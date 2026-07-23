/* game.js — 游戏主循环：调度器驱动音乐，rAF 只负责渲染与超时判定
 *
 * 判定口径（普通音符）：
 *   按键时刻（ctx 时间）与音符目标时间之差
 *   |dt| <= 50ms  → PERFECT
 *   |dt| <= 120ms → GOOD
 *   超过 120ms 未按 → MISS；按在空处 → 挥空（断连击）
 *
 * 扩展机制（由关卡声明）：
 *   双键（usesAlt）：音符带 key 字段（'main'|'alt'），按错键直接判 MISS
 *   长按（音符带 dur）：按下命中得 1 分并进入 holding，松开时刻再判一次，
 *   松开命中再得 1 分；过早/过晚松开或一直不放均判 MISS
 */
'use strict';

const Game = {
  PERFECT: 0.05,
  GOOD: 0.12,

  level: null,
  chart: [],
  running: false,
  onFinish: null,

  score: 0,
  combo: 0,
  maxCombo: 0,
  judges: { perfect: 0, good: 0, miss: 0 },
  whiffs: 0,

  effects: [],    // 判定浮字 { text, color, t }
  particles: [],  // 粒子 { x, y, vx, vy, life, color, size }

  _scheduler: null,
  _nextStep: 0,

  start(level, onFinish, mode) {
    this.level = level;
    this.onFinish = onFinish;
    this.mode = mode || 'easy';
    level.mode = this.mode;
    // 关卡可通过 setup(mode) 提供不同模式的 bpm / totalBeats，缺省用静态值（easy）
    const su = level.setup ? level.setup(this.mode) : null;
    this.bpm = (su && su.bpm) || level.bpm;
    this.totalBeats = (su && su.totalBeats) || level.totalBeats;
    Conductor.start(this.bpm);
    this.chart = level.buildChart(this.mode);
    for (const n of this.chart) {
      n.time = Conductor.beatToTime(n.beat);
      n.state = 'pending';
    }
    this.score = 0; this.combo = 0; this.maxCombo = 0; this.whiffs = 0;
    this.judges = { perfect: 0, good: 0, miss: 0 };
    this.effects = []; this.particles = [];
    this.delayedFx = []; // judgeDelay 延迟反馈队列
    this._nextStep = 0;
    level.init(this);
    this.running = true;
    this._scheduler = setInterval(() => this.schedule(), 25);
  },

  stop() {
    this.running = false;
    AudioEngine.fillStop();
    AudioEngine.choirStop();
    if (this._scheduler) { clearInterval(this._scheduler); this._scheduler = null; }
  },

  // lookahead 调度：把未来 0.15s 内的半拍事件排入音频时间轴
  schedule() {
    if (!this.running) return;
    const horizon = AudioEngine.now() + 0.15;
    while (true) {
      const beat = this._nextStep / 2;
      if (beat > this.totalBeats) break;
      const t = Conductor.beatToTime(beat);
      if (t >= horizon) break;
      this.level.scheduleStep(this._nextStep, t, this);
      this._nextStep++;
    }
  },

  // 判定反馈：judgeDelay（拍）>0 时延迟到滞空结束才公布结果（小狗飞盘用）
  feedback(res, text, color) {
    const delay = (this.level.judgeDelay || 0) * Conductor.secPerBeat();
    if (delay > 0) {
      this.delayedFx.push({ at: Conductor.songTime() + delay, text, color, res });
    } else {
      this.addEffect(text, color);
      if (res === 'miss') AudioEngine.sfxMiss();
    }
  },

  // 玩家按键。key: 'main' | 'alt'
  press(key) {
    if (!this.running) return;
    const t = AudioEngine.now();
    let best = null, bestAbs = Infinity;
    for (const n of this.chart) {
      if (n.state !== 'pending') continue;
      const a = Math.abs(t - n.time);
      if (a <= this.GOOD && a < bestAbs) { best = n; bestAbs = a; }
    }
    if (!best) {
      this.combo = 0;
      this.whiffs++;
      AudioEngine.sfxWhiff();
      this.addEffect('挥空…', '#9a94b8');
      this.level.onWhiff(this);
      return;
    }
    // 双键关：按错键 → 该音符直接 MISS
    if (best.key && best.key !== key) {
      best.state = 'miss';
      best.result = 'wrong';
      this.judges.miss++;
      this.combo = 0;
      this.feedback('miss', '按错了!', '#e85d5d');
      this.level.onJudge(this, best, 'miss');
      return;
    }
    const res = bestAbs <= this.PERFECT ? 'perfect' : 'good';
    if (best.dur) {
      // 长按音符：按下命中得 1 分，等待松开判定
      best.state = 'holding';
      best.pressRes = res;
      this.score += 1;
      if (this.level.onPress) this.level.onPress(this, best, res);
      return;
    }
    best.state = 'hit';
    best.result = res;
    this.judges[res]++;
    this.score += res === 'perfect' ? 2 : 1;
    this.combo++;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    this.feedback(res, res === 'perfect' ? 'PERFECT!' : 'GOOD', res === 'perfect' ? '#ffd94d' : '#7de38b');
    this.level.onJudge(this, best, res);
  },

  // 玩家松开按键（长按音符专用）
  release(key) {
    if (!this.running || key !== 'main') return;
    const n = this.chart.find(n => n.state === 'holding');
    if (!n) return; // 没有正在按住的音符，忽略
    const t = AudioEngine.now();
    const endT = n.time + n.dur * Conductor.secPerBeat();
    const a = Math.abs(t - endT);
    const relRes = a <= this.PERFECT ? 'perfect' : (a <= this.GOOD ? 'good' : 'bad');
    n.releaseRes = relRes;
    if (relRes === 'bad') {
      n.state = 'miss';
      this.judges.miss++;
      this.combo = 0;
      AudioEngine.sfxMiss();
      this.addEffect(t < endT ? '太早松开!' : '太晚松开!', '#e85d5d');
      if (this.level.onRelease) this.level.onRelease(this, n, 'miss');
    } else {
      n.state = 'hit';
      this.score += 1;
      const overall = (n.pressRes === 'perfect' && relRes === 'perfect') ? 'perfect' : 'good';
      this.judges[overall]++;
      this.combo++;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;
      this.addEffect(overall === 'perfect' ? 'PERFECT!' : 'GOOD', overall === 'perfect' ? '#ffd94d' : '#7de38b');
      if (this.level.onRelease) this.level.onRelease(this, n, relRes);
    }
  },

  update(dt) {
    if (!this.running) return;
    const now = AudioEngine.now();
    const st = Conductor.songTime();
    const spb = Conductor.secPerBeat();
    // 延迟判定反馈（judgeDelay：滞空结束才公布）
    for (const fx of this.delayedFx) {
      if (!fx.done && st >= fx.at) {
        fx.done = true;
        this.addEffect(fx.text, fx.color);
        if (fx.res === 'miss') AudioEngine.sfxMiss();
        else if (fx.res === 'perfect') AudioEngine.tone(AudioEngine.now(), 1320, 0.09, 'square', 0.18);
      }
    }
    this.delayedFx = this.delayedFx.filter(fx => !fx.done);
    for (const n of this.chart) {
      // MISS：超过判定窗仍未按（n.time 是 ctx 绝对时间，必须用 now 比较）
      if (n.state === 'pending' && now - n.time > this.GOOD) {
        n.state = 'miss';
        this.judges.miss++;
        this.combo = 0;
        this.feedback('miss', 'MISS', '#e85d5d');
        this.level.onJudge(this, n, 'miss');
      }
      // 长按音符：一直按住不放，超过松开判定窗 → MISS（灌太满）
      if (n.state === 'holding' && now - (n.time + n.dur * spb) > this.GOOD) {
        n.state = 'miss';
        this.judges.miss++;
        this.combo = 0;
        AudioEngine.sfxMiss();
        this.addEffect('没松开!', '#e85d5d');
        if (this.level.onRelease) this.level.onRelease(this, n, 'over');
      }
    }
    // 结束
    const endTime = this.totalBeats * spb;
    if (st > endTime + 1.2) { this.finish(); return; }
    // 特效推进
    for (const e of this.effects) e.t += dt;
    this.effects = this.effects.filter(e => e.t < 0.7);
    for (const p of this.particles) {
      p.vy += 900 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter(p => p.life > 0);
  },

  finish() {
    this.stop();
    const max = this.chart.length * 2;
    const acc = max > 0 ? this.score / max : 0;
    let rank, comment;
    if (acc >= 0.9) { rank = 'S'; comment = '太出色了！节奏感爆棚！'; }
    else if (acc >= 0.75) { rank = 'A'; comment = '相当不错！'; }
    else if (acc >= 0.55) { rank = 'B'; comment = '还行，再加把劲！'; }
    else { rank = 'C'; comment = '嗯……多练练吧。'; }
    if (this.onFinish) {
      this.onFinish({
        rank, comment, acc,
        score: this.score, max,
        judges: this.judges,
        maxCombo: this.maxCombo,
        whiffs: this.whiffs,
        level: this.level
      });
    }
  },

  // 供关卡调用：粒子爆发
  burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 120 + Math.random() * 320;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 150,
        life: 0.5 + Math.random() * 0.4,
        color,
        size: 3 + Math.random() * 5
      });
    }
  },

  addEffect(text, color) {
    this.effects.push({ text, color, t: 0 });
  },

  draw(ctx) {
    this.level.draw(this, ctx);

    // 粒子
    for (const p of this.particles) {
      ctx.globalAlpha = Math.min(1, p.life / 0.4);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // 判定浮字
    for (const e of this.effects) {
      ctx.globalAlpha = 1 - e.t / 0.7;
      const size = e.text === 'PERFECT!' ? 40 : 32;
      Draw.text(ctx, e.text, 480, 180 - e.t * 70, size, e.color);
    }
    ctx.globalAlpha = 1;

    // HUD：关卡名 / 连击 / 进度条
    Draw.text(ctx, this.level.name, 16, 24, 18, 'rgba(255,255,255,0.8)', 'left');
    if (this.combo >= 2) {
      const size = 26 + Math.min(this.combo, 30) * 0.4;
      Draw.text(ctx, this.combo + ' 连击!', 480, 46, size, '#ffd94d');
    }
    const prog = Math.max(0, Math.min(1, Conductor.songBeat() / this.totalBeats));
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(0, 0, 960, 5);
    ctx.fillStyle = '#ffd94d';
    ctx.fillRect(0, 0, 960 * prog, 5);
  }
};

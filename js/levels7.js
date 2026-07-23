/* levels7.js — 第 20 关 · 小狗飞盘（致敬 Frisbee Dog）
 * 主人抛出飞盘后数拍：抛球音高告诉你数几拍（低=6 拍 / 中=7 拍 / 高=8 拍）。
 * 数到拍起跳——小狗腾空约 1.5 拍后与飞盘相遇，判定结果也在相遇瞬间才公布
 * （judgeDelay：引擎延迟 PERFECT/GOOD/MISS 的公布）。
 * 前半段飞盘全程可见（带落点与节拍点），后半段飞出画面，心里默数！
 * 三模式：easy=原谱；normal=11 次投掷（6/8 拍混合更多，含连续近间隔），bpm×1.1；
 * hard=拍数 5~8 与间隔种子随机（新增超低音=5 拍），BLIND_FROM 提前到 30，bpm 110。
 *
 * 【注册方式】本关用 splice 插到 LevelRemix 之前（大团圆永远是最后一关），
 * 后续新增关卡文件也请沿用这一约定。
 */
'use strict';

const LevelFrisbee = {
  id: 'frisbee',
  name: '第 20 关 · 小狗飞盘',
  desc: '听抛球音数拍：低音=6拍、中音=7拍、高音=8拍！数到就跳——腾空 1.5 拍后与飞盘相遇，那时才知道接没接到！',
  hint: '空格 / 点击 = 起跳接飞盘 · Esc = 退出',
  bpm: 100,
  totalBeats: 70,

  judgeDelay: 1.5,  // 判定结果延迟 1.5 拍公布（腾空相遇瞬间）
  AIRTIME: 1.5,     // 起跳到接盘的拍数
  OX: 200,          // 主人 x
  DX: 700,          // 小狗 x
  FY: 250,          // 飞盘平飞高度
  BLIND_FROM: 38,   // 从这一拍开始进入「心里默数」阶段

  // [抛出拍, 拍数]（easy：与原谱一致）
  throws: [
    [4, 7], [12, 7], [20, 6], [28, 7],
    [36, 7], [44, 8], [52, 6], [60, 7]
  ],

  // normal：11 次投掷，6/8 拍混合更多；[56,7]→[64,6]→[71,6] 含连续两次近间隔投掷
  throwsNormal: [
    [4, 7], [12, 8], [22, 6], [30, 7], [38, 8], [48, 6],
    [56, 7], [64, 6], [71, 6], [80, 7], [90, 8]
  ],

  setup(mode) {
    if (mode === 'normal') return { bpm: this.bpm * 1.1, totalBeats: 102 };
    if (mode === 'hard') return { bpm: 110, totalBeats: 84 };
    return null; // easy：用静态 bpm / totalBeats
  },

  // hard：拍数 5~8、相遇后 2~4 拍再抛（种子随机，每次不同）
  genHardThrows() {
    const rnd = mulberry32(Date.now() % 100000);
    const throws = [];
    for (let c = 4; c <= 72;) {
      const n = 5 + Math.floor(rnd() * 4); // 5~8 拍
      throws.push([c, n]);
      c += n + 2 + Math.floor(rnd() * 3);  // 相遇后 2~4 拍随机休止
    }
    return throws;
  },

  buildChart(mode) {
    mode = mode || 'easy';
    const throws = mode === 'hard' ? this.genHardThrows()
      : mode === 'normal' ? this.throwsNormal
      : this.throws;
    // 结构化解算：scheduleStep / draw 统一读 this._cur（easy 也走这里）
    this._cur = {
      throws,
      blindFrom: mode === 'hard' ? 30 : mode === 'normal' ? 46 : this.BLIND_FROM,
      ext: mode === 'hard' // 是否启用 5 拍超低音
    };
    return throws.map(([c, n], i) => ({ beat: c + n, throw: c, count: n, idx: i }));
  },

  init(game) {
    game.fr = { jumpT: -9, sadT: -9, happyT: -9 };
  },

  // 抛球音高：5 拍超低 / 6 拍低 / 7 拍中 / 8 拍高（音高即拍数）
  throwPitch(n) {
    return n === 5 ? 660 : n === 6 ? 740 : n === 8 ? 1046 : 880;
  },

  scheduleStep(step, t, game) {
    const beat = step / 2;
    const spb = Conductor.secPerBeat();
    if (step % 2 === 0) {
      const b = ((beat % 4) + 4) % 4;
      // 公园轻快伴奏
      if (b === 0 || b === 2) AudioEngine.kick(t);
      if (b === 1 || b === 3) AudioEngine.snare(t);
      AudioEngine.tone(t, [130.81, 98, 110, 98][b], spb * 0.4, 'triangle', 0.16);
      AudioEngine.tone(t, [523.25, 659.25, 587.33, 659.25][b], spb * 0.3, 'square', 0.05);
      if (beat < 4) AudioEngine.blok(t, beat === 3 ? 1320 : 880);
    } else {
      AudioEngine.hihat(t, false);
    }
    for (const n of game.chart) {
      // 抛出：挥臂破空 + 「走！」（音高=拍数）
      if (beat === n.throw) {
        AudioEngine.swish(t);
        AudioEngine.blok(t + spb * 0.25, this.throwPitch(n.count));
      }
      // 可见阶段：飞行途中每拍一个轻响，帮你数拍
      if (n.throw < this._cur.blindFrom && beat > n.throw && beat < n.beat && step % 2 === 0) {
        AudioEngine.tone(t, 1568, 0.05, 'sine', 0.1);
      }
    }
  },

  onJudge(game, note, res) {
    const st = Conductor.songTime();
    const spb = Conductor.secPerBeat();
    const catchAt = AudioEngine.now() + this.AIRTIME * spb; // 相遇瞬间才出声
    if (res === 'miss') {
      game.fr.sadT = st + this.AIRTIME * spb; // 沮丧也在相遇时
      note.missT = st;
      AudioEngine.punch(catchAt); // 飞盘砸头「嘭」
    } else {
      game.fr.jumpT = st;         // 按下即起跳
      note.hitT = st;
      note.result = res;
      AudioEngine.chomp(catchAt); // 相遇瞬间「接住！」
      AudioEngine.tone(catchAt, 1760, 0.14, 'sine', 0.16);
      game.fr.happyT = st + this.AIRTIME * spb;
    }
  },

  onWhiff(game) {
    game.fr.sadT = Conductor.songTime();
  },

  // 平飞的飞盘：恒定高度 + 轻微浮动，碟片侧视旋转（宽度脉动）
  drawDisc(ctx, x, y, st) {
    ctx.save();
    ctx.translate(x, y);
    const spin = Math.abs(Math.cos(st * 9));
    ctx.fillStyle = '#ff5da2';
    ctx.beginPath(); ctx.ellipse(0, 0, 22 * (0.35 + 0.65 * spin), 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(0, -2, 12 * (0.35 + 0.65 * spin), 3.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // 平飞拖尾
    ctx.fillStyle = 'rgba(255,93,162,0.22)';
    ctx.beginPath(); ctx.ellipse(x - 36, y, 12, 3, 0, 0, Math.PI * 2); ctx.fill();
  },

  draw(game, ctx) {
    const st = Conductor.songTime();
    const beat = Conductor.songBeat();
    const spb = Conductor.secPerBeat();
    const fr = game.fr;
    const blind = beat >= this._cur.blindFrom;

    // 背景：公园
    const sky = ctx.createLinearGradient(0, 0, 0, 380);
    sky.addColorStop(0, '#6ec6ff');
    sky.addColorStop(1, '#d8f2ff');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 960, 380);
    ctx.fillStyle = '#fff8d0';
    ctx.beginPath(); ctx.arc(820, 66, 34, 0, Math.PI * 2); ctx.fill();
    const drift = (st * 9) % 1200;
    Draw.cloud(ctx, 980 - drift, 84, 0.9);
    Draw.cloud(ctx, 560 - drift, 140, 0.6);
    // 树
    for (const tx of [90, 880]) {
      ctx.fillStyle = '#8d6e63';
      ctx.fillRect(tx - 10, 260, 20, 130);
      ctx.fillStyle = '#5aa33e';
      ctx.beginPath(); ctx.arc(tx, 230, 58, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(tx - 34, 258, 40, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(tx + 34, 258, 40, 0, Math.PI * 2); ctx.fill();
    }
    Draw.ground(ctx, 380, '#8fd45e');
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, 440); ctx.lineTo(960, 440); ctx.stroke();

    // 飞盘：从抛出到相遇点（note.beat + AIRTIME）平飞；错过则飞过小狗继续向前
    for (const n of game.chart) {
      const catchBeat = n.beat + this.AIRTIME;
      if (beat < n.throw || beat > catchBeat + 0.8) continue;
      if (n.state === 'hit') continue; // 被接住了
      // 相遇前的飞行进度；相遇后（miss）继续向右飞并下坠
      let fx, fy;
      if (beat <= catchBeat) {
        const p = (beat - n.throw) / (n.count + this.AIRTIME);
        fx = this.OX + (this.DX - this.OX) * p;
        fy = this.FY + Math.sin(beat * 3) * 6;
      } else {
        const f = beat - catchBeat;
        fx = this.DX + f * 260;
        fy = this.FY + f * f * 320;
      }
      // 默数阶段：飞出视野后隐藏
      if (blind && beat > n.throw + 1 && beat <= catchBeat) continue;
      this.drawDisc(ctx, fx, fy, st);
      // 可见阶段：落点虚线圈 + 节拍点（亮满即跳）
      if (!blind && n.state === 'pending') {
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 5]);
        ctx.beginPath(); ctx.arc(this.DX, 330, 40, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        for (let i = 0; i < n.count; i++) {
          const lit = beat >= n.throw + i + 1;
          ctx.fillStyle = lit ? '#ffd94d' : 'rgba(255,255,255,0.45)';
          ctx.beginPath();
          ctx.arc(this.DX + (i - (n.count - 1) / 2) * 22, 250, 7, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // 默数阶段提示
    if (blind && game.chart.some(n => n.state === 'pending' && beat >= n.throw && beat < n.beat)) {
      Draw.text(ctx, '心里默数…', 480, 120, 34, '#1565c0');
    }

    // 主人（戴帽羊驼）：抛球动作
    const throwing = game.chart.some(n => beat >= n.throw && beat - n.throw < 0.4);
    Animals.alpaca(ctx, this.OX, 380, 44, {
      color: '#f0e6d2',
      mood: throwing ? 'happy' : 'idle',
      cap: '#1565c0',
      stretch: throwing ? 0.35 : 0
    });
    if (throwing) {
      Draw.text(ctx, '走！', this.OX + 60, 240, 28, '#1565c0');
    }
    Draw.text(ctx, '主人', this.OX, 470, 18, 'rgba(0,0,0,0.5)');

    // 小狗（玩家）：按下起跳，腾空 1.5 拍到最高点（相遇点），3 拍落地
    let dogY = 392;
    let caught = false;
    const airTotal = 3 * spb;
    if (st - fr.jumpT >= 0 && st - fr.jumpT < airTotal) {
      const p = (st - fr.jumpT) / airTotal;
      dogY = 392 - Math.sin(p * Math.PI) * 100; // 峰值在 1.5 拍
    }
    // 相遇瞬间接住：飞盘叼在嘴里
    if (st - fr.happyT >= 0 && st - fr.happyT < 1.2) caught = true;
    let mood = 'idle';
    if (st - fr.sadT < 0.7) mood = 'sad';
    else if (st - fr.happyT < 1.2 || (st - fr.jumpT >= 0 && st - fr.jumpT < airTotal)) mood = 'happy';
    Animals.dog(ctx, this.DX, dogY, 36, {
      color: '#c98d5e',
      mood,
      tailWag: Math.sin(st * (mood === 'happy' ? 12 : 6)) * 0.5 + 0.5
    });
    if (caught) {
      ctx.fillStyle = '#ff5da2';
      ctx.beginPath(); ctx.ellipse(this.DX + 30, dogY - 14, 14, 5, 0.3, 0, Math.PI * 2); ctx.fill();
    }
    Draw.text(ctx, '▼ 你', this.DX, 470, 20, '#c62828');

    // 教学提示（开头）
    if (beat >= 0 && beat < 4) {
      Draw.text(ctx, this._cur.ext
        ? '听抛球音数拍：超低=5 低=6 中=7 高=8，数到就跳！'
        : '听抛球音数拍：低=6 中=7 高=8，数到就跳！', 480, 120, 28, 'rgba(255,255,255,0.95)');
    }
  }
};

/* ---------- 注册：插到大团圆 Remix 之前（它永远是最后一关） ---------- */
Levels.splice(Levels.indexOf(LevelRemix), 0, LevelFrisbee);

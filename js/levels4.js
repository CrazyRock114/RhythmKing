/* levels4.js — 第四批关卡（第 11~14 关）
 *   第 11 关 · 踢踏舞（Tap Trial）：三连音模仿，听「哒哒哒」跟踢
 *   第 12 关 · 合唱团（Glee Club）：听指挥「唱！」按住、「停！」松开
 *   第 13 关 · 贪吃和尚（Munchy Monk）：听唱数吃包子（半拍一口）
 *   第 14 关 · 打包小能手（Packing）：双键分拣，空格接糖 / F 拍虫
 * 关卡接口与 levels.js 相同；长按（onPress/onRelease）与双键（usesAlt）扩展见 levels2.js。
 * 每关支持 easy/normal/hard 三模式：setup(mode) 返回 bpm/totalBeats（easy 返回 null 用静态值），
 * buildChart(mode) 生成谱面并把结构数据（组/乐句/指令/物品表）存到 this._cur，scheduleStep/draw 统一读 _cur；
 * hard 谱面在 setup 里用 mulberry32 种子一次生成并暂存 _hardGen（totalBeats 需先于 buildChart 确定），buildChart 消费。
 */
'use strict';

/* ================================================================
 * 第 11 关 · 踢踏舞
 * 示范猫踢一组三连音（1/3 拍间隔），下一拍玩家原样踢回去。
 * 注意：1/3 拍不在半拍调度网格上，示范声在组首拍一次性排 3 个。
 * ============================================================== */
const LevelTapTrial = {
  id: 'taptrial',
  name: '第 11 关 · 踢踏舞',
  desc: '三连音！听同伴「哒哒哒」，下一拍换你！后面还有六连音和二连音的变化。',
  hint: '空格 / 点击 = 踢踏 · Esc = 退出',
  bpm: 100,
  totalBeats: 40,

  // 组首拍与花样：tri=三连音（1 拍 3 下）、six=六连音（2 拍 6 下）、half=二连音（2 拍 2 下）
  // off-tri=反拍三连（normal/hard 新增：示范从 c+0.5 起，回应相应顺延半拍）
  groups: [
    [4, 'tri'], [6, 'tri'], [8, 'six'], [12, 'tri'], [16, 'half'],
    [18, 'tri'], [22, 'six'], [26, 'tri'], [30, 'half'], [32, 'tri'], [36, 'six']
  ],

  // normal：14 组，加入 off-tri 花样
  groupsNormal: [
    [4, 'tri'], [6, 'tri'], [8, 'six'], [12, 'off-tri'], [15, 'tri'],
    [18, 'half'], [21, 'off-tri'], [24, 'six'], [28, 'tri'], [31, 'off-tri'],
    [34, 'half'], [38, 'tri'], [44, 'six'], [50, 'off-tri']
  ],

  // 三模式：normal 提速 1.1 倍；hard 谱面种子随机，一次生成并暂存（totalBeats 需先于 buildChart 确定）
  setup(mode) {
    if (mode === 'normal') return { bpm: 100 * 1.1, totalBeats: 56 };
    if (mode === 'hard') {
      this._hardGen = this._genHard(mulberry32(Date.now() % 100000));
      return { bpm: 112, totalBeats: this._hardGen.totalBeats };
    }
    return null; // easy：用静态 bpm/totalBeats
  },

  // hard：16 组，花样（tri/six/half/off-tri）种子随机，组间隔至少 2 拍 + 随机休止
  _genHard(rnd) {
    const types = ['tri', 'six', 'half', 'off-tri'];
    const groups = [];
    let c = 4, end = 4;
    for (let i = 0; i < 16; i++) {
      const type = types[Math.floor(rnd() * types.length)];
      groups.push([c, type]);
      const offs = this.demoOffsets(type);
      end = c + this.respStart(type) + offs[offs.length - 1]; // 本组回应结束拍
      c += Math.ceil(end - c) + 2 + (rnd() < 0.3 ? 1 : 0);
    }
    return { groups, totalBeats: Math.ceil(end) + 2 };
  },

  // 示范击打的拍偏移（相对组首 c）
  demoOffsets(type) {
    if (type === 'six') return [0, 1 / 3, 2 / 3, 1, 4 / 3, 5 / 3];
    if (type === 'half') return [0, 1];
    if (type === 'off-tri') return [0.5, 5 / 6, 7 / 6];
    return [0, 1 / 3, 2 / 3];
  },

  // 回应起点（示范结束后 1 拍开始；off-tri 顺延半拍）
  respStart(type) {
    if (type === 'tri') return 1;
    if (type === 'off-tri') return 1.5;
    return 2;
  },

  buildChart(mode) {
    mode = mode || 'easy';
    let groups;
    if (mode === 'hard') {
      const gen = this._hardGen || this._genHard(mulberry32(Date.now() % 100000));
      this._hardGen = null;
      groups = gen.groups;
    } else {
      groups = mode === 'normal' ? this.groupsNormal : this.groups;
    }
    this._cur = { groups }; // scheduleStep/draw 统一读 _cur
    const notes = [];
    for (const [c, type] of groups) {
      const rs = this.respStart(type);
      this.demoOffsets(type).forEach((off, i) => {
        notes.push({ beat: c + rs + off, tap: i });
      });
    }
    return notes;
  },

  init(game) {
    game.tap = { tapT: -9, sadT: -9, stumbleT: -9, taps: 0 };
  },

  scheduleStep(step, t, game) {
    const beat = step / 2;
    const spb = Conductor.secPerBeat();
    if (step % 2 === 0) {
      const b = ((beat % 4) + 4) % 4;
      // 摇摆爵士：大鼓 1、3 拍，军鼓 2、4 拍
      if (b === 0 || b === 2) AudioEngine.kick(t);
      if (b === 1 || b === 3) AudioEngine.snare(t);
      // 行走贝斯（低音三角波，别抢踢踏声）
      AudioEngine.tone(t, [82.41, 98, 110, 123.47][b], spb * 0.45, 'triangle', 0.14);
      // ride 镲：正拍 + 摇摆位（2/3 拍处）
      AudioEngine.hihat(t, false);
      AudioEngine.hihat(t + spb * 2 / 3, false);
      // 预备拍
      if (beat < 4) AudioEngine.blok(t, beat === 3 ? 1320 : 880);
    }
    // 示范踢踏：1/3 拍不在半拍网格上，覆盖到组首拍 c 时按拍偏移一次性排整组
    for (const [c, type] of this._cur.groups) {
      if (beat === c) {
        this.demoOffsets(type).forEach((off) => {
          AudioEngine.tick(t + off * spb, 1600);
        });
      }
    }
  },

  onJudge(game, note, res) {
    const st = Conductor.songTime();
    if (res === 'miss') {
      game.tap.sadT = st;
    } else {
      game.tap.tapT = st;
      game.tap.taps++;
      // 玩家的踢踏声更亮一度，踩对即融入
      AudioEngine.tick(AudioEngine.now(), 2000);
      game.burst(650, 432, '#d8c9a8', 4);
    }
  },

  onWhiff(game) {
    game.tap.stumbleT = Conductor.songTime();
  },

  // 踢踏礼帽（猫没有帽子参数，手动补一顶；y 与身体同步传入）
  hat(ctx, x, y, s) {
    ctx.fillStyle = '#26232e';
    ctx.beginPath(); ctx.ellipse(x, y - s * 1.18, s * 0.56, s * 0.1, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(x - s * 0.32, y - s * 1.68, s * 0.64, s * 0.52);
    ctx.fillStyle = '#c62828';
    ctx.fillRect(x - s * 0.32, y - s * 1.3, s * 0.64, s * 0.12);
  },

  // 踢踏尘土（age 单位为拍）
  dust(ctx, x, y, age) {
    const a = Math.max(0, 1 - age / 0.3) * 0.5;
    ctx.fillStyle = 'rgba(216,201,168,' + a.toFixed(3) + ')';
    const r = 4 + age * 55;
    ctx.beginPath(); ctx.arc(x - 14 - age * 30, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 14 + age * 30, y - 3, r * 0.8, 0, Math.PI * 2); ctx.fill();
  },

  draw(game, ctx) {
    const st = Conductor.songTime();
    const beat = Conductor.songBeat();
    const tp = game.tap;

    // 背景：剧场
    const bg = ctx.createLinearGradient(0, 0, 0, 540);
    bg.addColorStop(0, '#4a1f3d');
    bg.addColorStop(1, '#241026');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 960, 540);
    // 墙面小金星（闪烁）
    for (let i = 0; i < 14; i++) {
      const sx = 60 + (i * 173) % 860;
      const sy = 60 + (i * 97) % 300;
      const tw = 0.25 + 0.2 * Math.sin(st * 2.4 + i * 1.7);
      ctx.fillStyle = 'rgba(255,217,77,' + tw.toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(sx, sy, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    // 幕布（顶部波浪 + 两侧垂帘）
    ctx.fillStyle = '#7a1f2b';
    ctx.fillRect(0, 0, 960, 26);
    for (let i = 0; i < 12; i++) {
      ctx.beginPath(); ctx.arc(i * 87 + 24, 26, 26, 0, Math.PI); ctx.fill();
    }
    ctx.fillRect(0, 0, 44, 190);
    ctx.fillRect(916, 0, 44, 190);
    ctx.fillStyle = '#5e1620';
    ctx.fillRect(30, 26, 8, 160);
    ctx.fillRect(922, 26, 8, 160);

    // 当前阶段：示范窗口 [c, c+rs)，回应窗口 [c+rs, c+2rs)
    let demo = null, respOn = false;
    for (const [c, type] of this._cur.groups) {
      const rs = this.respStart(type);
      if (beat >= c && beat < c + rs) demo = { c, type };
      if (beat >= c + rs && beat < c + rs * 2) respOn = true;
    }

    // 舞台地板（木纹）
    Draw.ground(ctx, 430, '#7a4a2f');
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 2;
    for (let x = 40; x < 960; x += 90) {
      ctx.beginPath(); ctx.moveTo(x, 430); ctx.lineTo(x - 20, 540); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,235,190,0.12)';
    ctx.fillRect(0, 430, 960, 5);

    // 聚光灯：示范段照左边两只示范猫，回应段照玩家
    const spot = (cx, active) => {
      const g = ctx.createLinearGradient(0, 0, 0, 470);
      g.addColorStop(0, active ? 'rgba(255,236,170,0.32)' : 'rgba(255,236,170,0.07)');
      g.addColorStop(1, 'rgba(255,236,170,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(cx - 24, -10);
      ctx.lineTo(cx - 130, 470);
      ctx.lineTo(cx + 130, 470);
      ctx.lineTo(cx + 24, -10);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = active ? 'rgba(255,236,170,0.22)' : 'rgba(255,236,170,0.05)';
      ctx.beginPath(); ctx.ellipse(cx, 452, 120, 15, 0, 0, Math.PI * 2); ctx.fill();
    };
    spot(350, !!demo);
    spot(650, respOn);

    // 脚灯（一排暖色小灯随节奏呼吸）
    for (let i = 0; i < 12; i++) {
      const glow = 0.55 + 0.35 * Math.sin(beat * Math.PI + i);
      ctx.fillStyle = 'rgba(255,217,77,' + glow.toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(i * 84 + 18, 522, 7, 0, Math.PI * 2); ctx.fill();
    }

    // 示范猫踢踏动画：每下交替腿（按拍偏移定位最近一下，off-tri 起打前先不动）
    let dLeg = 0, dSquash = 0;
    if (demo) {
      const p = beat - demo.c;
      const offs = this.demoOffsets(demo.type);
      const div = demo.type === 'half' ? 1 : 3;
      let idx = -1;
      for (let i = 0; i < offs.length; i++) if (p >= offs[i]) idx = i;
      if (idx >= 0) {
        dLeg = idx % 2 === 0 ? 1 : -1;
        const q = (p - offs[idx]) * div;
        dSquash = Math.max(0, 0.14 * (1 - q * 2.5));
      }
      // 每一下的尘土与「哒」字
      offs.forEach((off) => {
        const dt = beat - (demo.c + off);
        if (dt > 0 && dt < 0.3) {
          this.dust(ctx, 270, 436, dt);
          this.dust(ctx, 430, 436, dt);
        }
        if (dt > 0 && dt < 0.4) {
          ctx.globalAlpha = 1 - dt / 0.4;
          Draw.text(ctx, '哒', 350, 296 - dt * 55, 26, '#ffe9b3');
          ctx.globalAlpha = 1;
        }
      });
    }

    // 两只示范猫（灰蓝色，动作同步；帽子与身体同一个 y）
    const bob = Math.sin(beat * Math.PI) * 3;
    for (const dx of [270, 430]) {
      const dy = 400 + (demo ? 0 : bob);
      Animals.cat(ctx, dx, dy, 38, {
        color: '#8fa8c8',
        mood: demo ? 'happy' : 'idle',
        legPhase: dLeg,
        squash: dSquash,
        armL: 0.5 - dLeg * 0.35,
        armR: 0.5 + dLeg * 0.35,
        tailUp: demo ? 1 : 0
      });
      this.hat(ctx, dx, dy, 38);
    }

    // 玩家猫（橙色）：命中时交替抬腿带尘土；帽子与身体同一个 y
    const tapping = st - tp.tapT < 0.22;
    const pLeg = tapping ? (tp.taps % 2 === 0 ? 1 : -1) : 0;
    let mood = 'idle';
    if (st - tp.sadT < 0.6 || st - tp.stumbleT < 0.4) mood = 'sad';
    else if (st - tp.tapT < 0.3) mood = 'happy';
    const py = 400 + (respOn ? 0 : bob);
    Animals.cat(ctx, 650, py, 40, {
      color: '#f5a35c',
      mood,
      legPhase: pLeg,
      squash: tapping ? 0.12 : 0,
      armL: 0.5 - pLeg * 0.35,
      armR: 0.5 + pLeg * 0.35,
      tailUp: tapping ? 1 : 0
    });
    this.hat(ctx, 650, py, 40);
    if (st - tp.tapT < 0.18) this.dust(ctx, 650, 438, (st - tp.tapT) / Conductor.secPerBeat());
    Draw.text(ctx, '▼ 你', 650, 300, 22, '#c62828');

    // 阶段提示
    if (demo) Draw.text(ctx, '听！', 350, 250, 32, '#ffe9b3');
    else if (respOn) Draw.text(ctx, '轮到你！', 650, 250, 32, '#7de38b');

    // 教学提示（预备拍）
    if (beat >= 0 && beat < 4) {
      Draw.text(ctx, '听同伴「哒哒哒」，下一拍换你「哒哒哒」！', 480, 130, 28, 'rgba(255,255,255,0.95)');
    }
  }
};

/* ================================================================
 * 第 12 关 · 合唱团
 * 两只同伴羊驼开口领唱（持续和弦），听到他们开唱就按住跟唱，
 * 他们收声你就松开——按与松全靠耳朵，不靠文字。
 * 按住期间 choirStart() 为你的声部，松开 choirStop()。
 * ============================================================== */
const LevelGlee = {
  id: 'glee',
  name: '第 12 关 · 合唱团',
  desc: '跟着同伴唱：他们开口你就按住跟唱，他们收声你就松开！',
  hint: '按住空格 = 跟唱 · 同伴收声时松开 · Esc = 退出',
  bpm: 92,
  totalBeats: 46,

  // [开唱拍, 时长(拍)]
  holds: [[4, 1], [8, 2], [13, 1.5], [18, 3], [24, 2], [29, 1], [33, 2.5], [39, 3]],

  // normal：12 乐句，加入 2.5/3.5 拍长音，间隔更密
  holdsNormal: [
    [4, 1], [9, 2.5], [13, 1.5], [18, 3], [23, 2], [28, 3.5],
    [33, 1], [38, 2.5], [43, 2], [48, 3.5], [53, 1.5], [60, 3]
  ],

  // 三模式：normal 提速 1.1 倍；hard 乐句种子随机，一次生成并暂存（totalBeats 需先于 buildChart 确定）
  setup(mode) {
    if (mode === 'normal') return { bpm: 92 * 1.1, totalBeats: 66 };
    if (mode === 'hard') {
      this._hardGen = this._genHard(mulberry32(Date.now() % 100000));
      return { bpm: 100, totalBeats: this._hardGen.totalBeats };
    }
    return null; // easy：用静态 bpm/totalBeats
  },

  // hard：15 乐句，开唱拍/时长种子随机（dur∈{1,…,3.5}，间隔≥dur+2，再随机休 0~1 拍）
  _genHard(rnd) {
    const durs = [1, 1.5, 2, 2.5, 3, 3.5];
    const rests = [0, 0.5, 1];
    const holds = [];
    let c = 4;
    for (let i = 0; i < 15; i++) {
      const dur = durs[Math.floor(rnd() * durs.length)];
      holds.push([c, dur]);
      c += dur + 2 + rests[Math.floor(rnd() * rests.length)];
    }
    const last = holds[holds.length - 1];
    return { holds, totalBeats: Math.ceil(last[0] + last[1]) + 2 };
  },

  buildChart(mode) {
    mode = mode || 'easy';
    let holds;
    if (mode === 'hard') {
      const gen = this._hardGen || this._genHard(mulberry32(Date.now() % 100000));
      this._hardGen = null;
      holds = gen.holds;
    } else {
      holds = mode === 'normal' ? this.holdsNormal : this.holds;
    }
    this._cur = { holds }; // 领唱音频/绘制直接读 game.chart（与本谱面一致）
    return holds.map(([b, d]) => ({ beat: b, dur: d }));
  },

  init(game) {
    game.glee = { sadT: -9, happyT: -9 };
  },

  scheduleStep(step, t, game) {
    const beat = step / 2;
    const spb = Conductor.secPerBeat();
    if (step % 2 === 0) {
      const b = ((beat % 4) + 4) % 4;
      // 柔和圣咏：低音长音铺底（C C F G）
      AudioEngine.tone(t, [130.81, 130.81, 174.61, 196][b], spb * 0.95, 'sine', 0.13);
      // 预备拍
      if (beat < 4) AudioEngine.blok(t, beat === 3 ? 1320 : 880);
    } else if (beat >= 4) {
      // 半拍分解和弦（轻柔竖琴感）
      const arp = [523.25, 659.25, 783.99, 659.25];
      AudioEngine.tone(t, arp[Math.floor(beat) % 4], spb * 0.32, 'triangle', 0.05);
    }
    // 同伴领唱：乐句开始时唱出持续和弦直到乐句结束——开口你就按，收声你就松
    for (const n of game.chart) {
      if (beat === n.beat) {
        const durSec = n.dur * spb + 0.05;
        AudioEngine.tone(t, 220, durSec, 'triangle', 0.15);
        AudioEngine.tone(t, 277.18, durSec, 'triangle', 0.11);
        AudioEngine.tone(t, 329.63, durSec, 'triangle', 0.09);
      }
      // 开始前 1 拍：指挥轻声吸气提醒
      if (beat === n.beat - 1) AudioEngine.blok(t, 660);
    }
  },

  onPress(game, note, res) {
    AudioEngine.choirStart();
  },

  onRelease(game, note, res) {
    const st = Conductor.songTime();
    AudioEngine.choirStop();
    if (res === 'miss' || res === 'over') {
      game.glee.sadT = st;
    } else {
      game.glee.happyT = st;
      game.burst(480, 250, '#ffe9b3', 12);
    }
  },

  onJudge(game, note, res) {
    if (res === 'miss') game.glee.sadT = Conductor.songTime(); // 压根没开口
  },

  onWhiff(game) {},

  // 张开的嘴（羊驼没有张嘴参数，按脖子公式定位后覆盖绘制）
  openMouth(ctx, x, y, s, stretch) {
    const neckH = s * (1.1 + stretch * 0.7);
    const hy = y - s * 0.2 - neckH;
    ctx.fillStyle = '#6e2f2f';
    ctx.beginPath();
    ctx.ellipse(x, hy + s * 0.15, s * 0.085, s * 0.13, 0, 0, Math.PI * 2);
    ctx.fill();
  },

  // 从嘴边飘出的音符
  musicNotes(ctx, x, y, st, seed) {
    for (let j = 0; j < 3; j++) {
      const age = (st * 0.85 + j * 0.53 + seed) % 1.6;
      ctx.globalAlpha = 1 - age / 1.6;
      Draw.text(ctx, '♪', x + 16 * Math.sin(age * 3 + j * 2.1), y - age * 95, 20 + j * 4, '#ffe9b3');
    }
    ctx.globalAlpha = 1;
  },

  draw(game, ctx) {
    const st = Conductor.songTime();
    const beat = Conductor.songBeat();
    const gl = game.glee;

    // 背景：音乐厅
    const bg = ctx.createLinearGradient(0, 0, 0, 540);
    bg.addColorStop(0, '#3a2434');
    bg.addColorStop(1, '#241722');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 960, 540);
    // 三扇拱窗 + 光束
    for (let i = 0; i < 3; i++) {
      const wx = 180 + i * 300;
      ctx.fillStyle = 'rgba(255,220,150,0.14)';
      ctx.beginPath();
      ctx.moveTo(wx - 46, 240);
      ctx.lineTo(wx - 46, 110);
      ctx.arc(wx, 110, 46, Math.PI, 0);
      ctx.lineTo(wx + 46, 240);
      ctx.closePath(); ctx.fill();
      const beam = ctx.createLinearGradient(0, 130, 0, 460);
      beam.addColorStop(0, 'rgba(255,220,150,0.10)');
      beam.addColorStop(1, 'rgba(255,220,150,0)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(wx - 30, 140); ctx.lineTo(wx - 90, 460); ctx.lineTo(wx + 90, 460); ctx.lineTo(wx + 30, 140);
      ctx.closePath(); ctx.fill();
    }
    // 吊灯
    ctx.strokeStyle = '#8a6a3a';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(480, 0); ctx.lineTo(480, 52); ctx.stroke();
    ctx.fillStyle = '#c9a24d';
    ctx.beginPath(); ctx.arc(480, 66, 20, 0, Math.PI); ctx.fill();
    for (let i = -2; i <= 2; i++) {
      const glow = 0.5 + 0.3 * Math.sin(st * 2 + i);
      ctx.fillStyle = 'rgba(255,236,170,' + glow.toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(480 + i * 16, 78, 4, 0, Math.PI * 2); ctx.fill();
    }
    // 木地板 + 红毯
    Draw.ground(ctx, 430, '#6d4a33');
    ctx.fillStyle = 'rgba(180,60,70,0.45)';
    ctx.beginPath(); ctx.ellipse(480, 445, 260, 22, 0, 0, Math.PI * 2); ctx.fill();

    // 合唱状态：两侧羊驼跟着乐句唱，玩家跟着按键唱
    let choirSing = false;
    for (const n of game.chart) {
      if (beat >= n.beat && beat < n.beat + n.dur) choirSing = true;
    }
    const playerSing = game.chart.some(n => n.state === 'holding');

    // 三只羊驼（玩家在中间，系红领结）
    const bob = Math.sin(beat * Math.PI) * 3;
    const members = [
      { x: 330, s: 38, color: '#f0e6d2', sing: choirSing, player: false },
      { x: 480, s: 40, color: '#ffd9a0', sing: playerSing, player: true },
      { x: 630, s: 38, color: '#e2d4f0', sing: choirSing, player: false }
    ];
    for (const m of members) {
      const stretch = m.sing ? 0.3 : 0;
      let mood = 'idle';
      if (m.player) {
        if (st - gl.sadT < 0.7) mood = 'sad';
        else if (m.sing || st - gl.happyT < 0.5) mood = 'happy';
      } else if (m.sing) mood = 'happy';
      Animals.alpaca(ctx, m.x, 400 + (m.sing ? 0 : bob), m.s, {
        color: m.color,
        mood,
        stretch
      });
      if (m.sing) {
        this.openMouth(ctx, m.x, 400, m.s, stretch);
        this.musicNotes(ctx, m.x, 400 - m.s * 1.9, st, m.x * 0.01);
      }
      if (m.player) {
        // 红领结 + 标记
        ctx.fillStyle = '#c62828';
        ctx.beginPath();
        ctx.moveTo(m.x - 14, 386); ctx.lineTo(m.x, 392); ctx.lineTo(m.x - 14, 398);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(m.x + 14, 386); ctx.lineTo(m.x, 392); ctx.lineTo(m.x + 14, 398);
        ctx.closePath(); ctx.fill();
        Draw.text(ctx, '▼ 你', m.x, 262, 20, '#c62828');
      }
    }

    // 指挥口令气泡
    let cue = null;
    for (const n of game.chart) {
      if (beat >= n.beat - 1 && beat < n.beat - 0.1) cue = { text: '唱！', color: '#2e7d32' };
      if (beat >= n.beat + n.dur - 0.5 && beat < n.beat + n.dur + 0.25) cue = { text: '停！', color: '#c62828' };
    }
    if (cue) {
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#26232e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(576, 252, 96, 52, 12);
      else ctx.rect(576, 252, 96, 52, 12);
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(592, 300); ctx.lineTo(580, 324); ctx.lineTo(612, 302);
      ctx.closePath(); ctx.fill();
      Draw.text(ctx, cue.text, 624, 279, 28, cue.color);
    }

    // 指挥狗背影（燕尾服，面向合唱团挥棒）
    const raised = cue != null;
    const ang = raised ? -1.15 : -0.35 + Math.sin(beat * Math.PI) * 0.3;
    ctx.save();
    ctx.translate(480, 516);
    ctx.rotate(Math.sin(beat * Math.PI) * 0.03);
    // 身体（燕尾服）
    ctx.fillStyle = '#2f2f3a';
    ctx.beginPath(); ctx.ellipse(0, 16, 52, 44, 0, 0, Math.PI * 2); ctx.fill();
    // 燕尾
    ctx.beginPath();
    ctx.moveTo(-20, 44); ctx.lineTo(-30, 78); ctx.lineTo(-6, 50);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(20, 44); ctx.lineTo(30, 78); ctx.lineTo(6, 50);
    ctx.closePath(); ctx.fill();
    // 白衬衫领
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(-12, -18); ctx.lineTo(0, 2); ctx.lineTo(12, -18);
    ctx.closePath(); ctx.fill();
    // 后脑勺 + 垂耳
    ctx.fillStyle = '#c98d5e';
    ctx.beginPath(); ctx.arc(0, -34, 31, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#a8713f';
    ctx.beginPath(); ctx.ellipse(-27, -42, 10, 20, 0.35, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(27, -42, 10, 20, -0.35, 0, Math.PI * 2); ctx.fill();
    // 尾巴（随拍摇摆）
    ctx.strokeStyle = '#c98d5e';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-40, 30);
    ctx.quadraticCurveTo(-58, 20, -54 + Math.sin(beat * Math.PI * 2) * 6, 2);
    ctx.stroke();
    // 右臂 + 指挥棒
    ctx.save();
    ctx.translate(32, 4);
    ctx.rotate(ang);
    ctx.strokeStyle = '#2f2f3a';
    ctx.lineWidth = 11;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(26, -20); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(28, -22, 7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(32, -26); ctx.lineTo(58, -44); ctx.stroke();
    ctx.restore();
    ctx.restore();

    // 教学提示（预备拍）
    if (beat >= 0 && beat < 4) {
      Draw.text(ctx, '听到同伴开唱就按住，他们收声你就松！', 480, 130, 27, 'rgba(255,255,255,0.95)');
    }
  }
};

/* ================================================================
 * 第 13 关 · 贪吃和尚
 * 小鸟唱几个音（半拍一个）就吃个包子：唱 1 个吃 1 口，唱 3 个连吃 3 口。
 * 回应从指令后 2 拍开始，半拍一口。
 * ============================================================== */
const LevelMonk = {
  id: 'monk',
  name: '第 13 关 · 贪吃和尚',
  desc: '听数吃包子：唱几个音就吃几下（半拍一下）！',
  hint: '空格 / 点击 = 吃 · Esc = 退出',
  bpm: 108,
  totalBeats: 44,

  MX: 380,  // 和尚嘴 x
  MY: 327,  // 和尚嘴 y（与 Animals.monk 嘴部位置对齐）

  // [指令拍, 个数]：指令从指令拍起半拍唱一个音，回应从指令后 2 拍起半拍一口
  commands: [
    [4, 1], [7, 2], [10, 3], [14, 1], [16, 3], [19, 2],
    [22, 3], [26, 1], [28, 2], [31, 3], [35, 2], [38, 3]
  ],

  // normal：15 条指令，加入「4 个！」（半拍连吃 4 口）
  commandsNormal: [
    [4, 1], [7, 2], [10, 3], [14, 4], [18, 1], [21, 3], [24, 2],
    [28, 4], [32, 2], [35, 3], [39, 1], [43, 4], [47, 2], [51, 3], [56, 4]
  ],

  // 三模式：normal 提速 1.1 倍；hard 指令种子随机，一次生成并暂存（totalBeats 需先于 buildChart 确定）
  setup(mode) {
    if (mode === 'normal') return { bpm: 108 * 1.1, totalBeats: 62 };
    if (mode === 'hard') {
      this._hardGen = this._genHard(mulberry32(Date.now() % 100000));
      return { bpm: 118, totalBeats: this._hardGen.totalBeats };
    }
    return null; // easy：用静态 bpm/totalBeats
  },

  // hard：18 条指令，个数 1~4 种子随机 + 随机休止（回应结束与下一指令至少隔 1 拍）
  _genHard(rnd) {
    const commands = [];
    let c = 4;
    for (let i = 0; i < 18; i++) {
      const k = 1 + Math.floor(rnd() * 4);
      commands.push([c, k]);
      c += 2 + Math.ceil((k - 1) / 2) + (rnd() < 0.5 ? 1 : 2);
    }
    const last = commands[commands.length - 1];
    return { commands, totalBeats: Math.ceil(last[0] + 2 + (last[1] - 1) * 0.5) + 2 };
  },

  buildChart(mode) {
    mode = mode || 'easy';
    let commands;
    if (mode === 'hard') {
      const gen = this._hardGen || this._genHard(mulberry32(Date.now() % 100000));
      this._hardGen = null;
      commands = gen.commands;
    } else {
      commands = mode === 'normal' ? this.commandsNormal : this.commands;
    }
    this._cur = { commands }; // scheduleStep/draw 统一读 _cur
    const notes = [];
    for (const [c, k] of commands) {
      for (let i = 0; i < k; i++) notes.push({ beat: c + 2 + i * 0.5, k, idx: i });
    }
    return notes;
  },

  init(game) {
    game.monk = { chewT: -9, sadT: -9 };
  },

  scheduleStep(step, t, game) {
    const beat = step / 2;
    const spb = Conductor.secPerBeat();
    const b = ((beat % 4) + 4) % 4;
    // 禅寺伴奏：低鼓 + 五声音阶弹拨
    if (step % 2 === 0) {
      if (b === 0) AudioEngine.tone(t, 82, 0.18, 'sine', 0.24); // 堂鼓
      const mel = [659.25, 587.33, 523.25, 587.33, 659.25, 783.99, 880, 783.99];
      AudioEngine.tone(t, mel[Math.floor(beat) % 8], spb * 0.38, 'triangle', 0.07);
      if (b === 0) AudioEngine.tone(t, 130.81, spb * 1.6, 'sine', 0.07); // 低吟 drone
      // 预备拍
      if (beat < 4) AudioEngine.blok(t, beat === 3 ? 1320 : 880);
    }
    // 指令唱词：k 个音，半拍一个，音高逐个上扬
    for (const [c, k] of this._cur.commands) {
      for (let i = 0; i < k; i++) {
        if (beat === c + i * 0.5) AudioEngine.blok(t, 587 + i * 110);
      }
    }
  },

  onJudge(game, note, res) {
    const st = Conductor.songTime();
    if (res === 'miss') {
      game.monk.sadT = st;
      note.missT = st; // 包子掉地上
    } else {
      game.monk.chewT = st;
      AudioEngine.chomp(AudioEngine.now());
      game.burst(this.MX, this.MY, '#e8dcc0', 9); // 包子碎屑
    }
  },

  onWhiff(game) {
    // 咬了个空：嚼到空气
    game.monk.chewT = Conductor.songTime();
  },

  // 画一个包子
  bun(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#fdf6e8';
    ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f0e2c8';
    ctx.beginPath(); ctx.arc(0, -12, 4.5, 0, Math.PI * 2); ctx.fill(); // 顶部褶子
    ctx.strokeStyle = 'rgba(180,150,110,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 3, 10, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
    // 蒸汽
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 2;
    for (const dx of [-5, 5]) {
      ctx.beginPath();
      ctx.moveTo(dx, -18);
      ctx.quadraticCurveTo(dx + 4, -24, dx, -30);
      ctx.stroke();
    }
    ctx.restore();
  },

  draw(game, ctx) {
    const st = Conductor.songTime();
    const beat = Conductor.songBeat();
    const mk = game.monk;

    // 背景：禅寺
    const bg = ctx.createLinearGradient(0, 0, 0, 420);
    bg.addColorStop(0, '#efe0bd');
    bg.addColorStop(1, '#e0c99a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 960, 420);
    // 木梁与立柱
    ctx.fillStyle = '#8a5a3b';
    ctx.fillRect(0, 0, 960, 26);
    ctx.fillRect(60, 0, 20, 420);
    ctx.fillRect(880, 0, 20, 420);
    // 圆形窗（窗外竹影）
    ctx.save();
    ctx.beginPath(); ctx.arc(760, 170, 95, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#a8d48a';
    ctx.fillRect(660, 70, 200, 200);
    ctx.strokeStyle = '#5a8a4a';
    ctx.lineWidth = 7;
    for (const bx of [710, 760, 815]) {
      ctx.beginPath(); ctx.moveTo(bx, 70); ctx.lineTo(bx + 14, 270); ctx.stroke();
    }
    ctx.fillStyle = '#6fbf45';
    ctx.beginPath(); ctx.ellipse(730, 130, 26, 9, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(800, 190, 26, 9, 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#8a5a3b';
    ctx.lineWidth = 8;
    ctx.beginPath(); ctx.arc(760, 170, 95, 0, Math.PI * 2); ctx.stroke();
    // 挂轴「禅」
    ctx.fillStyle = '#f7efdc';
    ctx.fillRect(130, 70, 76, 150);
    ctx.strokeStyle = '#8a5a3b';
    ctx.lineWidth = 4;
    ctx.strokeRect(130, 70, 76, 150);
    Draw.text(ctx, '禅', 168, 145, 52, '#4a3a2a');
    // 榻榻米地面
    Draw.ground(ctx, 420, '#cbb877');
    ctx.strokeStyle = 'rgba(120,100,60,0.35)';
    ctx.lineWidth = 2;
    for (let y = 436; y < 540; y += 22) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(960, y); ctx.stroke();
    }

    // 木桌
    ctx.fillStyle = '#8a5a3b';
    ctx.fillRect(268, 386, 224, 16);
    ctx.fillStyle = '#a06a45';
    ctx.fillRect(268, 386, 224, 5);
    ctx.fillStyle = '#6d4527';
    ctx.fillRect(286, 402, 14, 34);
    ctx.fillRect(460, 402, 14, 34);
    // 坐垫
    ctx.fillStyle = '#a34a4a';
    ctx.beginPath(); ctx.ellipse(380, 408, 70, 14, 0, 0, Math.PI * 2); ctx.fill();

    // 当前指令（唱词窗口 [c, c+2)）
    let cue = null;
    for (const [c, k] of this._cur.commands) {
      if (beat >= c && beat < c + 2) { cue = { c, k }; break; }
    }

    // 唱歌的小鸟（圆窗前的木托上）
    ctx.fillStyle = '#8a5a3b';
    ctx.fillRect(712, 244, 110, 10);
    let singing = false;
    if (cue) singing = beat < cue.c + cue.k * 0.5;
    Animals.bird(ctx, 770, 226, 20, {
      color: '#7fb069',
      pose: 'idle',
      beakOpen: singing ? 1 : 0,
      wingFlap: singing ? 0.5 : 0,
      mood: singing ? 'happy' : 'idle'
    });

    // 唱词气泡：个数 + 逐音点亮的小圆点
    if (cue) {
      const bx = 640, by = 118;
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#26232e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bx - 74, by - 40, 148, 78, 14);
      else ctx.rect(bx - 74, by - 40, 148, 78, 14);
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(bx + 52, by + 26);
      ctx.lineTo(bx + 88, by + 52);
      ctx.lineTo(bx + 64, by + 18);
      ctx.closePath(); ctx.fill();
      Draw.text(ctx, cue.k + ' 个！', bx, by - 12, 30, '#c62828');
      for (let i = 0; i < cue.k; i++) {
        ctx.fillStyle = beat >= cue.c + i * 0.5 ? '#e85d5d' : '#d8cfc0';
        ctx.beginPath(); ctx.arc(bx - (cue.k - 1) * 13 + i * 26, by + 18, 7, 0, Math.PI * 2); ctx.fill();
      }
    }

    // 和尚（光头袈裟打坐：包子快到嘴边时张嘴，咬下瞬间大张）
    const chewing = st - mk.chewT < 0.3;
    const sad = st - mk.sadT < 0.6;
    const monkMood = sad ? 'sad' : (st - mk.chewT < 0.5 ? 'happy' : 'idle');
    let mouthOpen = 0;
    if (chewing) {
      mouthOpen = 1;
    } else {
      for (const n of game.chart) {
        if (n.state === 'pending' && n.beat - beat > 0 && n.beat - beat < 0.3) {
          mouthOpen = 0.55;
          break;
        }
      }
    }
    Animals.monk(ctx, this.MX, 345, 45, { mood: monkMood, mouthOpen });
    // 流汗（miss 后）
    if (sad) {
      ctx.fillStyle = '#7ec8e8';
      ctx.beginPath(); ctx.ellipse(this.MX + 30, 290, 5, 8, 0.2, 0, Math.PI * 2); ctx.fill();
    }

    // 包子：从右侧飞入嘴，命中消失，错过落地
    for (const n of game.chart) {
      const launch = n.beat - 1.5;
      if (beat < launch) continue;
      if (n.state === 'hit') continue;
      let x, y, alpha = 1;
      const p = (beat - launch) / 1.5;
      if (n.state === 'miss') {
        const ft = st - (n.missT || st);
        if (ft > 0.7) continue;
        alpha = 1 - ft / 0.7;
        x = this.MX - 6 - ft * 60;
        y = this.MY + ft * ft * 800;
      } else {
        const cp = Math.min(p, 1); // 判定窗内停在嘴边等结果
        x = 980 + (this.MX - 980) * cp;
        y = 250 + (this.MY - 250) * cp - Math.sin(cp * Math.PI) * 40;
      }
      ctx.globalAlpha = alpha;
      this.bun(ctx, x, y);
      ctx.globalAlpha = 1;
    }

    // 教学提示（预备拍）
    if (beat >= 0 && beat < 4) {
      Draw.text(ctx, '听小鸟唱几个音，包子到嘴边就连吃几下！', 480, 52, 27, 'rgba(90,60,30,0.9)');
    }
  }
};

/* ================================================================
 * 第 14 关 · 打包小能手（双键关）
 * 传送带右端来货：糖果「叮」（提前 2 拍预告）= 空格接住，
 * 虫子「嗡」（提前 2 拍预告）= F 拍走。按错键由引擎直接判 miss。
 * ============================================================== */
const LevelPacking = {
  id: 'packing',
  name: '第 14 关 · 打包小能手',
  desc: '糖果「叮」=空格接住，虫子「嗡」=F 拍走！别接反了。',
  hint: '空格=接糖果 · F=拍虫子 · Esc = 退出',
  bpm: 110,
  totalBeats: 42,
  usesAlt: true,

  CATX: 480,   // 猫工人 x
  BELTY: 398,  // 传送带顶 y

  candies: [4, 6, 8, 10, 13, 15, 18, 20, 22, 25, 27, 30, 33, 36],
  bugs: [5, 9, 12, 16, 19, 23, 26, 31, 34, 37, 38],

  // normal：32 物品（[拍, 键]），更多半拍连击与 main/alt 交替
  itemsNormal: [
    [4, 'main'], [6, 'alt'], [8, 'main'], [9.5, 'alt'], [10, 'main'], [12, 'alt'],
    [14, 'main'], [15.5, 'alt'], [17.5, 'main'], [19, 'alt'], [19.5, 'main'], [22, 'alt'],
    [24, 'main'], [25.5, 'alt'], [27.5, 'main'], [29, 'alt'], [30.5, 'main'], [32, 'alt'],
    [34, 'main'], [36, 'alt'], [36.5, 'main'], [39.5, 'alt'], [41.5, 'main'], [43, 'alt'],
    [44.5, 'main'], [46.5, 'alt'], [48, 'main'], [50, 'alt'], [50.5, 'main'], [53, 'alt'],
    [54.5, 'main'], [56, 'alt']
  ],

  // 三模式：normal 提速 1.1 倍；hard 物品序列种子随机，一次生成并暂存（totalBeats 需先于 buildChart 确定）
  setup(mode) {
    if (mode === 'normal') return { bpm: 110 * 1.1, totalBeats: 60 };
    if (mode === 'hard') {
      this._hardGen = this._genHard(mulberry32(Date.now() % 100000));
      return { bpm: 122, totalBeats: this._hardGen.totalBeats };
    }
    return null; // easy：用静态 bpm/totalBeats
  },

  // hard：44 物品，糖果(main)/虫(alt)种子随机；最小间隔 0.5 拍（半拍只作同键连击且不连续出现）
  _genHard(rnd) {
    const gaps = [0.5, 1, 1, 1, 1.5, 2];
    const items = [];
    let c = 4, prevKey = 'main', prevGap = 1;
    for (let i = 0; i < 44; i++) {
      let gap = i === 0 ? 0 : gaps[Math.floor(rnd() * gaps.length)];
      if (prevGap === 0.5 && gap === 0.5) gap = 1; // 不连续半拍
      c += gap; // gap 是与上一物品的间距，先推进再落子
      const key = (i > 0 && gap === 0.5) ? prevKey : (rnd() < 0.55 ? 'main' : 'alt');
      items.push([c, key]);
      prevKey = key; prevGap = gap;
    }
    return { items, totalBeats: Math.ceil(c) + 2 };
  },

  buildChart(mode) {
    mode = mode || 'easy';
    let items;
    if (mode === 'hard') {
      const gen = this._hardGen || this._genHard(mulberry32(Date.now() % 100000));
      this._hardGen = null;
      items = gen.items;
    } else if (mode === 'normal') {
      items = this.itemsNormal;
    } else {
      items = this.candies.map(b => [b, 'main']).concat(this.bugs.map(b => [b, 'alt']));
    }
    this._cur = { items }; // 预告音/绘制直接读 game.chart（与本谱面一致）
    return items.map(([b, key]) => ({ beat: b, key }));
  },

  init(game) {
    game.pack = { catchT: -9, swatT: -9, sadT: -9, biteT: -9, whiffT: -9 };
  },

  scheduleStep(step, t, game) {
    const beat = step / 2;
    const spb = Conductor.secPerBeat();
    const b = ((beat % 4) + 4) % 4;
    // 轻快工厂伴奏
    if (step % 2 === 0) {
      if (b === 0 || b === 2) AudioEngine.kick(t);
      if (b === 1 || b === 3) AudioEngine.snare(t);
      AudioEngine.tone(t, [98, 98, 110, 130.81][b], spb * 0.3, 'sawtooth', 0.1);
      if (beat >= 4) {
        const mel = [659.25, 783.99, 987.77, 783.99];
        AudioEngine.tone(t, mel[b], spb * 0.2, 'square', 0.045);
      }
      // 预备拍
      if (beat < 4) AudioEngine.blok(t, beat === 3 ? 1320 : 880);
    } else {
      AudioEngine.hihat(t, false);
    }
    // 物品预告：提前 2 拍，糖果「叮」/ 虫子「嗡」
    for (const n of game.chart) {
      if (beat === n.beat - 2) {
        if (n.key === 'alt') AudioEngine.tone(t, 180, 0.3, 'sawtooth', 0.25);
        else AudioEngine.blok(t, 1318);
      }
    }
  },

  onJudge(game, note, res) {
    const st = Conductor.songTime();
    const pk = game.pack;
    if (res === 'miss') {
      pk.sadT = st;
      note.missT = st;
      if (note.key === 'alt') {
        // 虫子没拍走（或按错键）：爬上来咬猫
        pk.biteT = st;
        game.burst(this.CATX + 16, 280, '#e85d5d', 10);
      }
    } else if (note.key === 'alt') {
      pk.swatT = st;
      note.splatT = st;
      AudioEngine.zap(AudioEngine.now());
      game.burst(this.CATX + 60, this.BELTY - 6, '#b98ae0', 12);
    } else {
      pk.catchT = st;
      note.catchT = st;
      AudioEngine.blok(AudioEngine.now(), 1568);
      game.burst(this.CATX - 40, this.BELTY - 18, '#ff9ec0', 10);
    }
  },

  onWhiff(game) {
    game.pack.whiffT = Conductor.songTime();
  },

  // 齿轮（背景装饰）
  gear(ctx, x, y, r, rot, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = color;
    for (let i = 0; i < 8; i++) {
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-r * 0.16, -r * 1.22, r * 0.32, r * 0.44);
    }
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#202b36';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.34, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  },

  // 糖果：粉色圆球 + 两端糖纸
  candy(ctx, x, y, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.fillStyle = '#ff9ec0';
    ctx.beginPath();
    ctx.moveTo(-12, 0); ctx.lineTo(-24, -8); ctx.lineTo(-24, 8);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(12, 0); ctx.lineTo(24, -8); ctx.lineTo(24, 8);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff7fa5';
    ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 7, -0.4, 1.4); ctx.stroke();
    ctx.restore();
  },

  // 虫子：紫黑多脚
  bug(ctx, x, y, st, squash) {
    ctx.save();
    ctx.translate(x, y);
    if (squash) ctx.scale(1.4, 0.35);
    // 六条腿（爬行摆动）
    ctx.strokeStyle = '#3a1f4c';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const wig = Math.sin(st * 18 + i * 2.1) * 4;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(-8 + i * 8, 4 * side);
        ctx.lineTo(-12 + i * 8 + wig, 12 * side);
        ctx.stroke();
      }
    }
    // 身体 + 头
    ctx.fillStyle = '#4a2b5c';
    ctx.beginPath(); ctx.ellipse(0, 0, 14, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a1f4c';
    ctx.beginPath(); ctx.arc(-13, 0, 7, 0, Math.PI * 2); ctx.fill();
    // 触角
    ctx.beginPath(); ctx.moveTo(-16, -5); ctx.lineTo(-22, -13); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-12, -6); ctx.lineTo(-14, -15); ctx.stroke();
    // 红眼睛
    ctx.fillStyle = '#e85d5d';
    ctx.beginPath(); ctx.arc(-15, -2, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  },

  draw(game, ctx) {
    const st = Conductor.songTime();
    const beat = Conductor.songBeat();
    const pk = game.pack;

    // 背景：工厂（青钢色调，与第 5 关区分）
    const bg = ctx.createLinearGradient(0, 0, 0, 540);
    bg.addColorStop(0, '#33414f');
    bg.addColorStop(1, '#202b36');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 960, 540);
    // 吊灯三盏
    for (const lx of [200, 480, 760]) {
      ctx.strokeStyle = '#454552';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, 46); ctx.stroke();
      ctx.fillStyle = '#565664';
      ctx.beginPath(); ctx.moveTo(lx - 24, 62); ctx.lineTo(lx + 24, 62); ctx.lineTo(lx + 10, 44); ctx.lineTo(lx - 10, 44); ctx.closePath(); ctx.fill();
      const lg = ctx.createLinearGradient(0, 62, 0, 300);
      lg.addColorStop(0, 'rgba(255,236,170,0.13)');
      lg.addColorStop(1, 'rgba(255,236,170,0)');
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.moveTo(lx - 20, 62); ctx.lineTo(lx - 90, 300); ctx.lineTo(lx + 90, 300); ctx.lineTo(lx + 20, 62);
      ctx.closePath(); ctx.fill();
    }
    // 管道 + 齿轮
    ctx.fillStyle = '#454552';
    ctx.fillRect(0, 84, 960, 14);
    ctx.fillRect(120, 84, 14, 120);
    this.gear(ctx, 180, 260, 38, st * 0.7, '#4c4c5a');
    this.gear(ctx, 862, 300, 46, -st * 0.5, '#454552');
    // 操作说明海报
    ctx.fillStyle = '#f5ecd7';
    ctx.strokeStyle = '#8a6a3a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(706, 116, 216, 104, 8);
    else ctx.rect(706, 116, 216, 104, 8);
    ctx.fill(); ctx.stroke();
    this.candy(ctx, 742, 148, 0);
    Draw.text(ctx, '= 空格', 812, 148, 24, '#c2285c');
    this.bug(ctx, 744, 192, st, false);
    Draw.text(ctx, '= F', 812, 192, 24, '#4a2b5c');
    // 地面
    Draw.ground(ctx, 470, '#1a1f26');

    // 猫工人（站在传送带后方，下半身被带子挡住）
    const catMood = (st - pk.sadT < 0.7) ? 'sad'
      : (st - pk.catchT < 0.3 || st - pk.swatT < 0.3) ? 'happy' : 'idle';
    const shake = st - pk.biteT < 0.7;
    const bob = Math.sin(beat * Math.PI) * 2.5;
    ctx.save();
    if (shake) ctx.translate(Math.sin(st * 40) * 3, 0);
    Animals.cat(ctx, this.CATX, 336 + bob, 40, {
      color: '#f5a35c',
      mood: catMood,
      headband: '#3d6b9e',
      armL: st - pk.catchT < 0.22 ? 1.0 : 0.5,
      armR: (st - pk.swatT < 0.22 || st - pk.whiffT < 0.15) ? 1.15 : 0.5,
      squash: st - pk.swatT < 0.22 ? 0.14 : 0
    });
    ctx.restore();
    // 被咬时虫子爬在猫头上
    if (shake) this.bug(ctx, this.CATX + 14, 268 + bob, st, false);

    // 传送带（向左滚动）
    ctx.fillStyle = '#2b2b33';
    ctx.fillRect(0, this.BELTY, 960, 44);
    ctx.fillStyle = '#3d3d49';
    const off = (st * 230) % 56;
    for (let x = -56; x < 1016; x += 56) {
      ctx.fillRect(x + 56 - off, this.BELTY, 26, 44);
    }
    ctx.fillStyle = '#565664';
    ctx.fillRect(0, this.BELTY, 960, 4);
    ctx.fillRect(0, this.BELTY + 40, 960, 4);

    // 糖果篮（左下角，接住的糖都飞进这里）
    ctx.fillStyle = '#a8713f';
    ctx.beginPath();
    ctx.moveTo(60, 452); ctx.lineTo(130, 452); ctx.lineTo(120, 500); ctx.lineTo(70, 500);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#8a5a2f';
    ctx.fillRect(56, 444, 78, 12);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(80, 456); ctx.lineTo(84, 496); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(100, 456); ctx.lineTo(100, 496); ctx.stroke();

    // 拍虫冲击星
    if (st - pk.swatT < 0.15) {
      const p = 1 - (st - pk.swatT) / 0.15;
      ctx.strokeStyle = 'rgba(255,217,77,' + p.toFixed(3) + ')';
      ctx.lineWidth = 3;
      const R = 28 * (1.25 - p);
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 4;
        ctx.beginPath();
        ctx.moveTo(this.CATX + 60 - Math.cos(a) * R, this.BELTY - 6 - Math.sin(a) * R);
        ctx.lineTo(this.CATX + 60 + Math.cos(a) * R, this.BELTY - 6 + Math.sin(a) * R);
        ctx.stroke();
      }
    }

    // 物品：提前 2 拍从右端出现，正拍到达猫面前
    for (const n of game.chart) {
      const spawn = n.beat - 2;
      if (beat < spawn) continue;
      // 出现闪光（与预告音同步）
      if (beat - spawn < 0.25) {
        const fp = 1 - (beat - spawn) / 0.25;
        ctx.strokeStyle = (n.key === 'alt' ? 'rgba(185,138,224,' : 'rgba(255,158,192,') + fp.toFixed(3) + ')';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(940, this.BELTY - 12, 26 - fp * 10, 0, Math.PI * 2); ctx.stroke();
      }
      const onBeltX = 940 - (beat - spawn) * 230;
      const onBeltY = this.BELTY - 12;
      if (n.key === 'main') {
        // —— 糖果 ——
        if (n.state === 'hit') {
          // 接住的糖划弧飞进篮子
          const p = (st - (n.catchT || st)) / 0.5;
          if (p > 1) continue;
          const x = (this.CATX - 40) + (95 - (this.CATX - 40)) * p;
          const y = (this.BELTY - 18) + (448 - (this.BELTY - 18)) * p - Math.sin(p * Math.PI) * 130;
          this.candy(ctx, x, y, p * 9);
        } else if (n.state === 'miss') {
          // 漏掉的糖滚出左端
          if (onBeltX < -40) continue;
          ctx.globalAlpha = Math.max(0, Math.min(1, onBeltX / 130));
          this.candy(ctx, onBeltX, onBeltY, beat * 4);
          ctx.globalAlpha = 1;
        } else {
          this.candy(ctx, onBeltX, onBeltY, beat * 4);
        }
      } else {
        // —— 虫子 ——
        if (n.state === 'hit') {
          // 拍扁的虫子（一滩）
          const ft = st - (n.splatT || st);
          if (ft > 0.6) continue;
          ctx.globalAlpha = 1 - ft / 0.6;
          this.bug(ctx, this.CATX + 60, this.BELTY - 4, st, true);
          ctx.globalAlpha = 1;
        } else if (n.state === 'miss') {
          continue; // 爬去咬猫了（见猫头上的虫）
        } else {
          this.bug(ctx, onBeltX, onBeltY + Math.sin(beat * 8) * 2, st, false);
        }
      }
    }

    // 教学提示（预备拍）
    if (beat >= 0 && beat < 4) {
      Draw.text(ctx, '糖果「叮」=空格接住，虫子「嗡」=F 拍走！', 480, 150, 28, 'rgba(255,255,255,0.95)');
    }
  }
};

/* ---------- 注册第四批关卡 ---------- */
Levels.push(LevelTapTrial, LevelGlee, LevelMonk, LevelPacking);

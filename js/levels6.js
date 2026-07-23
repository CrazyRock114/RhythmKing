/* levels6.js — 第六批关卡：教练指令 & 大团圆混曲
 *   第 19 关 · 拳击台（Ringside）：听教练喊拳路照打 —— 三连击 / 单击 / 按住重拳
 *   第 21 关 · 大团圆 Remix：20 种玩法池的混曲串烧（每段 8 拍，三模式 8/12/16 段）
 * 关卡接口与 levels.js 相同；长按音符额外实现 onPress / onRelease，
 * Remix 含双键段（打包：usesAlt，空格=糖 / F=虫）。
 */
'use strict';

/* ================================================================
 * 第 19 关 · 拳击台
 * 教练狗喊拳路，羊驼拳手照打（指令占 1 拍，出拳在指令后 2 拍开始）：
 *   「pa-pa-pow!」  = 三连击（+2、+2.5、+3 拍，第三下最重）
 *   「pa-pa-pa-pow!」= 四连击（+2、+2.5、+3、+3.5 拍，第四下最重，normal 起出现）
 *   「pow!」        = 单击（+2 拍）
 *   「hooold-pow!」 = 按住 1 拍重拳（+2 拍按下，蓄满松开）
 * 三模式：easy=原谱；normal=14 条指令（新增四连拳路），bpm×1.1；
 * hard=指令与拳路种子随机（combo/single/hold/combo4，间隔随机休止），bpm 125。
 * ============================================================== */
const LevelRingside = {
  id: 'ringside',
  name: '第 19 关 · 拳击台',
  desc: '听教练喊拳路：「pa-pa-pow!」=三连击，「pow!」=单击，「hooold-pow!」=按住重拳！',
  hint: '空格=出拳 · 按住=重拳 · Esc = 退出',
  bpm: 115,
  totalBeats: 44,

  // [指令拍, 类型]（easy：与原谱一致）
  commands: [
    [4, 'combo'], [8, 'single'], [10, 'combo'], [14, 'hold'],
    [18, 'combo'], [22, 'single'], [24, 'hold'], [28, 'combo'],
    [32, 'single'], [34, 'combo'], [38, 'hold']
  ],

  // normal：14 条指令（easy 的 11 条 + 3 条，新增四连拳路 combo4）
  commandsNormal: [
    [4, 'combo'], [8, 'single'], [10, 'combo'], [14, 'hold'],
    [18, 'combo'], [22, 'single'], [24, 'hold'], [28, 'combo'],
    [32, 'single'], [34, 'combo'], [38, 'hold'],
    [44, 'combo4'], [48, 'single'], [54, 'combo4']
  ],

  setup(mode) {
    if (mode === 'normal') return { bpm: this.bpm * 1.1, totalBeats: 62 };
    if (mode === 'hard') return { bpm: 125, totalBeats: 84 };
    return null; // easy：用静态 bpm / totalBeats
  },

  // hard：指令与拳路种子随机。先定 16~19 条指令（且至少 12 条多击，保密度下限），
  // 再在最小 4 拍间隔上随机撒 +2 拍休止（受 76 拍上限约束，指令互不重叠）
  genHardCommands() {
    const rnd = mulberry32(Date.now() % 100000);
    const kinds = ['combo', 'combo', 'combo', 'combo4', 'combo4', 'combo4', 'single', 'single', 'hold'];
    const count = 16 + Math.floor(rnd() * 4);
    const maxCheap = count - 12;
    let slack = 76 - 4 * count;
    let c = 4, cheap = 0;
    const cmds = [];
    for (let i = 0; i < count; i++) {
      let kind = kinds[Math.floor(rnd() * kinds.length)];
      if (kind === 'single' || kind === 'hold') {
        if (cheap >= maxCheap) kind = rnd() < 0.5 ? 'combo' : 'combo4';
        else cheap++;
      }
      cmds.push([c, kind]);
      let gap = 4;
      if (slack >= 2 && rnd() < 0.5) { gap = 6; slack -= 2; }
      c += gap;
    }
    return cmds;
  },

  buildChart(mode) {
    mode = mode || 'easy';
    const commands = mode === 'hard' ? this.genHardCommands()
      : mode === 'normal' ? this.commandsNormal
      : this.commands;
    // 结构化解算：scheduleStep / draw 统一读 this._cur（easy 也走这里）
    this._cur = { commands, hasCombo4: commands.some(([, k]) => k === 'combo4') };
    const notes = [];
    for (const [c, kind] of commands) {
      if (kind === 'combo' || kind === 'combo4') {
        const hits = kind === 'combo' ? [2, 2.5, 3] : [2, 2.5, 3, 3.5];
        for (let i = 0; i < hits.length; i++) notes.push({ beat: c + hits[i], kind, idx: i });
      } else if (kind === 'single') {
        notes.push({ beat: c + 2, kind });
      } else {
        notes.push({ beat: c + 2, dur: 1, kind });
      }
    }
    return notes;
  },

  init(game) {
    game.ringside = { punchT: -9, sadT: -9, holdT: -9, swingT: -9, swingAmp: 0, cheerT: -9 };
  },

  // 观众底噪：每半拍一小段低音量噪声，叠成连续嗡嗡声
  crowd(t) {
    const ac = AudioEngine.ctx;
    const n = ac.createBufferSource();
    n.buffer = AudioEngine.noiseBuffer();
    const f = ac.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 0.6;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.03, t + 0.06);
    g.gain.setValueAtTime(0.03, t + 0.22);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    n.connect(f); f.connect(g); g.connect(AudioEngine.master);
    n.start(t); n.stop(t + 0.34);
  },

  // 欢呼（perfect 时）
  cheer(t) {
    const ac = AudioEngine.ctx;
    const n = ac.createBufferSource();
    n.buffer = AudioEngine.noiseBuffer();
    const f = ac.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 0.8;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.18, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
    n.connect(f); f.connect(g); g.connect(AudioEngine.master);
    n.start(t); n.stop(t + 0.4);
    AudioEngine.tone(t, 1046, 0.1, 'sine', 0.1);
    AudioEngine.tone(t + 0.07, 1318, 0.14, 'sine', 0.1);
  },

  scheduleStep(step, t, game) {
    const beat = step / 2;
    const spb = Conductor.secPerBeat();
    this.crowd(t);
    // 伴奏：拳击场放克（每拍大鼓 + 2/4 拍军鼓 + 锯齿贝斯）
    if (step % 2 === 0) {
      const b = ((beat % 4) + 4) % 4;
      AudioEngine.kick(t);
      if (b === 1 || b === 3) AudioEngine.snare(t);
      AudioEngine.tone(t, [82.41, 82.41, 98, 110][b], spb * 0.35, 'sawtooth', 0.12);
      if (beat < 4) AudioEngine.blok(t, beat === 3 ? 1320 : 880);
    } else {
      AudioEngine.hihat(t, false);
    }
    // 教练喊拳路（木鱼人声，与伴奏音色区分；与 _cur 指令表严格对齐）
    for (const [c, kind] of this._cur.commands) {
      if (beat !== c) continue;
      if (kind === 'combo' || kind === 'combo4') {
        AudioEngine.blok(t, 587);              // pa
        AudioEngine.blok(t + spb * 0.5, 659);  // pa
        if (kind === 'combo4') AudioEngine.blok(t + spb, 698); // pa
        AudioEngine.blok(t + spb * (kind === 'combo4' ? 1.5 : 1), 784); // pow!
      } else if (kind === 'single') {
        AudioEngine.blok(t, 784);              // pow!
      } else {
        AudioEngine.tone(t, 392, 0.4, 'square', 0.2); // hooold…
        AudioEngine.blok(t + spb, 784);               // …pow!
      }
    }
  },

  onJudge(game, note, res) {
    const st = Conductor.songTime();
    const r = game.ringside;
    if (res === 'miss') {
      r.sadT = st;
      AudioEngine.tone(AudioEngine.now(), 150, 0.22, 'sawtooth', 0.18);
      return;
    }
    if (note.kind === 'hold') return; // 重拳的命中反馈在 onRelease
    r.punchT = st;
    r.swingT = st;
    // 左右手交替出拳
    r.lastSide = (r.punches || 0) % 2;
    r.punches = (r.punches || 0) + 1;
    // 连击最后一下是重击（boom），其余普通 punch
    const big = (note.kind === 'combo' && note.idx === 2) || (note.kind === 'combo4' && note.idx === 3);
    r.swingAmp = big ? 0.42 : 0.18;
    if (big) AudioEngine.boom(AudioEngine.now());
    else AudioEngine.punch(AudioEngine.now());
    if (res === 'perfect') { this.cheer(AudioEngine.now()); r.cheerT = st; }
    game.burst(560, 300, '#aee2ff', big ? 14 : 7); // 汗珠
    if (big) game.burst(560, 300, '#ffd94d', 10);
  },

  // 重拳：按住 = 抵住沙袋蓄力
  onPress(game, note, res) {
    game.ringside.holdT = Conductor.songTime();
    AudioEngine.punch(AudioEngine.now());
    AudioEngine.fillStart(); // 蓄力上升音
  },

  // 松开 = 重锤轰出
  onRelease(game, note, res) {
    const st = Conductor.songTime();
    const r = game.ringside;
    AudioEngine.fillStop();
    if (res === 'miss' || res === 'over') {
      r.sadT = st;
      AudioEngine.tone(AudioEngine.now(), 150, 0.22, 'sawtooth', 0.18);
      return;
    }
    r.punchT = st;
    r.swingT = st;
    r.swingAmp = 0.5;
    AudioEngine.boom(AudioEngine.now());
    if (res === 'perfect') { this.cheer(AudioEngine.now()); r.cheerT = st; }
    game.burst(560, 300, '#aee2ff', 14);
    game.burst(560, 300, '#ffd94d', 10);
  },

  onWhiff(game) {
    game.ringside.punchT = Conductor.songTime(); // 挥空也有出拳动作
  },

  draw(game, ctx) {
    const st = Conductor.songTime();
    const beat = Conductor.songBeat();
    const r = game.ringside;

    // 背景：夜间体育馆
    const bg = ctx.createLinearGradient(0, 0, 0, 540);
    bg.addColorStop(0, '#141b33');
    bg.addColorStop(1, '#2b1f3d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 960, 540);
    // 扫动的聚光灯
    const sweep = Math.sin(st * 0.7) * 0.2;
    for (const dir of [-1, 1]) {
      ctx.save();
      ctx.translate(480 + dir * 320, -10);
      ctx.rotate(dir * (0.3 + sweep));
      const lg = ctx.createLinearGradient(0, 0, 0, 470);
      lg.addColorStop(0, 'rgba(255,240,180,0.14)');
      lg.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(-100, 470); ctx.lineTo(100, 470);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    // 观众席（两排剪影，perfect 后欢呼跳高）
    const cheering = st - r.cheerT < 0.6;
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < 12; i++) {
        const x = 36 + i * 82 + (row ? 40 : 0);
        const jump = cheering ? Math.abs(Math.sin(st * 10 + i)) * 8 : 0;
        const y = 52 + row * 46 + Math.sin(beat * Math.PI + i * 1.3) * 3 - jump;
        ctx.fillStyle = row ? '#0c0f1e' : '#11152a';
        ctx.beginPath(); ctx.arc(x, y, 21, 0, Math.PI * 2); ctx.fill();
      }
    }

    // 拳击台：台裙 + 台面
    ctx.fillStyle = '#28406b';
    ctx.fillRect(60, 428, 840, 62);
    ctx.fillStyle = '#e8dcc8';
    ctx.fillRect(78, 398, 804, 34);
    ctx.fillStyle = 'rgba(198,40,40,0.22)';
    ctx.beginPath(); ctx.ellipse(480, 415, 120, 12, 0, 0, Math.PI * 2); ctx.fill();
    // 台柱 + 后围绳
    for (const px of [92, 868]) {
      ctx.fillStyle = '#c62828';
      ctx.fillRect(px - 8, 258, 16, 146);
      ctx.fillStyle = '#ffd94d';
      ctx.fillRect(px - 8, 258, 16, 16);
    }
    for (let i = 0; i < 3; i++) {
      const ry = 282 + i * 36;
      ctx.strokeStyle = i === 1 ? '#e85d5d' : '#f5f0e8';
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(92, ry); ctx.lineTo(868, ry); ctx.stroke();
    }

    // 沙袋吊架
    ctx.strokeStyle = '#3a3a44';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(700, 404); ctx.lineTo(700, 40); ctx.lineTo(560, 40); ctx.stroke();
    // 沙袋（被击中后绕吊点摆动）
    const dt2 = st - r.swingT;
    const ang = dt2 < 1.4 ? Math.sin(dt2 * 10) * r.swingAmp * (1 - dt2 / 1.4) : 0;
    ctx.save();
    ctx.translate(560, 44);
    ctx.rotate(ang);
    ctx.strokeStyle = '#8a93a0';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 190); ctx.stroke();
    ctx.fillStyle = '#b8433a';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-32, 190, 64, 128, 26);
    else ctx.rect(-32, 190, 64, 128);
    ctx.fill();
    ctx.fillStyle = '#8f2f28';
    ctx.fillRect(-32, 224, 64, 12);
    ctx.fillRect(-32, 262, 64, 12);
    ctx.restore();

    // 教练狗（角落，戴帽子）+ 指令气泡
    const dbob = Math.sin(beat * Math.PI + 1) * 3;
    Animals.dog(ctx, 130, 418 + dbob, 30, {
      color: '#8d6e63',
      mood: st - r.sadT < 0.7 ? 'sad' : 'idle',
      tailWag: Math.sin(st * 5) * 0.5 + 0.5
    });
    ctx.fillStyle = '#28406b';
    ctx.beginPath(); ctx.ellipse(130, 388 + dbob, 20, 8, 0, Math.PI, 0); ctx.fill();
    ctx.fillRect(110, 386 + dbob, 40, 5);
    let cue = null;
    for (const [c, kind] of this._cur.commands) {
      if (beat >= c && beat < c + 2) { cue = { kind }; break; }
    }
    if (cue) {
      const txt = cue.kind === 'combo' ? 'pa-pa-pow!' : cue.kind === 'combo4' ? 'pa-pa-pa-pow!' : cue.kind === 'single' ? 'pow!' : 'hooold-pow!';
      const sub = cue.kind === 'combo' ? '三连击！' : cue.kind === 'combo4' ? '四连击！' : cue.kind === 'single' ? '单击！' : '按住重拳！';
      const bx = 255, by = 208;
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#26232e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bx - 105, by - 46, 210, 80, 14);
      else ctx.rect(bx - 105, by - 46, 210, 80, 14);
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(bx - 80, by + 30);
      ctx.lineTo(bx - 112, by + 60);
      ctx.lineTo(bx - 52, by + 34);
      ctx.closePath(); ctx.fill();
      Draw.text(ctx, txt, bx, by - 16, 30, cue.kind === 'hold' ? '#1565c0' : '#c62828');
      Draw.text(ctx, sub, bx, by + 16, 19, '#555');
    }

    // 橘猫拳手：平时在沙袋旁游走，出拳时进步贴近，左右手交替（重拳双臂齐出）
    const holding = game.chart.find(n => n.state === 'holding');
    const pt = st - r.punchT;
    const punching = pt >= 0 && pt < 0.22;
    const punchK = punching ? Math.sin((pt / 0.22) * Math.PI) : 0;
    let mood = 'idle';
    if (st - r.sadT < 0.7) mood = 'sad';
    else if (pt >= 0 && pt < 0.3) mood = 'happy';
    // 游走晃动 + 出拳/蓄力时向沙袋进步（不再拉长手臂）
    const weave = Math.sin(beat * Math.PI) * 10;
    const stepIn = holding ? 46 : punchK * 46;
    const bx = 430 + weave + stepIn;
    const by = 392 + Math.abs(Math.sin(beat * Math.PI * 2)) * 3;
    const side = holding ? 0 : (r.lastSide === 1 ? -1 : 1);
    Animals.cat(ctx, bx, by, 40, {
      color: '#f5a35c',
      mood,
      headband: '#e85d5d',
      squash: holding ? 0.12 : 0,
      armL: false,
      armR: false,
      legPhase: Math.floor(beat * 2) % 2 === 0 ? 1 : -1
    });
    // 拳套（含小臂）：平时收在胸前，出拳时前伸至沙袋
    const glove = (sd, extended) => {
      const sx = bx + sd * 24, sy = by - 2;
      const reach = extended ? 62 : 26;
      const gx = sx + reach;
      const gy = sy - (extended ? 4 : 12) + (holding ? Math.sin(st * 30) * 2 : 0);
      ctx.strokeStyle = '#f5a35c';
      ctx.lineWidth = 11;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(gx - 10, gy + 2); ctx.stroke();
      ctx.fillStyle = '#e85d5d';
      ctx.beginPath(); ctx.arc(gx, gy, 15, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c62828';
      ctx.beginPath(); ctx.arc(gx - 5, gy + 5, 8, 0, Math.PI * 2); ctx.fill();
    };
    glove(-1, holding || (side === -1 && punchK > 0));
    glove(1, holding || (side === 1 && punchK > 0));
    // 命中火星
    if (pt >= 0 && pt < 0.18) {
      const p2 = 1 - pt / 0.18;
      ctx.strokeStyle = 'rgba(255,217,77,' + (0.9 * p2).toFixed(3) + ')';
      ctx.lineWidth = 4;
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3 + 0.3;
        ctx.beginPath();
        ctx.moveTo(560 + Math.cos(a) * 22, 300 + Math.sin(a) * 22);
        ctx.lineTo(560 + Math.cos(a) * (34 + (1 - p2) * 26), 300 + Math.sin(a) * (34 + (1 - p2) * 26));
        ctx.stroke();
      }
    }

    // 教学提示（开头）
    if (beat >= 0 && beat < 4) {
      if (this._cur.hasCombo4) {
        Draw.text(ctx, '听教练喊：pa-pa-pow=三连击 · pa-pa-pa-pow=四连击 · pow=单击 · hooold-pow=按住！', 480, 150, 22, '#fff');
      } else {
        Draw.text(ctx, '听教练喊：pa-pa-pow=三连击 · pow=单击 · hooold-pow=按住重拳！', 480, 150, 25, '#fff');
      }
    }
  }
};

/* ================================================================
 * 第 21 关 · 大团圆 Remix
 * 20 种玩法池的混曲串烧：每段 8 拍，段首 1.5 拍中文标题卡 + 重音鼓花，段与段连续不停。
 * 三模式：
 *   easy   8 段：空手道→蓝鸟→拍手→乒乓→和尚→打包→拳击→终章，bpm 112，totalBeats 70（静态值）
 *   normal 12 段：easy 8 段 + 模仿/灌油/跳台/魔法 插入中间，bpm 123.2（×1.1），102 拍
 *   hard   16 段：首段空手道、末段终章固定，中间 14 段从 20 种池中种子随机
 *          （mulberry32(Date.now()%100000)，不放回抽取 = 种类不重复），bpm 134.4（×1.2），134 拍
 * 统一伴奏：kick 1,3 / snare 2,4 / 半拍踩镲 / 三角贝斯，不随段落变化；
 * 预备拍 0~3 blok(880)，beat 3 blok(1320)。
 * 各段谱面与提示音由 genStructure 按段首拍一次生成（音符落点与各原关一致），
 * scheduleStep / draw 统一读 this._cur；长按音符的 dur 判定由引擎处理。
 * ============================================================== */
const LevelRemix = {
  id: 'remix',
  name: '第 21 关 · 大团圆 Remix',
  desc: '20 种玩法大混曲！段首标题卡告诉你接下来是谁，跟紧别掉链子！',
  hint: '空格=全部操作 · 打包段 F=拍虫 · 长按段按住 · Esc = 退出',
  bpm: 112,
  totalBeats: 70,
  usesAlt: true, // 打包段需要副键（F）拍虫
  altLabel: 'F',
  mainLabel: '空格',

  // 段落标题卡
  KIND_NAMES: {
    karate: '空手道！', echo: '节奏模仿！', pong: '节奏乒乓！',
    marchOn: '齐步走！', marchOff: '反拍齐步走！', fill: '灌油！',
    birds: '蓝鸟！', clappy: '拍手三人组！', spaceball: '太空棒球！',
    crop: '收割庄稼！', shooter: '宇宙射击！', taptrial: '踢踏舞！',
    glee: '合唱团！', monk: '吃包子！', packing: '打包！',
    mahou: '魔法使！', showtime: '企鹅跳台！', ratrace: '老鼠冲刺！',
    dj: 'DJ 学校！', ringside: '拳击台！', finale: '终章！'
  },

  // 玩法池（hard 中段抽取用；karate 已固定为首段、finale 固定为末段，不入池防重复）
  POOL: ['echo', 'pong', 'marchOn', 'marchOff', 'fill', 'birds', 'clappy',
    'spaceball', 'crop', 'shooter', 'taptrial', 'glee', 'monk', 'packing', 'mahou',
    'showtime', 'ratrace', 'dj', 'ringside'],

  // easy：8 段（与旧版等价的编排密度，4+64+2=70 拍）
  sectionsEasy: ['karate', 'birds', 'clappy', 'pong', 'monk', 'packing', 'ringside', 'finale'],
  // normal：12 段 = easy 8 段 + 模仿/灌油/跳台/魔法 插入中间
  sectionsNormal: ['karate', 'birds', 'echo', 'clappy', 'fill', 'pong',
    'monk', 'showtime', 'packing', 'mahou', 'ringside', 'finale'],

  // 模仿段节奏型与音阶（与第 2 关一致）
  ECHO_PATTERN: [0, 1, 1.5, 2.5],
  ECHO_SCALE: [523.25, 587.33, 659.25, 783.99],

  setup(mode) {
    if (mode === 'normal') return { bpm: this.bpm * 1.1, totalBeats: 4 + 12 * 8 + 2 }; // 123.2 / 102
    if (mode === 'hard') return { bpm: this.bpm * 1.2, totalBeats: 4 + 16 * 8 + 2 };   // 134.4 / 134
    return null; // easy：用静态 bpm / totalBeats
  },

  // hard：首段空手道、末段终章固定，中间 14 段从 20 种池不放回随机抽取（种类不重复）
  shuffledSections() {
    const rnd = mulberry32(Date.now() % 100000);
    const pool = this.POOL.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    }
    return ['karate', ...pool.slice(0, 14), 'finale'];
  },

  // kind 列表 → 段落表（每段 8 拍，start 依次重排，标题卡随段首对齐）
  resolveSections(kinds) {
    return kinds.map((kind, i) => ({ start: 4 + i * 8, name: this.KIND_NAMES[kind], kind }));
  },

  // 按段落表一次生成全部结构数据（音符 + 各玩法指令表），内容只依赖段首拍
  genStructure(sections) {
    const notes = [];
    const push = (beat, kind, extra) => notes.push(Object.assign({ beat, kind }, extra));
    const cur = {
      sections, notes,
      echoDemo: [], pongEvents: [], birdCmds: [], clapGroups: [],
      monkCmds: [], mahouCmds: [], showCues: [], ringCmds: [], tapGroups: []
    };
    for (const s of sections) {
      const b0 = s.start;
      switch (s.kind) {
        case 'karate': // 抛出 sfxCue 提前 2 拍
          for (const off of [1, 2, 3, 4, 5, 5.5, 6, 7]) push(b0 + off, 'karate');
          break;
        case 'finale': // 终章·空手道：密集收官
          for (const off of [1, 2, 3, 3.5, 4, 5, 6, 6.5, 7, 7.5]) push(b0 + off, 'finale');
          break;
        case 'echo': // 示范 [0,1,1.5,2.5] @ s+p（blok 音阶），玩家 s+4+p 跟打
          this.ECHO_PATTERN.forEach((p, i) => {
            cur.echoDemo.push({ beat: b0 + p, idx: i });
            push(b0 + 4 + p, 'echo', { idx: i });
          });
          break;
        case 'pong': { // 电脑发球→交替，电脑击球排在中点
          const pb = [1, 3, 4, 5, 7].map(o => b0 + o);
          cur.pongEvents.push({ beat: b0, side: 'cpu' });
          for (let i = 0; i < pb.length; i++) {
            cur.pongEvents.push({ beat: pb[i], side: 'player' });
            if (i + 1 < pb.length) cur.pongEvents.push({ beat: (pb[i] + pb[i + 1]) / 2, side: 'cpu' });
            push(pb[i], 'pong');
          }
          break;
        }
        case 'marchOn': // 正拍每拍一步
          for (let b = 1; b <= 7; b++) push(b0 + b, 'marchOn');
          break;
        case 'marchOff': // 反拍：错半拍，每拍一步
          for (let b = 1; b <= 7; b++) push(b0 + b + 0.5, 'marchOff');
          break;
        case 'fill':
          push(b0 + 1, 'fill', { dur: 1 });
          push(b0 + 4, 'fill', { dur: 2 });
          break;
        case 'birds': // 突突突@ s+1 → 玩家 s+3,3.5,4；昂——@ s+5 → 玩家 s+7 按住
          cur.birdCmds.push([b0 + 1, 'peck'], [b0 + 5, 'stretch']);
          for (const off of [3, 3.5, 4]) push(b0 + off, 'peck');
          push(b0 + 7, 'stretch', { dur: 1 });
          break;
        case 'clappy': // 同伴示范两声（间隔 gap），玩家隔同样时间补第三声
          for (const [c, gap] of [[1, 1], [4, 0.5], [6, 0.5]]) {
            cur.clapGroups.push([b0 + c, gap]);
            push(b0 + c + 2 * gap, 'clap', { head: b0 + c, gap });
          }
          break;
        case 'spaceball': // 投球声按 flight 提前：swish(1)/zap(0.5)/bell(2)
          for (const [off, flight] of [[1, 1], [3, 0.5], [4.5, 2], [6.5, 1]]) {
            push(b0 + off, 'spaceball', { flight });
          }
          break;
        case 'crop': // 普通菜点按 + 南瓜按住拔
          for (const off of [1, 2, 3, 5]) push(b0 + off, 'crop');
          push(b0 + 6, 'pumpkin', { dur: 1 });
          break;
        case 'shooter': // 警报提前 2 拍
          for (const off of [1, 2.5, 3, 4.5, 6, 6.5]) push(b0 + off, 'shooter');
          break;
        case 'taptrial': // 示范三连（1/3 拍间隔）@ 组首，玩家 1 拍后跟踢
          for (const g of [1, 4]) {
            cur.tapGroups.push([b0 + g]);
            for (let i = 0; i < 3; i++) push(b0 + g + 1 + i / 3, 'taptrial');
          }
          break;
        case 'glee': // 同伴领唱和弦起=按住，收=松开
          push(b0 + 1, 'glee', { dur: 2 });
          push(b0 + 5, 'glee', { dur: 2.5 });
          break;
        case 'monk': { // 唱 2 个音→跟吃 2 口；唱 3 个音→跟吃 3 口（半拍一口）
          const groups = [[1, [587, 697]], [4.5, [587, 697, 784]]];
          for (const [c, pitches] of groups) {
            cur.monkCmds.push([b0 + c, pitches]);
            pitches.forEach((p, i) => push(b0 + c + 2 + i * 0.5, 'monk', { cueBeat: b0 + c, idx: i }));
          }
          break;
        }
        case 'packing': // 双键：糖=main 空格 / 虫=alt F，预告提前 2 拍
          for (const off of [1, 3, 5, 7]) push(b0 + off, 'packing', { key: 'main' });
          for (const off of [2, 4.5, 6]) push(b0 + off, 'packing', { key: 'alt' });
          break;
        case 'mahou': // 快咒@ s+1 → 花 s+2.5；慢咒@ s+4 → 花 s+7
          cur.mahouCmds.push([b0 + 1, 'fast'], [b0 + 4, 'slow']);
          push(b0 + 2.5, 'mahou', { spell: 'fast' });
          push(b0 + 7, 'mahou', { spell: 'slow' });
          break;
        case 'showtime': // 高音铃→1 拍后跳；低音铃→2 拍后跳
          cur.showCues.push([b0 + 1, 2093], [b0 + 4, 1046]);
          push(b0 + 2, 'showtime');
          push(b0 + 6, 'showtime');
          break;
        case 'ratrace': // 预备@ note-1，真哨@ note+dur；第二段假哨@ note+dur-1
          push(b0 + 1, 'ratrace', { dur: 1.5, fakes: [] });
          push(b0 + 4.5, 'ratrace', { dur: 2.5, fakes: [1.5] });
          break;
        case 'dj': // 按住搓碟，「YO!」@ note+dur-0.5（混曲简化：伴奏不静音）
          push(b0 + 1, 'dj', { dur: 1 });
          push(b0 + 4, 'dj', { dur: 2 });
          break;
        case 'ringside': // 教练口令：combo@ s+1 → s+3,3.5,4；single@ s+5 → s+7
          cur.ringCmds.push([b0 + 1, 'combo'], [b0 + 5, 'single']);
          for (let i = 0; i < 3; i++) push(b0 + 3 + i * 0.5, 'ringside', { cmd: 'combo', idx: i });
          push(b0 + 7, 'ringside', { cmd: 'single', idx: 0 });
          break;
      }
    }
    notes.sort((a, b) => a.beat - b.beat);
    return cur;
  },

  buildChart(mode) {
    mode = mode || 'easy';
    const kinds = mode === 'hard' ? this.shuffledSections()
      : mode === 'normal' ? this.sectionsNormal
      : this.sectionsEasy;
    // 结构化解算：scheduleStep / draw 统一读 this._cur（easy 也走这里）
    this._cur = this.genStructure(this.resolveSections(kinds));
    return this._cur.notes;
  },

  // 当前拍所在的段（窗口为 [start, 下一段 start)，结尾归入末段）
  sectionAt(beat) {
    let cur = null;
    for (const s of this._cur.sections) {
      if (beat >= s.start) cur = s;
    }
    return cur;
  },

  // 当前段窗口内的某类音符（含提前 2 拍的道具预警期；hard 里 karate 会出现两次，必须按窗过滤）
  secNotes(game, sec, kinds) {
    const a = sec.start - 2, b = sec.start + 8;
    return game.chart.filter(n => kinds.indexOf(n.kind) >= 0 && n.beat >= a && n.beat < b);
  },

  // 角色情绪：刚错过 sad / 刚命中开心
  moodOf(r, st) {
    if (st - r.sadT < 0.7) return 'sad';
    if (st - r.happyT < 0.35) return 'happy';
    return 'idle';
  },

  init(game) {
    game.remix = {
      happyT: -9, sadT: -9, hitT: -9, stepT: -9,
      holdT: -9, stretchT: -9, swingT: -9,
      clapT: -9, laserT: -9, laserX: 0,
      tapT: -9, hopT: -9, bloomT: -9, jumpT: -9,
      punchT: -9, goT: -9, dropT: -9, scratchT: -9
    };
  },

  scheduleStep(step, t, game) {
    const beat = step / 2;
    const spb = Conductor.secPerBeat();
    const cur = this._cur;
    const sec = this.sectionAt(beat);
    // —— 统一伴奏：kick 1,3 / snare 2,4 / 半拍踩镲 / 三角贝斯（不随段落变） ——
    if (step % 2 === 0) {
      const b = ((beat % 4) + 4) % 4;
      if (b === 0 || b === 2) AudioEngine.kick(t);
      if (b === 1 || b === 3) AudioEngine.snare(t);
      AudioEngine.tone(t, [110, 98, 130.81, 98][b], spb * 0.4, 'triangle', 0.14);
      if (beat < 4) AudioEngine.blok(t, beat === 3 ? 1320 : 880); // 预备拍
    }
    AudioEngine.hihat(t, false);
    // 段首重音鼓花 + 闪亮登场
    if (sec && beat === sec.start) {
      AudioEngine.kick(t);
      AudioEngine.snare(t);
      AudioEngine.hihat(t, true);
      AudioEngine.sparkle(t);
    }
    // —— 音符级提示音（按拍精确匹配；警报/抛出等允许跨段落到段首前） ——
    for (const n of game.chart) {
      // 空手道：陶罐提前 2 拍抛出 "fwip"
      if ((n.kind === 'karate' || n.kind === 'finale') && (n.beat - 2) * 2 === step) AudioEngine.sfxCue(t);
      if (n.beat === beat) {
        if (n.kind === 'marchOn') AudioEngine.blok(t, 587);  // 正拍脚步（低沉）
        if (n.kind === 'marchOff') AudioEngine.blok(t, 880); // 反拍脚步（高亮）
        if (n.kind === 'fill') AudioEngine.blok(t, 1568);    // 机器人到位"叮"
        if (n.kind === 'glee') { // 同伴领唱和弦（A 大三）持续 dur 拍
          const durSec = n.dur * spb;
          AudioEngine.tone(t, 220, durSec, 'triangle', 0.12);
          AudioEngine.tone(t, 277, durSec, 'triangle', 0.12);
          AudioEngine.tone(t, 330, durSec, 'triangle', 0.12);
        }
      }
      if (n.kind === 'fill' && n.beat + n.dur === beat) AudioEngine.blok(t, 2093); // 灌满提示
      // 太空棒球：投球声提前 flight 拍（三种音色对应三种球速）
      if (n.kind === 'spaceball' && (n.beat - n.flight) * 2 === step) {
        if (n.flight === 2) AudioEngine.bell(t, 2093);
        else if (n.flight === 0.5) AudioEngine.zap(t);
        else AudioEngine.swish(t);
      }
      if (n.kind === 'crop' && n.beat - 1 === beat) AudioEngine.blok(t, 988);    // 菜冒头
      if (n.kind === 'pumpkin' && n.beat - 1 === beat) AudioEngine.blok(t, 494); // 南瓜冒头
      // 宇宙射击：敌人到准星前 2 拍警报
      if (n.kind === 'shooter' && (n.beat - 2) * 2 === step) AudioEngine.blok(t, 1175);
      // 打包：物品预告提前 2 拍，糖果「叮」/ 虫子「嗡」
      if (n.kind === 'packing' && n.beat - 2 === beat) {
        if (n.key === 'alt') AudioEngine.tone(t, 180, 0.3, 'sawtooth', 0.25);
        else AudioEngine.blok(t, 1318);
      }
      // 老鼠冲刺：预备「蹲！」/ 真哨 GO / 假哨（忍住别松）
      if (n.kind === 'ratrace') {
        if (n.beat - 1 === beat) AudioEngine.tone(t, 392, spb * 0.3, 'square', 0.24);
        if (n.beat + n.dur === beat) AudioEngine.whistle(t);
        for (const f of n.fakes) {
          if (n.beat + f === beat) AudioEngine.whistle(t, true);
        }
      }
      // DJ：「YO!」准备松开（混曲里伴奏不静音，见 onPress 注释）
      if (n.kind === 'dj' && n.beat + n.dur - 0.5 === beat) AudioEngine.blok(t, 988);
    }
    // —— 指令表级提示音（与各原关一致） ——
    // 节奏模仿：老师示范（音阶递增）
    for (const d of cur.echoDemo) {
      if (d.beat === beat) AudioEngine.blok(t, this.ECHO_SCALE[d.idx]);
    }
    // 乒乓：电脑回球声
    for (const ev of cur.pongEvents) {
      if (ev.side === 'cpu' && ev.beat === beat) AudioEngine.pon(t, 880);
    }
    // 蓝鸟：队长唱「突突突」blok 587/587/784；「昂——」tone 392/440
    for (const [c, kind] of cur.birdCmds) {
      if (kind === 'peck') {
        if (beat === c || beat === c + 0.5) AudioEngine.blok(t, 587);
        if (beat === c + 1) AudioEngine.blok(t, 784);
      } else {
        if (beat === c) AudioEngine.tone(t, 392, spb * 0.55, 'square', 0.2);
        if (beat === c + 1) AudioEngine.tone(t, 440, spb * 0.6, 'square', 0.2);
      }
    }
    // 拍手三人组：同伴示范两声（玩家的第三声不预排，由玩家自己拍）
    for (const [c, gap] of cur.clapGroups) {
      if (beat === c || beat === c + gap) AudioEngine.clap(t);
    }
    // 和尚：唱数（半拍一音，音高递增）
    for (const [c, pitches] of cur.monkCmds) {
      for (let i = 0; i < pitches.length; i++) {
        if (beat === c + i * 0.5) AudioEngine.blok(t, pitches[i]);
      }
    }
    // 魔法使：音节 blok 659/740/831（快咒半拍间隔 / 慢咒一拍间隔）
    for (const [c, kind] of cur.mahouCmds) {
      const gap = kind === 'fast' ? 0.5 : 1;
      if (beat === c) AudioEngine.blok(t, 659);
      if (beat === c + gap) AudioEngine.blok(t, 740);
      if (beat === c + 2 * gap) AudioEngine.blok(t, 831);
    }
    // 企鹅跳台：高/低音铃
    for (const [c, pitch] of cur.showCues) {
      if (beat === c) AudioEngine.bell(t, pitch);
    }
    // 踢踏三连：示范 tick×3（1/3 拍间隔不在半拍网格上，组首一次排整组）
    for (const [c] of cur.tapGroups) {
      if (beat === c) {
        AudioEngine.tick(t, 1600);
        AudioEngine.tick(t + spb / 3, 1600);
        AudioEngine.tick(t + 2 * spb / 3, 1600);
      }
    }
    // 拳击台：教练喊拳路（与第 19 关一致）
    for (const [c, kind] of cur.ringCmds) {
      if (beat !== c) continue;
      if (kind === 'combo') {
        AudioEngine.blok(t, 587);             // pa
        AudioEngine.blok(t + spb * 0.5, 659); // pa
        AudioEngine.blok(t + spb, 784);       // pow!
      } else {
        AudioEngine.blok(t, 784);             // pow!
      }
    }
  },

  onJudge(game, note, res) {
    const st = Conductor.songTime();
    const r = game.remix;
    const now = AudioEngine.now();
    if (res === 'miss') {
      r.sadT = st;
      if (note.kind === 'karate' || note.kind === 'finale' || note.kind === 'monk' || note.kind === 'spaceball') note.fallT = st;
      if (note.kind === 'crop' || note.kind === 'pumpkin' || note.kind === 'shooter' || note.kind === 'packing') note.missT = st;
      if (note.kind === 'fill') { note.doneT = st; note.fillShown = 0; note.outcome = 'empty'; }
      AudioEngine.tone(now, 150, 0.22, 'sawtooth', 0.15);
      return;
    }
    r.happyT = st;
    r.hitT = st;
    switch (note.kind) {
      case 'karate':
      case 'finale':
        AudioEngine.sfxSmash();
        game.burst(260, 310, '#c98d5e', 14);
        break;
      case 'echo': // 玩家敲出对应音高，形成「演奏」感
        AudioEngine.blok(now, this.ECHO_SCALE[note.idx % this.ECHO_SCALE.length]);
        game.burst(700, 360, '#8be9fd', 8);
        break;
      case 'pong':
        r.swingT = st;
        AudioEngine.pon(now, 1150);
        game.burst(748, 330, '#c4f56b', 10);
        break;
      case 'marchOn':
      case 'marchOff':
        r.stepT = st;
        AudioEngine.blok(now, note.kind === 'marchOff' ? 988 : 660);
        game.burst(450, 400, '#cbb26a', 5);
        break;
      case 'peck':
        AudioEngine.tone(now, 240, 0.08, 'sine', 0.3);  // 啄！
        AudioEngine.tone(now, 1760, 0.09, 'sine', 0.1); // 星星
        game.burst(740, 380, '#fff', 5);
        break;
      case 'clap':
        r.clapT = st;
        AudioEngine.clap(now); // 拍中了：第三声融入节奏
        game.burst(680, 372, '#ffffff', 8);
        break;
      case 'spaceball':
        r.swingT = st;
        AudioEngine.punch(now);
        AudioEngine.swish(now);
        game.burst(300, 320, '#ffffff', 10);
        break;
      case 'crop':
        r.hopT = st;
        AudioEngine.punch(now);
        AudioEngine.blok(now, 1320);
        game.burst(420, 400, '#7de38b', 8);
        break;
      case 'shooter':
        r.laserT = st;
        r.laserX = 260; // 准星 x（与 sceneShoot 的 AIMX 一致）
        AudioEngine.zap(now);
        AudioEngine.boom(now);
        game.burst(260, 300, '#ff9a3d', 16);
        game.burst(260, 300, '#8be04e', 8);
        break;
      case 'taptrial':
        r.tapT = st;
        AudioEngine.tick(now, 2000); // 玩家的踢踏声更亮一度
        game.burst(650, 420, '#d8c9a8', 4);
        break;
      case 'monk':
        note.eatenT = st;
        AudioEngine.chomp(now);
        game.burst(400, 330, '#ffd9a0', 8);
        break;
      case 'packing':
        if (note.key === 'alt') {
          AudioEngine.punch(now); // 拍虫
          game.burst(480, 384, '#8be04e', 8);
        } else {
          AudioEngine.blok(now, 1320); // 接糖
          game.burst(480, 384, '#ff7eb9', 8);
        }
        break;
      case 'mahou':
        r.bloomT = st;
        AudioEngine.sparkle(now); // 花开！
        game.burst(600, 380, '#ff7eb9', 12);
        break;
      case 'showtime':
        r.jumpT = st;
        note.hitT = st;
        AudioEngine.sfxCue(now); // 起跳上升滑音
        game.burst(240, 386, '#ffffff', 8);
        break;
      case 'ringside':
        r.punchT = st;
        if (note.cmd === 'combo' && note.idx === 2) { // 三连击最后一下是重击
          AudioEngine.boom(now);
          game.burst(660, 320, '#ffd94d', 12);
        } else {
          AudioEngine.punch(now);
        }
        game.burst(660, 320, '#aee2ff', 6);
        break;
      // fill / stretch / pumpkin / glee / ratrace / dj：长按音符，反馈在 onPress / onRelease
    }
  },

  // 长按（灌油 / 昂首 / 南瓜 / 合唱 / 冲刺 / 搓碟）：按下蓄力
  onPress(game, note, res) {
    const st = Conductor.songTime();
    note.pressT = st;
    const r = game.remix;
    r.holdT = st;
    if (note.kind === 'fill' || note.kind === 'ratrace') AudioEngine.fillStart(); // 蓄力上升音
    else if (note.kind === 'glee') AudioEngine.choirStart(); // 你的声部加入
    else if (note.kind === 'dj') {
      r.scratchT = st;
      AudioEngine.scratch(AudioEngine.now()); // 搓碟（混曲简化：伴奏不静音，仅叠搓碟声）
    }
  },

  onRelease(game, note, res) {
    const st = Conductor.songTime();
    const r = game.remix;
    const now = AudioEngine.now();
    const bad = res === 'miss' || res === 'over';
    switch (note.kind) {
      case 'fill':
        note.doneT = st;
        note.fillShown = note.pressT != null
          ? Math.min(1.2, (st - note.pressT) / (note.dur * Conductor.secPerBeat()))
          : 0;
        AudioEngine.fillStop();
        if (bad) {
          note.outcome = 'spill';
          r.sadT = st;
          game.burst(480, 320, '#3a3a44', 14);
        } else {
          note.outcome = 'ok';
          r.happyT = st;
          r.hitT = st;
          game.burst(480, 320, '#7de38b', 12);
        }
        break;
      case 'stretch': // 蓝鸟昂首：松开伸展
        if (bad) {
          r.sadT = st;
          AudioEngine.tone(now, 150, 0.22, 'sawtooth', 0.18);
        } else {
          r.stretchT = st;
          r.happyT = st;
          r.hitT = st;
          AudioEngine.sfxCue(now);
        }
        break;
      case 'pumpkin': // 南瓜：蓄满拔出
        if (bad) {
          r.sadT = st;
          note.missT = st;
          AudioEngine.tone(now, 150, 0.22, 'sawtooth', 0.15);
        } else {
          r.happyT = st;
          r.hopT = st;
          AudioEngine.punch(now);
          AudioEngine.blok(now, 494);
          game.burst(780, 400, '#ff9a3d', 12);
        }
        break;
      case 'glee': // 合唱：松开收声
        AudioEngine.choirStop();
        if (bad) {
          r.sadT = st;
        } else {
          r.happyT = st;
          r.hitT = st;
          game.burst(660, 330, '#8be9fd', 10);
        }
        break;
      case 'ratrace': // 松开 = 冲刺 / 摔倒
        AudioEngine.fillStop();
        if (bad) {
          r.sadT = st;
          note.tripT = st;
        } else {
          r.goT = st;
          note.goT = st;
          r.happyT = st;
          AudioEngine.swish(now); // 冲刺破空
          game.burst(240, 400, '#c9b08a', 10);
        }
        break;
      case 'dj': // 松开 = 音乐回来（高光音）
        if (bad) {
          r.sadT = st;
        } else {
          r.dropT = st;
          r.happyT = st;
          AudioEngine.tone(now, 1568, 0.35, 'sine', 0.22);
          game.burst(480, 300, '#ff5da2', 14);
        }
        break;
    }
  },

  onWhiff(game) {
    const st = Conductor.songTime();
    const r = game.remix;
    r.hitT = st;   // 空手道/模仿的空气动作
    r.swingT = st; // 乒乓/棒球挥空
    r.sadT = st;
    r.clapT = st;  // 拍手：照样抬手（动作反馈）
    r.laserT = st; // 射击：激光射向深空
    r.laserX = 1000;
    r.punchT = st; // 拳击：挥空也出拳
  },

  draw(game, ctx) {
    const beat = Conductor.songBeat();
    const sec = this.sectionAt(beat);
    if (!sec) this.sceneReady(ctx, game);
    else {
      this.sceneStage(ctx, game); // 共享舞台背景
      switch (sec.kind) {
        case 'karate': this.sceneKarate(ctx, game, sec, false); break;
        case 'finale': this.sceneKarate(ctx, game, sec, true); break;
        case 'birds': this.sceneBirds(ctx, game, sec); break;
        case 'marchOn': this.sceneMarch(ctx, game, sec, false); break;
        case 'marchOff': this.sceneMarch(ctx, game, sec, true); break;
        case 'pong': this.scenePong(ctx, game, sec); break;
        case 'fill': this.sceneFill(ctx, game, sec); break;
        case 'monk': this.sceneMonk(ctx, game, sec); break;
        case 'clappy': this.sceneClap(ctx, game, sec); break;
        case 'shooter': this.sceneShoot(ctx, game, sec); break;
        case 'echo': this.sceneEcho(ctx, game, sec); break;
        case 'spaceball': this.sceneSpaceball(ctx, game, sec); break;
        case 'crop': this.sceneCrop(ctx, game, sec); break;
        case 'taptrial': this.sceneTaptrial(ctx, game, sec); break;
        case 'glee': this.sceneGlee(ctx, game, sec); break;
        case 'packing': this.scenePacking(ctx, game, sec); break;
        case 'mahou': this.sceneMahou(ctx, game, sec); break;
        case 'showtime': this.sceneShowtime(ctx, game, sec); break;
        case 'ratrace': this.sceneRatrace(ctx, game, sec); break;
        case 'dj': this.sceneDJ(ctx, game, sec); break;
        case 'ringside': this.sceneRingside(ctx, game, sec); break;
      }
    }
    // 段首标题卡（1.5 拍，弹跳入场 + 淡出）
    if (sec && beat >= sec.start && beat < sec.start + 1.5) {
      const p = (beat - sec.start) / 1.5;
      const pop = 1 + 0.35 * Math.max(0, 1 - p * 5);
      ctx.save();
      ctx.globalAlpha = p < 0.75 ? 1 : 1 - (p - 0.75) / 0.25;
      ctx.translate(480, 210);
      ctx.scale(pop, pop);
      ctx.fillStyle = 'rgba(20,16,40,0.78)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(-190, -48, 380, 96, 18);
      else ctx.rect(-190, -48, 380, 96, 18);
      ctx.fill();
      ctx.strokeStyle = '#ffd94d';
      ctx.lineWidth = 4;
      ctx.stroke();
      Draw.text(ctx, sec.name, 0, 2, 46, '#ffd94d');
      ctx.restore();
    }
  },

  /* ---------- 预备画面（前 4 拍）：全员集结 ---------- */
  sceneReady(ctx, game) {
    const beat = Conductor.songBeat();
    const bg = ctx.createLinearGradient(0, 0, 0, 540);
    bg.addColorStop(0, '#3b2d5c');
    bg.addColorStop(1, '#241d3d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 960, 540);
    // 幕布
    ctx.fillStyle = '#7a1f2b';
    ctx.fillRect(0, 0, 960, 26);
    for (let i = 0; i < 12; i++) {
      ctx.beginPath(); ctx.arc(i * 87 + 24, 26, 26, 0, Math.PI); ctx.fill();
    }
    Draw.ground(ctx, 440, '#191430');
    // 全体演员排队亮相
    const bob = Math.sin(beat * Math.PI) * 5;
    Animals.cat(ctx, 200, 400 + bob, 36, { color: '#f5a35c', headband: '#fff' });
    Animals.bunny(ctx, 340, 402 - bob, 34, { color: '#dfe7ee' });
    Animals.bird(ctx, 480, 400 + bob, 34, { color: '#4a90d9' });
    Animals.dog(ctx, 620, 402 - bob, 32, { color: '#c98d5e' });
    Animals.alpaca(ctx, 760, 396 + bob, 36, { color: '#f0e6d2' });
    if (beat >= 0) Draw.text(ctx, '全员集结 · 混曲预备…', 480, 180, 36, '#fff');
  },

  /* ---------- 共享舞台背景：剧场（幕布 + 聚光灯 + 观众 + 木地板） ---------- */
  sceneStage(ctx, game) {
    const st = Conductor.songTime();
    const beat = Conductor.songBeat();
    const bg = ctx.createLinearGradient(0, 0, 0, 540);
    bg.addColorStop(0, '#2c2350');
    bg.addColorStop(1, '#191430');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 960, 540);
    // 扫动的聚光灯
    const sweep = Math.sin(st * 0.7) * 0.2;
    for (const dir of [-1, 1]) {
      ctx.save();
      ctx.translate(480 + dir * 330, -10);
      ctx.rotate(dir * (0.32 + sweep));
      const lg = ctx.createLinearGradient(0, 0, 0, 470);
      lg.addColorStop(0, 'rgba(255,240,180,0.13)');
      lg.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(-110, 470); ctx.lineTo(110, 470);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    // 顶幕 + 侧幕
    ctx.fillStyle = '#7a1f2b';
    ctx.fillRect(0, 0, 960, 26);
    for (let i = 0; i < 12; i++) {
      ctx.beginPath(); ctx.arc(i * 87 + 24, 26, 26, 0, Math.PI); ctx.fill();
    }
    ctx.fillStyle = '#5e1722';
    ctx.fillRect(0, 0, 22, 470);
    ctx.fillRect(938, 0, 22, 470);
    // 舞台地板
    Draw.ground(ctx, 440, '#8a5a3b');
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath(); ctx.moveTo(i * 128 + 20, 448); ctx.lineTo(i * 128 - 30, 540); ctx.stroke();
    }
    // 前排观众剪影（随节拍晃动）
    for (let i = 0; i < 9; i++) {
      const ab = Math.sin(beat * Math.PI + i * 1.3) * 3;
      ctx.fillStyle = '#0f0c1c';
      ctx.beginPath(); ctx.arc(i * 116 + 40, 536 + ab, 24, 0, Math.PI * 2); ctx.fill();
    }
  },

  /* ---------- 空手道 / 终章：猫 + 飞罐 + 目标圈 ---------- */
  sceneKarate(ctx, game, sec, finale) {
    const st = Conductor.songTime();
    const beat = Conductor.songBeat();
    const r = game.remix;
    const TX = 260, TY = 310;
    // 终章：星夜挂幕
    if (finale) {
      for (let i = 0; i < 16; i++) {
        ctx.globalAlpha = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(st * 3 + i));
        ctx.fillStyle = '#fff';
        ctx.fillRect((i * 173) % 960, 36 + (i * 97) % 170, 3, 3);
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff3c4';
      ctx.beginPath(); ctx.arc(820, 90, 34, 0, Math.PI * 2); ctx.fill();
    }
    // 目标圈（随节拍脉动）
    const pulse = 1 + 0.08 * Math.max(0, Math.sin(beat * Math.PI));
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 5;
    ctx.setLineDash([10, 8]);
    ctx.beginPath(); ctx.arc(TX, TY, 46 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    // 空手道猫
    const bob = Math.sin(beat * Math.PI) * 6;
    const punching = st - r.hitT < 0.22;
    Animals.cat(ctx, 155, 345 + bob, 44, {
      color: '#f5a35c',
      mood: this.moodOf(r, st),
      headband: finale ? '#ffd94d' : '#fff',
      armL: 0.6,
      armR: punching ? -0.15 : 0.6,
      squash: punching ? 0.14 : 0,
      tailUp: punching ? 1 : 0
    });
    if (punching) {
      const p = 1 - (st - r.hitT) / 0.22;
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.8 * p).toFixed(3) + ')';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(TX - 30, TY, 24 + (1 - p) * 30, -0.6, 0.6); ctx.stroke();
    }
    // 飞行陶罐
    for (const n of this.secNotes(game, sec, ['karate', 'finale'])) {
      const launch = n.beat - 2;
      if (beat < launch || n.state === 'hit') continue;
      ctx.save();
      if (n.state === 'miss') {
        const ft = st - (n.fallT || st);
        if (ft > 0.8) { ctx.restore(); continue; }
        ctx.globalAlpha = 1 - ft / 0.8;
        ctx.translate(TX, TY + ft * ft * 700);
        ctx.rotate(ft * 6);
      } else {
        const p = (beat - launch) / 2;
        if (p > 1.35) { ctx.restore(); continue; }
        const x = 920 - (920 - TX) * p;
        const y = TY - Math.sin(Math.min(p, 1) * Math.PI) * 70;
        ctx.translate(x, y);
        ctx.rotate(beat * 3);
      }
      ctx.fillStyle = '#b5651d';
      ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8a4a12';
      ctx.fillRect(-18, -4.5, 36, 9);
      ctx.restore();
    }
  },

  /* ---------- 蓝鸟：三鸟 + 指令气泡 ---------- */
  sceneBirds(ctx, game, sec) {
    const st = Conductor.songTime();
    const beat = Conductor.songBeat();
    const r = game.remix;
    // 树枝
    ctx.strokeStyle = '#7a4a21';
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(240, 442); ctx.lineTo(900, 432); ctx.stroke();
    ctx.fillStyle = '#5aa33e';
    ctx.beginPath(); ctx.ellipse(300, 428, 20, 10, 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(860, 420, 18, 9, -0.4, 0, Math.PI * 2); ctx.fill();
    // 队长（左边高台 + 礼帽）
    let singing = false;
    for (const [c] of this._cur.birdCmds) {
      if (beat >= c && beat < c + 1.05) singing = true;
    }
    ctx.fillStyle = '#8d6e63';
    ctx.fillRect(108, 380, 64, 60);
    ctx.fillStyle = '#6d4c3d';
    ctx.fillRect(96, 370, 88, 14);
    const cbob = Math.sin(beat * Math.PI) * 4;
    Animals.bird(ctx, 140, 330 + cbob, 42, { color: '#3d6b9e', beakOpen: singing ? 1 : 0 });
    ctx.fillStyle = '#26232e';
    ctx.fillRect(118, 268 + cbob, 44, 10);
    ctx.fillRect(128, 244 + cbob, 24, 26);
    // 指令气泡
    for (const [c, kind] of this._cur.birdCmds) {
      if (beat >= c && beat < c + 2) {
        const peck = kind === 'peck';
        Draw.text(ctx, peck ? '突！突！突！' : '昂——！', 340, 170, 32, peck ? '#c62828' : '#1565c0');
        Draw.text(ctx, peck ? '点按空格 ×3' : '按住再松开', 340, 204, 20, 'rgba(255,255,255,0.85)');
      }
    }
    // 两只同伴（在回应窗口示范）
    for (let i = 0; i < 2; i++) {
      const x = 400 + i * 140;
      let pose = 'idle';
      for (const [c, kind] of this._cur.birdCmds) {
        if (kind === 'peck' && beat >= c + 2 && beat < c + 3.3) pose = 'peck';
        if (kind === 'stretch' && beat >= c + 1.5 && beat < c + 3) pose = 'stretch';
      }
      Animals.bird(ctx, x, 396, 32, { color: '#4a90d9', pose, beakOpen: pose === 'idle' ? 0 : 0.8 });
    }
    // 玩家（橙色）：蓄力低头 → 松开昂首
    let pose = 'idle';
    if (st - r.stretchT < 0.45) pose = 'stretch';
    else if (r.holdT > r.stretchT && st - r.holdT < 0.9) pose = 'peck';
    else if (st - r.hitT < 0.26) pose = 'peck';
    const sad = st - r.sadT < 0.7;
    Animals.bird(ctx, 740, 394, 36, {
      color: '#ff9a3d',
      pose,
      beakOpen: pose === 'idle' ? 0 : 0.8,
      mood: sad ? 'sad' : 'idle'
    });
    if (sad) Draw.text(ctx, '?', 740, 318, 32, '#fff');
  },

  /* ---------- 齐步走（off=反拍）：5 兔 + 指示牌 ---------- */
  sceneMarch(ctx, game, sec, off) {
    const st = Conductor.songTime();
    const beat = Conductor.songBeat();
    const r = game.remix;
    // 指示牌（● 正拍 / ◐ 反拍）
    ctx.fillStyle = '#8d6e63';
    ctx.fillRect(856, 116, 8, 60);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#26232e';
    ctx.lineWidth = 3;
    ctx.fillRect(800, 60, 120, 56);
    ctx.strokeRect(800, 60, 120, 56);
    const cx = 826, cy = 88;
    ctx.fillStyle = '#26232e';
    ctx.beginPath(); ctx.arc(cx, cy, 13, 0, Math.PI * 2); ctx.fill();
    if (off) {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(cx, cy, 13, -Math.PI / 2, Math.PI / 2); ctx.fill();
      ctx.strokeStyle = '#26232e';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(cx, cy, 13, 0, Math.PI * 2); ctx.stroke();
    }
    Draw.text(ctx, off ? '反拍' : '正拍', 872, 88, 24, '#26232e');
    // 全队脚步时刻表（当前段）
    const kind = off ? 'marchOff' : 'marchOn';
    const squadSteps = this.secNotes(game, sec, [kind]).map(n => n.beat);
    // 队伍：5 只兔子，中间橙色是你
    for (let i = 0; i < 5; i++) {
      const x = 230 + i * 110;
      const isPlayer = i === 2;
      let yOff = 0, flop = 0, squash = 0;
      if (!isPlayer) {
        for (const nb of squadSteps) {
          const p = (beat - (nb - 0.12)) / 0.45;
          if (p >= 0 && p <= 1) {
            yOff = -Math.sin(p * Math.PI) * 26;
            flop = Math.sin(p * Math.PI);
            if (p > 0.85) squash = (p - 0.85) * 1.5;
            break;
          }
        }
      } else {
        const hp = (st - r.stepT) / 0.3;
        if (hp >= 0 && hp <= 1) {
          yOff = -Math.sin(hp * Math.PI) * 26;
          flop = Math.sin(hp * Math.PI);
        }
      }
      let mood = 'idle', rotate = 0;
      if (isPlayer) {
        if (st - r.sadT < 0.5) { mood = 'sad'; rotate = Math.sin(st * 28) * 0.15; }
        else if (st - r.stepT < 0.3) mood = 'happy';
      }
      Animals.bunny(ctx, x, 380 + yOff, 34, {
        color: isPlayer ? '#ff9a3d' : '#dfe7ee',
        mood, rotate, squash, earFlop: flop,
        headband: isPlayer ? '#e85d5d' : null,
        armL: 0.5 + flop * 0.4,
        armR: 0.5 - flop * 0.4
      });
    }
    Draw.text(ctx, '▼ 你', 450, 306, 22, '#c62828');
  },

  /* ---------- 节奏乒乓：狗 + 往返球 ---------- */
  scenePong(ctx, game, sec) {
    const st = Conductor.songTime();
    const beat = Conductor.songBeat();
    const r = game.remix;
    const PX = 800, CX = 160, BY = 330;
    // 球台 + 球网
    ctx.fillStyle = '#1565c0';
    ctx.fillRect(180, 368, 600, 16);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(180, 368, 600, 3);
    ctx.fillStyle = '#0d47a1';
    ctx.fillRect(230, 384, 14, 38);
    ctx.fillRect(716, 384, 14, 38);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 4;
    ctx.setLineDash([8, 8]);
    ctx.beginPath(); ctx.moveTo(480, 180); ctx.lineTo(480, 368); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#c62828';
    ctx.fillRect(476, 360, 8, 10);
    // 电脑挥拍（纯时钟比较，不改状态）
    let cpuSwing = false;
    for (const ev of this._cur.pongEvents) {
      if (ev.side === 'cpu' && beat >= ev.beat && beat - ev.beat < 0.36) cpuSwing = true;
    }
    // 小狗球手（与第 3 关同款）
    const drawPlayer = (x, swing, color, mood) => {
      const dir = x === PX ? -1 : 1;
      const reach = swing ? 30 : 0;
      const px = x + dir * (52 + reach);
      ctx.save();
      ctx.translate(px, BY - 6);
      ctx.rotate(dir * (swing ? -0.3 : 0.08));
      ctx.fillStyle = '#8d6e63';
      ctx.fillRect(-5, 8, 10, 28);
      ctx.fillStyle = '#e85d5d';
      ctx.beginPath(); ctx.arc(0, -10, 22, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.translate(x, BY + 16);
      if (dir === -1) ctx.scale(-1, 1);
      Animals.dog(ctx, 0, 0, 30, {
        color, mood,
        squash: swing ? 0.12 : 0,
        tailWag: Math.sin(st * 6) * 0.5 + 0.5
      });
      ctx.restore();
    };
    drawPlayer(CX, cpuSwing, '#c98d5e', 'idle');
    drawPlayer(PX, st - r.swingT < 0.18, '#f5a35c', st - r.sadT < 0.7 ? 'sad' : 'idle');
    // 球：找到当前所处的球路段
    const evs = this._cur.pongEvents;
    let bi = -1;
    for (let i = 0; i < evs.length - 1; i++) {
      if (beat >= evs[i].beat && beat < evs[i + 1].beat) { bi = i; break; }
    }
    if (bi >= 0) {
      const a = evs[bi], b2 = evs[bi + 1];
      const seg = b2.beat - a.beat;
      const tt = Math.min(1.2, (beat - a.beat) / seg);
      const xa = a.side === 'player' ? PX - 52 : CX + 52;
      const xb = b2.side === 'player' ? PX - 52 : CX + 52;
      const x = xa + (xb - xa) * tt;
      const fast = seg <= 0.55;
      const arcH = fast ? 60 : 150;
      const y = BY - Math.sin(Math.min(tt, 1) * Math.PI) * arcH;
      // 残影
      ctx.fillStyle = fast ? 'rgba(255,90,90,0.25)' : 'rgba(255,255,255,0.2)';
      for (let k = 1; k <= 3; k++) {
        const t2 = Math.max(0, tt - k * 0.06);
        const gx = xa + (xb - xa) * t2;
        const gy = BY - Math.sin(t2 * Math.PI) * arcH;
        ctx.beginPath(); ctx.arc(gx, gy, 12 - k * 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = fast ? '#ff5a5a' : '#ffffff';
      ctx.beginPath(); ctx.arc(x, y, 13, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  },

  /* ---------- 灌油机器人：机器人 + 传送带 ---------- */
  sceneFill(ctx, game, sec) {
    const st = Conductor.songTime();
    const beat = Conductor.songBeat();
    const spb = Conductor.secPerBeat();
    const SX = 480;
    // 传送带（滚动条纹 + 警示边）
    ctx.fillStyle = '#2b2b33';
    ctx.fillRect(0, 400, 960, 40);
    ctx.fillStyle = '#3d3d49';
    const off = (st * 140) % 60;
    for (let x = -60; x < 1000; x += 60) ctx.fillRect(x + off, 400, 26, 40);
    ctx.fillStyle = '#1f1f26';
    ctx.fillRect(0, 436, 960, 6);
    for (let i = 0; i < 24; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#d8b62e' : '#26262e';
      ctx.beginPath();
      ctx.moveTo(i * 40, 440);
      ctx.lineTo(i * 40 + 20, 440);
      ctx.lineTo(i * 40 + 10, 458);
      ctx.lineTo(i * 40 - 10, 458);
      ctx.closePath(); ctx.fill();
    }
    // 加油枪
    ctx.fillStyle = '#5a6b80';
    ctx.fillRect(SX - 12, 60, 24, 150);
    ctx.fillStyle = '#7c8da3';
    ctx.beginPath();
    ctx.moveTo(SX - 22, 210);
    ctx.lineTo(SX + 22, 210);
    ctx.lineTo(SX + 8, 248);
    ctx.lineTo(SX - 8, 248);
    ctx.closePath(); ctx.fill();
    // 灌油中的油流
    const holding = game.chart.find(n => n.kind === 'fill' && n.state === 'holding');
    if (holding) {
      ctx.fillStyle = '#ffd94d';
      ctx.fillRect(SX - 5, 248, 10, 120);
      ctx.fillStyle = 'rgba(255,217,77,0.5)';
      ctx.fillRect(SX - 9, 250, 18, 116);
    }
    // 机器人队列
    for (const n of this.secNotes(game, sec, ['fill'])) {
      const walkIn = 4;
      let x, mood = 'idle', fill = 0, shake = false;
      if (n.state === 'pending') {
        if (beat < n.beat - walkIn) continue;
        const p = Math.min(1, (beat - (n.beat - walkIn)) / walkIn);
        x = 1060 - (1060 - SX) * p;
      } else if (n.state === 'holding') {
        x = SX;
        fill = Math.min(1.2, (st - n.pressT) / (n.dur * spb));
        if (fill >= 1.05) shake = true;
      } else {
        const q = (st - (n.doneT || st)) * 2.2;
        if (q > 4) continue;
        x = SX - q * 220;
        fill = n.fillShown || 0;
        mood = n.outcome === 'ok' ? 'happy' : 'sad';
        if (n.outcome === 'spill') shake = q < 0.8;
      }
      const bobW = (n.state === 'pending' && beat < n.beat) ? Math.abs(Math.sin(beat * Math.PI * 2)) * 4 : 0;
      this.drawRobot(ctx, x, 388 - bobW, n.dur, fill, mood, shake);
    }
  },

  // 画一个机器人（fill: 0~1.2 油量比例），与第 5 关同款
  drawRobot(ctx, x, y, dur, fill, mood, shake) {
    const w = 52 + dur * 14;
    const h = 64 + dur * 16;
    if (shake) x += Math.sin(Conductor.songTime() * 60) * 3;
    ctx.save();
    ctx.translate(x, y);
    // 轮子
    ctx.fillStyle = '#3a3a44';
    ctx.beginPath(); ctx.arc(-w * 0.28, h * 0.5, 9, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(w * 0.28, h * 0.5, 9, 0, Math.PI * 2); ctx.fill();
    // 身体
    ctx.fillStyle = '#9fb2c8';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-w / 2, -h / 2, w, h, 10);
    else ctx.rect(-w / 2, -h / 2, w, h);
    ctx.fill();
    ctx.strokeStyle = '#5a6b80';
    ctx.lineWidth = 3;
    ctx.stroke();
    // 天线 + 指示灯（满=绿，溢出=红）
    ctx.strokeStyle = '#5a6b80';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, -h / 2); ctx.lineTo(0, -h / 2 - 16); ctx.stroke();
    ctx.fillStyle = fill >= 1.05 ? '#e85d5d' : (fill >= 0.95 ? '#7de38b' : '#8a93a0');
    ctx.beginPath(); ctx.arc(0, -h / 2 - 22, 7, 0, Math.PI * 2); ctx.fill();
    if (fill >= 0.95) {
      ctx.globalAlpha = 0.35;
      ctx.beginPath(); ctx.arc(0, -h / 2 - 22, 12, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // 眼睛与嘴
    ctx.fillStyle = '#26232e';
    if (mood === 'sad') {
      ctx.fillRect(-w * 0.3, -h * 0.28, 12, 3);
      ctx.fillRect(w * 0.3 - 12, -h * 0.28, 12, 3);
    } else {
      ctx.beginPath(); ctx.arc(-w * 0.22, -h * 0.26, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(w * 0.22, -h * 0.26, 4.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = '#26232e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (mood === 'happy') ctx.arc(0, -h * 0.18, 10, 0.15 * Math.PI, 0.85 * Math.PI);
    else if (mood === 'sad') ctx.arc(0, -h * 0.02, 8, 1.15 * Math.PI, 1.85 * Math.PI);
    else { ctx.moveTo(-7, -h * 0.08); ctx.lineTo(7, -h * 0.08); }
    ctx.stroke();
    // 油箱窗口
    const tw = w * 0.56, th = h * 0.42;
    const tx = -tw / 2, ty = h * 0.5 - 16 - th;
    ctx.fillStyle = '#2b2b33';
    ctx.fillRect(tx, ty, tw, th);
    const fh = Math.min(1, fill) * th;
    const grad = ctx.createLinearGradient(0, ty + th, 0, ty);
    grad.addColorStop(0, '#ffd94d');
    grad.addColorStop(1, '#7de38b');
    ctx.fillStyle = fill >= 1.05 ? '#e85d5d' : grad;
    ctx.fillRect(tx, ty + th - fh, tw, fh);
    ctx.strokeStyle = '#5a6b80';
    ctx.lineWidth = 2;
    ctx.strokeRect(tx, ty, tw, th);
    ctx.restore();
  },

  /* ---------- 和尚：和尚 + 飞包子 ---------- */
  sceneMonk(ctx, game, sec) {
    const st = Conductor.songTime();
    const beat = Conductor.songBeat();
    const r = game.remix;
    // 桌子
    ctx.fillStyle = '#8d6e63';
    ctx.fillRect(300, 400, 220, 14);
    ctx.fillRect(320, 414, 16, 40);
    ctx.fillRect(484, 414, 16, 40);
    const monkNotes = this.secNotes(game, sec, ['monk']);
    // 和尚（咀嚼时张嘴）
    let chew = 0;
    for (const n of monkNotes) {
      if (n.eatenT && st - n.eatenT < 0.4) chew = Math.sin((st - n.eatenT) / 0.4 * Math.PI);
    }
    Animals.monk(ctx, 400, 356, 52, { mood: this.moodOf(r, st), mouthOpen: chew });
    // 唱数气泡（唱几个音 = 跟吃几口）
    for (const [c, pitches] of this._cur.monkCmds) {
      if (beat >= c && beat < c + pitches.length * 0.5 + 0.4) {
        Draw.text(ctx, pitches.length === 2 ? '一！二！' : '一！二！三！', 600, 190, 30, '#c62828');
      }
    }
    // 飞来的包子（唱数时起飞，到点入口；错过则掉落）
    for (const n of monkNotes) {
      if (beat < n.cueBeat || n.state === 'hit') continue;
      ctx.save();
      if (n.state === 'miss') {
        const ft = st - (n.fallT || st);
        if (ft > 0.8) { ctx.restore(); continue; }
        ctx.globalAlpha = 1 - ft / 0.8;
        ctx.translate(400, 330 + ft * ft * 600);
        ctx.rotate(ft * 5);
      } else {
        const p = Math.min(1.3, (beat - n.cueBeat) / (n.beat - n.cueBeat));
        const x = 820 - (820 - 400) * p;
        const y = 330 - Math.sin(Math.min(p, 1) * Math.PI) * 60;
        ctx.translate(x, y);
      }
      // 包子（褶皱小圆包）
      ctx.fillStyle = '#fff3e0';
      ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#d9c4a8';
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * 2 / 5;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 10, Math.sin(a) * 10); ctx.stroke();
      }
      ctx.restore();
    }
  },

  /* ---------- 拍手三人组：三猫拍手 ---------- */
  sceneClap(ctx, game, sec) {
    const st = Conductor.songTime();
    const beat = Conductor.songBeat();
    const r = game.remix;
    const CATX = [280, 480, 680], CATY = 392;
    // 同伴拍手状态（按拍比较，与排程严格一致）：组内第一声→猫0，第二声→猫1
    let clap0 = false, clap1 = false;
    for (const [c, gap] of this._cur.clapGroups) {
      if (beat >= c && beat < c + 0.3) clap0 = true;
      if (beat >= c + gap && beat < c + gap + 0.3) clap1 = true;
    }
    const clapP = st - r.clapT < 0.28;
    const allSad = st - r.sadT < 0.7;
    // 三只猫：谁拍手谁双臂举起 + 爪间闪光（最右是玩家）
    for (let i = 0; i < 3; i++) {
      const isP = i === 2;
      const clapping = isP ? clapP : (i === 0 ? clap0 : clap1);
      let mood = 'idle';
      if (allSad) mood = 'sad';
      else if (clapping || (isP && st - r.happyT < 0.4)) mood = 'happy';
      const bob = Math.sin(beat * Math.PI + i * 0.8) * 4;
      Animals.cat(ctx, CATX[i], CATY + bob, isP ? 42 : 38, {
        color: isP ? '#ff9a3d' : '#8fa3b8',
        mood,
        armL: clapping ? -2.4 : 0.6,
        armR: clapping ? -2.4 : 0.6,
        squash: clapping ? 0.1 : 0
      });
      if (clapping) {
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        const fy = CATY + bob - 20;
        for (let a = 0; a < 5; a++) {
          const ang = -Math.PI / 2 + (a - 2) * 0.55;
          ctx.beginPath();
          ctx.moveTo(CATX[i] + Math.cos(ang) * 30, fy + Math.sin(ang) * 30);
          ctx.lineTo(CATX[i] + Math.cos(ang) * 42, fy + Math.sin(ang) * 42);
          ctx.stroke();
        }
      }
    }
    Draw.text(ctx, '▼ 你', CATX[2], CATY + 66, 22, '#c62828');
    Draw.text(ctx, '听两声拍手，隔同样时间补第三声！', 480, 130, 24, 'rgba(255,255,255,0.85)');
  },

  /* ---------- 宇宙射击：猫战机 + 敌人 ---------- */
  sceneShoot(ctx, game, sec) {
    const st = Conductor.songTime();
    const beat = Conductor.songBeat();
    const r = game.remix;
    const SHIPX = 140, SHIPY = 300, AIMX = 260;
    // 警报视觉（听觉为主，画面仅确认）：右缘红「!」闪烁
    for (const n of this.secNotes(game, sec, ['shooter'])) {
      if (beat >= n.beat - 2 && beat < n.beat - 1.7 && Math.floor(st * 8) % 2 === 0) {
        Draw.text(ctx, '!', 928, SHIPY, 40, '#ff5a5a');
      }
    }
    // 准星（随节拍脉动）
    const pulse = 1 + 0.1 * Math.max(0, Math.sin(beat * Math.PI));
    ctx.strokeStyle = 'rgba(125,227,139,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(AIMX, SHIPY, 26 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(AIMX, SHIPY, 10 * pulse, 0, Math.PI * 2); ctx.stroke();
    // 猫咪战机（飞碟 + 引擎焰 + 座舱里的猫）
    const bobY = Math.sin(st * 2) * 5;
    const fl = 12 + Math.sin(st * 30) * 5;
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.moveTo(SHIPX - 46, SHIPY + 16 + bobY);
    ctx.lineTo(SHIPX - 46 - fl, SHIPY + 24 + bobY);
    ctx.lineTo(SHIPX - 46, SHIPY + 32 + bobY);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#9fb2c8';
    ctx.beginPath(); ctx.ellipse(SHIPX, SHIPY + 24 + bobY, 48, 15, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7c8da3';
    ctx.beginPath(); ctx.ellipse(SHIPX, SHIPY + 26 + bobY, 48, 13, 0, 0, Math.PI); ctx.fill();
    let mood = 'idle';
    if (st - r.sadT < 0.6) mood = 'sad';
    else if (st - r.hitT < 0.3) mood = 'happy';
    Animals.cat(ctx, SHIPX, SHIPY - 2 + bobY, 17, { color: '#f5a35c', mood, armL: 0.5, armR: 0.5 });
    ctx.fillStyle = 'rgba(180,230,255,0.28)';
    ctx.beginPath(); ctx.arc(SHIPX, SHIPY + 6 + bobY, 36, Math.PI, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(180,230,255,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    // 激光束（命中到准星，挥空射向深空）
    const lt = st - r.laserT;
    if (lt >= 0 && lt < 0.14) {
      ctx.save();
      ctx.globalAlpha = 1 - lt / 0.14;
      ctx.strokeStyle = 'rgba(139,233,253,0.6)';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(SHIPX + 46, SHIPY + 12 + bobY);
      ctx.lineTo(r.laserX, SHIPY);
      ctx.stroke();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(SHIPX + 46, SHIPY + 12 + bobY);
      ctx.lineTo(r.laserX, SHIPY);
      ctx.stroke();
      ctx.restore();
    }
    // 敌人：圆胖外星人，警报后 2 拍到准星；漏掉的从战机旁飞走
    for (const n of this.secNotes(game, sec, ['shooter'])) {
      if (n.state === 'hit') continue;
      const launch = n.beat - 2;
      if (beat < launch) continue;
      const p = (beat - launch) / 2;
      if (p > 1.45) continue;
      const x = 1000 - (1000 - AIMX) * p;
      const y = SHIPY + Math.sin((beat + n.beat) * Math.PI) * 5;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(st * 3 + n.beat);
      if (n.state === 'miss') ctx.globalAlpha = Math.max(0, 1 - (p - 1) * 2.5);
      const body = n.state === 'miss' ? '#6b7a4a' : '#8be04e';
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.fill();
      Animals.eye(ctx, 0, 0, 8, 'idle');
      ctx.strokeStyle = body;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(0, -30); ctx.stroke();
      ctx.fillStyle = '#ff5a5a';
      ctx.beginPath(); ctx.arc(0, -33, 4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    Draw.text(ctx, '警报响后 2 拍，敌人到准星——射击！', 480, 120, 22, 'rgba(255,255,255,0.85)');
  },

  /* ---------- 节奏模仿：两羊驼 + 时间轴 ---------- */
  sceneEcho(ctx, game, sec) {
    const beat = Conductor.songBeat();
    const st = Conductor.songTime();
    const r = game.remix;
    const s = sec.start;
    const demo = beat >= s && beat < s + 4;
    const play = beat >= s + 4 && beat < s + 8;
    // 老师（戴帽）与玩家羊驼
    const bob = Math.sin(beat * Math.PI) * 4;
    Animals.alpaca(ctx, 240, 400 + bob, 40, { color: '#f0e6d2', cap: '#1565c0', mood: 'idle' });
    Animals.alpaca(ctx, 700, 400 - bob, 40, { color: '#ffd9a0', mood: this.moodOf(r, st) });
    Draw.text(ctx, '老师', 240, 282, 20, '#8be9fd');
    Draw.text(ctx, '▼ 你', 700, 282, 22, '#c62828');
    // 时间轴：s..s+8 映射到 160..800；上排示范（cyan）/ 下排跟打（gold）
    const X0 = 160, X1 = 800, Y = 160;
    const bx = o => X0 + (X1 - X0) * (o / 8);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(X0, Y); ctx.lineTo(X1, Y); ctx.stroke();
    // 进度游标
    if (beat >= s && beat < s + 8) {
      const cx = X0 + (X1 - X0) * ((beat - s) / 8);
      ctx.strokeStyle = '#ffd94d';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx, Y - 26); ctx.lineTo(cx, Y + 44); ctx.stroke();
    }
    const echoNotes = this.secNotes(game, sec, ['echo']);
    this.ECHO_PATTERN.forEach((p, i) => {
      // 示范音符：经过后常亮
      ctx.fillStyle = beat >= s + p ? '#8be9fd' : 'rgba(139,233,253,0.3)';
      ctx.beginPath(); ctx.arc(bx(p), Y, 9, 0, Math.PI * 2); ctx.fill();
      // 玩家音符：命中亮金 / 错过灰
      const note = echoNotes.find(n => n.beat === s + 4 + p);
      let col = 'rgba(255,217,77,0.35)';
      if (note && note.state === 'hit') col = '#ffd94d';
      if (note && note.state === 'miss') col = '#5a5a66';
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(bx(4 + p), Y + 34, 9, 0, Math.PI * 2); ctx.fill();
    });
    Draw.text(ctx, demo ? '听！' : play ? '跟！' : '预备…', 480, 100, 32, demo ? '#8be9fd' : '#ffd94d');
  },

  /* ---------- 太空棒球：羊驼击球手 + 来球 ---------- */
  sceneSpaceball(ctx, game, sec) {
    const st = Conductor.songTime();
    const beat = Conductor.songBeat();
    const r = game.remix;
    const HITX = 300, BALLY = 320;
    // 击球圈
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 4;
    ctx.setLineDash([8, 7]);
    ctx.beginPath(); ctx.arc(HITX, BALLY, 34, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    // 羊驼击球手 + 球棒（命中挥棒）
    const swinging = st - r.swingT < 0.25;
    Animals.alpaca(ctx, 190, 400, 42, { color: '#f0e6d2', mood: this.moodOf(r, st), cap: '#c62828' });
    ctx.save();
    ctx.translate(242, 336);
    ctx.rotate(swinging ? -1.6 : -0.5);
    ctx.strokeStyle = '#c98d5e';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(76, 0); ctx.stroke();
    ctx.restore();
    // 来球：按 flight 提前飞入（0.5 快=红/平直，1 中=白/小弧，2 高=白/高抛）
    for (const n of this.secNotes(game, sec, ['spaceball'])) {
      const launch = n.beat - n.flight;
      if (beat < launch || n.state === 'hit') continue;
      const p = (beat - launch) / n.flight;
      if (p > 1.4) continue;
      ctx.save();
      if (n.state === 'miss') {
        const ft = st - (n.fallT || st);
        if (ft > 0.8) { ctx.restore(); continue; }
        ctx.globalAlpha = 1 - ft / 0.8;
        ctx.translate(HITX, BALLY + ft * ft * 600);
      } else {
        const x = 940 - (940 - HITX) * Math.min(1.15, p);
        const arcH = n.flight === 2 ? 190 : n.flight === 1 ? 90 : 26;
        const y = BALLY - Math.sin(Math.min(p, 1) * Math.PI) * arcH;
        ctx.translate(x, y);
        if (n.flight === 0.5) { // 快球残影
          ctx.fillStyle = 'rgba(255,90,90,0.3)';
          ctx.beginPath(); ctx.arc(26, 0, 9, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(52, 0, 6, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.fillStyle = n.flight === 0.5 ? '#ff5a5a' : '#ffffff';
      ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#c62828';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 12, 0.6, 2.2); ctx.stroke();
      ctx.restore();
    }
  },

  /* ---------- 收割庄稼：兔子农夫 + 菜 / 南瓜 ---------- */
  sceneCrop(ctx, game, sec) {
    const st = Conductor.songTime();
    const beat = Conductor.songBeat();
    const r = game.remix;
    // 菜畦
    ctx.fillStyle = '#5a3a28';
    ctx.fillRect(120, 428, 720, 20);
    // 兔子农夫（命中蹦一下）
    const hopping = st - r.hopT < 0.3;
    Animals.bunny(ctx, 180, 386 + (hopping ? -14 : Math.sin(beat * Math.PI) * 3), 36, {
      color: '#ff9a3d', mood: this.moodOf(r, st), earFlop: hopping ? 0.7 : 0.1
    });
    // 普通菜：提前 1 拍冒头，熟了点按拔起
    const slots = [320, 440, 560, 680];
    this.secNotes(game, sec, ['crop']).forEach((n, i) => {
      const x = slots[i % slots.length];
      if (beat < n.beat - 1 || n.state === 'hit') return;
      ctx.save();
      if (n.state === 'miss') {
        const ft = st - (n.missT || st);
        if (ft > 0.7) { ctx.restore(); return; }
        ctx.globalAlpha = 1 - ft / 0.7;
        ctx.translate(x, 424 + ft * 26); // 蔫回土里
      } else {
        const p = Math.min(1, beat - (n.beat - 1));
        ctx.translate(x, 424 - p * 34);
      }
      // 胡萝卜：橙身子 + 绿叶
      ctx.fillStyle = '#3fa34d';
      ctx.beginPath(); ctx.ellipse(-6, -24, 5, 10, -0.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(6, -24, 5, 10, 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff8c42';
      ctx.beginPath(); ctx.moveTo(-11, -16); ctx.lineTo(11, -16); ctx.lineTo(0, 16); ctx.closePath(); ctx.fill();
      ctx.restore();
    });
    // 南瓜（最右）：按住蓄力拔起
    for (const n of this.secNotes(game, sec, ['pumpkin'])) {
      if (beat < n.beat - 1 || n.state === 'hit') continue;
      ctx.save();
      let lift = 0;
      if (n.state === 'holding') {
        lift = Math.min(1, (st - n.pressT) / (n.dur * Conductor.secPerBeat())) * 34;
      }
      if (n.state === 'miss') ctx.globalAlpha = 0.45;
      ctx.translate(800, 416 - lift);
      ctx.fillStyle = n.state === 'miss' ? '#7a5a3a' : '#ff9a3d';
      ctx.beginPath(); ctx.ellipse(0, 0, 30, 24, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 3;
      for (const rx of [-12, 0, 12]) {
        ctx.beginPath(); ctx.ellipse(rx, 0, 8, 24, 0, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.fillStyle = '#3fa34d';
      ctx.fillRect(-3, -34, 6, 10);
      ctx.restore();
    }
  },

  /* ---------- 踢踏三连：三猫 + 聚光灯 ---------- */
  sceneTaptrial(ctx, game, sec) {
    const st = Conductor.songTime();
    const beat = Conductor.songBeat();
    const r = game.remix;
    const CATX = [330, 480, 630], CATY = 396;
    // 聚光灯锥
    const lg = ctx.createLinearGradient(0, 40, 0, 470);
    lg.addColorStop(0, 'rgba(255,240,180,0.22)');
    lg.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.moveTo(480, 30); ctx.lineTo(240, 470); ctx.lineTo(720, 470);
    ctx.closePath(); ctx.fill();
    // 示范猫（左）在组首三连踢；玩家猫（右橙）跟踢
    let demoLeg = 0;
    for (const [c] of this._cur.tapGroups) {
      if (beat >= c && beat < c + 1) demoLeg = Math.floor((beat - c) * 3) % 2 === 0 ? 1 : -1;
    }
    const tapP = st - r.tapT < 0.25;
    for (let i = 0; i < 3; i++) {
      const isP = i === 2;
      const tapping = isP ? tapP : (i === 0 && demoLeg !== 0);
      const leg = isP ? (tapP ? 1 : 0) : (i === 0 ? demoLeg : 0);
      Animals.cat(ctx, CATX[i], CATY + Math.sin(beat * Math.PI + i) * 3, isP ? 40 : 36, {
        color: isP ? '#ff9a3d' : '#8fa3b8',
        mood: isP ? this.moodOf(r, st) : 'idle',
        legPhase: leg,
        squash: tapping ? 0.08 : 0
      });
      if (tapping) { // 脚下星光
        ctx.fillStyle = '#ffd94d';
        ctx.beginPath(); ctx.arc(CATX[i] + 20, CATY + 34, 5, 0, Math.PI * 2); ctx.fill();
      }
    }
    Draw.text(ctx, '▼ 你', CATX[2], CATY + 62, 22, '#c62828');
    Draw.text(ctx, '听「哒哒哒」，慢一拍跟踢三连！', 480, 130, 24, 'rgba(255,255,255,0.85)');
  },

  /* ---------- 合唱跟唱：3 羊驼 + 张嘴音符 ---------- */
  sceneGlee(ctx, game, sec) {
    const st = Conductor.songTime();
    const beat = Conductor.songBeat();
    const r = game.remix;
    const AX = [300, 480, 660], AY = 400;
    const notes = this.secNotes(game, sec, ['glee']);
    // 同伴在音符窗口内张嘴领唱；玩家按住时张嘴
    const singing = notes.some(n => beat >= n.beat && beat < n.beat + n.dur);
    const holding = game.chart.some(n => n.kind === 'glee' && n.state === 'holding');
    for (let i = 0; i < 3; i++) {
      const isP = i === 2;
      const open = isP ? holding : singing;
      const bob = Math.sin(beat * Math.PI + i * 0.9) * 4;
      Animals.alpaca(ctx, AX[i], AY + bob, 38, {
        color: isP ? '#ffd9a0' : '#f0e6d2',
        mood: isP ? this.moodOf(r, st) : 'idle',
        stretch: open ? 0.25 : 0
      });
      if (open) {
        // 张嘴（ alpaca 脸在脖子顶，约 AY-43 ）
        ctx.fillStyle = '#7a3b2e';
        ctx.beginPath(); ctx.ellipse(AX[i], AY + bob - 43, 6, 8, 0, 0, Math.PI * 2); ctx.fill();
        // 飘出的音符
        const rise = (st * 40 + i * 30) % 36;
        ctx.globalAlpha = 0.9 - rise / 48;
        Draw.text(ctx, i % 2 ? '♪' : '♫', AX[i] + 30, AY - 96 - rise, 26, '#8be9fd');
        ctx.globalAlpha = 1;
      }
    }
    Draw.text(ctx, '▼ 你', AX[2], AY + 66, 22, '#c62828');
    Draw.text(ctx, '同伴开口你就按住，收声你就松开！', 480, 130, 24, 'rgba(255,255,255,0.85)');
  },

  /* ---------- 打包双键：猫工人 + 传送带糖/虫 ---------- */
  scenePacking(ctx, game, sec) {
    const st = Conductor.songTime();
    const beat = Conductor.songBeat();
    const r = game.remix;
    const CATX = 480, BELTY = 400;
    // 传送带（滚动条纹）
    ctx.fillStyle = '#2b2b33';
    ctx.fillRect(0, BELTY, 960, 36);
    ctx.fillStyle = '#3d3d49';
    const off = (st * 140) % 60;
    for (let x = -60; x < 1000; x += 60) ctx.fillRect(x + off, BELTY, 26, 36);
    ctx.fillStyle = '#1f1f26';
    ctx.fillRect(0, BELTY + 32, 960, 6);
    // 物品：提前 2 拍上传送带，到猫面前按键（先画物品，猫站前景）
    for (const n of this.secNotes(game, sec, ['packing'])) {
      if (beat < n.beat - 2 || n.state === 'hit') continue;
      const p = (beat - (n.beat - 2)) / 2;
      if (p > 1.3) continue;
      const x = 1000 - (1000 - CATX) * Math.min(1.2, p);
      const y = BELTY - 16;
      ctx.save();
      if (n.state === 'miss') ctx.globalAlpha = Math.max(0, 1 - (p - 1) * 2.5);
      ctx.translate(x, y);
      if (n.key === 'alt') { // 虫子：黑紫扭动
        ctx.fillStyle = '#5a3a6e';
        ctx.beginPath(); ctx.ellipse(0, 0, 16, 10, Math.sin(st * 12 + n.beat) * 0.2, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#3a2a4e';
        ctx.lineWidth = 2;
        for (let l = 0; l < 3; l++) {
          ctx.beginPath(); ctx.moveTo(-8 + l * 8, 6); ctx.lineTo(-10 + l * 8, 14); ctx.stroke();
        }
        Animals.eye(ctx, 6, -4, 4, 'idle');
      } else { // 糖果：粉色双扭结
        ctx.fillStyle = '#ff7eb9';
        ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-12, 0); ctx.lineTo(-24, -8); ctx.lineTo(-24, 8); ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(12, 0); ctx.lineTo(24, -8); ctx.lineTo(24, 8); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath(); ctx.arc(-4, -4, 4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    // 猫工人（接糖 / 拍虫时探身）
    const reach = st - r.hitT < 0.2;
    Animals.cat(ctx, CATX, BELTY - 40, 36, {
      color: '#f5a35c', mood: this.moodOf(r, st),
      armL: reach ? -0.2 : 0.5, armR: reach ? -0.2 : 0.5,
      headband: '#1565c0'
    });
    Draw.text(ctx, '糖 = 空格 · 虫 = F', 480, 130, 26, '#ffd94d');
  },

  /* ---------- 魔法使：兔子巫师 + 花苞 ---------- */
  sceneMahou(ctx, game, sec) {
    const st = Conductor.songTime();
    const beat = Conductor.songBeat();
    const r = game.remix;
    // 兔子巫师（尖帽 + 魔杖）
    const casting = st - r.hitT < 0.3;
    Animals.bunny(ctx, 220, 390, 40, {
      color: '#b8a6e0', mood: this.moodOf(r, st),
      armR: casting ? -1.2 : 0.4
    });
    ctx.fillStyle = '#4a3a7e';
    ctx.beginPath();
    ctx.moveTo(188, 316); ctx.lineTo(252, 316); ctx.lineTo(220, 246); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath(); ctx.arc(220, 266, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8d6e63';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(258, 352); ctx.lineTo(300, 314); ctx.stroke();
    if (casting) {
      ctx.fillStyle = '#ffd94d';
      ctx.beginPath(); ctx.arc(304, 310, 8, 0, Math.PI * 2); ctx.fill();
    }
    // 咒语气泡（与听觉提示同步：快咒半拍三连 / 慢咒一拍三连）
    for (const [c, kind] of this._cur.mahouCmds) {
      if (beat >= c && beat < c + (kind === 'fast' ? 1.2 : 2.2)) {
        Draw.text(ctx, kind === 'fast' ? '快快快！' : '慢～慢～慢～', 430, 200, 28,
          kind === 'fast' ? '#ff9a3d' : '#8be9fd');
      }
    }
    // 花苞：对应两个音符，命中绽放
    this.secNotes(game, sec, ['mahou']).forEach((n, i) => {
      const x = 600 + i * 160, y = 400;
      ctx.strokeStyle = '#3fa34d';
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(x, 440); ctx.lineTo(x, y - 8); ctx.stroke();
      if (n.state === 'hit') { // 绽放：六瓣彩花
        const cols = ['#ff7eb9', '#ffd94d', '#8be9fd', '#ff9a3d', '#7de38b', '#e85d5d'];
        for (let p2 = 0; p2 < 6; p2++) {
          const a = p2 * Math.PI / 3;
          ctx.fillStyle = cols[p2];
          ctx.beginPath();
          ctx.ellipse(x + Math.cos(a) * 16, y - 24 + Math.sin(a) * 16, 12, 7, a, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(x, y - 24, 8, 0, Math.PI * 2); ctx.fill();
      } else { // 花苞
        ctx.fillStyle = '#7de38b';
        ctx.beginPath(); ctx.ellipse(x, y - 24, 10, 14, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#3fa34d';
        ctx.beginPath(); ctx.ellipse(x, y - 10, 12, 6, 0, 0, Math.PI * 2); ctx.fill();
      }
    });
  },

  /* ---------- 企鹅跳台：企鹅 + 跳板领奖台 + 双色铃 ---------- */
  sceneShowtime(ctx, game, sec) {
    const st = Conductor.songTime();
    const beat = Conductor.songBeat();
    const r = game.remix;
    const PLANKX = 300, PLANKY = 420;
    // 领奖台
    ctx.fillStyle = '#ffd94d';
    ctx.fillRect(660, 350, 110, 90);
    ctx.fillStyle = '#e0b93e';
    ctx.fillRect(660, 350, 110, 12);
    Draw.text(ctx, '1', 715, 404, 40, '#8a6d1f');
    // 跳板（支架 + 板）
    ctx.fillStyle = '#8d6e63';
    ctx.fillRect(PLANKX - 90, PLANKY, 180, 10);
    ctx.fillStyle = '#5d4037';
    ctx.beginPath();
    ctx.moveTo(PLANKX, PLANKY + 10);
    ctx.lineTo(PLANKX - 16, PLANKY + 44);
    ctx.lineTo(PLANKX + 16, PLANKY + 44);
    ctx.closePath(); ctx.fill();
    // 高低铃（cue 前后摇摆）：高铃=1 拍后跳 / 低铃=2 拍后跳
    for (const [c, pitch] of this._cur.showCues) {
      if (beat < c - 1 && beat >= sec.start) { /* 未到预告期也照画 */ }
      const near = Math.abs(beat - c) < 0.6;
      const hi = pitch > 1500;
      const x = hi ? 540 : 850, y = 140;
      ctx.save();
      ctx.translate(x, y);
      if (near) ctx.rotate(Math.sin(st * 18) * 0.25);
      ctx.fillStyle = hi ? '#ffd94d' : '#d8a93e';
      const rr = hi ? 18 : 26;
      ctx.beginPath(); ctx.arc(0, 0, rr, Math.PI, 0); ctx.fill();
      ctx.fillRect(-rr, -2, rr * 2, 6);
      ctx.restore();
      Draw.text(ctx, hi ? '高·快跳' : '低·慢跳', x, y + 40, 18, 'rgba(255,255,255,0.75)');
    }
    // 企鹅：命中后弧线跳上领奖台
    let px = PLANKX - 60, py = PLANKY - 34, wingUp = false;
    const jn = this.secNotes(game, sec, ['showtime']).find(n => n.hitT && st - n.hitT < 1.2);
    if (jn) {
      const q = Math.min(1, (st - jn.hitT) / 1.2);
      px = PLANKX - 60 + (715 - (PLANKX - 60)) * q;
      py = PLANKY - 34 - Math.sin(q * Math.PI) * 130 - q * 70;
      wingUp = true;
    }
    Animals.penguin(ctx, px, py, 34, {
      mood: this.moodOf(r, st), wingUp,
      squash: jn ? 0 : Math.max(0, Math.sin(beat * Math.PI)) * 0.06
    });
  },

  /* ---------- 老鼠冲刺：兔子 + 起跑线奶酪 ---------- */
  sceneRatrace(ctx, game, sec) {
    const st = Conductor.songTime();
    const beat = Conductor.songBeat();
    const r = game.remix;
    const STARTX = 220, CHEESEX = 760, GY = 420;
    // 跑道
    ctx.fillStyle = '#c98d5e';
    ctx.fillRect(80, GY, 800, 14);
    // 起跑线（黑白格）
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? '#fff' : '#26232e';
      ctx.fillRect(STARTX - 4, GY - 72 + i * 12, 8, 12);
      ctx.fillStyle = i % 2 ? '#26232e' : '#fff';
      ctx.fillRect(STARTX + 4, GY - 72 + i * 12, 8, 12);
    }
    // 奶酪（终点）
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath();
    ctx.moveTo(CHEESEX, GY - 44); ctx.lineTo(CHEESEX + 56, GY); ctx.lineTo(CHEESEX, GY);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e0b93e';
    ctx.beginPath(); ctx.arc(CHEESEX + 18, GY - 14, 6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(CHEESEX + 34, GY - 8, 4, 0, Math.PI * 2); ctx.fill();
    // 兔子：按住=蹲下蓄力，真哨松开=冲刺，早松/晚松=摔倒
    const holding = game.chart.some(n => n.kind === 'ratrace' && n.state === 'holding');
    const ratNotes = this.secNotes(game, sec, ['ratrace']);
    const go = ratNotes.find(n => n.goT && st - n.goT < 0.9);
    const trip = ratNotes.find(n => n.tripT && st - n.tripT < 0.9);
    let x = STARTX - 30, squash = holding ? 0.22 : 0, rotate = 0;
    if (go) {
      const q = (st - go.goT) / 0.9;
      x = STARTX - 30 + q * (CHEESEX - STARTX + 80);
    } else if (trip) {
      rotate = Math.min(1, (st - trip.tripT) / 0.3) * 1.4;
    }
    Animals.bunny(ctx, x, GY - 26, 34, {
      color: '#dfe7ee', mood: this.moodOf(r, st), squash, rotate,
      earFlop: go ? 1 : holding ? 0.5 : 0.1
    });
    if (holding) Draw.text(ctx, '蓄力…听真哨声松开！', 480, 140, 26, '#ffd94d');
  },

  /* ---------- DJ：狗 + 碟机（混曲简化：伴奏不静音） ---------- */
  sceneDJ(ctx, game, sec) {
    const st = Conductor.songTime();
    const beat = Conductor.songBeat();
    const r = game.remix;
    const scratching = game.chart.some(n => n.kind === 'dj' && n.state === 'holding');
    // 灯球 + 光束点
    ctx.fillStyle = '#c9d4e0';
    ctx.beginPath(); ctx.arc(480, 64, 26, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 8; i++) {
      const a = st * 1.5 + i * Math.PI / 4;
      ctx.fillStyle = 'rgba(255,217,77,0.5)';
      ctx.fillRect(480 + Math.cos(a) * 70, 64 + Math.sin(a) * 34, 3, 3);
    }
    // DJ 狗
    Animals.dog(ctx, 480, 300 + Math.sin(beat * Math.PI) * 4, 34, {
      color: '#c98d5e', mood: this.moodOf(r, st), tailWag: 0.5
    });
    // 碟机台 + 两个转盘（搓碟时冻结 + 弧线）
    ctx.fillStyle = '#26232e';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(300, 360, 360, 74, 10);
    else ctx.rect(300, 360, 360, 74);
    ctx.fill();
    const platter = (x) => {
      ctx.fillStyle = '#16161e';
      ctx.beginPath(); ctx.arc(x, 397, 40, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, 397, 28, 0, Math.PI * 2); ctx.stroke();
      const th = (scratching ? r.scratchT : st) * 3;
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(x, 397);
      ctx.lineTo(x + Math.cos(th) * 36, 397 + Math.sin(th) * 36); ctx.stroke();
      ctx.fillStyle = '#ffd94d';
      ctx.beginPath(); ctx.arc(x, 397, 9, 0, Math.PI * 2); ctx.fill();
      if (scratching) {
        ctx.strokeStyle = 'rgba(139,233,253,0.7)';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(x, 397, 48, -0.6, 0.6); ctx.stroke();
        ctx.beginPath(); ctx.arc(x, 397, 48, Math.PI - 0.6, Math.PI + 0.6); ctx.stroke();
      }
    };
    platter(384); platter(576);
    // 「YO!」提示泡（准备松开）
    for (const n of this.secNotes(game, sec, ['dj'])) {
      if (beat >= n.beat + n.dur - 0.5 && beat < n.beat + n.dur + 0.4) {
        Draw.text(ctx, 'YO!', 720, 220, 42, '#ff5da2');
      }
    }
    Draw.text(ctx, '碟位按住搓碟，「YO!」后半拍松开！', 480, 150, 22, 'rgba(255,255,255,0.8)');
  },

  /* ---------- 拳击台：猫拳手 + 沙袋 + 教练指令 ---------- */
  sceneRingside(ctx, game, sec) {
    const st = Conductor.songTime();
    const beat = Conductor.songBeat();
    const r = game.remix;
    // 围绳
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = i === 1 ? '#e85d5d' : '#f5f0e8';
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(60, 240 + i * 34); ctx.lineTo(900, 240 + i * 34); ctx.stroke();
    }
    // 沙袋吊架 + 沙袋（命中摆动）
    ctx.strokeStyle = '#3a3a44';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(770, 420); ctx.lineTo(770, 120); ctx.lineTo(660, 120); ctx.stroke();
    const dt = st - r.punchT;
    const ang = dt < 1.2 ? Math.sin(dt * 10) * 0.3 * (1 - dt / 1.2) : 0;
    ctx.save();
    ctx.translate(660, 120);
    ctx.rotate(ang);
    ctx.strokeStyle = '#8a93a0';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 110); ctx.stroke();
    ctx.fillStyle = '#b8433a';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-26, 110, 52, 104, 22);
    else ctx.rect(-26, 110, 52, 104);
    ctx.fill();
    ctx.fillStyle = '#8f2f28';
    ctx.fillRect(-26, 140, 52, 10);
    ctx.fillRect(-26, 172, 52, 10);
    ctx.restore();
    // 教练狗 + 指令气泡
    Animals.dog(ctx, 120, 412, 28, {
      color: '#8d6e63', mood: st - r.sadT < 0.7 ? 'sad' : 'idle', tailWag: 0.6
    });
    for (const [c, kind] of this._cur.ringCmds) {
      if (beat >= c && beat < c + 2) {
        Draw.text(ctx, kind === 'combo' ? 'pa-pa-pow!' : 'pow!', 290, 180, 32, '#c62828');
        Draw.text(ctx, kind === 'combo' ? '三连击！' : '单击！', 290, 212, 20, 'rgba(255,255,255,0.85)');
      }
    }
    // 猫拳手：出拳时进步前伸
    const pt = st - r.punchT;
    const punching = pt >= 0 && pt < 0.22;
    const k = punching ? Math.sin((pt / 0.22) * Math.PI) : 0;
    const bx = 480 + k * 46;
    Animals.cat(ctx, bx, 400, 40, {
      color: '#f5a35c', mood: this.moodOf(r, st), headband: '#e85d5d',
      armL: 0.5, armR: punching ? -0.1 : 0.5,
      legPhase: Math.floor(beat * 2) % 2 === 0 ? 1 : -1
    });
    // 拳套
    ctx.fillStyle = '#e85d5d';
    ctx.beginPath(); ctx.arc(bx + 34 + k * 36, 388, 15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c62828';
    ctx.beginPath(); ctx.arc(bx + 29 + k * 36, 393, 8, 0, Math.PI * 2); ctx.fill();
    // 命中火星
    if (pt >= 0 && pt < 0.18) {
      const p2 = 1 - pt / 0.18;
      ctx.strokeStyle = 'rgba(255,217,77,' + (0.9 * p2).toFixed(3) + ')';
      ctx.lineWidth = 4;
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3 + 0.3;
        ctx.beginPath();
        ctx.moveTo(660 + Math.cos(a) * 22, 320 + Math.sin(a) * 22);
        ctx.lineTo(660 + Math.cos(a) * (34 + (1 - p2) * 26), 320 + Math.sin(a) * (34 + (1 - p2) * 26));
        ctx.stroke();
      }
    }
  }
};

/* ---------- 注册第六批关卡 ---------- */
Levels.push(LevelRingside, LevelRemix);

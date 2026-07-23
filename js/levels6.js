/* levels6.js — 第六批关卡：教练指令 & 大团圆混曲
 *   第 19 关 · 拳击台（Ringside）：听教练喊拳路照打 —— 三连击 / 单击 / 按住重拳
 *   第 21 关 · 大团圆 Remix：8 段玩法串烧
 *     （空手道 / 蓝鸟 / 齐步走正拍 / 乒乓 / 灌油 / 和尚 / 齐步走反拍 / 终章空手道）
 * 关卡接口与 levels.js 相同；长按音符额外实现 onPress / onRelease。
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
 * 混曲串烧（每段 8 拍，段首标题卡 1.5 拍）。easy 8 段：
 *   ① 4  空手道：陶罐提前 2 拍从右飞来，到圈时击破
 *   ② 12 蓝鸟：「突突突」三连啄 /「昂——」按住昂首
 *   ③ 20 齐步走·正拍：每拍一步
 *   ④ 28 乒乓：球到右侧回击
 *   ⑤ 36 灌油：按住灌油，灯满松开
 *   ⑥ 44 和尚：唱数「一！二！三！」后 1 拍吃包子
 *   ⑦ 52 齐步走·反拍：踩后半拍
 *   ⑧ 60 终章·空手道：密集收官
 * 三模式：easy=原谱 8 段；normal=10 段（插入拍手三人组 / 宇宙射击），bpm×1.1；
 * hard=10 段、除首尾空手道外中间段落顺序种子随机（段首标题卡同步），bpm 120。
 * 各段内容由 genStructure 按段起始拍生成，scheduleStep / draw 统一读 this._cur。
 * ============================================================== */
const LevelRemix = {
  id: 'remix',
  name: '第 21 关 · 大团圆 Remix',
  desc: '全部玩法的混曲串烧！跟紧每一段别掉链子！',
  hint: '空格=全部操作 · 长按段按住 · Esc = 退出',
  bpm: 112,
  totalBeats: 70,

  // easy：原谱 8 段
  sections: [
    { start: 4,  name: '空手道！',      kind: 'karate' },
    { start: 12, name: '蓝鸟！',        kind: 'birds' },
    { start: 20, name: '齐步走！',      kind: 'marchOn' },
    { start: 28, name: '乒乓！',        kind: 'pong' },
    { start: 36, name: '灌油！',        kind: 'fill' },
    { start: 44, name: '吃包子！',      kind: 'monk' },
    { start: 52, name: '反拍齐步走！',  kind: 'marchOff' },
    { start: 60, name: '终章·空手道！', kind: 'finale' }
  ],

  // normal：10 段（插入拍手三人组 / 宇宙射击，各 8 拍，totalBeats 86）
  sectionsNormal: [
    { start: 4,  name: '空手道！',      kind: 'karate' },
    { start: 12, name: '蓝鸟！',        kind: 'birds' },
    { start: 20, name: '拍手三人组！',  kind: 'clap' },
    { start: 28, name: '齐步走！',      kind: 'marchOn' },
    { start: 36, name: '乒乓！',        kind: 'pong' },
    { start: 44, name: '灌油！',        kind: 'fill' },
    { start: 52, name: '吃包子！',      kind: 'monk' },
    { start: 60, name: '宇宙射击！',    kind: 'shoot' },
    { start: 68, name: '反拍齐步走！',  kind: 'marchOff' },
    { start: 76, name: '终章·空手道！', kind: 'finale' }
  ],

  setup(mode) {
    if (mode === 'normal') return { bpm: this.bpm * 1.1, totalBeats: 86 };
    if (mode === 'hard') return { bpm: 120, totalBeats: 86 };
    return null; // easy：用静态 bpm / totalBeats
  },

  // hard：除首尾空手道外，中间 8 段顺序种子随机（每段 8 拍，重新编号 start）
  shuffledSections() {
    const rnd = mulberry32(Date.now() % 100000);
    const src = this.sectionsNormal;
    const mid = src.slice(1, -1).map(s => ({ name: s.name, kind: s.kind }));
    for (let i = mid.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const tmp = mid[i]; mid[i] = mid[j]; mid[j] = tmp;
    }
    const sections = [{ name: src[0].name, kind: src[0].kind }, ...mid, { name: src[src.length - 1].name, kind: src[src.length - 1].kind }];
    sections.forEach((s, i) => { s.start = 4 + i * 8; });
    return sections;
  },

  // 按段落表生成全部结构数据（音符 + 各玩法指令表），内容只依赖段起始拍
  genStructure(sections) {
    const notes = [];
    const push = (beat, kind, extra) => notes.push(Object.assign({ beat, kind }, extra));
    const birdCmds = [], pongBeats = [], fillSpecs = [], monkCmds = [], clapGroups = [];
    for (const s of sections) {
      const b0 = s.start;
      switch (s.kind) {
        case 'karate':
          for (const off of [0, 1, 2, 3, 4, 4.5, 5, 6]) push(b0 + off, 'karate');
          break;
        case 'finale':
          for (const off of [0, 1, 2, 2.5, 3, 4, 5, 5.5, 6, 6.5, 7]) push(b0 + off, 'finale');
          break;
        case 'birds':
          birdCmds.push([b0, 'peck'], [b0 + 4, 'stretch']);
          push(b0 + 2, 'peck');
          push(b0 + 2.5, 'peck');
          push(b0 + 3, 'peck');
          push(b0 + 6, 'stretch', { dur: 1 });
          break;
        case 'marchOn':
          for (let b = 0; b < 8; b++) push(b0 + b, 'marchOn');
          break;
        case 'marchOff':
          for (let b = 0; b < 8; b++) push(b0 + b + 0.5, 'marchOff');
          break;
        case 'pong':
          for (const off of [0, 2, 4, 5, 6, 7]) { pongBeats.push(b0 + off); push(b0 + off, 'pong'); }
          break;
        case 'fill':
          fillSpecs.push([b0 + 2, 1], [b0 + 5, 2]);
          push(b0 + 2, 'fill', { dur: 1 });
          push(b0 + 5, 'fill', { dur: 2 });
          break;
        case 'monk':
          monkCmds.push([b0, 1], [b0 + 3, 2], [b0 + 6, 3]);
          push(b0 + 1, 'monk', { num: 1, cueBeat: b0 });
          push(b0 + 4, 'monk', { num: 2, cueBeat: b0 + 3 });
          push(b0 + 7, 'monk', { num: 3, cueBeat: b0 + 6 });
          break;
        case 'clap':
          // 同伴示范两声（间隔 gap），玩家隔同样时间补第三声
          for (const [c, gap] of [[b0, 1], [b0 + 3, 1], [b0 + 6, 0.5]]) {
            clapGroups.push([c, gap]);
            push(c + 2 * gap, 'clap', { head: c, gap });
          }
          break;
        case 'shoot':
          // 警报提前 2 拍，敌人到准星瞬间射击（含一组双连）
          for (const off of [1, 3, 5, 5.5, 7]) push(b0 + off, 'shoot');
          break;
      }
    }
    return { sections, notes, birdCmds, pongBeats, fillSpecs, monkCmds, clapGroups };
  },

  buildChart(mode) {
    mode = mode || 'easy';
    const sections = mode === 'hard' ? this.shuffledSections()
      : mode === 'normal' ? this.sectionsNormal
      : this.sections;
    // 结构化解算：scheduleStep / draw 统一读 this._cur（easy 也走这里）
    this._cur = this.genStructure(sections);
    return this._cur.notes;
  },

  // 当前拍所在的段（窗口为 [start, 下一段 start)，结尾归入终章）
  sectionAt(beat) {
    let cur = null;
    for (const s of this._cur.sections) {
      if (beat >= s.start) cur = s;
    }
    return cur;
  },

  // 乒乓球路：电脑提前 1 拍发球 → 玩家/电脑交替
  buildPongEvents() {
    const sec = this._cur.sections.find(s => s.kind === 'pong');
    const ev = [{ beat: sec.start - 1, side: 'cpu' }];
    const pb = this._cur.pongBeats;
    for (let i = 0; i < pb.length; i++) {
      ev.push({ beat: pb[i], side: 'player' });
      if (i + 1 < pb.length) ev.push({ beat: (pb[i] + pb[i + 1]) / 2, side: 'cpu' });
    }
    return ev;
  },

  init(game) {
    game.remix = {
      happyT: -9, sadT: -9, hitT: -9, stepT: -9,
      holdT: -9, stretchT: -9, swingT: -9,
      clapT: -9, laserT: -9, laserX: 0,
      events: this.buildPongEvents()
    };
  },

  scheduleStep(step, t, game) {
    const beat = step / 2;
    const spb = Conductor.secPerBeat();
    const sec = this.sectionAt(beat);
    // —— 统一伴奏：动次打次 + 贝斯 + 半拍踩镲 ——
    if (step % 2 === 0) {
      const b = ((beat % 4) + 4) % 4;
      if (b === 0 || b === 2) AudioEngine.kick(t);
      if (b === 1 || b === 3) AudioEngine.snare(t);
      AudioEngine.tone(t, [110, 98, 130.81, 98][b], spb * 0.4, 'triangle', 0.14);
      if (beat < 4) AudioEngine.blok(t, beat === 3 ? 1320 : 880);
    }
    AudioEngine.hihat(t, false);
    // 段首重音 + 闪亮登场
    if (sec && beat === sec.start) {
      AudioEngine.kick(t);
      AudioEngine.snare(t);
      AudioEngine.hihat(t, true);
      AudioEngine.sparkle(t);
    }
    // —— 各玩法提示音（按拍精确匹配，跨段也不漏） ——
    for (const n of game.chart) {
      // 空手道：陶罐提前 2 拍抛出 "fwip"
      if ((n.kind === 'karate' || n.kind === 'finale') && (n.beat - 2) * 2 === step) {
        AudioEngine.sfxCue(t);
      }
      // 齐步走：全队脚步声（正拍低沉 / 反拍高亮）
      if (n.beat === beat && n.kind === 'marchOn') AudioEngine.blok(t, 587);
      if (n.beat === beat && n.kind === 'marchOff') AudioEngine.blok(t, 880);
      // 灌油：到位"叮" / 灌满提示音
      if (n.kind === 'fill') {
        if (n.beat === beat) AudioEngine.blok(t, 1568);
        if (n.beat + n.dur === beat) AudioEngine.blok(t, 2093);
      }
      // 宇宙射击：敌人到准星前 2 拍警报
      if (n.kind === 'shoot' && (n.beat - 2) * 2 === step) AudioEngine.blok(t, 1175);
    }
    // 蓝鸟：队长唱指令 + 同伴示范（简化自第 6 关）
    for (const [c, kind] of this._cur.birdCmds) {
      if (kind === 'peck') {
        if (beat === c) { AudioEngine.blok(t, 587); AudioEngine.blok(t + spb * 0.5, 587); }
        if (beat === c + 1) AudioEngine.blok(t, 784);
        for (const off of [2, 2.5, 3]) {
          if (beat === c + off) AudioEngine.tone(t, 240, 0.08, 'sine', 0.11);
        }
      } else {
        if (beat === c) AudioEngine.tone(t, 392, spb * 0.55, 'square', 0.2);
        if (beat === c + 1) AudioEngine.tone(t, 440, spb * 0.6, 'square', 0.2);
        if (beat === c + 3) AudioEngine.sfxCue(t);
      }
    }
    // 乒乓：电脑回球声
    for (const ev of game.remix.events) {
      if (ev.side === 'cpu' && ev.beat === beat) AudioEngine.pon(t, 880);
    }
    // 和尚：唱数「一！二！三！」（音高递增）
    for (const [c, num] of this._cur.monkCmds) {
      if (beat === c) AudioEngine.blok(t, [523.25, 587.33, 659.25][num - 1]);
    }
    // 拍手三人组：同伴示范两声（玩家的第三声不预排，由玩家自己拍）
    for (const [c, gap] of this._cur.clapGroups) {
      if (beat === c || beat === c + gap) AudioEngine.clap(t);
    }
  },

  onJudge(game, note, res) {
    const st = Conductor.songTime();
    const r = game.remix;
    if (res === 'miss') {
      r.sadT = st;
      if (note.kind === 'karate' || note.kind === 'finale' || note.kind === 'monk') note.fallT = st;
      if (note.kind === 'fill') { note.doneT = st; note.fillShown = 0; note.outcome = 'empty'; }
      AudioEngine.tone(AudioEngine.now(), 150, 0.22, 'sawtooth', 0.15);
      return;
    }
    r.happyT = st;
    r.hitT = st;
    const now = AudioEngine.now();
    switch (note.kind) {
      case 'karate':
      case 'finale':
        AudioEngine.sfxSmash();
        game.burst(260, 310, '#c98d5e', 14);
        break;
      case 'peck':
        AudioEngine.tone(now, 240, 0.08, 'sine', 0.3);  // 啄！
        AudioEngine.tone(now, 1760, 0.09, 'sine', 0.1); // 星星
        game.burst(720, 380, '#fff', 5);
        break;
      case 'marchOn':
      case 'marchOff':
        r.stepT = st;
        AudioEngine.blok(now, note.kind === 'marchOff' ? 988 : 660);
        game.burst(450, 400, '#cbb26a', 5);
        break;
      case 'pong': {
        r.swingT = st;
        const i = this._cur.pongBeats.indexOf(note.beat);
        const gap = i + 1 < this._cur.pongBeats.length ? this._cur.pongBeats[i + 1] - note.beat : 2;
        AudioEngine.pon(now, gap <= 1 ? 1400 : 1150);
        game.burst(748, 330, '#c4f56b', 10);
        break;
      }
      case 'monk':
        note.eatenT = st;
        AudioEngine.chomp(now);
        game.burst(352, 336, '#ffd9a0', 8);
        break;
      case 'clap':
        r.clapT = st;
        AudioEngine.clap(now); // 拍中了：第三声融入节奏
        game.burst(680, 372, '#ffffff', 8);
        break;
      case 'shoot':
        r.laserT = st;
        r.laserX = 260; // 准星 x（与 sceneShoot 的 AIMX 一致）
        AudioEngine.zap(now);
        AudioEngine.boom(now);
        game.burst(260, 300, '#ff9a3d', 16);
        game.burst(260, 300, '#8be04e', 8);
        break;
      // fill / stretch 的命中反馈在 onRelease
    }
  },

  // 长按（蓝鸟昂首 / 灌油）：按下蓄力
  onPress(game, note, res) {
    const st = Conductor.songTime();
    note.pressT = st;
    game.remix.holdT = st;
    if (note.kind === 'fill') AudioEngine.fillStart();
  },

  onRelease(game, note, res) {
    const st = Conductor.songTime();
    const r = game.remix;
    if (note.kind === 'fill') {
      note.doneT = st;
      note.fillShown = note.pressT != null
        ? Math.min(1.2, (st - note.pressT) / (note.dur * Conductor.secPerBeat()))
        : 0;
      AudioEngine.fillStop();
      if (res === 'miss' || res === 'over') {
        note.outcome = 'spill';
        r.sadT = st;
        game.burst(480, 320, '#3a3a44', 14);
      } else {
        note.outcome = 'ok';
        r.happyT = st;
        r.hitT = st;
        game.burst(480, 320, '#7de38b', 12);
      }
      return;
    }
    // 蓝鸟昂首：松开伸展
    if (res === 'miss' || res === 'over') {
      r.sadT = st;
      AudioEngine.tone(AudioEngine.now(), 150, 0.22, 'sawtooth', 0.18);
    } else {
      r.stretchT = st;
      r.happyT = st;
      r.hitT = st;
      AudioEngine.sfxCue(AudioEngine.now());
    }
  },

  onWhiff(game) {
    const st = Conductor.songTime();
    const r = game.remix;
    r.hitT = st;   // 空手道/蓝鸟的空气动作
    r.swingT = st; // 乒乓挥空拍
    r.sadT = st;
    r.clapT = st;  // 拍手：照样抬手（动作反馈）
    r.laserT = st; // 射击：激光射向深空
    r.laserX = 1000;
  },

  draw(game, ctx) {
    const beat = Conductor.songBeat();
    const sec = this.sectionAt(beat);
    if (!sec) this.sceneReady(ctx, game);
    else {
      switch (sec.kind) {
        case 'karate': this.sceneKarate(ctx, game, false); break;
        case 'finale': this.sceneKarate(ctx, game, true); break;
        case 'birds': this.sceneBirds(ctx, game); break;
        case 'marchOn': this.sceneMarch(ctx, game, false); break;
        case 'marchOff': this.sceneMarch(ctx, game, true); break;
        case 'pong': this.scenePong(ctx, game); break;
        case 'fill': this.sceneFill(ctx, game); break;
        case 'monk': this.sceneMonk(ctx, game); break;
        case 'clap': this.sceneClap(ctx, game); break;
        case 'shoot': this.sceneShoot(ctx, game); break;
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

  /* ---------- ①⑧ 空手道（finale=终章夜空版） ---------- */
  sceneKarate(ctx, game, finale) {
    const st = Conductor.songTime();
    const beat = Conductor.songBeat();
    const r = game.remix;
    const TX = 260, TY = 310;
    // 背景：夕阳道场 / 终章星夜
    const sky = ctx.createLinearGradient(0, 0, 0, 400);
    if (finale) {
      sky.addColorStop(0, '#2d2350');
      sky.addColorStop(1, '#7a3d6e');
    } else {
      sky.addColorStop(0, '#ff9a56');
      sky.addColorStop(1, '#ffd93b');
    }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 960, 400);
    if (finale) {
      // 闪烁星星 + 月亮
      for (let i = 0; i < 24; i++) {
        const sx = (i * 173) % 960, sy = (i * 97) % 220;
        ctx.globalAlpha = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(st * 3 + i));
        ctx.fillStyle = '#fff';
        ctx.fillRect(sx, sy, 3, 3);
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff3c4';
      ctx.beginPath(); ctx.arc(800, 80, 36, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = '#fff3c4';
      ctx.beginPath(); ctx.arc(760, 90, 46, 0, Math.PI * 2); ctx.fill();
    }
    const drift = (st * 14) % 1200;
    Draw.cloud(ctx, 1050 - drift, 60, 1, finale ? 'rgba(200,180,230,0.5)' : 'rgba(255,240,200,0.75)');
    Draw.cloud(ctx, 760 - drift, 125, 0.65, finale ? 'rgba(200,180,230,0.35)' : 'rgba(255,240,200,0.55)');
    ctx.fillStyle = finale ? '#4a2d55' : '#d97b3f';
    ctx.beginPath(); ctx.moveTo(0, 400); ctx.lineTo(200, 240); ctx.lineTo(420, 400); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(560, 400); ctx.lineTo(760, 260); ctx.lineTo(960, 400); ctx.closePath(); ctx.fill();
    Draw.ground(ctx, 400, finale ? '#5a3a4a' : '#8a5a3b');

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
    let mood = 'idle';
    if (st - r.sadT < 0.7) mood = 'sad';
    else if (st - r.happyT < 0.3) mood = 'happy';
    const punching = st - r.hitT < 0.22;
    Animals.cat(ctx, 155, 345 + bob, 44, {
      color: '#f5a35c',
      mood,
      headband: '#fff',
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
    for (const n of game.chart) {
      if (n.kind !== 'karate' && n.kind !== 'finale') continue;
      const launch = n.beat - 2;
      if (beat < launch) continue;
      if (n.state === 'hit') continue;
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

  /* ---------- ② 蓝鸟合唱团 ---------- */
  sceneBirds(ctx, game) {
    const st = Conductor.songTime();
    const beat = Conductor.songBeat();
    const r = game.remix;
    // 背景：晴空枝头
    const sky = ctx.createLinearGradient(0, 0, 0, 420);
    sky.addColorStop(0, '#4aa3e8');
    sky.addColorStop(1, '#a8ddff');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 960, 420);
    ctx.fillStyle = '#fff8d0';
    ctx.beginPath(); ctx.arc(120, 80, 40, 0, Math.PI * 2); ctx.fill();
    const drift = (st * 8) % 1200;
    Draw.cloud(ctx, 980 - drift, 90, 0.9);
    Draw.cloud(ctx, 560 - drift, 150, 0.6);
    Draw.hill(ctx, 140, 420, 280, 80, '#7ec850');
    Draw.hill(ctx, 820, 420, 300, 100, '#6fbf45');
    Draw.ground(ctx, 420, '#8fd45e');
    // 树枝
    ctx.strokeStyle = '#7a4a21';
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(280, 462); ctx.lineTo(900, 452); ctx.stroke();
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(620, 458); ctx.lineTo(660, 420); ctx.stroke();
    ctx.fillStyle = '#5aa33e';
    ctx.beginPath(); ctx.ellipse(664, 414, 18, 9, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(300, 448, 20, 10, 0.3, 0, Math.PI * 2); ctx.fill();

    // 队长（左边高台 + 礼帽）
    let singing = false;
    for (const [c] of this._cur.birdCmds) {
      if (beat >= c && beat < c + 1.05) singing = true;
    }
    ctx.fillStyle = '#8d6e63';
    ctx.fillRect(108, 380, 64, 70);
    ctx.fillStyle = '#6d4c3d';
    ctx.fillRect(96, 370, 88, 14);
    const cbob = Math.sin(beat * Math.PI) * 4;
    Animals.bird(ctx, 140, 330 + cbob, 42, { color: '#3d6b9e', pose: 'idle', beakOpen: singing ? 1 : 0 });
    ctx.fillStyle = '#26232e';
    ctx.fillRect(118, 268 + cbob, 44, 10);
    ctx.fillRect(128, 244 + cbob, 24, 26);
    // 指令气泡
    let cue = null;
    for (const [c, kind] of this._cur.birdCmds) {
      if (beat >= c && beat < c + 2) { cue = { kind }; break; }
    }
    if (cue) {
      const peck = cue.kind === 'peck';
      const bx = 300, by = 190;
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#26232e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bx - 90, by - 42, 180, 72, 14);
      else ctx.rect(bx - 90, by - 42, 180, 72, 14);
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(bx - 66, by + 26);
      ctx.lineTo(bx - 86, by + 52);
      ctx.lineTo(bx - 44, by + 28);
      ctx.closePath(); ctx.fill();
      Draw.text(ctx, peck ? '突！突！突！' : '昂——！', bx, by - 14, 28, peck ? '#c62828' : '#1565c0');
      Draw.text(ctx, peck ? '点按空格 ×3' : '按住再松开', bx, by + 14, 18, '#555');
    }
    // 两只同伴（在回应窗口示范）
    for (let i = 0; i < 2; i++) {
      const x = 400 + i * 150;
      let pose = 'idle';
      for (const [c, kind] of this._cur.birdCmds) {
        if (kind === 'peck' && beat >= c + 2 && beat < c + 3.3) pose = 'peck';
        if (kind === 'stretch' && beat >= c + 2 && beat < c + 3.2) pose = 'stretch';
      }
      Animals.bird(ctx, x, 408, 32, { color: '#4a90d9', pose, beakOpen: pose === 'idle' ? 0 : 0.8 });
    }
    // 玩家（橙色）：蓄力低头 → 松开昂首
    let pose = 'idle';
    if (st - r.stretchT < 0.45) pose = 'stretch';
    else if (r.holdT > r.stretchT && st - r.holdT < 0.9) pose = 'peck';
    else if (st - r.hitT < 0.26) pose = 'peck';
    const sad = st - r.sadT < 0.7;
    Animals.bird(ctx, 720, 406, 36, {
      color: '#ff9a3d',
      pose,
      beakOpen: pose === 'idle' ? 0 : 0.8,
      mood: sad ? 'sad' : 'idle'
    });
    if (sad) Draw.text(ctx, '?', 720, 330, 32, '#fff');
  },

  /* ---------- ③⑦ 齐步走（off=反拍） ---------- */
  sceneMarch(ctx, game, off) {
    const st = Conductor.songTime();
    const beat = Conductor.songBeat();
    const r = game.remix;
    // 背景：操场
    const sky = ctx.createLinearGradient(0, 0, 0, 360);
    sky.addColorStop(0, '#5db9ff');
    sky.addColorStop(1, '#bfe8ff');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 960, 360);
    ctx.fillStyle = '#fff8d0';
    ctx.beginPath(); ctx.arc(830, 70, 38, 0, Math.PI * 2); ctx.fill();
    const drift = (st * 10) % 1200;
    Draw.cloud(ctx, 1000 - drift, 80, 0.9);
    Draw.cloud(ctx, 640 - drift, 140, 0.6);
    Draw.hill(ctx, 180, 360, 260, 90, '#7ec850');
    Draw.hill(ctx, 760, 360, 320, 110, '#6fbf45');
    Draw.ground(ctx, 360, '#8fd45e');
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, 430); ctx.lineTo(960, 430); ctx.stroke();
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
    const squadSteps = [];
    for (const n of game.chart) {
      if (n.kind === kind) squadSteps.push(n.beat);
    }
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
      Animals.bunny(ctx, x, 350 + yOff, 34, {
        color: isPlayer ? '#ff9a3d' : '#dfe7ee',
        mood,
        rotate,
        squash,
        earFlop: flop,
        headband: isPlayer ? '#e85d5d' : null,
        armL: 0.5 + flop * 0.4,
        armR: 0.5 - flop * 0.4
      });
    }
    Draw.text(ctx, '▼ 你', 450, 278, 22, '#c62828');
  },

  /* ---------- ④ 节奏乒乓 ---------- */
  scenePong(ctx, game) {
    const st = Conductor.songTime();
    const beat = Conductor.songBeat();
    const r = game.remix;
    const PX = 800, CX = 160, BY = 330;
    // 背景：球馆
    const bg = ctx.createLinearGradient(0, 0, 0, 540);
    bg.addColorStop(0, '#1f6f6b');
    bg.addColorStop(1, '#134542');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 960, 540);
    Draw.ground(ctx, 420, '#0f3735');
    for (let i = 0; i < 9; i++) {
      const ab = Math.sin(beat * Math.PI + i * 1.7) * 3;
      ctx.fillStyle = '#0a2926';
      ctx.beginPath(); ctx.arc(i * 116 + 40, 60 + ab, 24, 0, Math.PI * 2); ctx.fill();
    }
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
    for (const ev of r.events) {
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
        color,
        mood,
        squash: swing ? 0.12 : 0,
        tailWag: Math.sin(st * 6) * 0.5 + 0.5
      });
      ctx.restore();
    };
    drawPlayer(CX, cpuSwing, '#c98d5e', 'idle');
    drawPlayer(PX, st - r.swingT < 0.18, '#f5a35c', st - r.sadT < 0.7 ? 'sad' : 'idle');

    // 球：找到当前所处的球路段
    const evs = r.events;
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

  /* ---------- ⑤ 灌油机器人 ---------- */
  sceneFill(ctx, game) {
    const st = Conductor.songTime();
    const beat = Conductor.songBeat();
    const spb = Conductor.secPerBeat();
    const SX = 480;
    // 背景：工厂
    const bg = ctx.createLinearGradient(0, 0, 0, 540);
    bg.addColorStop(0, '#34343f');
    bg.addColorStop(1, '#23232c');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 960, 540);
    // 管道
    ctx.fillStyle = '#454552';
    ctx.fillRect(0, 60, 960, 18);
    ctx.fillRect(120, 60, 18, 160);
    ctx.fillRect(700, 60, 18, 110);
    ctx.fillStyle = '#3a3a46';
    ctx.fillRect(0, 150, 700, 12);
    Draw.ground(ctx, 470, '#1a1a22');
    // 警示条纹
    for (let i = 0; i < 24; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#d8b62e' : '#26262e';
      ctx.beginPath();
      ctx.moveTo(i * 40, 470);
      ctx.lineTo(i * 40 + 20, 470);
      ctx.lineTo(i * 40 + 10, 490);
      ctx.lineTo(i * 40 - 10, 490);
      ctx.closePath(); ctx.fill();
    }
    // 传送带（滚动条纹）
    ctx.fillStyle = '#2b2b33';
    ctx.fillRect(0, 400, 960, 40);
    ctx.fillStyle = '#3d3d49';
    const off = (st * 140) % 60;
    for (let x = -60; x < 1000; x += 60) {
      ctx.fillRect(x + off, 400, 26, 40);
    }
    ctx.fillStyle = '#1f1f26';
    ctx.fillRect(0, 436, 960, 6);
    // 加油枪
    ctx.fillStyle = '#5a6b80';
    ctx.fillRect(SX - 12, 0, 24, 210);
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
      const oy = 248 + ((st * 300) % 12);
      ctx.fillRect(SX - 5, 248, 10, 120 - (oy - 248));
      ctx.fillStyle = 'rgba(255,217,77,0.5)';
      ctx.fillRect(SX - 9, 250, 18, 116);
    }
    // 机器人队列
    for (const n of game.chart) {
      if (n.kind !== 'fill') continue;
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

  /* ---------- ⑥ 和尚吃包子 ---------- */
  sceneMonk(ctx, game) {
    const st = Conductor.songTime();
    const beat = Conductor.songBeat();
    const r = game.remix;
    // 背景：山寺清晨
    const sky = ctx.createLinearGradient(0, 0, 0, 420);
    sky.addColorStop(0, '#ffd9a0');
    sky.addColorStop(1, '#ffefc4');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 960, 420);
    ctx.fillStyle = '#fff8d0';
    ctx.beginPath(); ctx.arc(830, 80, 40, 0, Math.PI * 2); ctx.fill();
    const drift = (st * 8) % 1200;
    Draw.cloud(ctx, 980 - drift, 100, 0.8);
    Draw.hill(ctx, 140, 420, 300, 90, '#d9a05e');
    Draw.hill(ctx, 820, 420, 320, 110, '#c98d5e');
    // 小宝塔剪影
    ctx.fillStyle = '#9a5a33';
    for (let i = 0; i < 3; i++) {
      const w = 96 - i * 24, ty = 380 - i * 44;
      ctx.fillRect(120 - w * 0.28, ty, w * 0.56, 44);
      ctx.beginPath();
      ctx.moveTo(120 - w / 2, ty);
      ctx.lineTo(120 + w / 2, ty);
      ctx.lineTo(120, ty - 26);
      ctx.closePath(); ctx.fill();
    }
    Draw.ground(ctx, 420, '#8fd45e');
    // 桌子
    ctx.fillStyle = '#8d6e63';
    ctx.fillRect(360, 380, 220, 14);
    ctx.fillRect(380, 394, 16, 60);
    ctx.fillRect(544, 394, 16, 60);

    const monkNotes = game.chart.filter(n => n.kind === 'monk');
    // 和尚羊驼（咀嚼时脖子一耸一耸）
    let chew = 0;
    for (const n of monkNotes) {
      if (n.eatenT && st - n.eatenT < 0.4) chew = Math.sin((st - n.eatenT) / 0.4 * Math.PI);
    }
    let mood = 'idle';
    if (st - r.sadT < 0.7) mood = 'sad';
    else if (st - r.happyT < 0.4) mood = 'happy';
    Animals.alpaca(ctx, 340, 395, 44, {
      color: '#f0e6d2',
      mood,
      stretch: chew * 0.15
    });
    // 僧帽
    ctx.fillStyle = '#e8a33d';
    ctx.beginPath(); ctx.ellipse(340, 330, 16, 7, 0, Math.PI, 0); ctx.fill();
    ctx.fillRect(324, 328, 32, 5);
    // 唱数气泡
    const nums = ['一', '二', '三'];
    for (const [c, num] of this._cur.monkCmds) {
      if (beat >= c && beat < c + 1) {
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#26232e';
        ctx.lineWidth = 3;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(480, 190, 110, 64, 14);
        else ctx.rect(480, 190, 110, 64, 14);
        ctx.fill(); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(500, 252); ctx.lineTo(478, 280); ctx.lineTo(528, 254);
        ctx.closePath(); ctx.fill();
        Draw.text(ctx, nums[num - 1] + '！', 535, 224, 34, '#c62828');
      }
    }
    // 飞来的包子（唱数时起飞，1 拍后入口；错过则掉落）
    for (const n of monkNotes) {
      if (beat < n.cueBeat) continue;
      if (n.state === 'hit') continue; // 已吃掉
      ctx.save();
      if (n.state === 'miss') {
        const ft = st - (n.fallT || st);
        if (ft > 0.8) { ctx.restore(); continue; }
        ctx.globalAlpha = 1 - ft / 0.8;
        ctx.translate(352, 336 + ft * ft * 600);
        ctx.rotate(ft * 5);
      } else {
        const p = Math.min(1.3, (beat - n.cueBeat) / (n.beat - n.cueBeat));
        const x = 760 - (760 - 352) * p;
        const y = 336 - Math.sin(Math.min(p, 1) * Math.PI) * 60;
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

  /* ---------- 拍手三人组（normal 起加入，简化自第 7 关） ---------- */
  sceneClap(ctx, game) {
    const st = Conductor.songTime();
    const beat = Conductor.songBeat();
    const r = game.remix;
    const CATX = [280, 480, 680], CATY = 392;
    // 背景：深蓝剧场 + 幕布
    const bg = ctx.createLinearGradient(0, 0, 0, 540);
    bg.addColorStop(0, '#2c2350');
    bg.addColorStop(1, '#191430');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 960, 540);
    Draw.ground(ctx, 430, '#8a5a3b');
    ctx.fillStyle = '#8e2434';
    ctx.fillRect(0, 0, 960, 26);
    for (let i = 0; i < 12; i++) {
      ctx.beginPath(); ctx.arc(i * 87 + 24, 26, 26, 0, Math.PI); ctx.fill();
    }
    // 观众剪影（随节拍摇晃）
    for (let i = 0; i < 9; i++) {
      const ab = Math.sin(beat * Math.PI + i * 1.3) * 3;
      ctx.fillStyle = '#0f0c1c';
      ctx.beginPath(); ctx.arc(i * 116 + 40, 528 + ab, 24, 0, Math.PI * 2); ctx.fill();
    }
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
    Draw.text(ctx, '听两声拍手，隔同样时间补第三声！', 480, 120, 26, 'rgba(255,255,255,0.9)');
  },

  /* ---------- 宇宙射击（normal 起加入，简化自第 10 关） ---------- */
  sceneShoot(ctx, game) {
    const st = Conductor.songTime();
    const beat = Conductor.songBeat();
    const r = game.remix;
    const SHIPX = 140, SHIPY = 300, AIMX = 260;
    // 背景：深空 + 向后流动的星野
    const bg = ctx.createLinearGradient(0, 0, 0, 540);
    bg.addColorStop(0, '#0a0d28');
    bg.addColorStop(1, '#1c1440');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 960, 540);
    for (let i = 0; i < 80; i++) {
      const sx = 960 - ((i * 173 + st * 60) % 1000);
      const sy = (i * 97 + 29) % 540;
      const tw = 0.3 + 0.7 * Math.abs(Math.sin(st * 2 + i * 0.7));
      ctx.fillStyle = 'rgba(255,255,255,' + (tw * 0.8).toFixed(3) + ')';
      ctx.fillRect(sx, sy, 2, 2);
    }
    ctx.fillStyle = '#3d5a9e';
    ctx.beginPath(); ctx.arc(790, 110, 34, 0, Math.PI * 2); ctx.fill();
    // 警报视觉（听觉为主，画面仅确认）：右缘红「!」闪烁
    for (const n of game.chart) {
      if (n.kind === 'shoot' && beat >= n.beat - 2 && beat < n.beat - 1.7 && Math.floor(st * 8) % 2 === 0) {
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
    for (const n of game.chart) {
      if (n.kind !== 'shoot' || n.state === 'hit') continue;
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
    Draw.text(ctx, '警报响后 2 拍，敌人到准星——射击！', 480, 56, 24, 'rgba(255,255,255,0.9)');
  }
};

/* ---------- 注册第六批关卡 ---------- */
Levels.push(LevelRingside, LevelRemix);

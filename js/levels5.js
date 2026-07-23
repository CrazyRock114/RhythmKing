/* levels5.js — 第五批关卡：音频先行的高级玩法
 *   第 15 关 · 魔法使（Mahou Tsukai）：听咒语 pi-ko-pon，咒停瞬间开花
 *   第 16 关 · 企鹅跳台（Showtime）：听铃声高低，数 1/2 拍后起跳
 *   第 17 关 · 老鼠冲刺（Rat Race）：「预备」按住蓄力，哨声松开冲刺（长按）
 *   第 18 关 · DJ 学校（DJ School）：按住搓碟停音乐，「YO!」松开放回（长按）
 * 关卡接口与 levels.js 相同；长按音符额外实现 onPress / onRelease。
 */
'use strict';

/* ================================================================
 * 第 15 关 · 魔法使
 * 咒语 3 个音节 pi-ko-pon，咒停瞬间花开——按键！
 * 慢咒：音节间隔 1 拍（花在 c+3）；快咒：间隔半拍（花在 c+1.5）。
 * 间隔本身即预告：保持音节的速度「脑内续一拍」就是开花时机。
 * ============================================================== */
const LevelMahou = {
  id: 'mahou',
  name: '第 15 关 · 魔法使',
  desc: '听咒语「pi-ko-pon!」，咒停瞬间花开——按！慢咒 3 拍，快咒 1.5 拍。',
  hint: '空格 / 点击 = 开花 · Esc = 退出',
  bpm: 100,
  totalBeats: 46,

  // [咒语起始拍, 类型]
  commands: [
    [4, 'slow'], [8, 'slow'], [12, 'fast'], [15, 'slow'], [18, 'fast'], [21, 'fast'],
    [24, 'slow'], [28, 'fast'], [31, 'slow'], [34, 'fast'], [37, 'fast'], [40, 'fast']
  ],
  SYL: ['pi', 'ko', 'pon'],
  SYL_FREQ: [659, 740, 831],
  FLOWER_COLORS: ['#ff8fb3', '#ffd94d', '#b39dff', '#7de3a8', '#ff9a3d', '#8be9fd'],

  ivlOf(kind) { return kind === 'slow' ? 1 : 0.5; },
  bloomBeat(c, kind) { return c + (kind === 'slow' ? 3 : 1.5); },

  buildChart() {
    return this.commands.map(([c, kind], i) => ({
      beat: this.bloomBeat(c, kind), cmd: c, kind, idx: i
    }));
  },

  init(game) {
    game.mahou = { bloomT: -9, sadT: -9 };
  },

  scheduleStep(step, t, game) {
    const beat = step / 2;
    const spb = Conductor.secPerBeat();
    if (step % 2 === 0) {
      // 神秘夜晚伴奏：分解和弦（Am → F → C → G，每小节一换）
      const chords = [
        [220, 261.63, 329.63],
        [174.61, 220, 261.63],
        [196, 261.63, 329.63],
        [196, 246.94, 293.66]
      ];
      const b = ((beat % 4) + 4) % 4;
      const ch = chords[Math.floor(beat / 4) % 4];
      AudioEngine.tone(t, ch[[0, 1, 2, 1][b]], spb * 0.5, 'triangle', 0.07);
      if (b === 0) AudioEngine.tone(t, ch[0] / 2, spb * 3.2, 'sine', 0.07); // 低音垫底
      // 预备拍（前 4 拍滴答）
      if (beat < 4) AudioEngine.blok(t, beat === 3 ? 1320 : 880);
    }
    // 咒语音节：pi-ko-pon（间隔 = 速度：慢 1 拍 / 快半拍）
    for (const [c, kind] of this.commands) {
      const ivl = this.ivlOf(kind);
      for (let i = 0; i < 3; i++) {
        if (c + i * ivl === beat) AudioEngine.blok(t, this.SYL_FREQ[i]);
      }
    }
  },

  onJudge(game, note, res) {
    const st = Conductor.songTime();
    if (res === 'miss') {
      game.mahou.sadT = st;
    } else {
      game.mahou.bloomT = st;
      note.bloomT = st;
      AudioEngine.sparkle(AudioEngine.now()); // 花开！
      const [fx, fy] = this.flowerPos(note.idx);
      game.burst(fx, fy - 36, this.FLOWER_COLORS[note.idx % 6], 18);
    }
  },

  onWhiff(game) {
    game.mahou.sadT = Conductor.songTime();
  },

  // 花坛位置：上排 6 朵 + 下排 6 朵
  flowerPos(i) {
    return [400 + (i % 6) * 104, i < 6 ? 448 : 500];
  },

  // 四角小星星（魔杖尖 / 装饰用）
  star(ctx, x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const rr = i % 2 === 0 ? r : r * 0.4;
      const a = -Math.PI / 2 + i * Math.PI / 4;
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
  },

  // 画一朵花：open 0=花苞 1=盛开；wilt=凋谢
  drawFlower(ctx, x, y, open, color, wilt, sway) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(sway);
    const stemH = 34;
    // 花茎（凋谢时弯曲垂头）
    ctx.strokeStyle = wilt ? '#5a5a66' : '#4e9e4e';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    if (wilt) ctx.quadraticCurveTo(6, -stemH * 0.6, 10, -stemH + 8);
    else ctx.lineTo(0, -stemH);
    ctx.stroke();
    if (!wilt) {
      ctx.fillStyle = '#4e9e4e';
      ctx.beginPath(); ctx.ellipse(-7, -12, 7, 3.5, -0.5, 0, Math.PI * 2); ctx.fill();
    }
    // 花头
    ctx.translate(wilt ? 10 : 0, wilt ? -stemH + 8 : -stemH);
    if (wilt) ctx.rotate(1.1);
    if (open <= 0.12) {
      // 花苞：萼片抱住的闭合骨朵
      const r = 6 + open * 10;
      ctx.fillStyle = wilt ? '#7a7a88' : color;
      ctx.beginPath(); ctx.ellipse(0, -3, r * 0.62, r * 0.85, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = wilt ? '#5a5a66' : '#3e8e3e';
      ctx.beginPath();
      ctx.moveTo(-5, 2); ctx.lineTo(0, 6); ctx.lineTo(5, 2); ctx.lineTo(0, -1);
      ctx.closePath(); ctx.fill();
    } else {
      // 盛开：5 瓣 + 花心
      const r = 6 + open * 12;
      ctx.fillStyle = wilt ? '#8a8a99' : color;
      for (let i = 0; i < 5; i++) {
        ctx.save();
        ctx.rotate(i * Math.PI * 2 / 5);
        ctx.beginPath(); ctx.ellipse(0, -r * 0.62, r * 0.34, r * 0.62, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = wilt ? '#6a6a78' : '#fff3c4';
      ctx.beginPath(); ctx.arc(0, 0, r * 0.34, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  },

  draw(game, ctx) {
    const st = Conductor.songTime();
    const beat = Conductor.songBeat();
    const k = game.mahou;

    // 背景：夜晚花园
    const sky = ctx.createLinearGradient(0, 0, 0, 400);
    sky.addColorStop(0, '#150f38');
    sky.addColorStop(1, '#3b2d6b');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 960, 400);
    // 星星（闪烁）
    for (let i = 0; i < 36; i++) {
      const sx = (i * 167) % 960, sy = (i * 89) % 240;
      ctx.fillStyle = 'rgba(255,255,255,' + (0.25 + 0.5 * Math.abs(Math.sin(st * 1.5 + i))).toFixed(3) + ')';
      ctx.fillRect(sx, sy, 2.5, 2.5);
    }
    // 月亮 + 光晕
    ctx.fillStyle = 'rgba(255,243,196,0.16)';
    ctx.beginPath(); ctx.arc(800, 95, 62, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath(); ctx.arc(800, 95, 42, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(230,214,160,0.8)';
    ctx.beginPath(); ctx.arc(788, 86, 8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(812, 106, 5, 0, Math.PI * 2); ctx.fill();
    // 远山 + 树影
    Draw.hill(ctx, 140, 390, 250, 60, '#231d3f');
    Draw.hill(ctx, 860, 390, 280, 70, '#1f1937');
    ctx.fillStyle = '#1a1530';
    ctx.fillRect(48, 300, 14, 92);
    ctx.fillStyle = '#201a3a';
    ctx.beginPath(); ctx.arc(55, 285, 42, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(28, 306, 26, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(84, 308, 24, 0, Math.PI * 2); ctx.fill();
    // 萤火虫
    for (let i = 0; i < 6; i++) {
      const fx = 480 + i * 74 + Math.sin(st * 0.8 + i * 2) * 26;
      const fy = 320 + Math.sin(st * 1.3 + i * 3) * 24;
      ctx.fillStyle = 'rgba(232,255,154,' + (0.3 + 0.5 * Math.abs(Math.sin(st * 2 + i * 1.7))).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(fx, fy, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    // 地面 + 两层花坛土丘
    Draw.ground(ctx, 390, '#2c2547');
    ctx.fillStyle = '#3a2f52';
    ctx.beginPath(); ctx.ellipse(660, 450, 300, 26, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#342a4a';
    ctx.beginPath(); ctx.ellipse(650, 508, 320, 28, 0, 0, Math.PI * 2); ctx.fill();

    // 当前进行中的咒语（含即将开花的瞬间）
    let active = null;
    for (const [c, kind] of this.commands) {
      const bb = this.bloomBeat(c, kind);
      if (beat >= c - 0.02 && beat < bb + 0.25) { active = { c, kind, bb }; break; }
    }
    // 音节发声时刻 → 杖尖闪光
    let wandGlow = 0;
    for (const [c, kind] of this.commands) {
      const ivl = this.ivlOf(kind);
      for (let i = 0; i < 3; i++) {
        const sb = c + i * ivl;
        if (beat >= sb && beat - sb < 0.2) wandGlow = Math.max(wandGlow, 1 - (beat - sb) / 0.2);
      }
    }

    // 花园（先上排后下排，idx 顺序即绘制顺序）
    for (const n of game.chart) {
      const [fx, fy] = this.flowerPos(n.idx);
      const color = this.FLOWER_COLORS[n.idx % 6];
      let open = 0.06, wilt = false, sway = Math.sin(st * 1.6 + n.idx) * 0.04;
      if (n.state === 'miss') {
        wilt = true;
      } else if (n.bloomT != null) {
        const p = Math.min(1, (st - n.bloomT) / 0.35);
        open = 0.06 + 0.94 * (1 - Math.pow(1 - p, 3)); // 绽放动画
      } else if (n.state === 'pending' && beat >= n.cmd) {
        // 咒语进行中：花苞颤动 + 微光（就要开了！）
        sway = Math.sin(st * 26) * 0.05;
        ctx.fillStyle = 'rgba(255,240,180,' + (0.22 + 0.16 * Math.sin(st * 8)).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(fx, fy - 34, 16, 0, Math.PI * 2); ctx.fill();
      }
      this.drawFlower(ctx, fx, fy, open, color, wilt, sway);
    }

    // 兔子巫师（持杖）
    const bx = 170, bob = Math.sin(beat * Math.PI) * 3, by = 380 + bob;
    let mood = 'idle';
    if (st - k.sadT < 0.7) mood = 'sad';
    else if (st - k.bloomT < 0.6) mood = 'happy';
    Animals.bunny(ctx, bx, by, 34, {
      color: '#c5b3f0',
      mood,
      earFlop: active ? 0.3 : 0,
      armL: 0.5,
      armR: -0.9
    });
    // 巫师帽（歪戴）
    ctx.save();
    ctx.translate(bx + 4, by - 64);
    ctx.rotate(-0.12);
    ctx.fillStyle = '#5b3fa8';
    ctx.beginPath();
    ctx.moveTo(-22, -2); ctx.lineTo(10, -58); ctx.lineTo(26, -2);
    ctx.closePath(); ctx.fill();
    this.star(ctx, 2, -22, 5, '#ffd94d');
    this.star(ctx, 10, -38, 4, '#ffd94d');
    ctx.fillStyle = '#4a3590';
    ctx.beginPath(); ctx.ellipse(0, 0, 32, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // 魔杖（开花瞬间高举）
    const tipUp = st - k.bloomT < 0.4;
    const wx = bx + 34, wy = by - 8;
    const tx = bx + 64, ty = tipUp ? by - 76 : by - 44;
    ctx.strokeStyle = '#8a5a3b';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(tx, ty); ctx.stroke();
    if (wandGlow > 0) {
      ctx.fillStyle = 'rgba(255,217,77,' + (wandGlow * 0.35).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(tx, ty, 14 + wandGlow * 10, 0, Math.PI * 2); ctx.fill();
    }
    this.star(ctx, tx, ty, 9 * (1 + wandGlow * 0.5), '#ffd94d');

    // 咒语气泡：pi ko pon 逐个亮起
    if (active) {
      const ivl = this.ivlOf(active.kind);
      const due = beat >= active.bb - 0.12; // 开花在即：气泡描边变金
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = due ? '#ffd94d' : 'rgba(38,35,46,0.85)';
      ctx.lineWidth = due ? 5 : 3;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(208, 78, 250, 78, 14);
      else ctx.rect(208, 78, 250, 78, 14);
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(240, 152); ctx.lineTo(216, 182); ctx.lineTo(268, 154);
      ctx.closePath(); ctx.fill();
      for (let i = 0; i < 3; i++) {
        const lit = beat >= active.c + i * ivl - 0.02;
        Draw.text(ctx, this.SYL[i], 333 + (i - 1) * 72, 118, lit ? 32 : 28,
          lit ? '#e8a13d' : 'rgba(38,35,46,0.3)');
      }
      if (beat >= active.c + 2 * ivl) Draw.text(ctx, '→ 🌸', 410, 118, 24, '#e85d8a');
    }

    // 教学提示（开头）
    if (beat >= 0 && beat < 4) {
      Draw.text(ctx, '听咒语「pi-ko-pon」：咒停的瞬间按空格，花开！', 480, 40, 26, 'rgba(255,255,255,0.95)');
    }
  }
};

/* ================================================================
 * 第 16 关 · 企鹅跳台
 * 听铃声起跳：高音铃 = 1 拍后跳，低音铃 = 2 拍后跳。
 * 铃声在音符前 wait 拍响起，铃声音高本身就是「数几拍」的提示。
 * ============================================================== */
const LevelShowtime = {
  id: 'showtime',
  name: '第 16 关 · 企鹅跳台',
  desc: '听铃声起跳：高音铃=1拍后跳，低音铃=2拍后跳！',
  hint: '空格 / 点击 = 起跳 · Esc = 退出',
  bpm: 108,
  totalBeats: 40,

  PLANK_X: 366, PLANK_Y: 384, // 跳板端站位
  POD_X: 650, POD_Y: 312,     // 领奖台顶站位

  // [起跳拍, 等待拍数]
  specs: [
    [4, 1], [6, 1], [8, 2], [11, 1], [13, 2], [16, 1], [18, 1],
    [20, 2], [23, 1], [25, 1], [27, 2], [30, 1], [32, 2], [35, 1]
  ],

  buildChart() {
    return this.specs.map(([b, w]) => ({ beat: b, wait: w }));
  },

  init(game) {
    game.showtime = { jumpT: -9, sadT: -9 };
  },

  scheduleStep(step, t, game) {
    const beat = step / 2;
    const spb = Conductor.secPerBeat();
    if (step % 2 === 0) {
      const b = ((beat % 4) + 4) % 4;
      // 马戏伴奏：oom-pah + 轻快旋律
      if (b === 0 || b === 2) AudioEngine.kick(t);
      if (b === 1 || b === 3) AudioEngine.snare(t);
      AudioEngine.tone(t, [130.81, 98, 110, 98][b], spb * 0.4, 'triangle', 0.2);
      AudioEngine.tone(t, [659.25, 783.99, 659.25, 587.33][b], spb * 0.25, 'triangle', 0.05);
      if (beat < 4) AudioEngine.blok(t, beat === 3 ? 1320 : 880);
    } else {
      AudioEngine.hihat(t, false);
      AudioEngine.tone(t, [261.63, 329.63, 349.23, 329.63][Math.floor(beat) % 4], 0.1, 'square', 0.05);
    }
    // 铃声预告：高音铃 = 1 拍后跳，低音铃 = 2 拍后跳
    for (const n of game.chart) {
      if (n.beat - n.wait === beat) AudioEngine.bell(t, n.wait === 1 ? 2093 : 1046);
    }
  },

  onJudge(game, note, res) {
    const st = Conductor.songTime();
    if (res === 'miss') {
      game.showtime.sadT = st;
    } else {
      game.showtime.jumpT = st;
      AudioEngine.sfxCue(AudioEngine.now()); // 起跳上升滑音
      game.burst(this.PLANK_X, this.PLANK_Y, '#ffffff', 8);
    }
  },

  onWhiff(game) {
    game.showtime.sadT = Conductor.songTime();
  },

  // 金色铃铛（ring 时摇摆 + 声波）
  drawBell(ctx, x, y, s, ring, st) {
    ctx.save();
    ctx.translate(x, y);
    if (ring) ctx.rotate(Math.sin(st * 30) * 0.22);
    ctx.fillStyle = '#a8720e';
    ctx.fillRect(-2 * s, -22 * s, 4 * s, 8 * s);
    ctx.fillStyle = ring ? '#ffe680' : '#e8b93b';
    ctx.beginPath();
    ctx.moveTo(-14 * s, 10 * s);
    ctx.quadraticCurveTo(-16 * s, -12 * s, 0, -16 * s);
    ctx.quadraticCurveTo(16 * s, -12 * s, 14 * s, 10 * s);
    ctx.closePath(); ctx.fill();
    ctx.fillRect(-17 * s, 8 * s, 34 * s, 5 * s);
    ctx.fillStyle = '#a8720e';
    ctx.beginPath(); ctx.arc(0, 15 * s, 4 * s, 0, Math.PI * 2); ctx.fill();
    if (ring) {
      ctx.strokeStyle = 'rgba(255,230,128,0.8)';
      ctx.lineWidth = 2.5;
      for (const side of [-1, 1]) {
        ctx.beginPath(); ctx.arc(side * 20 * s, 0, 8 * s, side > 0 ? -0.9 : Math.PI - 0.9, side > 0 ? 0.9 : Math.PI + 0.9); ctx.stroke();
        ctx.beginPath(); ctx.arc(side * 20 * s, 0, 13 * s, side > 0 ? -0.7 : Math.PI - 0.7, side > 0 ? 0.7 : Math.PI + 0.7); ctx.stroke();
      }
    }
    ctx.restore();
  },

  // 串灯（下垂弧线 + 彩色灯泡）
  stringLights(ctx, x1, y1, x2, y2, st) {
    const cx = (x1 + x2) / 2, cy = Math.max(y1, y2) + 42;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(cx, cy, x2, y2); ctx.stroke();
    const cols = ['#ff5da2', '#ffd94d', '#7de3a8', '#8be9fd'];
    for (let i = 1; i < 8; i++) {
      const u = i / 8;
      const lx = (1 - u) * (1 - u) * x1 + 2 * (1 - u) * u * cx + u * u * x2;
      const ly = (1 - u) * (1 - u) * y1 + 2 * (1 - u) * u * cy + u * u * y2;
      ctx.fillStyle = cols[i % 4];
      ctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(st * 2 + i * 1.3));
      ctx.beginPath(); ctx.arc(lx, ly + 5, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  },

  draw(game, ctx) {
    const st = Conductor.songTime();
    const beat = Conductor.songBeat();
    const k = game.showtime;

    // 背景：雪夜马戏团
    const sky = ctx.createLinearGradient(0, 0, 0, 400);
    sky.addColorStop(0, '#101a3a');
    sky.addColorStop(1, '#33507e');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 960, 400);
    for (let i = 0; i < 30; i++) {
      const sx = (i * 173) % 960, sy = (i * 67) % 200;
      ctx.fillStyle = 'rgba(255,255,255,' + (0.25 + 0.45 * Math.abs(Math.sin(st * 1.4 + i))).toFixed(3) + ')';
      ctx.fillRect(sx, sy, 2.5, 2.5);
    }
    // 大帐篷（红白条纹楔形）
    const apexX = 680, apexY = 120, baseY = 400, tx0 = 470, tx1 = 890;
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#c62828' : '#f5f0e8';
      ctx.beginPath();
      ctx.moveTo(apexX, apexY);
      ctx.lineTo(tx0 + (tx1 - tx0) * i / 6, baseY);
      ctx.lineTo(tx0 + (tx1 - tx0) * (i + 1) / 6, baseY);
      ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = '#8d6e63';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(apexX, apexY); ctx.lineTo(apexX, apexY - 30); ctx.stroke();
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath();
    ctx.moveTo(apexX, apexY - 30); ctx.lineTo(apexX + 22, apexY - 23); ctx.lineTo(apexX, apexY - 16);
    ctx.closePath(); ctx.fill();
    // 串灯
    this.stringLights(ctx, 40, 66, 460, 108, st);
    this.stringLights(ctx, 500, 108, 930, 62, st);
    // 飘雪
    for (let i = 0; i < 28; i++) {
      const sx = (i * 97 + st * 24) % 980 - 10;
      const sy = (i * 71 + st * 42) % 420;
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath(); ctx.arc(sx, sy, 2, 0, Math.PI * 2); ctx.fill();
    }
    // 雪地
    Draw.ground(ctx, 400, '#dfe9f5');
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = 'rgba(255,255,255,' + (0.3 + 0.5 * Math.abs(Math.sin(st * 2 + i * 2.1))).toFixed(3) + ')';
      ctx.fillRect((i * 131) % 940 + 10, 420 + (i * 37) % 100, 3, 3);
    }

    // 领奖台（2 / 1 / 3）
    ctx.fillStyle = '#c9ccd6'; ctx.fillRect(520, 385, 80, 85);
    ctx.fillStyle = '#e8b93b'; ctx.fillRect(600, 345, 100, 125);
    ctx.fillStyle = '#cd8f5a'; ctx.fillRect(700, 405, 80, 65);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(520, 385, 80, 4);
    ctx.fillRect(600, 345, 100, 4);
    ctx.fillRect(700, 405, 80, 4);
    Draw.text(ctx, '2', 560, 430, 26, '#7a7a88');
    Draw.text(ctx, '1', 650, 415, 34, '#8a6d1f');
    Draw.text(ctx, '3', 740, 445, 22, '#8a5a3b');

    // 当前蓄力中的音符（铃已响、跳未到）→ 跳板压弯
    let armed = null;
    for (const n of game.chart) {
      if (n.state === 'pending' && beat >= n.beat - n.wait && beat <= n.beat) { armed = n; break; }
    }
    const sag = armed ? 13 : 0;
    // 支点 + 跳板
    ctx.fillStyle = '#8d8d99';
    ctx.beginPath();
    ctx.moveTo(300, 404); ctx.lineTo(284, 432); ctx.lineTo(316, 432);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#c98d5e';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(226, 406);
    ctx.quadraticCurveTo(312, 406 + sag, 394, 406 + sag * 0.9);
    ctx.stroke();

    // 企鹅（蓝白色的鸟）：站位状态机（全部只读时钟推导）
    let px = this.PLANK_X, py = this.PLANK_Y + sag * 0.8;
    let prot = 0, squash = 0, flap = 0, mood = 'idle', phase = 'board';
    const f = st - k.jumpT;
    if (f >= 0 && f < 0.5) {
      phase = 'fly';
      const p = f / 0.5;
      px = this.PLANK_X + (this.POD_X - this.PLANK_X) * p;
      py = this.PLANK_Y + (this.POD_Y - this.PLANK_Y) * p - Math.sin(p * Math.PI) * 120;
      prot = -0.25 + p * 0.5;
      flap = 1;
    } else if (f >= 0.5 && f < 1.5) {
      phase = 'podium';
      px = this.POD_X; py = this.POD_Y;
      mood = 'happy';
    } else if (f >= 1.5 && f < 2.1) {
      phase = 'back';
      const q = (f - 1.5) / 0.6;
      px = this.POD_X + (this.PLANK_X - this.POD_X) * q;
      py = this.POD_Y + (this.PLANK_Y - this.POD_Y) * q + Math.sin(q * Math.PI * 3) * 8;
      flap = 0.5;
    }
    if (armed && phase === 'board') squash = 0.22; // 铃响后压板蓄力
    if (st - k.sadT < 0.7) {
      mood = 'sad';
      if (phase === 'board') py -= Math.abs(Math.sin((st - k.sadT) * 6)) * 8; // 懊恼小跳
    }
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(prot);
    if (squash > 0) ctx.scale(1 + squash * 0.5, 1 - squash); // 铃响后压板蓄力
    Animals.bird(ctx, 0, 0, 28, {
      color: '#33507e',
      mood,
      pose: phase === 'fly' ? 'stretch' : 'idle',
      beakOpen: phase === 'podium' ? 0.6 : 0,
      wingFlap: flap
    });
    ctx.restore();
    // 蓄力时的板上影子
    if (squash > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath(); ctx.ellipse(px, this.PLANK_Y + 26, 26, 5, 0, 0, Math.PI * 2); ctx.fill();
    }

    // 登台闪光灯
    if (phase === 'podium') {
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + Math.PI / 4;
        const fx2 = this.POD_X + Math.cos(a) * 74, fy2 = this.POD_Y - 20 + Math.sin(a) * 52;
        ctx.fillStyle = 'rgba(255,255,255,' + (0.4 + 0.6 * Math.abs(Math.sin(st * 10 + i * 1.6))).toFixed(3) + ')';
        ctx.beginPath();
        for (let j = 0; j < 8; j++) {
          const rr = j % 2 === 0 ? 9 : 3.5;
          const aa = -Math.PI / 2 + j * Math.PI / 4;
          const jx = fx2 + Math.cos(aa) * rr, jy = fy2 + Math.sin(aa) * rr;
          if (j === 0) ctx.moveTo(jx, jy); else ctx.lineTo(jx, jy);
        }
        ctx.closePath(); ctx.fill();
      }
    }

    // 等待拍数提示点（逐个亮起，亮满即跳）
    if (armed) {
      for (let j = 0; j < armed.wait; j++) {
        const lit = beat >= armed.beat - armed.wait + j;
        ctx.fillStyle = lit ? '#ffd94d' : 'rgba(255,255,255,0.4)';
        ctx.beginPath();
        ctx.arc(this.PLANK_X + (j - (armed.wait - 1) / 2) * 22, 330, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 大小铃铛（铃响时摇摆发声）
    let ringHi = false, ringLo = false;
    for (const n of game.chart) {
      const bb = n.beat - n.wait;
      if (beat >= bb && beat - bb < 0.35) {
        if (n.wait === 1) ringHi = true; else ringLo = true;
      }
    }
    this.drawBell(ctx, 130, 96, 0.85, ringHi, st);
    this.drawBell(ctx, 224, 108, 1.2, ringLo, st);
    Draw.text(ctx, '高音=1拍', 130, 140, 15, 'rgba(255,255,255,0.85)');
    Draw.text(ctx, '低音=2拍', 224, 152, 15, 'rgba(255,255,255,0.85)');

    // 按键图例（右下角常驻）
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(706, 470, 240, 56, 10);
    else ctx.rect(706, 470, 240, 56, 10);
    ctx.fill();
    Draw.text(ctx, '高音铃 = 1 拍后跳', 826, 490, 17, '#1565c0');
    Draw.text(ctx, '低音铃 = 2 拍后跳', 826, 512, 17, '#c62828');

    // 教学提示（开头）
    if (beat >= 0 && beat < 4) {
      Draw.text(ctx, '听铃声：高音铃 1 拍后跳，低音铃 2 拍后跳！', 480, 40, 26, 'rgba(255,255,255,0.95)');
    }
  }
};

/* ================================================================
 * 第 17 关 · 老鼠冲刺（长按音符）
 * 「预备」两声 → 按住蹲下蓄力；哨声 GO → 松开冲刺到奶酪。
 * 蓄力时长（dur）每次不同，全靠听哨声。
 * ============================================================== */
const LevelRatRace = {
  id: 'ratrace',
  name: '第 17 关 · 老鼠冲刺',
  desc: '「预备」按住蹲下，哨声「GO!」松开冲刺！蓄力时长每次不同。',
  hint: '按住空格 = 蓄力 · 哨声松开 · Esc = 退出',
  bpm: 100,
  totalBeats: 42,

  START_X: 210, CHEESE_X: 760, // 起跑线 / 奶酪位置

  // [预备拍, 蓄力拍数]
  specs: [
    [4, 1], [8, 2], [12, 1], [16, 3], [21, 2], [25, 1], [29, 2.5], [34, 1.5]
  ],

  buildChart() {
    return this.specs.map(([b, d]) => ({ beat: b, dur: d }));
  },

  init(game) {
    game.rat = { goT: -9, sadT: -9, crouchT: -9 };
  },

  scheduleStep(step, t, game) {
    const beat = step / 2;
    const spb = Conductor.secPerBeat();
    if (step % 2 === 0) {
      const b = ((beat % 4) + 4) % 4;
      if (b === 0 || b === 2) AudioEngine.kick(t);
      if (b === 1 || b === 3) AudioEngine.snare(t);
      if (beat < 4) AudioEngine.blok(t, beat === 3 ? 1320 : 880);
    } else {
      AudioEngine.hihat(t, false);
    }
    // 赛跑伴奏：紧张感八分贝斯脉冲
    AudioEngine.tone(t, [82.41, 82.41, 82.41, 87.31, 82.41, 82.41, 98, 110][step % 8],
      0.12, 'sawtooth', 0.11);
    // 口令：预备（两声）→ 哨声 GO!
    for (const n of game.chart) {
      if (n.beat === beat) {
        AudioEngine.blok(t, 660);
        AudioEngine.blok(t + spb * 0.5, 660);
      }
      if (n.beat + n.dur === beat) AudioEngine.whistle(t);
    }
  },

  // 按下 = 蹲下蓄力
  onPress(game, note, res) {
    game.rat.crouchT = Conductor.songTime();
    AudioEngine.tone(AudioEngine.now(), 196, 0.1, 'sine', 0.2); // 蹲下闷响
  },

  // 松开 = 冲刺 / 摔倒
  onRelease(game, note, res) {
    const st = Conductor.songTime();
    if (res === 'miss' || res === 'over') {
      game.rat.sadT = st;
      note.tripT = st;
    } else {
      game.rat.goT = st;
      note.goT = st;
      AudioEngine.swish(AudioEngine.now()); // 冲刺破空
      game.burst(this.START_X, 420, '#c9b08a', 10);
    }
  },

  onJudge(game, note, res) {
    if (res === 'miss') game.rat.sadT = Conductor.songTime(); // 压根没蹲下
  },

  onWhiff(game) {
    game.rat.sadT = Conductor.songTime();
  },

  draw(game, ctx) {
    const st = Conductor.songTime();
    const beat = Conductor.songBeat();
    const k = game.rat;

    // 背景：清晨赛场
    const sky = ctx.createLinearGradient(0, 0, 0, 400);
    sky.addColorStop(0, '#7ec8ff');
    sky.addColorStop(1, '#eaf8ff');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 960, 400);
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath(); ctx.arc(840, 66, 36, 0, Math.PI * 2); ctx.fill();
    const drift = (st * 12) % 1200;
    Draw.cloud(ctx, 1020 - drift, 80, 0.9);
    Draw.cloud(ctx, 620 - drift, 140, 0.6);
    Draw.hill(ctx, 150, 400, 290, 70, '#9edb7a');
    Draw.hill(ctx, 800, 400, 310, 80, '#8fd45e');
    // 观众：一排彩色圆脑袋（随节拍蹦跳）
    const crowdCols = ['#ff8fb3', '#ffd94d', '#7de3a8', '#8be9fd', '#b39dff', '#ff9a3d'];
    for (let i = 0; i < 12; i++) {
      const cbob = Math.abs(Math.sin(beat * Math.PI + i)) * 6;
      Draw.blob(ctx, 50 + i * 80, 372 - cbob, 15, crowdCols[i % 6], 'happy', {});
    }
    // 跑道 + 白色分道虚线
    Draw.ground(ctx, 400, '#c98d5e');
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let x = 20; x < 960; x += 60) ctx.fillRect(x, 470, 30, 4);
    // 起跑线（棋盘格）
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#26232e' : '#fff';
      ctx.fillRect(204, 402 + i * 10, 6, 10);
      ctx.fillStyle = i % 2 === 0 ? '#fff' : '#26232e';
      ctx.fillRect(210, 402 + i * 10, 6, 10);
    }

    // —— 兔子状态机（全部只读时钟推导） ——
    const holding = game.chart.find(n => n.state === 'holding');
    let cur = null;
    for (const n of game.chart) if (n.state !== 'pending') cur = n;
    const next = game.chart.find(n => n.state === 'pending');

    let bx = this.START_X, by = 402, squash = 0, rotate = 0, mood = 'idle';
    let speed = 0, legPhase = 0, phase = 'idle', cheeseGone = false;
    if (holding) {
      // 蹲踞蓄力：压低 + 高频颤动
      phase = 'hold';
      squash = 0.3;
      bx = this.START_X + Math.sin(st * 55) * 1.6;
    } else if (cur && cur.goT != null) {
      const f = st - cur.goT;
      if (f < 0.34) {
        // 冲刺：加速冲出 + 快速倒腾腿
        phase = 'run';
        const p = f / 0.34;
        bx = this.START_X + 550 * p * p;
        speed = 1;
        rotate = 0.18;
        legPhase = Math.floor(st * 24) % 2 === 0 ? 1 : -1;
      } else if (next && beat >= next.beat - 0.5) {
        // 下一跑开始前冲回起点
        phase = 'back';
        const q = Math.min(1, (beat - (next.beat - 0.5)) / 0.5);
        bx = this.CHEESE_X - 550 * q;
        speed = q < 1 ? 0.7 : 0;
        rotate = q < 1 ? -0.12 : 0;
        cheeseGone = q < 1;
      } else {
        // 在奶酪旁开心进食
        phase = 'eat';
        bx = this.CHEESE_X - 18;
        mood = f < 1.3 ? 'happy' : 'idle';
        cheeseGone = true;
      }
    } else if (cur && cur.state === 'miss') {
      // 摔倒 / 没跑成：懊恼地杵在起点附近
      phase = 'trip';
      mood = 'sad';
      const f = st - k.sadT;
      if (f < 0.5) {
        const p = f / 0.5;
        bx = this.START_X + 40 * p;
        rotate = Math.sin(p * Math.PI) * 0.35;
      } else {
        bx = this.START_X + 40;
        if (next && beat >= next.beat - 0.5) {
          const q = Math.min(1, (beat - (next.beat - 0.5)) / 0.5);
          bx = this.START_X + 40 - 40 * q;
          if (q >= 1) mood = 'idle';
        }
      }
    }
    if (phase !== 'run' && phase !== 'eat' && st - k.sadT < 0.6) mood = 'sad';

    // 奶酪（被吃掉前一直在终点等着）
    if (!cheeseGone) {
      ctx.fillStyle = '#e8e8ee';
      ctx.beginPath(); ctx.ellipse(790, 432, 46, 10, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd94d';
      ctx.beginPath();
      ctx.moveTo(762, 428); ctx.lineTo(818, 428); ctx.lineTo(790, 396);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e8b93b';
      ctx.beginPath(); ctx.arc(786, 420, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(800, 424, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(778, 425, 2.5, 0, Math.PI * 2); ctx.fill();
    }

    // 速度线
    if (speed > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.6 * speed).toFixed(3) + ')';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        const ly = by - 34 + i * 16;
        const ll = 30 + (i * 37) % 40;
        const lx = bx - 44 - (i * 53) % 50;
        ctx.beginPath(); ctx.moveTo(lx - ll, ly); ctx.lineTo(lx, ly); ctx.stroke();
      }
    }

    // 兔子选手（蹲踞式起跑）
    Animals.bunny(ctx, bx, by, 32, {
      color: '#ff9a3d',
      mood,
      squash,
      rotate,
      legPhase,
      earFlop: phase === 'run' || phase === 'back' ? 1 : 0,
      headband: '#e85d5d',
      armL: 0.6,
      armR: 0.6
    });
    // 蓄力汗滴
    if (phase === 'hold') {
      ctx.fillStyle = '#8be9fd';
      const sy2 = by - 58 + ((st * 90) % 24);
      ctx.beginPath(); ctx.ellipse(bx + 26, sy2, 3.5, 5, 0, 0, Math.PI * 2); ctx.fill();
    }
    // 到达奶酪的开心花花
    if (phase === 'eat' && st - cur.goT < 1.3) {
      Draw.text(ctx, '♥', this.CHEESE_X - 6, by - 70 - (st - cur.goT) * 20, 24, '#ff8fb3');
    }

    // 发令旗：蓄力期红旗，哨响瞬间变绿旗
    ctx.strokeStyle = '#8d6e63';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(168, 322); ctx.lineTo(168, 402); ctx.stroke();
    let flagCol = '#b9b3c8';
    for (const n of game.chart) {
      if (beat >= n.beat && beat < n.beat + n.dur) flagCol = '#e85d5d';
      else if (beat >= n.beat + n.dur && beat < n.beat + n.dur + 0.5) flagCol = '#2e9e4e';
    }
    ctx.fillStyle = flagCol;
    ctx.beginPath();
    ctx.moveTo(168, 322); ctx.lineTo(196, 331); ctx.lineTo(168, 340);
    ctx.closePath(); ctx.fill();

    // 口令文字
    if (phase === 'hold' || (next && beat >= next.beat && beat < next.beat + next.dur)) {
      Draw.text(ctx, '预备！', 330, 300, 36, '#e85d5d');
    }
    if (cur && cur.goT != null && st - cur.goT < 0.5) {
      Draw.text(ctx, 'GO!!', 330, 300, 40, '#2e9e4e');
    }
    // 赛段计数
    const raceNo = Math.min(8,
      game.chart.filter(n => n.beat <= beat).length + (game.chart.some(n => n.beat > beat) ? 1 : 0));
    Draw.text(ctx, '第 ' + raceNo + ' / 8 跑', 930, 30, 19, 'rgba(38,35,46,0.6)', 'right');

    // 教学提示（开头）
    if (beat >= 0 && beat < 4) {
      Draw.text(ctx, '「预备」按住蹲下，哨声「GO!」松开冲刺！', 480, 40, 26, '#fff');
    }
  }
};

/* ================================================================
 * 第 18 关 · DJ 学校（长按音符）
 * 按住 = 搓碟：伴奏整体「被搓停」（scheduleStep 检测 holding 跳过鼓/贝斯/旋律）；
 * 「YO!」= 松开提示，音乐回来。
 * ============================================================== */
const LevelDJ = {
  id: 'dj',
  name: '第 18 关 · DJ 学校',
  desc: '按住空格搓碟（音乐停），听「YO!」松开让音乐回来！',
  hint: '按住=搓碟 · YO!松开 · Esc = 退出',
  bpm: 110,
  totalBeats: 38,

  // [搓碟起始拍, 持续拍数]
  specs: [
    [4, 2], [8, 1], [12, 2], [16, 1], [20, 2], [26, 1], [28, 2], [32, 2]
  ],

  buildChart() {
    return this.specs.map(([b, d]) => ({ beat: b, dur: d }));
  },

  init(game) {
    game.dj = { dropT: -9, sadT: -9, freezeT: 0 };
  },

  scheduleStep(step, t, game) {
    const beat = step / 2;
    const spb = Conductor.secPerBeat();
    // ★核心机制：搓碟中（有音符处于 holding）→ 跳过全部鼓/贝斯/旋律
    const scratching = game.chart.some(n => n.state === 'holding');
    const b = ((beat % 4) + 4) % 4;
    if (!scratching) {
      // 放克伴奏：kick 1,3 / snare 2,4 / 贝斯 riff
      if (step % 2 === 0) {
        if (b === 0 || b === 2) AudioEngine.kick(t);
        if (b === 1 || b === 3) AudioEngine.snare(t);
        AudioEngine.tone(t, [82.4, 82.4, 98, 110][b], spb * 0.3, 'sawtooth', 0.16);
        AudioEngine.tone(t, [659.25, 587.33, 783.99, 587.33][b], spb * 0.18, 'square', 0.05);
      } else {
        AudioEngine.hihat(t, false);
        AudioEngine.tone(t, [82.4, 82.4, 98, 110][Math.floor(beat) % 4], spb * 0.25, 'sawtooth', 0.1);
      }
    }
    // 预备拍（前 4 拍滴答）
    if (beat < 4 && step % 2 === 0) AudioEngine.blok(t, beat === 3 ? 1320 : 880);
    // 口令与提示（搓碟中也必须听得见！）
    for (const n of game.chart) {
      // 提前 1 拍预告：「预备…搓！」
      if (n.beat - 1 === beat) {
        AudioEngine.blok(t, 587);
        AudioEngine.blok(t + spb * 0.5, 587);
      }
      if (n.beat === beat) AudioEngine.blok(t, 1568);           // 到位叮：此刻按住
      if (n.beat + n.dur - 0.5 === beat) AudioEngine.blok(t, 988); // 「YO!」：准备松开
    }
  },

  // 按住开始 = 搓碟（音乐随之静止）
  onPress(game, note, res) {
    game.dj.freezeT = Conductor.songTime();
    AudioEngine.scratch(AudioEngine.now());
  },

  // 松开 = 音乐回来
  onRelease(game, note, res) {
    const st = Conductor.songTime();
    if (res === 'miss' || res === 'over') {
      game.dj.sadT = st;
    } else {
      game.dj.dropT = st;
      AudioEngine.tone(AudioEngine.now(), 1568, 0.35, 'sine', 0.22); // 高光音
      game.burst(480, 300, '#ff5da2', 16);
    }
  },

  onJudge(game, note, res) {
    if (res === 'miss') game.dj.sadT = Conductor.songTime();
  },

  onWhiff(game) {
    game.dj.sadT = Conductor.songTime();
  },

  // 碟盘（θ 为唱针标记角度；scratch 时加运动弧线）
  drawPlatter(ctx, x, y, r, theta, scratch) {
    ctx.fillStyle = '#16161e';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, r * 0.72, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, r * 0.5, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(theta) * r * 0.92, y + Math.sin(theta) * r * 0.92);
    ctx.stroke();
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath(); ctx.arc(x, y, r * 0.22, 0, Math.PI * 2); ctx.fill();
    if (scratch) {
      ctx.strokeStyle = 'rgba(139,233,253,0.7)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, r + 8, -0.6, 0.6); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, r + 8, Math.PI - 0.6, Math.PI + 0.6); ctx.stroke();
    }
  },

  draw(game, ctx) {
    const st = Conductor.songTime();
    const beat = Conductor.songBeat();
    const spb = Conductor.secPerBeat();
    const k = game.dj;
    const scratching = game.chart.some(n => n.state === 'holding');
    // 搓碟时画面里的「音乐时间」冻结：音符停飞、声波拉平、灯球停转
    const tAnim = scratching ? k.freezeT : st;
    const beatAnim = scratching ? k.freezeT / spb : beat;

    // 背景：霓虹夜店
    const bg = ctx.createLinearGradient(0, 0, 0, 540);
    bg.addColorStop(0, '#160a26');
    bg.addColorStop(1, '#2c1248');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 960, 540);
    // 霓虹招牌
    Draw.text(ctx, 'DJ ★ SCHOOL', 480, 46, 38,
      scratching ? 'rgba(255,93,162,0.35)' : '#ff5da2');
    // 碟球光束
    for (let i = 0; i < 3; i++) {
      const a = tAnim * 0.5 + i * (Math.PI * 2 / 3);
      ctx.save();
      ctx.translate(480, 92);
      ctx.rotate(a);
      const lg = ctx.createLinearGradient(0, 0, 0, 400);
      lg.addColorStop(0, 'rgba(139,233,253,' + (scratching ? 0.04 : 0.12) + ')');
      lg.addColorStop(1, 'rgba(139,233,253,0)');
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(-60, 400); ctx.lineTo(60, 400);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    // 碟球
    ctx.fillStyle = '#c9ccd6';
    ctx.beginPath(); ctx.arc(480, 92, 24, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(90,90,110,0.7)';
    ctx.lineWidth = 1.5;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath(); ctx.moveTo(480 - 24, 92 + i * 9); ctx.lineTo(480 + 24, 92 + i * 9); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(480 + i * 9, 92 - 24); ctx.lineTo(480 + i * 9, 92 + 24); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,' + (scratching ? 0.2 : (0.4 + 0.4 * Math.abs(Math.sin(tAnim * 6)))).toFixed(3) + ')';
    ctx.beginPath(); ctx.arc(470, 82, 6, 0, Math.PI * 2); ctx.fill();

    // 悬浮音符（搓碟时静止灰暗，播放时彩色飞舞）
    for (let i = 0; i < 8; i++) {
      const nx = (i * 140 + tAnim * 36) % 1000 - 20;
      const ny = 118 + i * 24 + Math.sin(tAnim * 1.5 + i * 2) * 10;
      const col = scratching
        ? 'rgba(150,150,160,0.45)'
        : 'hsl(' + Math.floor((i * 47 + tAnim * 40) % 360) + ',85%,65%)';
      Draw.text(ctx, i % 2 === 0 ? '♪' : '♫', nx, ny, 24, col);
    }

    // 地面 + 霓虹网格
    Draw.ground(ctx, 470, '#140b24');
    ctx.strokeStyle = 'rgba(255,93,162,0.25)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) {
      const gy = 478 + i * 14;
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(960, gy); ctx.stroke();
    }
    for (let i = -5; i <= 5; i++) {
      ctx.beginPath(); ctx.moveTo(480 + i * 60, 470); ctx.lineTo(480 + i * 160, 540); ctx.stroke();
    }

    // 两侧音箱（随节拍鼓动，搓碟时静止）
    for (const sx of [64, 896]) {
      ctx.fillStyle = '#241634';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(sx - 34, 360, 68, 110, 8);
      else ctx.rect(sx - 34, 360, 68, 110, 8);
      ctx.fill();
      const pulse = scratching ? 0 : Math.max(0, Math.sin(beatAnim * Math.PI * 2)) * 4;
      ctx.fillStyle = '#3a2a5e';
      ctx.beginPath(); ctx.arc(sx, 392, 20 + pulse, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(sx, 444, 14 + pulse * 0.7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#16101f';
      ctx.beginPath(); ctx.arc(sx, 392, 9 + pulse * 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(sx, 444, 6, 0, Math.PI * 2); ctx.fill();
    }

    // DJ 台
    ctx.fillStyle = '#3a2a5e';
    ctx.strokeStyle = scratching ? 'rgba(255,93,162,0.4)' : '#ff5da2';
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(350, 330, 260, 140, 12);
    else ctx.rect(350, 330, 260, 140, 12);
    ctx.fill(); ctx.stroke();
    // 台面 EQ 灯（搓碟时冻结）
    const eqCols = ['#ff5da2', '#ffd94d', '#7de3a8', '#8be9fd', '#b39dff', '#ff9a3d'];
    for (let j = 0; j < 6; j++) {
      const h = scratching ? 4 : 4 + ((Math.floor(beatAnim * 2) + j) % 4) * 7;
      ctx.fillStyle = eqCols[j];
      ctx.fillRect(382 + j * 36, 452 - h, 18, h);
    }
    // 碟盘 ×2（右边是搓碟盘：搓碟时狂转）
    this.drawPlatter(ctx, 420, 336, 34, tAnim * 2, false);
    this.drawPlatter(ctx, 540, 336, 34, scratching ? st * 16 : tAnim * 2, scratching);

    // 狗 DJ（戴帽 + 耳机，搓碟时摇摆）
    let mood = 'idle';
    if (st - k.sadT < 0.7) mood = 'sad';
    else if (st - k.dropT < 0.5) mood = 'happy';
    const dogRot = scratching ? Math.sin(st * 12) * 0.06 : Math.sin(beatAnim * Math.PI) * 0.04;
    Animals.dog(ctx, 480, 262, 32, {
      color: '#c98d5e',
      mood,
      rotate: dogRot,
      tailWag: scratching ? 0.2 : 0.5 + 0.5 * Math.sin(beatAnim * Math.PI * 2)
    });
    // 帽子（反戴）
    ctx.fillStyle = '#e85d5d';
    ctx.beginPath(); ctx.arc(480, 244, 18, Math.PI, 0); ctx.fill();
    ctx.fillRect(448, 240, 18, 6);
    // 耳机
    ctx.strokeStyle = '#26232e';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(480, 250, 24, Math.PI, 0); ctx.stroke();
    ctx.fillStyle = '#26232e';
    ctx.fillRect(452, 244, 9, 14);
    ctx.fillRect(499, 244, 9, 14);
    // 搓碟爪（按住时搭在右盘上）
    if (scratching) {
      ctx.fillStyle = '#c98d5e';
      ctx.beginPath(); ctx.ellipse(536, 322, 10, 7, -0.4, 0, Math.PI * 2); ctx.fill();
      Draw.text(ctx, 'WIKI-WIKI!', 480, 168, 28,
        Math.floor(st * 6) % 2 === 0 ? '#8be9fd' : '#ff5da2');
    }
    // 音乐回来的高光
    if (st - k.dropT < 0.5) {
      Draw.text(ctx, 'DROP!', 480, 168, 42, '#ffd94d');
    }

    // 「YO!」气泡（松开前半拍出现）
    for (const n of game.chart) {
      if (beat >= n.beat + n.dur - 0.5 && beat < n.beat + n.dur + 0.25) {
        ctx.fillStyle = '#ff5da2';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(596, 168, 96, 56, 12);
        else ctx.rect(596, 168, 96, 56, 12);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(620, 222); ctx.lineTo(606, 244); ctx.lineTo(644, 224);
        ctx.closePath(); ctx.fill();
        Draw.text(ctx, 'YO!', 644, 196, 30, '#fff');
      }
    }

    // 等幅声波条（随音乐跳动；搓碟时拉平）
    for (let i = 0; i < 30; i++) {
      const wx = 18 + i * 32;
      const h = scratching ? 3
        : 4 + 26 * Math.abs(Math.sin(beatAnim * Math.PI * 2 + i * 0.9)) *
          (0.4 + 0.6 * Math.abs(Math.sin(i * 1.7 + beatAnim * Math.PI)));
      ctx.fillStyle = scratching ? '#4a4a58' : 'hsl(' + (i * 12) + ',80%,60%)';
      ctx.fillRect(wx, 520 - h, 20, h);
    }

    // 教学提示（开头）
    if (beat >= 0 && beat < 4) {
      Draw.text(ctx, '按住 = 搓碟（音乐停！），听「YO!」松开！', 480, 128, 26, '#fff');
    }
  }
};

/* ---------- 注册第五批关卡 ---------- */
Levels.push(LevelMahou, LevelShowtime, LevelRatRace, LevelDJ);

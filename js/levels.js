/* levels.js — 三个节奏天国风格关卡：谱面数据、音乐排程、玩法与绘制
 *
 * 关卡接口（由 game.js 驱动）：
 *   id / name / desc / bpm / totalBeats
 *   buildChart()            返回音符数组 [{ beat, ... }]，beat 为目标拍（浮点，0.5 网格）
 *   init(game)              关卡状态初始化
 *   scheduleStep(step, t, game)  每半拍被调度器调用一次，t 为该半拍的 ctx 绝对时间
 *   draw(game, ctx)         每帧渲染
 *   onJudge(game, note, res)  res: 'perfect' | 'good' | 'miss'
 *   onWhiff(game)           玩家按空（附近没有可判定音符）
 */
'use strict';

/* ---------- 共用绘制小助手 ---------- */
const Draw = {
  // 圆滚滚卡通角色（可选四肢与配饰）
  // mood: 'idle' | 'happy' | 'sad'
  // o: { rotate, squash, legs, legPhase(-1|0|1 迈步), armL/armR(弧度, 0=水平, 负=上举),
  //      headband: 颜色, cap: 颜色, beak: 颜色 }
  blob(ctx, x, y, r, color, mood, o) {
    o = o || {};
    ctx.save();
    ctx.translate(x, y);
    if (o.rotate) ctx.rotate(o.rotate);
    const sq = o.squash || 0;
    ctx.scale(1 + sq * 0.5, 1 - sq);

    // 腿
    if (o.legs) {
      const lp = o.legPhase || 0;
      ctx.strokeStyle = color;
      ctx.lineWidth = r * 0.24;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-r * 0.32, r * 0.72);
      ctx.lineTo(-r * 0.32 - lp * r * 0.42, r * 1.42);
      ctx.moveTo(r * 0.32, r * 0.72);
      ctx.lineTo(r * 0.32 + lp * r * 0.42, r * 1.42);
      ctx.stroke();
    }

    // 身体
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();

    // 手臂
    const drawArm = (side, ang) => {
      const sx = side * r * 0.78, sy = r * 0.05;
      const ex = sx + side * Math.cos(ang) * r * 0.95;
      const ey = sy + Math.sin(ang) * r * 0.95;
      ctx.strokeStyle = color;
      ctx.lineWidth = r * 0.2;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.beginPath(); ctx.arc(ex, ey, r * 0.16, 0, Math.PI * 2); ctx.fill();
    };
    if (o.armL != null) drawArm(-1, o.armL);
    if (o.armR != null) drawArm(1, o.armR);

    // 脸
    ctx.fillStyle = '#26232e';
    if (mood === 'sad') {
      ctx.fillRect(-r * 0.48, -r * 0.28, r * 0.34, r * 0.09);
      ctx.fillRect(r * 0.14, -r * 0.28, r * 0.34, r * 0.09);
    } else {
      ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.25, r * 0.11, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(r * 0.3, -r * 0.25, r * 0.11, 0, Math.PI * 2); ctx.fill();
    }
    if (o.beak) {
      ctx.fillStyle = o.beak;
      ctx.beginPath();
      ctx.moveTo(r * 0.12, 0);
      ctx.lineTo(r * 0.78, r * 0.16);
      ctx.lineTo(r * 0.12, r * 0.32);
      ctx.closePath(); ctx.fill();
    } else {
      ctx.strokeStyle = '#26232e';
      ctx.lineWidth = Math.max(2, r * 0.07);
      ctx.lineCap = 'round';
      ctx.beginPath();
      if (mood === 'happy') ctx.arc(0, r * 0.02, r * 0.38, 0.15 * Math.PI, 0.85 * Math.PI);
      else if (mood === 'sad') ctx.arc(0, r * 0.62, r * 0.3, 1.15 * Math.PI, 1.85 * Math.PI);
      else { ctx.moveTo(-r * 0.2, r * 0.32); ctx.lineTo(r * 0.2, r * 0.32); }
      ctx.stroke();
    }

    // 配饰
    if (o.headband) {
      ctx.fillStyle = o.headband;
      ctx.fillRect(-r, -r * 0.62, r * 2, r * 0.26);
    }
    if (o.cap) {
      ctx.fillStyle = o.cap;
      ctx.beginPath(); ctx.arc(0, -r * 0.5, r * 0.62, Math.PI, 0); ctx.fill();
      ctx.fillRect(-r * 0.62, -r * 0.6, r * 1.24, r * 0.14);
    }
    ctx.restore();
  },

  // 云朵
  cloud(ctx, x, y, s, color) {
    ctx.fillStyle = color || 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(x, y, 18 * s, 0, Math.PI * 2);
    ctx.arc(x + 22 * s, y - 10 * s, 23 * s, 0, Math.PI * 2);
    ctx.arc(x + 46 * s, y, 16 * s, 0, Math.PI * 2);
    ctx.fill();
  },

  // 半圆山丘（y 为底部）
  hill(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(x, y, w, h, 0, Math.PI, 0); ctx.fill();
  },

  text(ctx, str, x, y, size, color, align) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = 'bold ' + size + 'px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(str, x, y);
    ctx.restore();
  },

  ground(ctx, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(0, y, 960, 540 - y);
  }
};

/* ================================================================
 * 第 1 关 · 飞物击打（致敬「空手道」）
 * 物品从右侧随节拍飞入，到达目标圈的瞬间按键击碎。
 * ============================================================== */
const LevelKarate = {
  id: 'karate',
  name: '第 1 关 · 飞物击打',
  desc: '物品飞到圆圈的一瞬间按【空格】击碎！后半段会出现半拍（八分音符）节奏。',
  bpm: 100,
  totalBeats: 36,

  TX: 230,  // 目标圈 x
  TY: 310,  // 目标圈 y

  buildChart() {
    const beats = [
      4, 5, 6, 7, 8, 9, 10, 11,           // 每拍一个，热身
      13, 13.5, 14, 14.5, 15, 15.5, 16,   // 加入半拍
      18, 19, 20, 21,
      22, 22.5, 23, 24,
      26, 26.5, 27, 27.5, 28, 28.5, 29,
      32                                   // 终结大岩石
    ];
    return beats.map(b => ({ beat: b, big: b === 32 }));
  },

  init(game) {
    game.karate = { punchT: -9, sadT: -9 };
  },

  scheduleStep(step, t, game) {
    const beat = step / 2;
    const spb = Conductor.secPerBeat();
    // 鼓组：动次打次
    if (step % 2 === 0) {
      const b = ((beat % 4) + 4) % 4;
      if (b === 0 || b === 2) AudioEngine.kick(t);
      if (b === 1 || b === 3) AudioEngine.snare(t);
      // 贝斯
      const bass = [110, 110, 130.81, 98][b];
      AudioEngine.tone(t, bass, spb * 0.45, 'triangle', 0.22);
      // 预备拍（前 4 拍滴答）
      if (beat < 4) AudioEngine.blok(t, beat === 3 ? 1320 : 880);
    }
    AudioEngine.hihat(t, false);
    // 物品抛出提示音（目标拍前 2 拍）
    for (const n of game.chart) {
      if ((n.beat - 2) * 2 === step) AudioEngine.sfxCue(t);
    }
  },

  onJudge(game, note, res) {
    const st = Conductor.songTime();
    if (res === 'miss') {
      game.karate.sadT = st;
      note.fallT = st;
    } else {
      game.karate.punchT = st;
      AudioEngine.sfxSmash();
      game.burst(this.TX, this.TY, note.big ? '#ffb347' : '#c98d5e', note.big ? 26 : 14);
    }
  },

  onWhiff(game) {
    game.karate.punchT = Conductor.songTime();
  },

  draw(game, ctx) {
    const st = Conductor.songTime();
    const beat = Conductor.songBeat();
    const k = game.karate;

    // 背景：夕阳道场
    const sky = ctx.createLinearGradient(0, 0, 0, 400);
    sky.addColorStop(0, '#ff9a56');
    sky.addColorStop(1, '#ffd93b');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 960, 400);
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath(); ctx.arc(760, 90, 46, 0, Math.PI * 2); ctx.fill();
    // 漂移的云
    const drift = (st * 14) % 1200;
    Draw.cloud(ctx, 1050 - drift, 60, 1, 'rgba(255,240,200,0.75)');
    Draw.cloud(ctx, 760 - drift, 125, 0.65, 'rgba(255,240,200,0.55)');
    ctx.fillStyle = '#d97b3f';
    ctx.beginPath(); ctx.moveTo(0, 400); ctx.lineTo(200, 240); ctx.lineTo(420, 400); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(560, 400); ctx.lineTo(760, 260); ctx.lineTo(960, 400); ctx.closePath(); ctx.fill();
    Draw.ground(ctx, 400, '#8a5a3b');
    // 草丛
    ctx.fillStyle = '#6d4527';
    ctx.beginPath(); ctx.ellipse(180, 415, 90, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(620, 432, 130, 14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(880, 412, 70, 10, 0, 0, Math.PI * 2); ctx.fill();

    // 目标圈（随节拍脉动）
    const pulse = 1 + 0.08 * Math.max(0, Math.sin(beat * Math.PI));
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 5;
    ctx.setLineDash([10, 8]);
    ctx.beginPath(); ctx.arc(this.TX, this.TY, 46 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();

    // 角色：空手道猫（出拳时右爪前伸）
    const bob = Math.sin(beat * Math.PI) * 6;
    let mood = 'idle';
    if (st - k.sadT < 0.7) mood = 'sad';
    else if (st - k.punchT < 0.3) mood = 'happy';
    const punching = st - k.punchT < 0.22;
    Animals.cat(ctx, 125, 345 + bob, 44, {
      color: '#f5a35c',
      mood,
      headband: '#fff',
      armL: 0.6,
      armR: punching ? -0.15 : 0.6,
      squash: punching ? 0.14 : 0,
      tailUp: punching ? 1 : 0
    });
    // 出拳冲击波
    if (punching) {
      const p = 1 - (st - k.punchT) / 0.22;
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.8 * p).toFixed(3) + ')';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(this.TX - 30, this.TY, 24 + (1 - p) * 30, -0.6, 0.6); ctx.stroke();
    }

    // 飞行物
    for (const n of game.chart) {
      const launch = n.beat - 2;
      if (beat < launch) continue;
      if (n.state === 'hit') continue;
      const r = n.big ? 30 : 18;
      ctx.save();
      if (n.state === 'miss') {
        const ft = st - n.fallT;
        if (ft > 0.8) { ctx.restore(); continue; }
        ctx.globalAlpha = 1 - ft / 0.8;
        ctx.translate(this.TX, this.TY + ft * ft * 700);
        ctx.rotate(ft * 6);
      } else {
        const p = (beat - launch) / 2;
        if (p > 1.35) { ctx.restore(); continue; }
        const x = 920 - (920 - this.TX) * p;
        const y = this.TY - Math.sin(Math.min(p, 1) * Math.PI) * 70;
        ctx.translate(x, y);
        ctx.rotate(beat * 3);
      }
      // 陶罐 / 岩石
      ctx.fillStyle = n.big ? '#8d8d99' : '#b5651d';
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = n.big ? '#6d6d79' : '#8a4a12';
      ctx.fillRect(-r, -r * 0.25, r * 2, r * 0.5);
      ctx.restore();
    }

    // 教学提示（开头）
    if (beat < 4 && beat >= 0) {
      Draw.text(ctx, '物品到圆圈时按空格！', 480, 120, 30, 'rgba(255,255,255,0.95)');
    }
  }
};

/* ================================================================
 * 第 2 关 · 节奏模仿（Call & Response）
 * 老师先演奏一段节奏型（灯亮+木鱼声），随后玩家原样复现。
 * ============================================================== */
const LevelEcho = {
  id: 'echo',
  name: '第 2 关 · 节奏模仿',
  desc: '先听老师演奏一段节奏，灯亮结束后【原样】敲出来！注意休止符。',
  bpm: 92,
  totalBeats: 4 + 4 * 16 + 2,

  patterns: [
    [0, 1, 2, 3],
    [0, 1.5, 2, 3.5],
    [0, 0.5, 1, 2, 3, 3.5],
    [0, 1, 1.5, 2.5, 4, 5.5, 6]
  ],
  scale: [523.25, 587.33, 659.25, 783.99, 880],

  roundStart(r) { return 4 + r * 16; },

  // 返回 { round, phase: 'demo'|'play', local } 或 null
  phaseOf(beat) {
    if (beat < 4) return null;
    const r = Math.floor((beat - 4) / 16);
    if (r > 3) return null;
    const local16 = (beat - 4) % 16;
    return { round: r, phase: local16 < 8 ? 'demo' : 'play', local: local16 % 8 };
  },

  buildChart() {
    const notes = [];
    for (let r = 0; r < 4; r++) {
      const pat = this.patterns[r];
      for (let i = 0; i < pat.length; i++) {
        notes.push({ beat: this.roundStart(r) + 8 + pat[i], round: r, idx: i });
      }
    }
    return notes;
  },

  init(game) {
    game.echo = { sadT: -9, happyT: -9, hitFlash: {} };
  },

  scheduleStep(step, t, game) {
    const beat = step / 2;
    const spb = Conductor.secPerBeat();
    if (step % 2 === 0) {
      const b = ((beat % 4) + 4) % 4;
      if (b === 0) AudioEngine.kick(t);
      if (b === 2) AudioEngine.snare(t);
      AudioEngine.tone(t, [87.31, 87.31, 98, 110][b], spb * 0.4, 'triangle', 0.16);
      if (beat < 4) AudioEngine.blok(t, beat === 3 ? 1320 : 880);
    }
    AudioEngine.hihat(t, false);
    // 示范段：演奏节奏型
    const info = this.phaseOf(beat);
    if (info && info.phase === 'demo') {
      const pat = this.patterns[info.round];
      for (let i = 0; i < pat.length; i++) {
        if (this.roundStart(info.round) + pat[i] === beat) {
          AudioEngine.blok(t, this.scale[i % this.scale.length]);
        }
      }
    }
  },

  onJudge(game, note, res) {
    const st = Conductor.songTime();
    if (res === 'miss') {
      game.echo.sadT = st;
    } else {
      game.echo.happyT = st;
      game.echo.hitFlash[note.beat] = st;
      // 玩家敲出对应的音高，形成「演奏」感
      AudioEngine.blok(AudioEngine.now(), this.scale[note.idx % this.scale.length]);
      game.burst(480, 430, '#8be9fd', 8);
    }
  },

  onWhiff(game) {
    game.echo.sadT = Conductor.songTime();
  },

  draw(game, ctx) {
    const st = Conductor.songTime();
    const beat = Conductor.songBeat();
    const e = game.echo;
    const info = this.phaseOf(beat);

    // 背景：紫色舞台
    const bg = ctx.createLinearGradient(0, 0, 0, 540);
    bg.addColorStop(0, '#3b2d5c');
    bg.addColorStop(1, '#241d3d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 960, 540);
    // 扫动的聚光灯
    const sweep = Math.sin(st * 0.6) * 0.25;
    for (const dir of [-1, 1]) {
      ctx.save();
      ctx.translate(480 + dir * 300, -10);
      ctx.rotate(dir * (0.35 + sweep));
      const lg = ctx.createLinearGradient(0, 0, 0, 480);
      lg.addColorStop(0, 'rgba(255,240,180,0.16)');
      lg.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(-90, 480); ctx.lineTo(90, 480);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath(); ctx.ellipse(480, 200, 320, 150, 0, 0, Math.PI * 2); ctx.fill();
    Draw.ground(ctx, 470, '#191430');
    // 幕布
    ctx.fillStyle = '#7a1f2b';
    ctx.fillRect(0, 0, 960, 24);
    for (let i = 0; i < 12; i++) {
      ctx.beginPath(); ctx.arc(i * 87 + 24, 24, 26, 0, Math.PI); ctx.fill();
    }
    ctx.fillRect(0, 0, 40, 150);
    ctx.fillRect(920, 0, 40, 150);
    // 观众席剪影（随节拍摇晃）
    for (let i = 0; i < 10; i++) {
      const ab = Math.sin(beat * Math.PI + i) * 3;
      ctx.fillStyle = '#0f0c1c';
      ctx.beginPath(); ctx.arc(i * 104 + 34, 522 + ab, 26, 0, Math.PI * 2); ctx.fill();
    }

    // 当前轮次的示范是否正在发声（老师闪光用）
    let teacherActive = false;
    if (info && info.phase === 'demo') {
      const pat = this.patterns[info.round];
      for (const p of pat) {
        const db = this.roundStart(info.round) + p;
        if (beat >= db && beat - db < 0.22) teacherActive = true;
      }
    }

    // 羊驼老师（上，示范时脖子伸长）与羊驼学生（下）
    const tbob = Math.sin(beat * Math.PI) * 4;
    Animals.alpaca(ctx, 480, 165 + tbob, 44, {
      color: teacherActive ? '#ffe9b3' : '#f0e6d2',
      mood: teacherActive ? 'happy' : 'idle',
      cap: '#4a3d80',
      stretch: teacherActive ? 0.6 : 0
    });
    Draw.text(ctx, '老师', 590, 165, 20, '#b9b3d8');

    let mood = 'idle';
    if (st - e.sadT < 0.6) mood = 'sad';
    else if (st - e.happyT < 0.35) mood = 'happy';
    const pbo = Math.sin(beat * Math.PI + 1) * 4;
    Animals.alpaca(ctx, 480, 425 + pbo, 38, {
      color: '#dce8f5',
      mood,
      stretch: mood === 'happy' ? 0.35 : 0
    });
    Draw.text(ctx, '你', 580, 425, 20, '#b9b3d8');

    // 阶段文字
    if (!info) {
      if (beat >= 0 && beat < 4) Draw.text(ctx, '预备…', 480, 250, 34, '#fff');
    } else {
      Draw.text(ctx, '第 ' + (info.round + 1) + ' / 4 轮', 120, 50, 22, '#8f8ab0', 'left');
      if (info.phase === 'demo') {
        Draw.text(ctx, '仔细听…', 480, 250, 34, '#ffd94d');
      } else {
        Draw.text(ctx, '轮到你了！', 480, 250, 34, '#7de38b');
      }
    }

    // 节奏时间轴：8 拍槽位 + 节奏型标记
    const x0 = 230, x1 = 730, y = 320;
    const px = b => x0 + (b / 8) * (x1 - x0);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
    for (let i = 0; i <= 8; i++) {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(px(i) - 1, y - 6, 2, 12);
    }
    // 播放头
    if (info) {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(px(info.local), y, 7, 0, Math.PI * 2); ctx.fill();
    }
    if (info) {
      const pat = this.patterns[info.round];
      for (let i = 0; i < pat.length; i++) {
        const mx = px(pat[i]);
        let color = 'rgba(255,255,255,0.35)';
        let r = 10;
        if (info.phase === 'demo') {
          const db = this.roundStart(info.round) + pat[i];
          if (beat >= db && beat - db < 0.25) { color = '#ffd94d'; r = 14; }
          else if (beat >= db) color = 'rgba(255,217,77,0.5)';
        } else {
          const nb = this.roundStart(info.round) + 8 + pat[i];
          const note = game.chart.find(n => n.beat === nb);
          if (note && note.state === 'hit') { color = '#7de38b'; r = 13; }
          else if (note && note.state === 'miss') { color = '#e85d5d'; }
        }
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(mx, y, r, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
};

/* ================================================================
 * 第 3 关 · 节奏乒乓（致敬「Rhythm Rally」）
 * 球落到己方球拍时按键回击；间隔 1 拍的是快速球（红色）。
 * ============================================================== */
const LevelPong = {
  id: 'pong',
  name: '第 3 关 · 节奏乒乓',
  desc: '球飞到右手边时按【空格】打回去！红色的快速球间隔只有半拍，小心！',
  bpm: 124,
  totalBeats: 62,

  PX: 800,  // 玩家球拍 x
  CX: 160,  // 电脑球拍 x
  BY: 330,  // 球路基准 y

  playerBeats: [
    4, 6, 8, 10,
    12, 13, 14, 15,        // 快速
    17, 19, 21,
    23, 24, 25, 26,        // 快速
    28, 30, 32, 34,
    36, 36.5, 37, 37.5,    // 超快速
    39, 41, 43,
    44, 45, 46, 47,        // 快速
    49, 50.5, 52, 53.5,    // 中速
    55, 56, 57, 58
  ],

  buildChart() {
    return this.playerBeats.map(b => ({ beat: b }));
  },

  // 球路事件：电脑发球(beat 2) → 玩家/电脑交替
  buildEvents() {
    const ev = [{ beat: 2, side: 'cpu' }];
    const pb = this.playerBeats;
    for (let i = 0; i < pb.length; i++) {
      ev.push({ beat: pb[i], side: 'player', idx: i });
      if (i + 1 < pb.length) ev.push({ beat: (pb[i] + pb[i + 1]) / 2, side: 'cpu' });
    }
    return ev;
  },

  init(game) {
    game.pong = { events: this.buildEvents(), swingT: -9, cpuSwingT: -9, sadT: -9 };
  },

  scheduleStep(step, t, game) {
    const beat = step / 2;
    const spb = Conductor.secPerBeat();
    if (step % 2 === 0) {
      const b = ((beat % 4) + 4) % 4;
      AudioEngine.kick(t);
      if (b === 1 || b === 3) AudioEngine.snare(t);
      AudioEngine.tone(t, [82.41, 82.41, 98, 110][b], spb * 0.4, 'sawtooth', 0.12);
      if (beat < 4) AudioEngine.blok(t, beat === 3 ? 1320 : 880);
    } else {
      AudioEngine.hihat(t, true); // 反拍开镲
    }
    // 电脑击球声（玩家侧是否击中由玩家自己决定，不预排）
    for (const ev of game.pong.events) {
      if (ev.side === 'cpu' && ev.beat === beat) AudioEngine.pon(t, 880);
    }
  },

  onJudge(game, note, res) {
    const st = Conductor.songTime();
    if (res === 'miss') {
      game.pong.sadT = st;
    } else {
      game.pong.swingT = st;
      // 快速回球音调更高
      const i = this.playerBeats.indexOf(note.beat);
      const gap = i + 1 < this.playerBeats.length ? this.playerBeats[i + 1] - note.beat : 2;
      AudioEngine.pon(AudioEngine.now(), gap <= 1 ? 1400 : 1150);
      game.burst(this.PX - 52, this.BY, '#c4f56b', 10);
    }
  },

  onWhiff(game) {
    game.pong.swingT = Conductor.songTime();
  },

  draw(game, ctx) {
    const st = Conductor.songTime();
    const beat = Conductor.songBeat();
    const p = game.pong;

    // 背景：球馆
    const bg = ctx.createLinearGradient(0, 0, 0, 540);
    bg.addColorStop(0, '#1f6f6b');
    bg.addColorStop(1, '#134542');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 960, 540);
    Draw.ground(ctx, 420, '#0f3735');
    // 观众席剪影
    for (let i = 0; i < 9; i++) {
      const ab = Math.sin(beat * Math.PI + i * 1.7) * 3;
      ctx.fillStyle = '#0a2926';
      ctx.beginPath(); ctx.arc(i * 116 + 40, 60 + ab, 24, 0, Math.PI * 2); ctx.fill();
    }
    // 球台
    ctx.fillStyle = '#1565c0';
    ctx.fillRect(180, 368, 600, 16);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(180, 368, 600, 3);
    ctx.fillStyle = '#0d47a1';
    ctx.fillRect(230, 384, 14, 38);
    ctx.fillRect(716, 384, 14, 38);
    // 球网
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 4;
    ctx.setLineDash([8, 8]);
    ctx.beginPath(); ctx.moveTo(480, 180); ctx.lineTo(480, 368); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#c62828';
    ctx.fillRect(476, 360, 8, 10);

    // 电脑挥拍动画（全部用拍位置比较，避免混用时钟）
    for (const ev of p.events) {
      if (ev.side === 'cpu' && beat >= ev.beat && beat - ev.beat < 0.36) {
        p.cpuSwingT = st;
      }
    }

    // 小狗球手：狗在后、球拍在前，挥拍时球拍前伸
    const drawPlayer = (x, swing, color, mood) => {
      const dir = x === this.PX ? -1 : 1;
      const reach = swing ? 30 : 0;
      const px = x + dir * (52 + reach);
      // 球拍
      ctx.save();
      ctx.translate(px, this.BY - 6);
      ctx.rotate(dir * (swing ? -0.3 : 0.08));
      ctx.fillStyle = '#8d6e63';
      ctx.fillRect(-5, 8, 10, 28);
      ctx.fillStyle = '#e85d5d';
      ctx.beginPath(); ctx.arc(0, -10, 22, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
      // 小狗（面向球台，尾巴一直摇）
      ctx.save();
      ctx.translate(x, this.BY + 16);
      if (dir === -1) ctx.scale(-1, 1);
      Animals.dog(ctx, 0, 0, 30, {
        color,
        mood,
        squash: swing ? 0.12 : 0,
        tailWag: Math.sin(st * 6) * 0.5 + 0.5
      });
      ctx.restore();
    };

    const cpuMood = 'idle';
    const playerMood = (st - p.sadT < 0.7) ? 'sad' : 'idle';
    drawPlayer(this.CX, st - p.cpuSwingT < 0.18, '#c98d5e', cpuMood);
    drawPlayer(this.PX, st - p.swingT < 0.18, '#f5a35c', playerMood);

    // 球：找到当前所处的球路段
    const evs = p.events;
    let bi = -1;
    for (let i = 0; i < evs.length - 1; i++) {
      if (beat >= evs[i].beat && beat < evs[i + 1].beat) { bi = i; break; }
    }
    if (bi >= 0) {
      const a = evs[bi], b = evs[bi + 1];
      const seg = b.beat - a.beat;
      const t = Math.min(1.2, (beat - a.beat) / seg);
      const xa = a.side === 'player' ? this.PX - 52 : this.CX + 52;
      const xb = b.side === 'player' ? this.PX - 52 : this.CX + 52;
      const x = xa + (xb - xa) * t;
      const fast = seg <= 0.55;
      const arcH = fast ? 60 : 150;
      const y = this.BY - Math.sin(Math.min(t, 1) * Math.PI) * arcH;
      // 残影
      ctx.fillStyle = fast ? 'rgba(255,90,90,0.25)' : 'rgba(255,255,255,0.2)';
      for (let k = 1; k <= 3; k++) {
        const tt = Math.max(0, t - k * 0.06);
        const gx = xa + (xb - xa) * tt;
        const gy = this.BY - Math.sin(tt * Math.PI) * arcH;
        ctx.beginPath(); ctx.arc(gx, gy, 12 - k * 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = fast ? '#ff5a5a' : '#ffffff';
      ctx.beginPath(); ctx.arc(x, y, 13, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (beat < 2) {
      // 开局前球停在电脑旁
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(this.CX + 44, this.BY - 20, 13, 0, Math.PI * 2); ctx.fill();
      if (beat >= 0) Draw.text(ctx, '预备…', 480, 120, 30, 'rgba(255,255,255,0.9)');
    }
  }
};

const Levels = [LevelKarate, LevelEcho, LevelPong];

/* levels2.js — 第二批关卡：致敬节奏天国的另外三种经典玩法
 *   第 4 关 · 齐步走（Lockstep）：正拍 / 反拍踏步切换
 *   第 5 关 · 灌油机器人（Fillbots）：长按 + 松开判定
 *   第 6 关 · 蓝鸟合唱团（Blue Birds）：双键玩法（啄米 / 昂首）
 * 关卡接口与 levels.js 相同；长按音符额外实现 onPress / onRelease。
 */
'use strict';

/* ================================================================
 * 第 4 关 · 齐步走
 * 跟着队伍踏步：正拍段每拍一步，反拍段踩后半拍；段首前 1 拍有口令提示。
 * ============================================================== */
const LevelMarch = {
  id: 'march',
  name: '第 4 关 · 齐步走',
  desc: '全队踩什么你就踩什么！休息时仔细听全队演示：低「咚」=接下来踩正拍，高「哒」=接下来踩反拍（曲风也会变！）。',
  hint: '空格 / 点击 = 跟着脚步声踏步 · Esc = 退出',
  bpm: 112,
  totalBeats: 62,

  // 跟踩段：[起始拍, 结束拍, 模式]，段间有 4 拍休息+演示
  blocks: [
    [4, 12, 'on'],
    [16, 24, 'off'],
    [28, 36, 'on'],
    [40, 48, 'off'],
    [52, 60, 'on']
  ],
  // 休息演示段：[起始拍, 演示的模式]（各 4 拍，玩家休息，全队演示下一段节奏）
  gaps: [
    [12, 'off'], [24, 'on'], [36, 'off'], [48, 'on']
  ],

  buildChart() {
    const beats = [];
    for (const [s, e, mode] of this.blocks) {
      for (let b = s; b < e; b++) beats.push(mode === 'on' ? b : b + 0.5);
    }
    return beats.map(b => ({ beat: b }));
  },

  modeAt(beat) {
    for (const [s, e, mode] of this.blocks) {
      if (beat >= s && beat < e) return mode;
    }
    return null;
  },

  gapAt(beat) {
    for (const [s, mode] of this.gaps) {
      if (beat >= s && beat < s + 4) return { start: s, mode };
    }
    return null;
  },

  init(game) {
    game.march = { stumbleT: -9, stepT: -9 };
  },

  scheduleStep(step, t, game) {
    const beat = step / 2;
    const spb = Conductor.secPerBeat();
    const mode = this.modeAt(beat);
    const gap = this.gapAt(beat);
    // 当前听觉风格：跟踩段用本段风格，休息段直接预演下一段风格
    const style = mode || (gap ? gap.mode : null);
    const b = ((beat % 4) + 4) % 4;

    // —— 节奏组 ——
    if (step % 2 === 0) {
      if (style === 'off') {
        // 放克风：切分大鼓 + 锯齿贝斯（一听就知道要反拍）
        if (b === 0) AudioEngine.kick(t);
        if (b === 2) AudioEngine.snare(t);
        AudioEngine.tone(t, [82.41, 82.41, 98, 110][b], spb * 0.28, 'sawtooth', 0.16);
      } else {
        // 进行曲风：方正的四四拍
        if (b === 0 || b === 2) AudioEngine.kick(t);
        if (b === 1 || b === 3) AudioEngine.snare(t);
        AudioEngine.tone(t, [98, 87.31, 98, 110][b], spb * 0.4, 'triangle', 0.15);
      }
      if (beat < 4) AudioEngine.blok(t, beat === 3 ? 1320 : 880);
    } else if (style === 'off') {
      // 反拍开镲 + 2.5 拍切分大鼓，强化「and」的律动感
      AudioEngine.hihat(t, true);
      if (b === 2.5) AudioEngine.kick(t);
    }

    // —— 背景旋律（跟随当前风格） ——
    if (beat >= 4) {
      if (style === 'on' && step % 2 === 0) {
        // 进行曲旋律：C 大调五声音阶，两小节一循环
        const mel = [523.25, 587.33, 659.25, 783.99, 659.25, 587.33, 523.25, 392];
        AudioEngine.tone(t, mel[Math.floor(beat) % 8], spb * 0.32, 'square', 0.07);
      } else if (style === 'off') {
        if (step % 2 === 1) {
          // 放克短刺：每个半拍一个短音，两小节交替音高
          AudioEngine.tone(t, Math.floor(beat / 2) % 2 === 0 ? 392 : 440, 0.09, 'square', 0.08);
        } else if (b === 2) {
          // 每小节第 3 拍小过门
          AudioEngine.tone(t, 659.25, spb * 0.25, 'square', 0.07);
          AudioEngine.tone(t + spb * 0.5, 523.25, spb * 0.25, 'square', 0.07);
        }
      }
    }

    // —— 段落边界信号 ——
    for (const [gs, gmode] of this.gaps) {
      // 休息开始：哨声「停！」
      if (beat === gs) AudioEngine.whistle(t);
      // 休息段内：全队演示下一段节奏
      if (beat > gs && beat < gs + 3) {
        if (gmode === 'off' && beat % 1 === 0.5) AudioEngine.blok(t, 880);
        if (gmode === 'on' && step % 2 === 0) AudioEngine.blok(t, 587);
      }
      // 预备口令：休息段最后 1 拍「哒-哒」
      if (beat === gs + 3) {
        AudioEngine.blok(t, 660);
        AudioEngine.blok(t + spb * 0.5, 660);
      }
    }
    // 跟踩段开始：重音「起！」
    for (const [bs] of this.blocks) {
      if (beat === bs && bs > 4) {
        AudioEngine.kick(t);
        AudioEngine.snare(t);
        AudioEngine.hihat(t, true);
      }
    }

    // 跟踩段：全队脚步声（跟着踩！）
    for (const n of game.chart) {
      if (n.beat === beat) {
        AudioEngine.blok(t, this.modeAt(n.beat) === 'off' ? 880 : 587);
      }
    }
  },

  onJudge(game, note, res) {
    const st = Conductor.songTime();
    if (res === 'miss') {
      game.march.stumbleT = st;
      game.burst(450, 400, '#9a94b8', 6);
    } else {
      game.march.stepT = st;
      // 玩家自己的脚步声：比全队亮一度，踩对融入、踩错突兀
      AudioEngine.blok(AudioEngine.now(), this.modeAt(note.beat) === 'off' ? 988 : 660);
      game.burst(450, 400, '#cbb26a', 5);
    }
  },

  onWhiff(game) {
    game.march.stumbleT = Conductor.songTime();
  },

  draw(game, ctx) {
    const st = Conductor.songTime();
    const beat = Conductor.songBeat();
    const m = game.march;
    const mode = this.modeAt(beat);
    const gap = this.gapAt(beat);
    const shown = gap ? gap.mode : mode; // 休息段指示牌预告下一段

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

    // 指示牌（右上角）：● 正拍 / ◐ 反拍，休息段闪烁预告下一段
    ctx.fillStyle = '#8d6e63';
    ctx.fillRect(856, 116, 8, 60);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = gap && Math.floor(st * 6) % 2 === 0 ? '#e85d5d' : '#26232e';
    ctx.lineWidth = gap ? 5 : 3;
    ctx.fillRect(800, 60, 120, 56);
    ctx.strokeRect(800, 60, 120, 56);
    const cx = 826, cy = 88;
    ctx.fillStyle = '#26232e';
    ctx.beginPath(); ctx.arc(cx, cy, 13, 0, Math.PI * 2); ctx.fill();
    if (shown === 'off') { // ◐：擦掉右半
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(cx, cy, 13, -Math.PI / 2, Math.PI / 2); ctx.fill();
      ctx.strokeStyle = '#26232e';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(cx, cy, 13, 0, Math.PI * 2); ctx.stroke();
    }
    Draw.text(ctx, (gap ? '→' : '') + (shown === 'off' ? '反拍' : '正拍'), 872, 88, 24, '#26232e');

    // 休息段公告 + 悬浮音符演示（♪ 亮起的顺序就是下一段的节奏）
    if (gap) {
      const demoBeats = [];
      if (gap.mode === 'off') for (const off of [0.5, 1.5, 2.5]) demoBeats.push(gap.start + off);
      else for (const off of [1, 2]) demoBeats.push(gap.start + off);
      const remain = gap.start + 4 - beat;
      if (remain <= 1) {
        Draw.text(ctx, '预备…', 480, 190, 40, '#e85d5d');
      } else {
        Draw.text(ctx, '休息！听：接下来是【' + (gap.mode === 'off' ? '反拍' : '正拍') + '】',
          480, 190, 40, gap.mode === 'off' ? '#8e24aa' : '#1565c0');
      }
      const litColor = gap.mode === 'off' ? '#8e24aa' : '#1565c0';
      for (let i = 0; i < demoBeats.length; i++) {
        const lit = beat >= demoBeats[i];
        const px = 480 - (demoBeats.length - 1) * 50 + i * 100;
        Draw.text(ctx, '♪', px, 255, 46, lit ? litColor : 'rgba(255,255,255,0.45)');
      }
    } else if (mode) {
      // 跟踩段开头：「开始！」
      for (const [bs] of this.blocks) {
        if (bs > 4 && beat >= bs && beat < bs + 1) {
          Draw.text(ctx, '开始！', 480, 190, 44, '#e85d5d');
        }
      }
    }

    // 全队踩踏时刻表（只含跟踩段：休息时全队立正休息）
    const squadSteps = [];
    for (const n of game.chart) squadSteps.push(n.beat);

    // 队伍：5 只兔子，灰色是队友（总是跳对），橙色是你
    for (let i = 0; i < 5; i++) {
      const x = 230 + i * 110;
      const isPlayer = i === 2;
      let yOff = 0, flop = 0, squash = 0;
      if (!isPlayer) {
        // 队友跟着节奏跳（跟踩段+休息演示段都跳，做示范）
        for (const nb of squadSteps) {
          const p = (beat - (nb - 0.12)) / 0.45;
          if (p >= 0 && p <= 1) {
            yOff = -Math.sin(p * Math.PI) * 26;
            flop = Math.sin(p * Math.PI);
            if (p > 0.85) squash = (p - 0.85) * 1.5;
            break;
          }
        }
      } else if (!gap) {
        const hp = (st - m.stepT) / 0.3;
        if (hp >= 0 && hp <= 1) {
          yOff = -Math.sin(hp * Math.PI) * 26;
          flop = Math.sin(hp * Math.PI);
        }
      }
      let mood = 'idle', rotate = 0;
      if (isPlayer) {
        if (st - m.stumbleT < 0.5) { mood = 'sad'; rotate = Math.sin(st * 28) * 0.15; }
        else if (st - m.stepT < 0.3) mood = 'happy';
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

    if (beat >= 0 && beat < 4) {
      Draw.text(ctx, '跟着全队踩：低「咚」=正拍，高「哒」=反拍！', 480, 120, 27, '#fff');
    }
  }
};

/* ================================================================
 * 第 5 关 · 灌油机器人
 * 机器人走到加油位 → 按住灌油 → 油量满时松开。按下与松开各判一次。
 * ============================================================== */
const LevelFill = {
  id: 'fill',
  name: '第 5 关 · 灌油机器人',
  desc: '机器人走到加油位时【按住】空格灌油，油量灯满时【松开】！小机器人 1 拍，大机器人要按更久。',
  hint: '按住空格 = 灌油，灯满时松开 · Esc = 退出',
  bpm: 96,
  totalBeats: 48,

  SX: 480, // 加油位 x

  // [到位拍, 灌油时长(拍)]
  specs: [
    [4, 1], [7, 1], [10, 2], [14, 1], [17, 2], [21, 3],
    [26, 2], [29, 1], [32, 2], [36, 3], [41, 2], [44, 1]
  ],

  buildChart() {
    return this.specs.map(([b, d]) => ({ beat: b, dur: d }));
  },

  init(game) {
    game.fill = {};
  },

  scheduleStep(step, t, game) {
    const beat = step / 2;
    const spb = Conductor.secPerBeat();
    if (step % 2 === 0) {
      const b = ((beat % 4) + 4) % 4;
      if (b === 0 || b === 2) AudioEngine.kick(t);
      if (b === 1 || b === 3) AudioEngine.snare(t);
      AudioEngine.tone(t, [73.42, 73.42, 82.41, 65.41][b], spb * 0.5, 'sawtooth', 0.11);
      if (beat < 4) AudioEngine.blok(t, beat === 3 ? 1320 : 880);
    } else {
      AudioEngine.hihat(t, false);
    }
    for (const n of game.chart) {
      if (n.beat === beat) AudioEngine.blok(t, 1568);        // 到位"叮"
      if (n.beat + n.dur === beat) AudioEngine.blok(t, 2093); // 灌满提示音
    }
  },

  onPress(game, note, res) {
    note.pressT = Conductor.songTime();
    AudioEngine.fillStart();
  },

  onRelease(game, note, res) {
    const st = Conductor.songTime();
    note.doneT = st;
    note.fillShown = note.pressT != null
      ? Math.min(1.2, (st - note.pressT) / (note.dur * Conductor.secPerBeat()))
      : 0;
    AudioEngine.fillStop();
    if (res === 'miss' || res === 'over') {
      note.outcome = 'spill';
      game.burst(this.SX, 320, '#3a3a44', 16);
    } else {
      note.outcome = 'ok';
      game.burst(this.SX, 320, '#7de38b', 14);
    }
  },

  onJudge(game, note, res) {
    if (res === 'miss') { // 压根没按：机器人空着油箱离开
      note.doneT = Conductor.songTime();
      note.fillShown = 0;
      note.outcome = 'empty';
    }
  },

  onWhiff(game) {},

  // 画一个机器人（fill: 0~1.2 油量比例）
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

  draw(game, ctx) {
    const st = Conductor.songTime();
    const beat = Conductor.songBeat();
    const spb = Conductor.secPerBeat();

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
    // 齿轮
    this.gear(ctx, 120, 260, 40, st * 0.8, '#4c4c5a');
    this.gear(ctx, 850, 200, 52, -st * 0.6, '#454552');
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
    ctx.fillRect(this.SX - 12, 0, 24, 210);
    ctx.fillStyle = '#7c8da3';
    ctx.beginPath();
    ctx.moveTo(this.SX - 22, 210);
    ctx.lineTo(this.SX + 22, 210);
    ctx.lineTo(this.SX + 8, 248);
    ctx.lineTo(this.SX - 8, 248);
    ctx.closePath(); ctx.fill();

    // 是否有机器人在灌油：画油流
    const holding = game.chart.find(n => n.state === 'holding');
    if (holding) {
      ctx.fillStyle = '#ffd94d';
      const oy = 248 + ((st * 300) % 12);
      ctx.fillRect(this.SX - 5, 248, 10, 120 - (oy - 248));
      ctx.fillStyle = 'rgba(255,217,77,0.5)';
      ctx.fillRect(this.SX - 9, 250, 18, 116);
    }

    if (beat >= 0 && beat < 4) Draw.text(ctx, '按住灌油，灯满松开！', 480, 130, 30, '#fff');

    // 机器人队列
    for (const n of game.chart) {
      const walkIn = 4; // 提前 4 拍入场
      let x, mood = 'idle', fill = 0, shake = false;
      if (n.state === 'pending') {
        if (beat < n.beat - walkIn) continue;
        const p = Math.min(1, (beat - (n.beat - walkIn)) / walkIn);
        x = 1060 - (1060 - this.SX) * p;
      } else if (n.state === 'holding') {
        x = this.SX;
        fill = Math.min(1.2, (st - n.pressT) / (n.dur * spb));
        if (fill >= 1.05) shake = true;
      } else {
        // 已了结：向左离场
        const q = (st - (n.doneT || st)) * 2.2;
        if (q > 4) continue;
        x = this.SX - q * 220;
        fill = n.fillShown || 0;
        mood = n.outcome === 'ok' ? 'happy' : 'sad';
        if (n.outcome === 'spill') shake = q < 0.8;
      }
      const bobW = (n.state === 'pending' && beat < n.beat) ? Math.abs(Math.sin(beat * Math.PI * 2)) * 4 : 0;
      this.drawRobot(ctx, x, 388 - bobW, n.dur, fill, mood, shake);
    }
  },

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
    ctx.fillStyle = '#23232c';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.34, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
};

/* ================================================================
 * 第 6 关 · 蓝鸟合唱团（忠实原作机制）
 * 队长把指令唱出来：「突！突！突！」= 点按啄米 3 下（固定节奏型），
 * 「昂——」= 按住蓄力再松开昂首。回应都在指令后 2 拍开始。
 * ============================================================== */
const LevelBirds = {
  id: 'birds',
  name: '第 6 关 · 蓝鸟合唱团',
  desc: '听队长唱歌做动作：唱「突突突」=【点按空格】啄米 3 下，唱「昂——」=【按住空格再松开】昂首！',
  hint: '点按空格 = 啄米 ×3 · 按住再松开 = 昂首 · Esc = 退出',
  bpm: 118,
  totalBeats: 56,

  // [指令拍, 类型]  指令占 1 拍，回应在指令后 2 拍开始
  commands: [
    [4, 'peck'], [8, 'stretch'], [12, 'peck'], [16, 'peck'], [20, 'stretch'],
    [26, 'peck'], [30, 'stretch'], [34, 'peck'], [38, 'peck'], [42, 'stretch'],
    [46, 'peck'], [50, 'stretch']
  ],

  buildChart() {
    const notes = [];
    for (const [c, kind] of this.commands) {
      if (kind === 'peck') {
        // 啄米固定节奏型：三连啄（半拍一下）
        notes.push({ beat: c + 2, kind });
        notes.push({ beat: c + 2.5, kind });
        notes.push({ beat: c + 3, kind });
      } else {
        // 昂首：按住蓄力 1 拍再松开
        notes.push({ beat: c + 2, dur: 1, kind });
      }
    }
    return notes;
  },

  init(game) {
    game.birds = { peckT: -9, stretchT: -9, holdT: -9, confusedT: -9 };
  },

  scheduleStep(step, t, game) {
    const beat = step / 2;
    const spb = Conductor.secPerBeat();
    // 轻快伴奏
    if (step % 2 === 0) {
      const b = ((beat % 4) + 4) % 4;
      if (b === 0) AudioEngine.kick(t);
      if (b === 2) AudioEngine.snare(t);
      AudioEngine.tone(t, [523.25, 659.25, 783.99, 659.25][b], spb * 0.25, 'square', 0.06);
      if (beat < 4) AudioEngine.blok(t, beat === 3 ? 1320 : 880);
    } else {
      AudioEngine.hihat(t, false);
    }
    for (const [c, kind] of this.commands) {
      if (kind === 'peck') {
        // 队长唱「突！突！突！」
        if (beat === c) { AudioEngine.blok(t, 587); AudioEngine.blok(t + spb * 0.5, 587); }
        if (beat === c + 1) AudioEngine.blok(t, 784);
        // 同伴的啄米声（跟着这个节奏啄：半拍一下，共 3 下）
        for (const off of [2, 2.5, 3]) {
          if (beat === c + off) AudioEngine.tone(t, 240, 0.08, 'sine', 0.11);
        }
      } else {
        // 队长唱「昂——」
        if (beat === c) AudioEngine.tone(t, 392, spb * 0.55, 'square', 0.2);
        if (beat === c + 1) AudioEngine.tone(t, 440, spb * 0.6, 'square', 0.2);
        // 同伴的伸展声（在松开时刻响起）
        if (beat === c + 3) AudioEngine.sfxCue(t);
      }
    }
  },

  onJudge(game, note, res) {
    const st = Conductor.songTime();
    if (res === 'miss') {
      game.birds.confusedT = st;
      AudioEngine.tone(AudioEngine.now(), 150, 0.22, 'sawtooth', 0.18); // doink
    } else {
      game.birds.peckT = st;
      AudioEngine.tone(AudioEngine.now(), 240, 0.08, 'sine', 0.3);  // 啄！
      AudioEngine.tone(AudioEngine.now(), 1760, 0.09, 'sine', 0.1); // 星星
    }
  },

  // 昂首（长按）：按下=低头蓄力
  onPress(game, note, res) {
    game.birds.holdT = Conductor.songTime();
  },

  // 松开=昂首伸展；过早/过晚/没松=脖子抽筋
  onRelease(game, note, res) {
    const st = Conductor.songTime();
    if (res === 'miss' || res === 'over') {
      game.birds.confusedT = st;
      AudioEngine.tone(AudioEngine.now(), 150, 0.22, 'sawtooth', 0.18);
    } else {
      game.birds.stretchT = st;
      AudioEngine.sfxCue(AudioEngine.now()); // 伸展 whoosh
    }
  },

  onWhiff(game) {
    game.birds.confusedT = Conductor.songTime();
  },

  draw(game, ctx) {
    const st = Conductor.songTime();
    const beat = Conductor.songBeat();
    const b = game.birds;

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

    if (beat >= 0 && beat < 4) {
      Draw.text(ctx, '听队长唱歌：「突突突」点按 ×3，「昂——」按住再松开！', 480, 110, 25, '#fff');
    }

    // 当前指令（指令拍 ~ 回应开始前）
    let cue = null;
    for (const [c, kind] of this.commands) {
      if (beat >= c && beat < c + 2) { cue = { kind, beat: c }; break; }
    }
    // 队长张嘴唱指令的时刻（指令的 1 拍内）
    let singing = false;
    for (const [c] of this.commands) {
      if (beat >= c && beat < c + 1.05) singing = true;
    }

    // 队长（左边高台上的大蓝鸟 + 礼帽）
    ctx.fillStyle = '#8d6e63';
    ctx.fillRect(108, 380, 64, 70);
    ctx.fillStyle = '#6d4c3d';
    ctx.fillRect(96, 370, 88, 14);
    const cbob = Math.sin(beat * Math.PI) * 4;
    Animals.bird(ctx, 140, 330 + cbob, 42, {
      color: '#3d6b9e',
      pose: 'idle',
      beakOpen: singing ? 1 : 0,
      mood: 'idle'
    });
    ctx.fillStyle = '#26232e';
    ctx.fillRect(118, 268 + cbob, 44, 10);
    ctx.fillRect(128, 244 + cbob, 24, 26);
    Draw.text(ctx, '队长', 140, 480, 18, 'rgba(0,0,0,0.5)');

    // 指令气泡：唱词 + 操作
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

    // 两只同伴（在回应窗口做示范动作）
    for (let i = 0; i < 2; i++) {
      const x = 400 + i * 150;
      let pose = 'idle';
      for (const [c, kind] of this.commands) {
        if (kind === 'peck' && beat >= c + 2 && beat < c + 3.3) pose = 'peck';
        if (kind === 'stretch' && beat >= c + 2 && beat < c + 3.2) pose = 'stretch';
      }
      Animals.bird(ctx, x, 408, 32, { color: '#4a90d9', pose, beakOpen: pose === 'idle' ? 0 : 0.8 });
    }

    // 玩家（橙色，最右）：蓄力低头 → 松开昂首
    let pose = 'idle';
    if (st - b.stretchT < 0.45) pose = 'stretch';
    else if (b.holdT > b.stretchT && st - b.holdT < 0.9) pose = 'peck';
    else if (st - b.peckT < 0.26) pose = 'peck';
    const confused = st - b.confusedT < 0.7;
    Animals.bird(ctx, 720, 406, 36, {
      color: '#ff9a3d',
      pose,
      beakOpen: pose === 'idle' ? 0 : 0.8,
      mood: confused ? 'sad' : 'idle'
    });
    if (confused) Draw.text(ctx, '?', 720, 330, 32, '#fff');
    Draw.text(ctx, '你', 720, 480, 18, 'rgba(0,0,0,0.5)');

    // 按键图例（右下角常驻）
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(742, 462, 206, 64, 10);
    else ctx.rect(742, 462, 206, 64, 10);
    ctx.fill();
    Draw.text(ctx, '点按空格 = 啄米 ×3', 845, 484, 17, '#c62828');
    Draw.text(ctx, '按住再松开 = 昂首', 845, 508, 17, '#1565c0');
  }
};

/* ---------- 注册第二批关卡 ---------- */
Levels.push(LevelMarch, LevelFill, LevelBirds);

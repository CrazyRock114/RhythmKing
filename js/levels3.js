/* levels3.js — 第三批关卡：致敬节奏天国的另外四种经典玩法
 *   第 7 关 · 拍手三人组（Clappy Trio）：听同伴拍两声，按同样间隔补第三声
 *   第 8 关 · 太空棒球（Spaceball）：听投球声判断飞行时间，到位瞬间挥棒
 *   第 9 关 · 收割庄稼：菜冒头后下一拍收；大南瓜【按住】拔出再松开
 *   第 10 关 · 宇宙射击（Shoot-'Em-Up）：警报后 2 拍敌人到准星，射击
 * 关卡接口与 levels.js 相同；第 9 关的长按音符额外实现 onPress / onRelease。
 */
'use strict';

/* ================================================================
 * 第 7 关 · 拍手三人组
 * 两只同伴猫先拍两声，玩家猫用【相同间隔】补第三声（示范声即预告，不靠看！）。
 * 三模式（组 = { head 组首拍, gap 间隔 }，示范在 head/head+gap，玩家在 head+2*gap）：
 *   easy   = 原始谱面：前半段间隔 1 拍，后半段间隔半拍（96 bpm）
 *   normal = 10 组，加入 0.75 拍间隔（bpm×1.1）
 *   hard   = 108 bpm，组数 8~12 与每组间隔（0.5/0.75/1）种子随机，每次不同
 * ============================================================== */
const LevelClappy = {
  id: 'clappy',
  name: '第 7 关 · 拍手三人组',
  desc: '听前两声拍手，用同样的间隔补上第三声！后半段会变成半拍间隔。',
  hint: '空格 / 点击 = 拍手 · Esc = 退出',
  bpm: 96,
  totalBeats: 50,

  // easy：慢间隔组（组首拍）：示范在 c / c+1，玩家在 c+2
  slowHeads: [4, 8, 12, 16, 20, 24, 28, 32],
  // easy：快间隔组（组首拍）：示范在 c / c+0.5，玩家在 c+1
  fastHeads: [36, 38, 40, 42, 44, 46],
  // normal：10 组（组首拍 = 4 + i*7.5），加入 0.75 拍间隔
  NORMAL_GAPS: [1, 0.75, 1, 0.5, 1, 0.75, 0.5, 1, 0.75, 0.5],

  CATX: [280, 480, 680], // 三只猫：同伴 0/1，最右 2 是玩家
  CATY: 392,

  setup(mode) {
    if (mode === 'normal') return { bpm: 96 * 1.1, totalBeats: 77 };
    if (mode === 'hard') return { bpm: 108, totalBeats: 43 };
    return null; // easy：用静态 bpm / totalBeats
  },

  buildChart(mode) {
    mode = mode || 'easy';
    let groups;
    if (mode === 'normal') {
      groups = this.NORMAL_GAPS.map((gap, i) => ({ head: 4 + i * 7.5, gap }));
    } else if (mode === 'hard') {
      // 种子随机：12 个槽位（间隔 3 拍）随机休止留 8~12 组，每组间隔 0.5/0.75/1 随机
      const rnd = mulberry32(Date.now() % 100000);
      const idx = [];
      for (let i = 0; i < 11; i++) idx.push(i);
      for (let i = idx.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        const tmp = idx[i]; idx[i] = idx[j]; idx[j] = tmp;
      }
      const k = 8 + Math.floor(rnd() * 5); // 8~12 组
      const slots = idx.slice(0, k - 1).concat([11]).sort((a, b) => a - b); // 末槽必留，收尾干净
      const GAPS = [0.5, 0.75, 1];
      groups = slots.map(s => ({ head: 4 + s * 3, gap: GAPS[Math.floor(rnd() * 3)] }));
    } else {
      groups = this.slowHeads.map(c => ({ head: c, gap: 1 }))
        .concat(this.fastHeads.map(c => ({ head: c, gap: 0.5 })));
    }
    groups.sort((a, b) => a.head - b.head);
    // 示范拍手与玩家音符都从生成的组结构派生，严格对齐
    const demos = [];
    for (const g of groups) demos.push(g.head, g.head + g.gap);
    demos.sort((a, b) => a - b);
    this._cur = { groups, demos, fastTip: mode === 'easy' };
    const notes = groups.map(g => ({ beat: g.head + g.gap * 2 }));
    return notes.sort((a, b) => a.beat - b.beat);
  },

  init(game) {
    game.clappy = { clapT: -9, happyT: -9, sadT: -9 };
  },

  scheduleStep(step, t, game) {
    const beat = step / 2;
    const spb = Conductor.secPerBeat();
    const b = ((beat % 4) + 4) % 4;
    // 轻柔爵士：大鼓 1、3 拍，军鼓 2、4 拍，低音贝斯
    if (step % 2 === 0) {
      if (b === 0 || b === 2) AudioEngine.kick(t);
      if (b === 1 || b === 3) AudioEngine.snare(t);
      AudioEngine.tone(t, [65.4, 73.4, 82.4, 98][b], spb * 0.5, 'triangle', 0.2);
      // 预备拍（前 4 拍滴答）
      if (beat < 4) AudioEngine.blok(t, beat === 3 ? 1320 : 880);
      // 轻柔钢琴垫音（两拍一音）
      if (beat >= 4 && beat % 2 === 0) {
        AudioEngine.tone(t, [329.63, 349.23, 392, 349.23][Math.floor(beat / 2) % 4], spb * 0.9, 'sine', 0.05);
      }
    } else {
      AudioEngine.hihat(t, false); // 反拍踩镲，留出正拍给拍手声
    }
    // 同伴示范拍手（玩家的第三声不预排，由玩家自己拍）
    // 0.75 拍间隔落在半拍网格之间：按时间窗排程并补偿偏移，与音符严格对齐
    for (const d of this._cur.demos) {
      if (d >= beat && d < beat + 0.5) AudioEngine.clap(t + (d - beat) * spb);
    }
  },

  onJudge(game, note, res) {
    const st = Conductor.songTime();
    if (res === 'miss') {
      game.clappy.sadT = st;
    } else {
      game.clappy.clapT = st;
      game.clappy.happyT = st;
      AudioEngine.clap(AudioEngine.now()); // 拍中了：第三声融入节奏
      game.burst(this.CATX[2], this.CATY - 20, '#ffffff', 8);
    }
  },

  onWhiff(game) {
    // 拍了但不在点上：照样抬手（动作反馈），但不闪光
    game.clappy.clapT = Conductor.songTime();
  },

  draw(game, ctx) {
    const st = Conductor.songTime();
    const beat = Conductor.songBeat();
    const k = game.clappy;

    // 背景：深蓝剧场 + 扫动聚光灯
    const bg = ctx.createLinearGradient(0, 0, 0, 540);
    bg.addColorStop(0, '#2c2350');
    bg.addColorStop(1, '#191430');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 960, 540);
    const sweep = Math.sin(st * 0.5) * 0.22;
    for (const dir of [-1, 1]) {
      ctx.save();
      ctx.translate(480 + dir * 260, -10);
      ctx.rotate(dir * (0.3 + sweep));
      const lg = ctx.createLinearGradient(0, 0, 0, 480);
      lg.addColorStop(0, 'rgba(255,240,180,0.14)');
      lg.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(-80, 480); ctx.lineTo(80, 480);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    // 木质舞台
    Draw.ground(ctx, 430, '#8a5a3b');
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 2;
    for (let i = 1; i < 6; i++) {
      ctx.beginPath(); ctx.moveTo(0, 430 + i * 18); ctx.lineTo(960, 430 + i * 18); ctx.stroke();
    }
    // 红色幕布（顶部波浪 + 两侧垂帘 + 金穗边）
    ctx.fillStyle = '#8e2434';
    ctx.fillRect(0, 0, 960, 26);
    for (let i = 0; i < 12; i++) {
      ctx.beginPath(); ctx.arc(i * 87 + 24, 26, 26, 0, Math.PI); ctx.fill();
    }
    ctx.fillRect(0, 0, 36, 160);
    ctx.fillRect(924, 0, 36, 160);
    ctx.fillStyle = '#d8b62e';
    ctx.fillRect(0, 24, 960, 5);
    // 观众剪影（随节拍摇晃）
    for (let i = 0; i < 9; i++) {
      const ab = Math.sin(beat * Math.PI + i * 1.3) * 3;
      ctx.fillStyle = '#0f0c1c';
      ctx.beginPath(); ctx.arc(i * 116 + 40, 528 + ab, 24, 0, Math.PI * 2); ctx.fill();
    }

    // 同伴拍手状态（按拍比较，与排程严格一致）：组内第一声→猫0，第二声→猫1
    let clap0 = false, clap1 = false;
    for (const g of this._cur.groups) {
      if (beat >= g.head && beat < g.head + 0.3) clap0 = true;
      if (beat >= g.head + g.gap && beat < g.head + g.gap + 0.3) clap1 = true;
    }
    const clapP = st - k.clapT < 0.28;
    const allSad = st - k.sadT < 0.7;

    // 三只猫：谁拍手谁双臂举起 + 爪间闪光
    for (let i = 0; i < 3; i++) {
      const isP = i === 2;
      const clapping = isP ? clapP : (i === 0 ? clap0 : clap1);
      let mood = 'idle';
      if (allSad) mood = 'sad';
      else if (clapping || (isP && st - k.happyT < 0.4)) mood = 'happy';
      const bob = Math.sin(beat * Math.PI + i * 0.8) * 4;
      Animals.cat(ctx, this.CATX[i], this.CATY + bob, isP ? 42 : 38, {
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
        const fy = this.CATY + bob - 20;
        for (let a = 0; a < 5; a++) {
          const ang = -Math.PI / 2 + (a - 2) * 0.55;
          ctx.beginPath();
          ctx.moveTo(this.CATX[i] + Math.cos(ang) * 10, fy + Math.sin(ang) * 10);
          ctx.lineTo(this.CATX[i] + Math.cos(ang) * 24, fy + Math.sin(ang) * 24);
          ctx.stroke();
        }
      }
    }
    Draw.text(ctx, '▼ 你', this.CATX[2], 292, 22, '#ffb3b3');

    // 教学文字与变奏预告
    if (beat >= 0 && beat < 4) {
      Draw.text(ctx, '听前两声拍手，按同样的间隔补第三声！', 480, 130, 28, 'rgba(255,255,255,0.95)');
    } else if (this._cur.fastTip && beat >= 33 && beat < 36) {
      Draw.text(ctx, '注意听：间隔变成半拍了！', 480, 130, 30, '#ffd94d');
    }
  }
};

/* ================================================================
 * 第 8 关 · 太空棒球
 * 投手投球，飞行时间分三种，投球声即预告：
 *   普通球 1 拍（低沉「咻」）/ 高球 2 拍（高飘「叮」）/ 快速球 0.5 拍（短促「兹」）。
 * 三模式（[到达拍, 飞行拍数]）：
 *   easy   = 原始 18 球（100 bpm）
 *   normal = 24 球，加入连续快球与更多 0.5 快球（bpm×1.1）
 *   hard   = 112 bpm，1 拍网格随机休止 + 球速 flight∈{0.5,1,2} 种子随机（最小间隔 1 拍）
 * ============================================================== */
const LevelSpaceball = {
  id: 'spaceball',
  name: '第 8 关 · 太空棒球',
  desc: '听投球声判断球速：普通「咻」=1拍后挥棒，高飘「叮」=2拍，短促「兹」=半拍！',
  hint: '空格 / 点击 = 挥棒 · Esc = 退出',
  bpm: 100,
  totalBeats: 42,

  PITX: 190,   // 投手 x
  BATX: 745,   // 击球手 x
  HITX: 700,   // 击球点 x
  BALLY: 330,  // 球路基准 y

  // easy：[到达拍, 飞行拍数]
  pitches: [
    [4, 1], [6, 1], [8, 2], [11, 1], [12, 1], [14, 0.5], [15, 0.5],
    [17, 2], [20, 1], [22, 0.5], [24, 2], [27, 1], [28, 1], [30, 0.5],
    [32, 2], [35, 1], [36, 1], [37, 1]
  ],
  // normal：24 球（最小间隔 1 拍；12.5/13.5、31/32、41/42/43 为连续快球）
  NORMAL_PITCHES: [
    [4, 1], [6, 1], [8, 2], [11, 1], [12.5, 0.5], [13.5, 0.5],
    [16, 1], [18.5, 2], [21, 1], [22.5, 0.5], [24.5, 1], [27, 2],
    [29.5, 1], [31, 0.5], [32, 0.5], [34.5, 1], [37, 2], [39.5, 1],
    [41, 0.5], [42, 0.5], [43, 0.5], [45.5, 1], [48.5, 2], [51.5, 1]
  ],

  setup(mode) {
    if (mode === 'normal') return { bpm: 100 * 1.1, totalBeats: 59 };
    if (mode === 'hard') return { bpm: 112, totalBeats: 48 };
    return null; // easy：用静态 bpm / totalBeats
  },

  buildChart(mode) {
    mode = mode || 'easy';
    let pitches;
    if (mode === 'normal') {
      pitches = this.NORMAL_PITCHES;
    } else if (mode === 'hard') {
      // 种子随机：1 拍网格（相邻音符最小间隔 1 拍）随机休止，球速随机
      const rnd = mulberry32(Date.now() % 100000);
      const active = [];
      for (let b = 4; b <= 44; b++) active.push(rnd() < 0.72);
      active[0] = active[active.length - 1] = true; // 开场与收尾必有球
      let count = active.reduce((s, a) => s + (a ? 1 : 0), 0);
      while (count < 24) { // 保底 24 球
        const i = Math.floor(rnd() * active.length);
        if (!active[i]) { active[i] = true; count++; }
      }
      pitches = [];
      for (let i = 0; i < active.length; i++) {
        if (!active[i]) continue;
        const r = rnd();
        pitches.push([4 + i, r < 0.3 ? 0.5 : (r < 0.75 ? 1 : 2)]);
      }
    } else {
      pitches = this.pitches;
    }
    const notes = pitches.map(([beat, flight]) => ({
      beat,
      flight,
      kind: flight === 2 ? 'high' : (flight === 0.5 ? 'fast' : 'normal')
    }));
    this._cur = { pitches: notes };
    return notes;
  },

  init(game) {
    game.spaceball = { swingT: -9, happyT: -9, sadT: -9 };
  },

  scheduleStep(step, t, game) {
    const beat = step / 2;
    const spb = Conductor.secPerBeat();
    // 星空氛围伴奏：稀疏贝斯 + 高音旋律
    if (step % 2 === 0) {
      const b = ((beat % 4) + 4) % 4;
      if (b === 0) AudioEngine.kick(t);
      AudioEngine.tone(t, [55, 55, 65.41, 49][b], spb * 0.9, 'triangle', 0.15);
      if (beat < 4) AudioEngine.blok(t, beat === 3 ? 1320 : 880);
      if (beat >= 4 && beat % 2 === 0) {
        const mel = [880, 1046.5, 1318.5, 1174.7, 1046.5, 880, 783.99, 1046.5];
        AudioEngine.tone(t, mel[Math.floor(beat / 2) % 8], spb * 1.4, 'sine', 0.045);
      }
    } else {
      AudioEngine.hihat(t, false);
    }
    // 投球声：在到达前 flight 拍发出，三种音色对应三种球速
    for (const n of this._cur.pitches) {
      if ((n.beat - n.flight) * 2 === step) {
        if (n.kind === 'high') AudioEngine.bell(t, 2093);
        else if (n.kind === 'fast') AudioEngine.zap(t);
        else AudioEngine.swish(t);
      }
    }
  },

  onJudge(game, note, res) {
    const st = Conductor.songTime();
    const s = game.spaceball;
    if (res === 'miss') {
      s.sadT = st;
      note.fallT = st;
    } else {
      s.swingT = st;
      s.happyT = st;
      note.hitT = st;
      AudioEngine.punch(AudioEngine.now());
      AudioEngine.swish(AudioEngine.now());
      game.burst(this.HITX, this.BALLY, '#ffffff', 12);
      game.burst(this.HITX, this.BALLY, '#ffd94d', 8);
    }
  },

  onWhiff(game) {
    game.spaceball.swingT = Conductor.songTime();
  },

  draw(game, ctx) {
    const st = Conductor.songTime();
    const beat = Conductor.songBeat();
    const s = game.spaceball;

    // 背景：星空
    const bg = ctx.createLinearGradient(0, 0, 0, 540);
    bg.addColorStop(0, '#0d1030');
    bg.addColorStop(1, '#1f2450');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 960, 540);
    // 星星（闪烁）
    for (let i = 0; i < 70; i++) {
      const sx = (i * 167 + 37) % 960;
      const sy = (i * 89 + 13) % 400;
      const tw = 0.35 + 0.65 * Math.abs(Math.sin(st * 1.5 + i));
      ctx.fillStyle = 'rgba(255,255,255,' + (tw * 0.85).toFixed(3) + ')';
      ctx.fillRect(sx, sy, i % 5 === 0 ? 3 : 2, i % 5 === 0 ? 3 : 2);
    }
    // 月亮与环形山
    ctx.fillStyle = '#f5f0d8';
    ctx.beginPath(); ctx.arc(830, 80, 42, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(180,175,150,0.6)';
    ctx.beginPath(); ctx.arc(818, 68, 9, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(844, 92, 6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(838, 60, 4, 0, Math.PI * 2); ctx.fill();
    // 远处带环行星
    ctx.fillStyle = '#6a5a9e';
    ctx.beginPath(); ctx.arc(120, 110, 18, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(200,190,255,0.6)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(120, 110, 30, 8, -0.4, 0, Math.PI * 2); ctx.stroke();
    // 月面
    Draw.ground(ctx, 430, '#9a9ab0');
    ctx.fillStyle = '#83839c';
    ctx.beginPath(); ctx.ellipse(300, 472, 70, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(620, 502, 100, 14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(880, 462, 50, 9, 0, 0, Math.PI * 2); ctx.fill();

    // 击球点圈（随节拍脉动）
    const pulse = 1 + 0.08 * Math.max(0, Math.sin(beat * Math.PI));
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 4;
    ctx.setLineDash([9, 7]);
    ctx.beginPath(); ctx.arc(this.HITX, this.BALLY, 34 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();

    // 投手丘 + 投手剪影（投球前半拍抬手蓄力，出手瞬间跨步）
    ctx.fillStyle = '#83839c';
    ctx.beginPath(); ctx.ellipse(this.PITX, 432, 60, 10, 0, 0, Math.PI * 2); ctx.fill();
    let windup = false, threw = false;
    for (const n of this._cur.pitches) {
      const lb = n.beat - n.flight;
      if (beat >= lb - 0.6 && beat < lb) windup = true;
      if (beat >= lb && beat < lb + 0.25) threw = true;
    }
    Draw.blob(ctx, this.PITX, 375, 34, '#3d3d5c', 'idle', {
      cap: '#2a2a40',
      armL: 0.4,
      armR: windup ? -2.6 : (threw ? 0.9 : 0.5),
      legs: true,
      legPhase: threw ? 1 : 0
    });

    // 羊驼击球手（右侧，面向左）：挥棒时从后上方抡到水平
    const bob = Math.sin(beat * Math.PI) * 4;
    let mood = 'idle';
    if (st - s.sadT < 0.7) mood = 'sad';
    else if (st - s.happyT < 0.5) mood = 'happy';
    const swinging = st - s.swingT < 0.26;
    let ang = Math.PI + 1.1; // 待机：球棒立在后上方
    if (swinging) ang = Math.PI + 1.1 - Math.min(1, (st - s.swingT) / 0.26) * 1.35;
    ctx.strokeStyle = '#c98d5e';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(this.BATX - 22, 348 + bob);
    ctx.lineTo(this.BATX - 22 + Math.cos(ang) * 54, 348 + bob + Math.sin(ang) * 54);
    ctx.stroke();
    Animals.alpaca(ctx, this.BATX, 385 + bob, 40, {
      color: '#f0e6d2',
      mood,
      cap: '#e85d5d',
      stretch: swinging ? 0.25 : 0
    });

    // 飞行的球
    for (const n of this._cur.pitches) {
      const launch = n.beat - n.flight;
      if (beat < launch) continue;
      if (n.state === 'hit') {
        // 击中：飞向星空拖尾
        const d = st - n.hitT;
        if (d > 0.9) continue;
        ctx.save();
        ctx.globalAlpha = 1 - d / 0.9;
        ctx.fillStyle = 'rgba(255,217,77,0.5)';
        for (let g = 4; g >= 1; g--) {
          const gd = Math.max(0, d - g * 0.045);
          ctx.beginPath();
          ctx.arc(this.HITX + gd * 560, this.BALLY - gd * 420 + gd * gd * 260, 9 - g * 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(this.HITX + d * 560, this.BALLY - d * 420 + d * d * 260, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        continue;
      }
      const p = (beat - launch) / n.flight;
      if (p > 1.6) continue;
      const arcH = n.kind === 'high' ? 235 : (n.kind === 'fast' ? 26 : 80);
      const x = 215 + (this.HITX - 215) * p;
      let y = this.BALLY - Math.sin(Math.min(p, 1) * Math.PI) * arcH;
      let alpha = 1;
      if (n.state === 'miss') {
        // 漏接：从身边滚落月面
        y = this.BALLY + (p - 1) * (p - 1) * 500;
        alpha = Math.max(0, 1 - (st - n.fallT) / 0.9);
        if (alpha <= 0) continue;
      } else if (n.kind === 'fast') {
        // 快速球残影
        ctx.fillStyle = 'rgba(255,107,107,0.3)';
        for (let g = 1; g <= 3; g++) {
          const gp = Math.max(0, p - g * 0.09);
          ctx.beginPath();
          ctx.arc(215 + (this.HITX - 215) * gp, this.BALLY - Math.sin(gp * Math.PI) * arcH, 11 - g * 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(x, y);
      ctx.fillStyle = n.kind === 'fast' ? '#ff6b6b' : (n.kind === 'high' ? '#9fdcff' : '#ffffff');
      ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 2;
      ctx.stroke();
      // 棒球缝线
      ctx.strokeStyle = '#c62828';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(-4, 0, 8, -0.8, 0.8); ctx.stroke();
      ctx.beginPath(); ctx.arc(4, 0, 8, Math.PI - 0.8, Math.PI + 0.8); ctx.stroke();
      ctx.restore();
    }

    if (beat >= 0 && beat < 4) {
      Draw.text(ctx, '听投球声：「咻」=1拍 ·「叮」=2拍 ·「兹」=半拍！', 480, 56, 27, 'rgba(255,255,255,0.95)');
    }
  }
};

/* ================================================================
 * 第 9 关 · 收割庄稼
 * 菜冒头（「啵」一声，提前 1 拍）后下一拍收；
 * 大南瓜（低沉「啵」）要【按住】拔，拔出时松开。
 * 三模式：
 *   easy   = 原始 8 菜 + 4 南瓜（104 bpm）
 *   normal = 18 株，加入双南瓜（21.5/23.5）与 0.5 间隔连收（bpm×1.1）
 *   hard   = 116 bpm，菜/南瓜位置、南瓜 dur∈{1,1.5,2}、槽位全部种子随机
 * ============================================================== */
const LevelCrop = {
  id: 'crop',
  name: '第 9 关 · 收割庄稼',
  desc: '菜冒头「啵」一声后，下一拍收！大南瓜要【按住】拔，拔出时松开。',
  hint: '空格=收菜 · 大南瓜按住再松开 · Esc = 退出',
  bpm: 104,
  totalBeats: 36,

  TAP_BEATS: [4, 5, 7, 8, 10, 12, 13, 15],
  PUMPKIN_BEATS: [17, 20, 24, 28],
  // normal：18 株 = 12 菜 + 6 南瓜（含 0.5 间隔连收与双南瓜）
  NORMAL_TAPS: [4, 5, 7.5, 8, 11, 13, 15.5, 16, 26, 28, 34.5, 35],
  NORMAL_PUMPKINS: [18, 21.5, 23.5, 30, 40, 46],

  setup(mode) {
    if (mode === 'normal') return { bpm: 104 * 1.1, totalBeats: 51 };
    if (mode === 'hard') return { bpm: 116, totalBeats: 48 };
    return null; // easy：用静态 bpm / totalBeats
  },

  buildChart(mode) {
    mode = mode || 'easy';
    let notes;
    if (mode === 'normal') {
      notes = this.NORMAL_TAPS.map(b => ({ beat: b }))
        .concat(this.NORMAL_PUMPKINS.map(b => ({ beat: b, dur: 1, big: true })));
    } else if (mode === 'hard') {
      // 种子随机：位置 / 种类 / 南瓜 dur / 槽位每次不同
      const rnd = mulberry32(Date.now() % 100000);
      notes = [];
      const slotLast = new Array(12).fill(-9); // 各槽位上次出菜拍
      let b = 4, first = true;
      while (b <= 42) {
        const maxDur = 45 - b; // 保证南瓜在收尾前拔完
        const isP = !first && b > 8 && maxDur >= 1 && rnd() < 0.3;
        const n = { beat: b };
        if (isP) {
          const durs = [1, 1.5, 2].filter(d => d <= maxDur);
          n.dur = durs[Math.floor(rnd() * durs.length)];
          n.big = true;
        }
        // 随机槽位：避开 2.5 拍内刚出过菜的槽位，防止视觉重叠
        const cand = [];
        for (let s = 0; s < 12; s++) if (b - slotLast[s] > 2.5) cand.push(s);
        const s = cand.length ? cand[Math.floor(rnd() * cand.length)]
          : slotLast.indexOf(Math.min.apply(null, slotLast));
        n.slot = s;
        slotLast[s] = b;
        notes.push(n);
        if (isP) {
          b += n.dur + (rnd() < 0.5 ? 1 : 1.5); // 南瓜按住期间不插别的菜
        } else {
          const r = rnd();
          b += r < 0.15 ? 0.5 : (r < 0.45 ? 1 : (r < 0.7 ? 1.5 : (r < 0.9 ? 2 : 2.5)));
        }
        first = false;
      }
    } else {
      notes = this.TAP_BEATS.map(b => ({ beat: b }))
        .concat(this.PUMPKIN_BEATS.map(b => ({ beat: b, dur: 1, big: true })));
    }
    notes.sort((a, b) => a.beat - b.beat);
    // 田埂槽位：两行六列共 12 格，超过 12 株循环复用（hard 已逐株指定）
    notes.forEach((n, i) => { if (n.slot == null) n.slot = i % 12; });
    this._cur = { notes };
    return notes;
  },

  slotX(slot) { return 170 + (slot % 6) * 124; },
  slotY(slot) { return slot % 12 < 6 ? 402 : 478; },

  init(game) {
    game.crop = { hopT: -9, sadT: -9, flinchT: -9 };
  },

  scheduleStep(step, t, game) {
    const beat = step / 2;
    const spb = Conductor.secPerBeat();
    // 田园伴奏：大鼓 + 木贝斯 + 方波小调
    if (step % 2 === 0) {
      const b = ((beat % 4) + 4) % 4;
      if (b === 0 || b === 2) AudioEngine.kick(t);
      AudioEngine.tone(t, [98, 87.31, 110, 82.41][b], spb * 0.4, 'triangle', 0.15);
      if (beat < 4) AudioEngine.blok(t, beat === 3 ? 1320 : 880);
      if (beat >= 4) {
        const mel = [523.25, 659.25, 587.33, 783.99, 659.25, 523.25, 440, 392];
        AudioEngine.tone(t, mel[Math.floor(beat) % 8], spb * 0.25, 'square', 0.045);
      }
    } else {
      AudioEngine.hihat(t, false);
    }
    // 冒头声（提前 1 拍）：普通菜高「啵」，大南瓜低「啵」
    for (const n of this._cur.notes) {
      if ((n.beat - 1) * 2 === step) AudioEngine.blok(t, n.big ? 494 : 988);
    }
  },

  onJudge(game, note, res) {
    const st = Conductor.songTime();
    const c = game.crop;
    if (res === 'miss') {
      // 没收到：菜蔫回土里（南瓜压根没按也是这里）
      c.sadT = st;
      note.missT = st;
      if (note.big) note.outcome = 'rot';
    } else {
      // 点按收菜：轻快的拔出声（南瓜的命中反馈在 onRelease）
      c.hopT = st;
      AudioEngine.punch(AudioEngine.now());
      AudioEngine.blok(AudioEngine.now(), 1320);
      game.burst(this.slotX(note.slot), this.slotY(note.slot) - 24, '#7de38b', 10);
    }
  },

  // 南瓜：按下=开始拔（上升蓄力声）
  onPress(game, note, res) {
    note.pressT = Conductor.songTime();
    AudioEngine.fillStart();
  },

  // 南瓜：松开=拔出 / 拔断
  onRelease(game, note, res) {
    const st = Conductor.songTime();
    note.doneT = st;
    AudioEngine.fillStop();
    if (res === 'miss' || res === 'over') {
      note.outcome = 'bad';
      game.crop.sadT = st;
    } else {
      note.outcome = 'ok';
      game.crop.hopT = st;
      AudioEngine.punch(AudioEngine.now());
      AudioEngine.blok(AudioEngine.now(), 988);
      game.burst(this.slotX(note.slot), this.slotY(note.slot) - 40, '#ffb347', 14);
    }
  },

  onWhiff(game) {
    game.crop.flinchT = Conductor.songTime();
  },

  // 普通菜（萝卜）：冒头升起，错过则蔫回土里
  drawVeggie(ctx, n, x, y, st, beat) {
    const appear = n.beat - 1;
    const p = Math.min(1, (beat - appear) / 0.9);
    const e = 1 - (1 - p) * (1 - p);
    let alpha = 1, rise = (1 - e) * 24;
    if (n.state === 'miss') {
      const q = Math.min(1, (st - n.missT) / 0.5);
      if (q >= 1) return;
      alpha = 1 - q;
      rise += q * 20;
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y + rise);
    ctx.rotate(Math.sin((beat - appear) * Math.PI * 2) * 0.08 * e);
    // 叶子
    ctx.fillStyle = '#4caf50';
    ctx.beginPath(); ctx.ellipse(-6, -34, 5, 14, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(6, -34, 5, 14, 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, -38, 5, 15, 0, 0, Math.PI * 2); ctx.fill();
    // 白紫圆根
    ctx.fillStyle = '#f0e6f5';
    ctx.beginPath(); ctx.arc(0, -14, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#b39ddb';
    ctx.beginPath(); ctx.arc(0, -18, 14, Math.PI, 0); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath(); ctx.arc(-4, -18, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  },

  // 大南瓜：半埋在土里，按住期间随进度被拔出
  drawPumpkin(ctx, n, x, y, st, beat, spb) {
    let py = y, rot = 0, alpha = 1, gray = false;
    if (n.state === 'pending') {
      const p = Math.min(1, (beat - (n.beat - 1)) / 0.9);
      py = y + 36 - p * 26; // 冒头：从全埋到半埋
      rot = Math.sin((beat - n.beat) * Math.PI * 2) * 0.05;
    } else if (n.state === 'holding') {
      const pull = Math.min(1.15, (st - n.pressT) / (n.dur * spb));
      py = y + 10 - pull * 46; // 随按住进度逐渐拔出
      rot = Math.sin(st * 18) * 0.08 * Math.min(1, pull + 0.3);
    } else {
      const d = st - (n.doneT != null ? n.doneT : (n.missT != null ? n.missT : st));
      if (n.outcome === 'ok') {
        // 拔出飞起
        if (d > 0.8) return;
        py = y - 36 - d * 220;
        rot = d * 6;
        alpha = 1 - d / 0.8;
      } else {
        // 拔断 / 烂在地里：变灰下沉
        const q = Math.min(1, d / 0.6);
        if (q >= 1) return;
        py = y + 10 + q * 18;
        alpha = 1 - q;
        gray = true;
      }
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, py);
    ctx.rotate(rot);
    // 瓜身
    ctx.fillStyle = gray ? '#8a7a5d' : '#ff9a3d';
    ctx.beginPath(); ctx.ellipse(0, -16, 30, 26, 0, 0, Math.PI * 2); ctx.fill();
    // 瓜棱
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, -16, 17, 26, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, -16, 7, 26, 0, 0, Math.PI * 2); ctx.stroke();
    // 瓜蒂
    ctx.fillStyle = gray ? '#5d5a45' : '#4caf50';
    ctx.fillRect(-3, -50, 6, 10);
    ctx.beginPath(); ctx.ellipse(8, -46, 9, 4, 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  },

  draw(game, ctx) {
    const st = Conductor.songTime();
    const beat = Conductor.songBeat();
    const spb = Conductor.secPerBeat();
    const c = game.crop;

    // 背景：清晨田园
    const sky = ctx.createLinearGradient(0, 0, 0, 300);
    sky.addColorStop(0, '#8fd3ff');
    sky.addColorStop(1, '#ffe9a8');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 960, 300);
    ctx.fillStyle = '#fff8d0';
    ctx.beginPath(); ctx.arc(110, 70, 36, 0, Math.PI * 2); ctx.fill();
    const drift = (st * 9) % 1200;
    Draw.cloud(ctx, 1010 - drift, 80, 0.85);
    Draw.cloud(ctx, 600 - drift, 140, 0.55);
    Draw.hill(ctx, 160, 300, 260, 70, '#7ec850');
    Draw.hill(ctx, 800, 300, 300, 90, '#6fbf45');
    Draw.ground(ctx, 300, '#8fd45e');
    // 农田土壤带（两条田垄）
    ctx.fillStyle = '#7a4a21';
    ctx.fillRect(0, 360, 960, 180);
    ctx.fillStyle = '#6b3f1b';
    ctx.fillRect(0, 424, 960, 14);
    ctx.fillRect(0, 500, 960, 14);
    ctx.fillStyle = '#79bd4a';
    ctx.fillRect(0, 352, 960, 10);

    // 兔子农夫（收菜时蹦起来）
    const hopP = (st - c.hopT) / 0.35;
    const hop = (hopP >= 0 && hopP <= 1) ? Math.sin(hopP * Math.PI) * 22 : 0;
    let mood = 'idle';
    if (st - c.sadT < 0.7 || st - c.flinchT < 0.3) mood = 'sad';
    else if (st - c.hopT < 0.4) mood = 'happy';
    Animals.bunny(ctx, 82, 458 - hop, 32, {
      color: '#f5f0e8',
      mood,
      earFlop: hop > 0 ? 0.6 : 0,
      headband: '#4caf50'
    });
    // 草帽
    ctx.fillStyle = '#e8c860';
    ctx.beginPath(); ctx.ellipse(82, 424 - hop, 26, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(82, 420 - hop, 14, 9, 0, Math.PI, 0); ctx.fill();

    // 庄稼与南瓜（先画菜再盖土堆，菜像从土里长出来）
    for (const n of this._cur.notes) {
      const x = this.slotX(n.slot);
      const y = this.slotY(n.slot);
      if (n.state !== 'hit' && beat >= n.beat - 1) {
        if (n.big) this.drawPumpkin(ctx, n, x, y, st, beat, spb);
        else this.drawVeggie(ctx, n, x, y, st, beat);
      }
      ctx.fillStyle = '#5d3a17';
      ctx.beginPath(); ctx.ellipse(x, y + 4, 30, 8, 0, 0, Math.PI * 2); ctx.fill();
    }

    if (beat >= 0 && beat < 4) {
      Draw.text(ctx, '菜冒头「啵」一声后，下一拍收！大南瓜按住拔！', 480, 56, 26, '#fff');
    }
  }
};

/* ================================================================
 * 第 10 关 · 宇宙射击
 * 敌人从右侧飞入（警报声提前 2 拍），到达左侧准星瞬间射击；
 * 双连、三连、快波要跟着警报连按。
 * 三模式（波次 = [起始拍, 连发数]，组内间隔 0.5 拍）：
 *   easy   = 原始波次：单发 → 双连 → 三连 → 快波（112 bpm）
 *   normal = totalBeats 48，更多波次 + 四连波（bpm×1.1）
 *   hard   = 124 bpm，单/双/三/四连波次与波间休止种子随机，警报仍严格 note.beat-2
 * ============================================================== */
const LevelShooter = {
  id: 'shooter',
  name: '第 10 关 · 宇宙射击',
  desc: '听警报声：2 拍后敌人到准星，射击！双连、三连警报要连按。',
  hint: '空格 / 点击 = 射击 · Esc = 退出',
  bpm: 112,
  totalBeats: 36,

  SHIPX: 140, // 战机 x
  SHIPY: 300, // 航线 y
  AIMX: 260,  // 准星 x

  // easy 波次：[起始拍, 连发数]，展开与原扁平表完全一致
  WAVES: [[4, 1], [6, 1], [8, 1], [11, 2], [14, 2], [17, 3], [21, 3], [25, 4], [29, 5]],
  // normal：更多波次 + 四连波
  NORMAL_WAVES: [[4, 1], [6, 1], [8, 1], [11, 2], [14, 2], [17, 3], [20, 4], [23, 3],
    [26, 2], [28.5, 2], [31, 4], [34.5, 3], [37.5, 4], [41, 2], [43.5, 3]],

  setup(mode) {
    if (mode === 'normal') return { bpm: 112 * 1.1, totalBeats: 48 };
    if (mode === 'hard') return { bpm: 124, totalBeats: 48 };
    return null; // easy：用静态 bpm / totalBeats
  },

  buildChart(mode) {
    mode = mode || 'easy';
    let waves;
    if (mode === 'normal') {
      waves = this.NORMAL_WAVES;
    } else if (mode === 'hard') {
      // 种子随机：单/双/三/四连波次，波间休止 1.5~3 拍，每次不同
      const rnd = mulberry32(Date.now() % 100000);
      waves = [];
      let b = 4;
      while (b <= 43) {
        const r = rnd();
        let count = r < 0.3 ? 1 : (r < 0.6 ? 2 : (r < 0.85 ? 3 : 4));
        if (b + (count - 1) * 0.5 > 46) count = 1; // 收尾前不挤长波
        waves.push([b, count]);
        b += (count - 1) * 0.5 + 1.5 + Math.floor(rnd() * 4) * 0.5;
      }
    } else {
      waves = this.WAVES;
    }
    const notes = [];
    for (const w of waves) {
      for (let i = 0; i < w[1]; i++) notes.push({ beat: w[0] + i * 0.5 });
    }
    notes.sort((a, b) => a.beat - b.beat);
    this._cur = { waves, notes };
    return notes;
  },

  init(game) {
    game.shooter = { laserT: -9, laserX: 0, hitT: -9, sadT: -9 };
  },

  scheduleStep(step, t, game) {
    const beat = step / 2;
    const spb = Conductor.secPerBeat();
    // 太空伴奏：大鼓 + 锯齿贝斯
    if (step % 2 === 0) {
      const b = ((beat % 4) + 4) % 4;
      if (b === 0 || b === 2) AudioEngine.kick(t);
      AudioEngine.tone(t, [55, 55, 65.41, 49][b], spb * 0.32, 'sawtooth', 0.14);
      if (beat < 4) AudioEngine.blok(t, beat === 3 ? 1320 : 880);
      // 太空长音垫底（每 8 拍）
      if (beat >= 4 && beat % 8 === 0) AudioEngine.tone(t, 1568, spb * 4, 'sine', 0.03);
    } else {
      AudioEngine.hihat(t, false);
    }
    // 警报：敌人到达准星前 2 拍
    for (const n of this._cur.notes) {
      if ((n.beat - 2) * 2 === step) AudioEngine.blok(t, 1175);
    }
  },

  onJudge(game, note, res) {
    const st = Conductor.songTime();
    const s = game.shooter;
    if (res === 'miss') {
      s.sadT = st;
    } else {
      s.hitT = st;
      s.laserT = st;
      s.laserX = this.AIMX;
      AudioEngine.zap(AudioEngine.now());
      AudioEngine.boom(AudioEngine.now());
      game.burst(this.AIMX, this.SHIPY, '#ff9a3d', 16);
      game.burst(this.AIMX, this.SHIPY, '#8be04e', 8);
    }
  },

  onWhiff(game) {
    // 射向深空：激光照打，只是打不到东西
    const s = game.shooter;
    s.laserT = Conductor.songTime();
    s.laserX = 1000;
  },

  draw(game, ctx) {
    const st = Conductor.songTime();
    const beat = Conductor.songBeat();
    const s = game.shooter;

    // 背景：深空 + 向后流动的星野（营造飞行感）
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
    // 远处星球
    ctx.fillStyle = '#3d5a9e';
    ctx.beginPath(); ctx.arc(790, 110, 34, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath(); ctx.arc(780, 100, 12, 0, Math.PI * 2); ctx.fill();
    // 底部星云
    ctx.fillStyle = 'rgba(90,60,160,0.25)';
    ctx.beginPath(); ctx.ellipse(480, 560, 520, 90, 0, 0, Math.PI * 2); ctx.fill();

    // 警报视觉（听觉为主，画面仅确认）：右缘红「!」闪烁
    for (const n of this._cur.notes) {
      if (beat >= n.beat - 2 && beat < n.beat - 1.7 && Math.floor(st * 8) % 2 === 0) {
        Draw.text(ctx, '!', 928, this.SHIPY, 40, '#ff5a5a');
      }
    }

    // 准星（随节拍脉动）
    const pulse = 1 + 0.1 * Math.max(0, Math.sin(beat * Math.PI));
    ctx.strokeStyle = 'rgba(125,227,139,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(this.AIMX, this.SHIPY, 26 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(this.AIMX, this.SHIPY, 10 * pulse, 0, Math.PI * 2); ctx.stroke();
    for (const d of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      ctx.beginPath();
      ctx.moveTo(this.AIMX + d[0] * 34, this.SHIPY + d[1] * 34);
      ctx.lineTo(this.AIMX + d[0] * 42, this.SHIPY + d[1] * 42);
      ctx.stroke();
    }

    // 猫咪战机（左侧飞碟 + 座舱里的猫）
    const bobY = Math.sin(st * 2) * 5;
    // 引擎焰
    const fl = 12 + Math.sin(st * 30) * 5;
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.moveTo(this.SHIPX - 46, this.SHIPY + 16 + bobY);
    ctx.lineTo(this.SHIPX - 46 - fl, this.SHIPY + 24 + bobY);
    ctx.lineTo(this.SHIPX - 46, this.SHIPY + 32 + bobY);
    ctx.closePath(); ctx.fill();
    // 碟身
    ctx.fillStyle = '#9fb2c8';
    ctx.beginPath(); ctx.ellipse(this.SHIPX, this.SHIPY + 24 + bobY, 48, 15, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7c8da3';
    ctx.beginPath(); ctx.ellipse(this.SHIPX, this.SHIPY + 26 + bobY, 48, 13, 0, 0, Math.PI); ctx.fill();
    // 彩灯
    for (let i = -2; i <= 2; i++) {
      ctx.fillStyle = Math.floor(st * 4 + i) % 2 === 0 ? '#ffd94d' : '#8be9fd';
      ctx.beginPath(); ctx.arc(this.SHIPX + i * 20, this.SHIPY + 30 + bobY, 3.5, 0, Math.PI * 2); ctx.fill();
    }
    // 猫咪驾驶员
    let mood = 'idle';
    if (st - s.sadT < 0.6) mood = 'sad';
    else if (st - s.hitT < 0.3) mood = 'happy';
    Animals.cat(ctx, this.SHIPX, this.SHIPY - 2 + bobY, 17, { color: '#f5a35c', mood, armL: 0.5, armR: 0.5 });
    // 座舱玻璃罩
    ctx.fillStyle = 'rgba(180,230,255,0.28)';
    ctx.beginPath(); ctx.arc(this.SHIPX, this.SHIPY + 6 + bobY, 36, Math.PI, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(180,230,255,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 激光束（命中到准星，挥空射向深空）
    const lt = st - s.laserT;
    if (lt >= 0 && lt < 0.14) {
      ctx.save();
      ctx.globalAlpha = 1 - lt / 0.14;
      ctx.strokeStyle = 'rgba(139,233,253,0.6)';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(this.SHIPX + 46, this.SHIPY + 12 + bobY);
      ctx.lineTo(s.laserX, this.SHIPY);
      ctx.stroke();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(this.SHIPX + 46, this.SHIPY + 12 + bobY);
      ctx.lineTo(s.laserX, this.SHIPY);
      ctx.stroke();
      ctx.restore();
    }

    // 敌人：圆胖外星人，旋转着从右飞入；漏掉的从战机旁飞走
    for (const n of this._cur.notes) {
      if (n.state === 'hit') continue;
      const launch = n.beat - 2;
      if (beat < launch) continue;
      const p = (beat - launch) / 2;
      if (p > 1.45) continue;
      const x = 1000 - (1000 - this.AIMX) * p;
      const y = this.SHIPY + Math.sin((beat + n.beat) * Math.PI) * 5;
      const passed = n.state === 'miss';
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(st * 3 + n.beat);
      if (passed) ctx.globalAlpha = Math.max(0, 1 - (p - 1) * 2.5);
      const body = passed ? '#6b7a4a' : '#8be04e';
      // 身体
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.fill();
      // 斑点
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath(); ctx.arc(-10, 6, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(11, -8, 4, 0, Math.PI * 2); ctx.fill();
      // 中间独眼（旋转也认得出）
      Animals.eye(ctx, 0, 0, 8, 'idle');
      // 天线
      ctx.strokeStyle = body;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(0, -30); ctx.stroke();
      ctx.fillStyle = '#ff5a5a';
      ctx.beginPath(); ctx.arc(0, -33, 4, 0, Math.PI * 2); ctx.fill();
      // 小短手
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.arc(-24, 2, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(24, 2, 5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    if (beat >= 0 && beat < 4) {
      Draw.text(ctx, '警报响后 2 拍，敌人到准星——射击！', 480, 56, 27, 'rgba(255,255,255,0.95)');
    }
  }
};

/* ---------- 注册第三批关卡 ---------- */
Levels.push(LevelClappy, LevelSpaceball, LevelCrop, LevelShooter);

/* animals.js — 矢量卡通动物绘制库（Canvas 路径手绘，无外部素材）
 * 所有动物共用一套姿态参数，方便关卡做动作动画：
 *   o.squash   压扁(0~0.4)   o.stretch  拉长(0~0.8)
 *   o.rotate   整体倾斜      o.mood     'idle'|'happy'|'sad'
 *   o.earFlop  耳朵下垂/后摆量(0~1，跳跃时耳朵滞后)
 *   o.armL/armR 手臂角度（0=水平, 负=上举）
 *   o.legPhase 迈步(-1|0|1)  o.headband 头带颜色
 * 坐标约定：x,y 为身体中心；绘制尺寸以 s（≈身体半径）为基准。
 */
'use strict';

const Animals = {

  /* ---------- 五官零件 ---------- */

  // 卡通大眼（带眼白和高光）
  eye(ctx, x, y, r, mood) {
    if (mood === 'sad') {
      ctx.strokeStyle = '#333';
      ctx.lineWidth = r * 0.35;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.stroke();
      return;
    }
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2b2b33';
    ctx.beginPath(); ctx.arc(x + r * 0.15, y + r * 0.1, r * 0.55, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(x - r * 0.15, y - r * 0.2, r * 0.2, 0, Math.PI * 2); ctx.fill();
  },

  // 腮红
  blush(ctx, x, y, r) {
    ctx.fillStyle = 'rgba(255,130,150,0.55)';
    ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
  },

  /* ---------- 兔子（第 4 关） ---------- */
  // 圆滚滚垂耳兔：大耳朵、板牙、短手短脚
  bunny(ctx, x, y, s, o) {
    o = o || {};
    const color = o.color || '#f5f0e8';
    const sq = o.squash || 0;
    const stretch = o.stretch || 0;
    ctx.save();
    ctx.translate(x, y);
    if (o.rotate) ctx.rotate(o.rotate);
    ctx.scale(1 + sq * 0.6 - stretch * 0.2, 1 - sq + stretch);

    // 耳朵（两只长耳，earFlop 越大越向后倒）
    const flop = (o.earFlop || 0) * 0.9;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * s * 0.32, -s * 1.28);
      ctx.rotate(side * (0.12 + flop));
      // 外耳
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.ellipse(0, -s * 0.62, s * 0.2, s * 0.68, 0, 0, Math.PI * 2); ctx.fill();
      // 内耳
      ctx.fillStyle = '#ffb3c0';
      ctx.beginPath(); ctx.ellipse(0, -s * 0.58, s * 0.1, s * 0.45, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // 脚
    ctx.fillStyle = color;
    const lp = o.legPhase || 0;
    ctx.beginPath(); ctx.ellipse(-s * 0.35 - lp * s * 0.18, s * 0.78, s * 0.3, s * 0.18, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(s * 0.35 + lp * s * 0.18, s * 0.78, s * 0.3, s * 0.18, 0, 0, Math.PI * 2); ctx.fill();

    // 身体
    ctx.beginPath(); ctx.ellipse(0, s * 0.15, s * 0.78, s * 0.72, 0, 0, Math.PI * 2); ctx.fill();
    // 肚皮
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.beginPath(); ctx.ellipse(0, s * 0.3, s * 0.45, s * 0.42, 0, 0, Math.PI * 2); ctx.fill();

    // 手臂
    const arm = (side, ang) => {
      if (ang == null) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = s * 0.2;
      ctx.lineCap = 'round';
      const sx = side * s * 0.6, sy = s * 0.15;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + side * Math.cos(ang) * s * 0.55, sy + Math.sin(ang) * s * 0.55);
      ctx.stroke();
    };
    arm(-1, o.armL != null ? o.armL : 0.5);
    arm(1, o.armR != null ? o.armR : 0.5);

    // 头
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(0, -s * 0.72, s * 0.62, 0, Math.PI * 2); ctx.fill();

    // 眼睛
    Animals.eye(ctx, -s * 0.26, -s * 0.82, s * 0.15, o.mood);
    Animals.eye(ctx, s * 0.26, -s * 0.82, s * 0.15, o.mood);
    // 腮红
    Animals.blush(ctx, -s * 0.42, -s * 0.6, s * 0.13);
    Animals.blush(ctx, s * 0.42, -s * 0.6, s * 0.13);
    // 鼻子 + 板牙
    ctx.fillStyle = '#ff8fa0';
    ctx.beginPath();
    ctx.moveTo(-s * 0.07, -s * 0.68);
    ctx.lineTo(s * 0.07, -s * 0.68);
    ctx.lineTo(0, -s * 0.58);
    ctx.closePath(); ctx.fill();
    if (o.mood !== 'sad') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(-s * 0.06, -s * 0.55, s * 0.12, s * 0.14);
      ctx.strokeStyle = '#d9cfc4';
      ctx.lineWidth = 1;
      ctx.strokeRect(-s * 0.06, -s * 0.55, s * 0.12, s * 0.14);
    }

    // 头带
    if (o.headband) {
      ctx.fillStyle = o.headband;
      ctx.fillRect(-s * 0.6, -s * 1.08, s * 1.2, s * 0.16);
    }
    ctx.restore();
  },

  /* ---------- 鸟（第 6 关） ---------- */
  // 肥啾：大圆身体、呆毛、喙可张开；pose: 'idle'|'peck'|'stretch'
  bird(ctx, x, y, s, o) {
    o = o || {};
    const color = o.color || '#4a90d9';
    const pose = o.pose || 'idle';
    ctx.save();
    ctx.translate(x, y);
    if (pose === 'peck') ctx.rotate(1.0);          // 整个身体前倾下啄
    if (pose === 'stretch') ctx.scale(0.82, 1.5);  // 拔高昂首

    // 尾巴
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-s * 0.55, -s * 0.1);
    ctx.lineTo(-s * 1.4, -s * 0.5);
    ctx.lineTo(-s * 1.3, s * 0.15);
    ctx.lineTo(-s * 0.8, s * 0.35);
    ctx.closePath(); ctx.fill();

    // 身体
    ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.fill();
    // 肚皮
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.ellipse(s * 0.1, s * 0.35, s * 0.5, s * 0.42, 0, 0, Math.PI * 2); ctx.fill();

    // 呆毛（头顶三根）
    ctx.strokeStyle = color;
    ctx.lineWidth = s * 0.12;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.92); ctx.lineTo(-s * 0.25, -s * 1.35);
    ctx.moveTo(0, -s * 0.95); ctx.lineTo(0, -s * 1.45);
    ctx.moveTo(0, -s * 0.92); ctx.lineTo(s * 0.25, -s * 1.35);
    ctx.stroke();

    // 翅膀
    ctx.fillStyle = 'rgba(0,0,0,0.14)';
    const flap = (o.wingFlap || 0) * 0.5;
    ctx.save();
    ctx.translate(-s * 0.15, s * 0.1);
    ctx.rotate(-0.35 - flap);
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.5, s * 0.32, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // 眼睛（大而圆）
    Animals.eye(ctx, s * 0.18, -s * 0.32, s * 0.2, o.mood);
    Animals.blush(ctx, s * 0.52, -s * 0.05, s * 0.14);

    // 喙（可张开，beakOpen 0~1）
    const open = o.beakOpen || 0;
    ctx.fillStyle = '#ffb347';
    // 上喙
    ctx.save();
    ctx.translate(s * 0.62, -s * 0.18);
    ctx.rotate(-open * 0.35);
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.1);
    ctx.lineTo(s * 0.72, s * 0.02);
    ctx.lineTo(0, s * 0.12);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    // 下喙
    ctx.save();
    ctx.translate(s * 0.62, -s * 0.06);
    ctx.rotate(open * 0.5);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(s * 0.5, s * 0.06);
    ctx.lineTo(0, s * 0.14);
    ctx.closePath(); ctx.fill();
    ctx.restore();

    // 腿
    ctx.strokeStyle = '#ffb347';
    ctx.lineWidth = s * 0.11;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-s * 0.22, s * 0.9); ctx.lineTo(-s * 0.22, s * 1.4);
    ctx.moveTo(s * 0.22, s * 0.9); ctx.lineTo(s * 0.22, s * 1.4);
    ctx.stroke();
    ctx.restore();
  }
};

/* ================= 第二批动物 ================= */

Object.assign(Animals, {

  /* ---------- 猫（第 1 关·空手道猫） ---------- */
  cat(ctx, x, y, s, o) {
    o = o || {};
    const color = o.color || '#f5a35c';
    const sq = o.squash || 0;
    ctx.save();
    ctx.translate(x, y);
    if (o.rotate) ctx.rotate(o.rotate);
    ctx.scale(1 + sq * 0.6, 1 - sq);

    // 尾巴（弯曲上翘）
    ctx.strokeStyle = color;
    ctx.lineWidth = s * 0.22;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-s * 0.65, s * 0.45);
    ctx.quadraticCurveTo(-s * 1.5, s * 0.25, -s * 1.3, -s * 0.5 - (o.tailUp || 0) * s * 0.35);
    ctx.stroke();

    // 耳朵（三角 + 粉色内耳）
    for (const side of [-1, 1]) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(side * s * 0.24, -s * 1.12);
      ctx.lineTo(side * s * 0.66, -s * 1.78);
      ctx.lineTo(side * s * 0.86, -s * 0.96);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffb3c0';
      ctx.beginPath();
      ctx.moveTo(side * s * 0.4, -s * 1.16);
      ctx.lineTo(side * s * 0.62, -s * 1.56);
      ctx.lineTo(side * s * 0.72, -s * 1.04);
      ctx.closePath(); ctx.fill();
    }

    // 脚
    ctx.fillStyle = color;
    const lp = o.legPhase || 0;
    ctx.beginPath(); ctx.ellipse(-s * 0.3 - lp * s * 0.15, s * 0.8, s * 0.26, s * 0.16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(s * 0.3 + lp * s * 0.15, s * 0.8, s * 0.26, s * 0.16, 0, 0, Math.PI * 2); ctx.fill();

    // 身体
    ctx.beginPath(); ctx.ellipse(0, s * 0.25, s * 0.72, s * 0.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.ellipse(0, s * 0.35, s * 0.4, s * 0.35, 0, 0, Math.PI * 2); ctx.fill();

    // 手臂（猫爪）
    const arm = (side, ang) => {
      if (ang == null) return;
      const sx = side * s * 0.58, sy = s * 0.1;
      const ex = sx + side * Math.cos(ang) * s * 0.6;
      const ey = sy + Math.sin(ang) * s * 0.6;
      ctx.strokeStyle = color;
      ctx.lineWidth = s * 0.2;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(ex, ey, s * 0.14, 0, Math.PI * 2); ctx.fill();
    };
    if (o.armL !== false) arm(-1, o.armL != null ? o.armL : 0.5);
    if (o.armR !== false) arm(1, o.armR != null ? o.armR : 0.5);

    // 头
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(0, -s * 0.62, s * 0.62, 0, Math.PI * 2); ctx.fill();

    // 眼睛
    Animals.eye(ctx, -s * 0.25, -s * 0.72, s * 0.15, o.mood);
    Animals.eye(ctx, s * 0.25, -s * 0.72, s * 0.15, o.mood);
    // 腮红
    Animals.blush(ctx, -s * 0.42, -s * 0.5, s * 0.12);
    Animals.blush(ctx, s * 0.42, -s * 0.5, s * 0.12);
    // 鼻子 + 猫嘴（ω形）
    ctx.fillStyle = '#ff8fa0';
    ctx.beginPath();
    ctx.moveTo(-s * 0.06, -s * 0.58);
    ctx.lineTo(s * 0.06, -s * 0.58);
    ctx.lineTo(0, -s * 0.5);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = s * 0.04;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (o.mood === 'sad') {
      ctx.arc(0, -s * 0.32, s * 0.12, 1.15 * Math.PI, 1.85 * Math.PI);
    } else {
      ctx.arc(-s * 0.08, -s * 0.48, s * 0.08, 0.1 * Math.PI, 0.95 * Math.PI);
      ctx.moveTo(s * 0.16, -s * 0.42);
      ctx.arc(s * 0.08, -s * 0.48, s * 0.08, 0.05 * Math.PI, 0.9 * Math.PI);
    }
    ctx.stroke();
    // 胡须
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = s * 0.03;
    ctx.beginPath();
    for (const side of [-1, 1]) {
      for (let i = -1; i <= 1; i++) {
        ctx.moveTo(side * s * 0.5, -s * 0.55 + i * s * 0.08);
        ctx.lineTo(side * s * 0.95, -s * 0.6 + i * s * 0.14);
      }
    }
    ctx.stroke();

    // 头带
    if (o.headband) {
      ctx.fillStyle = o.headband;
      ctx.fillRect(-s * 0.6, -s * 0.98, s * 1.2, s * 0.16);
      ctx.fillRect(s * 0.45, -s * 0.92, s * 0.4, s * 0.1);
    }
    ctx.restore();
  },

  /* ---------- 羊驼（第 2 关·师生） ---------- */
  // 长脖子 + 蓬松羊毛；stretch 越大脖子伸得越长
  alpaca(ctx, x, y, s, o) {
    o = o || {};
    const color = o.color || '#f0e6d2';
    const stretch = o.stretch || 0;
    ctx.save();
    ctx.translate(x, y);
    if (o.rotate) ctx.rotate(o.rotate);

    // 蓬松身体（一团圆）
    ctx.fillStyle = color;
    const blobs = [[0, 0.1, 0.8], [-0.55, 0.2, 0.5], [0.55, 0.2, 0.5], [-0.3, 0.5, 0.5], [0.3, 0.5, 0.5], [0, 0.55, 0.45]];
    for (const [bx, by, br] of blobs) {
      ctx.beginPath(); ctx.arc(bx * s, by * s, br * s, 0, Math.PI * 2); ctx.fill();
    }
    // 腿
    ctx.fillStyle = '#d9cdb8';
    ctx.fillRect(-s * 0.4, s * 0.7, s * 0.16, s * 0.5);
    ctx.fillRect(s * 0.24, s * 0.7, s * 0.16, s * 0.5);

    // 脖子
    const neckH = s * (1.1 + stretch * 0.7);
    const neckW = s * 0.34;
    const neckTopY = -s * 0.2 - neckH;
    ctx.fillStyle = color;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-neckW / 2, neckTopY, neckW, neckH + s * 0.4, neckW / 2);
    else ctx.rect(-neckW / 2, neckTopY, neckW, neckH + s * 0.4);
    ctx.fill();

    // 头（在脖子顶端）
    const hy = neckTopY;
    ctx.beginPath(); ctx.ellipse(0, hy, s * 0.34, s * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    // 头顶毛球
    for (const [px, pr] of [[-0.16, 0.14], [0, 0.17], [0.16, 0.14]]) {
      ctx.beginPath(); ctx.arc(px * s, hy - s * 0.28, pr * s, 0, Math.PI * 2); ctx.fill();
    }
    // 耳朵
    ctx.fillStyle = '#d9cdb8';
    ctx.beginPath(); ctx.ellipse(-s * 0.3, hy - s * 0.18, s * 0.08, s * 0.16, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(s * 0.3, hy - s * 0.18, s * 0.08, s * 0.16, 0.4, 0, Math.PI * 2); ctx.fill();
    // 口鼻
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath(); ctx.ellipse(0, hy + s * 0.12, s * 0.18, s * 0.13, 0, 0, Math.PI * 2); ctx.fill();
    // 眼睛
    Animals.eye(ctx, -s * 0.14, hy - s * 0.06, s * 0.11, o.mood);
    Animals.eye(ctx, s * 0.14, hy - s * 0.06, s * 0.11, o.mood);
    Animals.blush(ctx, -s * 0.26, hy + s * 0.06, s * 0.09);
    Animals.blush(ctx, s * 0.26, hy + s * 0.06, s * 0.09);
    // 鼻嘴
    ctx.fillStyle = '#8a7a66';
    ctx.beginPath(); ctx.ellipse(0, hy + s * 0.08, s * 0.05, s * 0.035, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8a7a66';
    ctx.lineWidth = s * 0.03;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (o.mood === 'sad') ctx.arc(0, hy + s * 0.24, s * 0.08, 1.15 * Math.PI, 1.85 * Math.PI);
    else ctx.arc(0, hy + s * 0.12, s * 0.08, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();

    // 帽子
    if (o.cap) {
      ctx.fillStyle = o.cap;
      ctx.beginPath(); ctx.ellipse(0, hy - s * 0.3, s * 0.3, s * 0.12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(-s * 0.2, hy - s * 0.62, s * 0.4, s * 0.34);
    }
    ctx.restore();
  },

  /* ---------- 狗（第 3 关·乒乓小狗） ---------- */
  dog(ctx, x, y, s, o) {
    o = o || {};
    const color = o.color || '#c98d5e';
    ctx.save();
    ctx.translate(x, y);
    if (o.rotate) ctx.rotate(o.rotate);
    const sq = o.squash || 0;
    ctx.scale(1 + sq * 0.5, 1 - sq);

    // 尾巴（摇摆）
    const wag = o.tailWag || 0;
    ctx.strokeStyle = color;
    ctx.lineWidth = s * 0.18;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-s * 0.6, s * 0.3);
    ctx.quadraticCurveTo(-s * 1.2, s * 0.1, -s * 1.1 + wag * s * 0.3, -s * 0.5);
    ctx.stroke();

    // 身体
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(0, s * 0.25, s * 0.7, s * 0.58, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.ellipse(s * 0.05, s * 0.35, s * 0.38, s * 0.32, 0, 0, Math.PI * 2); ctx.fill();

    // 前爪
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(-s * 0.28, s * 0.78, s * 0.2, s * 0.13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(s * 0.28, s * 0.78, s * 0.2, s * 0.13, 0, 0, Math.PI * 2); ctx.fill();

    // 头
    ctx.beginPath(); ctx.arc(0, -s * 0.55, s * 0.58, 0, Math.PI * 2); ctx.fill();
    // 垂耳
    ctx.fillStyle = '#a8713f';
    ctx.beginPath(); ctx.ellipse(-s * 0.52, -s * 0.62, s * 0.18, s * 0.4, 0.35, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(s * 0.52, -s * 0.62, s * 0.18, s * 0.4, -0.35, 0, Math.PI * 2); ctx.fill();
    // 口鼻
    ctx.fillStyle = '#f5e6d0';
    ctx.beginPath(); ctx.ellipse(0, -s * 0.36, s * 0.26, s * 0.18, 0, 0, Math.PI * 2); ctx.fill();
    // 眼睛
    Animals.eye(ctx, -s * 0.22, -s * 0.66, s * 0.14, o.mood);
    Animals.eye(ctx, s * 0.22, -s * 0.66, s * 0.14, o.mood);
    Animals.blush(ctx, -s * 0.4, -s * 0.42, s * 0.11);
    Animals.blush(ctx, s * 0.4, -s * 0.42, s * 0.11);
    // 鼻子
    ctx.fillStyle = '#333';
    ctx.beginPath(); ctx.ellipse(0, -s * 0.44, s * 0.09, s * 0.07, 0, 0, Math.PI * 2); ctx.fill();
    // 嘴 + 舌头
    if (o.mood === 'sad') {
      ctx.strokeStyle = '#333';
      ctx.lineWidth = s * 0.04;
      ctx.beginPath(); ctx.arc(0, -s * 0.18, s * 0.1, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke();
    } else {
      ctx.fillStyle = '#ff8fa0';
      ctx.beginPath(); ctx.ellipse(0, -s * 0.24, s * 0.09, s * 0.13, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#e06a80';
      ctx.lineWidth = s * 0.02;
      ctx.beginPath(); ctx.moveTo(0, -s * 0.32); ctx.lineTo(0, -s * 0.18); ctx.stroke();
    }
    ctx.restore();
  }
});

/* ================= 第三批动物 ================= */

Object.assign(Animals, {

  /* ---------- 企鹅（第 16 关） ---------- */
  penguin(ctx, x, y, s, o) {
    o = o || {};
    ctx.save();
    ctx.translate(x, y);
    if (o.rotate) ctx.rotate(o.rotate);
    const sq = o.squash || 0;
    ctx.scale(1 + sq * 0.5, 1 - sq);
    const body = o.color || '#2b3440';

    // 橙色蹼足
    ctx.fillStyle = '#ffb347';
    const lp = o.legPhase || 0;
    ctx.beginPath(); ctx.ellipse(-s * 0.25 - lp * s * 0.12, s * 0.85, s * 0.22, s * 0.1, -0.1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(s * 0.25 + lp * s * 0.12, s * 0.85, s * 0.22, s * 0.1, 0.1, 0, Math.PI * 2); ctx.fill();

    // 身体 + 白肚皮
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.72, s * 0.9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f5f8fa';
    ctx.beginPath(); ctx.ellipse(0, s * 0.12, s * 0.48, s * 0.62, 0, 0, Math.PI * 2); ctx.fill();

    // 鳍状翅膀（wingUp 时高举庆祝）
    ctx.fillStyle = body;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * s * 0.66, -s * 0.05);
      ctx.rotate(side * (o.wingUp ? -0.95 : 0.3));
      ctx.beginPath(); ctx.ellipse(0, s * 0.15, s * 0.16, s * 0.45, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // 眼睛 + 腮红
    Animals.eye(ctx, -s * 0.2, -s * 0.35, s * 0.13, o.mood);
    Animals.eye(ctx, s * 0.2, -s * 0.35, s * 0.13, o.mood);
    Animals.blush(ctx, -s * 0.4, -s * 0.16, s * 0.1);
    Animals.blush(ctx, s * 0.4, -s * 0.16, s * 0.1);
    // 喙
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.moveTo(-s * 0.1, -s * 0.22);
    ctx.lineTo(s * 0.1, -s * 0.22);
    ctx.lineTo(0, -s * 0.05);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  },

  /* ---------- 和尚（第 13 关） ---------- */
  // 光头 + 袈裟 + 佛珠；mouthOpen(0~1) 控制张嘴幅度（吃东西用）
  monk(ctx, x, y, s, o) {
    o = o || {};
    const skin = o.color || '#f2c9a0';
    ctx.save();
    ctx.translate(x, y);
    const sq = o.squash || 0;
    ctx.scale(1 + sq * 0.5, 1 - sq);

    // 袈裟（盘腿坐姿的梯形）
    ctx.fillStyle = '#e8862e';
    ctx.beginPath();
    ctx.moveTo(-s * 0.85, s * 0.9);
    ctx.quadraticCurveTo(-s * 0.8, -s * 0.1, -s * 0.35, -s * 0.25);
    ctx.lineTo(s * 0.35, -s * 0.25);
    ctx.quadraticCurveTo(s * 0.8, -s * 0.1, s * 0.85, s * 0.9);
    ctx.closePath(); ctx.fill();
    // 斜披带
    ctx.fillStyle = '#c96a1b';
    ctx.beginPath();
    ctx.moveTo(-s * 0.3, -s * 0.22);
    ctx.lineTo(s * 0.15, -s * 0.22);
    ctx.lineTo(-s * 0.5, s * 0.9);
    ctx.lineTo(-s * 0.85, s * 0.9);
    ctx.closePath(); ctx.fill();
    // 盘腿
    ctx.beginPath(); ctx.ellipse(0, s * 0.88, s * 0.78, s * 0.16, 0, 0, Math.PI * 2); ctx.fill();

    // 光头
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(0, -s * 0.62, s * 0.52, 0, Math.PI * 2); ctx.fill();

    // 眼睛（打坐闭眼 / 难过垂眼）
    ctx.strokeStyle = '#333';
    ctx.lineWidth = s * 0.045;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (o.mood === 'sad') {
      ctx.moveTo(-s * 0.3, -s * 0.66); ctx.lineTo(-s * 0.1, -s * 0.62);
      ctx.moveTo(s * 0.1, -s * 0.62); ctx.lineTo(s * 0.3, -s * 0.66);
    } else {
      ctx.arc(-s * 0.2, -s * 0.68, s * 0.11, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.moveTo(s * 0.31, -s * 0.63);
      ctx.arc(s * 0.2, -s * 0.68, s * 0.11, 0.15 * Math.PI, 0.85 * Math.PI);
    }
    ctx.stroke();
    Animals.blush(ctx, -s * 0.36, -s * 0.5, s * 0.1);
    Animals.blush(ctx, s * 0.36, -s * 0.5, s * 0.1);

    // 嘴：mouthOpen 控制张合（吃东西的关键动作）
    const mo = Math.max(0, Math.min(1, o.mouthOpen || 0));
    if (mo > 0.06) {
      ctx.fillStyle = '#7a3b2e';
      ctx.beginPath(); ctx.ellipse(0, -s * 0.4, s * 0.15 * (0.4 + mo * 0.8), s * 0.19 * mo, 0, 0, Math.PI * 2); ctx.fill();
      // 舌头
      ctx.fillStyle = '#d96a6a';
      ctx.beginPath(); ctx.ellipse(0, -s * 0.4 + s * 0.08 * mo, s * 0.09 * mo, s * 0.06 * mo, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.strokeStyle = '#8a5a3b';
      ctx.lineWidth = s * 0.04;
      ctx.beginPath(); ctx.arc(0, -s * 0.48, s * 0.12, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
    }

    // 佛珠
    ctx.fillStyle = '#8a5a3b';
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * 0.25 + (i / 6) * Math.PI * 0.5;
      ctx.beginPath(); ctx.arc(Math.cos(a) * s * 0.42, -s * 0.12 + Math.sin(a) * s * 0.4, s * 0.05, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
});

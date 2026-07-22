/* audio.js — Web Audio 实时合成：鼓组 / 旋律 / 音效，无需任何音频文件 */
'use strict';

const AudioEngine = {
  ctx: null,
  master: null,
  _noiseBuf: null,

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.45;
    const comp = this.ctx.createDynamicsCompressor();
    this.master.connect(comp);
    comp.connect(this.ctx.destination);
  },

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },

  now() {
    return this.ctx ? this.ctx.currentTime : 0;
  },

  noiseBuffer() {
    if (!this._noiseBuf) {
      const len = Math.floor(this.ctx.sampleRate * 0.5);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this._noiseBuf = buf;
    }
    return this._noiseBuf;
  },

  /* ---------- 打击乐（t 为 ctx 时间） ---------- */

  kick(t) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.26);
  },

  snare(t) {
    const n = this.ctx.createBufferSource();
    n.buffer = this.noiseBuffer();
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.8;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    n.connect(f); f.connect(g); g.connect(this.master);
    n.start(t); n.stop(t + 0.18);
    const o = this.ctx.createOscillator();
    const g2 = this.ctx.createGain();
    o.type = 'triangle'; o.frequency.value = 190;
    g2.gain.setValueAtTime(0.25, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    o.connect(g2); g2.connect(this.master);
    o.start(t); o.stop(t + 0.1);
  },

  hihat(t, open) {
    const n = this.ctx.createBufferSource();
    n.buffer = this.noiseBuffer();
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 7500;
    const g = this.ctx.createGain();
    const dur = open ? 0.22 : 0.05;
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    n.connect(f); f.connect(g); g.connect(this.master);
    n.start(t); n.stop(t + dur + 0.02);
  },

  /* ---------- 旋律 ---------- */

  tone(t, freq, dur, type, vol) {
    type = type || 'square';
    vol = vol == null ? 0.16 : vol;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.setValueAtTime(vol, t + Math.max(0.012, dur - 0.05));
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  },

  // 木鱼声（示范段 / 模仿段用）
  blok(t, freq) {
    this.tone(t, freq || 660, 0.13, 'sine', 0.32);
    this.tone(t, (freq || 660) * 2, 0.06, 'sine', 0.1);
  },

  // 乒乓球声
  pon(t, pitch) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(pitch || 1150, t);
    o.frequency.exponentialRampToValueAtTime((pitch || 1150) * 0.8, t + 0.06);
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.1);
  },

  /* ---------- 即时反馈音效 ---------- */

  sfxSmash() { // 击碎（L1 命中）
    const t = this.now();
    const n = this.ctx.createBufferSource();
    n.buffer = this.noiseBuffer();
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 4200;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.4, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    n.connect(f); f.connect(g); g.connect(this.master);
    n.start(t); n.stop(t + 0.22);
    this.tone(t, 220, 0.08, 'square', 0.2);
  },

  sfxMiss() { // 错过
    const t = this.now();
    this.tone(t, 130, 0.26, 'sawtooth', 0.2);
    this.tone(t, 98, 0.3, 'sawtooth', 0.16);
  },

  sfxCue(t) { // 物体抛出 "fwip"
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(500, t);
    o.frequency.exponentialRampToValueAtTime(1400, t + 0.09);
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.12);
  },

  sfxWhiff() { // 挥空
    const t = this.now();
    const n = this.ctx.createBufferSource();
    n.buffer = this.noiseBuffer();
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = 1.5;
    f.frequency.setValueAtTime(3000, t);
    f.frequency.exponentialRampToValueAtTime(500, t + 0.15);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    n.connect(f); f.connect(g); g.connect(this.master);
    n.start(t); n.stop(t + 0.18);
  },

  /* ---------- 新关卡专用 ---------- */

  // 灌油声：按住期间持续的上升音（Fillbots）
  fillStart() {
    this.fillStop();
    const t = this.now();
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(200, t);
    o.frequency.linearRampToValueAtTime(900, t + 3);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.05);
    o.connect(g); g.connect(this.master);
    o.start(t);
    this._fill = { o, g };
  },

  fillStop() {
    if (!this._fill) return;
    const t = this.now();
    const { o, g } = this._fill;
    try {
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(Math.max(0.001, g.gain.value), t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      o.stop(t + 0.1);
    } catch (e) { /* 已停止则忽略 */ }
    this._fill = null;
  },

  // 鸟队长口令（Blue Birds）：'main' 低哑=啄米，'alt' 高亢两连=昂首
  squawk(t, kind) {
    if (kind === 'alt') {
      this.tone(t, 990, 0.09, 'square', 0.2);
      this.tone(t + 0.11, 1320, 0.14, 'square', 0.2);
    } else {
      this.tone(t, 320, 0.13, 'sawtooth', 0.22);
    }
  },

  // 踏步口令（Lockstep 换拍提示）
  marchCue(t) {
    this.blok(t, 1046);
    this.blok(t + 0.09, 1318);
  },

  // 哨声（段落停止信号）
  whistle(t) {
    this.tone(t, 2093, 0.12, 'sine', 0.28);
    this.tone(t + 0.14, 1568, 0.22, 'sine', 0.28);
  },

  /* ---------- 第三批关卡专用 ---------- */

  // 拍手（Clappy Trio）
  clap(t) {
    const n = this.ctx.createBufferSource();
    n.buffer = this.noiseBuffer();
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 1300; f.Q.value = 1.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.4, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    n.connect(f); f.connect(g); g.connect(this.master);
    n.start(t); n.stop(t + 0.1);
  },

  // 踢踏声（Tap Trial）
  tick(t, pitch) {
    this.tone(t, pitch || 1800, 0.04, 'square', 0.2);
  },

  // 咀嚼（Munchy Monk）
  chomp(t) {
    const n = this.ctx.createBufferSource();
    n.buffer = this.noiseBuffer();
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 900;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.4, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    n.connect(f); f.connect(g); g.connect(this.master);
    n.start(t); n.stop(t + 0.14);
    this.tone(t, 180, 0.1, 'sine', 0.2);
  },

  // 激光（Shoot-'Em-Up）
  zap(t) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(1400, t);
    o.frequency.exponentialRampToValueAtTime(180, t + 0.18);
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.2);
  },

  // 爆炸
  boom(t) {
    const n = this.ctx.createBufferSource();
    n.buffer = this.noiseBuffer();
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 500;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    n.connect(f); f.connect(g); g.connect(this.master);
    n.start(t); n.stop(t + 0.42);
  },

  // 铃铛（Showtime），pitch 决定起跳间隔
  bell(t, pitch) {
    const p = pitch || 1568;
    this.tone(t, p, 0.5, 'sine', 0.26);
    this.tone(t, p * 2.01, 0.3, 'sine', 0.09);
  },

  // 魔法绽放（Mahou Tsukai）
  sparkle(t) {
    this.tone(t, 1046, 0.08, 'sine', 0.2);
    this.tone(t + 0.06, 1318, 0.08, 'sine', 0.2);
    this.tone(t + 0.12, 1568, 0.14, 'sine', 0.22);
    this.tone(t + 0.18, 2093, 0.2, 'sine', 0.18);
  },

  // DJ 搓碟
  scratch(t) {
    const n = this.ctx.createBufferSource();
    n.buffer = this.noiseBuffer();
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = 3;
    f.frequency.setValueAtTime(600, t);
    f.frequency.linearRampToValueAtTime(2400, t + 0.12);
    f.frequency.linearRampToValueAtTime(500, t + 0.24);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
    n.connect(f); f.connect(g); g.connect(this.master);
    n.start(t); n.stop(t + 0.28);
  },

  // 重拳击中
  punch(t) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(50, t + 0.08);
    g.gain.setValueAtTime(0.55, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.16);
  },

  // 挥棒破空（排程版）
  swish(t) {
    const n = this.ctx.createBufferSource();
    n.buffer = this.noiseBuffer();
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = 1.5;
    f.frequency.setValueAtTime(2500, t);
    f.frequency.exponentialRampToValueAtTime(600, t + 0.12);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    n.connect(f); f.connect(g); g.connect(this.master);
    n.start(t); n.stop(t + 0.16);
  },

  // 合唱垫底（Glee Club）：按住期间持续的 C 大三和弦
  choirStart() {
    this.choirStop();
    const t = this.now();
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.2);
    const oscs = [261.63, 329.63, 392].map(fr => {
      const o = this.ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = fr;
      o.connect(g);
      o.start(t);
      return o;
    });
    g.connect(this.master);
    this._choir = { oscs, g };
  },

  choirStop() {
    if (!this._choir) return;
    const t = this.now();
    const { oscs, g } = this._choir;
    try {
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(Math.max(0.001, g.gain.value), t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      oscs.forEach(o => o.stop(t + 0.18));
    } catch (e) { /* 已停止则忽略 */ }
    this._choir = null;
  }
};

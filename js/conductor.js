/* conductor.js — 节拍引擎
 * 核心原则：AudioContext.currentTime 是唯一时钟源。
 * 音乐排程与按键判定都从它推导，绝不使用 setTimeout/rAF 直接计量音乐时间。
 */
'use strict';

const Conductor = {
  bpm: 120,
  startTime: 0, // ctx 时间轴上第 0 拍对应的时刻

  secPerBeat() {
    return 60 / this.bpm;
  },

  // 歌曲时间（秒），第 0 拍之前为负值
  songTime() {
    return AudioEngine.now() - this.startTime;
  },

  // 歌曲拍位置（浮点拍）
  songBeat() {
    return this.songTime() / this.secPerBeat();
  },

  // 拍 → ctx 绝对时间
  beatToTime(beat) {
    return this.startTime + beat * this.secPerBeat();
  },

  // 开始一首 bpm 的曲子，留出短延迟让第一拍不突兀
  start(bpm) {
    this.bpm = bpm;
    this.startTime = AudioEngine.now() + 0.15;
  }
};

/* 种子随机（hard 模式生成谱面用）：返回 0~1 的随机函数
 * 用法：const rnd = mulberry32(Date.now() % 100000); const x = rnd(); */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

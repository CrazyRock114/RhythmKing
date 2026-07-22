/* main.js — 启动、屏幕流转（标题 → 选关 → 游戏 → 结算）、输入绑定
 *
 * 按键映射：
 *   主键（击打/踏步/灌油）：空格 / 回车 / J / 点击画面
 *   副键（双键关专用，如蓝鸟的"昂首"）：F / K
 *   Esc：退出到选关
 */
'use strict';

const Main = {
  state: 'title',
  canvas: null,
  ctx: null,
  currentLevel: null,
  best: {}, // 本次会话内各关最佳评级

  MAIN_KEYS: ['Space', 'Enter', 'KeyJ'],
  ALT_KEYS: ['KeyF', 'KeyK'],

  init() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.fitCanvas();
    window.addEventListener('resize', () => this.fitCanvas());

    // 浏览器自动播放策略：必须在用户手势后创建/恢复 AudioContext
    const unlock = () => { AudioEngine.init(); AudioEngine.resume(); };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    document.getElementById('btn-start').addEventListener('click', () => this.showSelect());
    document.getElementById('btn-retry').addEventListener('click', () => this.startLevel(this.currentLevel));
    document.getElementById('btn-back').addEventListener('click', () => this.showSelect());

    // 生成选关卡片
    const list = document.getElementById('level-list');
    for (const lv of Levels) {
      const btn = document.createElement('button');
      btn.className = 'level-card';
      btn.innerHTML =
        '<div class="lv-name">' + lv.name + '</div>' +
        '<div class="lv-desc">' + lv.desc + '</div>' +
        '<div class="lv-best" data-lv="' + lv.id + '"></div>';
      btn.addEventListener('click', () => this.startLevel(lv));
      list.appendChild(btn);
    }

    // 键盘输入
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (this.MAIN_KEYS.includes(e.code)) {
        e.preventDefault();
        if (this.state === 'game') Game.press('main');
        else if (this.state === 'title') this.showSelect();
      } else if (this.ALT_KEYS.includes(e.code)) {
        e.preventDefault();
        if (this.state === 'game' && Game.level && Game.level.usesAlt) Game.press('alt');
      } else if (e.code === 'Escape' && this.state === 'game') {
        Game.stop();
        this.showSelect();
      }
    });
    window.addEventListener('keyup', (e) => {
      if (this.MAIN_KEYS.includes(e.code) && this.state === 'game') Game.release('main');
    });
    // 触屏 / 鼠标
    this.canvas.addEventListener('pointerdown', () => {
      if (this.state === 'game') Game.press('main');
    });
    window.addEventListener('pointerup', () => {
      if (this.state === 'game') Game.release('main');
    });

    // 渲染主循环
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (this.state === 'game') {
        Game.update(dt);
        Game.draw(this.ctx);
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  },

  fitCanvas() {
    const scale = Math.min(window.innerWidth / 960, window.innerHeight / 540) * 0.96;
    this.canvas.style.width = (960 * scale) + 'px';
    this.canvas.style.height = (540 * scale) + 'px';
  },

  show(id) {
    for (const s of ['screen-title', 'screen-select', 'screen-result']) {
      document.getElementById(s).classList.toggle('hidden', s !== id);
    }
    document.getElementById('hud-tip').classList.toggle('hidden', id !== null);
  },

  showSelect() {
    this.state = 'select';
    this.show('screen-select');
    this.renderBest();
  },

  renderBest() {
    for (const lv of Levels) {
      const el = document.querySelector('.lv-best[data-lv="' + lv.id + '"]');
      if (el) el.textContent = this.best[lv.id] ? '最佳评级：' + this.best[lv.id] : '';
    }
  },

  startLevel(lv) {
    this.currentLevel = lv;
    this.state = 'game';
    this.show(null);
    // 每关的操作提示
    document.getElementById('hud-tip').textContent =
      lv.hint || '空格 / 点击 = 击打 · Esc = 退出';
    AudioEngine.init();
    AudioEngine.resume();
    Game.start(lv, (stats) => this.showResult(stats));
  },

  showResult(stats) {
    this.state = 'result';
    const order = ['C', 'B', 'A', 'S'];
    const prev = this.best[stats.level.id];
    if (!prev || order.indexOf(stats.rank) > order.indexOf(prev)) {
      this.best[stats.level.id] = stats.rank;
    }
    const rankEl = document.getElementById('result-rank');
    rankEl.textContent = stats.rank;
    rankEl.className = 'rank-' + stats.rank;
    document.getElementById('result-comment').textContent = stats.comment;
    document.getElementById('result-stats').innerHTML =
      '命中率 <b>' + Math.round(stats.acc * 100) + '%</b><br>' +
      'PERFECT <b>' + stats.judges.perfect + '</b> · GOOD <b>' + stats.judges.good + '</b> · MISS <b>' + stats.judges.miss + '</b><br>' +
      '最大连击 <b>' + stats.maxCombo + '</b>';
    this.show('screen-result');
  }
};

window.addEventListener('DOMContentLoaded', () => Main.init());

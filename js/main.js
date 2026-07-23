/* main.js — 启动、屏幕流转（标题 → 选关 → 难度选择 → 游戏 → 结算）、输入绑定
 *
 * 按键映射：
 *   主键（击打/踏步/灌油）：空格 / 回车 / J / 点击画面
 *   副键（双键关专用）：F / K
 *   Esc：退出到选关
 * 难度：easy 简单 / normal 普通 / hard 困难，各关最佳评级按 关卡+模式 分别记录。
 */
'use strict';

const Main = {
  state: 'title',
  canvas: null,
  ctx: null,
  currentLevel: null,
  currentMode: 'easy',
  best: {}, // key: levelId:mode → 最佳评级
  isTouch: ('ontouchstart' in window) || navigator.maxTouchPoints > 0,

  MAIN_KEYS: ['Space', 'Enter', 'KeyJ'],
  ALT_KEYS: ['KeyF', 'KeyK'],
  MODE_NAMES: { easy: '简单', normal: '普通', hard: '困难' },

  init() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    document.body.classList.toggle('is-touch', this.isTouch);
    this.fitCanvas();
    window.addEventListener('resize', () => this.fitCanvas());

    // 横屏提示的两个选择：强制横屏（CSS 旋转）/ 竖屏继续
    document.getElementById('btn-force-landscape').addEventListener('click', () => {
      document.body.classList.add('force-landscape');
      this.fitCanvas();
    });
    document.getElementById('btn-portrait-continue').addEventListener('click', () => {
      document.body.classList.add('allow-portrait');
      this.fitCanvas();
    });

    // 浏览器自动播放策略：必须在用户手势后创建/恢复 AudioContext
    const unlock = () => { AudioEngine.init(); AudioEngine.resume(); };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    document.getElementById('btn-start').addEventListener('click', () => this.showSelect());
    document.getElementById('btn-retry').addEventListener('click', () => this.startLevel(this.currentLevel, this.currentMode));
    document.getElementById('btn-back').addEventListener('click', () => this.showSelect());
    document.getElementById('btn-diff-back').addEventListener('click', () => this.showSelect());
    // 难度按钮
    document.querySelectorAll('.btn-diff').forEach(btn => {
      btn.addEventListener('click', () => this.startLevel(this.currentLevel, btn.dataset.mode));
    });

    // 生成选关卡片
    const list = document.getElementById('level-list');
    for (const lv of Levels) {
      const btn = document.createElement('button');
      btn.className = 'level-card';
      btn.innerHTML =
        '<div class="lv-name">' + lv.name + '</div>' +
        '<div class="lv-desc">' + lv.desc + '</div>' +
        '<div class="lv-best" data-lv="' + lv.id + '"></div>';
      btn.addEventListener('click', () => this.showDiff(lv));
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
      } else if (e.code === 'Escape') {
        if (this.state === 'game') { Game.stop(); this.showSelect(); }
        else if (this.state === 'diff') this.showSelect();
      }
    });
    window.addEventListener('keyup', (e) => {
      if (this.MAIN_KEYS.includes(e.code) && this.state === 'game') Game.release('main');
    });
    // 触屏 / 鼠标：按 pointerId 跟踪（支持多点触控与长按）
    this.touchKeys = new Map();
    this.canvas.addEventListener('pointerdown', (e) => {
      if (this.state !== 'game') return;
      e.preventDefault();
      let key = 'main';
      // 双键关的触屏分区：左半屏 = 副键(F)，右半屏 = 主键(空格)
      if (this.isTouch && Game.level && Game.level.usesAlt) {
        const rect = this.canvas.getBoundingClientRect();
        if (document.body.classList.contains('force-landscape')) {
          // 画面顺时针旋转 90°：用户看到的"左半屏"对应原始画布的下半部分
          key = (e.clientY - rect.top) > rect.height / 2 ? 'alt' : 'main';
        } else {
          key = (e.clientX - rect.left) < rect.width / 2 ? 'alt' : 'main';
        }
      }
      this.touchKeys.set(e.pointerId, key);
      Game.press(key);
    }, { passive: false });
    const releasePointer = (e) => {
      if (!this.touchKeys.has(e.pointerId)) return;
      const key = this.touchKeys.get(e.pointerId);
      this.touchKeys.delete(e.pointerId);
      if (this.state === 'game' && key === 'main') Game.release('main');
    };
    window.addEventListener('pointerup', releasePointer);
    window.addEventListener('pointercancel', releasePointer); // iOS 长按触发 callout 时会走这里
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

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
    // 以 #app 的布局尺寸为准（强制横屏时 #app 宽高为 100vh/100vw）
    const app = document.getElementById('app');
    const w = app.clientWidth || window.innerWidth;
    const h = app.clientHeight || window.innerHeight;
    const scale = Math.min(w / 960, h / 540) * 0.96;
    this.canvas.style.width = (960 * scale) + 'px';
    this.canvas.style.height = (540 * scale) + 'px';
  },

  show(id) {
    for (const s of ['screen-title', 'screen-select', 'screen-result', 'screen-diff']) {
      document.getElementById(s).classList.toggle('hidden', s !== id);
    }
    document.getElementById('hud-tip').classList.toggle('hidden', id !== null);
  },

  showSelect() {
    this.state = 'select';
    this.show('screen-select');
    this.renderBest();
    // 离开游戏时退出全屏
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  },

  // 难度选择
  showDiff(lv) {
    this.currentLevel = lv;
    this.state = 'diff';
    document.getElementById('diff-title').textContent = lv.name;
    document.getElementById('diff-desc').textContent = lv.desc;
    const parts = [];
    for (const m of ['easy', 'normal', 'hard']) {
      const b = this.best[lv.id + ':' + m];
      parts.push(this.MODE_NAMES[m] + ' ' + (b || '—'));
    }
    document.getElementById('diff-best').textContent = '最佳：' + parts.join(' · ');
    this.show('screen-diff');
  },

  renderBest() {
    for (const lv of Levels) {
      const el = document.querySelector('.lv-best[data-lv="' + lv.id + '"]');
      if (!el) continue;
      const parts = [];
      for (const m of ['easy', 'normal', 'hard']) {
        const b = this.best[lv.id + ':' + m];
        if (b) parts.push(this.MODE_NAMES[m] + ' ' + b);
      }
      el.textContent = parts.length ? '最佳：' + parts.join(' · ') : '';
    }
  },

  startLevel(lv, mode) {
    this.currentLevel = lv;
    this.currentMode = mode || 'easy';
    this.state = 'game';
    this.show(null);
    // 每关的操作提示
    document.getElementById('hud-tip').textContent =
      lv.hint || '空格 / 点击 = 击打 · Esc = 退出';
    // 触屏：双键关显示左右分区提示
    const zl = document.getElementById('zone-left');
    const zr = document.getElementById('zone-right');
    if (this.isTouch && lv.usesAlt) {
      zl.textContent = lv.altLabel || 'F';
      zr.textContent = lv.mainLabel || '空格';
      zl.classList.remove('hidden');
      zr.classList.remove('hidden');
    } else {
      zl.classList.add('hidden');
      zr.classList.add('hidden');
    }
    // 触屏设备尝试进入全屏并锁定横屏（iOS Safari 不支持则静默失败，由 CSS 提示兜底）
    if (this.isTouch) {
      const el = document.documentElement;
      const lock = () => {
        if (screen.orientation && screen.orientation.lock) {
          screen.orientation.lock('landscape').catch(() => {});
        }
      };
      if (el.requestFullscreen) {
        el.requestFullscreen().then(lock).catch(lock);
      } else {
        lock();
      }
    }
    AudioEngine.init();
    AudioEngine.resume();
    Game.start(lv, (stats) => this.showResult(stats), this.currentMode);
  },

  showResult(stats) {
    this.state = 'result';
    const order = ['C', 'B', 'A', 'S'];
    const key = stats.level.id + ':' + this.currentMode;
    const prev = this.best[key];
    if (!prev || order.indexOf(stats.rank) > order.indexOf(prev)) {
      this.best[key] = stats.rank;
    }
    const rankEl = document.getElementById('result-rank');
    rankEl.textContent = stats.rank;
    rankEl.className = 'rank-' + stats.rank;
    document.getElementById('result-mode').textContent =
      stats.level.name + ' · ' + this.MODE_NAMES[this.currentMode] + '模式';
    document.getElementById('result-comment').textContent = stats.comment;
    document.getElementById('result-stats').innerHTML =
      '命中率 <b>' + Math.round(stats.acc * 100) + '%</b><br>' +
      'PERFECT <b>' + stats.judges.perfect + '</b> · GOOD <b>' + stats.judges.good + '</b> · MISS <b>' + stats.judges.miss + '</b><br>' +
      '最大连击 <b>' + stats.maxCombo + '</b>';
    this.show('screen-result');
  }
};

window.addEventListener('DOMContentLoaded', () => Main.init());

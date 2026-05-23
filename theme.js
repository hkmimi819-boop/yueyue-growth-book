/**
 * 主题与品牌：男宝蓝色 / 女宝粉色，动态书名
 */
(function (global) {
  'use strict';

  const THEMES = {
    boy: {
      bg: '#f4f9fc',
      primary: '#6eb5e8',
      primaryLight: '#e3f2fc',
      primaryDark: '#4a90c8',
      sky: '#b8dff5',
      cloud: '#d8ecf8',
      chartHeight: '#6eb5e8',
      chartWeight: '#5eb8d4',
      shadow: 'rgba(74, 144, 200, 0.12)',
      btnShadow: 'rgba(74, 144, 200, 0.35)',
    },
    girl: {
      bg: '#fff8fa',
      primary: '#ff9eb5',
      primaryLight: '#ffe4ec',
      primaryDark: '#e86b8a',
      sky: '#ffd4b8',
      cloud: '#f8e0ec',
      chartHeight: '#ff9eb5',
      chartWeight: '#e8a0c8',
      shadow: 'rgba(232, 107, 138, 0.12)',
      btnShadow: 'rgba(232, 107, 138, 0.35)',
    },
  };

  const DEFAULT_NAME = '宝宝';

  function normalizeName(name) {
    const n = (name || '').trim();
    return n || DEFAULT_NAME;
  }

  function bookTitle(name) {
    return `${normalizeName(name)}的成长记录本`;
  }

  function applyTheme(gender) {
    const g = gender === 'girl' ? 'girl' : 'boy';
    const t = THEMES[g];
    const root = document.documentElement;

    root.dataset.theme = g;
    root.style.setProperty('--bg', t.bg);
    root.style.setProperty('--primary', t.primary);
    root.style.setProperty('--primary-light', t.primaryLight);
    root.style.setProperty('--primary-dark', t.primaryDark);
    root.style.setProperty('--sky', t.sky);
    root.style.setProperty('--cloud', t.cloud);
    root.style.setProperty('--shadow', `0 4px 20px ${t.shadow}`);
    root.style.setProperty('--btn-shadow', `0 4px 14px ${t.btnShadow}`);
    root.style.setProperty('--chart-height', t.chartHeight);
    root.style.setProperty('--chart-weight', t.chartWeight);

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = t.bg;
  }

  function applyBranding(babyName) {
    const title = bookTitle(babyName);
    document.title = title;

    document.querySelectorAll('[data-book-title]').forEach((el) => {
      el.textContent = title;
    });
  }

  function apply(gender, babyName) {
    applyTheme(gender);
    applyBranding(babyName);
  }

  function getChartColors() {
    const s = getComputedStyle(document.documentElement);
    return {
      height: s.getPropertyValue('--chart-height').trim() || '#6eb5e8',
      weight: s.getPropertyValue('--chart-weight').trim() || '#5eb8d4',
    };
  }

  function previewRegister(name, gender) {
    applyTheme(gender);
    applyBranding(name);
  }

  global.BabyBookTheme = {
    apply,
    applyTheme,
    applyBranding,
    bookTitle,
    normalizeName,
    previewRegister,
    getChartColors,
    DEFAULT_NAME,
  };
})(window);

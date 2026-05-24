(function () {
  'use strict';

  function loadData() {
    return window.BabyBookStore.getCache();
  }

  function saveData(data) {
    window.BabyBookStore.saveData(data);
  }

  const PRESET_MILESTONES = [
    { id: 'smile', name: '第一次微笑', emoji: '😊', ageHint: '约 6-8 周' },
    { id: 'sound', name: '第一次发声', emoji: '👶', ageHint: '约 4-6 周' },
    { id: 'giggle', name: '第一次咯咯笑', emoji: '😄', ageHint: '约 2-3 月' },
    { id: 'headup', name: '第一次抬头', emoji: '💪', ageHint: '约 1-2 月' },
    { id: 'grasp', name: '第一次抓握', emoji: '✊', ageHint: '约 2-3 月' },
    { id: 'roll', name: '第一次翻身', emoji: '🔄', ageHint: '约 3-5 月' },
    { id: 'recognize', name: '第一次认人', emoji: '👀', ageHint: '约 2-3 月' },
    { id: 'babble', name: '第一次咿呀学语', emoji: '🗣️', ageHint: '约 4-5 月' },
    { id: 'sit', name: '第一次独坐', emoji: '🪑', ageHint: '约 5-6 月' },
    { id: 'solid', name: '第一次吃辅食', emoji: '🥣', ageHint: '约 4-6 月' },
    { id: 'tooth', name: '第一颗小牙', emoji: '🦷', ageHint: '约 4-7 月' },
    { id: 'crawl', name: '第一次爬行', emoji: '🐛', ageHint: '约 6-10 月' },
  ];

  let growthChart = null;
  let calYear = new Date().getFullYear();
  let calMonth = new Date().getMonth();
  let selectedCalDate = null;
  let pendingPhoto = null;
  let feedingView = 'record';
  let feedingDayDate = '';
  let feedingMonthYear = new Date().getFullYear();
  let feedingMonthMonth = new Date().getMonth();

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function todayStr() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function localDateFromIso(iso) {
    if (!iso) return '';
    if (/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso.slice(0, 10);
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function formatDateCN(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return `${y}年${parseInt(m, 10)}月${parseInt(d, 10)}日`;
  }

  function formatDateTime(iso) {
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function isToday(dateStr) {
    return dateStr === todayStr();
  }

  function isSameDay(iso, dayStr) {
    return localDateFromIso(iso) === dayStr;
  }

  function feedingRecordHtml(f) {
    return `
      <li class="record-item">
        <div class="record-main">
          <div class="record-date">${formatDateTime(f.time)}</div>
          <div class="record-meta">
            <span class="record-badge">${f.method}</span>
            ${f.amount} ml
          </div>
        </div>
        <button type="button" class="record-delete" data-id="${f.id}" aria-label="删除">×</button>
      </li>`;
  }

  function bindFeedingDelete(listEl) {
    listEl.querySelectorAll('.record-delete').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!confirm('确定删除这条喂奶记录吗？')) return;
        const d = loadData();
        d.feeding = d.feeding.filter((x) => x.id !== btn.dataset.id);
        saveData(d);
        renderFeeding();
      });
    });
  }

  /* ——— Tabs ——— */
  function initTabs() {
    document.querySelectorAll('.tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        const id = tab.dataset.tab;
        document.querySelectorAll('.tab').forEach((t) => {
          t.classList.toggle('active', t === tab);
          t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
        });
        document.querySelectorAll('.panel').forEach((p) => {
          const active = p.id === `panel-${id}`;
          p.classList.toggle('active', active);
          p.hidden = !active;
        });
        if (id === 'growth') renderGrowthChart();
        if (id === 'feeding') renderFeeding();
        if (id === 'health' && window.BabyBookHealth) window.BabyBookHealth.refresh();
        if (id === 'milestones') renderMilestones();
        if (id === 'diary') renderDiaryWrite();
      });
    });
  }

  /* ——— Growth ——— */
  function initGrowth() {
    const dateInput = document.getElementById('growth-date');
    dateInput.value = todayStr();
    dateInput.max = todayStr();

    document.getElementById('growth-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const data = loadData();
      const headRaw = document.getElementById('growth-head').value.trim();
      const entry = {
        id: uid(),
        date: document.getElementById('growth-date').value,
        height: parseFloat(document.getElementById('growth-height').value),
        weight: parseFloat(document.getElementById('growth-weight').value),
      };
      if (headRaw) entry.head = parseFloat(headRaw);
      data.growth.push(entry);
      data.growth.sort((a, b) => a.date.localeCompare(b.date));
      saveData(data);
      e.target.reset();
      document.getElementById('growth-date').value = todayStr();
      renderGrowthList();
      renderGrowthChart();
    });

    renderGrowthList();
    renderGrowthChart();
  }

  function renderGrowthList() {
    const list = document.getElementById('growth-list');
    const data = loadData();
    const sorted = [...data.growth].sort((a, b) => b.date.localeCompare(a.date));

    list.innerHTML = sorted
      .map(
        (r) => `
      <li class="record-item">
        <div class="record-main">
          <div class="record-date">${formatDateCN(r.date)}</div>
          <div class="record-meta">身高 ${r.height} cm · 体重 ${r.weight} kg${r.head != null && !Number.isNaN(r.head) ? ` · 头围 ${r.head} cm` : ''}</div>
        </div>
        <button type="button" class="record-delete" data-id="${r.id}" aria-label="删除">×</button>
      </li>`
      )
      .join('');

    list.querySelectorAll('.record-delete').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!confirm('确定删除这条记录吗？')) return;
        const d = loadData();
        d.growth = d.growth.filter((x) => x.id !== btn.dataset.id);
        saveData(d);
        renderGrowthList();
        renderGrowthChart();
      });
    });
  }

  function renderGrowthChart() {
    const canvas = document.getElementById('growth-chart');
    const hint = document.getElementById('chart-hint');
    if (!canvas || !hint) return;

    const records = [...loadData().growth].sort((a, b) => a.date.localeCompare(b.date));

    if (typeof window.Chart === 'undefined') {
      hint.textContent = '图表库未加载，请刷新页面或检查网络';
      hint.classList.remove('hidden');
      return;
    }

    if (records.length === 0) {
      hint.textContent = '添加记录后即可查看曲线';
      hint.classList.remove('hidden');
      if (growthChart) {
        growthChart.destroy();
        growthChart = null;
      }
      return;
    }

    hint.classList.add('hidden');
    const labels = records.map((r) => {
      const [, m, d] = r.date.split('-');
      return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
    });

    if (growthChart) growthChart.destroy();

    const colors = window.BabyBookTheme?.getChartColors() || {
      height: '#6eb5e8',
      weight: '#5eb8d4',
      head: '#8bc9a0',
    };

    const hexToRgba = (hex, a) => {
      const h = hex.replace('#', '');
      const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
      const r = (n >> 16) & 255;
      const g = (n >> 8) & 255;
      const b = n & 255;
      return `rgba(${r},${g},${b},${a})`;
    };

    const hasHead = records.some((r) => r.head != null && !Number.isNaN(r.head));
    const datasets = [
      {
        label: '身高 (cm)',
        data: records.map((r) => r.height),
        borderColor: colors.height,
        backgroundColor: hexToRgba(colors.height, 0.15),
        tension: 0.35,
        fill: true,
        yAxisID: 'y',
      },
      {
        label: '体重 (kg)',
        data: records.map((r) => r.weight),
        borderColor: colors.weight,
        backgroundColor: hexToRgba(colors.weight, 0.15),
        tension: 0.35,
        fill: true,
        yAxisID: 'y1',
      },
    ];

    const scales = {
      y: {
        type: 'linear',
        position: 'left',
        title: { display: true, text: 'cm', color: colors.height },
        grid: { color: hexToRgba(colors.height, 0.12) },
      },
      y1: {
        type: 'linear',
        position: 'right',
        title: { display: true, text: 'kg', color: colors.weight },
        grid: { drawOnChartArea: false },
      },
    };

    if (hasHead) {
      datasets.push({
        label: '头围 (cm)',
        data: records.map((r) => (r.head != null && !Number.isNaN(r.head) ? r.head : null)),
        borderColor: colors.head,
        backgroundColor: hexToRgba(colors.head, 0.12),
        tension: 0.35,
        fill: false,
        yAxisID: 'y2',
        spanGaps: true,
      });
      scales.y2 = {
        type: 'linear',
        position: 'right',
        offset: true,
        title: { display: true, text: '头围', color: colors.head },
        grid: { drawOnChartArea: false },
      };
    }

    growthChart = new Chart(canvas, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 12, padding: 14, font: { family: "'Noto Sans SC'" } },
          },
        },
        scales,
      },
    });
  }

  /* ——— Feeding ——— */
  function setFeedingView(view) {
    feedingView = view;
    document.querySelectorAll('#panel-feeding .feeding-view-toggle .toggle-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.feedingView === view);
    });
    document.getElementById('feeding-record-view').hidden = view !== 'record';
    document.getElementById('feeding-day-view').hidden = view !== 'day';
    document.getElementById('feeding-month-view').hidden = view !== 'month';
    renderFeeding();
  }

  function initFeeding() {
    feedingDayDate = todayStr();
    const filterDate = document.getElementById('feeding-filter-date');
    filterDate.value = feedingDayDate;
    filterDate.max = todayStr();

    const timeInput = document.getElementById('feeding-time');
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    timeInput.value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;

    document.querySelectorAll('#panel-feeding .feeding-view-toggle .toggle-btn').forEach((btn) => {
      btn.addEventListener('click', () => setFeedingView(btn.dataset.feedingView));
    });

    filterDate.addEventListener('change', () => {
      feedingDayDate = filterDate.value;
      renderFeeding();
    });

    document.getElementById('feeding-month-prev').addEventListener('click', () => {
      feedingMonthMonth--;
      if (feedingMonthMonth < 0) {
        feedingMonthMonth = 11;
        feedingMonthYear--;
      }
      renderFeeding();
    });

    document.getElementById('feeding-month-next').addEventListener('click', () => {
      feedingMonthMonth++;
      if (feedingMonthMonth > 11) {
        feedingMonthMonth = 0;
        feedingMonthYear++;
      }
      renderFeeding();
    });

    document.getElementById('feeding-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const data = loadData();
      data.feeding.unshift({
        id: uid(),
        time: document.getElementById('feeding-time').value,
        method: document.querySelector('input[name="feeding-method"]:checked').value,
        amount: parseInt(document.getElementById('feeding-amount').value, 10),
      });
      saveData(data);
      const n = new Date();
      timeInput.value = `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}T${pad(n.getHours())}:${pad(n.getMinutes())}`;
      document.getElementById('feeding-amount').value = '';
      renderFeeding();
    });

    renderFeeding();
  }

  function renderFeedingMonth(data) {
    const today = todayStr();
    const daysInMonth = new Date(feedingMonthYear, feedingMonthMonth + 1, 0).getDate();
    const monthPad = String(feedingMonthMonth + 1).padStart(2, '0');

    document.getElementById('feeding-month-title').textContent =
      `${feedingMonthYear}年${feedingMonthMonth + 1}月`;

    let monthCount = 0;
    let monthTotal = 0;
    const rows = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const dayStr = `${feedingMonthYear}-${monthPad}-${String(d).padStart(2, '0')}`;
      const dayRecords = data.feeding.filter((f) => isSameDay(f.time, dayStr));
      const count = dayRecords.length;
      const total = dayRecords.reduce((s, f) => s + f.amount, 0);
      monthCount += count;
      monthTotal += total;

      const isToday = dayStr === today;
      const empty = count === 0;
      rows.push(`
        <button type="button" class="feeding-month-row ${isToday ? 'today' : ''} ${empty ? 'empty' : ''}"
          data-date="${dayStr}" ${empty ? 'disabled' : ''}>
          <span class="col-day">${d}日${isToday ? ' · 今天' : ''}</span>
          <span class="col-meta">${count}次</span>
          <span class="col-meta">${total} ml</span>
        </button>`);
    }

    document.getElementById('feeding-month-summary').textContent =
      `本月共 ${monthCount} 次，总量 ${monthTotal} ml`;

    const table = document.getElementById('feeding-month-table');
    table.innerHTML = rows.join('');

    table.querySelectorAll('.feeding-month-row:not(.empty)').forEach((btn) => {
      btn.addEventListener('click', () => {
        feedingDayDate = btn.dataset.date;
        document.getElementById('feeding-filter-date').value = feedingDayDate;
        setFeedingView('day');
      });
    });
  }

  function renderFeeding() {
    const data = loadData();
    const today = todayStr();
    let statsRecords;
    let countLabel;
    let totalLabel;

    if (feedingView === 'day') {
      const day = feedingDayDate || today;
      statsRecords = data.feeding.filter((f) => isSameDay(f.time, day));
      const label = day === today ? '今日' : formatDateCN(day);
      countLabel = `${label}次数`;
      totalLabel = `${label}总量 (ml)`;
    } else if (feedingView === 'month') {
      const monthPad = String(feedingMonthMonth + 1).padStart(2, '0');
      statsRecords = data.feeding.filter((f) => localDateFromIso(f.time).slice(0, 7) === `${feedingMonthYear}-${monthPad}`);
      countLabel = '本月次数';
      totalLabel = '本月总量 (ml)';
    } else {
      statsRecords = data.feeding.filter((f) => isSameDay(f.time, today));
      countLabel = '今日次数';
      totalLabel = '今日总量 (ml)';
    }

    document.getElementById('feeding-count').textContent = statsRecords.length;
    document.getElementById('feeding-total').textContent = statsRecords.reduce((s, f) => s + f.amount, 0);
    document.getElementById('feeding-count-label').textContent = countLabel;
    document.getElementById('feeding-total-label').textContent = totalLabel;

    if (feedingView === 'record') {
      const list = document.getElementById('feeding-list');
      const recent = data.feeding.slice(0, 20);
      list.innerHTML = recent.length ? recent.map(feedingRecordHtml).join('') : '<li class="empty-hint">暂无记录</li>';
      bindFeedingDelete(list);
    } else if (feedingView === 'day') {
      const day = feedingDayDate || today;
      const dayRecords = data.feeding
        .filter((f) => isSameDay(f.time, day))
        .sort((a, b) => new Date(b.time) - new Date(a.time));
      const list = document.getElementById('feeding-day-list');
      list.innerHTML = dayRecords.length
        ? dayRecords.map(feedingRecordHtml).join('')
        : '<li class="empty-hint">这一天还没有喂奶记录</li>';
      bindFeedingDelete(list);
    } else if (feedingView === 'month') {
      renderFeedingMonth(data);
    }
  }

  /* ——— Milestones ——— */
  function getMilestoneState(data, preset) {
    return data.milestones[preset.id] || { achieved: false, date: '', note: '' };
  }

  function initMilestones() {
    const dialog = document.getElementById('milestone-dialog');
    const form = document.getElementById('milestone-form');

    document.getElementById('milestone-cancel').addEventListener('click', () => dialog.close());
    document.getElementById('milestone-unachieve').addEventListener('click', () => {
      const id = document.getElementById('milestone-id').value;
      const data = loadData();
      delete data.milestones[id];
      saveData(data);
      dialog.close();
      renderMilestones();
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = document.getElementById('milestone-id').value;
      const date = document.getElementById('milestone-date').value;
      if (!date) {
        alert('请选择达成日期');
        return;
      }
      const data = loadData();
      data.milestones[id] = {
        achieved: true,
        date,
        note: document.getElementById('milestone-note').value.trim(),
      };
      saveData(data);
      dialog.close();
      renderMilestones();
    });

    renderMilestones();
  }

  function renderMilestones() {
    const data = loadData();
    const list = document.getElementById('milestone-list');
    const dialog = document.getElementById('milestone-dialog');

    list.innerHTML = PRESET_MILESTONES.map((preset) => {
      const state = getMilestoneState(data, preset);
      const achieved = state.achieved;
      let info = preset.ageHint;
      if (achieved) {
        info = formatDateCN(state.date);
        if (state.note) info += ` · ${state.note}`;
      }
      return `
        <li class="milestone-item ${achieved ? 'achieved' : ''}" data-id="${preset.id}">
          <span class="milestone-check">${achieved ? '✓' : ''}</span>
          <div class="milestone-body">
            <div class="milestone-name">${preset.name}</div>
            <div class="milestone-info">${info}</div>
          </div>
          <span class="milestone-emoji">${preset.emoji}</span>
        </li>`;
    }).join('');

    list.querySelectorAll('.milestone-item').forEach((item) => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        const preset = PRESET_MILESTONES.find((m) => m.id === id);
        const state = getMilestoneState(loadData(), preset);

        document.getElementById('milestone-id').value = id;
        document.getElementById('milestone-dialog-title').textContent = preset.name;
        document.getElementById('milestone-date').value = state.date || todayStr();
        document.getElementById('milestone-date').max = todayStr();
        document.getElementById('milestone-note').value = state.note || '';
        document.getElementById('milestone-unachieve').hidden = !state.achieved;

        dialog.showModal();
      });
    });
  }

  /* ——— Diary ——— */
  function initDiary() {
    document.getElementById('diary-date').value = todayStr();
    document.getElementById('diary-date-title').textContent = '今日心情';

    document.querySelectorAll('.mood-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.mood-btn').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        document.getElementById('diary-mood').value = btn.dataset.mood;
      });
    });
    document.querySelector('.mood-btn[data-mood="😊"]').classList.add('selected');

    document.getElementById('diary-photo').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      const input = e.target;
      if (!file) return;
      const preview = document.getElementById('diary-photo-preview');
      preview.hidden = false;
      preview.innerHTML = '<p class="photo-loading">正在压缩照片…</p>';
      try {
        if (!window.BabyBookImage) throw new Error('图片模块未加载');
        pendingPhoto = await window.BabyBookImage.compress(file);
        preview.innerHTML = `<img src="${pendingPhoto}" alt="预览">`;
        document.getElementById('diary-photo-clear').hidden = false;
      } catch (err) {
        pendingPhoto = null;
        preview.hidden = true;
        input.value = '';
        alert(err.message || '照片处理失败，请换一张试试');
      }
    });

    document.getElementById('diary-photo-clear').addEventListener('click', () => {
      pendingPhoto = null;
      document.getElementById('diary-photo').value = '';
      document.getElementById('diary-photo-preview').hidden = true;
      document.getElementById('diary-photo-clear').hidden = true;
    });

    document.getElementById('diary-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const date = document.getElementById('diary-date').value || todayStr();
      const data = loadData();
      data.diary[date] = {
        mood: document.getElementById('diary-mood').value,
        text: document.getElementById('diary-text').value.trim(),
        photo: pendingPhoto || (data.diary[date] && data.diary[date].photo) || null,
      };
      saveData(data);
      alert('日记已保存 💕');
      renderCalendar();
    });

    document.querySelectorAll('#panel-diary .view-toggle .toggle-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        document.querySelectorAll('#panel-diary .view-toggle .toggle-btn').forEach((b) => {
          b.classList.toggle('active', b === btn);
        });
        document.getElementById('diary-write').hidden = view !== 'write';
        document.getElementById('diary-calendar').hidden = view !== 'calendar';
        if (view === 'calendar') renderCalendar();
        else renderDiaryWrite();
      });
    });

    document.getElementById('cal-prev').addEventListener('click', () => {
      calMonth--;
      if (calMonth < 0) {
        calMonth = 11;
        calYear--;
      }
      renderCalendar();
    });

    document.getElementById('cal-next').addEventListener('click', () => {
      calMonth++;
      if (calMonth > 11) {
        calMonth = 0;
        calYear++;
      }
      renderCalendar();
    });

    renderDiaryWrite();
  }

  function renderDiaryWrite() {
    const date = todayStr();
    document.getElementById('diary-date').value = date;
    const entry = loadData().diary[date];
    if (entry) {
      document.getElementById('diary-mood').value = entry.mood;
      document.querySelectorAll('.mood-btn').forEach((b) => {
        b.classList.toggle('selected', b.dataset.mood === entry.mood);
      });
      document.getElementById('diary-text').value = entry.text || '';
      pendingPhoto = entry.photo || null;
      const preview = document.getElementById('diary-photo-preview');
      if (entry.photo) {
        preview.hidden = false;
        preview.innerHTML = `<img src="${entry.photo}" alt="预览">`;
        document.getElementById('diary-photo-clear').hidden = false;
      } else {
        preview.hidden = true;
        document.getElementById('diary-photo-clear').hidden = true;
      }
    } else {
      document.getElementById('diary-text').value = '';
      pendingPhoto = null;
      document.getElementById('diary-photo-preview').hidden = true;
      document.getElementById('diary-photo-clear').hidden = true;
      document.querySelectorAll('.mood-btn').forEach((b) => b.classList.remove('selected'));
      document.querySelector('.mood-btn[data-mood="😊"]').classList.add('selected');
      document.getElementById('diary-mood').value = '😊';
    }
  }

  function renderCalendar() {
    const data = loadData();
    document.getElementById('cal-title').textContent = `${calYear}年${calMonth + 1}月`;

    const firstDay = new Date(calYear, calMonth, 1);
    const lastDay = new Date(calYear, calMonth + 1, 0);
    const startPad = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const prevLast = new Date(calYear, calMonth, 0).getDate();
    const grid = document.getElementById('cal-grid');
    const cells = [];
    const today = todayStr();

    for (let i = startPad - 1; i >= 0; i--) {
      const d = prevLast - i;
      const m = calMonth === 0 ? 12 : calMonth;
      const y = calMonth === 0 ? calYear - 1 : calYear;
      cells.push({ day: d, date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, other: true });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ day: d, date, other: false });
    }

    const remain = 42 - cells.length;
    for (let d = 1; d <= remain; d++) {
      const m = calMonth === 11 ? 1 : calMonth + 2;
      const y = calMonth === 11 ? calYear + 1 : calYear;
      cells.push({ date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, day: d, other: true });
    }

    grid.innerHTML = cells
      .map((c) => {
        const entry = data.diary[c.date];
        const hasEntry = !!entry;
        const isToday = c.date === today;
        const selected = c.date === selectedCalDate;
        return `
        <button type="button" class="cal-day ${c.other ? 'other-month' : ''} ${isToday ? 'today' : ''} ${hasEntry ? 'has-entry' : ''} ${selected ? 'selected' : ''}"
          data-date="${c.date}">
          ${c.day}
          ${hasEntry ? `<span class="cal-day-mood">${entry.mood}</span>` : ''}
        </button>`;
      })
      .join('');

    grid.querySelectorAll('.cal-day').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedCalDate = btn.dataset.date;
        renderCalendar();
        showCalDetail(btn.dataset.date);
      });
    });

    if (selectedCalDate) showCalDetail(selectedCalDate);
  }

  function showCalDetail(date) {
    const entry = loadData().diary[date];
    const detail = document.getElementById('cal-detail');
    if (!entry) {
      detail.hidden = true;
      return;
    }
    detail.hidden = false;
    document.getElementById('cal-detail-date').textContent = formatDateCN(date);
    document.getElementById('cal-detail-mood').textContent = entry.mood;
    document.getElementById('cal-detail-text').textContent = entry.text || '（没有文字记录）';
    const img = document.getElementById('cal-detail-photo');
    if (entry.photo) {
      img.src = entry.photo;
      img.hidden = false;
    } else {
      img.hidden = true;
    }
  }

  /* ——— Init ——— */
  let appStarted = false;
  const bound = { tabs: false, growth: false, feeding: false, health: false, milestones: false, diary: false };

  function refreshAll() {
    renderGrowthList();
    renderGrowthChart();
    renderFeeding();
    if (window.BabyBookHealth) window.BabyBookHealth.refresh();
    renderMilestones();
    renderDiaryWrite();
  }

  function setupApp() {
    if (!bound.tabs) {
      bound.tabs = true;
      initTabs();
    }
    if (!bound.growth) {
      bound.growth = true;
      initGrowth();
    }
    if (!bound.feeding) {
      bound.feeding = true;
      initFeeding();
    }
    if (!bound.health && window.BabyBookHealth) {
      bound.health = true;
      window.BabyBookHealth.init();
    }
    if (!bound.milestones) {
      bound.milestones = true;
      initMilestones();
    }
    if (!bound.diary) {
      bound.diary = true;
      initDiary();
    }
  }

  window.BabyBookApp = {
    async start() {
      setupApp();
      refreshAll();
      appStarted = true;
    },
  };

  async function bootstrap() {
    if (!window.BabyBookStore) return;
    const ready = await window.BabyBookStore.init();
    if (ready) await window.BabyBookApp.start();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})();

/**
 * 健康记录：黄疸、大便、体温、睡眠、用药
 */
(function (global) {
  'use strict';

  let healthSection = 'jaundice';
  let jaundiceChart = null;
  let temperatureChart = null;
  let inited = false;

  function loadData() {
    return global.BabyBookStore.getCache();
  }

  function saveData(data) {
    global.BabyBookStore.saveData(data);
  }

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

  function isSameDay(iso, dayStr) {
    return localDateFromIso(iso) === dayStr;
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

  function setDatetimeLocalValue(input) {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    input.value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }

  function chartLabelFromDate(dateStr) {
    const [, m, d] = dateStr.split('-');
    return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
  }

  function chartLabelFromTime(iso) {
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function hexToRgba(hex, a) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return `rgba(${r},${g},${b},${a})`;
  }

  function sleepMinutes(start, end) {
    const s = new Date(start).getTime();
    let e = new Date(end).getTime();
    if (Number.isNaN(s) || Number.isNaN(e)) return 0;
    if (e <= s) e += 24 * 60 * 60 * 1000;
    return Math.round((e - s) / 60000);
  }

  function formatDuration(minutes) {
    if (!minutes || minutes < 1) return '0分钟';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0) return `${h}小时${m}分`;
    return `${m}分钟`;
  }

  function bindListDelete(listEl, arrayKey, onDelete) {
    listEl.querySelectorAll('.record-delete').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!confirm('确定删除这条记录吗？')) return;
        const d = loadData();
        d[arrayKey] = d[arrayKey].filter((x) => x.id !== btn.dataset.id);
        saveData(d);
        if (onDelete) onDelete();
        else refresh();
      });
    });
  }

  function setHealthSection(section) {
    healthSection = section;
    document.querySelectorAll('#panel-health .health-subnav .toggle-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.health === section);
    });
    document.querySelectorAll('#panel-health .health-section').forEach((el) => {
      el.hidden = el.id !== `health-${section}`;
    });
    refresh();
  }

  function renderJaundice() {
    const data = loadData();
    const sorted = [...data.jaundice].sort((a, b) => a.date.localeCompare(b.date));

    const list = document.getElementById('jaundice-list');
    const recent = [...data.jaundice].sort((a, b) => b.date.localeCompare(a.date));
    list.innerHTML = recent.length
      ? recent
          .map(
            (r) => `
      <li class="record-item">
        <div class="record-main">
          <div class="record-date">${formatDateCN(r.date)}</div>
          <div class="record-meta">${r.value} mg/dL</div>
        </div>
        <button type="button" class="record-delete" data-id="${r.id}" aria-label="删除">×</button>
      </li>`
          )
          .join('')
      : '<li class="empty-hint">暂无记录</li>';
    bindListDelete(list, 'jaundice', () => refresh());

    const canvas = document.getElementById('jaundice-chart');
    const hint = document.getElementById('jaundice-chart-hint');
    if (!canvas || !hint) return;

    if (typeof global.Chart === 'undefined') {
      hint.textContent = '图表库未加载，请刷新页面';
      hint.classList.remove('hidden');
      return;
    }

    if (sorted.length === 0) {
      hint.textContent = '添加记录后即可查看曲线';
      hint.classList.remove('hidden');
      if (jaundiceChart) {
        jaundiceChart.destroy();
        jaundiceChart = null;
      }
      return;
    }

    hint.classList.add('hidden');
    if (jaundiceChart) jaundiceChart.destroy();

    const colors = global.BabyBookTheme?.getChartColors() || { height: '#6eb5e8' };
    jaundiceChart = new global.Chart(canvas, {
      type: 'line',
      data: {
        labels: sorted.map((r) => chartLabelFromDate(r.date)),
        datasets: [
          {
            label: '黄疸 (mg/dL)',
            data: sorted.map((r) => r.value),
            borderColor: colors.height,
            backgroundColor: hexToRgba(colors.height, 0.15),
            tension: 0.35,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { family: "'Noto Sans SC'" } } },
        },
        scales: { y: { beginAtZero: true, title: { display: true, text: 'mg/dL' } } },
      },
    });
  }

  function renderStool() {
    const data = loadData();
    const today = todayStr();
    const todayCount = data.stool.filter((s) => isSameDay(s.time, today)).length;
    document.getElementById('stool-today-count').textContent = todayCount;

    const list = document.getElementById('stool-list');
    const recent = [...data.stool].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 50);
    list.innerHTML = recent.length
      ? recent
          .map(
            (r) => `
      <li class="record-item">
        <div class="record-main">
          <div class="record-date">${formatDateTime(r.time)}</div>
          <div class="record-meta">
            <span class="record-badge">${r.color}</span>
            <span class="record-badge">${r.texture}</span>
          </div>
        </div>
        <button type="button" class="record-delete" data-id="${r.id}" aria-label="删除">×</button>
      </li>`
          )
          .join('')
      : '<li class="empty-hint">暂无记录</li>';
    bindListDelete(list, 'stool');
  }

  function renderTemperature() {
    const data = loadData();
    const sorted = [...data.temperature].sort((a, b) => new Date(a.time) - new Date(b.time));

    const list = document.getElementById('temperature-list');
    const recent = [...data.temperature].sort((a, b) => new Date(b.time) - new Date(a.time));
    list.innerHTML = recent.length
      ? recent
          .map(
            (r) => `
      <li class="record-item ${r.value > 37.5 ? 'record-fever' : ''}">
        <div class="record-main">
          <div class="record-date">${formatDateTime(r.time)}</div>
          <div class="record-meta ${r.value > 37.5 ? 'fever-value' : ''}">${r.value} °C${r.value > 37.5 ? ' · 偏高' : ''}</div>
        </div>
        <button type="button" class="record-delete" data-id="${r.id}" aria-label="删除">×</button>
      </li>`
          )
          .join('')
      : '<li class="empty-hint">暂无记录</li>';
    bindListDelete(list, 'temperature');

    const canvas = document.getElementById('temperature-chart');
    const hint = document.getElementById('temperature-chart-hint');
    if (!canvas || !hint) return;

    if (typeof global.Chart === 'undefined') {
      hint.textContent = '图表库未加载，请刷新页面';
      hint.classList.remove('hidden');
      return;
    }

    if (sorted.length === 0) {
      hint.textContent = '添加记录后即可查看曲线';
      hint.classList.remove('hidden');
      if (temperatureChart) {
        temperatureChart.destroy();
        temperatureChart = null;
      }
      return;
    }

    hint.classList.add('hidden');
    if (temperatureChart) temperatureChart.destroy();

    const feverColor = '#c45c5c';
    const normalColor = (global.BabyBookTheme?.getChartColors() || {}).weight || '#5eb8d4';

    temperatureChart = new global.Chart(canvas, {
      type: 'line',
      data: {
        labels: sorted.map((r) => chartLabelFromTime(r.time)),
        datasets: [
          {
            label: '体温 (°C)',
            data: sorted.map((r) => r.value),
            borderColor: normalColor,
            segment: {
              borderColor: (ctx) => {
                const v = sorted[ctx.p1DataIndex]?.value;
                return v > 37.5 ? feverColor : normalColor;
              },
            },
            pointBackgroundColor: sorted.map((r) => (r.value > 37.5 ? feverColor : normalColor)),
            pointBorderColor: sorted.map((r) => (r.value > 37.5 ? feverColor : normalColor)),
            pointRadius: 5,
            tension: 0.35,
            fill: false,
          },
          {
            label: '37.5°C',
            data: sorted.map(() => 37.5),
            borderColor: 'rgba(196, 92, 92, 0.55)',
            borderDash: [6, 4],
            pointRadius: 0,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { family: "'Noto Sans SC'" } } },
        },
        scales: {
          y: {
            suggestedMin: 35.5,
            suggestedMax: 39,
            title: { display: true, text: '°C' },
          },
        },
      },
    });
  }

  function renderSleep() {
    const data = loadData();
    const today = todayStr();
    let todayMinutes = 0;
    data.sleep.forEach((s) => {
      if (isSameDay(s.end, today)) todayMinutes += sleepMinutes(s.start, s.end);
    });
    document.getElementById('sleep-today-total').textContent = formatDuration(todayMinutes);

    const list = document.getElementById('sleep-list');
    const recent = [...data.sleep].sort((a, b) => new Date(b.end) - new Date(a.end)).slice(0, 50);
    list.innerHTML = recent.length
      ? recent
          .map((r) => {
            const mins = sleepMinutes(r.start, r.end);
            return `
      <li class="record-item">
        <div class="record-main">
          <div class="record-date">${formatDateTime(r.start)} → ${formatDateTime(r.end)}</div>
          <div class="record-meta">睡眠 ${formatDuration(mins)}</div>
        </div>
        <button type="button" class="record-delete" data-id="${r.id}" aria-label="删除">×</button>
      </li>`;
          })
          .join('')
      : '<li class="empty-hint">暂无记录</li>';
    bindListDelete(list, 'sleep');
  }

  function renderMedicine() {
    const data = loadData();
    const list = document.getElementById('medicine-list');
    const recent = [...data.medicine].sort((a, b) => new Date(b.time) - new Date(a.time));
    list.innerHTML = recent.length
      ? recent
          .map(
            (r) => `
      <li class="record-item">
        <div class="record-main">
          <div class="record-date">${formatDateTime(r.time)}</div>
          <div class="record-meta">
            <span class="record-badge">${r.name}</span>
            ${r.dose}
          </div>
        </div>
        <button type="button" class="record-delete" data-id="${r.id}" aria-label="删除">×</button>
      </li>`
          )
          .join('')
      : '<li class="empty-hint">暂无记录</li>';
    bindListDelete(list, 'medicine');
  }

  function refresh() {
    if (healthSection === 'jaundice') renderJaundice();
    else if (healthSection === 'stool') renderStool();
    else if (healthSection === 'temperature') renderTemperature();
    else if (healthSection === 'sleep') renderSleep();
    else if (healthSection === 'medicine') renderMedicine();
  }

  function initHealth() {
    if (inited) {
      refresh();
      return;
    }
    inited = true;

    const jDate = document.getElementById('jaundice-date');
    jDate.value = todayStr();
    jDate.max = todayStr();

    document.querySelectorAll('#panel-health .health-subnav .toggle-btn').forEach((btn) => {
      btn.addEventListener('click', () => setHealthSection(btn.dataset.health));
    });

    document.getElementById('jaundice-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const data = loadData();
      data.jaundice.push({
        id: uid(),
        date: document.getElementById('jaundice-date').value,
        value: parseFloat(document.getElementById('jaundice-value').value),
      });
      data.jaundice.sort((a, b) => a.date.localeCompare(b.date));
      saveData(data);
      document.getElementById('jaundice-value').value = '';
      jDate.value = todayStr();
      refresh();
    });

    const stoolTime = document.getElementById('stool-time');
    setDatetimeLocalValue(stoolTime);
    document.getElementById('stool-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const data = loadData();
      data.stool.unshift({
        id: uid(),
        time: stoolTime.value,
        color: document.querySelector('input[name="stool-color"]:checked').value,
        texture: document.querySelector('input[name="stool-texture"]:checked').value,
      });
      saveData(data);
      setDatetimeLocalValue(stoolTime);
      refresh();
    });

    const tempTime = document.getElementById('temperature-time');
    setDatetimeLocalValue(tempTime);
    document.getElementById('temperature-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const data = loadData();
      const value = parseFloat(document.getElementById('temperature-value').value);
      data.temperature.unshift({ id: uid(), time: tempTime.value, value });
      saveData(data);
      document.getElementById('temperature-value').value = '';
      setDatetimeLocalValue(tempTime);
      refresh();
    });

    const sleepStart = document.getElementById('sleep-start');
    const sleepEnd = document.getElementById('sleep-end');
    setDatetimeLocalValue(sleepStart);
    setDatetimeLocalValue(sleepEnd);
    document.getElementById('sleep-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const start = sleepStart.value;
      const end = sleepEnd.value;
      if (sleepMinutes(start, end) < 1) {
        alert('醒来时间应晚于入睡时间');
        return;
      }
      const data = loadData();
      data.sleep.unshift({ id: uid(), start, end });
      saveData(data);
      setDatetimeLocalValue(sleepStart);
      setDatetimeLocalValue(sleepEnd);
      refresh();
    });

    const medTime = document.getElementById('medicine-time');
    setDatetimeLocalValue(medTime);
    document.getElementById('medicine-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const data = loadData();
      data.medicine.unshift({
        id: uid(),
        name: document.getElementById('medicine-name').value.trim(),
        dose: document.getElementById('medicine-dose').value.trim(),
        time: medTime.value,
      });
      saveData(data);
      document.getElementById('medicine-name').value = '';
      document.getElementById('medicine-dose').value = '';
      setDatetimeLocalValue(medTime);
      refresh();
    });

    refresh();
  }

  global.BabyBookHealth = { init: initHealth, refresh };
})(window);

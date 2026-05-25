/**
 * 成长报告 PDF 导出（jsPDF + autoTable，数据来自解密后的 Supabase 云端缓存）
 */
(function (global) {
  'use strict';

  const FONT_FILE = 'NotoSansCJKjp-Regular.ttf';
  const FONT_NAME = 'NotoSansSC';
  const FEVER_C = 37.5;
  const JAUNDICE_HIGH = 12.9;
  const MARGIN = 14;
  const PAGE_W = 210;
  const PAGE_H = 297;
  const FOOTER_Y = PAGE_H - 12;

  const MODULE_LABELS = {
    growth: '身高体重头围',
    temperature: '体温',
    jaundice: '黄疸',
    stool: '大便',
    sleep: '睡眠',
    medicine: '用药',
  };

  function loadData() {
    return global.BabyBookStore.getCache();
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
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function addMonths(dateStr, months) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setMonth(dt.getMonth() - months);
    const pad = (n) => String(n).padStart(2, '0');
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
  }

  function inRange(day, start, end) {
    return day >= start && day <= end;
  }

  function collectAllDates(data) {
    const dates = [];
    data.growth.forEach((r) => r.date && dates.push(r.date));
    data.jaundice.forEach((r) => r.date && dates.push(r.date));
    data.temperature.forEach((r) => {
      const d = localDateFromIso(r.time);
      if (d) dates.push(d);
    });
    data.stool.forEach((r) => {
      const d = localDateFromIso(r.time);
      if (d) dates.push(d);
    });
    data.sleep.forEach((r) => {
      const d = localDateFromIso(r.end || r.start);
      if (d) dates.push(d);
    });
    data.medicine.forEach((r) => {
      const d = localDateFromIso(r.time);
      if (d) dates.push(d);
    });
    dates.sort();
    return dates;
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

  function setupChineseFont(doc) {
    if (!global.jspdf?.jsPDF) throw new Error('PDF 库未加载，请刷新页面');
    doc.addFont(FONT_FILE, FONT_NAME, 'normal');
    doc.setFont(FONT_NAME, 'normal');
  }

  function tableStyles() {
    return {
      font: FONT_NAME,
      fontSize: 9,
      cellPadding: 3,
      overflow: 'linebreak',
    };
  }

  function filterData(data, start, end) {
    return {
      growth: data.growth
        .filter((r) => inRange(r.date, start, end))
        .sort((a, b) => a.date.localeCompare(b.date)),
      jaundice: data.jaundice
        .filter((r) => inRange(r.date, start, end))
        .sort((a, b) => a.date.localeCompare(b.date)),
      temperature: data.temperature
        .filter((r) => inRange(localDateFromIso(r.time), start, end))
        .sort((a, b) => new Date(a.time) - new Date(b.time)),
      stool: data.stool
        .filter((r) => inRange(localDateFromIso(r.time), start, end))
        .sort((a, b) => new Date(b.time) - new Date(a.time)),
      sleep: data.sleep
        .filter((r) => inRange(localDateFromIso(r.end || r.start), start, end))
        .sort((a, b) => new Date(b.end) - new Date(a.end)),
      medicine: data.medicine
        .filter((r) => inRange(localDateFromIso(r.time), start, end))
        .sort((a, b) => new Date(b.time) - new Date(a.time)),
    };
  }

  function countModules(filtered, modules) {
    const counts = {};
    modules.forEach((m) => {
      counts[m] = (filtered[m] || []).length;
    });
    return counts;
  }

  function buildGrowthRows(rows) {
    return rows.map((r) => [
      formatDateCN(r.date),
      String(r.height),
      String(r.weight),
      r.head != null && !Number.isNaN(r.head) ? String(r.head) : '—',
    ]);
  }

  function growthSummary(rows) {
    if (!rows.length) return '该时间段暂无记录';
    const last = rows[rows.length - 1];
    let s = `共 ${rows.length} 条；最新：身高 ${last.height} cm，体重 ${last.weight} kg`;
    if (last.head != null && !Number.isNaN(last.head)) s += `，头围 ${last.head} cm`;
    return s;
  }

  function buildTemperatureRows(rows) {
    return rows.map((r) => [formatDateTime(r.time), String(r.value)]);
  }

  function temperatureSummary(rows) {
    if (!rows.length) return '该时间段暂无记录';
    const avg = rows.reduce((s, r) => s + r.value, 0) / rows.length;
    const fever = rows.filter((r) => r.value > FEVER_C).length;
    return `共 ${rows.length} 条；平均体温 ${avg.toFixed(1)} °C；发烧(>${FEVER_C}°C) ${fever} 次`;
  }

  function buildJaundiceRows(rows) {
    return rows.map((r) => [formatDateCN(r.date), String(r.value)]);
  }

  function jaundiceSummary(rows) {
    if (!rows.length) return '该时间段暂无记录';
    const avg = rows.reduce((s, r) => s + r.value, 0) / rows.length;
    const high = rows.filter((r) => r.value > JAUNDICE_HIGH).length;
    return `共 ${rows.length} 条；平均 ${avg.toFixed(1)} mg/dL；偏高(>${JAUNDICE_HIGH}) ${high} 次`;
  }

  function buildStoolRows(rows) {
    return rows.map((r) => [formatDateTime(r.time), r.color, r.texture]);
  }

  function stoolSummary(rows) {
    if (!rows.length) return '该时间段暂无记录';
    return `共 ${rows.length} 条大便记录`;
  }

  function buildSleepRows(rows) {
    return rows.map((r) => {
      const mins = sleepMinutes(r.start, r.end);
      return [formatDateTime(r.start), formatDateTime(r.end), formatDuration(mins)];
    });
  }

  function sleepSummary(rows) {
    if (!rows.length) return '该时间段暂无记录';
    const total = rows.reduce((s, r) => s + sleepMinutes(r.start, r.end), 0);
    return `共 ${rows.length} 段睡眠；合计 ${formatDuration(total)}`;
  }

  function buildMedicineRows(rows) {
    return rows.map((r) => [formatDateTime(r.time), r.name, r.dose]);
  }

  function medicineSummary(rows) {
    if (!rows.length) return '该时间段暂无记录';
    return `共 ${rows.length} 条用药记录`;
  }

  function rowHighlightHook(kind) {
    return {
      didParseCell(hook) {
        if (hook.section !== 'body') return;
        const row = hook.row.raw;
        if (kind === 'temperature') {
          const val = parseFloat(row[1]);
          if (val > FEVER_C) {
            hook.cell.styles.textColor = [196, 92, 92];
            hook.cell.styles.fontStyle = 'bold';
          }
        }
        if (kind === 'jaundice') {
          const val = parseFloat(row[1]);
          if (val > JAUNDICE_HIGH) {
            hook.cell.styles.textColor = [196, 92, 92];
            hook.cell.styles.fontStyle = 'bold';
          }
        }
      },
    };
  }

  function addModulePage(doc, title, head, body, summary, hookKind) {
    doc.addPage();
    setupChineseFont(doc);
    doc.setFontSize(16);
    doc.setTextColor(74, 144, 200);
    doc.text(title, MARGIN, 22);
    doc.setTextColor(61, 79, 92);
    doc.setFontSize(10);

    const startY = 30;
    if (body.length === 0) {
      doc.text('该时间段暂无记录', MARGIN, startY + 4);
      doc.setFontSize(9);
      doc.setTextColor(122, 143, 158);
      doc.text(`摘要：${summary}`, MARGIN, FOOTER_Y);
      return;
    }

    doc.autoTable({
      head: [head],
      body,
      startY,
      margin: { left: MARGIN, right: MARGIN },
      styles: tableStyles(),
      headStyles: {
        font: FONT_NAME,
        fillColor: [110, 181, 232],
        textColor: [255, 255, 255],
        fontStyle: 'normal',
      },
      alternateRowStyles: { fillColor: [244, 249, 252] },
      ...rowHighlightHook(hookKind),
    });

    doc.setFontSize(9);
    doc.setTextColor(61, 79, 92);
    const summaryY = Math.min((doc.lastAutoTable?.finalY || startY) + 10, FOOTER_Y - 6);
    doc.text(`摘要：${summary}`, MARGIN, summaryY);
  }

  function addCoverPage(doc, opts) {
    setupChineseFont(doc);
    const profile = global.BabyBookStore.getProfile?.() || { baby_name: '宝宝' };
    const babyName = profile.baby_name || '宝宝';

    doc.setFontSize(22);
    doc.setTextColor(74, 144, 200);
    doc.text('宝宝成长记录报告', PAGE_W / 2, 70, { align: 'center' });

    doc.setFontSize(14);
    doc.setTextColor(61, 79, 92);
    doc.text(`${babyName} · 成长数据汇总`, PAGE_W / 2, 88, { align: 'center' });

    doc.setFontSize(11);
    doc.text(`时间范围：${formatDateCN(opts.start)} 至 ${formatDateCN(opts.end)}`, PAGE_W / 2, 108, {
      align: 'center',
    });
    doc.text(`生成时间：${opts.generatedAt}`, PAGE_W / 2, 120, { align: 'center' });

    doc.setFontSize(12);
    doc.text('各模块记录条数', PAGE_W / 2, 145, { align: 'center' });

    let y = 158;
    doc.setFontSize(10);
    opts.modules.forEach((key) => {
      const label = MODULE_LABELS[key] || key;
      const n = opts.counts[key] ?? 0;
      doc.text(`${label}：${n} 条`, PAGE_W / 2, y, { align: 'center' });
      y += 10;
    });

    doc.setFontSize(9);
    doc.setTextColor(122, 143, 158);
    doc.text('数据来源于家庭加密云端记录 · 仅供家庭留存与打印', PAGE_W / 2, PAGE_H - 24, {
      align: 'center',
    });
  }

  async function generatePdf(start, end, modules) {
    const data = loadData();
    const filtered = filterData(data, start, end);
    const counts = countModules(filtered, modules);
    const generatedAt = new Date().toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    const { jsPDF } = global.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

    addCoverPage(doc, { start, end, modules, counts, generatedAt });

    const pages = {
      growth: () =>
        addModulePage(
          doc,
          '身高体重头围',
          ['日期', '身高(cm)', '体重(kg)', '头围(cm)'],
          buildGrowthRows(filtered.growth),
          growthSummary(filtered.growth),
          null
        ),
      temperature: () =>
        addModulePage(
          doc,
          '体温记录',
          ['时间', '体温(°C)'],
          buildTemperatureRows(filtered.temperature),
          temperatureSummary(filtered.temperature),
          'temperature'
        ),
      jaundice: () =>
        addModulePage(
          doc,
          '黄疸记录',
          ['日期', '黄疸(mg/dL)'],
          buildJaundiceRows(filtered.jaundice),
          jaundiceSummary(filtered.jaundice),
          'jaundice'
        ),
      stool: () =>
        addModulePage(
          doc,
          '大便记录',
          ['时间', '颜色', '性状'],
          buildStoolRows(filtered.stool),
          stoolSummary(filtered.stool),
          null
        ),
      sleep: () =>
        addModulePage(
          doc,
          '睡眠记录',
          ['入睡', '醒来', '时长'],
          buildSleepRows(filtered.sleep),
          sleepSummary(filtered.sleep),
          null
        ),
      medicine: () =>
        addModulePage(
          doc,
          '用药记录',
          ['时间', '药品', '剂量'],
          buildMedicineRows(filtered.medicine),
          medicineSummary(filtered.medicine),
          null
        ),
    };

    modules.forEach((key) => {
      if (pages[key]) pages[key]();
    });

    const filename = `宝宝成长报告_${start}_至_${end}.pdf`;
    doc.save(filename);
  }

  function setExportStatus(msg, isError) {
    const el = document.getElementById('export-pdf-status');
    if (!el) return;
    el.hidden = !msg;
    el.textContent = msg || '';
    el.classList.toggle('export-status-err', !!isError);
  }

  function applyRangePreset(monthsKey) {
    const endInput = document.getElementById('export-end-date');
    const startInput = document.getElementById('export-start-date');
    const end = todayStr();
    endInput.value = end;
    endInput.max = end;

    if (monthsKey === 'all') {
      const dates = collectAllDates(loadData());
      startInput.value = dates[0] || end;
    } else {
      const n = parseInt(monthsKey, 10);
      startInput.value = addMonths(end, n);
    }
    startInput.max = end;
  }

  function openExportDialog() {
    const dialog = document.getElementById('export-pdf-dialog');
    if (!dialog) return;
    if (!global.BabyBookStore?.isLoggedIn?.()) {
      alert('请先登录后再导出报告');
      return;
    }
    applyRangePreset('all');
    setExportStatus('');
    dialog.showModal();
  }

  function initExportPdf() {
    const dialog = document.getElementById('export-pdf-dialog');
    const btnOpen = document.getElementById('btn-export-pdf');
    const btnCancel = document.getElementById('export-pdf-cancel');
    const btnConfirm = document.getElementById('export-pdf-confirm');
    if (!dialog || !btnOpen) return;

    btnOpen.addEventListener('click', openExportDialog);
    btnCancel?.addEventListener('click', () => dialog.close());

    document.querySelectorAll('.export-range-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.export-range-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        applyRangePreset(btn.dataset.months);
      });
    });

    btnConfirm?.addEventListener('click', async () => {
      const start = document.getElementById('export-start-date').value;
      const end = document.getElementById('export-end-date').value;
      const modules = [...document.querySelectorAll('input[name="export-module"]:checked')].map(
        (el) => el.value
      );

      if (!start || !end) {
        setExportStatus('请选择开始和结束日期', true);
        return;
      }
      if (start > end) {
        setExportStatus('开始日期不能晚于结束日期', true);
        return;
      }
      if (!modules.length) {
        setExportStatus('请至少勾选一个数据模块', true);
        return;
      }

      btnConfirm.disabled = true;
      setExportStatus('正在生成 PDF，请稍候…');

      try {
        await generatePdf(start, end, modules);
        setExportStatus('');
        dialog.close();
      } catch (e) {
        console.error(e);
        setExportStatus(e.message || '生成失败，请重试', true);
      } finally {
        btnConfirm.disabled = false;
      }
    });
  }

  global.BabyBookExport = { init: initExportPdf, generate: generatePdf };
})(window);

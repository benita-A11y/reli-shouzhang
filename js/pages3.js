/* ============================================================
 * 热量手账 · 页面组3：数据看板（可视化日历 + 趋势图）
 * ============================================================ */
'use strict';

const BOARD = { view: 'month', month: null };

registerPage('board', async function (root) {
  BOARD.month = BOARD.month || todayKey().slice(0, 7);
  const totalCount = (await getRecords()).length;
  root.innerHTML = `
    <div class="page-head">
      <div>
        <div class="page-title"><span class="page-emoji">📊</span>数据看板</div>
        <div class="page-sub">只和自己比，不焦虑</div>
      </div>
    </div>
    <div class="tabs" style="max-width:220px">
      ${[['month', '🗓️ 月视图'], ['week', '📅 周视图']].map(([k, t]) => `<div class="tab-item ${BOARD.view === k ? 'on' : ''}" data-action="board:view" data-v="${k}">${t}</div>`).join('')}
    </div>
    ${BOARD.view === 'month' ? (totalCount ? await renderMonth() : renderBoardEmpty()) : await renderWeek()}
    <div id="board-charts">${await renderCharts()}</div>
    <div id="board-days">${await renderDayList()}</div>
  `;
  // 长按日历格子 → 标记放纵日
  if (BOARD.view === 'month' && totalCount) {
    setTimeout(() => {
      document.querySelectorAll('.cal-day[data-date]').forEach((el) => {
        bindLongPress(el, (e) => dayIndulgeHandler(e.dataset.date));
      });
    }, 60);
  }
});
function renderBoardEmpty() {
  return `
    <div class="card" style="padding:38px 20px;text-align:center">
      <div style="font-size:40px">🗓️</div>
      <div class="es-title" style="font-size:16px;font-weight:700;margin:12px 0 6px">开始记录第一天，你的日历会在这里慢慢填满</div>
      <div class="muted small">每一次记录，都会在日历上留下颜色</div>
      <button class="btn primary" style="margin-top:16px" data-action="nav:go" data-page="record">📷 去记录</button>
    </div>`;
}

async function renderMonth() {
  const [y, m] = BOARD.month.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const startDow = new Date(y, m - 1, 1).getDay();
  const target = PROFILE.targetKcal || 1800;
  let ok = 0, no = 0, free = 0;
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push('<div class="cal-day empty"></div>');
  for (let d = 1; d <= daysInMonth; d++) {
    const key = dateKey(new Date(y, m - 1, d));
    const stats = await getDayStats(key);
    const info = await getDayInfo(key);
    const isToday = key === todayKey();
    let cls = '', icon = '';
    if (info.isIndulge) { cls = 'free'; free++; icon = PROFILE.indulgenceEmoji || '🎉'; }
    else if (stats.count === 0) { cls = ''; }
    else if (stats.kcal <= target) { cls = 'ok'; ok++; }
    else { cls = 'no'; no++; }
    cells.push(`
      <div class="cal-day ${cls} ${isToday ? 'today' : ''}" data-action="board:day" data-date="${key}">
        <div class="cd-icon">${icon}</div>
        <div>${d}</div>
        ${stats.count ? `<div class="cd-kcal">${stats.kcal}</div>` : ''}
      </div>`);
  }
  const rate = ok + no ? Math.round((ok / (ok + no)) * 100) : 0;
  return `
    <div class="card">
      <div class="cal-head">
        <div class="cal-nav">
          <button data-action="board:prev">‹</button>
          <div class="cal-title" data-action="board:month-open">${y}年${m}月</div>
          <button data-action="board:next">›</button>
        </div>
        <div class="muted small">${monthKeyOf(todayKey()) === BOARD.month ? '本月' : ''}</div>
      </div>
      <div class="cal-summary">
        <span class="chip" style="background:var(--brand-soft);color:#3F3DA8">达标 ${ok} 天</span>
        <span class="chip">未达标 ${no} 天</span>
        <span class="chip" style="background:var(--pink-soft);color:var(--pink)">放纵日 ${free} 天</span>
        <span class="chip" style="background:var(--green-soft);color:var(--green)">完成率 ${rate}%</span>
      </div>
      <div class="cal-grid">
        ${['日', '一', '二', '三', '四', '五', '六'].map((w) => `<div class="cal-week">${w}</div>`).join('')}
        ${cells.join('')}
      </div>
      <div class="legend">
        <span>🟢 达标日</span><span>⚪ 未达标</span><span>${PROFILE.indulgenceEmoji || '🎉'} 放纵日</span>
      </div>
      <div class="hint" style="text-align:center;margin-top:10px">长按某一天可标记为放纵日 · 点击查看详情</div>
    </div>
    <div class="flex" style="justify-content:flex-end">
      <button class="btn sm ghost" data-action="day:indulge" data-date="${todayKey()}">标记今天为放纵日</button>
    </div>`;
}
async function renderWeek() {
  const target = PROFILE.targetKcal || 1800;
  const rows = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = dateKey(d);
    const stats = await getDayStats(key);
    const info = await getDayInfo(key);
    const cls = info.isIndulge ? 'free' : stats.count === 0 ? '' : stats.kcal <= target ? 'ok' : 'no';
    rows.push(`
      <div class="food-line" data-action="board:day" data-date="${key}">
        <div class="fl-photo" style="background:${cls === 'ok' ? 'var(--brand-soft)' : cls === 'free' ? 'var(--pink-soft)' : 'rgba(0,0,0,0.05)'}">
          ${key === todayKey() ? '📌' : info.isIndulge ? (PROFILE.indulgenceEmoji || '🎉') : cls === 'ok' ? '✅' : cls === 'no' ? '⚪' : '·'}</div>
        <div class="fl-info">
          <div class="fl-name">${d.getMonth() + 1}月${d.getDate()}日 周${'日一二三四五六'[d.getDay()]}</div>
          <div class="fl-meta">${stats.count} 样食物${info.isIndulge ? ' · 放纵日' : ''}</div>
        </div>
        <div class="fl-kcal" style="color:${cls === 'no' ? 'var(--red)' : 'var(--text)'}">${stats.kcal}kcal / ${target}</div>
      </div>`);
  }
  return `<div class="card" style="padding:14px">${rows.join('')}</div>`;
}
async function renderCharts() {
  const target = PROFILE.targetKcal || 1800;
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const key = addDays(todayKey(), -i);
    const stats = await getDayStats(key);
    days.push({ label: fmtShort(new Date(key + 'T00:00:00')), kcal: stats.kcal, p: stats.protein, c: stats.carbs, f: stats.fat });
  }
  const max = Math.max(target, ...days.map((d) => d.kcal)) * 1.12;
  const W = 680, H = 190, padT = 18, padB = 26, padL = 34, padR = 12;
  const iw = (W - padL - padR) / (days.length - 1 || 1);
  const ih = (v) => H - padB - (v / max) * (H - padT - padB);
  const pts = days.map((d, i) => `${(padL + i * iw).toFixed(1)},${ih(d.kcal).toFixed(1)}`);
  const area = `M ${padL},${H - padB} L ${pts.join(' L ')} L ${W - padR},${H - padB} Z`;
  const grid = [0.25, 0.5, 0.75].map((r) => {
    const y = (padT + (H - padT - padB) * r).toFixed(1);
    return `<line class="chart-grid-line" x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}"/>`;
  }).join('');
  const bars = days.slice(-7).map((d, i) => {
    const pk = d.p * 4, ck = d.c * 4, fk = d.f * 9;
    const sum = Math.max(1, pk + ck + fk);
    const bh = Math.min(H - padT - padB, (sum / max) * (H - padT - padB));
    const x = padL + 60 + i * 80, bw = 44, yBase = H - padB;
    const segP = bh * (pk / sum), segC = bh * (ck / sum), segF = bh * (fk / sum);
    return `
      <rect x="${x}" y="${(yBase - segP).toFixed(1)}" width="${bw}" height="${segP.toFixed(1)}" rx="4" fill="#007AFF"/>
      <rect x="${x}" y="${(yBase - segP - segC).toFixed(1)}" width="${bw}" height="${segC.toFixed(1)}" rx="4" fill="#FF9500"/>
      <rect x="${x}" y="${(yBase - segP - segC - segF).toFixed(1)}" width="${bw}" height="${segF.toFixed(1)}" rx="4" fill="#AF52DE"/>`;
  }).join('');
  return `
    <div class="card">
      <div class="chart-title">📈 热量趋势（近14天） <span class="muted" style="font-weight:500">目标 ${target}kcal</span></div>
      <svg class="chart-box" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
        <defs><linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#5E5CE6" stop-opacity="0.22"/><stop offset="1" stop-color="#5E5CE6" stop-opacity="0"/>
        </linearGradient></defs>
        ${grid}
        <path class="chart-area" d="${area}"/>
        <polyline class="chart-line" points="${pts.join(' ')}"/>
        ${days.map((d, i) => `<circle class="chart-dot" cx="${(padL + i * iw).toFixed(1)}" cy="${ih(d.kcal).toFixed(1)}" r="3.2"/>`).join('')}
      </svg>
      <div class="chart-labels"><span>${days[0].label}</span><span>${days[7].label}</span><span>${days[13].label}</span></div>
    </div>
    <div class="card">
      <div class="chart-title">🥗 三大营养素（近7天） <span class="muted" style="font-weight:500">蓝=蛋白 橙=碳水 紫=脂肪</span></div>
      <svg class="chart-box" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${bars}</svg>
      <div class="chart-labels">${days.slice(-7).map((d) => `<span>${d.label}</span>`).join('')}</div>
    </div>`;
}
async function renderDayList() {
  const stats = await getDayStats(todayKey());
  if (!stats.count) return '';
  return `
    <div class="section-title">📋 今日明细</div>
    <div class="card" style="padding:14px">
      ${stats.records.map((r) => `
        <div class="food-line">
          <div class="fl-photo">${photoHTML(r)}</div>
          <div class="fl-info"><div class="fl-name">${esc(r.foodName)}</div><div class="fl-meta">${MEALS.find((m) => m.k === r.meal).label} · ${esc(r.portion || '')}</div></div>
          <div class="fl-kcal">${r.kcal}kcal</div>
        </div>`).join('')}
    </div>`;
}
async function boardDayHandler(date) {
  const stats = await getDayStats(date);
  const info = await getDayInfo(date);
  const target = PROFILE.targetKcal || 1800;
  const all = await dbGetAll('days');
  const indulges = all.filter((d) => d.isIndulge).length;
  const over = stats.kcal - target;
  openModal(`
    <div class="modal-title">${date} ${info.isIndulge ? (PROFILE.indulgenceEmoji || '🎉') : ''}</div>
    <div class="modal-sub">${stats.count ? `吃了 ${stats.count} 样` : '没有记录'}</div>
    <div class="card" style="box-shadow:none;background:rgba(0,0,0,0.04);margin-bottom:10px">
      <div class="flex-between" style="margin-bottom:6px"><span class="muted small">当日总摄入</span><b>${stats.kcal} kcal</b></div>
      <div class="flex-between" style="margin-bottom:6px"><span class="muted small">目标热量</span><b>${target} kcal</b></div>
      <div class="flex-between"><span class="muted small">${stats.kcal <= target ? '还有余量' : '超出'}</span>
        <b style="color:${stats.kcal <= target ? 'var(--green)' : 'var(--red)'}">${stats.kcal <= target ? '✓' : '+'}${Math.abs(over)} kcal</b></div>
      ${info.isIndulge ? `<div class="small" style="margin-top:8px;color:var(--pink)">这是你的第 ${indulges} 个放纵日</div>` : ''}
    </div>
    <div class="field">
      <label>备注</label>
      <textarea id="day-note" placeholder="如：朋友生日聚餐">${esc(info.note || '')}</textarea>
    </div>
    <div class="flex" style="gap:10px">
      ${info.isIndulge ? '' : `<button class="btn ghost" style="flex:1" data-action="day:indulge" data-date="${date}">标记放纵日</button>`}
      <button class="btn primary" style="flex:1" data-action="day:note" data-date="${date}">保存备注</button>
    </div>`);
}
async function dayNoteHandler(date) {
  const info = await getDayInfo(date);
  info.note = $('#day-note').value.trim();
  await saveDayInfo(info);
  closeModal();
  toast('备注已保存 ✨', 'green');
  rerender();
}
async function dayIndulgeHandler(date) {
  const info = await getDayInfo(date);
  info.isIndulge = !info.isIndulge;
  if (info.isIndulge && !info.note) info.note = '今天想好好吃一顿';
  await saveDayInfo(info);
  closeModal(); closeSheet();
  toast(info.isIndulge ? `${PROFILE.indulgenceEmoji || '🎉'} 已标记为放纵日，今天不算数！` : '已取消放纵日', 'brand');
  rerender();
}
registerAction('day:indulge', (el) => dayIndulgeHandler(el.dataset.date));
registerAction('day:note', (el) => dayNoteHandler(el.dataset.date));
registerAction('board:view', (el) => { BOARD.view = el.dataset.v; renderPage('board'); });
registerAction('board:prev', () => { shiftMonth(-1); });
registerAction('board:next', () => { shiftMonth(1); });
registerAction('board:month-open', () => {
  const [y, m] = BOARD.month.split('-').map(Number);
  openSheet(`
    <div class="sheet-title">选择月份</div>
    <div class="chips" style="justify-content:center">
      ${Array.from({ length: 12 }, (_, i) => `<button class="chip ${m === i + 1 ? 'on' : ''}" data-action="board:month" data-v="${y}-${pad(i + 1)}">${i + 1}月</button>`).join('')}
    </div>`);
});
registerAction('board:month', (el) => {
  BOARD.month = el.dataset.v;
  closeSheet();
  renderPage('board');
});
function shiftMonth(delta) {
  const [y, m] = BOARD.month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  BOARD.month = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  renderPage('board');
}
registerAction('board:day', (el) => boardDayHandler(el.dataset.date));

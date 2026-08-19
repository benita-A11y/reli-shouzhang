/* ============================================================
 * 热量手账 · 核心（状态 / 导航 / 通用UI / 记录核心 / 事件分发）
 * 页面渲染在 pages1/2/3.js，通过注册表接入
 * ============================================================ */
'use strict';

/* ---------- 注册表（跨文件） ---------- */
window.PAGE_RENDER = {};
window._ACTIONS = {};
function registerAction(name, fn) { window._ACTIONS[name] = fn; }
function registerPage(key, fn) { window.PAGE_RENDER[key] = fn; }

/* ---------- 全局状态 ---------- */
let PROFILE = null;
let FOODS = [];
let CURRENT = 'home';
let SIDEBAR_PIN = false;
let SHOP_MAP = {};
let overPrompted = {};
let congratsShown = false;

const MEALS = [
  { k: 'breakfast', label: '早餐', emoji: '🌅' },
  { k: 'lunch', label: '午餐', emoji: '☀️' },
  { k: 'dinner', label: '晚餐', emoji: '🌙' },
  { k: 'snack', label: '加餐', emoji: '🍿' }
];
const NAV = [
  { key: 'home', emoji: '🏠', label: '首页', color: '#5E5CE6', soft: 'rgba(94,92,230,.14)' },
  { key: 'record', emoji: '📷', label: '记录', color: '#34C759', soft: 'rgba(52,199,89,.14)' },
  { key: 'recipes', emoji: '📖', label: '我的食谱', color: '#FF9500', soft: 'rgba(255,149,0,.14)' },
  { key: 'hunt', emoji: '🍽️', label: '觅食', color: '#FF2D55', soft: 'rgba(255,45,85,.12)' },
  { key: 'bill', emoji: '🧾', label: '多巴胺账单', color: '#FF3B30', soft: 'rgba(255,59,48,.12)' },
  { key: 'board', emoji: '📊', label: '数据看板', color: '#007AFF', soft: 'rgba(0,122,255,.12)' },
  { key: 'nutri', emoji: '🤖', label: '营养秘书', color: '#AF52DE', soft: 'rgba(175,82,222,.12)' },
  { key: 'profile', emoji: '👤', label: '我的', color: '#8E8E93', soft: 'rgba(142,142,147,.14)' }
];
const MEAL_EMOJI = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍿' };
const CAT_EMOJI = { 食堂: '🍚', 外卖: '🥡', 自制: '🏠', 饮品: '🧋' };
const $ = (sel, root) => (root || document).querySelector(sel);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const foodEmoji = (f) => (CAT_EMOJI[f.category] || '🍽️');
const dk = (kcal) => displayKcal(kcal, PROFILE ? PROFILE.recordTotal : 0);
const dkr = (kcal) => displayKcalRange(kcal, PROFILE ? PROFILE.recordTotal : 0);
function photoHTML(f, big) {
  if (f && f.photo) return `<img src="${f.photo}" alt="">`;
  return `<span style="${big ? 'font-size:28px' : ''}">${foodEmoji(f)}</span>`;
}
const defaultMeal = () => {
  const h = new Date().getHours();
  if (h < 10) return 'breakfast';
  if (h < 14) return 'lunch';
  if (h < 20) return 'dinner';
  return 'snack';
};

/* ============================================================
 * 初始化
 * ============================================================ */
async function init() {
  await openDB();
  await seedIfNeeded();
  PROFILE = await loadProfile();
  await refreshRecordTotal();
  buildShopMap();
  renderNav();
  bindGlobalEvents();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
  switchPage('home');
  if (!PROFILE.onboarded) setTimeout(() => openOnboarding(), 500);
}
function buildShopMap() {
  SHOP_MAP = {};
  [...BRANDS, ...SHOPS].forEach((s) => {
    SHOP_MAP[s.id] = s;
    s.items.forEach((it) => { it._shopId = s.id; it._shopName = s.name; it._shopEmoji = s.emoji; it._i = s.items.indexOf(it); });
  });
}
async function refreshRecordTotal() {
  const recs = await getRecords();
  PROFILE.recordTotal = recs.length;
  await saveProfile(PROFILE);
}
async function loadFoods() { FOODS = await getFoods(); }

/* ---------- 导航 ---------- */
function renderNav() {
  const nav = $('#side-nav');
  nav.innerHTML = NAV.map((n) => `
    <div class="nav-item" data-action="nav:go" data-page="${n.key}" style="--nc:${n.color};--nc-soft:${n.soft}">
      <div class="nav-emoji">${n.emoji}</div>
      <div class="nav-label">${n.label}</div>
    </div>`).join('');
  $('#pin-btn').classList.toggle('on', SIDEBAR_PIN);
  $('#sidebar').classList.toggle('open', SIDEBAR_PIN);
}
function setNavActive(key) {
  document.querySelectorAll('.nav-item').forEach((n) => n.classList.toggle('active', n.dataset.page === key));
}
function switchPage(key) {
  CURRENT = key;
  setNavActive(key);
  const view = $('#view');
  view.innerHTML = '<div class="page" id="page-root"></div>';
  renderPage(key);
  view.scrollTop = 0;
}
function renderPage(key) {
  const root = $('#page-root');
  const fn = window.PAGE_RENDER[key];
  if (fn) fn(root); else window.PAGE_RENDER.home(root);
}
const rerender = () => renderPage(CURRENT);

/* ============================================================
 * 通用 UI
 * ============================================================ */
function openSheet(html) {
  $('#sheet-root').innerHTML = `<div class="sheet-handle"></div>${html}`;
  $('#sheet-mask').classList.add('show');
  $('#sheet-root').classList.add('show');
  requestAnimationFrame(() => { $('#sheet-root').scrollTop = 0; });
}
function closeSheet() {
  $('#sheet-root').classList.remove('show');
  $('#sheet-mask').classList.remove('show');
  setTimeout(() => { $('#sheet-root').innerHTML = ''; }, 320);
}
function replaceSheet(html) {
  $('#sheet-root').innerHTML = `<div class="sheet-handle"></div>${html}`;
  $('#sheet-root').scrollTop = 0;
}
function openModal(html) {
  $('#modal-root').innerHTML = `<div class="modal-back" data-action="modal:close"></div><div class="modal-card">${html}</div>`;
}
function closeModal() { $('#modal-root').innerHTML = ''; }
function toast(msg, type = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  $('#toast-root').appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; }, 1800);
  setTimeout(() => t.remove(), 2200);
}
function confetti() {
  const host = $('#confetti-root');
  const colors = ['#5E5CE6', '#34C759', '#FF9500', '#FF2D55', '#FFCC00', '#007AFF'];
  for (let i = 0; i < 46; i++) {
    const c = document.createElement('div');
    c.className = 'confetti';
    c.style.left = Math.random() * 100 + '%';
    c.style.background = colors[Math.floor(Math.random() * colors.length)];
    c.style.animationDuration = (1.6 + Math.random() * 1.4) + 's';
    c.style.width = 7 + Math.random() * 6 + 'px';
    c.style.height = 9 + Math.random() * 8 + 'px';
    host.appendChild(c);
    setTimeout(() => c.remove(), 3100);
  }
}
function bindLongPress(el, cb) {
  let timer = null, sx = 0, sy = 0;
  el.addEventListener('pointerdown', (e) => {
    sx = e.clientX; sy = e.clientY;
    timer = setTimeout(() => { timer = null; cb(el); }, 520);
  });
  const clear = () => { if (timer) { clearTimeout(timer); timer = null; } };
  el.addEventListener('pointermove', (e) => { if (Math.abs(e.clientX - sx) > 12 || Math.abs(e.clientY - sy) > 12) clear(); });
  el.addEventListener('pointerup', clear);
  el.addEventListener('pointerleave', clear);
}

/* ---------- 拍照/选图 ---------- */
function pickPhoto(cb, capture = false) {
  const input = capture ? $('#camera-input') : $('#album-input');
  input.value = '';
  input.onchange = async () => {
    const file = input.files && input.files[0];
    if (!file) return;
    const raw = await fileToDataURL(file);
    const compressed = await compressImage(raw);
    cb(compressed);
  };
  input.click();
}

/* ============================================================
 * 记录核心
 * ============================================================ */
async function recordFood(food, meal) {
  const rec = await addRecord({
    foodId: food.id || null,
    foodName: food.name,
    foodPhoto: food.photo || '',
    kcal: food.kcal,
    price: food.price || 0,
    shop: food.shop || '',
    portion: food.portion || '一份',
    meal,
    category: food.category || '食堂',
    macros: food.macros || null
  });
  await refreshRecordTotal();
  toast(`已记录：${food.name} +${food.kcal}kcal`, 'green');
  const stats = await getDayStats(todayKey());
  if (stats.kcal > (PROFILE.targetKcal || 1800) && !overPrompted[todayKey()]) {
    overPrompted[todayKey()] = true;
    setTimeout(askIndulge, 600);
  }
  rerender();
  return rec;
}
function askMealSheet(food) {
  openSheet(`
    <div class="sheet-title">记录「${esc(food.name)}」到哪一餐？</div>
    ${MEALS.map((m) => `
      <div class="food-line" data-action="meal:pick" data-meal="${m.k}"
           data-name="${esc(food.name)}" data-kcal="${food.kcal}" data-id="${food.id || ''}"
           data-price="${food.price || 0}" data-shop="${esc(food.shop || '')}"
           data-cat="${food.category || '食堂'}" data-photo="${esc(food.photo || '')}"
           data-portion="${esc(food.portion || '')}" data-macros='${JSON.stringify(food.macros || {})}'>
        <div class="fl-photo">${m.emoji}</div>
        <div class="fl-info"><div class="fl-name">${m.label}</div><div class="fl-meta">记录到${m.label}</div></div>
        <div class="fl-kcal">+${food.kcal}kcal</div>
      </div>`).join('')}
    <div style="height:8px"></div>
    <button class="btn ghost block" data-action="sheet:close">取消</button>`);
}
async function mealPickHandler(el) {
  const food = {
    id: el.dataset.id || null, name: el.dataset.name, kcal: Number(el.dataset.kcal),
    price: Number(el.dataset.price || 0), shop: el.dataset.shop, category: el.dataset.cat,
    photo: el.dataset.photo, portion: el.dataset.portion,
    macros: el.dataset.macros ? JSON.parse(el.dataset.macros) : null
  };
  closeSheet();
  await recordFood(food, el.dataset.meal);
}
function askIndulge() {
  openModal(`
    <div class="modal-title">今天吃超标了 ✨</div>
    <div class="modal-sub">要标记今天为放纵日吗？放纵日不算失败，只是给努力放个假。</div>
    <div class="flex" style="justify-content:flex-end;gap:10px;margin-top:6px">
      <button class="btn ghost" data-action="modal:close">算了</button>
      <button class="btn primary" data-action="day:indulge" data-date="${todayKey()}">标记放纵日</button>
    </div>`);
}
/* 店铺单品同步进食谱库（数据闭环） */
async function upsertShopFood(name, kcal, price, shop, shopId) {
  const s = SHOP_MAP[shopId];
  await loadFoods();
  if (!FOODS.some((f) => f.name === name && f.shop === shop)) {
    const now = nowISO();
    await saveFood({
      id: uid(), name, kcal, price, shop, portion: '一份',
      category: s && s.cat === '奶茶咖啡' ? '饮品' : '外卖',
      photo: '', macros: estimateMacros(kcal),
      createdAt: now, updatedAt: now, editCount: 0, favorite: true
    });
  }
}

/* ============================================================
 * 全局事件分发
 * ============================================================ */
function bindGlobalEvents() {
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const fn = window._ACTIONS[el.dataset.action];
    if (fn) { e.preventDefault(); fn(el, e); }
  });
  $('#sheet-mask').addEventListener('click', closeSheet);
}
registerAction('nav:go', (el) => switchPage(el.dataset.page));
registerAction('sidebar:pin', () => {
  SIDEBAR_PIN = !SIDEBAR_PIN;
  renderNav();
});
registerAction('sheet:close', closeSheet);
registerAction('modal:close', closeModal);
registerAction('meal:pick', mealPickHandler);
// 注意：dayIndulgeHandler 定义在 pages3.js（后加载），此处必须惰性引用
registerAction('day:indulge', (el) => dayIndulgeHandler(el.dataset.date));

document.addEventListener('DOMContentLoaded', init);

/* ============================================================
 * 热量手账 · 本地数据层（IndexedDB，离线优先）
 * 唯一数据源：foods 食谱库 / records 每日记录 / orders 多巴胺账单
 *            days 日历状态 / profile 个人档案 / contribs 用户贡献
 * ============================================================ */
'use strict';

const DB_NAME = 'reliang-shouzhang';
const DB_VER = 1;

const IDB = {
  foods: 'foods',
  records: 'records',
  orders: 'orders',
  days: 'days',
  profile: 'profile',
  contribs: 'contribs'
};

let _db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (_db) return resolve(_db);
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IDB.foods)) {
        const s = db.createObjectStore(IDB.foods, { keyPath: 'id' });
        s.createIndex('name', 'name');
        s.createIndex('category', 'category');
        s.createIndex('updatedAt', 'updatedAt');
      }
      if (!db.objectStoreNames.contains(IDB.records)) {
        const s = db.createObjectStore(IDB.records, { keyPath: 'id' });
        s.createIndex('date', 'date');
        s.createIndex('foodId', 'foodId');
      }
      if (!db.objectStoreNames.contains(IDB.orders)) {
        db.createObjectStore(IDB.orders, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(IDB.days)) {
        db.createObjectStore(IDB.days, { keyPath: 'date' });
      }
      if (!db.objectStoreNames.contains(IDB.profile)) {
        db.createObjectStore(IDB.profile, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(IDB.contribs)) {
        db.createObjectStore(IDB.contribs, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

function tx(store, mode, fn) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const os = t.objectStore(store);
    let result;
    try { result = fn(os); } catch (err) { reject(err); return; }
    t.oncomplete = () => resolve(result && result.result !== undefined ? result.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}
const dbGetAll = (s) => tx(s, 'readonly', (os) => os.getAll());
const dbGet = (s, key) => tx(s, 'readonly', (os) => os.get(key));
const dbPut = (s, val) => tx(s, 'readwrite', (os) => os.put(val));
const dbDel = (s, key) => tx(s, 'readwrite', (os) => os.delete(key));
const dbClear = (s) => tx(s, 'readwrite', (os) => os.clear());
const dbBulk = (s, arr) => tx(s, 'readwrite', (os) => { arr.forEach((v) => os.put(v)); });

/* ---------- 工具 ---------- */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const pad = (n) => String(n).padStart(2, '0');
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayKey = () => dateKey(new Date());
const nowISO = () => new Date().toISOString();

function fmtDateCN(d) {
  const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  return `${d.getMonth() + 1}月${d.getDate()}日 周${week}`;
}
function fmtShort(d) {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
function daysAgoText(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const diff = Math.round((new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()) - target) / 86400000);
  if (diff <= 0) return '今天';
  if (diff === 1) return '昨天';
  return `${diff}天前`;
}
function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const t = new Date(y, m - 1, d + n);
  return dateKey(t);
}
function monthKeyOf(dateStr) { return dateStr.slice(0, 7); }

/* ---------- 图片压缩（存入本地，减小体积） ---------- */
function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(file);
  });
}
function compressImage(dataURL, max = 640, quality = 0.72) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > max || height > max) {
        const r = Math.min(max / width, max / height);
        width = Math.round(width * r);
        height = Math.round(height * r);
      }
      const c = document.createElement('canvas');
      c.width = width; c.height = height;
      c.getContext('2d').drawImage(img, 0, 0, width, height);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataURL);
    img.src = dataURL;
  });
}

/* ---------- 档案（Profile） ---------- */
const DEFAULT_PROFILE = {
  id: 'main',
  nickname: '手账同学',
  motto: '慢慢来，比较快',
  avatar: '🥑',
  onboarded: false,
  height: null, weight: null, age: null, gender: 'female',
  activity: 1.4, goal: 0,                 // goal: -400 减脂 / 0 保持 / +200 增肌
  targetKcal: 1800,
  bmr: null, tdee: null,
  indulgenceEmoji: '🎉',
  notifyOn: false,
  tastePrefs: { flavor: [], ingredient: [] },  // 口味偏好学习
  tasteCount: 0,
  contributionCount: 0,
  badges: [],
  recordTotal: 0
};

async function loadProfile() {
  const p = await dbGet(IDB.profile, 'main');
  if (p) return Object.assign({}, DEFAULT_PROFILE, p);
  return JSON.parse(JSON.stringify(DEFAULT_PROFILE));
}
async function saveProfile(p) {
  await dbPut(IDB.profile, p);
  return p;
}

/* ---------- 种子数据 ---------- */
const SEED_FOODS = [
  { name: '食堂炒饭', kcal: 620, price: 12, shop: '学校食堂', portion: '一份', category: '食堂', photo: '', macros: { protein: 16, carbs: 92, fat: 20 } },
  { name: '煎饼果子', kcal: 450, price: 8, shop: '学校食堂', portion: '一套', category: '食堂', photo: '', macros: { protein: 14, carbs: 55, fat: 18 } },
  { name: '黄焖鸡米饭', kcal: 660, price: 18, shop: '黄焖鸡米饭', portion: '一份', category: '外卖', photo: '', macros: { protein: 30, carbs: 78, fat: 24 } },
  { name: '番茄鸡蛋面', kcal: 430, price: 10, shop: '兰州拉面', portion: '一碗', category: '食堂', photo: '', macros: { protein: 16, carbs: 62, fat: 12 } },
  { name: '全麦面包', kcal: 150, price: 5, shop: '自己做的', portion: '两片', category: '自制', photo: '', macros: { protein: 6, carbs: 26, fat: 2 } },
  { name: '苹果', kcal: 80, price: 3, shop: '水果摊', portion: '一个', category: '自制', photo: '', macros: { protein: 0, carbs: 20, fat: 0 } },
  { name: '生椰拿铁（瑞幸）', kcal: 300, price: 15, shop: '瑞幸咖啡', portion: '中杯', category: '饮品', photo: '', macros: { protein: 4, carbs: 34, fat: 15 } },
  { name: '珍珠奶茶（蜜雪）', kcal: 380, price: 8, shop: '蜜雪冰城', portion: '中杯', category: '饮品', photo: '', macros: { protein: 3, carbs: 58, fat: 14 } }
];

async function seedIfNeeded() {
  const foods = await dbGetAll(IDB.foods);
  if (foods.length === 0) {
    const now = nowISO();
    const list = SEED_FOODS.map((f, i) => ({
      id: 'seed-' + i + '-' + now,
      name: f.name, kcal: f.kcal, price: f.price, shop: f.shop,
      portion: f.portion, category: f.category, photo: f.photo,
      macros: f.macros, createdAt: now, updatedAt: now,
      editCount: 0, isSeed: true
    }));
    await dbBulk(IDB.foods, list);
  }
}

/* ---------- 食物 ---------- */
async function getFoods() {
  const list = await dbGetAll(IDB.foods);
  list.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  return list;
}
async function getFood(id) { return dbGet(IDB.foods, id); }
/* 保存食物；若为编辑（已存在），同步历史记录的名称/照片为新版本（热量保留当时原值），返回同步条数 */
async function saveFood(food) {
  const existed = await dbGet(IDB.foods, food.id);
  await dbPut(IDB.foods, food);
  if (!existed) return 0;
  const recs = (await dbGetAll(IDB.records)).filter((r) => r.foodId === food.id);
  for (const r of recs) {
    r.foodName = food.name;
    r.foodPhoto = food.photo || r.foodPhoto;
    await dbPut(IDB.records, r);
  }
  return recs.length;
}
async function deleteFood(id) {
  await dbDel(IDB.foods, id);
  // 历史记录保留（名称照片同步更新为新版本，热量保留原值）——删除食物后历史记录仍保留
}

/* ---------- 记录 ---------- */
async function getRecords() { return dbGetAll(IDB.records); }
async function getRecordsByDate(date) {
  const all = await dbGetAll(IDB.records);
  return all.filter((r) => r.date === date).sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
}
async function addRecord({ foodId, foodName, foodPhoto, kcal, price, shop, portion, meal, category, macros, date }) {
  const rec = {
    id: uid(), foodId: foodId || null, foodName, foodPhoto: foodPhoto || '',
    kcal, price: price || 0, shop: shop || '', portion: portion || '',
    meal, category: category || '食堂', macros: macros || estimateMacros(kcal),
    date: date || todayKey(), createdAt: nowISO(), synced: false
  };
  await dbPut(IDB.records, rec);
  // 同步更新食物库“最近食用时间”
  if (foodId) {
    const f = await getFood(foodId);
    if (f) {
      f.lastEatenAt = rec.createdAt;
      await saveFood(f);
    }
  }
  return rec;
}
async function delRecord(id) { await dbDel(IDB.records, id); }

function estimateMacros(kcal) {
  // 无营养数据时按常规比例估算（碳水50% / 蛋白15% / 脂肪35%）
  return {
    protein: Math.round((kcal * 0.15) / 4),
    carbs: Math.round((kcal * 0.5) / 4),
    fat: Math.round((kcal * 0.35) / 9)
  };
}

/* ---------- 每日统计 ---------- */
async function getDayStats(date) {
  const recs = await getRecordsByDate(date);
  let kcal = 0, protein = 0, carbs = 0, fat = 0, price = 0;
  const byMeal = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 };
  for (const r of recs) {
    kcal += r.kcal; price += r.price || 0;
    protein += (r.macros && r.macros.protein) || 0;
    carbs += (r.macros && r.macros.carbs) || 0;
    fat += (r.macros && r.macros.fat) || 0;
    if (byMeal[r.meal] !== undefined) byMeal[r.meal] += r.kcal;
  }
  return { date, kcal: Math.round(kcal), protein: Math.round(protein), carbs: Math.round(carbs), fat: Math.round(fat), price, count: recs.length, records: recs, byMeal };
}

async function getDayInfo(date) {
  const d = await dbGet(IDB.days, date);
  return d || { date, isIndulge: false, note: '' };
}
async function saveDayInfo(info) { await dbPut(IDB.days, info); }

/* ---------- 多巴胺账单 ---------- */
async function getOrders() {
  const list = await dbGetAll(IDB.orders);
  return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}
async function addOrder(o) {
  const order = Object.assign({ id: uid(), createdAt: nowISO() }, o);
  await dbPut(IDB.orders, order);
  return order;
}
async function getBillStats() {
  const orders = await getOrders();
  let savedKcal = 0, savedPrice = 0;
  orders.forEach((o) => { savedKcal += o.savedKcal || 0; savedPrice += o.savedPrice || 0; });
  return { count: orders.length, savedKcal, savedPrice, orders };
}

/* ---------- 用户贡献 ---------- */
async function getContribs() { return dbGetAll(IDB.contribs); }
/* 本地模拟平台审核：AI 归类成功且品牌已收录 → 已通过；
 * 创建新品牌或系列归入「其他」→ 审核中；名称不合规（过短/含违禁词）→ 已驳回 */
function auditContrib(c) {
  if (!c || !c.name || String(c.name).length < 2 || /测试|广告|垃圾|xxx/.test(String(c.name))) return '已驳回';
  if (c.series === '其他' || !c.matchBrand) return '审核中';
  return '已通过';
}
async function addContrib(c) {
  const contrib = Object.assign({ id: uid(), createdAt: nowISO() }, c);
  contrib.status = auditContrib(contrib);
  await dbPut(IDB.contribs, contrib);
  // 众包验证：同品牌同名 ≥3 次提交 → 全部打上「热门新品」标签并提升为已通过
  const all = (await dbGetAll(IDB.contribs)).filter((x) => x.name === contrib.name && x.brand === contrib.brand);
  if (all.length >= 3) {
    for (const x of all) { x.hot = true; x.status = '已通过'; await dbPut(IDB.contribs, x); }
    contrib.hot = true;
    contrib.status = '已通过';
  }
  return contrib;
}
/* 贡献者激励称号：1次新品体验官 / 5次资深体验官 / 10次首席体验官 */
function contribBadge(count) {
  const n = Number(count) || 0;
  if (n >= 10) return { name: '首席体验官', emoji: '👑' };
  if (n >= 5) return { name: '资深体验官', emoji: '🎖️' };
  if (n >= 1) return { name: '新品体验官', emoji: '🪙' };
  return null;
}

/* ---------- 精度控制：精细期（前10次）精确数字，日常期区间估算 ---------- */
function displayKcal(kcal, recordTotal) {
  if (kcal == null) return '';
  if (recordTotal < 10) return `${kcal}kcal`;
  const lo = Math.round(kcal * 0.92), hi = Math.round(kcal * 1.08);
  return `≈${Math.round((lo + hi) / 2 / 50) * 50 || Math.round((lo + hi) / 2)}kcal`;
}
function displayKcalRange(kcal, recordTotal) {
  if (recordTotal < 10) return `${kcal}kcal`;
  const lo = Math.round(kcal * 0.92), hi = Math.round(kcal * 1.08);
  return `≈${Math.round((lo + hi) / 2 / 50) * 50 || Math.round((lo + hi) / 2)}kcal（${lo}-${hi}）`;
}

/* ---------- 导出 ---------- */
async function exportAllData() {
  const [foods, records, orders, days, profile, contribs] = await Promise.all([
    dbGetAll(IDB.foods), dbGetAll(IDB.records), dbGetAll(IDB.orders),
    dbGetAll(IDB.days), dbGet(IDB.profile, 'main'), dbGetAll(IDB.contribs)
  ]);
  return {
    app: '热量手账', version: '1.0.0', exportedAt: nowISO(),
    profile, foods, records, orders, days, contribs
  };
}
function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  triggerDownload(blob, filename);
}
function downloadCSV(filename, header, rows) {
  const esc = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const csv = [header, ...rows].map((r) => r.map(esc).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  triggerDownload(blob, filename);
}
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 300);
}

/* ============================================================
 * 热量手账 · 营养秘书（端侧规则引擎 AI）
 * BMR/TDEE 计算 · 红黄绿灯 · 营养缺口分析 · 下一餐推荐 · 引导语
 * 完全本地运行，无网络依赖
 * ============================================================ */
'use strict';

/* ---------- 身体数据 → 每日热量目标 ---------- */
function calcBodyData(p) {
  const h = Number(p.height) || 165, w = Number(p.weight) || 55, a = Number(p.age) || 20;
  const s = p.gender === 'male' ? 5 : -161;
  const bmr = Math.round(10 * w + 6.25 * h - 5 * a + s);
  const tdee = Math.round(bmr * (Number(p.activity) || 1.4));
  let target = tdee + (Number(p.goal) || 0);
  target = Math.max(1200, Math.min(3000, target));
  return { bmr, tdee, targetKcal: target };
}
function macroTargets(p, targetKcal) {
  const w = Number(p.weight) || 55;
  const protein = Math.max(50, Math.round(w * 1.2));          // 每kg体重1.2g
  const carbs = Math.max(60, Math.round((targetKcal * 0.5) / 4));
  const fat = Math.max(35, Math.round((targetKcal * 0.3) / 9));
  return { protein, carbs, fat };
}

/* ---------- 红黄绿灯（基于区间碰撞，而非精确数字） ---------- */
function trafficLight(foodKcal, remaining, recordTotal) {
  // 区间：精细期 ±5%，日常期 ±8%
  const band = recordTotal < 10 ? 0.05 : 0.08;
  const lo = foodKcal * (1 - band), hi = foodKcal * (1 + band);
  const eps = 100; // 临界带宽
  let level, reason;
  if (remaining <= 0) {
    level = 'red';
    reason = '今日额度已经用完啦，建议分餐吃掉或改天再吃，别硬撑。';
  } else if (hi <= remaining - eps) {
    level = 'green';
    const pct = Math.round((hi / remaining) * 100);
    reason = `放心吃！约消耗今日剩余额度的 ${pct}% 左右。`;
  } else if (lo <= remaining + eps) {
    level = 'yellow';
    const pct = Math.round((foodKcal / remaining) * 100);
    reason = `这块约等于今日剩余热量的 ${Math.min(150, pct)}%，临界啦，建议少吃一半。`;
  } else {
    level = 'red';
    reason = '吃完今天大概率要超标，建议只吃一部分，或者换更轻的选择。';
  }
  return { level, lo, hi, reason };
}

/* ---------- 当日营养缺口分析 ---------- */
function analyzeDay(stats, profile) {
  const target = profile.targetKcal || 1800;
  const mt = macroTargets(profile, target);
  const remaining = Math.max(0, target - stats.kcal);
  return {
    target,
    remaining,
    over: stats.kcal > target,
    stats,
    mt,
    proteinNeed: Math.max(0, mt.protein - stats.protein),
    carbsNeed: Math.max(0, mt.carbs - stats.carbs),
    fatNeed: Math.max(0, mt.fat - stats.fat),
    fatOver: stats.fat > mt.fat,
    carbsOver: stats.carbs > mt.carbs,
    proteinRate: Math.min(1.5, stats.protein / mt.protein),
    carbsRate: Math.min(1.5, stats.carbs / mt.carbs),
    fatRate: Math.min(1.5, stats.fat / mt.fat)
  };
}

/* ---------- 营养秘书推荐逻辑 ---------- */
function recommendNextMeal(meal, analysis, prefs, foodPool) {
  const tips = [];
  let strategy = '均衡';
  let note = '';

  if (meal === 'lunch') {
    // 基于早餐（仅早餐数据时传入 stats 为早餐）
    const breakfast = analysis;
    if (breakfast.carbsOver) { strategy = '压主食补蛋白'; note = '早餐碳水偏高，午餐压主食、补蛋白质。'; }
    else if (breakfast.proteinNeed > 0) { strategy = '蛋白拉满'; note = '早餐蛋白质不够，午餐蛋白质拉满。'; }
    else if (breakfast.stats && breakfast.stats.kcal < analysis.target * 0.25) { strategy = '补偿性中高碳水'; note = '早餐吃太少，午餐补偿性中高碳水 + 蛋白质。'; }
    else { strategy = '均衡'; note = '早餐状态不错，午餐保持均衡即可。'; }
  } else if (meal === 'dinner') {
    // 基于早+午餐累计
    if (analysis.proteinNeed > 20) { strategy = '高蛋白低碳水'; note = `蛋白质还差 ${analysis.proteinNeed}g，晚餐高蛋白低碳水（纯肉/海鲜/豆腐）。`; }
    else if (analysis.fatOver) { strategy = '极致清淡'; note = '今天脂肪偏多，晚餐清淡为主（水煮/清蒸/凉拌）。'; }
    else if (analysis.remaining > 400) { strategy = '标准均衡餐'; note = `热量还有富余（剩 ${analysis.remaining}kcal），吃标准均衡餐。`; }
    else if (analysis.stats && analysis.stats.carbs > analysis.mt.carbs * 0.6) { strategy = '高纤维蔬菜'; note = '纤维可能不足，让高纤维蔬菜占一半。'; }
    else { strategy = '均衡'; note = '平稳的一天，均衡搭配就好。'; }
  } else {
    // 加餐（上午/下午/晚上）
    strategy = '加餐'; note = '选择轻盈的加餐，不给正餐添负担。';
  }

  // 优先从用户食谱库匹配
  let pool = foodPool && foodPool.length ? foodPool : FALLBACK_POOL[meal] || FALLBACK_POOL.default;
  if (prefs && prefs.flavor && prefs.flavor.length) {
    const f = prefs.flavor;
    pool = pool.filter((x) => {
      const xf = x.flavor || '';
      return f.some((pf) => xf.includes(pf));
    }).concat(pool);
  }
  const seen = new Set();
  const out = [];
  for (const x of pool) {
    if (seen.has(x.name) || out.length >= 3) continue;
    // 按策略筛选
    if (strategy === '压主食补蛋白' && (x.macros ? x.macros.protein < 15 : false)) continue;
    if (strategy === '高蛋白低碳水' && (x.macros ? x.macros.protein < 20 : false)) continue;
    if (strategy === '极致清淡' && (x.flavor && x.flavor.includes('辣'))) continue;
    if (strategy === '加餐' && x.kcal > 250) continue;
    if (analysis.remaining > 0 && x.kcal > analysis.remaining + 150) continue;
    seen.add(x.name);
    out.push(Object.assign({}, x, { reason: buildReason(strategy, x, analysis, meal, note) }));
  }
  return { strategy, note, items: out };
}

function buildReason(strategy, food, analysis, meal, baseNote) {
  const n = food.name;
  if (strategy === '压主食补蛋白') return `早餐碳水偏高，${n}蛋白质充足，适合补蛋白。`;
  if (strategy === '蛋白拉满') return `早餐缺蛋白，${n}帮你把蛋白质拉满。`;
  if (strategy === '补偿性中高碳水') return `早餐吃太少，${n}能补回能量又不过量。`;
  if (strategy === '高蛋白低碳水') return `蛋白质还差 ${analysis.proteinNeed}g，${n}是高蛋白低碳水的好选择。`;
  if (strategy === '极致清淡') return `今天脂肪已超标，${n}清淡不添乱。`;
  if (strategy === '标准均衡餐') return `还剩 ${analysis.remaining}kcal 额度，${n}刚刚好。`;
  if (strategy === '高纤维蔬菜') return `纤维不足，${n}帮你补足膳食纤维。`;
  if (strategy === '加餐') return `加餐吃${n}，克制又满足。`;
  return `${n}，${baseNote}`;
}

/* 兜底推荐池（食谱为空时使用） */
const FALLBACK_POOL = {
  lunch: [
    { name: '番茄鸡蛋面', kcal: 430, price: 12, emoji: '🍜', flavor: '清淡', macros: { protein: 16, carbs: 62, fat: 12 } },
    { name: '鸡胸肉沙拉', kcal: 330, price: 23, emoji: '🥗', flavor: '清淡', macros: { protein: 32, carbs: 20, fat: 10 } },
    { name: '黄焖鸡米饭', kcal: 660, price: 18, emoji: '🍚', flavor: '咸香', macros: { protein: 30, carbs: 78, fat: 24 } },
    { name: '全麦三明治', kcal: 300, price: 15, emoji: '🥪', flavor: '清淡', macros: { protein: 15, carbs: 36, fat: 10 } }
  ],
  dinner: [
    { name: '鸡胸肉沙拉', kcal: 330, price: 23, emoji: '🥗', flavor: '清淡', macros: { protein: 32, carbs: 20, fat: 10 } },
    { name: '虾仁糙米碗', kcal: 380, price: 26, emoji: '🍤', flavor: '清淡', macros: { protein: 28, carbs: 40, fat: 9 } },
    { name: '清蒸鱼套餐', kcal: 420, price: 25, emoji: '🐟', flavor: '清淡', macros: { protein: 32, carbs: 38, fat: 14 } },
    { name: '牛肉拉面', kcal: 520, price: 13, emoji: '🍜', flavor: '咸香', macros: { protein: 24, carbs: 66, fat: 16 } }
  ],
  snack: [
    { name: '无糖酸奶', kcal: 120, price: 6, emoji: '🥛', flavor: '清淡', macros: { protein: 7, carbs: 10, fat: 5 } },
    { name: '苹果', kcal: 80, price: 3, emoji: '🍎', flavor: '甜口', macros: { protein: 0, carbs: 20, fat: 0 } },
    { name: '一小把坚果', kcal: 200, price: 8, emoji: '🥜', flavor: '咸香', macros: { protein: 6, carbs: 7, fat: 18 } },
    { name: '热牛奶', kcal: 150, price: 5, emoji: '🥛', flavor: '清淡', macros: { protein: 8, carbs: 12, fat: 8 } }
  ],
  default: [
    { name: '煎饼果子', kcal: 450, price: 8, emoji: '🥞', flavor: '咸香', macros: { protein: 14, carbs: 55, fat: 18 } },
    { name: '苹果', kcal: 80, price: 3, emoji: '🍎', flavor: '甜口', macros: { protein: 0, carbs: 20, fat: 0 } }
  ]
};

/* ---------- 首页引导语 ---------- */
function greeting() {
  const h = new Date().getHours();
  let base;
  if (h < 6) base = '夜深了，早点休息，别点夜宵啦';
  else if (h < 11) base = '早上好，今天状态不错，保持住';
  else if (h < 14) base = '中午啦，记得好好吃饭';
  else if (h < 18) base = '下午茶时间，注意别嘴馋';
  else base = '晚上好，今天也要好好吃饭';
  return base;
}

/* 放纵日后的第二天调整语 */
function indulgenceAdjustMsg(daysOverInARow) {
  if (daysOverInARow >= 3) return '连续3天未达标了哦，今天要不要试着吃清淡一点？';
  return '昨天放纵了，今天建议适当控制，减少200kcal摄入，多吃蔬菜帮身体排排水。';
}

/* ---------- 换算白话 ---------- */
function convertKcal(kcal) {
  const burgers = kcal / 500;
  const teas = kcal / 400;
  if (burgers >= 1) return `≈ ${burgers < 2 ? 1 : Math.round(burgers)} 个汉堡`;
  if (teas >= 1) return `≈ ${teas < 2 ? 1 : Math.round(teas)} 杯奶茶`;
  return '≈ 一碟小零食';
}
function jogHours(kcal) {
  const hr = kcal / 500; // 慢跑约500kcal/小时
  return hr < 1 ? Math.max(0.5, Math.round(hr * 60) / 60).toFixed(1) : hr.toFixed(1);
}

/* ---------- 昵称随机建议 ---------- */
const NICKNAME_IDEAS = ['干饭选手', '热量管理员', '轻食观察员', '奶茶监督员', '食堂常驻嘉宾'];

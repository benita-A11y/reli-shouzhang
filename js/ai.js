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
  // 膳食纤维无直接字段，用「蔬菜类食物」作为代理判断：今日是否吃过绿叶菜
  const veggieOk = (stats.records || []).some((r) => /菜|沙拉|生菜|菠菜|西兰花|菌菇|香菇|金针菇|木耳|芹|黄瓜|番茄|芦笋|绿叶/.test(r.foodName));
  return {
    target,
    remaining,
    over: stats.kcal > target,
    stats,
    mt,
    veggieOk,
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
function recommendNextMeal(meal, analysis, prefs, foodPool, slot) {
  const tips = [];
  let strategy = '均衡';
  let note = '';

  if (meal === 'lunch') {
    // 午餐推荐基于早餐独立数据（传入的 analysis.stats 为早餐累计）
    const b = (analysis.stats && analysis.stats) || {};
    const carbs = b.carbs || 0, protein = b.protein || 0, kcal = b.kcal || 0;
    if (carbs > 50) { strategy = '压主食补蛋白'; note = `早餐碳水已足量（吃了 ${carbs}g），午餐建议避开米饭/面条，主攻蛋白+蔬菜：去皮鸡腿沙拉，主食换成红薯或玉米。`; }
    else if (protein < 20) { strategy = '蛋白拉满'; note = `早餐蛋白几乎为零（仅 ${protein}g），午餐急需补货：牛肉/虾仁为主菜，搭配一拳米饭。`; }
    else if (kcal < 200) { strategy = '补偿性中高碳水'; note = `早上吃得太少了（仅 ${kcal}kcal），小心下午暴食。午餐务必吃够一碗杂粮饭+正常肉菜，稳住代谢。`; }
    else { strategy = '均衡'; note = '早餐表现不错！午餐继续保持均衡：一拳主食+一掌心肉+两拳蔬菜。'; }
  } else if (meal === 'dinner') {
    // 晚餐推荐基于早+午餐累计数据
    const need = analysis.proteinNeed || 0;
    if ((analysis.proteinRate || 0) < 0.8) { strategy = '高蛋白低碳水'; note = `今天还差 ${need}g 蛋白质，晚餐不要碰主食了。强烈建议：清蒸鱼/白切鸡/凉拌豆腐，补足蛋白。`; }
    else if (analysis.fatOver) { strategy = '极致清淡'; note = '今天油脂已经拉满，晚餐请给肠胃放个假：水煮西兰花+虾仁，或一碗菌菇汤。'; }
    else if (analysis.remaining > (analysis.target || 1800) * 0.2) { strategy = '标准均衡餐'; note = `今天热量余量充足（还剩 ${analysis.remaining}kcal），晚餐可以吃得舒服点：一碗杂粮饭+炒肉+青菜。`; }
    else if (!analysis.veggieOk) { strategy = '高纤维蔬菜'; note = '今天绿叶菜几乎没吃，晚餐必须加大份青菜！推荐：大份蒜蓉生菜/菠菜。'; }
    else { strategy = '均衡'; note = '平稳的一天，均衡搭配就好。'; }
  } else {
    // 加餐（上午/下午/晚上），按触发条件给对应建议
    const st = (analysis.stats && analysis.stats) || {};
    const gap = analysis.proteinNeed || 0;
    if (slot === 'snack0') {
      strategy = '垫底加餐';
      note = (st.kcal || 0) < 300 ? '早餐热量偏低，距离午餐还早，先垫个底（无糖酸奶/一个苹果），以免午餐刹不住车。' : '上午加餐选个轻盈的，别影响午餐胃口。';
    } else if (slot === 'snack1') {
      strategy = '提神加餐';
      note = (st.carbs || 0) > 60 ? '午餐碳水偏多，下午代谢低谷期，吃点优质脂肪（一小把坚果/黑咖啡）提提神，顺便压制晚餐前的饥饿感。' : '下午加餐，选个低负担的提提神。';
    } else {
      strategy = '晚安加餐';
      note = gap > 15 ? `蛋白质还差 ${gap}g，实在饿就吃这个吧（一杯热牛奶/几颗虾仁）：高蛋白低热量，不影响睡眠。` : '睡前加餐，高蛋白低热量最稳妥。';
    }
  }

  // 优先从用户食谱库匹配
  let pool = foodPool && foodPool.length ? foodPool : FALLBACK_POOL[meal] || FALLBACK_POOL.default;
  // 加餐按时段把对应推荐单品排到最前
  if (meal === 'snack' && slot) {
    const fav = slot === 'snack0' ? ['酸奶', '苹果'] : slot === 'snack1' ? ['坚果', '咖啡'] : ['牛奶', '虾'];
    pool = pool.filter((x) => fav.some((k) => x.name.includes(k))).concat(pool.filter((x) => !fav.some((k) => x.name.includes(k))));
  }
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
    if (meal === 'snack' && x.kcal > 250) continue;
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
  if (strategy === '垫底加餐') return `${n}，垫个底又不怕胖。`;
  if (strategy === '提神加餐') return `${n}，优质脂肪提提神。`;
  if (strategy === '晚安加餐') return `${n}，高蛋白低热量，安稳入睡。`;
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

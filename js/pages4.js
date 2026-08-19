/* ============================================================
 * 热量手账 · 页面组4：营养秘书 / 我的 / 贡献 / 新手引导
 * ============================================================ */
'use strict';

const NUTRI = { step: 1, flavor: [], ingredient: [], meal: 'lunch0' };

/* ============================================================
 * 营养秘书（AI 推荐/复盘）
 * ============================================================ */
registerPage('nutri', async function (root) {
  const stats = await getDayStats(todayKey());
  const analysis = analyzeDay(stats, PROFILE);
  const yesterday = await getDayInfo(addDays(todayKey(), -1));
  const yStats = await getDayStats(addDays(todayKey(), -1));
  const yIndulged = yesterday.isIndulge || (yStats.count > 0 && yStats.kcal > (PROFILE.targetKcal || 1800));
  const overDays = await consecutiveOverDays();
  root.innerHTML = `
    <div class="page-head">
      <div>
        <div class="page-title"><span class="page-emoji">🤖</span>营养秘书</div>
        <div class="page-sub">查漏补缺 · 推荐下一餐</div>
      </div>
    </div>
    ${NUTRI.step === 1 ? renderNutriStep1(analysis, yIndulged, overDays) : renderNutriStep2(analysis)}
    ${NUTRI.step === 2 ? `<div id="nutri-rec"></div>` : ''}`;
  if (NUTRI.step === 2) renderNutriRec();
});
function renderNutriStep1(analysis, yIndulged, overDays) {
  const advice = (yIndulged || overDays >= 2) ? indulgenceAdjustMsg(overDays)
    : analysis.over ? '今天热量有点超了，接下来吃得克制一点吧'
    : `今天还剩 ${analysis.remaining}kcal，蛋白质还差 ${analysis.proteinNeed}g，让秘书帮你安排`;
  return `
    <div class="card" style="background:linear-gradient(160deg,#AF52DE,#7D3FBF);color:#fff;border:none">
      <div class="small" style="opacity:.9">今日体检报告</div>
      <div style="font-size:19px;font-weight:800;margin:8px 0 12px">${esc(advice)}</div>
      <div class="flex" style="gap:8px;flex-wrap:wrap">
        <span class="chip" style="background:rgba(255,255,255,.18);color:#fff">已吃 ${analysis.stats.kcal}kcal / ${analysis.target}kcal</span>
        <span class="chip" style="background:rgba(255,255,255,.18);color:#fff">蛋白 ${analysis.stats.protein}/${analysis.mt.protein}g</span>
        <span class="chip" style="background:rgba(255,255,255,.18);color:#fff">碳水 ${analysis.stats.carbs}/${analysis.mt.carbs}g</span>
      </div>
    </div>
    <div class="card">
      <div class="section-title" style="margin-top:0">第一步 · 今天想吃什么口味？</div>
      <div class="muted small" style="margin-bottom:10px">${(PROFILE.tasteCount || 0) >= 10 ? `🎯 已熟悉你的口味（${PROFILE.tasteCount}次），推荐会自动优先你的偏好` : `可多选，越选越懂你（已积累 ${PROFILE.tasteCount} 次偏好）`}</div>
      <div class="spec-title">味道</div>
      <div class="chips" style="margin-bottom:14px">
        ${['辣的', '咸香的', '清淡的', '甜口的'].map((f) => `<button class="chip ${NUTRI.flavor.includes(f) ? 'on' : ''}" data-action="nutri:flavor" data-v="${f}">${f}</button>`).join('')}
      </div>
      <div class="spec-title">食材</div>
      <div class="chips" style="margin-bottom:18px">
        ${['想吃肉', '想吃蔬菜', '想吃主食', '想吃蛋/豆腐'].map((f) => `<button class="chip ${NUTRI.ingredient.includes(f) ? 'on' : ''}" data-action="nutri:ingredient" data-v="${f}">${f}</button>`).join('')}
      </div>
      <div class="flex" style="gap:10px">
        <button class="btn ghost" style="flex:1" data-action="nutri:any">🎲 随便</button>
        <button class="btn primary" style="flex:2" data-action="nutri:next">给我推荐 →</button>
      </div>
    </div>`;
}
function renderNutriStep2(analysis) {
  const snackTags = [['上午加餐', 'snack0'], ['下午加餐', 'snack1'], ['晚上加餐', 'snack2']];
  return `
    <div class="card">
      <div class="section-title" style="margin-top:0">第二步 · 推荐给哪一餐？</div>
      <div class="chips" style="margin-bottom:12px">
        <button class="chip ${NUTRI.meal === 'lunch0' ? 'on' : ''}" data-action="nutri:meal" data-v="lunch0">☀️ 午餐</button>
        <button class="chip ${NUTRI.meal === 'dinner0' ? 'on' : ''}" data-action="nutri:meal" data-v="dinner0">🌙 晚餐</button>
        ${snackTags.map(([t, v]) => `<button class="chip ${NUTRI.meal === v ? 'on' : ''}" data-action="nutri:meal" data-v="${v}">🍿 ${t}</button>`).join('')}
      </div>
    </div>`;
}
async function renderNutriRec() {
  const box = $('#nutri-rec');
  if (!box) return;
  const stats = await getDayStats(todayKey());
  const analysis = analyzeDay(stats, PROFILE);
  const mealKey = NUTRI.meal;
  const isSnack = mealKey.startsWith('snack');
  const mealForRec = isSnack ? 'snack' : mealKey === 'lunch0' ? 'lunch' : 'dinner';
  const recsToday = await getRecordsByDate(todayKey());
  const sumMacros = (list) => list.reduce((a, r) => {
    a.kcal += r.kcal; a.carbs += (r.macros && r.macros.carbs) || 0; a.protein += (r.macros && r.macros.protein) || 0; return a;
  }, { kcal: 0, carbs: 0, protein: 0 });
  // 午餐/上午加餐基于早餐数据；下午加餐基于午餐数据
  let src = analysis;
  if (mealForRec === 'lunch' || mealKey === 'snack0') {
    const bf = sumMacros(recsToday.filter((r) => r.meal === 'breakfast'));
    src = Object.assign({}, analysis, { stats: bf, carbs: bf.carbs, protein: bf.protein, remaining: analysis.target - bf.kcal });
  } else if (mealKey === 'snack1') {
    const lu = sumMacros(recsToday.filter((r) => r.meal === 'lunch'));
    src = Object.assign({}, analysis, { stats: lu, carbs: lu.carbs, protein: lu.protein });
  }
  const pool = FOODS.map((f) => ({
    name: f.name, kcal: f.kcal, emoji: foodEmoji(f), photo: f.photo, price: f.price,
    flavor: f.category === '饮品' ? '甜口' : '清淡', macros: f.macros
  })).concat([
    { name: '无糖酸奶', kcal: 120, emoji: '🥛', price: 6, flavor: '清淡', macros: { protein: 7, carbs: 10, fat: 5 } },
    { name: '鸡胸肉沙拉', kcal: 330, emoji: '🥗', price: 23, flavor: '清淡', macros: { protein: 32, carbs: 20, fat: 10 } },
    { name: '一小把坚果', kcal: 200, emoji: '🥜', price: 8, flavor: '咸香', macros: { protein: 6, carbs: 7, fat: 18 } },
    { name: '热牛奶', kcal: 150, emoji: '🥛', price: 5, flavor: '清淡', macros: { protein: 8, carbs: 12, fat: 8 } }
  ]);
  const rec = recommendNextMeal(mealForRec, src, PROFILE.tastePrefs, pool, mealKey);
  box.innerHTML = `
    ${rec.note ? `<div class="reason-box" style="border-left-color:var(--purple);margin-bottom:12px">${esc(rec.note)}</div>` : ''}
    ${rec.items.length ? rec.items.map((it) => `
      <div class="reco-card">
        <div class="reco-photo">${it.photo ? `<img src="${it.photo}">` : it.emoji}</div>
        <div class="reco-info">
          <div class="reco-name">${esc(it.name)} <span class="muted small">${it.price ? '¥' + it.price : ''}</span></div>
          <div class="reco-reason">${esc(it.reason || '')}</div>
          <div class="reco-meal-btns">
            ${MEALS.map((m) => `<span class="chip" data-action="nutri:record" data-name="${esc(it.name)}" data-kcal="${it.kcal}" data-price="${it.price || 0}" data-meal="${m.k}">${m.emoji}${m.label}</span>`).join('')}
          </div>
        </div>
        <div class="reco-kcal">${it.kcal}kcal</div>
      </div>`).join('') : `<div class="empty-state" style="padding:26px"><div class="es-icon">🥤</div><div class="es-sub">今天额度紧张，喝杯水吃点水果就好</div></div>`}
    <div class="hint" style="margin-top:4px">💡 点一下即可记录到对应餐次 · 推荐优先匹配你的食谱库</div>`;
}
registerAction('nutri:flavor', (el) => toggleArr(NUTRI.flavor, el.dataset.v));
registerAction('nutri:ingredient', (el) => toggleArr(NUTRI.ingredient, el.dataset.v));
function toggleArr(arr, v) {
  const i = arr.indexOf(v);
  if (i >= 0) arr.splice(i, 1); else arr.push(v);
}
/* 连续超标天数（不含今天），用于秘书温柔提醒 */
async function consecutiveOverDays() {
  const target = PROFILE.targetKcal || 1800;
  let n = 0;
  let d = addDays(todayKey(), -1);
  for (let i = 0; i < 30; i++) {
    const st = await getDayStats(d);
    if (st.count > 0 && st.kcal > target) { n++; d = addDays(d, -1); }
    else break;
  }
  return n;
}
registerAction('nutri:meal', (el) => { NUTRI.meal = el.dataset.v; renderPage('nutri'); });
registerAction('nutri:any', async () => { NUTRI.flavor = []; NUTRI.ingredient = []; await nutriNext(); });
registerAction('nutri:next', async () => { await nutriNext(); });
async function nutriNext() {
  if (NUTRI.flavor.length || NUTRI.ingredient.length) {
    PROFILE.tastePrefs.flavor = PROFILE.tastePrefs.flavor.concat(NUTRI.flavor).slice(-10);
    PROFILE.tastePrefs.ingredient = PROFILE.tastePrefs.ingredient.concat(NUTRI.ingredient).slice(-10);
    PROFILE.tasteCount = (PROFILE.tasteCount || 0) + 1;
    await saveProfile(PROFILE);
  } else if ((PROFILE.tasteCount || 0) >= 10 && PROFILE.tastePrefs.flavor.length) {
    toast('🎯 已自动按你的口味偏好优先推荐', 'brand');
  }
  NUTRI.step = 2;
  renderPage('nutri');
}
registerAction('nutri:back', () => { NUTRI.step = 1; renderPage('nutri'); });
registerAction('nutri:record', async (el) => {
  await recordFood({ id: null, name: el.dataset.name, kcal: Number(el.dataset.kcal), price: Number(el.dataset.price), shop: '', category: '食堂', portion: '一份', macros: null }, el.dataset.meal);
});

/* ============================================================
 * 我的（个人中心）
 * ============================================================ */
registerPage('profile', async function (root) {
  const st = await getBillStats();
  const badge = contribBadge(PROFILE.contributionCount);
  root.innerHTML = `
    <div class="page-head">
      <div>
        <div class="page-title"><span class="page-emoji">👤</span>我的</div>
        <div class="page-sub">为健康而活的自己</div>
      </div>
    </div>
    <div class="card" style="text-align:center;padding:26px 20px">
      <div class="avatar-wrap" style="cursor:pointer" data-action="prof:avatar">${PROFILE.avatar && String(PROFILE.avatar).startsWith('data:') ? `<img src="${PROFILE.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : esc(PROFILE.avatar || '🥑')}</div>
      <div style="font-size:19px;font-weight:800">${esc(PROFILE.nickname)}</div>
      ${badge ? `<div style="margin-top:4px"><span class="cat-tag" style="background:var(--purple-soft);color:var(--purple)">${badge.emoji} ${badge.name}</span></div>` : ''}
      <div class="muted small" style="margin-top:3px">「${esc(PROFILE.motto)}」 <span style="color:var(--brand);cursor:pointer" data-action="prof:motto">编辑</span></div>
      <div class="muted small" style="margin-top:6px">目标 ${PROFILE.targetKcal}kcal/天${PROFILE.bmr ? ` · BMR ${PROFILE.bmr}` : ''}</div>
      <div style="margin-top:12px;display:flex;justify-content:center"><button class="btn sm" data-action="prof:body">📏 身体数据</button></div>
    </div>
    <div class="three-cards">
      <div class="tc-card"><div class="tc-num">${st.savedKcal.toLocaleString()}</div><div class="tc-label">累计节省 kcal</div></div>
      <div class="tc-card"><div class="tc-num" style="color:var(--orange)">¥${st.savedPrice.toFixed(2)}</div><div class="tc-label">累计节省金额</div></div>
      <div class="tc-card"><div class="tc-num" style="color:var(--pink)">${st.count}</div><div class="tc-label">虚拟下单次数</div></div>
    </div>
    <div class="card" style="margin-top:16px;padding:6px 16px">
      <div class="list-item" data-action="prof:body"><div class="li-icon" style="background:var(--blue-soft)">📏</div>
        <div class="li-main"><div class="li-title">身体数据</div><div class="li-sub">身高/体重/年龄/性别/活动水平/目标设定</div></div><div class="li-arrow">›</div></div>
      <div class="list-item" data-action="prof:contribs"><div class="li-icon" style="background:var(--orange-soft)">📮</div>
        <div class="li-main"><div class="li-title">我的贡献 <span class="cat-tag" style="background:var(--orange-soft);color:var(--orange)">${PROFILE.contributionCount}次</span></div>
          <div class="li-sub">提交新品及审核状态</div></div><div class="li-arrow">›</div></div>
      <div class="list-item" data-action="nav:go" data-page="board"><div class="li-icon" style="background:var(--brand-soft)">🗓️</div>
        <div class="li-main"><div class="li-title">我的日历</div><div class="li-sub">跳转到数据看板的日历视图</div></div><div class="li-arrow">›</div></div>
      <div class="list-item" data-action="day:indulge"><div class="li-icon" style="background:var(--pink-soft)">🎉</div>
        <div class="li-main"><div class="li-title">标记今天为放纵日</div><div class="li-sub">今天想好好吃一顿？给自己放个假</div></div><div class="li-arrow">›</div></div>
      <div class="list-item" data-action="prof:export"><div class="li-icon" style="background:var(--green-soft)">📤</div>
        <div class="li-main"><div class="li-title">数据导出</div><div class="li-sub">一键导出所有个人数据（JSON/CSV）</div></div><div class="li-arrow">›</div></div>
      <div class="list-item" data-action="prof:settings"><div class="li-icon" style="background:rgba(0,0,0,0.05)">⚙️</div>
        <div class="li-main"><div class="li-title">设置</div><div class="li-sub">通知开关 / 放纵日Emoji选择</div></div><div class="li-arrow">›</div></div>
      <div class="list-item" data-action="prof:about"><div class="li-icon" style="background:var(--purple-soft)">📕</div>
        <div class="li-main"><div class="li-title">关于热量手账</div><div class="li-sub">前期建食谱，后期闭眼记</div></div><div class="li-arrow">›</div></div>
    </div>`;
});
registerAction('prof:avatar', () => {
  openSheet(`
    <div class="sheet-title">选择头像</div>
    <div class="muted small" style="text-align:center;margin-bottom:12px">换个心情，换个头像</div>
    <div class="chips" style="justify-content:center;font-size:26px">${['🥑', '🍊', '🐱', '🐶', '🌿', '🍙', '🦦', '✨', '🐷', '🦄', '🍓', '🥞'].map((e) => `<button class="chip avatar-em" data-action="prof:avatar-set" data-v="${e}">${e}</button>`).join('')}</div>
    <button class="btn block" style="margin-top:14px" data-action="prof:avatar-photo">📷 用照片做头像</button>`);
});
registerAction('prof:avatar-set', async (el) => {
  PROFILE.avatar = el.dataset.v;
  await saveProfile(PROFILE);
  closeSheet(); toast('头像已更新 ✨', 'green'); rerender();
});
registerAction('prof:avatar-photo', () => {
  closeSheet();
  pickPhoto(async (dataURL) => {
    PROFILE.avatar = await compressImage(dataURL, 160, 0.8);
    await saveProfile(PROFILE);
    toast('头像已更新 📷', 'green'); rerender();
  });
});
registerAction('prof:motto', () => {
  openModal(`
    <div class="modal-title">个人格言</div>
    <div class="modal-sub">每天首页都会展示这句话</div>
    <div class="field"><input id="motto-input" type="text" value="${esc(PROFILE.motto)}"></div>
    <button class="btn primary lg" data-action="prof:motto-save">保存</button>`);
});
registerAction('prof:motto-save', async () => {
  PROFILE.motto = $('#motto-input').value.trim() || '慢慢来，比较快';
  await saveProfile(PROFILE);
  closeModal(); toast('已更新 ✨', 'green'); rerender();
});
registerAction('prof:body', () => {
  const p = PROFILE;
  window._gender = p.gender; window._activity = String(p.activity); window._goal = String(p.goal);
  openSheet(`
    <div class="sheet-title">身体数据</div>
    <div class="field"><label>身高（cm）</label><input id="b-h" type="number" value="${p.height || ''}" placeholder="165"></div>
    <div class="field"><label>体重（kg）</label><input id="b-w" type="number" value="${p.weight || ''}" placeholder="55"></div>
    <div class="field"><label>年龄</label><input id="b-a" type="number" value="${p.age || ''}" placeholder="20"></div>
    <div class="field"><label>性别</label>
      <div class="chips">${['female', 'male'].map((g) => `<button class="chip ${window._gender === g ? 'on' : ''}" data-action="prof:gender" data-v="${g}">${g === 'female' ? '👩 女' : '👨 男'}</button>`).join('')}</div></div>
    <div class="field"><label>活动水平</label>
      <div class="chips">${[['1.2', '久坐'], ['1.375', '轻度'], ['1.55', '中度'], ['1.725', '高强度']].map(([v, t]) => `<button class="chip ${window._activity === v ? 'on' : ''}" data-action="prof:act" data-v="${v}">${t}</button>`).join('')}</div></div>
    <div class="field"><label>目标</label>
      <div class="chips">${[['-400', '减脂'], ['0', '保持'], ['200', '增肌']].map(([v, t]) => `<button class="chip ${window._goal === v ? 'on' : ''}" data-action="prof:goal" data-v="${v}">${t}</button>`).join('')}</div></div>
    <button class="btn primary lg" data-action="prof:body-save">保存并重算目标</button>
    <div class="hint" style="text-align:center;margin-top:10px">根据 BMR/TDEE 自动生成每日热量目标</div>`);
});
registerAction('prof:gender', (el) => { window._gender = el.dataset.v; renderSheetChips(el, '#prof-gender'); });
registerAction('prof:act', (el) => { window._activity = el.dataset.v; renderSheetChips(el); });
registerAction('prof:goal', (el) => { window._goal = el.dataset.v; renderSheetChips(el); });
function renderSheetChips(el) {
  const box = el.parentElement;
  if (box) box.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === el));
}
registerAction('prof:body-save', async () => {
  const h = Number($('#b-h').value), w = Number($('#b-w').value), a = Number($('#b-a').value);
  if (!(h > 50 && w > 20 && a > 10)) { toast('请完整填写身体数据', 'red'); return; }
  PROFILE.height = h; PROFILE.weight = w; PROFILE.age = a;
  PROFILE.gender = window._gender || 'female';
  PROFILE.activity = Number(window._activity) || 1.4;
  PROFILE.goal = Number(window._goal) || 0;
  const calc = calcBodyData(PROFILE);
  PROFILE.bmr = calc.bmr; PROFILE.tdee = calc.tdee; PROFILE.targetKcal = calc.targetKcal;
  await saveProfile(PROFILE);
  closeSheet(); toast(`每日目标已更新为 ${calc.targetKcal}kcal 🎯`, 'brand'); rerender();
});
registerAction('prof:contribs', async () => {
  const list = await getContribs();
  const badge = contribBadge(PROFILE.contributionCount);
  const statusColor = (s) => (s === '已通过' ? 'var(--green)' : s === '已驳回' ? 'var(--red)' : 'var(--orange)');
  openSheet(`
    <div class="sheet-title">我的贡献</div>
    <div class="muted small" style="text-align:center;margin-bottom:12px">已贡献 ${PROFILE.contributionCount} 次 · ${badge ? `当前称号：<b>${badge.emoji} ${badge.name}</b>` : '提交 1 次解锁「新品体验官」'}</div>
    ${list.length ? list.map((c) => `
      <div class="order-card">
        <div class="order-emoji" style="background:var(--orange-soft)">🧋</div>
        <div class="order-info"><div class="order-name">${esc(c.name)}${c.hot ? ' <span class="cat-tag" style="background:var(--red-soft);color:var(--red)">🔥热门新品</span>' : ''}</div>
          <div class="order-shop">${esc(c.brand || '')} · ¥${c.price}${c.kcal ? ' · ' + c.kcal + 'kcal' : ''} · ${esc(c.series || '自动归类')}${c.spec ? ' · ' + esc(c.spec) : ''}</div></div>
        <div class="order-save" style="color:${statusColor(c.status)}">${c.status}</div>
      </div>`).join('') : `<div class="empty-state"><div class="es-icon">📮</div><div class="es-title">还没有贡献</div><div class="es-sub">在「记录」页没找到想吃的？点我新增，帮大家一起建库</div></div>`}
    <button class="btn block" data-action="contrib:open">＋ 提交新品</button>`);
});
registerAction('prof:settings', () => {
  openSheet(`
    <div class="sheet-title">设置</div>
    <div class="card" style="box-shadow:none;background:rgba(0,0,0,0.03)">
      <div class="flex-between" style="padding:6px 2px">
        <div><div style="font-weight:700;font-size:14.5px">餐前提醒通知</div>
        <div class="muted small">开启后餐前收到秘书的温柔提醒</div></div>
        <input type="checkbox" id="notify-switch" ${PROFILE.notifyOn ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--brand)"></div>
      <div class="divider"></div>
      <div><div style="font-weight:700;font-size:14.5px;margin-bottom:10px">放纵日 Emoji 选择</div>
        <div class="chips">${['🎉', '🍔', '🍕', '🎂', '🎊', '✨'].map((e) => `<button class="chip ${PROFILE.indulgenceEmoji === e ? 'on' : ''}" data-action="prof:emoji" data-v="${e}">${e}</button>`).join('')}</div></div>
    </div>
    <div class="hint" style="text-align:center;margin-top:10px">所有数据存储在本机，飞行模式也能用 ✈️</div>`);
  $('#notify-switch').addEventListener('change', async (e) => {
    PROFILE.notifyOn = e.target.checked;
    await saveProfile(PROFILE);
    toast(PROFILE.notifyOn ? '已开启餐前提醒 🔔' : '已关闭通知', 'brand');
  });
});
registerAction('prof:emoji', async (el) => {
  PROFILE.indulgenceEmoji = el.dataset.v;
  await saveProfile(PROFILE);
  toast(`放纵日标记改为 ${el.dataset.v}`, 'brand');
  rerender();
});
registerAction('prof:export', () => {
  openSheet(`
    <div class="sheet-title">数据导出</div>
    <div class="muted small" style="text-align:center;margin-bottom:14px">一键导出所有个人数据，JSON 或 CSV 任选</div>
    <button class="btn primary block" data-action="prof:export-json" style="margin-bottom:10px">⬇️ 导出 JSON（完整数据）</button>
    <button class="btn block" data-action="prof:export-csv">⬇️ 导出 CSV（记录明细）</button>`);
});
registerAction('prof:export-json', async () => {
  const data = await exportAllData();
  downloadJSON(data, `热量手账-数据备份-${todayKey()}.json`);
  toast('已导出 JSON 📦', 'green');
  closeSheet();
});
registerAction('prof:export-csv', async () => {
  const recs = await getRecords();
  const rows = recs.map((r) => [r.date, r.foodName, r.kcal, r.price, r.meal, r.shop, r.portion]);
  downloadCSV(`热量手账-记录-${todayKey()}.csv`, ['日期', '食物', '热量kcal', '价格', '餐次', '店铺', '分量'], rows);
  toast('已导出 CSV 📊', 'green');
  closeSheet();
});
registerAction('prof:about', () => {
  openModal(`
    <div class="modal-title">📕 热量手账</div>
    <div class="modal-sub" style="line-height:1.8">
      为自己而用的私密热量管理手账。<br><br><b>不社交 · 不排行榜 · 不比较 · 不焦虑</b><br><br>
      前期建食谱，后期闭眼记。<br>吃外卖，也能吃明白。<br><br>所有数据存储本地，离线可用。
    </div>
    <div class="muted small" style="margin-bottom:14px">v1.0.0 · 2026</div>
    <button class="btn primary lg" data-action="modal:close">知道了</button>`);
});

/* ============================================================
 * 用户贡献新品（AI 自动归类 + 名称消歧）
 * ============================================================ */
registerAction('contrib:open', () => {
  closeSheet();
  openSheet(`
    <div class="sheet-title">没找到？点我新增</div>
    <div class="muted small" style="text-align:center;margin-bottom:14px">提交后 AI 会自动归类，帮助大家一起建库</div>
    <div class="field"><label>饮品/食物名称 <span class="req">*</span></label><input id="c-name" type="text" placeholder="如：海盐芝士拿铁"></div>
    <div class="field"><label>品牌名 <span class="req">*</span></label><input id="c-brand" type="text" placeholder="如：瑞幸咖啡 / 学校门口奶茶店"></div>
    <div class="field"><label>价格（元）<span class="req">*</span></label><input id="c-price" type="number" step="0.1" placeholder="如：15"></div>
    <div class="field"><label>热量（kcal，选填）</label><input id="c-kcal" type="number" placeholder="如：320"></div>
    <div class="field"><label>规格（选填）</label><input id="c-spec" type="text" placeholder="如：大杯/全糖/加珍珠"></div>
    <div class="field"><label>照片（选填）</label>
      <div class="photo-pick" data-action="contrib:photo">${window._contribPhoto ? `<img src="${window._contribPhoto}"><div class="pp-x" data-action="contrib:photo-clear">✕</div>` : '<span>＋</span><span>上传照片</span>'}</div></div>
    <button class="btn primary lg" data-action="contrib:submit">提交给 AI 归类</button>`);
  window._contribPhoto = window._contribPhoto || '';
});
registerAction('contrib:photo', () => {
  pickPhoto((dataURL) => { window._contribPhoto = dataURL; document.querySelector('[data-action="contrib:open"]') && openContribRedraw(); });
});
registerAction('contrib:photo-clear', (el) => {
  el.stopPropagation();
  window._contribPhoto = '';
  document.querySelector('[data-action="contrib:open"]') && openContribRedraw();
});
function openContribRedraw() { document.querySelector('[data-action="contrib:open"]').click(); }
registerAction('contrib:submit', async () => {
  const name = $('#c-name').value.trim();
  const brand = $('#c-brand').value.trim();
  const price = Number($('#c-price').value);
  if (!name || !brand || !(price > 0)) { toast('名称、品牌、价格必填哦', 'red'); return; }
  const kcal = Number($('#c-kcal').value) || null;
  const spec = $('#c-spec') ? $('#c-spec').value.trim() : '';
  // AI 自动归类：品牌匹配 + 系列推测 + 名称消歧
  let series = guessSeries(name);
  let matchBrand = null;
  BRANDS.forEach((b) => { if (b.name.includes(brand) || brand.includes(b.name)) matchBrand = b; });
  const contrib = {
    name, brand, price, kcal, spec, photo: window._contribPhoto || '',
    series: series === '其他' && !matchBrand ? '其他' : series,
    matchBrand: !!matchBrand
  };
  await addContrib(contrib);
  // 同款消歧：品牌内相似度>80% 合并提示
  let hint = `已提交「${name}」→ AI 归类为「${contrib.series}」系列`;
  const brandItems = matchBrand ? matchBrand.items : [];
  const dup = brandItems.find((it) => nameSimilarity(it.name, name) > 0.8);
  if (dup) hint += ` · 与「${dup.name}」相似度高，已合并参考`;
  // 众包验证（addContrib 内已处理）：≥3 次提交自动打「热门新品」标签
  PROFILE.contributionCount = (PROFILE.contributionCount || 0) + 1;
  const bd = contribBadge(PROFILE.contributionCount);
  const badge = bd && [1, 5, 10].includes(PROFILE.contributionCount) ? ` · 解锁「${bd.emoji} ${bd.name}」称号！` : '';
  await saveProfile(PROFILE);
  closeSheet();
  toast(`${hint}（状态：${contrib.status}）${badge}`, 'brand');
});

/* ============================================================
 * 新手引导（首次打开）
 * ============================================================ */
const ONB = { step: 1, data: {} };
function openOnboarding() {
  ONB.step = 1;
  renderOnb();
}
function renderOnb() {
  const p = ONB.data;
  const html = `
    <div class="modal-title">${ONB.step === 1 ? '先认识一下你 👋' : ONB.step === 2 ? '你的日常活动量？' : '最后一步 ✨'}</div>
    <div class="onboard-progress">${[1, 2, 3].map((s) => `<div class="dot ${ONB.step >= s ? 'on' : ''}"></div>`).join('')}</div>
    ${ONB.step === 1 ? `
      <div class="field"><label>身高（cm）</label><input id="o-h" type="number" placeholder="165" value="${p.height || ''}"></div>
      <div class="field"><label>体重（kg）</label><input id="o-w" type="number" placeholder="55" value="${p.weight || ''}"></div>
      <div class="field"><label>年龄</label><input id="o-a" type="number" placeholder="20" value="${p.age || ''}"></div>
      <div class="field"><label>性别</label>
        <div class="chips">${['female', 'male'].map((g) => `<button class="chip ${(p.gender || 'female') === g ? 'on' : ''}" data-action="onb:gender" data-v="${g}">${g === 'female' ? '👩 女' : '👨 男'}</button>`).join('')}</div></div>
    ` : ONB.step === 2 ? `
      <div class="field"><label>活动水平</label>
        <div class="chips" style="flex-direction:column;align-items:stretch;gap:8px">
          ${[['1.2', '🪑 久坐', '上课/办公为主，几乎不运动'], ['1.375', '🚶 轻度', '每周1-3次轻运动'], ['1.55', '🏃 中度', '每周3-5次规律运动'], ['1.725', '🏋️ 高强度', '每天高强度训练']].map(([v, t, d]) => `
            <button class="chip" style="text-align:left;padding:10px 14px;white-space:normal" data-action="onb:act" data-v="${v}">
              <b>${t}</b><span class="muted small" style="display:block;font-weight:400">${d}</span></button>`).join('')}
        </div></div>
      <div class="field"><label>目标</label>
        <div class="chips">${[['-400', '🍽️ 减脂'], ['0', '⚖️ 保持'], ['200', '💪 增肌']].map(([v, t]) => `<button class="chip ${(p.goal || '0') === v ? 'on' : ''}" data-action="onb:goal" data-v="${v}">${t}</button>`).join('')}</div></div>
    ` : `
      <div class="field"><label>昵称</label><input id="o-name" type="text" placeholder="手账同学" value="${p.nickname || ''}"></div>
      <div class="field"><label>个人格言</label><input id="o-motto" type="text" placeholder="慢慢来，比较快" value="${p.motto || ''}"></div>
      <div class="card" style="background:var(--brand-soft);box-shadow:none;text-align:center;padding:16px">
        <div class="muted small">根据你的身体数据，系统将自动计算</div>
        <div class="big" style="color:var(--brand);margin:4px 0">每日目标 ${calcBodyData({ height: p.height, weight: p.weight, age: p.age, gender: p.gender || 'female', activity: Number(p.activity) || 1.4, goal: Number(p.goal) || 0 }).targetKcal} kcal</div>
        <div class="muted small">前期精确显示 · 后期区间估算，越用越懂你</div>
      </div>`}
    <div class="flex" style="gap:10px;margin-top:8px">
      ${ONB.step > 1 ? `<button class="btn ghost" style="flex:1" data-action="onb:prev">上一步</button>` : ''}
      ${ONB.step < 3 ? `<button class="btn primary" style="flex:2" data-action="onb:next">下一步 →</button>`
        : `<button class="btn primary lg" data-action="onb:finish">开启热量手账 🎉</button>`}
    </div>`;
  openModal(html);
}
registerAction('onb:gender', (el) => { ONB.data.gender = el.dataset.v; renderOnb(); });
registerAction('onb:act', (el) => { ONB.data.activity = el.dataset.v; renderOnb(); });
registerAction('onb:goal', (el) => { ONB.data.goal = el.dataset.v; renderOnb(); });
registerAction('onb:prev', () => { ONB.step--; renderOnb(); });
registerAction('onb:next', () => {
  if (ONB.step === 1) {
    const h = Number($('#o-h').value), w = Number($('#o-w').value), a = Number($('#o-a').value);
    if (!(h > 50 && w > 20 && a > 10)) { toast('请先填写身高/体重/年龄', 'red'); return; }
    Object.assign(ONB.data, { height: h, weight: w, age: a });
  }
  ONB.step++;
  renderOnb();
});
registerAction('onb:finish', async () => {
  const name = ($('#o-name') && $('#o-name').value.trim()) || '手账同学';
  const motto = ($('#o-motto') && $('#o-motto').value.trim()) || '慢慢来，比较快';
  const d = ONB.data;
  PROFILE.nickname = name; PROFILE.motto = motto; PROFILE.onboarded = true;
  if (d.height && d.weight && d.age) {
    PROFILE.height = d.height; PROFILE.weight = d.weight; PROFILE.age = d.age;
    PROFILE.gender = d.gender || 'female';
    PROFILE.activity = Number(d.activity) || 1.4;
    PROFILE.goal = Number(d.goal) || 0;
    const calc = calcBodyData(PROFILE);
    PROFILE.bmr = calc.bmr; PROFILE.tdee = calc.tdee; PROFILE.targetKcal = calc.targetKcal;
  }
  await saveProfile(PROFILE);
  closeModal();
  toast(`🎉 欢迎，${esc(name)}！每日目标 ${PROFILE.targetKcal}kcal`, 'brand');
  // 引导录入第一样食物
  setTimeout(() => openManualForm(), 800);
});

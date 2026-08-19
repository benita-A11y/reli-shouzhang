/* ============================================================
 * 热量手账 · 页面组1：首页 / 记录 / 我的食谱
 * ============================================================ */
'use strict';

/* ============================================================
 * 首页（今日仪表盘）
 * ============================================================ */
registerPage('home', async function (root) {
  const today = todayKey();
  const stats = await getDayStats(today);
  const target = PROFILE.targetKcal || 1800;
  const remaining = Math.max(0, target - stats.kcal);
  const mt = macroTargets(PROFILE, target);
  const pct = Math.min(1, stats.kcal / target);
  const ringColor = remaining / target > 0.5 ? '#34C759' : remaining / target > 0.2 ? '#FF9500' : '#FF3B30';

  const recent = await getRecentSix();
  const groups = { breakfast: [], lunch: [], dinner: [], snack: [] };
  stats.records.forEach((r) => { if (groups[r.meal]) groups[r.meal].push(r); });
  const needCount = Math.max(0, 5 - FOODS.length);
  const C = 2 * Math.PI * 88;

  root.innerHTML = `
    <div class="page-head">
      <div>
        <div class="page-title">${fmtDateCN(new Date())}</div>
        <div class="page-sub">${esc(greeting())} · 只为更好的自己</div>
      </div>
      <button class="btn sm primary" data-action="nav:go" data-page="record">＋ 记录</button>
    </div>
    ${needCount > 0 ? `
    <div class="card" style="display:flex;align-items:center;gap:12px;padding:16px 18px">
      <div style="font-size:26px">📘</div>
      <div style="flex:1;font-size:13px;line-height:1.55">
        <b>前期建食谱，后期闭眼记。</b>
        <div class="muted small">再录 ${needCount} 样，就能开启「闭眼记」模式！</div>
      </div>
      <button class="btn sm" data-action="nav:go" data-page="recipes">去建库</button>
    </div>` : ''}
    <div class="card" style="text-align:center">
      <div class="ring-wrap">
        <svg width="216" height="216" viewBox="0 0 216 216">
          <circle cx="108" cy="108" r="88" fill="none" stroke="#E9E9EC" stroke-width="16"/>
          <circle cx="108" cy="108" r="88" fill="none" stroke="${ringColor}" stroke-width="16" stroke-linecap="round"
            stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}" style="transition:stroke-dashoffset .8s cubic-bezier(.25,.8,.35,1),stroke .4s"/>
        </svg>
        <div class="ring-center">
          <div class="rc-num">${remaining.toLocaleString()} <small style="font-size:14px;color:var(--sub)">kcal</small></div>
          <div class="rc-label">今日剩余热量</div>
          <div class="rc-extra" style="color:${ringColor}">目标 ${target}kcal · 已吃 ${stats.kcal}kcal</div>
        </div>
      </div>
      <div style="margin-top:18px">
        ${[['protein', '蛋白质', '#007AFF', stats.protein, mt.protein], ['carbs', '碳水', '#FF9500', stats.carbs, mt.carbs], ['fat', '脂肪', '#AF52DE', stats.fat, mt.fat]].map(([k, label, color, val, tgt]) => `
          <div class="macro-row">
            <div class="macro-label"><span class="macro-dot" style="background:${color}"></span>${label}</div>
            <div class="macro-track"><div class="macro-fill" style="width:${Math.min(100, (val / tgt) * 100)}%;background:${color}"></div></div>
            <div class="macro-val"><b>${val}</b>/${tgt}g</div>
          </div>`).join('')}
      </div>
    </div>
    <div class="section-title">⚡ 快速记录 <span class="small muted" style="font-weight:500">点一下，3秒完成</span></div>
    <div class="card" style="padding:14px 16px">
      <div class="quick-row">
        ${recent.length ? recent.map((f, i) => `
          <div class="quick-item" data-action="quick:record" data-i="${i}">
            <div class="quick-photo">${f.photo ? `<img src="${f.photo}">` : `<span>${foodEmoji(f)}</span>`}</div>
            <div class="q-name">${esc(f.name)}</div>
            <div class="q-ago">${f.ago === '—' ? '食谱库' : '上次吃：' + f.ago}</div>
          </div>`).join('') : `<div class="muted small" style="padding:18px">还没吃过东西，去「记录」添加第一样吧</div>`}
      </div>
    </div>
    <div class="section-title">📋 今日已吃 <span class="small muted" style="font-weight:500">共 ${stats.count} 样 · ${stats.kcal}kcal</span></div>
    <div class="card" style="padding:16px">
      ${MEALS.map((m) => `
        <div class="meal-block">
          <div class="meal-head">
            <span class="meal-emoji">${m.emoji}</span><span class="meal-name">${m.label}</span>
            <span class="meal-kcal"><b>${groups[m.k].reduce((a, r) => a + r.kcal, 0)}</b> kcal</span>
          </div>
          ${groups[m.k].length ? groups[m.k].map((r) => `
            <div class="food-line">
              <div class="fl-photo">${photoHTML(r)}</div>
              <div class="fl-info"><div class="fl-name">${esc(r.foodName)}</div>
                <div class="fl-meta">${esc(r.portion || '')}${r.shop ? ' · ' + esc(r.shop) : ''}</div></div>
              <div class="fl-kcal">${r.kcal}kcal</div>
              <div class="fl-del" data-action="rec:del" data-id="${r.id}">✕</div>
            </div>`).join('') : `<div class="muted small" style="padding:6px 2px 10px">${m.k === 'breakfast' ? '记得吃早餐哦' : '可以去「觅食」看看吃什么'}</div>`}
        </div>`).join('')}
    </div>`;
});

async function getRecentSix() {
  const recs = await getRecords();
  const seen = new Set();
  const recent = [];
  for (const r of recs) {
    const key = r.foodName + (r.shop || '');
    if (seen.has(key)) continue;
    seen.add(key);
    recent.push({ name: r.foodName, kcal: r.kcal, photo: r.foodPhoto, ago: daysAgoText(r.date), id: r.foodId, shop: r.shop, category: r.category, portion: r.portion, macros: r.macros, price: r.price });
    if (recent.length >= 6) break;
  }
  let i = 0;
  while (recent.length < 6 && FOODS.length && i < FOODS.length) {
    const f = FOODS[i++];
    if (seen.has(f.name + (f.shop || ''))) continue;
    seen.add(f.name + (f.shop || ''));
    recent.push({ name: f.name, kcal: f.kcal, photo: f.photo, ago: '—', id: f.id, shop: f.shop, category: f.category, portion: f.portion, macros: f.macros, price: f.price });
  }
  return recent;
}
registerAction('quick:record', async (el) => {
  const idx = Number(el.dataset.i);
  const recent = await getRecentSix();
  const food = recent[idx];
  if (!food) return;
  await recordFood(food, defaultMeal());
});
registerAction('rec:del', async (el) => {
  await delRecord(el.dataset.id);
  toast('已删除', 'brand');
  rerender();
});

/* ============================================================
 * 记录页（拍照识别 / 手动录入）
 * ============================================================ */
const REC = { photo: null, candidates: [], picked: null };

registerPage('record', function (root) {
  root.innerHTML = `
    <div class="page-head">
      <div>
        <div class="page-title"><span class="page-emoji">📷</span>记录</div>
        <div class="page-sub">拍照识别 · 或手动录入</div>
      </div>
    </div>
    <div class="card" style="padding:18px">
      <div class="viewfinder">
        <div class="vf-center">
          <div class="vf-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13.5" r="3.5"/></svg>
          </div>
          <div class="vf-text">把食物放进圆框</div>
        </div>
      </div>
      <div class="flex" style="gap:10px;justify-content:center">
        <button class="btn primary" data-action="rec:camera">📸 拍照识别</button>
        <button class="btn" data-action="rec:album">🖼️ 相册选图</button>
      </div>
      <div class="hint" style="text-align:center;margin-top:10px">识别在本地完成，不联网也能用 · 前期也可直接手动录入</div>
    </div>
    <div class="card">
      <div class="search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <input id="rec-search" placeholder="搜索食物库，直接记录…" autocomplete="off">
      </div>
      <div id="rec-search-result"></div>
      <div class="divider"></div>
      <button class="btn block" data-action="rec:manual">＋ 快速录入（自己写）</button>
      <div class="hint" style="text-align:center;margin-top:10px">没找到想吃的？<span style="color:var(--brand);cursor:pointer" data-action="contrib:open">没找到？点我新增 →</span></div>
    </div>`;
  $('#rec-search').addEventListener('input', (e) => renderSearchResult(e.target.value));
});
async function renderSearchResult(q) {
  const box = $('#rec-search-result');
  if (!q.trim()) { box.innerHTML = ''; return; }
  const list = FOODS.filter((f) => f.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6);
  box.innerHTML = list.length ? list.map((f) => `
    <div class="food-line" data-action="rec:quick" data-id="${f.id}">
      <div class="fl-photo">${photoHTML(f)}</div>
      <div class="fl-info"><div class="fl-name">${esc(f.name)}</div><div class="fl-meta">${dk(f.kcal)}</div></div>
      <div class="fl-kcal" style="color:var(--brand);font-size:12px">点一下记录</div>
    </div>`).join('') : `<div class="muted small" style="padding:10px 4px">食谱库没有「${esc(q.trim())}」…<span style="color:var(--brand);cursor:pointer" data-action="contrib:open">点我新增 →</span></div>`;
}
registerAction('rec:quick', async (el) => {
  const f = FOODS.find((x) => x.id === el.dataset.id);
  if (f) askMealSheet(f);
});
/* 拍照识别（端侧模拟：本地匹配食物库） */
function recPhotoStart(capture) {
  pickPhoto(async (dataURL) => {
    REC.photo = dataURL; REC.picked = null;
    replaceSheet(`
      <div class="sheet-title">🤖 正在识别…</div>
      <div style="text-align:center;padding:26px 0">
        <img src="${dataURL}" style="width:150px;height:150px;border-radius:24px;object-fit:cover;margin:0 auto;filter:blur(1px)">
        <div class="muted small" style="margin-top:14px">本地模型推理中，请稍候</div>
      </div>`);
    setTimeout(async () => {
      const pool = FOODS.length ? FOODS : [{ id: null, name: '未知食物', kcal: 300, category: '外卖', shop: '', portion: '一份', macros: null, price: 0 }];
      const picks = pool.slice(0, Math.min(4, pool.length));
      REC.candidates = picks;
      const stats = await getDayStats(todayKey());
      const remaining = Math.max(0, (PROFILE.targetKcal || 1800) - stats.kcal);
      replaceSheet(`
        <div class="sheet-title">识别到以下食物，选一个？</div>
        ${picks.map((f, i) => {
          const tl = trafficLight(f.kcal, remaining, PROFILE.recordTotal);
          return `
          <div class="food-line" data-action="rec:candidate" data-i="${i}">
            <div class="fl-photo">${photoHTML(f)}</div>
            <div class="fl-info"><div class="fl-name">${esc(f.name)} <span class="traffic ${tl.level}"></span></div>
              <div class="fl-meta">${dk(f.kcal)} · 置信度 ${(92 + i * 2)}%</div></div>
            <div class="fl-kcal">${f.kcal}kcal</div>
          </div>`;}).join('')}
        <button class="btn ghost block" data-action="rec:manual" style="margin-top:6px">都不是，手动录入</button>`);
    }, 1200);
  }, capture);
}
registerAction('rec:camera', () => recPhotoStart(true));
registerAction('rec:album', () => recPhotoStart(false));
registerAction('rec:candidate', (el) => {
  const f = REC.candidates[Number(el.dataset.i)];
  if (f) { REC.picked = f; renderRecResult(f); }
});
async function renderRecResult(f) {
  const target = PROFILE.targetKcal || 1800;
  const remaining = Math.max(0, target - (await getDayStats(todayKey())).kcal);
  const tl = trafficLight(f.kcal, remaining, PROFILE.recordTotal);
  const btnCls = tl.level === 'green' ? 'green' : tl.level === 'red' ? 'red' : 'primary';
  replaceSheet(`
    <div class="sheet-title">识别结果</div>
    <div class="card" style="margin-bottom:0;box-shadow:none;background:rgba(0,0,0,0.03)">
      <div class="food-line" style="box-shadow:none;background:transparent;padding:4px 0">
        <div class="fl-photo" style="width:56px;height:56px;border-radius:18px">${photoHTML(f, true)}</div>
        <div class="fl-info">
          <div class="fl-name" style="font-size:16px">${esc(f.name)}</div>
          <div class="fl-meta">${esc(f.portion || '约一份')} · 约 ${Math.max(30, Math.round(f.kcal / 1.3))}g · 预估 ${Math.round(f.kcal * 0.5)}~${f.kcal}kcal</div>
        </div>
        <div class="fl-kcal" style="font-size:18px">${f.kcal}kcal</div>
      </div>
      <div style="margin-top:6px"><span class="light-badge ${tl.level}">${tl.level === 'green' ? '🟢 放心吃' : tl.level === 'yellow' ? '🟡 控制量' : '🔴 今天超标'}</span></div>
      <div class="reason-box">${esc(tl.reason)}</div>
    </div>
    <div style="height:10px"></div>
    <button class="btn ${btnCls} lg" data-action="rec:confirm">确认记录到${MEALS.find((m) => m.k === defaultMeal()).label}</button>
    <div style="height:8px"></div>
    <button class="btn ghost block" data-action="sheet:close">换一个</button>`);
}
registerAction('rec:confirm', async () => {
  const f = REC.picked;
  if (!f) return;
  closeSheet();
  await recordFood({ id: f.id || null, name: f.name, kcal: f.kcal, photo: f.photo || REC.photo, shop: f.shop, category: f.category, portion: f.portion, macros: f.macros, price: f.price }, defaultMeal());
});
/* 快速录入表单 */
window._formPhoto = '';
window._formCat = '食堂';
window._formUpdateCal = false;
window._formCompare = null;
window._formCompareId = null;

function openManualForm(existing, compare) {
  const f = existing || {};
  openSheet(`
    <div class="sheet-title">${existing ? '编辑食物' : '快速录入'}</div>
    <div class="field">
      <label>照片 <span class="req">*</span></label>
      <div class="photo-pick" data-action="form:photo">
        ${f.photo ? `<img src="${f.photo}"><div class="pp-x" data-action="form:photo-clear">✕</div>` : '<span>＋</span><span>拍照 / 相册</span>'}
      </div>
    </div>
    <div class="field"><label>食物名称 <span class="req">*</span></label><input id="f-name" type="text" placeholder="如：食堂麻辣香锅" value="${esc(f.name || '')}"></div>
    <div class="field"><label>预估热量（kcal）<span class="req">*</span></label><input id="f-kcal" type="number" placeholder="如：580" value="${f.kcal != null ? f.kcal : ''}"></div>
    <div class="field"><label>价格（元，选填）</label><input id="f-price" type="number" step="0.1" placeholder="用于多巴胺账单省钱统计" value="${f.price != null ? f.price : ''}"></div>
    <div class="field"><label>店铺名（选填）</label><input id="f-shop" type="text" placeholder="用于觅食页关联" value="${esc(f.shop || '')}"></div>
    <div class="field"><label>分量描述（选填）</label><input id="f-portion" type="text" placeholder="一碗 / 一份 / 大份 / 小份" value="${esc(f.portion || '')}"></div>
    <div class="field">
      <label>分类</label>
      <div class="chips" id="f-cat">
        ${['食堂', '外卖', '自制', '饮品'].map((c) => `<button class="chip ${(f.category || '食堂') === c ? 'on' : ''}" data-action="form:cat" data-v="${c}">${c}</button>`).join('')}
      </div>
    </div>
    ${compare ? `<div class="card" style="box-shadow:none;background:var(--brand-soft);padding:14px;margin-bottom:6px">
      <div class="small" style="font-weight:800;color:var(--brand);margin-bottom:8px">📢 平台数据有更新</div>
      <div class="small" style="line-height:1.8">
        <div>原数据（你的录入）：<b>约${f.kcal}kcal</b></div>
        <div>新数据（平台校准）：<b>${compare.kcal}kcal</b> <span class="muted">（来源：${esc(compare.source)}）</span></div>
      </div>
      <div class="flex" style="margin-top:10px;gap:8px">
        <button class="btn sm primary" data-action="form:update-cal">一键更新</button>
        <button class="btn sm ghost" data-action="form:ignore-cal">忽略</button>
      </div>
    </div>` : ''}
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
      <input type="checkbox" id="also-record" ${existing ? '' : 'checked'} style="width:18px;height:18px;accent-color:var(--brand)">
      <label for="also-record" class="small muted" style="cursor:pointer">保存${existing ? '' : '并记录到今日（' + MEALS.find((m) => m.k === defaultMeal()).label + '）'}</label>
    </div>
    <button class="btn primary lg" data-action="form:save" data-id="${f.id || ''}">${existing ? '保存修改' : '保存'}</button>`);
  window._formPhoto = f.photo || '';
  window._formCat = f.category || '食堂';
  window._formUpdateCal = false;
  window._formCompare = compare;
  window._formCompareId = existing ? existing.id : null;
}
registerAction('rec:manual', () => openManualForm());
registerAction('form:photo', () => {
  pickPhoto((dataURL) => {
    window._formPhoto = dataURL;
    openManualForm(null); // 重绘保持照片
  });
});
registerAction('form:photo-clear', (el) => {
  el.stopPropagation();
  window._formPhoto = '';
  openManualForm(null);
});
registerAction('form:cat', (el) => {
  window._formCat = el.dataset.v;
  document.querySelectorAll('#f-cat .chip').forEach((c) => c.classList.toggle('on', c === el));
});
registerAction('form:update-cal', () => {
  const cal = window._formCompare;
  if (!cal) return;
  $('#f-kcal').value = cal.kcal;
  window._formUpdateCal = true;
  toast(`已采用平台数据 ${cal.kcal}kcal ✓`, 'green');
  const panel = $('#sheet-root .card');
  if (panel && panel.querySelector('[data-action="form:update-cal"]')) panel.style.display = 'none';
});
registerAction('form:ignore-cal', () => {
  window._formUpdateCal = false;
  const panel = $('#sheet-root .card');
  if (panel && panel.querySelector('[data-action="form:update-cal"]')) panel.style.display = 'none';
  toast('已忽略，继续使用你的数据', 'brand');
});
registerAction('form:save', async (el) => {
  const id = el.dataset.id;
  const name = $('#f-name').value.trim();
  const kcal = Number($('#f-kcal').value);
  if (!name || !(kcal > 0)) { toast('名称和热量必填哦', 'red'); return; }
  if (!id && !window._formPhoto) { toast('新增食物请先拍张照片哦 📷', 'red'); return; }
  const now = nowISO();
  const old = id ? (FOODS.find((x) => x.id === id) || null) : null;
  const food = {
    id: id || uid(), name, kcal: Math.round(kcal),
    price: Number($('#f-price').value) || 0,
    shop: $('#f-shop').value.trim(),
    portion: $('#f-portion').value.trim() || '一份',
    category: window._formCat || '食堂',
    photo: window._formPhoto || '',
    createdAt: old ? old.createdAt : now,
    updatedAt: now,
    editCount: old ? (old.editCount || 0) + 1 : 0,
    macros: old ? old.macros : estimateMacros(kcal)
  };
  if (window._formUpdateCal) { food.calAdopted = true; }
  const synced = await saveFood(food);
  await loadFoods();
  if (old && synced > 0) toast(`已同步 ${synced} 条历史记录的名称/照片 · 历史热量保持不变`, 'brand');
  const also = $('#also-record') && $('#also-record').checked;
  closeSheet();
  if (also) {
    await recordFood(food, defaultMeal());
  } else {
    toast('已存入食谱库 📖', 'green');
    rerender();
  }
  if (!id && FOODS.length === 5 && !congratsShown) {
    congratsShown = true;
    toast('🎉 你的专属食谱库已就绪！点两下就能记录', 'brand');
  }
});

/* ============================================================
 * 我的食谱（专属食品库）
 * ============================================================ */
let RECIPES_FILTER = '全部';
let RECIPES_Q = '';
let RECIPES_SORT = 'recent';
registerPage('recipes', async function (root) {
  await loadFoods();
  const filter = RECIPES_FILTER;
  const q = RECIPES_Q;
  const sort = RECIPES_SORT;
  let list = FOODS.slice();
  if (filter !== '全部') list = list.filter((f) => f.category === filter);
  if (q) list = list.filter((f) => f.name.toLowerCase().includes(q.toLowerCase()));
  if (sort === 'kcal-asc') list.sort((a, b) => (a.kcal || 0) - (b.kcal || 0));
  else if (sort === 'kcal-desc') list.sort((a, b) => (b.kcal || 0) - (a.kcal || 0));
  else if (sort === 'name') list.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'zh'));
  else list.sort((a, b) => ((b.lastEatenAt || b.updatedAt) || '').localeCompare((a.lastEatenAt || a.updatedAt) || ''));

  root.innerHTML = `
    <div class="page-head">
      <div>
        <div class="page-title"><span class="page-emoji">📖</span>我的食谱</div>
        <div class="page-sub">你的专属食品库 · ${FOODS.length} 样食物</div>
      </div>
      <button class="btn sm primary" data-action="food:add">＋ 添加</button>
    </div>
    <div class="search" style="margin-bottom:12px">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input id="recipes-search" placeholder="搜索食物…" value="${esc(q)}" autocomplete="off">
    </div>
    <div class="chips" id="recipes-chips" style="margin-bottom:10px">
      ${['全部', '外卖', '食堂', '自制', '饮品'].map((c) => `<button class="chip ${filter === c ? 'on' : ''}" data-action="recipes:cat" data-v="${c}">${c}</button>`).join('')}
    </div>
    <div class="chips" id="recipes-sort" style="margin-bottom:16px;opacity:.85">
      ${[['recent', '⏱️ 最近食用'], ['kcal-asc', '热量低→高'], ['kcal-desc', '热量高→低'], ['name', '🔤 名称']].map(([v, t]) => `<button class="chip sm ${sort === v ? 'on' : ''}" data-action="recipes:sort" data-v="${v}">${t}</button>`).join('')}
    </div>
    ${list.length ? `<div class="food-grid">
      ${list.map((f) => {
        const cal = PLATFORM_CALIBRATIONS[f.name];
        const hasNew = cal && f.kcal !== cal.kcal && !f.calAdopted;
        return `
        <div class="food-card" data-action="food:detail" data-id="${f.id}">
          ${hasNew ? '<div class="badge-new">📢 有更新</div>' : ''}
          <div class="fc-edit" data-action="food:edit" data-id="${f.id}">···</div>
          <div class="fc-photo">${photoHTML(f, true)}</div>
          <div class="fc-body">
            <div class="fc-name">${esc(f.name)} <span class="cat-tag">${f.category || ''}</span></div>
            <div class="fc-kcal">${dkr(f.kcal)}</div>
            <div class="fc-meta">${f.lastEatenAt ? '上次吃：' + daysAgoText(f.lastEatenAt.slice(0, 10)) : '还没吃过'}${f.price ? ' · ¥' + f.price : ''}</div>
            <div class="fc-meta">上次更新：${(f.updatedAt || f.createdAt || '').slice(0, 10)} | 已编辑${f.editCount || 0}次</div>
          </div>
        </div>`;}).join('')}
    </div>` : `
    <div class="empty-state">
      <div class="es-icon">📖</div>
      <div class="es-title">食谱库还空着</div>
      <div class="es-sub">还没录入食物？点击下方「添加新食物」开始建立你的专属食谱库吧</div>
      <div style="height:16px"></div>
      <button class="btn primary" data-action="food:add">＋ 添加新食物</button>
    </div>`}`;
  $('#recipes-search').addEventListener('input', (e) => {
    RECIPES_Q = e.target.value;
    renderPage('recipes');
  });
  // 长按卡片 → 快速记录
  setTimeout(() => {
    document.querySelectorAll('.food-card').forEach((card) => {
      bindLongPress(card, () => {
        const f = FOODS.find((x) => x.id === card.dataset.id);
        if (f) askMealSheet(f);
      });
    });
  }, 60);
});
registerAction('recipes:cat', (el) => {
  RECIPES_FILTER = el.dataset.v;
  renderPage('recipes');
});
registerAction('recipes:sort', (el) => {
  RECIPES_SORT = el.dataset.v;
  renderPage('recipes');
});
registerAction('food:add', () => openManualForm());
registerAction('food:edit', async (el) => {
  await loadFoods();
  const f = FOODS.find((x) => x.id === el.dataset.id);
  if (!f) return;
  openSheet(`
    <div class="sheet-title">「${esc(f.name)}」</div>
    <div class="food-line" data-action="food:edit-open" data-id="${f.id}">
      <div class="fl-photo" style="background:var(--brand-soft)">✏️</div>
      <div class="fl-info"><div class="fl-name">编辑</div><div class="fl-meta">修改名称/热量/价格/照片/分类</div></div>
      <div class="li-arrow">›</div>
    </div>
    <div class="food-line" data-action="food:delete" data-id="${f.id}">
      <div class="fl-photo" style="background:var(--red-soft)">🗑️</div>
      <div class="fl-info"><div class="fl-name" style="color:var(--red)">删除</div><div class="fl-meta">历史记录会保留</div></div>
      <div class="li-arrow">›</div>
    </div>
    <div style="height:8px"></div>
    <button class="btn ghost block" data-action="sheet:close">取消</button>`);
});
registerAction('food:edit-open', async (el) => {
  const f = FOODS.find((x) => x.id === el.dataset.id);
  if (!f) return;
  const cal = PLATFORM_CALIBRATIONS[f.name];
  const compare = cal && f.kcal !== cal.kcal && !f.calAdopted ? cal : null;
  openManualForm(f, compare);
});
registerAction('food:detail', async (el) => {
  const f = FOODS.find((x) => x.id === el.dataset.id);
  if (!f) return;
  const recs = (await getRecords()).filter((r) => r.foodId === f.id);
  const remaining = Math.max(0, (PROFILE.targetKcal || 1800) - (await getDayStats(todayKey())).kcal);
  const tl = trafficLight(f.kcal, remaining, PROFILE.recordTotal);
  openSheet(`
    <button class="sheet-close" data-action="sheet:close">✕</button>
    <div class="sheet-title">食物详情</div>
    <div class="card" style="box-shadow:none;background:rgba(0,0,0,0.03)">
      <div class="flex" style="gap:14px">
        <div class="fl-photo" style="width:64px;height:64px;border-radius:20px">${photoHTML(f, true)}</div>
        <div style="flex:1">
          <div class="fl-name" style="font-size:17px">${esc(f.name)} <span class="traffic ${tl.level}"></span></div>
          <div class="muted small" style="margin-top:2px">${dkr(f.kcal)}${f.shop ? ' · ' + esc(f.shop) : ''}</div>
          <div class="muted small">${esc(f.portion || '')}${f.price ? ' · ¥' + f.price : ''} · ${f.category || ''}</div>
        </div>
      </div>
    </div>
    <div class="section-title" style="font-size:14px;margin-top:14px">📜 历史记录（${recs.length}）</div>
    ${recs.length ? recs.slice(0, 8).map((r) => `
      <div class="food-line">
        <div class="fl-photo">${MEAL_EMOJI[r.meal]}</div>
        <div class="fl-info"><div class="fl-name">${MEALS.find((m) => m.k === r.meal).label} · ${r.date}</div>
          <div class="fl-meta">${esc(r.portion || '')}${r.shop ? ' · ' + esc(r.shop) : ''}</div></div>
        <div class="fl-kcal">${r.kcal}kcal</div>
      </div>`).join('') : `<div class="muted small" style="padding:8px 4px">还没有吃过的记录</div>`}
    <div style="height:12px"></div>
    <div class="flex" style="gap:10px">
      <button class="btn primary" style="flex:1" data-action="food:quick" data-id="${f.id}">⚡ 快速记录</button>
      <button class="btn ghost" style="flex:1" data-action="food:edit" data-id="${f.id}">编辑</button>
    </div>`);
});
registerAction('food:quick', async (el) => {
  const f = FOODS.find((x) => x.id === el.dataset.id);
  if (!f) return;
  closeSheet();
  await recordFood(f, defaultMeal());
});
registerAction('food:delete', async (el) => {
  const f = FOODS.find((x) => x.id === el.dataset.id);
  if (!f) return;
  openModal(`
    <div class="modal-title">删除「${esc(f.name)}」？</div>
    <div class="modal-sub">历史记录会保留，只从食谱库移除。</div>
    <div class="flex" style="justify-content:flex-end;gap:10px">
      <button class="btn ghost" data-action="modal:close">取消</button>
      <button class="btn red" data-action="food:del-confirm" data-id="${f.id}">删除</button>
    </div>`);
});
registerAction('food:del-confirm', async (el) => {
  await deleteFood(el.dataset.id);
  await loadFoods();
  closeModal();
  toast('已删除', 'brand');
  rerender();
});

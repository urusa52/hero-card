// render/draw.js
// 뽑기 페이즈 화면: 호출 버튼, 손패, 족보 패널.
// 어떤 족보가 성립하는지는 yaku.evaluate의 결과를 받아 표시만 한다.
const rarityClass = (r) => (r >= 5 ? 'r5' : r >= 4 ? 'r4' : r >= 3 ? 'r3' : 'r0');

function handCard(c, data, isNew) {
  const g = c.genre ? data.cards.genres[c.genre] : null;
  return `<div class="hand-card ${rarityClass(c.rarity)} ${isNew ? 'new' : ''} ${c.isCopy ? 'copy' : ''}"
    style="${g ? `--genre:${g.color}` : ''}" title="${c.wish || ''}">
    <div class="hc-name">${c.name}${c.isCopy ? ' (필사)' : ''}</div>
    <div class="hc-meta">${c.rarity > 0 ? '★'.repeat(c.rarity) : c.kind === 'blank' ? '백지' : ''}
      ${c.role ? data.cards.roles[c.role] : ''}</div>
    <div class="hc-tags">${(c.tags || []).map((t) => `<i>${data.cards.tags[t]}</i>`).join('')}</div>
  </div>`;
}

export function renderDraw(state, data, evaluations, odds = {}) {
  const el = document.getElementById('screen');

  const yakuHtml = evaluations.map((e) => {
    const p = e.progress;
    const near = !e.ok && p.need > 0 && p.have >= p.need - 1; // 텐파이(한 장 전) 표시
    const o = odds[e.def.id];
    return `<li class="yaku ${e.ok ? 'ok' : ''} ${near ? 'near' : ''} tier${e.def.tier}">
      <div class="yaku-head">
        <b>${e.def.name}</b><span class="mult">×${e.def.mult}</span>
        <span class="progress">${p.need ? `${Math.min(p.have, p.need)}/${p.need}` : ''}</span>
      </div>
      <div class="yaku-desc">${e.bondTitle || e.def.desc}</div>
      ${!e.ok && o && state.pullsLeft > 0
        ? `<div class="yaku-odds">다음 호출로 완성 <b>${o.pct}%</b> <small>(산 ${o.total}장 중 ${o.completing}장)</small></div>`
        : ''}
      ${e.ok ? `<button data-action="draw:declare" data-id="${e.def.id}" class="declare">
        선언 — 반향 ${e.baseSum} ×${e.def.mult}${e.cards.some((c) => c.isCopy) ? ' (복각판 ×0.5)' : ''}
      </button>` : ''}
    </li>`;
  }).join('');

  const anyOk = evaluations.some((e) => e.ok);
  const dead = state.pullsLeft === 0 || state.mountain.length === 0;

  // 남은 산 카운팅 — 마작처럼 전부 셀 수 있다 (D16)
  const mCounts = {};
  for (const id of state.mountain) mCounts[id] = (mCounts[id] || 0) + 1;
  const mountainHtml = Object.entries(mCounts).map(([id, n]) => {
    const c = data.cardById[id];
    const g = c.genre ? data.cards.genres[c.genre] : null;
    return `<li style="${g ? `--genre:${g.color}` : ''}"><i class="genre-dot"></i>${c.name} <b>×${n}</b></li>`;
  }).join('');

  el.innerHTML = `
    <div class="draw-grid">
      <section class="panel">
        <button data-action="draw:pull" class="pull-btn" ${!dead ? '' : 'disabled'}>
          호출<small>${state.mountain.length === 0 ? '산이 말랐습니다'
            : state.pullsLeft > 0 ? `${state.pullsLeft}회 남음 · 산 ${state.mountain.length}장` : '소진'}</small>
        </button>
        <div class="hand">
          ${state.hand.map((c) => handCard(c, data, c.uid === state.lastPull)).join('')
            || '<p class="empty">아직 아무도 호출되지 않았습니다</p>'}
        </div>
        ${dead && !anyOk
          ? '<button data-action="draw:giveup" class="ghost danger">이번 장을 덮는다 (게임 오버)</button>'
          : ''}
        <details class="mountain" open>
          <summary>남은 산 (${state.mountain.length}장)</summary>
          <ul class="mountain-list">${mountainHtml || '<li>비었습니다</li>'}</ul>
        </details>
        <ul class="log">${state.log.slice(-4).map((l) => `<li>${l}</li>`).join('')}</ul>
      </section>
      <section class="panel yaku-panel">
        <h2>족보 <small>완성 가능한 이야기가 빛납니다</small></h2>
        <ul class="yaku-list">${yakuHtml}</ul>
      </section>
    </div>`;
}

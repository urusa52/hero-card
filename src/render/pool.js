// render/pool.js
// 설계 페이즈 화면: 서고(컬렉션), 산(쌓은 카드 묶음), 구성 파이, 검증 결과.
// D16: 슬라이더 폐지 — +/− 로 장수를 조절하고, 구성 비율이 곧 확률로 표시된다.
// 검증은 poolBuilder의 결과를 표시만 한다 (규칙을 여기서 중복 구현하지 않는다).
import { validate } from '../logic/poolBuilder.js';
import { pullsForChapter } from '../logic/round.js';

const rarityStars = (r) => (r > 0 ? '★'.repeat(r) : '');

function cardLabel(card, data) {
  const g = card.genre ? data.cards.genres[card.genre] : null;
  const role = card.role ? data.cards.roles[card.role] : '';
  const tags = (card.tags || []).map((t) => data.cards.tags[t]).join('·');
  return `
    <span class="card-name" style="${g ? `--genre:${g.color}` : ''}">
      ${g ? `<i class="genre-dot"></i>` : ''}${card.name}
    </span>
    <span class="card-meta">${rarityStars(card.rarity)} ${g ? g.name : ''} ${role} ${tags ? `[${tags}]` : ''}</span>`;
}

// 산의 구성 비율을 파이로 — "이 확률, 당신이 쌓았습니다"
function pieGradient(deck, cardById, data) {
  if (!deck.length) return 'conic-gradient(#2a2d3a 0 100%)';
  const counts = {};
  for (const id of deck) counts[id] = (counts[id] || 0) + 1;
  let acc = 0;
  const stops = Object.entries(counts).map(([id, n]) => {
    const c = cardById[id];
    const color = c.kind === 'hero' ? data.cards.genres[c.genre].color
      : c.kind === 'special' ? '#c9a227' : '#4a4d58';
    const from = acc; acc += (n / deck.length) * 100;
    return `${color} ${from}% ${acc}%`;
  });
  return `conic-gradient(${stops.join(',')})`;
}

export function renderPool(state, data) {
  const el = document.getElementById('screen');
  const cardById = data.cardById;
  const rules = data.balance.pool;
  const basePulls = pullsForChapter(state.chapterIdx, data.balance, state.carried);
  const v = validate(state.deck, state.ink, cardById, rules, basePulls);

  const counts = {};
  for (const id of state.deck) counts[id] = (counts[id] || 0) + 1;

  const available = [...state.collection, ...data.cards.alwaysAvailable];
  const collectionHtml = available.map((id) => {
    const c = cardById[id];
    const n = counts[id] || 0;
    return `<li class="row">
      ${cardLabel(c, data)}
      <span class="cost">${c.cost >= 0 ? c.cost : `+${-c.cost}`}</span>
      ${n ? `<button data-action="pool:sub" data-id="${id}" class="ghost">−</button>
             <span class="deck-count">${n}장</span>` : ''}
      <button data-action="pool:add" data-id="${id}">＋ 쌓기</button>
    </li>`;
  }).join('');

  const deckHtml = Object.entries(counts).map(([id, n]) => {
    const c = cardById[id];
    const share = Math.round((n / state.deck.length) * 100);
    return `<li class="row">
      ${cardLabel(c, data)}
      <span class="weight">${n}장 · ${share}%</span>
    </li>`;
  }).join('');

  el.innerHTML = `
    <div class="design-grid">
      <section class="panel">
        <h2>서고 <small>영웅을 산에 쌓으세요 — 여러 장도 가능</small></h2>
        <ul class="list">${collectionHtml}</ul>
      </section>
      <section class="panel">
        <h2>산(山) <small>구성이 곧 확률입니다</small></h2>
        <div class="pie" style="background:${pieGradient(state.deck, cardById, data)}"></div>
        <p class="deck-size ${state.deck.length < v.need ? 'lack' : ''}">
          ${state.deck.length} / 최소 ${v.need}장 (이번 장 호출 ${basePulls}회)
        </p>
        <ul class="list">${deckHtml || '<li class="empty">아직 아무도 쌓이지 않았습니다</li>'}</ul>
        <div class="pool-tools">
          <span class="spend ${v.spend > state.ink ? 'over' : ''}">잉크 ${v.spend >= 0 ? '소모' : '환급'} ${Math.abs(v.spend)} / 보유 ${state.ink}</span>
        </div>
        ${v.errors.length ? `<ul class="errors">${v.errors.map((e) => `<li>${e}</li>`).join('')}</ul>` : ''}
        <button data-action="design:start" class="primary" ${v.valid ? '' : 'disabled'}>집필 시작</button>
      </section>
    </div>`;
}

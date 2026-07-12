// render/pool.js
// 설계 페이즈 화면: 서고(컬렉션), 계약서(풀), 잉크 파이, 검증 결과.
// 검증은 poolBuilder의 결과를 표시만 한다 — 규칙을 여기서 중복 구현하지 않는다.
import { validate } from '../logic/poolBuilder.js';

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

function pieGradient(pool, cardById, data) {
  if (!pool.length) return 'conic-gradient(#2a2d3a 0 100%)';
  let acc = 0;
  const stops = pool.map((e) => {
    const c = cardById[e.cardId];
    const color = c.kind === 'hero' ? data.cards.genres[c.genre].color
      : c.kind === 'special' ? '#c9a227' : '#4a4d58';
    const from = acc; acc += e.weight;
    return `${color} ${from}% ${acc}%`;
  });
  if (acc < 100) stops.push(`#2a2d3a ${acc}% 100%`);
  return `conic-gradient(${stops.join(',')})`;
}

export function renderPool(state, data) {
  const el = document.getElementById('screen');
  const cardById = data.cardById;
  const rules = data.balance.pool;
  const v = validate(state.pool, state.ink, cardById, rules);

  const available = [...state.collection, ...data.cards.alwaysAvailable];
  const collectionHtml = available.map((id) => {
    const c = cardById[id];
    return `<li class="row">
      ${cardLabel(c, data)}
      <span class="cost">${c.cost >= 0 ? c.cost : `+${-c.cost}`}</span>
      <button data-action="pool:add" data-id="${id}">넣기</button>
    </li>`;
  }).join('');

  const poolHtml = state.pool.map((e, i) => {
    const c = cardById[e.cardId];
    const cap = rules.weightCapByRarity[String(c.rarity)] || 95;
    return `<li class="row pool-row">
      ${cardLabel(c, data)}
      <input type="range" data-action="pool:weight" data-index="${i}"
             min="${rules.minWeight}" max="${cap}" step="5" value="${e.weight}">
      <span class="weight">${e.weight}%</span>
      <button data-action="pool:remove" data-index="${i}" class="ghost">빼기</button>
    </li>`;
  }).join('');

  el.innerHTML = `
    <div class="design-grid">
      <section class="panel">
        <h2>서고 <small>영웅을 계약서에 올리세요</small></h2>
        <ul class="list">${collectionHtml}</ul>
      </section>
      <section class="panel">
        <h2>캐스팅 계약서 <small>확률은 당신이 씁니다</small></h2>
        <div class="pie" style="background:${pieGradient(state.pool, cardById, data)}"></div>
        <ul class="list">${poolHtml || '<li class="empty">비어 있는 계약서입니다</li>'}</ul>
        <div class="pool-tools">
          <button data-action="pool:normalize" class="ghost">가중치 100% 맞추기</button>
          <span class="spend ${v.spend > state.ink ? 'over' : ''}">잉크 ${v.spend >= 0 ? '소모' : '환급'} ${Math.abs(v.spend)} / 보유 ${state.ink}</span>
        </div>
        ${v.errors.length ? `<ul class="errors">${v.errors.map((e) => `<li>${e}</li>`).join('')}</ul>` : ''}
        <button data-action="design:start" class="primary" ${v.valid ? '' : 'disabled'}>집필 시작</button>
      </section>
    </div>`;
}

// render/modal.js
// 오버레이 화면들: 필사본 대상 선택 / 선언 결과(점수 내역) / 클리어 / 보상 3택1 / 게임오버 / 엔딩.
// 전부 상태를 읽어 그리기만 한다.
export function renderModal(state, data) {
  const el = document.getElementById('modal');
  const cardById = data.cardById;

  // 필사본: 손패의 영웅 중 하나를 골라 베낀다
  if (state.pendingCopy) {
    const targets = state.hand.filter((c) => c.kind === 'hero');
    el.innerHTML = overlay(`
      <h2>필사본 <small>누구를 베낄까요?</small></h2>
      <div class="choice-grid">
        ${targets.map((c) => `<button data-action="copy:pick" data-uid="${c.uid}">
          ${c.name}<small>${'★'.repeat(c.rarity)}</small></button>`).join('')}
      </div>`);
    return;
  }

  // 선언 직후: 점수 내역 (기본 → ×족보 → ×수정자) — scoring의 breakdown을 그대로 표시
  if (state.declFx) {
    const d = state.declFx;
    el.innerHTML = overlay(`
      <h2 class="decl-name tier${d.tier}">「${d.name}」</h2>
      <ul class="breakdown">
        ${d.breakdown.map((b) => `<li><span>${b.label}</span><b>${b.value}</b></li>`).join('')}
      </ul>
      <button data-action="fx:close" class="primary">계속</button>`, d.tier >= 4 ? 'yakuman' : '');
    return;
  }

  if (state.phase === 'clear') {
    const r = state.clearInfo;
    el.innerHTML = overlay(`
      <h2>제${state.chapterIdx + 1}장, 읽혔습니다</h2>
      <p class="quiet">잉크 +${r.ink}${r.overshoot ? ` (초과 반향 환급 ${r.overshoot} 포함)` : ''}
      ${r.bonusPulls ? `<br>10연 티켓 획득 — 다음 장 호출 +${r.bonusPulls}` : ''}</p>
      <button data-action="game:next" class="primary">보상 받기</button>`);
    return;
  }

  if (state.phase === 'reward') {
    el.innerHTML = overlay(`
      <h2>서고에 새 책이 도착했습니다 <small>한 권을 들이세요</small></h2>
      <div class="choice-grid">
        ${state.rewardOffer.map((id) => {
          const c = cardById[id];
          const g = c.genre ? data.cards.genres[c.genre] : null;
          return `<button data-action="reward:pick" data-id="${id}" style="${g ? `--genre:${g.color}` : ''}">
            ${c.name}<small>${c.rarity > 0 ? '★'.repeat(c.rarity) : '서고의 도구'} ${c.wish || ''}</small>
          </button>`;
        }).join('')}
      </div>`);
    return;
  }

  if (state.phase === 'gameover') {
    el.innerHTML = overlay(`
      <h2>이야기가 잊혔습니다</h2>
      <p class="quiet">제${state.chapterIdx + 1}장에서 서고가 조용해졌습니다.</p>
      <button data-action="game:restart" class="primary">다시 펼치기</button>`);
    return;
  }

  if (state.phase === 'ending') {
    el.innerHTML = overlay(`
      <p class="quiet">마지막 책이 완성되었습니다.</p>
      <h2 class="ending-title">우리는 아직 『${state.endingWord}』입니다</h2>
      <p class="quiet">— 빈칸이 채워졌습니다. 모두, 읽혔습니다.</p>
      <button data-action="game:restart" class="primary">새 런</button>`, 'yakuman');
    return;
  }

  el.innerHTML = '';
}

function overlay(inner, cls = '') {
  return `<div class="overlay ${cls}"><div class="dialog">${inner}</div></div>`;
}

// render/modal.js
// 오버레이 화면들: 필사본 대상 선택 / 선언 결과(점수 내역) / 클리어 / 보상 3택1 / 게임오버 / 엔딩.
// 전부 상태를 읽어 그리기만 한다.
export function renderModal(state, data) {
  const el = document.getElementById('modal');
  const cardById = data.cardById;

  // 도움말: 어느 페이즈에서든 ? 버튼으로 열람
  if (state.helpOpen) {
    el.innerHTML = overlay(`
      <h2>게임 방법 <small>잊히기 전에, 다시 읽히게 하라</small></h2>
      <div class="help-body">
        <p><b>목표</b> — 챕터마다 목표 반향(점수)이 있습니다. 제한된 호출 횟수 안에 족보를 선언해 채우면 다음 장으로. 8장을 완성하면 빈 『 』가 채워집니다.</p>
        <p><b>흐름</b> — ① <b>산 쌓기</b>: 잉크(예산)로 카드를 장 단위로 산에 쌓습니다. 같은 영웅 여러 장도 가능 — 구성이 곧 확률입니다 →
        ② <b>호출</b>: 산에서 한 장씩 뽑기. 뽑힌 카드는 산에서 사라지고(비복원), 남은 산은 전부 셀 수 있습니다 →
        ③ <b>선언</b>: 성립한 족보(빛나는 항목)를 선언해 반향 획득. 쓰인 카드는 소모, 남은 패는 다음 선언의 재료.</p>
        <p><b>족보</b> — 콤비(같은 역할 2)는 안전하지만 ×1, 원맨 아미(같은 영웅 5장)는 ×20. 낮은 족보로 버틸지, 큰 것을 노릴지가 이 게임의 전부입니다. 후반 챕터는 낮은 족보만으로는 수학적으로 불가능해요.</p>
        <p><b>알아두면 좋은 것</b> — 산은 호출 수보다 5장 이상 커야 하고, 산이 마르면 남은 호출은 흩어집니다 ·
        백지(꽝)를 쌓으면 잉크가 환급되지만 뽑힐 위험도 함께 집니다 ·
        띠지는 다음 선언 ×2 · 필사본은 영웅을 복제하지만 그 족보의 배율이 절반(복각판) ·
        남은 잉크는 다음 장으로 이월되되 20% 마릅니다 · 몰빵 파티는 강하지만 다음 장 호출 -2.</p>
      </div>
      <button data-action="help:toggle" class="primary">닫기</button>`);
    return;
  }

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

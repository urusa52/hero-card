// render/tutorial.js
// 튜토리얼: 별도 시나리오 없이, 현재 상태를 읽어 "지금 해야 할 일" 한 줄을 안내한다.
// 상태 기반이라 플레이어가 어떤 순서로 조작해도 안내가 어긋나지 않는다. 제1장에서만 표시.
import { validate, requiredSize } from '../logic/poolBuilder.js';
import { pullsForChapter } from '../logic/round.js';

function currentHint(state, data, evaluations) {
  const rules = data.balance.pool;
  if (state.phase === 'design') {
    const basePulls = pullsForChapter(state.chapterIdx, data.balance, state.carried);
    const need = requiredSize(basePulls, rules);
    if (state.deck.length < need)
      return `① 왼쪽 <b>서고</b>에서 <b>＋ 쌓기</b>를 눌러 산에 카드를 ${need}장 이상 쌓으세요. 같은 영웅을 여러 장 쌓으면 그만큼 잘 뽑힙니다. (지금 ${state.deck.length}장)`;
    const v = validate(state.deck, state.ink, data.cardById, rules, basePulls);
    if (!v.valid)
      return `② 잉크가 모자라면 비싼 카드를 <b>−</b>로 빼거나, <b>백지</b>를 쌓아 잉크를 환급받으세요 — 대신 백지가 뽑힐 위험도 함께 집니다.`;
    return `③ 산 완성! 오른쪽 파이가 당신이 만든 확률입니다. <b>집필 시작</b>을 누르세요.`;
  }
  if (state.phase === 'draw') {
    if (state.hand.length === 0)
      return `④ <b>호출</b>을 누르세요. 산에서 한 장이 뽑히고, 뽑힌 카드는 산에서 사라집니다. 아래 <b>남은 산</b>에서 뭐가 몇 장 남았는지 셀 수 있어요. (${state.pullsLeft}회 남음)`;
    if (!evaluations.some((e) => e.ok))
      return `⑤ 오른쪽 <b>족보</b> 목록을 보세요. 완성이 가까우면 <b>다음 호출로 완성 %</b>가 뜹니다. 가장 쉬운 건 <b>콤비</b>(같은 역할 2명) — 계속 호출해 보세요.`;
    return `⑥ 빛나는 족보의 <b>선언</b>을 누르면 반향(점수)을 얻고, 쓰인 영웅은 이야기 속으로 떠납니다. 상단 게이지의 목표를 채우면 클리어!`;
  }
  return null;
}

export function renderTutorial(state, data, evaluations) {
  const el = document.getElementById('tutorial');
  if (!el) return; // 테스트 스텁 등 요소가 없는 환경 방어
  if (!state.tutorialOn || state.chapterIdx > 0) { el.innerHTML = ''; return; }
  const hint = currentHint(state, data, evaluations);
  el.innerHTML = hint
    ? `<div class="tuto-banner">
         <span class="tuto-text">${hint}</span>
         <button data-action="tutorial:off" class="tuto-skip">안내 끄기</button>
       </div>`
    : '';
}

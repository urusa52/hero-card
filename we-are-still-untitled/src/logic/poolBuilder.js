// logic/poolBuilder.js
// 산(山) 설계 규칙 담당: "이 산을 이렇게 쌓아도 되는가?"
// D16: 가중치/합100% 검증 폐지 → 크기·예산 검증만 남아 단순해졌다.
// 모든 규칙 수치는 balance.json에서 온다 (매직 넘버 금지).

// 산 최소 크기: 기본 호출 수 + 여유분 — 전량 뽑히면 랜덤이 0이 되므로 (마작의 산이 큰 이유)
export function requiredSize(basePulls, rules) {
  return basePulls + rules.minOverPulls;
}

// 중복 투입 비용: 같은 카드 n장째는 cost × growth^(n-1) (원맨 아미의 진입 장벽)
// 환급 카드(음수 비용)는 증가 없이 고정 — 환급 뻥튀기 방지
export function computeSpend(deck, cardById, rules) {
  const seen = {};
  let spend = 0;
  for (const cardId of deck) {
    const card = cardById[cardId];
    const n = (seen[cardId] = (seen[cardId] || 0) + 1);
    spend += card.cost < 0
      ? card.cost
      : Math.ceil(card.cost * Math.pow(rules.duplicateCostGrowth, n - 1));
  }
  return spend;
}

// 검증: 위반 사유 목록을 돌려준다. UI는 이 결과를 표시만 한다 (검증 로직 중복 구현 금지).
export function validate(deck, budget, cardById, rules, basePulls) {
  const errors = [];
  const spend = computeSpend(deck, cardById, rules);
  const need = requiredSize(basePulls, rules);

  if (deck.length < need)
    errors.push(`산이 너무 낮습니다 — 최소 ${need}장 (지금 ${deck.length}장)`);
  if (deck.length > rules.maxCards)
    errors.push(`산은 최대 ${rules.maxCards}장까지입니다`);
  if (spend > budget)
    errors.push(`잉크가 부족합니다 (필요 ${spend}, 보유 ${budget})`);

  return { valid: errors.length === 0, errors, spend, need };
}

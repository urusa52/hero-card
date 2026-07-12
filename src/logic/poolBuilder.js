// logic/poolBuilder.js
// 확률 설계 규칙 담당: "이 풀을 이렇게 짜도 되는가?"
// 비용 계산과 검증만 한다. 뽑기는 gacha, 상태 변경은 로직 조립부(main)의 몫.
// 모든 규칙 수치는 balance.json에서 온다 — 코드에 매직 넘버를 두지 않는다 (원칙 5).

// 중복 투입 비용: 같은 카드 n장째는 cost × growth^(n-1) (원맨 아미의 진입 장벽)
// 환급 카드(음수 비용)는 증가 없이 고정 — 환급 뻥튀기 방지
export function computeSpend(pool, cardById, rules) {
  const seen = {};
  let spend = 0;
  for (const entry of pool) {
    const card = cardById[entry.cardId];
    const n = (seen[entry.cardId] = (seen[entry.cardId] || 0) + 1);
    spend += card.cost < 0
      ? card.cost
      : Math.ceil(card.cost * Math.pow(rules.duplicateCostGrowth, n - 1));
  }
  return spend;
}

// 검증: 위반 사유 목록을 돌려준다. UI는 이 결과를 표시만 한다 (검증 로직의 중복 구현 금지).
export function validate(pool, budget, cardById, rules) {
  const errors = [];
  const spend = computeSpend(pool, cardById, rules);

  if (pool.length < rules.minCards) errors.push(`카드가 최소 ${rules.minCards}장 필요합니다`);
  if (pool.length > rules.maxCards) errors.push(`카드는 최대 ${rules.maxCards}장까지입니다`);
  if (spend > budget) errors.push(`잉크가 부족합니다 (필요 ${spend}, 보유 ${budget})`);

  let sum = 0;
  for (const entry of pool) {
    const card = cardById[entry.cardId];
    sum += entry.weight;
    // 최소 가중치 — 시뮬레이션에서 발견된 "꽝 환급만 챙기기" 익스플로잇 방지 규칙
    if (entry.weight < rules.minWeight)
      errors.push(`${card.name}: 가중치는 최소 ${rules.minWeight}%`);
    const cap = rules.weightCapByRarity[String(card.rarity)];
    if (cap && entry.weight > cap)
      errors.push(`${card.name}: ${card.rarity}성은 최대 ${cap}%`);
  }
  if (pool.length && sum !== 100) errors.push(`가중치 합이 100%여야 합니다 (현재 ${sum}%)`);

  return { valid: errors.length === 0, errors, spend };
}

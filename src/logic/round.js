// logic/round.js
// 챕터 진행 규칙: 목표, 클리어/게임오버 판정, 보상 계산, 잉크 이월(증발).
// 상태를 직접 바꾸지 않고 "무엇이 일어나야 하는지"를 계산해 돌려준다. 적용은 조립부(main)에서.

// 챕터 시작 시 뽑기 횟수: 기본 + 티켓 보너스 - 몰빵 페널티
export function pullsForChapter(chapterIdx, balance, carried) {
  const base = balance.chapters[chapterIdx].pulls;
  return Math.max(1, base + (carried.bonusPulls || 0) - (carried.penaltyPulls || 0));
}

// 선언 후 클리어 여부
export function isCleared(score, chapterIdx, balance) {
  return score >= balance.chapters[chapterIdx].target;
}

// 클리어 정산: 초과 달성 환급 + 챕터 잉크 보상, 티켓 챕터면 다음 챕터 보너스 뽑기
export function clearRewards(score, chapterIdx, balance) {
  const ch = balance.chapters[chapterIdx];
  const overshoot = Math.floor(Math.max(0, score - ch.target) * balance.budget.overshootRefund);
  const chapterNo = chapterIdx + 1; // 표기는 1부터
  return {
    ink: ch.inkReward + overshoot,
    overshoot,
    bonusPulls: balance.ticketChapters.includes(chapterNo) ? balance.ticketBonusPulls : 0,
    isLast: chapterIdx === balance.chapters.length - 1,
  };
}

// 잉크는 마른다 — 챕터를 넘길 때 이월분 증발 (D13)
export function evaporate(ink, balance) {
  return Math.floor(ink * (1 - balance.budget.evaporation));
}

// 영웅 3택1 보상 후보: 미보유 영웅 + 낮은 확률로 특수 패 (D15)
export function rewardOffer(collection, allCards, balance, rng) {
  const owned = new Set(collection);
  const pool = allCards.filter((c) => c.kind === 'hero' && !owned.has(c.id));
  const specials = allCards.filter((c) => c.kind === 'special' && !owned.has(c.id));
  const offer = [];
  const n = Math.min(balance.rewardChoices, pool.length + specials.length);
  const heroPool = [...pool];
  for (let i = 0; i < n; i++) {
    const useSpecial = specials.length && rng() < balance.specialRewardChance;
    const src = useSpecial ? specials : heroPool.length ? heroPool : specials;
    if (!src.length) break;
    const idx = Math.floor(rng() * src.length);
    offer.push(src.splice(idx, 1)[0].id);
  }
  return offer;
}

// 게임오버 판정: 뽑기 소진 && 성립 가능한 족보 없음 && 목표 미달
export function isGameOver(pullsLeft, evaluations, score, chapterIdx, balance) {
  if (isCleared(score, chapterIdx, balance)) return false;
  if (pullsLeft > 0) return false;
  return !evaluations.some((e) => e.ok);
}

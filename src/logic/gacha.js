// logic/gacha.js
// 뽑기: (풀, RNG) → 카드 1장. 순수 함수 — 같은 풀 + 같은 시드면 같은 결과 (시뮬레이션/재현 가능)
// 화면도 상태도 모른다. 랜덤은 인자로 받은 rng()만 사용한다.

// mulberry32 — 시드 기반 의사난수 생성기. 가볍고 재현 가능해서 채택.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// pool: [{ cardId, weight }] — weight는 % 정수. 가중치 룰렛으로 1장 선택.
export function pull(pool, rng) {
  const total = pool.reduce((s, e) => s + e.weight, 0);
  let roll = rng() * total;
  for (const entry of pool) {
    roll -= entry.weight;
    if (roll < 0) return entry.cardId;
  }
  return pool[pool.length - 1].cardId; // 부동소수 오차 방어
}

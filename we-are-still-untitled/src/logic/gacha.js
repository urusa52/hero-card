// logic/gacha.js
// 호출: 산(비복원 덱)에서 1장을 균등 확률로 뽑는다. 순수 함수 — 같은 산 + 같은 시드면 같은 결과.
// D16: 복원 추출(가중치 룰렛) → 비복원 추출(마작의 산)로 전환.
// 확률은 별도 수치가 아니라 산의 구성 그 자체다. 뽑힌 카드는 산에서 사라진다.

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

// mountain: [cardId, ...] — 남은 산. 원본을 바꾸지 않고 { cardId, rest }를 반환한다.
export function draw(mountain, rng) {
  const i = Math.floor(rng() * mountain.length);
  return {
    cardId: mountain[i],
    rest: [...mountain.slice(0, i), ...mountain.slice(i + 1)],
  };
}

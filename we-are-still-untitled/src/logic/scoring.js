// logic/scoring.js
// 점수 계산: 기본 반향 합 × 족보 배율 × 수정자(복각판/띠지).
// 계산 과정을 단계별 내역(breakdown)으로 반환한다 — 연출(점수 카운트업)이 이 데이터를 그대로 쓴다.
// 순수 함수: 손패도 상태도 직접 만지지 않는다.

export function calc(entry, modifiers) {
  // entry: yaku.evaluate의 결과 1건 { def, cards, baseSum }
  // modifiers: { nextDeclMult } — 띠지 등 상태에서 온 일회성 배수
  const breakdown = [];
  const base = entry.baseSum;
  breakdown.push({ label: '기본 반향', value: base });

  let mult = entry.def.mult;
  breakdown.push({ label: `족보 「${entry.def.name}」`, value: `×${mult}` });

  // 복각판 규칙: 필사본(isCopy)이 섞인 족보는 배율 절반 — 순정 프리미엄
  const hasCopy = entry.cards.some((c) => c.isCopy);
  if (hasCopy) {
    mult = mult / 2;
    breakdown.push({ label: '복각판 (필사본 포함)', value: '×0.5' });
  }

  let extra = 1;
  if (modifiers.nextDeclMult && modifiers.nextDeclMult !== 1) {
    extra = modifiers.nextDeclMult;
    breakdown.push({ label: '띠지', value: `×${extra}` });
  }

  const total = Math.floor(base * mult * extra);
  breakdown.push({ label: '반향', value: total });
  return { total, hasCopy, breakdown };
}

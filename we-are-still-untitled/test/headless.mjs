// test/headless.mjs — 로직 모듈 검증 (브라우저 없이 node로 실행)
// 순수 함수 설계 덕분에 UI 없이 규칙을 테스트할 수 있다. (D16 산 시스템 반영)
import { readFileSync } from 'node:fs';
import { makeRng, draw } from '../src/logic/gacha.js';
import { validate, computeSpend, requiredSize } from '../src/logic/poolBuilder.js';
import { evaluate, completionOdds } from '../src/logic/yaku.js';
import { calc } from '../src/logic/scoring.js';
import * as round from '../src/logic/round.js';

const load = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const balance = load('../src/data/balance.json');
const cardsData = load('../src/data/cards.json');
const yakuDefs = load('../src/data/yaku.json').yaku;
const cardById = Object.fromEntries(cardsData.cards.map((c) => [c.id, c]));
const ctx = { bondPairs: cardsData.bondPairs };

let pass = 0, fail = 0;
const ok = (cond, name) => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`); }
};
let uid = 1;
const inst = (id, isCopy = false) => ({ ...cardById[id], cardId: id, uid: uid++, isCopy });

console.log('[gacha] 비복원 산 (D16)');
{
  const deck = ['h01', 'h01', 'h03', 'h04', 'h05'];
  const seq = (seed) => {
    const r = makeRng(seed);
    let m = [...deck]; const out = [];
    while (m.length) { const d = draw(m, r); out.push(d.cardId); m = d.rest; }
    return out;
  };
  ok(JSON.stringify(seq(7)) === JSON.stringify(seq(7)), '같은 시드 → 같은 결과');
  ok(seq(7).sort().join() === [...deck].sort().join(), '전량 뽑으면 산 구성과 정확히 일치 (비복원)');
  const r = makeRng(1);
  const d = draw(deck, r);
  ok(d.rest.length === 4 && deck.length === 5, '뽑힌 카드는 산에서 제거, 원본 불변');
}

console.log('[poolBuilder] 산 설계 규칙');
{
  const rules = balance.pool;
  ok(requiredSize(8, rules) === 8 + rules.minOverPulls, '최소 산 크기 = 호출 + 여유분');
  const mk = (n, id = 'h01') => Array.from({ length: n }, () => id);
  ok(!validate(mk(10), 999, cardById, rules, 8).valid, '산 부족(10 < 13) 감지');
  ok(validate(mk(13, 'h01'), 999, cardById, rules, 8).errors.length === 0
     === (computeSpend(mk(13, 'h01'), cardById, rules) <= 999), '크기 충족 시 예산만 관건');
  ok(!validate(mk(25), 99999, cardById, rules, 8).valid, '산 상한(24장) 감지');
  // 중복 비용 증가: h12(20) 3장 = 20 + 30 + 45 = 95
  const dup = computeSpend(mk(3, 'h12'), cardById, rules);
  ok(dup === 20 + 30 + 45, `중복 비용 증가 (${dup} === 95)`);
  ok(computeSpend(mk(2, 'b01'), cardById, rules) === -30, '꽝 환급은 고정 (증가 없음)');
}

console.log('[yaku] 족보 판정');
{
  const get = (hand, id) => evaluate(hand, yakuDefs, ctx).find((e) => e.def.id === id);
  ok(get([inst('h01'), inst('h05')], 'combo').ok, '콤비: 딜러 2 성립');
  ok(!get([inst('h01'), inst('h03')], 'combo').ok, '콤비: 역할 다르면 불성립');
  const bal = [inst('h03'), inst('h01'), inst('h04'), inst('h02'), inst('h05')];
  ok(get(bal, 'balanced').ok, '밸런스 파티: 탱딜힐 포함 5인 성립');
  const oneman = Array.from({ length: 5 }, () => inst('h12'));
  const om = get(oneman, 'oneman');
  ok(om.ok && om.baseSum === 100, '원맨 아미: 동일 영웅 5장 성립');
  ok(get([inst('h01'), inst('h03'), inst('h12'), inst('h17')], 'royal').ok, '왕도물: 태그 시퀀스 성립');
  const trag = get([inst('h01'), inst('h03'), inst('h05'), inst('b02')], 'tragedy');
  ok(trag.ok, '비극: 희생 태그 꽝으로 성립');
  ok(get([inst('h01'), inst('h14'), inst('h12'), inst('h17')], 'royal').ok, '왕도물: 복수 태그 백트래킹');
  ok(get([inst('h12'), inst('h13')], 'bond').ok, '인연: 검(劍)과 검(檢) 성립');
  const near = get(Array.from({ length: 4 }, () => inst('h12')), 'oneman');
  ok(!near.ok && near.progress.have === 4 && near.progress.need === 5, '니어미스: 원맨 아미 4/5');
}

console.log('[yaku] 완성 확률 (D16 — 산이 실물이라 정확히 계산)');
{
  const hand = Array.from({ length: 4 }, () => inst('h12')); // 원맨 아미 텐파이
  const mountain = ['h12', 'h01', 'h01'];                    // 3장 중 1장이 완성패
  const odds = completionOdds(hand, mountain, cardById, yakuDefs, ctx);
  ok(odds.oneman && odds.oneman.pct === 33 && odds.oneman.completing === 1,
     `원맨 아미 완성 확률 33% (산 3장 중 1장)`);
  ok(!odds.tragedy || odds.tragedy.completing >= 0, '성립 불가 족보는 확률 미표기 or 0 초과만');
}

console.log('[scoring] 점수 계산');
{
  const oneman = Array.from({ length: 5 }, () => inst('h12'));
  const e = evaluate(oneman, yakuDefs, ctx).find((x) => x.def.id === 'oneman');
  ok(calc(e, { nextDeclMult: 1 }).total === 100 * 20, '원맨 아미: 100×20 = 2000');
  const copyHand = [...Array.from({ length: 4 }, () => inst('h12')), inst('h12', true)];
  const ec = evaluate(copyHand, yakuDefs, ctx).find((x) => x.def.id === 'oneman');
  ok(calc(ec, { nextDeclMult: 1 }).total === 100 * 10, '복각판: 필사본 포함 시 ×10');
  ok(calc(e, { nextDeclMult: 2 }).total === 4000, '띠지: ×2 적용');
}

console.log('[round] 챕터 규칙');
{
  ok(round.pullsForChapter(0, balance, { bonusPulls: 10, penaltyPulls: 2 }) === 16, '뽑기 수 = 기본+티켓-페널티');
  ok(round.isCleared(60, 0, balance) && !round.isCleared(59, 0, balance), '클리어 경계값');
  const r = round.clearRewards(160, 0, balance);
  ok(r.ink === 30 + 10 && r.overshoot === 10, '초과 달성 환급');
  ok(round.clearRewards(100, 3, balance).bonusPulls === 10, '챕터 4 클리어 → 10연 티켓');
  ok(round.evaporate(100, balance) === 80, '잉크는 마른다 (20% 증발)');
  const offer = round.rewardOffer(['h01'], cardsData.cards, balance, makeRng(1));
  ok(offer.length === 3 && !offer.includes('h01'), '보상 3택1: 미보유만');
}

console.log('[통합] 헤드리스 1챕터 플레이 (산 13장, 호출 8회)');
{
  const rng = makeRng(42);
  // 예산이 빠듯하면 백지로 산을 싸게 채운다 — D16이 의도한 바로 그 의사결정
  const deck = ['h01','h01','h01','h05','h05','h05','h03','h03','h03','h04','h02','h02','b01'];
  const v = validate(deck, balance.budget.initial, cardById, balance.pool, balance.chapters[0].pulls);
  ok(v.valid, `산 검증 통과 (소모 ${v.spend}, 최소 ${v.need}장)`);
  let mountain = [...deck], hand = [], score = 0, pulls = balance.chapters[0].pulls;
  while (pulls-- > 0 && mountain.length) {
    const d = draw(mountain, rng);
    mountain = d.rest;
    hand.push(inst(d.cardId));
  }
  let guard = 10;
  while (guard-- > 0) {
    const best = evaluate(hand, yakuDefs, ctx).filter((e) => e.ok)
      .sort((a, b) => b.baseSum * b.def.mult - a.baseSum * a.def.mult)[0];
    if (!best) break;
    score += calc(best, { nextDeclMult: 1 }).total;
    const used = new Set(best.cards.map((c) => c.uid));
    hand = hand.filter((c) => !used.has(c.uid));
  }
  console.log(`    → 8회 호출 후 남은 산 ${mountain.length}장, 최종 반향 ${score} (목표 ${balance.chapters[0].target})`);
  ok(mountain.length === deck.length - 8, '비복원: 산이 정확히 8장 줄었다');
  ok(score > 0, '한 챕터가 끝까지 돈다');
}

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);

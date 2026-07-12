// test/headless.mjs — 로직 모듈 검증 (브라우저 없이 node로 실행)
// 순수 함수 설계 덕분에 UI 없이 규칙을 테스트할 수 있다.
import { readFileSync } from 'node:fs';
import { makeRng, pull } from '../src/logic/gacha.js';
import { validate, computeSpend } from '../src/logic/poolBuilder.js';
import { evaluate } from '../src/logic/yaku.js';
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

console.log('[gacha] 시드 재현성');
{
  const pool = [{ cardId: 'h01', weight: 50 }, { cardId: 'h03', weight: 50 }];
  const seq = (seed) => {
    const r = makeRng(seed);
    return Array.from({ length: 10 }, () => pull(pool, r));
  };
  ok(JSON.stringify(seq(7)) === JSON.stringify(seq(7)), '같은 시드 → 같은 결과');
}

console.log('[poolBuilder] 검증 규칙');
{
  const rules = balance.pool;
  const mk = (n, id = 'h01', w = 20) => Array.from({ length: n }, () => ({ cardId: id, weight: w }));
  ok(!validate(mk(3), 999, cardById, rules).valid, '최소 장수 위반 감지');
  const capPool = [{ cardId: 'h19', weight: 10 }, ...mk(4, 'h01', 20), { cardId: 'h02', weight: 10 }];
  ok(validate(capPool, 999, cardById, rules).errors.some((e) => e.includes('5성')), '5성 가중치 상한 감지');
  const lowW = [{ cardId: 'b01', weight: 0 }, ...mk(4, 'h01', 25)];
  ok(validate(lowW, 999, cardById, rules).errors.some((e) => e.includes('최소')), '최소 가중치(꽝 익스플로잇 방지) 감지');
  // 중복 비용 증가: h12(20) 3장 = 20 + 30 + 45 = 95
  const dup = computeSpend(mk(3, 'h12'), cardById, rules);
  ok(dup === 20 + 30 + 45, `중복 비용 증가 (${dup} === 95)`);
  // 꽝 환급: b01(-15) 2장 = -30 (증가 없음)
  ok(computeSpend(mk(2, 'b01'), cardById, rules) === -30, '꽝 환급은 고정');
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
  // 서사: 왕도물 (기원 h01 → 시련 h03 → 각성 h12 → 승리 h17)
  ok(get([inst('h01'), inst('h03'), inst('h12'), inst('h17')], 'royal').ok, '왕도물: 태그 시퀀스 성립');
  // 비극: 기원 + 시련×2 + 희생(이름 없는 조연 = 꽝) — 꽝이 에이스가 되는 반전
  const trag = get([inst('h01'), inst('h03'), inst('h05'), inst('b02')], 'tragedy');
  ok(trag.ok, '비극: 희생 태그 꽝으로 성립');
  // h14는 trial+victory 복수 태그 — 백트래킹이 슬롯 배정을 찾아야 함
  ok(get([inst('h01'), inst('h14'), inst('h12'), inst('h17')], 'royal').ok, '왕도물: 복수 태그 백트래킹');
  ok(get([inst('h12'), inst('h13')], 'bond').ok, '인연: 검(劍)과 검(檢) 성립');
  const near = get(Array.from({ length: 4 }, () => inst('h12')), 'oneman');
  ok(!near.ok && near.progress.have === 4 && near.progress.need === 5, '니어미스: 원맨 아미 4/5');
}

console.log('[scoring] 점수 계산');
{
  const oneman = Array.from({ length: 5 }, () => inst('h12'));
  const e = evaluate(oneman, yakuDefs, ctx).find((x) => x.def.id === 'oneman');
  ok(calc(e, { nextDeclMult: 1 }).total === 100 * 20, '원맨 아미: 100×20 = 2000');
  // 복각판: 필사본 1장 포함 → 배율 절반
  const copyHand = [...Array.from({ length: 4 }, () => inst('h12')), inst('h12', true)];
  const ec = evaluate(copyHand, yakuDefs, ctx).find((x) => x.def.id === 'oneman');
  ok(calc(ec, { nextDeclMult: 1 }).total === 100 * 10, '복각판: 필사본 포함 시 ×10');
  ok(calc(e, { nextDeclMult: 2 }).total === 4000, '띠지: ×2 적용');
}

console.log('[round] 챕터 규칙');
{
  ok(round.pullsForChapter(0, balance, { bonusPulls: 10, penaltyPulls: 2 }) === 16, '뽑기 수 = 기본+티켓-페널티');
  ok(round.isCleared(60, 0, balance) && !round.isCleared(59, 0, balance), '클리어 경계값');
  const r = round.clearRewards(160, 0, balance); // 목표 60, 초과 100 → 환급 10
  ok(r.ink === 30 + 10 && r.overshoot === 10, '초과 달성 환급');
  ok(round.clearRewards(100, 3, balance).bonusPulls === 10, '챕터 4 클리어 → 10연 티켓');
  ok(round.evaporate(100, balance) === 80, '잉크는 마른다 (20% 증발)');
  const offer = round.rewardOffer(['h01'], cardsData.cards, balance, makeRng(1));
  ok(offer.length === 3 && !offer.includes('h01'), '보상 3택1: 미보유만');
}

console.log('[통합] 헤드리스 1챕터 플레이');
{
  const rng = makeRng(42);
  const pool = [
    { cardId: 'h01', weight: 30 }, { cardId: 'h05', weight: 30 },
    { cardId: 'h03', weight: 15 }, { cardId: 'h04', weight: 15 }, { cardId: 'h02', weight: 10 },
  ];
  const v = validate(pool, balance.budget.initial, cardById, balance.pool);
  ok(v.valid, `풀 검증 통과 (소모 ${v.spend})`);
  let hand = [], score = 0, pulls = balance.chapters[0].pulls;
  while (pulls-- > 0) hand.push(inst(pull(pool, rng)));
  let guard = 10;
  while (guard-- > 0) {
    const best = evaluate(hand, yakuDefs, ctx).filter((e) => e.ok)
      .sort((a, b) => b.baseSum * b.def.mult - a.baseSum * a.def.mult)[0];
    if (!best) break;
    score += calc(best, { nextDeclMult: 1 }).total;
    const used = new Set(best.cards.map((c) => c.uid));
    hand = hand.filter((c) => !used.has(c.uid));
  }
  console.log(`    → 8회 호출, 최종 반향 ${score} (목표 ${balance.chapters[0].target})`);
  ok(score > 0, '한 챕터가 끝까지 돈다');
}

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);

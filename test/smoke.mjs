// test/smoke.mjs — 통합 배선 검증
// DOM과 fetch를 스텁으로 대체하고 main.js를 실제로 부트한 뒤,
// 의도 이벤트를 쏘아 "설계 → 뽑기 → 선언 → 클리어/게임오버" 흐름이 배선되어 있는지 확인한다.
// (헤드리스 테스트가 로직을 검증한다면, 이 테스트는 조립을 검증한다 — wireIntents 누락 같은 사고 방지)
import { readFileSync } from 'node:fs';

// --- DOM 스텁: render가 innerHTML만 쓰므로 그 최소만 흉내 ---
const fakeEl = () => ({ innerHTML: '' });
const els = { hud: fakeEl(), screen: fakeEl(), modal: fakeEl() };
globalThis.document = {
  addEventListener() {},
  getElementById: (id) => els[id],
};

// --- fetch 스텁: 파일시스템에서 JSON을 읽는다 ---
globalThis.fetch = (path) => Promise.resolve({
  json: () => JSON.parse(readFileSync(new URL('../' + path.replace('./', ''), import.meta.url), 'utf8')),
});

const { eventBus } = await import('../src/core/eventBus.js');
const { store } = await import('../src/core/store.js');
await import('../src/main.js');
await new Promise((r) => setTimeout(r, 50)); // boot의 데이터 로드 대기

let pass = 0, fail = 0;
const ok = (cond, name) => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`); }
};
const emit = (type, payload) => eventBus.emit(`intent:${type}`, payload || {});
const S = () => store.get();

ok(S() && S().phase === 'design', '부트: design 페이즈로 시작');

// [설계] 시작 컬렉션 5장을 계약서에 올리고 가중치 보정
for (const id of ['h01', 'h02', 'h03', 'h04', 'h05']) emit('pool:add', { id });
ok(S().pool.length === 5, '넣기: 풀에 5장 추가됨');   // ← 이번에 발견된 버그의 회귀 테스트
emit('pool:normalize');
ok(S().pool.reduce((a, e) => a + e.weight, 0) === 100, '가중치 100% 보정');

emit('design:start');
ok(S().phase === 'draw' && S().pullsLeft === 8, '집필 시작: draw 페이즈, 호출 8회');
ok(S().ink === 100 - 25, `잉크 지불 (${S().ink} === 75)`);

// [뽑기] 전부 호출
for (let i = 0; i < 8; i++) emit('draw:pull');
ok(S().pullsLeft === 0, '호출 소진');
ok(S().hand.length === 8, '손패 8장 누적 (버리기 없음)');

// [선언] 성립 족보를 반복 선언 (선언 → 연출 닫기)
let declared = 0, guard = 10;
while (guard-- > 0) {
  const before = S().score;
  // 렌더가 아니라 상태 기준으로: modal에 declFx가 없고, 아무 족보나 선언 시도
  for (const y of ['oneman', 'tragedy', 'royal', 'allin', 'balanced', 'anthology', 'bond', 'combo']) {
    emit('draw:declare', { id: y });
    if (S().declFx) break;
  }
  if (!S().declFx) break;
  declared++;
  emit('fx:close');
  if (S().phase !== 'draw') break;
}
ok(declared > 0, `선언 배선 동작 (${declared}회 선언, 반향 ${S().score})`);
ok(['draw', 'clear', 'gameover'].includes(S().phase), `흐름 종착 페이즈 유효 (${S().phase})`);

// [게임오버 or 클리어] 어느 쪽이든 다음 단계 배선 확인
if (S().phase === 'clear') {
  emit('game:next');
  ok(S().phase === 'reward' && S().rewardOffer.length > 0, '클리어 → 보상 3택1');
  emit('reward:pick', { id: S().rewardOffer[0] });
  ok(S().phase === 'design' && S().chapterIdx === 1, '보상 → 제2장 설계로');
} else if (S().phase === 'gameover') {
  emit('game:restart');
  ok(S().phase === 'design' && S().chapterIdx === 0, '게임오버 → 재시작');
} else {
  // 아직 draw면 (족보 없이 소진) 포기 버튼 경로 확인
  emit('draw:giveup');
  ok(S().phase === 'gameover', '포기 → 게임오버');
}

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);

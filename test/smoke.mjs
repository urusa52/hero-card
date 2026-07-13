// test/smoke.mjs — 통합 배선 검증 (D16 산 시스템)
// DOM과 fetch를 스텁으로 대체하고 main.js를 실제로 부트한 뒤,
// 의도 이벤트로 "산 쌓기 → 집필 → 호출 → 선언 → 클리어" 흐름이 배선되어 있는지 확인한다.
import { readFileSync } from 'node:fs';

const fakeEl = () => ({ innerHTML: '' });
const els = { hud: fakeEl(), screen: fakeEl(), modal: fakeEl(), tutorial: fakeEl() };
globalThis.document = {
  addEventListener() {},
  getElementById: (id) => els[id],
};
globalThis.fetch = (path) => Promise.resolve({
  json: () => JSON.parse(readFileSync(new URL('../' + path.replace('./', ''), import.meta.url), 'utf8')),
});

const { eventBus } = await import('../src/core/eventBus.js');
const { store } = await import('../src/core/store.js');
await import('../src/main.js');
await new Promise((r) => setTimeout(r, 50));

let pass = 0, fail = 0;
const ok = (cond, name) => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`); }
};
const emit = (type, payload) => eventBus.emit(`intent:${type}`, payload || {});
const S = () => store.get();

ok(S() && S().phase === 'design', '부트: design 페이즈로 시작');

// [설계] 시작 컬렉션 6종을 2장씩 + 백지 1장 = 13장 산
for (const id of S().collection) { emit('pool:add', { id }); emit('pool:add', { id }); }
emit('pool:add', { id: 'b01' });
ok(S().deck.length === 13, '＋ 쌓기: 산에 13장 쌓임');   // ← pool:add 회귀 테스트
emit('pool:sub', { id: 'b01' });
emit('pool:add', { id: 'b01' });
ok(S().deck.length === 13, '− 빼기/다시 쌓기 배선 동작');

emit('design:start');
ok(S().phase === 'draw' && S().pullsLeft === 8, '집필 시작: draw 페이즈, 호출 8회');
ok(S().mountain.length === 13, '산이 실체화됨 (13장)');
ok(S().ink === 100 - 75, `잉크 지불 (${S().ink} === 25)`);

// [호출] 전부 — 비복원이라 산이 정확히 8장 줄어야 함 (드라마 리빌이 뜨면 공개하고 진행)
for (let i = 0; i < 8; i++) {
  emit('draw:pull');
  if (S().reveal) emit('reveal:open'); // 연출 스킵 경로 (D5)
}
ok(S().pullsLeft === 0, '호출 소진');
ok(S().mountain.length === 5, `비복원: 산 13→${S().mountain.length}장`);
const handAndEffects = S().hand.length;
ok(handAndEffects >= 6, `손패 누적 (특수효과 제외 ${handAndEffects}장)`);

// [선언] 성립 족보를 반복 선언
let declared = 0, guard = 10;
while (guard-- > 0) {
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

if (S().phase === 'clear') {
  emit('game:next');
  ok(S().phase === 'reward' && S().rewardOffer.length > 0, '클리어 → 보상 3택1');
  emit('reward:pick', { id: S().rewardOffer[0] });
  ok(S().phase === 'design' && S().chapterIdx === 1 && S().deck.length === 0, '보상 → 제2장 설계로 (산 초기화)');
} else if (S().phase === 'gameover') {
  emit('game:restart');
  ok(S().phase === 'design' && S().chapterIdx === 0, '게임오버 → 재시작');
} else {
  emit('draw:giveup');
  ok(S().phase === 'gameover', '포기 → 게임오버');
}

// 도움말/튜토리얼 배선
emit('help:toggle');
ok(S().helpOpen === true, '도움말 열기 배선');
emit('help:toggle');
emit('tutorial:off');
ok(S().tutorialOn === false, '튜토리얼 끄기 배선');

console.log(`\n결과: ${pass} 통과 / ${fail} 실패`);
process.exit(fail ? 1 : 0);

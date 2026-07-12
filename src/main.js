// main.js — 부트스트랩: 모듈 조립만 담당한다.
// 흐름: input(의도) → 여기서 로직 호출 → store 갱신 → render가 상태를 그림.
import { eventBus } from './core/eventBus.js';
import { store } from './core/store.js';
import { makeRng, pull } from './logic/gacha.js';
import { validate } from './logic/poolBuilder.js';
import { evaluate } from './logic/yaku.js';
import { calc } from './logic/scoring.js';
import * as round from './logic/round.js';
import { renderHud } from './render/hud.js';
import { renderPool } from './render/pool.js';
import { renderDraw } from './render/draw.js';
import { renderModal } from './render/modal.js';
import { bindControls } from './input/controls.js';

const data = {};   // { balance, cards, yaku, cardById, ctx }
let rng = null;

async function loadData() {
  const [balance, cards, yaku] = await Promise.all([
    fetch('./src/data/balance.json').then((r) => r.json()),
    fetch('./src/data/cards.json').then((r) => r.json()),
    fetch('./src/data/yaku.json').then((r) => r.json()),
  ]);
  Object.assign(data, { balance, cards, yaku: yaku.yaku });
  data.cardById = Object.fromEntries(cards.cards.map((c) => [c.id, c]));
  data.ctx = { bondPairs: cards.bondPairs };
}

function freshState(seed) {
  return {
    phase: 'design', chapterIdx: 0,
    ink: data.balance.budget.initial,
    pullsLeft: 0, carried: { bonusPulls: 0, penaltyPulls: 0 },
    score: 0, hand: [], pool: [],
    collection: [...data.cards.startCollection],
    uidSeq: 1, nextDeclMult: 1,
    pendingCopy: false, pendingCopyUid: null,
    rewardOffer: null, clearInfo: null, declFx: null,
    lastPull: null, log: [], seed,
    heroUse: {}, endingWord: '',
  };
}

// 손패 인스턴스 생성: 카드 원본 + uid (판정/렌더가 쓰는 병합본)
function materialize(s, cardId, isCopy = false) {
  return { ...data.cardById[cardId], cardId, uid: s.uidSeq++, isCopy };
}

const evals = (s) => evaluate(s.hand, data.yaku, data.ctx);

// ---------- 의도 배선 ----------
function wireIntents() {
  // [설계] 계약서에 카드 추가 — 기본 가중치는 최소치, 이후 슬라이더로 조정
  eventBus.on('intent:pool:add', ({ id }) => store.update((s) => {
    if (s.phase !== 'design' || s.pool.length >= data.balance.pool.maxCards) return;
    s.pool.push({ cardId: id, weight: data.balance.pool.minWeight });
  }));

  eventBus.on('intent:pool:remove', ({ index }) => store.update((s) => {
    s.pool.splice(Number(index), 1);
  }));

  eventBus.on('intent:pool:weight', ({ index, value }) => store.update((s) => {
    s.pool[Number(index)].weight = value;
  }));

  // 가중치 합 100% 자동 보정: 비례 배분 후 최소/상한으로 클램프, 잔차는 조정 가능한 칸에 5%p씩
  eventBus.on('intent:pool:normalize', () => store.update((s) => {
    const rules = data.balance.pool;
    const capOf = (e) => rules.weightCapByRarity[String(data.cardById[e.cardId].rarity)] || 95;
    const sum = s.pool.reduce((a, e) => a + e.weight, 0) || 1;
    s.pool.forEach((e) => {
      const w = Math.round((e.weight / sum) * 100 / 5) * 5;
      e.weight = Math.max(rules.minWeight, Math.min(capOf(e), w));
    });
    let diff = 100 - s.pool.reduce((a, e) => a + e.weight, 0);
    let guard = 100;
    while (diff !== 0 && guard-- > 0) {
      const step = diff > 0 ? 5 : -5;
      const target = s.pool.find((e) =>
        step > 0 ? e.weight + 5 <= capOf(e) : e.weight - 5 >= rules.minWeight);
      if (!target) break;
      target.weight += step; diff -= step;
    }
  }));

  // [설계 → 뽑기] 검증 통과 시 잉크를 지불하고 집필 시작
  eventBus.on('intent:design:start', () => store.update((s) => {
    const v = validate(s.pool, s.ink, data.cardById, data.balance.pool);
    if (!v.valid) return;
    s.ink -= v.spend;
    s.pullsLeft = round.pullsForChapter(s.chapterIdx, data.balance, s.carried);
    s.carried = { bonusPulls: 0, penaltyPulls: 0 };
    s.phase = 'draw';
    s.log.push(`제${s.chapterIdx + 1}장 — 집필을 시작합니다`);
  }));

  // [뽑기] 호출 1회: 특수 패는 즉시 효과, 나머지는 손패로
  eventBus.on('intent:draw:pull', () => store.update((s) => {
    if (s.phase !== 'draw' || s.pullsLeft <= 0 || s.pendingCopy) return;
    s.pullsLeft--;
    const cardId = pull(s.pool, rng);
    const card = data.cardById[cardId];
    if (card.effect === 'next_mult_x2') {
      s.nextDeclMult = 2;
      s.log.push('띠지 — 다음 선언의 반향 ×2');
    } else if (card.effect === 'wild_copy') {
      if (s.hand.some((c) => c.kind === 'hero')) {
        s.pendingCopy = true; // 대상 선택 모달로
        s.log.push('필사본 — 베낄 영웅을 고르세요');
      } else {
        s.hand.push(materialize(s, 'b01'));
        s.log.push('필사본이 백지가 되었습니다 (베낄 영웅 없음)');
      }
    } else {
      const inst = materialize(s, cardId);
      s.hand.push(inst);
      s.lastPull = inst.uid;
      s.log.push(card.kind === 'blank' ? `${card.name}…` : `${card.name} 호출`);
    }
    // 뽑기 소진 && 족보 없음 → 게임오버 판정은 round 로직에 위임
    if (round.isGameOver(s.pullsLeft, evals(s), s.score, s.chapterIdx, data.balance)) {
      s.phase = 'gameover';
    }
  }));

  // 필사본 대상 확정
  eventBus.on('intent:copy:pick', ({ uid }) => store.update((s) => {
    const target = s.hand.find((c) => c.uid === Number(uid));
    if (!target) return;
    const inst = materialize(s, target.cardId, true);
    s.hand.push(inst);
    s.lastPull = inst.uid;
    s.pendingCopy = false;
    s.log.push(`${target.name}의 필사본을 만들었습니다`);
  }));

  // [선언] 족보 확정 → 점수 계산(scoring) → 카드 소모 → 클리어 판정(round)
  eventBus.on('intent:draw:declare', ({ id }) => store.update((s) => {
    const entry = evals(s).find((e) => e.def.id === id && e.ok);
    if (!entry) return;
    const result = calc(entry, { nextDeclMult: s.nextDeclMult });
    s.nextDeclMult = 1; // 띠지는 일회성
    s.score += result.total;
    const usedUids = new Set(entry.cards.map((c) => c.uid));
    entry.cards.forEach((c) => { s.heroUse[c.name] = (s.heroUse[c.name] || 0) + 1; });
    s.hand = s.hand.filter((c) => !usedUids.has(c.uid));
    s.declFx = { name: entry.def.name, tier: entry.def.tier, breakdown: result.breakdown };
    if (entry.def.penalty === 'next_pulls_minus') {
      s.carried.penaltyPulls = data.balance.allinPenaltyPulls;
      s.log.push('독자들이 조금 질렸습니다 (다음 장 호출 -2)');
    }
  }));

  // 선언 연출 닫기 → 클리어/게임오버 판정
  eventBus.on('intent:fx:close', () => store.update((s) => {
    s.declFx = null;
    if (round.isCleared(s.score, s.chapterIdx, data.balance)) {
      s.clearInfo = round.clearRewards(s.score, s.chapterIdx, data.balance);
      s.phase = 'clear';
    } else if (round.isGameOver(s.pullsLeft, evals(s), s.score, s.chapterIdx, data.balance)) {
      s.phase = 'gameover';
    }
  }));

  // 클리어 → 보상 or 엔딩
  eventBus.on('intent:game:next', () => store.update((s) => {
    const r = s.clearInfo;
    s.ink += r.ink;
    if (r.bonusPulls) s.carried.bonusPulls = r.bonusPulls;
    if (r.isLast) {
      // 엔딩: 가장 많이 이야기에 오른 영웅의 이름이 『 』를 채운다
      const top = Object.entries(s.heroUse).sort((a, b) => b[1] - a[1])[0];
      s.endingWord = top ? top[0] : '이야기';
      s.phase = 'ending';
      return;
    }
    s.rewardOffer = round.rewardOffer(s.collection, data.cards.cards, data.balance, rng);
    s.phase = 'reward';
  }));

  // 보상 선택 → 다음 챕터 설계로 (잉크는 마른다)
  eventBus.on('intent:reward:pick', ({ id }) => store.update((s) => {
    s.collection.push(id);
    s.chapterIdx++;
    s.ink = round.evaporate(s.ink, data.balance);
    s.score = 0; s.hand = []; s.pool = []; s.rewardOffer = null; s.clearInfo = null;
    s.log = [];
    s.phase = 'design';
  }));

  eventBus.on('intent:draw:giveup', () => store.update((s) => { s.phase = 'gameover'; }));

  eventBus.on('intent:game:restart', () => {
    const seed = Date.now() % 2 ** 31;
    rng = makeRng(seed);
    store.init(freshState(seed));
  });
}

// ---------- 렌더 배선 ----------
function render(state) {
  renderHud(state, data);
  if (state.phase === 'design') renderPool(state, data);
  else renderDraw(state, data, evals(state));
  renderModal(state, data);
}

// ---------- 시작 ----------
(async function boot() {
  await loadData();
  bindControls();
  eventBus.on('state:changed', render);
  const seed = Date.now() % 2 ** 31;
  rng = makeRng(seed);
  store.init(freshState(seed));
})();

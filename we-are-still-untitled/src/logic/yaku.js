// logic/yaku.js
// 족보 판정: (손패, 족보 정의) → 성립 가능한 족보 목록 + 진행도(니어미스).
// 순수 함수 — 상태/화면을 모른다. 족보는 데이터(yaku.json)이고, 이 파일은 조건 프리미티브의 해석기다.
// 새 족보 대부분은 코드 수정 없이 데이터 추가만으로 생긴다 (원칙 5).

// 손패 카드 인스턴스: { uid, cardId, isCopy } + 카드 원본 필드 병합본을 받는다.
// isCopy(필사본)는 점수의 복각판 규칙(scoring)에서 처리하고, 판정에서는 원본과 동일하게 취급.

const heroes = (hand) => hand.filter((c) => c.kind === 'hero');

// 같은 key(role/genre) 값으로 count장 — 기본 반향이 높은 카드 우선 선택
function bestSameKey(hand, key, count) {
  const groups = {};
  for (const c of heroes(hand)) (groups[c[key]] ||= []).push(c);
  let best = null;
  for (const g of Object.values(groups)) {
    if (g.length < count) continue;
    const picked = [...g].sort((a, b) => b.base - a.base).slice(0, count);
    const sum = picked.reduce((s, c) => s + c.base, 0);
    if (!best || sum > best.sum) best = { cards: picked, sum };
  }
  return best;
}

const finders = {
  same_role: (hand, cond) => bestSameKey(hand, 'role', cond.count),
  same_genre: (hand, cond) => bestSameKey(hand, 'genre', cond.count),

  same_hero: (hand, cond) => {
    const groups = {};
    for (const c of heroes(hand)) (groups[c.cardId] ||= []).push(c);
    let best = null;
    for (const g of Object.values(groups)) {
      if (g.length < cond.count) continue;
      const picked = g.slice(0, cond.count);
      const sum = picked.reduce((s, c) => s + c.base, 0);
      if (!best || sum > best.sum) best = { cards: picked, sum };
    }
    return best;
  },

  // 탱·딜·힐 각 1 이상을 포함한 size장 — 필수 역할을 먼저 채우고 나머지는 반향순
  role_composition: (hand, cond) => {
    const hs = heroes(hand);
    if (hs.length < cond.size) return null;
    const used = new Set();
    const picked = [];
    for (const role of cond.need) {
      const c = hs
        .filter((c) => c.role === role && !used.has(c.uid))
        .sort((a, b) => b.base - a.base)[0];
      if (!c) return null;
      used.add(c.uid);
      picked.push(c);
    }
    const rest = hs
      .filter((c) => !used.has(c.uid))
      .sort((a, b) => b.base - a.base)
      .slice(0, cond.size - picked.length);
    if (picked.length + rest.length < cond.size) return null;
    const cards = [...picked, ...rest];
    return { cards, sum: cards.reduce((s, c) => s + c.base, 0) };
  },

  // 인연: 데이터로 정의된 짝이 손패에 동시에 존재
  hero_pair: (hand, _cond, ctx) => {
    let best = null;
    for (const { pair, title } of ctx.bondPairs) {
      const a = heroes(hand).find((c) => c.cardId === pair[0]);
      const b = heroes(hand).find((c) => c.cardId === pair[1]);
      if (a && b) {
        const sum = a.base + b.base;
        if (!best || sum > best.sum) best = { cards: [a, b], sum, title };
      }
    }
    return best;
  },

  // 서사 순서: seq의 각 슬롯에 해당 태그를 가진 서로 다른 카드를 배정 (백트래킹)
  // 한 카드가 여러 태그를 가질 수 있어 그리디로는 놓치는 배정이 있다 — 그래서 백트래킹.
  tag_sequence: (hand, cond) => {
    const pool = hand.filter((c) => c.tags && c.tags.length); // 희생 태그 꽝(이름 없는 조연)도 포함
    const slots = cond.seq;
    let best = null;
    (function assign(i, used, picked) {
      if (i === slots.length) {
        const sum = picked.reduce((s, c) => s + c.base, 0);
        if (!best || sum > best.sum) best = { cards: [...picked], sum };
        return;
      }
      for (const c of pool) {
        if (used.has(c.uid) || !c.tags.includes(slots[i])) continue;
        used.add(c.uid);
        picked.push(c);
        assign(i + 1, used, picked);
        picked.pop();
        used.delete(c.uid);
      }
    })(0, new Set(), []);
    return best;
  },
};

// 진행도(니어미스): "지금 몇 장 모였나 / 몇 장 필요한가" — 텐파이 연출/표시의 데이터 소스
function progressOf(hand, def, ctx) {
  const cond = def.condition;
  const count = (arr) => Math.max(0, ...arr, 0);
  if (cond.type === 'same_role' || cond.type === 'same_genre') {
    const key = cond.type === 'same_role' ? 'role' : 'genre';
    const groups = {};
    for (const c of heroes(hand)) groups[c[key]] = (groups[c[key]] || 0) + 1;
    return { have: count(Object.values(groups)), need: cond.count };
  }
  if (cond.type === 'same_hero') {
    const groups = {};
    for (const c of heroes(hand)) groups[c.cardId] = (groups[c.cardId] || 0) + 1;
    return { have: count(Object.values(groups)), need: cond.count };
  }
  if (cond.type === 'tag_sequence') {
    // 간이 진행도: 슬롯별로 배정 가능한 카드 수의 하한 (정확 판정은 finder가 담당)
    const remaining = [...cond.seq];
    let have = 0;
    const used = new Set();
    for (const t of remaining) {
      const c = hand.find((c) => !used.has(c.uid) && c.tags && c.tags.includes(t));
      if (c) { used.add(c.uid); have++; }
    }
    return { have, need: cond.seq.length };
  }
  if (cond.type === 'role_composition') {
    const rolesHave = new Set(heroes(hand).map((c) => c.role));
    const have = cond.need.filter((r) => rolesHave.has(r)).length;
    return { have: Math.min(heroes(hand).length, have + Math.max(0, heroes(hand).length - have)), need: cond.size, needRoles: cond.need.filter((r) => !rolesHave.has(r)) };
  }
  if (cond.type === 'hero_pair') {
    let have = 0;
    for (const { pair } of ctx.bondPairs) {
      const n = pair.filter((id) => heroes(hand).some((c) => c.cardId === id)).length;
      have = Math.max(have, n);
    }
    return { have, need: 2 };
  }
  return { have: 0, need: 0 };
}

// 공개 API: 손패에 대해 모든 족보를 평가
// 반환: [{ def, ok, cards, baseSum, progress, bondTitle? }]
export function evaluate(hand, yakuDefs, ctx) {
  return yakuDefs.map((def) => {
    const found = finders[def.condition.type](hand, def.condition, ctx);
    return {
      def,
      ok: !!found,
      cards: found ? found.cards : [],
      baseSum: found ? found.sum : 0,
      bondTitle: found && found.title,
      progress: progressOf(hand, def, ctx),
    };
  });
}

// 다음 호출 완성 확률 (D16 — 산이 실물이라 정확히 계산 가능)
// 산의 각 카드 종류에 대해 "그 카드가 손에 들어오면 이 족보가 성립하는가"를 판정해,
// (완성시키는 장수 / 산 전체 장수)를 반환한다. 텐파이 연출과 마지막 호출 드라마의 데이터 소스.
export function completionOdds(hand, mountain, cardById, yakuDefs, ctx) {
  if (!mountain.length) return {};
  const counts = {};
  for (const id of mountain) counts[id] = (counts[id] || 0) + 1;
  const now = evaluate(hand, yakuDefs, ctx);
  const odds = {};
  for (const e of now) {
    if (e.ok) continue;
    let completing = 0;
    for (const [id, n] of Object.entries(counts)) {
      const probe = { ...cardById[id], cardId: id, uid: -1, isCopy: false };
      const after = finders[e.def.condition.type]([...hand, probe], e.def.condition, ctx);
      if (after) completing += n;
    }
    if (completing > 0)
      odds[e.def.id] = { completing, total: mountain.length, pct: Math.round((completing / mountain.length) * 100) };
  }
  return odds;
}

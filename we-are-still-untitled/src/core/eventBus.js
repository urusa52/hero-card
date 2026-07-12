// core/eventBus.js
// 모듈 간 통신은 이 버스로만 한다 — 서로의 내부 구현을 직접 참조하지 않기 위해 (아키텍처 원칙 2)
const listeners = new Map();

export const eventBus = {
  on(type, fn) {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(fn);
    return () => listeners.get(type).delete(fn); // 해제 함수 반환
  },
  emit(type, payload) {
    (listeners.get(type) || []).forEach((fn) => fn(payload));
  },
};

// input/controls.js
// DOM 이벤트 → 의도(intent) 이벤트 변환. 로직을 직접 호출하지 않는다 (관심사 분리).
// data-action 속성이 곧 의도 이름이므로, 버튼을 추가해도 이 파일은 바뀌지 않는다.
import { eventBus } from '../core/eventBus.js';

export function bindControls() {
  document.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-action]');
    if (!btn || btn.disabled || btn.tagName === 'INPUT') return;
    eventBus.emit(`intent:${btn.dataset.action}`, { ...btn.dataset });
  });

  // 가중치 슬라이더: input 이벤트로 실시간 반영
  document.addEventListener('input', (ev) => {
    const el = ev.target.closest('input[data-action]');
    if (!el) return;
    eventBus.emit(`intent:${el.dataset.action}`, { ...el.dataset, value: Number(el.value) });
  });
}

// core/store.js
// 게임 상태는 여기 한 곳에만 존재하고, 변경은 update() 한 경로로만 일어난다 (아키텍처 원칙 4)
// 렌더링 모듈은 get()으로 읽기만 하고, 로직 모듈만 update()를 호출한다.
import { eventBus } from './eventBus.js';

let state = null;

export const store = {
  init(initial) {
    state = initial;
    eventBus.emit('state:changed', state);
  },
  get() {
    return state;
  },
  // mutator(state)가 상태를 수정한다. 어떤 변경이든 반드시 이 함수를 거친다.
  update(mutator) {
    mutator(state);
    eventBus.emit('state:changed', state);
  },
};

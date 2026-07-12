// render/hud.js
// 상단 HUD: 챕터, 잉크, 남은 뽑기, 반향/목표. 상태를 읽어 그리기만 한다 (변경 금지).
export function renderHud(state, data) {
  const ch = data.balance.chapters[state.chapterIdx];
  const pct = Math.min(100, (state.score / ch.target) * 100);
  const el = document.getElementById('hud');
  el.innerHTML = `
    <div class="hud-row">
      <span class="hud-chapter">제${state.chapterIdx + 1}장 <em>/ ${data.balance.chapters.length}</em></span>
      <span class="hud-stat">잉크 <b>${state.ink}</b></span>
      <span class="hud-stat">남은 호출 <b>${state.phase === 'draw' ? state.pullsLeft : '—'}</b></span>
      ${state.nextDeclMult > 1 ? '<span class="hud-tiji">띠지 ×2 대기</span>' : ''}
    </div>
    <div class="score-bar" title="반향 / 목표">
      <div class="score-fill" style="width:${pct}%"></div>
      <span class="score-text">${state.score} / ${ch.target}</span>
    </div>`;
}

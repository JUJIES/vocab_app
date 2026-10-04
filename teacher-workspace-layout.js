/* Desktop panel geometry only. The workspace owns per-account persistence. */
window.LerndeckWorkspaceLayout = (() => {
  const MIN = [160, 200], MAX = [360, 520], SNAP = [100, 130];
  const EDITOR_MIN = 480, EDGE = 10, RAIL = 28;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  function create({ root, onChange }) {
    const desktop = matchMedia('(min-width: 981px)');
    const panes = ['workspace-units', 'workspace-library'].map((id) => document.getElementById(id));
    const dividers = [...root.querySelectorAll('.workspace-divider')];
    const handles = dividers.map((node) => node.querySelector('[role="separator"]'));
    const buttons = dividers.map((node) => node.querySelector('button'));
    let preferences = [{ width: null, collapsed: false }, { width: null, collapsed: false }];
    let effective = [0, 0], drag = null;
    const snapshot = () => (drag ? drag.before : preferences).map((entry) => ({ ...entry }));
    const defaultWidth = (index) => clamp(root.clientWidth * [0.15, 0.22][index], [176, 240][index], [224, 320][index]);
    const desired = (index) => preferences[index].width ?? defaultWidth(index);
    const edges = () => preferences.reduce((sum, entry) => sum + (entry.collapsed ? RAIL : EDGE), 0);
    function maximum(index) {
      const other = 1 - index;
      return Math.max(MIN[index], Math.min(MAX[index], root.clientWidth - edges() - EDITOR_MIN - effective[other]));
    }
    function paint() {
      const active = desktop.matches;
      if (active && root.clientWidth > 0) {
        effective = preferences.map((entry, index) => entry.collapsed ? 0 : desired(index));
        // Fit smaller windows without changing the user's preferred desktop widths.
        let excess = effective[0] + effective[1] + edges() + EDITOR_MIN - root.clientWidth;
        for (const index of [1, 0]) {
          const reduction = Math.min(Math.max(0, excess), Math.max(0, effective[index] - MIN[index]));
          effective[index] -= reduction; excess -= reduction;
        }
      }
      panes.forEach((pane, index) => {
        const collapsed = active && preferences[index].collapsed;
        if (collapsed && pane.contains(document.activeElement)) handles[index].focus({ preventScroll: true });
        pane.inert = collapsed;
        pane.classList.toggle('is-collapsed', collapsed);
        if (collapsed) pane.setAttribute('aria-hidden', 'true'); else pane.removeAttribute('aria-hidden');
        dividers[index].classList.toggle('is-collapsed', collapsed);
        root.style.setProperty(`--workspace-pane-${index}`, `${effective[index]}px`);
        root.style.setProperty(`--workspace-edge-${index}`, `${collapsed ? RAIL : EDGE}px`);
        const label = index === 0 ? 'Bibliothek' : 'Lernsets';
        handles[index].tabIndex = active ? 0 : -1;
        handles[index].setAttribute('aria-valuenow', String(Math.round(effective[index])));
        handles[index].setAttribute('aria-valuemax', String(Math.round(maximum(index))));
        handles[index].setAttribute('aria-valuetext', collapsed ? 'Eingeklappt' : `${Math.round(effective[index])} Pixel breit`);
        buttons[index].setAttribute('aria-expanded', String(!collapsed));
        buttons[index].setAttribute('aria-label', `${label} ${collapsed ? 'aufklappen' : 'einklappen'}`);
        buttons[index].title = `${label} ${collapsed ? 'aufklappen' : 'einklappen'}`;
      });
    }
    function setWidth(index, raw) {
      if (raw < SNAP[index]) {
        // Keep the last useful width for restoring with Enter/the arrow button.
        preferences[index].collapsed = true;
      } else {
        preferences[index].collapsed = false;
        preferences[index].width = clamp(raw, MIN[index], maximum(index));
      }
      paint();
    }
    function toggle(index) {
      if (!desktop.matches) return;
      cancel();
      preferences[index].collapsed = !preferences[index].collapsed;
      paint(); onChange();
    }
    function finish(commit) {
      if (!drag) return;
      const previous = drag; drag = null;
      if (!commit) preferences = previous.before;
      root.classList.remove('is-resizing');
      if (previous.handle.hasPointerCapture(previous.id)) previous.handle.releasePointerCapture(previous.id);
      paint();
      if (commit) onChange();
    }
    function cancel() { finish(false); }
    handles.forEach((handle, index) => {
      handle.addEventListener('pointerdown', (event) => {
        if (!desktop.matches || event.button !== 0 || drag) return;
        event.preventDefault();
        handle.focus({ preventScroll: true });
        drag = { index, id: event.pointerId, x: event.clientX, width: effective[index], before: snapshot(), handle };
        handle.setPointerCapture(event.pointerId);
        root.classList.add('is-resizing');
      });
      handle.addEventListener('pointermove', (event) => {
        if (!drag || drag.id !== event.pointerId) return;
        setWidth(index, drag.width + event.clientX - drag.x);
      });
      handle.addEventListener('pointerup', (event) => { if (drag?.id === event.pointerId) finish(true); });
      handle.addEventListener('pointercancel', cancel);
      handle.addEventListener('lostpointercapture', cancel);
      handle.addEventListener('dblclick', () => toggle(index));
      handle.addEventListener('keydown', (event) => {
        if (!desktop.matches || event.altKey || event.ctrlKey || event.metaKey) return;
        if (event.key === 'Escape') { if (drag) { event.preventDefault(); cancel(); } return; }
        if (!['ArrowLeft', 'ArrowRight', 'Enter', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        if (event.key === 'Enter') { toggle(index); return; }
        const step = event.shiftKey ? 64 : 16;
        const width = event.key === 'Home' ? 0 : event.key === 'End' ? maximum(index)
          : (preferences[index].collapsed ? (event.key === 'ArrowRight' ? MIN[index] : 0) : (event.key === 'ArrowLeft' && effective[index] <= MIN[index] ? 0 : effective[index] + (event.key === 'ArrowRight' ? step : -step)));
        setWidth(index, width); onChange();
      });
      buttons[index].addEventListener('click', () => toggle(index));
    });
    document.addEventListener('keydown', (event) => {
      if (drag && event.key === 'Escape') { event.preventDefault(); cancel(); }
    });
    window.addEventListener('blur', cancel);
    desktop.addEventListener('change', () => { cancel(); paint(); });
    new ResizeObserver(() => { if (!drag) paint(); }).observe(root);
    return {
      snapshot, cancel,
      restore(saved) {
        cancel();
        preferences = [0, 1].map((index) => {
          const entry = Array.isArray(saved) ? saved[index] : null;
          return { width: Number.isFinite(entry?.width) ? clamp(entry.width, MIN[index], MAX[index]) : null,
            collapsed: entry?.collapsed === true };
        });
        paint();
      },
    };
  }
  return { create };
})();

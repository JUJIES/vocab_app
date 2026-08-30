(() => {
  const activeOperations = new WeakMap();
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const DIALOG_DURATION_MS = 250;
  const SURFACE_DURATION_MS = 260;

  function prefersReducedMotion() {
    return reducedMotionQuery.matches;
  }

  function clearOperation(element) {
    const operation = activeOperations.get(element);
    if (!operation) {
      return;
    }

    window.clearTimeout(operation.timerId);
    activeOperations.delete(element);
  }

  function schedule(element, callback, durationMs) {
    clearOperation(element);
    const timerId = window.setTimeout(() => {
      if (activeOperations.get(element)?.timerId !== timerId) {
        return;
      }
      activeOperations.delete(element);
      callback();
    }, prefersReducedMotion() ? 0 : durationMs);
    activeOperations.set(element, { timerId });
  }

  function show(element, { focus = null } = {}) {
    if (!(element instanceof HTMLElement)) {
      return;
    }

    clearOperation(element);
    element.classList.remove("ui-motion-leaving");
    element.classList.add("ui-motion-entering");
    element.hidden = false;
    element.setAttribute("aria-hidden", "false");
    void element.offsetWidth;

    window.requestAnimationFrame(() => {
      if (element.hidden) {
        return;
      }
      element.classList.remove("ui-motion-entering");
      if (focus instanceof HTMLElement) {
        focus.focus({ preventScroll: true });
      }
    });
  }

  function hide(element, { after = null } = {}) {
    if (!(element instanceof HTMLElement)) {
      after?.();
      return;
    }

    if (element.hidden) {
      after?.();
      return;
    }

    clearOperation(element);
    element.classList.remove("ui-motion-entering");
    element.classList.add("ui-motion-leaving");
    element.setAttribute("aria-hidden", "true");
    schedule(element, () => {
      element.hidden = true;
      element.classList.remove("ui-motion-leaving");
      after?.();
    }, DIALOG_DURATION_MS);
  }

  function swap(fromElement, toElement, { focus = null } = {}) {
    hide(fromElement);
    show(toElement, { focus });
  }

  function revealSurface(element) {
    if (!(element instanceof HTMLElement) || element.hidden) {
      return;
    }

    element.classList.remove("ui-motion-surface-entering");
    void element.offsetWidth;
    element.classList.add("ui-motion-surface-entering");
    schedule(
      element,
      () => element.classList.remove("ui-motion-surface-entering"),
      SURFACE_DURATION_MS,
    );
  }

  function revealPopover(element) {
    if (!(element instanceof HTMLElement)) {
      return;
    }

    clearOperation(element);
    element.hidden = false;
    element.setAttribute("aria-hidden", "false");
    element.classList.remove("ui-motion-popover-leaving");
    element.classList.remove("ui-motion-popover-entering");
    void element.offsetWidth;
    element.classList.add("ui-motion-popover-entering");
    schedule(
      element,
      () => element.classList.remove("ui-motion-popover-entering"),
      DIALOG_DURATION_MS,
    );
  }

  function hidePopover(element, { after = null } = {}) {
    if (!(element instanceof HTMLElement) || element.hidden) {
      after?.();
      return;
    }

    clearOperation(element);
    element.classList.remove("ui-motion-popover-entering");
    element.classList.add("ui-motion-popover-leaving");
    element.setAttribute("aria-hidden", "true");
    schedule(element, () => {
      element.hidden = true;
      element.classList.remove("ui-motion-popover-leaving");
      after?.();
    }, DIALOG_DURATION_MS);
  }

  function isVisible(element) {
    return element instanceof HTMLElement
      && !element.hidden
      && !element.classList.contains("ui-motion-leaving");
  }

  window.LerndeckUiMotion = Object.freeze({
    hide,
    hidePopover,
    isVisible,
    revealPopover,
    revealSurface,
    show,
    swap,
  });
})();

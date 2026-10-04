(() => {
  // Change this ID only when the highlights change, not on every deployment.
  const RELEASE_ID = "2026-10-04";
  const STORAGE_PREFIX = "lerndeck-whats-new-v1:";
  const shown = new Set();
  let pendingTeacher = "";
  let currentTeacher = "";
  let splashObserver = null;
  let bound = false;

  function dialog() { return document.getElementById("teacher-whats-new"); }
  function acknowledged(teacherId) {
    try { return localStorage.getItem(STORAGE_PREFIX + teacherId) === RELEASE_ID; }
    catch { return false; }
  }
  function bind() {
    if (bound) return;
    bound = true;
    const modal = dialog();
    modal.querySelector("[data-whats-new-close]").addEventListener("click", () => modal.close());
    modal.querySelector("[data-whats-new-confirm]").addEventListener("click", () => {
      if (modal.querySelector("[data-whats-new-hide]").checked && currentTeacher) {
        try { localStorage.setItem(STORAGE_PREFIX + currentTeacher, RELEASE_ID); }
        catch { /* Still dismiss for this visit when storage is unavailable. */ }
      }
      modal.close();
    });
    modal.addEventListener("close", () => { currentTeacher = ""; document.body.classList.remove("teacher-whats-new-open"); });
  }
  function openWhenReady() {
    if (!pendingTeacher || document.documentElement.classList.contains("pwa-splash-pending")) return;
    splashObserver?.disconnect(); splashObserver = null;
    const teacherId = pendingTeacher; pendingTeacher = "";
    if (shown.has(teacherId) || acknowledged(teacherId)) return;
    const modal = dialog();
    if (!modal || modal.open) return;
    bind(); currentTeacher = teacherId; shown.add(teacherId);
    modal.querySelector("[data-whats-new-hide]").checked = false;
    modal.showModal();
    document.body.classList.add("teacher-whats-new-open");
    window.LerndeckUiMotion?.revealSurface(modal);
    modal.querySelector("h2").focus({ preventScroll: true });
  }
  function show(teacherId) {
    if (!teacherId || shown.has(teacherId) || acknowledged(teacherId)) return;
    pendingTeacher = teacherId;
    if (document.documentElement.classList.contains("pwa-splash-pending") && !splashObserver) {
      splashObserver = new MutationObserver(openWhenReady);
      splashObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    }
    openWhenReady();
  }
  function dismiss() {
    pendingTeacher = ""; currentTeacher = "";
    splashObserver?.disconnect(); splashObserver = null;
    if (dialog()?.open) dialog().close();
  }
  window.LerndeckWhatsNew = Object.freeze({ show, dismiss });
})();

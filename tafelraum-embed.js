(() => {
  const APP_ID = "lerndeck";
  const active = window.self !== window.top
    && new URLSearchParams(window.location.search).get("embed") === "tafelraum";

  function contentZoomAction(event) {
    if ((!event.metaKey && !event.ctrlKey) || event.altKey || event.isComposing) return "";
    if (event.key === "+" || event.key === "=") return "increase";
    if (event.key === "-" || event.key === "_") return "decrease";
    if (event.key === "0") return "reset";
    return "";
  }

  if (active) {
    window.addEventListener("keydown", (event) => {
      const action = contentZoomAction(event);
      if (!action) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      window.parent.postMessage({
        type: "tafelraum:app-content-zoom",
        appId: APP_ID,
        action,
      }, "*");
    }, true);
  }

  window.LerndeckTafelraumEmbed = Object.freeze({
    active,
    ready() {
      if (!active) return;
      window.parent.postMessage({ type: "tafelraum:app-ready", appId: APP_ID }, "*");
    },
  });
})();

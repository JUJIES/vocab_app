(() => {
  const PWA_SPLASH_MIN_VISIBLE_MS = 2100;
  const PWA_SPLASH_MAX_READY_WAIT_MS = 2600;
  const PWA_SPLASH_FADE_MS = 540;
  const splashStartedAt = window.performance.now();
  const splash = document.querySelector(".pwa-splash");
  const isStandalone = document.documentElement.classList.contains("is-pwa-standalone");
  const backgroundElements = splash && isStandalone
    ? Array.from(document.body.children)
        .filter((element) => element !== splash)
        .map((element) => ({ element, wasInert: element.inert }))
    : [];
  let appReady = false;
  let dismissStarted = false;

  if (isStandalone && splash) {
    document.body.setAttribute("aria-busy", "true");
    for (const { element } of backgroundElements) {
      element.inert = true;
    }
  }

  function wait(delayMs) {
    return new Promise((resolve) => window.setTimeout(resolve, delayMs));
  }

  function finishSplashDismissal() {
    for (const { element, wasInert } of backgroundElements) {
      element.inert = wasInert;
    }
    document.body.removeAttribute("aria-busy");
    splash?.remove();
    document.documentElement.classList.remove("pwa-splash-pending");
  }

  async function dismissSplashWhenReady() {
    if (!isStandalone || !splash || dismissStarted) {
      finishSplashDismissal();
      return;
    }

    dismissStarted = true;
    const remainingMinimumMs = Math.max(
      0,
      PWA_SPLASH_MIN_VISIBLE_MS - (window.performance.now() - splashStartedAt),
    );
    const remainingMaximumMs = Math.max(
      0,
      PWA_SPLASH_MAX_READY_WAIT_MS - (window.performance.now() - splashStartedAt),
    );

    await Promise.all([
      wait(remainingMinimumMs),
      appReady ? Promise.resolve() : Promise.race([
        new Promise((resolve) => window.addEventListener("lerndeck:app-ready", resolve, { once: true })),
        wait(remainingMaximumMs),
      ]),
      document.fonts?.ready
        ? Promise.race([document.fonts.ready, wait(remainingMaximumMs)])
        : Promise.resolve(),
    ]);

    splash.classList.add("is-leaving");
    window.setTimeout(finishSplashDismissal, PWA_SPLASH_FADE_MS + 80);
  }

  window.LerndeckPwa = Object.freeze({
    ready() {
      if (appReady) {
        return;
      }
      appReady = true;
      window.dispatchEvent(new Event("lerndeck:app-ready"));
    },
  });

  void dismissSplashWhenReady();

  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    if (window.location.protocol === "http:") {
      navigator.serviceWorker.getRegistrations()
        .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
        .then(() => caches.keys())
        .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
        .catch((error) => {
          console.error("Unable to clear local service workers:", error);
        });
      return;
    }

    navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    }).then((registration) => registration.update()).catch((error) => {
      console.error("Unable to register or update service worker:", error);
    });
  });
})();

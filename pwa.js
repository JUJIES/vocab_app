(() => {
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

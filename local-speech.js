(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LerndeckLocalSpeech = api;
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";

  function selectVoice(voices, language) {
    const requested = String(language || "").toLowerCase().replace(/_/g, "-");
    if (!requested) return null;
    const base = requested.split("-")[0];
    const preferred = requested.includes("-") ? requested : ({ en: "en-gb", de: "de-de" }[base] || requested);
    // Never use a remote voice or silently pronounce English with a German voice.
    return voices.filter((voice) => voice.localService === true
      && String(voice.lang).toLowerCase().split(/[-_]/)[0] === base)
      .map((voice, index) => {
        const name = String(voice.name || "");
        const quality = /premium|enhanced|natural|neural|siri/i.test(name) ? 100 : 0;
        const locale = String(voice.lang).toLowerCase().replace(/_/g, "-");
        return { voice, index, score: quality + (locale === preferred ? 20 : 0) + (voice.default ? 1 : 0) };
      }).sort((a, b) => b.score - a.score || a.index - b.index)[0]?.voice || null;
  }

  function createPlayer(environment) {
    let active = null;
    const synth = environment.speechSynthesis;
    const supported = Boolean(synth && environment.SpeechSynthesisUtterance);
    function voice(language) {
      return supported ? selectVoice(synth.getVoices(), language) : null;
    }
    function stop() {
      const previous = active;
      active = null;
      if (previous) {
        environment.clearTimeout(previous.timer);
        previous.resolve(false);
        synth.cancel();
      }
    }
    function speak(text, language) {
      stop();
      const selected = voice(language);
      if (!selected || !String(text || "").trim()) return Promise.resolve(false);
      return new Promise((resolve) => {
        const utterance = new environment.SpeechSynthesisUtterance(text);
        utterance.voice = selected;
        utterance.lang = selected.lang;
        utterance.rate = 0.9;
        const entry = { utterance, resolve, timer: null };
        active = entry; // Retain the utterance until end/error, including on Safari.
        function finish(success) {
          if (active !== entry) return;
          environment.clearTimeout(entry.timer);
          active = null;
          resolve(success);
        }
        utterance.onend = () => finish(true);
        utterance.onerror = () => finish(false);
        // Device/browser failures must never leave the exercise waiting indefinitely.
        entry.timer = environment.setTimeout(() => { stop(); }, 20000);
        try {
          synth.speak(utterance); // Stay inside the user's click/submit gesture.
        } catch {
          finish(false);
        }
      });
    }
    return { voice, speak, stop, isSpeaking: () => Boolean(active) };
  }

  return { selectVoice, createPlayer };
});

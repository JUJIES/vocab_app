(function (root, factory) {
  const options = factory();
  if (typeof module === "object" && module.exports) module.exports = options;
  else if (root) root.LerndeckSetSides = options;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const choices = Object.freeze({
    en: { label: "Englisch", language: "en", symbol: "🇬🇧", partner: "de", preset: "languages" },
    de: { label: "Deutsch", language: "de", symbol: "🇩🇪", partner: "en", preset: "languages" },
    term: { label: "Begriff", language: "und", symbol: "🏷️", partner: "definition", preset: "term-definition" },
    definition: { label: "Definition", language: "und", symbol: "📖", partner: "term", preset: "term-definition" },
    question: { label: "Frage", language: "und", symbol: "❓", partner: "answer", preset: "question-answer" },
    answer: { label: "Antwort", language: "und", symbol: "💬", partner: "question", preset: "question-answer" },
  });

  function resolve(front, back) {
    const source = choices[front];
    const target = choices[back];
    if (!source || !target || source.partner !== back || target.partner !== front) return null;
    return {
      preset: source.preset,
      sourceLabel: source.label,
      targetLabel: target.label,
      sourceLanguage: source.language,
      targetLanguage: target.language,
    };
  }

  function infer(metadata) {
    for (const front of Object.keys(choices)) {
      const back = choices[front].partner;
      const configuration = resolve(front, back);
      if (configuration.sourceLabel === metadata?.sourceLabel
        && configuration.targetLabel === metadata?.targetLabel
        && configuration.sourceLanguage === metadata?.sourceLanguage
        && configuration.targetLanguage === metadata?.targetLanguage) {
        return { front, back, ...configuration };
      }
    }
    return null;
  }

  return { choices, resolve, infer };
});

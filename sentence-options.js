((root, factory) => {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root && typeof root === "object") root.LerndeckSentenceOptions = api;
})(typeof globalThis === "object" ? globalThis : this, () => {
  const difficulties = Object.freeze([
    Object.freeze({ key: "easy", label: "Einfach", description: "Kurze Sätze", iconPath: "./assets/icons/translation-difficulty/easy.webp", maxWords: 10 }),
    Object.freeze({ key: "medium", label: "Mittel", description: "Mehr Kontext", iconPath: "./assets/icons/translation-difficulty/medium.webp", maxWords: 16 }),
    Object.freeze({ key: "hard", label: "Schwer", description: "Kleine Challenge", iconPath: "./assets/icons/translation-difficulty/hard.webp", maxWords: 24 }),
  ]);
  return Object.freeze({ difficulties, defaultDifficulty: "easy", getDifficulty: key => difficulties.find(item => item.key === key) || null });
});

(function initGradingRules(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.LerndeckGradingRules = api;
  }
}(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const GRADE_THRESHOLDS = Object.freeze([
    Object.freeze({ minimumPercent: 92, grade: 1 }),
    Object.freeze({ minimumPercent: 81, grade: 2 }),
    Object.freeze({ minimumPercent: 67, grade: 3 }),
    Object.freeze({ minimumPercent: 50, grade: 4 }),
    Object.freeze({ minimumPercent: 30, grade: 5 }),
    Object.freeze({ minimumPercent: 0, grade: 6 }),
  ]);

  function clamp(value, minimum, maximum) {
    return Math.min(Math.max(value, minimum), maximum);
  }

  function summarizeResult(correctCount, totalCount) {
    const normalizedTotalCount = Math.max(0, Math.floor(Number(totalCount) || 0));
    const normalizedCorrectCount = clamp(
      Math.floor(Number(correctCount) || 0),
      0,
      normalizedTotalCount,
    );
    const percent = normalizedTotalCount > 0
      ? Math.round((normalizedCorrectCount / normalizedTotalCount) * 100)
      : 0;
    const grade = GRADE_THRESHOLDS.find((threshold) => percent >= threshold.minimumPercent)?.grade || 6;

    return Object.freeze({
      correctCount: normalizedCorrectCount,
      totalCount: normalizedTotalCount,
      percent,
      grade,
    });
  }

  return Object.freeze({
    GRADE_THRESHOLDS,
    summarizeResult,
  });
}));

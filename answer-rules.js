((root, factory) => {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (root && typeof root === "object") {
    root.LerndeckAnswerRules = api;
  }
})(typeof globalThis === "object" ? globalThis : this, () => {
  const ENGLISH_OPTIONAL_LEADING_WORDS = new Set(["a", "an", "the", "to"]);
  const COMPARISON_TOKEN_PATTERN = /[\p{L}\p{N}]+(?:['’‘ʼ\p{Pd}][\p{L}\p{N}]+)*/gu;

  function normalizeForComparison(value) {
    if (typeof value !== "string") {
      return "";
    }

    const tokens = value
      .normalize("NFKC")
      .trim()
      .toLocaleLowerCase()
      .match(COMPARISON_TOKEN_PATTERN) || [];

    return tokens
      .map((token) => token
        .replace(/[’‘ʼ]/gu, "'")
        .replace(/\p{Pd}/gu, "-"))
      .join(" ");
  }

  function tokenize(value) {
    return typeof value === "string"
      ? value
          .normalize("NFKC")
          .trim()
          .toLocaleLowerCase()
          .match(/[\p{L}\p{N}]+/gu) || []
      : [];
  }

  function getDisplayWords(value, language = "") {
    const words = tokenize(value);
    const normalizedLanguage = typeof language === "string" ? language.trim().toLowerCase() : "";
    return normalizedLanguage === "en" && ENGLISH_OPTIONAL_LEADING_WORDS.has(words[0])
      ? words.slice(1)
      : words;
  }

  function calculateDistance(source, target) {
    const left = normalizeForComparison(source);
    const right = normalizeForComparison(target);

    if (left === right) {
      return 0;
    }
    if (!left) {
      return right.length;
    }
    if (!right) {
      return left.length;
    }

    const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
    const current = new Array(right.length + 1).fill(0);

    for (let row = 1; row <= left.length; row += 1) {
      current[0] = row;
      for (let column = 1; column <= right.length; column += 1) {
        const substitutionCost = left[row - 1] === right[column - 1] ? 0 : 1;
        current[column] = Math.min(
          current[column - 1] + 1,
          previous[column] + 1,
          previous[column - 1] + substitutionCost,
        );
      }
      for (let index = 0; index <= right.length; index += 1) {
        previous[index] = current[index];
      }
    }

    return previous[right.length];
  }

  function areEquivalentDisplayForms(left, right, { language = "" } = {}) {
    if (normalizeForComparison(left) === normalizeForComparison(right)) {
      return true;
    }

    const leftWords = getDisplayWords(left, language);
    const rightWords = getDisplayWords(right, language);
    if (leftWords.join("") === rightWords.join("")) {
      return true;
    }
    if (leftWords.length !== rightWords.length) {
      return false;
    }

    return leftWords.every((word, index) => {
      const counterpart = rightWords[index];
      if (word === counterpart) {
        return true;
      }
      if (word[0] !== counterpart?.[0] || Math.min(word.length, counterpart.length) < 4) {
        return false;
      }
      const distance = calculateDistance(word, counterpart);
      if (distance <= 1) {
        return true;
      }
      return distance === 2
        && [...word].sort().join("") === [...counterpart].sort().join("");
    });
  }

  function getAlmostDistanceLimit(answerLength) {
    if (answerLength >= 9) {
      return 2;
    }
    if (answerLength >= 5) {
      return 1;
    }
    return 0;
  }

  function evaluate(input, answers) {
    const normalizedInput = normalizeForComparison(input);
    const normalizedAnswers = Array.isArray(answers)
      ? answers
          .filter((answer) => typeof answer === "string" && answer.trim())
          .map((answer) => ({
            raw: answer.trim(),
            normalized: normalizeForComparison(answer),
          }))
          .filter((answer) => answer.normalized)
      : [];

    if (normalizedAnswers.length === 0) {
      return {
        status: "wrong",
        normalizedInput,
        bestAnswer: "",
        distance: null,
      };
    }

    const exactAnswer = normalizedInput
      ? normalizedAnswers.find((answer) => answer.normalized === normalizedInput)
      : null;
    if (exactAnswer) {
      return {
        status: "correct",
        normalizedInput,
        bestAnswer: exactAnswer.raw,
        distance: 0,
      };
    }

    let bestMatch = normalizedAnswers[0];
    let bestDistance = calculateDistance(normalizedInput, bestMatch.normalized);
    for (const answer of normalizedAnswers.slice(1)) {
      const distance = calculateDistance(normalizedInput, answer.normalized);
      if (distance < bestDistance) {
        bestMatch = answer;
        bestDistance = distance;
      }
    }

    const almostDistanceLimit = getAlmostDistanceLimit(bestMatch.normalized.length);
    const hasSameFirstLetter = normalizedInput[0]
      && bestMatch.normalized[0]
      && normalizedInput[0] === bestMatch.normalized[0];
    const isAlmost = almostDistanceLimit > 0
      && bestDistance > 0
      && bestDistance <= almostDistanceLimit
      && hasSameFirstLetter;

    return {
      status: isAlmost ? "almost" : "wrong",
      normalizedInput,
      bestAnswer: bestMatch.raw,
      distance: bestDistance,
    };
  }

  return Object.freeze({
    areEquivalentDisplayForms,
    calculateDistance,
    evaluate,
    normalizeForComparison,
  });
});

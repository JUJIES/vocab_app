((root, factory) => {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (root && typeof root === "object") {
    root.LerndeckIrregularVerbs = api;
  }
})(typeof globalThis === "object" ? globalThis : this, () => {
  const FORM_LABELS = Object.freeze([
    "Infinitiv",
    "Simple Past",
    "Past Participle",
  ]);
  const FORM_SEPARATOR = /\s+[\-–—]\s+/u;

  function parseForms(value) {
    if (typeof value !== "string" || !FORM_SEPARATOR.test(value)) {
      return null;
    }

    const forms = value
      .split(FORM_SEPARATOR)
      .map((form) => form.trim());

    return forms.length === FORM_LABELS.length && forms.every(Boolean)
      ? forms
      : null;
  }

  function buildAnswerGroups(primaryAnswer, alternativeAnswers = []) {
    const primaryForms = parseForms(primaryAnswer);

    if (!primaryForms) {
      return null;
    }

    const groups = primaryForms.map((form) => [form]);
    const candidates = Array.isArray(alternativeAnswers)
      ? alternativeAnswers.flatMap((answer) => (
          typeof answer === "string" ? answer.split(";") : []
        ))
      : [];

    for (const candidate of candidates) {
      const candidateForms = parseForms(candidate);
      if (!candidateForms) {
        continue;
      }

      candidateForms.forEach((form, index) => {
        const normalizedForm = form.toLocaleLowerCase("de");
        const alreadyIncluded = groups[index].some(
          (answer) => answer.toLocaleLowerCase("de") === normalizedForm,
        );
        if (!alreadyIncluded) {
          groups[index].push(form);
        }
      });
    }

    return groups;
  }

  function evaluateInputs(inputs, answerGroups, evaluateSingleAnswer) {
    if (
      !Array.isArray(inputs)
      || !Array.isArray(answerGroups)
      || answerGroups.length !== FORM_LABELS.length
      || typeof evaluateSingleAnswer !== "function"
    ) {
      return null;
    }

    const rawInputs = FORM_LABELS.map((_label, index) => (
      typeof inputs[index] === "string" ? inputs[index] : ""
    ));
    const fieldEvaluations = answerGroups.map((answers, index) => (
      evaluateSingleAnswer(rawInputs[index], answers)
    ));
    const allCorrect = fieldEvaluations.every((evaluation) => evaluation.status === "correct");
    const hasWrong = fieldEvaluations.some((evaluation) => evaluation.status === "wrong");
    const status = allCorrect ? "correct" : hasWrong ? "wrong" : "almost";

    return {
      status,
      rawInputs,
      fieldEvaluations,
      bestAnswers: fieldEvaluations.map((evaluation) => evaluation.bestAnswer || ""),
      bestAnswer: fieldEvaluations.map((evaluation) => evaluation.bestAnswer || "").join(" · "),
      normalizedInput: fieldEvaluations.map((evaluation) => evaluation.normalizedInput || "").join(" · "),
      distance: fieldEvaluations.reduce((total, evaluation) => (
        total + (Number.isFinite(evaluation.distance) ? evaluation.distance : 0)
      ), 0),
    };
  }

  return Object.freeze({
    FORM_LABELS,
    buildAnswerGroups,
    evaluateInputs,
    parseForms,
  });
});

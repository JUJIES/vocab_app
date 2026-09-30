// Loaded before CSS so the teacher's saved appearance is used on the first paint.
(() => {
  const STORAGE_KEY = "lerndeck-teacher-appearance-v1";
  const themes = {
    light: [
      { id: "linen", name: "Leinen", description: "Warm & sandfarben" },
      { id: "sage", name: "Salbei", description: "Frisch & sanft grün" },
    ],
    dark: [
      { id: "navy", name: "Nachtblau", description: "Ruhig & blaugrau" },
      { id: "forest", name: "Wald", description: "Weich & dunkelgrün" },
    ],
  };

  function normalize(value) {
    return {
      mode: value?.mode === "light" ? "light" : "dark",
      light: themes.light.some((theme) => theme.id === value?.light) ? value.light : "linen",
      dark: themes.dark.some((theme) => theme.id === value?.dark) ? value.dark : "navy",
    };
  }

  let preference;
  try {
    preference = normalize(JSON.parse(window.localStorage.getItem(STORAGE_KEY)));
  } catch {
    preference = normalize(null);
  }

  function apply() {
    document.documentElement.dataset.teacherMode = preference.mode;
    document.documentElement.dataset.teacherTheme = preference[preference.mode];
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = {
      linen: "#eae5dc", sage: "#e3ebe5", navy: "#141b28", forest: "#192723",
    }[preference[preference.mode]];
  }

  function save(next) {
    preference = normalize(next);
    apply();
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preference));
    } catch {
      // Appearance still works for this visit when browser storage is unavailable.
    }
  }

  window.LerndeckTeacherTheme = {
    themes,
    getPreference: () => ({ ...preference }),
    setMode(mode) { save({ ...preference, mode }); },
    setTheme(theme) { save({ ...preference, [preference.mode]: theme }); },
  };
  apply();
})();

/* Library/navigation controller. Set content and saving remain in teacher.js. */
window.LerndeckTeacherWorkspace = (() => {
  const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const labels = { all: "Alle Sets", unfiled: "Nicht eingeordnet" };

  function create(config) {
    const byId = (id) => document.getElementById(id);
    const el = {
      root: byId("teacher-workspace"), nav: byId("workspace-navigation"), owner: byId("workspace-owner"),
      ownerField: byId("workspace-owner-field"), units: byId("workspace-units"), library: byId("workspace-library"),
      search: byId("workspace-search"), list: byId("teacher-set-list"), title: byId("sets-title"), meta: byId("sets-meta"),
      empty: byId("teacher-empty-state"), feedback: byId("workspace-library-feedback"), newSet: byId("create-set-button"),
      newUnit: byId("workspace-create-unit"), unitForm: byId("workspace-unit-form"), unitName: byId("workspace-unit-name"),
      unitCancel: byId("workspace-unit-cancel"), unitSelect: byId("set-unit-input"), editor: byId("workspace-editor"),
      breadcrumb: byId("workspace-breadcrumb"),
    };
    const state = { owner: "", view: "all", selected: "", search: "", mobile: "library", editUnit: "", loaded: false, intent: 0, restored: null, movingUnit: false, unitOptions: "", navMarkup: "" };
    const key = () => `lerndeck-teacher-workspace-v1:${config.data().teacher?.id || ""}`;
    const ownLibrary = () => state.owner === config.data().teacher?.id;
    const units = () => config.data().units.filter((unit) => unit.ownerTeacherId === state.owner);
    const sets = () => config.data().sets.filter((set) => set.ownerTeacherId === state.owner);
    const name = () => labels[state.view] || units().find((unit) => unit.id === state.view)?.name || "Alle Sets";
    const currentUnit = () => units().find((unit) => unit.id === state.view)?.id || "";
    const count = (view) => sets().filter((set) => matches(set, view)).length;
    function matches(set, view = state.view) {
      return view === "all" || (view === "unfiled" ? !set.unitId : set.unitId === view);
    }
    function read() {
      try { return JSON.parse(localStorage.getItem(key()) || "null") || {}; } catch (_) { return {}; }
    }
    function remember() {
      if (!state.loaded) return;
      try { localStorage.setItem(key(), JSON.stringify({ owner: state.owner, view: state.view, selected: state.selected,
        search: state.search, mobile: state.mobile, libraryScroll: el.list.scrollTop,
        unitsScroll: el.units.scrollTop, editorScroll: el.editor.scrollTop })); } catch (_) { /* Navigation works with blocked storage. */ }
    }
    function writeUrl() {
      const url = new URL(location.href);
      for (const [key, value] of [["owner", state.owner], ["unit", state.view], ["set", state.selected]]) {
        if (value) url.searchParams.set(key, value); else url.searchParams.delete(key);
      }
      history.replaceState(null, "", url);
    }
    function applyMobile() { el.root.dataset.mobileView = state.mobile; }
    function feedback(message) { el.feedback.textContent = message; }
    function showError(error) {
      if (error.requiresAuth) config.authRequired(error.message);
      else feedback(error.message);
    }
    async function refreshAfterCommit(message, inEditor = false) {
      try { await config.reload(); }
      catch (error) {
        if (error.requiresAuth) showError(error);
        else if (inEditor) config.editorError(message);
        else feedback(message);
      }
    }
    async function request(path, options) {
      const response = await config.request(path, options);
      if (!response.ok) {
        const error = new Error(response.data?.error || "Änderung konnte nicht gespeichert werden.");
        error.requiresAuth = response.status === 401;
        throw error;
      }
      return response.data;
    }
    async function navigate(change) {
      const intent = ++state.intent;
      if (!await config.beforeLeave() || intent !== state.intent) return;
      await change();
      remember(); writeUrl();
    }
    async function selectSet(id) {
      if (id === state.selected && config.editorId() === id) {
        state.mobile = "editor"; applyMobile(); remember(); return;
      }
      await navigate(async () => {
        const scroll = state.restored?.selected === id ? state.restored.editorScroll || 0 : 0;
        const opened = await config.openSet(config.data().sets.find((set) => set.id === id));
        if (!opened) return;
        state.selected = id; state.mobile = "editor"; applyMobile(); render();
        el.editor.scrollTop = scroll;
        state.restored = null;
      });
    }
    function render() {
      const data = config.data();
      if (!data.teacher) return;
      if (!state.loaded) {
        const saved = read(), params = new URLSearchParams(location.search);
        state.restored = saved;
        state.owner = params.get("owner") || saved.owner || data.teacher.id;
        state.view = params.get("unit") || saved.view || "all";
        state.selected = params.get("set") || saved.selected || "";
        state.search = typeof saved.search === "string" ? saved.search : "";
        state.mobile = saved.mobile === "editor" ? "editor" : "library";
        state.loaded = true;
      }
      const isAdmin = data.teacher.role === "admin";
      const owners = isAdmin ? data.accounts : [data.teacher];
      if (!owners.some((owner) => owner.id === state.owner)) state.owner = data.teacher.id;
      if (!labels[state.view] && !units().some((unit) => unit.id === state.view)) state.view = "all";
      el.ownerField.hidden = !isAdmin;
      el.owner.replaceChildren(...owners.map((owner) => new Option(owner.displayName, owner.id)));
      el.owner.value = state.owner;
      el.newSet.hidden = !ownLibrary(); el.newUnit.hidden = !ownLibrary();
      el.search.value = state.search;
      const navScroll = el.units.scrollTop, listScroll = el.list.scrollTop;
      const navButton = (view, text) => `<button type="button" class="workspace-nav-button" data-library-view="${escape(view)}" aria-pressed="${state.view === view}"><span>${escape(text)}</span><span class="workspace-count">${count(view)}</span></button>`;
      const navMarkup = navButton("all", labels.all)
        + '<p class="workspace-nav-caption">Lerndecks</p>'
        + units().map((unit) => `<div class="workspace-unit-row">${navButton(unit.id, unit.name)}${ownLibrary() ? `<details class="workspace-unit-menu" data-unit-id="${escape(unit.id)}"><summary aria-label="Lerndeck ${escape(unit.name)} verwalten">•••</summary><div><button type="button" data-unit-rename="${escape(unit.id)}">Umbenennen</button><button type="button" data-unit-delete="${escape(unit.id)}">Entfernen</button></div></details>` : ""}</div>`).join("")
        + navButton("unfiled", labels.unfiled);
      if (navMarkup !== state.navMarkup) {
        const openUnits = new Set([...el.nav.querySelectorAll(".workspace-unit-menu[open]")].map((menu) => menu.dataset.unitId));
        el.nav.innerHTML = navMarkup;
        for (const menu of el.nav.querySelectorAll(".workspace-unit-menu")) menu.open = openUnits.has(menu.dataset.unitId);
        state.navMarkup = navMarkup;
      }
      const needle = state.search.trim().toLocaleLowerCase("de");
      const filtered = sets().filter((set) => matches(set) && (!needle || [set.title, set.subject, set.description,
        units().find((unit) => unit.id === set.unitId)?.name || ""].join(" ").toLocaleLowerCase("de").includes(needle)));
      el.list.replaceChildren();
      for (const set of filtered) {
        const row = document.createElement("button");
        row.type = "button"; row.className = "workspace-set-row"; row.dataset.openSet = set.id;
        row.setAttribute("aria-label", `Set ${set.title} öffnen`);
        if (set.id === state.selected) row.setAttribute("aria-current", "page");
        const title = document.createElement("span"); title.className = "workspace-set-title"; title.textContent = set.title;
        const meta = document.createElement("span"); meta.className = "workspace-set-meta";
        const job = data.jobs.find((job) => job.setId === set.id && ["queued", "running"].includes(job.status));
        meta.textContent = `${set.cardCount} ${set.cardCount === 1 ? "Vokabel" : "Vokabeln"}${job ? " · Bilder werden erstellt" : ""}`;
        row.append(title, meta); el.list.append(row);
      }
      el.title.textContent = name(); el.meta.textContent = `${filtered.length} Set${filtered.length === 1 ? "" : "s"}`;
      el.empty.hidden = filtered.length > 0;
      el.empty.querySelector("p").textContent = needle ? "Keine Treffer" : "Keine Sets";
      el.units.scrollTop = navScroll; el.list.scrollTop = listScroll;
      applyMobile(); refreshEditorUnit();
    }
    function refreshEditorUnit() {
      const editorOwner = config.editorOwner() || config.data().teacher?.id;
      const editorUnits = config.data().units.filter((unit) => unit.ownerTeacherId === editorOwner);
      const selected = config.editorUnit();
      const options = JSON.stringify(editorUnits.map((unit) => [unit.id, unit.name]));
      if (options !== state.unitOptions) {
        el.unitSelect.replaceChildren(new Option("Nicht eingeordnet", ""), ...editorUnits.map((unit) => new Option(unit.name, unit.id)));
        state.unitOptions = options;
      }
      el.unitSelect.value = selected;
      el.unitSelect.disabled = state.movingUnit || editorOwner !== config.data().teacher?.id;
      const owner = config.data().accounts.find((account) => account.id === editorOwner);
      const unit = editorUnits.find((unit) => unit.id === selected);
      el.breadcrumb.textContent = `${owner?.displayName || "Meine Lernsets"} / ${unit?.name || "Nicht eingeordnet"}`;
    }
    function showUnitForm(id = "") {
      state.editUnit = id;
      el.unitName.value = units().find((unit) => unit.id === id)?.name || "";
      el.unitForm.hidden = false; feedback(""); el.unitName.focus();
    }
    el.nav.addEventListener("click", (event) => {
      const button = event.target.closest("button"); if (!button) return;
      if (button.dataset.libraryView !== undefined) {
        void navigate(async () => {
          state.view = button.dataset.libraryView; state.mobile = "library"; el.list.scrollTop = 0; render();
        });
      }
      if (button.dataset.unitRename) {
        const menu = button.closest("details"); if (menu) menu.open = false;
        showUnitForm(button.dataset.unitRename);
      }
      if (button.dataset.unitDelete) {
        const menu = button.closest("details"); if (menu) menu.open = false;
        void (async () => {
          const unit = units().find((unit) => unit.id === button.dataset.unitDelete);
          if (!unit || !confirm(`Lerndeck „${unit.name}“ entfernen? Die Sets bleiben unter „Nicht eingeordnet“ erhalten.`)) return;
          try {
            const result = await request(`/api/teacher/units/${encodeURIComponent(unit.id)}`, { method: "DELETE" });
            config.unitCommitted(result.unit, true);
            await refreshAfterCommit("Lerndeck entfernt. Die Bibliothek konnte gerade nicht aktualisiert werden.");
            refreshEditorUnit(); remember(); writeUrl();
          }
          catch (error) { showError(error); }
        })();
      }
    });
    el.list.addEventListener("click", (event) => {
      const row = event.target.closest("[data-open-set]"); if (row) void selectSet(row.dataset.openSet);
    });
    el.search.addEventListener("input", () => { state.search = el.search.value; render(); remember(); });
    el.owner.addEventListener("change", () => {
      const owner = el.owner.value;
      void navigate(async () => { state.owner = owner; state.view = "all"; state.selected = ""; state.search = "";
        state.mobile = "library"; config.hideEditor(); el.unitForm.hidden = true; render(); }).finally(() => { el.owner.value = state.owner; });
    });
    el.newUnit.addEventListener("click", () => showUnitForm());
    el.unitCancel.addEventListener("click", () => { el.unitForm.hidden = true; feedback(""); });
    el.unitForm.addEventListener("submit", (event) => {
      event.preventDefault();
      void (async () => {
        const button = el.unitForm.querySelector('[type="submit"]'); button.disabled = true;
        try {
          const path = state.editUnit ? `/api/teacher/units/${encodeURIComponent(state.editUnit)}` : "/api/teacher/units";
          const result = await request(path, { method: state.editUnit ? "PUT" : "POST", body: { name: el.unitName.value } });
          config.unitCommitted(result.unit);
          el.unitForm.hidden = true; feedback("");
          await refreshAfterCommit("Lerndeck gespeichert. Die Bibliothek konnte gerade nicht aktualisiert werden.");
        } catch (error) { showError(error); } finally { button.disabled = false; }
      })();
    });
    el.unitSelect.addEventListener("change", () => {
      const unitId = el.unitSelect.value; state.movingUnit = true; el.unitSelect.disabled = true;
      void (async () => {
        try {
          await config.moveEditor(unitId); config.editorError("");
          await refreshAfterCommit("Zuordnung gespeichert. Die Bibliothek konnte gerade nicht aktualisiert werden.", true);
          refreshEditorUnit(); remember();
        }
        catch (error) {
          if (error.requiresAuth) showError(error);
          else config.editorError(error.name === "TypeError" ? "Zuordnung konnte nicht gespeichert werden. Bitte erneut versuchen." : error.message);
          refreshEditorUnit();
        }
        finally { state.movingUnit = false; refreshEditorUnit(); }
      })();
    });
    for (const surface of [el.units, el.list, el.editor]) surface.addEventListener("scroll", remember, { passive: true });
    document.addEventListener("visibilitychange", remember);
    return {
      render, remember, refreshEditorUnit, currentUnit, owner: () => state.owner,
      reset() { state.loaded = false; state.selected = ""; state.intent += 1; },
      async restore() {
        const selected = config.data().sets.find((set) => set.id === state.selected && set.ownerTeacherId === state.owner);
        if (selected) {
          if (await config.openSet(selected)) {
            el.editor.scrollTop = state.restored?.editorScroll || 0;
            el.list.scrollTop = state.restored?.libraryScroll || 0;
            el.units.scrollTop = state.restored?.unitsScroll || 0;
          }
        } else { state.selected = ""; state.mobile = "library"; }
        render(); writeUrl();
      },
      markEditor(id) { state.selected = id; state.mobile = "editor"; render(); remember(); writeUrl(); },
      async newSet() { if (el.newSet.disabled) return; el.newSet.disabled = true; try { await navigate(async () => { if (await config.newSet()) { state.mobile = "editor"; render(); } }); } finally { el.newSet.disabled = false; } },
      showLibrary() { state.mobile = "library"; applyMobile(); remember(); },
    };
  }
  return { create };
})();

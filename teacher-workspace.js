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
      unitCancel: byId("workspace-unit-cancel"), editor: byId("workspace-editor"),
      breadcrumb: byId("workspace-breadcrumb"),
    };
    const state = { owner: "", view: "all", selected: "", search: "", mobile: "library", editUnit: "", loaded: false, intent: 0, restored: null, organizing: false, organizationPromise: null, drag: null, renderPending: false, suppressClickUntil: 0, suppressClickTarget: "", navMarkup: "" };
    const unitMenu = document.createElement("div");
    unitMenu.className = "workspace-unit-menu"; unitMenu.hidden = true;
    unitMenu.setAttribute("role", "menu");
    unitMenu.innerHTML = '<button type="button" role="menuitem" tabindex="-1" data-unit-rename="">Umbenennen</button><button type="button" role="menuitem" tabindex="-1" data-unit-delete="">Entfernen</button>';
    document.body.append(unitMenu);
    let unitMenuSource = null, unitHold = null;
    function closeUnitMenu(restoreFocus = false) {
      if (!unitMenuSource) return;
      const source = unitMenuSource; unitMenuSource = null;
      source.setAttribute("aria-expanded", "false");
      window.LerndeckUiMotion.hidePopover(unitMenu);
      if (restoreFocus && source.isConnected) source.focus({ preventScroll: true });
    }
    function cancelUnitHold() {
      if (unitHold) clearTimeout(unitHold.timer);
      unitHold = null;
      if (state.suppressClickUntil === Infinity) state.suppressClickUntil = Date.now() + 350;
    }
    function openUnitMenu(source, x, y) {
      const id = source?.dataset.libraryView;
      const unit = units().find((entry) => entry.id === id);
      if (!unit || !ownLibrary() || state.drag || state.organizing) return;
      config.closeMenus();
      cancelUnitHold(); closeUnitMenu(); unitMenuSource = source;
      source.setAttribute("aria-expanded", "true");
      unitMenu.setAttribute("aria-label", `Lerndeck ${unit.name} verwalten`);
      unitMenu.querySelector("[data-unit-rename]").dataset.unitRename = id;
      unitMenu.querySelector("[data-unit-delete]").dataset.unitDelete = id;
      window.LerndeckUiMotion.revealPopover(unitMenu);
      const anchor = source.getBoundingClientRect();
      unitMenu.style.left = `${Math.max(8, Math.min(x ?? anchor.left, innerWidth - unitMenu.offsetWidth - 8))}px`;
      unitMenu.style.top = `${Math.max(8, Math.min(y ?? anchor.bottom, innerHeight - unitMenu.offsetHeight - 8))}px`;
      unitMenu.querySelector("button").focus({ preventScroll: true });
    }
    el.nav.addEventListener("contextmenu", (event) => {
      const source = event.target.closest("[data-library-view]");
      if (!ownLibrary() || !units().some((unit) => unit.id === source?.dataset.libraryView)) return;
      event.preventDefault(); openUnitMenu(source, event.clientX, event.clientY);
    });
    el.nav.addEventListener("keydown", (event) => {
      if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;
      const source = event.target.closest("[data-library-view]");
      if (!ownLibrary() || !units().some((unit) => unit.id === source?.dataset.libraryView)) return;
      event.preventDefault(); openUnitMenu(source);
    });
    // Long press keeps the same actions available on touch, away from the drag grip.
    el.nav.addEventListener("pointerdown", (event) => {
      cancelUnitHold();
      if (event.pointerType !== "touch" || event.target.closest(".workspace-drag-handle")) return;
      const source = event.target.closest("[data-library-view]");
      if (!ownLibrary() || !units().some((unit) => unit.id === source?.dataset.libraryView)) return;
      unitHold = { x: event.clientX, y: event.clientY, timer: setTimeout(() => {
        openUnitMenu(source, event.clientX, event.clientY);
        state.suppressClickTarget = `units:${source.dataset.libraryView}`;
        state.suppressClickUntil = Infinity;
      }, 500) };
    });
    document.addEventListener("pointermove", (event) => {
      if (unitHold && Math.hypot(event.clientX - unitHold.x, event.clientY - unitHold.y) > 8) cancelUnitHold();
    });
    for (const type of ["pointerup", "pointercancel"]) document.addEventListener(type, cancelUnitHold);
    // Touch's compatibility mousedown must not return focus to the held row and dismiss its menu.
    document.addEventListener("mousedown", (event) => {
      if (unitMenuSource && Date.now() < state.suppressClickUntil
        && event.target.closest("[data-library-view]") === unitMenuSource) event.preventDefault();
    }, true);
    document.addEventListener("pointerdown", (event) => { if (!unitMenu.contains(event.target)) closeUnitMenu(); });
    document.addEventListener("focusin", (event) => { if (!unitMenu.contains(event.target)) closeUnitMenu(); });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && unitMenuSource) { event.preventDefault(); closeUnitMenu(true); }
    });
    document.addEventListener("scroll", () => { cancelUnitHold(); closeUnitMenu(); }, true);
    window.addEventListener("resize", () => { cancelUnitHold(); closeUnitMenu(); });
    unitMenu.addEventListener("keydown", (event) => {
      if (event.key === "Tab") { closeUnitMenu(true); return; }
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const items = [...unitMenu.querySelectorAll("button")];
      const at = items.indexOf(document.activeElement);
      items[event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
        : (at + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length].focus();
    });
    const key = () => `lerndeck-teacher-workspace-v1:${config.data().teacher?.id || ""}`;
    const ownLibrary = () => state.owner === config.data().teacher?.id;
    const units = () => config.data().units.filter((unit) => unit.ownerTeacherId === state.owner).sort((a, b) => a.libraryOrder - b.libraryOrder);
    const sets = () => config.data().sets.filter((set) => set.ownerTeacherId === state.owner).sort((a, b) => a.libraryOrder - b.libraryOrder);
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
    async function refreshAfterCommit(message) {
      try { await config.reload(); }
      catch (error) {
        if (error.requiresAuth) showError(error);
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
      closeUnitMenu(); cancelUnitHold();
      const intent = ++state.intent;
      if (state.organizationPromise) await state.organizationPromise;
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
      if (state.drag) { state.renderPending = true; return; }
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
      const handle = '<img class="workspace-drag-handle" src="./assets/icons/grip-vertical.svg" alt="" draggable="false" />';
      const navButton = (view, text) => `<button type="button" class="workspace-nav-button" data-library-view="${escape(view)}" ${ownLibrary() && !labels[view] ? 'draggable="true" aria-haspopup="menu" aria-expanded="false" aria-keyshortcuts="Shift+F10 Alt+ArrowUp Alt+ArrowDown" aria-description="Rechtsklick, langes Drücken oder Umschalt und F10 für Optionen. Zum Sortieren ziehen oder Alt und Pfeil hoch oder runter verwenden."' : ''} aria-pressed="${state.view === view}">${ownLibrary() && !labels[view] ? handle : ''}<span>${escape(text)}</span><span class="workspace-count">${count(view)}</span></button>`;
      const navMarkup = navButton("all", labels.all)
        + '<p class="workspace-nav-caption">Lerndecks</p>'
        + units().map((unit) => `<div class="workspace-unit-row">${navButton(unit.id, unit.name)}</div>`).join("")
        + navButton("unfiled", labels.unfiled);
      if (navMarkup !== state.navMarkup) {
        closeUnitMenu(); cancelUnitHold();
        el.nav.innerHTML = navMarkup;
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
        const content = document.createElement("span"); content.className = "workspace-set-content"; content.append(title, meta);
        if (ownLibrary()) {
          row.draggable = true;
          row.setAttribute("aria-keyshortcuts", "Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight");
          row.setAttribute("aria-description", "Zum Sortieren oder in ein Lerndeck ziehen. Alt und Pfeil hoch oder runter sortiert; Alt und Pfeil links oder rechts wechselt das Lerndeck.");
          const grip = document.createElement("img"); grip.className = "workspace-drag-handle";
          grip.src = "./assets/icons/grip-vertical.svg"; grip.alt = ""; grip.draggable = false; row.append(grip);
        }
        row.append(content); el.list.append(row);
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
      const button = event.target.closest("button"); if (!button || (Date.now() < state.suppressClickUntil && state.suppressClickTarget === `units:${button.dataset.libraryView}`)) return;
      if (button.dataset.libraryView !== undefined) {
        void navigate(async () => {
          state.view = button.dataset.libraryView; state.mobile = "library"; el.list.scrollTop = 0; render();
        });
      }
    });
    unitMenu.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button || !unitMenuSource || !ownLibrary()) return;
      closeUnitMenu(true);
      if (button.dataset.unitRename) {
        showUnitForm(button.dataset.unitRename);
      }
      if (button.dataset.unitDelete) {
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
      const row = event.target.closest("[data-open-set]"); if (row && !(Date.now() < state.suppressClickUntil && state.suppressClickTarget === `sets:${row.dataset.openSet}`)) void selectSet(row.dataset.openSet);
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
    async function organize(change, focusId = "") {
      if (state.organizing || !ownLibrary()) return;
      state.organizing = true; feedback(""); el.root.setAttribute("aria-busy", "true");
      const owner = state.owner;
      const operation = (async () => {
        try {
          await config.organize(change);
          if (state.owner !== owner) return;
          render(); remember(); writeUrl();
          if (focusId) (el.list.querySelector(`[data-open-set="${CSS.escape(focusId)}"]`)
            || el.nav.querySelector(`[data-library-view="${CSS.escape(focusId)}"]`))?.focus({ preventScroll: true });
          feedback(change.kind === "assignment" ? "Zuordnung gespeichert" : "Reihenfolge gespeichert");
        } catch (error) {
          if (state.owner === owner) showError(error.name === "TypeError" ? new Error("Änderung konnte nicht gespeichert werden. Bitte erneut versuchen.") : error);
        } finally { state.organizing = false; el.root.removeAttribute("aria-busy"); }
      })();
      state.organizationPromise = operation;
      try { await operation; } finally { if (state.organizationPromise === operation) state.organizationPromise = null; }
    }
    function dragSource(target) {
      const row = target.closest("[data-open-set], [data-library-view]");
      if (!row || !ownLibrary() || state.organizing) return null;
      if (row.dataset.openSet) return { kind: "sets", id: row.dataset.openSet, owner: state.owner, row };
      if (!labels[row.dataset.libraryView]) return { kind: "units", id: row.dataset.libraryView, owner: state.owner, row };
      return null;
    }
    function dragLabel(source) {
      return source.row.querySelector(".workspace-set-title, span")?.textContent || "Lernset";
    }
    function clearDropHints() {
      for (const node of el.root.querySelectorAll("[data-drop-position]")) delete node.dataset.dropPosition;
    }
    function finishDrag() {
      state.drag?.row.classList.remove("is-dragging");
      state.drag = null; clearDropHints();
      if (state.renderPending) { state.renderPending = false; render(); }
    }
    function dropTarget(target, clientY) {
      const drag = state.drag;
      if (!drag || !ownLibrary() || drag.owner !== state.owner) return null;
      const nav = target.closest("[data-library-view]");
      if (nav) {
        const view = nav.dataset.libraryView;
        if (drag.kind === "sets" && view !== "all") return { node: nav, position: "inside", change: { kind: "assignment", id: drag.id, unitId: view === "unfiled" ? "" : view } };
        if (drag.kind === "units" && !labels[view] && view !== drag.id) return insertion(nav, "units", view, clientY);
        return null;
      }
      if (drag.kind !== "sets") return null;
      const row = target.closest("[data-open-set]");
      if (row && row.dataset.openSet !== drag.id) return insertion(row, "sets", row.dataset.openSet, clientY);
      if (target.closest("#teacher-set-list, #teacher-empty-state") && !row) return { node: el.list, position: "after", change: { kind: "sets", id: drag.id, beforeId: null } };
      return null;
    }
    function insertion(node, kind, targetId, clientY) {
      const after = clientY >= node.getBoundingClientRect().top + node.offsetHeight / 2;
      const ids = [...(kind === "sets" ? el.list.querySelectorAll("[data-open-set]") : el.nav.querySelectorAll('[draggable="true"]'))]
        .map((row) => kind === "sets" ? row.dataset.openSet : row.dataset.libraryView).filter((id) => id !== state.drag.id);
      const beforeId = after ? ids[ids.indexOf(targetId) + 1] || null : targetId;
      return { node, position: after ? "after" : "before", change: { kind, id: state.drag.id, beforeId } };
    }
    function showDrop(target, clientY) {
      clearDropHints(); const drop = dropTarget(target, clientY);
      if (drop) drop.node.dataset.dropPosition = drop.position;
      const surface = target.closest("#teacher-set-list, #workspace-units");
      if (surface) {
        const rect = surface.getBoundingClientRect();
        if (clientY < rect.top + 36) surface.scrollTop -= 16;
        else if (clientY > rect.bottom - 36) surface.scrollTop += 16;
      }
      return drop;
    }
    function suppressDragClick() {
      if (!state.drag) return;
      state.suppressClickTarget = `${state.drag.kind}:${state.drag.id}`;
      state.suppressClickUntil = Date.now() + 350;
    }
    function commitDrop(drop) {
      suppressDragClick();
      finishDrag();
      if (drop) void organize(drop.change);
    }
    el.root.addEventListener("dragstart", (event) => {
      const source = dragSource(event.target);
      if (!source) { event.preventDefault(); return; }
      closeUnitMenu(); cancelUnitHold();
      state.drag = source; source.row.classList.add("is-dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("application/x-lerndeck-library", source.id);
      event.dataTransfer.setData("text/plain", dragLabel(source));
    });
    el.root.addEventListener("dragover", (event) => {
      if (showDrop(event.target, event.clientY)) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }
    });
    el.root.addEventListener("drop", (event) => {
      const drop = dropTarget(event.target, event.clientY);
      if (state.drag) { event.preventDefault(); commitDrop(drop); }
    });
    el.root.addEventListener("dragend", () => { suppressDragClick(); finishDrag(); });
    el.root.addEventListener("dragleave", (event) => { if (!el.root.contains(event.relatedTarget)) clearDropHints(); });
    // Touch drags start on the grip; the rest of each row keeps native scrolling and clicking.
    let touch = null;
    el.root.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "touch" || !event.target.closest(".workspace-drag-handle")) return;
      const source = dragSource(event.target); if (!source) return;
      touch = { source, x: event.clientX, y: event.clientY, pointerId: event.pointerId, preview: null };
      event.target.setPointerCapture(event.pointerId);
    });
    el.root.addEventListener("pointermove", (event) => {
      if (!touch || touch.pointerId !== event.pointerId) return;
      if (!state.drag && Math.hypot(event.clientX - touch.x, event.clientY - touch.y) < 6) return;
      if (!state.drag) {
        state.drag = touch.source; state.drag.row.classList.add("is-dragging");
        touch.preview = document.createElement("div"); touch.preview.className = "workspace-drag-preview";
        touch.preview.textContent = dragLabel(state.drag); document.body.append(touch.preview);
      }
      touch.preview.style.transform = `translate(${event.clientX + 14}px, ${event.clientY + 14}px)`;
      const target = document.elementFromPoint(event.clientX, event.clientY);
      if (target) showDrop(target, event.clientY);
    });
    function endTouch(event) {
      if (!touch || touch.pointerId !== event.pointerId) return;
      const target = document.elementFromPoint(event.clientX, event.clientY);
      const drop = event.type === "pointerup" && target ? dropTarget(target, event.clientY) : null;
      touch.preview?.remove(); touch = null;
      if (state.drag) commitDrop(drop);
    }
    el.root.addEventListener("pointerup", endTouch);
    el.root.addEventListener("pointercancel", endTouch);
    el.root.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && state.drag) { touch?.preview?.remove(); touch = null; finishDrag(); }
      if (!event.altKey || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
      const source = dragSource(event.target); if (!source) return;
      event.preventDefault();
      const down = event.key === "ArrowDown", up = event.key === "ArrowUp";
      if (down || up) {
        const ids = [...(source.kind === "sets" ? el.list.querySelectorAll("[data-open-set]") : el.nav.querySelectorAll('[draggable="true"]'))]
          .map((row) => source.kind === "sets" ? row.dataset.openSet : row.dataset.libraryView);
        const at = ids.indexOf(source.id);
        if ((up && at === 0) || (down && at === ids.length - 1)) return;
        void organize({ kind: source.kind, id: source.id, beforeId: up ? ids[at - 1] : ids[at + 2] || null }, source.id);
      } else if (source.kind === "sets") {
        const folders = ["", ...units().map((unit) => unit.id)];
        const current = sets().find((set) => set.id === source.id)?.unitId || "";
        const next = folders.indexOf(current) + (event.key === "ArrowRight" ? 1 : -1);
        if (next >= 0 && next < folders.length) void organize({ kind: "assignment", id: source.id, unitId: folders[next] }, source.id);
      }
    });
    for (const surface of [el.units, el.list, el.editor]) surface.addEventListener("scroll", remember, { passive: true });
    document.addEventListener("visibilitychange", remember);
    return {
      render, remember, refreshEditorUnit, currentUnit, owner: () => state.owner,
      reset() { closeUnitMenu(); cancelUnitHold(); touch?.preview?.remove(); touch = null; finishDrag(); state.loaded = false; state.selected = ""; state.intent += 1; },
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

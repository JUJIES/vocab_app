(() => {
  const APP_ID = "lerndeck";
  const active = window.self !== window.top
    && new URLSearchParams(window.location.search).get("embed") === "tafelraum";

  function contentZoomAction(event) {
    if ((!event.metaKey && !event.ctrlKey) || event.altKey || event.isComposing) return "";
    if (event.key === "+" || event.key === "=" || event.code === "BracketRight" || event.code === "NumpadAdd") return "increase";
    if (event.key === "-" || event.key === "_") return "decrease";
    if (event.key === "0") return "reset";
    return "";
  }

  if (active) {
    installTafelraumBridge();
    window.addEventListener("keydown", (event) => {
      const action = contentZoomAction(event);
      if (!action) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      window.parent.postMessage({
        type: "tafelraum:app-content-zoom",
        appId: APP_ID,
        action,
      }, "*");
    }, true);
  }

function installTafelraumBridge() {
  if (!active) return;
  const interactiveSelector = [
    "a[href]", "button", "input", "select", "summary", "textarea",
    "[contenteditable='true']", "[draggable='true']", "[data-tafelraum-interactive]",
    "[role='button']", "[role='checkbox']", "[role='combobox']", "[role='link']",
    "[role='listbox']", "[role='option']", "[role='radio']", "[role='slider']",
    "[role='spinbutton']", "[role='switch']", "[role='tab']",
  ].join(",");
  let backgroundPanEnabled = false;
  let materialMoveEnabled = false;
  let movingMaterial = false;
  let panPointerId = null;
  let panTarget = null;
  let lastPoint = { clientX: 0, clientY: 0 };
  const pointerPoint = event => ({clientX:event.clientX,clientY:event.clientY,screenX:event.screenX,screenY:event.screenY});
  const contentOwnsPointer = (target) => target instanceof Element && Boolean(target.closest(interactiveSelector));
  const canScrollToward = (target, deltaX, deltaY) => {
    const vertical = Math.abs(deltaY) >= Math.abs(deltaX);
    const delta = vertical ? deltaY : deltaX;
    if (delta === 0) return false;
    const root = document.scrollingElement;
    for (let node = target instanceof Element ? target : null; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      const overflow = vertical ? style.overflowY : style.overflowX;
      const viewport = vertical ? node.clientHeight : node.clientWidth;
      const extent = vertical ? node.scrollHeight : node.scrollWidth;
      const position = vertical ? node.scrollTop : node.scrollLeft;
      const scrollable = (node === root || /^(auto|scroll|overlay)$/.test(overflow)) && extent > viewport + 1;
      if (scrollable && (delta < 0 ? position > 0.5 : position < extent - viewport - 0.5)) return true;
    }
    return false;
  };
  const textOwnsPoint=event=>{
    // Hit the rendered character, not the bounding box of an entire paragraph.
    const caret=document.caretPositionFromPoint?.(event.clientX,event.clientY);
    const range=caret?document.createRange():document.caretRangeFromPoint?.(event.clientX,event.clientY);
    if(caret)range.setStart(caret.offsetNode,caret.offset);
    if(!range||range.startContainer.nodeType!==Node.TEXT_NODE)return false;
    const node=range.startContainer,offset=range.startOffset;
    if(getComputedStyle(node.parentElement).userSelect==="none")return false;
    for(const index of [offset-1,offset]){
      if(index<0||index>=node.textContent.length||/[\r\n\t]/.test(node.textContent[index]))continue;
      const character=document.createRange();character.setStart(node,index);character.setEnd(node,index+1);
      for(const rect of character.getClientRects()){
        if(event.clientX>=rect.left&&event.clientX<=rect.right&&event.clientY>=rect.top&&event.clientY<=rect.bottom)return true;
      }
    }
    return false;
  };
  const scrollbarOwnsPoint=event=>{
    for(let node=event.target instanceof Element?event.target:null;node;node=node.parentElement){
      const rect=node.getBoundingClientRect();
      if(node===document.documentElement){
        if(event.clientX>=node.clientWidth||event.clientY>=node.clientHeight)return true;
      }else if((node.scrollHeight>node.clientHeight&&event.clientX>=rect.left+node.clientLeft+node.clientWidth)
        ||(node.scrollWidth>node.clientWidth&&event.clientY>=rect.top+node.clientTop+node.clientHeight))return true;
    }
    return false;
  };
  const materialContentOwnsPointer=event=>contentOwnsPointer(event.target)||textOwnsPoint(event)||scrollbarOwnsPoint(event)
    ||event.target instanceof Element&&Boolean(event.target.closest("canvas,video,audio,[role='textbox'],[contenteditable]:not([contenteditable='false'])"))
    ||event.target instanceof Element&&getComputedStyle(event.target).cursor==="pointer";

  const postPan = (phase, point = lastPoint) => window.parent.postMessage({
    type: movingMaterial ? "tafelraum:interactive-material-move" : "tafelraum:interactive-pan",
    phase,
    pointerId: panPointerId,
    clientX: point.clientX,
    clientY: point.clientY,
    ...(movingMaterial ? {screenX:point.screenX,screenY:point.screenY} : {}),
  }, "*");
  const finishPan = (phase, event) => {
    if (panPointerId === null || (event && event.pointerId !== panPointerId)) return;
    if (event) {
      lastPoint = pointerPoint(event);
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    postPan(phase);
    const target = panTarget, id = panPointerId;
    panPointerId = null; panTarget = null;
    if (target?.hasPointerCapture?.(id)) target.releasePointerCapture(id);
  };
  window.addEventListener("message", (event) => {
    if (event.source !== window.parent) return;
    if (event.data?.type === "tafelraum:interactive-material-move-mode") {
      const enabled = event.data.enabled === true;
      if (materialMoveEnabled && !enabled && movingMaterial) finishPan("cancel");
      materialMoveEnabled = enabled;
      return;
    }
    if (event.data?.type !== "tafelraum:interactive-pan-mode") return;
    backgroundPanEnabled = event.data.enabled === true;
    if (!backgroundPanEnabled && !materialMoveEnabled) finishPan("cancel");
  });
  window.addEventListener("pointerdown", (event) => {
    if ((!backgroundPanEnabled && !materialMoveEnabled) || panPointerId !== null || !event.isPrimary || event.button !== 0 || contentOwnsPointer(event.target)) return;
    movingMaterial = materialMoveEnabled && !backgroundPanEnabled;
    if (movingMaterial && materialContentOwnsPointer(event)) return;
    panPointerId = event.pointerId;
    panTarget = event.target instanceof Element ? event.target : document.documentElement;
    lastPoint = pointerPoint(event);
    panTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
    event.stopImmediatePropagation();
    postPan("start");
  }, { capture: true });
  window.addEventListener("pointermove", (event) => {
    if (event.pointerId !== panPointerId) return;
    lastPoint = pointerPoint(event);
    event.preventDefault();
    event.stopImmediatePropagation();
    postPan("move");
  }, { capture: true });
  window.addEventListener("pointerup", (event) => finishPan("end", event), { capture: true });
  window.addEventListener("pointercancel", (event) => finishPan("cancel", event), { capture: true });
  window.addEventListener("lostpointercapture", (event) => finishPan("cancel", event), {capture:true});
  window.addEventListener("blur", () => finishPan("cancel"));
  window.addEventListener("wheel", (event) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      window.parent.postMessage({
        type: "tafelraum:interactive-zoom",
        clientX: event.clientX,
        clientY: event.clientY,
        deltaMode: event.deltaMode,
        deltaX: event.deltaX,
        deltaY: event.deltaY,
      }, "*");
      return;
    }
    if (canScrollToward(event.target, event.deltaX, event.deltaY)) return;
    event.preventDefault();
    window.parent.postMessage({
      type: "tafelraum:interactive-wheel-pan",
      clientX: event.clientX,
      clientY: event.clientY,
      deltaMode: event.deltaMode,
      deltaX: event.deltaX,
      deltaY: event.deltaY,
      shiftKey: event.shiftKey,
    }, "*");
  }, { capture: true, passive: false });
}


  window.LerndeckTafelraumEmbed = Object.freeze({
    active,
    ready() {
      if (!active) return;
      window.parent.postMessage({ type: "tafelraum:app-ready", appId: APP_ID }, "*");
    },
  });
})();

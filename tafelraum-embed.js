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


  // Capture only while an explicitly joined local Room renderer needs this instance.
  // No provider state, passwords, cookies or session credentials are transferred.
  // The Room replica has no real focus or native mouse. These inert DOM marks
  // travel through the existing bounded visual stream, never a second input path.
  function installRoomCursor() {
    const pointer=document.createElement('div'),caret=document.createElement('div'),measure=document.createElement('div');
    for(const mark of [pointer,caret,measure]){mark.setAttribute('aria-hidden','true');mark.style.pointerEvents='none';}
    pointer.style.cssText='position:fixed;z-index:2147483000;box-sizing:border-box;width:18px;height:18px;border:2px solid white;border-radius:50%;box-shadow:0 0 0 2px #16324f;background:#2876c955;pointer-events:none;display:none';
    caret.style.cssText='position:fixed;z-index:2147483000;width:3px;background:#1864c0;box-shadow:0 0 0 1px white;pointer-events:none;display:none';
    pointer.dataset.roomPointer='';caret.dataset.roomCaret='';measure.dataset.roomMeasure='';
    measure.style.cssText='position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;overflow:hidden';
    document.body.append(pointer,caret,measure);
    let frame=0,last=0,point=null,observed=null;
    const observer=new MutationObserver(()=>schedule());
    const properties=['boxSizing','width','fontFamily','fontSize','fontWeight','fontStyle','fontVariant','lineHeight','letterSpacing','wordSpacing','textTransform','textIndent','textAlign','direction','tabSize','paddingTop','paddingRight','paddingBottom','paddingLeft','borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth','borderStyle','wordBreak'];
    function update() {
      const now=performance.now();
      if(now-last<50){frame=requestAnimationFrame(update);return;}
      frame=0;last=now;
      if(point){pointer.style.left=`${point[0]-9}px`;pointer.style.top=`${point[1]-9}px`;pointer.style.display='block';}
      const input=document.activeElement;
      // Only the learner's Translation answer, never account/secret fields.
      if(!(input instanceof HTMLTextAreaElement)||input.id!=='sentence-answer'||input.disabled||input.readOnly||!input.isConnected){caret.style.display='none';observer.disconnect();observed=null;return;}
      if(observed!==input){observer.disconnect();observer.observe(input,{attributes:true,attributeFilter:['disabled','readonly','hidden']});observed=input;}
      const rect=input.getBoundingClientRect(),css=getComputedStyle(input);
      if(!rect.width||!rect.height||css.visibility==='hidden'){caret.style.display='none';return;}
      for(const property of properties)measure.style[property]=css[property];
      measure.style.height='auto';measure.style.whiteSpace='pre-wrap';measure.style.overflowWrap='break-word';
      const position=input.selectionEnd??input.value.length,span=document.createElement('span');
      measure.replaceChildren(document.createTextNode(input.value.slice(0,position)));
      span.textContent=input.value.slice(position)||'.';measure.append(span);
      const at=span.getClientRects()[0]||span.getBoundingClientRect(),base=measure.getBoundingClientRect();
      const x=rect.left+at.left-base.left-input.scrollLeft,y=rect.top+at.top-base.top-input.scrollTop;
      const height=parseFloat(css.lineHeight)||parseFloat(css.fontSize)*1.2;
      const visible=x>=rect.left&&x<=rect.right&&y>=rect.top&&y+height<=rect.bottom;
      Object.assign(caret.style,{left:`${x}px`,top:`${y}px`,height:`${height}px`,display:visible?'block':'none'});
    }
    function schedule(){if(!frame)frame=requestAnimationFrame(update);}
    function move(event){
      if(event.target instanceof Element&&event.target.closest("input[type='password'],input[type='hidden']")){leave();return;}
      point=[event.clientX,event.clientY];
      schedule();
    }
    function leave(){point=null;pointer.style.display='none';}
    const events=['selectionchange','focusin','focusout','input','keyup','click','scroll'];
    for(const name of events)document.addEventListener(name,schedule,true);
    document.addEventListener('pointermove',move,true);document.documentElement.addEventListener('pointerleave',leave);
    window.addEventListener('resize',schedule);schedule();
    return()=>{cancelAnimationFrame(frame);observer.disconnect();for(const name of events)document.removeEventListener(name,schedule,true);document.removeEventListener('pointermove',move,true);document.documentElement.removeEventListener('pointerleave',leave);window.removeEventListener('resize',schedule);pointer.remove();caret.remove();measure.remove();};
  }
  let captureStop=null,cursorStop=null,captureRequest=0,captureTimer=null,recorderPromise=null,epoch=0;
  const loadRecorder=()=>recorderPromise??(recorderPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src='/vendor/tafelraum-view-2.2.0.js';
    script.onload=()=>resolve(window.rrweb.record);script.onerror=()=>{recorderPromise=null;script.remove();reject(new Error('Room-Ausgabe nicht verfügbar'));};
    document.head.append(script);
  }));
  const stopCapture=()=>{captureStop?.();captureStop=null;cursorStop?.();cursorStop=null;clearInterval(captureTimer);captureTimer=null;};
  if(active)window.addEventListener('message',async event=>{
    const m=event.data;
    if(event.source!==window.parent||m?.type!=='tafelraum:app-view-mode'||m.protocol!=='rrweb-2.2-v1'||m.appId!==APP_ID
      ||typeof m.token!=='string'||!/^[a-f0-9-]{36}$/.test(m.token))return;
    const request=++captureRequest;stopCapture();if(m.enabled!==true)return;
    let sequence=0,batch=[],bytes=0,failed=false,phase="recorder-load";
    const send=(error,reason)=>{
      if(request!==captureRequest)return;
      const events=error?[]:batch;batch=[];bytes=0;
      window.parent.postMessage({type:'tafelraum:app-view',appId:APP_ID,protocol:'rrweb-2.2-v1',token:m.token,epoch,sequence:++sequence,events,...(error?{error:true,reason}:{})},'*');
      if(error){failed=true;stopCapture();}
    };
    try{
      const record=await loadRecorder();if(request!==captureRequest)return;
      phase="recording";epoch=Math.max(epoch+1,Date.now());
      cursorStop=installRoomCursor();
      captureStop=record({
        emit:event=>{
          if(request!==captureRequest||failed)return;
          const size=new TextEncoder().encode(JSON.stringify(event)).byteLength;
          if(size>2*1024*1024){send(true,"snapshot-too-large");return;}
          if(bytes+size>2*1024*1024||batch.length>=800)send(false);
          batch.push(event);bytes+=size;
        },
        // Keep provider image URLs: embedding all hidden/preloaded image pixels exceeds the local packet budget.
        checkoutEveryNms:10000,inlineStylesheet:true,inlineImages:false,
        maskInputOptions:{password:true,hidden:true},
        blockSelector:"input[type='password'],input[type='hidden'],[data-room-measure]",
        recordCanvas:false,recordCrossOriginIframes:false,
        slimDOMOptions:{script:true,comment:true,headMetaDescKeywords:true,headMetaSocial:true,headMetaRobots:true,headMetaHttpEquiv:true,headMetaAuthorship:true,headMetaVerification:true},
        sampling:{mousemove:false,mouseInteraction:false,scroll:50,input:'all',mediaInteraction:false},
      });
      if(failed)stopCapture();else captureTimer=setInterval(()=>send(false),100);
    }catch(error){send(true,phase+":"+(["TypeError","SecurityError","NotSupportedError"].includes(error?.name)?error.name:"unavailable"));}
  });
  window.addEventListener('pagehide',()=>{captureRequest++;stopCapture();});

  window.LerndeckTafelraumEmbed = Object.freeze({
    active,
    ready() {
      if (!active) return;
      window.parent.postMessage({ type: "tafelraum:app-ready", appId: APP_ID }, "*");
    },
  });
})();

(()=>{'use strict';
const pages=new Set(["/bake-obrazcovaya.html","/bake-chelyuskina.html","/edit-obrazcovaya.html","/edit-chelyuskina.html","/index.html"]);
const owner=location.pathname==='/owner-app.html',studio=/\/vinyl-room-(?:hifi|download-visual-lab)\.html$/.test(location.pathname);
if(studio)document.documentElement.classList.add('peku-motion-studio');
const reduce=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const controls='button,summary,a[href],input[type="button"],input[type="submit"],input[type="reset"],[role="button"],[role="tab"],.note-card,.staff-tile,.inspiration-tile';
const ownControls='.quicklinks,.owner-bottom-nav,.mobile-jumps,.module,.admin-entry,.writeoffs-entry,.shift-admin-link,.shift-history-link,.shift-refresh,.market-row,.header-weather-chip,.quiet,.owner-editor-settings,[data-qr-preview],[data-qr-download],.report-fold>summary,.shift-finished-fold>summary,.qrh-group>summary,.install-help-details>summary,.inspiration-tiles';
const ownFolds='.report-fold,.shift-finished-fold,.qrh-group,.install-help-details,.quote-quicklink';
const pulses=new WeakMap(),folds=new WeakMap(),pressed=new WeakMap();let navigating=false;
function pulse(el){
 if(reduce()||studio||(owner&&el.closest('#privateArea')&&el.closest(ownControls))||typeof el.animate!=='function')return;
 pulses.get(el)?.cancel();pressed.set(el,performance.now());
 const a=el.animate([{scale:'1'},{scale:'.977',offset:.32},{scale:'1'}],{duration:300,easing:'cubic-bezier(.22,.72,.24,1)'});
 pulses.set(el,a);a.finished.catch(()=>{}).finally(()=>{if(pulses.get(el)===a)pulses.delete(el)});
}
function route(el,e){
 if(el.tagName!=='A'||el.hasAttribute('download')||el.hasAttribute('data-no-motion')||el.hasAttribute('onclick')||el.onclick||(el.target&&el.target!=='_self')||e.defaultPrevented)return null;
 try{const u=new URL(el.href,location.href);if(u.origin!==location.origin||!pages.has(u.pathname)||u.pathname===location.pathname)return null;return u}catch{return null}
}
function toggleFold(summary,e){
 const f=summary.parentElement;
 if(studio||!f?.matches('details:not([name])')||(owner&&f.matches(ownFolds))||e.target.closest('a,button,input,select,textarea')||e.defaultPrevented||typeof f.animate!=='function'||summary.hasAttribute('onclick')||summary.onclick)return;
 e.preventDefault();
 const p=folds.get(f),opening=p?!p.opening:!f.open,from=f.getBoundingClientRect().height;
 if(p)p.a.cancel();
 const overflow=p?p.overflow:f.style.overflow;f.style.overflow=overflow;
 if(opening)f.open=true;
 const cs=getComputedStyle(f),ss=getComputedStyle(summary),to=opening?f.getBoundingClientRect().height:summary.getBoundingClientRect().height+parseFloat(cs.borderTopWidth||0)+parseFloat(cs.borderBottomWidth||0)+parseFloat(cs.paddingTop||0)+parseFloat(cs.paddingBottom||0)+parseFloat(ss.marginTop||0)+parseFloat(ss.marginBottom||0);
 f.style.overflow='hidden';
 const a=f.animate([{height:from+'px',boxSizing:'border-box'},{height:to+'px',boxSizing:'border-box'}],{duration:opening?440:320,easing:'cubic-bezier(.22,.72,.24,1)',fill:'both'});
 const state={a,opening,overflow};folds.set(f,state);
 a.finished.then(()=>{if(folds.get(f)!==state)return;if(!opening)f.open=false;f.style.overflow=overflow;folds.delete(f);a.cancel()}).catch(()=>{});
}
let arrival=false;try{arrival=sessionStorage.getItem('peku_motion_arrival')==='1';sessionStorage.removeItem('peku_motion_arrival')}catch{}
if(arrival&&!reduce()){
 if('onpagereveal' in window)window.addEventListener('pagereveal',e=>{if(!e.viewTransition)document.documentElement.classList.add('peku-motion-arrival')},{once:true});
 else document.documentElement.classList.add('peku-motion-arrival');
}
window.addEventListener('pageshow',e=>{navigating=false;if(e.persisted)document.documentElement.classList.remove('peku-motion-arrival')});
window.addEventListener('pointerdown',e=>{if(!e.isPrimary||e.button!==0||reduce())return;const el=e.target?.closest?.(controls);if(!el||el.matches(':disabled,[aria-disabled="true"]')||el.closest('[contenteditable="true"],[data-no-motion]'))return;pulse(el)},{passive:true});
window.addEventListener('click',e=>{
 if(reduce()||e.button>0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;
 const el=e.target?.closest?.(controls);if(!el||el.matches(':disabled,[aria-disabled="true"]')||el.closest('[contenteditable="true"],[data-no-motion]'))return;
 const u=route(el,e);
 if(u&&!studio){
  e.preventDefault();if(navigating)return;navigating=true;if(performance.now()-(pressed.get(el)||-1000)>350)pulse(el);
  setTimeout(()=>{try{sessionStorage.setItem('peku_motion_arrival','1')}catch{}location.assign(u.href);setTimeout(()=>{navigating=false},2000)},140);return;
 }
 if(performance.now()-(pressed.get(el)||-1000)>350)pulse(el);if(el.tagName==='SUMMARY')toggleFold(el,e);
});
/* Animate only explicitly identified panels, never ordinary live data refresh. */
if(!studio&&typeof MutationObserver==='function'){
 const selector='#editOverlay,#wheelOverlay,#editorModal,#backgroundPanel,#editorView,#listView,#importPanel,#readView,#form,#editPanel,#radarCalendar,#calendarPanel,#revenueArea';
 const seen=new WeakMap();
 function visible(el){return !el.hidden&&!el.classList.contains('hidden')&&getComputedStyle(el).display!=='none'}
 const nodes=[...document.querySelectorAll(selector)];
 for(const el of nodes)seen.set(el,visible(el));
 const observer=new MutationObserver(records=>{
  for(const el of new Set(records.map(r=>r.target))){
   const before=seen.get(el),after=visible(el);seen.set(el,after);
   if(before!==false||!after||reduce()||typeof el.animate!=='function')continue;
   const target=el.querySelector(':scope > .sheet,:scope > .dialog')||el;
   if(getComputedStyle(target).animationName!=='none')continue;
   target.animate([{opacity:0,translate:'0 5px'},{opacity:1,translate:'0 0'}],{duration:440,easing:'cubic-bezier(.22,.72,.24,1)'});
   /* The overlay and panel do not fade twice. Only the content is animated. */
  }
 });
 for(const el of nodes)observer.observe(el,{attributes:true,attributeFilter:['hidden','class','style']});
}
})();

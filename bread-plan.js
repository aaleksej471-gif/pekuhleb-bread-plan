(()=>{
'use strict';
const branch=document.body.dataset.branch;
const branchNames={obrazcovaya:'Образцовая',chelyuskina:'Челюскина'};
if(!branchNames[branch])return;
const breads=[
 'Цельнозерновой','Луковый','С семечками',
 'Багет','Ржаной','Чиабатта',
 'Фокачча','Фугас','Солодовый',
 'Тыквенный','Оливки + чеддер','Безглютеновый',
 'Багет с добавками','С чесноком'
];
const selected=new Set();
const editMode=document.body.dataset.edit==='owner';
const params=new URLSearchParams(location.search);
const workKey=params.get('k')||'';
if(editMode){
 const maskText=params.get('s')||'';
 if(/^[0-9a-z]{1,4}$/.test(maskText)){
  const mask=parseInt(maskText,36);
  if(mask>0&&mask<(1<<breads.length)){
   breads.forEach((name,index)=>{if(mask&(1<<index))selected.add(name)});
  }
 }
}
let submitting=false;
let sentSignature='';
const signature=()=>targetDate+'|'+[...selected].sort().join('|');
const $=id=>document.getElementById(id);
const todayInMoscow=()=>{
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(x=>[x.type,x.value]));
 return p.year+'-'+p.month+'-'+p.day;
};
const addDays=(iso,days)=>{
 const d=new Date(iso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);
 return d.toISOString().slice(0,10);
};
const moveMonth=(iso,step)=>{
 const [y,m]=iso.slice(0,7).split('-').map(Number);
 return new Date(Date.UTC(y,m-1+step,1)).toISOString().slice(0,10);
};
const prettyDate=iso=>new Intl.DateTimeFormat('ru-RU',{timeZone:'UTC',day:'numeric',month:'long',year:'numeric'}).format(new Date(iso+'T12:00:00Z'));
const prettyMonth=iso=>new Intl.DateTimeFormat('ru-RU',{timeZone:'UTC',month:'long',year:'numeric'}).format(new Date(iso+'T12:00:00Z'));
let targetDate=editMode&&/^\d{4}-\d{2}-\d{2}$/.test(params.get('d')||'')?params.get('d'):todayInMoscow();
let shownMonth=targetDate.slice(0,7)+'-01';
$('branchName').textContent=branchNames[branch];
$('modalBranch').textContent=branchNames[branch];
function syncDate(){
 $('targetDate').textContent=prettyDate(targetDate);
 $('modalDate').textContent='Дата выпечки · '+prettyDate(targetDate);
 $('dateTrigger').setAttribute('aria-label','Дата выпечки: '+prettyDate(targetDate)+'. Изменить дату');
}
const dateDialog=$('dateDialog');
function chooseDate(iso){
 if(iso<todayInMoscow())return;
 targetDate=iso;
 syncDate();
 update();
 dateDialog.close();
}
function drawCalendar(){
 const root=$('calendarGrid');root.replaceChildren();
 $('calendarMonth').textContent=prettyMonth(shownMonth);
 const prev=$('calendarPrev');
 prev.disabled=shownMonth.slice(0,7)<=todayInMoscow().slice(0,7);
 const [year,month]=shownMonth.split('-').map(Number);
 const weekdays=['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
 for(const wd of weekdays){
  const label=document.createElement('span');label.className='weekday';label.textContent=wd;root.append(label);
 }
 const offset=(new Date(Date.UTC(year,month-1,1)).getUTCDay()+6)%7;
 for(let i=0;i<offset;i++){const space=document.createElement('span');space.className='day-blank';root.append(space);}
 const total=new Date(Date.UTC(year,month,0)).getUTCDate();
 const today=todayInMoscow();
 for(let day=1;day<=total;day++){
  const iso=shownMonth.slice(0,7)+'-'+String(day).padStart(2,'0');
  const button=document.createElement('button');button.type='button';button.className='day-btn';button.textContent=String(day);
  button.setAttribute('aria-label',prettyDate(iso));
  if(iso===today)button.classList.add('today');
  if(iso===targetDate){button.classList.add('chosen');button.setAttribute('aria-pressed','true');}
  if(iso<today)button.disabled=true;
  button.addEventListener('click',()=>chooseDate(iso));
  root.append(button);
 }
}
$('dateTrigger').addEventListener('click',()=>{
 shownMonth=targetDate.slice(0,7)+'-01';
 drawCalendar();
 dateDialog.showModal();
 $('dateClose').focus({preventScroll:true});
});
$('dateClose').addEventListener('click',()=>dateDialog.close());
$('calendarPrev').addEventListener('click',()=>{if(shownMonth.slice(0,7)<=todayInMoscow().slice(0,7))return;shownMonth=moveMonth(shownMonth,-1);drawCalendar();});
$('calendarNext').addEventListener('click',()=>{shownMonth=moveMonth(shownMonth,1);drawCalendar();});
$('dateToday').addEventListener('click',()=>chooseDate(todayInMoscow()));
$('dateTomorrow').addEventListener('click',()=>chooseDate(addDays(todayInMoscow(),1)));
dateDialog.addEventListener('click',e=>{
 if(e.target!==dateDialog)return;
 const bounds=dateDialog.getBoundingClientRect();
 if(e.clientX<bounds.left||e.clientX>bounds.right||e.clientY<bounds.top||e.clientY>bounds.bottom)dateDialog.close();
});
syncDate();
const grid=$('breadGrid');
const nodes=new Map();
const update=()=>{
 for(const [name,node] of nodes)node.setAttribute('aria-pressed',String(selected.has(name)));
 $('selectedCount').textContent=String(selected.size);
 const alreadySent=selected.size>0&&sentSignature===signature();
 $('openConfirm').disabled=selected.size===0||submitting||alreadySent;
 $('openConfirm').textContent=alreadySent?(editMode?'Изменено ✓':'Отправлено ✓'):(editMode?'Сохранить изменения':'Отправить →');
};
for(const name of breads){
 const button=document.createElement('button');
 button.type='button';button.className='bread';button.setAttribute('aria-pressed','false');button.setAttribute('aria-label',name);
 const label=document.createElement('span');label.className='name';label.textContent=name;
 const tick=document.createElement('span');tick.className='tick';tick.setAttribute('aria-hidden','true');tick.textContent='✓';
 button.append(label,tick);
 button.addEventListener('click',()=>{if(selected.has(name))selected.delete(name);else selected.add(name);update()});
 nodes.set(name,button);
 grid.append(button);
}
const dialog=$('confirmDialog');
const close=()=>dialog.close();
$('modalClose').addEventListener('click',close);
$('sentClose').addEventListener('click',close);
$('cancelConfirm').addEventListener('click',close);
dialog.addEventListener('click',event=>{
 if(event.target!==dialog)return;
 const bounds=dialog.getBoundingClientRect();
 if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)close();
});
$('openConfirm').addEventListener('click',()=>{
 if(selected.size===0)return;
 dialog.classList.remove('is-success');
 $('confirmList').replaceChildren();
 for(const name of breads){
  if(!selected.has(name))continue;
  const item=document.createElement('div');item.className='list-entry';item.textContent=name;
  $('confirmList').append(item);
 }
 $('modalStatus').hidden=true;
 $('confirmActions').hidden=false;
 syncDate();
 dialog.showModal();
});
$('confirmSelection').addEventListener('click',async()=>{
 if(submitting||selected.size===0||sentSignature===signature())return;
 const status=$('modalStatus');
 status.hidden=true;
 if(!editMode&&!workKey){
  status.hidden=false;
  status.textContent='Для отправки откройте страницу по рабочему QR-коду своей пекарни.';
  return;
 }
 if(editMode&&(!params.get('m')||!params.get('s')||!params.get('sig')||!params.get('e'))){
  status.hidden=false;
  status.textContent='Откройте личную ссылку исправления из сообщения бота.';
  return;
 }
 const button=$('confirmSelection');
 const requestedSignature=signature();
 submitting=true;
 update();
 button.disabled=true;
 button.textContent=editMode?'Сохраняем…':'Отправляем…';
 try{
  const currentParams=new URLSearchParams(location.search);
  const payload=editMode?{
   branch,date:targetDate,breads:[...selected],
   originalDate:currentParams.get('d'),
   mask:currentParams.get('s'),
   expires:currentParams.get('e'),
   sig:currentParams.get('sig'),
   messageId:currentParams.get('m')
  }:{branch,date:targetDate,breads:[...selected],key:workKey};
  const response=await fetch(editMode?'/api/edit':'/api/send',{
   method:'POST',
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify(payload),
   cache:'no-store'
  });
  const result=await response.json().catch(()=>({}));
  if(!response.ok||result.ok!==true)throw new Error(result.message||'Telegram не принял сообщение. Попробуйте ещё раз.');
  sentSignature=requestedSignature;
  if(editMode&&result.editUrl)history.replaceState(null,'',result.editUrl);
  $('confirmActions').hidden=true;
  status.hidden=true;
  $('sentTitle').textContent=editMode?'Изменения сохранены':'Сообщение отправлено';
  dialog.classList.add('is-success');
 }catch(error){
  status.hidden=false;
  status.textContent='⚠️ '+String(error?.message||'Не удалось отправить. Попробуйте ещё раз.');
 }finally{
  submitting=false;
  button.disabled=false;
  button.textContent='Подтвердить';
  update();
 }
});
update();
})();
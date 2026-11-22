(()=>{
'use strict';
const input=document.getElementById('photoInput');
if(!input)return;
const $=id=>document.getElementById(id);
const status=$('photoStatus');
const original=$('photoOriginal');
const enhanced=$('photoEnhanced');
const comparison=$('photoComparison');
const buttons=[...document.querySelectorAll('[data-photo-view]')];
let processed='',busy=false,originalUrl='',generation=0;
const showStatus=(text,isError=false)=>{
 status.textContent=text;
 status.classList.toggle('photo-error',isError);
};
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
function selectView(view){
 original.hidden=view!=='original';
 enhanced.hidden=view!=='enhanced';
 for(const button of buttons)button.setAttribute('aria-pressed',String(button.dataset.photoView===view));
}
buttons.forEach(b=>b.addEventListener('click',()=>selectView(b.dataset.photoView)));
$('photoRemove').addEventListener('click',()=>{
 generation++;
 if(originalUrl)URL.revokeObjectURL(originalUrl);
 originalUrl='';
 processed='';
 busy=false;
 input.value='';
 original.removeAttribute('src');
 enhanced.removeAttribute('src');
 comparison.hidden=true;
 $('photoRemove').hidden=true;
 showStatus('Фото необязательно — можно отправить только план.');
});
window.breadPhoto={
 get:()=>processed,
 isBusy:()=>busy,
 isInvalid:()=>Boolean(input.files?.length&&!processed&&!busy)
};
function loadImage(url){
 return new Promise((resolve,reject)=>{
  const img=new Image();
  img.onload=()=>resolve(img);
  img.onerror=()=>reject(new Error('Телефон не смог открыть этот формат фото. Попробуйте JPG.'));
  img.src=url;
 });
}
function enhance(img){
 // Adaptive tonal correction, not generative AI: never invents/erases bakery goods.
 const maxSide=1280;
 const scale=Math.min(1,maxSide/Math.max(img.naturalWidth,img.naturalHeight));
 const w=Math.max(1,Math.round(img.naturalWidth*scale));
 const h=Math.max(1,Math.round(img.naturalHeight*scale));
 const canvas=document.createElement('canvas');
 canvas.width=w;canvas.height=h;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});
 if(!ctx)throw new Error('Не удалось подготовить фотографию');
 ctx.drawImage(img,0,0,w,h);
 const data=ctx.getImageData(0,0,w,h);
 const rgba=data.data;

 // Sample actual lighting. Do not measure saturation on warm bread to correct WB:
 // prefer neutral metal/glass/table surfaces when a scene contains them.
 const histogram=new Uint32Array(256);
 let neutralR=0,neutralG=0,neutralB=0,neutralN=0;
 let sampleCount=0;
 const step=Math.max(4,Math.floor(rgba.length/120000/4)*4);
 for(let i=0;i<rgba.length;i+=step){
  const r=rgba[i],g=rgba[i+1],b=rgba[i+2];
  const l=.2126*r+.7152*g+.0722*b;
  histogram[Math.min(255,Math.round(l))]++;
  sampleCount++;
  const high=Math.max(r,g,b),low=Math.min(r,g,b);
  if(l>60&&l<238&&(high-low)<Math.max(15,high*.16)){
   neutralR+=r;neutralG+=g;neutralB+=b;neutralN++;
  }
 }
 const percentile=p=>{
  const n=Math.max(1,Math.round(sampleCount*p));
  let sum=0;
  for(let i=0;i<256;i++){sum+=histogram[i];if(sum>=n)return i;}
  return 255;
 };
 const median=percentile(.5);
 const bright=percentile(.95);
 // Stronger but restrained exposure for under-lit display cases.
 const exposure=clamp(145/Math.max(50,median),.95,1.24);
 let gains=[1,1,1];
 if(neutralN>sampleCount*.035){
  const means=[neutralR/neutralN,neutralG/neutralN,neutralB/neutralN];
  const gray=means.reduce((a,b)=>a+b,0)/3;
  gains=means.map(v=>clamp(1+.65*(gray/Math.max(1,v)-1),.91,1.09));
 }
 const shadows=median<120?26:20;
 const highlights=bright>210?19:11;

 // A very soft copy provides local contrast on crust texture without strong halos.
 // Downsampling keeps the process light enough for a phone.
 const small=document.createElement('canvas');
 small.width=Math.max(1,Math.round(w/12));
 small.height=Math.max(1,Math.round(h/12));
 const smctx=small.getContext('2d');
 smctx.drawImage(canvas,0,0,small.width,small.height);
 const soft=document.createElement('canvas');soft.width=w;soft.height=h;
 const softctx=soft.getContext('2d',{willReadFrequently:true});
 softctx.imageSmoothingEnabled=true;
 softctx.imageSmoothingQuality='high';
 softctx.drawImage(small,0,0,w,h);
 const blur=softctx.getImageData(0,0,w,h).data;

 for(let i=0;i<rgba.length;i+=4){
  let r=rgba[i]*gains[0],g=rgba[i+1]*gains[1],b=rgba[i+2]*gains[2];
  const l=.2126*r+.7152*g+.0722*b;
  const t=clamp(l/255,0,1);
  const lifted=shadows*Math.pow(1-t,2.2);
  const recovered=highlights*Math.pow(t,4.2);
  let mapped=l*exposure+lifted-recovered;
  // A delicate contrast curve, leaving highlights on the steel and glass intact.
  mapped=(mapped-126)*1.055+126;
  const softL=.2126*blur[i]+.7152*blur[i+1]+.0722*blur[i+2];
  const rawL=.2126*rgba[i]+.7152*rgba[i+1]+.0722*rgba[i+2];
  const texture=(rawL-softL)*.20*clamp(rawL/55,0,1);
  const delta=clamp(mapped-l+texture,-32,49);
  r+=delta;g+=delta;b+=delta;
  // Preserve colors while gently improving food contrast.
  const gray=.2126*r+.7152*g+.0722*b;
  const saturation=1.055;
  rgba[i]=clamp(gray+(r-gray)*saturation,0,255);
  rgba[i+1]=clamp(gray+(g-gray)*saturation,0,255);
  rgba[i+2]=clamp(gray+(b-gray)*saturation,0,255);
 }
 ctx.putImageData(data,0,0);
 return canvas.toDataURL('image/jpeg',.86);
}

input.addEventListener('change',async()=>{
 const file=input.files?.[0];
 if(!file)return;
 if(originalUrl)URL.revokeObjectURL(originalUrl);
 processed='';originalUrl='';
 comparison.hidden=true;
 if(!file.type.startsWith('image/')||file.size>22*1024*1024){
  showStatus('Выберите фотографию размером не более 22 МБ.',true);input.value='';return;
 }
 const ticket=++generation;
 $('photoRemove').hidden=false;
 busy=true;showStatus('Корректируем свет, тени и фактуру хлеба…');
 const url=URL.createObjectURL(file);
 originalUrl=url;
 try{
  const img=await loadImage(url);
  if(ticket!==generation)return;
  if(img.naturalWidth<64||img.naturalHeight<64)throw new Error('Фото слишком маленькое');
  const dataUrl=enhance(img);
  if(ticket!==generation)return;
  if(dataUrl.length>2.8*1024*1024)throw new Error('Фотография получилась слишком большой — выберите другой снимок');
  processed=dataUrl;
  original.src=url;
  enhanced.src=dataUrl;
  comparison.hidden=false;
  selectView('enhanced');
  showStatus('Готово. Сравни «Оригинал» и «После обработки» — в Telegram уйдёт вторая версия.');
 }catch(err){
  if(ticket!==generation)return;
  showStatus(String(err?.message||'Не удалось обработать фотографию.'),true);
  processed='';
  comparison.hidden=true;
 }finally{
  if(ticket===generation)busy=false;
 }
});
})();

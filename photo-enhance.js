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
 showStatus('Фото необязательно — можно отправить только план.');
});
window.breadPhoto={
 get:()=>processed,
 isBusy:()=>busy
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
 // Deliberately non-generative. Pixel-level exposure, shadow, white balance,
 // and mild color correction do not create or remove any products on the shelf.
 const maxSide=1280;
 const scale=Math.min(1,maxSide/Math.max(img.naturalWidth,img.naturalHeight));
 const w=Math.max(1,Math.round(img.naturalWidth*scale));
 const h=Math.max(1,Math.round(img.naturalHeight*scale));
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});
 if(!ctx)throw new Error('Не удалось подготовить фотографию');
 ctx.drawImage(img,0,0,w,h);
 const image=ctx.getImageData(0,0,w,h);
 const a=image.data;
 let red=0,green=0,blue=0,lum=0,n=0;
 const step=Math.max(4,Math.floor(a.length/100000/4)*4);
 for(let i=0;i<a.length;i+=step){
  const r=a[i],g=a[i+1],b=a[i+2];
  red+=r;green+=g;blue+=b;
  lum+=.2126*r+.7152*g+.0722*b;n++;
 }
 red/=n;green/=n;blue/=n;lum/=n;
 const mid=(red+green+blue)/3;
 const wb=[
  clamp(1+.34*(mid/Math.max(red,1)-1),.93,1.07),
  clamp(1+.34*(mid/Math.max(green,1)-1),.93,1.07),
  clamp(1+.34*(mid/Math.max(blue,1)-1),.93,1.07)
 ];
 const exposure=clamp(126/Math.max(lum,30),.88,1.18);
 for(let i=0;i<a.length;i+=4){
  const l=.2126*a[i]+.7152*a[i+1]+.0722*a[i+2];
  const shadow=clamp(Math.pow(1-l/255,2)*15,0,15);
  let r=a[i]*exposure*wb[0]+shadow;
  let g=a[i+1]*exposure*wb[1]+shadow;
  let b=a[i+2]*exposure*wb[2]+shadow;
  r=clamp((r-128)*1.027+128,0,255);
  g=clamp((g-128)*1.027+128,0,255);
  b=clamp((b-128)*1.027+128,0,255);
  const gray=.2126*r+.7152*g+.0722*b;
  a[i]=clamp(gray+(r-gray)*1.045,0,255);
  a[i+1]=clamp(gray+(g-gray)*1.045,0,255);
  a[i+2]=clamp(gray+(b-gray)*1.045,0,255);
 }
 ctx.putImageData(image,0,0);
 return canvas.toDataURL('image/jpeg',.82);
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
 busy=true;showStatus('Улучшаем свет и цвет фотографии…');
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
  showStatus('Готово. В Telegram отправится улучшенная версия.');
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

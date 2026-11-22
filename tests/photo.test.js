import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/send.js';

function today(){
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{
  timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',year:'numeric'
 }).formatToParts(new Date()).map(v=>[v.type,v.value]));
 return p.year+'-'+p.month+'-'+p.day;
}
function response(){
 return {code:null,body:null,setHeader(){return this},status(n){this.code=n;return this},json(x){this.body=x;return this}};
}
const savedKeys=['TELEGRAM_BOT_TOKEN','TELEGRAM_CHAT_ID','TELEGRAM_OWNER_CHAT_ID','BREAD_KEY_OBRAZCOVAYA'];
const fakeReq=(photoData,branch='obrazcovaya')=>({
 method:'POST',headers:{'content-type':'application/json'},
 body:{branch,date:today(),breads:['Луковый'],key:'photo-test-key',...(photoData!==undefined?{photoData}:{})}
});
const jpeg=Buffer.alloc(1300,123);
jpeg[0]=0xff;jpeg[1]=0xd8;jpeg[2]=0xff;
jpeg[jpeg.length-2]=0xff;jpeg[jpeg.length-1]=0xd9;
const dataURL='data:image/jpeg;base64,'+jpeg.toString('base64');

test('A valid compressed bakery photo is uploaded to Telegram as the actual attachment',async()=>{
 const saved=Object.fromEntries(savedKeys.map(k=>[k,process.env[k]]));
 const originalFetch=globalThis.fetch;
 try{
  Object.assign(process.env,{
   TELEGRAM_BOT_TOKEN:'test-token',TELEGRAM_CHAT_ID:'-100000000',
   BREAD_KEY_OBRAZCOVAYA:'photo-test-key'
  });
  delete process.env.TELEGRAM_OWNER_CHAT_ID;
  let count=0;
  globalThis.fetch=async(url,init)=>{
   count++;
   assert.match(url,/\/sendPhoto$/);
   assert.equal(init.method,'POST');
   assert.equal(init.body instanceof FormData,true);
   assert.equal(init.body.get('chat_id'),'-100000000');
   assert.match(init.body.get('caption'),/✓ Луковый/);
   const file=init.body.get('photo');
   assert.equal(file.type,'image/jpeg');
   assert.equal(file.size,jpeg.length);
   return {ok:true,json:async()=>({ok:true,result:{message_id:100}})};
  };
  const r=response();
  await handler(fakeReq(dataURL),r);
  assert.equal(r.code,200);
  assert.equal(r.body.ok,true);
  assert.equal(count,1);
 }finally{
  globalThis.fetch=originalFetch;
  for(const [k,v] of Object.entries(saved))v===undefined?delete process.env[k]:process.env[k]=v;
 }
});

test('Broken photo data is rejected before sending to Telegram',async()=>{
 const saved=Object.fromEntries(savedKeys.map(k=>[k,process.env[k]]));
 const originalFetch=globalThis.fetch;
 try{
  Object.assign(process.env,{
   TELEGRAM_BOT_TOKEN:'test-token',TELEGRAM_CHAT_ID:'-100000000',
   BREAD_KEY_OBRAZCOVAYA:'photo-test-key'
  });
  globalThis.fetch=()=>{throw new Error('must not send')};
  for(const bad of ['data:text/plain;base64,WA==','data:image/jpeg;base64,YWJj',dataURL.replace(/.$/,'?')]){
   const r=response();await handler(fakeReq(bad),r);
   assert.equal(r.code,400);
  }
 }finally{
  globalThis.fetch=originalFetch;
  for(const [k,v] of Object.entries(saved))v===undefined?delete process.env[k]:process.env[k]=v;
 }
});

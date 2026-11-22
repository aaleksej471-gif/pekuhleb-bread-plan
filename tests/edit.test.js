import test from 'node:test';
import assert from 'node:assert/strict';
import { makeEditUrl,validEditLink,encodeBreads,decodeBreads,ownerButton } from '../shared/owner-edit.js';
import editHandler from '../api/edit.js';
import sendHandler from '../api/send.js';

const before=process.env.TELEGRAM_BOT_TOKEN;
const saveKeys=['TELEGRAM_BOT_TOKEN','TELEGRAM_CHAT_ID','TELEGRAM_OWNER_CHAT_ID','BREAD_KEY_OBRAZCOVAYA'];
const env=Object.fromEntries(saveKeys.map(key=>[key,process.env[key]]));
const today=()=>{
 const v=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{
  timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'
 }).formatToParts(new Date()).map(p=>[p.type,p.value]));
 return v.year+'-'+v.month+'-'+v.day;
};
const fakeRes=()=>{
 const r={statusCode:0,body:null,headers:{}};
 r.setHeader=(k,v)=>{r.headers[k]=v;return r};
 r.status=(code)=>{r.statusCode=code;return r};
 r.json=(body)=>{r.body=body;return r};
 return r;
};
function linkParams(url){
 const u=new URL(url);
 return {
  branch:u.pathname.includes('obrazcovaya')?'obrazcovaya':'chelyuskina',
  date:u.searchParams.get('d'),mask:u.searchParams.get('s'),
  messageId:Number(u.searchParams.get('m')),
  expires:u.searchParams.get('e'),sig:u.searchParams.get('sig')
 };
}
const request=(body)=>({method:'POST',headers:{'content-type':'application/json'},body});
test('Signed private edit links are valid, tampering is blocked',()=>{
 process.env.TELEGRAM_BOT_TOKEN='temporary-test-bot-token';
 try{
  const link=makeEditUrl({branch:'obrazcovaya',date:today(),breads:['Луковый','Фугас'],messageId:613});
  const params=linkParams(link);
  assert.equal(validEditLink(params),true);
  assert.deepEqual(decodeBreads(params.mask),['Луковый','Фугас']);
  assert.equal(validEditLink({...params,messageId:614}),false);
  assert.equal(validEditLink({...params,branch:'chelyuskina'}),false);
  assert.equal(validEditLink({...params,expires:'1000000000'}),false);
  assert.equal(validEditLink({...params,sig:'forged'}),false);
  assert.deepEqual(ownerButton(link),{inline_keyboard:[[{text:'Исправить план выпечки',url:link}]]});
 }finally{
  if(before===undefined)delete process.env.TELEGRAM_BOT_TOKEN;
  else process.env.TELEGRAM_BOT_TOKEN=before;
 }
});
test('Owner correction edits existing Telegram message, not sending another',async()=>{
 const prevFetch=globalThis.fetch;
 try{
  Object.assign(process.env,{
   TELEGRAM_BOT_TOKEN:'test-bot-token',TELEGRAM_CHAT_ID:'-100999999',
   BREAD_KEY_OBRAZCOVAYA:'test-staff-key'
  });
  const link=makeEditUrl({branch:'obrazcovaya',date:today(),breads:['Ржаной'],messageId:812});
  const params=linkParams(link);
  let count=0,requestUrl=null,payload=null;
  globalThis.fetch=async(url,options)=>{
   count++;requestUrl=url;payload=JSON.parse(options.body);
   return {ok:true,status:200,json:async()=>({ok:true,result:{message_id:812}})};
  };
  const r=fakeRes();
  await editHandler(request({
   branch:params.branch,originalDate:params.date,mask:params.mask,
   expires:params.expires,sig:params.sig,messageId:params.messageId,
   date:today(),breads:['Луковый','Ржаной']
  }),r);
  assert.equal(r.statusCode,200);
  assert.equal(count,1);
  assert.match(requestUrl,/\/editMessageCaption$/);
  assert.equal(payload.chat_id,'-100999999');
  assert.equal(payload.message_id,812);
  assert.match(payload.caption,/✓ Луковый\n✓ Ржаной/);
  assert.equal(validEditLink(linkParams(r.body.editUrl)),true);
  assert.equal(r.body.editUrl.startsWith('https://project-ply6y.vercel.app/edit-obrazcovaya.html'),true);
  const forged=fakeRes();
  await editHandler(request({
   branch:params.branch,originalDate:params.date,mask:params.mask,
   expires:params.expires,sig:'invalid',messageId:params.messageId,
   date:today(),breads:['Багет']
  }),forged);
  assert.equal(forged.statusCode,403);
  assert.equal(count,1);
 }finally{
  globalThis.fetch=prevFetch;
  for(const [key,val] of Object.entries(env))val===undefined?delete process.env[key]:process.env[key]=val;
 }
});
test('Staff submission sends a private owner link but no button into the group',async()=>{
 const prevFetch=globalThis.fetch;
 try{
  Object.assign(process.env,{
   TELEGRAM_BOT_TOKEN:'test-bot',TELEGRAM_CHAT_ID:'-100999999',
   TELEGRAM_OWNER_CHAT_ID:'321987',BREAD_KEY_OBRAZCOVAYA:'test-staff-key'
  });
  const calls=[];
  globalThis.fetch=async(url,options)=>{
   if(options?.method==='HEAD')return {ok:false,status:404,headers:{get:()=>''}};
   calls.push({url,body:JSON.parse(options.body)});
   return {ok:true,status:200,json:async()=>({ok:true,result:{message_id:calls.length===1?812:813}})};
  };
  const r=fakeRes();
  await sendHandler(request({branch:'obrazcovaya',date:today(),breads:['Фугас'],key:'test-staff-key'}),r);
  assert.equal(r.statusCode,200);
  assert.equal(calls.length,2);
  assert.equal(calls[0].body.chat_id,'-100999999');
  assert.match(calls[0].url,/\/sendPhoto$/);
  assert.match(calls[0].body.photo,/^https:\/\/images\.unsplash\.com\/photo-/);
  assert.equal(calls[0].body.reply_markup,undefined);
  assert.equal(calls[1].body.chat_id,'321987');
  const editLink=calls[1].body.reply_markup.inline_keyboard[0][0].url;
  assert.equal(validEditLink(linkParams(editLink)),true);
  assert.equal(calls[0].body.caption.includes('Фугас'),true);
  assert.equal(calls[0].body.caption.includes('test-staff-key'),false);
 }finally{
  globalThis.fetch=prevFetch;
  for(const [key,val] of Object.entries(env))val===undefined?delete process.env[key]:process.env[key]=val;
 }
});

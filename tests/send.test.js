import test from 'node:test';
import assert from 'node:assert/strict';
import handler,{makeMessage} from '../api/send.js';

const dateInMoscow=()=>{
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(x=>[x.type,x.value]));
 return p.year+'-'+p.month+'-'+p.day;
};
function fakeRes(){
 const r={code:200,body:null,headers:{}};
 r.setHeader=(key,value)=>{r.headers[key]=value;return r};
 r.status=(code)=>{r.code=code;return r};
 r.json=(body)=>{r.body=body;return r};
 return r;
}
const req=(body,headers={'content-type':'application/json'})=>({method:'POST',headers,body});

test('Telegram message is minimal and readable',()=>{
 const message=makeMessage('chelyuskina','2026-11-23',['Цельнозерновой','Луковый','С семечками']);
 assert.match(message,/<b>ПЛАН ВЫПЕЧКИ<\/b>/);
 assert.match(message,/<b>Челюскина<\/b> · 23 ноября/);
 assert.match(message,/✓ Цельнозерновой\n✓ Луковый\n✓ С семечками/);
 assert.doesNotMatch(message,/Пеку Хлеб|Всего|✅|📍|📅|🥖/);
});

test('Telegram headline says today when the bake date is today',()=>{
 const message=makeMessage('obrazcovaya',dateInMoscow(),['Багет']);
 assert.match(message,/<b>Сегодня выпекаем<\/b>/);
});

test('Unknown branch is rejected before delivery',async()=>{
 const response=fakeRes();
 await handler(req({branch:'not-bakery',date:dateInMoscow(),breads:['Луковый']}),response);
 assert.equal(response.code,400);
});

test('Missing private configuration never sends anything',async()=>{
 const keys=['TELEGRAM_BOT_TOKEN','TELEGRAM_CHAT_ID','BREAD_KEY_OBRAZCOVAYA','BREAD_KEY_CHELYUSKINA'];
 const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 try{
  keys.forEach(k=>delete process.env[k]);
  const response=fakeRes();
  await handler(req({branch:'obrazcovaya',date:dateInMoscow(),breads:['Луковый'],key:'test'}),response);
  assert.equal(response.code,503);
 }finally{
  keys.forEach(k=>saved[k]===undefined?delete process.env[k]:process.env[k]=saved[k]);
 }
});

test('A correct request calls Telegram once; a wrong key cannot',async()=>{
 const prevFetch=globalThis.fetch;
 const prevEnv={TELEGRAM_BOT_TOKEN:process.env.TELEGRAM_BOT_TOKEN,TELEGRAM_CHAT_ID:process.env.TELEGRAM_CHAT_ID,BREAD_KEY_OBRAZCOVAYA:process.env.BREAD_KEY_OBRAZCOVAYA};
 try{
  Object.assign(process.env,{TELEGRAM_BOT_TOKEN:'fake-test-token',TELEGRAM_CHAT_ID:'-100000000',BREAD_KEY_OBRAZCOVAYA:'testing-private-link'});
  let hits=0,received;
  globalThis.fetch=async(url,init)=>{
   hits++;
   assert.match(url,/api.telegram.org\/botfake-test-token\/sendMessage$/);
   received=JSON.parse(init.body);
   return {ok:true,json:async()=>({ok:true})};
  };
  const bad=fakeRes();
  await handler(req({branch:'obrazcovaya',date:dateInMoscow(),breads:['Багет'],key:'wrong'}),bad);
  assert.equal(bad.code,401);assert.equal(hits,0);

  const good=fakeRes();
  await handler(req({branch:'obrazcovaya',date:dateInMoscow(),breads:['Багет','Цельнозерновой'],key:'testing-private-link'}),good);
  assert.equal(good.code,200);assert.equal(good.body.ok,true);assert.equal(hits,1);
  assert.equal(received.parse_mode,'HTML');
  assert.match(received.text,/✓ Цельнозерновой\n✓ Багет/);
  assert.doesNotMatch(received.text,/testing-private-link/);
 }finally{
  globalThis.fetch=prevFetch;
  for(const [k,v] of Object.entries(prevEnv))v===undefined?delete process.env[k]:process.env[k]=v;
 }
});

import { timingSafeEqual } from 'node:crypto';
import { BREADS, BRANCH_NAMES } from '../shared/catalog.js';
import { makeEditUrl, ownerButton } from '../shared/owner-edit.js';

// Temporary licensed sample image for the Telegram group visual test.
// Replace with an original bakery photo once the layout is approved.
export const BREAD_PHOTO_URL = 'https://images.unsplash.com/photo-1509440159596-0249088772ff?fm=jpg&w=1100&q=82&fit=crop';

const KEY_ENV = {
  obrazcovaya: 'BREAD_KEY_OBRAZCOVAYA',
  chelyuskina: 'BREAD_KEY_CHELYUSKINA'
};
const allowed = new Set(BREADS);
const json = (res, status, payload) => res.status(status).json(payload);
const safeEqual = (a,b) => {
  if (!a || !b || typeof a !== 'string' || typeof b !== 'string') return false;
  const left=Buffer.from(a),right=Buffer.from(b);
  return left.length===right.length && timingSafeEqual(left,right);
};
const moscowToday = () => {
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{
    timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(new Date()).map(x=>[x.type,x.value]));
  return p.year+'-'+p.month+'-'+p.day;
};
const addDays=(iso,n)=>{
  const date=new Date(iso+'T12:00:00Z');
  date.setUTCDate(date.getUTCDate()+n);
  return date.toISOString().slice(0,10);
};
const validDate=(iso)=>{
  if(typeof iso!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(iso))return false;
  const date=new Date(iso+'T12:00:00Z');
  return !Number.isNaN(date.valueOf())&&date.toISOString().slice(0,10)===iso;
};
const esc=(s)=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const makeMessage=(branch,date,breads)=>{
  const day=new Date(date+'T12:00:00Z');
  const dayMonth=new Intl.DateTimeFormat('ru-RU',{
    timeZone:'UTC',day:'numeric',month:'long'
  }).format(day);
  const today=moscowToday();
  const heading=date===today?'Сегодня выпекаем':
    date===addDays(today,1)?'Завтра выпекаем':'Выпекаем';
  return [
    '<b>ПЛАН ВЫПЕЧКИ</b>',
    '<b>'+esc(BRANCH_NAMES[branch])+'</b> · '+esc(dayMonth),
    '',
    '<b>'+heading+'</b>',
    ...breads.map(x=>'✓ '+esc(x))
  ].join('\n');
};

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST')return json(res,405,{ok:false,message:'Метод не поддерживается'});
  if(!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json'))
    return json(res,415,{ok:false,message:'Нужен запрос с данными в формате JSON'});
  const body=req.body||{};
  const branch=typeof body.branch==='string'?body.branch:'';
  if(!Object.hasOwn(BRANCH_NAMES,branch))
    return json(res,400,{ok:false,message:'Неизвестная пекарня'});
  const key=process.env[KEY_ENV[branch]];
  if(!key||!process.env.TELEGRAM_BOT_TOKEN||!process.env.TELEGRAM_CHAT_ID)
    return json(res,503,{ok:false,message:'Отправка в Telegram ещё не настроена'});
  if(!safeEqual(body.key,key))
    return json(res,401,{ok:false,message:'Откройте страницу по рабочему QR-коду пекарни'});
  const date=body.date;
  const today=moscowToday();
  if(!validDate(date)||date<today||date>addDays(today,180))
    return json(res,400,{ok:false,message:'Выберите дату выпечки: сегодня или ближайшие 180 дней'});
  if(!Array.isArray(body.breads)||body.breads.length<1||body.breads.length>BREADS.length||
    body.breads.some(x=>typeof x!=='string'||!allowed.has(x))||
    new Set(body.breads).size!==body.breads.length)
    return json(res,400,{ok:false,message:'Выберите хлеб из списка, без повторов'});
  // Сохраняем стабильный порядок, как в сетке на телефоне.
  const picked=BREADS.filter(x=>body.breads.includes(x));
  const message=makeMessage(branch,date,picked);
  try{
    const response=await fetch('https://api.telegram.org/bot'+process.env.TELEGRAM_BOT_TOKEN+'/sendPhoto',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        chat_id:process.env.TELEGRAM_CHAT_ID,
        photo:BREAD_PHOTO_URL,
        caption:message,
        parse_mode:'HTML'
      }),
      signal:AbortSignal.timeout(18000)
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok||data.ok!==true){
      console.error('Bread plan Telegram delivery failed:',response.status,data.error_code||'');
      return json(res,502,{ok:false,message:'Telegram не принял фотографию с планом. Попробуйте ещё раз или сообщите администратору.'});
    }
    // Only the owner receives a private edit link. It is NOT shown in the staff group.
    const messageId=data.result?.message_id;
    const ownerChat=process.env.TELEGRAM_OWNER_CHAT_ID;
    // Telegram private user IDs are positive; never risk sending edit access to a group.
    if(/^\d{4,20}$/.test(String(ownerChat||''))&&Number.isSafeInteger(messageId)&&messageId>0){
      try{
        const editUrl=makeEditUrl({branch,date,breads:picked,messageId});
        const ownerResponse=await fetch('https://api.telegram.org/bot'+process.env.TELEGRAM_BOT_TOKEN+'/sendMessage',{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({
            chat_id:ownerChat,
            text:'План выпечки · '+BRANCH_NAMES[branch]+' · '+date+'\nДля исправления сообщения нажми кнопку:',
            reply_markup:ownerButton(editUrl)
          }),
          signal:AbortSignal.timeout(10000)
        });
        const ownerResult=await ownerResponse.json().catch(()=>({}));
        if(!ownerResponse.ok||ownerResult.ok!==true)
          console.error('Bread owner edit invitation not delivered',ownerResponse.status,ownerResult.error_code||'');
      }catch(e){
        console.error('Bread owner edit invitation failed:',String(e?.name||'unknown'));
      }
    }
    return json(res,200,{ok:true,message:'План выпечки отправлен в Telegram',date,branch,count:picked.length});
  }catch(error){
    console.error('Bread plan network failure:',String(error?.name||'unknown'));
    return json(res,502,{ok:false,message:'Не удалось связаться с Telegram. Проверьте интернет и попробуйте ещё раз.'});
  }
}

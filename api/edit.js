import { BREADS, BRANCH_NAMES } from '../shared/catalog.js';
import { validEditLink, makeEditUrl } from '../shared/owner-edit.js';
import { makeMessage } from './send.js';

const json=(res,code,data)=>res.status(code).json(data);
const isDate=date=>{
 if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date))return false;
 const d=new Date(date+'T12:00:00Z');return !Number.isNaN(d.valueOf())&&d.toISOString().slice(0,10)===date;
};
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='POST')return json(res,405,{ok:false,message:'Метод не поддерживается'});
 if(!String(req.headers['content-type']||'').startsWith('application/json'))
  return json(res,415,{ok:false,message:'Некорректный запрос'});
 if(!process.env.TELEGRAM_BOT_TOKEN||!process.env.TELEGRAM_CHAT_ID)
  return json(res,503,{ok:false,message:'Telegram не настроен'});
 const body=req.body||{};
 const branch=typeof body.branch==='string'?body.branch:'';
 const originalDate=body.originalDate;
 const mask=body.mask;
 const expires=body.expires;
 const sig=body.sig;
 const messageId=Number(body.messageId);
 const sender=body.sender??'';
 if(!validEditLink({branch,date:originalDate,mask,messageId,expires,sig,sender}))
  return json(res,403,{ok:false,message:'Ссылка редактирования устарела или недействительна'});
 const date=body.date;
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{
  timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'
 }).formatToParts(new Date()).map(x=>[x.type,x.value]));
 const today=p.year+'-'+p.month+'-'+p.day;
 const end=new Date(today+'T12:00:00Z');end.setUTCDate(end.getUTCDate()+180);
 if(!isDate(date)||date<today||date>end.toISOString().slice(0,10))
  return json(res,400,{ok:false,message:'Выберите подходящую дату выпечки'});
 const breads=body.breads;
 if(!Array.isArray(breads)||!breads.length||breads.length>BREADS.length||
  breads.some(x=>typeof x!=='string'||!BREADS.includes(x))||
  new Set(breads).size!==breads.length)
  return json(res,400,{ok:false,message:'Выберите хлеб из списка'});
 const chosen=BREADS.filter(x=>breads.includes(x));
 const text=makeMessage(branch,date,chosen,sender);
 try{
  const response=await fetch('https://api.telegram.org/bot'+process.env.TELEGRAM_BOT_TOKEN+'/editMessageCaption',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({chat_id:process.env.TELEGRAM_CHAT_ID,message_id:messageId,caption:text,parse_mode:'HTML'}),
   signal:AbortSignal.timeout(10000)
  });
  const result=await response.json().catch(()=>({}));
  if(!response.ok||result.ok!==true){
   if(result.description?.includes('message is not modified')){
    return json(res,200,{ok:true,message:'План уже соответствует выбранному списку',editUrl:makeEditUrl({branch,date,breads:chosen,messageId,sender})});
   }
   console.error('Bread plan edit rejected:',response.status,result.error_code||'unknown');
   return json(res,502,{ok:false,message:'Бот не смог исправить сообщение. Возможно, оно слишком старое или было удалено.'});
  }
  return json(res,200,{ok:true,message:'План изменён в Telegram',editUrl:makeEditUrl({branch,date,breads:chosen,messageId,sender})});
 }catch(e){
  console.error('Bread edit network issue:',String(e?.name||'unknown'));
  return json(res,502,{ok:false,message:'Не удалось связаться с Telegram. Попробуйте ещё раз.'});
 }
}

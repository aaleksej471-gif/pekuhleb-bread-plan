import { createHmac, timingSafeEqual } from 'node:crypto';
import { BREADS, BRANCH_NAMES } from './catalog.js';

const EDIT_ORIGIN = 'https://project-ply6y.vercel.app';

export function safeEqual(a,b){
 if(typeof a!=='string'||typeof b!=='string'||!a||!b)return false;
 const left=Buffer.from(a),right=Buffer.from(b);
 return left.length===right.length&&timingSafeEqual(left,right);
}
export function encodeBreads(breads){
 return BREADS.reduce((mask,name,index)=>breads.includes(name)?mask|(1<<index):mask,0).toString(36);
}
export function decodeBreads(raw){
 if(typeof raw!=='string'||!/^[0-9a-z]{1,4}$/.test(raw))return null;
 const mask=parseInt(raw,36);
 if(!Number.isInteger(mask)||mask<1||mask>=(1<<BREADS.length))return null;
 return BREADS.filter((name,index)=>mask&(1<<index));
}
function editSignature(branch,date,mask,messageId){
 const secret=process.env.TELEGRAM_BOT_TOKEN;
 if(!secret)throw new Error('Telegram bot not configured');
 return createHmac('sha256',secret)
 .update('bread-plan-editor-v1\n'+[branch,date,mask,messageId].join('\n'))
 .digest('base64url');
}
export function makeEditUrl({branch,date,breads,messageId}){
 if(!Object.hasOwn(BRANCH_NAMES,branch)||!Number.isSafeInteger(messageId)||messageId<1)throw new Error('Invalid edit target');
 const mask=encodeBreads(breads);
 const u=new URL('/edit-'+branch+'.html',EDIT_ORIGIN);
 u.searchParams.set('m',String(messageId));
 u.searchParams.set('d',date);
 u.searchParams.set('s',mask);
 u.searchParams.set('sig',editSignature(branch,date,mask,messageId));
 return u.href;
}
export function validEditLink({branch,date,mask,messageId,sig}){
 if(!Object.hasOwn(BRANCH_NAMES,branch)||typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||
 !Number.isSafeInteger(messageId)||messageId<1||!decodeBreads(mask)||typeof sig!=='string')return false;
 return safeEqual(sig,editSignature(branch,date,mask,messageId));
}
export function markupForUrl(url){
 return {inline_keyboard:[[{text:'Изменить план',url}]]};
}

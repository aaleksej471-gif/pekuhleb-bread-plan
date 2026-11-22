import { createHmac, timingSafeEqual } from 'node:crypto';
import { BREADS, BRANCH_NAMES } from './catalog.js';

const EDIT_ORIGIN = 'https://project-ply6y.vercel.app';
const EDIT_LIFETIME = 30 * 24 * 60 * 60; // 30 суток

function safeEqual(a,b){
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
 if(!Number.isSafeInteger(mask)||mask<1||mask>=(1<<BREADS.length))return null;
 return BREADS.filter((name,index)=>mask&(1<<index));
}
function editSignature(branch,date,mask,messageId,expires){
 const secret=process.env.TELEGRAM_BOT_TOKEN;
 if(!secret)throw new Error('Telegram bot not configured');
 return createHmac('sha256',secret)
 .update('bread-plan-owner-v2\n'+[branch,date,mask,messageId,expires].join('\n'))
 .digest('base64url');
}
export function makeEditUrl({branch,date,breads,messageId}){
 if(!Object.hasOwn(BRANCH_NAMES,branch)||!/^\d{4}-\d{2}-\d{2}$/.test(date)||
 !Number.isSafeInteger(messageId)||messageId<1||
 !Array.isArray(breads)||!breads.length||breads.some(x=>!BREADS.includes(x)))throw new Error('Invalid edit target');
 const mask=encodeBreads(breads);
 const expires=String(Math.floor(Date.now()/1000)+EDIT_LIFETIME);
 const url=new URL('/edit-'+branch+'.html',EDIT_ORIGIN);
 url.searchParams.set('m',String(messageId));
 url.searchParams.set('d',date);
 url.searchParams.set('s',mask);
 url.searchParams.set('e',expires);
 url.searchParams.set('sig',editSignature(branch,date,mask,messageId,expires));
 return url.href;
}
export function validEditLink({branch,date,mask,messageId,expires,sig}){
 if(!Object.hasOwn(BRANCH_NAMES,branch)||typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||
 !Number.isSafeInteger(messageId)||messageId<1||!decodeBreads(mask)||typeof sig!=='string'||
 typeof expires!=='string'||!/^\d{10}$/.test(expires)||
 Number(expires)<Math.floor(Date.now()/1000)||
 Number(expires)>Math.floor(Date.now()/1000)+EDIT_LIFETIME)return false;
 return safeEqual(sig,editSignature(branch,date,mask,messageId,expires));
}
export function ownerButton(url){
 return {inline_keyboard:[[{text:'Исправить план выпечки',url}]]};
}

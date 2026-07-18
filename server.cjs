const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const querystring = require('querystring');
const PDFDocument = require('pdfkit');

const PORT = process.env.PORT || 10000;

function resolveDataDir(){
  const localDir = path.join(__dirname, 'data');
  const configuredDir = String(process.env.DATA_DIR || '').trim();
  if(!configuredDir) return localDir;

  try {
    fs.mkdirSync(configuredDir, {recursive:true});
    fs.accessSync(configuredDir, fs.constants.R_OK | fs.constants.W_OK);
    return configuredDir;
  } catch (error) {
    console.warn(`[storage] DATA_DIR ${configuredDir} is unavailable; using local directory ${localDir}`);
    return localDir;
  }
}

const DATA_DIR = resolveDataDir();
const DB_FILE = path.join(DATA_DIR, 'db.json');
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'sklepm1';
const SHOP_PASSWORD = process.env.SHOP_PASSWORD || '12345678';
const BACKUP_DOWNLOAD_PASSWORD = process.env.BACKUP_DOWNLOAD_PASSWORD || '199325';
const DEFAULT_SHOPS = ['М1','Центр','Ожарув','Воломін','Ловіч','Рава','Ломʼянки','Сідельце','Мінськ Мазовецький','Плоцьк'];
const CATEGORIES = ['Алкоголь','Напої','Сухий склад','Холодильник 1','Холодильник 2','Морозильна камера','Забезпечення'];
const UNIT_OPTIONS = ['szt','g','kg','L','ml'];
const CAT_ICONS = {'Алкоголь':'🍷','Напої':'🥤','Сухий склад':'📦','Холодильник 1':'❄️','Холодильник 2':'🧊','Морозильна камера':'⛄','Забезпечення':'🧰'};
const DEPOSIT_CATEGORIES = ['Алкоголь','Напої'];
function canHaveDeposit(category){ return DEPOSIT_CATEGORIES.includes(String(category||'')); }
const CAT_SVG_ICONS = {
  'Алкоголь': '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" width="36" height="36"><defs><linearGradient id="si_alc" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#fde68a"/><stop offset="100%" stop-color="#d97706"/></linearGradient></defs><rect x="10" y="20" width="22" height="22" rx="3" fill="url(#si_alc)"/><path d="M10 20 Q10 12 21 12 Q32 12 32 20" fill="#fcd34d"/><ellipse cx="21" cy="20" rx="11" ry="4" fill="white" opacity="0.88"/><ellipse cx="17" cy="17" rx="4" ry="2.5" fill="white" opacity="0.5"/><ellipse cx="24" cy="15" rx="2.5" ry="1.5" fill="white" opacity="0.4"/><path d="M32 24 Q40 24 40 32 Q40 40 32 40" stroke="#b45309" stroke-width="4.5" fill="none" stroke-linecap="round"/><rect x="13" y="27" width="2" height="9" rx="1" fill="white" opacity="0.22"/><rect x="17" y="29" width="2" height="7" rx="1" fill="white" opacity="0.15"/></svg>',
  'Напої': '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" width="36" height="36"><defs><linearGradient id="si_nap" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#6ee7b7"/><stop offset="100%" stop-color="#047857"/></linearGradient></defs><rect x="18" y="6" width="12" height="6" rx="3" fill="#fbbf24"/><path d="M16 12 L15 43 Q15 45 24 45 Q33 45 33 43 L32 12 Z" fill="url(#si_nap)"/><rect x="16.5" y="18" width="15" height="11" rx="2" fill="white" opacity="0.9"/><text x="24" y="26" text-anchor="middle" font-size="5" font-weight="900" fill="#065f46" font-family="Arial,sans-serif">Живчик</text><ellipse cx="24" cy="38" rx="5" ry="1.5" fill="#065f46" opacity="0.28"/><rect x="16" y="31" width="16" height="2" rx="1" fill="white" opacity="0.18"/></svg>',
  'Сухий склад': '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" width="36" height="36"><defs><linearGradient id="si_box" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#fde68a"/><stop offset="100%" stop-color="#d97706"/></linearGradient><linearGradient id="si_pal" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#c4934a"/><stop offset="100%" stop-color="#92400e"/></linearGradient></defs><rect x="4" y="38" width="40" height="5" rx="2" fill="url(#si_pal)"/><rect x="7" y="37" width="3" height="8" rx="1" fill="#78350f"/><rect x="22" y="37" width="3" height="8" rx="1" fill="#78350f"/><rect x="37" y="37" width="3" height="8" rx="1" fill="#78350f"/><rect x="7" y="27" width="15" height="11" rx="2" fill="url(#si_box)"/><rect x="7" y="27" width="15" height="3.5" rx="1" fill="#f59e0b"/><line x1="14.5" y1="27" x2="14.5" y2="38" stroke="#b45309" stroke-width="1" opacity="0.5"/><rect x="25" y="27" width="16" height="11" rx="2" fill="url(#si_box)"/><rect x="25" y="27" width="16" height="3.5" rx="1" fill="#f59e0b"/><line x1="33" y1="27" x2="33" y2="38" stroke="#b45309" stroke-width="1" opacity="0.5"/><rect x="13" y="15" width="17" height="12" rx="2" fill="#fcd34d"/><rect x="13" y="15" width="17" height="3.5" rx="1" fill="#fbbf24"/><line x1="21.5" y1="15" x2="21.5" y2="27" stroke="#d97706" stroke-width="1" opacity="0.5"/></svg>',
  'Холодильник 1': '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" width="36" height="36"><defs><linearGradient id="si_rf1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#f1f5f9"/><stop offset="100%" stop-color="#cbd5e1"/></linearGradient></defs><rect x="10" y="4" width="28" height="40" rx="5" fill="url(#si_rf1)"/><rect x="10" y="23" width="28" height="3" fill="#94a3b8"/><rect x="12" y="7" width="24" height="14" rx="3" fill="#f8fafc" opacity="0.85"/><rect x="12" y="28" width="24" height="13" rx="3" fill="#f8fafc" opacity="0.85"/><rect x="32" y="12" width="4" height="6" rx="2" fill="#64748b"/><rect x="32" y="31" width="4" height="6" rx="2" fill="#64748b"/><rect x="15" y="11" width="8" height="3" rx="1.5" fill="#94a3b8" opacity="0.5"/><rect x="15" y="31" width="8" height="2" rx="1" fill="#94a3b8" opacity="0.4"/><rect x="15" y="34" width="5" height="2" rx="1" fill="#94a3b8" opacity="0.3"/></svg>',
  'Холодильник 2': '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" width="36" height="36"><defs><linearGradient id="si_rf2" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#e2e8f0"/><stop offset="100%" stop-color="#cbd5e1"/></linearGradient></defs><rect x="8" y="4" width="22" height="40" rx="4" fill="url(#si_rf2)"/><path d="M30 4 Q42 4 42 12 L42 40 Q42 44 30 44 Z" fill="#dde4ed" opacity="0.65"/><rect x="10" y="9" width="18" height="4" rx="1.5" fill="#ef4444" opacity="0.72"/><rect x="10" y="15" width="18" height="4" rx="1.5" fill="#f97316" opacity="0.72"/><rect x="10" y="21" width="18" height="4" rx="1.5" fill="#22c55e" opacity="0.72"/><rect x="10" y="27" width="18" height="4" rx="1.5" fill="#facc15" opacity="0.8"/><rect x="10" y="33" width="18" height="4" rx="1.5" fill="#a78bfa" opacity="0.65"/><rect x="28" y="22" width="3" height="8" rx="1.5" fill="#94a3b8" opacity="0.45"/></svg>',
  'Морозильна камера': '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" width="36" height="36"><defs><linearGradient id="si_cup" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#93c5fd"/><stop offset="100%" stop-color="#1d4ed8"/></linearGradient></defs><circle cx="16" cy="24" r="9.5" fill="#fca5a5"/><circle cx="24" cy="21" r="9.5" fill="#bbf7d0"/><circle cx="32" cy="24" r="9.5" fill="#c4b5fd"/><circle cx="16" cy="23" r="7.5" fill="#f87171"/><circle cx="24" cy="20" r="7.5" fill="#86efac"/><circle cx="32" cy="23" r="7.5" fill="#a78bfa"/><ellipse cx="14" cy="20" rx="3" ry="2" fill="white" opacity="0.32"/><ellipse cx="22" cy="17" rx="3" ry="2" fill="white" opacity="0.32"/><ellipse cx="30" cy="20" rx="3" ry="2" fill="white" opacity="0.32"/><path d="M10 31 L13 44 Q13 46 24 46 Q35 46 35 44 L38 31 Z" fill="url(#si_cup)"/><text x="24" y="42" text-anchor="middle" font-size="9" fill="white" opacity="0.92" font-family="Arial,sans-serif">❄</text></svg>',
  'Забезпечення': '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" width="36" height="36"><defs><linearGradient id="si_bg1" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#60a5fa"/><stop offset="100%" stop-color="#1d4ed8"/></linearGradient><linearGradient id="si_bg2" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#a78bfa"/><stop offset="100%" stop-color="#6d28d9"/></linearGradient></defs><path d="M5 19 L7 43 Q7 45 15 45 L23 45 Q31 45 31 43 L33 19 Z" fill="url(#si_bg1)"/><path d="M13 19 Q13 12 19 12 Q25 12 25 19" stroke="#93c5fd" stroke-width="2.8" fill="none" stroke-linecap="round"/><rect x="8" y="29" width="17" height="2" rx="1" fill="white" opacity="0.22"/><path d="M18 17 L20 43 Q20 45 28 45 L36 45 Q44 45 44 43 L46 17 Z" fill="url(#si_bg2)"/><path d="M26 17 Q26 10 32 10 Q38 10 38 17" stroke="#c4b5fd" stroke-width="2.8" fill="none" stroke-linecap="round"/><rect x="23" y="27" width="16" height="2" rx="1" fill="white" opacity="0.2"/></svg>'
};
const NEW_SVG_ICON = '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" width="30" height="30"><defs><linearGradient id="si_new" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#c084fc"/><stop offset="100%" stop-color="#6d28d9"/></linearGradient></defs><rect x="1" y="8" width="46" height="32" rx="10" fill="url(#si_new)"/><text x="24" y="30" text-anchor="middle" font-size="15" font-weight="900" fill="white" font-family="Arial,sans-serif" letter-spacing="-0.5">NEW</text><text x="39" y="15" font-size="9" fill="white" opacity="0.85" font-family="Arial,sans-serif">✦</text><text x="6" y="37" font-size="7" fill="white" opacity="0.6" font-family="Arial,sans-serif">✦</text></svg>';
const CAT_COLORS = ['#7c3aed','#0ea5e9','#f59e0b','#06b6d4','#14b8a6','#6366f1','#22c55e'];
const sessions = new Map();

function ensureDb(){
  if(!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, {recursive:true});
  if(!fs.existsSync(DB_FILE)) writeDb({products:[], orders:[], accountingReports:[], kegAdjustments:[], notes:[], announcements:[], chatMembers:[], chatMessages:[], directMessages:[], presence:{}, readState:{}, carts:{}, sessions:{}, shops: defaultShops()});
}
function readDb(){
  ensureDb();
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const db = JSON.parse(raw);
    db.products=db.products||[];
    db.orders=db.orders||[];
    db.accountingReports=Array.isArray(db.accountingReports)?db.accountingReports:[];
    db.kegTypes=Array.isArray(db.kegTypes)?db.kegTypes:[];
    db.kegReturns=Array.isArray(db.kegReturns)?db.kegReturns:[];
    db.kegAdjustments=Array.isArray(db.kegAdjustments)?db.kegAdjustments:[];
    db.kegTransfers=Array.isArray(db.kegTransfers)?db.kegTransfers:[];
    db.productBarcodes=Array.isArray(db.productBarcodes)?db.productBarcodes:[];
    db.applications=Array.isArray(db.applications)?db.applications:[];
    db.applicationLogs=Array.isArray(db.applicationLogs)?db.applicationLogs:[];
    db.notes=db.notes||[];
    db.announcements=db.announcements||[];
    db.chatMembers=Array.isArray(db.chatMembers)?db.chatMembers:[];
    db.chatMessages=Array.isArray(db.chatMessages)?db.chatMessages:[];
    db.directMessages=Array.isArray(db.directMessages)?db.directMessages:[];
    db.presence=db.presence||{};
    db.readState=db.readState||{};
    db.carts=db.carts||{};
    db.sessions=db.sessions||{};
    normalizeShops(db);
    normalizeChat(db);
    sortProductsInCategories(db);
    return db;
  } catch(error) {
    console.error(`[database] Не вдалося прочитати ${DB_FILE}. Запис заблоковано, щоб не перезаписати дані порожньою базою.`, error);
    const dbError = new Error('База даних тимчасово недоступна або пошкоджена. Дані не були перезаписані.');
    dbError.code = 'DB_READ_FAILED';
    dbError.cause = error;
    throw dbError;
  }
}
function writeDb(db){ normalizeShops(db); normalizeChat(db); sortProductsInCategories(db); fs.writeFileSync(DB_FILE, JSON.stringify(db,null,2)); }
function passwordHash(password){
  const salt = crypto.randomBytes(16).toString('hex');
  const iterations = 120000;
  const hash = crypto.pbkdf2Sync(String(password || ''), salt, iterations, 32, 'sha256').toString('hex');
  return `pbkdf2$${iterations}$${salt}$${hash}`;
}
function passwordVerify(password, stored){
  const value = String(stored || '');
  if(value.startsWith('pbkdf2$')){
    const parts = value.split('$');
    if(parts.length !== 4) return false;
    const iterations = Number(parts[1]);
    const salt = parts[2];
    const expected = parts[3];
    if(!iterations || !salt || !expected) return false;
    const actual = crypto.pbkdf2Sync(String(password || ''), salt, iterations, 32, 'sha256').toString('hex');
    try { return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex')); } catch(e){ return false; }
  }
  return value && String(password || '') === value;
}
function adminPasswordStored(db){ return db && db.adminPasswordHash ? String(db.adminPasswordHash) : passwordHash(DEFAULT_ADMIN_PASSWORD); }
function checkAdminPassword(db, password){ return passwordVerify(password, adminPasswordStored(db)); }
function setAdminPassword(db, password){ db.adminPasswordHash = passwordHash(password); return db.adminPasswordHash; }
function defaultShops(){ return DEFAULT_SHOPS.map((name,i)=>({id:String(i+1), name, password:SHOP_PASSWORD})); }
function normalizeShops(db){
  db.shops = Array.isArray(db.shops) && db.shops.length ? db.shops : defaultShops();
  db.shops = db.shops.map((shop,i)=>{
    if(typeof shop === 'string') return {id:String(i+1), name:shop, password:SHOP_PASSWORD};
    return {id:String(shop.id || Date.now()+i), name:String(shop.name || '').trim(), password:String(shop.password || SHOP_PASSWORD)};
  }).filter(shop=>shop.name);
  return db.shops;
}
function getShops(db=readDb()){ return normalizeShops(db); }
function getShopNames(db=readDb()){ return getShops(db).map(s=>s.name); }
function findShopById(db, id){ return getShops(db).find(s=>String(s.id)===String(id)); }
function isValidShop(shop){ return getShopNames().includes(String(shop || '')); }
function isValidShopInDb(db, shop){ return getShopNames(db).includes(String(shop || '')); }
function checkShopPassword(db, name, password){ const shop=getShops(db).find(s=>s.name===String(name || '')); return !!shop && String(shop.password)===String(password || ''); }
function sortProductsInCategories(db){
  db.products=(db.products||[]).sort((a,b)=>{
    const ca=CATEGORIES.indexOf(String(a.category||''));
    const cb=CATEGORIES.indexOf(String(b.category||''));
    if(ca!==cb)return ca-cb;
    return String(a.name||'').localeCompare(String(b.name||''),'uk',{sensitivity:'base'});
  });
}

function normalizeChat(db){
  db.chatMembers = Array.isArray(db.chatMembers) ? db.chatMembers.map(String).filter(Boolean) : [];
  db.chatMembers = [...new Set(db.chatMembers)].filter(name=>isValidShopInDb(db, name));
  db.chatMessages = Array.isArray(db.chatMessages) ? db.chatMessages : [];
  db.chatMessages = db.chatMessages.map((m,i)=>({
    id:String(m.id || Date.now()+i),
    authorType:m.authorType==='admin'?'admin':'shop',
    author:String(m.author || ''),
    text:String(m.text || ''),
    createdAt:String(m.createdAt || ''),
    createdMs:Number(m.createdMs || m.id || 0) || 0
  })).filter(m=>m.text);
  db.directMessages = Array.isArray(db.directMessages) ? db.directMessages : [];
  db.directMessages = db.directMessages.map((m,i)=>({
    id:String(m.id || Date.now()+i),
    shop:String(m.shop || ''),
    authorType:m.authorType==='admin'?'admin':'shop',
    text:String(m.text || ''),
    createdAt:String(m.createdAt || ''),
    createdMs:Number(m.createdMs || m.id || 0) || 0
  })).filter(m=>m.text && isValidShopInDb(db, m.shop));
}
function canUseChat(db, session){ return !!(session && (session.admin || (session.shop && db.chatMembers.includes(session.shop)))); }

function nowMs(){ return Date.now(); }
function readerKey(session){ if(!session) return ''; if(session.admin) return 'admin'; if(session.shop) return 'shop:'+session.shop; return ''; }
function ensureReadState(db, key){ db.readState=db.readState||{}; if(key && !db.readState[key]) db.readState[key]={newProducts:0, announcements:0, chat:0, directMessages:0, notifications:0}; if(key && db.readState[key].directMessages===undefined) db.readState[key].directMessages=0; if(key && db.readState[key].notifications===undefined) db.readState[key].notifications=0; return key?db.readState[key]:{}; }
function badge(n){ return n>0 ? `<span class="notifBadge">+${n}</span>` : ''; }
function badgeCount(n){ return n>0 ? `<span class="notifBadge notifBadgeCount">${n}</span>` : ''; }
function unreadCounts(db, session){
  const key=readerKey(session); if(!key) return {newProducts:0, announcements:0, chat:0};
  const seen=ensureReadState(db, key);
  const newProducts=(db.products||[]).filter(p=>p.isNew && !p.hidden && Number(p.newAt || 0)>Number(seen.newProducts || 0)).length;
  const announcements=(db.announcements||[]).filter(a=>Number(a.createdMs || a.id || 0)>Number(seen.announcements || 0)).length;
  const chat=(db.chatMessages||[]).filter(m=>Number(m.createdMs || m.id || 0)>Number(seen.chat || 0) && (session.admin ? m.authorType!=='admin' : m.authorType==='admin')).length;
  const directMessages=(db.directMessages||[]).filter(m=>Number(m.createdMs || 0)>Number(seen.directMessages || 0) && (session.admin ? m.authorType==='shop' : (m.authorType==='admin' && m.shop===session.shop))).length;
  return {newProducts, announcements, chat, directMessages};
}
function markRead(db, session, section){ const key=readerKey(session); if(!key) return; const seen=ensureReadState(db, key); seen[section]=nowMs(); writeDb(db); }
function adminDirectUnread(db){ const seen=ensureReadState(db,'admin'); return (db.directMessages||[]).filter(m=>m.authorType==='shop' && Number(m.createdMs||0)>Number(seen.directMessages||0)).length; }
function eventMs(x){ return Number(x&& (x.statusUpdatedMs||x.updatedMs||x.createdMs||x.id) || 0) || 0; }
function notificationItems(db, session){
  const seen=ensureReadState(db,readerKey(session));
  const after=Number(seen.notifications||0), out=[];
  const add=(time,icon,title,text,href,type)=>{time=Number(time||0);if(time>after)out.push({time,icon,title,text,href,type});};
  if(session.admin){
    (db.orders||[]).forEach(o=>add(eventMs(o),'📦','Нова заявка від магазину',`№${o.orderNo||o.id} · ${o.shop||''}`,'/admin-orders','orders'));
    (db.kegReturns||[]).filter(r=>r.status==='Очікує перевірки').forEach(r=>add(eventMs(r),'🛢️','Кеги очікують підтвердження',`№${r.number||''} · ${r.shop||''}`,'/admin-kegs','kegs'));
    (db.kegTransfers||[]).filter(t=>t.status==='Очікує підтвердження складу').forEach(t=>add(eventMs(t),'🔄','Нове переміщення кег',`${t.fromShop||''} → ${t.toShop||''}`,'/admin-kegs','kegTransfers'));
    (db.directMessages||[]).filter(m=>m.authorType==='shop').forEach(m=>add(eventMs(m),'✉️','Нове повідомлення',m.shop||'Магазин','/admin-messages?shop='+encodeURIComponent(m.shop||''),'messages'));
    (db.chatMessages||[]).filter(m=>m.authorType==='shop').forEach(m=>add(eventMs(m),'💬','Нове повідомлення в чаті',m.author||'Магазин','/admin-chat','chat'));
  }else if(session.shop){
    const shop=session.shop;
    (db.kegTransfers||[]).filter(t=>(t.fromShop===shop||t.toShop===shop) && t.status!=='Очікує підтвердження складу').forEach(t=>{
      const needs=t.toShop===shop&&t.status==='Очікує підтвердження магазину';
      add(eventMs(t),needs?'✅':'🔄',needs?'Потрібно підтвердити отримання кег':'Оновлено статус переміщення',`${t.number||''} · ${t.status||''}`,'/kegs','kegTransfers');
    });
    (db.kegReturns||[]).filter(r=>r.shop===shop&&r.status!=='Очікує перевірки').forEach(r=>add(eventMs(r),'🛢️','Оновлено заявку по кегах',`№${r.number||''} · ${r.status||''}`,'/kegs','kegs'));
    (db.directMessages||[]).filter(m=>m.authorType==='admin'&&m.shop===shop).forEach(m=>add(eventMs(m),'✉️','Нове повідомлення від складу','Відкрийте повідомлення','/messages','messages'));
    (db.announcements||[]).forEach(a=>add(eventMs(a),'📢','Нове оголошення',String(a.text||'').slice(0,90),'/about','announcements'));
    if(canUseChat(db,session))(db.chatMessages||[]).filter(m=>m.authorType==='admin').forEach(m=>add(eventMs(m),'💬','Нове повідомлення в чаті','Від складу','/chat','chat'));
  }
  return out.sort((a,b)=>b.time-a.time).slice(0,50);
}
function notificationsCount(db,session){ return notificationItems(db,session).length; }
function notificationsPanel(db,session,compact=false){
  const items=notificationItems(db,session), href=session.admin?'/admin-notifications':'/notifications';
  if(!items.length)return '';
  const shown=compact?items.slice(0,5):items;
  return `<div class="card notificationCenter"><div class="notificationHead"><div><h2>🔔 Нові сповіщення</h2><p class="muted">Показуються лише нові події</p></div><span class="notifBadge notifBadgeCount">${items.length}</span></div><div class="notificationList">${shown.map(n=>`<a class="notificationItem" href="${n.href}"><span class="notificationIcon">${n.icon}</span><span><b>${esc(n.title)}</b><small>${esc(n.text)}</small></span><span class="adminCabinetArrow">›</span></a>`).join('')}</div>${compact?`<a class="btn secondary notificationAll" href="${href}">Переглянути всі</a>`:''}</div>`;
}
function notificationsPage(db,session){ const html=notificationsPanel(db,session,false)||'<div class="card center"><h2>Нових сповіщень немає</h2><p class="muted">Старі переглянуті події повторно не показуються.</p></div>'; return session.admin?`<div class="adminShell">${adminMenu()}<section><h1>Центр сповіщень</h1>${html}</section></div>`:`<section><h1>Центр сповіщень</h1>${html}</section>`; }

function chatMessagesHtml(db, canDelete=false){
  const messages=(db.chatMessages || []).slice(-300);
  return messages.map(m=>{
    const isAdmin=m.authorType==='admin';
    const name=isAdmin?'Склад':m.author;
    const del=canDelete?`<form class="directDeleteForm chatDeleteForm" method="post" action="/chat/delete" onsubmit="return deleteDirectMessage(this)"><input type="hidden" name="id" value="${esc(m.id)}"><button class="deleteIcon messageDeleteBtn" title="Видалити повідомлення" aria-label="Видалити повідомлення">×</button></form>`:'';
    return `<div class="chatMessage ${isAdmin?'adminMsg':'shopMsg'}" data-message-id="${esc(m.id)}"><div class="chatMeta"><b class="${isAdmin?'adminName':'shopName'}">${esc(name)}</b>${del}</div><div class="chatText">${esc(m.text || '')}</div></div>`;
  }).join('') || '<div class="chatEmpty">Повідомлень поки немає</div>';
}
function chatPage(db, session){
  const who=session.admin?'Склад':session.shop;
  return `<section><div class="actions" style="align-items:center;justify-content:space-between;margin-bottom:12px"><h1 style="margin:0">Чат</h1>${session.admin?'<a class="btn secondary" href="/admin-chat">Учасники чату</a>':''}</div><div class="card chatBox"><div class="chatHeader"><div><h2>Повідомлення</h2></div></div><div class="chatMessages">${chatMessagesHtml(db, !!session.admin)}</div><form class="form chatForm" method="post" action="/chat/send"><label>Повідомлення від ${esc(who || '')}<textarea name="text" required placeholder="Напишіть повідомлення..."></textarea></label><button>Надіслати</button></form></div></section>`;
}
function adminChatPage(db, session){
  const shops=getShops(db);
  const members=new Set(db.chatMembers || []);
  return `<div class="adminShell">${adminMenu()}<section><div class="actions" style="align-items:center;justify-content:space-between;margin-bottom:12px"><h1 style="margin:0">Чат</h1><a class="btn secondary" href="/chat">Відкрити чат</a></div><div class="card" style="padding:20px;margin-bottom:16px"><h2>Учасники чату</h2><p class="muted">Позначте магазини, яким доступний чат. Інші магазини не бачитимуть кнопку та не зможуть відкрити чат.</p><form method="post" action="/admin/chat-members"><div class="shopChecks">${shops.map(shop=>`<label class="shopCheck"><span class="shopCheckName">${esc(shop.name)}</span><input type="checkbox" name="members" value="${esc(shop.name)}" ${members.has(shop.name)?'checked':''}></label>`).join('')}</div><button>Зберегти учасників</button></form></div><div class="card chatBox"><div class="chatHeader"><div><h2>Повідомлення</h2><p class="muted">Відповідайте магазинам у зручному чистому вікні.</p></div></div><div class="chatMessages">${chatMessagesHtml(db, true)}</div><form class="form chatForm" method="post" action="/chat/send"><label>Повідомлення від складу<textarea name="text" required placeholder="Напишіть повідомлення магазинам..."></textarea></label><button>Надіслати</button></form></div></section></div>`;
}

function adminMenu(){ const menuDb=readDb(),msgUnread=adminDirectUnread(menuDb),notifUnread=notificationsCount(menuDb,{admin:true}); return `<a class="mobileBackToCabinet" href="/admin">← Перейти у Кабінет складу</a><aside class="adminMenu"><div class="adminMenuHead"><a class="adminMenuLogo" href="/admin" style="text-decoration:none">Кабінет</a></div><a href="/admin-notifications">Сповіщення${badgeCount(notifUnread)}</a><a href="/admin-settings">Налаштування магазинів</a><a href="/admin-products">Товар</a><a href="/admin-new-products">Новинки</a><a href="/admin-applications">Нова заявка</a><a data-unread-key="directMessages" href="/admin-messages">Повідомлення${badgeCount(msgUnread)}</a><a href="/admin-notes">Нотатки</a><a href="/admin-announcements">Оголошення</a><a href="/admin-chat">Чат</a><a href="/admin-orders">Замовлення</a><a href="/admin-accounting">Журнал обліку</a><a href="/admin-kegs">Облік кег</a><a href="/admin-keg-types">Редагувати список кег</a><a href="/admin-hidden-products">Приховані позиції</a><a href="/admin-backup">Резервна копія</a><a href="/admin-logout" class="adminMenuLogout">Вийти</a></aside>`; }

function shopPresence(db, shop){
  const p=(db.presence||{})[shop]||{};
  const last=Number(p.lastSeenMs||0);
  const diff=nowMs()-last;
  const online=last>0 && diff<2*60*1000;
  const mins=Math.max(1, Math.floor(diff/60000));
  return {online, text: online?'Онлайн':(last?`був онлайн ${mins} хв тому`:'Офлайн')};
}
function touchPresence(db, session){
  if(!session || !session.shop) return;
  db.presence=db.presence||{};
  db.presence[session.shop]={lastSeenMs:nowMs(), lastSeenAt:warsawTime()};
  writeDb(db);
}
function directMessagesFor(db, shop){ return (db.directMessages||[]).filter(m=>m.shop===shop).sort((a,b)=>Number(a.createdMs||0)-Number(b.createdMs||0)); }
function directMessagesHtml(db, shop, canDelete=false){
  const messages=directMessagesFor(db, shop).slice(-300);
  return messages.map(m=>{
    const isAdmin=m.authorType==='admin';
    const name=isAdmin?'Склад':m.shop;
    const del=canDelete?`<form class="directDeleteForm" method="post" action="/messages/delete" onsubmit="return deleteDirectMessage(this)"><input type="hidden" name="id" value="${esc(m.id)}"><input type="hidden" name="shop" value="${esc(shop)}"><button class="deleteIcon messageDeleteBtn" title="Видалити повідомлення" aria-label="Видалити повідомлення">×</button></form>`:'';
    return `<div class="chatMessage ${isAdmin?'adminMsg':'shopMsg'}" data-message-id="${esc(m.id)}"><div class="chatMeta"><b class="${isAdmin?'adminName':'shopName'}">${esc(name)}</b><span class="muted" style="font-size:11px;margin-left:6px">${esc(m.createdAt||'')}</span>${del}</div><div class="chatText">${esc(m.text||'')}</div></div>`;
  }).join('') || '<div class="chatEmpty">Повідомлень поки немає</div>';
}
function adminCabinetPage(db){
  const shops=getShops(db);
  const items=[['Сповіщення','/admin-notifications','🔔',notificationsCount(db,{admin:true})],['Налаштування магазинів','/admin-settings','⚙️'],['Товар','/admin-products','📦'],['Новинки','/admin-new-products','🆕',(db.products||[]).filter(p=>p.isNew&&!p.hidden).length],['Нова заявка','/admin-applications','📲'],['Повідомлення','/admin-messages','✉️',adminDirectUnread(db)],['Нотатки','/admin-notes','📝'],['Оголошення','/admin-announcements','📢'],['Чат','/admin-chat','💬'],['Замовлення','/admin-orders','🧾'],['Журнал обліку','/admin-accounting','📒'],['Облік кег','/admin-kegs','🛢️'],['Редагувати список кег','/admin-keg-types','🧰'],['Приховані позиції','/admin-hidden-products','🙈'],['Резервна копія','/admin-backup','💾'],['Вийти зі складу','/admin-logout','🚪']];
  return `<div class="adminShell adminHomeShell">${adminMenu()}<section><h1>Кабінет складу</h1>${notificationsPanel(db,{admin:true},true)}<div class="adminCabinetList">${items.map(i=>`<a class="adminCabinetItem" href="${i[1]}"><span class="adminCabinetIcon">${i[2]}</span><span>${i[0]}${badgeCount(i[3]||0)}</span><span class="adminCabinetArrow">›</span></a>`).join('')}</div></section></div>`;
}
function shopCabinetPage(db, session){
  const unread=unreadCounts(db, session);
  const items=[['Сповіщення','/notifications','🔔',notificationsCount(db,session)],['Каталог','/catalog','🛍️'],['Кеги',session.shop==='Склад'?'/warehouse-kegs':'/kegs','🛢️'],['Журнал обліку','/cabinet/accounting','📒'],['Кошик','/cart','🛒',(session.cart||[]).reduce((a,i)=>a+Number(i.qty||0),0)],['Повідомлення','/messages','✉️',unread.directMessages],['Оголошення','/about','📢',unread.announcements]];
  if(canUseChat(db, session)) items.push(['Чат','/chat','💬',unread.chat]);
  items.push(['Вийти','/shop-logout','🚪']);
  return `<section><h1>Кабінет магазину</h1><p class="muted" style="margin-top:-8px;margin-bottom:16px">${esc(session.shop||'')}</p>${notificationsPanel(db,session,true)}<div class="adminCabinetList shopCabinetList">${items.map(i=>`<a class="adminCabinetItem" href="${i[1]}"><span class="adminCabinetIcon">${i[2]}</span><span>${i[0]}${badgeCount(i[3]||0)}</span><span class="adminCabinetArrow">›</span></a>`).join('')}</div></section>`;
}
function adminMessagesPage(db, selected=''){
  const shops=getShops(db); const active=selected && isValidShopInDb(db, selected) ? selected : (shops[0]&&shops[0].name)||'';
  return `<div class="adminShell">${adminMenu()}<section><h1>Повідомлення</h1><div class="messagesLayout"><div class="card shopMessagesList"><h2>Магазини</h2>${shops.map(shop=>{const st=shopPresence(db,shop.name);return `<a class="messageShop ${shop.name===active?'active':''}" href="/admin-messages?shop=${encodeURIComponent(shop.name)}"><span><b>${esc(shop.name)}</b><small>${esc(st.text)}</small></span><span class="onlineDot ${st.online?'isOnline':'isOffline'}"></span></a>`}).join('')}</div><div class="card chatBox"><div class="chatHeader"><div><h2>${esc(active||'Магазин')}</h2><p class="muted">Повноцінний діалог між працівником складу і магазином.</p></div></div><div class="chatMessages" data-direct-messages="1">${active?directMessagesHtml(db,active,true):'<div class="chatEmpty">Немає магазинів</div>'}</div>${active?`<form class="form chatForm" method="post" action="/messages/send"><input type="hidden" name="shop" value="${esc(active)}"><label>Повідомлення від складу<textarea name="text" required placeholder="Напишіть повідомлення магазину..."></textarea></label><button>Надіслати</button></form>`:''}</div></div></section></div>`;
}
function shopMessagesPage(db, session){
  const shop=session.shop;
  return `<section><h1>Повідомлення</h1><div class="card chatBox"><div class="chatHeader"><div><h2>Діалог зі складом</h2><p class="muted">Тут можна написати працівнику складу та отримати відповідь.</p></div></div><div class="chatMessages" data-direct-messages="1">${directMessagesHtml(db,shop,false)}</div><form class="form chatForm" method="post" action="/messages/send"><label>Ваше повідомлення<textarea name="text" required placeholder="Напишіть повідомлення працівнику складу..."></textarea></label><button>Надіслати</button></form></div></section>`;
}


function moneyNum(v){
  let s=String(v==null?'':v).trim();
  if(!s) return 0;
  s=s.replace(/\s+/g,'').replace(/ /g,'');
  const hasComma=s.includes(','), hasDot=s.includes('.');
  if(hasComma && hasDot){
    const lastComma=s.lastIndexOf(','), lastDot=s.lastIndexOf('.');
    if(lastComma>lastDot) s=s.replace(/\./g,'').replace(',','.');
    else s=s.replace(/,/g,'');
  } else {
    s=s.replace(',', '.');
  }
  s=s.replace(/[^0-9.\-]/g,'').replace(/(?!^)-/g,'');
  const parts=s.split('.');
  if(parts.length>2) s=parts.shift()+'.'+parts.join('');
  const n=Number(s);
  return Number.isFinite(n)?Math.round(n*100)/100:0;
}
function money(v){ return moneyNum(v).toFixed(2).replace('.', ','); }
function moneyInput(v){ return moneyNum(v).toFixed(2).replace('.', ','); }
function moneyExcel(v){ return moneyNum(v).toFixed(2); }
function todayIsoWarsaw(){ return new Date().toLocaleDateString('sv-SE',{timeZone:'Europe/Warsaw'}); }
function calcAccounting(r){
  const opening=moneyNum(r.openingBalance), fiscal=moneyNum(r.fiscalReport), terminal=moneyNum(r.terminalClose), actual=moneyNum(r.actualCash), office=moneyNum(r.sentToOffice);
  const cash=moneyNum(fiscal-terminal);
  const discrepancy=moneyNum(actual-opening-cash);
  const closing=moneyNum(actual-office);
  return {...r, openingBalance:opening, fiscalReport:fiscal, terminalClose:terminal, cash, actualCash:actual, discrepancy, sentToOffice:office, closingBalance:closing};
}
function accountingRows(db){ return (db.accountingReports||[]).slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')) || (Number(b.createdMs||0)-Number(a.createdMs||0))); }
function lastShopAccountingReport(db, shop){ return accountingRows(db).find(r=>String(r.shop||'')===String(shop||'')) || null; }
function canShopEditAccountingReport(db, session, id){
  const last=lastShopAccountingReport(db, session&&session.shop);
  return !!(last && String(last.id)===String(id));
}
function accountingTableRows(reports, admin=false, shopEdit=false){
  return reports.map((r,n)=>`<tr><td>${n+1}</td>${admin?`<td>${esc(r.shop||'')}</td>`:''}<td>${esc(r.date||'')}</td><td>${money(r.openingBalance)}</td><td>${money(r.fiscalReport)}</td><td>${money(r.terminalClose)}</td><td>${money(r.cash)}</td><td>${money(r.actualCash)}</td><td class="${Math.abs(moneyNum(r.discrepancy))>0.009?'warnText':''}">${money(r.discrepancy)}</td><td>${money(r.sentToOffice)}</td><td>${money(r.closingBalance)}</td><td>${esc(r.comment||'')}</td>${admin?`<td><div class="actions" style="gap:6px;flex-wrap:nowrap"><a class="btn secondary compactBtn" href="/admin-accounting-view?id=${encodeURIComponent(r.id)}">Перегляд</a><a class="btn secondary compactBtn" href="/admin-accounting-edit?id=${encodeURIComponent(r.id)}">Редагувати</a><form method="post" action="/admin-accounting-delete" onsubmit="return confirm('Видалити цей звіт?')"><input type="hidden" name="id" value="${esc(r.id)}"><button class="btn secondary compactBtn">Видалити</button></form></div></td>`:(shopEdit?`<td>${n===0?`<a class="btn secondary compactBtn" href="/accounting/edit?id=${encodeURIComponent(r.id)}">Редагувати</a>`:`<span class="muted">Тільки перегляд</span>`}</td>`:'')}</tr>`).join('') || `<tr><td colspan="${admin?13:(shopEdit?12:11)}" class="center muted" style="padding:24px">Записів поки немає</td></tr>`;
}
function accountingPage(db, session){
  const reports=accountingRows(db).filter(r=>r.shop===session.shop).slice(0,60);
  const last=reports[0];
  const opening=last?moneyInput(last.closingBalance):'0,00';
  return `<section><div class="actions" style="align-items:center;justify-content:space-between;margin-bottom:12px"><h1 style="margin:0">Журнал обліку</h1><a class="btn secondary" href="/cabinet">До кабінету магазину</a></div><div class="card" style="padding:20px;margin-bottom:16px"><h2>Новий щоденний звіт</h2><p class="muted" style="margin-bottom:14px">Після збереження запис одразу зʼявиться в адмін-панелі складу. Кількість звітів за день не обмежена. Редагувати можна тільки останній надісланий звіт.</p><form class="form accountingForm" method="post" action="/accounting/save"><label>Дата<input type="date" name="date" value="${todayIsoWarsaw()}" required></label><label>Залишок на початок дня<input type="text" inputmode="decimal" name="openingBalance" value="${opening}" required oninput="calcAccountingForm(this.form)"></label><label>Фіскальний рапорт<input type="text" inputmode="decimal" name="fiscalReport" required oninput="calcAccountingForm(this.form)"></label><label>Закриття дня по терміналу<input type="text" inputmode="decimal" name="terminalClose" required oninput="calcAccountingForm(this.form)"></label><label>Каса<input type="text" inputmode="decimal" name="cash" readonly></label><label>Всього готівки в касі фактично<input type="text" inputmode="decimal" name="actualCash" required oninput="calcAccountingForm(this.form)"></label><label>Розбіжність<input type="text" inputmode="decimal" name="discrepancy" readonly></label><label>Передано в офіс<input type="text" inputmode="decimal" name="sentToOffice" required oninput="calcAccountingForm(this.form)"></label><label>Залишок у касі<input type="text" inputmode="decimal" name="closingBalance" readonly></label><label>Коментар<textarea name="comment" rows="3" placeholder="Необовʼязково"></textarea></label><button class="accountingSubmitBtn">Зберегти і надіслати</button></form></div><h2>Мої записи</h2><div class="listWrap"><table class="listTable accountingTable"><thead><tr><th>№</th><th>Дата</th><th>Залишок поч.</th><th>Фіскальний</th><th>Термінал</th><th>Каса</th><th>Факт.</th><th>Розбіжність</th><th>Офіс</th><th>Залишок</th><th>Коментар</th><th>Дія</th></tr></thead><tbody>${accountingTableRows(reports,false,true)}</tbody></table></div></section>`;
}
function shopAccountingEditPage(db, session, id){
  if(!canShopEditAccountingReport(db, session, id)) return `<section class="card center"><h1>Цей звіт недоступний для редагування</h1><p class="muted">Магазин може редагувати тільки останній надісланий звіт. Старі звіти доступні лише для перегляду.</p><a class="btn" href="/cabinet/accounting">Назад до журналу</a></section>`;
  const r=lastShopAccountingReport(db, session.shop);
  return `<section><div class="actions" style="align-items:center;justify-content:space-between;margin-bottom:12px"><h1 style="margin:0">Редагування останнього звіту</h1><a class="btn secondary" href="/cabinet/accounting">Назад</a></div><div class="card" style="padding:20px"><form class="form accountingForm" method="post" action="/accounting/update"><input type="hidden" name="id" value="${esc(r.id)}"><label>Дата<input type="date" name="date" value="${esc(r.date||todayIsoWarsaw())}" required></label><label>Залишок на початок дня<input type="text" inputmode="decimal" name="openingBalance" value="${moneyInput(r.openingBalance)}" required oninput="calcAccountingForm(this.form)"></label><label>Фіскальний рапорт<input type="text" inputmode="decimal" name="fiscalReport" value="${moneyInput(r.fiscalReport)}" required oninput="calcAccountingForm(this.form)"></label><label>Закриття дня по терміналу<input type="text" inputmode="decimal" name="terminalClose" value="${moneyInput(r.terminalClose)}" required oninput="calcAccountingForm(this.form)"></label><label>Каса<input type="text" inputmode="decimal" name="cash" value="${moneyInput(r.cash)}" readonly></label><label>Всього готівки в касі фактично<input type="text" inputmode="decimal" name="actualCash" value="${moneyInput(r.actualCash)}" required oninput="calcAccountingForm(this.form)"></label><label>Розбіжність<input type="text" inputmode="decimal" name="discrepancy" value="${moneyInput(r.discrepancy)}" readonly></label><label>Передано в офіс<input type="text" inputmode="decimal" name="sentToOffice" value="${moneyInput(r.sentToOffice)}" required oninput="calcAccountingForm(this.form)"></label><label>Залишок у касі<input type="text" inputmode="decimal" name="closingBalance" value="${moneyInput(r.closingBalance)}" readonly></label><label>Коментар<textarea name="comment" rows="3">${esc(r.comment||'')}</textarea></label><button class="accountingSubmitBtn">Зберегти зміни</button></form></div></section>`;
}
function adminAccountingPage(db, url){
  const shop=url.searchParams.get('shop')||''; const from=url.searchParams.get('from')||''; const to=url.searchParams.get('to')||''; const discrepancy=url.searchParams.get('discrepancy')||'';
  let reports=accountingRows(db).filter(r=>(!shop||r.shop===shop)&&(!from||String(r.date)>=from)&&(!to||String(r.date)<=to)&&(!discrepancy||Math.abs(moneyNum(r.discrepancy))>0.009));
  const qs=new URLSearchParams(); if(shop)qs.set('shop',shop); if(from)qs.set('from',from); if(to)qs.set('to',to); if(discrepancy)qs.set('discrepancy',discrepancy);
  return `<div class="adminShell">${adminMenu()}<section><div class="actions" style="align-items:center;justify-content:space-between;margin-bottom:12px"><h1 style="margin:0">Журнал обліку</h1><a class="btn" href="/admin-accounting-export?${qs.toString()}">⬇️ Скачать Excel</a></div><div class="card" style="padding:16px;margin-bottom:16px"><form class="form" method="get" action="/admin-accounting" style="grid-template-columns:repeat(5,1fr);align-items:end"><label>Користувач<select name="shop"><option value="">Усі</option>${getShops(db).map(s=>`<option value="${esc(s.name)}" ${s.name===shop?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label><label>Від дати<input type="date" name="from" value="${esc(from)}"></label><label>До дати<input type="date" name="to" value="${esc(to)}"></label><label>Розбіжність<select name="discrepancy"><option value="">Усі</option><option value="1" ${discrepancy?'selected':''}>Тільки з розбіжністю</option></select></label><button>Фільтрувати</button></form></div><div class="listWrap"><table class="listTable accountingTable"><thead><tr><th>№</th><th>Магазин</th><th>Дата</th><th>Залишок поч.</th><th>Фіскальний</th><th>Термінал</th><th>Каса</th><th>Факт.</th><th>Розбіжність</th><th>Офіс</th><th>Залишок</th><th>Коментар</th><th>Дія</th></tr></thead><tbody>${accountingTableRows(reports,true)}</tbody></table></div></section></div>`;
}
function adminAccountingViewPage(db, id){ const r=(db.accountingReports||[]).find(x=>String(x.id)===String(id)); if(!r) return `<div class="adminShell">${adminMenu()}<section class="card center"><h1>Запис не знайдено</h1><a class="btn" href="/admin-accounting">Назад</a></section></div>`; return `<div class="adminShell">${adminMenu()}<section><div class="actions" style="align-items:center;justify-content:space-between;margin-bottom:12px"><h1 style="margin:0">Звіт: ${esc(r.shop)} · ${esc(r.date)}</h1><div class="actions"><a class="btn secondary" href="/admin-accounting-edit?id=${encodeURIComponent(r.id)}">Редагувати</a><a class="btn secondary" href="/admin-accounting">Назад</a></div></div><div class="card" style="padding:20px"><table class="listTable"><tbody>${[['Дата',r.date],['Магазин',r.shop],['Залишок на початок дня',money(r.openingBalance)],['Фіскальний рапорт',money(r.fiscalReport)],['Закриття дня по терміналу',money(r.terminalClose)],['Каса',money(r.cash)],['Всього готівки фактично',money(r.actualCash)],['Розбіжність',money(r.discrepancy)],['Передано в офіс',money(r.sentToOffice)],['Залишок у касі',money(r.closingBalance)],['Коментар',r.comment||''],['Створено',r.createdAt||''],['Оновлено',r.updatedAt||'']].map(x=>`<tr><th style="width:280px">${esc(x[0])}</th><td>${esc(x[1])}</td></tr>`).join('')}</tbody></table><form method="post" action="/admin-accounting-delete" onsubmit="return confirm('Видалити цей звіт?')" style="margin-top:14px"><input type="hidden" name="id" value="${esc(r.id)}"><button class="secondary">Видалити звіт</button></form></div></section></div>`; }
function adminAccountingEditPage(db, id){ const r=(db.accountingReports||[]).find(x=>String(x.id)===String(id)); if(!r) return `<div class="adminShell">${adminMenu()}<section class="card center"><h1>Запис не знайдено</h1><a class="btn" href="/admin-accounting">Назад</a></section></div>`; return `<div class="adminShell">${adminMenu()}<section><div class="actions" style="align-items:center;justify-content:space-between;margin-bottom:12px"><h1 style="margin:0">Редагування звіту</h1><a class="btn secondary" href="/admin-accounting">Назад</a></div><div class="card" style="padding:20px"><form class="form accountingForm" method="post" action="/admin-accounting-update"><input type="hidden" name="id" value="${esc(r.id)}"><label>Магазин<select name="shop" required>${getShops(db).map(s=>`<option value="${esc(s.name)}" ${s.name===r.shop?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label><label>Дата<input type="date" name="date" value="${esc(r.date||todayIsoWarsaw())}" required></label><label>Залишок на початок дня<input type="text" inputmode="decimal" name="openingBalance" value="${moneyInput(r.openingBalance)}" required oninput="calcAccountingForm(this.form)"></label><label>Фіскальний рапорт<input type="text" inputmode="decimal" name="fiscalReport" value="${moneyInput(r.fiscalReport)}" required oninput="calcAccountingForm(this.form)"></label><label>Закриття дня по терміналу<input type="text" inputmode="decimal" name="terminalClose" value="${moneyInput(r.terminalClose)}" required oninput="calcAccountingForm(this.form)"></label><label>Каса<input type="text" inputmode="decimal" name="cash" value="${moneyInput(r.cash)}" readonly></label><label>Всього готівки в касі фактично<input type="text" inputmode="decimal" name="actualCash" value="${moneyInput(r.actualCash)}" required oninput="calcAccountingForm(this.form)"></label><label>Розбіжність<input type="text" inputmode="decimal" name="discrepancy" value="${moneyInput(r.discrepancy)}" readonly></label><label>Передано в офіс<input type="text" inputmode="decimal" name="sentToOffice" value="${moneyInput(r.sentToOffice)}" required oninput="calcAccountingForm(this.form)"></label><label>Залишок у касі<input type="text" inputmode="decimal" name="closingBalance" value="${moneyInput(r.closingBalance)}" readonly></label><label>Коментар<textarea name="comment" rows="3">${esc(r.comment||'')}</textarea></label><button>Зберегти зміни</button></form></div></section></div>`; }
function xmlEsc(v){ return String(v==null?'':v).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[ch])); }
function crc32buf(buf){ let c=~0; for(let i=0;i<buf.length;i++){ c^=buf[i]; for(let k=0;k<8;k++) c=(c>>>1)^(0xEDB88320&-(c&1)); } return (~c)>>>0; }
function zipStore(files){ const locals=[], centrals=[]; let offset=0; for(const f of files){ const name=Buffer.from(f.name); const data=Buffer.isBuffer(f.data)?f.data:Buffer.from(f.data); const crc=crc32buf(data); const local=Buffer.alloc(30); local.writeUInt32LE(0x04034b50,0); local.writeUInt16LE(20,4); local.writeUInt16LE(0,6); local.writeUInt16LE(0,8); local.writeUInt16LE(0,10); local.writeUInt16LE(0,12); local.writeUInt32LE(crc,14); local.writeUInt32LE(data.length,18); local.writeUInt32LE(data.length,22); local.writeUInt16LE(name.length,26); local.writeUInt16LE(0,28); locals.push(local,name,data); const central=Buffer.alloc(46); central.writeUInt32LE(0x02014b50,0); central.writeUInt16LE(20,4); central.writeUInt16LE(20,6); central.writeUInt16LE(0,8); central.writeUInt16LE(0,10); central.writeUInt16LE(0,12); central.writeUInt16LE(0,14); central.writeUInt32LE(crc,16); central.writeUInt32LE(data.length,20); central.writeUInt32LE(data.length,24); central.writeUInt16LE(name.length,28); central.writeUInt16LE(0,30); central.writeUInt16LE(0,32); central.writeUInt16LE(0,34); central.writeUInt16LE(0,36); central.writeUInt32LE(0,38); central.writeUInt32LE(offset,42); centrals.push(central,name); offset += local.length+name.length+data.length; } const centralSize=centrals.reduce((a,b)=>a+b.length,0); const end=Buffer.alloc(22); end.writeUInt32LE(0x06054b50,0); end.writeUInt16LE(0,4); end.writeUInt16LE(0,6); end.writeUInt16LE(files.length,8); end.writeUInt16LE(files.length,10); end.writeUInt32LE(centralSize,12); end.writeUInt32LE(offset,16); end.writeUInt16LE(0,20); return Buffer.concat([...locals,...centrals,end]); }

function xlsxColName(n){ let s=''; n=Number(n)||1; while(n>0){ const m=(n-1)%26; s=String.fromCharCode(65+m)+s; n=Math.floor((n-1)/26); } return s; }
function genericXlsx(sheetName, rows, colWidths, orientation='landscape', logoBuffer=null){
  const safeSheetName=String(sheetName||'Sheet1').replace(/[\\/?*\[\]:]/g,' ').slice(0,31) || 'Sheet1';
  const widthCount=Math.max(colWidths.length, rows.reduce((m,r)=>Math.max(m,(r||[]).length),0),1);
  const colXml=Array.from({length:widthCount},(_,i)=>`<col min="${i+1}" max="${i+1}" width="${colWidths[i]||16}" customWidth="1"/>`).join('');
  const sheetData=rows.map((row,ri)=>`<row r="${ri+1}">${Array.from({length:widthCount},(_,ci)=>{ const v=(row&&row[ci]!=null)?row[ci]:''; const style=(row&&row._plain)?0:((ri===0 || (row&&row._header))?1:2); return `<c r="${xlsxColName(ci+1)}${ri+1}" t="inlineStr" s="${style}"><is><t>${xmlEsc(v)}</t></is></c>`; }).join('')}</row>`).join('');
  const lastCell=`${xlsxColName(widthCount)}${Math.max(rows.length,1)}`;
  const drawingTag=logoBuffer?'<drawing r:id="rId1"/>':'';
  const sheet=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:${lastCell}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews><cols>${colXml}</cols><sheetData>${sheetData}</sheetData><pageMargins left="0.2" right="0.2" top="0.25" bottom="0.25" header="0.1" footer="0.1"/><pageSetup paperSize="9" orientation="${orientation}" fitToWidth="1" fitToHeight="0"/>${drawingTag}</worksheet>`;
  const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEFEFEF"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color indexed="64"/></left><right style="thin"><color indexed="64"/></right><top style="thin"><color indexed="64"/></top><bottom style="thin"><color indexed="64"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  const files=[
    {name:'[Content_Types].xml',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${logoBuffer?'<Default Extension="png" ContentType="image/png"/><Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>':''}<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`},
    {name:'_rels/.rels',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},
    {name:'xl/workbook.xml',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlEsc(safeSheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`},
    {name:'xl/_rels/workbook.xml.rels',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'},
    {name:'xl/worksheets/sheet1.xml',data:sheet},
    {name:'xl/styles.xml',data:styles}
  ];
  if(logoBuffer){
    files.push({name:'xl/worksheets/_rels/sheet1.xml.rels',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>'});
    files.push({name:'xl/drawings/drawing1.xml',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>4</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>5</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>1</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="1" name="Taranka logo"/><xdr:cNvPicPr/></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:twoCellAnchor></xdr:wsDr>'});
    files.push({name:'xl/drawings/_rels/drawing1.xml.rels',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/taranka-logo.png"/></Relationships>'});
    files.push({name:'xl/media/taranka-logo.png',data:logoBuffer});
  }
  return zipStore(files);
}
function markHeader(row){ row._header=true; return row; }
function markPlain(row){ row._plain=true; return row; }
function firstPresent(obj, keys){ for(const k of keys){ if(obj && obj[k]!=null && String(obj[k]).trim()!=='') return obj[k]; } return ''; }
function itemUnitPrice(i){ return moneyNum(firstPresent(i, ['price','unitPrice','salePrice','cost','retailPrice'])); }
function orderXlsx(o){
  const items=Array.isArray(o.items)?o.items:[];
  const orderNo=o.orderNo || o.id || '';
  const quantityText=(i)=>{
    const item=itemWithQuantityFields(i);
    const qty=Math.max(0,Number(item.qty||0));
    const total=productFormatValue(item)*qty;
    return `${fmtNum(total)} ${inferResultUnit(item)}`;
  };
  const itemComment=(i)=>{
    const explicit=firstPresent(i, ['comment','note','notes','remark','remarks']);
    if(explicit) return explicit;
    return productMetaText(i) || '';
  };
  const rows=[
    markPlain(['Замовлення №', orderNo, '', '']),
    markPlain(['Магазин', o.shop || '', '', '']),
    markPlain(['Дата та час', o.createdAt || '', '', '']),
    markPlain(['','','','']),
    markHeader(['№','Назва товару','Замовлена кількість','Коментар'])
  ];
  items.forEach((i,idx)=>{
    rows.push([idx+1, productDisplayName(i), quantityText(i), itemComment(i)]);
  });
  return genericXlsx(`Замовлення ${orderNo}`, rows, [6,58,20,24], 'portrait');
}

function accountingXlsx(reports){
  const rows=[['№','Магазин','Дата','Залишок на початок дня','Фіскальний рапорт','Закриття дня по терміналу','Каса','Всього готівки фактично','Розбіжність','Передано в офіс','Залишок у касі','Коментар'], ...reports.map((r,i)=>[i+1,r.shop,r.date,moneyNum(r.openingBalance),moneyNum(r.fiscalReport),moneyNum(r.terminalClose),moneyNum(r.cash),moneyNum(r.actualCash),moneyNum(r.discrepancy),moneyNum(r.sentToOffice),moneyNum(r.closingBalance),r.comment||''])];
  const colWidths=[5,14,12,15,14,15,11,15,13,14,13,28];
  const moneyCols=new Set([4,5,6,7,8,9,10,11]);
  const colXml=colWidths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('');
  const sheetData=rows.map((row,ri)=>`<row r="${ri+1}">${row.map((v,ci)=>{ const ref=`${String.fromCharCode(65+ci)}${ri+1}`; if(ri>0 && (ci===0 || moneyCols.has(ci+1))){ return `<c r="${ref}" s="${moneyCols.has(ci+1)?3:2}"><v>${xmlEsc(ci===0?String(Number(v)||0):moneyExcel(v))}</v></c>`; } return `<c r="${ref}" t="inlineStr" s="${ri===0?1:2}"><is><t>${xmlEsc(v)}</t></is></c>`; }).join('')}</row>`).join('');
  const drawingTag=logoBuffer?'<drawing r:id="rId1"/>':'';
  const sheet=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:L${Math.max(rows.length,1)}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews><cols>${colXml}</cols><sheetData>${sheetData}</sheetData><pageMargins left="0.2" right="0.2" top="0.25" bottom="0.25" header="0.1" footer="0.1"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;
  const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEFEFEF"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color indexed="64"/></left><right style="thin"><color indexed="64"/></right><top style="thin"><color indexed="64"/></top><bottom style="thin"><color indexed="64"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="top" wrapText="1"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="top"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  return zipStore([
    {name:'[Content_Types].xml',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'},
    {name:'_rels/.rels',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},
    {name:'xl/workbook.xml',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Журнал обліку" sheetId="1" r:id="rId1"/></sheets></workbook>'},
    {name:'xl/_rels/workbook.xml.rels',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'},
    {name:'xl/worksheets/sheet1.xml',data:sheet},
    {name:'xl/styles.xml',data:styles}
  ]);
}

function exportFileDate(){
  return new Date().toLocaleDateString('sv-SE', {timeZone:'Europe/Warsaw'});
}
function safeDownloadName(v){
  return String(v||'export').trim().replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,'_').slice(0,80) || 'export';
}
function contentDispositionXlsx(filename){
  const ascii=filename.replace(/[^A-Za-z0-9_.-]+/g,'_') || 'products.xlsx';
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
function productExportQuantityText(p){
  p=enrichProduct(p);
  const unit=normalizeUnit(p.resultUnit||p.packUnit);
  return `${fmtNum(productFormatValue(p))} ${unit}`.trim();
}
function productExportComment(p){
  const explicit=firstPresent(p, ['comment','note','notes','remark','remarks']);
  if(explicit) return explicit;
  return productMetaText(p) || '';
}
function productsCategoryXlsx(category, products){
  const rows=[
    markHeader([`Товари: ${category}`,'','']),
    markPlain(['','','']),
    markHeader(['Назва','Кількість / вага','Коментар'])
  ];
  (products||[]).forEach(p=>{
    const e=enrichProduct(p);
    rows.push([String(e.name||''), productExportQuantityText(e), productExportComment(e)]);
  });
  return genericXlsx(String(category||'Товари'), rows, [42,20,32], 'portrait');
}
function categoryDownloadIcon(category){
  return `<a class="categoryDownloadIcon" href="/admin-products-export?cat=${encodeURIComponent(category)}" title="Скачати Excel" aria-label="Скачати товари категорії ${esc(category)}" onclick="event.stopPropagation()">⬇️</a>`;
}

function warsawTime(){ return new Date().toLocaleString('uk-UA', {timeZone:'Europe/Warsaw', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit'}); }
function ensureOrderNumbers(db){
  db.orders = db.orders || [];
  const used = new Set();
  let changed = false;
  for(const o of db.orders){ if(Number.isInteger(o.orderNo) && o.orderNo > 0){ used.add(o.orderNo); } }
  const oldFirst = [...db.orders].sort((a,b)=>(Number(a.id)||0)-(Number(b.id)||0));
  let n = 1;
  for(const o of oldFirst){
    if(!Number.isInteger(o.orderNo) || o.orderNo < 1){
      while(used.has(n)) n++;
      o.orderNo = n;
      used.add(n);
      changed = true;
    }
  }
  if(changed) writeDb(db);
}
function nextOrderNumber(db){
  ensureOrderNumbers(db);
  return (db.orders || []).reduce((max,o)=>Math.max(max, Number(o.orderNo)||0), 0) + 1;
}

function normalizeUnit(u){
  const raw=String(u||'').trim();
  const low=raw.toLowerCase();
  if(['l','л','lt','liter','litre'].includes(low)) return 'L';
  if(['ml','мл'].includes(low)) return 'ml';
  if(['kg','кг'].includes(low)) return 'kg';
  if(['g','гр','г'].includes(low)) return 'g';
  if(['szt','шт','pcs','pc'].includes(low)) return 'szt';
  return UNIT_OPTIONS.includes(raw) ? raw : (UNIT_OPTIONS.includes(low) ? low : 'szt');
}
function unitOptionsHtml(selected){
  selected=normalizeUnit(selected);
  return UNIT_OPTIONS.map(u=>`<option value="${u}" ${u===selected?'selected':''}>${u}</option>`).join('');
}
function compactMeasure(item){
  item=itemWithQuantityFields(item);
  return `${fmtNum(productFormatValue(item))}${normalizeUnit(item.resultUnit||item.packUnit)}`;
}
function escRegExp(v){ return String(v).replace(/[.*+?^${}()|[\\]\\]/g,'\\$&'); }
function productDisplayName(item){
  item=itemWithQuantityFields(item);
  const base=String(item.name||'').trim();
  const qty=escRegExp(fmtNum(productFormatValue(item)));
  const unit=escRegExp(normalizeUnit(item.resultUnit||item.packUnit));
  const re=new RegExp('(^|\\s)'+qty+'\\s*'+unit+'($|\\s|[,.])','i');
  return re.test(base) ? base : `${base} ${compactMeasure(item)}`;
}
function fmtNum(n){ n=Number(n); if(!Number.isFinite(n)) return '0'; return String(Math.round(n*1000)/1000).replace(/\.0+$/,'').replace(/(\.\d*?)0+$/,'$1'); }
function pluralKeg(n){ n=Number(n)||0; if(n===1) return 'кег'; if(n>=2&&n<=4) return 'кеги'; return 'кег'; }
function inferResultUnit(item){
  const explicit=normalizeUnit(item.resultUnit||item.packUnit||'');
  if(explicit) return explicit;
  const txt=String((item.name||'')+' '+(item.displayWeight||'')+' '+(item.weightText||'')).toLowerCase();
  if(/(szt|шт|pcs|pc)/i.test(txt)) return 'szt';
  if(/(kg|кг)/i.test(txt)) return 'kg';
  if(/(\d|\s)(g|гр|г)\b/i.test(txt)) return 'g';
  if(/(ml|мл)/i.test(txt)) return 'ml';
  if(/\d[\d\.,]*\s*(l|л)\b/i.test(txt)) return 'L';
  return 'szt';
}
function productFormatValue(item){
  const raw=String(item.format ?? item.weight ?? item.packQty ?? '1').replace(',','.');
  const m=raw.match(/\d+(?:\.\d+)?/);
  const n=m?Number(m[0]):1;
  return Number.isFinite(n)&&n>0?n:1;
}
function parseProductQuantity(raw, name='', category=''){
  const s=String(raw||'').trim();
  const hasDeposit=/кауц|депозит|kauc/i.test(String(name||'')+' '+s);
  const formatValue=productFormatValue({weight:s});
  const resultUnit=inferResultUnit({name, weight:s});
  return { productType:'universal', sizeValue:null, sizeUnit:'', packQty:formatValue, packUnit:resultUnit, resultUnit, hasDeposit, displayWeight:s, format:formatValue };
}
function enrichProduct(p){
  if(!p) return p;
  const q=parseProductQuantity(p.weight ?? p.format, p.name, p.category);
  const hasDeposit = p.hasDeposit!==undefined ? !!p.hasDeposit : !!q.hasDeposit;
  const formatValue = productFormatValue({weight:p.weight ?? p.format ?? q.format});
  const resultUnit = normalizeUnit(p.resultUnit || p.packUnit || inferResultUnit({...p, packUnit:q.resultUnit}));
  return {...p, productType:'universal', sizeValue:null, sizeUnit:'', packQty:formatValue, packUnit:resultUnit, resultUnit, hasDeposit, format:formatValue, weight:String(p.weight ?? p.format ?? formatValue)};
}
function itemWithQuantityFields(x){ return enrichProduct(x||{}); }
function productMetaText(p){ p=itemWithQuantityFields(p); return (p.hasDeposit && canHaveDeposit(p.category)) ? 'кауція' : ''; }
function productTotalDisplay(item, qty){
  item=itemWithQuantityFields(item); qty=Math.max(0,Number(qty||0));
  const total=productFormatValue(item)*qty;
  return `${fmtNum(total)}${inferResultUnit(item)}`;
}
function productResultText(item, qty){ return `Разом: ${productTotalDisplay(item, qty)}`; }
function productOrderedText(item, qty){ item=itemWithQuantityFields(item); return `замовлено - ${productTotalDisplay(item, qty)}${(item.hasDeposit&&canHaveDeposit(item.category))?' · кауція':''}`; }
function copyProductFields(p){ const e=enrichProduct(p); const hasDeposit=!!e.hasDeposit && canHaveDeposit(e.category); return {id:e.id, name:e.name, category:e.category, weight:String(e.weight||e.format||''), format:e.format, productType:'universal', packQty:e.packQty, packUnit:normalizeUnit(e.resultUnit||e.packUnit), resultUnit:normalizeUnit(e.resultUnit||e.packUnit), hasDeposit, displayWeight:hasDeposit?'кауція':''}; }

function orderCopyText(o){
  const lines = [];
  lines.push(`Замовлення №${o.orderNo || o.id}`);
  lines.push(`Магазин: ${o.shop || ''}`);
  lines.push(`Час: ${o.createdAt || ''}`);
  lines.push(`Статус: ${o.status || 'Нове'}`);
  lines.push('');
  lines.push('Товари:');
  for(const i of (o.items || [])) lines.push(`- ${productDisplayName(i)} — ${productOrderedText(i, i.qty)}`);
  if(o.comment) { lines.push(''); lines.push('Коментар:'); lines.push(String(o.comment)); }
  return lines.join('\n');
}
function shopOrderHistoryHtml(db, shop){
  const orders=(db.orders || []).filter(o=>String(o.shop || '')===String(shop || '')).sort((a,b)=>(Number(b.id)||0)-(Number(a.id)||0));
  const list=orders.map(o=>`<div class="card historyOrder"><h3>Замовлення №${o.orderNo || o.id}</h3><div class="historyMeta">${esc(o.createdAt || '')} · ${esc(o.status || 'Нове')}</div><ul>${(o.items || []).map(i=>`<li>${esc(productDisplayName(i))} — ${esc(productOrderedText(i, i.qty))}</li>`).join('')}</ul>${o.comment?`<div class="orderComment"><div class="orderCommentLabel">Коментар:</div>${esc(o.comment)}</div>`:''}</div>`).join('');
  return `<section class="orderHistory"><h2>Історія попередніх замовлень</h2>${list || '<div class="card historyEmpty">Попередніх замовлень ще немає</div>'}</section>`;
}

/* ═══════════════════════════════════════════════
   SHOP LOGIN PAGE — modernized design
═══════════════════════════════════════════════ */
function shopLoginPage(message='', db=readDb()){ return `
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
:root{
  --ln:#050d1a;--lb:#0a1628;--ldb:#0f1f3d;
  --lv:#7c3aed;--lvl:#a78bfa;
  --lc:#06b6d4;--lcg:rgba(6,182,212,.4);
  --lg:rgba(255,255,255,.05);--lgb:rgba(255,255,255,.1);
  --lt:#e2e8f0;--ltm:rgba(226,232,240,.6);
}
*{font-family:'Inter',system-ui,Arial,sans-serif;box-sizing:border-box}
.top{display:none!important}
body{overflow-x:hidden;background:var(--ln)!important;margin:0}
.wrap{max-width:none!important;padding:0!important;min-height:100vh;background:transparent!important}

/* background */
.loginBg{position:fixed;inset:0;background:linear-gradient(135deg,#050d1a 0%,#0a1628 40%,#0f1f3d 70%,#1a0a3d 100%);overflow:hidden;z-index:0}
.loginOrb{position:absolute;border-radius:50%;filter:blur(80px);opacity:.2;animation:orbFloat 8s ease-in-out infinite}
.loginOrb1{width:700px;height:700px;background:radial-gradient(circle,#7c3aed 0%,transparent 70%);top:-250px;left:-200px;animation-delay:0s}
.loginOrb2{width:550px;height:550px;background:radial-gradient(circle,#06b6d4 0%,transparent 70%);bottom:-180px;right:-150px;animation-delay:-4s}
.loginOrb3{width:450px;height:450px;background:radial-gradient(circle,#1e40af 0%,transparent 70%);top:40%;left:50%;transform:translate(-50%,-50%);animation-delay:-2s;animation-duration:10s}
@keyframes orbFloat{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(30px,-30px) scale(1.05)}66%{transform:translate(-20px,20px) scale(.95)}}
.loginOrb3{animation:orbFloat3 10s ease-in-out infinite;animation-delay:-2s}
@keyframes orbFloat3{0%,100%{transform:translate(-50%,-50%) scale(1)}33%{transform:translate(calc(-50% + 30px),calc(-50% - 30px)) scale(1.05)}66%{transform:translate(calc(-50% - 20px),calc(-50% + 20px)) scale(.95)}}
#loginParticles{position:absolute;inset:0;z-index:1}
.loginGrid{position:absolute;inset:0;background-image:linear-gradient(rgba(6,182,212,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(6,182,212,.025) 1px,transparent 1px);background-size:60px 60px;z-index:2}

/* layout */
.loginPage{position:relative;z-index:10;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 20px;gap:36px}

/* logo */
.loginLogo{display:flex;flex-direction:column;align-items:center;animation:fadeInDown .8s cubic-bezier(.16,1,.3,1) forwards;opacity:0}
.loginLogoImg{width:min(360px,78vw);height:auto;filter:invert(1) brightness(1.3) drop-shadow(0 0 28px rgba(6,182,212,.55)) drop-shadow(0 0 56px rgba(124,58,237,.4));transition:filter .35s ease,transform .35s ease}
.loginLogoImg:hover{filter:invert(1) brightness(1.6) drop-shadow(0 0 40px rgba(6,182,212,.8)) drop-shadow(0 0 80px rgba(124,58,237,.6));transform:scale(1.02)}

/* card */
.loginCard{
  background:rgba(255,255,255,.06);
  backdrop-filter:blur(28px);-webkit-backdrop-filter:blur(28px);
  border:1px solid rgba(255,255,255,.12);
  border-radius:32px;
  padding:44px 48px;
  width:min(460px,calc(100vw - 32px));
  box-shadow:0 32px 80px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.06),inset 0 1px 0 rgba(255,255,255,.12);
  animation:fadeInUp .9s cubic-bezier(.16,1,.3,1) .15s forwards;
  opacity:0;
  position:relative;
  overflow:hidden;
}
.loginCard::before{
  content:'';position:absolute;inset:0;
  background:linear-gradient(135deg,rgba(124,58,237,.06) 0%,rgba(6,182,212,.04) 100%);
  pointer-events:none;border-radius:inherit;
}
.loginCardTitle{text-align:center;font-size:24px;font-weight:800;color:var(--lt);margin:0 0 6px;letter-spacing:-.4px}
.loginCardSub{text-align:center;color:rgba(226,232,240,.5);font-size:13.5px;margin:0 0 30px;line-height:1.55}
.loginErr{
  background:rgba(239,68,68,.12);
  border:1px solid rgba(239,68,68,.28);
  border-radius:14px;
  color:#fca5a5;
  padding:13px 16px;
  font-size:14px;margin-bottom:20px;text-align:center;
  animation:fadeInUp .4s ease;
}

/* form fields */
.lform .llabel{display:block;margin-bottom:20px}
.lform .llabel-text{display:block;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(148,163,184,.75);margin-bottom:9px}
.lform .lfieldwrap{position:relative}
.lform .lficon{position:absolute;left:15px;top:50%;transform:translateY(-50%);color:rgba(148,163,184,.55);pointer-events:none;display:flex;align-items:center}
.lform .lselect,.lform .linput{
  width:100%;
  background:rgba(255,255,255,.07);
  border:1px solid rgba(255,255,255,.1);
  border-radius:16px;
  padding:15px 16px 15px 46px;
  color:var(--lt);
  font-size:15px;font-family:inherit;
  outline:none;
  transition:all .25s ease;
  box-sizing:border-box;
}
.lform .lselect{
  appearance:none;-webkit-appearance:none;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat:no-repeat;background-position:right 15px center;
  background-color:rgba(255,255,255,.07);cursor:pointer;
}
.lform .lselect option{background:#1a1f35;color:var(--lt)}
.lform .lselect:focus,.lform .linput:focus{
  border-color:rgba(124,58,237,.65);
  background:rgba(255,255,255,.11);
  box-shadow:0 0 0 3px rgba(124,58,237,.18),0 0 24px rgba(124,58,237,.1);
}
.lform .linput::placeholder{color:rgba(148,163,184,.4)}

/* button */
.lbtn{
  width:100%;padding:17px 24px;
  background:linear-gradient(135deg,#7c3aed 0%,#0ea5e9 100%);
  border:none;border-radius:16px;
  color:#fff;font-size:16px;font-weight:700;
  cursor:pointer;transition:all .28s cubic-bezier(.34,1.56,.64,1);
  position:relative;overflow:hidden;margin-top:8px;
  letter-spacing:.02em;
  box-shadow:0 10px 32px rgba(124,58,237,.38),0 4px 12px rgba(0,0,0,.2);
  display:block;font-family:inherit;
}
.lbtn::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,#6d28d9 0%,#0284c7 100%);opacity:0;transition:opacity .25s ease}
.lbtn:hover::before{opacity:1}
.lbtn:hover{transform:translateY(-2px) scale(1.01);box-shadow:0 18px 44px rgba(124,58,237,.55),0 6px 16px rgba(0,0,0,.25)}
.lbtn:active{transform:translateY(0) scale(.99);box-shadow:0 6px 18px rgba(124,58,237,.35)}
.lbtn-inner{position:relative;z-index:1;display:flex;align-items:center;justify-content:center;gap:8px}
.lbtn.lbtn-loading .lbtn-inner{visibility:hidden}
.lbtn.lbtn-loading::after{content:'';position:absolute;width:20px;height:20px;top:50%;left:50%;transform:translate(-50%,-50%);border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:lspin .6s linear infinite}
@keyframes lspin{to{transform:translate(-50%,-50%) rotate(360deg)}}

.ldivider{border:none;border-top:1px solid rgba(255,255,255,.07);margin:24px 0 18px}
.ladmin-link{
  display:flex;align-items:center;justify-content:center;gap:6px;
  text-align:center;color:rgba(148,163,184,.6);font-size:13px;
  text-decoration:none;transition:all .2s ease;padding:4px;
  border-radius:8px;
}
.ladmin-link:hover{color:rgba(167,139,250,.95);background:rgba(124,58,237,.08)}

/* animations */
@keyframes fadeInDown{from{opacity:0;transform:translateY(-32px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeInUp{from{opacity:0;transform:translateY(32px)}to{opacity:1;transform:translateY(0)}}

/* shop count badge */
.loginShopCount{
  display:inline-flex;align-items:center;gap:6px;
  background:rgba(6,182,212,.12);border:1px solid rgba(6,182,212,.2);
  border-radius:999px;padding:4px 12px;
  font-size:12px;font-weight:600;color:rgba(6,182,212,.9);
  margin-top:10px;
}

@media(max-width:480px){
  .loginCard{padding:30px 22px;border-radius:24px}
  .loginLogoImg{width:min(260px,72vw)}
  .loginPage{gap:24px;padding:28px 16px}
}
.appBindSearchGrid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.appItemsTableWrap{overflow-x:auto;margin-bottom:16px}.appItemsTable th,.appItemsTable td{vertical-align:middle}.appItemsTable small.appWeightBadge{display:block;color:#7c3aed;margin-top:4px}.appRowActions{display:flex;gap:8px;align-items:center}.appRowActions .deleteIcon{position:static}.appItemsTable strong{white-space:nowrap}@media(max-width:700px){.appBindSearchGrid{grid-template-columns:1fr}.appItemsTable{min-width:760px}}

@media(max-width:700px){
.adminShell>section{padding:8px 10px 96px}.appTop{display:block;margin-bottom:10px}.appTop h1{font-size:20px}.appTop>a{display:block;width:100%;margin-top:10px;text-align:center}.appMeta{display:grid;grid-template-columns:1fr 1fr}.appMeta b{grid-column:1/-1;font-size:16px}.appMeta span{font-size:12px}.appStatsSingle{display:block}.appStats>div{padding:8px}.appStats b{font-size:22px}.appScannerClear{padding:10px;border-radius:12px}.appListHead{margin:4px 0 8px}.appListHead h2{font-size:17px}.appListHead p{font-size:12px}.appCameraActions{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.appCameraActions button{width:100%;padding:12px 6px}.barcodeReader{width:100%;height:30vh;min-height:170px;border-radius:12px}#barcodeForm{grid-template-columns:1fr}#barcodeForm input,#barcodeForm button{width:100%;min-height:48px}.appItemsTableWrap{overflow:visible}.appItemsTable,.appItemsTable tbody,.appItemsTable tr,.appItemsTable td{display:block;width:100%}.appItemsTable thead{display:none}.appItemsTable tr{background:#fff;border:1px solid var(--line);border-radius:14px;padding:12px;margin-bottom:10px}.appItemsTable td{border:0;padding:4px 0;display:grid;grid-template-columns:105px 1fr;gap:8px;align-items:start}.appItemsTable td:before{font-size:11px;font-weight:800;color:var(--mut)}.appItemsTable td:nth-child(1):before{content:'Позиція'}.appItemsTable td:nth-child(2):before{content:'Товар'}.appItemsTable td:nth-child(3):before{content:'Штрихкод'}.appItemsTable td:nth-child(4):before{content:'Кількість'}.appItemsTable td:nth-child(5):before{content:'Вага / обсяг'}.appItemsTable td:nth-child(6):before{content:'Одиниця'}.appItemsTable td:nth-child(7){display:block;padding-top:10px;border-top:1px solid var(--line);margin-top:6px}.appItemsTable td:nth-child(7):before{display:none}.appRowActions{display:grid;grid-template-columns:1fr 1fr auto;gap:7px}.appRowActions button{min-height:42px}.appFinishBox{position:sticky;bottom:6px;z-index:20;border:2px solid var(--b);box-shadow:0 8px 28px rgba(15,23,42,.18);padding:12px}.appFinishBox h2{font-size:16px}.appFinishBox p{display:none}.appFinishBox .appActions{display:grid;grid-template-columns:1fr;gap:8px}.appFinishBox button{min-height:48px}.appModal{padding:14px;align-items:center;justify-content:center}.appModalBox{width:min(620px,calc(100% - 4px));border-radius:18px;padding:16px;max-height:88vh}.appBindSearchGrid{grid-template-columns:1fr}.appModalBox .actions{display:grid;grid-template-columns:1fr}.appModalBox .actions button{width:100%;min-height:46px}}

</style>
<div class="loginBg">
  <div class="loginOrb loginOrb1"></div>
  <div class="loginOrb loginOrb2"></div>
  <div class="loginOrb loginOrb3"></div>
  <canvas id="loginParticles"></canvas>
  <div class="loginGrid"></div>
</div>
<div class="loginPage">
  <div class="loginLogo">
    <img class="loginLogoImg" src="/taranka-logo.png" alt="TARANKA">
  </div>
  <div class="loginCard">
    <h2 class="loginCardTitle">Вхід у систему</h2>
    <p class="loginCardSub">Оберіть ваш магазин та введіть пароль для входу</p>
    ${message ? `<div class="loginErr">⚠️ ${esc(message)}</div>` : ''}
    <form class="lform" method="post" action="/shop-login" onsubmit="lbtnLoad(this)">
      <label class="llabel">
        <span class="llabel-text">Магазин</span>
        <div class="lfieldwrap">
          <span class="lficon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></span>
          <select class="lselect" name="shop" required>${getShopNames(db).map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('')}</select>
        </div>
      </label>
      <label class="llabel">
        <span class="llabel-text">Пароль</span>
        <div class="lfieldwrap">
          <span class="lficon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>
          <input class="linput" type="password" name="password" required placeholder="Введіть пароль" autocomplete="current-password">
        </div>
      </label>
      <button class="lbtn" type="submit"><span class="lbtn-inner">Увійти в магазин <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg></span></button>
    </form>
    <hr class="ldivider">
    <a class="ladmin-link" href="/admin-login">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M6 20v-2a6 6 0 0 1 12 0v2"/></svg>
      Вхід у склад
    </a>
  </div>
</div>
<script>
(function(){
  var c=document.getElementById('loginParticles');
  if(!c)return;
  var ctx=c.getContext('2d');
  function resize(){c.width=window.innerWidth;c.height=window.innerHeight;}
  resize();
  window.addEventListener('resize',resize);
  var pts=[];
  for(var i=0;i<80;i++){
    pts.push({
      x:Math.random()*window.innerWidth,
      y:Math.random()*window.innerHeight,
      vx:(Math.random()-.5)*.2,
      vy:-Math.random()*.35-.06,
      r:Math.random()*2+.4,
      a:Math.random()*.4+.07,
      col:Math.random()>.5?'6,182,212':'124,58,237'
    });
  }
  function tick(){
    ctx.clearRect(0,0,c.width,c.height);
    pts.forEach(function(p){
      p.x+=p.vx; p.y+=p.vy;
      if(p.y<-5){p.y=c.height+5;p.x=Math.random()*c.width;}
      if(p.x<-5)p.x=c.width+5;
      if(p.x>c.width+5)p.x=-5;
      ctx.beginPath();
      ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle='rgba('+p.col+','+p.a+')';
      ctx.fill();
    });
    requestAnimationFrame(tick);
  }
  tick();
})();
function lbtnLoad(form){
  var btn=form.querySelector('.lbtn');
  if(btn)setTimeout(function(){btn.classList.add('lbtn-loading')},30);
}
</script>
`; }

/* ═══════════════════════════════════════════════
   ADMIN LOGIN PAGE — modernized dark theme
═══════════════════════════════════════════════ */
function adminLoginPage(message=''){
  return `
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
*{font-family:'Inter',system-ui,Arial,sans-serif;box-sizing:border-box}
.top{display:none!important}
body{overflow-x:hidden;background:#020817!important;margin:0}
.wrap{max-width:none!important;padding:0!important;min-height:100vh;background:transparent!important}
.aLoginBg{position:fixed;inset:0;background:linear-gradient(135deg,#020817 0%,#0a0f1e 50%,#0f0a2a 100%);z-index:0}
.aLoginOrb1{position:absolute;width:500px;height:500px;border-radius:50%;background:radial-gradient(circle,rgba(124,58,237,.25) 0%,transparent 70%);top:-150px;right:-100px;filter:blur(60px);animation:aOrbF 9s ease-in-out infinite}
.aLoginOrb2{position:absolute;width:400px;height:400px;border-radius:50%;background:radial-gradient(circle,rgba(6,182,212,.18) 0%,transparent 70%);bottom:-100px;left:-80px;filter:blur(60px);animation:aOrbF 11s ease-in-out infinite reverse}
@keyframes aOrbF{0%,100%{transform:scale(1) translate(0,0)}50%{transform:scale(1.08) translate(20px,-20px)}}
.aLoginGrid{position:absolute;inset:0;background-image:linear-gradient(rgba(124,58,237,.02) 1px,transparent 1px),linear-gradient(90deg,rgba(124,58,237,.02) 1px,transparent 1px);background-size:50px 50px}

.aLoginPage{position:relative;z-index:10;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:40px 20px}
.aLoginWrap{width:min(420px,calc(100vw - 32px));animation:aFadeUp .8s cubic-bezier(.16,1,.3,1) forwards;opacity:0}
@keyframes aFadeUp{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:translateY(0)}}

.aLoginBadge{
  display:inline-flex;align-items:center;gap:7px;
  background:rgba(124,58,237,.15);border:1px solid rgba(124,58,237,.25);
  border-radius:999px;padding:6px 14px;
  font-size:12px;font-weight:600;color:rgba(167,139,250,.9);
  margin-bottom:24px;letter-spacing:.03em;
}
.aLoginCard{
  background:rgba(255,255,255,.055);
  backdrop-filter:blur(28px);-webkit-backdrop-filter:blur(28px);
  border:1px solid rgba(255,255,255,.1);
  border-radius:28px;
  padding:40px 44px;
  box-shadow:0 28px 70px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.1);
}
.aLoginTitle{font-size:26px;font-weight:800;color:#f1f5f9;margin:0 0 6px;letter-spacing:-.4px}
.aLoginSub{color:rgba(148,163,184,.6);font-size:13.5px;margin:0 0 28px;line-height:1.5}
.aLoginErr{background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.28);border-radius:12px;color:#fca5a5;padding:12px 16px;font-size:14px;margin-bottom:18px;text-align:center}

.aLLabel{display:block;margin-bottom:22px}
.aLLabelText{display:block;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(148,163,184,.65);margin-bottom:9px}
.aLFieldWrap{position:relative}
.aLIcon{position:absolute;left:15px;top:50%;transform:translateY(-50%);color:rgba(148,163,184,.5);pointer-events:none;display:flex;align-items:center}
.aLInput{
  width:100%;background:rgba(255,255,255,.07);
  border:1px solid rgba(255,255,255,.1);
  border-radius:14px;padding:15px 16px 15px 46px;
  color:#e2e8f0;font-size:15px;font-family:inherit;
  outline:none;transition:all .25s ease;box-sizing:border-box;
}
.aLInput::placeholder{color:rgba(148,163,184,.4)}
.aLInput:focus{border-color:rgba(124,58,237,.6);background:rgba(255,255,255,.1);box-shadow:0 0 0 3px rgba(124,58,237,.18)}

.aLBtn{
  width:100%;padding:16px 24px;
  background:linear-gradient(135deg,#7c3aed 0%,#5b21b6 100%);
  border:none;border-radius:14px;color:#fff;
  font-size:16px;font-weight:700;cursor:pointer;
  transition:all .28s cubic-bezier(.34,1.56,.64,1);
  box-shadow:0 10px 30px rgba(124,58,237,.4);
  display:block;width:100%;font-family:inherit;
}
.aLBtn:hover{transform:translateY(-2px);box-shadow:0 16px 40px rgba(124,58,237,.55)}
.aLBtn:active{transform:translateY(0);box-shadow:0 6px 16px rgba(124,58,237,.3)}

.aLBack{
  display:block;text-align:center;margin-top:20px;
  color:rgba(148,163,184,.55);font-size:13px;text-decoration:none;
  transition:color .2s;padding:4px;border-radius:8px;
}
.aLBack:hover{color:rgba(226,232,240,.8)}

@media(max-width:480px){.aLoginCard{padding:28px 22px;border-radius:22px}}
</style>
<div class="aLoginBg">
  <div class="aLoginOrb1"></div>
  <div class="aLoginOrb2"></div>
  <div class="aLoginGrid"></div>
</div>
<div class="aLoginPage">
  <div class="aLoginWrap">
    <div class="aLoginBadge">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      Доступ до складу
    </div>
    <div class="aLoginCard">
      <h1 class="aLoginTitle">Вхід у склад</h1>
      <p class="aLoginSub">Введіть пароль для доступу до панелі управління</p>
      ${message ? `<div class="aLoginErr">⚠️ ${esc(message)}</div>` : ''}
      <form method="post" action="/admin-login">
        <label class="aLLabel">
          <span class="aLLabelText">Пароль</span>
          <div class="aLFieldWrap">
            <span class="aLIcon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>
            <input class="aLInput" type="password" name="password" required autofocus placeholder="Введіть пароль складу" autocomplete="current-password">
          </div>
        </label>
        <button class="aLBtn" type="submit">Увійти в склад →</button>
      </form>
      <a class="aLBack" href="/">← Повернутись до входу магазину</a>
    </div>
  </div>
</div>
`; }

function esc(s=''){ return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function parseCookies(req){ return Object.fromEntries((req.headers.cookie||'').split(';').filter(Boolean).map(x=>{const i=x.indexOf('='); return [x.slice(0,i).trim(), decodeURIComponent(x.slice(i+1))];})); }
function setSessionCookie(res, sid){ res.setHeader('Set-Cookie', `sid=${encodeURIComponent(sid)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`); }
function cartKey(session){ return session && session.shop ? `shop:${session.shop}` : `sid:${session.sid}`; }
function loadCartForSession(session, db=readDb()){
  db.carts=db.carts||{};
  const key=cartKey(session);
  session.cart=Array.isArray(db.carts[key]) ? db.carts[key] : [];
  return session.cart;
}
function getSession(req,res){
  const cookies=parseCookies(req);
  let sid=cookies.sid;
  const db=readDb();
  db.sessions=db.sessions||{};
  if(!sid){
    sid=crypto.randomBytes(18).toString('hex');
    setSessionCookie(res, sid);
  }
  const saved=db.sessions[sid] || {};
  if(!sessions.has(sid)) sessions.set(sid,{sid, admin:!!saved.admin, shop:saved.shop || null});
  const session=sessions.get(sid);
  session.sid=sid;
  session.admin=!!saved.admin || !!session.admin;
  session.shop=saved.shop || session.shop || null;
  loadCartForSession(session, db);
  return session;
}
function saveSession(session){
  const db=readDb();
  db.sessions=db.sessions||{};
  db.sessions[session.sid]={admin:!!session.admin, shop:session.shop || null, updatedAt:warsawTime()};
  writeDb(db);
}
function saveCart(session){ const db=readDb(); db.carts=db.carts||{}; db.carts[cartKey(session)]=session.cart||[]; writeDb(db); }
function body(req){ return new Promise(resolve=>{let d=''; req.on('data',c=>d+=c); req.on('end',()=>resolve(querystring.parse(d)));}); }
function redirect(res,loc){ res.writeHead(302,{Location:loc}); res.end(); }
function send(res,html,status=200){ const code=typeof status==='number'?status:200; res.writeHead(code, {'Content-Type':'text/html; charset=utf-8'}); res.end(html); }
function notFound(res){ send(res, layout('Не знайдено', `<section class="card center"><h1>Сторінку не знайдено</h1><p>Перейдіть у каталог або на головну.</p><a class="btn" href="/catalog">Каталог</a></section>`), 404); }

/* ═══════════════════════════════════════════════
   MAIN LAYOUT — modernized global CSS
═══════════════════════════════════════════════ */
function layout(title, content, session={cart:[]}){
  const count=(session.cart||[]).reduce((a,i)=>a+Number(i.qty||0),0);
  const layoutDb=readDb();
  const unread=unreadCounts(layoutDb, session);
  const logoHref=session.admin?'/admin':'/';
  return `<!doctype html><html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · TARANKA MAGAZINE</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
:root{
  --b:#2563eb;--bd:#1d4ed8;
  --d:#0f172a;--mut:#64748b;
  --bg:#f8fafc;--card:#fff;--line:#e2e8f0;
  --r:18px;
  --shadow-sm:0 1px 3px rgba(0,0,0,.06),0 1px 2px rgba(0,0,0,.04);
  --shadow:0 4px 16px rgba(15,23,42,.08),0 1px 4px rgba(15,23,42,.04);
  --shadow-lg:0 12px 40px rgba(15,23,42,.12),0 4px 12px rgba(15,23,42,.06);
}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',system-ui,Arial,sans-serif;background:var(--bg);color:#0f172a;line-height:1.5;-webkit-font-smoothing:antialiased}

/* ── NAV ── */
.top{position:sticky;top:0;z-index:50;background:rgba(255,255,255,.88);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:1px solid rgba(226,232,240,.8);box-shadow:0 1px 0 rgba(15,23,42,.06)}
.nav{max-width:1200px;margin:auto;display:flex;align-items:center;gap:18px;padding:12px 20px}
.logo{font-weight:900;color:var(--d);text-decoration:none;font-size:19px;letter-spacing:-.4px;display:flex;align-items:center;line-height:1.1;flex-shrink:0}
.logo span{display:block;font-size:11px;font-weight:600;color:var(--b);letter-spacing:.04em;text-transform:uppercase;opacity:.8}
.siteLogoImg{display:block;height:32px;width:auto;max-width:150px;object-fit:contain}
.shopPill{background:linear-gradient(135deg,#eff6ff,#dbeafe);border:1px solid #bfdbfe;border-radius:999px;padding:4px 12px;font-size:12px;font-weight:700;color:#1d4ed8;letter-spacing:.01em}
.links{margin-left:auto;display:flex;align-items:center;gap:4px;flex-wrap:wrap}
.links a{color:#334155;text-decoration:none;padding:8px 13px;border-radius:10px;font-size:14px;font-weight:500;transition:all .18s ease}
.links a:hover{background:#f1f5f9;color:var(--b)}
.active{background:#eff6ff!important;color:var(--b)!important;font-weight:600!important}
.cart{font-weight:700!important}
.notifBadge{display:inline-flex;align-items:center;justify-content:center;background:#ef4444;color:#fff;font-size:10px;font-weight:800;border-radius:999px;padding:1px 6px;margin-left:3px;vertical-align:middle}
.burger{display:none!important}
@media(max-width:700px){
  .nav{flex-wrap:wrap;padding:8px 12px;gap:6px}
  .links{margin-left:0;display:flex;width:100%;flex-wrap:nowrap;overflow-x:auto;gap:2px;padding-bottom:2px;scrollbar-width:none;-webkit-overflow-scrolling:touch}
  .links::-webkit-scrollbar{display:none}
  .links a{padding:7px 10px;white-space:nowrap;font-size:13px;flex-shrink:0;border-radius:9px}
  .siteLogoImg{height:24px;max-width:116px}
  .links a.mobileHide{display:none!important}
  .links a.mobileCabinet{order:1}
  .links a.mobileCart{order:2;margin-left:8px;background:linear-gradient(145deg,#ffffff,#eaf2ff)!important;color:#2563eb!important;border:1px solid #bfdbfe;box-shadow:0 7px 18px rgba(37,99,235,.16);font-weight:800!important}
  .links a.mobileCart:hover,.links a.mobileCart:active{background:linear-gradient(145deg,#f8fbff,#dbeafe)!important;color:#1d4ed8!important;box-shadow:0 4px 12px rgba(37,99,235,.18);transform:none}
  .links a.mobileMessages{order:3}
  .links a.mobileAnnouncements{order:4}
  .links a.mobileChat{order:5}
  .links a.mobileLogout{order:6}
}

/* ── LAYOUT ── */
.wrap{max-width:1200px;margin:0 auto;padding:28px 20px}
h1{font-size:32px;font-weight:800;letter-spacing:-.5px;margin-bottom:18px}
h2{font-size:22px;font-weight:700;letter-spacing:-.3px;margin-bottom:16px}
h3{font-size:17px;font-weight:700;letter-spacing:-.2px;margin-bottom:10px}

/* ── CARDS ── */
.card{background:var(--card);border:1px solid var(--line);border-radius:var(--r);box-shadow:var(--shadow)}
.card.center{text-align:center;padding:36px 24px}
.heroBox{padding:42px;background:linear-gradient(135deg,#fff 0%,#eff6ff 100%);border-radius:var(--r);border:1px solid #dbeafe;box-shadow:var(--shadow)}
.hero{display:grid;grid-template-columns:1.2fr .8fr;gap:22px;align-items:center}
.muted{color:var(--mut);line-height:1.6}

/* ── BUTTONS ── */
.btn,button{
  border:0;background:var(--b);color:#fff;
  padding:10px 18px;border-radius:11px;
  font-weight:700;cursor:pointer;font-size:14px;
  text-decoration:none;display:inline-flex;align-items:center;gap:7px;
  font-family:inherit;transition:all .2s ease;
  box-shadow:0 2px 8px rgba(37,99,235,.25);
}
.btn:hover,button:not(.secondary):not(.danger):not(.warn):not(.deleteIcon):not(.compactBtn):hover{background:var(--bd);transform:translateY(-1px);box-shadow:0 6px 18px rgba(37,99,235,.35)}
button.secondary,.btn.secondary{background:#eff6ff;color:var(--b);box-shadow:none;border:1px solid #bfdbfe}
button.secondary:hover,.btn.secondary:hover{background:#dbeafe;transform:translateY(-1px)}
button.danger,.btn.danger{background:#fee2e2;color:#b91c1c;box-shadow:none;border:1px solid #fecaca}
button.warn,.btn.warn{background:#fefce8;color:#92400e;box-shadow:none;border:1px solid #fde68a}
.btn.cartGoto{background:linear-gradient(145deg,rgba(255,255,255,.96),rgba(239,246,255,.92));color:#2563eb;border:1px solid #bfdbfe;box-shadow:0 4px 12px rgba(37,99,235,.10);font-weight:800;white-space:nowrap}
.btn.cartGoto:hover{background:linear-gradient(145deg,#ffffff,#e8f1ff);color:#1d4ed8;border-color:#93c5fd;box-shadow:0 6px 16px rgba(37,99,235,.14);transform:translateY(-1px)}
.catalogControls{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.iconBtn{width:40px;min-height:40px;padding:0;justify-content:center;font-size:22px;line-height:1;border-radius:11px}
.minusBtn{background:#f1f5f9!important;color:#475569!important;box-shadow:none!important;border:1px solid var(--line)!important}
.minusBtn:hover{background:#e2e8f0!important}
.deleteIcon{background:none!important;border:none!important;box-shadow:none!important;color:#94a3b8!important;font-size:22px;width:36px;min-height:36px;padding:0;justify-content:center;border-radius:8px;transition:all .15s}
.deleteIcon:hover{color:#ef4444!important;background:#fee2e2!important;transform:scale(1.1)}
.compactBtn{padding:6px 12px;border-radius:8px;font-size:12px;font-weight:700}

.mobileCabinetShortcut,.mobileJournalShortcut{display:none}
@media(max-width:700px){.mobileCabinetShortcut,.mobileJournalShortcut{display:inline-flex;padding:8px 10px;font-size:13px}.catalogHeader{align-items:flex-start}.catalogControls{width:100%;display:flex;align-items:center;gap:8px;flex-wrap:nowrap}.catalogControls .cartGoto{margin-left:auto;padding:9px 14px;border-radius:12px;justify-content:center;box-shadow:0 4px 12px rgba(37,99,235,.10)}}

/* ── FORMS ── */
.form{display:grid;gap:16px}
.form label{display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:600;color:#475569}
.form input,.form select,.form textarea{
  background:#f8fafc;border:1.5px solid var(--line);
  border-radius:11px;padding:11px 14px;
  font-size:14px;font-family:inherit;color:#0f172a;
  outline:none;transition:all .2s ease;
  box-sizing:border-box;width:100%;
}
.form input:focus,.form select:focus,.form textarea:focus{border-color:var(--b);background:#fff;box-shadow:0 0 0 3px rgba(37,99,235,.12)}
.form textarea{min-height:100px;resize:vertical}
.actions{display:flex;flex-wrap:wrap;gap:10px}
.checkoutDoneActions{justify-content:center;margin-top:20px;display:flex;flex-direction:column;align-items:center;gap:12px}
.checkoutDoneActions .checkoutDoneBtn{width:min(330px,100%);min-height:58px;box-sizing:border-box;justify-content:center;text-align:center;border-radius:14px;box-shadow:0 5px 14px rgba(15,23,42,.12)}
.checkoutDoneActions .checkoutDoneBtn.secondary{box-shadow:0 5px 14px rgba(15,23,42,.10)}
.checkoutDoneActions .checkoutDoneBtn:hover{box-shadow:0 7px 18px rgba(15,23,42,.16)}

/* ── TOAST ── */
.toast{position:fixed;bottom:24px;right:24px;background:#0f172a;color:#fff;padding:12px 20px;border-radius:14px;font-size:14px;font-weight:600;z-index:999;opacity:0;transform:translateY(8px);transition:all .3s cubic-bezier(.34,1.56,.64,1);pointer-events:none;box-shadow:0 8px 30px rgba(0,0,0,.3)}
.toast.show{opacity:1;transform:translateY(0)}
@media(max-width:480px){.toast{bottom:16px;right:16px;left:16px;text-align:center}}

/* ── TABLES / LISTS ── */
.listWrap{overflow-x:auto;border-radius:var(--r);border:1px solid var(--line);box-shadow:var(--shadow-sm)}
.listTable{width:100%;border-collapse:collapse;font-size:14px}
.listTable thead{background:#f8fafc;border-bottom:1px solid var(--line)}
.listTable th{padding:10px 12px;font-weight:700;color:#475569;font-size:12px;text-transform:uppercase;letter-spacing:.06em;white-space:nowrap;text-align:left}
.listTable td{padding:11px 12px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
.listTable tr:last-child td{border-bottom:none}
.listTable tr:hover td{background:#fafbff}
.warnText{color:#b91c1c;font-weight:800}
.accountingForm{grid-template-columns:repeat(3,minmax(0,1fr))}
@media(min-width:801px){.accountingForm button.accountingSubmitBtn{grid-column:1/-1;width:170px;height:42px;min-height:42px;max-width:170px;padding:10px 20px;font-size:14px;line-height:1.2;justify-self:center;display:inline-flex;align-items:center;justify-content:center;white-space:nowrap;box-sizing:border-box}}
@media(max-width:800px){.accountingForm button.accountingSubmitBtn{width:170px;height:42px;min-height:42px;max-width:170px;padding:10px 20px;font-size:14px;line-height:1.2;justify-self:center;display:inline-flex;align-items:center;justify-content:center;white-space:nowrap;box-sizing:border-box}}
@media(max-width:800px){.accountingForm{grid-template-columns:1fr}.adminShell .form{grid-template-columns:1fr!important}}
.num{color:var(--mut);font-size:13px;width:36px}
.mainCell{min-width:160px}
.name{font-weight:700;color:#0f172a}
.weight{color:#64748b;font-size:13px;white-space:normal;min-width:96px;line-height:1.35}
.weight .prodResult{display:inline-block;margin-top:4px}
.mobileMeta{display:none;font-size:12px;color:var(--mut);margin-top:2px}
@media(max-width:700px){.weight,.catHead,.weightHead{display:none}.mobileMeta{display:block}}
.newDot{display:inline-flex;align-items:center;font-size:10px;font-weight:800;background:#2563eb;color:#fff;padding:2px 8px;border-radius:999px;letter-spacing:.04em;margin-right:4px}
.hiddenBadge{display:inline-flex;align-items:center;font-size:10px;font-weight:700;background:#fee2e2;color:#b91c1c;padding:2px 8px;border-radius:999px;margin-right:4px}
.hiddenProduct{opacity:.5}
.listQty{display:flex;align-items:center;gap:5px}
.qtynum{font-size:14px;min-width:0;padding:7px 10px;font-weight:800;text-align:center;min-width:32px}
.status{display:inline-flex;align-items:center;background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0;border-radius:999px;padding:2px 10px;font-size:12px;font-weight:700;margin-left:6px}

.qtySide{display:flex;align-items:center;justify-content:flex-end;gap:8px}
.mobileDepositBadge{display:none}
@media(max-width:700px){
  .catalogListWrap{overflow:hidden;width:100%}
  .catalogListTable{width:100%;table-layout:fixed}
  .catalogListTable th,.catalogListTable td{box-sizing:border-box}
  .catalogListTable th:nth-child(1),.catalogListTable td:nth-child(1){width:42px;padding-left:10px;padding-right:4px}
  .catalogListTable th:nth-child(2),.catalogListTable td:nth-child(2){width:auto;padding-left:8px;padding-right:8px}
  .catalogListTable th:nth-child(4),.catalogListTable td:nth-child(4){width:170px;padding-left:4px;padding-right:12px}
  .catalogListTable td{border-bottom:2px solid #cbd5e1}
  .catalogListTable tr:last-child td{border-bottom:none}
  .catalogListTable .mainCell{min-width:0;overflow-wrap:anywhere;word-break:normal}
  .catalogListTable .qtyCell{min-width:0;width:170px;overflow:visible}
  .qtySide{width:100%;display:flex;align-items:center;justify-content:flex-end;gap:6px;flex-wrap:nowrap}
  .mobileDepositBadge{display:inline-flex;align-items:center;justify-content:center;white-space:nowrap;background:#fff7ed;color:#9a3412;border:1px solid #fdba74;border-radius:999px;padding:5px 8px;font-size:10px;font-weight:800;line-height:1;flex:0 0 auto}
  .catalogListTable .listQty{display:flex;align-items:center;justify-content:flex-end;gap:4px;flex:0 0 auto}
  .catalogListTable .iconBtn{width:42px;min-width:42px;min-height:42px;padding:0}
  .catalogListTable .qtynum{min-width:24px;padding:6px 2px}
  .floatingCartButton{position:fixed;z-index:850;top:14px;left:14px;width:48px;height:48px;border-radius:16px;background:linear-gradient(145deg,#ffffff,#eaf2ff);color:#2563eb!important;display:flex;align-items:center;justify-content:center;text-decoration:none;box-shadow:0 8px 22px rgba(37,99,235,.20);font-size:22px;border:1px solid #bfdbfe;opacity:0;visibility:hidden;pointer-events:none;transform:translateY(-10px) scale(.94);transition:opacity .2s ease,transform .2s ease,visibility .2s ease,box-shadow .2s ease}
  .floatingCartButton:active{box-shadow:0 4px 12px rgba(37,99,235,.18);transform:translateY(0) scale(.97)}
  .floatingCartButton.isVisible{opacity:1;visibility:visible;pointer-events:auto;transform:translateY(0) scale(1)}
  .floatingCartCount{position:absolute;top:-6px;right:-6px;min-width:22px;height:22px;padding:0 5px;border-radius:999px;background:#ef4444;color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;border:2px solid #fff;box-sizing:border-box}
}
@media(min-width:701px){.floatingCartButton{display:none!important}}

/* ── LAYOUT 2-COL ── */
.layout2{display:grid;grid-template-columns:260px 1fr;gap:20px;align-items:start}
.side{padding:16px!important}
@media(max-width:800px){.layout2{grid-template-columns:1fr}}

/* ── ANNOUNCEMENTS ── */
.announcementCard{padding:18px;margin-bottom:12px}
.announcementDate{font-size:12px;font-weight:600;color:var(--mut);margin-bottom:8px}
.announcementText{font-size:15px;line-height:1.6;color:#0f172a;white-space:pre-wrap}

/* ── ORDER ── */
.order{padding:20px;margin-bottom:16px}
.orderItemsPreview{margin:14px 0 10px;padding-left:20px;font-size:14px;color:#334155}
.orderItemsPreview li{margin:4px 0}
.orderComment{background:#f8fafc;border:1px solid var(--line);border-radius:11px;padding:12px 14px;font-size:13px;color:#475569;margin:10px 0}
.orderCommentLabel{font-weight:700;color:#334155;margin-bottom:4px;font-size:12px;text-transform:uppercase;letter-spacing:.06em}
.orderHistory{margin-top:22px}
.historyOrder{padding:16px;margin-bottom:12px}
.historyOrder h3{margin:0 0 6px;font-size:17px}
.historyOrder ul{margin:10px 0 0;padding-left:22px}
.historyOrder li{margin:4px 0}
.historyMeta{color:var(--mut);font-size:13px;font-weight:600}
.historyEmpty{padding:18px;text-align:center;color:var(--mut)}
.shopNotice{background:#eff6ff;border:1px solid #bfdbfe;border-radius:11px;padding:10px 14px;font-size:13px;font-weight:600;color:#1d4ed8;margin-bottom:16px}

/* ── CART ── */
.cartSummary{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;background:#fff;border:1px solid var(--line);border-radius:var(--r);padding:18px 20px;margin-bottom:16px;box-shadow:var(--shadow-sm)}
.cartTable td.catCell{font-size:13px;color:#64748b}
@media(max-width:700px){
  .cartSummary{flex-direction:column;align-items:stretch;gap:10px;padding:14px}
  .cartSummary .btn{width:100%;justify-content:center;text-align:center}
  .cartTable{width:100%;table-layout:fixed}
  .cartTable thead th:nth-child(1),.cartTable tbody td:nth-child(1){width:42px}
  .cartTable thead th:nth-child(2),.cartTable tbody td:nth-child(2){width:auto}
  .cartTable thead th:nth-child(3),.cartTable tbody td:nth-child(3){width:150px}
  .cartTable thead th:nth-child(4),.cartTable tbody td:nth-child(4){width:42px}
  .cartTable .mainCell{min-width:0;padding:12px 8px;vertical-align:top}
  .cartTable .name{display:block;line-height:1.28;overflow-wrap:anywhere}
  .cartTable .mobileMeta{display:flex;align-items:center;gap:6px;flex-wrap:nowrap;margin-top:6px;min-width:0;max-width:100%}
  .cartTable .cartTotalBadge{display:inline-flex;align-items:center;min-width:0;max-width:calc(100% - 72px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:#f8fafc;border:1px solid #dbe3ee;border-radius:999px;padding:4px 8px;color:#475569;font-size:11px;font-weight:700;line-height:1.2}
  .cartTable .cartDepositBadge{display:inline-flex;align-items:center;justify-content:center;white-space:nowrap;flex:0 0 auto;background:#fff7ed;border:1px solid #fdba74;border-radius:999px;padding:4px 8px;color:#9a3412;font-size:11px;font-weight:800;line-height:1.2}
  .cartTable .qtyCell{white-space:nowrap;min-width:0;padding:14px 4px 8px;vertical-align:top}
  .cartTable .listQty{justify-content:center;gap:6px}
  .cartTable .qtynum{min-width:28px;padding:5px 2px;font-size:16px}
  .cartTable .deleteCell{width:42px;text-align:center;padding:14px 6px 8px;vertical-align:top}
  .cartTable td{border-bottom:2px solid #d1d9e5}
  .cartTable tr:last-child td{border-bottom:none}
  .cartTable .deleteIcon{width:34px;height:34px;display:inline-flex;align-items:center;justify-content:center}
  .cartTable .iconBtn{width:42px;min-width:42px;min-height:42px;font-size:20px;padding:0}
}

/* ── ADMIN MENU ── */

.notificationCenter{padding:18px;margin-bottom:16px;border:1px solid #dbeafe;background:#f8fbff}.notificationHead{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:10px}.notificationHead h2{margin:0 0 3px;font-size:19px}.notificationHead p{margin:0}.notificationList{display:grid;gap:8px}.notificationItem{display:grid;grid-template-columns:42px 1fr auto;gap:10px;align-items:center;padding:11px;border:1px solid var(--line);border-radius:13px;background:#fff;text-decoration:none;color:var(--d)}.notificationItem:hover{border-color:#93c5fd;background:#eff6ff}.notificationIcon{display:grid;place-items:center;width:42px;height:42px;border-radius:12px;background:#eff6ff;font-size:21px}.notificationItem b{display:block;font-size:14px}.notificationItem small{display:block;color:var(--mut);margin-top:3px;line-height:1.35}.notificationAll{display:block;text-align:center;margin-top:10px}
.adminShell{display:grid;grid-template-columns:1fr;gap:20px;align-items:start}
@media(max-width:800px){.adminShell{grid-template-columns:1fr}}
.adminMenu{
  background:#fff;border:1px solid var(--line);border-radius:var(--r);
  padding:8px;box-shadow:var(--shadow);position:sticky;top:88px;
}
.adminMenuHead{
  display:flex;align-items:center;justify-content:space-between;
  padding:12px 14px 14px;margin-bottom:4px;
  border-bottom:1px solid var(--line);
}
.adminMenuLogo{font-weight:800;font-size:15px;color:var(--d);letter-spacing:-.2px}
.settingsGear{font-size:18px;text-decoration:none;border-radius:8px;padding:3px 6px;transition:background .15s}
.settingsGear:hover{background:#f1f5f9}
.adminMenu a{
  display:flex;align-items:center;padding:10px 14px;border-radius:11px;
  color:#334155;text-decoration:none;font-size:14px;font-weight:500;
  transition:all .18s ease;margin-bottom:2px;
}
.adminMenu a:hover{background:#eff6ff;color:var(--b)}
.adminMenuLogout{color:#ef4444!important;margin-top:4px;border-top:1px solid var(--line);border-radius:0 0 10px 10px!important;padding-top:12px!important}
.adminMenuLogout:hover{background:#fee2e2!important;color:#b91c1c!important}

/* ── ADMIN PRODUCTS ── */
.adminAction{width:1px;white-space:nowrap;padding:8px 6px}
.editIconBtn{background:none;border:none;box-shadow:none;color:#94a3b8;font-size:18px;cursor:pointer;padding:4px 8px;border-radius:8px;transition:all .15s}
.editIconBtn:hover{background:#f1f5f9;color:#475569}
.editInlineInput{border:1.5px solid var(--b);border-radius:8px;padding:6px 10px;font-size:13px;background:#fff;outline:none;font-family:inherit;box-shadow:0 0 0 3px rgba(37,99,235,.1)}
.deleteCell{width:40px;text-align:center}
.adminProductAddForm{grid-template-columns:1.6fr .55fr .8fr auto;align-items:end;gap:10px}
.adminProductAddActions{display:flex;gap:8px;align-items:center}
.adminProductNewCheck{align-items:center!important;flex-direction:row!important;gap:6px!important;font-size:13px!important;cursor:pointer}
.adminProductNewCheck input[type="checkbox"]{width:auto;flex:none}
.adminProductCats{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:12px;padding-bottom:2px}
.adminProductCats .btn{font-size:13px;white-space:nowrap}
.adminProductsTable{min-width:650px}
@media(max-width:800px){
  .adminMenu{position:static;display:flex;overflow-x:auto;gap:4px;padding:8px;scrollbar-width:none;-webkit-overflow-scrolling:touch}
  .adminMenu::-webkit-scrollbar{display:none}
  .adminMenuHead{border-bottom:0;border-right:1px solid var(--line);margin:0 4px 0 0;padding:8px 10px;gap:8px;flex:0 0 auto}
  .adminMenu a{margin:0;white-space:nowrap;flex:0 0 auto;padding:9px 12px}
  .adminMenuLogout{border-top:0!important;border-left:1px solid var(--line);border-radius:11px!important;padding-top:9px!important}
}
@media(max-width:700px){
  .wrap{padding:16px 10px}
  .adminShell{gap:12px}
  .adminProductsSection h1{font-size:26px}
  .adminProductAddCard{padding:12px!important;margin-bottom:12px!important}
  .adminProductAddForm{grid-template-columns:1fr!important;gap:10px!important}
  .adminProductAddActions{display:grid!important;grid-template-columns:1fr;gap:4px!important}
  .adminProductAddActions button{width:100%;justify-content:center}
  .adminProductNewCheck{width:100%;justify-content:flex-start;background:#f8fafc;border:1px solid var(--line);border-radius:11px;padding:10px 12px}
  .adminProductCats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin:0 0 10px;padding:0}
  .adminProductCatExport{display:grid;grid-template-columns:minmax(0,1fr) 30px;align-items:center;gap:4px;min-width:0}
  .adminProductCats .btn{min-height:50px;padding:7px 6px!important;font-size:12.5px!important;white-space:normal;text-align:center;justify-content:center;align-items:center;border-radius:13px;line-height:1.15}
  .adminProductCatExport .btn{width:100%;min-width:0}
  .adminProductCatExport .categoryDownloadIcon{width:30px;height:30px;margin:0;font-size:13px;flex:none}
  .adminProductsTableWrap{border-radius:0;max-width:100%;overflow:visible;background:transparent;border:0;box-shadow:none}
  .adminProductsTable{display:block;min-width:0;width:100%;font-size:13px;background:transparent}
  .adminProductsTable thead{display:none}
  .adminProductsTable tbody{display:grid;gap:10px}
  .adminProductsTable tr{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:start;background:#fff;border:1px solid var(--line);border-radius:16px;padding:12px;box-shadow:var(--shadow)}
  .adminProductsTable td{display:block;border:0!important;padding:0!important}
  .adminProductsTable .num{grid-column:2;grid-row:1;color:#94a3b8;font-size:12px;text-align:right;min-width:auto}
  .adminProductsTable .mainCell{grid-column:1;grid-row:1;min-width:0;font-size:15px;font-weight:800;line-height:1.25}
  .adminProductsTable .mainCell .name,.adminProductsTable .editNameSpan{display:block;overflow-wrap:anywhere}
  .adminProductsTable .mobileMeta{display:block;margin-top:5px;font-size:13px;font-weight:600;color:#64748b}
  .adminProductsTable .weight{display:none}
  .adminProductsTable .adminAction,.adminProductsTable .deleteCell{width:auto;text-align:left}
  .adminProductsTable .adminAction:nth-of-type(4){grid-column:1;grid-row:2}
  .adminProductsTable .adminAction:nth-of-type(5){grid-column:2;grid-row:2}
  .adminProductsTable .adminAction:nth-of-type(6){grid-column:1;grid-row:3}
  .adminProductsTable .deleteCell{grid-column:2;grid-row:3;text-align:right}
  .adminProductsTable .adminAction form{height:100%}
  .adminProductsTable .compactBtn{width:100%;min-height:40px;padding:9px 10px;font-size:12px;justify-content:center}
  .editIconBtn{width:100%;min-height:40px;padding:6px 12px;background:#f8fafc;border:1px solid var(--line);color:#475569}
  .deleteIcon{width:40px;min-height:40px}
  .editInlineInput{width:100%;font-size:14px;padding:8px 9px}
}
@media(max-width:380px){
  .adminProductCats{grid-template-columns:1fr 1fr;gap:6px}
  .adminProductCats .btn{min-height:46px;font-size:11.5px!important;padding:6px 5px!important}
  .adminProductCatExport{grid-template-columns:minmax(0,1fr) 28px;gap:3px}
  .adminProductCatExport .categoryDownloadIcon{width:28px;height:28px;font-size:12px}
  .adminProductsTable tr{padding:10px;gap:8px}
  .adminProductsTable .compactBtn,.editIconBtn{font-size:11.5px;padding-left:7px;padding-right:7px}
}

/* ── CONFIRM MODAL ── */
.confirmOverlay{position:fixed;inset:0;background:rgba(15,23,42,.6);backdrop-filter:blur(6px);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px}
.confirmModal{background:#fff;border-radius:22px;padding:28px 32px;max-width:400px;width:100%;box-shadow:0 24px 60px rgba(15,23,42,.3),0 8px 20px rgba(15,23,42,.15)}
.confirmModal h3{font-size:20px;font-weight:800;color:#0f172a;margin-bottom:10px}
.confirmModal p{font-size:14px;color:var(--mut);line-height:1.55;margin-bottom:22px}
.confirmActions{display:flex;gap:10px;justify-content:flex-end}
.confirmDanger{background:#ef4444;color:#fff;box-shadow:0 4px 14px rgba(239,68,68,.3)}
.confirmDanger:hover{background:#dc2626}
.warn{background:#fef3c7;color:#92400e;border:1px solid #fde68a}

/* ── CHAT ── */
.chatBox{padding:0;overflow:hidden}
.chatHeader{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:18px 20px 14px;border-bottom:1px solid var(--line)}
.chatHeader h2{margin:0 0 4px;font-size:20px}
.chatMessages{display:flex;flex-direction:column;gap:10px;min-height:340px;max-height:55vh;overflow:auto;padding:18px;background:#f8fafc}
.chatMessage{max-width:min(72%,700px);padding:11px 14px;border-radius:18px;border:1px solid var(--line);box-shadow:var(--shadow-sm);line-height:1.5;overflow-wrap:anywhere;word-break:break-word}
.chatMessage.adminMsg{align-self:flex-end;background:#fff;border-top-right-radius:6px}
.chatMessage.shopMsg{align-self:flex-start;background:#fff;border-top-left-radius:6px}
.chatMeta{display:flex;align-items:center;margin-bottom:4px}
.chatMeta b{font-size:13px}
.adminName{color:#dc2626}
.shopName{color:var(--b)}
.chatText{white-space:pre-wrap;color:#0f172a;font-size:14px}
.chatEmpty{text-align:center;color:var(--mut);padding:40px 16px;border:1.5px dashed #cbd5e1;border-radius:16px;margin:8px}
.chatForm{padding:14px 18px 18px;background:#fff;border-top:1px solid var(--line);display:grid;grid-template-columns:1fr auto;align-items:end;gap:10px}
.chatForm label{font-size:13px;color:#475569;font-weight:500}
.chatForm textarea{min-height:52px;max-height:160px;resize:vertical;background:#f8fafc;border:1.5px solid var(--line);border-radius:10px;padding:10px 12px;font-family:inherit;font-size:14px;outline:none;transition:border-color .2s}
.chatForm textarea:focus{border-color:var(--b);background:#fff}
.chatForm button{min-height:52px;padding-left:22px;padding-right:22px}
.shopChecks{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin:16px 0}
.shopChecks .shopCheck{display:flex;flex-direction:row;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border:1.5px solid var(--line);border-radius:12px;background:#f8fafc;font-weight:600;font-size:14px;transition:border-color .2s}
.shopChecks .shopCheck:hover{border-color:#bfdbfe}
.shopChecks .shopCheckName{line-height:1.3}
.shopChecks input[type="checkbox"]{width:18px;height:18px;flex:0 0 auto;accent-color:var(--b);cursor:pointer}

.appScannerControls{display:grid;gap:10px;margin-top:10px}.appManualAddBtn{white-space:nowrap}
@media(max-width:700px){
.appScannerClear .appListHead{margin-bottom:6px}.appScannerClear .barcodeReader{margin:6px auto 0}
.appScannerControls{gap:8px;margin-top:8px}.appCameraActions{display:grid!important;grid-template-columns:1fr 1fr 1.2fr!important;gap:6px!important;margin:0!important}
.appCameraActions button{min-height:42px!important;padding:9px 6px!important;font-size:12px!important;line-height:1.15!important;border-radius:11px!important}
#barcodeForm{display:grid!important;grid-template-columns:minmax(0,1fr) 92px!important;gap:7px!important;margin-top:0!important}
#barcodeForm input,#barcodeForm button{min-height:44px!important;height:44px!important;margin:0!important}#barcodeForm input{font-size:16px!important}
#barcodeForm button{padding:8px 10px!important;font-size:13px!important}
.appManualSheet{align-items:flex-end!important;justify-content:center!important;padding:0!important;background:rgba(15,23,42,0)!important;transition:background .22s ease!important}
.appManualSheet.isOpen{background:rgba(15,23,42,.42)!important}
.appManualSheetBox{width:100%!important;max-width:700px!important;max-height:56vh!important;margin:0!important;border-radius:22px 22px 0 0!important;padding:8px 14px calc(12px + env(safe-area-inset-bottom))!important;overflow:hidden!important;box-shadow:0 -12px 35px rgba(15,23,42,.22)!important;transform:translateY(105%)!important;transition:transform .22s ease!important;display:flex!important;flex-direction:column!important}
.appManualSheet.isOpen .appManualSheetBox{transform:translateY(0)!important}
.appSheetHandle{width:46px;height:5px;border-radius:999px;background:#cbd5e1;margin:0 auto 8px;flex:0 0 auto}
.appSheetHead{display:flex;align-items:center;justify-content:space-between;gap:10px;flex:0 0 auto}.appSheetClose{width:36px!important;height:36px!important;min-height:36px!important;padding:0!important;border-radius:50%!important;background:#f1f5f9!important;color:#334155!important}
.appManualSheetBox h2{font-size:18px!important;margin:0 0 4px!important}.appManualSheetBox>p{font-size:12px!important;margin:0 0 8px!important}
.appManualSheetBox .appBindSearchGrid{display:grid!important;grid-template-columns:115px 1fr!important;gap:7px!important;flex:0 0 auto}.appManualSheetBox label{gap:4px!important;font-size:12px!important}
.appManualSheetBox input,.appManualSheetBox select{min-height:42px!important;padding:9px 10px!important;font-size:16px!important}.appManualNativeSelect{display:none!important}
.manualProductList{overflow:auto;min-height:90px;max-height:190px;margin:8px 0;border:1px solid #e2e8f0;border-radius:12px;background:#fff;overscroll-behavior:contain}
.manualProductRow{width:100%;min-height:48px!important;padding:9px 11px!important;border:0!important;border-bottom:1px solid #eef2f7!important;border-radius:0!important;background:#fff!important;color:#0f172a!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important;text-align:left!important;font-size:13px!important}.manualProductRow:last-child{border-bottom:0!important}.manualProductRow.selected{background:#eff6ff!important;color:#1d4ed8!important}.manualProductRow small{color:#64748b;font-weight:700;white-space:nowrap}.manualProductEmpty{padding:22px 12px;text-align:center;color:#64748b;font-size:13px}
.appManualSheetBox .appBindGrid{grid-template-columns:90px 1fr!important;gap:7px!important;flex:0 0 auto}
.appManualSheetBox .actions{background:#fff;padding-top:8px;margin-top:4px;display:grid!important;grid-template-columns:100px 1fr!important;gap:7px!important;flex:0 0 auto}
.appManualSheetBox .actions button{min-height:44px!important;padding:9px 10px!important}
body.sheetOpen{overflow:hidden}
}
@media(max-width:700px){
/* Мобільне вікно ручного додавання — майже на весь екран */
.appManualSheet{align-items:flex-end!important;padding:0!important}
.appManualSheetBox{width:calc(100% - 12px)!important;max-width:none!important;height:calc(100dvh - 72px)!important;max-height:calc(100dvh - 72px)!important;margin:0 6px!important;border-radius:24px 24px 0 0!important;padding:8px 16px calc(14px + env(safe-area-inset-bottom))!important}
.appManualSheetBox .manualProductList{min-height:160px!important;max-height:none!important;flex:1 1 auto!important;margin:10px 0!important}
.appSheetHead{position:relative!important;min-height:46px!important;padding-right:48px!important}
.appSheetClose{position:absolute!important;right:0!important;top:50%!important;transform:translateY(-50%)!important;display:flex!important;align-items:center!important;justify-content:center!important;width:42px!important;height:42px!important;min-width:42px!important;min-height:42px!important;padding:0!important;margin:0!important;border-radius:50%!important;line-height:1!important;font-size:24px!important;font-weight:700!important;text-align:center!important}
}
@media(max-width:390px){.appCameraActions{grid-template-columns:1fr 1fr!important}.appManualAddBtn{grid-column:1/-1}.appManualSheetBox .appBindGrid{grid-template-columns:1fr!important}}
@media(max-width:700px){.chatMessages{min-height:280px;max-height:58vh;padding:12px}.chatMessage{max-width:90%}.chatForm{grid-template-columns:1fr}.chatForm button{width:100%;justify-content:center}.shopChecks{grid-template-columns:1fr}}

/* ── ORDER EDITOR ── */
.orderEditToggle{margin:12px 0 14px}
.orderEditToggle summary{width:max-content;max-width:100%;list-style:none;border:0;background:#eff6ff;color:var(--b);padding:10px 16px;border-radius:11px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:8px;font-size:13px}
.orderEditToggle summary::-webkit-details-marker{display:none}
.orderEditToggle summary:before{content:'▸';font-size:12px}
.orderEditToggle[open] summary:before{content:'▾'}
.orderEditToggleBody{margin-top:10px}
.orderSearchAddBox{align-items:start}
.orderSearchLabel{position:relative}
.orderSearchAddBox input[name="productSearch"]{font-weight:700}
.orderSearchAddBox input[name="productSearch"]::placeholder{font-weight:500;color:#94a3b8}
.orderSearchResults{display:none;margin-top:8px;border:1px solid var(--line);border-radius:14px;background:#fff;box-shadow:var(--shadow-lg);max-height:260px;overflow:auto;padding:6px;z-index:20}
.orderSearchAddBox.searching .orderSearchResults{display:grid;gap:6px}
.orderSearchOption{display:none;width:100%;background:#fff!important;color:#0f172a!important;border:1px solid var(--line);border-radius:11px;padding:9px 10px;text-align:left;box-shadow:none;justify-content:flex-start}
.orderSearchOption.is-match{display:grid}
.orderSearchOption b{font-size:14px;line-height:1.25;overflow-wrap:anywhere}
.orderSearchOption span{color:var(--mut);font-size:12px;font-weight:600;line-height:1.25}
.orderSearchOption:hover{background:#eff6ff!important;color:var(--b)!important}
.orderEditTable{gap:6px}
.orderEditQtyStepper,.orderAddQtyStepper{display:grid;grid-template-columns:38px 42px 38px;gap:6px;align-items:center}
.orderEditQtyStepper button,.orderAddQtyStepper button{width:38px;min-height:38px;padding:0;justify-content:center;font-size:22px;line-height:1;border-radius:11px}
.orderAddQtyStepper input{text-align:center;font-weight:900;padding-left:4px;padding-right:4px}
.orderEditQtyStepper form{margin:0}
.orderEditQtyStepper .qtynum{font-size:14px;min-width:0;padding:7px 0}
.orderSearchAddBox.is-picked .orderSearchResults{display:none!important}
.orderEditRow{display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:#f8fafc}
.orderEditInfo b{font-size:14px;font-weight:700;line-height:1.25;color:#0f172a}
.orderEditInfo span{font-size:12px;color:var(--mut);font-weight:500}
.orderEditBox{border:1px solid var(--line);border-radius:14px;padding:16px;background:#fff;margin-top:12px}
.orderEditHead{margin-bottom:14px}
.orderEditHead b{font-weight:700;font-size:15px}
.orderEditHead span{display:block;font-size:13px;color:var(--mut);margin-top:3px}
.orderEmptyItems{color:var(--mut);font-size:13px;padding:12px 0}
.orderAddBox{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:start;background:#f8fafc;border:1px solid var(--line);border-radius:14px;padding:14px}
.orderAddActions{display:flex;align-items:end;gap:8px}
.orderAddQty{display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:600;color:#475569}
.orderAddSubmit{white-space:nowrap}
.smallDelete{width:32px!important;height:32px!important;min-height:32px!important;font-size:18px!important}
@media(max-width:720px){
  .orderEditToggle{margin:12px 0}
  .orderEditToggle summary{width:100%;justify-content:center;padding:12px 14px;font-size:14px}
  .orderEditToggleBody{margin-top:12px}

  /* Зручний мобільний пошук товарів */
  .orderAddBox.orderSearchAddBox{display:block;padding:14px;border-radius:16px;background:#fff}
  .orderSearchLabel{display:block;width:100%}
  .orderSearchAddBox input[name="productSearch"]{width:100%;min-height:48px;padding:12px 14px;font-size:16px;border-radius:12px}
  .orderSearchResults{max-height:38vh;margin-top:8px;padding:0;border-radius:12px;box-shadow:none;overflow-y:auto;-webkit-overflow-scrolling:touch}
  .orderSearchAddBox.searching .orderSearchResults{display:block}
  .orderSearchOption,.orderSearchOption.is-match{width:100%;min-height:58px;border:0;border-bottom:1px solid var(--line);border-radius:0;padding:11px 12px;display:none!important;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10px}
  .orderSearchOption.is-match{display:grid!important}
  .orderSearchOption:first-child{border-radius:11px 11px 0 0}
  .orderSearchOption:last-child{border-bottom:0;border-radius:0 0 11px 11px}
  .orderSearchOption b{font-size:14px;line-height:1.3}
  .orderSearchOption span{text-align:right;max-width:105px;font-size:11px}
  .orderAddActions{display:grid;grid-template-columns:minmax(0,1fr) minmax(120px,.72fr);gap:10px;align-items:end;margin-top:12px}
  .orderAddQty{min-width:0}
  .orderAddQtyStepper{grid-template-columns:42px minmax(56px,1fr) 42px;gap:6px}
  .orderAddQtyStepper button{width:42px;min-height:42px}
  .orderAddQtyStepper input{min-width:0;height:42px}
  .orderAddSubmit{width:100%;min-height:42px;justify-content:center;padding-left:12px;padding-right:12px}

  /* Рівний список позицій замовлення */
  .orderEditBox{padding:14px;border-radius:16px}
  .orderEditHead{margin-bottom:10px}
  .orderEditList.orderEditTable{display:grid;gap:8px}
  .orderEditRow{display:grid;grid-template-columns:minmax(0,1fr) auto 34px;grid-template-areas:'info qty del';gap:8px;align-items:center;padding:11px 10px;border-radius:12px;background:#f8fafc}
  .orderEditInfo{grid-area:info;min-width:0;display:flex;flex-direction:column;gap:3px}
  .orderEditInfo b{font-size:14px;line-height:1.25;overflow-wrap:anywhere}
  .orderEditInfo span{font-size:12px;line-height:1.2}
  .orderEditQtyStepper{grid-area:qty;display:grid;grid-template-columns:38px 42px 38px;gap:5px;align-items:center}
  .orderEditQtyStepper button{width:38px;min-height:38px;font-size:20px;border-radius:10px}
  .orderEditQtyStepper .qtynum{min-width:42px;text-align:center;font-size:14px;font-weight:800;padding:8px 2px}
  .smallDelete{grid-area:del;width:32px!important;height:32px!important;min-width:32px!important;min-height:32px!important;margin:0!important;align-self:center;justify-self:center}
  .orderEditBox>.actions{display:grid!important;grid-template-columns:1fr;gap:8px}
  .orderEditBox>.actions button{width:100%;justify-content:center}
}
@media(max-width:430px){
  .orderEditRow{grid-template-columns:minmax(0,1fr) 34px;grid-template-areas:'info del' 'qty qty'}
  .orderEditQtyStepper{grid-template-columns:42px minmax(70px,1fr) 42px;width:100%;margin-top:4px}
  .orderEditQtyStepper button{width:42px}
  .orderAddActions{grid-template-columns:1fr}
}

/* ══════════════════════════════════════════
   CATEGORIES SIDEBAR — modernized
══════════════════════════════════════════ */
.catSideNew{
  background:#fff!important;
  border:1px solid var(--line)!important;
  box-shadow:var(--shadow)!important;
  padding:14px!important;
  border-radius:var(--r)!important;
}
.catSideHead{display:flex;flex-direction:column;gap:6px;margin-bottom:14px}
.catAllLink,.catNewLink{
  display:flex;align-items:center;gap:10px;
  padding:10px 12px;border-radius:12px;
  text-decoration:none;color:#334155;
  font-weight:600;font-size:13.5px;
  transition:all .2s ease;
  background:#f8fafc;border:1.5px solid transparent;
}
.catAllLink:hover,.catNewLink:hover{background:#eff6ff;color:var(--b);border-color:#bfdbfe}
.catAllActive{background:#eff6ff!important;color:var(--b)!important;border-color:#bfdbfe!important;font-weight:700!important}
.catNewActive{background:rgba(124,58,237,.08)!important;color:#7c3aed!important;border-color:rgba(124,58,237,.2)!important;font-weight:700!important}
.catAllIcon{
  font-size:18px;line-height:1;flex-shrink:0;
  width:34px;height:34px;
  display:flex;align-items:center;justify-content:center;
  background:rgba(37,99,235,.08);border-radius:9px;
  transition:transform .25s cubic-bezier(.34,1.56,.64,1);
}
.catAllLink:hover .catAllIcon,.catNewLink:hover .catAllIcon{transform:scale(1.12)}
.catAllLabel{flex:1;font-size:13px}
.catAllCount,.catNewCnt{
  font-size:11px;font-weight:700;
  background:#eff6ff;color:var(--b);
  padding:2px 8px;border-radius:999px;min-width:26px;text-align:center;
}
.catNewCnt{background:rgba(124,58,237,.1);color:#7c3aed}

/* Category grid — iOS 2026 style cards */
.catGridNew{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:14px}
.catCardNew{
  display:flex;flex-direction:column;align-items:center;gap:8px;
  padding:14px 8px 12px;border-radius:20px;
  text-decoration:none;color:#334155;
  border:1.5px solid rgba(255,255,255,.85);
  background:linear-gradient(150deg,rgba(255,255,255,.97) 0%,rgba(248,250,252,.92) 100%);
  transition:transform .22s cubic-bezier(.34,1.56,.64,1),box-shadow .22s ease,border-color .22s ease;
  box-shadow:0 2px 10px rgba(15,23,42,.07),0 1px 2px rgba(15,23,42,.04),inset 0 1px 0 rgba(255,255,255,.9);
  position:relative;overflow:hidden;
  -webkit-tap-highlight-color:transparent;
}
.catCardNew::before{
  content:'';position:absolute;inset:0;
  background:linear-gradient(145deg,rgba(255,255,255,.5) 0%,transparent 60%);
  border-radius:inherit;pointer-events:none;
}
.catCardNew:hover{
  transform:translateY(-3px) scale(1.04);
  box-shadow:0 10px 28px rgba(15,23,42,.13),0 2px 6px rgba(15,23,42,.06),inset 0 1px 0 rgba(255,255,255,.9);
  border-color:rgba(255,255,255,.95);
}
.catCardNew:active{transform:scale(0.97);transition-duration:.12s}
.catCardActive{
  border-color:rgba(37,99,235,.3)!important;
  background:linear-gradient(150deg,#eff6ff 0%,#dbeafe 100%)!important;
  color:var(--b)!important;
  box-shadow:0 6px 22px rgba(37,99,235,.18),inset 0 1px 0 rgba(255,255,255,.8)!important;
}
.catIconNew{
  width:52px;height:52px;border-radius:16px;
  display:flex;align-items:center;justify-content:center;
  font-size:24px;flex-shrink:0;
  transition:transform .25s cubic-bezier(.34,1.56,.64,1),box-shadow .25s ease;
  box-shadow:0 3px 10px rgba(0,0,0,.1),inset 0 1px 0 rgba(255,255,255,.7);
  overflow:hidden;
}
.catIconNew svg{display:block;width:36px;height:36px;flex-shrink:0}
.catCardNew:hover .catIconNew{transform:scale(1.1);box-shadow:0 6px 18px rgba(0,0,0,.16),inset 0 1px 0 rgba(255,255,255,.75)}
.catCardNew:active .catIconNew{transform:scale(0.95)}
.catCardActive .catIconNew{transform:scale(1.05)}
.catCardLbl{font-size:10.5px;font-weight:700;line-height:1.3;text-align:center;color:inherit;max-width:100%}
.catCardCnt{
  font-size:10px;font-weight:700;
  padding:2px 8px;border-radius:999px;
  background:rgba(0,0,0,.06);color:#64748b;
  min-width:22px;text-align:center;
}
.catCardActive .catCardCnt{background:rgba(37,99,235,.15);color:var(--b)}

/* Search in sidebar */
.catSearch{position:relative;margin-top:4px}
.catSearchIcon{position:absolute;left:11px;top:50%;transform:translateY(-50%);font-size:14px;pointer-events:none;z-index:1;color:#94a3b8}
.catSearch input{
  width:100%;padding:10px 10px 10px 34px;
  border:1.5px solid var(--line);border-radius:12px;
  font-size:13px;font-family:inherit;outline:none;
  background:#f8fafc;transition:all .2s ease;box-sizing:border-box;color:#0f172a;
}
.catSearch input:focus{border-color:var(--b);background:#fff;box-shadow:0 0 0 3px rgba(37,99,235,.1)}
.catSearch input::placeholder{color:#94a3b8}

@media(max-width:700px){
  .catGridNew{grid-template-columns:repeat(4,1fr);gap:6px}
  .catCardNew{padding:10px 5px 9px;gap:6px;border-radius:15px}
  .catIconNew{width:42px;height:42px;font-size:19px;border-radius:13px}
  .catIconNew svg{width:28px;height:28px}
  .catCardLbl{font-size:9.5px}
  .catSideHead{flex-direction:row}
  .catAllLink,.catNewLink{flex:1;padding:9px 10px;font-size:12px;gap:7px}
  .catAllIcon{width:30px;height:30px;font-size:16px;border-radius:8px}
}

/* ── CATALOG HEADER & PRODUCT CARDS ── */
.viewToggle{display:flex;gap:3px;background:#f1f5f9;border-radius:11px;padding:3px}
.viewBtn{display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:8px;border:none;background:transparent;cursor:pointer;color:#64748b;transition:all .18s ease;padding:0;flex-shrink:0;box-shadow:none}
.viewBtn.active{background:#fff;color:var(--b);box-shadow:0 2px 8px rgba(15,23,42,.12)}
.catalogHeader{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px}
.catalogTitle{font-size:24px;font-weight:900;color:#0f172a;margin:0;letter-spacing:-.4px}

.prodGrid{display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:stretch;grid-auto-rows:1fr}
.prodCard{
  background:#fff;border:1.5px solid rgba(0,0,0,.07);
  border-radius:18px;padding:15px 14px;
  display:flex;flex-direction:column;gap:10px;height:100%;
  box-shadow:0 2px 10px rgba(15,23,42,.05);
  transition:all .22s cubic-bezier(.34,1.56,.64,1);
  position:relative;overflow:hidden;
}
.prodCard::after{
  content:'';position:absolute;inset:0;
  background:linear-gradient(135deg,rgba(37,99,235,.04),transparent);
  opacity:0;transition:opacity .22s ease;pointer-events:none;
}
.prodCard:hover{
  box-shadow:0 10px 28px rgba(15,23,42,.11);
  border-color:rgba(37,99,235,.22);
  transform:translateY(-2px);
}
.prodCard:hover::after{opacity:1}
.prodCardBadge{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;color:var(--b);background:#eff6ff;padding:3px 9px;border-radius:999px;width:max-content}
.prodCardNew{font-size:10px;font-weight:800;color:#fff;background:linear-gradient(135deg,#2563eb,#1d4ed8);padding:2px 8px;border-radius:999px;letter-spacing:.3px;text-transform:uppercase}
.prodCardName{font-size:14px;font-weight:800;color:#0f172a;line-height:1.35;min-height:38px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.prodCardWeight{font-size:12px;color:#64748b;font-weight:600;min-height:24px;line-height:1.3;overflow-wrap:anywhere;display:flex;align-items:center}
.prodCardDepositBadge{display:inline-flex;align-items:center;justify-content:center;white-space:nowrap;background:#fff7ed;color:#9a3412;border:1px solid #fdba74;border-radius:999px;padding:5px 9px;font-size:10px;font-weight:800;line-height:1;width:max-content}
.prodResult{font-size:12px;font-weight:800;color:#0f172a;background:#f8fafc;border:1px solid var(--line);border-radius:10px;padding:7px 9px;white-space:normal;overflow-wrap:anywhere;line-height:1.25}.mobileMeta .prodResult{display:inline-block;margin-top:4px}
.prodCardQty{display:grid;grid-template-columns:40px 1fr 40px;gap:6px;align-items:center;margin-top:auto}
.prodCardQty button{width:40px;min-height:40px;padding:0;justify-content:center;font-size:22px;line-height:1;border-radius:12px}
.prodCardQtyNum{text-align:center;font-weight:800;background:#f8fafc;border:1.5px solid var(--line);border-radius:11px;padding:7px 4px;font-size:16px;min-width:36px;color:#0f172a}

@media(max-width:700px){.prodGrid{gap:8px}.prodCard{padding:12px 10px;gap:8px;min-height:185px}.prodCardName{min-height:40px;display:block;-webkit-line-clamp:unset;-webkit-box-orient:initial;overflow:visible;white-space:normal;overflow-wrap:anywhere;word-break:break-word}.prodCardWeight{margin-top:auto}.prodCardQty{grid-template-columns:36px 1fr 36px;margin-top:0}.prodCardQty button{width:36px;min-height:36px;font-size:20px}.prodCardQtyNum{font-size:14px}.catalogHeader{gap:8px}}

/* ── NOTES / SETTINGS ── */
.noteCard{padding:18px;margin-bottom:12px}
.noteDate{font-size:12px;font-weight:600;color:var(--mut);margin-bottom:6px}
.noteText{font-size:14px;line-height:1.6;white-space:pre-wrap}
.shopSettingsGrid{display:grid;gap:14px}
.shopSettingRow{display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center;padding:14px 16px;border:1.5px solid var(--line);border-radius:14px;background:#f8fafc}
.shopSettingName{font-weight:700;font-size:14px}
@media(max-width:700px){
  .shopSettingRow{grid-template-columns:1fr auto;gap:10px 8px;align-items:center}
  .shopSettingName{grid-column:1/-1}
  .shopSettingRow form[action="/admin/shop-password"]{grid-column:1/2;display:flex;align-items:center;gap:6px;min-width:0;flex-wrap:nowrap}
  .shopSettingRow form[action="/admin/shop-password"] input[name="password"]{width:100%!important;max-width:180px;min-width:0;box-sizing:border-box}
  .shopSettingRow form[action="/admin/shop-password"] .compactBtn{flex:0 0 auto;white-space:nowrap}
  .shopSettingRow form[action="/admin/shop-delete"]{grid-column:2/3;grid-row:2;justify-self:end}
}

.mobileBackToCabinet{display:none;text-decoration:none;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:13px 16px;color:var(--d);font-weight:800;box-shadow:var(--shadow-sm);margin-bottom:12px}
.adminShell .adminMenu{display:none!important}
.adminShell:not(.adminHomeShell) .mobileBackToCabinet{display:flex;align-items:center}
.adminHomeShell .mobileBackToCabinet{display:none!important}
@media(max-width:800px){.adminShell:not(.adminHomeShell) .adminMenu{display:none!important}.adminShell:not(.adminHomeShell) .mobileBackToCabinet{display:flex;align-items:center}.adminHomeShell .mobileBackToCabinet{display:none!important}}
.adminCabinetList{display:grid;grid-template-columns:1fr;gap:10px;margin:16px 0}
.adminCabinetItem{display:flex;align-items:center;gap:12px;padding:16px 18px;background:var(--card);border:1px solid var(--line);border-radius:16px;text-decoration:none;color:var(--d);font-weight:800;box-shadow:var(--shadow-sm);transition:.2s}
.adminCabinetItem:hover{transform:translateY(-1px);box-shadow:var(--shadow);border-color:#bfdbfe}
.adminCabinetIcon{width:38px;height:38px;display:grid;place-items:center;border-radius:12px;background:#eff6ff}
.adminCabinetArrow{margin-left:auto;color:var(--mut);font-size:24px}
.onlineCard{padding:20px;margin-top:16px}.onlineList{display:grid;gap:8px;margin-top:10px}.onlineRow{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--line)}.onlineRow:last-child{border-bottom:0}
.onlineDot{width:10px;height:10px;border-radius:999px;display:inline-block;flex:0 0 auto}.isOnline{background:#22c55e;box-shadow:0 0 0 4px rgba(34,197,94,.12)}.isOffline{background:#94a3b8}
.messageDeleteBtn{margin-left:8px;width:24px;height:24px;font-size:16px;line-height:1}.directDeleteForm{display:inline-flex;margin-left:auto}.chatMeta{display:flex;align-items:center;gap:4px}.messagesLayout{display:grid;grid-template-columns:260px 1fr;gap:16px;align-items:start}.shopMessagesList{padding:16px}.shopMessagesList h2{margin-bottom:10px}.messageShop{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:11px 10px;border-radius:12px;color:var(--d);text-decoration:none}.messageShop:hover,.messageShop.active{background:#eff6ff}.messageShop small{display:block;color:var(--mut);font-weight:500;font-size:12px;margin-top:2px}
.notifBadgeCount{margin-left:6px;background:linear-gradient(135deg,#ef4444,#db2777);color:#fff;box-shadow:0 4px 12px rgba(219,39,119,.22);animation:notifPop .22s ease}
@keyframes notifPop{from{transform:scale(.78);opacity:.2}to{transform:scale(1);opacity:1}}
.adminSearchCard{padding:12px 14px;margin-bottom:14px}.adminSearchWrap{position:relative}.adminSearchWrap input{width:100%;padding:12px 14px 12px 40px;border:1.5px solid var(--line);border-radius:14px;font-size:14px;font-family:inherit;outline:none;background:#f8fafc;color:#0f172a;transition:.2s}.adminSearchWrap input:focus{background:#fff;border-color:var(--b);box-shadow:0 0 0 3px rgba(37,99,235,.1)}.adminSearchIcon{position:absolute;left:14px;top:50%;transform:translateY(-50%);color:#94a3b8}.adminSearchEmpty{display:none;padding:22px;text-align:center;color:var(--mut);font-weight:700}
@media(max-width:700px){.messagesLayout{grid-template-columns:1fr}.adminCabinetItem{padding:14px 15px}.onlineCard{padding:16px}.adminMenu{flex-direction:column;overflow-x:visible}.adminMenuHead{border-right:0!important;border-bottom:1px solid var(--line)!important;margin:0!important}.adminMenu a{white-space:normal;width:100%}}
@media(max-width:800px){.adminHomeShell .adminMenu{display:none}}


.adminProductCatExport{display:inline-flex;flex-direction:column;align-items:center;gap:4px}
.categoryDownloadIcon{width:26px;height:26px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;text-decoration:none;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);font-size:14px;line-height:1;transition:.15s ease}
.categoryDownloadIcon:hover{transform:translateY(-1px);background:rgba(255,255,255,.14)}
.categoryDownloadPlaceholder{visibility:hidden!important;pointer-events:none!important}

.kegCard{padding:20px}.kegRows{display:grid;gap:10px}.kegRow,.kegVerifyRow{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px;border:1px solid var(--line);border-radius:14px;background:#f8fafc}.kegRow.onAccount{border-color:#fca5a5;background:#fff1f2;box-shadow:0 5px 16px rgba(220,38,38,.08)}.kegRow.onAccount b,.kegRow.onAccount small{color:#b91c1c}.kegTransferCard{padding:18px;margin-top:18px}.kegTransferStatus{display:inline-flex;padding:6px 10px;border-radius:999px;font-size:12px;font-weight:800}.kegTransferStatus.warehouse{background:#fff7ed;color:#c2410c}.kegTransferStatus.receiver{background:#eff6ff;color:#1d4ed8}.kegTransferStatus.done{background:#ecfdf5;color:#047857}.kegTransferStatus.rejected{background:#fef2f2;color:#b91c1c}.kegTransferActions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.kegTransferItems{margin:10px 0 0;padding-left:20px}.kegTransferItems li{margin:4px 0}.kegStepper{display:flex;align-items:center;gap:8px}.kegStepper input{width:76px;text-align:center;padding:10px;border:1.5px solid var(--line);border-radius:10px;font-weight:800}.kegStepper button{min-width:42px;padding:10px}.kegSendBtn{width:100%;margin-top:16px}.kegHistory{padding:18px;margin-bottom:12px}.kegMiniList{list-style:none;padding:0;margin:12px 0}.kegMiniList li{display:flex;justify-content:space-between;border-bottom:1px solid var(--line);padding:8px 0}.kegRequestLink{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:18px;margin-bottom:10px;text-decoration:none;color:var(--d)}.kegRequestLink:hover{border-color:#bfdbfe}.kegRequestMeta{text-align:right;display:grid;gap:8px;justify-items:end}.kegStatus.pending{background:#fff7ed;color:#c2410c}.kegStatus.ok{background:#ecfdf5;color:#047857}.kegStatus.warn{background:#fef2f2;color:#b91c1c}.kegVerifyRow>div{display:grid;gap:4px}.kegVerifyRow label{display:grid;gap:6px;font-size:12px;font-weight:700}.kegTypeRow{padding:12px;margin-bottom:10px}.kegTypeRow form{display:grid;grid-template-columns:1fr 100px auto auto;gap:10px;align-items:center}.kegTypeRow input,.kegFilters input,.kegFilters select{padding:10px;border:1.5px solid var(--line);border-radius:10px;font-family:inherit}.kegActive{display:flex;align-items:center;gap:6px}.kegFilters{display:grid;grid-template-columns:repeat(4,minmax(130px,1fr)) auto auto;gap:10px;align-items:end}.kegFilters label{display:grid;gap:6px;font-size:12px;font-weight:700}.kegBalanceShop{display:block;padding:14px 12px;border-bottom:1px solid var(--line);color:inherit;text-decoration:none;border-radius:12px}.kegBalanceShop:hover{background:#f8fafc}.kegBalanceHead{display:flex;justify-content:space-between;align-items:center;gap:12px}.kegTransferGrid{display:grid;gap:10px}.kegTransferRow{display:grid;grid-template-columns:minmax(0,1fr) 110px 150px;gap:12px;align-items:center;padding:12px;border:1px solid var(--line);border-radius:12px}.kegTransferRow input{width:100%;padding:10px;border:1.5px solid var(--line);border-radius:10px}.kegTransferShopLabel,.kegTransferCommentLabel{display:grid;gap:6px;font-weight:700}.kegTransferShopLabel select,.kegTransferCommentLabel input{width:100%;padding:11px;border:1.5px solid var(--line);border-radius:10px;font-family:inherit;background:#fff}.kegTransferRows{margin-top:14px}.kegTransferCommentLabel{margin-top:14px}.kegTransferHistory{margin-top:18px}.kegTransferHistory li{padding:8px 0;border-bottom:1px solid var(--line)}@media(max-width:700px){.kegRow,.kegVerifyRow{align-items:flex-start;flex-direction:column}.kegVerifyRow label{width:100%}.kegRequestLink{align-items:flex-start}.kegTypeRow form,.kegFilters{grid-template-columns:1fr}.kegRequestMeta{justify-items:end;min-width:110px}.kegStepper{width:100%}.kegStepper input{flex:1}.kegTransferRow{grid-template-columns:1fr}.kegBalanceHead{align-items:flex-start}}

/* Рівна сітка історії заявок */
.appHistoryTable{width:100%;min-width:760px;table-layout:fixed;border-collapse:collapse}
.appHistoryTable .appHistoryColNo{width:7%}
.appHistoryTable .appHistoryColProduct{width:43%}
.appHistoryTable .appHistoryColValue{width:18%}
.appHistoryTable .appHistoryColUnit{width:12%}
.appHistoryTable .appHistoryColBarcode{width:20%}
.appHistoryTable th,.appHistoryTable td{box-sizing:border-box;vertical-align:middle;text-align:left;overflow-wrap:anywhere}
.appHistoryTable th:first-child,.appHistoryTable td:first-child{text-align:center}
.appHistoryTable th:nth-child(3),.appHistoryTable td:nth-child(3),.appHistoryTable th:nth-child(4),.appHistoryTable td:nth-child(4){white-space:nowrap}
.appHistoryOrder{width:100%;box-sizing:border-box}
.appHistoryHead{min-height:48px}

/* Пошук товару під час прив’язки невідомого штрихкоду */
.bindProductList{overflow:auto;min-height:150px;max-height:320px;margin:10px 0;border:1px solid #dbe3ee;border-radius:12px;background:#fff;overscroll-behavior:contain}
.bindProductRow{appearance:none;-webkit-appearance:none;width:100%;min-height:50px;padding:10px 12px;border:0;border-bottom:1px solid #edf1f6;border-radius:0;background:#fff;color:#0f172a;display:flex;align-items:center;justify-content:space-between;gap:12px;text-align:left;font:inherit;font-size:14px;cursor:pointer;box-shadow:none}
.bindProductRow:last-child{border-bottom:0}.bindProductRow:hover{background:#f8fafc}.bindProductRow.selected{background:#eff6ff;color:#1d4ed8;box-shadow:inset 3px 0 0 #2563eb}.bindProductRow span{min-width:0;overflow-wrap:anywhere;font-weight:650}.bindProductRow small{flex:0 0 auto;color:#64748b;font-weight:700;white-space:nowrap;background:#f1f5f9;border-radius:999px;padding:3px 8px}.bindProductRow.selected small{background:#dbeafe;color:#1d4ed8}.bindProductEmpty{padding:24px 14px;text-align:center;color:#64748b;font-size:13px}
@media(max-width:700px){#bindModal{align-items:center!important;padding:8px!important;overflow:hidden!important}#bindModal .appModalBox{width:100%!important;max-width:none!important;height:calc(100svh - 16px)!important;max-height:calc(100svh - 16px)!important;margin:0!important;border-radius:22px!important;padding:14px 16px calc(12px + env(safe-area-inset-bottom))!important;display:flex!important;flex-direction:column!important;overflow:hidden!important;box-sizing:border-box!important}#bindModal .appModalBox>h2{flex:0 0 auto!important;margin:0 0 6px!important;font-size:clamp(24px,7vw,34px)!important;line-height:1.15!important}#bindModal .appModalBox>p{flex:0 0 auto!important;margin:4px 0 8px!important}#bindModal .appBindSearchGrid{flex:0 0 auto!important;gap:6px!important}#bindModal .appBindSearchGrid label{margin:6px 0!important}#bindModal .bindProductList{min-height:110px!important;max-height:none!important;flex:1 1 0!important;overflow-y:auto!important;-webkit-overflow-scrolling:touch!important;margin:8px 0!important}#bindModal .appBindGrid{flex:0 0 auto!important;display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important}#bindModal .appBindGrid label{margin:6px 0!important}#bindModal .actions{position:sticky!important;bottom:0!important;z-index:3!important;flex:0 0 auto!important;display:grid!important;grid-template-columns:110px 1fr!important;gap:8px!important;margin-top:8px!important;padding-top:8px!important;background:#fff!important}#bindModal .actions button{width:100%!important;min-height:48px!important}}@media(max-width:390px){#bindModal .appBindGrid{grid-template-columns:1fr!important}#bindModal .appModalBox>h2{font-size:25px!important}}
@media(max-width:700px){#bindModal .appBindGrid{align-items:stretch!important}#bindModal .appBindGrid label{display:grid!important;grid-template-rows:minmax(58px,auto) 58px!important;align-content:end!important;margin:0!important;min-width:0!important}#bindModal .appBindFieldTitle{display:flex!important;align-items:flex-end!important;min-height:58px!important;line-height:1.2!important;padding-bottom:8px!important}#bindModal .appBindGrid input{height:58px!important;min-height:58px!important;box-sizing:border-box!important;margin:0!important}}
/* Акуратний список товарів без штрихкоду на ПК і телефоні */
.manualProductList{overflow:auto;min-height:120px;max-height:300px;margin:10px 0;border:1px solid #dbe3ee;border-radius:12px;background:#fff;overscroll-behavior:contain}
.manualProductRow{appearance:none;-webkit-appearance:none;width:100%;min-height:50px;padding:10px 12px;border:0;border-bottom:1px solid #edf1f6;border-radius:0;background:#fff;color:#0f172a;display:flex;align-items:center;justify-content:space-between;gap:12px;text-align:left;font:inherit;font-size:14px;cursor:pointer;box-shadow:none}
.manualProductRow:last-child{border-bottom:0}
.manualProductRow:hover{background:#f8fafc;color:#0f172a}
.manualProductRow.selected{background:#eff6ff;color:#1d4ed8;box-shadow:inset 3px 0 0 #2563eb}
.manualProductRow span{min-width:0;overflow-wrap:anywhere;font-weight:650}
.manualProductRow small{flex:0 0 auto;color:#64748b;font-weight:700;white-space:nowrap;background:#f1f5f9;border-radius:999px;padding:3px 8px}
.manualProductRow.selected small{background:#dbeafe;color:#1d4ed8}
.manualProductEmpty{padding:24px 14px;text-align:center;color:#64748b;font-size:13px}
.appCreate,.appScanner{padding:14px;margin-bottom:12px}.appScannerClear{padding:18px}.appListHead{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin:18px 0 10px}.appListHead h2,.appFinishBox h2{font-size:18px;margin:3px 0}.appListHead p,.appFinishBox p{margin:3px 0}.appStep{display:inline-block;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.04em;color:var(--b);background:#eff6ff;border-radius:999px;padding:4px 8px}.appCameraActions{margin-top:14px}.appFinishBox{padding:16px;margin-top:16px;display:flex;justify-content:space-between;align-items:center;gap:18px}.appFinishBox .appActions{margin-top:0}.appEmptyList{padding:22px}.appCreateForm{display:grid;grid-template-columns:minmax(220px,1fr) auto;align-items:end;gap:10px}.appSectionTitle{font-size:18px;margin:18px 0 8px}.appMeta{display:flex;gap:10px;flex-wrap:wrap;align-items:center;font-size:13px}.appMeta span{background:#f8fafc;border:1px solid var(--line);padding:5px 8px;border-radius:9px}.appTop h1{font-size:22px;margin-bottom:6px}.appHistory{display:grid;gap:12px}.appHistoryShop{padding:0;overflow:hidden}.appHistoryShop>summary{list-style:none;cursor:pointer;padding:16px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;font-weight:800}.appHistoryShop>summary::-webkit-details-marker{display:none}.appHistoryShop>summary:after{content:'Відкрити ›';font-size:13px;color:var(--b)}.appHistoryShop[open]>summary{border-bottom:1px solid var(--line);background:#f8fafc}.appHistoryShop[open]>summary:after{content:'Закрити ⌃'}.appHistoryShopName{display:grid;gap:3px}.appHistoryShopName small{font-weight:600;color:var(--mut)}.appHistoryShopOrders{display:grid;gap:10px;padding:12px}.appHistoryOrder{padding:12px}.appHistoryHead{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;margin-bottom:10px}.appHistoryDownloads{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.appHistoryTitle{display:grid;gap:3px;min-width:0}.appHistoryTableWrap{overflow:auto}.appHistoryTable{min-width:650px}.appHistoryTable th,.appHistoryTable td{font-size:12px;padding:7px}.appWeightBox{max-width:380px}.appWeightCount{font-size:12px;font-weight:800;color:var(--mut)}.appHistoryRow{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;padding:12px}.appHistoryRow>a:first-child{display:grid;gap:3px;text-decoration:none;color:inherit}.appHistoryRow small{color:#b45309}.appUnlinked{padding:10px 14px;margin-bottom:12px}.appUnlinked summary{cursor:pointer;font-weight:800}.appUnlinked div{padding:6px 0;border-top:1px solid var(--line)}.appStatsSingle{grid-template-columns:minmax(150px,240px)}.appConfirmBox{max-width:420px;text-align:center}.appDrafts{display:grid;gap:10px}.appDraft{padding:14px;display:grid;grid-template-columns:1fr 1fr auto;text-decoration:none;color:inherit;gap:12px}.appTop{justify-content:space-between;align-items:center;margin-bottom:14px}.appStats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px}.appStats>div{background:#fff;border:1px solid var(--line);border-radius:14px;padding:12px;text-align:center}.appStats b{display:block;font-size:24px;color:var(--b)}.appStats span{font-size:12px;color:var(--mut)}.barcodeReader{display:none;position:relative;width:100%;max-width:520px;height:min(34vh,300px);min-height:190px;margin:10px auto;background:#111;border-radius:14px;overflow:hidden}.barcodeReader video{display:block;width:100%;height:100%;object-fit:cover}.barcodeGuide{position:absolute;inset:22% 8%;border:3px solid #22c55e;border-radius:14px;box-shadow:0 0 0 9999px rgba(0,0,0,.28);pointer-events:none}.barcodeHint{position:absolute;left:12px;right:12px;bottom:12px;background:rgba(15,23,42,.78);color:#fff;padding:8px 10px;border-radius:10px;text-align:center;font-size:12px;font-weight:700;pointer-events:none}#barcodeForm{display:flex;gap:8px;margin-top:10px}#barcodeForm input{flex:1;padding:13px;border:1.5px solid var(--line);border-radius:12px;font:inherit}#appMessage{min-height:24px;margin-top:8px;font-weight:700}.appPalletHead{display:flex;justify-content:space-between;align-items:center;margin:18px 0 10px}.appItems{display:grid;gap:8px}.appItem{display:grid;grid-template-columns:minmax(0,1fr) auto 70px 38px;align-items:center;gap:10px;background:#fff;border:1px solid var(--line);padding:12px;border-radius:14px}.appItemMain small{display:block;color:var(--mut);font-size:11px}.appQty{display:flex;gap:5px;align-items:center}.appQty button{width:38px;height:38px;padding:0}.appQty input{width:58px;text-align:center;padding:8px;border:1px solid var(--line);border-radius:9px}.appActions{display:flex;gap:8px;flex-wrap:wrap;margin-top:18px}.appModal{position:fixed;inset:0;background:rgba(15,23,42,.6);z-index:1000;padding:18px;display:flex;align-items:center;justify-content:center}.appModal[hidden]{display:none}.appModalBox{background:#fff;width:min(620px,100%);max-height:90vh;overflow:auto;border-radius:18px;padding:20px}.appModalBox label{display:block;margin:12px 0;font-weight:700}.appModalBox input,.appModalBox select{width:100%;padding:11px;border:1.5px solid var(--line);border-radius:10px;font:inherit}.appBindGrid{display:grid;grid-template-columns:1fr 1fr;gap:10px}@media(max-width:700px){.appFinishBox{display:block}.appFinishBox .appActions{margin-top:14px}.appHistoryHead{grid-template-columns:1fr}.appHistoryHead .btn{width:100%;text-align:center}.appHistoryDownloads{display:grid;grid-template-columns:1fr;width:100%}.appCreateForm{grid-template-columns:1fr}.appHistoryRow{grid-template-columns:1fr}.appMeta{gap:6px}.appTop{align-items:flex-start}.appScanner{padding:12px}.barcodeReader{height:32vh;min-height:180px;max-height:260px;margin:8px auto}.barcodeGuide{inset:24% 7%}.appDraft{grid-template-columns:1fr}.appItem{grid-template-columns:1fr auto 36px}.appItemMain{grid-column:1/-1}.appItem>strong{display:none}.appActions{display:grid}.appActions button{width:100%}#barcodeForm{display:grid}.appBindGrid{grid-template-columns:1fr}}
@media(max-width:700px){
  .adminShell>section{min-width:0;width:100%;max-width:100%;overflow:hidden}
  .adminShell>section>h1{font-size:23px;margin:4px 0 12px}
  .appCreate{padding:12px;margin-bottom:14px}
  .appCreateForm{gap:9px}
  .appCreateForm label{font-size:13px}
  .appCreateForm select{width:100%;min-width:0}
  .appCreateForm button{width:100%;min-height:44px}
  .appSectionTitle{font-size:17px;margin:18px 0 8px}
  .appDrafts,.appHistory{gap:9px}
  .appDraft{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 10px;padding:12px;border-radius:14px;align-items:center}
  .appDraft b{grid-column:1;font-size:15px;overflow-wrap:anywhere}
  .appDraft span{grid-column:1;font-size:12px;color:var(--mut);overflow-wrap:anywhere}
  .appDraft strong{grid-column:2;grid-row:1/3;align-self:center;font-size:12px;color:var(--b);white-space:nowrap}
  .appHistoryOrder{padding:12px;border-radius:15px;overflow:hidden}
  .appHistoryHead{display:grid;grid-template-columns:minmax(0,1fr);gap:9px;margin-bottom:10px}
  .appHistoryTitle{min-width:0;gap:2px}
  .appHistoryTitle b{font-size:15px;overflow-wrap:anywhere}
  .appHistoryTitle span,.appHistoryTitle small{font-size:12px;overflow-wrap:anywhere}
  .appHistoryHead .btn{width:100%;min-height:40px;padding:9px 12px}
  .appHistoryTableWrap{overflow:visible;width:100%;max-width:100%}
  .appHistoryTable{display:block!important;width:100%!important;min-width:0!important;border:0}
  .appHistoryTable thead{display:none}
  .appHistoryTable tbody{display:grid;gap:8px;width:100%}
  .appHistoryTable tr{display:grid;grid-template-columns:30px minmax(0,1fr);gap:4px 8px;width:100%;padding:10px;box-sizing:border-box;border:1px solid var(--line);border-radius:12px;background:#f8fafc}
  .appHistoryTable td{display:block!important;width:auto!important;min-width:0!important;padding:0!important;border:0!important;font-size:12px;overflow-wrap:anywhere;word-break:break-word}
  .appHistoryTable td:nth-child(1){grid-row:1/5;grid-column:1;display:flex!important;align-items:flex-start;justify-content:center;color:var(--b);font-weight:900;font-size:15px}
  .appHistoryTable td:nth-child(2){grid-column:2;font-size:14px;font-weight:800;color:#0f172a}
  .appHistoryTable td:nth-child(3){grid-column:2}
  .appHistoryTable td:nth-child(3)::before{content:'Вага / кількість: ';font-weight:800;color:#475569}
  .appHistoryTable td:nth-child(4){grid-column:2}
  .appHistoryTable td:nth-child(4)::before{content:'Одиниця: ';font-weight:800;color:#475569}
  .appHistoryTable td:nth-child(5){grid-column:2;color:var(--mut)}
  .appHistoryTable td:nth-child(5)::before{content:'Штрихкод: ';font-weight:800;color:#475569}
  .appDrafts .center,.appHistory .center{padding:20px 12px;font-size:13px}
}

@media(max-width:700px){
html,body{max-width:100%;overflow-x:hidden}
.adminShell,.adminShell>section{min-width:0;width:100%;max-width:100%;overflow-x:hidden}
.adminShell>section{padding-left:0;padding-right:0}
.mobileBackToCabinet{width:100%;box-sizing:border-box;margin:0 0 10px}
.appTop{display:grid!important;grid-template-columns:1fr auto;gap:8px;width:100%;min-width:0;margin-bottom:10px}
.appTop>div{min-width:0}.appTop h1{font-size:20px;margin:0 0 5px}.appTop>.btn{padding:9px 11px;font-size:13px;white-space:nowrap;align-self:start}
.appMeta{display:grid;grid-template-columns:auto 1fr;gap:5px;font-size:12px}.appMeta>b{grid-column:1/-1;overflow-wrap:anywhere}.appMeta span{padding:4px 7px;min-width:0;overflow-wrap:anywhere}
.appStats.appStatsSingle{grid-template-columns:1fr;margin-bottom:10px}.appStats>div{padding:8px}.appStats b{font-size:21px}
.appScannerClear{padding:11px;border-radius:14px}.appListHead{margin:4px 0 8px}.appListHead h2{font-size:17px}.appListHead p{font-size:13px;line-height:1.35}
.appCameraActions{display:grid!important;grid-template-columns:1fr 1fr;gap:7px;margin-top:9px}.appCameraActions button{width:100%;padding:11px 7px;font-size:13px;min-width:0}
.barcodeReader{width:100%;height:27vh;min-height:165px;max-height:225px;border-radius:12px}
#barcodeForm{grid-template-columns:1fr;gap:7px}#barcodeForm input,#barcodeForm button{width:100%;box-sizing:border-box}
#applicationItems{min-width:0;width:100%;overflow:hidden}.appItemsTableWrap{overflow:visible!important;width:100%;max-width:100%;margin:0}.appItemsTable{display:block!important;min-width:0!important;width:100%!important}.appItemsTable thead{display:none}.appItemsTable tbody{display:grid;gap:9px;width:100%}.appItemsTable tr{display:grid;grid-template-columns:34px minmax(0,1fr);gap:5px 9px;width:100%;box-sizing:border-box;padding:11px;border:1px solid var(--line);border-radius:13px;background:#fff}.appItemsTable td{display:block!important;width:auto!important;min-width:0!important;padding:0!important;border:0!important;font-size:13px;overflow-wrap:anywhere}.appItemsTable td:nth-child(1){grid-row:1/4;grid-column:1;display:flex!important;align-items:flex-start;justify-content:center;font-weight:900;color:var(--b);font-size:16px}.appItemsTable td:nth-child(2){grid-column:2;font-size:14px}.appItemsTable td:nth-child(3){grid-column:2;color:var(--mut);font-size:12px}.appItemsTable td:nth-child(3)::before{content:'Штрихкод: ';font-weight:800;color:#475569}.appItemsTable td:nth-child(4){grid-column:2}.appItemsTable td:nth-child(4)::before{content:'Кількість: ';font-weight:800}.appItemsTable td:nth-child(5){grid-column:2}.appItemsTable td:nth-child(5)::before{content:'Вага / обсяг: ';font-weight:800}.appItemsTable td:nth-child(6){grid-column:2}.appItemsTable td:nth-child(6)::before{content:'Одиниця: ';font-weight:800}.appItemsTable td:nth-child(7){grid-column:1/-1;margin-top:5px}.appRowActions{display:grid;grid-template-columns:1fr 1fr 42px;gap:7px;width:100%}.appRowActions button{width:100%;min-width:0;padding:9px 6px;font-size:12px}.appRowActions .deleteIcon{height:38px}
.appFinishBox{padding:12px;margin-top:12px}.appFinishBox h2{font-size:17px}.appFinishBox p{font-size:13px}.appFinishBox .appActions{display:grid;gap:8px}
.appModal{padding:14px;align-items:center;justify-content:center}.appModalBox{width:min(620px,100%);max-height:88vh;border-radius:18px;padding:16px}.appModalBox .actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.appModalBox .actions button{width:100%}
}
@media(max-width:390px){.appTop{grid-template-columns:1fr}.appTop>.btn{width:100%;text-align:center}.appMeta{grid-template-columns:1fr}.appCameraActions{grid-template-columns:1fr}.appRowActions{grid-template-columns:1fr 1fr}.appRowActions .deleteIcon{grid-column:1/-1}.appModalBox .actions{grid-template-columns:1fr}}
/* Mobile scanned-products list: compact cards without horizontal scroll */
@media(max-width:700px){
  #applicationItems{width:100%;max-width:100%;overflow:visible}
  #applicationItems .appListHead{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}
  #applicationItems .appListHead>div{min-width:0}
  #applicationItems .appListHead>div p{display:none}
  #applicationItems .appListHead>b{flex:0 0 auto;white-space:nowrap;background:#eff6ff;color:var(--b);border-radius:999px;padding:5px 9px;font-size:12px}
  .appItemsTableWrap{width:100%;max-width:100%;overflow:visible!important}
  .appItemsTable,.appItemsTable tbody{display:block!important;width:100%!important;min-width:0!important}
  .appItemsTable tr:not(.appEmptyRow){display:grid!important;grid-template-columns:42px minmax(0,1fr);gap:6px 10px;width:100%;padding:12px;box-sizing:border-box;border:1px solid var(--line);border-radius:14px;background:#fff;margin:0 0 10px}
  .appItemsTable tr:not(.appEmptyRow) td{display:block!important;width:auto!important;min-width:0!important;padding:0!important;border:0!important;overflow-wrap:normal;word-break:normal}
  .appItemsTable tr:not(.appEmptyRow) td:nth-child(1){grid-column:1;grid-row:1/5;display:flex!important;align-items:center;justify-content:center;width:36px!important;height:36px;border-radius:10px!important;background:#eff6ff;color:var(--b);font-size:16px;font-weight:900}
  .appItemsTable tr:not(.appEmptyRow) td:nth-child(1)::before{display:none!important}
  .appItemsTable tr:not(.appEmptyRow) td:nth-child(2){grid-column:2;font-size:15px;line-height:1.25}
  .appItemsTable tr:not(.appEmptyRow) td:nth-child(3){display:none!important}
  .appItemsTable tr:not(.appEmptyRow) td:nth-child(4),
  .appItemsTable tr:not(.appEmptyRow) td:nth-child(5),
  .appItemsTable tr:not(.appEmptyRow) td:nth-child(6){grid-column:2;display:inline!important;font-size:13px;color:#475569}
  .appItemsTable tr:not(.appEmptyRow) td:nth-child(4)::before,.appItemsTable tr:not(.appEmptyRow) td:nth-child(5)::before{content:attr(data-label) ': ';font-weight:800;color:#0f172a}
  .appItemsTable tr.appItemCount td.appMeasureCell{display:none!important}
  .appItemsTable tr.appItemMeasure td.appCountCell{display:none!important}
  .appItemsTable tr:not(.appEmptyRow) td:nth-child(6)::before{content:'Одиниця: ';font-weight:800;color:#0f172a}
  .appItemsTable tr:not(.appEmptyRow) td:nth-child(7){grid-column:1/-1;margin-top:5px;padding-top:10px!important;border-top:1px solid var(--line)!important}
  .appRowActions{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr) 46px!important;gap:8px;width:100%}
  .appRowActions .appRebindBtn{display:none!important}
  .appRowActions button{min-height:42px;width:100%;font-size:13px}
  .appRowActions .deleteIcon{grid-column:3!important;height:42px!important;font-size:24px}
  .appEmptyRow{display:block!important;width:100%!important;border:1px dashed var(--line)!important;border-radius:14px!important;background:#fff!important;padding:18px!important;box-sizing:border-box!important}
  .appEmptyRow td{display:block!important;width:100%!important;padding:0!important;text-align:center!important;line-height:1.45!important;word-break:normal!important;overflow-wrap:normal!important;color:var(--mut)!important}
  .appEmptyRow td::before{display:none!important}
}


/* Final alignment for the warehouse application items table */
@media(min-width:701px){
  #applicationItems .appItemsTableWrap{width:100%;overflow-x:auto!important}
  #applicationItems .appItemsTable{display:table!important;width:100%!important;min-width:980px!important;table-layout:fixed;border-collapse:collapse}
  #applicationItems .appItemsTable thead{display:table-header-group!important}
  #applicationItems .appItemsTable tbody{display:table-row-group!important}
  #applicationItems .appItemsTable tr{display:table-row!important}
  #applicationItems .appItemsTable th,
  #applicationItems .appItemsTable td{display:table-cell!important;box-sizing:border-box;vertical-align:middle;padding:11px 10px!important}
  #applicationItems .appItemsTable th:nth-child(1),#applicationItems .appItemsTable td:nth-child(1){width:5%;text-align:center}
  #applicationItems .appItemsTable th:nth-child(2),#applicationItems .appItemsTable td:nth-child(2){width:36%;text-align:left}
  #applicationItems .appItemsTable th:nth-child(3),#applicationItems .appItemsTable td:nth-child(3){width:14%;text-align:left}
  #applicationItems .appItemsTable th:nth-child(4),#applicationItems .appItemsTable td:nth-child(4){width:9%;text-align:center}
  #applicationItems .appItemsTable th:nth-child(5),#applicationItems .appItemsTable td:nth-child(5){width:11%;text-align:center}
  #applicationItems .appItemsTable th:nth-child(6),#applicationItems .appItemsTable td:nth-child(6){width:8%;text-align:center}
  #applicationItems .appItemsTable th:nth-child(7),#applicationItems .appItemsTable td:nth-child(7){width:17%;text-align:right}
  #applicationItems .appItemsTable td:nth-child(2) b{display:block;line-height:1.35;overflow-wrap:anywhere}
  #applicationItems .appItemsTable td:nth-child(3){overflow-wrap:anywhere;color:#64748b}
  #applicationItems .appItemsTable td:nth-child(4) strong,
  #applicationItems .appItemsTable td:nth-child(5) strong,
  #applicationItems .appItemsTable td:nth-child(6){white-space:nowrap}
  #applicationItems .appRowActions{display:grid!important;grid-template-columns:minmax(138px,1fr) 38px;gap:8px;align-items:center;justify-content:end;width:100%}
  #applicationItems .appRowActions .compactBtn{width:100%;min-width:0;min-height:38px;padding:7px 8px;white-space:normal;line-height:1.15;text-align:center}
  #applicationItems .appRowActions .appBarcodeDeleteBtn{grid-column:1}
  #applicationItems .appRowActions .deleteIcon{grid-column:2;grid-row:1;height:38px;width:38px;min-width:38px;margin:0;display:flex;align-items:center;justify-content:center}
  #applicationItems .appRowActions:has(.appBarcodeDeleteBtn) .deleteIcon{grid-row:1/3;height:100%;min-height:38px}
}



.appItemsTable tr.appItemCount td.appMeasureCell{display:none}.appItemsTable tr.appItemMeasure td.appCountCell{display:none}.appItemsTable td.appCountCell::before,.appItemsTable td.appMeasureCell::before{content:attr(data-label) ': ';font-weight:800;color:#0f172a}@media(min-width:701px){.appItemsTable td.appCountCell::before,.appItemsTable td.appMeasureCell::before{display:none}}
</style>
<script>

function stepKeg(btn,delta){const wrap=btn.closest('.kegStepper');const input=wrap&&wrap.querySelector('input');if(!input)return;const min=Number.isFinite(Number(input.min))?Number(input.min):0;const max=input.max!==''&&Number.isFinite(Number(input.max))?Number(input.max):Infinity;const n=Number.isFinite(Number(input.value))?Number(input.value):min;input.value=Math.min(max,Math.max(min,n+delta))}
function validateKegSend(form){const vals=[...form.querySelectorAll('input[type=number]')].map(i=>Number(i.value||0));if(!vals.some(v=>Number.isInteger(v)&&v>0)){toast('Додайте хоча б одну кегу');return false}return true}
function filterKegRequests(){const q=(document.getElementById('search')?.value||'').toLowerCase();document.querySelectorAll('[data-keg-search]').forEach(el=>el.style.display=!q||el.dataset.kegSearch.includes(q)?'flex':'none')}
function menu(){document.querySelector('.links').classList.toggle('open')}
function normalizeSearchText(v){return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ł/g,'l').replace(/đ/g,'d').replace(/ß/g,'ss').replace(/æ/g,'ae').replace(/œ/g,'oe').replace(/[^a-z0-9а-яіїєґ]+/gi,' ').trim()}
function filterProducts(){const q=normalizeSearchText(document.getElementById('search')?.value||'');let visible=0;document.querySelectorAll('[data-product]').forEach(el=>{const hay=normalizeSearchText(el.dataset.product||'');const show=!q||hay.includes(q);if(show)visible++;el.style.display=show?(el.tagName==='TR'?'':'flex'):'none'});const empty=document.getElementById('searchEmpty');if(empty)empty.style.display=visible?'none':'block';}
function setView(v){try{localStorage.setItem('catalogView',v)}catch(e){}const g=document.getElementById('prodGrid'),l=document.getElementById('prodList');if(g)g.style.display=v==='grid'?'grid':'none';if(l)l.style.display=v==='list'?'':'none';document.querySelectorAll('.viewBtn').forEach(b=>b.classList.toggle('active',b.dataset.view===v))}
function toast(msg='✓ Додано в кошик'){let t=document.getElementById('toast');if(!t){t=document.createElement('div');t.id='toast';t.className='toast';document.body.appendChild(t)}t.textContent=msg;t.classList.add('show');clearTimeout(window.__toastTimer);window.__toastTimer=setTimeout(()=>t.classList.remove('show'),1300)}
function updateEmptyCart(){const wrap=document.querySelector('[data-cart-page]');if(!wrap)return;const rows=wrap.querySelectorAll('[data-cart-row]');if(rows.length===0){wrap.innerHTML='<section class="card center"><p>Кошик порожній</p><a class="btn" href="/catalog">До каталогу</a></section>'}}
function updateCartUI(data){document.querySelectorAll('[data-cart-count]').forEach(el=>el.textContent=data.count||0);document.querySelectorAll('[data-cart-summary-total]').forEach(el=>el.textContent=data.count||0);if(data.positions!==undefined)document.querySelectorAll('[data-cart-summary-positions]').forEach(el=>el.textContent=data.positions||0);if(data.id){document.querySelectorAll('[data-item-count="'+CSS.escape(String(data.id))+'"]').forEach(el=>el.textContent=data.itemQty||0);document.querySelectorAll('[data-cart-row="'+CSS.escape(String(data.id))+'"]').forEach(row=>{if((data.itemQty||0)<=0){row.remove()}else{row.querySelectorAll('[data-row-qty]').forEach(el=>el.textContent=data.itemQty);row.querySelectorAll('[data-item-result]').forEach(el=>{if(data.result)el.textContent=data.result})}});document.querySelectorAll('[data-item-result="'+CSS.escape(String(data.id))+'"]').forEach(el=>{if(data.result)el.textContent=data.result})}if(data.cleared){document.querySelectorAll('[data-item-count]').forEach(el=>el.textContent='0');document.querySelectorAll('[data-cart-row]').forEach(row=>row.remove())}updateEmptyCart()}
async function cartFetch(form,msg){try{const r=await fetch(form.action,{method:'POST',body:new URLSearchParams(new FormData(form)),headers:{'X-Requested-With':'fetch'}});const data=await r.json();updateCartUI(data);if(msg)toast(msg);return true}catch(e){console.error(e);toast('Помилка дії');return false}}
function addToCart(form){const btn=form.querySelector('button');const old=btn.textContent;btn.textContent='✓';btn.disabled=true;cartFetch(form,'✓ Додано в кошик').finally(()=>setTimeout(()=>{btn.textContent=old;btn.disabled=false},260));return false}
function changeQty(form,delta){if(delta!==undefined){let input=form.querySelector('[name=delta]');if(!input){input=document.createElement('input');input.type='hidden';input.name='delta';form.appendChild(input)}input.value=delta}cartFetch(form);return false}
function removeCart(form){cartFetch(form,'Видалено');return false}
function clearCart(form){cartFetch(form,'Кошик очищено');return false}
function toggleDepositCheckbox(sel){const form=sel.closest('form');if(!form)return;const wrap=form.querySelector('[data-deposit-wrap]');const cb=form.querySelector('input[name=hasDeposit]');const allowed=['Алкоголь','Напої'].includes(sel.value);if(wrap)wrap.style.display=allowed?'':'none';if(cb&&!allowed)cb.checked=false;}
async function copyOrder(btn){const text=btn.dataset.copy||'';try{if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(text)}else{const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.left='-9999px';document.body.appendChild(ta);ta.focus();ta.select();document.execCommand('copy');ta.remove()}toast('Замовлення скопійовано')}catch(e){console.error(e);toast('Не вдалося скопіювати')}}
function niceConfirm(title,text,okText){return new Promise(resolve=>{const old=document.querySelector('.confirmOverlay');if(old)old.remove();const overlay=document.createElement('div');overlay.className='confirmOverlay';overlay.innerHTML='<div class="confirmModal" role="dialog" aria-modal="true"><h3></h3><p></p><div class="confirmActions"><button type="button" class="secondary" data-cancel>Скасувати</button><button type="button" class="confirmDanger" data-ok></button></div></div>';overlay.querySelector('h3').textContent=title;overlay.querySelector('p').textContent=text;overlay.querySelector('[data-ok]').textContent=okText||'Видалити';document.body.appendChild(overlay);const done=v=>{overlay.remove();resolve(v)};overlay.addEventListener('click',e=>{if(e.target===overlay||e.target.hasAttribute('data-cancel'))done(false);if(e.target.hasAttribute('data-ok'))done(true)});document.addEventListener('keydown',function escClose(e){if(e.key==='Escape'){document.removeEventListener('keydown',escClose);done(false)}},{once:true});});}
function submitAfterConfirm(form,title,text,okText){niceConfirm(title,text,okText).then(ok=>{if(ok){if(form.matches('form[data-ajax-admin-order]')){adminOrderFetch(form,'Видалено');}else{saveScrollState();form.submit();}}});return false}
function confirmOrderDelete(form){return submitAfterConfirm(form,'Видалити замовлення?','Цю дію не можна буде скасувати. Перевірте, що магазин справді надіслав замовлення випадково.','Так, видалити')}
function confirmOrderItemDelete(form){return submitAfterConfirm(form,'Видалити позицію?','Буде видалена тільки ця позиція із замовлення. Інші товари залишаться без змін.','Видалити позицію')}
function scrollStateKey(){return 'scrollState:'+location.pathname}
function saveScrollState(){try{const lists=[...document.querySelectorAll('.listWrap')].map(el=>el.scrollTop||0);sessionStorage.setItem(scrollStateKey(),JSON.stringify({x:window.scrollX||0,y:window.scrollY||0,lists,ts:Date.now()}));}catch(e){}}
function restoreScrollState(){try{const raw=sessionStorage.getItem(scrollStateKey());if(!raw)return;sessionStorage.removeItem(scrollStateKey());const st=JSON.parse(raw);if(!st||Date.now()-Number(st.ts||0)>10*60*1000)return;const apply=function(){window.scrollTo(Number(st.x)||0,Number(st.y)||0);document.querySelectorAll('.listWrap').forEach((el,i)=>{if(st.lists&&st.lists[i]!==undefined)el.scrollTop=Number(st.lists[i])||0;});};setTimeout(apply,0);requestAnimationFrame(apply);setTimeout(apply,80);setTimeout(apply,250);setTimeout(apply,600);}catch(e){}}
function saveAdminScroll(){saveScrollState();try{sessionStorage.setItem('adminProductsScroll',String(window.scrollY||0));}catch(e){}}
function startEditProduct(btn){
  var tr=btn.closest('tr');if(!tr)return;
  var nameSpan=tr.querySelector('.editNameSpan');
  var weightSpan=tr.querySelector('.editWeightSpan');
  var mobileMeta=tr.querySelector('.editWeightMobile');
  var mobileWeightSpan=tr.querySelector('.editWeightMobileValue');
  if(!nameSpan||!weightSpan)return;
  var nameVal=tr.dataset.editName||nameSpan.textContent;
  var weightVal=tr.dataset.editWeight||weightSpan.textContent;
  var unitVal=tr.dataset.editUnit||'szt';
  nameSpan.outerHTML='<input class="editInlineInput" name="editName" value="'+nameVal.replace(/&/g,'&amp;').replace(/"/g,'&quot;')+'" style="width:100%;min-width:90px;box-sizing:border-box">';
  weightSpan.outerHTML='<span class="editMeasureWrap" style="display:flex;gap:6px;align-items:center"><input class="editInlineInput" name="editWeight" value="'+weightVal.replace(/&/g,'&amp;').replace(/"/g,'&quot;')+'" style="width:80px;min-width:60px;box-sizing:border-box"><select class="editInlineInput" name="editUnit" style="width:70px;min-width:58px;box-sizing:border-box">'+['szt','g','kg','L','ml'].map(function(u){return '<option value="'+u+'" '+(u===unitVal?'selected':'')+'>'+u+'</option>';}).join('')+'</select></span>';
  if(mobileWeightSpan){mobileWeightSpan.outerHTML='<span class="editMeasureWrapMobile" style="display:flex;gap:6px;margin-top:6px"><input class="editInlineInput" name="editWeightMobile" value="'+weightVal.replace(/&/g,'&amp;').replace(/"/g,'&quot;')+'" style="width:100%;min-width:90px;box-sizing:border-box"><select class="editInlineInput" name="editUnitMobile" style="width:74px;box-sizing:border-box">'+['szt','g','kg','L','ml'].map(function(u){return '<option value="'+u+'" '+(u===unitVal?'selected':'')+'>'+u+'</option>';}).join('')+'</select></span>';}
  btn.textContent='✅';
  btn.title='Зберегти';
  btn.onclick=function(){saveEditProduct(this);return false};

  // Desktop and mobile editors exist in the same row. Keep them synchronized,
  // otherwise the hidden mobile fields can overwrite desktop changes.
  var desktopWeight=tr.querySelector('input[name="editWeight"]');
  var mobileWeight=tr.querySelector('input[name="editWeightMobile"]');
  var desktopUnit=tr.querySelector('select[name="editUnit"]');
  var mobileUnit=tr.querySelector('select[name="editUnitMobile"]');
  function mirror(a,b){if(a&&b){a.addEventListener('input',function(){b.value=a.value});a.addEventListener('change',function(){b.value=a.value});}}
  mirror(desktopWeight,mobileWeight);mirror(mobileWeight,desktopWeight);
  mirror(desktopUnit,mobileUnit);mirror(mobileUnit,desktopUnit);
  tr.querySelectorAll('.editInlineInput').forEach(function(el){
    el.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();saveEditProduct(btn);}});
  });
}
async function saveEditProduct(btn){
  var tr=btn.closest('tr');if(!tr)return;
  var id=tr.dataset.editId;
  var nameInput=tr.querySelector('input[name="editName"]');
  var desktopWeight=tr.querySelector('input[name="editWeight"]');
  var mobileWeight=tr.querySelector('input[name="editWeightMobile"]');
  var desktopUnit=tr.querySelector('select[name="editUnit"]');
  var mobileUnit=tr.querySelector('select[name="editUnitMobile"]');
  var isMobile=window.matchMedia&&window.matchMedia('(max-width: 700px)').matches;
  var weightInput=(isMobile&&mobileWeight?mobileWeight:desktopWeight)||mobileWeight;
  var unitInput=(isMobile&&mobileUnit?mobileUnit:desktopUnit)||mobileUnit;
  if(!nameInput||!weightInput||!unitInput)return;
  var name=nameInput.value.trim();var weight=weightInput.value.trim();var resultUnit=unitInput.value;
  if(!name||!weight){alert('Назва і кількість/вага не можуть бути порожніми');return;}
  btn.disabled=true;btn.textContent='⏳';
  try{
    var r=await fetch('/admin/product-update',{method:'POST',body:new URLSearchParams({id:id,name:name,weight:weight,resultUnit:resultUnit}),headers:{'X-Requested-With':'fetch'}});
    var data=await r.json();
    if(data.ok && data.html){tr.outerHTML=data.html;if(typeof toast==='function')toast('✓ Збережено');}
    else{alert('Помилка збереження');btn.disabled=false;btn.textContent='✅';}
  }catch(e){console.error(e);alert('Помилка мережі');btn.disabled=false;btn.textContent='✅';}
}
function filterOrderProductSearch(input){
  const form=input.closest('.orderSearchAddBox'); if(!form)return;
  const q=String(input.value||'').trim().toLowerCase();
  const hidden=form.querySelector('input[name="productId"]');
  if(hidden)hidden.value='';
  form.classList.remove('is-picked');
  let shown=0;
  form.querySelectorAll('.orderSearchOption').forEach(btn=>{
    const ok=q.length>0 && btn.dataset.search.includes(q) && shown<12;
    btn.classList.toggle('is-match', ok);
    if(ok)shown++;
  });
  form.classList.toggle('searching', q.length>0);
}
function selectOrderProduct(btn){
  const form=btn.closest('.orderSearchAddBox'); if(!form)return;
  const input=form.querySelector('input[name="productSearch"]');
  const hidden=form.querySelector('input[name="productId"]');
  if(input)input.value=btn.dataset.title||btn.textContent.trim();
  if(hidden)hidden.value=btn.dataset.id||'';
  form.classList.remove('searching');
  form.classList.add('is-picked');
}
function stepOrderAddQty(btn,delta){
  const form=btn.closest('form'); const input=form&&form.querySelector('input[name="qty"]'); if(!input)return;
  input.value=Math.max(1,(parseInt(input.value,10)||1)+delta);
}
function prepareOrderProductAdd(form){
  const search=form.querySelector('input[name="productSearch"]');
  const hidden=form.querySelector('input[name="productId"]');
  if(!search||!hidden)return true;
  const value=String(search.value||'').trim().toLowerCase();
  if(hidden.value)return true;
  const match=[...form.querySelectorAll('.orderSearchOption')].find(o=>String(o.dataset.title||'').trim().toLowerCase()===value);
  if(match){hidden.value=match.dataset.id||'';return true;}
  alert('Натисніть потрібний товар у результатах пошуку, щоб його було видно і можна було додати.');
  search.focus();
  filterOrderProductSearch(search);
  return false;
}
function orderDraftEsc(v){return String(v==null?'':v).replace(/[&<>"]/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]})}
function orderDraftRowHtml(item){
  const qty=Math.max(1,parseInt(item.qty,10)||1);
  return '<div class="orderEditRow" data-order-item data-id="'+orderDraftEsc(item.id)+'" data-name="'+orderDraftEsc(item.name)+'" data-category="'+orderDraftEsc(item.category)+'" data-weight="'+orderDraftEsc(item.weight)+'" data-qty="'+qty+'"><div class="orderEditInfo"><b>'+orderDraftEsc(item.name)+'</b><span>'+orderDraftEsc(item.weight)+'</span></div><div class="orderEditQtyStepper" aria-label="Кількість"><button type="button" class="secondary iconBtn minusBtn" aria-label="Мінус" onclick="stepOrderDraftItem(this,-1)">−</button><div class="qtynum" data-order-item-qty>'+qty+'</div><button type="button" class="iconBtn" aria-label="Плюс" onclick="stepOrderDraftItem(this,1)">+</button></div><button type="button" class="deleteIcon smallDelete" title="Видалити позицію" aria-label="Видалити позицію" onclick="removeOrderDraftItem(this)">×</button></div>';
}
function setOrderDraftStatus(card,text){const el=card&&card.querySelector('[data-order-draft-status]');if(el)el.textContent=text||'';}
function markOrderDraftChanged(card){setOrderDraftStatus(card,'Є незбережені зміни');}
function stepOrderDraftItem(btn,delta){
  const row=btn.closest('[data-order-item]'); if(!row)return;
  const qty=Math.max(1,(parseInt(row.dataset.qty,10)||1)+delta);
  row.dataset.qty=String(qty);
  const out=row.querySelector('[data-order-item-qty]'); if(out)out.textContent=String(qty);
  markOrderDraftChanged(row.closest('.order'));
}
function removeOrderDraftItem(btn){
  const row=btn.closest('[data-order-item]'); if(!row)return;
  const list=row.closest('[data-order-items-list]'); row.remove();
  if(list && !list.querySelector('[data-order-item]')) list.innerHTML='<div class="orderEmptyItems" data-order-empty>У цьому замовленні немає позицій.</div>';
  markOrderDraftChanged(list&&list.closest('.order'));
}
function addOrderDraftProduct(form){
  if(!prepareOrderProductAdd(form))return false;
  const card=form.closest('.order'); const list=card&&card.querySelector('[data-order-items-list]'); if(!list)return false;
  const hidden=form.querySelector('input[name="productId"]');
  const option=form.querySelector('.orderSearchOption[data-id="'+CSS.escape(String(hidden.value||''))+'"]');
  if(!option)return false;
  const qty=Math.max(1,parseInt((form.querySelector('input[name="qty"]')||{}).value,10)||1);
  const existing=list.querySelector('[data-order-item][data-id="'+CSS.escape(String(option.dataset.id||''))+'"]');
  if(existing){
    existing.dataset.qty=String((parseInt(existing.dataset.qty,10)||1)+qty);
    const out=existing.querySelector('[data-order-item-qty]'); if(out)out.textContent=existing.dataset.qty;
  }else{
    const empty=list.querySelector('[data-order-empty]'); if(empty)empty.remove();
    list.insertAdjacentHTML('beforeend',orderDraftRowHtml({id:option.dataset.id||'',name:option.dataset.name||'',weight:option.dataset.weight||'',category:option.dataset.category||'',qty}));
  }
  form.reset(); if(hidden)hidden.value=''; form.classList.remove('searching','is-picked'); form.querySelectorAll('.orderSearchOption').forEach(o=>o.classList.remove('is-match'));
  markOrderDraftChanged(card);
  return false;
}
async function applyOrderDraft(btn){
  const card=btn.closest('.order'); if(!card)return false;
  const id=card.dataset.orderId||'';
  const items=[...card.querySelectorAll('[data-order-item]')].map(row=>({id:row.dataset.id||'',name:row.dataset.name||'',category:row.dataset.category||'',weight:row.dataset.weight||'',qty:Math.max(1,parseInt(row.dataset.qty,10)||1)}));
  try{
    btn.disabled=true; setOrderDraftStatus(card,'Збереження...');
    const r=await fetch('/admin/order-items-apply',{method:'POST',body:new URLSearchParams({id,itemsJson:JSON.stringify(items)}),headers:{'X-Requested-With':'fetch'}});
    const data=await r.json();
    if(data && data.html){card.outerHTML=data.html;toast('Застосовано');return true;}
    setOrderDraftStatus(card,'Не вдалося зберегти');toast('Помилка дії');return false;
  }catch(e){console.error(e);setOrderDraftStatus(card,'Помилка збереження');toast('Помилка дії');return false;}
  finally{btn.disabled=false;}
}
function chatScrollToBottom(box){if(box)box.scrollTop=box.scrollHeight}
function chatIsNearBottom(box){return !box || (box.scrollHeight-box.scrollTop-box.clientHeight)<90}
function directMessagesUrl(){
  const form=document.querySelector('form.chatForm[action$="/messages/send"]');
  if(!form)return '/chat/messages';
  const shopInput=form.querySelector('input[name="shop"]');
  const qs=shopInput&&shopInput.value ? '?shop='+encodeURIComponent(shopInput.value) : '';
  return '/messages/list'+qs;
}
function setUnreadBadge(link,count,plus){
  if(!link)return;
  count=Math.max(0,Number(count)||0);
  const old=link.querySelector('.notifBadge');
  if(old)old.remove();
  if(count>0)link.insertAdjacentHTML('beforeend','<span class="notifBadge notifBadgeCount">'+(plus?('+'+count):count)+'</span>');
}
function updateUnreadBadges(unread){
  if(!unread)return;
  document.querySelectorAll('[data-unread-key="directMessages"]').forEach(function(link){setUnreadBadge(link,unread.directMessages,false)});
}
async function refreshChatMessages(forceScroll){
  const box=document.querySelector('.chatMessages');
  if(!box)return;
  try{
    const shouldScroll=forceScroll||chatIsNearBottom(box);
    const r=await fetch(directMessagesUrl(),{headers:{'X-Requested-With':'fetch'},cache:'no-store'});
    if(!r.ok)return;
    const data=await r.json();
    if(data && data.ok)updateUnreadBadges(data.unread);
    if(data && data.ok && typeof data.html==='string' && box.dataset.chatHtml!==data.html){
      box.innerHTML=data.html;
      box.dataset.chatHtml=data.html;
      if(shouldScroll)chatScrollToBottom(box);
    }
  }catch(e){console.error(e)}
}
async function sendChatMessage(form){
  const textarea=form.querySelector('textarea[name="text"]');
  const btn=form.querySelector('button');
  const text=String(textarea&&textarea.value||'').trim();
  if(!text){if(textarea)textarea.focus();return false;}
  const old=btn?btn.textContent:'';
  try{
    if(btn){btn.disabled=true;btn.textContent='Надсилання...';}
    const r=await fetch(form.action,{method:'POST',body:new URLSearchParams(new FormData(form)),headers:{'X-Requested-With':'fetch'}});
    const data=await r.json();
    if(data && data.ok){updateUnreadBadges(data.unread);if(textarea)textarea.value='';if(data.html){const box=document.querySelector('.chatMessages');if(box){box.innerHTML=data.html;box.dataset.chatHtml=data.html;chatScrollToBottom(box)}}else{await refreshChatMessages(true)}return true;}
    toast('Не вдалося надіслати');return false;
  }catch(e){console.error(e);toast('Помилка чату');return false;}
  finally{if(btn){btn.disabled=false;btn.textContent=old;}}
}
async function deleteDirectMessage(form){
  if(!confirm('Ви дійсно хочете видалити це повідомлення?'))return false;
  try{
    const r=await fetch(form.action,{method:'POST',body:new URLSearchParams(new FormData(form)),headers:{'X-Requested-With':'fetch'}});
    const data=await r.json();
    if(data && data.ok){
      updateUnreadBadges(data.unread);
      if(data.html){const box=document.querySelector('.chatMessages');if(box){box.innerHTML=data.html;box.dataset.chatHtml=data.html;chatScrollToBottom(box)}}
      else await refreshChatMessages(false);
      return false;
    }
    toast('Не вдалося видалити');
  }catch(e){console.error(e);toast('Помилка видалення')}
  return false;
}
function initChatAutoRefresh(){
  const box=document.querySelector('.chatMessages');
  if(!box)return;
  box.dataset.chatHtml=box.innerHTML;
  chatScrollToBottom(box);
  if(window.__chatTimer)clearInterval(window.__chatTimer);
  window.__chatTimer=setInterval(function(){refreshChatMessages(false)},2500);
  document.addEventListener('visibilitychange',function(){if(!document.hidden)refreshChatMessages(false)});
}
async function adminOrderFetch(form,msg){
  try{
    const card=form.closest('.order');
    const r=await fetch(form.action,{method:'POST',body:new URLSearchParams(new FormData(form)),headers:{'X-Requested-With':'fetch'}});
    const data=await r.json();
    if(data.removed && card){card.remove();toast(msg||'Видалено');return true;}
    if(data.html && card){card.outerHTML=data.html;toast(msg||'Збережено');return true;}
    toast(msg||'Збережено');return true;
  }catch(e){console.error(e);toast('Помилка дії');return false;}
}
function calcAccountingForm(form){function n(name){var el=form&&form.elements[name];var s=el?String(el.value||'').trim():'';s=s.replace(/\s+/g,'').replace(/\u00A0/g,'');var hasComma=s.indexOf(',')>=0,hasDot=s.indexOf('.')>=0;if(hasComma&&hasDot){if(s.lastIndexOf(',')>s.lastIndexOf('.'))s=s.replace(/\./g,'').replace(',','.');else s=s.replace(/,/g,'');}else{s=s.replace(',','.');}s=s.replace(/[^0-9.\-]/g,'').replace(/(?!^)-/g,'');var parts=s.split('.');if(parts.length>2)s=parts.shift()+'.'+parts.join('');var v=Number(s);return isFinite(v)?v:0}function set(name,val){var el=form&&form.elements[name];if(el)el.value=(Math.round(val*100)/100).toFixed(2).replace('.',',')}var cash=n('fiscalReport')-n('terminalClose');set('cash',cash);set('discrepancy',n('actualCash')-n('openingBalance')-cash);set('closingBalance',n('actualCash')-n('sentToOffice'));}

let appStream=null,appTimer=null,appZxingControls=null,appZxingReader=null,lastCameraCode='',lastCameraAt=0,unknownCode='',cameraStarting=false,cameraScanBusy=false,cameraWanted=false,cameraRecoveryTimer=null,lastCameraRestartAt=0;
function appMessage(t,ok=true){const e=document.getElementById('appMessage');if(e){e.textContent=t;e.style.color=ok?'#15803d':'#dc2626'}if(ok&&navigator.vibrate)navigator.vibrate(70)}
async function appPost(path,data){const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','X-Requested-With':'fetch'},body:new URLSearchParams(data||{})});const j=await r.json();if(!r.ok||!j.ok)throw new Error(j.error||'Помилка');return j}
function refreshApplication(j){const e=document.getElementById('applicationItems');if(e&&j.html)e.innerHTML=j.html}
let pendingBarcode='',pendingClientScanId='';
async function submitBarcode(e){if(e)e.preventDefault();const i=document.getElementById('barcodeInput'),code=String(i&&i.value||'').trim();if(!code)return false;pendingBarcode=code;pendingClientScanId=Date.now()+'_'+Math.random();cameraScanBusy=true;const b=document.getElementById('confirmBarcode');if(b)b.textContent=code;const m=document.getElementById('scanConfirmModal');if(m)m.hidden=false;return false}
function cancelConfirmedScan(){const m=document.getElementById('scanConfirmModal');if(m)m.hidden=true;pendingBarcode='';pendingClientScanId='';cameraScanBusy=false;const i=document.getElementById('barcodeInput');if(i){i.value='';i.focus()}appMessage('Сканування скасовано',false)}
async function confirmBarcodeScan(){const code=pendingBarcode,id=pendingClientScanId;const m=document.getElementById('scanConfirmModal');if(m)m.hidden=true;if(!code){cameraScanBusy=false;return}const i=document.getElementById('barcodeInput');try{if(i)i.disabled=true;const j=await appPost('/admin-applications/scan',{applicationId:currentApplicationId,barcode:code,clientScanId:id});if(j.unknown){unknownCode=code;document.getElementById('unknownBarcode').textContent=code;document.getElementById('bindModal').hidden=false;openBindProductSearch();appMessage('Штрихкод або QR-код не знайдено. Прив’яжіть його до товару.',false)}else if(j.needsWeight){document.getElementById('weightProductName').textContent=j.productName||'';document.getElementById('weightUnit').textContent=j.inputUnit||'кг';const w=document.getElementById('exactWeight');w.value='';document.getElementById('weightModal').hidden=false;setTimeout(()=>w.focus(),50);return}else{refreshApplication(j);if(i)i.value='';appMessage(j.message||'Товар додано');setTimeout(()=>{cameraScanBusy=false},700)}}catch(x){appMessage(x.message,false);setTimeout(()=>{cameraScanBusy=false},700)}finally{if(i){i.disabled=false;i.focus()}}}

function cancelWeightEntry(){document.getElementById('weightModal').hidden=true;pendingBarcode='';pendingClientScanId='';cameraScanBusy=false;const i=document.getElementById('barcodeInput');if(i){i.value='';i.focus()}appMessage('Додавання вагового товару скасовано',false)}
async function saveExactWeight(){const raw=String(document.getElementById('exactWeight').value||'').replace(',','.');const weight=Number(raw);if(!Number.isFinite(weight)||weight<=0){appMessage('Введіть правильну вагу',false);document.getElementById('exactWeight').focus();return}try{const j=await appPost('/admin-applications/scan',{applicationId:currentApplicationId,barcode:pendingBarcode,clientScanId:pendingClientScanId,exactWeight:weight});refreshApplication(j);document.getElementById('weightModal').hidden=true;const i=document.getElementById('barcodeInput');if(i)i.value='';appMessage(j.message||'Вагу збережено')}catch(x){appMessage(x.message,false)}finally{pendingBarcode='';pendingClientScanId='';cameraScanBusy=false}}
let bindProductId='',bindFilteredProducts=[];
function bindProductsSource(){const source=Array.isArray(window.manualProductsData)?window.manualProductsData:[];return source.map(o=>({id:String(o.id||''),name:String(o.name||''),category:String(o.category||''),unit:String(o.unit||''),amount:(Number(o.amount)>0?Number(o.amount):1)}))}
function closeBindModal(){document.getElementById('bindModal').hidden=true;unknownCode='';bindProductId='';cameraScanBusy=false;const i=document.getElementById('barcodeInput');if(i)i.value=''}
function filterBindProducts(){const q=normalizeSearchText((document.getElementById('productSearch')||{}).value||''),tokens=q.split(/\s+/).filter(Boolean),cat=String((document.getElementById('bindCategory')||{}).value||'');bindFilteredProducts=bindProductsSource().filter(o=>{if(cat&&o.category!==cat)return false;if(!tokens.length)return true;const hay=normalizeSearchText([o.name,o.category,o.unit].join(' '));return tokens.every(t=>hay.includes(t))});renderBindProductList(bindFilteredProducts)}
function renderBindProductList(items){const box=document.getElementById('bindProductList');if(!box)return;box.innerHTML=items.length?items.map(o=>'<button type="button" class="bindProductRow '+(String(o.id)===String(bindProductId)?'selected':'')+'" data-product-id="'+manualEscapeHtml(o.id)+'"><span>'+manualEscapeHtml(o.name)+'</span><small>'+manualEscapeHtml(({штуки:'szt.',кілограми:'kg',грами:'g',літри:'l',мл:'ml',кеги:'keg'})[o.unit]||o.unit||'')+'</small></button>').join(''):'<div class="bindProductEmpty">Товарів не знайдено. Перевірте назву або виберіть інший розділ.</div>';Array.from(box.querySelectorAll('.bindProductRow')).forEach(btn=>btn.addEventListener('click',()=>selectBindProduct(btn.getAttribute('data-product-id')||'')))}
function selectBindProduct(id){bindProductId=String(id||'');const hidden=document.getElementById('bindProduct');if(hidden)hidden.value=bindProductId;updateBindProductData();renderBindProductList(bindFilteredProducts)}
function updateBindProductData(){const selected=bindProductsSource().find(o=>String(o.id)===String(bindProductId));const u=document.getElementById('bindUnit'),a=document.getElementById('bindUnits');if(u)u.value=selected?(({штуки:'szt.',кілограми:'kg',грами:'g',літри:'l',мл:'ml',кеги:'keg'})[selected.unit]||selected.unit):'';if(a)a.value=selected?String(selected.amount):''}
function openBindProductSearch(){bindProductId='';const h=document.getElementById('bindProduct');if(h)h.value='';const q=document.getElementById('productSearch'),c=document.getElementById('bindCategory');if(q)q.value='';if(c)c.value='';filterBindProducts();setTimeout(()=>{if(q)q.focus()},50)}
async function bindBarcode(){const productId=String((document.getElementById('bindProduct')||{}).value||'');if(!productId)return appMessage('Оберіть товар зі списку',false);try{const j=await appPost('/admin-applications/bind',{applicationId:currentApplicationId,barcode:unknownCode,productId});refreshApplication(j);closeBindModal();appMessage('Штрихкод або QR-код прив’язано і товар додано')}catch(x){appMessage(x.message,false)}}
let manualProductId='',manualProductsCache=[],manualFilteredProducts=[],manualSearchTimer=null;
function manualProductsSource(){const source=Array.isArray(window.manualProductsData)?window.manualProductsData:[];return source.map(o=>({id:String(o.id||''),name:String(o.name||''),category:String(o.category||''),unit:String(o.unit||''),amount:(Number(o.amount)>0?Number(o.amount):1)}))}
function requestManualProducts(){const search=document.getElementById('manualProductSearch'),cat=document.getElementById('manualProductCategory'),product=document.getElementById('manualProduct');const query=normalizeSearchText(search&&search.value||''),tokens=query.split(/\s+/).filter(Boolean),category=String(cat&&cat.value||'');manualProductsCache=manualProductsSource();manualFilteredProducts=manualProductsCache.filter(o=>{if(category&&String(o.category)!==category)return false;if(!tokens.length)return true;const hay=normalizeSearchText([o.name,o.category,o.unit].join(' '));return tokens.every(token=>hay.includes(token))});if(product&&product.value&&!manualProductsCache.some(o=>String(o.id)===String(product.value))){product.value='';manualProductId='';updateManualProductData()}renderManualProductList(manualFilteredProducts)}
function openManualProductModal(){const m=document.getElementById('manualProductModal'),search=document.getElementById('manualProductSearch'),cat=document.getElementById('manualProductCategory'),product=document.getElementById('manualProduct'),value=document.getElementById('manualProductValue');manualProductId='';manualProductsCache=manualProductsSource();manualFilteredProducts=manualProductsCache.slice();if(search)search.value='';if(cat){cat.selectedIndex=0;cat.value=''}if(product)product.value='';if(value)value.value='';updateManualProductData();if(m){m.hidden=false;requestAnimationFrame(()=>m.classList.add('isOpen'));document.body.classList.add('sheetOpen')}requestManualProducts()}
function closeManualProductModal(){const m=document.getElementById('manualProductModal');if(!m)return;clearTimeout(manualSearchTimer);m.classList.remove('isOpen');document.body.classList.remove('sheetOpen');setTimeout(()=>{if(!m.classList.contains('isOpen'))m.hidden=true},220);manualProductId=''}
function selectManualProduct(id){const product=document.getElementById('manualProduct');if(!product)return;product.value=String(id);manualProductId=String(id);updateManualProductData();renderManualProductList(manualFilteredProducts)}
function manualEscapeHtml(value){return String(value==null?'':value).replace(/[&<>\"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[ch]})}
function renderManualProductList(matches){const product=document.getElementById('manualProduct'),box=document.getElementById('manualProductList');if(!product||!box)return;const visible=Array.isArray(matches)?matches:[];box.innerHTML=visible.length?visible.map(o=>'<button type="button" class="manualProductRow '+(String(o.id)===String(product.value)?'selected':'')+'" data-product-id="'+manualEscapeHtml(String(o.id))+'"><span>'+manualEscapeHtml(o.name||'')+'</span><small>'+manualEscapeHtml(({штуки:'szt.',кілограми:'kg',грами:'g',літри:'l',мл:'ml',кеги:'keg'})[o.unit]||o.unit||'')+'</small></button>').join(''):'<div class="manualProductEmpty">Товарів не знайдено. Перевірте назву або виберіть інший розділ.</div>';Array.from(box.querySelectorAll('.manualProductRow')).forEach(function(btn){btn.addEventListener('click',function(){selectManualProduct(btn.getAttribute('data-product-id')||'')})})}
function filterManualProducts(){clearTimeout(manualSearchTimer);manualSearchTimer=setTimeout(requestManualProducts,60)}
function updateManualProductData(){const product=document.getElementById('manualProduct'),selected=manualProductsSource().find(o=>String(o.id)===String(product&&product.value||'')),u=document.getElementById('manualProductUnit'),label=document.getElementById('manualValueLabel'),input=document.getElementById('manualProductValue');const unit=selected&&selected.unit||'';const short=({штуки:'szt.',кілограми:'kg',грами:'g',літри:'l',мл:'ml',кеги:'keg'})[unit]||unit||'';if(u)u.value=short;if(label)label.textContent=unit?((unit==='кілограми'||unit==='грами'?'Вага':unit==='літри'||unit==='мл'?'Обсяг':'Кількість')+' ('+short+')'):'Кількість / вага / обсяг';if(input){input.disabled=!selected;input.placeholder=selected?'За потреби змініть значення':'Спочатку оберіть товар';input.step=(unit==='штуки'||unit==='кеги')?'1':'0.001';input.min=(unit==='штуки'||unit==='кеги')?'1':'0.001';if(selected){const amount=Number(selected.amount)>0?Number(selected.amount):1;input.value=(unit==='штуки'||unit==='кеги')?String(Math.max(1,Math.round(amount))):String(Math.round(amount*1000)/1000);setTimeout(()=>{try{input.focus();input.select()}catch(e){}},0)}else input.value=''}}
async function addManualProduct(){const product=document.getElementById('manualProduct'),productId=String(product&&product.value||''),raw=String((document.getElementById('manualProductValue')||{}).value||'').replace(',','.'),value=Number(raw);if(!productId)return appMessage('Оберіть товар',false);if(!Number.isFinite(value)||value<=0)return appMessage('Введіть правильну кількість, вагу або обсяг',false);try{const j=await appPost('/admin-applications/manual-add',{applicationId:currentApplicationId,productId,value});refreshApplication(j);closeManualProductModal();appMessage('Товар без штрихкоду додано до заявки')}catch(x){appMessage(x.message,false)}}
async function changeAppQty(id,d){try{refreshApplication(await appPost('/admin-applications/item-qty',{applicationId:currentApplicationId,itemId:id,delta:d}))}catch(x){appMessage(x.message,false)}}
async function setAppQty(id,q){try{refreshApplication(await appPost('/admin-applications/item-set',{applicationId:currentApplicationId,itemId:id,quantity:q}))}catch(x){appMessage(x.message,false)}}
function editAppItem(id,isMeasure,currentQty,currentTotal,currentBarcode,unitType,manualEntry){let qty=String(currentQty),total=String(currentTotal);if(isMeasure){const title=unitType==='кілограми'?'Загальна вага':(unitType==='літри'||unitType==='мл'?'Загальний обсяг':'Загальне значення');total=prompt(title+' ('+(({кілограми:'kg',грами:'g',літри:'l',мл:'ml',штуки:'szt.'})[unitType]||unitType)+'):',String(currentTotal));if(total===null)return}else{total=prompt('Фактична кількість товару (szt.):',String(currentTotal));if(total===null)return}appPost('/admin-applications/item-edit',{applicationId:currentApplicationId,itemId:id,quantity:qty,totalUnits:total,barcode:String(currentBarcode||'')}).then(refreshApplication).then(()=>appMessage(isMeasure?'Значення оновлено':'Кількість оновлено')).catch(x=>appMessage(x.message,false))}
async function removeAppItemBarcode(id,barcode){const ok=await niceConfirm('Видалити штрихкод?','Штрихкод '+String(barcode||'')+' буде відв’язано від цього товару. Сам товар залишиться у заявці без штрихкоду.','Так, видалити штрихкод');if(!ok)return;try{refreshApplication(await appPost('/admin-applications/item-barcode-delete',{applicationId:currentApplicationId,itemId:id}));appMessage('Штрихкод видалено')}catch(x){appMessage(x.message,false)}}
let rebindItemId='',rebindBarcode='',rebindCurrentProductId='';
function openRebindModal(itemId,barcode,productId,productName){rebindItemId=itemId;rebindBarcode=barcode;rebindCurrentProductId=String(productId||'');const old=document.getElementById('rebindOldBarcode'),name=document.getElementById('rebindCurrentProduct'),search=document.getElementById('rebindProductSearch'),select=document.getElementById('rebindProduct');if(old)old.textContent=barcode;if(name)name.textContent=productName||'';if(search)search.value='';if(select){Array.from(select.options).forEach(o=>o.hidden=String(o.value)===rebindCurrentProductId);const first=Array.from(select.options).find(o=>!o.hidden);if(first)select.value=first.value}const m=document.getElementById('rebindModal');if(m)m.hidden=false;setTimeout(()=>{if(search)search.focus()},50)}
function filterRebindProducts(){const q=normalizeSearchText((document.getElementById('rebindProductSearch')||{}).value||''),cat=String((document.getElementById('rebindCategory')||{}).value||''),s=document.getElementById('rebindProduct');if(!s)return;Array.from(s.options).forEach(o=>{const notCurrent=String(o.value)!==rebindCurrentProductId,okSearch=!q||String(o.dataset.search||'').includes(q),okCat=!cat||String(o.dataset.category||'')===cat;o.hidden=!(notCurrent&&okSearch&&okCat)});const first=Array.from(s.options).find(o=>!o.hidden);if(first)s.value=first.value}
function closeRebindModal(){const m=document.getElementById('rebindModal');if(m)m.hidden=true;rebindItemId='';rebindBarcode='';rebindCurrentProductId=''}
async function saveRebindBarcode(){const productId=String((document.getElementById('rebindProduct')||{}).value||'');if(!productId)return appMessage('Оберіть правильний товар',false);if(productId===rebindCurrentProductId)return appMessage('Оберіть інший товар',false);const select=document.getElementById('rebindProduct'),productName=select&&select.options[select.selectedIndex]?select.options[select.selectedIndex].text:'';if(!confirm('Переприв’язати штрихкод '+rebindBarcode+' з товару «'+String((document.getElementById('rebindCurrentProduct')||{}).textContent||'')+'» до товару «'+productName+'»?'))return;try{const j=await appPost('/admin-applications/rebind',{applicationId:currentApplicationId,itemId:rebindItemId,barcode:rebindBarcode,productId});refreshApplication(j);closeRebindModal();appMessage('Штрихкод переприв’язано до правильного товару та збережено в системі')}catch(x){appMessage(x.message,false)}}
async function deleteAppItem(id){if(!confirm('Видалити позицію?'))return;try{refreshApplication(await appPost('/admin-applications/item-delete',{applicationId:currentApplicationId,itemId:id}))}catch(x){appMessage(x.message,false)}}
async function undoLastScan(){try{refreshApplication(await appPost('/admin-applications/undo',{applicationId:currentApplicationId}));appMessage('Останнє сканування скасовано')}catch(x){appMessage(x.message,false)}}
async function newPallet(){try{refreshApplication(await appPost('/admin-applications/pallet-new',{applicationId:currentApplicationId}));appMessage('Нову палету створено')}catch(x){appMessage(x.message,false)}}
async function finishPallet(){if(!confirm('Завершити палету?'))return;try{refreshApplication(await appPost('/admin-applications/pallet-finish',{applicationId:currentApplicationId}));appMessage('Палету завершено')}catch(x){appMessage(x.message,false)}}
async function completeApplication(){if(!confirm('Завершити комплектування?'))return;try{await appPost('/admin-applications/complete',{applicationId:currentApplicationId});saveScrollState();location.reload()}catch(x){appMessage(x.message,false)}}
async function cancelApplication(){if(!confirm('Скасувати заявку?'))return;try{await appPost('/admin-applications/cancel',{applicationId:currentApplicationId});saveScrollState();location.reload()}catch(x){appMessage(x.message,false)}}
function loadBarcodeLibrary(){
  if(window.ZXingBrowser)return Promise.resolve(window.ZXingBrowser);
  if(window.__zxingLoadPromise)return window.__zxingLoadPromise;
  const urls=['https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/umd/zxing-browser.min.js','https://unpkg.com/@zxing/browser@0.1.5/umd/zxing-browser.min.js'];
  window.__zxingLoadPromise=new Promise((resolve,reject)=>{
    let n=0;
    function next(){
      if(n>=urls.length)return reject(new Error('Не вдалося завантажити модуль сканування'));
      const sc=document.createElement('script');sc.src=urls[n++];sc.async=true;sc.crossOrigin='anonymous';
      sc.onload=()=>window.ZXingBrowser?resolve(window.ZXingBrowser):next();
      sc.onerror=()=>next();document.head.appendChild(sc);
    }
    next();
  });
  return window.__zxingLoadPromise;
}
function cameraErrorText(error){
  const name=String(error&&error.name||'');
  if(name==='NotAllowedError'||name==='PermissionDeniedError')return 'Доступ до камери заборонено. Дозвольте камеру в налаштуваннях браузера.';
  if(name==='NotFoundError'||name==='DevicesNotFoundError')return 'Камеру не знайдено на цьому пристрої.';
  if(name==='NotReadableError'||name==='TrackStartError')return 'Камера зайнята іншою програмою. Закрийте її та спробуйте ще раз.';
  if(!window.isSecureContext)return 'Камера працює лише через захищене HTTPS-з’єднання.';
  return 'Не вдалося запустити камеру. Спробуйте перезавантажити сторінку.';
}
async function startBarcodeCamera(){
  cameraWanted=true;
  if(cameraStarting)return;
  const box=document.getElementById('barcodeReader');if(!box)return;
  cameraStarting=true;stopBarcodeCamera(false,false);box.style.display='block';box.innerHTML='<p style="color:white;padding:28px;text-align:center">Запуск камери…</p>';
  try{
    if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia)throw new Error('MEDIA_UNSUPPORTED');
    if(!window.isSecureContext&&location.hostname!=='localhost'&&location.hostname!=='127.0.0.1')throw Object.assign(new Error('HTTPS_REQUIRED'),{name:'SecurityError'});
    const ZX=await loadBarcodeLibrary();
    const video=document.createElement('video');video.id='barcodeVideo';video.autoplay=true;video.muted=true;video.setAttribute('playsinline','true');video.setAttribute('webkit-playsinline','true');
    box.innerHTML='';box.appendChild(video);box.insertAdjacentHTML('beforeend','<div class="barcodeGuide"></div><div class="barcodeHint">Наведіть задню камеру на штрихкод</div>');
    appZxingReader=new ZX.BrowserMultiFormatReader();
    const constraints={audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}}};
    appZxingControls=await appZxingReader.decodeFromConstraints(constraints,video,(result,error,controls)=>{
      if(result){const value=typeof result.getText==='function'?result.getText():String(result.text||result.rawValue||'');if(value)cameraBarcode(value)}
    });
    appStream=video.srcObject||null;
    try{await video.play()}catch(e){}
    if(appStream){appStream.getVideoTracks().forEach(track=>{track.onended=()=>scheduleCameraRecovery(250);track.onmute=()=>scheduleCameraRecovery(500)})}
    startCameraHealthMonitor();
    appMessage('Камеру увімкнено. Наведіть її на штрихкод.');
  }catch(x){
    console.error(x);stopBarcodeCamera(false);box.style.display='block';box.innerHTML='<p style="color:white;padding:24px;text-align:center">'+cameraErrorText(x)+'</p>';appMessage(cameraErrorText(x),false);
  }finally{cameraStarting=false}
}
function cameraBarcode(code){const value=String(code||'').trim();if(!value||cameraScanBusy)return;const modal=document.getElementById('bindModal'),confirmModal=document.getElementById('scanConfirmModal');if((modal&&!modal.hidden)||(confirmModal&&!confirmModal.hidden))return;const now=Date.now();if(value===lastCameraCode&&now-lastCameraAt<1600)return;lastCameraCode=value;lastCameraAt=now;cameraScanBusy=true;const input=document.getElementById('barcodeInput');if(input)input.value=value;try{if(navigator.vibrate)navigator.vibrate(80)}catch(e){}submitBarcode()}
function cameraIsHealthy(){
  if(!cameraWanted||document.hidden)return true;
  const video=document.getElementById('barcodeVideo');
  const tracks=appStream&&typeof appStream.getVideoTracks==='function'?appStream.getVideoTracks():[];
  return !!(video&&tracks.length&&tracks.some(t=>t.readyState==='live')&&!video.paused&&!video.ended&&video.readyState>=2);
}
function scheduleCameraRecovery(delay=350){
  if(!cameraWanted||document.hidden||cameraStarting)return;
  if(cameraRecoveryTimer)clearTimeout(cameraRecoveryTimer);
  cameraRecoveryTimer=setTimeout(()=>{
    cameraRecoveryTimer=null;
    if(!cameraWanted||document.hidden||cameraStarting||cameraIsHealthy())return;
    const now=Date.now();
    if(now-lastCameraRestartAt<1200){scheduleCameraRecovery(1200);return}
    lastCameraRestartAt=now;
    startBarcodeCamera();
  },delay);
}
function startCameraHealthMonitor(){
  if(appTimer)clearInterval(appTimer);
  appTimer=setInterval(()=>{
    if(!cameraWanted||document.hidden)return;
    const video=document.getElementById('barcodeVideo');
    if(video&&video.paused){try{video.play().catch(()=>scheduleCameraRecovery(400))}catch(e){scheduleCameraRecovery(400)}}
    if(!cameraIsHealthy())scheduleCameraRecovery(400);
  },1500);
}
function stopBarcodeCamera(hide=true,explicit=true){
  if(explicit)cameraWanted=false;
  if(cameraRecoveryTimer)clearTimeout(cameraRecoveryTimer);cameraRecoveryTimer=null;
  if(appTimer)clearInterval(appTimer);appTimer=null;
  try{if(appZxingControls&&typeof appZxingControls.stop==='function')appZxingControls.stop()}catch(e){}
  appZxingControls=null;
  try{if(appZxingReader&&typeof appZxingReader.reset==='function')appZxingReader.reset()}catch(e){}
  appZxingReader=null;
  if(appStream)try{appStream.getTracks().forEach(t=>{t.onended=null;t.onmute=null;t.stop()})}catch(e){}appStream=null;
  const b=document.getElementById('barcodeReader');if(b){b.innerHTML='';if(hide)b.style.display='none'}
}
window.addEventListener('pagehide',()=>stopBarcodeCamera(false,false));
window.addEventListener('pageshow',()=>{if(cameraWanted)scheduleCameraRecovery(150)});
window.addEventListener('focus',()=>{if(cameraWanted)scheduleCameraRecovery(150)});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&cameraWanted)scheduleCameraRecovery(150)});
document.addEventListener('click',()=>{if(cameraWanted)setTimeout(()=>{const v=document.getElementById('barcodeVideo');if(v&&v.paused){try{v.play().catch(()=>scheduleCameraRecovery(250))}catch(e){scheduleCameraRecovery(250)}}else if(!cameraIsHealthy())scheduleCameraRecovery(250)},80)},true);

function initFloatingCartVisibility(){const btn=document.querySelector('.floatingCartButton');if(!btn)return;let ticking=false;const update=()=>{btn.classList.toggle('isVisible',(window.scrollY||document.documentElement.scrollTop||0)>180);ticking=false};const onScroll=()=>{if(!ticking){ticking=true;requestAnimationFrame(update)}};window.addEventListener('scroll',onScroll,{passive:true});window.addEventListener('pageshow',update);update();}
document.addEventListener('DOMContentLoaded',function(){restoreScrollState();document.querySelectorAll('.accountingForm').forEach(calcAccountingForm);initChatAutoRefresh();initFloatingCartVisibility();document.querySelectorAll('select[name=category]').forEach(toggleDepositCheckbox);try{if(document.getElementById('prodGrid'))setView(localStorage.getItem('catalogView')||'list');}catch(e){}try{if(location.pathname==='/admin-products'||location.pathname==='/admin-new-products'){const y=sessionStorage.getItem('adminProductsScroll');if(y!==null){sessionStorage.removeItem('adminProductsScroll');setTimeout(function(){window.scrollTo(0,Number(y)||0)},0);}}}catch(e){}});
document.addEventListener('submit',function(e){const f=e.target;if(f && f.matches('form.directDeleteForm')){e.preventDefault();e.stopPropagation();deleteDirectMessage(f);return false}if(f && f.matches('form.chatForm')){e.preventDefault();e.stopPropagation();sendChatMessage(f);return false}if(f && f.matches('form[data-ajax-cart]')){e.preventDefault();e.stopPropagation();const action=f.dataset.action;if(action==='add')addToCart(f);else if(action==='qty')changeQty(f);else if(action==='remove')removeCart(f);else if(action==='clear')clearCart(f);return false}if(f && f.matches('form[data-ajax-admin-order]')){e.preventDefault();e.stopPropagation();if(f.classList.contains('orderSearchAddBox')&&!prepareOrderProductAdd(f))return false;adminOrderFetch(f);return false}if(f && f.matches('form.orderSearchAddBox')){e.preventDefault();e.stopPropagation();addOrderDraftProduct(f);return false}if(f && f.method && String(f.method).toLowerCase()==='post'){saveScrollState();}},true);
</script></head><body>
<header class="top"><nav class="nav">
  <a class="logo" href="${logoHref}" aria-label="TARANKA"><img class="siteLogoImg" src="/taranka-header-logo.png" alt="TARANKA"></a>
  ${session.shop?`<span class="shopPill">${esc(session.shop)}</span>`:''}
  <div class="links">
    <a class="mobileHide" href="/">Головна</a>
    ${session.shop?`<a class="mobileCabinet" href="/cabinet">Кабінет магазину</a><a class="mobileMessages" data-unread-key="directMessages" href="/messages">Повідомлення${badgeCount(unread.directMessages)}</a><a class="cart mobileCart" href="/cart">🛒 Кошик (<span data-cart-count>${count}</span>)</a><a class="mobileHide" href="/catalog">Каталог</a><a class="mobileHide" href="/catalog?new=1">Новинки${badge(unread.newProducts)}</a><a class="mobileAnnouncements" href="/about">Оголошення${badge(unread.announcements)}</a>${canUseChat(layoutDb, session)?`<a class="mobileChat" href="/chat">Чат${badge(unread.chat)}</a>`:''}<a class="mobileLogout" href="/shop-logout">Вийти</a>`:''}
    ${!session.shop?`<a class="mobileAnnouncements" href="/about">Оголошення${badge(unread.announcements)}</a>`:''}
    ${!session.shop && canUseChat(layoutDb, session)?`<a class="mobileChat" href="/chat">Чат${badge(unread.chat)}</a>`:''}
    ${session.admin?`<a href="/admin">Склад</a><a href="/admin-logout">Вийти зі складу</a>`:(!session.shop?`<a class="mobileHide" href="/admin-login">Склад</a>`:'')}
  </div>
</nav></header>
<main class="wrap">${content}</main>
<div id="toast" class="toast"></div>
</body></html>`;
}

function productCard(p, session){ p=enrichProduct(p); const cartItem=(session.cart||[]).find(x=>String(x.id)===String(p.id)); const qty=cartItem?cartItem.qty:0; const meta=productMetaText(p); return `<div class="prodCard" data-product="${esc((p.name+' '+p.category+' '+meta+' '+p.weight).toLowerCase())}"><div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center"><span class="prodCardBadge">${CAT_ICONS[p.category]||'▣'} ${esc(p.category)}</span>${p.isNew?'<span class="prodCardNew">NEW</span>':''}</div><div class="prodCardName">${esc(productDisplayName(p))}</div><div class="prodCardWeight">${meta?'<span class="prodCardDepositBadge">кауція</span>':''}</div><div class="prodResult" data-item-result="${p.id}">${esc(productResultText(p, qty))}</div><div class="prodCardQty"><form method="post" action="/cart/qty" data-ajax-cart data-action="qty" onsubmit="event.preventDefault();return changeQty(this)"><input type="hidden" name="id" value="${p.id}"><input type="hidden" name="delta" value="-1"><button class="secondary iconBtn minusBtn" aria-label="Мінус">−</button></form><div class="prodCardQtyNum" data-item-count="${p.id}">${qty}</div><form method="post" action="/cart/add" data-ajax-cart data-action="add" onsubmit="event.preventDefault();return addToCart(this)"><input type="hidden" name="id" value="${p.id}"><button class="iconBtn" aria-label="Додати">+</button></form></div></div>`; }
function productRow(p, session, n){ p=enrichProduct(p); const cartItem=(session.cart||[]).find(x=>String(x.id)===String(p.id)); const qty=cartItem?cartItem.qty:0; const meta=productMetaText(p); return `<tr data-product="${esc((p.name+' '+p.category+' '+meta+' '+p.weight).toLowerCase())}"><td class="num">${n}</td><td class="mainCell">${p.isNew?'<span class="newDot">new</span> ':''}<span class="name">${esc(productDisplayName(p))}</span><span class="mobileMeta"><span class="prodResult" data-item-result="${p.id}">${esc(productResultText(p, qty))}</span></span></td><td class="weight">${esc(meta)}<br><span class="prodResult" data-item-result="${p.id}">${esc(productResultText(p, qty))}</span></td><td class="qtyCell"><div class="qtySide">${meta?'<span class="mobileDepositBadge">кауція</span>':''}<div class="listQty"><form method="post" action="/cart/qty" data-ajax-cart data-action="qty" onsubmit="event.preventDefault(); return changeQty(this)"><input type="hidden" name="id" value="${p.id}"><input type="hidden" name="delta" value="-1"><button class="secondary iconBtn minusBtn" aria-label="Мінус">−</button></form><div class="qtynum" data-item-count="${p.id}">${qty}</div><form method="post" action="/cart/add" data-ajax-cart data-action="add" onsubmit="event.preventDefault(); return addToCart(this)"><input type="hidden" name="id" value="${p.id}"><button class="iconBtn" aria-label="Додати">+</button></form></div></div></td></tr>`; }
function adminProductRow(p, n){
  p=enrichProduct(p);
  const meta=productMetaText(p);
  const depositCell=canHaveDeposit(p.category)
    ? `<form method="post" action="/admin/product-deposit" data-preserve-admin-scroll><input type="hidden" name="id" value="${p.id}"><button class="compactBtn ${p.hasDeposit?'warn':'secondary'}">${p.hasDeposit?'Кауція −':'Кауція +'}</button></form>`
    : `<span class="muted">—</span>`;
  return `<tr class="${p.hidden?'hiddenProduct':''}" data-product="${esc((p.name+' '+p.category+' '+meta+' '+p.weight).toLowerCase())}" data-edit-id="${p.id}" data-edit-name="${esc(p.name)}" data-edit-weight="${esc(p.weight)}" data-edit-unit="${esc(normalizeUnit(p.resultUnit||p.packUnit))}"><td class="num">${n}</td><td class="mainCell" data-edit-field="name">${p.hidden?'<span class="hiddenBadge">hidden</span> ':''}${p.isNew?'<span class="newDot">new</span> ':''}<span class="editNameSpan">${esc(p.name)}</span><span class="mobileMeta editWeightMobile"><span class="editWeightMobileValue">${esc(p.weight)}</span><span class="editUnitMobileValue">${esc(normalizeUnit(p.resultUnit||p.packUnit))}</span>${meta?` · ${esc(meta)}`:''}</span></td><td class="weight" data-edit-field="weight"><span class="editWeightSpan">${esc(p.weight)}</span> <span class="editUnitSpan">${esc(normalizeUnit(p.resultUnit||p.packUnit))}</span></td><td class="adminAction">${depositCell}</td><td class="adminAction"><form method="post" action="/admin/product-toggle-hidden" data-preserve-admin-scroll><input type="hidden" name="id" value="${p.id}"><button class="compactBtn ${p.hidden?'secondary':'warn'}">${p.hidden?'Показати':'Приховати'}</button></form></td><td class="adminAction"><form method="post" action="/admin/product-new" data-preserve-admin-scroll><input type="hidden" name="id" value="${p.id}"><button class="compactBtn secondary">${p.isNew?'new −':'new +'}</button></form></td><td class="adminAction"><button class="editIconBtn" type="button" onclick="startEditProduct(this)" title="Редагувати">✏️</button></td><td class="deleteCell"><form method="post" action="/admin/product-delete" onsubmit="saveAdminScroll(); return confirm('Видалити товар?')"><input type="hidden" name="id" value="${p.id}"><button class="deleteIcon" title="Видалити" aria-label="Видалити товар">×</button></form></td></tr>`;
}
function adminHiddenProductsPage(db){
  const hiddenProducts=(db.products||[]).filter(p=>p.hidden);
  return `<div class="adminShell">${adminMenu()}<section class="adminProductsSection"><div class="actions" style="align-items:center;justify-content:space-between;margin-bottom:12px"><h1 style="margin:0">Приховані позиції</h1><a class="btn secondary" href="/admin-products">До товарів</a></div><div class="card" style="padding:16px;margin-bottom:16px"><p class="muted" style="margin:0">Тут зберігаються товари, які були приховані в розділі “Товар”. Натисніть “Показати”, щоб повернути позицію в каталог і основний список товарів.</p></div><div class="card adminSearchCard"><div class="adminSearchWrap"><span class="adminSearchIcon">🔎</span><input id="search" oninput="filterProducts()" placeholder="Пошук товарів..." autocomplete="off"></div><div id="searchEmpty" class="adminSearchEmpty">Нічого не знайдено</div></div><div class="listWrap adminProductsTableWrap"><table class="listTable adminProductsTable"><thead><tr><th>№</th><th>Назва</th><th class="weightHead">Кількість/вага</th><th>Кауція</th><th>Дія</th><th>Новинка</th><th>✏️</th><th>×</th></tr></thead><tbody>${hiddenProducts.length?hiddenProducts.map((p,n)=>adminProductRow(p,n+1)).join(''):'<tr><td colspan="8" class="center muted" style="padding:24px">Прихованих позицій поки немає</td></tr>'}</tbody></table></div></section></div>`;
}

function adminNewProductsPage(db){
  const newProducts=(db.products||[]).filter(p=>p.isNew&&!p.hidden).sort((a,b)=>Number(b.newAt||0)-Number(a.newAt||0));
  return `<div class="adminShell">${adminMenu()}<section class="adminProductsSection"><div class="actions" style="align-items:center;justify-content:space-between;margin-bottom:12px"><h1 style="margin:0">Новинки</h1><a class="btn secondary" href="/admin-products">До всіх товарів</a></div><div class="card" style="padding:16px;margin-bottom:16px"><p class="muted" style="margin:0">У цьому розділі автоматично відображаються всі активні товари з позначкою «Новинка». Щоб прибрати товар зі списку, натисніть кнопку «new −» у його рядку.</p></div><div class="card adminSearchCard"><div class="adminSearchWrap"><span class="adminSearchIcon">🔎</span><input id="search" oninput="filterProducts()" placeholder="Пошук серед новинок..." autocomplete="off"></div><div id="searchEmpty" class="adminSearchEmpty">Нічого не знайдено</div></div><div class="listWrap adminProductsTableWrap"><table class="listTable adminProductsTable"><thead><tr><th>№</th><th>Назва</th><th class="weightHead">Кількість/вага</th><th>Кауція</th><th>Дія</th><th>Новинка</th><th>✏️</th><th>×</th></tr></thead><tbody>${newProducts.length?newProducts.map((p,n)=>adminProductRow(p,n+1)).join(''):'<tr><td colspan="8" class="center muted" style="padding:24px">Товарів із позначкою «Новинка» поки немає</td></tr>'}</tbody></table></div></section></div>`;
}

function orderItemsEditorHtml(o){
  const items = Array.isArray(o.items) ? o.items : [];
  return `<div class="orderEditBox"><div class="orderEditHead"><b>Редагування позицій</b><span>Змініть або додайте кілька позицій, а потім натисніть «Застосувати».</span></div><div class="orderEditList orderEditTable" data-order-items-list>${items.length?items.map((i,idx)=>orderDraftItemRowHtml(i, idx)).join(''):'<div class="orderEmptyItems" data-order-empty>У цьому замовленні немає позицій.</div>'}</div><div class="actions" style="margin-top:12px;align-items:center"><button type="button" onclick="applyOrderDraft(this)">Застосувати</button><span class="muted" data-order-draft-status></span></div></div>`;
}
function orderDraftItemRowHtml(i, idx){
  const qty=Math.max(1, Number(i.qty || 1));
  return `<div class="orderEditRow" data-order-item data-id="${esc(i.id || '')}" data-name="${esc(i.name || '')}" data-category="${esc(i.category || '')}" data-weight="${esc(i.weight || '')}" data-qty="${qty}"><div class="orderEditInfo"><b>${esc(i.name || '')}</b><span>${esc(productResultText(i, i.qty))}</span></div><div class="orderEditQtyStepper" aria-label="Кількість"><button type="button" class="secondary iconBtn minusBtn" aria-label="Мінус" onclick="stepOrderDraftItem(this,-1)">−</button><div class="qtynum" data-order-item-qty>${qty}</div><button type="button" class="iconBtn" aria-label="Плюс" onclick="stepOrderDraftItem(this,1)">+</button></div><button type="button" class="deleteIcon smallDelete" title="Видалити позицію" aria-label="Видалити позицію" onclick="removeOrderDraftItem(this)">×</button></div>`;
}
function orderAddProductHtml(o, products){
  const available = (products || []).filter(p=>!p.hidden);
  if(!available.length) return `<div class="orderAddBox muted">Немає товарів для додавання з асортименту.</div>`;
  return `<form class="orderAddBox orderSearchAddBox" method="post" action="/admin/order-item-add" onsubmit="return addOrderDraftProduct(this)"><input type="hidden" name="id" value="${esc(o.id)}"><input type="hidden" name="productId"><label class="orderSearchLabel"><input name="productSearch" autocomplete="off" required placeholder="Введіть назву або вагу..." oninput="filterOrderProductSearch(this)" onfocus="filterOrderProductSearch(this)"><div class="orderSearchResults" role="listbox">${available.map(p=>{const title=`${p.name} · ${p.weight} · ${p.category}`; const search=`${p.name} ${p.weight} ${p.category}`.toLowerCase(); return `<button type="button" class="orderSearchOption" data-id="${esc(p.id)}" data-name="${esc(p.name)}" data-weight="${esc(p.weight)}" data-category="${esc(p.category)}" data-title="${esc(title)}" data-search="${esc(search)}" onclick="selectOrderProduct(this)"><b>${esc(p.name)}</b><span>${esc(p.weight)} · ${esc(p.category)}</span></button>`;}).join('')}</div></label><div class="orderAddActions"><label class="orderAddQty">К-сть<div class="orderAddQtyStepper"><button type="button" class="secondary minusBtn" onclick="stepOrderAddQty(this,-1)" aria-label="Мінус">−</button><input type="number" name="qty" min="1" step="1" value="1"><button type="button" onclick="stepOrderAddQty(this,1)" aria-label="Плюс">+</button></div></label><button class="orderAddSubmit">Додати</button></div></form>`;
}
function adminOrderCard(o, products){
  return `<div class="card order" data-order-id="${esc(o.id)}"><div class="actions" style="align-items:flex-start;justify-content:space-between"><div><h3 style="margin:0 0 6px">Замовлення №${o.orderNo || o.id} · ${esc(o.shop)} <span class="status">${esc(o.status)}</span></h3><p class="muted" style="margin:0">${esc(o.createdAt)} · час Варшави</p></div><div class="actions" style="align-items:center;gap:8px"><button type="button" class="secondary" data-copy="${esc(orderCopyText(o))}" onclick="copyOrder(this)">📋 Копіювати</button><a class="btn secondary" href="/admin-order-export?id=${encodeURIComponent(o.id)}">⬇️ Скачати</a><form method="post" action="/admin/order-delete" data-ajax-admin-order onsubmit="return confirmOrderDelete(this)"><input type="hidden" name="id" value="${esc(o.id)}"><button class="deleteIcon" aria-label="Видалити замовлення" title="Видалити замовлення">×</button></form></div></div><ul class="orderItemsPreview">${(o.items||[]).map(i=>`<li>${esc(productDisplayName(i))} — ${esc(productOrderedText(i, i.qty))}</li>`).join('')}</ul><div class="orderComment"><div class="orderCommentLabel">Коментар магазину:</div>${esc(o.comment||'Без коментаря')}</div><details class="orderEditToggle"><summary>Показати / приховати редагування позицій</summary><div class="orderEditToggleBody">${orderAddProductHtml(o, products)}${orderItemsEditorHtml(o)}</div></details></div>`;
}


function isWarehouse(session){ return !!(session && (session.admin || session.shop==='Склад')); }
function intQty(v){ const n=Number(v); return Number.isInteger(n)&&n>=0?n:null; }
function kegStatusClass(status){ return status==='Перевірено'?'ok':(status==='Перевірено з розбіжністю'?'warn':'pending'); }
function returnableKegProducts(db){
  return (db.products||[]).filter(p=>p.isReturnableKeg===true && !p.hidden).map(enrichProduct).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'uk'));
}
function activeKegTypes(db){
  const products=returnableKegProducts(db);
  if(products.length) return products.map((p,idx)=>({id:String(p.id),productId:String(p.id),name:productDisplayName(p),order:idx+1,active:true}));
  return (db.kegTypes||[]).filter(k=>k.active!==false).sort((a,b)=>Number(a.order||0)-Number(b.order||0));
}
function orderKegItems(db, order){
  if(Array.isArray(order.kegItems)) return order.kegItems;
  return [];
}
function confirmedReturnedQty(db, shop, productId){
  return (db.kegReturns||[]).filter(r=>String(r.shop||'')===String(shop||'') && r.status!=='Очікує перевірки').reduce((sum,r)=>sum+(r.items||[]).filter(i=>String(i.productId||i.typeId||'')===String(productId)).reduce((a,i)=>a+Number(i.actualQty||0),0),0);
}
function pendingReturnedQty(db, shop, productId){
  return (db.kegReturns||[]).filter(r=>String(r.shop||'')===String(shop||'') && r.status==='Очікує перевірки').reduce((sum,r)=>sum+(r.items||[]).filter(i=>String(i.productId||i.typeId||'')===String(productId)).reduce((a,i)=>a+Number(i.declaredQty||0),0),0);
}
function applicationKegItems(db, app){
  if(Array.isArray(app.kegItems)) return app.kegItems;
  return captureApplicationKegItems(db, app);
}
function orderedKegQty(db, shop, productId){
  const fromOrders=(db.orders||[])
    .filter(o=>String(o.shop||'')===String(shop||''))
    .reduce((sum,o)=>sum+orderKegItems(db,o)
      .filter(i=>String(i.productId||i.id||'')===String(productId))
      .reduce((a,i)=>a+Number(i.qty||0),0),0);
  const fromApplications=(db.applications||[])
    .filter(app=>app.status==='completed' && String(app.shopName||app.shop||'')===String(shop||''))
    .reduce((sum,app)=>sum+applicationKegItems(db,app)
      .filter(i=>String(i.productId||i.id||'')===String(productId))
      .reduce((a,i)=>a+Number(i.qty||0),0),0);
  return fromOrders+fromApplications;
}
function kegAdjustmentQty(db, shop, productId){ return (db.kegAdjustments||[]).filter(a=>String(a.shop||'')===String(shop||'')&&String(a.productId||'')===String(productId||'')).reduce((sum,a)=>sum+Number(a.delta||0),0); }
function shopKegBalance(db, shop, productId){ return Math.max(0, orderedKegQty(db,shop,productId)-confirmedReturnedQty(db,shop,productId)+kegAdjustmentQty(db,shop,productId)); }
function pendingTransferOutQty(db, shop, productId){
  return (db.kegTransfers||[]).filter(t=>String(t.fromShop||'')===String(shop||'')&&['Очікує підтвердження складу','Очікує підтвердження магазину'].includes(t.status)).reduce((sum,t)=>sum+(t.items||[]).filter(i=>String(i.productId||'')===String(productId||'')).reduce((a,i)=>a+Number(i.qty||0),0),0);
}
function shopKegAvailableToReturn(db, shop, productId){ return Math.max(0, shopKegBalance(db,shop,productId)-pendingReturnedQty(db,shop,productId)-pendingTransferOutQty(db,shop,productId)); }
function kegTransferStatusClass(status){ return status==='Завершено'?'done':(String(status||'').startsWith('Відхилено')?'rejected':status==='Очікує підтвердження магазину'?'receiver':'warehouse'); }
function nextKegTransferNo(db){ const y=new Date().getFullYear(); const max=(db.kegTransfers||[]).reduce((m,r)=>Math.max(m,Number(String(r.number||'').split('-').pop())||0),0); return `KT-${y}-${String(max+1).padStart(5,'0')}`; }
function transferItemsHtml(items){ return `<ul class="kegTransferItems">${(items||[]).map(i=>`<li><b>${esc(i.name)}</b> — ${Number(i.qty||0)}</li>`).join('')}</ul>`; }

function captureOrderKegItems(db, items){
  const selected=new Set(returnableKegProducts(db).map(p=>String(p.id)));
  return (items||[]).filter(i=>selected.has(String(i.id))).map(i=>({productId:String(i.id),id:String(i.id),name:productDisplayName(i),qty:Math.max(0,Number(i.qty||0))})).filter(i=>i.qty>0);
}
function captureApplicationKegItems(db, app){
  const selected=new Set(returnableKegProducts(db).map(p=>String(p.id)));
  const totals=new Map();
  for(const pallet of (app&&app.pallets)||[]){
    for(const item of (pallet.items||[])){
      const productId=String(item.productId||'');
      if(!selected.has(productId)) continue;
      const quantity=Number(item.quantity);
      const qty=Math.max(0,Number.isFinite(quantity)?quantity:0);
      if(qty<=0) continue;
      const current=totals.get(productId)||{productId,id:productId,name:String(item.productName||''),qty:0};
      current.qty=Math.round((current.qty+qty)*1000)/1000;
      if(!current.name) current.name=String(item.productName||'');
      totals.set(productId,current);
    }
  }
  return [...totals.values()].filter(i=>i.qty>0);
}
function nextKegNo(db){ const y=new Date().getFullYear(); const max=(db.kegReturns||[]).reduce((m,r)=>Math.max(m,Number(String(r.number||'').split('-').pop())||0),0); return `KG-${y}-${String(max+1).padStart(5,'0')}`; }
function kegItemsList(items, field='declaredQty'){ return `<ul class="kegMiniList">${(items||[]).map(i=>`<li><b>${esc(i.name)}</b><span>${Number(i[field]||0)}</span></li>`).join('')}</ul>`; }
function shopKegsPage(db, session, msg=''){
 const types=activeKegTypes(db);
 const rows=(db.kegReturns||[]).filter(r=>r.shop===session.shop).sort((a,b)=>Number(b.createdMs)-Number(a.createdMs));
 const shops=getShops(db).filter(s=>s.name!=='Склад'&&s.name!==session.shop);
 const transfers=(db.kegTransfers||[]).filter(t=>t.fromShop===session.shop||t.toShop===session.shop).sort((a,b)=>Number(b.createdMs)-Number(a.createdMs));
 const incoming=transfers.filter(t=>t.toShop===session.shop&&t.status==='Очікує підтвердження магазину');
 return `<section><h1>Кеги</h1><p class="muted">Тут показані лише зворотні кеги, які магазин отримав у замовленнях. Кеги на обліку виділені червоним. Повернення або переміщення змінює залишок лише після потрібних підтверджень.</p>${msg?`<div class="successMsg">${esc(msg)}</div>`:''}<div class="card kegCard"><form method="post" action="/kegs/send" onsubmit="return validateKegSend(this)"><div class="kegRows">${types.map(t=>{const balance=shopKegBalance(db,session.shop,t.id), available=shopKegAvailableToReturn(db,session.shop,t.id); return `<div class="kegRow ${balance>0?'onAccount':''}"><div><b>${esc(t.name)}</b><small class="muted" style="display:block;margin-top:4px">На обліку: ${balance} · доступно: ${available}</small></div><div class="kegStepper"><button type="button" class="secondary" onclick="stepKeg(this,-1)">−</button><input type="number" name="qty_${esc(t.id)}" value="0" min="0" max="${available}" step="1" inputmode="numeric"><button type="button" onclick="stepKeg(this,1)">+</button></div></div>`;}).join('')||'<p class="muted">Склад ще не вибрав товари, які є зворотними кегами.</p>'}</div>${types.length?'<button class="kegSendBtn">Відправити на склад</button>':''}</form></div>
 <div class="card kegTransferCard"><h2 style="margin-top:0">Перемістити кеги в інший магазин</h2><p class="muted">Спочатку переміщення підтверджує склад, потім магазин-одержувач. До останнього підтвердження залишки не змінюються.</p><form method="post" action="/kegs/transfer"><label class="kegTransferShopLabel">Магазин-одержувач<select name="toShop" required><option value="">Оберіть магазин</option>${shops.map(s=>`<option value="${esc(s.name)}">${esc(s.name)}</option>`).join('')}</select></label><div class="kegRows kegTransferRows">${types.map(t=>{const balance=shopKegBalance(db,session.shop,t.id), available=shopKegAvailableToReturn(db,session.shop,t.id);return `<div class="kegRow ${balance>0?'onAccount':''}"><div><b>${esc(t.name)}</b><small class="muted" style="display:block;margin-top:4px">На обліку: ${balance} · доступно: ${available}</small></div><div class="kegStepper"><button type="button" class="secondary" onclick="stepKeg(this,-1)">−</button><input type="number" name="move_${esc(t.id)}" min="0" max="${available}" step="1" value="0" inputmode="numeric"><button type="button" onclick="stepKeg(this,1)">+</button></div></div>`}).join('')}</div><label class="kegTransferCommentLabel">Коментар<input name="comment" placeholder="Необов’язково"></label><button class="kegSendBtn">Надіслати на підтвердження</button></form></div>
 ${incoming.length?`<h2 style="margin-top:24px">Потрібно підтвердити отримання</h2>${incoming.map(t=>`<div class="card kegTransferCard"><div class="actions" style="justify-content:space-between"><div><h3 style="margin:0">${esc(t.number)} · від ${esc(t.fromShop)}</h3><p class="muted">${esc(t.createdAt)}</p></div><span class="kegTransferStatus receiver">${esc(t.status)}</span></div>${transferItemsHtml(t.items)}<div class="kegTransferActions"><form method="post" action="/kegs/transfer/confirm"><input type="hidden" name="id" value="${esc(t.id)}"><button>Підтвердити отримання</button></form><form method="post" action="/kegs/transfer/reject"><input type="hidden" name="id" value="${esc(t.id)}"><button class="secondary">Відхилити</button></form></div></div>`).join('')}`:''}
 <h2 style="margin-top:24px">Історія переміщень</h2>${transfers.map(t=>`<div class="card kegTransferCard"><div class="actions" style="justify-content:space-between"><div><h3 style="margin:0">${esc(t.number)} · ${esc(t.fromShop)} → ${esc(t.toShop)}</h3><p class="muted">${esc(t.createdAt)}</p></div><span class="kegTransferStatus ${kegTransferStatusClass(t.status)}">${esc(t.status)}</span></div>${transferItemsHtml(t.items)}${t.comment?`<p class="muted">${esc(t.comment)}</p>`:''}</div>`).join('')||'<div class="card center muted">Переміщень ще немає</div>'}
 <h2 style="margin-top:24px">Історія повернень</h2>${rows.map(r=>`<div class="card kegHistory"><div class="actions" style="justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:nowrap"><div style="flex:1;min-width:0"><h3 style="margin:0">Заявка №${esc(r.number)}</h3><p class="muted" style="margin:8px 0 0">${esc(r.createdAt)}</p></div><span class="${r.status==='Очікує перевірки'?'kegTransferStatus warehouse':'status kegStatus '+kegStatusClass(r.status)}" style="flex-shrink:0">${r.status==='Очікує перевірки'?'Очікує підтвердження складу':esc(r.status)}</span></div>${kegItemsList(r.items)}<b>Всього — ${r.items.reduce((a,i)=>a+Number(i.declaredQty||0),0)}</b></div>`).join('')||'<div class="card center muted">Заявок ще немає</div>'}</section>`;
}
function warehouseKegsPage(db, url, msg=''){
 const from=String(url.searchParams.get('from')||''), to=String(url.searchParams.get('to')||''), shop=String(url.searchParams.get('shop')||'');
 let rows=(db.kegReturns||[]).slice().sort((a,b)=>Number(b.createdMs)-Number(a.createdMs));
 if(from) rows=rows.filter(r=>String(r.dateKey||'')>=from); if(to) rows=rows.filter(r=>String(r.dateKey||'')<=to); if(shop) rows=rows.filter(r=>r.shop===shop);
 const qs=new URLSearchParams({from,to,shop}).toString();
 const types=activeKegTypes(db);
 const balanceRows=getShops(db).filter(s=>s.name!=='Склад').map(sh=>{
   const items=types.map(t=>({name:t.name,qty:shopKegBalance(db,sh.name,t.id)})).filter(i=>i.qty>0);
   const hasHistory=(db.orders||[]).some(o=>String(o.shop||'')===String(sh.name||'')&&(o.kegItems||[]).length) || (db.kegReturns||[]).some(r=>String(r.shop||'')===String(sh.name||'')) || (db.kegAdjustments||[]).some(a=>String(a.shop||'')===String(sh.name||'')||String(a.relatedShop||'')===String(sh.name||''));
   return {shop:sh.name,items,hasHistory};
 }).filter(x=>x.items.length||x.hasHistory);
 const pendingTransfers=(db.kegTransfers||[]).filter(t=>t.status==='Очікує підтвердження складу').sort((a,b)=>Number(b.createdMs)-Number(a.createdMs));
 const transferHtml=`<div class="card" style="padding:18px;margin-bottom:16px"><h2 style="margin-top:0">Переміщення між магазинами — підтвердження складу</h2>${pendingTransfers.map(t=>`<div class="kegTransferCard" style="border-top:1px solid var(--line);padding-left:0;padding-right:0"><div class="actions" style="justify-content:space-between"><div><b>${esc(t.number)} · ${esc(t.fromShop)} → ${esc(t.toShop)}</b><p class="muted" style="margin:4px 0">${esc(t.createdAt)}</p></div><span class="kegTransferStatus warehouse">${esc(t.status)}</span></div>${transferItemsHtml(t.items)}<div class="kegTransferActions"><form method="post" action="/warehouse-kegs/transfer/approve"><input type="hidden" name="id" value="${esc(t.id)}"><button>Підтвердити складом</button></form><form method="post" action="/warehouse-kegs/transfer/reject"><input type="hidden" name="id" value="${esc(t.id)}"><button class="secondary">Відхилити</button></form></div></div>`).join('')||'<p class="muted">Нових переміщень на підтвердження немає.</p>'}</div>`;
 const transferModal=pendingTransfers.length?`<div id="kegTransferConfirmModal" style="position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,.48);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:16px"><div style="width:min(620px,100%);max-height:88vh;overflow:auto;background:#fff;border:1px solid #dbe5f1;border-radius:22px;box-shadow:0 24px 70px rgba(15,23,42,.24);padding:20px"><div class="actions" style="justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:8px"><div><h2 style="margin:0 0 5px">Потрібно підтвердити переміщення</h2><p class="muted" style="margin:0">Нових заявок: ${pendingTransfers.length}</p></div><button type="button" class="secondary" aria-label="Закрити" onclick="document.getElementById('kegTransferConfirmModal').remove()" style="width:42px;height:42px;padding:0;border-radius:12px;font-size:24px;line-height:1">×</button></div>${pendingTransfers.map(t=>`<div class="kegTransferCard" style="margin-top:14px;border:1px solid var(--line);border-radius:16px;padding:16px"><div class="actions" style="justify-content:space-between;align-items:flex-start;gap:10px"><div><h3 style="margin:0">${esc(t.number)}</h3><p style="margin:5px 0 0;font-weight:700">${esc(t.fromShop)} → ${esc(t.toShop)}</p><p class="muted" style="margin:4px 0 0">${esc(t.createdAt)}</p></div><span class="kegTransferStatus warehouse">Очікує склад</span></div>${transferItemsHtml(t.items)}${t.comment?`<p class="muted" style="margin:10px 0">${esc(t.comment)}</p>`:''}<div class="kegTransferActions" style="margin-top:14px"><form method="post" action="/warehouse-kegs/transfer/approve" style="flex:1"><input type="hidden" name="id" value="${esc(t.id)}"><button style="width:100%">Підтвердити</button></form><form method="post" action="/warehouse-kegs/transfer/reject" style="flex:1"><input type="hidden" name="id" value="${esc(t.id)}"><button class="secondary" style="width:100%">Відхилити</button></form></div></div>`).join('')}</div></div>`:'';
 const balancesHtml=`<div class="card" style="padding:18px;margin-bottom:16px"><h2 style="margin-top:0">Кеги на обліку магазинів</h2>${balanceRows.map(x=>`<a class="kegBalanceShop" href="/admin-kegs/shop?shop=${encodeURIComponent(x.shop)}"><div class="kegBalanceHead"><b>${esc(x.shop)}</b><span class="btn secondary compactBtn">Змінити кількість</span></div>${x.items.length?kegItemsList(x.items.map(i=>({name:i.name,declaredQty:i.qty}))):'<p class="muted" style="margin:10px 0 0">Зараз на обліку: 0 кег</p>'}</a>`).join('')||'<p class="muted">Кег на обліку поки немає.</p>'}</div>`;
 return `${transferModal}<section><div style="margin-bottom:14px"><a class="btn secondary" href="/admin">← Повернутись назад</a></div><h1>Облік кег</h1>${msg?`<div class="successMsg">${esc(msg)}</div>`:''}${transferHtml}${balancesHtml}<div class="card" style="padding:18px;margin-bottom:16px"><form class="kegFilters" method="get"><label>Дата від<input type="date" name="from" value="${esc(from)}"></label><label>Дата до<input type="date" name="to" value="${esc(to)}"></label><label>Магазин<select name="shop"><option value="">Усі магазини</option>${getShops(db).filter(s=>s.name!=='Склад').map(s=>`<option value="${esc(s.name)}" ${shop===s.name?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label><button>Фільтрувати</button><a class="btn secondary" href="/admin-kegs/export?${qs}">Скачати Excel</a></form></div><div class="card adminSearchCard"><div class="adminSearchWrap"><span class="adminSearchIcon">🔎</span><input id="search" oninput="filterKegRequests()" placeholder="Пошук за номером, магазином або статусом"></div></div>${rows.map(r=>`<a class="card kegRequestLink" data-keg-search="${esc((r.number+' '+r.shop+' '+r.status).toLowerCase())}" href="/warehouse-kegs/view?id=${encodeURIComponent(r.id)}"><div><h3>№${esc(r.number)} · ${esc(r.shop)}</h3><p class="muted">${esc(r.createdAt)}</p></div><div class="kegRequestMeta"><span class="status kegStatus ${kegStatusClass(r.status)}">${esc(r.status)}</span><b>Всього: ${(r.items||[]).reduce((a,i)=>a+Number((r.status==='Очікує перевірки'?i.declaredQty:i.actualQty)||0),0)}</b></div></a>`).join('')||'<div class="card center muted">Заявок за вибраний період немає</div>'}</section>`;
}
function warehouseKegView(db, r){
 return `<section><a class="btn secondary" href="/warehouse-kegs">← Повернутися до обліку кег</a><div class="card kegCard" style="margin-top:14px"><h1>Заявка №${esc(r.number)}</h1><p><b>Магазин:</b> ${esc(r.shop)}<br><b>Дата:</b> ${esc(r.createdAt)}<br><b>Статус:</b> ${esc(r.status)}</p><form method="post" action="/warehouse-kegs/confirm"><input type="hidden" name="id" value="${esc(r.id)}"><div class="kegRows">${r.items.map(i=>`<div class="kegVerifyRow"><div><b>${esc(i.name)}</b><span class="muted">Заявлено: ${Number(i.declaredQty||0)}</span></div><label>Фактично прийнято<div class="kegStepper"><button type="button" class="secondary" onclick="stepKeg(this,-1)">−</button><input type="number" name="actual_${esc(i.typeId)}" value="${Number(i.actualQty??i.declaredQty)}" min="0" step="1" inputmode="numeric"><button type="button" onclick="stepKeg(this,1)">+</button></div></label></div>`).join('')}</div><div class="actions" style="margin-top:16px"><button name="mode" value="edit">Прийняти</button></div></form></div></section>`;
}
function adminKegTypesPage(db,msg=''){
 const products=(db.products||[]).filter(p=>!p.hidden).map(enrichProduct).sort((a,b)=>String(a.category||'').localeCompare(String(b.category||''),'uk')||String(a.name||'').localeCompare(String(b.name||''),'uk'));
 const selected=products.filter(p=>p.isReturnableKeg===true).length;
 return `<div class="adminShell">${adminMenu()}<section><h1>Зворотні кеги</h1>${msg?`<div class="successMsg">${esc(msg)}</div>`:''}<div class="card" style="padding:18px;margin-bottom:16px"><p style="margin:0"><b>Вибрано: ${selected}</b></p><p class="muted" style="margin:6px 0 0">Позначте товари із загального списку, тара яких має повертатися. Після замовлення такого товару кега автоматично додається на облік магазину.</p></div><div class="card adminSearchCard"><div class="adminSearchWrap"><span class="adminSearchIcon">🔎</span><input id="search" oninput="filterProducts()" placeholder="Пошук товару..."></div></div><div class="listWrap adminProductsTableWrap"><table class="listTable adminProductsTable"><thead><tr><th>№</th><th>Товар</th><th>Категорія</th><th>Зворотна кега</th></tr></thead><tbody>${products.map((p,n)=>`<tr data-product="${esc((p.name+' '+p.category+' '+p.weight).toLowerCase())}"><td class="num">${n+1}</td><td class="mainCell"><b>${esc(productDisplayName(p))}</b></td><td>${esc(p.category||'')}</td><td><form method="post" action="/admin-keg-types/toggle"><input type="hidden" name="id" value="${esc(p.id)}"><button class="compactBtn ${p.isReturnableKeg?'warn':'secondary'}">${p.isReturnableKeg?'Зворотна ✓':'Вибрати'}</button></form></td></tr>`).join('')||'<tr><td colspan="4" class="center muted">Товарів немає</td></tr>'}</tbody></table></div></section></div>`;
}
function adminKegShopEditPage(db,url,msg=''){
 const shop=String(url.searchParams.get('shop')||'');
 if(!shop||shop==='Склад'||!getShops(db).some(s=>s.name===shop)) return '<div class="adminShell">'+adminMenu()+'<section><h1>Магазин не знайдено</h1></section></div>';
 const types=activeKegTypes(db);
 const otherShops=getShops(db).filter(s=>s.name!=='Склад'&&s.name!==shop);
 const history=(db.kegAdjustments||[]).filter(a=>a.shop===shop||a.relatedShop===shop).sort((a,b)=>Number(b.createdMs||0)-Number(a.createdMs||0)).slice(0,20);
 return `<div class="adminShell">${adminMenu()}<section><div class="actions" style="justify-content:space-between;align-items:center"><div><h1 style="margin-bottom:4px">Кеги: ${esc(shop)}</h1><p class="muted" style="margin:0">Переміщення між магазинами або ручне коригування залишку.</p></div><a class="btn secondary" href="/admin-kegs">← Назад</a></div>${msg?`<div class="successMsg">${esc(msg)}</div>`:''}<div class="card" style="padding:18px;margin-top:16px"><h2 style="margin-top:0">Перемістити кеги</h2><form method="post" action="/admin-kegs/transfer"><input type="hidden" name="fromShop" value="${esc(shop)}"><label style="display:grid;gap:6px;margin-bottom:14px;font-weight:700">Магазин-одержувач<select name="toShop" required style="padding:11px;border:1.5px solid var(--line);border-radius:10px"><option value="">Оберіть магазин</option>${otherShops.map(s=>`<option value="${esc(s.name)}">${esc(s.name)}</option>`).join('')}</select></label><div class="kegTransferGrid">${types.map(t=>{const q=shopKegBalance(db,shop,t.id);return `<div class="kegTransferRow"><div><b>${esc(t.name)}</b><small class="muted" style="display:block">На обліку: ${q}</small></div><label>Перемістити<input type="number" name="move_${esc(t.id)}" min="0" max="${q}" step="1" value="0"></label><span class="muted">кег</span></div>`}).join('')}</div><label style="display:grid;gap:6px;margin-top:14px;font-weight:700">Коментар<input name="comment" placeholder="Наприклад: переміщення між магазинами" style="padding:11px;border:1.5px solid var(--line);border-radius:10px"></label><button style="margin-top:14px">Перемістити</button></form></div><div class="card" style="padding:18px;margin-top:16px"><h2 style="margin-top:0">Встановити точну кількість</h2><p class="muted">Використовуйте тільки для виправлення помилки обліку. Значення замінить поточний залишок.</p><form method="post" action="/admin-kegs/set-balance"><input type="hidden" name="shop" value="${esc(shop)}"><div class="kegTransferGrid">${types.map(t=>`<div class="kegTransferRow"><div><b>${esc(t.name)}</b><small class="muted" style="display:block">Поточна кількість: ${shopKegBalance(db,shop,t.id)}</small></div><label>Нова кількість<input type="number" name="set_${esc(t.id)}" min="0" step="1" value="${shopKegBalance(db,shop,t.id)}"></label><span class="muted">кег</span></div>`).join('')}</div><label style="display:grid;gap:6px;margin-top:14px;font-weight:700">Причина<input name="comment" required placeholder="Причина коригування" style="padding:11px;border:1.5px solid var(--line);border-radius:10px"></label><button class="secondary" style="margin-top:14px">Зберегти кількість</button></form></div><div class="card kegTransferHistory" style="padding:18px"><h2 style="margin-top:0">Останні зміни</h2>${history.length?`<ul style="list-style:none;padding:0;margin:0">${history.map(a=>`<li><b>${esc(a.createdAt||'')}</b> · ${esc(a.name||'Кега')} · ${Number(a.delta)>0?'+':''}${Number(a.delta||0)}<br><span class="muted">${esc(a.reason||'Коригування')}${a.relatedShop?' · '+esc(a.relatedShop):''}</span></li>`).join('')}</ul>`:'<p class="muted">Змін ще не було.</p>'}</div></section></div>`;
}
function adminKegsPage(db,url){
 const from=String(url.searchParams.get('from')||''), to=String(url.searchParams.get('to')||''), shop=String(url.searchParams.get('shop')||''), status=String(url.searchParams.get('status')||'');
 const pendingTransfers=(db.kegTransfers||[]).filter(t=>t.status==='Очікує підтвердження складу').sort((a,b)=>Number(b.createdMs)-Number(a.createdMs));
 let rows=(db.kegReturns||[]).slice().sort((a,b)=>Number(b.createdMs)-Number(a.createdMs));
 if(from) rows=rows.filter(r=>String(r.dateKey||'')>=from); if(to) rows=rows.filter(r=>String(r.dateKey||'')<=to); if(shop) rows=rows.filter(r=>r.shop===shop); if(status) rows=rows.filter(r=>r.status===status);
 const qs=new URLSearchParams({from,to,shop,status}).toString();
 const balanceRows=getShops(db).filter(s=>s.name!=='Склад').map(sh=>{
   const types=activeKegTypes(db);
   const items=types.map(t=>({name:t.name,qty:shopKegBalance(db,sh.name,t.id)})).filter(i=>i.qty>0);
   const hasHistory=(db.orders||[]).some(o=>String(o.shop||'')===String(sh.name||'')&&(o.kegItems||[]).length) || (db.kegReturns||[]).some(r=>String(r.shop||'')===String(sh.name||'')) || (db.kegAdjustments||[]).some(a=>String(a.shop||'')===String(sh.name||'')||String(a.relatedShop||'')===String(sh.name||''));
   return {shop:sh.name,items,hasHistory};
 }).filter(x=>x.items.length||x.hasHistory);
 const pendingTransferHtml=pendingTransfers.map(t=>`<div class="card kegRequestLink adminKegTransferApproval" style="display:block;border:2px solid #fdba74;background:#fffaf5"><div class="actions" style="justify-content:space-between;align-items:flex-start;gap:12px"><div><h3 style="margin:0 0 6px">№${esc(t.number)} · ${esc(t.fromShop)} → ${esc(t.toShop)}</h3><p class="muted" style="margin:0">${esc(t.createdAt)}</p></div><span class="status kegStatus pending">Очікує підтвердження</span></div>${transferItemsHtml(t.items)}${t.comment?`<p class="muted" style="margin:8px 0">${esc(t.comment)}</p>`:''}<div class="kegTransferActions" style="margin-top:14px"><form method="post" action="/admin-kegs/transfer-approve" style="flex:1"><input type="hidden" name="id" value="${esc(t.id)}"><button style="width:100%">Підтвердити</button></form><form method="post" action="/admin-kegs/transfer-reject" style="flex:1"><input type="hidden" name="id" value="${esc(t.id)}"><button class="secondary" style="width:100%">Відхилити</button></form></div></div>`).join('');
 return `<div class="adminShell">${adminMenu()}<section><div style="margin-bottom:14px"><a class="btn secondary" href="/admin">← Повернутись назад</a></div><h1>Облік кег</h1>${pendingTransfers.length?`<div class="card" style="padding:18px;margin-bottom:16px;border:2px solid #fdba74;background:#fff7ed"><div class="actions" style="justify-content:space-between;align-items:center;gap:10px"><div><h2 style="margin:0">Переміщення на підтвердження</h2><p class="muted" style="margin:5px 0 0">Нових заявок: ${pendingTransfers.length}</p></div><span class="status kegStatus pending">Потрібна дія</span></div></div>${pendingTransferHtml}`:''}<div class="card" style="padding:18px;margin-bottom:16px"><div class="actions" style="justify-content:space-between;align-items:center;margin-bottom:12px"><h2 style="margin:0">Кеги на обліку магазинів</h2><a class="btn secondary" href="/admin-kegs/balances-export">Скачати Excel</a></div>${balanceRows.map(x=>`<a class="kegBalanceShop" href="/admin-kegs/shop?shop=${encodeURIComponent(x.shop)}"><div class="kegBalanceHead"><b>${esc(x.shop)}</b><span class="btn secondary compactBtn">Змінити кількість</span></div>${x.items.length?kegItemsList(x.items.map(i=>({name:i.name,declaredQty:i.qty}))):'<p class="muted" style="margin:10px 0 0">Зараз на обліку: 0 кег</p>'}</a>`).join('')||'<p class="muted">Кег на обліку поки немає.</p>'}</div><div class="card" style="padding:18px;margin-bottom:16px"><form class="kegFilters" method="get"><label>Дата від<input type="date" name="from" value="${esc(from)}"></label><label>Дата до<input type="date" name="to" value="${esc(to)}"></label><label>Магазин<select name="shop"><option value="">Усі магазини</option>${getShops(db).filter(s=>s.name!=='Склад').map(s=>`<option ${shop===s.name?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label><label>Статус<select name="status"><option value="">Усі статуси</option>${['Очікує перевірки','Перевірено','Перевірено з розбіжністю'].map(x=>`<option ${status===x?'selected':''}>${x}</option>`).join('')}</select></label><button>Фільтрувати</button><a class="btn secondary" href="/admin-kegs/export?${qs}">Експорт в Excel</a></form></div>${rows.map(r=>`<a class="card kegRequestLink" href="/warehouse-kegs/view?id=${encodeURIComponent(r.id)}"><div><h3>№${esc(r.number)} · ${esc(r.shop)}</h3><p class="muted">${esc(r.createdAt)}</p></div><div class="kegRequestMeta"><span class="status kegStatus ${kegStatusClass(r.status)}">${esc(r.status)}</span><b>Всього: ${(r.items||[]).reduce((a,i)=>a+Number((r.status==='Очікує перевірки'?i.declaredQty:i.actualQty)||0),0)}</b></div></a>`).join('')||'<div class="card center muted">Нічого не знайдено</div>'}</section></div>`;
}
function kegBalancesXlsx(db){
 const shops=getShops(db).filter(s=>s.name!=='Склад');
 const types=activeKegTypes(db);
 const rows=[
   markHeader(['Кеги на обліку магазинів','','','']),
   markPlain(['Дата формування',warsawTime(),'','']),
   markPlain(['','','','']),
   markHeader(['Магазин','Назва кеги','Кількість',''])
 ];
 const totals={};
 let grand=0;
 for(const sh of shops){
   let hasAny=false;
   for(const t of types){
     const q=shopKegBalance(db,sh.name,t.id);
     if(q<=0) continue;
     rows.push([sh.name,t.name,q,'кег']);
     totals[t.name]=(totals[t.name]||0)+q;
     grand+=q;
     hasAny=true;
   }
   if(!hasAny) rows.push([sh.name,'На обліку немає кег',0,'кег']);
 }
 rows.push(markPlain(['','','','']));
 rows.push(markHeader(['Підсумок по всіх магазинах','','','']));
 rows.push(markHeader(['Назва кеги','Загальна кількість','','']));
 for(const t of types){
   const q=Number(totals[t.name]||0);
   if(q>0) rows.push([t.name,q,'кег','']);
 }
 rows.push(markHeader(['Усього кег',grand,'кег','']));
 return genericXlsx('Кеги на обліку',rows,[24,42,16,12],'portrait');
}

function kegReportXlsx(db,url){
 const from=String(url.searchParams.get('from')||''), to=String(url.searchParams.get('to')||''), shop=String(url.searchParams.get('shop')||''), status=String(url.searchParams.get('status')||'');
 let records=(db.kegReturns||[]).filter(r=>r.status!=='Очікує перевірки');
 if(from) records=records.filter(r=>String(r.dateKey||'')>=from);
 if(to) records=records.filter(r=>String(r.dateKey||'')<=to);
 if(shop) records=records.filter(r=>r.shop===shop);
 if(status) records=records.filter(r=>r.status===status);
 records.sort((a,b)=>String(a.shop||'').localeCompare(String(b.shop||''),'uk') || String(a.dateKey||'').localeCompare(String(b.dateKey||'')) || Number(a.createdMs||0)-Number(b.createdMs||0));

 const rows=[
   markHeader(['Звіт з обліку повернення кег','','','']),
   markPlain(['Період від',from||'без обмеження','Період до',to||'без обмеження']),
   markPlain(['Дата формування',warsawTime(),'','']),
   markPlain(['','','',''])
 ];
 const totals={};
 let grand=0;
 let currentShop='';

 for(const r of records){
   const shopName=String(r.shop||'Без магазину');
   if(shopName!==currentShop){
     if(currentShop) rows.push(markPlain(['','','','']));
     rows.push(markHeader([`Магазин: ${shopName}`,'','','']));
     currentShop=shopName;
   }
   rows.push(markHeader(['Дата','Назва кеги','Кількість','Заявка №']));
   let hasItems=false;
   for(const i of (r.items||[])){
     const q=Math.max(0,Number(i.actualQty??i.declaredQty??0));
     if(q<=0) continue;
     const name=String(i.name||'Без назви');
     rows.push([r.dateDisplay||r.dateKey||r.createdAt||'',name,`${q} ${pluralKeg(q)}`,r.number||'']);
     totals[name]=(totals[name]||0)+q;
     grand+=q;
     hasItems=true;
   }
   if(!hasItems) rows.push([r.dateDisplay||r.dateKey||r.createdAt||'','Кег не прийнято','0 кег',r.number||'']);
 }

 if(!records.length){
   rows.push(markHeader(['За вибраний період прийнятих кег немає','','','']));
 }
 rows.push(markPlain(['','','','']));
 rows.push(markHeader(['Підсумок по всіх позиціях кег','','','']));
 rows.push(markHeader(['Назва кеги','Загальна кількість','','']));
 const order=new Map(activeKegTypes(db).map((t,idx)=>[String(t.name),idx]));
 Object.entries(totals).sort((a,b)=>(order.get(a[0])??9999)-(order.get(b[0])??9999) || a[0].localeCompare(b[0],'uk')).forEach(([name,q])=>{
   rows.push([name,`${q} ${pluralKeg(q)}`,'','']);
 });
 rows.push(markHeader(['Загальна кількість усіх кег',`${grand} ${pluralKeg(grand)}`,'','']));
 return genericXlsx('Облік кег',rows,[18,38,18,16],'portrait');
}


/* ===== Комплектування магазину за штрихкодом ===== */
const APP_UNITS=['штуки','кілограми','кеги','літри','мл'];
function appUnitFromProduct(product){ const u=String(product&&product.resultUnit||product&&product.packUnit||'szt').trim().toLowerCase(); if(u==='kg'||u==='g')return 'кілограми'; if(u==='l')return 'літри'; if(u==='ml')return 'мл'; if(u==='keg'||u==='кег'||u==='кеги')return 'кеги'; return 'штуки'; }
function appProductAmount(product){ const n=Number(product&&product.packQty||product&&product.format||product&&product.weight||1); return Number.isFinite(n)&&n>0?n:1; }
function appUid(prefix){ return String(prefix||'id')+'_'+Date.now()+'_'+crypto.randomBytes(3).toString('hex'); }
function cleanBarcode(v){ return String(v||'').trim().replace(/\s+/g,''); }
function getApplication(db,id){ return (db.applications||[]).find(a=>String(a.id)===String(id)); }
function getActivePallet(app){ return app&&Array.isArray(app.pallets)?app.pallets.find(p=>p.status==='in_progress')||null:null; }
function findBarcode(db,code){ code=cleanBarcode(code); return (db.productBarcodes||[]).find(b=>String(b.barcode)===code); }
function appProduct(db,id){ return (db.products||[]).find(p=>String(p.id)===String(id)); }
function nextAppNumber(db){ const numeric=(db.applications||[]).map(a=>Number(String(a.number||'').trim())).filter(Number.isFinite).filter(n=>n>0); return String((numeric.length?Math.max(...numeric):0)+1); }
function appStatus(s){ return ({draft:'Чернетка',in_progress:'Комплектується',completed:'Завершена',cancelled:'Скасована'})[s]||s; }
function appLog(db,app,action,details){ db.applicationLogs=db.applicationLogs||[]; db.applicationLogs.push({id:appUid('log'),applicationId:app.id,action,details:String(details||''),actor:'Склад',createdAt:warsawTime()}); }
function jsonReply(res,data,status=200){ res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify(data)); }
function appTotals(app){ const items=(app.pallets||[]).flatMap(p=>p.items||[]); return {pallets:(app.pallets||[]).length,positions:items.length,total:items.reduce((a,i)=>a+Number(i.totalUnits||0),0)}; }
function appUnitLabel(value){const unit=String(value||'штуки').trim().toLowerCase();if(unit==='кілограми'||unit==='кілограм'||unit==='kg'||unit==='кг')return 'kg';if(unit==='грами'||unit==='грам'||unit==='g'||unit==='гр')return 'g';if(unit==='літри'||unit==='літр'||unit==='l'||unit==='л')return 'l';if(unit==='мілілітри'||unit==='мілілітр'||unit==='мл'||unit==='ml')return 'ml';if(unit==='штуки'||unit==='штук'||unit==='штука'||unit==='szt'||unit==='szt.')return 'szt.';return String(value||'szt.');}
function appItemMetric(i){const unit=String(i.unitType||'штуки').toLowerCase();const value=Number(i.totalUnits||0);if(unit==='кілограми'||unit==='kg'||unit==='кг')return {kind:'measure',label:'Вага',value,unit:'kg'};if(unit==='грами'||unit==='g'||unit==='гр')return {kind:'measure',label:'Вага',value,unit:'g'};if(unit==='літри'||unit==='l'||unit==='л')return {kind:'measure',label:'Обсяг',value,unit:'l'};if(unit==='мілілітри'||unit==='мл'||unit==='ml')return {kind:'measure',label:'Обсяг',value,unit:'ml'};if(unit==='кеги'||unit==='кега'||unit==='кег')return {kind:'count',label:'Кількість',value,unit:'кеги'};return {kind:'count',label:'Кількість',value,unit:'szt.'};}
function appItemsHtml(app){ const p=getActivePallet(app); if(!p)return '<div class="card center">Список товарів недоступний</div>'; const items=p.items||[]; return `<div class="appListHead"><div><span class="appStep">Крок 2</span><h2>Перевірте та відредагуйте товари</h2><p class="muted">Для кожної позиції показується лише правильне значення: кількість, вага або обсяг.</p></div><b>${items.length} поз.</b></div><div class="appItemsTableWrap"><table class="listTable appItemsTable"><thead><tr><th>№</th><th>Назва товару</th><th>Штрихкод</th><th>Кількість</th><th>Вага / обсяг</th><th>Одиниця</th><th>Дії</th></tr></thead><tbody>${items.length?items.map((i,n)=>{const m=appItemMetric(i);return `<tr class="appItemRow ${m.kind==='count'?'appItemCount':'appItemMeasure'}"><td>${n+1}</td><td><b>${esc(i.productName)}</b></td><td>${i.barcode?esc(i.barcode):'<span class="muted">Без штрихкоду</span>'}</td><td class="appCountCell" data-label="Кількість"><strong>${m.kind==='count'?fmtNum(m.value):''}</strong></td><td class="appMeasureCell" data-label="${esc(m.label)}"><strong>${m.kind==='measure'?fmtNum(m.value):''}</strong></td><td class="appUnitCell">${esc(m.unit)}</td><td><div class="appRowActions"><button type="button" class="secondary compactBtn" onclick="editAppItem('${esc(i.id)}',${(i.variableWeight||i.manualMeasure)?'true':'false'},${Number(i.quantity)||0},${Number(i.totalUnits)||0},'${esc(i.barcode)}','${esc(i.unitType||'штуки')}',${i.manualEntry?'true':'false'})">Редагувати кількість</button>${i.barcode?`<button type="button" class="secondary compactBtn appBarcodeDeleteBtn" onclick="removeAppItemBarcode('${esc(i.id)}','${esc(i.barcode)}')">Видалити штрихкод</button>`:''}<button type="button" class="deleteIcon" onclick="deleteAppItem('${esc(i.id)}')">×</button></div></td></tr>`}).join(''):`<tr class="appEmptyRow"><td colspan="7" class="center muted">Ще нічого не додано. Увімкніть камеру або введіть штрихкод вище.</td></tr>`}</tbody></table></div>`; }
function appXlsx(app){ const rows=[['Номер заявки',app.number,'','',''],['Дата',app.completedAt||app.createdAt,'','',''],['Магазин',app.shopName,'','',''],markPlain(['','','','','']),markHeader(['№ позиції','Назва товару','Замовлення','Одиниця','Штрихкод'])]; let n=0; (app.pallets||[]).forEach(p=>(p.items||[]).forEach(i=>{n++;rows.push([n,i.productName,fmtNum(i.totalUnits),appUnitLabel(i.unitType),i.barcode])})); let logo=null;try{logo=fs.readFileSync(path.join(__dirname,'taranka-header-logo.png'))}catch(e){try{logo=fs.readFileSync(path.join(__dirname,'taranka-logo.png'))}catch(_){}} return genericXlsx('Заявка',rows,[14,46,20,24,18],'portrait',logo);}


function appPdf(app){
  return new Promise((resolve,reject)=>{
    try{
      const doc=new PDFDocument({size:'A4',margins:{top:36,bottom:42,left:36,right:36},info:{Title:`Заявка ${app.number||''}`}});
      const chunks=[];
      doc.on('data',c=>chunks.push(c));
      doc.on('end',()=>resolve(Buffer.concat(chunks)));
      doc.on('error',reject);
      const firstExisting=(candidates)=>candidates.find(file=>file&&fs.existsSync(file));
      let dejavuRegular='';
      let dejavuBold='';
      try{
        const dejavuPkg=require.resolve('dejavu-fonts-ttf/package.json');
        const dejavuDir=path.join(path.dirname(dejavuPkg),'ttf');
        dejavuRegular=path.join(dejavuDir,'DejaVuSans.ttf');
        dejavuBold=path.join(dejavuDir,'DejaVuSans-Bold.ttf');
      }catch(_){}
      const regular=firstExisting([
        dejavuRegular,
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf',
        '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf'
      ]);
      const bold=firstExisting([
        dejavuBold,
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
        '/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf',
        '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
        regular
      ]);
      if(!regular) throw new Error('PDF font with Cyrillic support was not found');
      doc.registerFont('AppSans',regular);
      doc.registerFont('AppSansBold',bold||regular);
      doc.font('AppSans');
      let logoPath=path.join(__dirname,'taranka-header-logo.png');
      if(!fs.existsSync(logoPath)) logoPath=path.join(__dirname,'taranka-logo.png');
      if(fs.existsSync(logoPath)){ try{doc.image(logoPath,440,32,{fit:[105,68],align:'right'});}catch(_){} }
      doc.font('AppSansBold').fontSize(12).text('Номер заявки:',36,42,{continued:true}).font('AppSans').text(' '+String(app.number||''));
      doc.font('AppSansBold').text('Дата:',36,62,{continued:true}).font('AppSans').text(' '+String(app.completedAt||app.createdAt||''));
      doc.font('AppSansBold').text('Магазин:',36,82,{continued:true}).font('AppSans').text(' '+String(app.shopName||''));
      let y=120;
      const widths=[42,245,105,98];
      const x0=36;
      const rowH=28;
      const drawCell=(x,y,w,h,text,bold=false,align='left')=>{doc.rect(x,y,w,h).stroke('#777');doc.font(bold?'AppSansBold':'AppSans').fontSize(9).fillColor('#111').text(String(text??''),x+5,y+7,{width:w-10,height:h-10,align,ellipsis:true});};
      const header=()=>{drawCell(x0,y,widths[0],rowH,'№',true,'center');drawCell(x0+widths[0],y,widths[1],rowH,'Назва позиції',true,'center');drawCell(x0+widths[0]+widths[1],y,widths[2],rowH,'Замовлення',true,'center');drawCell(x0+widths[0]+widths[1]+widths[2],y,widths[3],rowH,'Код',true,'center');y+=rowH;};
      header();
      const rows=[];(app.pallets||[]).forEach(p=>(p.items||[]).forEach(i=>rows.push(i)));
      if(!rows.length){drawCell(x0,y,widths.reduce((a,b)=>a+b,0),rowH,'У заявці немає товарів',false,'center');y+=rowH;}
      rows.forEach((i,n)=>{
        if(y+rowH>doc.page.height-70){doc.addPage();y=36;header();}
        const value=fmtNum(i.totalUnits)+' '+appUnitLabel(i.unitType);
        drawCell(x0,y,widths[0],rowH,n+1,false,'center');
        drawCell(x0+widths[0],y,widths[1],rowH,i.productName||'');
        drawCell(x0+widths[0]+widths[1],y,widths[2],rowH,value,false,'center');
        drawCell(x0+widths[0]+widths[1]+widths[2],y,widths[3],rowH,i.barcode||'',false,'center');
        y+=rowH;
      });
      y=Math.min(y+34,doc.page.height-55);
      doc.font('AppSans').fontSize(10).text('Склад: ____________________',36,y);
      doc.text('Магазин: ____________________',330,y);
      doc.end();
    }catch(e){reject(e);}
  });
}

function appPrint(app,auto){
  const rows=[];
  (app.pallets||[]).forEach(p=>(p.items||[]).forEach(i=>rows.push(i)));
  const orderValue=i=>{
    const value=fmtNum(i.totalUnits);
    const unit=appUnitLabel(i.unitType);
    return `${value} ${esc(unit)}`;
  };
  return `<!doctype html><html lang="uk"><head><meta charset="utf-8"><title>${esc(app.number)}</title><style>
*{box-sizing:border-box}body{font-family:Arial,sans-serif;padding:24px;color:#111;background:#fff}.printButton{margin-bottom:14px;padding:8px 14px}.documentHead{position:relative;min-height:82px;padding-right:155px;margin-bottom:16px}.documentLogo{position:absolute;right:0;top:0;width:105px;height:auto;max-height:70px;object-fit:contain}.meta{display:grid;gap:7px;font-size:14px;line-height:1.35}.metaRow{display:grid;grid-template-columns:120px 1fr;gap:10px}.metaLabel{font-weight:700}.orderTable{width:100%;border-collapse:collapse;table-layout:fixed;margin:0 0 24px}.orderTable th,.orderTable td{border:1px solid #777;padding:7px 8px;font-size:12px;vertical-align:middle}.orderTable th{background:#eee;font-weight:700;text-align:center}.orderTable th:nth-child(1),.orderTable td:nth-child(1){width:48px;text-align:center}.orderTable th:nth-child(3),.orderTable td:nth-child(3){width:145px;text-align:center}.orderTable th:nth-child(4),.orderTable td:nth-child(4){width:150px;text-align:center;overflow-wrap:anywhere}.empty{text-align:center;color:#666;padding:18px!important}.sign{display:flex;justify-content:space-between;margin-top:50px;font-size:13px}
@media print{body{padding:0}.printButton{display:none}.documentHead{break-inside:avoid}.orderTable{page-break-inside:auto}.orderTable tr{page-break-inside:avoid;page-break-after:auto}.orderTable thead{display:table-header-group}@page{size:A4;margin:12mm}}
</style></head><body><button class="printButton" onclick="window.print()">Друкувати / зберегти PDF</button><header class="documentHead"><img class="documentLogo" src="/taranka-header-logo.png" alt="TARANKA"><div class="meta"><div class="metaRow"><span class="metaLabel">Номер заявки:</span><span>${esc(app.number)}</span></div><div class="metaRow"><span class="metaLabel">Дата:</span><span>${esc(app.completedAt||app.createdAt)}</span></div><div class="metaRow"><span class="metaLabel">Магазин:</span><span>${esc(app.shopName)}</span></div></div></header><table class="orderTable"><thead><tr><th>Номер</th><th>Назва позиції</th><th>Замовлення</th><th>Код</th></tr></thead><tbody>${rows.length?rows.map((i,n)=>`<tr><td>${n+1}</td><td>${esc(i.productName)}</td><td>${orderValue(i)}</td><td>${esc(i.barcode)}</td></tr>`).join(''):'<tr><td class="empty" colspan="4">У заявці немає товарів</td></tr>'}</tbody></table><div class="sign"><span>Склад: ____________</span><span>Магазин: ____________</span></div>${auto?'<script>setTimeout(()=>window.print(),300)</script>':''}</body></html>`;
}
function applicationsPage(db,url){ const id=url.searchParams.get('id')||''; const app=getApplication(db,id); if(!app){ const drafts=(db.applications||[]).filter(a=>!['completed','cancelled'].includes(a.status)).slice().reverse(); const history=(db.applications||[]).filter(a=>a.status==='completed').slice().reverse(); const historyByShop=[]; const shopMap=new Map(); for(const a of history){ const key=String(a.shopId||a.shopName||'Без магазину'); let group=shopMap.get(key); if(!group){group={shopName:a.shopName||'Без магазину',orders:[]};shopMap.set(key,group);historyByShop.push(group)} group.orders.push(a); } const orderCard=a=>{const items=(a.pallets||[]).flatMap(p=>p.items||[]);return `<div class="card appHistoryOrder"><div class="appHistoryHead"><div class="appHistoryTitle"><b>Заявка № ${esc(a.number)}</b><span>${esc(a.completedAt||a.createdAt)}</span></div><div class="appHistoryDownloads"><a class="btn" target="_blank" rel="noopener" href="/admin-applications/${encodeURIComponent(a.id)}/print?auto=1">Друкувати</a><a class="btn secondary" download href="/admin-applications/${encodeURIComponent(a.id)}/pdf">Скачати PDF</a><a class="btn secondary" href="/admin-applications/${encodeURIComponent(a.id)}/xlsx">Скачати Excel</a></div></div><div class="appHistoryTableWrap"><table class="listTable appHistoryTable"><colgroup><col class="appHistoryColNo"><col class="appHistoryColProduct"><col class="appHistoryColValue"><col class="appHistoryColUnit"><col class="appHistoryColBarcode"></colgroup><thead><tr><th>№</th><th>Товар</th><th>Вага / кількість</th><th>Одиниця</th><th>Штрихкод</th></tr></thead><tbody>${items.map((i,n)=>`<tr><td>${n+1}</td><td>${esc(i.productName)}</td><td>${fmtNum(i.totalUnits)}</td><td>${esc(appUnitLabel(i.unitType))}</td><td>${esc(i.barcode)}</td></tr>`).join('')}</tbody></table></div></div>`}; return `<div class="adminShell">${adminMenu()}<section><h1>Нова заявка</h1><div class="card appCreate"><form class="form appCreateForm" method="post" action="/admin-applications/create"><label>Магазин<select name="shopId" required><option value="">Оберіть магазин</option>${getShops(db).map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('')}</select></label><button>Створити заявку</button></form></div><h2 class="appSectionTitle">Незавершені заявки</h2><div class="appDrafts">${drafts.length?drafts.map(a=>`<a class="card appDraft" href="/admin-applications?id=${encodeURIComponent(a.id)}"><b>${esc(a.shopName)}</b><span>${esc(a.number)} · ${esc(a.createdAt)}</span><strong>Продовжити ›</strong></a>`).join(''):'<div class="card center muted">Незавершених заявок немає</div>'}</div><h2 class="appSectionTitle">Історія сформованих замовлень</h2><div class="appHistory">${historyByShop.length?historyByShop.map(g=>`<details class="card appHistoryShop"><summary><span class="appHistoryShopName"><b>${esc(g.shopName)}</b><small>Сформованих заявок: ${g.orders.length}</small></span></summary><div class="appHistoryShopOrders">${g.orders.map(orderCard).join('')}</div></details>`).join(''):'<div class="card center muted">Сформованих замовлень ще немає</div>'}</div></section></div>`; }
 const locked=['completed','cancelled'].includes(app.status), t=appTotals(app); return `<div class="adminShell">${adminMenu()}<section><div class="actions appTop"><div><h1>Комплектування</h1><div class="appMeta"><b>${esc(app.shopName)}</b><span>Дата: ${esc(app.createdAt)}</span><span>№ заявки: ${esc(app.number)}</span></div></div><a class="btn secondary" href="/admin-applications">До списку</a></div>${locked?`<div class="card appCreate"><div class="actions"><a class="btn" target="_blank" href="/admin-applications/${encodeURIComponent(app.id)}/print">Друкувати</a><a class="btn secondary" download href="/admin-applications/${encodeURIComponent(app.id)}/pdf">Зберегти PDF</a><a class="btn secondary" href="/admin-applications/${encodeURIComponent(app.id)}/xlsx">Excel</a></div></div>`:`<div class="card appScanner appScannerClear"><div class="appListHead"><div><span class="appStep">Крок 1</span><h2>Додайте товари до заявки</h2><p class="muted">Скануйте штрихкод або додайте товар вручну, якщо штрихкоду немає.</p></div></div><div id="barcodeReader" class="barcodeReader"></div><div class="appScannerControls"><div class="actions appCameraActions"><button type="button" onclick="startBarcodeCamera()">📷 Увімкнути</button><button type="button" class="secondary" onclick="stopBarcodeCamera()">⏹ Зупинити</button><button type="button" class="secondary appManualAddBtn" onclick="openManualProductModal()">➕ Без штрихкоду</button></div><form id="barcodeForm" onsubmit="return submitBarcode(event)"><input id="barcodeInput" autocomplete="off" inputmode="numeric" placeholder="Штрихкод товару"><button>Додати</button></form></div><div id="appMessage"></div></div><div id="applicationItems">${appItemsHtml(app)}</div><div class="card appFinishBox"><div><span class="appStep">Крок 3</span><h2>Завершіть заявку</h2><p class="muted">Після завершення замовлення збережеться в історії та буде доступне для скачування у PDF та Excel.</p></div><div class="appActions"><button type="button" onclick="completeApplication()">Завершити комплектування</button><button class="danger" type="button" onclick="cancelApplication()">Скасувати заявку</button></div></div>`}<script>window.currentApplicationId=${JSON.stringify(app.id)};window.manualProductsData=${JSON.stringify((db.products||[]).filter(p=>!p.hidden).map(p=>({id:String(p.id),name:String(p.name||''),category:String(p.category||''),unit:appUnitFromProduct(p),amount:appProductAmount(p)})))};</script><div id="scanConfirmModal" class="appModal" hidden><div class="appModalBox appConfirmBox"><h2>Додати позицію?</h2><p>Штрихкод: <b id="confirmBarcode"></b></p><div class="actions"><button class="secondary" type="button" onclick="cancelConfirmedScan()">Скасувати</button><button type="button" onclick="confirmBarcodeScan()">Додати позицію</button></div></div></div><div id="bindModal" class="appModal" hidden onclick="if(event.target===this)closeBindModal()"><div class="appModalBox"><h2>Штрихкод не прив’язаний до товару</h2><p>Відскановано: <b id="unknownBarcode"></b></p><div class="appBindSearchGrid"><label>Розділ<select id="bindCategory" onchange="filterBindProducts()"><option value="">Усі розділи</option>${CATEGORIES.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('')}</select></label><label>Пошук<input id="productSearch" oninput="filterBindProducts()" placeholder="Назва товару"></label></div><input id="bindProduct" type="hidden" value=""><div id="bindProductList" class="bindProductList"></div><div class="appBindGrid"><label><span class="appBindFieldTitle">Одиниця</span><input id="bindUnit" readonly></label><label><span class="appBindFieldTitle">Кількість за сканування</span><input id="bindUnits" readonly></label></div><div class="actions"><button class="secondary" type="button" onclick="closeBindModal()">Скасувати</button><button type="button" onclick="bindBarcode()">Прив’язати та додати</button></div></div></div><div id="manualProductModal" class="appModal appManualSheet" hidden onclick="if(event.target===this)closeManualProductModal()"><div class="appModalBox appManualSheetBox"><div class="appSheetHandle"></div><div class="appSheetHead"><h2>Додати товар без штрихкоду</h2><button class="appSheetClose" type="button" aria-label="Закрити" onclick="closeManualProductModal()">×</button></div><p class="muted">Оберіть товар зі списку та вкажіть кількість, вагу або обсяг.</p><div class="appBindSearchGrid"><label>Розділ<select id="manualProductCategory" onchange="filterManualProducts()"><option value="">Усі розділи</option>${CATEGORIES.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('')}</select></label><label>Пошук<input id="manualProductSearch" oninput="filterManualProducts()" placeholder="Назва товару"></label></div><input id="manualProduct" type="hidden" value=""><div id="manualProductList" class="manualProductList"></div><div class="appBindGrid"><label>Одиниця<input id="manualProductUnit" readonly></label><label><span id="manualValueLabel">Кількість</span><input id="manualProductValue" type="number" min="0.001" step="0.001" inputmode="decimal" placeholder="Введіть значення" onkeydown="if(event.key==='Enter'){event.preventDefault();addManualProduct()}"></label></div><div class="actions"><button class="secondary" type="button" onclick="closeManualProductModal()">Скасувати</button><button type="button" onclick="addManualProduct()">Додати до заявки</button></div></div></div><div id="rebindModal" class="appModal" hidden><div class="appModalBox"><h2>Переприв’язати штрихкод до іншого товару</h2><p>Штрихкод: <b id="rebindOldBarcode"></b></p><p>Зараз прив’язаний до: <b id="rebindCurrentProduct"></b></p><div class="appBindSearchGrid"><label>Розділ<select id="rebindCategory" onchange="filterRebindProducts()"><option value="">Усі розділи</option>${CATEGORIES.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('')}</select></label><label>Пошук правильного товару<input id="rebindProductSearch" oninput="filterRebindProducts()" placeholder="Назва товару"></label></div><label>Правильний товар<select id="rebindProduct">${(db.products||[]).filter(p=>!p.hidden).map(p=>`<option value="${esc(p.id)}" data-category="${esc(p.category||'')}" data-search="${esc(String(p.name||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ł/g,'l'))}">${esc(p.name)}</option>`).join('')}</select></label><p class="muted">Після підтвердження штрихкод буде від’єднано від помилкового товару, прив’язано до вибраного товару та збережено в базі.</p><div class="actions"><button class="secondary" type="button" onclick="closeRebindModal()">Скасувати</button><button type="button" onclick="saveRebindBarcode()">Переприв’язати</button></div></div></div><div id="weightModal" class="appModal" hidden><div class="appModalBox appWeightBox"><h2>Вкажіть точну вагу</h2><p id="weightProductName"></p><label>Вага (<span id="weightUnit">кг</span>)<input id="exactWeight" type="number" min="0.001" step="0.001" inputmode="decimal" placeholder="Наприклад 1,250" onkeydown="if(event.key==='Enter'){event.preventDefault();saveExactWeight()}"></label><div class="actions"><button class="secondary" type="button" onclick="cancelWeightEntry()">Скасувати</button><button type="button" onclick="saveExactWeight()">Зберегти вагу</button></div></div></div></section></div>`; }

function requireAdmin(req,res,session){ if(!session.admin){ redirect(res,'/admin-login'); return false;} return true; }
function requireShop(req,res,session){ if(!session.shop || !isValidShop(session.shop)){ redirect(res,'/'); return false;} return true; }

async function handler(req,res){ try{ const url=new URL(req.url, `http://${req.headers.host}`); const session=getSession(req,res); let db=readDb(); if(session.shop && isValidShopInDb(db, session.shop)){ touchPresence(db, session); db=readDb(); }

  /* static files */
  if(req.method==='GET' && url.pathname==='/taranka-header-logo.png'){
    const headerLogoPath=path.join(__dirname,'taranka-header-logo.png');
    if(fs.existsSync(headerLogoPath)){ res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'public,max-age=86400'}); return res.end(fs.readFileSync(headerLogoPath)); }
    res.writeHead(404); return res.end('Not found');
  }
  if(req.method==='GET' && (url.pathname==='/taranka-logo.png' || url.pathname==='/logo.png')){
    const logoPath=path.join(__dirname,'taranka-logo.png');
    if(fs.existsSync(logoPath)){ res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'public,max-age=86400'}); return res.end(fs.readFileSync(logoPath)); }
    res.writeHead(404); return res.end('Not found');
  }

  if(req.method==='GET' && url.pathname==='/'){
    if(session.admin) return redirect(res,'/admin');
    if(session.shop && isValidShopInDb(db, session.shop)) return redirect(res,'/catalog');
    return send(res, layout('Вхід магазину', shopLoginPage('', db), session));
  }
  if(req.method==='POST' && url.pathname==='/shop-login'){
    const b=await body(req);
    const shop=String(b.shop||'');
    if(checkShopPassword(db, shop, b.password)){
      session.shop=shop;
      loadCartForSession(session);
      saveSession(session);
      return redirect(res,'/catalog');
    }
    return send(res, layout('Вхід магазину', shopLoginPage('Невірний магазин або пароль', db), session), 401);
  }
  if(req.method==='GET' && url.pathname==='/shop-logout'){
    session.shop=null;
    session.cart=[];
    saveSession(session);
    return redirect(res,'/');
  }

  if(req.method==='GET' && url.pathname==='/messages'){
    if(session.admin) return redirect(res,'/admin-messages');
    if(!requireShop(req,res,session)) return;
    markRead(db, session, 'directMessages'); db=readDb();
    return send(res, layout('Повідомлення', shopMessagesPage(db, session), session));
  }
  if(req.method==='GET' && url.pathname==='/messages/list'){
    if(!session.admin && !session.shop){ res.writeHead(403, {'Content-Type':'application/json; charset=utf-8'}); return res.end(JSON.stringify({ok:false})); }
    const shop=session.admin ? String(url.searchParams.get('shop')||'') : session.shop;
    if(!isValidShopInDb(db, shop)){ res.writeHead(400, {'Content-Type':'application/json; charset=utf-8'}); return res.end(JSON.stringify({ok:false})); }
    markRead(db, session, 'directMessages'); db=readDb();
    res.writeHead(200, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
    return res.end(JSON.stringify({ok:true, html:directMessagesHtml(db, shop, !!session.admin), unread:unreadCounts(db, session)}));
  }
  if(req.method==='POST' && url.pathname==='/messages/send'){
    if(!session.admin && !session.shop) return redirect(res,'/');
    const b=await body(req); const text=String(b.text||'').trim();
    const shop=session.admin ? String(b.shop||'') : session.shop;
    let ok=false;
    if(text && isValidShopInDb(db, shop)){
      db.directMessages=db.directMessages||[]; const t=nowMs();
      db.directMessages.push({id:String(t)+'_'+crypto.randomBytes(3).toString('hex'), shop, authorType:session.admin?'admin':'shop', text, createdAt:warsawTime(), createdMs:t, read:false});
      writeDb(db); ok=true; db=readDb();
    }
    if(req.headers['x-requested-with']==='fetch'){ res.writeHead(ok?200:400, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); return res.end(JSON.stringify({ok, html:ok?directMessagesHtml(db, shop, !!session.admin):'', unread:unreadCounts(db, session)})); }
    return redirect(res, session.admin?`/admin-messages?shop=${encodeURIComponent(shop)}`:'/messages');
  }
  if(req.method==='POST' && url.pathname==='/messages/delete'){
    if(!requireAdmin(req,res,session)) return;
    const b=await body(req); const id=String(b.id||''); const shop=String(b.shop||'');
    const before=(db.directMessages||[]).length;
    db.directMessages=(db.directMessages||[]).filter(m=>String(m.id)!==id);
    const ok=before!==db.directMessages.length;
    if(ok) writeDb(db);
    db=readDb();
    if(req.headers['x-requested-with']==='fetch'){ res.writeHead(ok?200:404, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); return res.end(JSON.stringify({ok, html:isValidShopInDb(db, shop)?directMessagesHtml(db, shop, true):'', unread:unreadCounts(db, session)})); }
    return redirect(res, isValidShopInDb(db, shop)?`/admin-messages?shop=${encodeURIComponent(shop)}`:'/admin-messages');
  }
  if(req.method==='GET' && url.pathname==='/admin-messages'){
    if(!requireAdmin(req,res,session)) return;
    markRead(db, session, 'directMessages'); db=readDb();
    return send(res, layout('Повідомлення', adminMessagesPage(db, url.searchParams.get('shop')||''), session));
  }
  if(req.method==='GET' && url.pathname==='/admin/presence'){
    if(!requireAdmin(req,res,session)) return;
    res.writeHead(200, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
    return res.end(JSON.stringify({ok:true, shops:getShops(db).map(s=>({name:s.name, ...shopPresence(db,s.name)}))}));
  }

  if(req.method==='GET' && url.pathname==='/admin-notifications'){ if(!requireAdmin(req,res,session))return; const page=notificationsPage(db,session); const seen=ensureReadState(db,'admin'); seen.notifications=nowMs(); writeDb(db); return send(res,layout('Сповіщення',page,session)); }
  if(req.method==='GET' && url.pathname==='/notifications'){ if(!requireShop(req,res,session))return; const page=notificationsPage(db,session); const seen=ensureReadState(db,readerKey(session)); seen.notifications=nowMs(); writeDb(db); return send(res,layout('Сповіщення',page,session)); }
  if(req.method==='GET' && url.pathname==='/about'){ if(session.shop || session.admin){ markRead(db, session, 'announcements'); db=readDb(); } db.announcements=db.announcements||[]; return send(res, layout('Оголошення', `<section><h1>Оголошення для магазинів</h1><p class="muted">Тут магазини можуть переглядати актуальні текстові оголошення від складу.</p>${db.announcements.length?db.announcements.map(a=>`<div class="card announcementCard"><div class="announcementDate">${esc(a.createdAt || '')}</div><div class="announcementText">${esc(a.text || '')}</div></div>`).join(''):'<div class="card center">Оголошень поки немає</div>'}</section>`, session)); }
  if(req.method==='GET' && url.pathname==='/contacts') return redirect(res,'/chat');
  if(req.method==='GET' && url.pathname==='/chat/messages'){ if(!canUseChat(db, session)){ res.writeHead(403, {'Content-Type':'application/json; charset=utf-8'}); return res.end(JSON.stringify({ok:false})); } markRead(db, session, 'chat'); db=readDb(); res.writeHead(200, {'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store'}); return res.end(JSON.stringify({ok:true, html:chatMessagesHtml(db, !!session.admin)})); }
  if(req.method==='GET' && url.pathname==='/chat'){ if(!canUseChat(db, session)){ if(session.shop) return send(res, layout('Чат недоступний', `<section class="card center"><h1>Чат недоступний</h1><p class="muted">Склад ще не додав ваш магазин до учасників чату.</p></section>`, session), 403); return redirect(res,'/'); } markRead(db, session, 'chat'); db=readDb(); return send(res, layout('Чат', chatPage(db, session), session)); }
  if(req.method==='POST' && url.pathname==='/chat/send'){ if(!canUseChat(db, session)){ if(req.headers['x-requested-with']==='fetch'){ res.writeHead(403, {'Content-Type':'application/json; charset=utf-8'}); return res.end(JSON.stringify({ok:false})); } return redirect(res,'/chat'); } const b=await body(req); const text=String(b.text||'').trim(); if(text){ db.chatMessages=db.chatMessages||[]; const t=nowMs(); db.chatMessages.push({id:String(t), authorType:session.admin?'admin':'shop', author:session.admin?'Склад':session.shop, text, createdAt:warsawTime(), createdMs:t}); writeDb(db); } if(req.headers['x-requested-with']==='fetch'){ db=readDb(); res.writeHead(200, {'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store'}); return res.end(JSON.stringify({ok:true, html:chatMessagesHtml(db, !!session.admin)})); } return redirect(res, req.headers.referer && req.headers.referer.includes('/admin-chat') ? '/admin-chat' : '/chat'); }
  if(req.method==='POST' && url.pathname==='/chat/delete'){
    if(!requireAdmin(req,res,session)) return;
    const b=await body(req); const id=String(b.id||'');
    const before=(db.chatMessages||[]).length;
    db.chatMessages=(db.chatMessages||[]).filter(m=>String(m.id)!==id);
    const ok=before!==db.chatMessages.length;
    if(ok) writeDb(db);
    db=readDb();
    if(req.headers['x-requested-with']==='fetch'){ res.writeHead(ok?200:404, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); return res.end(JSON.stringify({ok, html:chatMessagesHtml(db, true), unread:unreadCounts(db, session)})); }
    return redirect(res, req.headers.referer && req.headers.referer.includes('/admin-chat') ? '/admin-chat' : '/chat');
  }
  if(req.method==='GET' && url.pathname==='/admin-chat'){ if(!requireAdmin(req,res,session)) return; markRead(db, session, 'chat'); db=readDb(); return send(res, layout('Чат', adminChatPage(db, session), session)); }
  if(req.method==='POST' && url.pathname==='/admin/chat-members'){ if(!requireAdmin(req,res,session)) return; const b=await body(req); const selected=Array.isArray(b.members)?b.members:(b.members?[b.members]:[]); db.chatMembers=[...new Set(selected.map(String).filter(name=>isValidShopInDb(db,name)))]; writeDb(db); return redirect(res,'/admin-chat'); }

  if(req.method==='GET' && url.pathname==='/kegs'){ if(!requireShop(req,res,session)) return; if(session.shop==='Склад') return redirect(res,'/warehouse-kegs'); return send(res,layout('Кеги',shopKegsPage(db,session,url.searchParams.get('ok')?'Заявку успішно відправлено на склад.':(url.searchParams.get('transfer')==='sent'?'Переміщення надіслано на підтвердження складу.':url.searchParams.get('transfer')==='done'?'Переміщення підтверджено. Кеги перенесено на ваш облік.':'')),session)); }
  if(req.method==='POST' && url.pathname==='/kegs/transfer'){ if(!requireShop(req,res,session)) return; if(session.shop==='Склад') return redirect(res,'/warehouse-kegs'); const b=await body(req),toShop=String(b.toShop||''),comment=String(b.comment||'').trim(); if(!toShop||toShop===session.shop||!getShops(db).some(x=>x.name===toShop&&x.name!=='Склад')) return redirect(res,'/kegs'); const items=[]; for(const t of activeKegTypes(db)){const q=intQty(b['move_'+t.id]); const available=shopKegAvailableToReturn(db,session.shop,t.id); if(q===null||q>available) return send(res,layout('Кеги',shopKegsPage(db,session,`Для ${t.name} доступно лише ${available}.`),session),400); if(q>0)items.push({productId:String(t.id),name:t.name,qty:q});} if(!items.length)return send(res,layout('Кеги',shopKegsPage(db,session,'Додайте хоча б одну кегу для переміщення.'),session),400); const now=nowMs(); db.kegTransfers.push({id:String(now)+'_'+crypto.randomBytes(3).toString('hex'),number:nextKegTransferNo(db),fromShop:session.shop,toShop,items,comment,createdAt:warsawTime(),createdMs:now,status:'Очікує підтвердження складу'}); writeDb(db); return redirect(res,'/kegs?transfer=sent'); }
  if(req.method==='POST' && url.pathname==='/warehouse-kegs/transfer/approve'){ if(!isWarehouse(session))return redirect(res,'/'); const b=await body(req),t=(db.kegTransfers||[]).find(x=>x.id===String(b.id||'')); if(!t||t.status!=='Очікує підтвердження складу')return redirect(res,'/warehouse-kegs'); t.status='Очікує підтвердження магазину';t.statusUpdatedMs=nowMs();t.warehouseConfirmedAt=warsawTime();t.warehouseConfirmedBy=session.admin?'Адміністратор':'Склад';writeDb(db);return redirect(res,'/warehouse-kegs?transfer=approved'); }
  if(req.method==='POST' && url.pathname==='/warehouse-kegs/transfer/reject'){ if(!isWarehouse(session))return redirect(res,'/'); const b=await body(req),t=(db.kegTransfers||[]).find(x=>x.id===String(b.id||'')); if(!t||t.status!=='Очікує підтвердження складу')return redirect(res,'/warehouse-kegs');t.status='Відхилено складом';t.statusUpdatedMs=nowMs();t.rejectedAt=warsawTime();writeDb(db);return redirect(res,'/warehouse-kegs?transfer=rejected'); }
  if(req.method==='POST' && url.pathname==='/kegs/transfer/confirm'){ if(!requireShop(req,res,session))return; const b=await body(req),t=(db.kegTransfers||[]).find(x=>x.id===String(b.id||'')); if(!t||t.toShop!==session.shop||t.status!=='Очікує підтвердження магазину')return redirect(res,'/kegs'); for(const i of t.items||[]){const available=shopKegBalance(db,t.fromShop,i.productId); if(Number(i.qty)>available){t.status='Відхилено: недостатньо кег у відправника';writeDb(db);return redirect(res,'/kegs');}} const now=nowMs(); for(const i of t.items||[]){const base={productId:String(i.productId),name:i.name,createdAt:warsawTime(),createdMs:now,reason:'Підтверджене переміщення '+t.number};db.kegAdjustments.push({...base,id:String(now)+'_out_'+crypto.randomBytes(3).toString('hex'),shop:t.fromShop,relatedShop:t.toShop,delta:-Number(i.qty),type:'transfer_out'});db.kegAdjustments.push({...base,id:String(now)+'_in_'+crypto.randomBytes(3).toString('hex'),shop:t.toShop,relatedShop:t.fromShop,delta:Number(i.qty),type:'transfer_in'});} t.status='Завершено';t.statusUpdatedMs=nowMs();t.receiverConfirmedAt=warsawTime();writeDb(db);return redirect(res,'/kegs?transfer=done'); }
  if(req.method==='POST' && url.pathname==='/kegs/transfer/reject'){ if(!requireShop(req,res,session))return; const b=await body(req),t=(db.kegTransfers||[]).find(x=>x.id===String(b.id||'')); if(!t||t.toShop!==session.shop||t.status!=='Очікує підтвердження магазину')return redirect(res,'/kegs');t.status='Відхилено магазином-одержувачем';t.statusUpdatedMs=nowMs();t.rejectedAt=warsawTime();writeDb(db);return redirect(res,'/kegs'); }
  if(req.method==='POST' && url.pathname==='/kegs/send'){ if(!requireShop(req,res,session)) return; if(session.shop==='Склад') return redirect(res,'/warehouse-kegs'); const b=await body(req); const items=[]; for(const t of activeKegTypes(db)){ const q=intQty(b['qty_'+t.id]); const available=shopKegAvailableToReturn(db,session.shop,t.id); if(q===null || q>available) return send(res,layout('Кеги',shopKegsPage(db,session,`Не можна повернути більше, ніж є на обліку. Для ${t.name} доступно: ${available}.`),session),400); if(q>0)items.push({typeId:String(t.id),productId:String(t.productId||t.id),name:t.name,declaredQty:q,actualQty:null}); } if(!items.length) return send(res,layout('Кеги',shopKegsPage(db,session,''),session),400); const t=nowMs(), d=new Date(t), parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Warsaw',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d), val=Object.fromEntries(parts.map(x=>[x.type,x.value])), dateKey=`${val.year}-${val.month}-${val.day}`; db.kegReturns.push({id:String(t)+'_'+crypto.randomBytes(3).toString('hex'),number:nextKegNo(db),shop:session.shop,createdAt:warsawTime(),createdMs:t,dateKey,dateDisplay:`${val.day}.${val.month}.${val.year}`,status:'Очікує перевірки',items}); writeDb(db); return redirect(res,'/kegs?ok=1'); }
  if(req.method==='GET' && url.pathname==='/warehouse-kegs'){ if(!isWarehouse(session)) return redirect(res,'/'); return send(res,layout('Облік кег',warehouseKegsPage(db,url,url.searchParams.get('ok')?'Приймання успішно підтверджено.':(url.searchParams.get('transfer')==='approved'?'Переміщення підтверджено складом і надіслано магазину-одержувачу.':url.searchParams.get('transfer')==='rejected'?'Переміщення відхилено складом.':'')),session)); }
  if(req.method==='GET' && url.pathname==='/warehouse-kegs/view'){ if(!isWarehouse(session)) return redirect(res,'/'); const r=(db.kegReturns||[]).find(x=>x.id===String(url.searchParams.get('id')||'')); if(!r)return notFound(res); return send(res,layout('Перевірка кег',warehouseKegView(db,r),session)); }
  if(req.method==='POST' && url.pathname==='/warehouse-kegs/confirm'){ if(!isWarehouse(session)) return redirect(res,'/'); const b=await body(req), r=(db.kegReturns||[]).find(x=>x.id===String(b.id||'')); if(!r)return notFound(res); const mode=String(b.mode||'edit'); let diff=false; for(const i of r.items){ const q=mode==='accept'?Number(i.declaredQty):intQty(b['actual_'+i.typeId]); if(q===null) return send(res,layout('Перевірка кег',warehouseKegView(db,r),session),400); i.actualQty=q; if(q!==Number(i.declaredQty))diff=true; } r.status=diff?'Перевірено з розбіжністю':'Перевірено';r.checkedAt=warsawTime();r.checkedMs=nowMs();r.checkedBy=session.admin?'Адміністратор':'Склад';writeDb(db);return redirect(res,'/warehouse-kegs?ok=1'); }
  if(req.method==='POST' && url.pathname==='/admin-kegs/transfer-approve'){ if(!requireAdmin(req,res,session))return; const b=await body(req),t=(db.kegTransfers||[]).find(x=>x.id===String(b.id||'')); if(t&&t.status==='Очікує підтвердження складу'){t.status='Очікує підтвердження магазину';t.statusUpdatedMs=nowMs();t.warehouseConfirmedAt=warsawTime();t.warehouseConfirmedBy='Адміністратор';writeDb(db);} return redirect(res,'/admin-kegs'); }
  if(req.method==='POST' && url.pathname==='/admin-kegs/transfer-reject'){ if(!requireAdmin(req,res,session))return; const b=await body(req),t=(db.kegTransfers||[]).find(x=>x.id===String(b.id||'')); if(t&&t.status==='Очікує підтвердження складу'){t.status='Відхилено складом';t.statusUpdatedMs=nowMs();t.rejectedAt=warsawTime();writeDb(db);} return redirect(res,'/admin-kegs'); }
  if(req.method==='GET' && url.pathname==='/admin-kegs/shop'){ if(!requireAdmin(req,res,session))return; return send(res,layout('Кеги магазину',adminKegShopEditPage(db,url,url.searchParams.get('ok')?'Зміни успішно збережено.':''),session)); }
  if(req.method==='POST' && url.pathname==='/admin-kegs/transfer'){ if(!requireAdmin(req,res,session))return; const b=await body(req),fromShop=String(b.fromShop||''),toShop=String(b.toShop||''),comment=String(b.comment||'').trim(); if(!fromShop||!toShop||fromShop===toShop)return redirect(res,'/admin-kegs/shop?shop='+encodeURIComponent(fromShop)); db.kegAdjustments=Array.isArray(db.kegAdjustments)?db.kegAdjustments:[]; let changed=false; for(const t of activeKegTypes(db)){const q=intQty(b['move_'+t.id]); if(q===null||q<0)continue; const available=shopKegBalance(db,fromShop,t.id); if(q>available)return send(res,layout('Кеги магазину',adminKegShopEditPage(db,new URL('http://x/admin-kegs/shop?shop='+encodeURIComponent(fromShop)),`Для ${t.name} доступно лише ${available}.`),session),400); if(q>0){const now=nowMs(),base={productId:String(t.id),name:t.name,createdAt:warsawTime(),createdMs:now,reason:comment||'Переміщення між магазинами'}; db.kegAdjustments.push({...base,id:String(now)+'_out_'+crypto.randomBytes(3).toString('hex'),shop:fromShop,relatedShop:toShop,delta:-q,type:'transfer_out'}); db.kegAdjustments.push({...base,id:String(now)+'_in_'+crypto.randomBytes(3).toString('hex'),shop:toShop,relatedShop:fromShop,delta:q,type:'transfer_in'}); changed=true;}} if(changed)writeDb(db); return redirect(res,'/admin-kegs/shop?shop='+encodeURIComponent(fromShop)+'&ok=1'); }
  if(req.method==='POST' && url.pathname==='/admin-kegs/set-balance'){ if(!requireAdmin(req,res,session))return; const b=await body(req),shop=String(b.shop||''),comment=String(b.comment||'').trim(); db.kegAdjustments=Array.isArray(db.kegAdjustments)?db.kegAdjustments:[]; let changed=false; for(const t of activeKegTypes(db)){const target=intQty(b['set_'+t.id]); if(target===null)continue; const current=shopKegBalance(db,shop,t.id),delta=target-current; if(delta!==0){const now=nowMs();db.kegAdjustments.push({id:String(now)+'_set_'+crypto.randomBytes(3).toString('hex'),shop,productId:String(t.id),name:t.name,delta,type:'manual_set',reason:comment||'Ручне коригування',createdAt:warsawTime(),createdMs:now});changed=true;}} if(changed)writeDb(db); return redirect(res,'/admin-kegs/shop?shop='+encodeURIComponent(shop)+'&ok=1'); }
  if(req.method==='GET' && url.pathname==='/admin-kegs'){ if(!requireAdmin(req,res,session))return; return send(res,layout('Облік кег',adminKegsPage(db,url),session)); }
  if(req.method==='GET' && url.pathname==='/admin-keg-types'){ if(!requireAdmin(req,res,session))return; return send(res,layout('Список кег',adminKegTypesPage(db),session)); }
  if(req.method==='POST' && url.pathname==='/admin-keg-types/toggle'){ if(!requireAdmin(req,res,session))return; const b=await body(req),p=db.products.find(x=>String(x.id)===String(b.id||'')); if(p){p.isReturnableKeg=!p.isReturnableKeg;writeDb(db);}return redirect(res,'/admin-keg-types'); }
  if(req.method==='POST' && url.pathname==='/admin-keg-types/add'){ if(!requireAdmin(req,res,session))return; const b=await body(req),name=String(b.name||'').trim(); if(name&&!db.kegTypes.some(k=>k.name.toLowerCase()===name.toLowerCase()))db.kegTypes.push({id:String(nowMs()),name,order:db.kegTypes.length+1,active:true});writeDb(db);return redirect(res,'/admin-keg-types'); }
  if(req.method==='POST' && url.pathname==='/admin-keg-types/update'){ if(!requireAdmin(req,res,session))return; const b=await body(req),k=db.kegTypes.find(x=>x.id===String(b.id||'')); if(k){const name=String(b.name||'').trim();if(name)k.name=name;k.order=Math.max(1,parseInt(b.order||'1',10)||1);k.active=String(b.active||'')==='1';writeDb(db);}return redirect(res,'/admin-keg-types'); }
  if(req.method==='GET' && url.pathname==='/admin-kegs/balances-export'){ if(!isWarehouse(session))return redirect(res,'/'); const xlsx=kegBalancesXlsx(db); res.writeHead(200,{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':contentDispositionXlsx(`kegi-na-obliku-magaziniv_${exportFileDate()}.xlsx`),'Cache-Control':'no-store'}); return res.end(xlsx); }
  if(req.method==='GET' && url.pathname==='/admin-kegs/export'){ if(!isWarehouse(session))return redirect(res,'/'); const xlsx=kegReportXlsx(db,url); res.writeHead(200,{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':contentDispositionXlsx(`oblik-keg_${exportFileDate()}.xlsx`),'Cache-Control':'no-store'}); return res.end(xlsx); }
  if(req.method==='GET' && url.pathname==='/cabinet'){ if(!requireShop(req,res,session)) return; return send(res, layout('Кабінет магазину', shopCabinetPage(db, session), session)); }
  if(req.method==='GET' && url.pathname==='/catalog'){
    if(!requireShop(req,res,session)) return;
    const cat=url.searchParams.get('cat');
    const onlyNew=url.searchParams.get('new')==='1';
    if(onlyNew && (session.shop || session.admin)){ markRead(db, session, 'newProducts'); db=readDb(); }
    const products=db.products.filter(p=>!p.hidden&&(!cat||p.category===cat)&&(!onlyNew||p.isNew));
    const unread=unreadCounts(db, session);
    return send(res, layout('Каталог', `
<a class="floatingCartButton" href="/cart" aria-label="Відкрити кошик" title="Кошик">🛒<span class="floatingCartCount" data-cart-count>${(session.cart||[]).reduce((a,i)=>a+Number(i.qty||0),0)}</span></a>
<div class="layout2">
  <aside class="card side catSideNew">
    <div class="catSideHead">
      <a href="/catalog" class="catAllLink ${!cat&&!onlyNew?'catAllActive':''}">
        <span class="catAllIcon">🛍️</span>
        <span class="catAllLabel">Усі товари</span>
        <span class="catAllCount">${db.products.filter(p=>!p.hidden).length}</span>
      </a>
      <a href="/catalog?new=1" class="catNewLink ${onlyNew?'catNewActive':''}">
        <span class="catAllIcon" style="background:rgba(124,58,237,.08);display:flex;align-items:center;justify-content:center">${NEW_SVG_ICON}</span>
        <span class="catAllLabel">Новинки${badge(unread.newProducts)}</span>
        <span class="catNewCnt">${db.products.filter(p=>!p.hidden&&p.isNew).length}</span>
      </a>
    </div>
    <div class="catGridNew">
      ${CATEGORIES.map((c,i)=>`
      <a href="/catalog?cat=${encodeURIComponent(c)}" class="catCardNew ${cat===c?'catCardActive':''}">
        <span class="catIconNew" style="background:${CAT_COLORS[i]}12;box-shadow:0 3px 10px ${CAT_COLORS[i]}28,inset 0 1px 0 rgba(255,255,255,.75)">${CAT_SVG_ICONS[c]||CAT_ICONS[c]||'▣'}</span>
        <span class="catCardLbl">${esc(c)}</span>
        <span class="catCardCnt">${db.products.filter(p=>!p.hidden&&p.category===c).length}</span>
      </a>`).join('')}
    </div>
    <div class="catSearch">
      <span class="catSearchIcon">🔍</span>
      <input id="search" oninput="filterProducts()" placeholder="Пошук товарів...">
    </div>
  </aside>
  <section>
    <div class="catalogHeader">
      <h1 class="catalogTitle">${onlyNew?'Новинки':(cat?esc(cat):'Каталог товарів')}</h1>
      <div class="catalogControls">
        <a class="btn secondary mobileCabinetShortcut" href="/cabinet">Кабінет магазину</a>
        <div class="viewToggle">
          <button class="viewBtn" data-view="list" onclick="setView('list')" title="Список">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          </button>
          <button class="viewBtn" data-view="grid" onclick="setView('grid')" title="Сітка">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
          </button>
        </div>
        ${session.cart&&session.cart.length?`<a class="btn cartGoto" href="/cart">🛒 Кошик (${session.cart.reduce((a,i)=>a+Number(i.qty||0),0)})</a>`:''}
      </div>
    </div>
    <div id="prodGrid" class="prodGrid" style="display:none">${products.map(p=>productCard(p,session)).join('')}</div>
    <div id="prodList"><div class="listWrap catalogListWrap"><table class="listTable catalogListTable"><thead><tr><th>№</th><th>Назва</th><th class="weightHead">Кількість/вага</th><th>К-сть</th></tr></thead><tbody>${products.map((p,n)=>productRow(p,session,n+1)).join('')}</tbody></table></div></div>
    ${!products.length?`<div class="card center" style="padding:36px"><p class="muted">У цій категорії немає товарів</p><a class="btn secondary" href="/catalog">Усі товари</a></div>`:''}
  </section>
</div>`, session));
  }
  if(req.method==='POST' && url.pathname==='/cart/add'){ if(!requireShop(req,res,session)) return; const b=await body(req); const p=db.products.find(x=>String(x.id)===String(b.id)&&!x.hidden); let itemQty=0; if(p){ const item=session.cart.find(x=>String(x.id)===String(p.id)); if(item)item.qty++; else session.cart.push({...copyProductFields(p), qty:1}); itemQty=(session.cart.find(x=>String(x.id)===String(p.id))||{}).qty||0; saveCart(session); } const count=session.cart.reduce((a,i)=>a+Number(i.qty||0),0); if(req.headers['x-requested-with']==='fetch'){ res.writeHead(200, {'Content-Type':'application/json; charset=utf-8'}); return res.end(JSON.stringify({ok:true,count,positions:session.cart.length,id:String(b.id),itemQty,result:productResultText(p,itemQty)})); } return redirect(res, req.headers.referer || '/catalog'); }
  if(req.method==='GET' && url.pathname==='/cart'){ if(!requireShop(req,res,session)) return; ensureOrderNumbers(db); const totalQty=session.cart.reduce((a,i)=>a+Number(i.qty||0),0); const historyHtml=shopOrderHistoryHtml(db, session.shop); return send(res, layout('Кошик', `<div class="actions" style="align-items:center;justify-content:space-between;margin-bottom:12px"><h1 style="margin:0">Кошик</h1><a class="btn secondary" href="/catalog">Продовжити покупки</a></div><div data-cart-page>${session.cart.length?`<div class="cartSummary"><div><b>Ваше замовлення</b><div class="muted">У кошику <span data-cart-summary-total>${totalQty}</span> шт. · <span data-cart-summary-positions>${session.cart.length}</span> позицій</div></div><a class="btn" href="/checkout">Оформити замовлення</a></div><div class="listWrap"><table class="listTable cartTable"><thead><tr><th>№</th><th>Назва</th><th>К-сть</th><th>×</th></tr></thead><tbody>${session.cart.map((i,n)=>`<tr data-cart-row="${i.id}"><td class="num">${n+1}</td><td class="mainCell"><span class="name">${esc(productDisplayName(i))}</span><span class="mobileMeta"><span class="cartTotalBadge" data-item-result="${i.id}">${esc(productResultText(i,i.qty))}</span>${productMetaText(i)?`<span class="cartDepositBadge">кауція</span>`:""}</span></td><td class="qtyCell"><form class="listQty" method="post" action="/cart/qty" data-ajax-cart data-action="qty" onsubmit="event.preventDefault(); return changeQty(this)"><input type="hidden" name="id" value="${i.id}"><input type="hidden" name="delta" value="0"><button type="button" onclick="changeQty(this.form,-1)" class="secondary iconBtn minusBtn" aria-label="Мінус">−</button><div class="qtynum" data-row-qty>${i.qty}</div><button type="button" onclick="changeQty(this.form,1)" class="iconBtn" aria-label="Додати">+</button></form></td><td class="deleteCell"><form method="post" action="/cart/remove" data-ajax-cart data-action="remove" onsubmit="event.preventDefault(); return removeCart(this)"><input type="hidden" name="id" value="${i.id}"><button class="deleteIcon" aria-label="Видалити">×</button></form></td></tr>`).join('')}</tbody></table></div><form method="post" action="/cart/clear" data-ajax-cart data-action="clear" onsubmit="event.preventDefault(); return clearCart(this)" style="margin-top:10px"><button class="secondary">Очистити кошик</button></form>`:'<section class="card center"><p>Кошик порожній</p><a class="btn" href="/catalog">До каталогу</a></section>'}</div>${historyHtml}`, session)); }
  if(req.method==='POST' && url.pathname==='/cart/qty'){ if(!requireShop(req,res,session)) return; const b=await body(req); const item=session.cart.find(x=>String(x.id)===String(b.id)); if(item){item.qty+=Number(b.delta||0); if(item.qty<1) session.cart=session.cart.filter(x=>String(x.id)!==String(b.id));} saveCart(session); const count=session.cart.reduce((a,i)=>a+Number(i.qty||0),0); const itemQty=(session.cart.find(x=>String(x.id)===String(b.id))||{}).qty||0; if(req.headers['x-requested-with']==='fetch'){ res.writeHead(200, {'Content-Type':'application/json; charset=utf-8'}); return res.end(JSON.stringify({ok:true,count,positions:session.cart.length,id:String(b.id),itemQty,result:productResultText(item,itemQty)})); } return redirect(res,'/cart'); }
  if(req.method==='POST' && url.pathname==='/cart/remove'){ if(!requireShop(req,res,session)) return; const b=await body(req); session.cart=session.cart.filter(x=>String(x.id)!==String(b.id)); saveCart(session); const count=session.cart.reduce((a,i)=>a+Number(i.qty||0),0); if(req.headers['x-requested-with']==='fetch'){ res.writeHead(200, {'Content-Type':'application/json; charset=utf-8'}); return res.end(JSON.stringify({ok:true,count,positions:session.cart.length,id:String(b.id),itemQty:0})); } return redirect(res,'/cart'); }
  if(req.method==='POST' && url.pathname==='/cart/clear'){ if(!requireShop(req,res,session)) return; session.cart=[]; saveCart(session); if(req.headers['x-requested-with']==='fetch'){ res.writeHead(200, {'Content-Type':'application/json; charset=utf-8'}); return res.end(JSON.stringify({ok:true,count:0,positions:0,cleared:true})); } return redirect(res,'/cart'); }

  if(req.method==='GET' && url.pathname==='/cabinet/accounting'){ if(!requireShop(req,res,session)) return; return send(res, layout('Кабінет магазину — Журнал обліку', accountingPage(db, session), session)); }
  if(req.method==='GET' && url.pathname==='/accounting'){ if(!requireShop(req,res,session)) return; return redirect(res,'/cabinet/accounting'); }
  if(req.method==='GET' && url.pathname==='/accounting/edit'){ if(!requireShop(req,res,session)) return; return send(res, layout('Кабінет магазину — Редагування звіту', shopAccountingEditPage(db, session, url.searchParams.get('id')), session)); }
  if(req.method==='POST' && url.pathname==='/accounting/save'){ if(!requireShop(req,res,session)) return; const b=await body(req); db.accountingReports=Array.isArray(db.accountingReports)?db.accountingReports:[]; db.kegTypes=Array.isArray(db.kegTypes)?db.kegTypes:[]; db.kegReturns=Array.isArray(db.kegReturns)?db.kegReturns:[]; db.productBarcodes=Array.isArray(db.productBarcodes)?db.productBarcodes:[]; db.applications=Array.isArray(db.applications)?db.applications:[]; db.applicationLogs=Array.isArray(db.applicationLogs)?db.applicationLogs:[]; const date=String(b.date||todayIsoWarsaw()); const report=calcAccounting({id:String(nowMs())+'-'+Math.random().toString(36).slice(2,8), shop:session.shop, date, openingBalance:b.openingBalance, fiscalReport:b.fiscalReport, terminalClose:b.terminalClose, actualCash:b.actualCash, sentToOffice:b.sentToOffice, comment:String(b.comment||'').trim(), createdAt:warsawTime(), createdMs:nowMs()}); db.accountingReports.push(report); writeDb(db); return redirect(res,'/cabinet/accounting'); }
  if(req.method==='POST' && url.pathname==='/accounting/update'){ if(!requireShop(req,res,session)) return; const b=await body(req); db.accountingReports=Array.isArray(db.accountingReports)?db.accountingReports:[]; db.kegTypes=Array.isArray(db.kegTypes)?db.kegTypes:[]; db.kegReturns=Array.isArray(db.kegReturns)?db.kegReturns:[]; db.productBarcodes=Array.isArray(db.productBarcodes)?db.productBarcodes:[]; db.applications=Array.isArray(db.applications)?db.applications:[]; db.applicationLogs=Array.isArray(db.applicationLogs)?db.applicationLogs:[]; if(!canShopEditAccountingReport(db, session, b.id)) return redirect(res,'/cabinet/accounting'); const idx=db.accountingReports.findIndex(r=>String(r.id)===String(b.id)&&String(r.shop||'')===String(session.shop||'')); if(idx>=0){ const old=db.accountingReports[idx]; const report=calcAccounting({id:old.id, shop:old.shop, date:String(b.date||old.date||todayIsoWarsaw()), openingBalance:b.openingBalance, fiscalReport:b.fiscalReport, terminalClose:b.terminalClose, actualCash:b.actualCash, sentToOffice:b.sentToOffice, comment:String(b.comment||'').trim(), createdAt:old.createdAt||warsawTime(), createdMs:old.createdMs||nowMs(), updatedAt:warsawTime()}); db.accountingReports[idx]=report; writeDb(db); } return redirect(res,'/cabinet/accounting'); }
  if(req.method==='GET' && url.pathname==='/admin-accounting'){ if(!requireAdmin(req,res,session)) return; return send(res, layout('Склад — Журнал обліку', adminAccountingPage(db,url), session)); }
  if(req.method==='GET' && url.pathname==='/admin-accounting-view'){ if(!requireAdmin(req,res,session)) return; return send(res, layout('Склад — Звіт журналу', adminAccountingViewPage(db, url.searchParams.get('id')), session)); }
  if(req.method==='GET' && url.pathname==='/admin-accounting-edit'){ if(!requireAdmin(req,res,session)) return; return send(res, layout('Склад — Редагування звіту', adminAccountingEditPage(db, url.searchParams.get('id')), session)); }
  if(req.method==='POST' && url.pathname==='/admin-accounting-update'){ if(!requireAdmin(req,res,session)) return; const b=await body(req); db.accountingReports=Array.isArray(db.accountingReports)?db.accountingReports:[]; db.kegTypes=Array.isArray(db.kegTypes)?db.kegTypes:[]; db.kegReturns=Array.isArray(db.kegReturns)?db.kegReturns:[]; db.productBarcodes=Array.isArray(db.productBarcodes)?db.productBarcodes:[]; db.applications=Array.isArray(db.applications)?db.applications:[]; db.applicationLogs=Array.isArray(db.applicationLogs)?db.applicationLogs:[]; const idx=db.accountingReports.findIndex(r=>String(r.id)===String(b.id)); if(idx>=0){ const old=db.accountingReports[idx]; const report=calcAccounting({id:old.id, shop:String(b.shop||old.shop||''), date:String(b.date||old.date||todayIsoWarsaw()), openingBalance:b.openingBalance, fiscalReport:b.fiscalReport, terminalClose:b.terminalClose, actualCash:b.actualCash, sentToOffice:b.sentToOffice, comment:String(b.comment||'').trim(), createdAt:old.createdAt||warsawTime(), createdMs:old.createdMs||nowMs(), updatedAt:warsawTime()}); db.accountingReports[idx]=report; writeDb(db); return redirect(res,'/admin-accounting-view?id='+encodeURIComponent(report.id)); } return redirect(res,'/admin-accounting'); }
  if(req.method==='POST' && url.pathname==='/admin-accounting-delete'){ if(!requireAdmin(req,res,session)) return; const b=await body(req); db.accountingReports=Array.isArray(db.accountingReports)?db.accountingReports:[]; db.kegTypes=Array.isArray(db.kegTypes)?db.kegTypes:[]; db.kegReturns=Array.isArray(db.kegReturns)?db.kegReturns:[]; db.productBarcodes=Array.isArray(db.productBarcodes)?db.productBarcodes:[]; db.applications=Array.isArray(db.applications)?db.applications:[]; db.applicationLogs=Array.isArray(db.applicationLogs)?db.applicationLogs:[]; db.accountingReports=db.accountingReports.filter(r=>String(r.id)!==String(b.id)); writeDb(db); return redirect(res,'/admin-accounting'); }
  if(req.method==='GET' && url.pathname==='/admin-accounting-export'){ if(!requireAdmin(req,res,session)) return; const shop=url.searchParams.get('shop')||''; const from=url.searchParams.get('from')||''; const to=url.searchParams.get('to')||''; const discrepancy=url.searchParams.get('discrepancy')||''; const reports=accountingRows(db).filter(r=>(!shop||r.shop===shop)&&(!from||String(r.date)>=from)&&(!to||String(r.date)<=to)&&(!discrepancy||Math.abs(moneyNum(r.discrepancy))>0.009)); const xlsx=accountingXlsx(reports); res.writeHead(200, {'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':'attachment; filename="accounting-journal.xlsx"','Cache-Control':'no-store'}); return res.end(xlsx); }
  if(req.method==='GET' && url.pathname==='/admin-order-export'){ if(!requireAdmin(req,res,session)) return; ensureOrderNumbers(db); const id=url.searchParams.get('id')||''; const o=(db.orders||[]).find(x=>String(x.id)===String(id)); if(!o){ res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'}); return res.end('Order not found'); } const xlsx=orderXlsx(o); const no=String(o.orderNo||o.id||'order').replace(/[^0-9A-Za-z_-]+/g,'-'); res.writeHead(200, {'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="order-${no}.xlsx"`,'Cache-Control':'no-store'}); return res.end(xlsx); }
  if(req.method==='GET' && url.pathname==='/checkout'){ if(!requireShop(req,res,session)) return; if(!session.cart.length) return redirect(res,'/cart'); return send(res, layout('Оформлення', `<div class="layout2"><section class="card" style="padding:22px"><h1>Оформлення замовлення</h1><div class="shopNotice">Магазин: ${esc(session.shop)}</div><form class="form" method="post" action="/checkout"><label>Коментар<textarea name="comment" rows="5" placeholder="Необовʼязково"></textarea></label><button>Надіслати замовлення</button></form></section><aside class="card side"><h3>Ваше замовлення</h3>${session.cart.map(i=>`<p><b>${esc(productDisplayName(i))}</b><br>${esc(productResultText(i,i.qty))}</p>`).join('')}</aside></div>`, session)); }
  if(req.method==='POST' && url.pathname==='/checkout'){ if(!requireShop(req,res,session)) return; if(!session.cart.length) return redirect(res,'/cart'); const b=await body(req); const orderNo=nextOrderNumber(db); const orderItems=[...session.cart]; const order={id:String(nowMs()), orderNo, shop:session.shop, items:orderItems, kegItems:captureOrderKegItems(db,orderItems), comment:String(b.comment||'').trim(), status:'Нове', createdAt:warsawTime(), createdMs:nowMs()}; db.orders.push(order); session.cart=[]; db.carts=db.carts||{}; db.carts[cartKey(session)]=[]; writeDb(db); return send(res, layout('Замовлення прийнято', `<section class="card center" style="padding:40px"><h1>Замовлення №${orderNo} прийнято!</h1><p class="muted">Замовлення успішно надіслано</p><div class="actions checkoutDoneActions"><a class="btn checkoutDoneBtn" href="/catalog">Продовжити покупки</a><a class="btn secondary checkoutDoneBtn" href="/cart">Мої замовлення</a></div></section>`, session)); }
  if(req.method==='GET' && url.pathname==='/admin-login'){ if(session.admin) return redirect(res,'/admin'); return send(res, layout('Вхід у склад', adminLoginPage(), session)); }
  if(req.method==='POST' && url.pathname==='/admin-login'){ const b=await body(req); if(checkAdminPassword(db, b.password)){ session.admin=true; saveSession(session); return redirect(res,'/admin'); } return send(res, layout('Вхід у склад', adminLoginPage('Невірний пароль. Спробуйте ще раз.'), session), 401); }
  if(req.method==='GET' && url.pathname==='/admin-logout'){ session.admin=false; saveSession(session); return redirect(res,'/'); }
  if(req.method==='GET' && url.pathname==='/admin'){ if(!requireAdmin(req,res,session)) return; return send(res, layout('Кабінет складу', adminCabinetPage(db), session)); }
  if(req.method==='GET' && url.pathname==='/admin-orders'){ if(!requireAdmin(req,res,session)) return; ensureOrderNumbers(db); const orders=db.orders.slice().sort((a,b)=>(Number(b.id)||0)-(Number(a.id)||0)); return send(res, layout('Склад — Замовлення', `<div class="adminShell">${adminMenu()}<section><h1>Замовлення</h1>${orders.length?orders.map(o=>adminOrderCard(o,db.products)).join(''):'<div class="card center"><p class="muted">Замовлень поки немає</p></div>'}</section></div>`, session)); }
  if(req.method==='POST' && url.pathname==='/admin/order-status'){ if(!requireAdmin(req,res,session)) return; const b=await body(req); const o=db.orders.find(x=>String(x.id)===String(b.id)); if(o) o.status=String(b.status||'Нове'); writeDb(db); if(req.headers['x-requested-with']==='fetch'){ res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'}); return res.end(JSON.stringify({ok:true,html:adminOrderCard(o,db.products)})); } return redirect(res,'/admin-orders'); }
  if(req.method==='POST' && url.pathname==='/admin/order-delete'){ if(!requireAdmin(req,res,session)) return; const b=await body(req); db.orders=db.orders.filter(x=>String(x.id)!==String(b.id)); writeDb(db); if(req.headers['x-requested-with']==='fetch'){ res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'}); return res.end(JSON.stringify({ok:true,removed:true})); } return redirect(res,'/admin-orders'); }
  if(req.method==='POST' && url.pathname==='/admin/order-items-apply'){ if(!requireAdmin(req,res,session)) return; const b=await body(req); const o=db.orders.find(x=>String(x.id)===String(b.id)); if(o){ try{ const items=JSON.parse(String(b.itemsJson||'[]')); o.items=items.map(i=>{ const old=(o.items||[]).find(x=>String(x.id)===String(i.id||'')); const category=String(i.category||''); const hasDeposit=!!(old&&old.hasDeposit)&&canHaveDeposit(category); return {id:String(i.id||''),name:String(i.name||''),category,weight:String(i.weight||''),qty:Math.max(1,Number(i.qty||1)),resultUnit:normalizeUnit((old&&old.resultUnit)||i.resultUnit),packUnit:normalizeUnit((old&&old.packUnit)||i.packUnit||i.resultUnit),hasDeposit}; }); o.kegItems=captureOrderKegItems(db,o.items); writeDb(db); } catch(e){} } if(req.headers['x-requested-with']==='fetch'){ res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'}); return res.end(JSON.stringify({ok:true,html:o?adminOrderCard(o,db.products):''})); } return redirect(res,'/admin-orders'); }
  if(req.method==='POST' && url.pathname==='/admin/order-item-add'){ if(!requireAdmin(req,res,session)) return; const b=await body(req); const o=db.orders.find(x=>String(x.id)===String(b.id)); if(o){ const p=db.products.find(x=>String(x.id)===String(b.productId)); if(p){ const qty=Math.max(1,Number(b.qty||1)); const exist=o.items&&o.items.find(i=>String(i.id)===String(p.id)); if(exist)exist.qty+=qty; else { o.items=o.items||[]; o.items.push({...copyProductFields(p),qty}); } o.kegItems=captureOrderKegItems(db,o.items); writeDb(db); } } if(req.headers['x-requested-with']==='fetch'){ res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'}); return res.end(JSON.stringify({ok:true,html:o?adminOrderCard(o,db.products):''})); } return redirect(res,'/admin-orders'); }
  if(req.method==='GET' && url.pathname==='/admin-hidden-products'){ if(!requireAdmin(req,res,session)) return; return send(res, layout('Склад — Приховані позиції', adminHiddenProductsPage(db), session)); }


  if(req.method==='GET' && url.pathname==='/admin-applications/product-search'){ if(!requireAdmin(req,res,session))return; const q=normalizeSearchText(url.searchParams.get('q')||''),tokens=q.split(/\s+/).filter(Boolean),category=String(url.searchParams.get('category')||'').trim(); const products=(db.products||[]).filter(p=>!p.hidden).filter(p=>!category||String(p.category||'')===category).filter(p=>{if(!tokens.length)return true;const hay=normalizeSearchText([p.name,p.category,p.weight,p.resultUnit,p.packUnit].filter(Boolean).join(' '));return tokens.every(t=>hay.includes(t))}).slice(0,200).map(p=>({id:String(p.id),name:String(p.name||''),category:String(p.category||''),unit:appUnitFromProduct(p)})); return jsonReply(res,{ok:true,products,total:products.length}); }
  if(req.method==='GET' && url.pathname==='/admin-applications/products'){ if(!requireAdmin(req,res,session))return; const products=(db.products||[]).filter(p=>!p.hidden).map(p=>({id:String(p.id),name:String(p.name||''),category:String(p.category||''),unit:appUnitFromProduct(p),weight:String(p.weight||''),resultUnit:String(p.resultUnit||''),packUnit:String(p.packUnit||'')})); return jsonReply(res,{ok:true,products}); }
  if(req.method==='GET' && url.pathname==='/admin-applications'){ if(!requireAdmin(req,res,session))return; return send(res,layout('Нова заявка',applicationsPage(db,url),session)); }
  if(req.method==='POST' && url.pathname==='/admin-applications/create'){ if(!requireAdmin(req,res,session))return; const b=await body(req),shop=findShopById(db,b.shopId); if(!shop)return redirect(res,'/admin-applications'); const app={id:appUid('app'),number:nextAppNumber(db),shopId:shop.id,shopName:shop.name,status:'in_progress',createdBy:'admin',createdAt:warsawTime(),updatedAt:warsawTime(),unlinkedBarcodes:[],pallets:[{id:appUid('pallet'),number:'1',status:'in_progress',createdAt:warsawTime(),items:[],scanHistory:[]}]}; db.applications.push(app);appLog(db,app,'created',shop.name);writeDb(db);return redirect(res,'/admin-applications?id='+encodeURIComponent(app.id)); }
  if(req.method==='POST' && url.pathname==='/admin-applications/scan'){ if(!requireAdmin(req,res,session))return; const b=await body(req),app=getApplication(db,b.applicationId),p=getActivePallet(app),code=cleanBarcode(b.barcode); if(!app||!p||['completed','cancelled'].includes(app.status))return jsonReply(res,{ok:false,error:'Немає активної заявки або палети'},400); if(!code)return jsonReply(res,{ok:false,error:'Порожній штрихкод'},400); if((p.scanHistory||[]).some(x=>x.clientScanId===String(b.clientScanId)))return jsonReply(res,{ok:true,html:appItemsHtml(app),message:'Сканування вже враховано'}); const bind=findBarcode(db,code); if(!bind){ app.unlinkedBarcodes=Array.isArray(app.unlinkedBarcodes)?app.unlinkedBarcodes:[]; let u=app.unlinkedBarcodes.find(x=>x.barcode===code&&!x.resolved); if(!u)app.unlinkedBarcodes.push({id:appUid('unlinked'),barcode:code,createdAt:warsawTime(),resolved:false}); app.updatedAt=warsawTime(); writeDb(db); return jsonReply(res,{ok:true,unknown:true}); } const product=appProduct(db,bind.productId); if(!product)return jsonReply(res,{ok:false,error:'Товар не знайдено'},404); const rawUnit=String(product.resultUnit||product.packUnit||'').toLowerCase(),variableWeight=rawUnit==='kg'||rawUnit==='g'; let exactWeight=Number(String(b.exactWeight||'').replace(',','.')); if(variableWeight&&!exactWeight)return jsonReply(res,{ok:true,needsWeight:true,productName:product.name,inputUnit:'кг'}); if(variableWeight&&(!Number.isFinite(exactWeight)||exactWeight<=0))return jsonReply(res,{ok:false,error:'Некоректна вага'},400); if(variableWeight&&rawUnit==='g')exactWeight=exactWeight/1000; p.items=Array.isArray(p.items)?p.items:[];p.scanHistory=Array.isArray(p.scanHistory)?p.scanHistory:[];let item=p.items.find(i=>i.barcode===code); const was=!!item; if(!item){item={id:appUid('item'),productId:product.id,productName:product.name,barcode:code,unitType:variableWeight?'кілограми':(bind.unitType||appUnitFromProduct(product)),unitsPerScan:variableWeight?0:Number(bind.unitsPerScan||appProductAmount(product)),variableWeight,quantity:0,totalUnits:0};p.items.push(item)}item.quantity+=1;const amount=variableWeight?exactWeight:item.unitsPerScan;item.totalUnits=Math.round((Number(item.totalUnits||0)+amount)*1000)/1000;p.scanHistory.push({id:appUid('scan'),itemId:item.id,clientScanId:String(b.clientScanId),amount,createdAt:warsawTime()});app.updatedAt=warsawTime();appLog(db,app,'scan',code+(variableWeight?' · '+exactWeight+' кг':''));writeDb(db);return jsonReply(res,{ok:true,html:appItemsHtml(app),message:variableWeight?'Вагу товару збережено':(was?'Кількість збільшено':'Товар додано')}); }
  if(req.method==='POST' && url.pathname==='/admin-applications/bind'){ if(!requireAdmin(req,res,session))return; const b=await body(req),app=getApplication(db,b.applicationId),p=getActivePallet(app),code=cleanBarcode(b.barcode),product=appProduct(db,b.productId); if(!app||!p||!product||!code)return jsonReply(res,{ok:false,error:'Некоректні дані'},400); if(findBarcode(db,code))return jsonReply(res,{ok:false,error:'Цей штрихкод уже належить іншому товару'},409); const productUnit=appUnitFromProduct(product), productAmount=appProductAmount(product); db.productBarcodes.push({id:appUid('barcode'),productId:product.id,barcode:code,barcodeType:'auto',unitType:productUnit,unitsPerScan:productAmount,createdAt:warsawTime(),updatedAt:warsawTime(),createdBy:'admin'}); const item={id:appUid('item'),productId:product.id,productName:product.name,barcode:code,unitType:productUnit,unitsPerScan:productAmount,quantity:1,totalUnits:productAmount};p.items.push(item);p.scanHistory.push({id:appUid('scan'),itemId:item.id,clientScanId:appUid('bind'),createdAt:warsawTime()});app.unlinkedBarcodes=(app.unlinkedBarcodes||[]).map(x=>x.barcode===code?{...x,resolved:true,resolvedAt:warsawTime(),productId:product.id}:x);appLog(db,app,'barcode_bound',code+' -> '+product.name);writeDb(db);return jsonReply(res,{ok:true,html:appItemsHtml(app)}); }
  if(req.method==='POST' && url.pathname==='/admin-applications/manual-add'){ if(!requireAdmin(req,res,session))return; const b=await body(req),app=getApplication(db,b.applicationId),p=getActivePallet(app),product=appProduct(db,b.productId),value=Number(String(b.value||'').replace(',','.')); if(!app||!p||!product)return jsonReply(res,{ok:false,error:'Некоректні дані'},400); if(!Number.isFinite(value)||value<=0)return jsonReply(res,{ok:false,error:'Вкажіть правильну кількість, вагу або обсяг'},400); const unitType=appUnitFromProduct(product),manualMeasure=['кілограми','літри','мл'].includes(unitType); if(['штуки','кеги'].includes(unitType)&&!Number.isInteger(value))return jsonReply(res,{ok:false,error:'Для штук або кег вкажіть цілу кількість'},400); const existing=(p.items||[]).find(i=>String(i.productId)===String(product.id)&&i.manualEntry&&!cleanBarcode(i.barcode)); if(existing){if(manualMeasure){existing.totalUnits=Math.round((Number(existing.totalUnits||0)+value)*1000)/1000;existing.quantity=1;}else{existing.quantity=Number(existing.quantity||0)+value;existing.totalUnits=existing.quantity;}}else{p.items.push({id:appUid('item'),productId:product.id,productName:product.name,barcode:'',unitType,unitsPerScan:1,quantity:manualMeasure?1:value,totalUnits:Math.round(value*1000)/1000,variableWeight:unitType==='кілограми',manualMeasure,manualEntry:true});} app.updatedAt=warsawTime();appLog(db,app,'manual_item_added',product.name+' · '+value+' '+unitType);writeDb(db);return jsonReply(res,{ok:true,html:appItemsHtml(app)}); }
  if(req.method==='POST' && url.pathname==='/admin-applications/item-barcode-delete'){ if(!requireAdmin(req,res,session))return; const b=await body(req),app=getApplication(db,b.applicationId),p=getActivePallet(app),item=p&&(p.items||[]).find(i=>String(i.id)===String(b.itemId)); if(!app||!p||!item)return jsonReply(res,{ok:false,error:'Позицію не знайдено'},404); const code=cleanBarcode(item.barcode); if(!code)return jsonReply(res,{ok:false,error:'У цієї позиції немає штрихкоду'},400); db.productBarcodes=(db.productBarcodes||[]).filter(x=>cleanBarcode(x.barcode)!==code); item.barcode=''; item.manualEntry=true; (p.scanHistory||[]).forEach(scan=>{if(String(scan.itemId)===String(item.id))scan.barcode=''}); app.updatedAt=warsawTime(); appLog(db,app,'item_barcode_deleted',code+' · '+item.productName); writeDb(db); return jsonReply(res,{ok:true,html:appItemsHtml(app)}); }
  if(req.method==='POST' && url.pathname==='/admin-applications/item-barcode-replace'){ if(!requireAdmin(req,res,session))return; const b=await body(req),app=getApplication(db,b.applicationId),p=getActivePallet(app),item=p&&(p.items||[]).find(i=>String(i.id)===String(b.itemId)),code=cleanBarcode(b.newBarcode); if(!app||!p||!item||!code)return jsonReply(res,{ok:false,error:'Некоректні дані'},400); if(code===cleanBarcode(item.barcode))return jsonReply(res,{ok:false,error:'Новий штрихкод збігається з поточним'},400); const existing=findBarcode(db,code); if(existing&&String(existing.productId)!==String(item.productId))return jsonReply(res,{ok:false,error:'Цей штрихкод уже прив’язаний до іншого товару'},409); const product=appProduct(db,item.productId); if(!product)return jsonReply(res,{ok:false,error:'Товар не знайдено в системі'},404); if(existing){existing.unitType=appUnitFromProduct(product);existing.unitsPerScan=appProductAmount(product);existing.updatedAt=warsawTime();}else{db.productBarcodes.push({id:appUid('barcode'),productId:product.id,barcode:code,barcodeType:'auto',unitType:appUnitFromProduct(product),unitsPerScan:appProductAmount(product),createdAt:warsawTime(),updatedAt:warsawTime(),createdBy:'admin'});} const oldCode=item.barcode; item.barcode=code; (p.scanHistory||[]).forEach(scan=>{if(String(scan.itemId)===String(item.id))scan.barcode=code}); app.updatedAt=warsawTime(); appLog(db,app,'item_barcode_replaced',String(oldCode||'')+' -> '+code+' · '+item.productName); writeDb(db); return jsonReply(res,{ok:true,html:appItemsHtml(app)}); }
  if(req.method==='POST' && url.pathname==='/admin-applications/rebind'){ if(!requireAdmin(req,res,session))return; const b=await body(req),app=getApplication(db,b.applicationId),p=getActivePallet(app),item=p&&(p.items||[]).find(i=>String(i.id)===String(b.itemId)),product=appProduct(db,b.productId),code=cleanBarcode(b.barcode); if(!app||!p||!item||!product||!code)return jsonReply(res,{ok:false,error:'Некоректні дані'},400); if(cleanBarcode(item.barcode)!==code)return jsonReply(res,{ok:false,error:'Штрихкод позиції змінився. Оновіть сторінку і повторіть дію'},409); if(String(item.productId)===String(product.id))return jsonReply(res,{ok:false,error:'Цей штрихкод уже прив’язаний до вибраного товару'},409); const previousProductName=item.productName||''; const binding=findBarcode(db,code); if(binding){binding.productId=product.id;binding.unitType=appUnitFromProduct(product);binding.unitsPerScan=appProductAmount(product);binding.updatedAt=warsawTime()}else{db.productBarcodes.push({id:appUid('barcode'),productId:product.id,barcode:code,barcodeType:'auto',unitType:appUnitFromProduct(product),unitsPerScan:appProductAmount(product),createdAt:warsawTime(),updatedAt:warsawTime(),createdBy:'admin'})} const rawUnit=String(product.resultUnit||product.packUnit||'').toLowerCase(),variableWeight=rawUnit==='kg'||rawUnit==='g'; item.productId=product.id;item.productName=product.name;item.unitType=variableWeight?'кілограми':appUnitFromProduct(product);item.unitsPerScan=variableWeight?0:appProductAmount(product);item.variableWeight=variableWeight;if(!variableWeight)item.totalUnits=Math.round(Number(item.quantity||0)*Number(item.unitsPerScan||1)*1000)/1000;app.updatedAt=warsawTime();appLog(db,app,'barcode_rebound',code+' · '+previousProductName+' -> '+product.name);writeDb(db);return jsonReply(res,{ok:true,html:appItemsHtml(app)}); }
  if(req.method==='POST' && url.pathname==='/admin-applications/item-edit'){ if(!requireAdmin(req,res,session))return; const b=await body(req),app=getApplication(db,b.applicationId),p=getActivePallet(app),item=p&&(p.items||[]).find(i=>String(i.id)===String(b.itemId)); if(!item)return jsonReply(res,{ok:false,error:'Позицію не знайдено'},404); const q=Number(String(b.quantity||'').replace(',','.')),total=Number(String(b.totalUnits||'').replace(',','.')),code=cleanBarcode(b.barcode); if(!Number.isFinite(q)||q<=0)return jsonReply(res,{ok:false,error:'Некоректна кількість'},400); if(!code&&!item.manualEntry)return jsonReply(res,{ok:false,error:'Вкажіть коректний штрихкод'},400); const existing=code?findBarcode(db,code):null; if(existing&&String(existing.productId)!==String(item.productId))return jsonReply(res,{ok:false,error:'Цей штрихкод уже прив’язаний до іншого товару'},409); if(item.variableWeight||item.manualMeasure){if(!Number.isFinite(total)||total<=0)return jsonReply(res,{ok:false,error:'Некоректна вага або обсяг'},400);item.quantity=q;item.totalUnits=Math.round(total*1000)/1000;}else{if(!Number.isFinite(total)||total<=0)return jsonReply(res,{ok:false,error:'Некоректна кількість'},400);if((String(item.unitType||'').toLowerCase()==='штуки'||String(item.unitType||'').toLowerCase()==='кеги')&&!Number.isInteger(total))return jsonReply(res,{ok:false,error:'Кількість повинна бути цілим числом'},400);item.quantity=q;item.totalUnits=Math.round(total*1000)/1000;} if(code&&code!==cleanBarcode(item.barcode)){const product=appProduct(db,item.productId);if(!product)return jsonReply(res,{ok:false,error:'Товар не знайдено в системі'},404);if(existing){existing.unitType=appUnitFromProduct(product);existing.unitsPerScan=appProductAmount(product);existing.updatedAt=warsawTime();}else{db.productBarcodes.push({id:appUid('barcode'),productId:product.id,barcode:code,barcodeType:'auto',unitType:appUnitFromProduct(product),unitsPerScan:appProductAmount(product),createdAt:warsawTime(),updatedAt:warsawTime(),createdBy:'admin'});}const oldCode=item.barcode;item.barcode=code;(p.scanHistory||[]).forEach(scan=>{if(String(scan.itemId)===String(item.id))scan.barcode=code});appLog(db,app,'item_barcode_replaced',String(oldCode||'')+' -> '+code+' · '+item.productName);} app.updatedAt=warsawTime();appLog(db,app,'item_edited',item.productName);writeDb(db);return jsonReply(res,{ok:true,html:appItemsHtml(app)}); }
  if(req.method==='POST' && ['/admin-applications/item-qty','/admin-applications/item-set','/admin-applications/item-delete'].includes(url.pathname)){ if(!requireAdmin(req,res,session))return; const b=await body(req),app=getApplication(db,b.applicationId),p=getActivePallet(app),item=p&&(p.items||[]).find(i=>String(i.id)===String(b.itemId)); if(!item)return jsonReply(res,{ok:false,error:'Позицію не знайдено'},404); if(url.pathname.endsWith('delete'))p.items=p.items.filter(i=>i!==item);else{const q=url.pathname.endsWith('item-set')?Number(b.quantity):Number(item.quantity)+Number(b.delta);if(!Number.isFinite(q)||q<0)return jsonReply(res,{ok:false,error:'Некоректна кількість'},400);if(q===0)p.items=p.items.filter(i=>i!==item);else{item.quantity=q;item.totalUnits=Math.round(q*item.unitsPerScan*1000)/1000}}appLog(db,app,'quantity_changed',item.productName);writeDb(db);return jsonReply(res,{ok:true,html:appItemsHtml(app)}); }
  if(req.method==='POST' && url.pathname==='/admin-applications/undo'){ if(!requireAdmin(req,res,session))return; const b=await body(req),app=getApplication(db,b.applicationId),p=getActivePallet(app),scan=p&&(p.scanHistory||[]).pop(); if(!scan)return jsonReply(res,{ok:false,error:'Немає сканувань для скасування'},400); const item=p.items.find(i=>i.id===scan.itemId);if(item){item.quantity--;item.totalUnits=Math.max(0,Math.round((Number(item.totalUnits||0)-Number(scan.amount!=null?scan.amount:item.unitsPerScan||0))*1000)/1000);if(item.quantity<=0)p.items=p.items.filter(i=>i!==item)}writeDb(db);return jsonReply(res,{ok:true,html:appItemsHtml(app)}); }
  if(req.method==='POST' && url.pathname==='/admin-applications/pallet-finish'){ if(!requireAdmin(req,res,session))return; const b=await body(req),app=getApplication(db,b.applicationId),p=getActivePallet(app);if(!p||(p.items||[]).length===0)return jsonReply(res,{ok:false,error:'Палета порожня'},400);p.status='completed';p.completedAt=warsawTime();writeDb(db);return jsonReply(res,{ok:true,html:appItemsHtml(app)}); }
  if(req.method==='POST' && url.pathname==='/admin-applications/pallet-new'){ if(!requireAdmin(req,res,session))return; const b=await body(req),app=getApplication(db,b.applicationId);if(!app)return jsonReply(res,{ok:false,error:'Заявку не знайдено'},404);const p=getActivePallet(app);if(p){if(!(p.items||[]).length)return jsonReply(res,{ok:false,error:'Поточна палета порожня'},400);p.status='completed';p.completedAt=warsawTime()}app.pallets.push({id:appUid('pallet'),number:String(app.pallets.length+1),status:'in_progress',createdAt:warsawTime(),items:[],scanHistory:[]});writeDb(db);return jsonReply(res,{ok:true,html:appItemsHtml(app)}); }
  if(req.method==='POST' && url.pathname==='/admin-applications/complete'){ if(!requireAdmin(req,res,session))return; const b=await body(req),app=getApplication(db,b.applicationId);if(!app)return jsonReply(res,{ok:false,error:'Заявку не знайдено'},404);if(!(app.pallets||[]).some(p=>(p.items||[]).length))return jsonReply(res,{ok:false,error:'Додайте хоча б один товар'},400);(app.pallets||[]).forEach(p=>{if((p.items||[]).length)p.status='completed'});app.status='completed';app.completedAt=warsawTime();app.updatedAt=warsawTime();app.kegItems=captureApplicationKegItems(db,app);appLog(db,app,'completed');writeDb(db);return jsonReply(res,{ok:true}); }
  if(req.method==='POST' && url.pathname==='/admin-applications/cancel'){ if(!requireAdmin(req,res,session))return; const b=await body(req),app=getApplication(db,b.applicationId);if(!app)return jsonReply(res,{ok:false,error:'Заявку не знайдено'},404);app.status='cancelled';app.updatedAt=warsawTime();appLog(db,app,'cancelled');writeDb(db);return jsonReply(res,{ok:true}); }
  { const m=url.pathname.match(/^\/admin-applications\/([^/]+)\/(print|pdf|xlsx)$/);if(req.method==='GET'&&m){if(!requireAdmin(req,res,session))return;const app=getApplication(db,decodeURIComponent(m[1]));if(!app)return notFound(res);if(m[2]==='xlsx'){const x=appXlsx(app);res.writeHead(200,{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':contentDispositionXlsx((app.number||'zayavka')+'.xlsx'),'Cache-Control':'no-store'});return res.end(x)}if(m[2]==='pdf'){try{const pdf=await appPdf(app);const filename='zayavka_'+String(app.number||app.id||'order').replace(/[^a-zA-Z0-9_-]+/g,'_')+'.pdf';res.writeHead(200,{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${filename}"`,'Content-Length':pdf.length,'Cache-Control':'no-store, no-cache, must-revalidate','Pragma':'no-cache','X-Content-Type-Options':'nosniff'});return res.end(pdf)}catch(error){console.error('[application-pdf]',error);return send(res,appPrint(app,true))}}return send(res,appPrint(app,url.searchParams.get('auto')==='1'));} }

  if(req.method==='GET' && url.pathname==='/admin-products-export'){ if(!requireAdmin(req,res,session)) return; const category=url.searchParams.get('cat')||''; if(!CATEGORIES.includes(category)){ res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'}); return res.end('Category not found'); } const products=(db.products||[]).filter(p=>!p.hidden && String(p.category||'')===category); const xlsx=productsCategoryXlsx(category, products); const filename=`${safeDownloadName(category)}_${exportFileDate()}.xlsx`; res.writeHead(200, {'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':contentDispositionXlsx(filename),'Cache-Control':'no-store'}); return res.end(xlsx); }
  if(req.method==='GET' && url.pathname==='/admin-new-products'){ if(!requireAdmin(req,res,session)) return; return send(res, layout('Склад — Новинки', adminNewProductsPage(db), session)); }
  if(req.method==='GET' && url.pathname==='/admin-products'){ if(!requireAdmin(req,res,session)) return; const cat=url.searchParams.get('cat')||''; return send(res, layout('Склад — Товари', `<div class="adminShell">${adminMenu()}<section class="adminProductsSection"><div class="actions" style="align-items:center;justify-content:space-between;margin-bottom:12px"><h1 style="margin:0">Товари</h1></div><div class="card adminProductAddCard" style="padding:16px;margin-bottom:16px"><form class="form adminProductAddForm" method="post" action="/admin/product-add"><label>Назва<input name="name" required placeholder="Напр. Пельмені Пузата Хата 900г 15 szt"></label><label>Кількість/вага<input name="weight" required type="number" min="0" step="0.001" placeholder="15"></label><label>Одиниця виміру<select name="resultUnit">${unitOptionsHtml('szt')}</select></label><label>Категорія<select name="category" onchange="toggleDepositCheckbox(this)">${CATEGORIES.map(c=>`<option value="${esc(c)}" ${c===cat?'selected':''}>${esc(c)}</option>`).join('')}</select></label><div class="adminProductAddActions"><label class="adminProductNewCheck" data-deposit-wrap><input type="checkbox" name="hasDeposit" value="1"> Кауція</label><label class="adminProductNewCheck"><input type="checkbox" name="isNew" value="1"> Новинка</label><button>Додати</button></div></form></div><div class="adminProductCats">${CATEGORIES.map(c=>`<span class="adminProductCatExport"><a class="btn ${cat===c?'':'secondary'}" href="/admin-products?cat=${encodeURIComponent(c)}">${CAT_ICONS[c]||''} ${esc(c)}</a>${categoryDownloadIcon(c)}</span>`).join('')}<span class="adminProductCatExport adminProductCatAll"><a class="btn ${!cat?'':'secondary'}" href="/admin-products">Усі</a><span class="categoryDownloadIcon categoryDownloadPlaceholder" aria-hidden="true">⬇️</span></span></div><div class="card adminSearchCard"><div class="adminSearchWrap"><span class="adminSearchIcon">🔎</span><input id="search" oninput="filterProducts()" placeholder="Пошук товарів..." autocomplete="off"></div><div id="searchEmpty" class="adminSearchEmpty">Нічого не знайдено</div></div><div class="listWrap adminProductsTableWrap"><table class="listTable adminProductsTable"><thead><tr><th>№</th><th>Назва</th><th class="weightHead">Кількість/вага</th><th>Кауція</th><th>Дія</th><th>Новинка</th><th>✏️</th><th>×</th></tr></thead><tbody>${db.products.filter(p=>!p.hidden&&(!cat||p.category===cat)).map((p,n)=>adminProductRow(p,n+1)).join('')}</tbody></table></div></section></div>`, session)); }
    if(req.method==='POST' && url.pathname==='/admin/product-add'){ if(!requireAdmin(req,res,session)) return; const b=await body(req); const name=String(b.name||'').trim(); const weight=String(b.weight||'').trim().replace(',','.'); const category=CATEGORIES.includes(String(b.category||''))?String(b.category):''; const resultUnit=normalizeUnit(b.resultUnit); if(name&&weight&&category){ const isNew=!!b.isNew; const prod=copyProductFields({id:nowMs(), name, category, weight, resultUnit, packUnit:resultUnit, hasDeposit:!!b.hasDeposit&&canHaveDeposit(category)}); db.products.push({...prod, isNew, newAt:isNew?nowMs():0, hidden:false}); writeDb(db); } return redirect(res, req.headers.referer||'/admin-products'); }
    if(req.method==='POST' && url.pathname==='/admin/product-delete'){ if(!requireAdmin(req,res,session)) return; const b=await body(req); db.products=db.products.filter(x=>String(x.id)!==String(b.id)); writeDb(db); return redirect(res, req.headers.referer||'/admin-products'); }
  if(req.method==='POST' && url.pathname==='/admin/product-toggle-hidden'){ if(!requireAdmin(req,res,session)) return; const b=await body(req); const p=db.products.find(x=>String(x.id)===String(b.id)); if(p) p.hidden=!p.hidden; writeDb(db); return redirect(res, req.headers.referer||'/admin-products'); }
  if(req.method==='POST' && url.pathname==='/admin/product-new'){ if(!requireAdmin(req,res,session)) return; const b=await body(req); const p=db.products.find(x=>String(x.id)===String(b.id)); if(p){ p.isNew=!p.isNew; p.newAt=p.isNew?nowMs():0; writeDb(db); } return redirect(res, req.headers.referer||'/admin-products'); }
  if(req.method==='POST' && url.pathname==='/admin/product-deposit'){ if(!requireAdmin(req,res,session)) return; const b=await body(req); const p=db.products.find(x=>String(x.id)===String(b.id)); if(p){ if(canHaveDeposit(p.category)){ p.hasDeposit=!p.hasDeposit; } else { p.hasDeposit=false; } p.displayWeight=productMetaText(p); writeDb(db); } return redirect(res, req.headers.referer||'/admin-products'); }
  if(req.method==='POST' && url.pathname==='/admin/product-update'){ if(!requireAdmin(req,res,session)) return; const b=await body(req); const p=db.products.find(x=>String(x.id)===String(b.id)); if(req.headers['x-requested-with']==='fetch'){ if(p){ const name=String(b.name||'').trim(); const weight=String(b.weight||'').trim().replace(',','.'); const resultUnit=normalizeUnit(b.resultUnit||p.resultUnit||p.packUnit); if(name&&weight){ const updated=copyProductFields({...p,name,weight,resultUnit,packUnit:resultUnit,hasDeposit:p.hasDeposit}); Object.assign(p, updated); if(db.carts){ Object.values(db.carts).forEach(cart=>{ if(Array.isArray(cart)){ cart.forEach(item=>{ if(String(item.id)===String(p.id)){ const qty=item.qty; Object.assign(item, updated); item.qty=qty; } }); } }); } writeDb(db); } } const n=db.products.indexOf(p)+1; res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'}); return res.end(JSON.stringify({ok:!!p, html:p?adminProductRow(p,n):''})); } return redirect(res, req.headers.referer||'/admin-products'); }
  if(req.method==='GET' && url.pathname==='/admin-notes'){ if(!requireAdmin(req,res,session)) return; db.notes=db.notes||[]; return send(res, layout('Нотатки', `<div class="adminShell">${adminMenu()}<section><h1>Нотатки</h1><div class="card" style="padding:20px;margin-bottom:16px"><form class="form" method="post" action="/admin/note-add"><label>Нова нотатка<textarea name="text" rows="4" required placeholder="Текст нотатки..."></textarea></label><button>Додати</button></form></div>${db.notes.slice().reverse().map(n=>`<div class="card noteCard"><div class="noteDate">${esc(n.createdAt||'')}</div><div class="noteText">${esc(n.text||'')}</div><form method="post" action="/admin/note-delete" style="margin-top:10px"><input type="hidden" name="id" value="${esc(n.id)}"><button class="danger">Видалити</button></form></div>`).join('')||'<div class="card center">Нотаток ще немає</div>'}</section></div>`, session)); }
  if(req.method==='POST' && url.pathname==='/admin/note-add'){ if(!requireAdmin(req,res,session)) return; const b=await body(req); const text=String(b.text||'').trim(); if(text){ db.notes=db.notes||[]; db.notes.push({id:String(nowMs()), text, createdAt:warsawTime()}); writeDb(db); } return redirect(res,'/admin-notes'); }
  if(req.method==='POST' && url.pathname==='/admin/note-delete'){ if(!requireAdmin(req,res,session)) return; const b=await body(req); db.notes=(db.notes||[]).filter(x=>String(x.id)!==String(b.id)); writeDb(db); return redirect(res,'/admin-notes'); }
  if(req.method==='GET' && url.pathname==='/admin-announcements'){ if(!requireAdmin(req,res,session)) return; db.announcements=db.announcements||[]; return send(res, layout('Оголошення', `<div class="adminShell">${adminMenu()}<section><h1>Оголошення</h1><div class="card" style="padding:20px;margin-bottom:16px"><form class="form" method="post" action="/admin/announcement-add"><label>Нове оголошення<textarea name="text" rows="4" required placeholder="Текст оголошення для магазинів..."></textarea></label><button>Опублікувати</button></form></div>${db.announcements.slice().reverse().map(a=>`<div class="card announcementCard"><div class="announcementDate">${esc(a.createdAt||'')}</div><div class="announcementText">${esc(a.text||'')}</div><form method="post" action="/admin/announcement-delete" style="margin-top:10px"><input type="hidden" name="id" value="${esc(a.id)}"><button class="danger">Видалити</button></form></div>`).join('')||'<div class="card center">Оголошень ще немає</div>'}</section></div>`, session)); }
  if(req.method==='POST' && url.pathname==='/admin/announcement-add'){ if(!requireAdmin(req,res,session)) return; const b=await body(req); const text=String(b.text||'').trim(); if(text){ db.announcements=db.announcements||[]; const t=nowMs(); db.announcements.push({id:String(t), text, createdAt:warsawTime(), createdMs:t}); writeDb(db); } return redirect(res,'/admin-announcements'); }
  if(req.method==='POST' && url.pathname==='/admin/announcement-delete'){ if(!requireAdmin(req,res,session)) return; const b=await body(req); db.announcements=(db.announcements||[]).filter(x=>String(x.id)!==String(b.id)); writeDb(db); return redirect(res,'/admin-announcements'); }
  if(req.method==='GET' && url.pathname==='/admin-settings'){ if(!requireAdmin(req,res,session)) return; const shops=getShops(db); const adminPasswordStatus=String(url.searchParams.get('adminPassword')||''); const adminPasswordMsg=adminPasswordStatus==='ok'?'<div class="successMsg" style="margin-bottom:12px">Пароль адмін-панелі успішно змінено.</div>':(adminPasswordStatus==='wrong'?'<div class="error" style="margin-bottom:12px">Поточний пароль введено неправильно.</div>':(adminPasswordStatus==='mismatch'?'<div class="error" style="margin-bottom:12px">Новий пароль і підтвердження не збігаються.</div>':(adminPasswordStatus==='short'?'<div class="error" style="margin-bottom:12px">Новий пароль має містити мінімум 8 символів.</div>':''))); return send(res, layout('Налаштування магазинів', `<div class="adminShell">${adminMenu()}<section><h1>Налаштування магазинів</h1><div class="card" style="padding:20px;margin-bottom:16px"><h2>Змінити пароль адмін-панелі</h2>${adminPasswordMsg}<form class="form" method="post" action="/admin/password-change" style="grid-template-columns:1fr 1fr 1fr auto;align-items:end;gap:10px"><label>Поточний пароль<input type="password" name="currentPassword" required placeholder="Поточний пароль" autocomplete="current-password"></label><label>Новий пароль<input type="password" name="newPassword" required minlength="8" placeholder="Новий пароль" autocomplete="new-password"></label><label>Підтвердження нового пароля<input type="password" name="confirmPassword" required minlength="8" placeholder="Повторіть пароль" autocomplete="new-password"></label><button>Змінити пароль</button></form></div><div class="card" style="padding:20px;margin-bottom:16px"><h2>Додати магазин</h2><form class="form" method="post" action="/admin/shop-add" style="grid-template-columns:1fr 1fr auto;align-items:end;gap:10px"><label>Назва<input name="name" required placeholder="Назва магазину"></label><label>Пароль<input name="password" required placeholder="Пароль" value="${esc(SHOP_PASSWORD)}"></label><button>Додати</button></form></div><div class="card" style="padding:20px"><h2>Список магазинів</h2><div class="shopSettingsGrid">${shops.map(shop=>`<div class="shopSettingRow"><span class="shopSettingName">${esc(shop.name)}</span><form method="post" action="/admin/shop-password"><input type="hidden" name="id" value="${esc(shop.id)}"><input name="password" required placeholder="Новий пароль" value="${esc(shop.password)}" style="width:140px;padding:6px 10px;border:1.5px solid var(--line);border-radius:9px;font-size:13px;font-family:inherit;outline:none"><button class="compactBtn secondary" style="white-space:nowrap">Змінити</button></form><form method="post" action="/admin/shop-delete" onsubmit="return confirm('Видалити магазин?')"><input type="hidden" name="id" value="${esc(shop.id)}"><button class="deleteIcon" title="Видалити" aria-label="Видалити магазин">×</button></form></div>`).join('')}</div></div></section></div>`, session)); }
  if(req.method==='POST' && url.pathname==='/admin/password-change'){ if(!requireAdmin(req,res,session)) return; const b=await body(req); const currentPassword=String(b.currentPassword||''); const newPassword=String(b.newPassword||''); const confirmPassword=String(b.confirmPassword||''); if(!checkAdminPassword(db, currentPassword)) return redirect(res,'/admin-settings?adminPassword=wrong'); if(newPassword.length<8) return redirect(res,'/admin-settings?adminPassword=short'); if(newPassword!==confirmPassword) return redirect(res,'/admin-settings?adminPassword=mismatch'); setAdminPassword(db, newPassword); writeDb(db); return redirect(res,'/admin-settings?adminPassword=ok'); }
  if(req.method==='POST' && url.pathname==='/admin/shop-add'){ if(!requireAdmin(req,res,session)) return; const b=await body(req); const name=String(b.name||'').trim(); const password=String(b.password||SHOP_PASSWORD).trim(); if(name&&password&&!getShops(db).find(s=>s.name===name)){ db.shops=getShops(db); db.shops.push({id:String(nowMs()), name, password}); writeDb(db); } return redirect(res,'/admin-settings'); }
  if(req.method==='POST' && url.pathname==='/admin/shop-password'){ if(!requireAdmin(req,res,session)) return; const b=await body(req); const shop=findShopById(db, b.id); if(shop){ shop.password=String(b.password||SHOP_PASSWORD).trim()||SHOP_PASSWORD; writeDb(db); } return redirect(res,'/admin-settings'); }
  if(req.method==='POST' && url.pathname==='/admin/shop-delete'){ if(!requireAdmin(req,res,session)) return; const b=await body(req); db.shops=getShops(db).filter(s=>String(s.id)!==String(b.id)); writeDb(db); return redirect(res,'/admin-settings'); }
  if(req.method==='GET' && url.pathname==='/admin-backup'){ if(!requireAdmin(req,res,session)) return; const wrong=url.searchParams.get('error')==='wrong'; return send(res, layout('Резервна копія', `<div class="adminShell">${adminMenu()}<section><div style="margin-bottom:14px"><a class="btn secondary" href="/admin">← Повернутись назад</a></div><h1>Резервна копія</h1><div class="card" style="padding:20px;max-width:620px"><h2 style="margin-top:0">Скачати базу даних</h2><p class="muted">База даних буде збережена одним файлом у форматі JSON. Для скачування введіть пароль.</p>${wrong?'<div class="error" style="margin-bottom:12px">Неправильний пароль.</div>':''}<form class="form" method="post" action="/admin-backup/download" autocomplete="off"><label>Пароль<input type="password" name="password" inputmode="numeric" required autocomplete="new-password" placeholder="Введіть пароль"></label><button type="submit">Створити резервну копію</button></form></div></section></div>`, session)); }
  if(req.method==='POST' && url.pathname==='/admin-backup/download'){ if(!requireAdmin(req,res,session)) return; const b=await body(req); const supplied=Buffer.from(String(b.password||'')); const expected=Buffer.from(String(BACKUP_DOWNLOAD_PASSWORD)); const valid=supplied.length===expected.length && crypto.timingSafeEqual(supplied, expected); if(!valid) return redirect(res,'/admin-backup?error=wrong'); ensureDb(); const stamp=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Warsaw',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date()).replace(/[^0-9]/g,'').slice(0,14); const filename=`taranka_database_${stamp}.json`; const stat=fs.statSync(DB_FILE); res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Content-Disposition':`attachment; filename="${filename}"`,'Content-Length':stat.size,'Cache-Control':'no-store'}); return fs.createReadStream(DB_FILE).pipe(res); }
  if(req.method==='GET' && url.pathname==='/healthz'){ res.writeHead(200,{'Content-Type':'text/plain'}); return res.end('ok'); }
  return notFound(res);
} catch(e){ console.error(e); try{ res.writeHead(500,{'Content-Type':'text/plain'}); res.end('Internal Server Error'); }catch(ignore){} } }

http.createServer(handler).listen(PORT, ()=>{
  console.log(`TARANKA MAGAZINE running on port ${PORT}`);
});

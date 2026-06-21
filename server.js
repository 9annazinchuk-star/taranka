const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const querystring = require('querystring');

const PORT = process.env.PORT || 10000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'sklepm1';
const SHOP_PASSWORD = process.env.SHOP_PASSWORD || '12345678';
const DEFAULT_SHOPS = ['М1','Центр','Ожарув','Воломін','Ловіч','Рава','Ломʼянки','Сідельце','Мінськ Мазовецький','Плоцьк'];
const CATEGORIES = ['Алкоголь','Напої','Сухий склад','Холодильник 1','Холодильник 2','Морозильна камера','Забезпечення'];
const CAT_ICONS = {'Алкоголь':'🍷','Напої':'🥤','Сухий склад':'📦','Холодильник 1':'❄️','Холодильник 2':'🧊','Морозильна камера':'⛄','Забезпечення':'🧰'};
const sessions = new Map();

function ensureDb(){
  if(!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, {recursive:true});
  if(!fs.existsSync(DB_FILE)) writeDb({products:[], orders:[], notes:[], announcements:[], chatMembers:[], chatMessages:[], readState:{}, carts:{}, sessions:{}, shops: defaultShops()});
}
function readDb(){ ensureDb(); try { const db=JSON.parse(fs.readFileSync(DB_FILE,'utf8')); db.products=db.products||[]; db.orders=db.orders||[]; db.notes=db.notes||[]; db.announcements=db.announcements||[]; db.chatMembers=Array.isArray(db.chatMembers)?db.chatMembers:[]; db.chatMessages=Array.isArray(db.chatMessages)?db.chatMessages:[]; db.readState=db.readState||{}; db.carts=db.carts||{}; db.sessions=db.sessions||{}; normalizeShops(db); normalizeChat(db); return db; } catch(e){ return {products:[], orders:[], notes:[], announcements:[], chatMembers:[], chatMessages:[], readState:{}, carts:{}, sessions:{}, shops: defaultShops()}; } }
function writeDb(db){ normalizeShops(db); normalizeChat(db); fs.writeFileSync(DB_FILE, JSON.stringify(db,null,2)); }
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
}
function canUseChat(db, session){ return !!(session && (session.admin || (session.shop && db.chatMembers.includes(session.shop)))); }

function nowMs(){ return Date.now(); }
function readerKey(session){ if(!session) return ''; if(session.admin) return 'admin'; if(session.shop) return 'shop:'+session.shop; return ''; }
function ensureReadState(db, key){ db.readState=db.readState||{}; if(key && !db.readState[key]) db.readState[key]={newProducts:0, announcements:0, chat:0}; return key?db.readState[key]:{}; }
function badge(n){ return n>0 ? `<span class="notifBadge">+${n}</span>` : ''; }
function unreadCounts(db, session){
  const key=readerKey(session); if(!key) return {newProducts:0, announcements:0, chat:0};
  const seen=ensureReadState(db, key);
  const newProducts=(db.products||[]).filter(p=>p.isNew && !p.hidden && Number(p.newAt || 0)>Number(seen.newProducts || 0)).length;
  const announcements=(db.announcements||[]).filter(a=>Number(a.createdMs || a.id || 0)>Number(seen.announcements || 0)).length;
  const chat=(db.chatMessages||[]).filter(m=>Number(m.createdMs || m.id || 0)>Number(seen.chat || 0) && (session.admin ? m.authorType!=='admin' : m.authorType==='admin')).length;
  return {newProducts, announcements, chat};
}
function markRead(db, session, section){ const key=readerKey(session); if(!key) return; const seen=ensureReadState(db, key); seen[section]=nowMs(); writeDb(db); }
function chatMessagesHtml(db){
  const messages=(db.chatMessages || []).slice(-300);
  return messages.map(m=>{ const isAdmin=m.authorType==='admin'; const name=isAdmin?'Адмін':m.author; return `<div class="chatMessage ${isAdmin?'adminMsg':'shopMsg'}"><div class="chatMeta"><b class="${isAdmin?'adminName':'shopName'}">${esc(name)}</b></div><div class="chatText">${esc(m.text || '')}</div></div>`; }).join('') || '<div class="chatEmpty">Повідомлень поки немає</div>';
}
function chatPage(db, session){
  const who=session.admin?'Адмін':session.shop;
  return `<section><div class="actions" style="align-items:center;justify-content:space-between;margin-bottom:12px"><h1 style="margin:0">Чат</h1>${session.admin?'<a class="btn secondary" href="/admin-chat">Учасники чату</a>':''}</div><div class="card chatBox"><div class="chatHeader"><div><h2>Повідомлення</h2></div></div><div class="chatMessages">${chatMessagesHtml(db)}</div><form class="form chatForm" method="post" action="/chat/send"><label>Повідомлення від ${esc(who || '')}<textarea name="text" required placeholder="Напишіть повідомлення..."></textarea></label><button>Надіслати</button></form></div></section>`;
}
function adminChatPage(db, session){
  const shops=getShops(db);
  const members=new Set(db.chatMembers || []);
  return `<div class="adminShell">${adminMenu()}<section><div class="actions" style="align-items:center;justify-content:space-between;margin-bottom:12px"><h1 style="margin:0">Чат</h1><a class="btn secondary" href="/chat">Відкрити чат</a></div><div class="card" style="padding:20px;margin-bottom:16px"><h2>Учасники чату</h2><p class="muted">Позначте магазини, яким доступний чат. Інші магазини не бачитимуть кнопку та не зможуть відкрити чат.</p><form method="post" action="/admin/chat-members"><div class="shopChecks">${shops.map(shop=>`<label class="shopCheck"><span class="shopCheckName">${esc(shop.name)}</span><input type="checkbox" name="members" value="${esc(shop.name)}" ${members.has(shop.name)?'checked':''}></label>`).join('')}</div><button>Зберегти учасників</button></form></div><div class="card chatBox"><div class="chatHeader"><div><h2>Повідомлення</h2><p class="muted">Відповідайте магазинам у зручному чистому вікні.</p></div></div><div class="chatMessages">${chatMessagesHtml(db)}</div><form class="form chatForm" method="post" action="/chat/send"><label>Повідомлення від адміна<textarea name="text" required placeholder="Напишіть повідомлення магазинам..."></textarea></label><button>Надіслати</button></form></div></section></div>`;
}

function adminMenu(){ return `<aside class="adminMenu"><div class="adminMenuHead"><h2>Адмін</h2><a class="settingsGear" href="/admin-settings" title="Налаштування магазинів" aria-label="Налаштування магазинів">⚙️</a></div><a href="/admin">Замовлення</a><a href="/admin-products">Товари</a><a href="/admin-notes">Нотатки</a><a href="/admin-announcements">Оголошення</a><a href="/admin-chat">Чат</a><a href="/admin-logout">Вийти</a></aside>`; }

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
function orderCopyText(o){
  const lines = [];
  lines.push(`Замовлення №${o.orderNo || o.id}`);
  lines.push(`Магазин: ${o.shop || ''}`);
  lines.push(`Час: ${o.createdAt || ''}`);
  lines.push(`Статус: ${o.status || 'Нове'}`);
  lines.push('');
  lines.push('Товари:');
  for(const i of (o.items || [])) lines.push(`- ${i.name || ''} · ${i.weight || ''} × ${i.qty || 0}`);
  if(o.comment) { lines.push(''); lines.push('Коментар:'); lines.push(String(o.comment)); }
  return lines.join('\n');
}
function shopOrderHistoryHtml(db, shop){
  const orders=(db.orders || []).filter(o=>String(o.shop || '')===String(shop || '')).sort((a,b)=>(Number(b.id)||0)-(Number(a.id)||0));
  const list=orders.map(o=>`<div class="card historyOrder"><h3>Замовлення №${o.orderNo || o.id}</h3><div class="historyMeta">${esc(o.createdAt || '')} · ${esc(o.status || 'Нове')}</div><ul>${(o.items || []).map(i=>`<li>${esc(i.name || '')} · ${esc(i.weight || '')} × ${Number(i.qty || 0)}</li>`).join('')}</ul>${o.comment?`<div class="orderComment"><div class="orderCommentLabel">Коментар:</div>${esc(o.comment)}</div>`:''}</div>`).join('');
  return `<section class="orderHistory"><h2>Історія попередніх замовлень</h2>${list || '<div class="card historyEmpty">Попередніх замовлень ще немає</div>'}</section>`;
}
function shopLoginPage(message='', db=readDb()){ return `<section class="loginHero"><div class="loginPanel"><div class="loginBrand"><div class="fish">🐟</div><h1>TARANKA</h1><p>Оберіть свій магазин, введіть пароль і оформлюйте замовлення від імені магазину.</p></div><form class="form" method="post" action="/shop-login">${message?`<div class="loginError">${esc(message)}</div>`:''}<label>Оберіть магазин<select name="shop" required>${getShopNames(db).map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('')}</select></label><label>Пароль<input type="password" name="password" required placeholder="Введіть пароль" autocomplete="current-password"></label><button>Увійти в магазин</button><a class="btn secondary" href="/admin-login">Вхід в адмінку</a></form></div></section>`; }
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
function send(res,html,status=200){ res.writeHead(status, {'Content-Type':'text/html; charset=utf-8'}); res.end(html); }
function notFound(res){ send(res, layout('Не знайдено', `<section class="card center"><h1>Сторінку не знайдено</h1><p>Перейдіть у каталог або на головну.</p><a class="btn" href="/catalog">Каталог</a></section>`), 404); }
function layout(title, content, session={cart:[]}){ const count=(session.cart||[]).reduce((a,i)=>a+Number(i.qty||0),0); const layoutDb=readDb(); const unread=unreadCounts(layoutDb, session); return `<!doctype html><html lang="uk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · TARANKA MAGAZINE</title><style>
:root{--b:#0b5bd3;--d:#071b3a;--mut:#64748b;--bg:#f4f7fb;--card:#fff;--line:#e5eaf2;--r:18px}*{box-sizing:border-box}body{margin:0;font-family:Inter,Arial,sans-serif;background:var(--bg);color:#101828}.top{position:sticky;top:0;z-index:5;background:#fff;border-bottom:1px solid var(--line);box-shadow:0 6px 22px #0b24451a}.nav{max-width:1180px;margin:auto;display:flex;align-items:center;gap:20px;padding:14px 18px}.logo{font-weight:900;color:var(--d);text-decoration:none;font-size:20px}.logo span{display:block;font-size:12px;color:var(--b)}.links{margin-left:auto;display:flex;align-items:center;gap:8px}.links a{color:#172033;text-decoration:none;padding:10px 12px;border-radius:12px}.links a:hover,.active{background:#eef5ff;color:var(--b)!important}.cart{font-weight:800}.wrap{max-width:1180px;margin:0 auto;padding:28px 18px}.hero{display:grid;grid-template-columns:1.2fr .8fr;gap:22px;align-items:center}.heroBox,.card{background:var(--card);border:1px solid var(--line);border-radius:var(--r);box-shadow:0 12px 30px #0b244514}.heroBox{padding:42px;background:linear-gradient(135deg,#fff 0%,#e9f3ff 100%)}h1{font-size:38px;margin:0 0 14px}h2{margin:0 0 18px}.muted{color:var(--mut);line-height:1.6}.btn,button{border:0;background:var(--b);color:#fff;padding:12px 16px;border-radius:12px;font-weight:800;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:8px}button.secondary,.btn.secondary{background:#eef5ff;color:var(--b)}.btn.cartGoto{background:#0a49ff;color:#fff;box-shadow:0 10px 24px #0a49ff2e}.btn.cartGoto:hover{background:#073bd1;color:#fff!important}.orderHistory{margin-top:22px}.historyOrder{padding:16px;margin-bottom:12px}.historyOrder h3{margin:0 0 6px;font-size:17px}.historyOrder ul{margin:10px 0 0;padding-left:22px}.historyOrder li{margin:4px 0}.historyMeta{color:var(--mut);font-size:13px;font-weight:800}.historyEmpty{padding:18px;text-align:center;color:var(--mut)}button.danger,.btn.danger{background:#fee2e2;color:#b91c1c}.warn{background:#fff7ed!important;color:#c2410c!important}.iconBtn{justify-content:center}.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.catgrid{display:grid;grid-template-columns:repeat(6,1fr);gap:10px}.cat{padding:14px;text-align:center;font-size:14px}.item{padding:8px 10px;display:flex;flex-direction:column;gap:4px;min-height:92px}.badge{display:inline-block;background:#eef5ff;color:var(--b);padding:3px 8px;border-radius:999px;font-size:12px;line-height:1.25}.notifBadge{display:inline-flex;align-items:center;justify-content:center;margin-left:6px;min-width:24px;height:22px;padding:0 7px;border-radius:999px;background:#dc2626;color:#fff;font-size:12px;font-weight:900;line-height:1}.layout2{display:grid;grid-template-columns:250px 1fr;gap:18px}.side{padding:16px;height:max-content}.side a{display:block;padding:8px 10px;border-radius:10px;text-decoration:none;color:#172033}.side a:hover{background:#eef5ff;color:var(--b)}input,select,textarea{width:100%;padding:10px 12px;border:1px solid var(--line);border-radius:12px;font:inherit;background:#fff}label{display:grid;gap:7px;font-weight:700}.form{display:grid;gap:14px}.table{width:100%;border-collapse:collapse;background:#fff;border-radius:16px;overflow:hidden}.table th,.table td{padding:10px;border-bottom:1px solid var(--line);text-align:left}.listWrap{background:#fff;border:1px solid var(--line);border-radius:18px;overflow:auto;box-shadow:0 12px 30px #0b244514;max-height:calc(100vh - 185px)}.listTable{width:100%;border-collapse:collapse;font-size:13px}.listTable th{position:sticky;top:0;background:#f4f7fb;z-index:1;color:#334155;font-size:13px}.listTable th,.listTable td{padding:6px 8px;border-bottom:1px solid var(--line);text-align:left;vertical-align:middle}.listTable tr:hover{background:#f8fbff}.listTable tr.hiddenProduct{background:#fff1f2}.listTable tr.hiddenProduct .name{color:#b91c1c}.hiddenBadge{display:inline-block;background:#fee2e2;color:#b91c1c;padding:2px 7px;border-radius:999px;font-size:11px;font-weight:900}.listTable .num{width:36px;color:var(--mut);font-weight:800;text-align:center}.mainCell{min-width:180px}.catCell{white-space:nowrap}.mobileMeta{display:none;color:var(--mut);font-size:11px;margin-top:2px}.adminAction{white-space:nowrap}.deleteCell{width:42px;text-align:center}.listTable .name{font-weight:900;color:#0f172a}.listTable .weight{white-space:nowrap;color:var(--mut)}.listTable .rowActions{display:flex;align-items:center;gap:6px;flex-wrap:nowrap}.listTable button{padding:6px 9px;border-radius:10px}.compactBtn{font-size:12px;padding:6px 9px!important}.deleteIcon{width:30px;height:30px;padding:0!important;border-radius:50%!important;background:#fee2e2!important;color:#dc2626!important;font-size:22px!important;line-height:1;font-weight:900;display:inline-flex;align-items:center;justify-content:center}.deleteIcon:hover{background:#dc2626!important;color:#fff!important}.listQty{display:grid;grid-template-columns:40px 42px 40px;gap:6px;align-items:center}.listQty button{width:40px;min-height:40px;padding:0;justify-content:center;font-size:24px;line-height:1;border-radius:13px}.minusBtn{background:#fee2e2!important;color:#dc2626!important}.minusBtn:hover{background:#dc2626!important;color:#fff!important}.newDot{display:inline-block;background:#0b5bd3;color:#fff;border-radius:999px;padding:1px 6px;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.2px}.actions{display:flex;gap:8px;flex-wrap:wrap}.qtymini{display:grid;grid-template-columns:48px 1fr 48px;gap:8px;align-items:center}.qtymini button{width:48px;min-height:44px;padding:0;justify-content:center;font-size:28px;line-height:1;border-radius:14px}.qtynum{text-align:center;font-weight:900;background:#f8fbff;border:1px solid var(--line);border-radius:12px;padding:8px 0;min-width:36px;font-size:17px}.center{text-align:center;padding:34px}.adminShell{display:grid;grid-template-columns:240px 1fr;gap:20px}.adminMenu{background:#071b3a;color:#fff;border-radius:20px;padding:18px}.adminMenuHead{display:flex;align-items:center;justify-content:space-between;gap:10px}.adminMenuHead h2{margin:0 0 10px}.adminMenu a{display:block;color:#fff;text-decoration:none;padding:12px;border-radius:12px}.adminMenu a:hover{background:#153764}.adminMenu .settingsGear{width:42px;height:42px;display:inline-flex;align-items:center;justify-content:center;padding:0;font-size:20px;background:#153764}.order{padding:18px;margin-bottom:14px}.orderComment{margin:12px 0 14px;padding:12px 14px;background:#f8fbff;border:1px solid var(--line);border-radius:14px;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;line-height:1.55}.orderCommentLabel{font-weight:900;color:#334155;margin-bottom:6px}.noteCard{padding:16px;margin-bottom:12px}.noteText{white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;line-height:1.55;margin:8px 0 12px}.noteDate{font-size:12px;color:var(--mut);font-weight:800}.noteForm textarea{min-height:150px;resize:vertical}.announcementCard{padding:18px;margin-bottom:14px}.announcementDate{font-size:12px;color:var(--mut);font-weight:800;margin-bottom:8px}.announcementText{white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;line-height:1.6;font-size:16px}.status{font-weight:800;color:var(--b)}.orderItemsPreview{margin:12px 0;padding-left:22px}.orderEditBox{margin:12px 0;padding:14px;border:1px solid var(--line);border-radius:16px;background:linear-gradient(180deg,#fff,#f8fbff)}.orderEditHead{display:flex;flex-direction:column;gap:3px;margin-bottom:10px}.orderEditHead b{color:#0f172a}.orderEditHead span{color:var(--mut);font-size:13px;line-height:1.35}.orderEditList{display:grid;gap:8px}.orderEditRow{display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center;padding:10px;border:1px solid var(--line);border-radius:14px;background:#fff}.orderEditInfo{display:grid;gap:2px;min-width:0}.orderEditInfo b{overflow-wrap:anywhere}.orderEditInfo span{color:var(--mut);font-size:13px}.orderQtyForm{display:flex;align-items:center;gap:6px}.orderQtyForm input{width:76px;text-align:center;font-weight:900}.smallDelete{width:34px!important;height:34px!important}.orderEmptyItems{padding:12px;border:1px dashed var(--line);border-radius:14px;color:var(--mut);text-align:center}.orderAddBox{display:grid;grid-template-columns:minmax(240px,1fr) 142px 128px;gap:12px;align-items:end;margin:12px 0 14px;padding:14px;border:1px solid #bfdbfe;border-radius:16px;background:#eef5ff}.orderAddBox button{justify-content:center}.orderSearchLabel{position:relative;min-width:0}.orderSearchResults{display:none;margin-top:8px;max-height:260px;overflow:auto;border:1px solid var(--line);border-radius:14px;background:#fff;box-shadow:0 12px 28px #0b24451a;padding:6px;position:relative;z-index:4}.orderSearchAddBox.searching .orderSearchResults{display:grid;gap:5px}.orderSearchOption{display:none;width:100%;text-align:left;background:#fff!important;color:#0f172a!important;border:1px solid var(--line);border-radius:12px;padding:9px 10px!important;box-shadow:none;font-weight:700}.orderSearchOption.is-match{display:grid;gap:2px}.orderSearchOption span{font-size:12px;color:var(--mut);font-weight:700}.orderSearchOption:hover{background:#f8fbff!important;border-color:#bfdbfe}.orderAddActions{display:grid;gap:8px}.orderAddQty input{text-align:center;font-weight:900}.orderAddQtyStepper{display:grid;grid-template-columns:40px 1fr 40px;gap:6px;align-items:center}.orderAddQtyStepper button{width:40px;min-height:40px;padding:0!important;font-size:24px;line-height:1;border-radius:13px}.orderAddSubmit{min-height:42px;padding-left:12px!important;padding-right:12px!important;white-space:nowrap}.orderEditQtyStepper{display:grid;grid-template-columns:38px 42px 38px;gap:6px;align-items:center}.orderEditQtyStepper form{margin:0}.orderEditQtyStepper button{width:38px;min-height:38px;padding:0!important;font-size:22px;line-height:1;border-radius:12px}.confirmOverlay{position:fixed;inset:0;background:#071b3a80;display:flex;align-items:center;justify-content:center;padding:18px;z-index:100}.confirmModal{width:min(430px,100%);background:#fff;border-radius:24px;border:1px solid var(--line);box-shadow:0 28px 80px #071b3a55;padding:22px}.confirmModal h3{margin:0 0 8px;color:#0f172a}.confirmModal p{margin:0 0 18px;color:var(--mut);line-height:1.5}.confirmActions{display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap}.confirmDanger{background:#dc2626!important;color:#fff!important}@media(max-width:760px){.orderEditRow{grid-template-columns:1fr}.orderQtyForm{display:grid;grid-template-columns:1fr auto}.orderQtyForm input{width:100%}.orderAddBox{grid-template-columns:1fr}.orderAddBox button{width:100%}}.flash{background:#dcfce7;color:#166534;padding:14px;border-radius:14px;margin-bottom:16px}.burger{display:none;margin-left:auto;background:#eef5ff;color:var(--b)}.shopPill{background:#eef5ff;color:var(--b);padding:8px 10px;border-radius:999px;font-weight:900}.loginHero{min-height:calc(100vh - 130px);display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at top left,#dbeafe,transparent 34%),linear-gradient(135deg,#f8fbff,#eef5ff);border-radius:28px;padding:26px}.loginPanel{width:min(520px,100%);background:#fff;border:1px solid var(--line);border-radius:28px;box-shadow:0 24px 70px #0b244526;padding:30px}.loginBrand{text-align:center;margin-bottom:22px}.loginBrand .fish{font-size:48px;margin-bottom:8px}.loginBrand h1{font-size:42px;letter-spacing:.5px;margin-bottom:6px;color:var(--d)}.loginBrand p{color:var(--mut);line-height:1.55;margin:0}.loginError{background:#fee2e2;color:#b91c1c;border-radius:14px;padding:12px;font-weight:800}.shopNotice{background:#eef5ff;border:1px solid #bfdbfe;color:#0b5bd3;padding:12px 14px;border-radius:16px;font-weight:900;margin-bottom:12px}.toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%) translateY(20px);background:#071b3a;color:#fff;padding:12px 18px;border-radius:999px;font-weight:900;box-shadow:0 14px 35px #071b3a40;opacity:0;pointer-events:none;transition:.25s;z-index:50}.toast.show{opacity:1;transform:translateX(-50%) translateY(0)}.cartSummary{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:14px 0 16px;padding:14px 16px;background:#fff;border:1px solid var(--line);border-radius:16px;box-shadow:0 10px 24px #0b24450f}.cartSummary b{font-size:18px}.cartTable .qtyCell{width:150px}.cartTable .deleteCell{width:54px}.cartTable .listQty{grid-template-columns:40px 46px 40px}.cartTable .name{font-size:14px}@media(max-width:820px){.hero,.layout2,.adminShell{grid-template-columns:1fr}.wrap{padding:18px 14px}.grid{grid-template-columns:1fr;gap:8px}.catgrid{grid-template-columns:repeat(2,1fr)}h1{font-size:30px}.item{border-radius:16px;padding:8px 10px;gap:3px;min-height:0}.item h3{font-size:18px!important;margin:2px 0 0!important}.item .muted{font-size:14px!important;line-height:1.3}.qtymini{grid-template-columns:46px 1fr 46px;gap:8px;margin-top:2px}.qtymini button{width:46px;min-height:42px;font-size:27px;border-radius:14px}.qtynum{padding:7px 0;font-size:17px}.badge{padding:3px 8px;font-size:12px}.burger{display:inline-flex}.links{display:none;position:absolute;left:12px;right:12px;top:70px;background:#fff;border:1px solid var(--line);border-radius:18px;padding:10px;flex-direction:column;align-items:stretch}.links.open{display:flex}.table{font-size:14px}.listWrap{max-height:calc(100vh - 150px);border-radius:14px}.listTable{min-width:0;font-size:12px}.listTable th,.listTable td{padding:5px 5px}.catCell,.catHead,.weight,.weightHead{display:none}.mobileMeta{display:block}.mainCell{min-width:0}.listTable .num{width:26px}.listQty{grid-template-columns:36px 36px 36px;gap:5px}.listQty button{width:36px;min-height:36px;font-size:22px}.qtynum{min-width:28px;padding:5px 0;font-size:13px}.compactBtn{font-size:11px;padding:5px 6px!important}.deleteIcon{width:27px;height:27px;font-size:20px!important}.adminMenu{display:flex;gap:6px;align-items:center;overflow:auto;border-radius:16px;padding:10px}.adminMenu h2{display:none}.adminMenu a{white-space:nowrap;padding:9px 10px}.actions .btn{padding:8px 10px;font-size:12px}.cartSummary{align-items:flex-start;flex-direction:column}.cartTable .qtyCell{width:118px}.cartTable .deleteCell{width:34px}.cartTable .listQty{grid-template-columns:36px 36px 36px}.cartTable .name{font-size:13px}input,select,textarea{padding:9px 10px}.orderAddBox{grid-template-columns:1fr;gap:10px}.orderSearchResults{max-height:220px}.orderAddActions{grid-template-columns:1fr}.orderAddQtyStepper{grid-template-columns:42px 1fr 42px}.orderAddSubmit{width:100%}.orderEditRow{grid-template-columns:1fr auto;gap:8px}.orderEditQtyStepper{grid-column:1 / -1;grid-template-columns:42px 1fr 42px}.orderEditQtyStepper button{width:42px;min-height:40px}.smallDelete{align-self:start}.nav{position:relative}}
.chatBox{padding:0;overflow:hidden;background:linear-gradient(180deg,#ffffff 0%,#f8fbff 100%)}
.chatHeader{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:20px 22px 14px;border-bottom:1px solid var(--line);background:#fff}
.chatHeader h2{margin:0 0 4px;font-size:22px}.chatHeader .muted{margin:0;font-size:14px}
.chatMessages{display:flex;flex-direction:column;gap:12px;min-height:360px;max-height:58vh;overflow:auto;padding:20px;background:linear-gradient(180deg,#f8fbff 0%,#eef5ff 100%)}
.chatMessage{max-width:min(74%,720px);padding:11px 14px;border-radius:18px;border:1px solid var(--line);box-shadow:0 10px 24px #0b24450f;line-height:1.5;overflow-wrap:anywhere;word-break:break-word}
.chatMessage.adminMsg{align-self:flex-end;background:#fff;border-top-right-radius:6px}.chatMessage.shopMsg{align-self:flex-start;background:#ffffffcc;border-top-left-radius:6px}
.chatMeta{display:flex;align-items:center;margin-bottom:4px}.chatMeta b{font-size:13px}.adminName{color:#dc2626}.shopName{color:#0b5bd3}
.chatText{white-space:pre-wrap;color:#0f172a}.chatEmpty{text-align:center;color:var(--mut);padding:46px 16px;border:1px dashed #cbd5e1;border-radius:18px;background:#fff}
.chatForm{padding:16px 20px 20px;background:#fff;border-top:1px solid var(--line);grid-template-columns:1fr auto;align-items:end}.chatForm label{font-size:13px;color:#334155}.chatForm textarea{min-height:54px;max-height:170px;resize:vertical;background:#f8fbff}.chatForm button{min-height:54px;padding-left:22px;padding-right:22px}
.shopChecks{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin:16px 0}.shopChecks .shopCheck{display:flex;flex-direction:row;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border:1px solid var(--line);border-radius:14px;background:#f8fbff;font-weight:800}.shopChecks .shopCheckName{line-height:1.3}.shopChecks input[type="checkbox"]{width:20px;height:20px;flex:0 0 auto;accent-color:var(--b)}
@media(max-width:700px){.chatMessages{min-height:320px;max-height:62vh;padding:14px}.chatMessage{max-width:92%}.chatForm{grid-template-columns:1fr}.chatForm button{width:100%;justify-content:center}.shopChecks{grid-template-columns:1fr}}

.orderEditToggle{margin:12px 0 14px}.orderEditToggle summary{width:max-content;max-width:100%;list-style:none;border:0;background:#eef5ff;color:var(--b);padding:12px 16px;border-radius:12px;font-weight:900;cursor:pointer;display:inline-flex;align-items:center;gap:8px}.orderEditToggle summary::-webkit-details-marker{display:none}.orderEditToggle summary:before{content:'▸';font-size:13px}.orderEditToggle[open] summary:before{content:'▾'}.orderEditToggleBody{margin-top:10px}.orderSearchAddBox{align-items:start}.orderSearchLabel{position:relative}.orderSearchAddBox input[name="productSearch"]{font-weight:700}.orderSearchAddBox input[name="productSearch"]::placeholder{font-weight:500;color:#94a3b8}.orderSearchResults{display:none;margin-top:8px;border:1px solid var(--line);border-radius:14px;background:#fff;box-shadow:0 12px 28px #0b24451a;max-height:260px;overflow:auto;padding:6px;z-index:20}.orderSearchAddBox.searching .orderSearchResults{display:grid;gap:6px}.orderSearchOption{display:none;width:100%;background:#fff!important;color:#0f172a!important;border:1px solid var(--line);border-radius:12px;padding:9px 10px;text-align:left;box-shadow:none;justify-content:flex-start}.orderSearchOption.is-match{display:grid}.orderSearchOption b{font-size:14px;line-height:1.25;overflow-wrap:anywhere}.orderSearchOption span{color:var(--mut);font-size:12px;font-weight:800;line-height:1.25}.orderSearchOption:hover{background:#eef5ff!important;color:var(--b)!important}.orderEditTable{gap:6px}.orderEditQtyStepper,.orderAddQtyStepper{display:grid;grid-template-columns:38px 42px 38px;gap:6px;align-items:center}.orderEditQtyStepper button,.orderAddQtyStepper button{width:38px;min-height:38px;padding:0;justify-content:center;font-size:22px;line-height:1;border-radius:12px}.orderAddQtyStepper input{text-align:center;font-weight:900;padding-left:4px;padding-right:4px}.orderEditQtyStepper form{margin:0}.orderEditQtyStepper .qtynum{font-size:14px;min-width:0;padding:7px 0}.orderSearchAddBox.is-picked input[name="productSearch"]{border-color:#93c5fd;background:#f8fbff}
@media(max-width:720px){.orderAddBox.orderSearchAddBox{grid-template-columns:1fr;gap:8px;padding:10px}.orderSearchResults{max-height:220px}.orderSearchAddBox.searching .orderSearchResults{display:grid;gap:6px}.orderSearchOption.is-match{display:grid}.orderEditToggle summary{width:100%;justify-content:center}.orderEditRow{grid-template-columns:minmax(0,1fr) auto;gap:6px;padding:8px}.orderEditInfo b{font-size:13px;line-height:1.25}.orderEditInfo span{font-size:12px}.orderEditQtyStepper{grid-column:1 / -1;grid-template-columns:44px 1fr 44px;gap:6px}.orderEditQtyStepper button{width:44px;min-height:40px;font-size:20px}.orderEditQtyStepper .qtynum{font-size:13px;padding:6px 0}.smallDelete{width:30px!important;height:30px!important}.orderAddActions{grid-template-columns:1fr}.orderAddQtyStepper{grid-template-columns:44px 1fr 44px}.orderAddQtyStepper button{width:44px;min-height:40px}.orderAddSubmit{width:100%;justify-content:center}.orderSearchOption{padding:10px}.orderSearchOption b{font-size:13px}.orderSearchOption span{font-size:11px}}
</style><script>
function menu(){document.querySelector('.links').classList.toggle('open')}
function filterProducts(){const q=(document.getElementById('search')?.value||'').toLowerCase();document.querySelectorAll('[data-product]').forEach(el=>el.style.display=el.dataset.product.includes(q)?(el.tagName==='TR'?'':'flex'):'none')}
function toast(msg='✓ Додано в кошик'){let t=document.getElementById('toast');if(!t){t=document.createElement('div');t.id='toast';t.className='toast';document.body.appendChild(t)}t.textContent=msg;t.classList.add('show');clearTimeout(window.__toastTimer);window.__toastTimer=setTimeout(()=>t.classList.remove('show'),1300)}
function updateEmptyCart(){const wrap=document.querySelector('[data-cart-page]');if(!wrap)return;const rows=wrap.querySelectorAll('[data-cart-row]');if(rows.length===0){wrap.innerHTML='<section class="card center"><p>Кошик порожній</p><a class="btn" href="/catalog">До каталогу</a></section>'}}
function updateCartUI(data){document.querySelectorAll('[data-cart-count]').forEach(el=>el.textContent=data.count||0);if(data.id){document.querySelectorAll('[data-item-count="'+CSS.escape(String(data.id))+'"]').forEach(el=>el.textContent=data.itemQty||0);document.querySelectorAll('[data-cart-row="'+CSS.escape(String(data.id))+'"]').forEach(row=>{if((data.itemQty||0)<=0){row.remove()}else{row.querySelectorAll('[data-row-qty]').forEach(el=>el.textContent=data.itemQty)}})}if(data.cleared){document.querySelectorAll('[data-item-count]').forEach(el=>el.textContent='0');document.querySelectorAll('[data-cart-row]').forEach(row=>row.remove())}updateEmptyCart()}
async function cartFetch(form,msg){try{const r=await fetch(form.action,{method:'POST',body:new URLSearchParams(new FormData(form)),headers:{'X-Requested-With':'fetch'}});const data=await r.json();updateCartUI(data);if(msg)toast(msg);return true}catch(e){console.error(e);toast('Помилка дії');return false}}
function addToCart(form){const btn=form.querySelector('button');const old=btn.textContent;btn.textContent='✓';btn.disabled=true;cartFetch(form,'✓ Додано в кошик').finally(()=>setTimeout(()=>{btn.textContent=old;btn.disabled=false},260));return false}
function changeQty(form,delta){if(delta!==undefined){let input=form.querySelector('[name=delta]');if(!input){input=document.createElement('input');input.type='hidden';input.name='delta';form.appendChild(input)}input.value=delta}cartFetch(form);return false}
function removeCart(form){cartFetch(form,'Видалено');return false}
function clearCart(form){cartFetch(form,'Кошик очищено');return false}
async function copyOrder(btn){const text=btn.dataset.copy||'';try{if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(text)}else{const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.left='-9999px';document.body.appendChild(ta);ta.focus();ta.select();document.execCommand('copy');ta.remove()}toast('Замовлення скопійовано')}catch(e){console.error(e);toast('Не вдалося скопіювати')}}
function niceConfirm(title,text,okText){return new Promise(resolve=>{const old=document.querySelector('.confirmOverlay');if(old)old.remove();const overlay=document.createElement('div');overlay.className='confirmOverlay';overlay.innerHTML='<div class="confirmModal" role="dialog" aria-modal="true"><h3></h3><p></p><div class="confirmActions"><button type="button" class="secondary" data-cancel>Скасувати</button><button type="button" class="confirmDanger" data-ok></button></div></div>';overlay.querySelector('h3').textContent=title;overlay.querySelector('p').textContent=text;overlay.querySelector('[data-ok]').textContent=okText||'Видалити';document.body.appendChild(overlay);const done=v=>{overlay.remove();resolve(v)};overlay.addEventListener('click',e=>{if(e.target===overlay||e.target.hasAttribute('data-cancel'))done(false);if(e.target.hasAttribute('data-ok'))done(true)});document.addEventListener('keydown',function escClose(e){if(e.key==='Escape'){document.removeEventListener('keydown',escClose);done(false)}},{once:true});});}
function submitAfterConfirm(form,title,text,okText){niceConfirm(title,text,okText).then(ok=>{if(ok){if(form.matches('form[data-ajax-admin-order]')){adminOrderFetch(form,'Видалено');}else{saveScrollState();form.submit();}}});return false}
function confirmOrderDelete(form){return submitAfterConfirm(form,'Видалити замовлення?','Цю дію не можна буде скасувати. Перевірте, що магазин справді надіслав замовлення випадково.','Так, видалити')}
function confirmOrderItemDelete(form){return submitAfterConfirm(form,'Видалити позицію?','Буде видалена тільки ця позиція із замовлення. Інші товари залишаться без змін.','Видалити позицію')}
function scrollStateKey(){return 'scrollState:'+location.pathname+location.search}
function saveScrollState(){try{const lists=[...document.querySelectorAll('.listWrap')].map(el=>el.scrollTop||0);sessionStorage.setItem(scrollStateKey(),JSON.stringify({x:window.scrollX||0,y:window.scrollY||0,lists,ts:Date.now()}));}catch(e){}}
function restoreScrollState(){try{const raw=sessionStorage.getItem(scrollStateKey());if(!raw)return;sessionStorage.removeItem(scrollStateKey());const st=JSON.parse(raw);if(!st||Date.now()-Number(st.ts||0)>10*60*1000)return;const apply=function(){window.scrollTo(Number(st.x)||0,Number(st.y)||0);document.querySelectorAll('.listWrap').forEach((el,i)=>{if(st.lists&&st.lists[i]!==undefined)el.scrollTop=Number(st.lists[i])||0;});};setTimeout(apply,0);requestAnimationFrame(apply);setTimeout(apply,80);}catch(e){}}
function saveAdminScroll(){saveScrollState();try{sessionStorage.setItem('adminProductsScroll',String(window.scrollY||0));}catch(e){}}

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
async function refreshChatMessages(forceScroll){
  const box=document.querySelector('.chatMessages');
  if(!box)return;
  try{
    const shouldScroll=forceScroll||chatIsNearBottom(box);
    const r=await fetch('/chat/messages',{headers:{'X-Requested-With':'fetch'},cache:'no-store'});
    if(!r.ok)return;
    const data=await r.json();
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
    if(data && data.ok){if(textarea)textarea.value='';await refreshChatMessages(true);return true;}
    toast('Не вдалося надіслати');return false;
  }catch(e){console.error(e);toast('Помилка чату');return false;}
  finally{if(btn){btn.disabled=false;btn.textContent=old;}}
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
document.addEventListener('DOMContentLoaded',function(){restoreScrollState();initChatAutoRefresh();try{if(location.pathname==='/admin-products'){const y=sessionStorage.getItem('adminProductsScroll');if(y!==null){sessionStorage.removeItem('adminProductsScroll');setTimeout(function(){window.scrollTo(0,Number(y)||0)},0);}}}catch(e){}});
document.addEventListener('submit',function(e){const f=e.target;if(f && f.matches('form.chatForm')){e.preventDefault();e.stopPropagation();sendChatMessage(f);return false}if(f && f.matches('form[data-ajax-cart]')){e.preventDefault();e.stopPropagation();const action=f.dataset.action;if(action==='add')addToCart(f);else if(action==='qty')changeQty(f);else if(action==='remove')removeCart(f);else if(action==='clear')clearCart(f);return false}if(f && f.matches('form[data-ajax-admin-order]')){e.preventDefault();e.stopPropagation();if(f.classList.contains('orderSearchAddBox')&&!prepareOrderProductAdd(f))return false;adminOrderFetch(f);return false}if(f && f.matches('form.orderSearchAddBox')){e.preventDefault();e.stopPropagation();addOrderDraftProduct(f);return false}if(f && f.method && String(f.method).toLowerCase()==='post'){saveScrollState();}},true);
</script></head><body><header class="top"><nav class="nav"><a class="logo" href="/">TARANKA<span>MAGAZINE</span></a>${session.shop?`<span class="shopPill">${esc(session.shop)}</span>`:''}<button class="burger" onclick="menu()">☰</button><div class="links"><a href="/">Головна</a>${session.shop?`<a href="/catalog">Каталог</a><a href="/catalog?new=1">Новинки${badge(unread.newProducts)}</a><a class="cart" href="/cart">Кошик (<span data-cart-count>${count}</span>)</a><a href="/shop-logout">Вийти з магазину</a>`:''}<a href="/about">Оголошення${badge(unread.announcements)}</a>${canUseChat(layoutDb, session)?`<a href="/chat">Чат${badge(unread.chat)}</a>`:''}${session.admin?`<a href="/admin">Адмінка</a><a href="/admin-logout">Вийти з адмінки</a>`:`<a href="/admin-login">Адмін</a>`}</div></nav></header><main class="wrap">${content}</main><div id="toast" class="toast"></div></body></html>`; }
function productCard(p, session){ const cartItem=(session.cart||[]).find(x=>String(x.id)===String(p.id)); const qty=cartItem?cartItem.qty:0; return `<div class="card item" data-product="${esc((p.name+' '+p.category+' '+p.weight).toLowerCase())}"><span class="badge">${CAT_ICONS[p.category]||'▣'} ${esc(p.category)}</span>${p.isNew?'<span class="badge" style="background:#0b5bd3;color:#fff;width:max-content">NEW</span>':''}<h3 style="margin:0;font-size:15px">${esc(p.name)}</h3><p class="muted" style="margin:0;font-size:13px">${esc(p.weight)}</p><div class="qtymini"><form method="post" action="/cart/qty" data-ajax-cart data-action="qty" onsubmit="event.preventDefault(); return changeQty(this)"><input type="hidden" name="id" value="${p.id}"><input type="hidden" name="delta" value="-1"><button class="secondary minusBtn" aria-label="Мінус">−</button></form><div class="qtynum" data-item-count="${p.id}">${qty}</div><form method="post" action="/cart/add" data-ajax-cart data-action="add" onsubmit="event.preventDefault(); return addToCart(this)"><input type="hidden" name="id" value="${p.id}"><button>+</button></form></div></div>`; }
function productRow(p, session, n){ const cartItem=(session.cart||[]).find(x=>String(x.id)===String(p.id)); const qty=cartItem?cartItem.qty:0; return `<tr data-product="${esc((p.name+' '+p.category+' '+p.weight).toLowerCase())}"><td class="num">${n}</td><td class="mainCell">${p.isNew?'<span class="newDot">new</span> ':''}<span class="name">${esc(p.name)}</span><span class="mobileMeta">${esc(p.weight)}</span></td><td class="weight">${esc(p.weight)}</td><td class="qtyCell"><div class="listQty"><form method="post" action="/cart/qty" data-ajax-cart data-action="qty" onsubmit="event.preventDefault(); return changeQty(this)"><input type="hidden" name="id" value="${p.id}"><input type="hidden" name="delta" value="-1"><button class="secondary iconBtn minusBtn" aria-label="Мінус">−</button></form><div class="qtynum" data-item-count="${p.id}">${qty}</div><form method="post" action="/cart/add" data-ajax-cart data-action="add" onsubmit="event.preventDefault(); return addToCart(this)"><input type="hidden" name="id" value="${p.id}"><button class="iconBtn" aria-label="Додати">+</button></form></div></td></tr>`; }
function adminProductRow(p, n){ return `<tr class="${p.hidden?'hiddenProduct':''}" data-product="${esc((p.name+' '+p.category+' '+p.weight).toLowerCase())}"><td class="num">${n}</td><td class="mainCell">${p.hidden?'<span class="hiddenBadge">hidden</span> ':''}${p.isNew?'<span class="newDot">new</span> ':''}<span class="name">${esc(p.name)}</span><span class="mobileMeta">${esc(p.weight)}</span></td><td class="weight">${esc(p.weight)}</td><td class="adminAction"><form method="post" action="/admin/product-toggle-hidden" data-preserve-admin-scroll><input type="hidden" name="id" value="${p.id}"><button class="compactBtn ${p.hidden?'secondary':'warn'}">${p.hidden?'Показати':'Приховати'}</button></form></td><td class="adminAction"><form method="post" action="/admin/product-new" data-preserve-admin-scroll><input type="hidden" name="id" value="${p.id}"><button class="compactBtn secondary">${p.isNew?'new −':'new +'}</button></form></td><td class="deleteCell"><form method="post" action="/admin/product-delete" onsubmit="saveAdminScroll(); return confirm('Видалити товар?')"><input type="hidden" name="id" value="${p.id}"><button class="deleteIcon" title="Видалити" aria-label="Видалити товар">×</button></form></td></tr>`; }

function orderItemsEditorHtml(o){
  const items = Array.isArray(o.items) ? o.items : [];
  return `<div class="orderEditBox"><div class="orderEditHead"><b>Редагування позицій</b><span>Змініть або додайте кілька позицій, а потім натисніть «Застосувати».</span></div><div class="orderEditList orderEditTable" data-order-items-list>${items.length?items.map((i,idx)=>orderDraftItemRowHtml(i, idx)).join(''):'<div class="orderEmptyItems" data-order-empty>У цьому замовленні немає позицій.</div>'}</div><div class="actions" style="margin-top:12px;align-items:center"><button type="button" onclick="applyOrderDraft(this)">Застосувати</button><span class="muted" data-order-draft-status></span></div></div>`;
}
function orderDraftItemRowHtml(i, idx){
  const qty=Math.max(1, Number(i.qty || 1));
  return `<div class="orderEditRow" data-order-item data-id="${esc(i.id || '')}" data-name="${esc(i.name || '')}" data-category="${esc(i.category || '')}" data-weight="${esc(i.weight || '')}" data-qty="${qty}"><div class="orderEditInfo"><b>${esc(i.name || '')}</b><span>${esc(i.weight || '')}</span></div><div class="orderEditQtyStepper" aria-label="Кількість"><button type="button" class="secondary iconBtn minusBtn" aria-label="Мінус" onclick="stepOrderDraftItem(this,-1)">−</button><div class="qtynum" data-order-item-qty>${qty}</div><button type="button" class="iconBtn" aria-label="Плюс" onclick="stepOrderDraftItem(this,1)">+</button></div><button type="button" class="deleteIcon smallDelete" title="Видалити позицію" aria-label="Видалити позицію" onclick="removeOrderDraftItem(this)">×</button></div>`;
}
function orderAddProductHtml(o, products){
  const available = (products || []).filter(p=>!p.hidden);
  if(!available.length) return `<div class="orderAddBox muted">Немає товарів для додавання з асортименту.</div>`;
  return `<form class="orderAddBox orderSearchAddBox" method="post" action="/admin/order-item-add" onsubmit="return addOrderDraftProduct(this)"><input type="hidden" name="id" value="${esc(o.id)}"><input type="hidden" name="productId"><label class="orderSearchLabel"><input name="productSearch" autocomplete="off" required placeholder="Введіть назву або вагу..." oninput="filterOrderProductSearch(this)" onfocus="filterOrderProductSearch(this)"><div class="orderSearchResults" role="listbox">${available.map(p=>{const title=`${p.name} · ${p.weight} · ${p.category}`; const search=`${p.name} ${p.weight} ${p.category}`.toLowerCase(); return `<button type="button" class="orderSearchOption" data-id="${esc(p.id)}" data-name="${esc(p.name)}" data-weight="${esc(p.weight)}" data-category="${esc(p.category)}" data-title="${esc(title)}" data-search="${esc(search)}" onclick="selectOrderProduct(this)"><b>${esc(p.name)}</b><span>${esc(p.weight)} · ${esc(p.category)}</span></button>`;}).join('')}</div></label><div class="orderAddActions"><label class="orderAddQty">К-сть<div class="orderAddQtyStepper"><button type="button" class="secondary minusBtn" onclick="stepOrderAddQty(this,-1)" aria-label="Мінус">−</button><input type="number" name="qty" min="1" step="1" value="1"><button type="button" onclick="stepOrderAddQty(this,1)" aria-label="Плюс">+</button></div></label><button class="orderAddSubmit">Додати</button></div></form>`;
}
function adminOrderCard(o, products){
  return `<div class="card order" data-order-id="${esc(o.id)}"><div class="actions" style="align-items:flex-start;justify-content:space-between"><div><h3 style="margin:0 0 6px">Замовлення №${o.orderNo || o.id} · ${esc(o.shop)} <span class="status">${esc(o.status)}</span></h3><p class="muted" style="margin:0">${esc(o.createdAt)} · час Варшави</p></div><div class="actions" style="align-items:center;gap:8px"><button type="button" class="secondary" data-copy="${esc(orderCopyText(o))}" onclick="copyOrder(this)">📋 Копіювати</button><form method="post" action="/admin/order-delete" data-ajax-admin-order onsubmit="return confirmOrderDelete(this)"><input type="hidden" name="id" value="${esc(o.id)}"><button class="deleteIcon" aria-label="Видалити замовлення" title="Видалити замовлення">×</button></form></div></div><ul class="orderItemsPreview">${(o.items||[]).map(i=>`<li>${esc(i.name)} · ${esc(i.weight)} × ${Number(i.qty || 0)}</li>`).join('')}</ul><div class="orderComment"><div class="orderCommentLabel">Коментар магазину:</div>${esc(o.comment||'Без коментаря')}</div><details class="orderEditToggle"><summary>Показати / приховати редагування позицій</summary><div class="orderEditToggleBody">${orderAddProductHtml(o, products)}${orderItemsEditorHtml(o)}</div></details><form class="actions" method="post" action="/admin/order-status" data-ajax-admin-order><input type="hidden" name="id" value="${esc(o.id)}"><select name="status"><option ${o.status==='Нове'?'selected':''}>Нове</option><option ${o.status==='Збирається'?'selected':''}>Збирається</option><option ${o.status==='Відправлено'?'selected':''}>Відправлено</option><option ${o.status==='Виконано'?'selected':''}>Виконано</option></select><button>Змінити статус</button></form></div>`;
}

function requireAdmin(req,res,session){ if(!session.admin){ redirect(res,'/admin-login'); return false;} return true; }
function requireShop(req,res,session){ if(!session.shop || !isValidShop(session.shop)){ redirect(res,'/'); return false;} return true; }

async function handler(req,res){ try{ const url=new URL(req.url, `http://${req.headers.host}`); const session=getSession(req,res); let db=readDb();
  if(req.method==='GET' && url.pathname==='/'){
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
    // Не очищаємо кошик при виході: він зберігається за магазином і повернеться після наступного входу.
    session.shop=null;
    session.cart=[];
    saveSession(session);
    return redirect(res,'/');
  }
  if(req.method==='GET' && url.pathname==='/about'){ if(session.shop || session.admin){ markRead(db, session, 'announcements'); db=readDb(); } db.announcements=db.announcements||[]; return send(res, layout('Оголошення', `<section><h1>Оголошення для магазинів</h1><p class="muted">Тут магазини можуть переглядати актуальні текстові оголошення від адміністратора.</p>${db.announcements.length?db.announcements.map(a=>`<div class="card announcementCard"><div class="announcementDate">${esc(a.createdAt || '')}</div><div class="announcementText">${esc(a.text || '')}</div></div>`).join(''):'<div class="card center">Оголошень поки немає</div>'}</section>`, session)); }
  if(req.method==='GET' && url.pathname==='/contacts') return redirect(res,'/chat');
  if(req.method==='GET' && url.pathname==='/chat/messages'){ if(!canUseChat(db, session)){ res.writeHead(403, {'Content-Type':'application/json; charset=utf-8'}); return res.end(JSON.stringify({ok:false})); } markRead(db, session, 'chat'); db=readDb(); res.writeHead(200, {'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store'}); return res.end(JSON.stringify({ok:true, html:chatMessagesHtml(db)})); }
  if(req.method==='GET' && url.pathname==='/chat'){ if(!canUseChat(db, session)){ if(session.shop) return send(res, layout('Чат недоступний', `<section class="card center"><h1>Чат недоступний</h1><p class="muted">Адмін ще не додав ваш магазин до учасників чату.</p></section>`, session), 403); return redirect(res,'/'); } markRead(db, session, 'chat'); db=readDb(); return send(res, layout('Чат', chatPage(db, session), session)); }
  if(req.method==='POST' && url.pathname==='/chat/send'){ if(!canUseChat(db, session)){ if(req.headers['x-requested-with']==='fetch'){ res.writeHead(403, {'Content-Type':'application/json; charset=utf-8'}); return res.end(JSON.stringify({ok:false})); } return redirect(res,'/chat'); } const b=await body(req); const text=String(b.text||'').trim(); if(text){ db.chatMessages=db.chatMessages||[]; const t=nowMs(); db.chatMessages.push({id:String(t), authorType:session.admin?'admin':'shop', author:session.admin?'Адмін':session.shop, text, createdAt:warsawTime(), createdMs:t}); writeDb(db); } if(req.headers['x-requested-with']==='fetch'){ db=readDb(); res.writeHead(200, {'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store'}); return res.end(JSON.stringify({ok:true, html:chatMessagesHtml(db)})); } return redirect(res, req.headers.referer && req.headers.referer.includes('/admin-chat') ? '/admin-chat' : '/chat'); }
  if(req.method==='GET' && url.pathname==='/admin-chat'){ if(!requireAdmin(req,res,session)) return; markRead(db, session, 'chat'); db=readDb(); return send(res, layout('Чат', adminChatPage(db, session), session)); }
  if(req.method==='POST' && url.pathname==='/admin/chat-members'){ if(!requireAdmin(req,res,session)) return; const b=await body(req); const selected=Array.isArray(b.members)?b.members:(b.members?[b.members]:[]); db.chatMembers=[...new Set(selected.map(String).filter(name=>isValidShopInDb(db,name)))]; writeDb(db); return redirect(res,'/admin-chat'); }
  if(req.method==='GET' && url.pathname==='/catalog'){ if(!requireShop(req,res,session)) return; const cat=url.searchParams.get('cat'); const onlyNew=url.searchParams.get('new')==='1'; if(onlyNew && (session.shop || session.admin)){ markRead(db, session, 'newProducts'); db=readDb(); } const products=db.products.filter(p=>!p.hidden&&(!cat||p.category===cat)&&(!onlyNew||p.isNew)); const unread=unreadCounts(db, session); return send(res, layout('Каталог', `<div class="layout2"><aside class="card side"><h3>Категорії</h3><a href="/catalog">Усі товари</a><a href="/catalog?new=1">🆕 Новинки${badge(unread.newProducts)}</a>${CATEGORIES.map(c=>`<a href="/catalog?cat=${encodeURIComponent(c)}">${CAT_ICONS[c]||'▣'} ${esc(c)}</a>`).join('')}<h3>Пошук</h3><input id="search" oninput="filterProducts()" placeholder="Пошук товарів..."></aside><section><div class="actions" style="align-items:center;justify-content:space-between;margin-bottom:12px"><h1 style="margin:0">${onlyNew?'Новинки':(cat?esc(cat):'Каталог товарів')}</h1><a class="btn cartGoto" href="/cart">Перейти в кошик (<span data-cart-count>${(session.cart||[]).reduce((a,i)=>a+Number(i.qty||0),0)}</span>)</a></div>${products.length?`<div class="listWrap"><table class="listTable"><thead><tr><th>№</th><th>Назва</th><th class="weightHead">Вага</th><th>К-сть</th></tr></thead><tbody>${products.map((p,i)=>productRow(p, session, i+1)).join('')}</tbody></table></div>`:'<div class="card center">Товарів немає</div>'}</section></div>`, session)); }
  if(req.method==='POST' && url.pathname==='/cart/add'){ if(!requireShop(req,res,session)) return; const b=await body(req); const p=db.products.find(x=>String(x.id)===String(b.id)&&!x.hidden); let itemQty=0; if(p){ const item=session.cart.find(x=>String(x.id)===String(p.id)); if(item)item.qty++; else session.cart.push({id:p.id, name:p.name, category:p.category, weight:p.weight, qty:1}); itemQty=(session.cart.find(x=>String(x.id)===String(p.id))||{}).qty||0; saveCart(session); } const count=session.cart.reduce((a,i)=>a+Number(i.qty||0),0); if(req.headers['x-requested-with']==='fetch'){ res.writeHead(200, {'Content-Type':'application/json; charset=utf-8'}); return res.end(JSON.stringify({ok:true,count,id:String(b.id),itemQty})); } return redirect(res, req.headers.referer || '/catalog'); }
  if(req.method==='GET' && url.pathname==='/cart'){ if(!requireShop(req,res,session)) return; ensureOrderNumbers(db); const totalQty=session.cart.reduce((a,i)=>a+Number(i.qty||0),0); const historyHtml=shopOrderHistoryHtml(db, session.shop); return send(res, layout('Кошик', `<div class="actions" style="align-items:center;justify-content:space-between;margin-bottom:12px"><h1 style="margin:0">Кошик</h1><a class="btn secondary" href="/catalog">Продовжити покупки</a></div><div data-cart-page>${session.cart.length?`<div class="cartSummary"><div><b>Ваше замовлення</b><div class="muted">У кошику ${totalQty} шт. · ${session.cart.length} позицій</div></div><a class="btn" href="/checkout">Оформити замовлення</a></div><div class="listWrap"><table class="listTable cartTable"><thead><tr><th>№</th><th>Назва</th><th class="weightHead">Вага</th><th class="catHead">Категорія</th><th>К-сть</th><th>×</th></tr></thead><tbody>${session.cart.map((i,n)=>`<tr data-cart-row="${i.id}"><td class="num">${n+1}</td><td class="mainCell"><span class="name">${esc(i.name)}</span><span class="mobileMeta">${esc(i.weight)} · ${esc(i.category)}</span></td><td class="weight">${esc(i.weight)}</td><td class="catCell">${CAT_ICONS[i.category]||'▣'} ${esc(i.category)}</td><td class="qtyCell"><form class="listQty" method="post" action="/cart/qty" data-ajax-cart data-action="qty" onsubmit="event.preventDefault(); return changeQty(this)"><input type="hidden" name="id" value="${i.id}"><input type="hidden" name="delta" value="0"><button type="button" onclick="changeQty(this.form,-1)" class="secondary iconBtn minusBtn" aria-label="Мінус">−</button><div class="qtynum" data-row-qty>${i.qty}</div><button type="button" onclick="changeQty(this.form,1)" class="iconBtn" aria-label="Додати">+</button></form></td><td class="deleteCell"><form method="post" action="/cart/remove" data-ajax-cart data-action="remove" onsubmit="event.preventDefault(); return removeCart(this)"><input type="hidden" name="id" value="${i.id}"><button class="deleteIcon" aria-label="Видалити">×</button></form></td></tr>`).join('')}</tbody></table></div><br><div class="actions"><a class="btn" href="/checkout">Оформити замовлення</a><form method="post" action="/cart/clear" data-ajax-cart data-action="clear" onsubmit="event.preventDefault(); return clearCart(this)"><button class="danger">Очистити кошик</button></form></div>`:'<section class="card center"><p>Кошик порожній</p><a class="btn" href="/catalog">До каталогу</a></section>'}</div>${historyHtml}`, session)); }
    if(req.method==='POST' && url.pathname==='/cart/qty'){ if(!requireShop(req,res,session)) return; const b=await body(req); const item=session.cart.find(x=>String(x.id)===String(b.id)); if(item){item.qty+=Number(b.delta||0); if(item.qty<1) session.cart=session.cart.filter(x=>String(x.id)!==String(b.id));} saveCart(session); const count=session.cart.reduce((a,i)=>a+Number(i.qty||0),0); const itemQty=(session.cart.find(x=>String(x.id)===String(b.id))||{}).qty||0; if(req.headers['x-requested-with']==='fetch'){ res.writeHead(200, {'Content-Type':'application/json; charset=utf-8'}); return res.end(JSON.stringify({ok:true,count,id:String(b.id),itemQty})); } return redirect(res,'/cart'); }
  if(req.method==='POST' && url.pathname==='/cart/remove'){ if(!requireShop(req,res,session)) return; const b=await body(req); session.cart=session.cart.filter(x=>String(x.id)!==String(b.id)); saveCart(session); const count=session.cart.reduce((a,i)=>a+Number(i.qty||0),0); if(req.headers['x-requested-with']==='fetch'){ res.writeHead(200, {'Content-Type':'application/json; charset=utf-8'}); return res.end(JSON.stringify({ok:true,count,id:String(b.id),itemQty:0})); } return redirect(res,'/cart'); }
  if(req.method==='POST' && url.pathname==='/cart/clear'){ if(!requireShop(req,res,session)) return; session.cart=[]; saveCart(session); if(req.headers['x-requested-with']==='fetch'){ res.writeHead(200, {'Content-Type':'application/json; charset=utf-8'}); return res.end(JSON.stringify({ok:true,count:0,cleared:true})); } return redirect(res,'/cart'); }
  if(req.method==='GET' && url.pathname==='/checkout'){ if(!requireShop(req,res,session)) return; if(!session.cart.length) return redirect(res,'/cart'); return send(res, layout('Оформлення', `<div class="layout2"><section class="card" style="padding:22px"><h1>Оформлення замовлення</h1><div class="shopNotice">Магазин: ${esc(session.shop)}</div><form class="form" method="post" action="/checkout"><label>Коментар<textarea name="comment" rows="5" placeholder="Необовʼязково"></textarea></label><button>Надіслати замовлення</button></form></section><aside class="card side"><h3>Ваше замовлення</h3>${session.cart.map(i=>`<p><b>${esc(i.name)}</b><br>${esc(i.weight)} × ${i.qty}</p>`).join('')}</aside></div>`, session)); }
  if(req.method==='POST' && url.pathname==='/checkout'){ if(!requireShop(req,res,session)) return; const b=await body(req); if(!session.cart.length) return redirect(res,'/cart'); const orderNo=nextOrderNumber(db); db.orders.unshift({id:Date.now(), orderNo, shop:session.shop, comment:String(b.comment||'').trim(), items:session.cart, status:'Нове', createdAt:warsawTime(), timeZone:'Europe/Warsaw'}); writeDb(db); session.cart=[]; saveCart(session); return send(res, layout('Готово', `<section class="card center"><h1>Замовлення надіслано</h1><p class="muted">Замовлення надіслано від магазину <b>${esc(session.shop)}</b>.</p><a class="btn" href="/catalog">Повернутися в каталог</a></section>`, session)); }
  if(req.method==='GET' && url.pathname==='/admin-login'){ if(session.admin) return redirect(res,'/admin'); return send(res, layout('Вхід адміністратора', `<section class="card" style="max-width:460px;margin:auto;padding:24px"><h1>Вхід адміністратора</h1><form class="form" method="post" action="/admin-login"><label>Пароль<input type="password" name="password" required autofocus></label><button>Увійти</button></form></section>`, session)); }
  if(req.method==='POST' && url.pathname==='/admin-login'){ const b=await body(req); if(String(b.password)===ADMIN_PASSWORD){ session.admin=true; saveSession(session); return redirect(res,'/admin'); } return send(res, layout('Помилка входу', `<section class="card center"><h1>Невірний пароль</h1><a class="btn" href="/admin-login">Спробувати ще</a></section>`, session), 401); }
  if(req.method==='GET' && url.pathname==='/admin-logout'){ session.admin=false; saveSession(session); return redirect(res,'/'); }
  if(req.method==='GET' && url.pathname==='/admin'){ if(!requireAdmin(req,res,session)) return; ensureOrderNumbers(db); return send(res, layout('Адмін', `<div class="adminShell">${adminMenu()}<section><h1>Замовлення</h1>${db.orders.map(o=>adminOrderCard(o, db.products)).join('')||'<div class="card center">Замовлень немає</div>'}</section></div>`, session)); }
  if(req.method==='POST' && url.pathname==='/admin/order-status'){ if(!requireAdmin(req,res,session)) return; const b=await body(req); const o=db.orders.find(x=>String(x.id)===String(b.id)); if(o)o.status=String(b.status); writeDb(db); if(req.headers['x-requested-with']==='fetch' && o){ res.writeHead(200, {'Content-Type':'application/json; charset=utf-8'}); return res.end(JSON.stringify({ok:true,html:adminOrderCard(o, db.products)})); } return redirect(res,'/admin'); }
  if(req.method==='POST' && url.pathname==='/admin/order-delete'){ if(!requireAdmin(req,res,session)) return; const b=await body(req); db.orders=(db.orders||[]).filter(o=>String(o.id)!==String(b.id)); writeDb(db); if(req.headers['x-requested-with']==='fetch'){ res.writeHead(200, {'Content-Type':'application/json; charset=utf-8'}); return res.end(JSON.stringify({ok:true,removed:true})); } return redirect(res,'/admin'); }
  if(req.method==='POST' && url.pathname==='/admin/order-item-delete'){ if(!requireAdmin(req,res,session)) return; const b=await body(req); const o=db.orders.find(x=>String(x.id)===String(b.id)); const idx=Number(b.idx); if(o && Array.isArray(o.items) && Number.isInteger(idx) && idx>=0 && idx<o.items.length){ o.items.splice(idx,1); } writeDb(db); if(req.headers['x-requested-with']==='fetch' && o){ res.writeHead(200, {'Content-Type':'application/json; charset=utf-8'}); return res.end(JSON.stringify({ok:true,html:adminOrderCard(o, db.products)})); } return redirect(res,'/admin'); }
  if(req.method==='POST' && url.pathname==='/admin/order-item-qty'){ if(!requireAdmin(req,res,session)) return; const b=await body(req); const o=db.orders.find(x=>String(x.id)===String(b.id)); const idx=Number(b.idx); if(o && Array.isArray(o.items) && Number.isInteger(idx) && idx>=0 && idx<o.items.length){ const cur=Math.max(1, Math.floor(Number(o.items[idx].qty)||1)); if(b.delta!==undefined){ o.items[idx].qty=Math.max(1, cur + Math.floor(Number(b.delta)||0)); } else { o.items[idx].qty=Math.max(1, Math.floor(Number(b.qty)||1)); } } writeDb(db); if(req.headers['x-requested-with']==='fetch' && o){ res.writeHead(200, {'Content-Type':'application/json; charset=utf-8'}); return res.end(JSON.stringify({ok:true,html:adminOrderCard(o, db.products)})); } return redirect(res,'/admin'); }
  if(req.method==='POST' && url.pathname==='/admin/order-item-add'){ if(!requireAdmin(req,res,session)) return; const b=await body(req); const o=db.orders.find(x=>String(x.id)===String(b.id)); const searchText=String(b.productSearch||'').trim().toLowerCase(); const p=db.products.find(x=>String(x.id)===String(b.productId) && !x.hidden) || db.products.find(x=>!x.hidden && `${x.name} · ${x.weight} · ${x.category}`.toLowerCase()===searchText); const qty=Math.max(1, Math.floor(Number(b.qty)||1)); if(o && p){ o.items=Array.isArray(o.items)?o.items:[]; const existing=o.items.find(i=>String(i.id)===String(p.id)); if(existing){ existing.qty=Number(existing.qty||0)+qty; } else { o.items.push({id:p.id, name:p.name, category:p.category, weight:p.weight, qty}); } } writeDb(db); if(req.headers['x-requested-with']==='fetch' && o){ res.writeHead(200, {'Content-Type':'application/json; charset=utf-8'}); return res.end(JSON.stringify({ok:true,html:adminOrderCard(o, db.products)})); } return redirect(res,'/admin'); }
  if(req.method==='POST' && url.pathname==='/admin/order-items-apply'){ if(!requireAdmin(req,res,session)) return; const b=await body(req); const o=db.orders.find(x=>String(x.id)===String(b.id)); if(o){ let items=[]; try{ items=JSON.parse(String(b.itemsJson||'[]')); }catch(e){ items=[]; } if(Array.isArray(items)){ o.items=items.map(i=>{ const p=db.products.find(x=>String(x.id)===String(i.id)); const qty=Math.max(1, Math.floor(Number(i.qty)||1)); return {id:String(i.id||''), name:String((p&&p.name)||i.name||'').trim(), category:String((p&&p.category)||i.category||'').trim(), weight:String((p&&p.weight)||i.weight||'').trim(), qty}; }).filter(i=>i.name && i.qty>0); } } writeDb(db); if(req.headers['x-requested-with']==='fetch' && o){ res.writeHead(200, {'Content-Type':'application/json; charset=utf-8'}); return res.end(JSON.stringify({ok:true,html:adminOrderCard(o, db.products)})); } return redirect(res,'/admin'); }
  if(req.method==='GET' && url.pathname==='/admin-notes'){ if(!requireAdmin(req,res,session)) return; db.notes=db.notes||[]; return send(res, layout('Нотатки', `<div class="adminShell">${adminMenu()}<section><h1>Нотатки</h1><div class="card" style="padding:20px;margin-bottom:16px"><form class="form noteForm" method="post" action="/admin/note"><label>Нова нотатка<textarea name="text" required placeholder="Запишіть тут інформацію для себе..."></textarea></label><button>Додати нотатку</button></form></div>${db.notes.length?db.notes.map(n=>`<div class="card noteCard"><div class="noteDate">${esc(n.createdAt || '')}</div><div class="noteText">${esc(n.text || '')}</div><form method="post" action="/admin/note-delete" onsubmit="return confirm('Видалити нотатку?')"><input type="hidden" name="id" value="${esc(n.id)}"><button class="danger">Видалити</button></form></div>`).join(''):'<div class="card center">Нотаток поки немає</div>'}</section></div>`, session)); }
  if(req.method==='POST' && url.pathname==='/admin/note'){ if(!requireAdmin(req,res,session)) return; const b=await body(req); const text=String(b.text||'').trim(); if(text){ db.notes=db.notes||[]; db.notes.unshift({id:String(Date.now()), text, createdAt:warsawTime()}); writeDb(db); } return redirect(res,'/admin-notes'); }
  if(req.method==='POST' && url.pathname==='/admin/note-delete'){ if(!requireAdmin(req,res,session)) return; const b=await body(req); db.notes=(db.notes||[]).filter(n=>String(n.id)!==String(b.id)); writeDb(db); return redirect(res,'/admin-notes'); }
  if(req.method==='GET' && url.pathname==='/admin-announcements'){ if(!requireAdmin(req,res,session)) return; db.announcements=db.announcements||[]; return send(res, layout('Оголошення', `<div class="adminShell">${adminMenu()}<section><h1>Оголошення</h1><div class="card" style="padding:20px;margin-bottom:16px"><form class="form noteForm" method="post" action="/admin/announcement"><label>Нове оголошення для магазинів<textarea name="text" required placeholder="Напишіть текст оголошення, яке побачать магазини..."></textarea></label><button>Додати оголошення</button></form></div>${db.announcements.length?db.announcements.map(a=>`<div class="card announcementCard"><div class="announcementDate">${esc(a.createdAt || '')}</div><div class="announcementText">${esc(a.text || '')}</div><form method="post" action="/admin/announcement-delete" onsubmit="return confirm('Видалити оголошення?')"><input type="hidden" name="id" value="${esc(a.id)}"><button class="danger">Видалити</button></form></div>`).join(''):'<div class="card center">Оголошень поки немає</div>'}</section></div>`, session)); }
  if(req.method==='POST' && url.pathname==='/admin/announcement'){ if(!requireAdmin(req,res,session)) return; const b=await body(req); const text=String(b.text||'').trim(); if(text){ db.announcements=db.announcements||[]; const t=nowMs(); db.announcements.unshift({id:String(t), text, createdAt:warsawTime(), createdMs:t}); writeDb(db); } return redirect(res,'/admin-announcements'); }
  if(req.method==='POST' && url.pathname==='/admin/announcement-delete'){ if(!requireAdmin(req,res,session)) return; const b=await body(req); db.announcements=(db.announcements||[]).filter(a=>String(a.id)!==String(b.id)); writeDb(db); return redirect(res,'/admin-announcements'); }
  if(req.method==='GET' && url.pathname==='/admin-settings'){ if(!requireAdmin(req,res,session)) return; const shops=getShops(db); return send(res, layout('Налаштування магазинів', `<div class="adminShell">${adminMenu()}<section><div class="actions" style="align-items:center;justify-content:space-between;margin-bottom:12px"><h1 style="margin:0">Налаштування магазинів</h1></div><div class="card" style="padding:20px;margin-bottom:16px"><h2>Додати новий магазин</h2><form class="form" method="post" action="/admin/shop-add"><label>Назва магазину<input name="name" required placeholder="Наприклад: Новий магазин"></label><label>Пароль для входу<input type="text" name="password" required placeholder="Пароль для магазину"></label><button>Додати магазин</button></form></div>${shops.length?`<div class="listWrap"><table class="listTable"><thead><tr><th>№</th><th>Назва магазину</th><th>Новий пароль</th><th>Дії</th><th>×</th></tr></thead><tbody>${shops.map((shop,i)=>{const formId=`shop-update-${esc(shop.id)}`; return `<tr><td class="num">${i+1}</td><td><form id="${formId}" method="post" action="/admin/shop-update"></form><input form="${formId}" type="hidden" name="id" value="${esc(shop.id)}"><input form="${formId}" name="name" value="${esc(shop.name)}" required></td><td><input form="${formId}" type="text" name="password" value="${esc(shop.password)}" required></td><td><button form="${formId}">Зберегти</button></td><td class="deleteCell"><form method="post" action="/admin/shop-delete" onsubmit="return confirm('Видалити магазин?')"><input type="hidden" name="id" value="${esc(shop.id)}"><button class="deleteIcon" aria-label="Видалити">×</button></form></td></tr>`}).join('')}</tbody></table></div>`:'<div class="card center">Магазинів поки немає</div>'}</section></div>`, session)); }
  if(req.method==='POST' && url.pathname==='/admin/shop-add'){ if(!requireAdmin(req,res,session)) return; const b=await body(req); const name=String(b.name||'').trim(); const password=String(b.password||'').trim(); if(name && password && !getShops(db).some(s=>s.name===name)){ db.shops.push({id:String(Date.now()), name, password}); writeDb(db); } return redirect(res,'/admin-settings'); }
  if(req.method==='POST' && url.pathname==='/admin/shop-update'){ if(!requireAdmin(req,res,session)) return; const b=await body(req); const shops=getShops(db); const shop=shops.find(s=>String(s.id)===String(b.id)); const oldName=shop && shop.name; const newName=String(b.name||'').trim(); const password=String(b.password||'').trim(); if(shop && newName && password && !shops.some(s=>s.id!==shop.id && s.name===newName)){ shop.name=newName; shop.password=password; if(oldName && oldName!==newName){ db.carts=db.carts||{}; if(db.carts[`shop:${oldName}`] && !db.carts[`shop:${newName}`]){ db.carts[`shop:${newName}`]=db.carts[`shop:${oldName}`]; delete db.carts[`shop:${oldName}`]; } for(const sid of Object.keys(db.sessions||{})){ if(db.sessions[sid].shop===oldName) db.sessions[sid].shop=newName; } for(const saved of sessions.values()){ if(saved.shop===oldName) saved.shop=newName; } } writeDb(db); } return redirect(res,'/admin-settings'); }
  if(req.method==='POST' && url.pathname==='/admin/shop-delete'){ if(!requireAdmin(req,res,session)) return; const b=await body(req); const shop=findShopById(db, b.id); if(shop){ db.shops=getShops(db).filter(s=>s.id!==shop.id); db.carts=db.carts||{}; delete db.carts[`shop:${shop.name}`]; db.chatMembers=(db.chatMembers||[]).filter(name=>name!==shop.name); for(const sid of Object.keys(db.sessions||{})){ if(db.sessions[sid].shop===shop.name) db.sessions[sid].shop=null; } for(const saved of sessions.values()){ if(saved.shop===shop.name){ saved.shop=null; saved.cart=[]; } } writeDb(db); } return redirect(res,'/admin-settings'); }
  if(req.method==='GET' && url.pathname==='/admin-products'){ if(!requireAdmin(req,res,session)) return; const cat=url.searchParams.get('cat')||''; const products=db.products.filter(p=>!cat||p.category===cat); return send(res, layout('Товари', `<div class="adminShell">${adminMenu()}<section><h1>Товари</h1><div class="card" style="padding:20px"><form class="form" method="post" action="/admin/product"><label>Категорія<select name="category">${CATEGORIES.map(c=>`<option>${esc(c)}</option>`).join('')}</select></label><label>Назва<input name="name" required></label><label>Вага / обʼєм<input name="weight" required></label><label style="display:flex;grid-template-columns:auto 1fr;align-items:center;gap:10px"><input type="checkbox" name="isNew" style="width:auto"> Додати в новинки</label><button>Додати товар</button></form></div><br><div class="actions"><a class="btn secondary" href="/admin-products">Усі</a>${CATEGORIES.map(c=>`<a class="btn secondary" href="/admin-products?cat=${encodeURIComponent(c)}">${CAT_ICONS[c]||'▣'} ${esc(c)}</a>`).join('')}</div><br><div class="card" style="padding:14px;margin-bottom:14px"><label>Пошук товару в адмінці<input id="search" oninput="filterProducts()" placeholder="Введіть назву або вагу..."></label></div>${products.length?`<div class="listWrap"><table class="listTable"><thead><tr><th>№</th><th>Назва</th><th class="weightHead">Вага</th><th>Показ</th><th>new</th><th>×</th></tr></thead><tbody>${products.map((p,i)=>adminProductRow(p, i+1)).join('')}</tbody></table></div>`:'<div class="card center">Товарів немає</div>'}</section></div>`, session)); }
  if(req.method==='POST' && url.pathname==='/admin/product'){ if(!requireAdmin(req,res,session)) return; const b=await body(req); const t=nowMs(); const isNew=b.isNew==='on'; db.products.push({id:t, name:String(b.name||'').trim(), category:String(b.category||CATEGORIES[0]), weight:String(b.weight||'').trim(), isNew, newAt:isNew?t:0, hidden:false}); writeDb(db); return redirect(res,'/admin-products?cat='+encodeURIComponent(String(b.category||''))); }
  if(req.method==='POST' && url.pathname==='/admin/product-toggle-hidden'){ if(!requireAdmin(req,res,session)) return; const b=await body(req); const p=db.products.find(x=>String(x.id)===String(b.id)); if(p)p.hidden=!p.hidden; writeDb(db); return redirect(res, req.headers.referer || '/admin-products'); }
  if(req.method==='POST' && url.pathname==='/admin/product-new'){ if(!requireAdmin(req,res,session)) return; const b=await body(req); const p=db.products.find(x=>String(x.id)===String(b.id)); if(p){ p.isNew=!p.isNew; p.newAt=p.isNew?nowMs():0; } writeDb(db); return redirect(res, req.headers.referer || '/admin-products'); }
  if(req.method==='POST' && url.pathname==='/admin/product-delete'){ if(!requireAdmin(req,res,session)) return; const b=await body(req); db.products=db.products.filter(p=>String(p.id)!==String(b.id)); writeDb(db); return redirect(res,'/admin-products'); }
  if(req.method==='GET' && url.pathname==='/health') { res.writeHead(200, {'Content-Type':'application/json'}); return res.end(JSON.stringify({ok:true})); }
  return notFound(res);
} catch(e){ console.error('SERVER ERROR', e); send(res, layout('Помилка', `<section class="card center"><h1>Помилка сервера</h1><p>${esc(e.message)}</p><a class="btn" href="/">На головну</a></section>`), 500); }}
ensureDb();
http.createServer(handler).listen(PORT, () => console.log(`Sklad public order running on port ${PORT}`));

const http = require('http');
const fs = require('fs');
const path = require('path');
const {spawn} = require('child_process');
const PORT = 43210;
const DB_FILE = path.join(__dirname, '..', 'data', 'db.json');
const dbBackup = fs.readFileSync(DB_FILE, 'utf8');
const app = spawn(process.execPath, ['server.js'], {cwd: __dirname + '/..', env:{...process.env, PORT:String(PORT)}});
function req(pathname, {method='GET', body='', cookie=''}={}){return new Promise((resolve,reject)=>{const headers={}; if(cookie) headers.Cookie=cookie; if(body){headers['Content-Type']='application/x-www-form-urlencoded'; headers['Content-Length']=Buffer.byteLength(body);} const r=http.request({hostname:'127.0.0.1',port:PORT,path:pathname,method,headers},res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>resolve({status:res.statusCode,body:d,headers:res.headers,cookie:(res.headers['set-cookie']||[]).map(x=>x.split(';')[0]).join('; ')}));}); r.on('error',reject); if(body) r.write(body); r.end();});}
async function finish(code){ app.kill(); fs.writeFileSync(DB_FILE, dbBackup); process.exit(code); }
setTimeout(async()=>{try{
  for(const p of ['/', '/catalog', '/cart', '/admin-login', '/health']){const r=await req(p); if(r.status>=500) throw new Error(p+' '+r.status);}
  const adminLogin=await req('/admin-login');
  const adminCookie=adminLogin.cookie;
  await req('/admin-login', {method:'POST', cookie:adminCookie, body:'password=sklepm1'});
  const members=await req('/admin/chat-members', {method:'POST', cookie:adminCookie, body:'members=%D0%9C1'});
  if(members.status !== 302) throw new Error('chat members save '+members.status);
  const shopLogin=await req('/shop-login');
  const shopCookie=shopLogin.cookie;
  await req('/shop-login', {method:'POST', cookie:shopCookie, body:'shop=%D0%9C1&password=12345678'});
  const msg='smoke chat '+Date.now();
  const sent=await req('/chat/send', {method:'POST', cookie:shopCookie, body:'text='+encodeURIComponent(msg)});
  if(sent.status !== 302) throw new Error('chat send '+sent.status);
  const db=JSON.parse(fs.readFileSync(DB_FILE,'utf8'));
  if(!db.chatMembers.includes('М1')) throw new Error('chat member was not stored');
  if(!db.chatMessages.some(m=>m.text===msg && m.author==='М1')) throw new Error('chat message was not stored');
  console.log('Smoke test passed'); await finish(0);
}catch(e){console.error(e); await finish(1);}},700);

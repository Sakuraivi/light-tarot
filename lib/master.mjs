import {createCipheriv,createDecipheriv,createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {readFile,mkdir,open,rename,unlink} from 'node:fs/promises';
import {join,resolve,isAbsolute} from 'node:path';
import {providers,legacyProvider,requestModel,providerMessage} from './providers.mjs';
import {fileURLToPath} from 'node:url';
const assets=new URL('../master/',import.meta.url);
const envelope='light-tarot/master/v1',ttl=30*60*1000,rateSpan=5*60*1000;
const validModel=s=>typeof s==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{0,119}$/.test(s);
const validKey=s=>typeof s==='string'&&/^[!-~]{8,512}$/.test(s);
const hash=s=>createHash('sha256').update(s).digest();
const loopback=h=>['127.0.0.1','localhost','[::1]','::1'].includes(h);
const same=(a,b)=>timingSafeEqual(hash(a),hash(b));
const defaultState=()=>({active:'offline',profiles:{}});
export function seal(state,key){
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
 cipher.setAAD(Buffer.from(envelope));
 const c=Buffer.concat([cipher.update(JSON.stringify(state),'utf8'),cipher.final()]);
 return JSON.stringify({v:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:c.toString('base64')});
}
export function unseal(raw,key){
 const {v,iv,tag,data}=JSON.parse(raw);
 if(v!==1)throw Error('Unsupported vault version');
 const decoder=createDecipheriv('aes-256-gcm',key,Buffer.from(iv,'base64'),{authTagLength:16});
 decoder.setAAD(Buffer.from(envelope));decoder.setAuthTag(Buffer.from(tag,'base64'));
 return JSON.parse(Buffer.concat([decoder.update(Buffer.from(data,'base64')),decoder.final()]).toString('utf8'));
}
function validState(s){
 if(!s||!s.profiles||typeof s.profiles!=='object'||Array.isArray(s.profiles))throw Error('Invalid configuration');
 if(s.active!=='offline'&&(!Object.hasOwn(providers,s.active)||!s.profiles[s.active]?.key))throw Error('Invalid configuration');
 for(const [k,v] of Object.entries(s.profiles))if(!Object.hasOwn(providers,k)||!validModel(v?.model)||!validKey(v?.key))throw Error('Invalid configuration');
 return s;
}
function setup(env,host,port){
 if(!env.TAROT_MASTER_PASSWORD&&!env.TAROT_MASTER_ENCRYPTION_KEY)return null;
 const password=env.TAROT_MASTER_PASSWORD||'', keyText=env.TAROT_MASTER_ENCRYPTION_KEY||'';
 const key=Buffer.from(keyText,'base64');
 if(password.length<24||password.length>512||key.length!==32||key.toString('base64')!==keyText)throw Error('后台需要不少于 24 字符的密码，以及 Base64 格式的 32 字节 TAROT_MASTER_ENCRYPTION_KEY。');
 const url=new URL(env.TAROT_PUBLIC_ORIGIN||`http://127.0.0.1:${port||80}`);
 if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||(url.protocol!=='https:'&&!(url.protocol==='http:'&&loopback(url.hostname)&&loopback(host))))throw Error('后台必须配置 HTTPS 的 TAROT_PUBLIC_ORIGIN（只填来源，不附路径）；仅本机回环测试可以用 HTTP。');
 if(!loopback(host))throw Error('后台开启时应用只能监听回环。请通过同机 HTTPS 反向代理对外提供服务。');
 const dir=env.TAROT_MASTER_DATA_DIR||fileURLToPath(new URL('../.tarot-data',import.meta.url));
 if(!isAbsolute(dir))throw Error('TAROT_MASTER_DATA_DIR 必须是绝对路径。');
 const path=resolve(dir), publicDir=fileURLToPath(new URL('../public',import.meta.url));
 if(path===publicDir||path.startsWith(publicDir+'/')||path.startsWith(publicDir+'\\'))throw Error('配置目录不得放进 public。');
 return {password,key,url,path};
}
export async function createMaster({env=process.env,host='127.0.0.1',port=3000,fetcher=fetch}={}){
 const cfg=setup(env,host,port),legacy=legacyProvider(env);
 let state=null;
 let queue=Promise.resolve(), testing=false;
 const sessions=new Map();
 let failed=[],requests=[];
 const json=(res,code,v)=>{res.writeHead(code,{'content-type':'application/json; charset=utf-8'});res.end(JSON.stringify(v));};
 const txt=(res,code,v)=>{res.writeHead(code,{'content-type':'text/plain; charset=utf-8'});res.end(v);};
 const tooMany=(res,retry)=>{res.setHeader('Retry-After',retry);return json(res,429,{error:'尝试过多，请稍后再试。'});};
 if(cfg){
  await mkdir(cfg.path,{recursive:true,mode:0o700});
  try{state=validState(unseal(await readFile(join(cfg.path,'providers.enc'),'utf8'),cfg.key));}
  catch(e){if(e.code!=='ENOENT')throw Error('无法解密后台配置。请核对原加密密钥；已有配置未修改。');}
 }
 function active(){
  if(!state)return legacy;
  if(state.active==='offline')return null;
  return {...providers[state.active],...state.profiles[state.active]};
 }
 function safeState(){
  const selected=state??defaultState();
  return {active:state?.active??(legacy?'legacy':'offline'),legacy:Boolean(legacy),providers:Object.fromEntries(Object.entries(providers).map(([id,p])=>[id,{label:p.label,model:selected.profiles[id]?.model??p.model,hasKey:Boolean(selected.profiles[id]?.key)}]))};
 }
 async function update(input){
  return queue=queue.catch(()=>{}).then(async()=>{
   if(!input||typeof input!=='object'||!['offline','openai','codex','deepseek'].includes(input.active)||!input.profiles||typeof input.profiles!=='object'||Array.isArray(input.profiles))throw Error('无效配置。');
   const next=structuredClone(state??defaultState());
   for(const [id,item] of Object.entries(input.profiles)){
    if(!Object.hasOwn(providers,id)||!item||!validModel(item.model)||typeof item.key!=='string'||typeof item.clear!=='boolean')throw Error('模型 ID 或配置格式不正确。');
    if(item.key&&!validKey(item.key))throw Error('Key 格式不正确，请只填写服务商 API Key。');
    if(item.clear&&item.key)throw Error('不能同时更换和清除 Key。');
    const key=item.clear?'':(item.key||next.profiles[id]?.key||'');
    if(key)next.profiles[id]={model:item.model,key};else delete next.profiles[id];
   }
   next.active=input.active;
   if(next.active!=='offline'&&!next.profiles[next.active]?.key)throw Error('请先为启用的服务填写有效的 API Key。');
   try{
    const dst=join(cfg.path,'providers.enc'),tmp=join(cfg.path,randomBytes(12).toString('hex')+'.tmp');
    try{const f=await open(tmp,'wx',0o600);try{await f.writeFile(seal(next,cfg.key),'utf8');await f.sync();}finally{await f.close();}await rename(tmp,dst);}
    finally{await unlink(tmp).catch(()=>{});}
   }catch{throw Error('无法写入配置；当前配置未更改。请检查数据目录。');}
   state=next;
   return safeState();
  });
 }
 async function body(req){
  const chunks=[];let n=0;
  for await(const b of req){n+=b.length;if(n>8192)throw Error('请求太大。');chunks.push(b);}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
 }
 function prune(now){for(const [token,expiry] of sessions)if(expiry<now)sessions.delete(token);}
 function cookie(token,clear=false){
  return `lt_master=${token}; Path=/master; HttpOnly; SameSite=Strict; Max-Age=${clear?0:ttl/1000}${cfg.url.protocol==='https:'?'; Secure':''}`;
 }
 async function handle(req,res,path){
  if(path!=='/master'&&!path.startsWith('/master/'))return false;
  const now=Date.now();
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Robots-Tag','noindex, nofollow');res.setHeader('Cross-Origin-Resource-Policy','same-origin');
  if(!cfg){txt(res,404,'未找到。');return true;}
  if(req.headers.host!==cfg.url.host){txt(res,421,'请使用已配置的管理域名。');return true;}
  if(path==='/master/'&&req.method==='GET'){res.writeHead(308,{location:'/master'});res.end();return true;}
  const file={
   '/master':['index.html','text/html; charset=utf-8'],
   '/master/app.mjs':['app.mjs','text/javascript; charset=utf-8'],
   '/master/style.css':['style.css','text/css; charset=utf-8']
  }[path];
  if(file&&req.method==='GET'){res.writeHead(200,{'content-type':file[1]});res.end(await readFile(new URL(file[0],assets)));return true;}
  if(req.method==='POST'&&(req.headers.origin!==cfg.url.origin||!/^application\/json(?:;|$)/i.test(req.headers['content-type']??''))){
   json(res,403,{error:'只接受同源管理请求。'});return true;
  }
  prune(now);
  if(path==='/master/api/login'&&req.method==='POST'){
   failed=failed.filter(t=>now-t<rateSpan);
   if(failed.length>=10){tooMany(res,300);return true;}
   let input;try{input=await body(req);}catch{json(res,400,{error:'请求格式不正确。'});return true;}
   if(typeof input?.password!=='string'||input.password.length>512||!same(input.password,cfg.password)){
    failed.push(now);json(res,401,{error:'密码不正确。'});return true;
   }
   const token=randomBytes(32).toString('base64url');
   if(sessions.size>=128)sessions.delete(sessions.keys().next().value);
   sessions.set(token,now+ttl);res.setHeader('Set-Cookie',cookie(token));json(res,200,{ok:true});return true;
  }
  if(!['/master/api/logout','/master/api/settings','/master/api/test'].includes(path)){txt(res,404,'未找到。');return true;}
  const token=(req.headers.cookie||'').match(/(?:^|;\s*)lt_master=([A-Za-z0-9_-]{43})(?:;|$)/)?.[1];
  if(!token||!sessions.has(token)){json(res,401,{error:'请先登录。'});return true;}
  if(path==='/master/api/logout'&&req.method==='POST'){sessions.delete(token);res.setHeader('Set-Cookie',cookie('',true));json(res,200,{ok:true});return true;}
  if(path==='/master/api/settings'&&req.method==='GET'){json(res,200,safeState());return true;}
  if(path==='/master/api/settings'&&req.method==='POST'){
   try{json(res,200,await update(await body(req)));}catch(e){json(res,400,{error:e instanceof SyntaxError?'请求格式不正确。':e.message});}
   return true;
  }
  if(path==='/master/api/test'&&req.method==='POST'){
   requests=requests.filter(t=>now-t<rateSpan);
   if(testing||requests.length>=5){tooMany(res,300);return true;}
   let input;try{input=await body(req);}catch{json(res,400,{error:'请求格式不正确。'});return true;}
   const name=input?.provider;
   if(!Object.hasOwn(providers,name)||!state?.profiles[name]){json(res,400,{error:'没有已保存的服务配置。'});return true;}
   const p={...providers[name],...state.profiles[name]};
   requests.push(now);testing=true;
   try{await requestModel(p,'Reply briefly and do not use tools.','只回复：连接成功。',{probe:true,fetcher});json(res,200,{ok:true,message:'模型成功返回文字。'});}
   catch(e){json(res,502,{error:providerMessage(e.code)});}
   finally{testing=false;}
   return true;
  }
  json(res,405,{error:'不支持的请求。'});return true;
 }
 return {handle,active};
}

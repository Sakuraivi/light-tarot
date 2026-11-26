import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {mkdtemp,readFile,rm,stat,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {createMaster,seal,unseal} from '../lib/master.mjs';

const dir=await mkdtemp(join(tmpdir(),'lt-master-test-'));
let service;
const log=[];
const mock=async(url,req)=>{
 const body=JSON.parse(req.body);
 log.push({url,body});
 assert.equal(req.redirect,'error');
 assert.match(req.headers.authorization,/^Bearer fake-/);
 if(url.includes('deepseek'))assert.equal(body.thinking.type,'disabled');
 return new Response(JSON.stringify(url.includes('deepseek')?{choices:[{message:{content:'成功。'}}]}:{status:'completed',output:[{type:'message',content:[{type:'output_text',text:'成功。'}]}]}));
};
const server=createServer(async(req,res)=>{if(!await service.handle(req,res,new URL(req.url,'http://localhost').pathname))res.writeHead(404).end();});
server.listen(0,'127.0.0.1');await once(server,'listening');
const origin='http://127.0.0.1:'+server.address().port;
const pw=randomBytes(24).toString('base64url');
const env={TAROT_MASTER_PASSWORD:pw,TAROT_MASTER_ENCRYPTION_KEY:randomBytes(32).toString('base64'),TAROT_MASTER_DATA_DIR:dir,TAROT_PUBLIC_ORIGIN:origin};
try{
 service=await createMaster({env:{},fetcher:mock});assert.equal((await fetch(origin+'/master')).status,404);
 service=await createMaster({env,fetcher:mock});
 assert.equal((await fetch(origin+'/master')).status,200);
 const endpoint=origin+'/master/api/';
 const post=(path,obj,auth='',from=origin)=>fetch(endpoint+path,{method:'POST',headers:{'Content-Type':'application/json',origin:from,cookie:auth},body:JSON.stringify(obj)});
 assert.equal((await fetch(endpoint+'settings')).status,401);
 assert.equal((await post('login',{password:pw},'','https://not-the-admin.example')).status,403);
 assert.equal((await post('login',{password:'fake-wrong-password'})).status,401);
 const login=await post('login',{password:pw});assert.equal(login.status,200);
 const set=login.headers.get('set-cookie');
 for(const attr of ['HttpOnly','SameSite=Strict','Path=/master'])assert.ok(set.includes(attr));
 const cookie=set.split(';')[0];
 assert.equal((await post('test',{provider:'openai'},cookie)).status,400);
 const profiles={openai:{key:'fake-openai-token',model:'gpt-5-mini',clear:false},deepseek:{key:'fake-deepseek-token',model:'deepseek-flash',clear:false}};
 const saved=await post('settings',{active:'deepseek',profiles},cookie);assert.equal(saved.status,200);
 const dashboard=await saved.json();
 assert.doesNotMatch(JSON.stringify(dashboard),/fake-|token/);
 assert.deepEqual(Object.keys(dashboard.providers),['openai','deepseek']);
 assert.equal(service.active().model,'deepseek-flash');
 const cipher=await readFile(join(dir,'providers.enc'),'utf8');assert.doesNotMatch(cipher,/fake-|deepseek-flash/);
 if(process.platform!=='win32')assert.equal((await stat(join(dir,'providers.enc'))).mode&0o777,0o600);
 for(const provider of Object.keys(profiles))assert.equal((await post('test',{provider},cookie)).status,200);
 assert.deepEqual(log.map(x=>[x.url,x.body.model]),[['https://api.openai.com/v1/responses','gpt-5-mini'],['https://api.deepseek.com/chat/completions','deepseek-flash']]);
 assert.equal(log[0].body.store,false);
 const wipe={...profiles.deepseek,key:'',clear:true};
 assert.equal((await post('settings',{active:'deepseek',profiles:{deepseek:wipe}},cookie)).status,400);
 assert.equal((await post('settings',{active:'openai',profiles:{openai:{...profiles.openai,key:''},deepseek:wipe}},cookie)).status,200);
 assert.equal(service.active().key,'fake-openai-token');
 assert.equal((await post('logout',{},cookie)).status,200);
 assert.equal((await fetch(endpoint+'settings',{headers:{cookie}})).status,401);
 await assert.rejects(createMaster({env:{...env,TAROT_MASTER_ENCRYPTION_KEY:randomBytes(32).toString('base64')},fetcher:mock}),/无法解密/);
 service=await createMaster({env,fetcher:mock});
 assert.equal(service.active().model,'gpt-5-mini');
 assert.equal((await post('login',{password:pw},cookie,'https://not-the-admin.example')).status,403);
 const oldProfiles={openai:{model:'gpt-5-mini',key:'fake-original-openai-key'},codex:{model:'gpt-5-codex',key:'fake-original-codex-key'},deepseek:{model:'deepseek-flash',key:'fake-original-deepseek-key'}};
 const vault=join(dir,'providers.enc'), key=Buffer.from(env.TAROT_MASTER_ENCRYPTION_KEY,'base64');
 for(const [old,expectedModel,expectedKey] of [
  [{active:'openai',profiles:oldProfiles},'gpt-5-mini',oldProfiles.openai.key],
  [{active:'deepseek',profiles:oldProfiles},'deepseek-flash',oldProfiles.deepseek.key],
  [{active:'codex',profiles:oldProfiles},'gpt-5-codex',oldProfiles.codex.key],
  [{active:'offline',profiles:{codex:oldProfiles.codex}},null,null]
 ]){
  const sealed=seal(old,key);
  await writeFile(vault,sealed);
  service=await createMaster({env,fetcher:mock});
  assert.equal(service.active()?.model??null,expectedModel);
  assert.equal(service.active()?.key??null,expectedKey);
  assert.equal(await readFile(vault,'utf8'),sealed,'no rewrite at startup');
 }
 await writeFile(vault,seal({active:'codex',profiles:oldProfiles},key));
 service=await createMaster({env,fetcher:mock});
 const login2=await post('login',{password:pw}), auth2=login2.headers.get('set-cookie').split(';')[0];
 const migrated=await (await fetch(endpoint+'settings',{headers:{cookie:auth2}})).json();
 assert.equal(migrated.active,'openai');assert.equal(migrated.providers.openai.model,'gpt-5-codex');assert.equal(migrated.providers.codex,undefined);
 assert.equal((await post('test',{provider:'openai'},auth2)).status,200);
 assert.equal(log.at(-1).body.model,'gpt-5-codex');assert.equal(log.at(-1).url,'https://api.openai.com/v1/responses');
 assert.equal((await post('settings',{active:'openai',profiles:{openai:{model:'gpt-5-codex',key:'',clear:false}}},auth2)).status,200);
 assert.equal(unseal(await readFile(vault,'utf8'),key).profiles.codex,undefined);
 assert.equal(service.active().key,oldProfiles.codex.key);
 console.log('通过：后台保护、OpenAI/Codex 模型与 DeepSeek、配置加密、升级迁移及重启恢复。');
}finally{server.close();await rm(dir,{recursive:true,force:true});}

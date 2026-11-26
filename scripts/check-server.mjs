import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {pickCards} from '../public/core.mjs';
const calls=[];
const mock=createServer(async(req,res)=>{
 let body='';for await(const part of req)body+=part;
 const input=JSON.parse(body);
 calls.push(JSON.parse(input.messages[1].content));
 assert.equal(req.headers.authorization,'Bearer mock-token');
 res.writeHead(calls.length===1?502:200,{'content-type':'application/json'});
 res.end(calls.length===1?'{}':JSON.stringify({choices:[{message:{content:'这是一段假的、可重复的测试结果。\n\n第二段只用来验证接口。'}}]}));
});
mock.listen(0,'127.0.0.1');await once(mock,'listening');
const listen=mock.address().port;
const app=spawn(process.execPath,['server.mjs'],{env:{...process.env,HOST:'127.0.0.1',PORT:'0',TAROT_API_URL:'http://127.0.0.1:'+listen+'/mock',TAROT_API_KEY:'mock-token',TAROT_MODEL:'mock'}});
let origin;
let output='';
app.stdout.on('data',b=>{output+=b;origin=output.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];});
try{
 for(let i=0;i<100&&!origin;i++)await delay(50);
 assert.ok(origin,output);
 assert.equal(await (await fetch(origin+'/api/config')).text(),'{"live":true}');
 let asset=await fetch(origin+'/akashic/card-78.jpg');assert.equal(asset.status,200);assert.equal(asset.headers.get('content-type'),'image/jpeg');
 const payload=JSON.stringify({question:'接口测试',spread:'core',cards:pickCards('core')});
 const post=(extra={})=>fetch(origin+'/api/read',{method:'POST',headers:{'content-type':'application/json',...extra},body:payload});
 assert.equal((await post({'sec-fetch-site':'cross-site'})).status,403);
 assert.equal((await post()).status,502);
 const next=await post();assert.equal(next.status,200);
 assert.equal((await next.json()).copy.length,2);
 assert.equal(calls.length,2);assert.deepEqual(calls[0],calls[1]);
 console.log('通过：资源、配置、跨站限制、模拟服务失败与原牌重试');
}finally{app.kill();mock.close();}

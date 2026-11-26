const $=s=>document.querySelector(s), login=$('#login'), settings=$('#settings'), logout=$('#logout'), status=$('#status');
const keys=['openai','codex','deepseek'];
const labels={openai:'OpenAI Platform API Key；通过 Responses API 解读。',codex:'使用有模型权限的 OpenAI Platform API Key。不要粘贴 ChatGPT 登录令牌、Codex 登录缓存或订阅凭据。',deepseek:'使用 DeepSeek API Key；通过 Chat Completions 解读。'};
let rendered;
function msg(text='',error=false){status.hidden=!text;status.textContent=text;status.dataset.error=String(error);}
async function api(name,data){
 const r=await fetch('/master/api/'+name,data===undefined?{cache:'no-store'}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),cache:'no-store'});
 const out=await r.json();
 if(!r.ok)throw Object.assign(new Error(out.error||'请求失败。'),{status:r.status});
 return out;
}
function loggedOut(){settings.hidden=true;logout.hidden=true;login.hidden=false;$('#providers').replaceChildren();$('#password').value='';}
function render(data){
 rendered=data;
 login.hidden=true;settings.hidden=false;logout.hidden=false;
 const active=$('#active');active.replaceChildren();
 active.add(new Option('离线试读（不调用模型）','offline'));
 for(const id of keys)active.add(new Option(data.providers[id].label,id));
 if(data.active==='legacy'){
  const a=new Option('当前使用环境变量服务（保存将改用本页配置）','legacy');a.disabled=true;active.add(a);
 }
 active.value=data.active;
 const container=$('#providers');container.replaceChildren();
 for(const id of keys){
  const p=data.providers[id], e=document.createElement('section');
  e.className='provider';e.id='profile-'+id;
  e.innerHTML='<div class="provider-top"><h2></h2><span class="badge"></span></div><p></p><div class="fields"><label>模型 ID <input class="model" required maxlength="120" spellcheck="false" autocomplete="off"></label><label>API Key <input class="key" type="password" maxlength="512" autocomplete="new-password"></label></div><div class="tools"><label><input class="clear" type="checkbox"> 清除已保存的 Key</label><button type="button" class="quiet test">测试已保存的连接</button></div>';
  e.querySelector('h2').textContent=p.label;e.querySelector('.badge').textContent=p.hasKey?'已配置':'未配置';
  e.querySelector('p').textContent=labels[id];e.querySelector('.model').value=p.model;
  e.querySelector('.key').placeholder=p.hasKey?'已保存，留空不改':'请输入服务商 Key';
  e.querySelector('.clear').disabled=!p.hasKey;
  const test=e.querySelector('.test');test.disabled=!p.hasKey;
  test.onclick=async()=>{
   test.disabled=true;msg('正在发送一次固定测试请求…');
   try{const r=await api('test',{provider:id});msg(p.label+'：'+r.message);}
   catch(err){if(err.status===401)loggedOut();msg(err.message,true);}
   finally{test.disabled=false;}
  };
  container.append(e);
 }
}
login.onsubmit=async e=>{
 e.preventDefault();const b=login.querySelector('button');b.disabled=true;
 try{await api('login',{password:$('#password').value});$('#password').value='';render(await api('settings'));msg();}
 catch(err){msg(err.message,true);}finally{b.disabled=false;}
};
settings.onsubmit=async e=>{
 e.preventDefault();const b=settings.querySelector('button[type=submit]');b.disabled=true;
 try{
  const active=$('#active').value;if(active==='legacy')throw Error('请选择一种服务或离线试读，再保存。');
  const profiles=Object.fromEntries(keys.map(id=>{const row=$('#profile-'+id);return [id,{model:row.querySelector('.model').value.trim(),key:row.querySelector('.key').value.trim(),clear:row.querySelector('.clear').checked}];}));
  const changed=await api('settings',{active,profiles});render(changed);msg('配置已保存并生效。');
 }catch(err){if(err.status===401)loggedOut();msg(err.message,true);}finally{b.disabled=false;}
};
logout.onclick=async()=>{try{await api('logout',{});loggedOut();msg('已退出。');}catch(err){if(err.status===401)loggedOut();msg(err.message,true);}};
api('settings').then(render).catch(e=>{loggedOut();if(e.status!==401)msg(e.message,true);});

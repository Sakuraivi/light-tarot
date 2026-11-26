import {assess,chooseSpread,deck,limit,normalizeQuestion,pickCards,previewReading,spreads} from './core.mjs';
import {makePoster} from './poster.mjs';
const $=(s,p=document)=>p.querySelector(s);
const stage=$('#stage'),app=$('main');
const brand='LIGHT TAROT',store='light-tarot.history.1';
const sigil=$('.sigil').outerHTML;
const esc=(value)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pic=(id,attr='')=>`<img src="${deck[id-1].src}" ${attr}>`;
$('.card-wall').innerHTML=[4,10,15,19,22,3,5,7,9].map(id=>pic(id,'alt=""')).join('');
const number=(n)=>String(n).padStart(2,'0');
const edition=()=> 'NO. '+String(serial).padStart(3,'0');
const headings=['你在困惑什么？','你想知道什么？','你在思考什么？'];
let serial=1,live=false,busy=false,pending=null,current=null,modal=null,previousFocus=null,posterUrl=null,configReady;
let history=readHistory(), storageWarning='';
function readHistory(){
 try{const rows=JSON.parse(localStorage.getItem(store)||'[]');return Array.isArray(rows)?rows.filter(r=>assess(r)&&typeof r.uid==='string'&&Number.isFinite(r.time)&&Array.isArray(r.copy)&&r.copy.every(p=>typeof p==='string')).slice(0,50):[];}
 catch{return [];}
}
function writeHistory(){
 try{localStorage.setItem(store,JSON.stringify(history));storageWarning='';}
 catch{storageWarning='此浏览器无法保存旧问题，本次内容只保留在当前页面。';}
}
function setEdition(){$('.edition').textContent=edition();}
function up(){window.scrollTo({top:0,behavior:'instant'});}
function deckMarkup(){return `<div class="deck-space" aria-hidden="true">${[6,18,14,2,16].map((id,i)=>`<div class="deck-card deck-card-${i+1}">${pic(id,'alt=""')}</div>`).join('')}<div class="deck-note">78 CARDS <i></i></div></div>`;}
function loadingMarkup(r){
 return `<div class="shuffle-stage" role="status"><div class="card-orbit" aria-hidden="true">${deck.map((c,i)=>pic(c.id,`alt="" class="orbit-card" style="--orbit-index:${i}"`)).join('')}</div>
 <div class="drawn-cards" aria-hidden="true">${r.cards.map((c,i)=>pic(c.id,`alt="" class="drawn-card drawn-card-${i+1}"`)).join('')}</div><div class="shuffle-copy"><strong>正在抽牌</strong><span>78 张牌正在重新排列</span></div></div>`;
}
function showHome(initial='',error=''){
 current=null;
 app.classList.remove('is-loading','is-result');
 setEdition();
 stage.innerHTML=`<section class="question-stage"><div class="stage-copy"><p class="eyebrow">ASK / DRAW / READ</p><h1>${headings[(serial-1)%headings.length]}</h1>
 <p class="intro">深呼吸，请描述清楚你的问题，<br>并专注想着你的问题，点下面的按钮。</p>
 <form><textarea aria-label="你的问题" placeholder="我现在最需要看清什么？" maxlength="${limit}">${esc(initial)}</textarea>
 <div class="form-foot"><span aria-live="polite">${initial.length}/500</span><button type="submit">${error&&pending?'重试解读':'开始抽牌'} <b aria-hidden="true">→</b></button></div>${error?`<p class="error" role="alert">${esc(error)}</p>`:''}</form>
 <p class="mode-note" ${live?'':'hidden'}>在线解读会把本轮问题和牌阵发给部署者配置的模型。提交前请勿填入隐私信息。</p></div>${deckMarkup()}</section>`;
 const form=$('form',stage),input=$('textarea',form);
 input.oninput=()=>{
  $('.form-foot>span',form).textContent=input.value.length+'/500';
  if(pending&&!busy&&pending.question!==normalizeQuestion(input.value)){
   pending=null;$('button',form).innerHTML='开始抽牌 <b aria-hidden="true">→</b>';$('.error',form)?.remove();
  }
 };
 form.onsubmit=(e)=>{e.preventDefault();draw(input.value);};
}
async function draw(raw){
 if(busy)return;
 const question=normalizeQuestion(raw);
 if(!question){showHome(raw,'先写下你想问的问题。');$('textarea',stage).focus();return;}
 const sp=chooseSpread(question);
 const uid=()=>globalThis.crypto?.randomUUID?.()??Date.now()+'-'+Math.random().toString(36).slice(2);
 const r=pending?.question===question?pending:{uid:uid(),question,spread:sp,cards:pickCards(sp),time:Date.now()};
 pending=r;busy=true;
 app.classList.add('is-loading');
 const b=$('form button',stage),input=$('textarea',stage);
 input.disabled=true;b.disabled=true;b.innerHTML='正在洗牌 <b aria-hidden="true">→</b>';$('.error',stage)?.remove();
 $('.deck-space',stage).innerHTML=loadingMarkup(r);
 try{
  await configReady;
  const min=new Promise(resolve=>setTimeout(resolve,1350));
  let copy;
  if(live){
   const rr=await fetch(new URL('./api/read',location.href),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(r),signal:AbortSignal.timeout(106000)});
   const result=await rr.json();
   if(!rr.ok||!Array.isArray(result.copy)||!result.copy.length)throw new Error(result.error||'解读暂时不可用，请重试。');
   copy=result.copy;
  }else copy=previewReading(r);
  await min;
  Object.assign(r,{copy,mode:live?'live':'offline'});
  history=[r,...history.filter(x=>x.uid!==r.uid)].slice(0,50);
  writeHistory();
  pending=null;
  if(modal?.classList.contains('history-modal'))refreshHistory();
  showResult(r,false);
 }catch(e){showHome(raw,/\p{Script=Han}/u.test(e.message)?e.message:'解读没有返回，请重试。同一轮重试会保留原牌。');}
 finally{busy=false;}
}
function showResult(r,focus){
 current=r;
 app.classList.remove('is-loading');
 app.classList.add('is-result');
 setEdition();
 const def=spreads[r.spread];
 stage.innerHTML=`<section class="result-stage">
 <div class="result-head"><div><p class="eyebrow">THE CARDS</p><h1 tabindex="-1">${def.title}</h1></div><p class="asked"><span>你问</span>${esc(r.question)}</p></div>
 <div class="card-row cards-${r.cards.length}">${r.cards.map((c,i)=>{
  const name=deck[c.id-1].name,orientation=c.reversed?'逆位':'正位';
  return `<article class="tarot-card"><div class="card-meta"><span>${number(i+1)}</span><span>${esc(c.slot)}</span></div><div class="art-window">${pic(c.id,`alt="${esc(name+' '+orientation)}" class="${c.reversed?'reversed':''}"`)}</div><div class="card-caption"><strong>${esc(name)}</strong><em>${orientation}</em></div></article>`;
 }).join('')}</div>
 <div class="reading-grid"><div class="reading-index">${sigil}<span>READING<br>${edition()}</span></div>
 <article class="reading-text"><div class="reading-copy">${r.copy.map(p=>`<p>${esc(p)}</p>`).join('')}</div>
 ${r.mode!=='live'?'<p class="mode-note">离线试读 · 基于牌义和牌阵，不是 AI 生成。</p>':''}
 <div class="result-actions"><button class="share-trigger" type="button">存长图分享 <span aria-hidden="true">↗</span></button><button class="secondary-button again" type="button">再抽一次 <span aria-hidden="true">↻</span></button></div>
 <p class="share-error" role="alert" hidden></p></article></div></section>`;
 $('.again',stage).onclick=()=>{serial++;pending=null;showHome();up();};
 $('.share-trigger',stage).onclick=()=>openShare(r);
 if(!modal){up();if(focus)$('h1',stage)?.focus({preventScroll:true});}
}
function showModal(className,label,markup){
 if(modal)closeModal(false);
 previousFocus=document.activeElement;
 modal=document.createElement('div');
 modal.className=className;modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label',label);modal.innerHTML=markup;
 app.append(modal);$('.topbar').inert=true;stage.inert=true;
 modal.querySelectorAll('.close-button,.history-backdrop,.share-backdrop').forEach(b=>b.onclick=()=>closeModal());
 $('.close-button',modal)?.focus({preventScroll:true});
}
function closeModal(restore=true){
 if(!modal)return;
 modal.remove();modal=null;$('.topbar').inert=false;stage.inert=false;
 if(posterUrl){URL.revokeObjectURL(posterUrl);posterUrl=null;}
 if(restore&&previousFocus?.isConnected)previousFocus.focus({preventScroll:true});
 previousFocus=null;
}
document.addEventListener('keydown',(e)=>{
 if(!modal)return;
 if(e.key==='Escape'){e.preventDefault();closeModal();return;}
 if(e.key!=='Tab')return;
 const f=[...modal.querySelectorAll('button:not([disabled]):not([tabindex="-1"]),[tabindex="0"]')];
 if(!f.length)return;
 if(e.shiftKey&&document.activeElement===f[0]){e.preventDefault();f.at(-1).focus();}
 else if(!e.shiftKey&&document.activeElement===f.at(-1)){e.preventDefault();f[0].focus();}
});
function refreshHistory(){
 const list=$('.history-list',modal);if(!list)return;
 const stamp=(t)=>new Intl.DateTimeFormat('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(t));
 list.innerHTML=history.length?history.map((r,i)=>`<article class="history-item" tabindex="0" data-index="${i}" aria-label="${esc(r.question)}">
 <div class="history-item-meta"><span>${esc(stamp(r.time))}</span><button class="history-delete" type="button" aria-label="删掉这条问题">删掉</button></div>
 <h2>${esc(r.question)}</h2><div class="history-item-foot"><div class="history-card-stack" aria-hidden="true">${r.cards.map(c=>pic(c.id,`alt="" class="${c.reversed?'reversed':''}"`)).join('')}</div><span>${spreads[r.spread].title}</span></div>
 </article>`).join(''):'<p class="history-empty">还没有旧问题。抽完一副牌，解读会留在这里。</p>';
 if(storageWarning)$('.history-note',modal).textContent=storageWarning;
 list.querySelectorAll('.history-item').forEach((el,i)=>{
  const r=history[i];
  const open=()=>{if(busy)return;closeModal(false);showResult(r,true);};
  el.onclick=(e)=>{if(!e.target.closest('button'))open();};
  el.onkeydown=(e)=>{if(e.target===el&&['Enter',' '].includes(e.key)){e.preventDefault();open();}};
  $('.history-delete',el).onclick=()=>{if(!confirm('删掉这一条旧问题和解读？'))return;history=history.filter(x=>x.uid!==r.uid);writeHistory();refreshHistory();$('.close-button',modal)?.focus();};
 });
}
function openHistory(){
 showModal('history-modal','之前问过的问题',`<button class="history-backdrop" type="button" tabindex="-1" aria-label="关闭旧问题"></button>
 <aside class="history-drawer"><div class="history-head"><div><span>THE QUESTIONS</span><strong>你之前问过的</strong></div><button class="close-button" type="button" aria-label="关闭">×</button></div>
 <div class="history-list"></div><p class="history-note">只收在这个浏览器里，最多显示最近 50 次。</p></aside>`);
 refreshHistory();
}
async function openShare(r){
 showModal('share-modal','分享长图预览',`<button class="share-backdrop" type="button" tabindex="-1" aria-label="关闭预览"></button>
 <section class="share-sheet"><div class="share-sheet-head"><div><span>SHARE YOUR READING</span><strong>长图已经排好了</strong></div><button class="close-button" type="button" aria-label="关闭">×</button></div>
 <div class="poster-preview"><p class="modal-status" role="status">正在排版…</p></div>
 <div class="share-sheet-actions"><button class="secondary-button save-poster" type="button" disabled>保存长图</button><button class="send-poster" type="button" disabled>转发分享 <span aria-hidden="true">↗</span></button></div></section>`);
 const here=modal;
 try{
  const blob=await makePoster(r);if(here!==modal)return;
  posterUrl=URL.createObjectURL(blob);
  $('.poster-preview',modal).innerHTML='<img alt="light-tarot 分享长图"><p class="modal-status" role="status" hidden></p>';
  $('.poster-preview img',modal).src=posterUrl;
  const save=$('.save-poster',modal),share=$('.send-poster',modal),status=$('.modal-status',modal);
  const filename='light-tarot-'+new Date(r.time).toISOString().slice(0,10)+'.png';
  save.disabled=false;share.disabled=false;
  save.onclick=()=>{const a=document.createElement('a');a.href=posterUrl;a.download=filename;a.click();};
  share.onclick=async()=>{
   const f=new File([blob],filename,{type:'image/png'});
   try{if(navigator.canShare?.({files:[f]})&&navigator.share){await navigator.share({files:[f],title:brand});return;}}
   catch(e){if(e.name==='AbortError')return;}
   status.hidden=false;status.textContent='这个浏览器不支持直接转发。可以先保存长图，再在想分享的地方发送。';
  };
 }catch(e){if(here===modal)$('.modal-status',modal).textContent=e.message||'长图没能生成，请关闭后重试。';}
}
$('.history-trigger').onclick=openHistory;
showHome();
configReady=fetch(new URL('./api/config',location.href),{signal:AbortSignal.timeout(3000)}).then(r=>r.ok?r.json():null).then(c=>{live=c?.live===true;const note=$('.stage-copy .mode-note');if(note)note.hidden=!live;}).catch(()=>{});

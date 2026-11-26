import {deck,spreads} from './core.mjs';
const CJK='"Yuanti SC","PingFang SC","Microsoft YaHei",sans-serif';
const load = (src)=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error('牌图未加载'));i.src=src;});
function wrap(ctx,str,w){
 const out=[];let line='';
 for(const c of str){if(c==='\n'||(line&&ctx.measureText(line+c).width>w)){out.push(line);line=c==='\n'?'':c;}else line+=c;}
 if(line||!out.length)out.push(line);
 return out;
}
export async function makePoster(r){
 const imgs=await Promise.all(r.cards.map(c=>load(deck[c.id-1].src)));
 const cv=document.createElement('canvas');cv.width=1080;const ctx=cv.getContext('2d');
 ctx.font='26px '+CJK;
 const qs=wrap(ctx,r.question||'未填写问题',900);
 const rows=r.copy.map(p=>wrap(ctx,p,880));
 const cardY=302+qs.length*32;
 const cell=900/r.cards.length;
 const thumbW=cell-16,thumbH=thumbW*1.7;
 const textY=cardY+Math.max(480,thumbH+130);
 const fullHeight=textY+rows.reduce((sum,l)=>sum+l.length*40+25,0)+125;
 if(fullHeight>15500)throw new Error('解读过长，无法生成长图');
 cv.height=fullHeight;
 const stock=ctx.createLinearGradient(0,0,1080,1150);stock.addColorStop(0,'#dce5d1');stock.addColorStop(.58,'#eee6c8');stock.addColorStop(1,'#e1e8d5');
 ctx.fillStyle=stock;ctx.fillRect(0,0,1080,fullHeight);
 ctx.strokeStyle='#6c7f6170';ctx.lineWidth=2;ctx.strokeRect(48,52,984,fullHeight-104);
 for(let y=64;y<fullHeight-55;y+=8){for(let x=64;x<1020;x+=8){ctx.fillStyle=(x+y)%24===0?'#35573a12':'#fff8d12a';ctx.fillRect(x+(y%3),y,1,2);}}
 ctx.fillStyle='#b55742';ctx.font='19px monospace';ctx.fillText('LIGHT TAROT / THE CARDS',94,115);
 ctx.fillStyle='#193e34';ctx.font='bold 64px '+CJK;ctx.fillText(spreads[r.spread].title,90,205);
 ctx.font='26px '+CJK;qs.forEach((line,i)=>ctx.fillText(line,92,250+i*32));
 r.cards.forEach((c,i)=>{
  const x=92+i*cell,y=cardY+(i%2)*24,im=imgs[i];
  ctx.font='17px '+CJK;ctx.fillText(String(i+1).padStart(2,'0')+' '+c.slot,x,y-14);
  ctx.fillStyle='#fff1d8';ctx.fillRect(x-4,y-4,thumbW+8,thumbH+8);ctx.fillStyle='#193e34';
  ctx.save();ctx.translate(x+thumbW/2,y+thumbH/2);if(c.reversed)ctx.rotate(Math.PI);
  const ratio=Math.max(thumbW/im.naturalWidth,thumbH/im.naturalHeight);
  const sourceW=thumbW/ratio,sourceH=thumbH/ratio;
  ctx.drawImage(im,(im.naturalWidth-sourceW)/2,(im.naturalHeight-sourceH)/2,sourceW,sourceH,-thumbW/2,-thumbH/2,thumbW,thumbH);ctx.restore();
  ctx.font='22px '+CJK;ctx.fillText(deck[c.id-1].name+' · '+(c.reversed?'逆位':'正位'),x,y+thumbH+38);
 });
 ctx.font='18px monospace';ctx.fillStyle='#b55742';ctx.fillText(r.mode==='live'?'READING':'READING / OFFLINE',94,textY-55);
 let y=textY;ctx.fillStyle='#1c3d34';ctx.font='26px '+CJK;
 rows.forEach(lines=>{for(const line of lines){ctx.fillText(line,93,y);y+=40;}y+=25;});
 ctx.strokeStyle='#78876c';ctx.beginPath();ctx.moveTo(93,y+10);ctx.lineTo(986,y+10);ctx.stroke();
 ctx.font='20px '+CJK;ctx.fillText('塔罗提供视角。决定还是你的。',93,y+48);
 return await new Promise((resolve,reject)=>cv.toBlob(b=>b?resolve(b):reject(new Error('无法生成长图')),'image/png'));
}

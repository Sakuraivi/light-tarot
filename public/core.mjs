export const spreads = Object.freeze({
 solve: { title:'问题解决', slots:['原因','现状','对策'] },
 core: { title:'直指核心', slots:['问题核心','障碍','对策','可用的资源'] },
 plan: { title:'行动计划', slots:['目前状态','第一步','可以借助的资源','需要绕开的阻力','下一阶段'] },
 path: { title:'发展路径', slots:['事情的起点','已经发生的变化','现在','接下来的变量','可能的走向'] },
 panorama: { title:'问题全景', slots:['问题核心','你的真实需要','暂时没看见的部分','可用的资源','可以采取的动作'] }
});
export const limit=500;
export function chooseSpread(q){
 const s=q.trim();
 if (/^(今天|今日|现在|此刻|当下)(的)?(提示|提醒)[。？！?！!]*$/.test(s)) return 'solve';
 if (/过去.{0,10}现在.{0,10}(未来|以后)|发展路径/.test(s)) return 'path';
 if (/(怎么|如何|怎样|从哪|先做|第一步|行动计划).{0,10}(开始|入门|准备|着手|启动)|开始.{0,22}(第一步|怎么|如何|做什么)|行动计划|^.{0,5}第一步/.test(s)) return 'plan';
 if (/(今天|此刻|现在|当下|最需要|眼下|当务之急).{0,12}(留意|注意|看清|反思|提醒|关注)|^(给我)?(一个)?(提醒|建议)[。？?]?$/.test(s)) return 'core';
 return 'panorama';
}
const majorNames=['愚者','魔术师','女祭司','皇后','皇帝','教皇','恋人','战车','力量','隐士','命运之轮','正义','倒吊人','死神','节制','恶魔','高塔','星星','月亮','太阳','审判','世界'];
const majorMean=['试探与起点','把手边工具变成行动','安静观察尚未说出口的线索','照顾能持续生长的条件','界限、顺序与掌控','传统、指导与共同约定','取舍、价值与真实连结','给纷杂动力一个方向','温和地承接压力','暂退一步以辨明方向','节奏变化和不确定性','事实、平衡与责任','悬置判断，换个观察角度','让旧阶段结束并腾出空间','逐步调和两种力量','辨认依赖或反复出现的拉扯','旧框架松动后重新整理','回到仍然值得守护的希望','分辨直觉和想象','让原本模糊的事情变清楚','回顾后作出下一次选择','收束并完成一个完整循环'];
const suitNames=['权杖','圣杯','宝剑','星币'];
const suitThemes=['行动力与热情','感受与关系','表达与判断','资源与日常实践'];
const pips=['一','二','三','四','五','六','七','八','九','十'];
const ranks=['国王','王后','骑士','侍从'];
const pipThemes=['新机会','平衡两个方向','合作与逐步成形','稳定与保留','压力下的冲突或落差','回应、分享与调整','评估和坚持','推进、积累或反复练习','独当一面和回顾','收束现有负担'];
const courtThemes=['负起约束和组织的责任','照顾与消化','采取明确行动','好奇地试探'];
const pipBySuit=[
 ['新的冲动与灵感','在选择之间先定方向','让小计划准备启程','可庆祝的阶段成果','竞争导致力量分散','被看见和获得支持','在压力下守住立场','快速推进或信息密集','保留体力、边坚持边观察','承担太多后的取舍'],
 ['感受有了出口','互相回应与承诺','一起庆祝与分享','暂时无感，重新观察已有选择','承认失落，也看尚未失去的东西','记忆、熟悉感与善意','想象的选项太多','离开不再适合的状态','承认自己的满足感','稳定与共同归属'],
 ['让判断或说法更清楚','在信息不足时谨慎取舍','受伤后的沟通和修复','停下来休息与整理','争胜可能损害关系','过渡和有步骤地离开','留意绕行、回避或保留的信息','重新评估自己受限在哪里','在担忧中检查事实','承认一个方式已经走到尽头'],
 ['可落地的新机会','安排预算与时间','协作和基本功','资源边界和掌控','资源不足时请求支持','平衡给予和接受','检查投入是否值得继续','专注练习与现实积累','独立成果和手边资源','可延续的积累与结构']
];
export const deck = Array.from({length:78},(_,i)=>{
 let name,theme,group;
 if(i<22){name=majorNames[i];theme=majorMean[i];group='大阿尔卡那';}
 else if(i<62){let s=Math.floor((i-22)/10), r=(i-22)%10;name=suitNames[s]+pips[r];theme=pipBySuit[s][r]||pipThemes[r];group=suitThemes[s];}
 else{let s=Math.floor((i-62)/4), r=(i-62)%4;name=suitNames[s]+ranks[r];theme=courtThemes[r]+'，着眼于'+suitThemes[s];group=suitThemes[s];}
 const id=i+1;return {id,name,theme,group,src:'./akashic/card-'+String(id).padStart(2,'0')+'.jpg'};
});
export function pickCards(spread,rng=Math.random){
 const pool=[...deck];
 return spreads[spread].slots.map(slot=>{const card=pool.splice(Math.floor(rng()*pool.length),1)[0];return {id:card.id,reversed:rng()<0.5,slot};});
}
export function normalizeQuestion(q){return typeof q==='string'?q.slice(0,limit).trim():'';}
export function assess(payload){
 if(!payload||typeof payload.question!=='string'||!Object.hasOwn(spreads,payload.spread))return false;
 const positions=spreads[payload.spread].slots;
 return payload.question.length<=limit&&Array.isArray(payload.cards)&&payload.cards.length===positions.length&&
 new Set(payload.cards.map(c=>c?.id)).size===positions.length&&payload.cards.every((c,i)=>c&&Number.isInteger(c.id)&&c.id>=1&&c.id<=78&&typeof c.reversed==='boolean'&&c.slot===positions[i]);
}
export function previewReading(r){
 const cs=r.cards.map(c=>({...deck[c.id-1],...c}));
 const at=(i)=>cs[i].name+(cs[i].reversed?'逆位':'正位');
 const guides={
 '原因':'看看最近发生的哪件事点燃了这个问题，不急着给自己定性。','现状':'把现在能确认的事情和对未来的猜测分开。',
 '目前状态':'先观察它已经在哪些小事上出现，别急着给现状判好坏。','第一步':'把它做成今天能开始、十分钟能验证的动作。','可以借助的资源':'问问自己已经拥有的东西里，哪一项能帮你动起来。','需要绕开的阻力':'写下一个容易让你卡住的惯性，再找一个代价更小的做法。','下一阶段':'给自己一个回顾点，看看该继续、调整还是停下。',
 '事情的起点':'先回到最早的动机，别用现在的印象替代当时的证据。','已经发生的变化':'把已经改变的事与仍然沿用的惯例分开。','现在':'记下一件你现在可以确认的事实。','接下来的变量':'列出会改变结果、却还没有确定的一项条件。','可能的走向':'把它当作观察上的假设，不必当作一个已经确定的结果。',
 '问题核心':'从最近一次具体事件入手，分清事实和自己的解释。','障碍':'辨认这是不能做、暂时不做，还是方法需要调整。','对策':'选一个可逆的小动作，做完再看是否值得加码。','可用的资源':'优先使用一个现成的人、工具或信息来源。','你的真实需要':'把期待从“别人应该怎样”改写成“我具体需要什么”。','暂时没看见的部分':'先找一条可能推翻你现有判断的证据。','可以采取的动作':'写清开始条件和停止条件，让下一步可验证。'
 };
 let p=[`先看一个方向：「${r.question||'当下想看清的事'}」不需要一步找到最终答案。核心的${at(0)}把注意力放在「${cs[0].theme}」，可以先把它当作一个观察角度。`];
 cs.forEach((c,i)=>p.push(`「${c.slot}」是${at(i)}。这张牌常可从「${c.theme}」来看。${c.reversed?'逆位在这里可以读成这股力量暂时受阻、向内，或用得过量；它不等于坏结果。':'正位在这里把这股力量带到台前；先看它在眼下有哪些证据。'}${guides[c.slot]??''}`));
 const rev=cs.filter(c=>c.reversed).length;
 p.push(`把牌串起来看：${at(0)}描述起点，${at(1)}把问题推向「${cs[1].theme}」，而${at(cs.length-1)}提供了另一个落脚点。全组有 ${rev} 张逆位，${rev>cs.length/2?'可以先留意被压住的动力':'可以看看哪些行动已经具备条件'}，不要只看单张牌的好坏。`);
 p.push(`这组牌可以提示你从哪里看，不替你决定结果。尤其是「${cs.at(-1).slot}」里的${at(cs.length-1)}，可以把“我应该怎样”改成“我还有哪个选择”。`);
 p.push('一、写一句事实，再写一句你对它的解释。两句若混在一起，先去确认一条信息，不急着定性。');
 p.push(`二、围绕「${cs.at(-1).theme}」定一个今天能做、做错也能调整的小动作。只做这一项，做完再看它有没有带来新信息。`);
 p.push('三、留一个回看时间。到时写下做过什么、发生了什么、下一轮想怎么改，不必用结果去证明牌面准不准。');
 p.push('塔罗提供的是一个思考视角。决定仍由你来做。');
 return p;
}

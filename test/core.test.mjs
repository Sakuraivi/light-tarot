import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile,readdir } from 'node:fs/promises';
import { chooseSpread,deck,assess,spreads,pickCards,previewReading,normalizeQuestion } from '../public/core.mjs';
test('observed question routes and structural differences',()=>{
 assert.equal(chooseSpread('我今天最需要留意什么？'),'core');
 assert.equal(chooseSpread('今天的提示？'),'solve');
 assert.deepEqual(spreads.solve.slots,['原因','现状','对策']);
 assert.equal(chooseSpread('我准备开始做一本植物观察手账，第一步可以做什么？'),'plan');
 assert.equal(chooseSpread('两个虚构朋友最近沟通疏远，这段友谊的现状和下一步是什么？'),'panorama');
 assert.deepEqual(spreads.core.slots,['问题核心','障碍','对策','可用的资源']);
 assert.deepEqual(spreads.plan.slots,['目前状态','第一步','可以借助的资源','需要绕开的阻力','下一阶段']);
 assert.notDeepEqual(spreads.plan.slots,spreads.panorama.slots);
 assert.equal(chooseSpread('请帮我看看一项新兴趣的过去、现在和未来。'),'path');
});
test('all 78 assets match their manifest and the verified reference IDs',async()=>{
 const files=await readdir(new URL('../public/akashic/',import.meta.url)); assert.equal(files.length,78);
 assert.equal(new Set(deck.map(c=>c.name)).size,78);
 for(const [id,name] of [[1,'愚者'],[12,'正义'],[22,'世界'],[30,'权杖八'],[35,'圣杯三'],[61,'星币九'],[63,'权杖国王'],[66,'权杖侍从'],[73,'宝剑骑士'],[77,'星币骑士']])assert.equal(deck[id-1].name,name);
 for(const c of deck){const b=await readFile(new URL('../public/'+c.src,import.meta.url));assert.ok(b[0]===255&&b[1]===216&&b.length>512);}
});
test('unique draws with correct position and orientation and complete offline structure',()=>{
 for(const key of Object.keys(spreads)){
  const reading={question:'示例',spread:key,cards:pickCards(key,()=>.2)};
  assert.ok(assess(reading));assert.equal(reading.cards.length,spreads[key].slots.length);
  assert.ok(reading.cards.every(c=>c.reversed));
  assert.equal(previewReading(reading).length,reading.cards.length+7);
  assert.ok(previewReading(reading).slice(1,reading.cards.length+1).every((p,i)=>p.includes(reading.cards[i].slot)&&p.includes('逆位')));
  assert.equal(assess({...reading,cards:Array(reading.cards.length).fill(reading.cards[0])}),false);
 }
});
test('limits and input normalization',()=>{assert.equal(normalizeQuestion('  问题  '),'问题');assert.equal(normalizeQuestion('台'.repeat(600)).length,500);assert.equal(normalizeQuestion(null),'');});

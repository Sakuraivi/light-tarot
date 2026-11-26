export const providers=Object.freeze({
 openai: {label:'OpenAI',model:'gpt-5-mini',url:'https://api.openai.com/v1/responses',wire:'responses'},
 deepseek: {label:'DeepSeek',model:'deepseek-flash',url:'https://api.deepseek.com/chat/completions',wire:'chat'}
});
export function legacyProvider(env=process.env){
 if(!env.TAROT_API_URL||!env.TAROT_API_KEY||!env.TAROT_MODEL)return null;
 let url;
 try{url=new URL(env.TAROT_API_URL);}catch{return null;}
 if(url.username||url.password||url.hash||(url.protocol!=='https:'&&!(url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname))))return null;
 return {label:'环境变量服务',model:env.TAROT_MODEL,key:env.TAROT_API_KEY,url:url.href,wire:'chat'};
}
export class ProviderError extends Error { constructor(code){super('模型服务未返回有效结果');this.code=code;} }
export async function requestModel(profile,system,user,{probe=false,fetcher=fetch}={}){
 const payload=profile.wire==='responses'
  ? {model:profile.model,instructions:system,input:user,max_output_tokens:probe?512:3500,store:false}
  : {model:profile.model,messages:[{role:'system',content:system},{role:'user',content:user}],max_tokens:probe?512:3500,
     ...(profile.url==='https://api.deepseek.com/chat/completions'?{thinking:{type:'disabled'}}:{})};
 let response;
 try{response=await fetcher(profile.url,{method:'POST',redirect:'error',signal:AbortSignal.timeout(probe?18000:95000),headers:{'content-type':'application/json',authorization:'Bearer '+profile.key},body:JSON.stringify(payload)});}
 catch{throw new ProviderError('network');}
 if(!response.ok)throw new ProviderError(({401:'credentials',403:'permissions',404:'model',429:'rate',400:'request'})[response.status]||'upstream');
 let data;
 try{data=await response.json();}catch{throw new ProviderError('format');}
 const raw=profile.wire==='responses'
  ? (data.status==='incomplete'?'':Array.isArray(data.output)?data.output.filter(i=>i.type==='message').flatMap(i=>Array.isArray(i.content)?i.content:[]).filter(c=>c.type==='output_text'&&typeof c.text==='string').map(c=>c.text).join('\n'):data.output_text)
  : data.choices?.[0]?.message?.content;
 if(typeof raw!=='string'||!raw.trim())throw new ProviderError('format');
 return raw.trim().slice(0,12000);
}
export const providerMessage=code=>({
 credentials:'Key 无效或已失效。',permissions:'该 Key 对这个模型没有权限。',model:'模型 ID 不存在或不可访问。',
 rate:'模型限流或额度不足。',request:'服务商拒绝请求，请核对模型 ID 和配置。',upstream:'模型服务暂时不可用。',
 network:'无法连接模型服务，或请求超时。',format:'模型没有返回可读文字。'
})[code]||'模型服务暂时不可用。';

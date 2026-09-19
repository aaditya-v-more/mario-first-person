import {readFile,writeFile,chmod,mkdir} from 'node:fs/promises';
const origin='https://api.plethora.studio';
const sessionPath='.env.plethora-session.json';
const tokenPath='.env.plethora-token.json';
async function savePrivate(path,value){await writeFile(path,JSON.stringify(value),{mode:0o600});await chmod(path,0o600);}
async function post(path,body,token){
  const response=await fetch(origin+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Plethora-Agent ${token}`}:{})},body:JSON.stringify(body)});
  const result=await response.json();
  if(!response.ok||!result.ok)throw new Error(`Plethora ${response.status}: ${JSON.stringify(result.error||result.message||'Request failed')}`);
  return result.data;
}
const action=process.argv[2];
if(action==='pair'){
  const data=await post('/v1/agent/pair/sessions',{});
  await savePrivate(sessionPath,data);
  console.log(JSON.stringify({pairingCode:data.pairingCode,approvalUrl:data.approvalUrl,pairingUrl:data.pairingUrl,pairingQrPayload:data.pairingQrPayload,expiresAt:data.expiresAt,scopes:data.scopes},null,2));
}else if(action==='exchange'){
  const session=JSON.parse(await readFile(sessionPath,'utf8'));
  const data=await post(`/v1/agent/pair/sessions/${encodeURIComponent(session.sessionId)}/exchange`,{sessionSecret:session.sessionSecret});
  if(data.status==='approved'){
    if(!data.accessToken)throw new Error('Approved response is missing data.accessToken.');
    await savePrivate(tokenPath,{accessToken:data.accessToken,tokenId:data.tokenId,expiresAt:data.tokenExpiresAt});
  }
  console.log(JSON.stringify({status:data.status,expiresAt:data.expiresAt,tokenSaved:data.status==='approved'}));
}else if(action==='upload'){
  const token=JSON.parse(await readFile(tokenPath,'utf8'));
  const payload=JSON.parse(await readFile('outputs/plethora/draft.json','utf8'));
  const data=await post('/v1/agent/bits/drafts',payload,token.accessToken);
  await mkdir('outputs/plethora',{recursive:true});
  await writeFile('outputs/plethora/upload-result.json',JSON.stringify(data,null,2));
  console.log(JSON.stringify({action:data.action,bitId:data.bit?.id,title:data.bit?.title,packageHash:data.packageHash,packageBytes:data.packageBytes}));
}else throw new Error('Usage: node scripts/plethora-upload.mjs pair|exchange|upload');

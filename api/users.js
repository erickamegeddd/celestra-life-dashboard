const REPO='erickamegeddd/celestra-life-dashboard';
async function getPdToken(){const r=await fetch('https://api.pipedream.com/v1/oauth/token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({grant_type:'client_credentials',client_id:process.env.PD_CLIENT_ID,client_secret:process.env.PD_CLIENT_SECRET})});return(await r.json()).access_token;}
function ghUrl(u,pid){const b=Buffer.from(u,'utf8').toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');return `https://api.pipedream.com/v1/connect/${pid}/proxy/${b}?`+new URLSearchParams({account_id:process.env.GH_ACCOUNT_ID,external_user_id:process.env.GH_EXTERNAL_USER_ID});}
async function getGhFile(path,tok,pid){const r=await fetch(ghUrl(`https://api.github.com/repos/${REPO}/contents/${path}`,pid),{headers:{Authorization:`Bearer ${tok}`,'x-pd-environment':'production'}});if(!r.ok)throw new Error('GH GET '+path+': '+r.status);return r.json();}
async function putGhFile(path,content,sha,message,tok,pid){const body=JSON.stringify({message,content:Buffer.from(content).toString('base64'),sha});const r=await fetch(ghUrl(`https://api.github.com/repos/${REPO}/contents/${path}`,pid),{method:'PUT',headers:{Authorization:`Bearer ${tok}`,'x-pd-environment':'production','Content-Type':'application/json','x-pd-proxy-content-type':'application/json'},body});if(!r.ok){const t=await r.text();throw new Error('GH PUT '+path+': '+r.status+' '+t.slice(0,200));}return r.json();}
async function sha256hex(s){const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');}
async function verifyAdmin(req){const auth=req.headers['authorization']||'';const token=auth.replace('Bearer ','').trim();const username=(req.headers['x-admin-username']||'').trim().toLowerCase();if(!token)return false;if(token===process.env.ADMIN_SECRET)return true;try{const hash=await sha256hex(token);if(hash===process.env.ADMIN_PASSWORD_HASH&&username===(process.env.ADMIN_USERNAME||'admin').toLowerCase())return true;}catch(_){}return false;}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,8);}
export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Methods','GET,POST,PUT,DELETE,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type,X-Admin-Username');
  if(req.method==='OPTIONS'){res.status(200).end();return;}
  if(!await verifyAdmin(req))return res.status(401).json({error:'Unauthorized'});
  const pdToken=await getPdToken();const pid=process.env.PD_PROJECT_ID;
  let ghFile,users;
  try{ghFile=await getGhFile('users.json',pdToken,pid);users=JSON.parse(Buffer.from(ghFile.content,'base64').toString('utf8'));if(!Array.isArray(users))users=[];}catch(e){ghFile=null;users=[];}
  if(req.method==='GET')return res.json({users});
  let body=req.body;if(typeof body==='string'){try{body=JSON.parse(body);}catch{body={};}}
  const{name,username,password,allowed_accounts,is_admin}=body||{};
  if(req.method==='POST'){
    if(!name||!username||!password)return res.status(400).json({error:'name, username, password required'});
    const hash=await sha256hex(password);
    const user={id:uid(),name,username,password_hash:hash,token:uid()+uid(),allowed_accounts:allowed_accounts||[],is_admin:!!is_admin,created_at:new Date().toISOString()};
    users.push(user);
    await putGhFile('users.json',JSON.stringify(users,null,2),ghFile?.sha||'',`Add user ${name}`,pdToken,pid);
    return res.json({user});
  }
  if(req.method==='PUT'){
    const id=req.query.id;const idx=users.findIndex(u=>u.id===id);
    if(idx===-1)return res.status(404).json({error:'User not found'});
    const u=users[idx];
    if(name)u.name=name;if(username)u.username=username;if(password)u.password_hash=await sha256hex(password);
    if(allowed_accounts!==undefined)u.allowed_accounts=allowed_accounts;if(is_admin!==undefined)u.is_admin=!!is_admin;
    u.updated_at=new Date().toISOString();users[idx]=u;
    await putGhFile('users.json',JSON.stringify(users,null,2),ghFile?.sha||'',`Update user ${u.name}`,pdToken,pid);
    return res.json({user:u});
  }
  if(req.method==='DELETE'){
    const id=req.query.id;const before=users.length;users=users.filter(u=>u.id!==id);
    if(users.length===before)return res.status(404).json({error:'User not found'});
    await putGhFile('users.json',JSON.stringify(users,null,2),ghFile?.sha||'',`Delete user ${id}`,pdToken,pid);
    return res.json({ok:true});
  }
  return res.status(405).json({error:'Method not allowed'});
}

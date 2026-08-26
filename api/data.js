const REPO='erickamegeddd/celestra-life-dashboard',SU=process.env.SUPABASE_URL,SK=process.env.SUPABASE_SERVICE_KEY;
async function getPdT(){const r=await fetch('https://api.pipedream.com/v1/oauth/token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({grant_type:'client_credentials',client_id:process.env.PD_CLIENT_ID,client_secret:process.env.PD_CLIENT_SECRET})});return(await r.json()).access_token;}
function ghUrl(u,pid){const b=Buffer.from(u,'utf8').toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');return `https://api.pipedream.com/v1/connect/${pid}/proxy/${b}?`+new URLSearchParams({account_id:process.env.GH_ACCOUNT_ID,external_user_id:process.env.GH_EXTERNAL_USER_ID});}
let _uc=null,_ut=0;
async function getUsers(){const now=Date.now();if(_uc&&now-_ut<60000)return _uc;try{const t=await getPdT(),pid=process.env.PD_PROJECT_ID;const r=await fetch(ghUrl(`https://api.github.com/repos/${REPO}/contents/users.json`,pid),{headers:{Authorization:`Bearer ${t}`,'x-pd-environment':'production'}});if(!r.ok)return[];const j=await r.json();_uc=JSON.parse(Buffer.from(j.content,'base64').toString('utf8'));_ut=now;return Array.isArray(_uc)?_uc:[];}catch{return[];}}
async function sbGet(path){const r=await fetch(`${SU}/rest/v1/${path}`,{headers:{apikey:SK,Authorization:`Bearer ${SK}`,Accept:'application/json'}});if(!r.ok){const t=await r.text().catch(()=>'');throw new Error(`SB ${path}: ${r.status} ${t.slice(0,200)}`);}return r.json();}
export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Methods','GET');
  let allowed=null,viewUser=null;
  const tok=req.query.token;
  if(tok){const users=await getUsers();const u=users.find(u=>u.token===tok);if(!u)return res.status(403).json({error:'Invalid token'});allowed=u.allowed_accounts||[];viewUser={id:u.id,name:u.name};res.setHeader('Cache-Control','no-store');}
  else res.setHeader('Cache-Control','s-maxage=300,stale-while-revalidate=600');
  if(!SU||!SK)return res.status(500).json({error:'Database not configured. Run a sync first.'});
  const df=req.query.start_date&&/^\d{4}-\d{2}-\d{2}$/.test(req.query.start_date)?`&date=gte.${req.query.start_date}`:'';
  let rows=[],offset=0;
  while(true){const p=await sbGet(`transactions?select=*${df}&order=date.desc&limit=5000&offset=${offset}`);rows=rows.concat(p);if(p.length<5000)break;offset+=5000;}
  let mapped=rows.map(r=>({id:r.id,date:r.date,month:r.month,account:r.account,description:r.description||'',payee:r.payee||'',amount:parseFloat(r.amount),type:r.type,category:r.category||'Uncategorized/Other'}));
  const bals=await sbGet('account_balances?select=*');
  let lb={};for(const b of bals)lb[b.account]={balance:parseFloat(b.balance),institution:b.institution||'Unknown',isNew:false};
  if(allowed!==null){mapped=mapped.filter(r=>allowed.includes(r.account));const f={};for(const[k,v]of Object.entries(lb))if(allowed.includes(k))f[k]=v;lb=f;}
  res.json({rows:mapped,accounts:lb,generatedAt:new Date().toISOString(),source:'database',viewUser:viewUser||undefined});
}

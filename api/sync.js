const SU=process.env.SUPABASE_URL,SK=process.env.SUPABASE_SERVICE_KEY;
async function sbF(m,p,b,x={}){const h={apikey:SK,Authorization:`Bearer ${SK}`,'Content-Type':'application/json',...x};const r=await fetch(`${SU}/rest/v1/${p}`,{method:m,headers:h,body:b?JSON.stringify(b):undefined});if(!r.ok){const t=await r.text().catch(()=>'');throw new Error(`SB ${m} ${p}: ${r.status} ${t.slice(0,300)}`);}const t=await r.text();return t?JSON.parse(t):null;}
function toDS(ts){return new Date(ts*1000).toISOString().split('T')[0];}
async function fSFIN(url,st){const u=new URL(url);const usr=decodeURIComponent(u.username),pwd=decodeURIComponent(u.password);u.username='';u.password='';const ep=u.toString().replace(/\/$/,'')+'/accounts?start-date='+st;const h={Accept:'application/json'};if(usr)h['Authorization']='Basic '+Buffer.from(usr+':'+(pwd||'')).toString('base64');const r=await fetch(ep,{headers:h});if(!r.ok){const t=await r.text().catch(()=>'');throw new Error('SFIN '+r.status+': '+t.slice(0,200));}return r.json();}
const CAT=[[/transfer|zelle|ach|wire/i,'Transfers Out'],[/amazon|amzn/i,'Online Shopping'],[/whole foods|grocery|market|food/i,'Groceries'],[/restaurant|caf|dining|pizza|doordash|grubhub|uber eats/i,'Dining'],[/delta|united|american air|southwest|flight|airline|hotel|marriott|hilton|hyatt|airbnb/i,'Travel'],[/chase credit|amex|capital one|citi.*pay|autopay/i,'Credit Card Payments'],[/insurance|geico|allstate|progressive/i,'Insurance'],[/dental|medical|pharmacy|cvs|walgreens|health/i,'Healthcare'],[/gas|shell|chevron|bp|exxon|fuel/i,'Gas & Fuel'],[/fee|interest|annual/i,'Bank Fees & Interest'],[/payroll|salary|direct dep|adp|paychex/i,'Payroll & Income'],[/rent|mortgage|lease/i,'Rent & Mortgage'],[/office|staples|best buy|apple|microsoft|software|subscription|saas/i,'Office & Technology'],[/gatewayfees|certificate of origin/i,'Business Income'],[/torsion|consulting|professional/i,'Professional Services'],[/integrityconnect|bounteous/i,'Marketing & Advertising'],[/etrade|schwab|fidelity|vanguard|robinhood|td ameritrade/i,'Investment']];
function ic(p,d,a){const t=((p||'')+' '+(d||'')).toLowerCase();for(const[pt,c]of CAT)if(pt.test(t))return c;return a>0?'Other Income':'Uncategorized/Other';}
export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  if(req.method==='OPTIONS'){res.status(200).end();return;}
  if(!SU||!SK)return res.status(500).json({error:'Supabase not configured'});
  const d=new Date();d.setDate(d.getDate()-90);const st=Math.floor(d.getTime()/1000);
  const urls=[process.env.SFIN_URL_1,process.env.SFIN_URL_2].filter(Boolean);
  if(!urls.length)return res.status(500).json({error:'No SimpleFIN credentials'});
  const map={},errs=[];
  for(const url of urls){try{const data=await fSFIN(url,st);for(const a of data.accounts||[])map[a.id]=a;}catch(e){errs.push(e.message);}}
  const accounts=Object.values(map);const seen=new Set(),rows=[];
  for(const a of accounts)for(const tx of a.transactions||[]){if(seen.has(tx.id))continue;seen.add(tx.id);const ds=toDS(tx.posted||tx.transacted_at);const amt=parseFloat(tx.amount)||0;rows.push({id:tx.id,date:ds,month:ds.slice(0,7),account:a.name,description:tx.description||'',payee:tx.payee||'',amount:amt,type:amt<0?'Expense':'Income',category:ic(tx.payee,tx.description,amt)});}
  let up=0;
  for(let i=0;i<rows.length;i+=500){try{await sbF('POST','transactions',rows.slice(i,i+500),{Prefer:'resolution=merge-duplicates,return=minimal'});up+=Math.min(500,rows.length-i);}catch(e){errs.push('b'+i+':'+e.message);}}
  if(accounts.length)try{await sbF('POST','account_balances',accounts.map(a=>({account:a.name,balance:parseFloat(a.balance)||0,institution:a.org?.name||'Unknown',updated_at:new Date().toISOString()})),{Prefer:'resolution=merge-duplicates,return=minimal'});}catch(e){errs.push('bal:'+e.message);}
  let total=0;try{const r=await fetch(`${SU}/rest/v1/transactions?select=id`,{headers:{apikey:SK,Authorization:`Bearer ${SK}`,Prefer:'count=exact',Range:'0-0'}});const cr=r.headers.get('Content-Range');if(cr)total=parseInt(cr.split('/')[1])||0;}catch(_){}
  res.json({ok:true,fetched:rows.length,upserted:up,totalInDb:total,accounts:accounts.length,syncedAt:new Date().toISOString(),errors:errs.length?errs:undefined});
}

const SU=process.env.SUPABASE_URL,SK=process.env.SUPABASE_SERVICE_KEY;
export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS'){res.status(200).end();return;}
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  if(!SU||!SK)return res.status(500).json({error:'Supabase not configured'});
  let body=req.body;if(typeof body==='string'){try{body=JSON.parse(body);}catch{body={};}}
  const{action,id,category,from_category,to_category}=body||{};
  const h={apikey:SK,Authorization:`Bearer ${SK}`,'Content-Type':'application/json',Prefer:'return=minimal'};
  if(action==='update_category'&&id&&category){const r=await fetch(`${SU}/rest/v1/transactions?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:h,body:JSON.stringify({category})});if(!r.ok){const t=await r.text();return res.status(500).json({error:t});}return res.json({ok:true});}
  if(action==='rename_category'&&from_category&&to_category){const r=await fetch(`${SU}/rest/v1/transactions?category=eq.${encodeURIComponent(from_category)}`,{method:'PATCH',headers:h,body:JSON.stringify({category:to_category})});if(!r.ok){const t=await r.text();return res.status(500).json({error:t});}return res.json({ok:true});}
  return res.status(400).json({error:'Invalid action'});
}

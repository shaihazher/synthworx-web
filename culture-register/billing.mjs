import {plans,origin,root} from './catalog.mjs';
export function makeBilling({key,products,mode='live',site=origin,remote=fetch}){
  if(!['live','test'].includes(mode)) throw Error('Invalid billing environment');
  const productPlans=new Map(plans.map(p=>[products[p.id],p]).filter(([id])=>id));
  const base='https://'+mode+'.dodopayments.com';
  const allowedHost=(host)=>mode==='live'?host:'test.'+host;
  async function api(path,body){
    if(!key)throw Error('Billing configuration missing');
    const res=await remote(base+path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(18000)});
    if(!res.ok)throw Error('Billing service HTTP '+res.status);
    return res.json();
  }
  async function list(path,params){
    const all=[];
    for(let n=0;;n++){
      const q=new URLSearchParams({...params,page_size:'100',page_number:String(n)});
      const {items}=await api(path+'?'+q);
      if(!Array.isArray(items))throw Error('Invalid billing list');
      all.push(...items);
      if(items.length<100)return all;
    }
  }
  function destination(url,host){
    const u=new URL(url);
    if(u.protocol!=='https:'||u.hostname!==allowedHost(host)||u.username||u.password)throw Error('Unexpected billing destination');
    return u.href;
  }
  async function access(email){
    const customers=(await list('/customers',{email})).filter(c=>c.email?.toLowerCase()===email);
    const matches=[];
    for(const customer of customers){
      const subs=await list('/subscriptions',{customer_id:customer.customer_id,status:'active'});
      for(const sub of subs){
        const plan=productPlans.get(sub.product_id);
        if(!plan || sub.status!=='active' || sub.customer?.customer_id!==customer.customer_id || sub.customer?.email?.toLowerCase()!==email)continue;
        if(sub.cancel_at_next_billing_date&&Date.parse(sub.next_billing_date)<=Date.now())continue;
        const charges=(await list('/payments',{subscription_id:sub.subscription_id,status:'succeeded'}))
          .filter(p=>p.subscription_id===sub.subscription_id||p.subscription_ids?.includes(sub.subscription_id))
          .sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at));
        const latest=charges[0];
        if(!latest||latest.total_amount<=0||latest.refund_status==='full'||(latest.dispute_status&&latest.dispute_status!=='dispute_won'))continue;
        matches.push({plan,customer:customer.customer_id,sub:sub.subscription_id,ending:sub.cancel_at_next_billing_date,date:sub.next_billing_date});
      }
    }
    return matches;
  }
  return {access,list,api,async checkout(plan,source){
    if(!products[plan.id])throw Error('Product missing');
    const c=await api('/checkouts',{product_cart:[{product_id:products[plan.id],quantity:1}],billing_currency:'USD',feature_flags:{allow_discount_code:false,allow_currency_selection:false},metadata:{publication:'culture-register',plan:plan.id,source},return_url:site+root+'/welcome',cancel_url:site+root+'/plans?focus='+plan.id});
    return destination(c.checkout_url,'checkout.dodopayments.com');
  },async portal(customer){
    const v=await api('/customers/'+encodeURIComponent(customer)+'/customer-portal/session?send_email=false&return_url='+encodeURIComponent(site+root+'/account'),{});
    return destination(v.link,'customer.dodopayments.com');
  }};
}


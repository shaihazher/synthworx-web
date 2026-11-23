export function billing({base, key, product, entitlement, origin, remote=fetch}) {
  async function api(path, data, authenticated=true) {
    const headers = {'Content-Type':'application/json'};
    if (authenticated) headers.Authorization='Bearer '+key;
    const r=await remote(base+path,{method:data?'POST':'GET',headers,body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(15000)});
    if (!r.ok) throw Error('Billing provider HTTP '+r.status);
    return r.json();
  }
  const usable = g => g.entitlement_id === entitlement && g.payment_id && g.customer_id &&
    g.status?.toLowerCase()==='delivered' && g.license_key?.status?.toLowerCase()==='active' &&
    (!g.license_key.expires_at || Date.parse(g.license_key.expires_at)>Date.now());
  async function grants(match, customer) {
    for(let page=0; ;page++) {
      const params=new URLSearchParams({page_size:'100',page_number:String(page)});
      if(customer) params.set('customer_id',customer);
      const data=await api('/entitlements/'+encodeURIComponent(entitlement)+'/grants?'+params);
      if(!Array.isArray(data.items)) throw Error('Malformed billing response');
      const grant=data.items.find(g=>usable(g) && match(g));
      if(grant) return {id:grant.id,customer:grant.customer_id};
      if(data.items.length<100) return null;
    }
  }
  return {
    async checkout(source) {
      const r=await api('/checkouts',{
        product_cart:[{product_id:product,quantity:1}],billing_currency:'USD',
        feature_flags:{allow_discount_code:false,allow_currency_selection:false},
        metadata:{offer:'outcome-prompt-web-100-v1',channel:source},
        return_url:origin+'/outcome-prompt/receipt',cancel_url:origin+'/outcome-prompt/#pack'
      });
      const u=new URL(r.checkout_url);
      if(u.protocol!=='https:'||!['checkout.dodopayments.com','test.checkout.dodopayments.com'].includes(u.hostname)) throw Error('Invalid checkout host');
      return u.href;
    },
    async redeem(license) {
      const r=await api('/licenses/validate',{license_key:license},false);
      if(r.valid!==true) return null;
      return grants(g=>g.license_key.key===license);
    },
    active(pack) {return grants(g=>g.id===pack.id,pack.customer);}
  };
}

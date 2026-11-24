let token='',until=0;
export async function sendReaderCode(email,code){
  if(Date.now()>=until){
    const r=await fetch('https://accounts.zoho.in/oauth/v2/token',{method:'POST',body:new URLSearchParams({grant_type:'refresh_token',refresh_token:process.env.ZOHO_REFRESH_TOKEN,client_id:process.env.ZOHO_CLIENT_ID,client_secret:process.env.ZOHO_CLIENT_SECRET}),signal:AbortSignal.timeout(15000)});
    const b=await r.json();
    if(!r.ok||!b.access_token)throw Error('Reader mail login unavailable');
    token=b.access_token;until=Date.now()+(Number(b.expires_in||3600)-60)*1000;
  }
  const r=await fetch('https://mail.zoho.in/api/accounts/'+process.env.ZOHO_ACCOUNT_ID+'/messages',{method:'POST',headers:{Authorization:'Zoho-oauthtoken '+token,'Content-Type':'application/json'},body:JSON.stringify({fromAddress:'hello@synthworx.com',toAddress:email,subject:'Your Culture Register reader code',mailFormat:'plaintext',content:'Your Culture Register sign-in code is '+code+'. It expires in 10 minutes. Enter it in the reader access window where you requested it.\n\nThe editors\nCulture Register by Synthworx\nhttps://synthworx.com/culture-register/'}),signal:AbortSignal.timeout(18000)});
  if(r.status===401)until=0;
  if(!r.ok||Number((await r.json()).status?.code)!==200)throw Error('Reader mail delivery unavailable');
}


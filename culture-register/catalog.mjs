export const root = '/culture-register';
export const origin = 'https://synthworx.com';
export const desks = {
  movies: {name:'Movies', price:495, focusPrice:189, cadence:'Monthly', decision:'Shape a development slate or a commissioning brief.', note:'We review release signals weekly and revisit the development calls monthly.'},
  music: {name:'Music', price:295, focusPrice:99, cadence:'Weekly', decision:'Choose a single, commission a mix or plan a release.', note:'A weekly edit follows release calendars and the short life of a promotion.'},
  fashion: {name:'Fashion', price:395, focusPrice:149, cadence:'Every two weeks', decision:'Set the depth of a buy or test a new silhouette.', note:'A fortnightly edit follows in-season buys, reorders and seasonal commitments.'},
  beauty: {name:'Beauty', price:345, focusPrice:129, cadence:'Weekly', decision:'Choose a shade, a format or a campaign demonstration.', note:'Weekly reviews inform merchandising and promotion. Longer product bets carry their own test horizons.'},
};
export const focuses = {
  movies: {romcom:'Romantic comedy',horror:'Horror','action-adventure':'Action & adventure','animation-family':'Family animation'},
  music: {pop:'Pop','hip-hop-rnb':'Hip-hop & R&B',country:'Country','dance-electronic':'Dance & electronic'},
  fashion: {denim:'Denim','ballet-flats':'Ballet flats',outerwear:'Outerwear',handbags:'Handbags'},
  beauty: {'lip-color':'Lip color',fragrance:'Fragrance','facial-sunscreen':'Facial sunscreen',blush:'Blush'},
};
export const plans = [];
for (const [desk, settings] of Object.entries(desks)) {
  for (const [slug, name] of Object.entries(focuses[desk])) {
    plans.push({id:slug,name,price:settings.focusPrice,slugs:[slug],type:'focus',desks:[desk]});
  }
  plans.push({id:desk,name:settings.name+' desk',price:settings.price,slugs:Object.keys(focuses[desk]),type:'desk',desks:[desk]});
}
const industries = Object.keys(desks);
for (let mask=1;mask<16;mask++) {
  const selected = industries.filter((_,i)=>mask & (1<<i));
  if (selected.length<2) continue;
  const all = selected.length===4;
  plans.push({
    id:all?'full':selected.join('-'), name:all?'Full access':selected.map(s=>desks[s].name).join(' + '),
    price:all?995:Math.round(selected.reduce((sum,s)=>sum+desks[s].price,0)*(selected.length===3?.75:.85)),
    type:all?'full':'bundle', desks:selected, slugs:selected.flatMap(s=>Object.keys(focuses[s])),
  });
}
export const planById = new Map(plans.map(p=>[p.id,p]));


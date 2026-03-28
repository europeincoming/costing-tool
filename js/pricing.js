// pricing.js — Brahms + Beethoven + Bach + Chopin
const FX={EUR:{GBP:0.853650,CHF:0.906572},GBP:{EUR:1.171440,CHF:1.102680},CHF:{EUR:1.103140,GBP:0.906572}};
function fx(a,f,t){if(!a||f===t)return a||0;if(FX[f]?.[t])return a*FX[f][t];const e=FX[f]?.EUR?a*FX[f].EUR:a;return FX.EUR?.[t]?e*FX.EUR[t]:e;}
function r2(n){return Math.round((n||0)*100)/100;}

const COACH_REGION={uk:"England",england:"England",scotland:"Scotland",wales:"England","northern ireland":"England",ireland:"Europe  excuding Switzerland",switzerland:"Switzerland",france:"Europe  excuding Switzerland",germany:"Europe  excuding Switzerland",austria:"Europe  excuding Switzerland",netherlands:"Europe  excuding Switzerland",belgium:"Europe  excuding Switzerland",italy:"Europe  excuding Switzerland",spain:"Europe  excuding Switzerland",portugal:"Europe  excuding Switzerland",norway:"Europe  excuding Switzerland",sweden:"Europe  excuding Switzerland",denmark:"Europe  excuding Switzerland",finland:"Europe  excuding Switzerland",iceland:"Europe  excuding Switzerland","czech republic":"Europe  excuding Switzerland",hungary:"Europe  excuding Switzerland",poland:"Europe  excuding Switzerland",croatia:"Europe  excuding Switzerland",greece:"Europe  excuding Switzerland",slovakia:"Europe  excuding Switzerland",slovenia:"Europe  excuding Switzerland",romania:"Europe  excuding Switzerland",bulgaria:"Europe  excuding Switzerland",luxembourg:"Europe  excuding Switzerland"};

const GUIDE_FALLBACK={uk:"London",england:"London",scotland:"Edinburgh",wales:"London",ireland:"Dublin",france:"Paris",germany:"Munich",austria:"Vienna",switzerland:"Zurich",netherlands:"Amsterdam",belgium:"Brussels",italy:"Rome",spain:"Madrid",portugal:"Lisbon",norway:"Oslo",sweden:"Stockholm",denmark:"Copenhagen",finland:"Helsinki",iceland:"Reykjavik","czech republic":"Prague",hungary:"Budapest",poland:"Warsaw",croatia:"Zagreb",greece:"Athens"};

function getCoachRegion(countries){
  if(!countries?.length)return"Europe  excuding Switzerland";
  if(countries.length>1&&countries.some(c=>c.toLowerCase()==="switzerland"))return"Europe  excuding Switzerland";
  return COACH_REGION[countries[0].toLowerCase()]||"Europe  excuding Switzerland";
}

function getGuideRate(city,dur,rates){
  const gr=rates.pg_guide;
  const ck=Object.keys(gr).find(k=>k.toLowerCase()===city.toLowerCase());
  if(ck&&gr[ck][dur])return{...gr[ck][dur],source:"exact",city:ck};
  const country=window.CITY_COUNTRY?.[city.toLowerCase()];
  const fb=country?GUIDE_FALLBACK[country]:null;
  if(fb){const fk=Object.keys(gr).find(k=>k.toLowerCase()===fb.toLowerCase());if(fk&&gr[fk][dur])return{...gr[fk][dur],source:`estimated (${fb} rate)`,city:fk};}
  if(gr["Switzerland"]?.[dur])return{...gr["Switzerland"][dur],source:"estimated (Switzerland generic)",city:"Switzerland"};
  return null;
}

function runBrahms(lead,rates){
  const{countries,market,groupSize,nights,days,program,offerCurrency}=lead;
  const coachQty=groupSize?Math.ceil(groupSize/49):1;
  const totalDays=days||(nights?nights+1:1);
  const results=[],flags=[];
  const allSvcs=[];
  for(const day of(program||[]))for(const s of(day.services||[]))if(["GUI","MTC"].includes(s.type))allSvcs.push({...s,day:day.day});
  for(const s of(lead.services||[]))if(["GUI","MTC"].includes(s.type)&&!allSvcs.find(x=>x.name===s.name))allSvcs.push(s);
  const hasDisposal=allSvcs.some(s=>s.type==="MTC"&&/disposal|touring|ldc/i.test(s.name));
  const hasTransfers=allSvcs.some(s=>s.type==="MTC"&&/transfer|airport|station/i.test(s.name));
  const hasTM=allSvcs.some(s=>s.type==="GUI"&&/tour.?manager/i.test(s.name));
  const guideSvcs=allSvcs.filter(s=>s.type==="GUI"&&!/tour.?manager/i.test(s.name));

  if(hasDisposal){
    const region=getCoachRegion(countries);
    const rk=Object.keys(rates.pg_coach).find(k=>k.toLowerCase()===region.toLowerCase());
    if(rk){const{rate,currency}=rates.pg_coach[rk];const cv=r2(fx(rate,currency,offerCurrency));const total=r2(cv*totalDays*coachQty);results.push({category:"Transport",service:`Coach at disposal — ${region}`,detail:`${coachQty} coach × ${totalDays} days @ ${offerCurrency} ${cv}/day`,rate:cv,qty:totalDays*coachQty,total,currency:offerCurrency,note:hasTransfers?"Includes transfers":"",source:"rate sheet"});}
    else{flags.push(`No coach rate for ${region}`);results.push({category:"Transport",service:`Coach at disposal — ${region}`,rate:null,qty:totalDays*coachQty,total:null,currency:offerCurrency,flag:true});}
  } else if(hasTransfers){
    const dest=(lead.cities||[]).slice(0,1);
    for(const city of dest){
      const lk=Object.keys(rates.local_transport).find(k=>k.toLowerCase()===city.toLowerCase());
      const tr=lk?rates.local_transport[lk].filter(r=>r.type==="transfer"):[];
      if(tr.length){const{rate,currency}=tr[0];const cv=r2(fx(rate,currency,offerCurrency));results.push({category:"Transport",service:`Transfer — ${city}`,detail:`${coachQty} coach`,rate:cv,qty:coachQty,total:r2(cv*coachQty),currency:offerCurrency,source:"rate sheet"});}
      else{flags.push(`No transfer rate for ${city}`);results.push({category:"Transport",service:`Transfer — ${city}`,rate:null,qty:coachQty,total:null,currency:offerCurrency,flag:true});}
    }
  }

  if(hasTM){
    const isUkOnly=countries.length===1&&["uk","england","scotland","wales"].includes(countries[0].toLowerCase());
    const scope=isUkOnly?"UK":"Europe";
    const tm=rates.pg_tm;
    let dk,fk;
    if(market==="Indian"){dk=isUkOnly?"UK|Indian tour manager for UK":"Europe|Indian tour manager for Europe";fk=isUkOnly?"UK|Indian tour manager for UK, flight expense":"Europe|Indian tour manager for Europe, flight expense";}
    else{dk=isUkOnly?"UK|European Tour Manager for UK":"Europe|European tour manager for Europe";fk=isUkOnly?null:"Europe|European tour manager for Europe, Flights";}
    if(tm[dk]){const{rate,currency}=tm[dk];const cv=r2(fx(rate,currency,offerCurrency));results.push({category:"Tour Manager",service:`Tour Manager (${market==="Indian"?"Indian":"European"}) — ${scope}`,detail:`${totalDays} days`,rate:cv,qty:totalDays,total:r2(cv*totalDays),currency:offerCurrency,source:"rate sheet"});}
    if(fk&&tm[fk]){const{rate,currency}=tm[fk];const cv=r2(fx(rate,currency,offerCurrency));results.push({category:"Tour Manager",service:"Tour Manager — Flights",detail:"Lump sum",rate:cv,qty:1,total:cv,currency:offerCurrency,source:"rate sheet"});}
  }

  for(const svc of guideSvcs){
    const city=svc.destination||(lead.cities||[])[0]||"";if(!city)continue;
    const dur=/full.day|excursion|day.trip|stonehenge|windsor|versailles/i.test(svc.name)?"full_day":"half_day";
    const re=getGuideRate(city,dur,rates);
    if(re){const cv=r2(fx(re.rate,re.currency,offerCurrency));const total=r2(cv*coachQty);if(re.source!=="exact")flags.push(`Guide rate estimated from ${re.city} for ${city}`);results.push({category:"Guide",service:`${dur==="full_day"?"Full Day":"Half Day"} Guide — ${city}`,detail:`${coachQty} group`,rate:cv,qty:coachQty,total,currency:offerCurrency,source:re.source,flag:re.source!=="exact"});}
    else{flags.push(`No guide rate for ${city}`);results.push({category:"Guide",service:`Guide — ${city}`,rate:null,qty:coachQty,total:null,currency:offerCurrency,flag:true});}
  }

  return{results,flags,total:r2(results.filter(r=>!r.flag).reduce((s,r)=>s+(r.total||0),0)),coachQty};
}

function fuzzyMatch(a,b){if(a===b)return true;if(b.includes(a.slice(0,10)))return true;const wa=a.split(/\s+/).filter(w=>w.length>3),wb=b.split(/\s+/).filter(w=>w.length>3);if(!wa.length)return false;return wa.filter(w=>b.includes(w)).length/wa.length>=0.5;}

function findPPRate(svc,dest,ppRates,offerCurrency){
  const nl=svc.name.toLowerCase();
  const destKeys=Object.keys(ppRates).filter(k=>k.toLowerCase()===dest.toLowerCase()||["europe  excuding switzerland","europe","uk","united kingdom","switzerland ","switzerland"].includes(k.toLowerCase()));
  for(const dk of destKeys)for(const e of ppRates[dk])if(fuzzyMatch(nl,e.name.toLowerCase()))return{...e,source:"exact match"};
  if(svc.type==="RST"){const isInd=/indian|curry|tandoor/i.test(svc.name);const isSw=["switzerland","zurich","geneva","lucerne","interlaken","zermatt"].includes(dest.toLowerCase());const reg=isSw?"Switzerland ":"Europe  excuding Switzerland";const mt=/dinner/i.test(svc.name)?"Buffet Dinner":"Buffet Lunch";const mk=isInd?`${mt} at Indian restaurant 2+1`:"3 Course Local Meal";const re=(ppRates[reg]||[]).find(e=>e.name.includes(mk));if(re)return{...re,source:"meal fallback"};}
  return null;
}

function runBeethoven(lead,rates){
  const{offerCurrency,services,program}=lead;
  const ppRates=rates.pp_rates;
  const results=[],flags=[];
  const ppSvcs=[];
  for(const day of(program||[]))for(const s of(day.services||[]))if(["ENT","RST","FRY"].includes(s.type))ppSvcs.push({...s,day:day.day});
  for(const s of(services||[]))if(["ENT","RST","FRY"].includes(s.type)&&!ppSvcs.find(x=>x.name===s.name))ppSvcs.push(s);
  for(const svc of ppSvcs){
    const dest=svc.destination||"";
    const m=findPPRate(svc,dest,ppRates,offerCurrency);
    if(m){const cv=r2(fx(m.rate,m.currency,offerCurrency));results.push({category:svc.type==="RST"?"Meal":svc.type==="FRY"?"Ferry":"Entrance",service:svc.name,destination:dest,rate:cv,currency:offerCurrency,source:m.source});}
    else{flags.push(`No per-person rate for: ${svc.name}`);results.push({category:"Entrance/Meal",service:svc.name,destination:dest,rate:null,currency:offerCurrency,flag:true});}
  }
  return{results,flags,totalPerPerson:r2(results.filter(r=>!r.flag).reduce((s,r)=>s+(r.rate||0),0))};
}

function selectHotel(city,date,hotelRates){
  const ck=Object.keys(hotelRates).find(k=>k.toLowerCase()===city.toLowerCase());
  if(!ck)return null;
  const month=date.getMonth()+1;
  const isHigh=[4,5,6,7,8,9,10].includes(month);
  const season=isHigh?"high":"low";
  return hotelRates[ck].map(e=>({...e,score:(e.stars===4?10:e.stars===3?5:3)+(e.season===season?5:0)+(e.location_type==="city_center"?3:0)})).sort((a,b)=>b.score-a.score)[0]||null;
}

function runBach(lead,rates){
  const{cities,nights,startDate,offerCurrency}=lead;
  const hotelRates=rates.hotel_rates;
  const results=[],flags=[];
  if(!cities?.length)return{results,flags,totalTwin:0,totalSingle:0};
  const nightsEach=Math.max(1,Math.floor((nights||cities.length)/cities.length));
  const startDt=startDate?new Date(startDate):new Date();
  for(const city of cities){
    const h=selectHotel(city,startDt,hotelRates);
    if(h){const tc=r2(fx(h.twin_rate,h.currency,offerCurrency));const sc=r2(fx(h.single_rate,h.currency,offerCurrency));results.push({city,nights:nightsEach,hotel_name:h.hotel_name,location_type:h.location_type,twin_rate:tc,twin_total:r2(tc*nightsEach),single_rate:sc,single_total:r2(sc*nightsEach),currency:offerCurrency,source:"rate sheet",season:h.season});}
    else{flags.push(`No hotel rate for ${city}`);results.push({city,nights:nightsEach,hotel_name:`4* hotel in ${city} or similar`,twin_rate:null,twin_total:null,single_rate:null,single_total:null,currency:offerCurrency,flag:true});}
  }
  return{results,flags,totalTwin:r2(results.filter(r=>!r.flag).reduce((s,r)=>s+(r.twin_total||0),0)),totalSingle:r2(results.filter(r=>!r.flag).reduce((s,r)=>s+(r.single_total||0),0))};
}

function runChopin(lead,brahms,beethoven,bach){
  const{market,groupSize,offerCurrency}=lead;
  const pg=brahms.total||0,pp=beethoven.totalPerPerson||0,ht=bach.totalTwin||0,hs=bach.totalSingle||0;
  const margin=n=>market==="Indian"?r2(n+50):r2(n/0.86);
  const BRACKETS=[{range:"15-19",div:15},{range:"20-24",div:20},{range:"25-29",div:25},{range:"30-34",div:30},{range:"35-39",div:35},{range:"40-44",div:40},{range:"45-49",div:45}];
  let pricing;
  if(groupSize&&groupSize>0){const sh=r2(pg/groupSize);const tn=r2(sh+pp+ht);const sn=r2(sh+pp+hs);pricing={mode:"large_group",groupSize,twin:{net:tn,final:margin(tn)},single:{net:sn,final:margin(sn)}};}
  else{const brackets=BRACKETS.map(b=>{const sh=r2(pg/b.div);const tn=r2(sh+pp+ht);const sn=r2(sh+pp+hs);return{range:b.range,divisor:b.div,groupShare:sh,twin:{net:tn,final:margin(tn)},single:{net:sn,final:margin(sn)}};});pricing={mode:"brackets",brackets};}
  const marginDesc=market==="Indian"?"Fixed +50 per person":"Net ÷ 0.86 (14% of selling price)";
  return{pricing,market,offerCurrency,marginDesc,baseCosts:{perGroupTotal:pg,perPersonTotal:pp,hotelTwin:ht,hotelSingle:hs}};
}

function runPipeline(lead,rates){
  const brahms=runBrahms(lead,rates);
  const beethoven=runBeethoven(lead,rates);
  const bach=runBach(lead,rates);
  const chopin=runChopin(lead,brahms,beethoven,bach);
  const flags=[...brahms.flags.map(f=>({source:"Transport/Guide",msg:f})),...beethoven.flags.map(f=>({source:"Entrances/Meals",msg:f})),...bach.flags.map(f=>({source:"Hotels",msg:f}))];
  return{lead,brahms,beethoven,bach,chopin,flags};
}

window.Pricing={runPipeline,runBrahms,runBeethoven,runBach,runChopin};

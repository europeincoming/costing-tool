// ─────────────────────────────────────────────────────────────────────────────
// PARSER  — rule-based email parser
// ─────────────────────────────────────────────────────────────────────────────

const CITY_COUNTRY = {
  london:"uk",edinburgh:"uk",glasgow:"uk",manchester:"uk",birmingham:"uk",
  liverpool:"uk",inverness:"uk",cambridge:"uk",cardiff:"uk",oxford:"uk",
  "stratford-upon-avon":"uk",windsor:"uk",bath:"uk",york:"uk",leeds:"uk",
  dublin:"ireland",cork:"ireland",galway:"ireland",limerick:"ireland",
  paris:"france",lyon:"france",nice:"france",marseille:"france",
  bordeaux:"france",strasbourg:"france",tours:"france",bayeux:"france",versailles:"france",
  berlin:"germany",munich:"germany",hamburg:"germany",frankfurt:"germany",
  cologne:"germany",stuttgart:"germany",heidelberg:"germany",konstanz:"germany",
  rome:"italy",milan:"italy",venice:"italy",florence:"italy",naples:"italy",
  pisa:"italy",bologna:"italy",verona:"italy",padua:"italy",siena:"italy",
  taormina:"italy",palermo:"italy",
  zurich:"switzerland",geneva:"switzerland",lucerne:"switzerland",
  bern:"switzerland",basel:"switzerland",interlaken:"switzerland",
  zermatt:"switzerland",engelberg:"switzerland",gstaad:"switzerland",
  lauterbrunnen:"switzerland",grindelwald:"switzerland",montreux:"switzerland",
  lausanne:"switzerland",
  "zell am see":"austria",vienna:"austria",salzburg:"austria",innsbruck:"austria",graz:"austria",
  amsterdam:"netherlands",rotterdam:"netherlands","the hague":"netherlands",
  eindhoven:"netherlands",lisse:"netherlands",
  brussels:"belgium",bruges:"belgium",ghent:"belgium",antwerp:"belgium",
  madrid:"spain",barcelona:"spain",seville:"spain",valencia:"spain",
  granada:"spain",bilbao:"spain",malaga:"spain",
  lisbon:"portugal",porto:"portugal",faro:"portugal",
  oslo:"norway",bergen:"norway",trondheim:"norway",
  stockholm:"sweden",gothenburg:"sweden",
  copenhagen:"denmark",aarhus:"denmark",
  helsinki:"finland",rovaniemi:"finland",
  reykjavik:"iceland",akureyri:"iceland",
  prague:"czech republic",brno:"czech republic",
  budapest:"hungary",debrecen:"hungary",
  warsaw:"poland",krakow:"poland",gdansk:"poland",
  bratislava:"slovakia",
  zagreb:"croatia",split:"croatia",dubrovnik:"croatia",
  ljubljana:"slovenia",bucharest:"romania",sofia:"bulgaria",
  athens:"greece",thessaloniki:"greece",luxembourg:"luxembourg"
};

const COUNTRY_ALIASES = {
  "uk":"uk","united kingdom":"uk","england":"uk","scotland":"uk","wales":"uk",
  "northern ireland":"uk","great britain":"uk",
  "ireland":"ireland","republic of ireland":"ireland",
  "switzerland":"switzerland","swiss":"switzerland",
  "france":"france","germany":"germany","italy":"italy",
  "spain":"spain","portugal":"portugal","netherlands":"netherlands","holland":"netherlands",
  "belgium":"belgium","austria":"austria","czech republic":"czech republic","czechia":"czech republic",
  "hungary":"hungary","poland":"poland","norway":"norway","sweden":"sweden",
  "denmark":"denmark","finland":"finland","iceland":"iceland",
  "greece":"greece","croatia":"croatia","slovenia":"slovenia",
  "bulgaria":"bulgaria","romania":"romania","slovakia":"slovakia","luxembourg":"luxembourg"
};

const ALL_CITIES = Object.keys(CITY_COUNTRY).sort((a,b)=>b.length-a.length);

const MONTHS = {
  jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12,
  january:1,february:2,march:3,april:4,june:6,july:7,august:8,
  september:9,october:10,november:11,december:12
};

function parseDate(str){
  if(!str)return null;
  str=str.trim();
  let m;
  // YYYY-MM-DD
  if((m=str.match(/(\d{4})-(\d{2})-(\d{2})/))){return new Date(+m[1],+m[2]-1,+m[3]);}
  // DD/MM/YYYY or DD-MM-YYYY
  if((m=str.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/))){return new Date(+m[3],+m[2]-1,+m[1]);}
  // 15th March 2026 or 15 March 2026
  if((m=str.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)\s+(\d{4})/i))){
    const mon=MONTHS[m[2].toLowerCase()];
    if(mon)return new Date(+m[3],mon-1,+m[1]);
  }
  // March 15 2026
  if((m=str.match(/([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/i))){
    const mon=MONTHS[m[1].toLowerCase()];
    if(mon)return new Date(+m[3],mon-1,+m[2]);
  }
  return null;
}

function extractDates(text){
  const found=[];
  const re=/(\d{1,2}(?:st|nd|rd|th)?\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}|\d{4}-\d{2}-\d{2})/gi;
  let m;
  while((m=re.exec(text))!==null){
    const d=parseDate(m[0]);
    if(d&&d.getFullYear()>=2025)found.push(d);
  }
  found.sort((a,b)=>a-b);
  return [...new Map(found.map(d=>[d.getTime(),d])).values()];
}

function extractPax(text){
  const patterns=[
    /(\d+)\s*(?:pax|passengers?|persons?|people|adults?|travell?ers?|guests?)/i,
    /(?:group of|party of|group size[:\s]+|total pax[:\s]+)(\d+)/i,
    /(\d+)\s*(?:nos?\.?|numbers?)\s*(?:pax|persons?|adults?)/i,
  ];
  for(const p of patterns){
    const m=text.match(p);
    if(m){const n=parseInt(m[1]);if(n>0&&n<5000)return n;}
  }
  return null;
}

function extractNights(text){
  const m=text.match(/(\d+)\s*nights?/i);
  if(m)return parseInt(m[1]);
  const dates=extractDates(text);
  if(dates.length>=2){
    const diff=Math.round((dates[dates.length-1]-dates[0])/(1000*60*60*24));
    if(diff>0&&diff<90)return diff;
  }
  return null;
}

function detectCities(text){
  const norm=text.toLowerCase();
  const found=[];
  for(const city of ALL_CITIES){
    const re=new RegExp(`\\b${city.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`,'i');
    if(re.test(norm)&&!found.includes(city))found.push(city);
  }
  // Try to order by appearance in text
  found.sort((a,b)=>{
    const ia=norm.indexOf(a),ib=norm.indexOf(b);
    return ia-ib;
  });
  return found;
}

function detectCountries(text,cities){
  const found=new Set();
  for(const[alias,canonical]of Object.entries(COUNTRY_ALIASES)){
    const re=new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`,'i');
    if(re.test(text))found.add(canonical);
  }
  for(const c of cities){
    const country=CITY_COUNTRY[c];
    if(country)found.add(country);
  }
  return[...found];
}

function detectMarket(text){
  if(/\.in\b|\+91\b|india[n\b]|mumbai|delhi|bangalore|chennai|kolkata|pune|ahmedabad|pvt\.?\s*ltd|private\s+limited/i.test(text))return"Indian";
  return"Non-Indian";
}

function determineCurrency(countries){
  if(!countries||!countries.length)return"EUR";
  const ukFamily=["uk","ireland"];
  if(countries.length===1){
    const c=countries[0];
    if(c==="switzerland")return"CHF";
    if(ukFamily.includes(c))return"GBP";
    return"EUR";
  }
  if(countries.every(c=>ukFamily.includes(c)))return"GBP";
  return"EUR";
}

function buildProgram(cities,nights,startDate){
  if(!cities.length)return[];
  const totalNights=nights||cities.length;
  const program=[];
  let dayNum=1;
  let dt=startDate?new Date(startDate):null;
  const advance=()=>{if(dt){const d=new Date(dt);dt.setDate(dt.getDate()+1);return d;}return null;};

  // Distribute nights
  const nightsMap={};
  if(cities.length===1){nightsMap[cities[0]]=totalNights;}
  else{
    let rem=totalNights;
    for(let i=0;i<cities.length;i++){
      const n=i===cities.length-1?rem:Math.max(1,Math.floor(totalNights/cities.length));
      nightsMap[cities[i]]=n;rem-=n;
    }
  }

  // Day 1: arrival
  const first=cities[0];
  program.push({day:dayNum++,date:advance(),title:`Arrival in ${titleCase(first)}`,overnight:first,
    services:[{type:"MTC",name:`Airport arrival transfer`,destination:first}]});

  for(let ci=0;ci<cities.length;ci++){
    const city=cities[ci];
    const stay=nightsMap[city]||1;
    const isLast=ci===cities.length-1;
    const sightDays=isLast?stay-1:stay;

    for(let n=0;n<sightDays;n++){
      program.push({day:dayNum++,date:advance(),title:`${titleCase(city)} sightseeing`,overnight:city,
        services:[
          {type:"MTC",name:`Coach at disposal`,destination:city},
          {type:"GUI",name:`City sightseeing tour`,destination:city}
        ]});
    }

    if(!isLast){
      const next=cities[ci+1];
      program.push({day:dayNum++,date:advance(),title:`${titleCase(city)} to ${titleCase(next)}`,overnight:next,
        services:[{type:"MTC",name:`Coach at disposal`,destination:city}]});
    }
  }

  // Departure day
  const last=cities[cities.length-1];
  program.push({day:dayNum,date:advance(),title:`Departure from ${titleCase(last)}`,overnight:null,
    services:[{type:"MTC",name:`Airport departure transfer`,destination:last}]});

  return program;
}

function titleCase(s){return s.replace(/\b\w/g,c=>c.toUpperCase());}

function parseEmail(emailText){
  const text=emailText||"";
  const flags=[];

  const pax=extractPax(text);
  const nights=extractNights(text);
  const dates=extractDates(text);
  const startDate=dates[0]||null;
  const endDate=dates.length>1?dates[dates.length-1]:null;
  const market=detectMarket(text);
  const cities=detectCities(text);
  const countries=detectCountries(text,cities);
  const offerCurrency=determineCurrency(countries);

  const hasTM=/tour manager|tour leader|\btm\b/i.test(text);

  const program=buildProgram(cities,nights,startDate);

  // Add TM to day 1 if mentioned
  if(hasTM&&program.length>0){
    program[0].services.push({type:"GUI",name:"Tour Manager",destination:cities[0]||""});
  }

  // From/subject extraction
  const fromM=text.match(/^from[:\s]+([^\n<]+)/im);
  const agencyName=fromM?fromM[1].trim():"Unknown Agency";
  const subjectM=text.match(/^subject[:\s]+([^\n]+)/im);
  const subject=subjectM?subjectM[1].trim():"Tour Quote Request";

  if(!pax)flags.push("⚠ Group size not found — bracket pricing will be used");
  if(!startDate)flags.push("⚠ Travel dates not found — hotel seasonal pricing may vary");
  if(!cities.length)flags.push("⚠ No cities detected — please review itinerary manually");
  if(nights===null)flags.push("⚠ Number of nights not found — estimated from city count");

  return{
    raw:text,agencyName,subject,market,
    pax,nights:nights||(cities.length||1),days:(nights||(cities.length||1))+1,
    startDate,endDate,cities,countries,offerCurrency,program,flags,
    hasTM
  };
}

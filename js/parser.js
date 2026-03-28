// ─────────────────────────────────────────────────────────────────────────────
// PARSER.JS — Smart rule-based email parser
// No external API dependencies. Works instantly, no tokens needed.
// When Claude/OpenAI API is approved, replace parseEmail() with AI call.
// ─────────────────────────────────────────────────────────────────────────────

const CITY_COUNTRY = {
  london:"uk",edinburgh:"uk",glasgow:"uk",manchester:"uk",birmingham:"uk",
  liverpool:"uk",inverness:"uk",cambridge:"uk",cardiff:"uk",oxford:"uk",
  "stratford-upon-avon":"uk",windsor:"uk",bath:"uk",york:"uk",leeds:"uk",
  dublin:"ireland",cork:"ireland",galway:"ireland",limerick:"ireland",
  paris:"france",lyon:"france",nice:"france",marseille:"france",
  bordeaux:"france",strasbourg:"france",versailles:"france",
  berlin:"germany",munich:"germany",hamburg:"germany",frankfurt:"germany",
  cologne:"germany",stuttgart:"germany",heidelberg:"germany",
  rome:"italy",milan:"italy",venice:"italy",florence:"italy",naples:"italy",
  pisa:"italy",bologna:"italy",verona:"italy",padua:"italy",siena:"italy",
  taormina:"italy",palermo:"italy",sorrento:"italy",
  zurich:"switzerland",geneva:"switzerland",lucerne:"switzerland",
  bern:"switzerland",basel:"switzerland",interlaken:"switzerland",
  zermatt:"switzerland",engelberg:"switzerland",gstaad:"switzerland",
  lauterbrunnen:"switzerland",grindelwald:"switzerland",montreux:"switzerland",lausanne:"switzerland",
  vienna:"austria",salzburg:"austria",innsbruck:"austria",graz:"austria","zell am see":"austria",
  amsterdam:"netherlands",rotterdam:"netherlands",lisse:"netherlands",
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
  bratislava:"slovakia",zagreb:"croatia",split:"croatia",dubrovnik:"croatia",
  ljubljana:"slovenia",bucharest:"romania",sofia:"bulgaria",
  athens:"greece",thessaloniki:"greece",luxembourg:"luxembourg"
};

const COUNTRY_ALIASES = {
  "uk":"uk","united kingdom":"uk","england":"uk","scotland":"uk","wales":"uk","great britain":"uk",
  "ireland":"ireland","republic of ireland":"ireland",
  "switzerland":"switzerland","swiss":"switzerland",
  "france":"france","germany":"germany","italy":"italy","spain":"spain","portugal":"portugal",
  "netherlands":"netherlands","holland":"netherlands","belgium":"belgium","austria":"austria",
  "czech republic":"czech republic","czechia":"czech republic","hungary":"hungary",
  "poland":"poland","croatia":"croatia","greece":"greece","slovakia":"slovakia",
  "slovenia":"slovenia","romania":"romania","bulgaria":"bulgaria","luxembourg":"luxembourg",
  "norway":"norway","sweden":"sweden","denmark":"denmark","finland":"finland","iceland":"iceland"
};

const COUNTRY_DEFAULT_CITIES = {
  "switzerland":["Zurich","Lucerne","Interlaken"],
  "uk":["London"],"england":["London"],"scotland":["Edinburgh"],
  "ireland":["Dublin"],"france":["Paris"],"germany":["Berlin","Munich"],
  "italy":["Rome","Florence","Venice"],"spain":["Madrid","Barcelona"],
  "portugal":["Lisbon"],"austria":["Vienna","Salzburg"],
  "netherlands":["Amsterdam"],"belgium":["Brussels"],
  "czech republic":["Prague"],"hungary":["Budapest"],
  "norway":["Oslo"],"sweden":["Stockholm"],"denmark":["Copenhagen"],
  "finland":["Helsinki"],"iceland":["Reykjavik"],
  "croatia":["Zagreb","Dubrovnik"],"greece":["Athens"]
};

function determineCurrency(countries) {
  if (!countries || !countries.length) return "EUR";
  const s = new Set(countries.map(c => c.toLowerCase()));
  if (s.size === 1 && s.has("switzerland")) return "CHF";
  if ([...s].every(c => ["uk","england","scotland","wales","northern ireland","ireland"].includes(c))) return "GBP";
  return "EUR";
}

function detectMarket(text) {
  return /\.in\b|\+91|\bindia\b|\bindian\b|pvt\.?\s*ltd|private\s+limited|mumbai|delhi|bangalore|kolkata|chennai|pune|ahmedabad|hyderabad|dnata/i.test(text)
    ? "Indian" : "Non-Indian";
}

function detectCities(text) {
  // Remove service keywords that could be mistaken for cities
  let cleaned = text
    .replace(/\btours?\s*:\s*\S+/gi, " ")
    .replace(/\btour\s+(?:operator|package|manager|leader|guide)\b/gi, " ")
    .replace(/\bno\s+of\s+rooms?\b/gi, " ")
    .replace(/\bboard\s+type\b/gi, " ");

  const cities = [];
  const usedPos = new Set();
  const cityList = Object.keys(CITY_COUNTRY).sort((a,b) => b.length - a.length);

  for (const city of cityList) {
    const idx = cleaned.toLowerCase().indexOf(city);
    if (idx === -1) continue;
    const before = idx > 0 ? cleaned[idx-1] : " ";
    const after  = idx+city.length < cleaned.length ? cleaned[idx+city.length] : " ";
    if (/[a-z]/i.test(before) || /[a-z]/i.test(after)) continue;
    let overlap = false;
    for (let i=idx; i<idx+city.length; i++) { if (usedPos.has(i)) { overlap=true; break; } }
    if (overlap) continue;
    for (let i=idx; i<idx+city.length; i++) usedPos.add(i);
    cities.push({ name: city.replace(/\b\w/g, c => c.toUpperCase()), index: idx });
  }
  cities.sort((a,b) => a.index - b.index);
  return cities.map(c => c.name);
}

function detectCountries(text) {
  const found = new Set();
  for (const [alias, canonical] of Object.entries(COUNTRY_ALIASES)) {
    if (new RegExp("\\b"+alias.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+"\\b","i").test(text))
      found.add(canonical);
  }
  return [...found];
}

function extractPax(text) {
  const patterns = [
    /(\d+)\s*adults?/i, /(\d+)\s*pax\b/i,
    /(\d+)\s*passengers?/i, /(\d+)\s*persons?/i,
    /group\s+of\s+(\d+)/i
  ];
  for (const p of patterns) { const m = text.match(p); if (m) return parseInt(m[1]); }
  return null;
}

function extractChildren(text) {
  const m = text.match(/(\d+)\s*(?:children|child|kids?)/i);
  return m ? parseInt(m[1]) : null;
}

function extractNights(text) {
  const nightsM = text.match(/(\d+)\s*nights?/i);
  if (nightsM) return parseInt(nightsM[1]);
  const daysM = text.match(/(?:max\.?\s+)?(\d+)\s*days?\b/i);
  if (daysM) return Math.max(1, parseInt(daysM[1]) - 1);
  const weekM = text.match(/(\d+)\s*weeks?/i);
  if (weekM) return parseInt(weekM[1]) * 7;
  return null;
}

function extractDates(text) {
  const dates = [];
  const months = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12,
    january:1,february:2,march:3,april:4,june:6,july:7,august:8,september:9,october:10,november:11,december:12};

  const patterns = [
    { re:/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/g, fn:m=>new Date(+m[3],+m[2]-1,+m[1]) },
    { re:/(\d{4})-(\d{2})-(\d{2})/g, fn:m=>new Date(+m[1],+m[2]-1,+m[3]) },
    { re:/(\d{1,2})\s+(jan\w*|feb\w*|mar\w*|apr\w*|may|jun\w*|jul\w*|aug\w*|sep\w*|oct\w*|nov\w*|dec\w*)\s+(\d{4})/gi,
      fn:m=>new Date(+m[3],(months[m[2].toLowerCase().slice(0,3)]||1)-1,+m[1]) },
    { re:/(jan\w*|feb\w*|mar\w*|apr\w*|may|jun\w*|jul\w*|aug\w*|sep\w*|oct\w*|nov\w*|dec\w*)\s+(\d{1,2}),?\s+(\d{4})/gi,
      fn:m=>new Date(+m[3],(months[m[1].toLowerCase().slice(0,3)]||1)-1,+m[2]) }
  ];
  for (const {re,fn} of patterns) {
    let m; while((m=re.exec(text))!==null){try{const d=fn(m);if(!isNaN(d)&&d.getFullYear()>=2025)dates.push(d);}catch(e){}}
  }

  // Vague dates: "3rd week of July", "mid August"
  const vagueM = text.match(/(\d+(?:st|nd|rd|th)?|first|second|third|last|mid)\s+week\s+of\s+(jan\w*|feb\w*|mar\w*|apr\w*|may|jun\w*|jul\w*|aug\w*|sep\w*|oct\w*|nov\w*|dec\w*)/i);
  if (vagueM && !dates.length) {
    const monthNum = months[vagueM[2].toLowerCase().slice(0,3)] || 7;
    const weekWord = vagueM[1].toLowerCase();
    const weekNum = {first:1,second:2,third:3,fourth:4,last:4}[weekWord] || parseInt(weekWord) || 2;
    const year = new Date().getFullYear();
    dates.push(new Date(year, monthNum-1, Math.min((weekNum-1)*7+1, 28)));
  }

  dates.sort((a,b)=>a-b);
  return dates;
}

function buildProgram(cities, nights, startDate, wantsSightseeing, wantsTransfer, hasTM) {
  if (!cities.length) return [];
  const program = [];
  let dayNum = 1;
  let cur = startDate ? new Date(startDate) : null;
  const advance = () => { const d=cur?formatDate(cur):null; if(cur)cur=new Date(cur.getTime()+86400000); return d; };
  const nightsEach = Math.max(1, Math.floor(nights/cities.length));

  cities.forEach((city, ci) => {
    const isLast = ci === cities.length-1;
    const stay = isLast ? Math.max(1, nights-nightsEach*ci) : nightsEach;
    for (let n=0; n<stay; n++) {
      const svcs = [];
      if (n===0 && wantsTransfer && ci===0) svcs.push({type:"MTC",name:"Airport Arrival Transfer",destination:city});
      svcs.push({type:"MTC",name:"Coach at disposal",destination:city});
      if (n===0 && hasTM) svcs.push({type:"GUI",name:"Tour Manager",destination:city});
      if (n===0 && wantsSightseeing) svcs.push({type:"GUI",name:"City sightseeing tour",destination:city});
      program.push({day:dayNum++,date:advance(),city,overnight:city,services:svcs});
    }
    if (!isLast)
      program.push({day:dayNum++,date:advance(),city,overnight:cities[ci+1],
        services:[{type:"MTC",name:"Coach at disposal",destination:city}]});
  });

  program.push({day:dayNum,date:advance(),city:cities[cities.length-1],overnight:null,
    services:[{type:"MTC",name:"Departure Transfer",destination:cities[cities.length-1]}]});
  return program;
}

function formatDate(d) {
  if (!d) return null;
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}

async function parseEmail(emailText) {
  const text = emailText || "";
  const flags = [];

  let cities    = detectCities(text);
  let countries = detectCountries(text);

  // Infer cities from country if none found
  if (!cities.length && countries.length) {
    for (const c of countries) {
      const defaults = COUNTRY_DEFAULT_CITIES[c];
      if (defaults) cities = [...cities, ...defaults];
    }
    if (cities.length) flags.push("ℹ Cities inferred from country — verify in Override fields");
  }

  // Infer countries from cities
  if (!countries.length && cities.length) {
    const inferred = new Set();
    for (const city of cities) { const c=CITY_COUNTRY[city.toLowerCase()]; if(c) inferred.add(c); }
    countries = [...inferred];
  }

  const pax        = extractPax(text);
  const children   = extractChildren(text);
  const nights     = extractNights(text);
  const dates      = extractDates(text);
  const startDate  = dates[0] ? formatDate(dates[0]) : null;
  const endDate    = dates.length>1 ? formatDate(dates[dates.length-1]) : null;
  const market     = detectMarket(text);
  const offerCurrency = determineCurrency(countries);

  const hotelM  = text.match(/(\d)\s*\*\s*(?:hotel|star)?/i) || text.match(/(\d)\s*star/i);
  const hotelCat = hotelM ? hotelM[1]+"*" : "4*";

  const fromM = text.match(/^from[:\s]+([^\n<]+)/im);
  const agencyName = fromM ? fromM[1].trim().replace(/\s*<.*>/,"") : "Unknown Agency";

  const wantsSightseeing = /\btours?\s*:\s*yes\b|\bsightseeing\b|\bactivities\b|\battractions\b|\bexcursions?\b/i.test(text);
  const wantsTransfer    = /airport\s*transfers?\s*:\s*yes|\btransfer\b.*\bairport\b|\barrival\s*transfer\b/i.test(text);
  const hasTM            = /\btour\s*manager\b|\btour\s*leader\b/i.test(text);

  // Special notes extraction
  const boardM  = text.match(/board\s*(?:type|basis)?\s*:\s*([^\n,]+)/i);
  const budgetM = text.match(/(?:budget|allocation)[:\s]+([^\n]+)/i);
  const airlineM= text.match(/(?:airlines?|flight)[:\s]+([^\n]+)/i);
  const roomsM  = text.match(/(?:no\.?\s*of\s*rooms?|rooms?)\s*:\s*([^\n,]+)/i);
  const specialNotes = [
    boardM   ? "Board: "+boardM[1].trim()    : null,
    roomsM   ? "Rooms: "+roomsM[1].trim()    : null,
    budgetM  ? "Budget: "+budgetM[1].trim()  : null,
    airlineM ? "Airline: "+airlineM[1].trim(): null,
  ].filter(Boolean).join(" · ");

  const services = [];
  if (wantsTransfer) services.push({type:"MTC",name:"Airport Transfer",destination:cities[0]||""});
  else if (cities.length) services.push({type:"MTC",name:"Coach at disposal",destination:cities[0]||""});
  if (hasTM) services.push({type:"GUI",name:"Tour Manager",destination:cities[0]||""});
  if (wantsSightseeing) for (const city of cities) services.push({type:"GUI",name:"City sightseeing tour",destination:city});

  if (!pax)           flags.push("⚠ Group size not found — bracket pricing will be used");
  if (!startDate)     flags.push("⚠ Travel dates not found — hotel seasonal pricing may vary");
  if (!cities.length) flags.push("⚠ No cities detected — please enter cities in Override fields");
  if (nights===null)  flags.push("⚠ Nights not found — estimated from city count");

  const nightsFinal = nights || Math.max(cities.length, 1);

  return {
    cities, countries,
    nights: nightsFinal, days: nightsFinal+1,
    pax, children, startDate, endDate,
    market, offerCurrency, hotelCategory: hotelCat,
    leadType: /day\s*1|day\s*2|arrive|depart/i.test(text) ? "explicit" : "vague",
    agencyName, specialNotes,
    hasTM, wantsSightseeing, wantsTransfer,
    program: buildProgram(cities, nightsFinal, startDate, wantsSightseeing, wantsTransfer, hasTM),
    services, flags, parseMethod:"rule-based"
  };
}

window.Parser = { parseEmail, determineCurrency, detectMarket };

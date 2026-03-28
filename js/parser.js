// ─────────────────────────────────────────────────────────────────────────────
// PARSER.JS — Gemini 2.0 Flash via Google AI Studio (free tier)
// ─────────────────────────────────────────────────────────────────────────────

const GEMINI_API_KEY = "AIzaSyBMEp94tJ14ajoNK_WHDGJLKSnKpmhTJnM";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + GEMINI_API_KEY;

const CITY_COUNTRY = {
  london:"uk",edinburgh:"uk",glasgow:"uk",manchester:"uk",birmingham:"uk",
  liverpool:"uk",inverness:"uk",cambridge:"uk",cardiff:"uk",oxford:"uk",
  "stratford-upon-avon":"uk",windsor:"uk",bath:"uk",york:"uk",leeds:"uk",
  dublin:"ireland",cork:"ireland",galway:"ireland",limerick:"ireland",
  paris:"france",lyon:"france",nice:"france",marseille:"france",
  bordeaux:"france",strasbourg:"france",tours:"france",versailles:"france",
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

function determineCurrency(countries) {
  if (!countries || !countries.length) return "EUR";
  const s = new Set(countries.map(c => c.toLowerCase()));
  if (s.size === 1 && s.has("switzerland")) return "CHF";
  if ([...s].every(c => ["uk","england","scotland","wales","northern ireland","ireland"].includes(c))) return "GBP";
  return "EUR";
}

function detectMarket(text) {
  return /\.in\b|\+91|\bindia\b|\bindian\b|pvt\.?\s*ltd|private\s+limited|mumbai|delhi|bangalore|kolkata|chennai|pune|ahmedabad|hyderabad/i.test(text)
    ? "Indian" : "Non-Indian";
}

// ── Gemini system prompt ──────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a travel lead parser for Europe Incoming, a European tour operator. Extract structured data from travel agent lead emails and return ONLY valid JSON with no markdown, no code fences, no explanation.

CRITICAL RULES:
- "Tours: Yes" or "Tours: tours" = client wants sightseeing/activities. NOT a city name. Set wants_sightseeing: true.
- "X days" means nights = X - 1. Example: "7 days" = 6 nights. "X nights" = X nights exactly.
- "3rd week of July" = set start_date to approx Monday of that week e.g. 2025-07-14.
- group_size = number of ADULTS only. Note children count separately in "children" field.
- If destination is a country (e.g. "Switzerland"), infer main tourist cities (e.g. ["Zurich","Lucerne","Interlaken"]).
- market: "Indian" if .in domain, mentions India/Indian company/Indian city. Otherwise "Non-Indian".
- offer_currency: "CHF" if Switzerland only. "GBP" if UK/Ireland only. "EUR" for everything else or multi-country.
- wants_airport_transfer: true if "Airport Transfers: Yes" or similar.
- has_tour_manager: true ONLY if "tour manager" or "tour leader" explicitly mentioned.
- hotel_category: extract star rating if mentioned, default "4*".
- For vague leads (no day-by-day itinerary) set lead_type "vague". For detailed day-by-day set "explicit".
- agency_name: extract from email signature or From field.
- special_notes: capture board type, room type, budget info, airline, or anything else relevant.

Return ONLY this JSON, no other text:
{
  "cities": ["Title Case city names"],
  "countries": ["lowercase country names"],
  "nights": number or null,
  "pax": number or null,
  "children": number or null,
  "start_date": "YYYY-MM-DD" or null,
  "end_date": "YYYY-MM-DD" or null,
  "market": "Indian" or "Non-Indian",
  "offer_currency": "EUR" or "GBP" or "CHF",
  "has_tour_manager": false,
  "wants_sightseeing": false,
  "wants_airport_transfer": false,
  "hotel_category": "4*",
  "lead_type": "vague",
  "agency_name": "string",
  "special_notes": "string",
  "services": [
    {"type": "MTC or GUI or ENT or RST or FRY", "name": "service name", "destination": "city"}
  ]
}`;

// ── Call Gemini API ───────────────────────────────────────────────────────────
async function parseWithGemini(emailText) {
  const body = {
    contents: [{
      parts: [{
        text: SYSTEM_PROMPT + "\n\nParse this travel lead email:\n\n" + emailText
      }]
    }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 1024
    }
  };

  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error("Gemini API error " + res.status + ": " + err.slice(0, 200));
  }

  const data = await res.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  // Strip any accidental markdown fences
  const clean = raw.replace(/```json\n?/g,"").replace(/```\n?/g,"").trim();
  return JSON.parse(clean);
}

// ── Rule-based fallback ───────────────────────────────────────────────────────
function parseRuleBased(emailText) {
  const text = emailText;
  const flags = [];

  // Strip "Tours: Yes/No" before city detection to avoid "tours" being picked up as Tours, France
  const cleanedForCities = text.replace(/\btours?\s*:\s*(yes|no|tours?)\b/gi, "");

  const cities = [];
  const usedPos = new Set();
  const cityList = Object.keys(CITY_COUNTRY).sort((a,b) => b.length - a.length);
  for (const city of cityList) {
    const idx = cleanedForCities.toLowerCase().indexOf(city);
    if (idx === -1) continue;
    const before = idx > 0 ? cleanedForCities[idx-1] : " ";
    const after  = idx + city.length < cleanedForCities.length ? cleanedForCities[idx+city.length] : " ";
    if (/[a-z]/i.test(before) || /[a-z]/i.test(after)) continue;
    let overlap = false;
    for (let i = idx; i < idx+city.length; i++) { if (usedPos.has(i)) { overlap=true; break; } }
    if (overlap) continue;
    for (let i = idx; i < idx+city.length; i++) usedPos.add(i);
    cities.push(city.replace(/\b\w/g, c => c.toUpperCase()));
  }

  // Countries
  const countries = new Set();
  for (const [alias, canonical] of Object.entries(COUNTRY_ALIASES)) {
    if (new RegExp("\\b" + alias.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + "\\b", "i").test(text))
      countries.add(canonical);
  }
  for (const city of cities) {
    const c = CITY_COUNTRY[city.toLowerCase()]; if (c) countries.add(c);
  }

  // Pax — adults only
  const paxM = text.match(/(\d+)\s*adults?/i) || text.match(/(\d+)\s*pax/i) || text.match(/(\d+)\s*passengers?/i);
  const pax = paxM ? parseInt(paxM[1]) : null;
  const childM = text.match(/(\d+)\s*children/i);
  const children = childM ? parseInt(childM[1]) : null;

  // Nights — handle both "X nights" and "X days"
  const nightsM = text.match(/(\d+)\s*nights?/i);
  const daysM   = text.match(/\bmax\s+(\d+)\s*days?\b/i) || text.match(/(\d+)\s*days?\b/i);
  let nights = nightsM ? parseInt(nightsM[1]) : (daysM ? parseInt(daysM[1]) - 1 : null);
  if (nights !== null && nights < 1) nights = 1;

  // Dates
  const dates = [];
  const dateRe = [
    { re:/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/g, fn:m=>new Date(+m[3],+m[2]-1,+m[1]) },
    { re:/(\d{4})-(\d{2})-(\d{2})/g,                fn:m=>new Date(+m[1],+m[2]-1,+m[3]) }
  ];
  for (const {re,fn} of dateRe) {
    let m; while((m=re.exec(text))!==null){const d=fn(m);if(!isNaN(d)&&d.getFullYear()>=2025)dates.push(d);}
  }
  dates.sort((a,b)=>a-b);
  const startDate = dates[0] ? formatDate(dates[0]) : null;
  const endDate   = dates.length>1 ? formatDate(dates[dates.length-1]) : null;

  const countriesArr = [...countries];
  const market = detectMarket(text);
  const offerCurrency = determineCurrency(countriesArr);
  const wantsSightseeing = /\btours?\s*:\s*yes|\bsightseeing\b|\bactivities\b|\battractions\b/i.test(text);
  const hasTM = /tour.?manager|tour.?leader/i.test(text);
  const wantsTransfer = /airport.?transfer|transfer.?airport/i.test(text);

  const services = [];
  if (wantsTransfer) services.push({type:"MTC", name:"Airport Transfer", destination:cities[0]||""});
  if (/coach.at.disposal|touring.coach/i.test(text)) services.push({type:"MTC", name:"Coach at disposal", destination:cities[0]||""});
  if (hasTM) services.push({type:"GUI", name:"Tour Manager", destination:cities[0]||""});
  if (wantsSightseeing) {
    for (const city of cities) services.push({type:"GUI", name:"City sightseeing tour", destination:city});
  }

  if (!pax)          flags.push("⚠ Group size not found — using bracket pricing");
  if (!startDate)    flags.push("⚠ Travel dates not found — hotel seasonal pricing may vary");
  if (!cities.length)flags.push("⚠ No cities detected — please enter cities manually");
  if (nights===null) flags.push("⚠ Nights not found — estimated from city count");

  return {
    cities, countries: countriesArr,
    nights: nights||(cities.length||1), days:(nights||(cities.length||1))+1,
    pax, children, startDate, endDate,
    market, offerCurrency,
    hasTM, wantsSightseeing, wantsTransfer,
    hotelCategory:"4*", leadType:"vague",
    agencyName:"Unknown Agency", specialNotes:"",
    program: buildProgram(cities, nights||(cities.length||1), startDate, services, wantsSightseeing),
    services, flags,
    parseMethod:"rule-based"
  };
}

// ── Build day program ─────────────────────────────────────────────────────────
function buildProgram(cities, nights, startDate, services, wantsSightseeing) {
  if (!cities.length) return [];
  const program = [];
  let dayNum = 1;
  let cur = startDate ? new Date(startDate) : null;
  const advance = () => { const d = cur ? formatDate(cur) : null; if(cur) cur=new Date(cur.getTime()+86400000); return d; };
  const nightsEach = Math.max(1, Math.floor(nights / cities.length));

  cities.forEach((city, ci) => {
    const stay = ci===cities.length-1 ? Math.max(1, nights-nightsEach*ci) : nightsEach;
    for (let n=0; n<stay; n++) {
      const svcs = [{type:"MTC", name:"Coach at disposal", destination:city}];
      if (n===0 && wantsSightseeing) svcs.push({type:"GUI", name:"City sightseeing tour", destination:city});
      program.push({day:dayNum++, date:advance(), city, overnight:city, services:svcs});
    }
    if (ci < cities.length-1) {
      program.push({day:dayNum++, date:advance(), city, overnight:cities[ci+1],
        services:[{type:"MTC",name:"Coach at disposal",destination:city}]});
    }
  });

  program.push({day:dayNum, date:advance(), city:cities[cities.length-1], overnight:null,
    services:[{type:"MTC",name:"Departure Transfer",destination:cities[cities.length-1]}]});
  return program;
}

function formatDate(d) {
  if (!d) return null;
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}

// ── Main entry point ──────────────────────────────────────────────────────────
async function parseEmail(emailText) {
  // Try Gemini if key is set
  if (GEMINI_API_KEY && GEMINI_API_KEY !== "PASTE_YOUR_KEY_HERE") {
    try {
      const ai = await parseWithGemini(emailText);
      const cities    = ai.cities    || [];
      const countries = ai.countries || [];
      const nights    = ai.nights    || Math.max(cities.length, 1);
      const services  = ai.services  || [];

      // Auto-add services from AI flags if not already in services array
      if (ai.wants_airport_transfer && !services.find(s=>/transfer/i.test(s.name)))
        services.unshift({type:"MTC", name:"Airport Transfer", destination:cities[0]||""});
      if (ai.wants_sightseeing) {
        for (const city of cities) {
          if (!services.find(s=>s.type==="GUI"&&s.destination===city&&/sightseeing|tour/i.test(s.name)))
            services.push({type:"GUI", name:"City sightseeing tour", destination:city});
        }
      }
      if (ai.has_tour_manager && !services.find(s=>/tour.?manager/i.test(s.name)))
        services.unshift({type:"GUI", name:"Tour Manager", destination:cities[0]||""});

      return {
        cities, countries,
        nights, days: nights+1,
        pax:           ai.pax            || null,
        children:      ai.children       || null,
        startDate:     ai.start_date     || null,
        endDate:       ai.end_date       || null,
        market:        ai.market         || detectMarket(emailText),
        offerCurrency: ai.offer_currency || determineCurrency(countries),
        hasTM:         ai.has_tour_manager   || false,
        wantsSightseeing: ai.wants_sightseeing || false,
        wantsTransfer: ai.wants_airport_transfer || false,
        hotelCategory: ai.hotel_category || "4*",
        leadType:      ai.lead_type      || "vague",
        agencyName:    ai.agency_name    || "Unknown Agency",
        specialNotes:  ai.special_notes  || "",
        program: buildProgram(cities, nights, ai.start_date, services, ai.wants_sightseeing),
        services, flags: [],
        parseMethod: "gemini"
      };
    } catch(err) {
      console.warn("Gemini parse failed, falling back:", err.message);
      const result = parseRuleBased(emailText);
      result.flags.unshift("⚠ AI parse failed (" + err.message.slice(0,80) + ") — used rule-based fallback");
      return result;
    }
  }

  // No key — rule-based only
  return parseRuleBased(emailText);
}

window.Parser = { parseEmail, determineCurrency, detectMarket };

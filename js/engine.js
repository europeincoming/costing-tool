// ─────────────────────────────────────────────────────────────────────────────
// COSTING ENGINE  —  Brahms + Beethoven + Bach + Chopin
// Pure deterministic logic. No AI. Reads from window.RATES (loaded at startup).
// ─────────────────────────────────────────────────────────────────────────────

const FX = {
  EUR: { GBP: 0.85365, CHF: 0.90657, NOK: 11.72 },
  GBP: { EUR: 1.17144, CHF: 1.10268, NOK: 13.73 },
  CHF: { EUR: 1.10314, GBP: 0.90657, NOK: 12.94 },
  NOK: { EUR: 0.0853, GBP: 0.0728, CHF: 0.0773 }
};

function fx(amount, from, to) {
  if (!amount || from === to) return amount;
  if (FX[from]?.[to]) return amount * FX[from][to];
  // via EUR
  const eur = FX[from]?.EUR ? amount * FX[from].EUR : amount;
  return FX.EUR?.[to] ? eur * FX.EUR[to] : amount;
}

function r2(n) { return Math.round((n || 0) * 100) / 100; }

// ── City / Country helpers ────────────────────────────────────────────────

function cityToCountry(city) {
  if (!city) return null;
  return window.RATES.cityCountry[city.toLowerCase()] || null;
}

function countryProxy(country) {
  if (!country) return null;
  return window.RATES.countryProxy[country.toLowerCase()] || null;
}

function getGuideRate(city, duration) {
  // duration: "half_day" | "full_day"
  const guides = window.RATES.pgRates.guides;
  const tryCity = (c) => {
    const entries = guides[c];
    if (!entries) return null;
    const match = entries.find(e => e.duration === duration) || entries[0];
    return match || null;
  };

  let result = tryCity(city);
  if (result) return { ...result, source: "exact", sourceCity: city };

  // Try proxy
  const country = cityToCountry(city);
  const proxyCity = country ? countryProxy(country) : null;
  if (proxyCity) {
    result = tryCity(proxyCity);
    if (result) return { ...result, source: "proxy", sourceCity: proxyCity };
  }
  return null;
}

function getCoachLDC(countries, offerCurrency) {
  const ldc = window.RATES.pgRates.coach_ldc;
  // Priority order from Brahms logic
  if (!countries || countries.length === 0) return ldc["Europe  excuding Switzerland"] || null;
  const c0 = countries[0].toLowerCase();
  if (c0 === "switzerland") return ldc["Switzerland"] || null;
  if (["england","uk","wales","northern ireland"].includes(c0)) return ldc["England"] || null;
  if (c0 === "scotland") return ldc["Scotland"] || null;
  // Multi-country — if any Switzerland, use Switzerland rate for Swiss days separately
  return ldc["Europe  excuding Switzerland"] || null;
}

function getCoachLocal(city, serviceType) {
  // serviceType: "transfer" | "half_day" | "full_day"
  const local = window.RATES.pgRates.coach_local;
  const country = cityToCountry(city);

  // Try city first (only London and Venice currently have local rates)
  const cityKey = Object.keys(local).find(k => k.toLowerCase() === city.toLowerCase());
  if (cityKey) {
    const match = local[cityKey].find(r => r.type === serviceType);
    if (match) return match;
  }
  // Try country-level fallback from motor CSV would need to be added — for now return null
  return null;
}

function getTourManagerRate(market, countries) {
  const tm = window.RATES.pgRates.tour_managers;
  const ukOnly = countries.every(c => ["uk","england","scotland","wales","northern ireland"].includes(c.toLowerCase()));

  if (market === "Indian") {
    if (ukOnly) {
      return {
        daily: tm["indian tour manager for uk"],
        flight: tm["indian tour manager for uk, flight expense"]
      };
    } else {
      return {
        daily: tm["indian tour manager for europe"],
        flight: tm["indian tour manager for europe, flight expense"]
      };
    }
  } else {
    if (ukOnly) {
      return {
        daily: tm["european tour manager for uk"],
        flight: null
      };
    } else {
      return {
        daily: tm["european tour manager for europe"],
        flight: tm["european tour manager for europe, flights"]
      };
    }
  }
}

// ── BRAHMS: per-group costs ───────────────────────────────────────────────

function runBrahms(lead) {
  const { countries, market, groupSize, totalDays, program, offerCurrency } = lead;
  const coachQty = groupSize ? Math.ceil(groupSize / 49) : 1;
  const results = [];
  const flags = [];

  const allSvc = program.flatMap(d => (d.services || []).map(s => ({ ...s, day: d.day })));
  const mtcSvc = allSvc.filter(s => s.type === "MTC");
  const guiSvc = allSvc.filter(s => s.type === "GUI");

  const hasDisposal = mtcSvc.some(s => /disposal|touring|ldc/i.test(s.name));
  const hasTransfers = mtcSvc.some(s => /transfer|airport|station/i.test(s.name));

  // ── Coach disposal ──────────────────────────────────────────────────────
  if (hasDisposal) {
    // Handle multi-country tours that include Switzerland (Swiss days get CHF rate)
    const hasSwiss = countries.some(c => c.toLowerCase() === "switzerland");
    const hasNonSwiss = countries.some(c => c.toLowerCase() !== "switzerland");

    if (hasSwiss && hasNonSwiss) {
      // Split: count Swiss overnight days vs non-Swiss
      const swissCities = Object.keys(window.RATES.cityCountry).filter(k => window.RATES.cityCountry[k] === "switzerland");
      let swissDays = 0, nonSwissDays = 0;
      for (const day of program) {
        if (!day.overnightCity) continue;
        if (swissCities.includes(day.overnightCity.toLowerCase())) swissDays++;
        else nonSwissDays++;
      }
      if (swissDays > 0) {
        const swissRate = window.RATES.pgRates.coach_ldc["Switzerland"];
        if (swissRate) {
          const conv = fx(swissRate.rate, swissRate.currency, offerCurrency);
          results.push({ category: "Transport", service: `Coach at disposal — Switzerland (${coachQty} coach × ${swissDays} days)`, rate: r2(conv), qty: swissDays * coachQty, total: r2(conv * swissDays * coachQty), currency: offerCurrency });
        }
      }
      if (nonSwissDays > 0) {
        const eurRate = window.RATES.pgRates.coach_ldc["Europe  excuding Switzerland"];
        if (eurRate) {
          const conv = fx(eurRate.rate, eurRate.currency, offerCurrency);
          results.push({ category: "Transport", service: `Coach at disposal — Europe (${coachQty} coach × ${nonSwissDays} days)`, rate: r2(conv), qty: nonSwissDays * coachQty, total: r2(conv * nonSwissDays * coachQty), currency: offerCurrency });
        }
      }
    } else {
      const ldcEntry = getCoachLDC(countries, offerCurrency);
      if (ldcEntry) {
        const conv = fx(ldcEntry.rate, ldcEntry.currency, offerCurrency);
        const note = hasTransfers ? " (incl. airport transfers)" : "";
        results.push({ category: "Transport", service: `Coach at disposal (${coachQty} coach × ${totalDays} days)${note}`, rate: r2(conv), qty: totalDays * coachQty, total: r2(conv * totalDays * coachQty), currency: offerCurrency });
      } else {
        flags.push("⚠ No LDC coach rate found — enter manually");
        results.push({ category: "Transport", service: "Coach at disposal", rate: null, qty: totalDays * coachQty, total: null, currency: offerCurrency, flag: true });
      }
    }
  }

  // ── Transfers only (no disposal) ────────────────────────────────────────
  if (!hasDisposal && hasTransfers) {
    const transferSvc = mtcSvc.filter(s => /transfer|airport|station/i.test(s.name));
    for (const svc of transferSvc) {
      const city = svc.destination || (countries[0] || "");
      const localRate = getCoachLocal(city, "transfer");
      if (localRate) {
        const conv = fx(localRate.rate, localRate.currency, offerCurrency);
        results.push({ category: "Transport", service: `${svc.name} — ${city} (${coachQty} coach)`, rate: r2(conv), qty: coachQty, total: r2(conv * coachQty), currency: offerCurrency });
      } else {
        flags.push(`⚠ No transfer rate for ${city} — enter manually`);
        results.push({ category: "Transport", service: svc.name, rate: null, qty: coachQty, total: null, currency: offerCurrency, flag: true });
      }
    }
  }

  // ── Tour Managers ────────────────────────────────────────────────────────
  const tmSvc = guiSvc.filter(s => /tour manager/i.test(s.name));
  if (tmSvc.length > 0) {
    const tmRates = getTourManagerRate(market, countries);
    if (tmRates.daily) {
      const conv = fx(tmRates.daily.rate, tmRates.daily.currency, offerCurrency);
      results.push({ category: "Tour Manager", service: `${tmRates.daily.name} × ${totalDays} days`, rate: r2(conv), qty: totalDays, total: r2(conv * totalDays), currency: offerCurrency });
    } else {
      flags.push("⚠ Tour Manager daily rate missing — enter manually");
      results.push({ category: "Tour Manager", service: "Tour Manager (daily)", rate: null, qty: totalDays, total: null, currency: offerCurrency, flag: true });
    }
    if (tmRates.flight) {
      const conv = fx(tmRates.flight.rate, tmRates.flight.currency, offerCurrency);
      results.push({ category: "Tour Manager", service: tmRates.flight.name, rate: r2(conv), qty: 1, total: r2(conv), currency: offerCurrency });
    }
  }

  // ── City Guides ──────────────────────────────────────────────────────────
  const citySvc = guiSvc.filter(s => !/tour manager/i.test(s.name));
  for (const svc of citySvc) {
    const city = svc.destination || "";
    const isFullDay = /full day|excursion|day trip|stonehenge|windsor|versailles|countryside|safari|winery/i.test(svc.name);
    const duration = isFullDay ? "full_day" : "half_day";
    const rateEntry = getGuideRate(city, duration);

    if (rateEntry) {
      const conv = fx(rateEntry.rate, rateEntry.currency, offerCurrency);
      const proxyNote = rateEntry.source === "proxy" ? ` (proxy: ${rateEntry.sourceCity})` : "";
      results.push({ category: "Guide", service: `${svc.name} — ${city}${proxyNote} (${coachQty} unit)`, rate: r2(conv), qty: coachQty, total: r2(conv * coachQty), currency: offerCurrency, proxy: rateEntry.source === "proxy" });
    } else {
      flags.push(`⚠ No guide rate for ${city} — estimated or enter manually`);
      results.push({ category: "Guide", service: `${svc.name} — ${city}`, rate: null, qty: coachQty, total: null, currency: offerCurrency, flag: true });
    }
  }

  const perGroupTotal = r2(results.filter(r => r.total).reduce((a, b) => a + b.total, 0));
  return { items: results, perGroupTotal, coachQty, flags };
}

// ── BEETHOVEN: per-person costs ───────────────────────────────────────────

function runBeethoven(lead) {
  const { program, offerCurrency, tourStartDate } = lead;
  const results = [];
  const flags = [];

  const allSvc = program.flatMap(d => (d.services || []).map(s => ({ ...s, day: d.day, date: d.date })));
  const ppSvc = allSvc.filter(s => ["ENT","RST","FRY"].includes(s.type));

  for (const svc of ppSvc) {
    const city = svc.destination || "";
    const rateEntry = findPPRate(city, svc.type, svc.name, offerCurrency);

    if (rateEntry) {
      // Museum closure check
      const closureNote = checkMuseumClosure(svc.name, city, svc.date);
      const conv = fx(rateEntry.rate, rateEntry.currency, offerCurrency);
      results.push({
        category: svc.type,
        service: svc.name,
        destination: city,
        rate: r2(conv),
        currency: offerCurrency,
        source: rateEntry.source,
        closureWarning: closureNote || null
      });
      if (closureNote) flags.push(`⚠ ${closureNote}`);
    } else {
      flags.push(`⚠ No rate for ${svc.name} (${city}) — enter manually`);
      results.push({ category: svc.type, service: svc.name, destination: city, rate: null, currency: offerCurrency, flag: true });
    }
  }

  const perPersonTotal = r2(results.filter(r => r.rate).reduce((a, b) => a + b.rate, 0));
  return { items: results, perPersonTotal, flags };
}

function findPPRate(city, svcType, svcName, offerCurrency) {
  const pp = window.RATES.ppRates;
  const nameLower = svcName.toLowerCase();

  // Direct city match
  const cityRates = pp[city] || pp[Object.keys(pp).find(k => k.toLowerCase() === city.toLowerCase())];
  if (cityRates) {
    const match = cityRates.find(r => r.service_type === svcType && nameLower.includes(r.service_name.toLowerCase().split(" ").slice(0,3).join(" ")));
    if (match) return { ...match, source: "exact" };
    // Fuzzy: any ENT in that city
    const fuzzy = cityRates.find(r => r.service_type === svcType);
    if (fuzzy) return { ...fuzzy, source: "fuzzy" };
  }

  // RST regional fallback
  if (svcType === "RST") {
    const isIndianMeal = /indian|curry|tandoor|bollywood/i.test(svcName);
    const isSwiss = ["Zurich","Geneva","Lucerne","Bern","Interlaken","Zermatt"].includes(city);
    const regionKey = isSwiss ? "Switzerland " : "Europe  excuding Switzerland";
    const mealKey = isIndianMeal ? "buffet" : "3 course";
    const regional = pp[regionKey]?.find(r => r.service_name.toLowerCase().includes(mealKey));
    if (regional) return { ...regional, source: "regional" };
    // UK meal fallback
    const ukMeal = pp["UK"]?.find(r => r.service_type === "RST");
    if (ukMeal) return { ...ukMeal, source: "regional" };
  }

  return null;
}

function checkMuseumClosure(name, city, date) {
  if (!date) return null;
  const closures = {
    "Paris": { "louvre": "Tuesday", "versailles": "Monday", "catacombs": "Monday" },
    "Rome": { "vatican": "Sunday" },
    "Munich": { "bmw": "Monday" },
    "Stuttgart": { "mercedes": "Monday" }
  };
  const rules = closures[city];
  if (!rules) return null;
  const nameLower = name.toLowerCase();
  for (const [museum, closedDay] of Object.entries(rules)) {
    if (nameLower.includes(museum)) {
      try {
        const d = new Date(date);
        const day = d.toLocaleDateString("en-GB", { weekday: "long" });
        if (day === closedDay) return `${name} is CLOSED on ${closedDay}s — check date or replace with alternative`;
      } catch {}
    }
  }
  return null;
}

// ── BACH: hotel costs ─────────────────────────────────────────────────────

function runBach(lead) {
  const { program, offerCurrency, market, tourStartDate } = lead;
  const results = [];
  const flags = [];

  // Count nights per city
  const cityNights = {};
  for (const day of program) {
    if (day.overnightCity && !["departure","at sea","n/a"].includes(day.overnightCity.toLowerCase())) {
      cityNights[day.overnightCity] = (cityNights[day.overnightCity] || 0) + 1;
    }
  }

  let twinTotal = 0;

  for (const [city, nights] of Object.entries(cityNights)) {
    const hotelEntry = findHotel(city, tourStartDate, 4);
    if (hotelEntry) {
      const conv = fx(hotelEntry.twin_rate, hotelEntry.currency, offerCurrency);
      const cityTotal = r2(conv * nights);
      twinTotal += cityTotal;
      results.push({
        city, nights,
        hotel: hotelEntry.hotel_name,
        ratePerNight: r2(conv),
        cityTotal,
        currency: offerCurrency,
        season: hotelEntry.season,
        source: "rate_sheet"
      });
    } else {
      flags.push(`⚠ No hotel rate for ${city} — using estimate`);
      const estimate = estimateHotelRate(city, offerCurrency, tourStartDate);
      const cityTotal = r2(estimate * nights);
      twinTotal += cityTotal;
      results.push({
        city, nights,
        hotel: `4* Hotel in ${city} or similar`,
        ratePerNight: estimate,
        cityTotal,
        currency: offerCurrency,
        season: "estimated",
        source: "estimate",
        flag: true
      });
    }
  }

  const singleTotal = r2(twinTotal * 1.9);
  return { items: results, twinTotal: r2(twinTotal), singleTotal, flags };
}

function findHotel(city, startDate, stars) {
  const hotels = window.RATES.hotelRates;
  const cityKey = Object.keys(hotels).find(k => k.toLowerCase() === city.toLowerCase());
  if (!cityKey) return null;

  const cityHotels = hotels[cityKey].filter(h => h.stars === stars);
  if (cityHotels.length === 0) return hotels[cityKey][0] || null;

  if (!startDate) return cityHotels[0];

  // Match by date range
  const d = new Date(startDate);
  for (const h of cityHotels) {
    try {
      const [df, dt] = [parseDate(h.date_from), parseDate(h.date_to)];
      if (d >= df && d <= dt) return h;
    } catch {}
  }
  return cityHotels[0];
}

function parseDate(str) {
  if (!str) return new Date();
  const parts = str.split("/");
  if (parts.length === 3) return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
  return new Date(str);
}

function estimateHotelRate(city, offerCurrency, startDate) {
  const country = cityToCountry(city) || "france";
  const BASE = {
    switzerland:90, uk:70, norway:85, sweden:75, denmark:75, finland:75, iceland:95,
    germany:65, austria:65, netherlands:70, belgium:65, luxembourg:70,
    france:65, spain:60, portugal:55, italy:60, ireland:65,
    poland:50, "czech republic":50, hungary:50, slovakia:48, romania:45, bulgaria:42,
    croatia:55, slovenia:55, greece:60, malta:65, cyprus:60
  };
  const base = BASE[country] || 60;
  let seasonal = 1.0;
  if (startDate) {
    const m = new Date(startDate).getMonth() + 1;
    if ([6,7,8].includes(m)) seasonal = 1.3;
    else if ([3,4,5,9,10,11].includes(m)) seasonal = 1.15;
  }
  const curr = country === "switzerland" ? "CHF" : (country === "uk" ? "GBP" : "EUR");
  return r2(fx(base * seasonal, curr, offerCurrency));
}

// ── CHOPIN: combine + margins + brackets ──────────────────────────────────

const BRACKETS = [
  { range: "15–19", div: 15 }, { range: "20–24", div: 20 },
  { range: "25–29", div: 25 }, { range: "30–34", div: 30 },
  { range: "35–39", div: 35 }, { range: "40–44", div: 40 },
  { range: "45–49", div: 45 }
];

function applyMargin(net, market) {
  if (market === "Indian") return r2(net + 50);
  return r2(net / 0.86);
}

function runChopin(lead, brahms, beethoven, bach) {
  const { market, groupSize, offerCurrency } = lead;
  const perGroup = brahms.perGroupTotal;
  const perPerson = beethoven.perPersonTotal;
  const twinHotel = bach.twinTotal;
  const singleHotel = bach.singleTotal;

  const marginDesc = market === "Indian" ? "+50 fixed" : "÷ 0.86 (14%)";

  if (groupSize && groupSize > 0) {
    // Large group custom
    const groupShare = r2(perGroup / groupSize);
    const twinNet = r2(groupShare + perPerson + twinHotel);
    const singleNet = r2(groupShare + perPerson + singleHotel);
    return {
      mode: "large_group",
      groupSize,
      market,
      offerCurrency,
      marginDesc,
      baseCosts: { perGroup, perPerson, twinHotel, singleHotel },
      twin: { groupShare, net: twinNet, final: applyMargin(twinNet, market) },
      single: { groupShare, net: singleNet, final: applyMargin(singleNet, market) }
    };
  } else {
    // Standard brackets
    const brackets = BRACKETS.map(b => {
      const gs = r2(perGroup / b.div);
      const twinNet = r2(gs + perPerson + twinHotel);
      const singleNet = r2(gs + perPerson + singleHotel);
      return {
        range: b.range, div: b.div,
        groupShare: gs,
        twinNet, twinFinal: applyMargin(twinNet, market),
        singleNet, singleFinal: applyMargin(singleNet, market)
      };
    });
    return {
      mode: "brackets",
      groupSize: null,
      market,
      offerCurrency,
      marginDesc,
      baseCosts: { perGroup, perPerson, twinHotel, singleHotel },
      brackets
    };
  }
}

// ── Discount scenarios (Mozart) ───────────────────────────────────────────

function discountScenarios(chopin) {
  const { market, mode, brackets, twin, offerCurrency } = chopin;
  const refNet = mode === "large_group" ? twin.net : brackets.find(b => b.range === "30–34")?.twinNet || 0;

  if (market === "Indian") {
    return [10, 20, 30, 40].map(d => ({
      label: `-${d} ${offerCurrency}`,
      price: r2(refNet + (50 - d)),
      margin: 50 - d,
      marginPct: r2(((50 - d) / refNet) * 100)
    }));
  } else {
    return [2, 4, 6, 8].map(d => {
      const newMargin = 14 - d;
      const price = r2(refNet / ((100 - newMargin) / 100));
      return {
        label: `-${d}%`,
        price,
        margin: r2(price - refNet),
        marginPct: newMargin
      };
    });
  }
}

// ── Master runner ─────────────────────────────────────────────────────────

function runFullPipeline(lead) {
  const brahms = runBrahms(lead);
  const beethoven = runBeethoven(lead);
  const bach = runBach(lead);
  const chopin = runChopin(lead, brahms, beethoven, bach);
  const discounts = discountScenarios(chopin);
  const allFlags = [...brahms.flags, ...beethoven.flags, ...bach.flags];
  return { lead, brahms, beethoven, bach, chopin, discounts, flags: allFlags };
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENTS.JS  — Wagner (client quote) + Mozart (internal sheet)
// Both generate self-contained HTML strings, downloadable as files
// ─────────────────────────────────────────────────────────────────────────────

function formatCurrency(amount, currency) {
  if (amount === null || amount === undefined) return "—";
  const sym = { EUR:"€", GBP:"£", CHF:"CHF " };
  return (sym[currency]||currency+" ") + Number(amount).toLocaleString("en-GB",{minimumFractionDigits:2,maximumFractionDigits:2});
}

function formatDateNice(dateStr) {
  if (!dateStr) return "TBD";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"});
}

function todayOrdinal() {
  const d = new Date();
  const day = d.getDate();
  const s = day%10===1&&day!==11?"st":day%10===2&&day!==12?"nd":day%10===3&&day!==13?"rd":"th";
  return `${d.toLocaleDateString("en-GB",{weekday:"short"})}, ${day}${s} ${d.toLocaleDateString("en-GB",{month:"short",year:"numeric"})}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// WAGNER — Client-facing quote
// ─────────────────────────────────────────────────────────────────────────────
function generateClientQuote(result) {
  const { lead, chopin, brahms, beethoven, bach } = result;
  const curr = lead.offerCurrency;
  const nights = lead.nights || 1;
  const days   = lead.days   || nights + 1;

  // Build inclusions list
  const inclusions = [];
  if (bach.results.some(r=>!r.flag)) inclusions.push(`${nights} night${nights!==1?"s":""} accommodation in 4-star hotels`);
  if (brahms.results.some(r=>r.category==="Transport"&&!r.flag)) inclusions.push("Coach transportation throughout");
  if (brahms.results.some(r=>r.category==="Guide"&&!r.flag)) inclusions.push("Professional local guides");
  if (brahms.results.some(r=>r.category==="Tour Manager"&&!r.flag)) inclusions.push("Tour manager accompaniment");
  beethoven.results.filter(r=>r.category==="Meal"&&!r.flag).forEach(r=>inclusions.push(r.service));
  beethoven.results.filter(r=>r.category==="Entrance"&&!r.flag).forEach(r=>inclusions.push(r.service));
  inclusions.push("Breakfast daily");

  // Build itinerary HTML
  const itineraryRows = (lead.program||[]).map(day => {
    const svcs = (day.services||[]).filter(s=>!["MTC"].includes(s.type)||/disposal/i.test(s.name));
    const desc = svcs.length
      ? svcs.map(s=>s.name).join(", ")
      : day.overnight ? `Arrive ${day.city}, check in` : `Depart ${day.city}`;
    return `
      <div class="day-block">
        <div class="day-header">Day ${day.day}${day.date?" — "+formatDateNice(day.date):""}${day.city?" | "+day.city:""}</div>
        <div class="day-desc">${desc}${day.overnight?`<span class="overnight"> 🏨 ${day.overnight}</span>`:""}</div>
      </div>`;
  }).join("");

  // Pricing table
  let pricingTable = "";
  if (chopin.pricing.mode === "large_group") {
    const { groupSize, twin, single } = chopin.pricing;
    pricingTable = `
      <table class="price-table">
        <thead><tr><th>Group Size</th><th>Room Type</th><th>Price Per Person</th></tr></thead>
        <tbody>
          <tr><td rowspan="2">${groupSize} persons</td><td>Twin Sharing</td><td><strong>${formatCurrency(twin.final, curr)}</strong></td></tr>
          <tr><td>Single Supplement</td><td><strong>${formatCurrency(single.final, curr)}</strong></td></tr>
        </tbody>
      </table>`;
  } else {
    const rows = chopin.pricing.brackets.map(b =>
      `<tr${b.range==="30-34"?' class="highlight"':""}>
        <td>${b.range} persons</td>
        <td><strong>${formatCurrency(b.twin.final, curr)}</strong></td>
        <td><strong>${formatCurrency(b.single.final, curr)}</strong></td>
      </tr>`
    ).join("");
    pricingTable = `
      <table class="price-table">
        <thead><tr><th>Group Size</th><th>Twin Sharing (pp)</th><th>Single Supplement (pp)</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  const tourName = lead.cities.length
    ? lead.cities.join(" – ") + " Tour"
    : "European Tour";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${tourName} — Quote</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:Arial,sans-serif; font-size:11pt; color:#222; background:#fff; padding:30px; max-width:900px; margin:0 auto; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #333; padding-bottom:15px; margin-bottom:20px; }
  .logo img { max-height:60px; }
  .logo-text { font-size:20px; font-weight:bold; color:#1a3a5c; }
  .logo-sub  { font-size:11px; color:#666; }
  .ref-block { text-align:right; font-size:10pt; color:#555; }
  .ref-block p { margin:2px 0; }
  h1 { font-size:16pt; text-align:center; text-transform:uppercase; margin:15px 0 5px; letter-spacing:1px; }
  h2 { font-size:12pt; color:#1a3a5c; border-bottom:1px solid #ccc; padding-bottom:4px; margin:20px 0 10px; text-transform:uppercase; }
  .tour-meta { text-align:center; color:#555; font-size:10pt; margin-bottom:20px; }
  .day-block { margin-bottom:10px; }
  .day-header { font-weight:bold; font-size:10.5pt; background:#f5f5f5; padding:5px 8px; border-left:3px solid #1a3a5c; }
  .day-desc { padding:5px 8px 5px 12px; font-size:10pt; color:#333; }
  .overnight { color:#888; font-size:9pt; margin-left:8px; }
  .price-table { width:100%; border-collapse:collapse; margin:10px 0; font-size:10pt; }
  .price-table th { background:#1a3a5c; color:#fff; padding:8px; text-align:center; }
  .price-table td { border:1px solid #ddd; padding:7px 10px; text-align:center; }
  .price-table tr.highlight { background:#f0f7ff; }
  .inc-grid { display:grid; grid-template-columns:1fr 1fr; gap:4px 20px; }
  .inc-item::before { content:"✓ "; color:#1a3a5c; font-weight:bold; }
  .exc-item::before { content:"✗ "; color:#c00; }
  .inc-item, .exc-item { font-size:10pt; padding:2px 0; }
  .terms { font-size:9pt; color:#555; }
  .terms h4 { color:#333; margin:10px 0 4px; }
  .terms ul { padding-left:16px; }
  .terms li { margin:2px 0; }
  .validity { background:#fffbe6; border:1px solid #f0c040; padding:8px 12px; font-size:10pt; margin:15px 0; border-radius:3px; }
  .footer { margin-top:30px; border-top:1px solid #ccc; padding-top:10px; font-size:9pt; color:#888; text-align:center; }
  @media print { body { padding:10px; } }
</style>
</head>
<body>

<div class="header">
  <div class="logo">
    <img src="../assets/logo.png" alt="Europe Incoming" onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
    <div style="display:none"><div class="logo-text">Europe Incoming</div><div class="logo-sub">FIT Packages</div></div>
  </div>
  <div class="ref-block">
    <p><strong>Date:</strong> ${todayOrdinal()}</p>
    <p><strong>Valid for:</strong> 14 days from quote date</p>
    <p><strong>Market:</strong> ${lead.market}</p>
    <p><strong>Currency:</strong> ${curr}</p>
  </div>
</div>

<h1>${tourName}</h1>
<div class="tour-meta">
  ${nights} Nights / ${days} Days
  ${lead.startDate ? " | " + formatDateNice(lead.startDate) + " – " + formatDateNice(lead.endDate) : ""}
  ${lead.groupSize ? " | Group of " + lead.groupSize + " persons" : ""}
</div>

<h2>Day by Day Programme</h2>
${itineraryRows}

<h2>Package Pricing</h2>
<p style="font-size:9pt;color:#888;margin-bottom:8px;">All rates are per person. ${chopin.pricing.mode==="brackets"?"Highlighted row (30-34) is standard reference bracket.":""}</p>
${pricingTable}

<h2>What's Included</h2>
<div class="inc-grid">
${inclusions.map(i=>`<div class="inc-item">${i}</div>`).join("")}
</div>

<h2>Not Included</h2>
<div class="inc-grid">
  ${["International flights","Visa fees","Travel insurance","Luggage porterage",
     "Personal expenses & gratuities","Any meals not listed above",
     "Optional activities","Items of a personal nature"]
    .map(i=>`<div class="exc-item">${i}</div>`).join("")}
</div>

<div class="validity">
  ⏱ <strong>Quote validity:</strong> Prices are valid for 14 days from the date of this quotation and subject to availability at time of booking.
</div>

<div class="terms">
  <h2>Terms & Conditions</h2>
  <h4>Booking Conditions</h4>
  <ul>
    <li>A deposit of 25% of the total cost is required to confirm the booking</li>
    <li>Full payment is due 45 days before departure</li>
    <li>Prices are net and non-commissionable</li>
    <li>Accommodation is based on twin/double occupancy</li>
  </ul>
  <h4>Cancellation Policy</h4>
  <ul>
    <li>More than 45 days before departure: 25% of total cost</li>
    <li>31–45 days: 50% of total cost</li>
    <li>15–30 days: 75% of total cost</li>
    <li>Less than 15 days: 100% of total cost</li>
  </ul>
  <h4>General</h4>
  <ul>
    <li>Itinerary is subject to change due to operational requirements</li>
    <li>Europe Incoming acts as agent only</li>
    <li>All disputes subject to local jurisdiction</li>
  </ul>
</div>

<div class="footer">
  <strong>Europe Incoming Limited</strong> | Sales: fitsales@europeincoming.com<br>
  © ${new Date().getFullYear()} Europe Incoming Limited. All rights reserved.
</div>

</body></html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// MOZART — Internal cost breakdown sheet
// ─────────────────────────────────────────────────────────────────────────────
function generateInternalSheet(result) {
  const { lead, chopin, brahms, beethoven, bach, flags } = result;
  const curr = lead.offerCurrency;

  // Transport + Guide rows
  const pgRows = brahms.results.map(r => `
    <tr class="${r.flag?"flagged":""}">
      <td>${r.category}</td>
      <td>${r.service}</td>
      <td>${r.detail||""}</td>
      <td class="num">${r.flag?"⚠ Manual":formatCurrency(r.rate,curr)}</td>
      <td class="num">${r.qty||""}</td>
      <td class="num bold">${r.flag?"⚠ Manual":formatCurrency(r.total,curr)}</td>
      <td class="src">${r.source||""}</td>
    </tr>`).join("");

  // PP rows
  const ppRows = beethoven.results.map(r => `
    <tr class="${r.flag?"flagged":""}">
      <td>${r.category}</td>
      <td>${r.service}</td>
      <td>${r.destination||""}</td>
      <td class="num">${r.flag?"⚠ Manual":formatCurrency(r.rate,curr)}</td>
      <td class="num">× pax</td>
      <td class="num bold">${r.flag?"⚠ Manual":"PP: "+formatCurrency(r.rate,curr)}</td>
      <td class="src">${r.source||""}</td>
    </tr>`).join("");

  // Hotel rows
  const hotelRows = bach.results.map(r => `
    <tr class="${r.flag?"flagged":""}">
      <td>Hotel</td>
      <td>${r.hotel_name}</td>
      <td>${r.city} — ${r.nights} night${r.nights!==1?"s":""} (${r.season||""})</td>
      <td class="num">${r.flag?"⚠ Manual":formatCurrency(r.twin_rate,curr)+"/night"}</td>
      <td class="num">${r.nights}</td>
      <td class="num bold">${r.flag?"⚠ Manual":formatCurrency(r.twin_total,curr)}</td>
      <td class="src">${r.source||""}</td>
    </tr>`).join("");

  // Cost summary
  const { perGroupTotal, perPersonTotal, hotelTwin, hotelSingle } = chopin.baseCosts;

  // Pricing table
  let pricingHTML = "";
  if (chopin.pricing.mode === "large_group") {
    const { groupSize, twin, single } = chopin.pricing;
    pricingHTML = `
    <table class="data-table">
      <thead><tr><th>Room Type</th><th>Group Share</th><th>PP Services</th><th>Hotel (Twin)</th><th>Net Cost</th><th>Final Price</th></tr></thead>
      <tbody>
        <tr>
          <td>Twin Sharing</td>
          <td>${formatCurrency(r2(perGroupTotal/groupSize),curr)}</td>
          <td>${formatCurrency(perPersonTotal,curr)}</td>
          <td>${formatCurrency(hotelTwin,curr)}</td>
          <td class="bold">${formatCurrency(twin.net,curr)}</td>
          <td class="bold green">${formatCurrency(twin.final,curr)}</td>
        </tr>
        <tr>
          <td>Single Supplement</td>
          <td>${formatCurrency(r2(perGroupTotal/groupSize),curr)}</td>
          <td>${formatCurrency(perPersonTotal,curr)}</td>
          <td>${formatCurrency(hotelSingle,curr)}</td>
          <td class="bold">${formatCurrency(single.net,curr)}</td>
          <td class="bold green">${formatCurrency(single.final,curr)}</td>
        </tr>
      </tbody>
    </table>`;
  } else {
    const rows = chopin.pricing.brackets.map(b => `
      <tr${b.range==="30-34"?' class="ref-row"':""}>
        <td>${b.range}</td>
        <td>${formatCurrency(b.groupShare,curr)}</td>
        <td>${formatCurrency(perPersonTotal,curr)}</td>
        <td>${formatCurrency(hotelTwin,curr)}</td>
        <td class="bold">${formatCurrency(b.twin.net,curr)}</td>
        <td class="bold green">${formatCurrency(b.twin.final,curr)}</td>
        <td class="bold">${formatCurrency(b.single.net,curr)}</td>
        <td class="bold green">${formatCurrency(b.single.final,curr)}</td>
      </tr>`).join("");
    pricingHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th rowspan="2">Pax</th><th rowspan="2">Group Share</th>
          <th rowspan="2">PP Services</th><th rowspan="2">Hotel/pp</th>
          <th colspan="2">Twin Sharing</th><th colspan="2">Single</th>
        </tr>
        <tr><th>Net</th><th>Final</th><th>Net</th><th>Final</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  // Discount scenarios (Mozart logic)
  const refNet = chopin.pricing.mode==="large_group"
    ? chopin.pricing.twin.net
    : (chopin.pricing.brackets.find(b=>b.range==="30-34")||chopin.pricing.brackets[3]).twin.net;

  const discountRows = (lead.market==="Indian"
    ? [10,20,30,40].map(d => {
        const margin = 50-d;
        const final  = r2(refNet + margin);
        return `<tr><td>-${curr} ${d}</td><td>${formatCurrency(final,curr)}</td><td>${formatCurrency(margin,curr)}</td><td>${r2(margin/refNet*100)}%</td></tr>`;
      })
    : [2,4,6,8].map(d => {
        const newPct  = 14-d;
        const divisor = (100-newPct)/100;
        const final   = r2(refNet/divisor);
        const margin  = r2(final-refNet);
        return `<tr><td>-${d}%</td><td>${formatCurrency(final,curr)}</td><td>${formatCurrency(margin,curr)}</td><td>${newPct}%</td></tr>`;
      })
  ).join("");

  // Flags section
  const flagsHTML = flags.length ? `
    <h2>⚠ Items Requiring Manual Pricing</h2>
    <div class="flags">
      ${flags.map(f=>`<div class="flag-item">⚠ <strong>${f.source}:</strong> ${f.msg}</div>`).join("")}
    </div>` : `<div class="all-good">✅ All items priced from rate sheets</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Internal Cost Breakdown</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:system-ui,Arial,sans-serif; font-size:12px; color:#333; background:#f4f4f4; padding:20px; }
  .wrap { max-width:1000px; margin:0 auto; }
  .header { background:#1a3a5c; color:#fff; padding:15px 20px; border-radius:4px 4px 0 0; display:flex; justify-content:space-between; align-items:center; }
  .header h1 { font-size:16px; }
  .header-meta { font-size:11px; opacity:0.8; text-align:right; }
  .section { background:#fff; border:1px solid #ddd; margin:10px 0; padding:15px; border-radius:0 0 4px 4px; }
  h2 { font-size:13px; color:#1a3a5c; border-bottom:2px solid #1a3a5c; padding-bottom:4px; margin-bottom:10px; text-transform:uppercase; }
  .data-table { width:100%; border-collapse:collapse; font-size:11px; }
  .data-table th { background:#f0f0f0; padding:6px 8px; text-align:left; border:1px solid #ccc; font-size:10px; }
  .data-table td { padding:5px 8px; border:1px solid #e0e0e0; vertical-align:top; }
  .data-table tr:hover { background:#fafafa; }
  .data-table tr.ref-row { background:#fff8e1; }
  .num { text-align:right; font-variant-numeric:tabular-nums; }
  .bold { font-weight:600; }
  .green { color:#1a6e2e; }
  .flagged { background:#fff3f3; }
  .src { font-size:10px; color:#999; font-style:italic; }
  .summary-grid { display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:10px; margin:10px 0; }
  .summary-box { background:#f8f8f8; border:1px solid #ddd; padding:10px; border-radius:3px; text-align:center; }
  .summary-box .val { font-size:16px; font-weight:700; color:#1a3a5c; }
  .summary-box .lbl { font-size:10px; color:#888; margin-top:3px; }
  .flags { background:#fff8e6; border:1px solid #f0c040; padding:10px; border-radius:3px; }
  .flag-item { padding:3px 0; font-size:11px; }
  .all-good { background:#e8f5e9; border:1px solid #a5d6a7; padding:10px; border-radius:3px; color:#2e7d32; font-weight:600; }
  .margin-note { background:#e3f2fd; border-left:3px solid #1a3a5c; padding:8px 12px; font-size:11px; margin:10px 0; }
  @media print { body { background:#fff; padding:5px; } .section { border:none; } }
</style>
</head>
<body>
<div class="wrap">

<div class="header">
  <div>
    <h1>Internal Cost Breakdown</h1>
    <div style="font-size:11px;opacity:0.8;margin-top:3px;">
      ${lead.cities.join(" – ")} | ${lead.nights||"?"} nights | ${lead.market} market | ${curr}
    </div>
  </div>
  <div class="header-meta">
    Generated: ${todayOrdinal()}<br>
    ${lead.startDate ? formatDateNice(lead.startDate)+" – "+formatDateNice(lead.endDate) : "Dates TBD"}<br>
    Group: ${lead.groupSize ? lead.groupSize+" pax" : "TBD"}
  </div>
</div>

<div class="section">
  <h2>Cost Summary</h2>
  <div class="summary-grid">
    <div class="summary-box"><div class="val">${formatCurrency(perGroupTotal,curr)}</div><div class="lbl">Per Group Total (Transport + Guides)</div></div>
    <div class="summary-box"><div class="val">${formatCurrency(perPersonTotal,curr)}</div><div class="lbl">Per Person (Entrances + Meals)</div></div>
    <div class="summary-box"><div class="val">${formatCurrency(hotelTwin,curr)}</div><div class="lbl">Hotel Twin/pp</div></div>
    <div class="summary-box"><div class="val">${formatCurrency(hotelSingle,curr)}</div><div class="lbl">Hotel Single/pp</div></div>
  </div>
  <div class="margin-note">
    <strong>Margin:</strong> ${chopin.marginDesc} | <strong>Market:</strong> ${lead.market}
  </div>
</div>

<div class="section">
  <h2>Transport, Guides & Tour Manager (per group)</h2>
  <table class="data-table">
    <thead><tr><th>Category</th><th>Service</th><th>Detail</th><th>Rate</th><th>Qty</th><th>Total</th><th>Source</th></tr></thead>
    <tbody>${pgRows}</tbody>
    <tfoot><tr><td colspan="5" style="text-align:right;font-weight:700;padding:6px 8px;">Sub-total</td>
      <td class="num bold" style="border:1px solid #ddd;padding:5px 8px;">${formatCurrency(brahms.total,curr)}</td><td></td></tr></tfoot>
  </table>
</div>

<div class="section">
  <h2>Entrances, Meals & Ferries (per person)</h2>
  <table class="data-table">
    <thead><tr><th>Category</th><th>Service</th><th>Destination</th><th>Rate/pp</th><th>Basis</th><th>Sub-total</th><th>Source</th></tr></thead>
    <tbody>${ppRows}</tbody>
    <tfoot><tr><td colspan="5" style="text-align:right;font-weight:700;padding:6px 8px;">Total per person</td>
      <td class="num bold" style="border:1px solid #ddd;padding:5px 8px;">${formatCurrency(beethoven.totalPerPerson,curr)}</td><td></td></tr></tfoot>
  </table>
</div>

<div class="section">
  <h2>Hotel Accommodation (per person per night)</h2>
  <table class="data-table">
    <thead><tr><th>Category</th><th>Hotel</th><th>City / Nights</th><th>Rate/night</th><th>Nights</th><th>Total (Twin)</th><th>Source</th></tr></thead>
    <tbody>${hotelRows}</tbody>
    <tfoot><tr><td colspan="5" style="text-align:right;font-weight:700;padding:6px 8px;">Total hotel (Twin pp)</td>
      <td class="num bold" style="border:1px solid #ddd;padding:5px 8px;">${formatCurrency(bach.totalTwin,curr)}</td><td></td></tr></tfoot>
  </table>
</div>

<div class="section">
  <h2>Final Pricing</h2>
  ${pricingHTML}
</div>

<div class="section">
  <h2>Discount Scenarios${chopin.pricing.mode==="large_group"?" ("+chopin.pricing.groupSize+" pax)":' (Reference: 30-34 bracket)'}</h2>
  <table class="data-table" style="max-width:400px">
    <thead><tr><th>Discount</th><th>Twin Price/pp</th><th>Margin Amount</th><th>Margin %</th></tr></thead>
    <tbody>${discountRows}</tbody>
  </table>
  <p style="font-size:10px;color:#999;margin-top:6px;">For minor amendments, adjust group share manually: new group share = total group cost ÷ new pax count, then recalculate net.</p>
</div>

<div class="section">
  ${flagsHTML}
</div>

</div>
</body></html>`;
}

function r2(n) { return Math.round((n||0)*100)/100; }

function downloadHTML(html, filename) {
  const blob = new Blob([html], { type:"text/html;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

window.Documents = { generateClientQuote, generateInternalSheet, downloadHTML };

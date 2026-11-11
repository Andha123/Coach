/* Ernæringsmotor — ren, deterministisk og testbar. Ingen DOM, ingen nettverk.
 * All næringsberegning i appen går gjennom denne modulen; AI-modellen regner aldri selv. */
(function (root) {
  'use strict';

  var NUTRIENTS = ['kcal', 'protein', 'carbs', 'sugars', 'fat', 'satFat', 'fiber', 'salt'];
  var CORE = ['kcal', 'protein', 'carbs', 'fat', 'fiber'];
  var LABELS = { kcal: 'Energi', protein: 'Protein', carbs: 'Karbohydrater', sugars: 'Sukkerarter', fat: 'Fett', satFat: 'Mettet fett', fiber: 'Fiber', salt: 'Salt' };

  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function num(v) {
    if (isNum(v)) return v;
    if (typeof v === 'string' && v.trim() !== '') {
      var n = Number(v.replace(',', '.').trim());
      return isFinite(n) ? n : null;
    }
    return null;
  }

  /* ---------- Enheter ---------- */
  var UNIT_ALIASES = {
    g: 'g', gram: 'g', gr: 'g', grams: 'g',
    kg: 'kg', ml: 'ml', dl: 'dl', l: 'l', liter: 'l',
    stk: 'stk', stykk: 'stk', pcs: 'stk', 'st': 'stk',
    porsjon: 'porsjon', porsjoner: 'porsjon', serving: 'porsjon', pakke: 'pakke', pakker: 'pakke', pk: 'pakke',
    g_med_skall: 'g_med_skall', 'g med skall': 'g_med_skall'
  };
  function normUnit(u) {
    if (!u) return 'g';
    var k = String(u).toLowerCase().trim();
    return UNIT_ALIASES[k] || null;
  }

  /* Vekt per stykk når produktet ikke har lagret sin egen: vanlige frukter/grønnsaker (spiselig del, typisk størrelse),
   * ellers én pakning (f.eks. én iskaffe eller én proteinbar). Brukeren kan alltid overstyre med egen vekt per stk. */
  var STK_DEFAULTS = {
    banan: 120, bananer: 120, eple: 150, epler: 150, pære: 170, pærer: 170, appelsin: 140, appelsiner: 140,
    klementin: 55, klementiner: 55, mandarin: 60, mandariner: 60, kiwi: 70, paprika: 150, tomat: 100, tomater: 100,
    cherrytomat: 15, cherrytomater: 15, agurk: 350, gulrot: 70, gulrøtter: 70, avokado: 140, egg: 55, løk: 100,
    rødløk: 100, vårløk: 15, potet: 100, poteter: 100, søtpotet: 250, nektarin: 130, fersken: 130, plomme: 55, plommer: 55,
    sitron: 90, lime: 60, mango: 250, granateple: 200, grapefrukt: 250, squash: 300, aubergine: 300, hvitløk: 5,
    brokkoli: 350, blomkål: 600, sjampinjong: 20, dadler: 8, daddel: 8, riskake: 8, riskaker: 8, knekkebrød: 13,
    brødskive: 40, skive: 40, tortilla: 60, wrap: 60, pølse: 70, pølser: 70, kyllingfilet: 150
  };
  function stkWeight(product) {
    if (!product) return null;
    if (product.unitWeights && isNum(product.unitWeights.stk)) return { g: product.unitWeights.stk, src: 'lagret' };
    /* Typisk vekt (banan, paprika …) gjelder hele råvarer. Ferdigvarer med merke/strekkode bruker pakningen først,
     * og bearbeidet mat («bananchips», «smoothie», «kake») får ingen typisk stk-vekt. */
    var name = String(product.name || '').toLowerCase();
    var first = name.replace(/[^a-zæøå ]+/g, ' ').trim().split(/\s+/)[0];
    var typical = first && STK_DEFAULTS[first] && !/tørket|chips|kake|smoothie|juice|saft|syltet|hermetisk|pulver|mos\b|puré|is\b|yoghurt|skyr|muffins|brød/.test(name) ? { g: STK_DEFAULTS[first], src: 'typisk' } : null;
    var pack = isNum(product.packageSize) && product.packageSize > 0 && product.packageSize <= 1000 ? { g: product.packageSize, src: 'pakning' } : null;
    if (product.barcode || product.brand) return pack || typical;
    return typical || pack;
  }

  /* Gjør om en mengde til produktets basisenhet (g eller ml), med spiselig del.
   * Returnerer { qty, basis, notes[] } eller kaster Error med norsk melding. */
  function toBasis(product, amount, unit) {
    var a = num(amount);
    if (a === null || a < 0) throw new Error('Ugyldig mengde: ' + amount);
    var u = normUnit(unit);
    if (!u) throw new Error('Ukjent enhet: ' + unit);
    var basis = product.basis === 'ml' ? 'ml' : 'g';
    var notes = [];
    var grams = null, ml = null;
    switch (u) {
      case 'g': grams = a; break;
      case 'kg': grams = a * 1000; break;
      case 'ml': ml = a; break;
      case 'dl': ml = a * 100; break;
      case 'l': ml = a * 1000; break;
      case 'stk':
        var sw = stkWeight(product);
        if (!sw) throw new Error('Mangler vekt per stk for ' + product.name + '. Oppgi mengden i gram, eller hvor mye én stk veier.');
        grams = a * sw.g;
        notes.push(a + ' stk × ' + sw.g + ' ' + (sw.src === 'pakning' && basis === 'ml' ? 'ml' : 'g') + (sw.src === 'typisk' ? ' (typisk vekt)' : sw.src === 'pakning' ? ' (én pakning)' : ''));
        if (sw.src === 'pakning' && basis === 'ml') { ml = grams; grams = null; }
        break;
      case 'porsjon':
        if (!isNum(product.servingSize)) throw new Error('Mangler porsjonsstørrelse for ' + product.name + '. Oppgi mengden i gram.');
        grams = a * product.servingSize;
        notes.push(a + ' porsjon × ' + product.servingSize + ' g');
        break;
      case 'pakke':
        if (!isNum(product.packageSize)) throw new Error('Mangler pakningsstørrelse for ' + product.name + '. Oppgi mengden i gram, eller lagre hvor mye pakken inneholder.');
        grams = a * product.packageSize;
        notes.push(a + ' pakke × ' + product.packageSize + ' ' + (product.basis === 'ml' ? 'ml' : 'g'));
        if (product.basis === 'ml') { ml = grams; grams = null; }
        break;
      case 'g_med_skall':
        if (!isNum(product.edibleFactor)) throw new Error('Mangler andel spiselig del for ' + product.name + '.');
        grams = a * product.edibleFactor;
        notes.push(a + ' g med skall × ' + Math.round(product.edibleFactor * 100) + ' % spiselig = ' + round(grams, 1) + ' g');
        break;
    }
    if (basis === 'g') {
      if (grams === null) {
        if (!isNum(product.density)) throw new Error(product.name + ' har næringsverdier per 100 g. Oppgi mengden i gram (tetthet er ukjent).');
        grams = ml * product.density;
        notes.push(ml + ' ml × ' + product.density + ' g/ml');
      }
      return { qty: grams, basis: 'g', notes: notes };
    }
    if (ml === null) {
      if (!isNum(product.density)) throw new Error(product.name + ' har næringsverdier per 100 ml. Oppgi mengden i ml (tetthet er ukjent).');
      ml = grams / product.density;
      notes.push(round(grams, 1) + ' g ÷ ' + product.density + ' g/ml');
    }
    return { qty: ml, basis: 'ml', notes: notes };
  }

  /* ---------- Beregning ---------- */
  /* per100: { kcal, protein, ... } der manglende verdi er null/undefined (ikke 0). */
  function scale(per100, qty) {
    var out = {};
    NUTRIENTS.forEach(function (k) {
      var v = per100 ? per100[k] : null;
      out[k] = isNum(v) ? v * qty / 100 : null;
    });
    return out;
  }

  /* Beregn én ingrediens. Returnerer { qty, basis, values, notes }. */
  function calcItem(product, amount, unit) {
    if (!product || !product.per100) throw new Error('Produktet mangler næringsdata.');
    var b = toBasis(product, amount, unit);
    return { qty: b.qty, basis: b.basis, values: scale(product.per100, b.qty), notes: b.notes };
  }

  /* Summer verdier. Manglende verdier telles ikke som 0: missing[k] = antall varer uten data. */
  function sum(list) {
    var total = {}, missing = {};
    NUTRIENTS.forEach(function (k) { total[k] = 0; missing[k] = 0; });
    (list || []).forEach(function (v) {
      NUTRIENTS.forEach(function (k) {
        if (v && isNum(v[k])) total[k] += v[k]; else missing[k] += 1;
      });
    });
    return { values: total, missing: missing, count: (list || []).length };
  }

  function divide(values, n) {
    var out = {};
    NUTRIENTS.forEach(function (k) { out[k] = isNum(values[k]) ? values[k] / n : null; });
    return out;
  }

  function round(v, d) {
    if (!isNum(v)) return null;
    var f = Math.pow(10, d || 0);
    return Math.round(v * f) / f;
  }
  /* Visningsavrunding: kcal hele tall, gram med én desimal (salt to). Summer regnes alltid fra uavrundede tall. */
  function display(values) {
    var out = {};
    NUTRIENTS.forEach(function (k) { out[k] = round(values[k], k === 'kcal' ? 0 : (k === 'salt' ? 2 : 1)); });
    return out;
  }

  /* ---------- Oppskrifter ---------- */
  /* items: [{ key, productId, amount, unit }]. mods: { set: {key|productId: amount}, remove: [key|productId], add: [item] } */
  function applyMods(items, mods) {
    mods = mods || {};
    var set = mods.set || {}, remove = mods.remove || [], add = mods.add || [];
    var used = {};
    var out = [];
    items.forEach(function (it) {
      var ids = [it.key, it.productId].filter(Boolean);
      if (ids.some(function (id) { return remove.indexOf(id) >= 0; })) { ids.forEach(function (id) { used[id] = 1; }); return; }
      var copy = Object.assign({}, it);
      ids.forEach(function (id) {
        if (Object.prototype.hasOwnProperty.call(set, id)) {
          var n = num(set[id]);
          if (n === null || n < 0) throw new Error('Ugyldig mengde for ' + id);
          copy.amount = n; copy.modified = true; used[id] = 1;
        }
      });
      if (copy.amount === 0) return;
      out.push(copy);
    });
    var unknown = Object.keys(set).concat(remove).filter(function (id) { return !used[id]; });
    if (unknown.length) throw new Error('Fant ikke ingrediens i oppskriften: ' + unknown.join(', '));
    add.forEach(function (it) { out.push(Object.assign({ added: true }, it)); });
    return out;
  }

  /* Beregn hel oppskrift. getProduct(id) -> produkt. Returnerer total og per porsjon. */
  function calcRecipe(version, getProduct, mods) {
    var items = applyMods(version.items || [], mods);
    var rows = items.map(function (it) {
      var p = getProduct(it.productId);
      if (!p) throw new Error('Mangler produkt ' + it.productId + ' i matdatabasen.');
      var c = calcItem(p, it.amount, it.unit || 'g');
      return { item: it, product: p, qty: c.qty, basis: c.basis, values: c.values, notes: c.notes };
    });
    var t = sum(rows.map(function (r) { return r.values; }));
    var portions = num(version.portions) || 1;
    return { rows: rows, total: t.values, missing: t.missing, portions: portions, perPortion: divide(t.values, portions) };
  }

  /* Andel av en oppskrift: porsjoner, eller gram av ferdig rett når ferdigvekt er kjent. */
  function recipeFraction(version, opts) {
    opts = opts || {};
    if (isNum(num(opts.portionGrams)) && opts.portionGrams !== null && opts.portionGrams !== undefined) {
      var cw = num(version.cookedWeightG);
      if (!cw) throw new Error('Ferdigvekt for oppskriften er ukjent, så jeg kan ikke regne ut fra gram. Oppgi antall porsjoner, eller vei hele retten én gang.');
      return num(opts.portionGrams) / cw;
    }
    var portions = num(version.portions) || 1;
    var n = num(opts.portions);
    if (n === null) n = 1;
    if (n <= 0) throw new Error('Antall porsjoner må være større enn 0.');
    return n / portions;
  }

  /* ---------- Validering av produktdata ---------- */
  function validateProduct(p) {
    var errors = [], warnings = [];
    if (!p || typeof p !== 'object') return { ok: false, errors: ['Mangler produktdata.'], warnings: [] };
    if (!p.name || String(p.name).trim().length < 2) errors.push('Produktnavn mangler.');
    var per = p.per100 || {};
    if (!isNum(per.kcal)) errors.push('Energi (kcal per 100) mangler.');
    ['protein', 'carbs', 'fat'].forEach(function (k) { if (!isNum(per[k])) errors.push(LABELS[k] + ' per 100 mangler.'); });
    NUTRIENTS.forEach(function (k) {
      if (per[k] === undefined || per[k] === null) return;
      if (!isNum(per[k]) || per[k] < 0) errors.push(LABELS[k] + ' må være et tall ≥ 0.');
      else if (k !== 'kcal' && per[k] > 100) errors.push(LABELS[k] + ' kan ikke være over 100 g per 100.');
    });
    if (isNum(per.kcal) && per.kcal > 900) errors.push('Over 900 kcal per 100 er ikke mulig.');
    if (isNum(per.sugars) && isNum(per.carbs) && per.sugars > per.carbs + 0.1) errors.push('Sukkerarter kan ikke være mer enn karbohydrater.');
    if (isNum(per.satFat) && isNum(per.fat) && per.satFat > per.fat + 0.1) errors.push('Mettet fett kan ikke være mer enn fett.');
    var mass = ['protein', 'carbs', 'fat', 'fiber', 'salt'].reduce(function (s, k) { return s + (isNum(per[k]) ? per[k] : 0); }, 0);
    if (mass > 102) errors.push('Summen av makronæringsstoffer er over 100 g per 100 g.');
    if (!errors.length) {
      var est = energyFromMacros(per, p.polyols);
      var diff = Math.abs(est - per.kcal);
      if (diff > Math.max(15, per.kcal * 0.12)) warnings.push('Oppgitt energi (' + round(per.kcal) + ' kcal) avviker fra beregnet fra makroer (' + round(est) + ' kcal). Kontroller avlesningen.');
    }
    if (p.basis && p.basis !== 'g' && p.basis !== 'ml') errors.push('Basis må være g eller ml.');
    if (p.edibleFactor !== undefined && p.edibleFactor !== null && !(isNum(p.edibleFactor) && p.edibleFactor > 0 && p.edibleFactor <= 1)) errors.push('Spiselig andel må være mellom 0 og 1.');
    return { ok: errors.length === 0, errors: errors, warnings: warnings };
  }
  /* EU-faktorer. Polyoler (2,4 kcal/g) trekkes fra karbohydrater når de er oppgitt. */
  function energyFromMacros(per, polyols) {
    var pol = isNum(polyols) ? polyols : 0;
    var carbs = (isNum(per.carbs) ? per.carbs : 0) - pol;
    return (isNum(per.protein) ? per.protein : 0) * 4 + carbs * 4 + pol * 2.4 + (isNum(per.fat) ? per.fat : 0) * 9 + (isNum(per.fiber) ? per.fiber : 0) * 2;
  }

  /* Omregning fra deklarasjon per porsjon til per 100. */
  function perServingTo100(perServing, servingGrams) {
    var s = num(servingGrams);
    if (!s || s <= 0) throw new Error('Ugyldig porsjonsstørrelse.');
    var out = {};
    NUTRIENTS.forEach(function (k) { var v = num(perServing[k]); out[k] = v === null ? null : v * 100 / s; });
    return out;
  }

  /* ---------- Energibehov ---------- */
  function mifflin(sex, weightKg, heightCm, age) {
    var base = 10 * weightKg + 6.25 * heightCm - 5 * age;
    return sex === 'kvinne' ? base - 161 : base + 5;
  }

  /* Lineær regresjon på vektmålinger -> kg per dag. */
  function weightTrend(points) {
    var pts = (points || []).filter(function (p) { return isNum(p.kg) && p.date; });
    if (pts.length < 2) return null;
    var t0 = Date.parse(pts[0].date);
    var xs = pts.map(function (p) { return (Date.parse(p.date) - t0) / 86400000; });
    var ys = pts.map(function (p) { return p.kg; });
    var n = xs.length, mx = xs.reduce(add0) / n, my = ys.reduce(add0) / n;
    var sxx = 0, sxy = 0;
    for (var i = 0; i < n; i++) { sxx += (xs[i] - mx) * (xs[i] - mx); sxy += (xs[i] - mx) * (ys[i] - my); }
    if (sxx === 0) return null;
    return { slopeKgPerDay: sxy / sxx, mean: my, n: n, spanDays: xs[n - 1] - xs[0] };
  }
  function add0(a, b) { return a + b; }

  /* Adaptivt estimat av vedlikeholdsbehov. Krever nok data, ellers null. */
  function adaptiveTdee(dayTotals, weights, opts) {
    opts = opts || {};
    var minDays = opts.minDays || 14;
    var logged = (dayTotals || []).filter(function (d) { return d.complete && isNum(d.kcal); });
    var tr = weightTrend(weights);
    if (logged.length < Math.max(10, Math.floor(minDays * 0.7)) || !tr || tr.n < 6 || tr.spanDays < minDays - 1) return null;
    var avg = logged.reduce(function (s, d) { return s + d.kcal; }, 0) / logged.length;
    var tdee = avg - tr.slopeKgPerDay * 7700;
    return { tdee: tdee, avgIntake: avg, kgPerWeek: tr.slopeKgPerDay * 7, days: logged.length, weighIns: tr.n };
  }

  /* Glidende gjennomsnitt (7 dager) over vektmålinger sortert på dato. */
  function rollingAvg(points, days) {
    days = days || 7;
    var sorted = (points || []).slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    return sorted.map(function (p) {
      var end = Date.parse(p.date), start = end - (days - 1) * 86400000;
      var win = sorted.filter(function (q) { var t = Date.parse(q.date); return t >= start && t <= end; });
      return { date: p.date, kg: p.kg, avg: win.reduce(function (s, q) { return s + q.kg; }, 0) / win.length };
    });
  }

  /* ---------- Energibehov fra reelle data ----------
   * Mifflin–St Jeor for hvileforbrenning. Aktivitet legges til som separate komponenter
   * (hverdag/skritt, jobb, styrke, kondisjon) i stedet for én grov aktivitetsfaktor, slik at det
   * er synlig hva estimatet bygger på. Netto MET (MET − 1) brukes for trening, fordi hvileforbruket
   * allerede ligger i grunnlinjen. Usikkerhet ±10 % (typisk avvik for prediksjonsformler). */
  var STEP_BASELINE = 3000;          // skritt som allerede ligger i faktor 1,2
  var KCAL_PER_STEP_PER_KG = 0.00035; // netto, rolig gange
  var JOB_DEFAULT_STEPS = { sittende: 5000, 'stående': 9000, fysisk: 12000 };
  var CARDIO_MET = { lett: 4, moderat: 6, hard: 9 };
  var STRENGTH_MET = 4.5;

  function round50(v) { return Math.round(v / 50) * 50; }
  function round5(v) { return Math.round(v / 5) * 5; }

  /* input: { sex, age, heightCm, weightKg, job, steps:{avg, source}, strength:{sessionsPerWeek, minutes, source}, cardio:{minutesPerWeek, intensity, walking, source} } */
  function estimateEnergy(input) {
    var kg = num(input.weightKg), h = num(input.heightCm), age = num(input.age);
    if (!kg || !h || !age) throw new Error('Trenger alder, høyde og vekt for å beregne energibehov.');
    var bmr = mifflin(input.sex, kg, h, age);
    var assumptions = [], comps = [];
    comps.push({ key: 'base', label: 'Hvileforbrenning + lett hverdag og fordøyelse (BMR × 1,2)', kcal: bmr * 1.2 });
    var job = JOB_DEFAULT_STEPS[input.job] !== undefined ? input.job : null;
    var steps = input.steps && isNum(num(input.steps.avg)) ? num(input.steps.avg) : null;
    var stepsSource = steps !== null ? (input.steps.source || 'oppgitt') : null;
    if (steps === null) {
      steps = JOB_DEFAULT_STEPS[job || 'sittende'];
      stepsSource = 'antatt';
      assumptions.push('Skritt per dag er antatt til ' + steps.toLocaleString('nb-NO') + (job ? ' ut fra jobbtypen' : ' (jobbtype og skritt er ukjent)') + '.');
    }
    if (!job) assumptions.push('Jobbtype er ukjent; antatt mest sittende.');
    comps.push({ key: 'steps', label: 'Gange og hverdagsaktivitet (' + Math.round(steps).toLocaleString('nb-NO') + ' skritt/dag, ' + stepsSource + ')', kcal: Math.max(0, steps - STEP_BASELINE) * KCAL_PER_STEP_PER_KG * kg });
    if (job === 'fysisk') comps.push({ key: 'job', label: 'Fysisk arbeid (løfting, bæring)', kcal: bmr * 0.1 });
    var st = input.strength || {};
    var sSess = num(st.sessionsPerWeek), sMin = num(st.minutes) || 60;
    if (sSess === null) { sSess = 0; assumptions.push('Antall styrkeøkter er ukjent; satt til 0.'); }
    comps.push({ key: 'strength', label: 'Styrketrening (' + fmtN(sSess, 1) + ' økter × ' + Math.round(sMin) + ' min per uke' + (st.source ? ', ' + st.source : '') + ')', kcal: sSess * (sMin / 60) * (STRENGTH_MET - 1) * kg / 7 });
    var cd = input.cardio || {};
    var cMin = num(cd.minutesPerWeek);
    if (cMin === null) { cMin = 0; assumptions.push('Kondisjonstrening er ukjent; satt til 0.'); }
    var met = CARDIO_MET[cd.intensity] || CARDIO_MET.moderat;
    var cKcal = (cMin / 60) * (met - 1) * kg / 7;
    var cLabel = 'Kondisjon (' + Math.round(cMin) + ' min/uke, ' + (cd.intensity || 'moderat') + (cd.source ? ', ' + cd.source : '') + ')';
    if (cd.walking && stepsSource === 'klokke') { cKcal *= 0.5; cLabel += ' – halv vekt fordi gangen er med i skrittallet'; }
    comps.push({ key: 'cardio', label: cLabel, kcal: cKcal });
    var tdee = comps.reduce(function (s, c) { return s + c.kcal; }, 0);
    return { bmr: bmr, tdee: tdee, low: tdee * 0.9, high: tdee * 1.1, components: comps, assumptions: assumptions };
  }
  function fmtN(v, d) { return isNum(v) ? String(round(v, d || 0)).replace('.', ',') : '–'; }

  /* Mål ut fra energibehov og målsetting.
   * goal: fettreduksjon | vedlikehold | muskelvekst; pace: rolig | moderat | raskere */
  var LOSS_RATE = { rolig: 0.0025, moderat: 0.005, raskere: 0.0075 }; // andel av kroppsvekt per uke
  var GAIN_SURPLUS = { rolig: 0.10, moderat: 0.15, raskere: 0.20 }; // overskudd som andel av forbruket (Iraki mfl. 2019: 10–20 %)
  var GAIN_RATE = { rolig: 0.0025, moderat: 0.0035, raskere: 0.005 }; // forventet økning, andel av kroppsvekt per uke (0,25–0,5 %)
  function computeTargets(energy, opts) {
    var kg = num(opts.weightKg), goal = opts.goal || 'fettreduksjon', pace = opts.pace || 'moderat';
    var why = [], warnings = [];
    var tdee = num(opts.tdeeOverride) || energy.tdee;
    var adjust = 0, kgPerWeek = 0;
    if (goal === 'fettreduksjon') {
      var rate = LOSS_RATE[pace] || LOSS_RATE.moderat;
      kgPerWeek = -rate * kg;
      adjust = kgPerWeek * 7700 / 7;
      if (-adjust > tdee * 0.25) { adjust = -tdee * 0.25; kgPerWeek = adjust * 7 / 7700; warnings.push('Underskuddet er begrenset til 25 % av energibehovet.'); }
      why.push('Vekttap i ' + pace + ' tempo: ca. ' + fmtN(rate * 100, 2) + ' % av kroppsvekten per uke (' + fmtN(-kgPerWeek, 2) + ' kg). Forskningen anbefaler 0,5–1 % per uke for å beholde mest mulig muskler når du trener styrke (Helms mfl. 2014).');
    } else if (goal === 'muskelvekst') {
      var gs = GAIN_SURPLUS[pace] || GAIN_SURPLUS.moderat;
      adjust = Math.round(tdee * gs / 10) * 10;
      kgPerWeek = (GAIN_RATE[pace] || GAIN_RATE.moderat) * kg;
      why.push('Vektøkning: overskudd på ' + Math.round(gs * 100) + ' % (+' + adjust + ' kcal), som gir omtrent ' + fmtN(kgPerWeek, 2) + ' kg opp per uke. Anbefalt er 10–20 % overskudd og 0,25–0,5 % av kroppsvekten per uke; jo mer trent du er, jo lavere ende (Iraki mfl. 2019).');
    } else why.push('Vedlikehold: inntak omtrent lik estimert forbruk.');
    var kcal = round50(tdee + adjust);
    var floor = round50(energy.bmr * 1.1);
    if (kcal < floor) { kcal = floor; warnings.push('Kalorimålet er ikke satt lavere enn ca. hvileforbrenning × 1,1.'); }
    var pPerKg = goal === 'fettreduksjon' ? 2.2 : goal === 'muskelvekst' ? 1.8 : 1.6;
    var protein = round5(pPerKg * kg);
    why.push(goal === 'fettreduksjon'
      ? 'Protein ' + fmtN(pPerKg, 1) + ' g/kg: i kaloriunderskudd beskytter høyt proteininntak muskelmassen. Anbefalt er 2,3–3,1 g per kg fettfri masse (Helms mfl. 2014), som for de fleste tilsvarer rundt 2–2,4 g per kg kroppsvekt.'
      : 'Protein ' + fmtN(pPerKg, 1) + ' g/kg: muskelveksten flater ut rundt 1,6 g/kg, med øvre anslag opp mot 2,2 g/kg (Morton mfl. 2018).');
    var fat = round5(Math.min(kcal * 0.35 / 9, Math.max(0.8 * kg, kcal * 0.25 / 9)));
    why.push('Fett ' + fat + ' g (ca. ' + Math.round(fat * 9 / kcal * 100) + ' % av energien). Nordiske næringsanbefalinger (NNR 2023) anbefaler 25–40 %, og for trening anbefales 20–35 % (Iraki mfl. 2019).');
    var carbs = round5((kcal - protein * 4 - fat * 9) / 4);
    if (carbs < 100) warnings.push('Lite karbohydrater igjen; det kan gå ut over treningsøktene.');
    why.push('Karbohydrater fyller resten av energien (' + carbs + ' g) og er viktigste drivstoff for trening.');
    var fiberMin = opts.sex === 'kvinne' ? 25 : 35;
    var fiber = Math.max(fiberMin, Math.round(kcal * 4.184 / 1000 * 3));
    why.push('Fiber minst ' + fiber + ' g: NNR 2023 anbefaler minst 3 g per MJ, det vil si minst ' + fiberMin + ' g per dag for ' + (opts.sex === 'kvinne' ? 'kvinner' : 'menn') + '.');
    var water = Math.round((35 * kg + (opts.trainingDaysPerWeek ? opts.trainingDaysPerWeek / 7 * 500 : 0)) / 100) * 100;
    return { kcal: kcal, protein: protein, fat: fat, carbs: carbs, fiber: fiber, waterMl: water, tdee: tdee, adjust: round(adjust), kgPerWeek: kgPerWeek, goal: goal, pace: pace, why: why, warnings: warnings };
  }

  /* Forslag til justering etter flere uker med data. Endrer aldri noe selv. */
  function recommendAdjustment(o) {
    var reasons = [];
    if (!o || !o.adaptive) return { action: 'vent', deltaKcal: 0, reasons: ['For lite data ennå. Trenger minst to uker med fullstendig matlogg og jevnlige veiinger.'] };
    var weeks = (o.adaptive.days || 0) / 7;
    var obs = o.adaptive.kgPerWeek, target = o.targetKgPerWeek, kcal = o.targetKcal;
    var checkin = o.checkin || {};
    reasons.push('Observert vektendring ' + fmtN(obs, 2) + ' kg/uke over ' + fmtN(weeks, 1) + ' uker; målet er ' + fmtN(target, 2) + ' kg/uke.');
    reasons.push('Beregnet faktisk forbruk fra dine data: ca. ' + Math.round(o.adaptive.tdee / 10) * 10 + ' kcal/dag.');
    if (weeks < 3) return { action: 'behold', deltaKcal: 0, reasons: reasons.concat(['Under tre uker med data: vekten svinger for mye til å konkludere. Behold målet.']) };
    var lowEnergy = isNum(checkin.energy) && checkin.energy <= 2 || isNum(checkin.performance) && checkin.performance <= 2;
    if (target < 0) {
      if (obs < target * 1.5) return { action: 'øk', deltaKcal: 150, newKcal: kcal + 150, reasons: reasons.concat(['Du går ned raskere enn planlagt, noe som øker risikoen for å miste muskelmasse. Foreslår +150 kcal.']) };
      if (obs > target * 0.5) {
        if (lowEnergy) return { action: 'behold', deltaKcal: 0, reasons: reasons.concat(['Vekten går saktere ned enn planlagt, men energi eller treningsform er lav. Se på søvn, aktivitet og loggføring før kaloriene kuttes.']) };
        return { action: 'reduser', deltaKcal: -100, newKcal: kcal - 100, reasons: reasons.concat(['Vekttapet er under halvparten av planlagt tempo over tid. Foreslår −100 kcal, eller flere skritt.']) };
      }
    } else if (target > 0) {
      if (obs < target * 0.5) return { action: 'øk', deltaKcal: 100, newKcal: kcal + 100, reasons: reasons.concat(['Vekten øker saktere enn planlagt. Foreslår +100 kcal.']) };
      if (obs > target * 2) return { action: 'reduser', deltaKcal: -100, newKcal: kcal - 100, reasons: reasons.concat(['Vekten øker raskere enn planlagt. Foreslår −100 kcal.']) };
    } else if (Math.abs(obs) > 0.2) {
      var d = obs > 0 ? -100 : 100;
      return { action: d > 0 ? 'øk' : 'reduser', deltaKcal: d, newKcal: kcal + d, reasons: reasons.concat(['Vekten endrer seg mer enn ventet ved vedlikehold.']) };
    }
    return { action: 'behold', deltaKcal: 0, reasons: reasons.concat(['Utviklingen er innenfor planen. Behold målet.']) };
  }

  /* ---------- Styrke ---------- */
  function e1rm(weightKg, reps) {
    var w = num(weightKg), r = num(reps);
    if (!w || !r || r < 1) return null;
    if (r === 1) return w;
    return w * (1 + Math.min(r, 12) / 30); // Epley, upålitelig over ~12 reps
  }
  function parseRepRange(s) {
    var m = /(\d+)\s*[-–]\s*(\d+)/.exec(String(s || ''));
    if (m) return [+m[1], +m[2]];
    var n = parseInt(s, 10);
    return isFinite(n) ? [n, n] : null;
  }
  /* Dobbel progresjon: fyll øvre rep-grense i alle arbeidssett med minst 1 RIR, så øk belastning. */
  function progressionSuggestion(lastSets, repRange, opts) {
    opts = opts || {};
    var sets = (lastSets || []).filter(function (s) { return isNum(s.reps) && isNum(s.weightKg); });
    var range = Array.isArray(repRange) ? repRange : parseRepRange(repRange);
    if (!sets.length) return { action: 'ingen data', text: 'Ingen registrerte sett med vekt og repetisjoner.' };
    if (!range) return { action: 'ukjent mål', text: 'Mangler rep-område i programmet.' };
    var w = Math.max.apply(null, sets.map(function (s) { return s.weightKg; }));
    var top = sets.filter(function (s) { return s.weightKg === w; });
    var allTop = top.every(function (s) { return s.reps >= range[1]; });
    var lowRir = top.some(function (s) { return isNum(s.rir) && s.rir < 1; });
    var anyBelow = top.some(function (s) { return s.reps < range[0]; });
    var step = w >= 100 ? 5 : opts.small ? 1 : 2.5;
    if (allTop && !lowRir) return { action: 'øk vekt', weightKg: w + step, text: 'Alle sett nådde ' + range[1] + ' reps. Neste økt: ' + fmtN(w + step, 1) + ' kg og sikt mot ' + range[0] + '+ reps.' };
    if (anyBelow) return { action: 'behold', weightKg: w, text: 'Noen sett var under ' + range[0] + ' reps. Behold ' + fmtN(w, 1) + ' kg til alle sett er innenfor området.' };
    return { action: 'flere reps', weightKg: w, text: 'Behold ' + fmtN(w, 1) + ' kg og prøv å legge til 1 rep per sett.' };
  }

  /* ---------- Duplikatsjekk ---------- */
  function mealSignature(meal) {
    var items = (meal.items || []).map(function (i) { return (i.productId || i.name) + ':' + round(i.qty, 1); }).sort();
    return (meal.type || '') + '|' + (meal.recipeRef ? meal.recipeRef.id : '') + '|' + items.join(',');
  }
  function findDuplicate(existingMeals, meal, windowMs, now) {
    var sig = mealSignature(meal);
    now = now || Date.now();
    windowMs = windowMs || 20 * 60 * 1000;
    return (existingMeals || []).find(function (m) {
      return mealSignature(m) === sig && Math.abs(now - Date.parse(m.createdAt || 0)) < windowMs;
    }) || null;
  }

  /* ---------- Dagssum ---------- */
  function dayTotals(day) {
    var vals = [], estimated = 0, items = 0;
    ((day && day.meals) || []).forEach(function (m) {
      (m.items || []).forEach(function (i) {
        vals.push(i.values); items++;
        if (i.estimated) estimated++;
      });
    });
    var s = sum(vals);
    return { values: s.values, missing: s.missing, items: items, estimated: estimated };
  }

  /* Kaloriforbruk for kondisjonsøkter (grovt estimat, brutto kcal inkl. hvile). I prioritert rekkefølge:
   * 1) Snittpuls + alder + kjønn + vekt: Keytel mfl. 2005 (J Sports Sci 23:289), gyldig ved jevn innsats (puls ≥ 90).
   * 2) Fart kjent for gange/løping: ACSM-likningene for oksygenopptak (gange 0,1·v + 1,8·v·stigning + 3,5; løping 0,2·v + 0,9·v·stigning + 3,5
   *    ml/kg/min, v i m/min), 5 kcal per liter O2.
   * 3) Ellers MET-verdier fra Compendium of Physical Activities (2024) etter aktivitet og hvor hardt: kcal = MET × kg × timer. */
  var ACT_MET = {
    'løping': [8.0, 9.8, 11.8], 'gåtur': [3.0, 3.8, 5.0], 'tredemølle': [3.5, 5.0, 8.0], 'sykkel': [5.8, 7.5, 10.0], 'spinning': [6.8, 8.5, 10.5],
    'roing': [4.8, 7.0, 8.5], 'ellipse': [4.0, 5.0, 6.8], 'svømming': [5.8, 7.0, 9.8], 'annet': [4.0, 6.0, 8.0]
  };
  function cardioKcal(o) {
    o = o || {};
    var min = num(o.min), kg = num(o.kg) || 75, km = num(o.km), hr = num(o.hr), age = num(o.age), grade = (num(o.inclinePct) || 0) / 100;
    if (!min || min <= 0) return null;
    var mod = String(o.mod || 'annet').toLowerCase(), lvl = { lett: 0, moderat: 1, hard: 2 }[o.intensity] !== undefined ? { lett: 0, moderat: 1, hard: 2 }[o.intensity] : 1;
    if (hr && hr >= 90 && age && (o.sex === 'mann' || o.sex === 'kvinne') && num(o.kg)) {
      var perMin = o.sex === 'kvinne' ? (-20.4022 + 0.4472 * hr - 0.1263 * kg + 0.074 * age) / 4.184 : (-55.0969 + 0.6309 * hr + 0.1988 * kg + 0.2017 * age) / 4.184;
      if (perMin > 2) return { kcal: Math.round(perMin * min), method: 'puls' };
    }
    if (km && (mod === 'løping' || mod === 'gåtur' || mod === 'tredemølle')) {
      var v = km * 1000 / min, run = mod === 'løping' || (mod === 'tredemølle' && v > 134), vo2 = run ? 0.2 * v + 0.9 * v * grade + 3.5 : 0.1 * v + 1.8 * v * grade + 3.5;
      return { kcal: Math.round(vo2 * kg / 1000 * 5 * min), method: 'fart' };
    }
    var met = (ACT_MET[mod] || ACT_MET.annet)[lvl];
    return { kcal: Math.round(met * kg * min / 60), method: 'met' };
  }

  var api = {
    NUTRIENTS: NUTRIENTS, CORE: CORE, LABELS: LABELS,
    num: num, normUnit: normUnit, stkWeight: stkWeight, toBasis: toBasis, scale: scale, calcItem: calcItem, sum: sum, divide: divide,
    round: round, display: display, applyMods: applyMods, calcRecipe: calcRecipe, recipeFraction: recipeFraction,
    validateProduct: validateProduct, energyFromMacros: energyFromMacros, perServingTo100: perServingTo100,
    mifflin: mifflin, weightTrend: weightTrend, adaptiveTdee: adaptiveTdee, rollingAvg: rollingAvg,
    mealSignature: mealSignature, findDuplicate: findDuplicate, dayTotals: dayTotals,
    estimateEnergy: estimateEnergy, computeTargets: computeTargets, recommendAdjustment: recommendAdjustment,
    e1rm: e1rm, parseRepRange: parseRepRange, progressionSuggestion: progressionSuggestion, cardioKcal: cardioKcal
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Engine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

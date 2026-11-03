/* Domenelogikk: registreringer, versjonering og oppsummeringer.
 * Snakker med lagring gjennom et enkelt repo-grensesnitt slik at den kan testes uten nettleser:
 *   repo.get(path) -> Promise<obj|null>, repo.set(path, obj) -> Promise, repo.list(collection) -> Promise<obj[]>
 * ctx = { repo, products: Map, recipes: Map, now: () => Date } */
(function (root) {
  'use strict';
  var E = root.Engine || (typeof require !== 'undefined' ? require('./engine.js') : null);

  var MEAL_TYPES = ['frokost', 'lunsj', 'middag', 'kvelds', 'mellommåltid', 'annet'];
  var STATUS_RANK = { etikett: 5, bruker: 5, produsent: 4, offentlig: 3, nett: 2, estimat: 1 };
  var STATUS_LABEL = { etikett: 'Etikett', bruker: 'Oppgitt av deg', produsent: 'Produsent', offentlig: 'Matvaretabellen', nett: 'Nettkilde', estimat: 'Estimat' };

  function nowIso(ctx) { return (ctx.now ? ctx.now() : new Date()).toISOString(); }
  function uid(prefix) { return (prefix || 'id') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); }
  function clone(o) { return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); }
  function isDate(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s)); }
  function slug(s) {
    return String(s || '').toLowerCase().replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'vare';
  }
  function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9æøå ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
  /* Felles nøkkel for en øvelse, så ulike skrivemåter blir samme øvelse i historikken:
   * «Incline bech press» = «incline bench», «Incline smith» = «Incline bench Smith», «Rear delt» = «Rear delts»,
   * «Stående curls» = «Stående biceps curls». Rekkefølgen på ordene spiller ingen rolle. */
  var EX_WORD = { flies: 'fly', flyes: 'fly', flys: 'fly', bech: 'bench', benk: 'bench', benkpress: 'bench', cabel: 'cable', kabel: 'cable', dumbell: 'dumbbell', db: 'dumbbell', manual: 'dumbbell', manualer: 'dumbbell', skulderpress: 'shoulder', skråbenk: 'incline' };
  var EX_DROP = { press: 1, pres: 1, the: 1, med: 1 };
  function exKey(name) {
    var w = norm(name).split(' ').filter(Boolean).map(function (x) { x = EX_WORD[x] || x; if (x.length > 3 && /s$/.test(x) && !/ss$/.test(x)) x = x.slice(0, -1); return EX_WORD[x] || x; });
    var hasCurl = w.indexOf('curl') >= 0;
    if (hasCurl && w.indexOf('stående') >= 0 && !w.some(function (x) { return x === 'bicep' || x === 'hammer' || x === 'leg'; })) w.push('bicep');
    if (w.indexOf('incline') >= 0 && w.indexOf('smith') >= 0 && w.indexOf('bench') < 0) w.push('bench');
    var core = w.filter(function (x) { return !EX_DROP[x]; });
    if (!core.length) core = w;
    var seen = {};
    return core.filter(function (x) { if (seen[x]) return false; seen[x] = 1; return true; }).sort().join(' ');
  }
  function localDate(d) {
    var x = d || new Date();
    var m = String(x.getMonth() + 1).padStart(2, '0'), day = String(x.getDate()).padStart(2, '0');
    return x.getFullYear() + '-' + m + '-' + day;
  }
  function addDays(dateStr, n) {
    var d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return localDate(d);
  }
  function mealType(t) {
    var s = norm(t);
    var map = { breakfast: 'frokost', lunch: 'lunsj', dinner: 'middag', middagen: 'middag', kveldsmat: 'kvelds', snack: 'mellommåltid', mellommaltid: 'mellommåltid' };
    s = map[s] || s;
    if (MEAL_TYPES.indexOf(s) < 0) throw new Error('Ukjent måltidstype: ' + t + '. Bruk ' + MEAL_TYPES.join(', ') + '.');
    return s;
  }

  /* ---------- Produkter ---------- */
  function findProducts(ctx, query, limit) {
    var q = norm(query);
    var digits = String(query || '').replace(/\D/g, '');
    if (digits.length >= 8) {
      var hit = null;
      ctx.products.forEach(function (p) { if (!p.archived && p.barcode === digits) hit = p; });
      if (hit) return [hit];
    }
    var words = q.split(' ').filter(Boolean);
    var out = [];
    ctx.products.forEach(function (p) {
      if (p.archived) return;
      var hay = norm([p.name, p.brand, p.variant].concat(p.aliases || []).join(' '));
      var aliasHit = (p.aliases || []).some(function (a) { return norm(a) === q; });
      var score = aliasHit ? 100 : 0;
      if (norm(p.name) === q) score += 90;
      words.forEach(function (w) { if (hay.indexOf(w) >= 0) score += 10; });
      if (!words.length) score = 1;
      if (score > 0) out.push({ p: p, score: score + (STATUS_RANK[p.status] || 0) });
    });
    out.sort(function (a, b) { return b.score - a.score; });
    return out.slice(0, limit || 8).map(function (x) { return x.p; });
  }

  function cleanProductInput(data) {
    var per = {};
    E.NUTRIENTS.forEach(function (k) { var v = data.per100 ? E.num(data.per100[k]) : null; per[k] = v; });
    var p = {
      name: String(data.name || '').trim(),
      brand: String(data.brand || '').trim(),
      variant: String(data.variant || '').trim(),
      aliases: (data.aliases || []).map(function (a) { return String(a).trim(); }).filter(Boolean).slice(0, 12),
      category: String(data.category || '').trim(),
      basis: data.basis === 'ml' ? 'ml' : 'g',
      state: String(data.state || 'ferdig').trim(),
      per100: per,
      status: STATUS_RANK[data.status] ? data.status : 'estimat',
      needsVerification: !!data.needsVerification || data.status === 'estimat',
      source: Object.assign({ type: data.status || 'estimat', name: '', checkedAt: null }, data.source || {}),
      notes: String(data.notes || '').trim()
    };
    ['servingSize', 'density', 'edibleFactor', 'polyols', 'packageSize'].forEach(function (k) { var v = E.num(data[k]); if (v !== null) p[k] = v; });
    if (data.unitWeights && E.num(data.unitWeights.stk) !== null) p.unitWeights = { stk: E.num(data.unitWeights.stk) };
    if (data.barcode && /^\d{8,14}$/.test(String(data.barcode))) p.barcode = String(data.barcode);
    var pk = E.num(data.packageSize); if (pk !== null && pk > 0) p.packageSize = pk;
    if (Array.isArray(data.labelAssets)) p.labelAssets = data.labelAssets.filter(function (x) { return /^[0-9a-f]{32}$/.test(x); });
    if (Array.isArray(data.commonPortions)) p.commonPortions = data.commonPortions.map(E.num).filter(function (x) { return x !== null; });
    return p;
  }

  /* Opprett eller oppdater produkt med versjonering. opts: { id, reason, override } */
  async function saveProduct(ctx, data, opts) {
    opts = opts || {};
    var input = cleanProductInput(data);
    var v = E.validateProduct(input);
    if (!v.ok) throw new Error('Kan ikke lagre produktet: ' + v.errors.join(' '));
    var t = nowIso(ctx);
    if (opts.id) {
      var existing = ctx.products.get(opts.id) || await ctx.repo.get('products/' + opts.id);
      if (!existing) throw new Error('Fant ikke produkt ' + opts.id);
      var oldRank = STATUS_RANK[existing.status] || 0, newRank = STATUS_RANK[input.status] || 0;
      if (newRank < oldRank && !opts.override) throw new Error('Eksisterende data er fra en sterkere kilde (' + STATUS_LABEL[existing.status] + ') enn den nye (' + STATUS_LABEL[input.status] + '). Oppdater bare hvis brukeren ber om det (override).');
      var next = Object.assign({}, existing, input, {
        id: existing.id,
        labelAssets: (existing.labelAssets || []).concat(input.labelAssets || []).filter(function (x, i, a) { return a.indexOf(x) === i; }),
        aliases: (existing.aliases || []).concat(input.aliases).filter(function (x, i, a) { return a.indexOf(x) === i; }).slice(0, 16),
        version: (existing.version || 1) + 1,
        history: (existing.history || []).concat([{ version: existing.version || 1, per100: existing.per100, source: existing.source, status: existing.status, changedAt: t, reason: opts.reason || 'Oppdatert' }]).slice(-20),
        createdAt: existing.createdAt || t, updatedAt: t, archived: false
      });
      await ctx.repo.set('products/' + next.id, next);
      ctx.products.set(next.id, next);
      await logChange(ctx, 'produkt oppdatert', next.name + ' → versjon ' + next.version + (opts.reason ? ' (' + opts.reason + ')' : ''));
      return { product: next, warnings: v.warnings, created: false };
    }
    var dupe = null;
    ctx.products.forEach(function (p) { if (!p.archived && ((norm(p.name) === norm(input.name) && norm(p.brand) === norm(input.brand)) || (input.barcode && p.barcode === input.barcode))) dupe = p; });
    if (dupe) throw new Error('Produktet finnes allerede (' + dupe.id + '). Bruk oppdatering i stedet for å lage et duplikat.');
    var id = slug((input.brand ? input.brand + ' ' : '') + input.name);
    if (ctx.products.has(id)) id = id + '-' + Math.random().toString(36).slice(2, 6);
    var prod = Object.assign({ id: id, version: 1, history: [], createdAt: t, updatedAt: t, archived: false }, input);
    await ctx.repo.set('products/' + id, prod);
    ctx.products.set(id, prod);
    await logChange(ctx, 'produkt lagret', prod.name + ' (' + STATUS_LABEL[prod.status] + ')');
    return { product: prod, warnings: v.warnings, created: true };
  }

  /* ---------- Måltider ---------- */
  function snapshotItem(ctx, input) {
    var p = ctx.products.get(String(input.product_id || input.productId || ''));
    if (!p) throw new Error('Ukjent produkt-id: ' + (input.product_id || input.productId) + '. Søk etter produktet først, eller opprett det.');
    var unit = input.unit || 'g';
    var c = E.calcItem(p, input.amount, unit);
    var amountSource = input.amount_source || input.amountSource || 'bruker';
    return {
      id: uid('i'), productId: p.id, productVersion: p.version || 1, name: p.name, brand: p.brand || '',
      amount: E.num(input.amount), unit: E.normUnit(unit), qty: c.qty, basis: c.basis, state: p.state || '',
      per100: clone(p.per100), values: c.values, notes: c.notes,
      sourceStatus: p.status, estimated: !!(p.needsVerification || p.status === 'estimat' || amountSource === 'bilde-anslag' || amountSource === 'anslag'),
      amountSource: amountSource
    };
  }

  function scaleValues(values, f) {
    var out = {};
    E.NUTRIENTS.forEach(function (k) { out[k] = typeof values[k] === 'number' ? values[k] * f : null; });
    return out;
  }

  function findRecipe(ctx, ref) {
    if (!ref) return null;
    var r = ctx.recipes.get(ref);
    if (r) return r;
    var q = norm(ref), hit = null;
    ctx.recipes.forEach(function (x) { if (!hit && (norm(x.name) === q || (x.aliases || []).some(function (a) { return norm(a) === q; }))) hit = x; });
    return hit;
  }

  function recipeItems(ctx, recipeInput) {
    var r = findRecipe(ctx, recipeInput.id || recipeInput.recipe_id);
    if (!r) throw new Error('Fant ikke oppskriften ' + (recipeInput.id || recipeInput.recipe_id) + '.');
    var ver = r.versions.find(function (v) { return v.version === r.currentVersion; }) || r.versions[r.versions.length - 1];
    var mods = { set: {}, remove: [], add: [] };
    var variantName = recipeInput.variant || null;
    if (variantName) {
      var vv = (r.variants || []).find(function (x) { return norm(x.name) === norm(variantName); });
      if (!vv) throw new Error('Fant ikke varianten «' + variantName + '». Varianter: ' + ((r.variants || []).map(function (x) { return x.name; }).join('; ') || 'ingen'));
      Object.assign(mods.set, vv.mods.set || {});
      mods.remove = mods.remove.concat(vv.mods.remove || []);
    }
    var m = recipeInput.mods || {};
    Object.assign(mods.set, m.set || {});
    mods.remove = mods.remove.concat(m.remove || []);
    Object.keys(mods.set).forEach(function (k) { mods.remove = mods.remove.filter(function (x) { return x !== k; }); });
    var items = E.applyMods(ver.items, { set: mods.set, remove: mods.remove });
    var frac = E.recipeFraction(ver, { portions: recipeInput.portions, portionGrams: recipeInput.portion_grams || recipeInput.portionGrams });
    var rows = items.map(function (it) {
      var p = ctx.products.get(it.productId);
      if (!p) throw new Error('Oppskriften bruker et produkt som mangler: ' + it.productId);
      var c = E.calcItem(p, it.amount, it.unit || 'g');
      return {
        id: uid('i'), productId: p.id, productVersion: p.version || 1, name: p.name, brand: p.brand || '', recipeKey: it.key,
        amount: E.round(it.amount * frac, 2), unit: E.normUnit(it.unit || 'g'), qty: c.qty * frac, basis: c.basis, state: p.state || '',
        per100: clone(p.per100), values: scaleValues(c.values, frac), notes: frac !== 1 ? ['Andel ' + E.round(frac * 100, 1) + ' % av oppskriften (' + it.amount + ' ' + (it.unit || 'g') + ' totalt)'] : [],
        sourceStatus: p.status, estimated: !!(p.needsVerification || p.status === 'estimat'), amountSource: 'oppskrift', modified: !!it.modified
      };
    });
    return { recipe: r, version: ver, rows: rows, fraction: frac, mods: mods, variant: variantName };
  }

  async function getDay(ctx, date) {
    var d = await ctx.repo.get('days/' + date);
    return d || { date: date, meals: [] };
  }

  function mealTotals(meal) {
    var s = E.sum((meal.items || []).map(function (i) { return i.values; }));
    return s;
  }

  function compactMeal(m) {
    var t = mealTotals(m).values;
    return {
      id: m.id, type: m.type, name: m.name, status: m.status,
      kcal: E.round(t.kcal), protein: E.round(t.protein, 1), carbs: E.round(t.carbs, 1), fat: E.round(t.fat, 1), fiber: E.round(t.fiber, 1),
      items: (m.items || []).map(function (i) {
        return { item_id: i.id, name: i.name, amount: E.round(i.amount, 1), unit: i.unit, kcal: E.round(i.values.kcal), protein: E.round(i.values.protein, 1), estimated: !!i.estimated };
      })
    };
  }

  async function logMeal(ctx, args) {
    var date = args.date || localDate(ctx.now ? ctx.now() : new Date());
    if (!isDate(date)) throw new Error('Ugyldig dato: ' + date);
    var type = mealType(args.meal_type || args.type || 'annet');
    var items = [], recipeRef = null, name = args.name || '';
    if (args.recipe) {
      var r = recipeItems(ctx, args.recipe);
      items = items.concat(r.rows);
      recipeRef = { id: r.recipe.id, name: r.recipe.name, version: r.version.version, variant: r.variant, fraction: r.fraction, portions: E.num(args.recipe.portions), portionGrams: E.num(args.recipe.portion_grams), mods: r.mods };
      if (!name) name = r.recipe.name + (Object.keys(r.mods.set).length || r.mods.remove.length ? ' (tilpasset)' : '');
    }
    (args.items || []).forEach(function (it) { items.push(snapshotItem(ctx, it)); });
    if (!items.length) throw new Error('Måltidet har ingen ingredienser.');
    var t = nowIso(ctx);
    var meal = {
      id: uid('m'), type: type, name: name || items.map(function (i) { return i.name; }).slice(0, 3).join(', '),
      recipeRef: recipeRef, items: items, note: args.note || '',
      status: args.status === 'foreslått' ? 'foreslått' : (items.some(function (i) { return i.estimated; }) ? 'estimat' : 'bekreftet'),
      createdAt: t, updatedAt: t
    };
    var day = await getDay(ctx, date);
    if (!args.force) {
      var dupe = E.findDuplicate(day.meals, meal, 20 * 60 * 1000, Date.parse(t));
      if (dupe) {
        var err = new Error('Et identisk måltid (' + dupe.name + ', ' + dupe.type + ') ble registrert for under 20 minutter siden. Ikke registrert på nytt. Hvis brukeren faktisk spiste det to ganger, kall igjen med force=true.');
        err.duplicate = dupe.id;
        throw err;
      }
    }
    day.date = date;
    day.meals = (day.meals || []).concat([meal]);
    day.updatedAt = t;
    await ctx.repo.set('days/' + date, day);
    await logChange(ctx, 'måltid registrert', date + ' ' + type + ': ' + meal.name);
    return { meal: meal, day: day };
  }

  async function updateMeal(ctx, args) {
    var date = args.date;
    if (!isDate(date)) throw new Error('Ugyldig dato: ' + date);
    var day = await getDay(ctx, date);
    var meal = (day.meals || []).find(function (m) { return m.id === args.meal_id; });
    if (!meal) throw new Error('Fant ikke måltidet ' + args.meal_id + ' på ' + date + '.');
    var changed = [];
    var scale = E.num(args.scale);
    if (scale !== null) {
      if (!(scale > 0 && scale <= 10)) throw new Error('Ugyldig faktor: ' + args.scale);
      var targetIds = args.scale_item_ids && args.scale_item_ids.length ? args.scale_item_ids : meal.items.map(function (i) { return i.id; });
      args.set_amounts = (args.set_amounts || []).concat(meal.items.filter(function (i) { return targetIds.indexOf(i.id) >= 0; }).map(function (i) { return { item_id: i.id, amount: E.round(i.amount * scale, 2) }; }));
    }
    (args.set_amounts || []).forEach(function (s) {
      var it = meal.items.find(function (i) { return i.id === s.item_id; });
      if (!it) throw new Error('Fant ikke ingrediensen ' + s.item_id);
      var n = E.num(s.amount);
      if (n === null || n < 0) throw new Error('Ugyldig mengde for ' + it.name);
      var unit = s.unit || it.unit;
      /* Bruk produktdata slik de var ved registrering (snapshot), så historikk ikke endres i stillhet. */
      var pseudo = { name: it.name, per100: it.per100, basis: it.basis, state: it.state };
      var live = ctx.products.get(it.productId);
      if (live) { pseudo.unitWeights = live.unitWeights; pseudo.servingSize = live.servingSize; pseudo.edibleFactor = live.edibleFactor; pseudo.density = live.density; }
      var c = E.calcItem(pseudo, n, unit);
      changed.push(it.name + ': ' + E.round(it.amount, 1) + ' → ' + n + ' ' + E.normUnit(unit));
      it.amount = n; it.unit = E.normUnit(unit); it.qty = c.qty; it.values = c.values; it.notes = c.notes;
      if (s.amount_source) { it.amountSource = s.amount_source; }
      it.modified = true;
    });
    if (args.remove_item_ids && args.remove_item_ids.length) {
      var before = meal.items.length;
      meal.items = meal.items.filter(function (i) {
        var rm = args.remove_item_ids.indexOf(i.id) >= 0;
        if (rm) changed.push('fjernet ' + i.name);
        return !rm;
      });
      if (before - meal.items.length !== args.remove_item_ids.length) throw new Error('Noen av ingrediensene som skulle fjernes ble ikke funnet.');
    }
    (args.add_items || []).forEach(function (it) { var s = snapshotItem(ctx, it); meal.items.push(s); changed.push('la til ' + s.name); });
    if (args.meal_type) { meal.type = mealType(args.meal_type); changed.push('type → ' + meal.type); }
    if (args.name) { meal.name = String(args.name); }
    if (args.status === 'bekreftet' || args.status === 'estimat') meal.status = args.status;
    else if (meal.status !== 'foreslått') meal.status = meal.items.some(function (i) { return i.estimated; }) ? 'estimat' : 'bekreftet';
    var removedMeal = null;
    if (!meal.items.length) { day.meals = day.meals.filter(function (m) { return m !== meal; }); removedMeal = meal; changed.push('måltidet var tomt og ble fjernet'); }
    meal.updatedAt = nowIso(ctx);
    day.updatedAt = meal.updatedAt;
    await ctx.repo.set('days/' + date, day);
    await logChange(ctx, 'måltid endret', date + ' ' + meal.name + ': ' + changed.join('; '));
    return { meal: removedMeal ? null : meal, day: day, changes: changed };
  }

  async function deleteMeal(ctx, args) {
    var day = await getDay(ctx, args.date);
    var meal = (day.meals || []).find(function (m) { return m.id === args.meal_id; });
    if (!meal) throw new Error('Fant ikke måltidet.');
    day.meals = day.meals.filter(function (m) { return m.id !== args.meal_id; });
    day.updatedAt = nowIso(ctx);
    await ctx.repo.set('days/' + args.date, day);
    await logChange(ctx, 'måltid slettet', args.date + ' ' + meal.name);
    return { removed: meal, day: day };
  }

  async function restoreMeal(ctx, date, meal) {
    var day = await getDay(ctx, date);
    if ((day.meals || []).some(function (m) { return m.id === meal.id; })) return day;
    day.meals = (day.meals || []).concat([meal]);
    day.updatedAt = nowIso(ctx);
    await ctx.repo.set('days/' + date, day);
    return day;
  }

  /* ---------- Oppskrifter ---------- */
  async function saveRecipe(ctx, args) {
    var items = (args.items || []).map(function (it, i) {
      var pid = String(it.product_id || it.productId || '');
      if (!ctx.products.get(pid)) throw new Error('Ukjent produkt i oppskriften: ' + pid);
      var amount = E.num(it.amount);
      if (amount === null || amount <= 0) throw new Error('Ugyldig mengde for ' + pid);
      E.calcItem(ctx.products.get(pid), amount, it.unit || 'g');
      return { key: it.key || slug(ctx.products.get(pid).name).split('-')[0] + (i ? '-' + i : ''), productId: pid, amount: amount, unit: E.normUnit(it.unit || 'g') };
    });
    if (!items.length) throw new Error('Oppskriften må ha minst én ingrediens.');
    var keys = {};
    items.forEach(function (it) { if (keys[it.key]) it.key = it.key + '-' + Math.random().toString(36).slice(2, 4); keys[it.key] = 1; });
    var portions = E.num(args.portions) || 1;
    var t = nowIso(ctx);
    var existing = args.id ? findRecipe(ctx, args.id) : null;
    if (args.id && !existing) throw new Error('Fant ikke oppskriften ' + args.id);
    var ver = { version: existing ? existing.currentVersion + 1 : 1, portions: portions, cookedWeightG: E.num(args.cooked_weight_g), items: items, notes: args.notes || '', createdAt: t };
    var r;
    if (existing) {
      r = clone(existing);
      r.versions.push(ver);
      r.currentVersion = ver.version;
      if (args.name) r.name = args.name;
      if (args.aliases) r.aliases = (r.aliases || []).concat(args.aliases).filter(function (x, i, a) { return a.indexOf(x) === i; });
      r.updatedAt = t;
    } else {
      var dupe = null;
      ctx.recipes.forEach(function (x) { if (norm(x.name) === norm(args.name)) dupe = x; });
      if (dupe) throw new Error('Oppskriften «' + dupe.name + '» finnes allerede (' + dupe.id + '). Oppdater den i stedet.');
      var id = slug(args.name);
      if (ctx.recipes.has(id)) id += '-' + Math.random().toString(36).slice(2, 6);
      r = { id: id, name: String(args.name || 'Oppskrift'), kind: args.kind || 'oppskrift', aliases: args.aliases || [], defaultMealType: args.default_meal_type ? mealType(args.default_meal_type) : null, currentVersion: 1, versions: [ver], variants: [], createdAt: t, updatedAt: t };
    }
    await ctx.repo.set('recipes/' + r.id, r);
    ctx.recipes.set(r.id, r);
    await logChange(ctx, existing ? 'oppskrift ny versjon' : 'oppskrift lagret', r.name + ' v' + r.currentVersion);
    return { recipe: r, calc: E.calcRecipe(ver, function (id) { return ctx.products.get(id); }) };
  }

  async function saveRecipeVariant(ctx, args) {
    var r = findRecipe(ctx, args.recipe_id);
    if (!r) throw new Error('Fant ikke oppskriften.');
    var mods = { set: args.set || {}, remove: args.remove || [] };
    var ver = r.versions.find(function (v) { return v.version === r.currentVersion; });
    E.applyMods(ver.items, mods);
    r = clone(r);
    r.variants = (r.variants || []).filter(function (v) { return norm(v.name) !== norm(args.name); }).concat([{ name: args.name, mods: mods }]);
    r.updatedAt = nowIso(ctx);
    await ctx.repo.set('recipes/' + r.id, r);
    ctx.recipes.set(r.id, r);
    return r;
  }

  function previewRecipe(ctx, recipeInput) {
    var r = recipeItems(ctx, recipeInput);
    return E.sum(r.rows.map(function (x) { return x.values; }));
  }

  /* ---------- Oppsummeringer ---------- */
  function targetsOf(profile) {
    return { kcal: (profile && profile.kcalTarget) || null, protein: (profile && profile.proteinTarget) || null };
  }

  async function daySummary(ctx, date) {
    var day = await getDay(ctx, date);
    var profile = (await ctx.repo.get('meta/profile')) || {};
    var t = E.dayTotals(day);
    var tg = targetsOf(profile);
    var disp = E.display(t.values);
    var workouts = ctx.workoutsByDate ? ctx.workoutsByDate(date) : [];
    return {
      date: date,
      targets: tg,
      totals: disp,
      remaining: { kcal: tg.kcal ? E.round(tg.kcal - t.values.kcal) : null, protein: tg.protein ? E.round(tg.protein - t.values.protein, 1) : null },
      missingData: Object.keys(t.missing).filter(function (k) { return t.missing[k] > 0 && E.CORE.indexOf(k) >= 0; }).map(function (k) { return E.LABELS[k] + ' mangler for ' + t.missing[k] + ' vare(r)'; }),
      estimatedItems: t.estimated,
      meals: (day.meals || []).map(compactMeal),
      workouts: workouts.map(function (w) { return { id: w.id, type: w.type, title: w.title }; })
    };
  }

  async function weekSummary(ctx, endDate, nDays) {
    nDays = nDays || 7;
    var days = [], weights = [], i;
    var all = await ctx.repo.list('days');
    var byDate = {}; all.forEach(function (d) { byDate[d.date] = d; });
    for (i = nDays - 1; i >= 0; i--) {
      var ds = addDays(endDate, -i);
      var d = byDate[ds];
      var tt = d ? E.dayTotals(d) : null;
      days.push({ date: ds, logged: !!(tt && tt.items), kcal: tt && tt.items ? E.round(tt.values.kcal) : null, protein: tt && tt.items ? E.round(tt.values.protein, 1) : null, estimatedItems: tt ? tt.estimated : 0 });
    }
    var wAll = (await ctx.repo.list('weights')).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var start = addDays(endDate, -(nDays - 1));
    weights = wAll.filter(function (w) { return w.date >= start && w.date <= endDate; });
    var prevStart = addDays(start, -nDays), prevEnd = addDays(start, -1);
    var prevWeights = wAll.filter(function (w) { return w.date >= prevStart && w.date <= prevEnd; });
    var workouts = (await ctx.repo.list('workouts')).filter(function (w) { return w.date >= start && w.date <= endDate && !w.planned; });
    var logged = days.filter(function (d) { return d.logged; });
    function avg(arr, k) { return arr.length ? arr.reduce(function (s, x) { return s + x[k]; }, 0) / arr.length : null; }
    /* Adaptivt estimat over 28 dager */
    var tdeeStart = addDays(endDate, -27);
    var tdDays = all.filter(function (d) { return d.date >= tdeeStart && d.date <= endDate; }).map(function (d) {
      var x = E.dayTotals(d); return { date: d.date, kcal: x.values.kcal, complete: !!d.complete || x.items >= 3 };
    });
    var ad = E.adaptiveTdee(tdDays, wAll.filter(function (w) { return w.date >= tdeeStart && w.date <= endDate; }), { minDays: 14 });
    return {
      from: start, to: endDate,
      days: days,
      avgKcal: E.round(avg(logged, 'kcal')), avgProtein: E.round(avg(logged, 'protein'), 1), loggedDays: logged.length,
      weight: { avgThisPeriod: E.round(avg(weights, 'kg'), 2), avgPrevPeriod: E.round(avg(prevWeights, 'kg'), 2), weighIns: weights.length },
      workouts: { count: workouts.length, strength: workouts.filter(function (w) { return w.type === 'styrke'; }).length, cardio: workouts.filter(function (w) { return w.type === 'kondisjon'; }).length },
      adaptiveTdee: ad ? { kcal: E.round(ad.tdee, -1), avgIntake: E.round(ad.avgIntake), kgPerWeek: E.round(ad.kgPerWeek, 2), basedOnDays: ad.days, weighIns: ad.weighIns } : null
    };
  }

  /* ---------- Kropp og trening ---------- */
  async function logWeight(ctx, args) {
    var kg = E.num(args.kg);
    if (kg === null || kg < 30 || kg > 300) throw new Error('Ugyldig vekt: ' + args.kg);
    var date = args.date || localDate(ctx.now ? ctx.now() : new Date());
    if (!isDate(date)) throw new Error('Ugyldig dato.');
    var doc = { date: date, kg: kg, note: args.note || '', source: args.source === 'garmin' ? 'garmin' : 'manuell', updatedAt: nowIso(ctx) };
    await ctx.repo.set('weights/' + date, doc);
    await logChange(ctx, 'vekt', date + ': ' + kg + ' kg');
    return doc;
  }

  function cleanSets(sets) {
    return (sets || []).map(function (s) {
      var o = { reps: E.num(s.reps), weightKg: E.num(s.weight_kg !== undefined ? s.weight_kg : s.weightKg), rir: E.num(s.rir), rpe: E.num(s.rpe) };
      if (o.reps !== null && (o.reps < 0 || o.reps > 200)) throw new Error('Ugyldig antall repetisjoner.');
      if (o.weightKg !== null && (o.weightKg < 0 || o.weightKg > 600)) throw new Error('Ugyldig belastning.');
      return o;
    });
  }

  async function logWorkout(ctx, args) {
    var date = args.date || localDate(ctx.now ? ctx.now() : new Date());
    if (!isDate(date)) throw new Error('Ugyldig dato.');
    var type = ['styrke', 'kondisjon', 'annet'].indexOf(args.type) >= 0 ? args.type : 'annet';
    var ext = args.external_id ? String(args.external_id).slice(0, 80) : null;
    if (ext) {
      var existing = (await ctx.repo.list('workouts')).find(function (x) { return x.externalId === ext; });
      if (existing) { existing.duplicate = true; return existing; }
    }
    var w = {
      id: args.id || (ext ? 'w-' + slug(ext) : uid('w')), date: date, type: type, externalId: ext, source: args.source || (ext ? 'garmin' : 'manuell'), title: String(args.title || (type === 'styrke' ? 'Styrkeøkt' : type === 'kondisjon' ? 'Kondisjonsøkt' : 'Økt')),
      planned: !!args.planned,
      exercises: (args.exercises || []).map(function (e) { return { name: String(e.name || '').trim(), sets: cleanSets(e.sets), notes: e.notes || '' }; }).filter(function (e) { return e.name; }),
      cardio: args.cardio ? {
        modality: args.cardio.modality || 'tredemølle',
        durationMin: E.num(args.cardio.duration_min), speedKmh: E.num(args.cardio.speed_kmh), inclinePct: E.num(args.cardio.incline_pct),
        distanceKm: E.num(args.cardio.distance_km), rpe: E.num(args.cardio.rpe),
        avgHr: E.num(args.cardio.avg_hr), maxHr: E.num(args.cardio.max_hr)
      } : null,
      notes: args.notes || '', createdAt: nowIso(ctx)
    };
    if (type === 'styrke') {
      w.durationMin = E.num(args.duration_min); w.avgHr = E.num(args.avg_hr); w.maxHr = E.num(args.max_hr);
      if (w.cardio && !w.exercises.length) { if (w.durationMin === null) w.durationMin = w.cardio.durationMin; if (w.avgHr === null) w.avgHr = w.cardio.avgHr; if (w.maxHr === null) w.maxHr = w.cardio.maxHr; w.cardio = null; }
    }
    await ctx.repo.set('workouts/' + w.id, w);
    await logChange(ctx, 'trening', date + ': ' + w.title);
    return w;
  }

  /* Styrkeøkt med øvelser. Finnes det en Garmin-økt (styrke uten øvelser) samme dag, fylles den ut i stedet
   * for å lage en ny, slik at varighet og puls fra klokka og settene fra brukeren havner i samme økt.
   * edit_id: oppdater en bestemt økt. */
  async function logStrength(ctx, args) {
    var date = args.date || localDate(ctx.now ? ctx.now() : new Date());
    if (!isDate(date)) throw new Error('Ugyldig dato.');
    var exercises = (args.exercises || []).map(function (e) { return { name: String(e.name || '').trim(), sets: cleanSets(e.sets), notes: e.notes || '' }; }).filter(function (e) { return e.name; });
    if (!exercises.length) throw new Error('Legg inn minst én øvelse.');
    var all = await ctx.repo.list('workouts');
    var target = null;
    if (args.edit_id) { target = all.find(function (w) { return w.id === args.edit_id; }) || null; if (!target) throw new Error('Fant ikke økten som skulle endres.'); }
    else target = all.find(function (w) { return w.date === date && w.type === 'styrke' && !w.planned && !(w.exercises || []).length; }) || null;
    var title = String(args.title || '').trim();
    if (target) {
      var w = Object.assign({}, target, { date: date, title: title || (target.title === 'Styrketrening' ? 'Styrketrening' : target.title), exercises: exercises, notes: args.notes !== undefined ? String(args.notes) : (target.notes || ''), updatedAt: nowIso(ctx) });
      await ctx.repo.set('workouts/' + w.id, w);
      await logChange(ctx, 'trening', date + ': ' + w.title + ' (' + exercises.length + ' øvelser)');
      w.merged = !args.edit_id && target.source === 'garmin';
      return w;
    }
    return logWorkout(ctx, { date: date, type: 'styrke', title: title || 'Styrketrening', exercises: exercises.map(function (e) { return { name: e.name, sets: e.sets.map(function (x) { return { reps: x.reps, weight_kg: x.weightKg, rir: x.rir, rpe: x.rpe }; }), notes: e.notes }; }), notes: args.notes || '', source: 'manuell' });
  }

  /* ---------- Skrivefelt uten AI ----------
   * «frokost: 300 g q yoghurt, 30 g havregryn og 100 g bær» -> linjer med mengde, enhet og beste treff i
   * matvarer/oppskrifter. aliases: {normalisert tekst: produkt-id} som appen har lært av tidligere valg. */
  var UNIT_WORDS = { g: 'g', gr: 'g', gram: 'g', kg: 'kg', ml: 'ml', dl: 'dl', l: 'l', liter: 'l', stk: 'stk', stykk: 'stk', st: 'stk', porsjon: 'porsjon', porsjoner: 'porsjon', pors: 'porsjon', pakke: 'pakke', pakker: 'pakke', pk: 'pakke', boks: 'pakke', skive: 'stk', skiver: 'stk' };
  var MEAL_WORDS = { frokost: 'frokost', lunsj: 'lunsj', lunch: 'lunsj', middag: 'middag', kvelds: 'kvelds', kveldsmat: 'kvelds', mellommåltid: 'mellommåltid', mellommaltid: 'mellommåltid', snack: 'mellommåltid' };
  function mealTypeForHour(h) { return h < 10 ? 'frokost' : h < 14 ? 'lunsj' : h < 17 ? 'mellommåltid' : h < 20 ? 'middag' : 'kvelds'; }
  function matchScore(query, p) {
    var words = norm(query).split(' ').filter(function (w) { return w.length > 1 || /\d/.test(w); });
    if (!words.length) return 0;
    var hay = norm([p.name, p.brand, p.variant].concat(p.aliases || []).join(' '));
    if ((p.aliases || []).some(function (a) { return norm(a) === norm(query); }) || norm(p.name) === norm(query)) return 1;
    var hit = words.filter(function (w) { return hay.indexOf(w) >= 0 || (w.length > 4 && hay.indexOf(w.slice(0, -1)) >= 0); }).length;
    return hit / words.length;
  }
  function parseFoodText(ctx, text, opts) {
    opts = opts || {};
    var raw = String(text || '').trim();
    var mt = null;
    var lead = /^\s*(frokost|lunsj|lunch|middag|kveldsmat|kvelds|mellommåltid|mellommaltid|snack)\b\s*[:\-–]?\s*/i.exec(raw);
    if (lead) { mt = MEAL_WORDS[lead[1].toLowerCase()]; raw = raw.slice(lead[0].length); }
    var any = /\btil\s+(frokost|lunsj|lunch|middag|kveldsmat|kvelds|mellommåltid|snack)\b/i.exec(raw);
    if (any) { mt = mt || MEAL_WORDS[any[1].toLowerCase()]; raw = raw.replace(any[0], ' '); }
    raw = raw.replace(/^(jeg\s+)?(spiste|har spist|åt|drakk|hadde)\s+/i, '');
    var aliases = opts.aliases || {};
    raw = raw.replace(/(\D)\.(\s+|$)/g, '$1,').replace(/(\d\s*[a-zæøå]+)\.(\s+|$)/gi, '$1,');
    var parts = raw.split(/\s*(?:(?<!\d),|,(?!\d)|;|\+|\n|\s+og\s+|\s+med\s+)\s*/i).map(function (x) { return x.trim(); }).filter(Boolean);
    var lines = parts.map(function (part) {
      var amount = null, unit = null, name = part;
      var m = /(\d+(?:[.,]\d+)?)\s*(kg|gram|gr|g|ml|dl|liter|l|stk|stykk|st|porsjoner|porsjon|pors|pakker|pakke|pk|boks|skiver|skive)?\b\.?/i.exec(part);
      if (m) { amount = E.num(m[1]); unit = m[2] ? UNIT_WORDS[m[2].toLowerCase()] : null; name = (part.slice(0, m.index) + ' ' + part.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim(); }
      else { var wn = /^(en|ett|ei|én|to|tre|fire|fem|halv|en halv)\s+/i.exec(part); if (wn) { amount = { en: 1, ett: 1, ei: 1, 'én': 1, to: 2, tre: 3, fire: 4, fem: 5, halv: 0.5, 'en halv': 0.5 }[wn[1].toLowerCase()]; name = part.slice(wn[0].length).trim(); } }
      name = name.replace(/^(av|med)\s+/i, '').replace(/\s+(av|med)$/i, '').trim();
      var line = { raw: part, name: name, amount: amount, unit: unit, kind: null, id: null, candidates: [], confident: false };
      var key = norm(name);
      var rec = findRecipe(ctx, name);
      if (!rec) ctx.recipes.forEach(function (x) { if (!rec && [x.name].concat(x.aliases || []).some(function (a) { var n = norm(a); return n && (key.indexOf(n) >= 0 || n.indexOf(key) >= 0) && key.length >= 4; })) rec = x; });
      if (rec && !(aliases[key])) {
        line.kind = 'recipe'; line.id = rec.id; line.confident = true;
        if (line.amount === null || (line.unit && line.unit !== 'porsjon')) { if (line.unit && line.unit !== 'porsjon') { line.kind = null; } else { line.amount = 1; line.unit = 'porsjon'; } }
        if (line.kind) return line;
      }
      var cands = findProducts(ctx, name, 6);
      if (aliases[key] && ctx.products.get(aliases[key])) { cands = [ctx.products.get(aliases[key])].concat(cands.filter(function (p) { return p.id !== aliases[key]; })); line.confident = true; }
      line.candidates = cands.map(function (p) { return p.id; });
      if (cands.length) {
        line.kind = 'product'; line.id = cands[0].id;
        if (!line.confident) line.confident = matchScore(name, cands[0]) >= 0.6;
        var p = cands[0];
        if (line.amount !== null && !line.unit) line.unit = line.amount <= 12 && E.stkWeight(p) ? 'stk' : (line.amount <= 3 && p.servingSize ? 'porsjon' : (p.basis === 'ml' ? 'ml' : 'g'));
        if (line.amount === null && E.stkWeight(p) && E.stkWeight(p).src !== 'pakning') { line.amount = 1; line.unit = 'stk'; }
        if (line.amount === null && p.servingSize) { line.amount = 1; line.unit = 'porsjon'; }
      }
      return line;
    });
    var h = opts.hour !== undefined ? opts.hour : new Date().getHours();
    return { mealType: mt || mealTypeForHour(h), lines: lines };
  }

  /* Tolker notater som «Mandag 2 nov push» + linjer «Pulldown 85 x 10» (kg × reps). Flere sett: «85 x 10, 80 x 8».
   * Like øvelsesnavn på rad blir sett i samme øvelse. Returnerer [{date, title, exercises}]. */
  var MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, mai: 5, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12 };
  function parseWorkoutNotes(text, opts) {
    opts = opts || {};
    var ref = opts.today || localDate(new Date());
    var sessions = [], cur = null;
    function start(date, title) { cur = { date: date, title: title, exercises: [] }; sessions.push(cur); }
    String(text || '').split(/\r?\n/).forEach(function (raw) {
      var line = raw.replace(/\|/g, ' ').replace(/\s+/g, ' ').trim();
      if (!line) return;
      var hm = /(\d{1,2})\.?\s*(jan|feb|mar|apr|mai|may|jun|jul|aug|sep|okt|oct|nov|des|dec)[a-zæøå]*\.?(?:\s+(\d{4}))?/i.exec(line);
      var pairs = [], re = /(\d+(?:[.,]\d+)?)\s*(?:kg)?\s*[x×*]\s*(\d+(?:[.,]\d+)?)?/gi, m;
      while ((m = re.exec(line))) pairs.push({ w: E.num(m[1]), r: m[2] !== undefined ? E.num(m[2]) : null, idx: m.index });
      if (hm && !pairs.length) {
        var y = hm[3] ? +hm[3] : +ref.slice(0, 4), mo = MONTHS[hm[2].toLowerCase().slice(0, 3)], d = +hm[1];
        var date = y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
        if (!hm[3] && date > ref) date = (y - 1) + date.slice(4);
        var rest = line.replace(hm[0], ' ').replace(/^(mandag|tirsdag|onsdag|torsdag|fredag|lørdag|søndag|man|tir|ons|tor|fre|lør|søn)\.?\s*/i, '').replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
        var split = /push|pull|bein|legs|ben\b|overkropp|underkropp|fullkropp|upper|lower|full/i.exec(rest);
        var vol = /volum/i.test(rest), tung = /tung|heavy/i.test(rest);
        var title = split ? split[0].charAt(0).toUpperCase() + split[0].slice(1).toLowerCase() : (rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : 'Styrketrening');
        if (split && (vol || tung)) title += vol ? ' (volum)' : ' (tung)';
        start(isDate(date) ? date : (opts.date || ref), title);
        return;
      }
      var name = (pairs.length ? line.slice(0, pairs[0].idx) : line.replace(/\d.*$/, '')).replace(/[:\-–]+\s*$/, '').trim();
      if (!name || /^\d/.test(name)) return;
      if (!cur) start(opts.date || ref, opts.title || 'Styrketrening');
      var sets = pairs.filter(function (p) { return p.w !== null; }).map(function (p) { return { weight_kg: p.w, reps: p.r }; });
      var last = cur.exercises[cur.exercises.length - 1];
      if (last && norm(last.name) === norm(name)) last.sets = last.sets.concat(sets);
      else cur.exercises.push({ name: name, sets: sets });
    });
    return sessions.filter(function (x) { return x.exercises.length; });
  }

  async function trainingHistory(ctx, args) {
    var days = E.num(args && args.days) || 28;
    var end = localDate(ctx.now ? ctx.now() : new Date());
    var start = addDays(end, -(days - 1));
    var list = (await ctx.repo.list('workouts')).filter(function (w) { return w.date >= start && w.date <= end; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var best = {}, e1 = {};
    list.forEach(function (w) {
      (w.exercises || []).forEach(function (e) {
        var top = (e.sets || []).map(function (s) { return E.e1rm(s.weightKg, s.reps); }).filter(function (x) { return x; });
        if (top.length) (e1[e.name] = e1[e.name] || []).push({ date: w.date, e1rm: E.round(Math.max.apply(null, top), 1) });
      });
    });
    list.forEach(function (w) {
      (w.exercises || []).forEach(function (e) {
        (e.sets || []).forEach(function (s) {
          if (s.weightKg === null || s.reps === null) return;
          var b = best[e.name];
          if (!b || s.weightKg > b.weightKg || (s.weightKg === b.weightKg && s.reps > b.reps)) best[e.name] = { weightKg: s.weightKg, reps: s.reps, date: w.date };
        });
      });
    });
    var plans = await ctx.repo.list('plans');
    return {
      from: start, to: end,
      sessions: list.map(function (w) {
        return { date: w.date, type: w.type, title: w.title, planned: w.planned, cardio: w.cardio, exercises: (w.exercises || []).map(function (e) { return { name: e.name, sets: e.sets }; }) };
      }),
      countByWeek: countByWeek(list.filter(function (w) { return !w.planned; })),
      bestSets: best, e1rmTrend: e1,
      activePlan: (plans.find(function (p) { return p.active; }) || null)
    };
  }
  /* Siste registrerte arbeidssett for en øvelse. */
  async function lastSetsFor(ctx, name) {
    var list = (await ctx.repo.list('workouts')).filter(function (w) { return !w.planned; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    var n = exKey(name);
    for (var i = 0; i < list.length; i++) {
      var ex = (list[i].exercises || []).find(function (e) { return exKey(e.name) === n; });
      if (ex && (ex.sets || []).length) return { date: list[i].date, sets: ex.sets };
    }
    return null;
  }
  function isoWeek(dateStr) {
    var d = new Date(dateStr + 'T12:00:00');
    var day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day + 3);
    var first = new Date(d.getFullYear(), 0, 4);
    return d.getFullYear() + '-U' + String(1 + Math.round(((d - first) / 86400000 - 3 + ((first.getDay() + 6) % 7)) / 7)).padStart(2, '0');
  }
  function countByWeek(list) {
    var out = {};
    list.forEach(function (w) { var k = isoWeek(w.date); out[k] = out[k] || { styrke: 0, kondisjon: 0, annet: 0 }; out[k][w.type] = (out[k][w.type] || 0) + 1; });
    return out;
  }

  async function savePlan(ctx, args) {
    var t = nowIso(ctx);
    var plan = {
      id: args.id || uid('p'), name: String(args.name || 'Treningsplan'), goal: args.goal || '', active: args.active !== false,
      sessionsPerWeek: E.num(args.sessions_per_week),
      days: (args.days || []).map(function (d) {
        return { name: String(d.name || ''), focus: d.focus || '', exercises: (d.exercises || []).map(function (e) { return { name: String(e.name || ''), sets: E.num(e.sets), reps: String(e.reps || ''), rir: e.rir !== undefined ? String(e.rir) : '', notes: e.notes || '' }; }) };
      }),
      cardio: args.cardio || '', notes: args.notes || '', createdAt: t, updatedAt: t
    };
    if (plan.active) {
      var plans = await ctx.repo.list('plans');
      for (var i = 0; i < plans.length; i++) if (plans[i].active && plans[i].id !== plan.id) { plans[i].active = false; await ctx.repo.set('plans/' + plans[i].id, plans[i]); }
    }
    await ctx.repo.set('plans/' + plan.id, plan);
    await logChange(ctx, 'treningsplan', plan.name);
    return plan;
  }

  /* Daglige helsetall fra klokke (Garmin). Brukes til visning og coaching, ikke til å justere kalorimålet. */
  var DAILY_FIELDS = ['steps', 'restingHr', 'sleepSeconds', 'sleepScore', 'hrv', 'bodyBatteryHigh', 'bodyBatteryLow', 'stressAvg', 'activeKcal', 'totalKcal', 'restingKcal', 'intensityMinutes'];
  async function saveDailyMetrics(ctx, args) {
    var date = args.date;
    if (!isDate(date)) throw new Error('Ugyldig dato: ' + date);
    var doc = (await ctx.repo.get('garmin/' + date)) || { date: date };
    var changed = [];
    DAILY_FIELDS.forEach(function (k) {
      if (args[k] === undefined || args[k] === null) return;
      var v = E.num(args[k]);
      if (v === null || v < 0) throw new Error('Ugyldig verdi for ' + k);
      if (k === 'restingHr' && (v < 25 || v > 130)) throw new Error('Urimelig hvilepuls: ' + v);
      if (k === 'sleepSeconds' && v > 86400) throw new Error('Urimelig søvnlengde.');
      doc[k] = v; changed.push(k);
    });
    doc.source = 'garmin'; doc.updatedAt = nowIso(ctx);
    await ctx.repo.set('garmin/' + date, doc);
    return { doc: doc, changed: changed };
  }

  /* ---------- Mål og dagsform ---------- */
  async function logMeasurement(ctx, args) {
    var date = args.date || localDate(ctx.now ? ctx.now() : new Date());
    if (!isDate(date)) throw new Error('Ugyldig dato.');
    var waist = E.num(args.waist_cm);
    if (waist === null || waist < 40 || waist > 200) throw new Error('Ugyldig midjemål: ' + args.waist_cm);
    var doc = { date: date, waistCm: waist, note: args.note || '', updatedAt: nowIso(ctx) };
    await ctx.repo.set('measures/' + date, doc);
    await logChange(ctx, 'midjemål', date + ': ' + waist + ' cm');
    return doc;
  }
  async function logCheckin(ctx, args) {
    var date = args.date || localDate(ctx.now ? ctx.now() : new Date());
    if (!isDate(date)) throw new Error('Ugyldig dato.');
    var c = {};
    ['hunger', 'energy', 'performance', 'sleepQuality'].forEach(function (k) {
      if (args[k] === undefined || args[k] === null) return;
      var v = E.num(args[k]);
      if (v === null || v < 1 || v > 5) throw new Error('Dagsform må være 1–5 (' + k + ').');
      c[k] = v;
    });
    if (args.note) c.note = String(args.note).slice(0, 300);
    if (!Object.keys(c).length) throw new Error('Ingen dagsform-verdier oppgitt.');
    var day = await getDay(ctx, date);
    day.date = date; day.checkin = Object.assign({}, day.checkin || {}, c, { updatedAt: nowIso(ctx) });
    await ctx.repo.set('days/' + date, day);
    return day.checkin;
  }

  /* Samler grunnlaget for energiberegningen fra reelle data, med profilen som reserve. */
  async function energyInputs(ctx, profile) {
    var p = profile || (await ctx.repo.get('meta/profile')) || {};
    var end = localDate(ctx.now ? ctx.now() : new Date());
    var weights = (await ctx.repo.list('weights')).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var recentW = weights.filter(function (w) { return w.date >= addDays(end, -10); });
    var kg = recentW.length ? recentW.reduce(function (s, w) { return s + w.kg; }, 0) / recentW.length : E.num(p.weightKg);
    var garmin = (await ctx.repo.list('garmin')).filter(function (g) { return g.date >= addDays(end, -13) && g.date < end && E.num(g.steps) !== null; });
    var steps = garmin.length >= 5 ? { avg: garmin.reduce(function (s, g) { return s + g.steps; }, 0) / garmin.length, source: 'klokke' } : (E.num(p.avgSteps) !== null ? { avg: E.num(p.avgSteps), source: 'oppgitt' } : null);
    var workouts = (await ctx.repo.list('workouts')).filter(function (w) { return !w.planned; });
    var first = workouts.reduce(function (m, w) { return !m || w.date < m ? w.date : m; }, null);
    var start = addDays(end, -27);
    var useLogged = first && first <= addDays(end, -13);
    var strength = { sessionsPerWeek: E.num(p.strengthSessions), minutes: E.num(p.strengthMinutes) || 60, source: E.num(p.strengthSessions) !== null ? 'oppgitt' : null };
    var cardio = { minutesPerWeek: E.num(p.cardioMinutes), intensity: p.cardioIntensity || 'moderat', walking: /mølle|gå|walk|tredemølle/i.test(p.cardioType || 'tredemølle'), source: E.num(p.cardioMinutes) !== null ? 'oppgitt' : null };
    if (useLogged) {
      var span = Math.min(28, (Date.parse(end) - Date.parse(first > start ? first : start)) / 86400000 + 1);
      var weeks = span / 7;
      var rec = workouts.filter(function (w) { return w.date >= start && w.date <= end; });
      var st = rec.filter(function (w) { return w.type === 'styrke'; });
      var cd = rec.filter(function (w) { return w.type === 'kondisjon'; });
      var stMin = st.map(function (w) { return E.num(w.durationMin); }).filter(function (x) { return x !== null && x > 0; });
      strength = { sessionsPerWeek: st.length / weeks, minutes: stMin.length ? stMin.reduce(function (a, b) { return a + b; }, 0) / stMin.length : strength.minutes, source: 'registrert siste ' + Math.round(span) + ' dager' };
      var cmin = cd.reduce(function (s, w) { return s + ((w.cardio && w.cardio.durationMin) || 0); }, 0);
      var rpes = cd.map(function (w) { return w.cardio && w.cardio.rpe; }).filter(function (x) { return typeof x === 'number'; });
      var avgRpe = rpes.length ? rpes.reduce(function (a, b) { return a + b; }, 0) / rpes.length : null;
      cardio = { minutesPerWeek: cmin / weeks, intensity: avgRpe === null ? (p.cardioIntensity || 'moderat') : avgRpe <= 4 ? 'lett' : avgRpe <= 7 ? 'moderat' : 'hard', walking: cd.every(function (w) { return /mølle|gå|walk|treadmill/i.test(((w.cardio && w.cardio.modality) || '') + ' ' + w.title); }), source: 'registrert siste ' + Math.round(span) + ' dager' };
    }
    return { sex: p.sex, age: E.num(p.age), heightCm: E.num(p.heightCm), weightKg: kg, weightSource: recentW.length ? 'snitt av ' + recentW.length + ' veiinger' : 'profil', job: p.jobActivity || null, steps: steps, strength: strength, cardio: cardio, goal: p.goalType || 'fettreduksjon', pace: p.pace || 'moderat' };
  }

  async function targetPlan(ctx) {
    var profile = (await ctx.repo.get('meta/profile')) || {};
    var inp = await energyInputs(ctx, profile);
    var missing = [];
    if (!inp.age) missing.push('alder'); if (!inp.heightCm) missing.push('høyde'); if (!inp.weightKg) missing.push('vekt');
    if (missing.length) return { ok: false, missing: missing };
    var energy = E.estimateEnergy(inp);
    var trainDays = (inp.strength.sessionsPerWeek || 0) + ((inp.cardio.minutesPerWeek || 0) > 0 ? Math.min(7, (inp.cardio.minutesPerWeek || 0) / 30) : 0);
    var targets = E.computeTargets(energy, { weightKg: inp.weightKg, goal: inp.goal, pace: inp.pace, sex: inp.sex, trainingDaysPerWeek: Math.min(7, trainDays) });
    var end = localDate(ctx.now ? ctx.now() : new Date());
    var days = (await ctx.repo.list('days')).filter(function (d) { return d.date >= addDays(end, -27) && d.date < end; });
    var dt = days.map(function (d) { var x = E.dayTotals(d); return { date: d.date, kcal: x.values.kcal, complete: !!d.complete || x.items >= 3 }; });
    var weights = (await ctx.repo.list('weights')).filter(function (w) { return w.date >= addDays(end, -27); }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var adaptive = E.adaptiveTdee(dt, weights, { minDays: 14 });
    var ck = days.map(function (d) { return d.checkin; }).filter(Boolean);
    function avgK(k) { var v = ck.map(function (c) { return c[k]; }).filter(function (x) { return typeof x === 'number'; }); return v.length ? v.reduce(function (a, b) { return a + b; }, 0) / v.length : null; }
    /* Restitusjon fra Garmin (søvnscore, Body Battery) brukes når brukeren ikke har rapportert dagsform selv. */
    var g = (await ctx.repo.list('garmin')).filter(function (x) { return x.date >= addDays(end, -13); });
    function avgG(k) { var v = g.map(function (x) { return x[k]; }).filter(function (x) { return typeof x === 'number'; }); return v.length >= 4 ? v.reduce(function (a, b) { return a + b; }, 0) / v.length : null; }
    var sleepScore = avgG('sleepScore'), bb = avgG('bodyBatteryHigh');
    var garminEnergy = sleepScore === null && bb === null ? null : ((sleepScore !== null && sleepScore < 60) || (bb !== null && bb < 50) ? 2 : 4);
    var current = { kcal: E.num(profile.kcalTarget), protein: E.num(profile.proteinTarget) };
    var rec = E.recommendAdjustment({ adaptive: adaptive, targetKcal: current.kcal || targets.kcal, targetKgPerWeek: targets.kgPerWeek, checkin: { energy: avgK('energy') !== null ? avgK('energy') : garminEnergy, performance: avgK('performance'), hunger: avgK('hunger') } });
    return { ok: true, inputs: inp, energy: energy, targets: targets, current: current, adaptive: adaptive, recommendation: rec, recovery: { sleepScore: sleepScore, bodyBatteryHigh: bb }, external: { bmr: E.num(profile.bmrExternal), tdee: E.num(profile.tdeeExternal) } };
  }

  async function applyTargets(ctx, t, meta) {
    var p = (await ctx.repo.get('meta/profile')) || {};
    var before = { kcal: p.kcalTarget, protein: p.proteinTarget };
    ['kcal', 'protein', 'fat', 'carbs', 'fiber'].forEach(function (k) {
      var v = E.num(t[k]);
      if (v === null || v <= 0) throw new Error('Mangler mål for ' + k);
    });
    if (t.kcal < 1200 || t.kcal > 6000) throw new Error('Kalorimål utenfor rimelig område.');
    p.kcalTarget = t.kcal; p.proteinTarget = t.protein; p.fatTarget = t.fat; p.carbTarget = t.carbs; p.fiberTarget = t.fiber;
    if (E.num(t.waterMl)) p.waterTarget = t.waterMl;
    p.targetsMeta = Object.assign({ appliedAt: nowIso(ctx) }, meta || {});
    p.targetHistory = (p.targetHistory || []).concat([{ at: nowIso(ctx), from: before, to: { kcal: t.kcal, protein: t.protein }, reason: (meta && meta.reason) || '' }]).slice(-30);
    p.updatedAt = nowIso(ctx);
    await ctx.repo.set('meta/profile', p);
    await logChange(ctx, 'mål', 'kcal ' + before.kcal + ' → ' + t.kcal + ', protein ' + before.protein + ' → ' + t.protein);
    return p;
  }

  /* ---------- Profil ---------- */
  var PROFILE_FIELDS = { age: 'num', sex: 'str', heightCm: 'num', weightKg: 'num', goal: 'str', kcalTarget: 'num', proteinTarget: 'num', activity: 'str', name: 'str',
    jobActivity: 'str', avgSteps: 'num', strengthSessions: 'num', strengthMinutes: 'num', cardioMinutes: 'num', cardioIntensity: 'str', cardioType: 'str', goalType: 'str', pace: 'str', onboarded: 'num' };
  var ENUMS = { jobActivity: ['sittende', 'stående', 'fysisk'], cardioIntensity: ['lett', 'moderat', 'hard'], goalType: ['fettreduksjon', 'vedlikehold', 'muskelvekst'], pace: ['rolig', 'moderat', 'raskere'], sex: ['mann', 'kvinne'] };
  async function updateProfile(ctx, fields) {
    var p = (await ctx.repo.get('meta/profile')) || {};
    var changed = [];
    Object.keys(fields || {}).forEach(function (k) {
      if (!PROFILE_FIELDS[k]) return;
      var v = PROFILE_FIELDS[k] === 'num' ? E.num(fields[k]) : String(fields[k]);
      if (v === null) throw new Error('Ugyldig verdi for ' + k);
      if (ENUMS[k] && ENUMS[k].indexOf(v) < 0) throw new Error(k + ' må være ' + ENUMS[k].join(', '));
      if (k === 'kcalTarget' && (v < 1200 || v > 6000)) throw new Error('Kalorimål må være mellom 1 200 og 6 000 kcal.');
      if (k === 'proteinTarget' && (v < 40 || v > 400)) throw new Error('Proteinmål virker urimelig.');
      changed.push(k + ': ' + (p[k] === undefined ? '–' : p[k]) + ' → ' + v);
      p[k] = v;
    });
    if (fields && fields.addNote) { p.notes = (p.notes || []).concat([String(fields.addNote)]).slice(-40); changed.push('notat lagt til'); }
    p.updatedAt = nowIso(ctx);
    await ctx.repo.set('meta/profile', p);
    if (changed.length) await logChange(ctx, 'profil', changed.join('; '));
    return { profile: p, changed: changed };
  }

  /* ---------- Endringslogg ---------- */
  async function logChange(ctx, action, summary) {
    if (ctx.skipChangeLog) return;
    var d = localDate(ctx.now ? ctx.now() : new Date());
    var doc = (await ctx.repo.get('changes/' + d)) || { date: d, entries: [] };
    doc.entries = (doc.entries || []).concat([{ ts: nowIso(ctx), action: action, summary: String(summary).slice(0, 300) }]).slice(-300);
    await ctx.repo.set('changes/' + d, doc);
  }

  var api = {
    MEAL_TYPES: MEAL_TYPES, STATUS_RANK: STATUS_RANK, STATUS_LABEL: STATUS_LABEL,
    uid: uid, slug: slug, norm: norm, exKey: exKey, localDate: localDate, addDays: addDays, isDate: isDate, mealType: mealType,
    findProducts: findProducts, cleanProductInput: cleanProductInput, saveProduct: saveProduct,
    snapshotItem: snapshotItem, findRecipe: findRecipe, recipeItems: recipeItems, previewRecipe: previewRecipe,
    getDay: getDay, mealTotals: mealTotals, compactMeal: compactMeal, logMeal: logMeal, updateMeal: updateMeal, deleteMeal: deleteMeal, restoreMeal: restoreMeal,
    saveRecipe: saveRecipe, saveRecipeVariant: saveRecipeVariant,
    daySummary: daySummary, weekSummary: weekSummary, logWeight: logWeight, logWorkout: logWorkout, trainingHistory: trainingHistory, savePlan: savePlan,
    updateProfile: updateProfile, logChange: logChange, logMeasurement: logMeasurement, logCheckin: logCheckin, energyInputs: energyInputs, targetPlan: targetPlan, applyTargets: applyTargets, lastSetsFor: lastSetsFor, logStrength: logStrength, parseWorkoutNotes: parseWorkoutNotes, parseFoodText: parseFoodText, isoWeek: isoWeek, saveDailyMetrics: saveDailyMetrics, DAILY_FIELDS: DAILY_FIELDS
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Core = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

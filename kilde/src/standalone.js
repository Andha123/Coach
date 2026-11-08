/* Coach som egen app: gir appen det samme «claude.use()»-grensesnittet som i Claude, men med Supabase som database
 * og innlogging. Ingen AI: «sample» og «mcp» finnes ikke her, så appen bruker sitt eget skrivefelt og egne oppslag. */
(function () {
  'use strict';
  var CFG = window.COACH_CONFIG || {};
  var sb = window.supabase.createClient(CFG.url, CFG.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'coach-auth', storage: window.localStorage } });
  window.coachSupabase = sb;

  /* ---------- Dokumentlager over tabellen docs (col, id, data) ---------- */
  var cache = {};       // col -> Map(id -> data)
  var loaded = {};      // col -> Promise
  var listeners = {};   // col -> [fn]
  var docListeners = {}; // path -> [fn]
  var userId = null;

  function clone(o) { return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); }
  function mapOf(col) { return cache[col] || (cache[col] = new Map()); }
  function err(e) { var x = new Error((e && e.message) || 'Databasefeil'); x.code = e && e.code === '42501' ? 'not_granted' : 'unknown'; return x; }

  async function fetchCol(col) {
    var all = [], from = 0, page = 1000;
    for (;;) {
      var r = await sb.from('docs').select('id,data').eq('col', col).range(from, from + page - 1);
      if (r.error) throw err(r.error);
      all = all.concat(r.data || []);
      if (!r.data || r.data.length < page) break;
      from += page;
    }
    var m = new Map(); all.forEach(function (row) { m.set(row.id, row.data); });
    cache[col] = m;
    return m;
  }
  function ensure(col) { return loaded[col] || (loaded[col] = fetchCol(col).catch(function (e) { delete loaded[col]; throw e; })); }
  function snapDoc(col, id) {
    var m = mapOf(col), has = m.has(id);
    return { id: id, exists: has, data: function () { return has ? clone(m.get(id)) : undefined; }, metadata: { fromCache: false } };
  }
  function notify(col, id) {
    (listeners[col] || []).forEach(function (f) { try { f(); } catch (e) { console.error(e); } });
    (docListeners[col + '/' + id] || []).forEach(function (f) { try { f(); } catch (e) { console.error(e); } });
  }
  function notifyAll(col) {
    (listeners[col] || []).forEach(function (f) { try { f(); } catch (e) { console.error(e); } });
    Object.keys(docListeners).forEach(function (p) { if (p.indexOf(col + '/') === 0) docListeners[p].forEach(function (f) { try { f(); } catch (e) {} }); });
  }

  function query(col, ord, lim) {
    function build() {
      var docs = Array.from(mapOf(col).keys()).map(function (id) { return snapDoc(col, id); });
      if (ord) docs.sort(function (a, b) { var x = a.data()[ord.f], y = b.data()[ord.f]; return (x < y ? -1 : x > y ? 1 : 0) * (ord.d === 'desc' ? -1 : 1); });
      if (lim) docs = docs.slice(0, lim);
      return { docs: docs, size: docs.length, empty: !docs.length, docChanges: function () { return []; }, metadata: { fromCache: false } };
    }
    return {
      orderBy: function (f, d) { return query(col, { f: f, d: d || 'asc' }, lim); },
      limit: function (n) { return query(col, ord, n); },
      where: function () { return query(col, ord, lim); },
      doc: function (id) { return doc(col + '/' + id); },
      get: async function () { await fetchCol(col); loaded[col] = Promise.resolve(cache[col]); return build(); },
      onSnapshot: function (next, onErr) {
        var f = function () { next(build()); };
        (listeners[col] = listeners[col] || []).push(f);
        ensure(col).then(f, function (e) { if (onErr) onErr(err(e)); });
        return function () { listeners[col] = (listeners[col] || []).filter(function (x) { return x !== f; }); };
      }
    };
  }
  function doc(path) {
    var parts = path.split('/'), col = parts[0], id = parts.slice(1).join('/');
    return {
      get: async function () {
        var r = await sb.from('docs').select('data').eq('col', col).eq('id', id).maybeSingle();
        if (r.error) throw err(r.error);
        if (r.data) mapOf(col).set(id, r.data.data); else mapOf(col).delete(id);
        return snapDoc(col, id);
      },
      set: async function (obj) {
        var data = clone(obj);
        var r = await sb.from('docs').upsert({ user_id: userId, col: col, id: id, data: data, updated_at: new Date().toISOString() }, { onConflict: 'user_id,col,id' });
        if (r.error) throw err(r.error);
        mapOf(col).set(id, data); notify(col, id);
      },
      delete: async function () {
        var r = await sb.from('docs').delete().eq('col', col).eq('id', id);
        if (r.error) throw err(r.error);
        mapOf(col).delete(id); notify(col, id);
      },
      onSnapshot: function (next, onErr) {
        var f = function () { next(snapDoc(col, id)); };
        (docListeners[path] = docListeners[path] || []).push(f);
        ensure(col).then(f, function (e) { if (onErr) onErr(err(e)); });
        return function () { docListeners[path] = (docListeners[path] || []).filter(function (x) { return x !== f; }); };
      }
    };
  }
  var db = { doc: doc, collection: function (c) { return query(c); } };

  /* Endringer fra andre steder (Garmin-synken, en annen enhet): hent samlingen på nytt. */
  var pending = {};
  function refreshCol(col) {
    if (pending[col]) return; pending[col] = setTimeout(function () {
      delete pending[col];
      if (!listeners[col] && !Object.keys(docListeners).some(function (p) { return p.indexOf(col + '/') === 0; })) return;
      fetchCol(col).then(function () { notifyAll(col); }, function () {});
    }, 300);
  }
  function startRealtime() {
    try {
      sb.channel('docs-' + userId).on('postgres_changes', { event: '*', schema: 'public', table: 'docs', filter: 'user_id=eq.' + userId }, function (p) {
        var col = (p.new && p.new.col) || (p.old && p.old.col); if (col) refreshCol(col); else Object.keys(listeners).forEach(refreshCol);
      }).subscribe();
    } catch (e) { /* sanntid er bonus */ }
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') Object.keys(cache).forEach(refreshCol); });
  }

  /* ---------- Innlogging ---------- */
  var dbReady, resolveDb;
  dbReady = new Promise(function (r) { resolveDb = r; });

  function loginHtml(mode, msg) {
    var su = mode === 'signup';
    return '<div class="authwrap"><div class="authcard">' +
      '<div class="authlogo">' + (window.COACH_LOGO_SVG || '') + '</div>' +
      '<h1>Coach</h1><p class="authsub">' + (su ? 'Lag bruker. Dataene dine er bare dine.' : 'Logg inn for å fortsette.') + '</p>' +
      '<form id="authForm" novalidate><input class="input" id="authEmail" type="email" autocomplete="email" placeholder="E-post" required>' +
      '<input class="input" id="authPw" type="password" autocomplete="' + (su ? 'new-password' : 'current-password') + '" placeholder="Passord' + (su ? ' (minst 8 tegn)' : '') + '" required>' +
      '<div id="authMsg">' + (msg || '') + '</div>' +
      '<button class="btn primary" type="submit">' + (su ? 'Lag bruker' : 'Logg inn') + '</button></form>' +
      '<button class="btn ghost" id="authSwitch" type="button">' + (su ? 'Har du bruker? Logg inn' : 'Ny her? Lag bruker') + '</button>' +
      (su ? '' : '<button class="btn ghost small" id="authForgot" type="button">Glemt passord</button>') +
      '</div></div>';
  }
  function showLogin(mode, msg) {
    var host = document.getElementById('authHost');
    if (!host) { host = document.createElement('div'); host.id = 'authHost'; document.body.appendChild(host); }
    host.innerHTML = loginHtml(mode, msg);
    var form = document.getElementById('authForm');
    form.onsubmit = async function (e) {
      e.preventDefault();
      var email = document.getElementById('authEmail').value.trim(), pw = document.getElementById('authPw').value;
      var box = document.getElementById('authMsg'), btn = form.querySelector('button[type=submit]');
      if (!email || !pw) { box.innerHTML = '<div class="notice bad">Fyll inn e-post og passord.</div>'; return; }
      btn.disabled = true;
      try {
        if (mode === 'signup') {
          if (pw.length < 8) throw new Error('Passordet må ha minst 8 tegn.');
          var s = await sb.auth.signUp({ email: email, password: pw, options: { emailRedirectTo: location.origin + location.pathname } });
          if (s.error) throw s.error;
          if (!s.data.session) { showLogin('login', '<div class="notice info">Sjekk e-posten din og trykk på bekreftelseslenken. Logg så inn her.</div>'); return; }
        } else {
          var l = await sb.auth.signInWithPassword({ email: email, password: pw });
          if (l.error) throw l.error;
        }
      } catch (er) {
        var m = String(er.message || er);
        if (/Invalid login/i.test(m)) m = 'Feil e-post eller passord.';
        if (/not confirmed/i.test(m)) m = 'E-posten er ikke bekreftet ennå. Sjekk innboksen.';
        if (/already registered/i.test(m)) m = 'Det finnes allerede en bruker med denne e-posten.';
        box.innerHTML = '<div class="notice bad">' + m.replace(/</g, '&lt;') + '</div>';
        btn.disabled = false;
      }
    };
    document.getElementById('authSwitch').onclick = function () { showLogin(mode === 'signup' ? 'login' : 'signup'); };
    var fg = document.getElementById('authForgot');
    if (fg) fg.onclick = async function () {
      var email = document.getElementById('authEmail').value.trim(), box = document.getElementById('authMsg');
      if (!email) { box.innerHTML = '<div class="notice bad">Skriv inn e-posten din først.</div>'; return; }
      var r = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
      box.innerHTML = r.error ? '<div class="notice bad">' + r.error.message + '</div>' : '<div class="notice info">Sjekk e-posten for lenke til nytt passord.</div>';
    };
  }
  function hideLogin() { var h = document.getElementById('authHost'); if (h) h.remove(); }

  var started = false;
  function onSession(session) {
    if (!session) { showLogin('login'); return; }
    hideLogin();
    if (started) { if (session.user.id !== userId) location.reload(); return; }
    started = true; userId = session.user.id; window.coachEmail = session.user.email || '';
    startRealtime();
    resolveDb(db);
  }
  sb.auth.onAuthStateChange(function (ev, session) {
    if (ev === 'PASSWORD_RECOVERY') {
      var pw = prompt('Nytt passord (minst 8 tegn):');
      if (pw && pw.length >= 8) sb.auth.updateUser({ password: pw }).then(function (r) { alert(r.error ? r.error.message : 'Passordet er endret.'); });
    }
    if (ev === 'SIGNED_OUT') { location.reload(); return; }
    onSession(session);
  });
  sb.auth.getSession().then(function (r) { onSession(r.data && r.data.session); });

  /* ---------- claude.use()-grensesnittet ---------- */
  var downloads = {
    save: async function (o) {
      var blob = o.data instanceof Blob ? o.data : new Blob([typeof o.data === 'string' ? o.data : JSON.stringify(o.data)], { type: 'application/json' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = o.filename || 'coach.json';
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      return { ok: true };
    }
  };
  var user = {
    isOwner: function () { return true; }, canEdit: function () { return true; }, can: function () { return true; },
    id: async function () { return userId; }, me: async function () { return { id: userId }; }, profiles: async function () { return {}; }
  };
  window.COACH_STANDALONE = true;
  window.coachSignOut = function () { return sb.auth.signOut(); };
  window.claude = {
    use: function (name) {
      if (name === 'db') return dbReady;
      if (name === 'user') return dbReady.then(function () { return user; });
      if (name === 'downloads') return Promise.resolve(downloads);
      return Promise.resolve(null);
    }
  };
})();

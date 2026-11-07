/* SOTG Premier League Season Predictor — vanilla JS, no build step. */
(function () {
  'use strict';
  const D = window.PL_DATA;
  const CFG = window.PL_CONFIG;
  const app = document.getElementById('app');
  const COMP = (CFG && CFG.comp) || 'pl';
  const LS_ME = `sotg-${COMP}-me`;       // { season, name, token }
  const LS_DRAFT = `sotg-${COMP}-draft`; // { season, name, answers }
  const SS_PIN = 'sotg-pl-pin';

  // ── Helpers ────────────────────────────────────────────────────────────
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const store = {
    get(k, d = null) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
    del(k) { try { localStorage.removeItem(k); } catch {} },
  };
  function toast(msg, err) {
    const t = h(`<div class="toast ${err ? 'err' : ''}">${esc(msg)}</div>`);
    document.body.appendChild(t); setTimeout(() => t.remove(), 3500);
  }
  // In-page dialogs (browser confirm/prompt are unreliable on mobile and in embedded views)
  function dialog(msg, { okText = 'OK', input = null } = {}) {
    return new Promise((resolve) => {
      const bg = h(`<div class="sheet-bg"><div class="sheet" role="dialog" style="padding:20px">
        <p style="margin:0 0 14px;font-size:17px">${esc(msg)}</p>
        ${input !== null ? '<input class="input" maxlength="40" />' : ''}
        <div class="row mt" style="justify-content:flex-end"><button class="btn btn-ghost btn-sm" data-no>Cancel</button><button class="btn btn-primary btn-sm" data-yes>${esc(okText)}</button></div></div></div>`);
      const inp = bg.querySelector('input'); if (inp) inp.value = input;
      const done = (v) => { bg.remove(); resolve(v); };
      bg.querySelector('[data-no]').onclick = () => done(input !== null ? null : false);
      bg.querySelector('[data-yes]').onclick = () => done(input !== null ? inp.value : true);
      bg.addEventListener('click', (e) => { if (e.target === bg) done(input !== null ? null : false); });
      document.body.appendChild(bg); if (inp) inp.focus();
    });
  }
  const askConfirm = (msg, okText = 'Yes') => dialog(msg, { okText });
  const askText = (msg, value = '') => dialog(msg, { okText: 'Save', input: value });

  function token() {
    const a = new Uint8Array(24); crypto.getRandomValues(a);
    return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  const norm = (s) => String(s ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  let rpc = async function (fn, args = {}) {
    const headers = { 'Content-Type': 'application/json', apikey: CFG.supabaseKey };
    if (!CFG.supabaseKey.startsWith('sb_')) headers.Authorization = 'Bearer ' + CFG.supabaseKey;
    const res = await fetch(`${CFG.supabaseUrl}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(args) });
    const text = await res.text();
    const body = text ? JSON.parse(text) : null;
    if (!res.ok) throw new Error((body && (body.message || body.hint)) || `Request failed (${res.status})`);
    return body;
  }

  // ── Option pools ───────────────────────────────────────────────────────
  const PL = D.teams.map((t) => ({ value: t, label: t }));
  const toOpts = (arr) => arr.map((t) => ({ value: t, label: t }));
  const POS_NAME = { GK: 'Goalkeeper', DEF: 'Defender', MID: 'Midfielder', FWD: 'Forward' };
  // players: [web_name, full_name, team, pos, dob]
  const seen = {};
  const PLAYERS = D.players.map(([web, full, team, pos, dob]) => {
    let key = full || web;
    if (seen[key]) key = `${key} (${team})`;
    seen[key] = true;
    return { value: key, label: web, sub: `${team} · ${pos}`, team, pos, dob, search: norm(`${web} ${full} ${team}`), group: team };
  });
  const PLAYER_BY = Object.fromEntries(PLAYERS.map((p) => [p.value, p]));
  const playersWhere = (fn) => PLAYERS.filter(fn);
  const POOLS = {
    teams: PL,
    teamsOrOther: PL,
    carabao: toOpts(D.carabao),
    ucl: toOpts(D.ucl), uel: toOpts(D.uel), uecl: toOpts(D.uecl),
    promoted: toOpts(['Coventry City', 'Hull City', 'Ipswich Town']),
    all: PLAYERS,
    outfield: playersWhere((p) => p.pos !== 'GK'),
    gk: playersWhere((p) => p.pos === 'GK'),
    def: playersWhere((p) => p.pos === 'DEF'),
    mid: playersWhere((p) => p.pos === 'MID'),
    att: playersWhere((p) => p.pos === 'MID' || p.pos === 'FWD'),
    // PFA Young Player: 21 or under at the start of the season
    young: playersWhere((p) => p.dob && p.dob >= '2004-08-01'),
  };

  // ── Questions ──────────────────────────────────────────────────────────
  const T = (id, label, extra = {}) => ({ id, label, type: 'team', pool: 'teams', score: 'exact', pts: 5, ...extra });
  const P = (id, label, extra = {}) => ({ id, label, type: 'player', pool: 'all', score: 'exact', pts: 5, ...extra });
  const SECTIONS = [
    { id: 'table', title: 'The Table', short: 'Table',
      blurb: 'Call the top seven in order. Once a team is picked it drops out of the other slots.',
      qs: [
        T('p1', 'Premier League Champions', { score: 'table', set: 'table', pts: 10, group: 'league', rank: 1 }),
        T('p2', '2nd place', { score: 'table', set: 'table', pts: 3, group: 'league', rank: 2 }),
        T('p3', '3rd place', { score: 'table', set: 'table', pts: 3, group: 'league', rank: 3 }),
        T('p4', '4th place', { score: 'table', set: 'table', pts: 3, group: 'league', rank: 4 }),
        T('p5', '5th place', { score: 'table', set: 'table', pts: 3, group: 'league', rank: 5 }),
        T('p6', '6th place', { score: 'table', set: 'table', pts: 3, group: 'league', rank: 6 }),
        T('p7', '7th place', { score: 'table', set: 'table', pts: 3, group: 'league', rank: 7 }),
      ] },
    { id: 'rel', title: 'Relegation', short: 'Relegation',
      blurb: 'Which three are going down? Order doesn’t matter.',
      qs: [1, 2, 3].map((n) => T('r' + n, 'Relegated #' + n, { score: 'set', set: 'rel', pts: 3, group: 'league' })) },
    { id: 'cups', title: 'The Cups', short: 'Cups',
      blurb: 'Domestic and European silverware. Carabao Cup is the eight teams left in the quarter-finals.',
      qs: [
        T('fa', 'FA Cup winners', { pool: 'teamsOrOther', other: true, hint: 'Pick a Premier League side — or type any other club for a dark horse.' }),
        T('lc', 'Carabao Cup winners', { pool: 'carabao' }),
        T('ucl', 'Champions League winners', { pool: 'ucl' }),
        T('uel', 'Europa League winners', { pool: 'uel' }),
        T('uecl', 'Conference League winners', { pool: 'uecl' }),
      ] },
    { id: 'boot', title: 'Golden Boot & Co', short: 'Stats',
      qs: [
        P('boot', 'Golden Boot — top scorer', { pool: 'outfield' }),
        P('assist', 'Playmaker — most assists', { pool: 'outfield' }),
        P('glove', 'Golden Glove — most clean sheets', { pool: 'gk', pts: 3 }),
      ] },
    { id: 'tots', title: 'Team of the Season', short: 'TOTS', layout: 'pitch',
      blurb: 'Your 4-3-3. Scored against the PFA Team of the Year — 2 pts for every player who makes it, whatever slot you put them in.',
      qs: [
        ['lw', 'LW', 'att'], ['st', 'ST', 'att'], ['rw', 'RW', 'att'],
        ['cm1', 'CM', 'mid'], ['cm2', 'CM', 'mid'], ['cm3', 'CM', 'mid'],
        ['lb', 'LB', 'def'], ['cb1', 'CB', 'def'], ['cb2', 'CB', 'def'], ['rb', 'RB', 'def'],
        ['gk', 'GK', 'gk'],
      ].map(([id, pos, pool]) => P('t_' + id, pos, { pool, score: 'set', set: 'tots', pts: 2, group: 'tots', slot: pos })) },
    { id: 'awards', title: 'Awards', short: 'Awards',
      blurb: 'The end-of-season gongs. Signing / flop / worst signing are settled by the group at the end of the season.',
      qs: [
        P('pots', 'Player of the Season'),
        P('ypots', 'Young Player of the Season', { pool: 'young', hint: 'Only players 21 or under at the start of the season are listed.' }),
        T('motm', 'Manager of the Season', { pts: 3, hint: 'Pick the club whose manager wins it.' }),
        P('signing', 'Signing of the Season', { pts: 3 }),
        P('flop', 'Flop of the Season', { pts: 3, hint: 'The worst player of the season, full stop — new signing or not.' }),
        P('worst', 'Worst Signing of the Season', { pts: 3, hint: 'Transfers made for this season only — the biggest waste of money.' }),
      ] },
    { id: 'wild', title: 'Wildcards', short: 'Wildcards',
      qs: [
        T('over', 'Overachievers of the season', { pts: 3, group: 'ach' }),
        T('under', 'Underachievers of the season', { pts: 3, group: 'ach' }),
        T('sack', 'Next club to sack their manager', { pts: 3 }),
        T('promo', 'Highest-finishing promoted side', { pool: 'promoted', pts: 2 }),
      ] },
    { id: 'tb', title: 'Tiebreakers', short: 'Tiebreak',
      blurb: 'No points — these only split ties. Closest wins.',
      qs: [
        { id: 'tb_pts', label: 'How many points will the champions finish on?', type: 'number', score: 'none', min: 50, max: 114 },
        { id: 'tb_goals', label: 'How many league goals will the Golden Boot winner score?', type: 'number', score: 'none', min: 10, max: 50 },
        { id: 'hot', label: 'Your hottest take for the season', type: 'text', score: 'none', optional: true, hint: 'Optional. Gets read out in May.' },
      ] },
  ];
  const ALL_QS = SECTIONS.flatMap((s) => s.qs.map((q) => ({ ...q, section: s.id })));
  const Q_BY = Object.fromEntries(ALL_QS.map((q) => [q.id, q]));
  const MAX_PTS = ALL_QS.reduce((a, q) => a + (q.pts && q.score !== 'none' ? q.pts : 0), 0);

  function displayValue(q, v) {
    if (v === undefined || v === null || v === '') return '';
    if (q.type === 'player') { const p = PLAYER_BY[v]; return p ? `${p.label} (${p.team})` : v; }
    return String(v);
  }
  const shortValue = (q, v) => (q.type === 'player' && PLAYER_BY[v] ? PLAYER_BY[v].label : displayValue(q, v));

  // ── Preview mode: no database yet, everything lives in this browser ────
  const DEMO = !CFG.supabaseKey || CFG.supabaseKey.startsWith('__');
  if (DEMO) {
    const K = 'sotg-pl-demo-db';
    const load = () => store.get(K) || { locked: false, results: {}, entries: null };
    const saveDb = (db) => store.set(K, db);
    const pickRand = (arr, used) => { const pool = arr.filter((o) => !used.has(o.value)); const o = pool[Math.floor(Math.random() * pool.length)]; used.add(o.value); return o.value; };
    const fakeAnswers = () => {
      const a = {}; const used = {};
      for (const q of ALL_QS) {
        if (q.type === 'number') a[q.id] = String(q.id === 'tb_pts' ? 80 + Math.floor(Math.random() * 20) : 20 + Math.floor(Math.random() * 12));
        else if (q.type === 'text') a[q.id] = '';
        else { const g = q.group || q.id; used[g] ||= new Set(); a[q.id] = pickRand(POOLS[q.pool], used[g]); }
      }
      return a;
    };
    const ensureSeed = (db) => { if (!db.entries) { db.entries = ['Dami', 'Kofi', 'Marcus'].map((n, i) => ({ id: 'demo' + i, name: n, answers: fakeAnswers(), tok: 'x', created_at: new Date().toISOString(), updated_at: new Date().toISOString() })); saveDb(db); } return db; };
    rpc = async (fn, a = {}) => {
      await new Promise((r) => setTimeout(r, 120));
      const db = ensureSeed(load());
      const mine = (n, t) => db.entries.find((e) => norm(e.name) === norm(n) && e.tok === t);
      const pinOk = () => { if (!a.p_pin) throw new Error('Preview: type any PIN'); };
      switch (fn) {
        case 'pred_state': return { comp: COMP, season: '2026/27', title: 'Premier League 2026/27', is_current: true, locked: db.locked, results: db.results, count: db.entries.length, seasons: [{ season: '2026/27', title: 'Premier League 2026/27', is_current: true }] };
        case 'pred_entries_list': { const see = db.locked || (a.p_name && mine(a.p_name, a.p_token)); return db.entries.map((e) => ({ id: e.id, name: e.name, created_at: e.created_at, updated_at: e.updated_at, answers: see ? e.answers : null })); }
        case 'pred_submit':
          if (db.locked) throw new Error('Predictions are closed');
          if (db.entries.some((e) => norm(e.name) === norm(a.p_name))) throw new Error('That name has already locked in.');
          db.entries.push({ id: 'e' + Date.now(), name: a.p_name, answers: a.p_answers, tok: a.p_token, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }); saveDb(db); return { id: 'x' };
        case 'pred_admin_get': pinOk(); return { settings: { comp: COMP, season: '2026/27', title: 'Premier League 2026/27', is_current: true, locked: db.locked, results: db.results }, entries: db.entries };
        case 'pred_admin_set_lock': pinOk(); db.locked = a.p_locked; saveDb(db); return null;
        case 'pred_admin_set_results': pinOk(); db.results = a.p_results; saveDb(db); return null;
        case 'pred_admin_delete_entry': pinOk(); db.entries = db.entries.filter((e) => e.id !== a.p_id); saveDb(db); return null;
        case 'pred_admin_new_season': pinOk(); throw new Error('Preview: new seasons need the real database');
        case 'pred_admin_rename_entry': pinOk(); db.entries.find((e) => e.id === a.p_id).name = a.p_name; saveDb(db); return null;
      }
      return null;
    };
    window.addEventListener('DOMContentLoaded', () => {});
    const banner = h(`<div style="background:rgb(var(--flame));color:#fff;text-align:center;font-size:13px;padding:6px 12px">Preview mode — saved in this browser only, with 3 pretend entries. <a href="#" style="color:#fff;font-weight:700" id="demo-reset">Reset</a></div>`);
    document.body.prepend(banner);
    banner.querySelector('#demo-reset').onclick = (e) => { e.preventDefault(); store.del(K); store.del(LS_ME); store.del(LS_DRAFT); location.hash = '#home'; location.reload(); };
  }

  // ── Scoring ────────────────────────────────────────────────────────────
  function scoreEntry(ans, res) {
    const sets = {};
    for (const q of ALL_QS) if (q.set && res[q.id]) (sets[q.set] ||= new Set()).add(norm(res[q.id]));
    let pts = 0, hits = 0; const per = {};
    for (const q of ALL_QS) {
      if (q.score === 'none' || !ans[q.id]) { per[q.id] = null; continue; }
      const a = norm(ans[q.id]); let p = 0;
      if (q.score === 'exact') { if (res[q.id] && a === norm(res[q.id])) p = q.pts; else if (!res[q.id]) { per[q.id] = null; continue; } }
      else if (q.score === 'table') {
        if (!res[q.id]) { per[q.id] = null; continue; }
        if (a === norm(res[q.id])) p = q.pts; else if (sets.table && sets.table.has(a)) p = 1;
      } else if (q.score === 'set') {
        if (!sets[q.set]) { per[q.id] = null; continue; }
        if (sets[q.set].has(a)) p = q.pts;
      }
      per[q.id] = p; pts += p; if (p > 0) hits++;
    }
    const diff = (k) => (res[k] !== undefined && res[k] !== '' && ans[k] !== undefined && ans[k] !== '') ? Math.abs(Number(ans[k]) - Number(res[k])) : Infinity;
    return { pts, hits, per, tb1: diff('tb_pts'), tb2: diff('tb_goals') };
  }
  function rankEntries(entries, res) {
    return entries.map((e) => ({ ...e, s: scoreEntry(e.answers || {}, res) }))
      .sort((a, b) => b.s.pts - a.s.pts || b.s.hits - a.s.hits || a.s.tb1 - b.s.tb1 || a.s.tb2 - b.s.tb2 || a.name.localeCompare(b.name));
  }

  // ── Picker (bottom sheet with search) ──────────────────────────────────
  function openSheet({ title, options, value, disabled, allowOther, onPick }) {
    const bg = h(`<div class="sheet-bg"><div class="sheet" role="dialog" aria-label="${esc(title)}">
      <div class="sheet-head"><div class="t"><span>${esc(title)}</span><button class="icon-btn" data-x aria-label="Close">✕</button></div>
      <input class="input" placeholder="Search…" autocomplete="off" /></div><div class="sheet-list"></div></div></div>`);
    const input = bg.querySelector('input'); const list = bg.querySelector('.sheet-list');
    const close = () => { bg.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    bg.addEventListener('click', (e) => { if (e.target === bg || e.target.closest('[data-x]')) close(); });
    const pick = (v) => { onPick(v); close(); };
    function render() {
      const term = norm(input.value);
      const found = options.filter((o) => !term || (o.search || norm(o.label)).includes(term)).slice(0, 300);
      list.innerHTML = '';
      if (value) list.appendChild(h(`<button class="opt" data-clear><span class="muted">Clear selection</span></button>`));
      let lastGroup = null;
      for (const o of found) {
        if (o.group && o.group !== lastGroup) { list.appendChild(h(`<div class="grp">${esc(o.group)}</div>`)); lastGroup = o.group; }
        const dis = disabled.has(o.value) && o.value !== value;
        const b = h(`<button class="opt ${o.value === value ? 'sel' : ''}" ${dis ? 'disabled' : ''}><span>${esc(o.label)}${dis ? ' <span class="sub">· already picked</span>' : ''}</span>${o.sub ? `<span class="sub">${esc(o.sub)}</span>` : ''}</button>`);
        b.onclick = () => pick(o.value); list.appendChild(b);
      }
      if (allowOther && term && !found.some((o) => norm(o.label) === term)) {
        const b = h(`<button class="opt"><span>Use “${esc(input.value.trim())}”</span><span class="sub">Other</span></button>`);
        b.onclick = () => pick(input.value.trim()); list.appendChild(b);
      }
      if (!found.length && !allowOther) list.appendChild(h(`<p class="center muted">No matches</p>`));
      const c = list.querySelector('[data-clear]'); if (c) c.onclick = () => pick('');
    }
    input.addEventListener('input', render);
    render(); document.body.appendChild(bg);
    if (window.matchMedia('(min-width: 640px)').matches) input.focus();
  }

  function disabledFor(q, obj) {
    const s = new Set();
    if (q.group) for (const o of ALL_QS) if (o.group === q.group && o.id !== q.id && obj[o.id]) s.add(obj[o.id]);
    return s;
  }

  // Render one question into a container. obj = answers/results object, onChange persists.
  function questionEl(q, obj, onChange, { showPts = true } = {}) {
    const ptsTxt = showPts && q.pts && q.score !== 'none' ? `<span class="pts">${q.score === 'table' && q.rank > 1 ? q.pts + ' PTS · 1 IF TOP 7' : q.pts + ' PTS'}</span>` : '';
    const el = h(`<div class="q" id="q-${q.id}"><div class="q-head"><span class="q-label">${esc(q.label)}</span>${ptsTxt}</div>${q.hint ? `<p class="q-hint">${esc(q.hint)}</p>` : ''}</div>`);
    if (q.type === 'number') {
      const i = h(`<input class="input" type="number" inputmode="numeric" min="${q.min}" max="${q.max}" placeholder="e.g. ${Math.round((q.min + q.max) / 2)}" />`);
      i.value = obj[q.id] ?? ''; i.oninput = () => { obj[q.id] = i.value === '' ? '' : String(Math.max(0, parseInt(i.value, 10) || 0)); onChange(false); };
      el.appendChild(i); return el;
    }
    if (q.type === 'text') {
      const i = h(`<textarea class="input" rows="3" maxlength="280" placeholder="Go on then…"></textarea>`);
      i.value = obj[q.id] ?? ''; i.oninput = () => { obj[q.id] = i.value; onChange(false); };
      el.appendChild(i); return el;
    }
    const btn = pickerButton(q, obj, onChange);
    if (q.rank) { const wrap = h(`<div class="q-inline"><span class="rank ${q.rank === 1 ? 'gold' : ''}">${q.rank}</span></div>`); wrap.appendChild(btn); el.appendChild(wrap); }
    else el.appendChild(btn);
    return el;
  }
  function pickerButton(q, obj, onChange) {
    const v = obj[q.id]; const p = q.type === 'player' ? PLAYER_BY[v] : null;
    const btn = h(`<button type="button" class="picker ${v ? 'filled' : ''}">
      <span>${v ? `${esc(p ? p.label : v)}${p ? ` <span class="sub">· ${esc(p.team)}</span>` : ''}` : `<span class="ph">${q.type === 'player' ? 'Choose a player' : 'Choose a team'}</span>`}</span>
      <span class="chev">▾</span></button>`);
    btn.onclick = () => openSheet({
      title: q.label, options: POOLS[q.pool], value: v, disabled: disabledFor(q, obj), allowOther: !!q.other,
      onPick: (nv) => { obj[q.id] = nv; onChange(true); },
    });
    return btn;
  }
  function pitchEl(section, obj, onChange) {
    const qs = section.qs; const byId = Object.fromEntries(qs.map((q) => [q.id, q]));
    const rows = [['t_lw', 't_st', 't_rw'], ['t_cm1', 't_cm2', 't_cm3'], ['t_lb', 't_cb1', 't_cb2', 't_rb'], ['t_gk']];
    const pitch = h(`<div class="pitch"></div>`);
    for (const r of rows) {
      const line = h(`<div class="line"></div>`);
      for (const id of r) {
        const q = byId[id]; const v = obj[id]; const p = PLAYER_BY[v];
        const s = h(`<button type="button" class="slot ${v ? 'filled' : ''}"><span class="shirt">${esc(q.slot)}</span><span class="nm ${v ? '' : 'empty'}">${v ? esc(p ? p.label : v) : 'Pick'}</span></button>`);
        s.onclick = () => openSheet({ title: `Team of the Season — ${q.slot}`, options: POOLS[q.pool], value: v, disabled: disabledFor(q, obj), onPick: (nv) => { obj[id] = nv; onChange(true); } });
        line.appendChild(s);
      }
      pitch.appendChild(line);
    }
    return pitch;
  }
  function sectionBody(section, obj, onChange, opts) {
    const box = h(`<div></div>`);
    if (section.layout === 'pitch') box.appendChild(pitchEl(section, obj, onChange));
    else section.qs.forEach((q) => box.appendChild(questionEl(q, obj, onChange, opts)));
    return box;
  }
  const missing = (ans) => ALL_QS.filter((q) => !q.optional && (ans[q.id] === undefined || ans[q.id] === ''));

  // ── State ──────────────────────────────────────────────────────────────
  let STATE = null; // { season, locked, results, count }
  async function loadState(season = null) { STATE = await rpc('pred_state', { p_comp: COMP, p_season: season }); return STATE; }
  // This device's entry/draft only count for the season they were made in
  const myEntry = () => { const m = store.get(LS_ME); return m && STATE && m.season === STATE.season ? m : null; };
  const myDraft = () => { const d = store.get(LS_DRAFT); return d && STATE && d.season === STATE.season ? d : null; };

  // ── Views ──────────────────────────────────────────────────────────────
  async function viewHome() {
    await loadState();
    const me = myEntry(); const draft = myDraft();
    if (STATE.locked) {
      app.innerHTML = '';
      app.appendChild(h(`<div class="wrap"><section class="hero">
        <span class="pill"><span class="dot"></span>Predictions locked</span>
        <h1>The calls<br/>are in.<br/><span class="lime">No take-backs.</span></h1>
        <p>${STATE.count} predictions locked for ${esc(STATE.season)}. See what everyone said — and who’s already looking silly.</p>
        <div class="row mt"><a class="btn btn-primary" href="#ledger">Open the ledger →</a></div></section></div>`));
      return;
    }
    const w = h(`<div class="wrap"><section class="hero">
      <span class="pill"><span class="dot"></span>${esc(STATE.title)} · open</span>
      <h1>Ten games in.<br/><span class="lime">Time to call it.</span></h1>
      <p>Champions, top seven, the drop, the cups, the awards and your Team of the Season. Lock it in now and we settle it in May.</p>
    </section>
    <div class="card mt" id="start"></div>
    <p class="muted small center mt">${STATE.count} ${STATE.count === 1 ? 'person has' : 'people have'} already got their picks in · <a href="#ledger">see who</a></p></div>`);
    const start = w.querySelector('#start');
    if (me) {
      start.appendChild(h(`<div><label class="lbl">You’re locked in</label><p style="margin:0 0 6px;font-size:20px;font-weight:800">${esc(me.name)} ✓</p>
        <p class="muted small" style="margin:0 0 14px">Your picks are final. Go and see what everyone else said.</p>
        <div class="row"><a class="btn btn-primary" href="#ledger">See everyone’s picks →</a><button class="btn btn-ghost btn-sm" data-out>Not you?</button></div></div>`));
      start.querySelector('[data-out]').onclick = async () => { if (await askConfirm('Forget this device’s entry? You won’t be able to see the ledger picks from here unless you submit again under a new name.')) { store.del(LS_ME); store.del(LS_DRAFT); viewHome(); } };
    } else {
      start.appendChild(h(`<form><label class="lbl" for="nm">What’s your name?</label>
        <input id="nm" class="input" maxlength="40" autocomplete="name" placeholder="The name the group knows you by" required />
        <button class="btn btn-primary mt" style="width:100%">Start predicting →</button>
        <p class="muted small mt-s">Takes about 5 minutes. Once you lock in there are <strong>no changes</strong> — and only then can you see everyone else’s picks.</p></form>`));
      const f = start.querySelector('form'); const nm = f.querySelector('#nm');
      if (draft && draft.name) nm.value = draft.name;
      f.onsubmit = async (e) => {
        e.preventDefault(); const name = nm.value.trim().replace(/\s+/g, ' ');
        if (!name) return;
        try {
          const list = await rpc('pred_entries_list', { p_comp: COMP, p_season: STATE.season });
          if (list.some((x) => norm(x.name) === norm(name))) { toast('That name’s already in. Add a surname or initial — or ask Tony to reset yours.', true); return; }
        } catch {}
        const answers = (draft && draft.answers) || {};
        store.set(LS_DRAFT, { season: STATE.season, name, answers }); location.hash = '#predict-0';
      };
    }
    app.innerHTML = ''; app.appendChild(w);
  }

  async function viewPredict(stepIdx) {
    if (!STATE) await loadState();
    if (!STATE || !STATE.is_current) await loadState();
    if (STATE.locked) { location.hash = '#home'; return; }
    if (myEntry()) { location.hash = '#ledger'; return; }
    const draft = myDraft();
    if (!draft || !draft.name) { location.hash = '#home'; return; }
    const ans = draft.answers || (draft.answers = {});
    const total = SECTIONS.length + 1; // + review
    const i = Math.max(0, Math.min(total - 1, stepIdx | 0));
    const save = () => store.set(LS_DRAFT, draft);
    const w = h(`<div class="wrap"></div>`);
    const prog = h(`<div class="progress"><div class="bar"><i style="width:${((i + 1) / total) * 100}%"></i></div><div class="steps"></div></div>`);
    const chips = prog.querySelector('.steps');
    [...SECTIONS.map((s) => s.short), 'Review'].forEach((label, k) => {
      const sec = SECTIONS[k];
      const done = sec ? sec.qs.every((q) => q.optional || ans[q.id]) : false;
      const c = h(`<button class="step-chip ${k === i ? 'on' : ''} ${done ? 'done' : ''}">${done && k !== i ? '✓ ' : ''}${esc(label)}</button>`);
      c.onclick = () => { location.hash = '#predict-' + k; };
      chips.appendChild(c);
    });
    w.appendChild(prog);

    const nav = h(`<div class="footer-nav"><div class="in"></div></div>`); const navIn = nav.firstElementChild;
    const back = h(`<button class="btn btn-ghost">← Back</button>`);
    back.onclick = () => { location.hash = i === 0 ? '#home' : '#predict-' + (i - 1); };
    navIn.appendChild(back);

    if (i < SECTIONS.length) {
      const s = SECTIONS[i];
      const card = h(`<div class="card"><p class="muted small" style="margin:0">Step ${i + 1} of ${total} · ${esc(draft.name)}</p>
        <h2 class="section-title">${esc(s.title)}</h2>${s.blurb ? `<p class="muted" style="margin-top:0">${esc(s.blurb)}</p>` : ''}</div>`);
      const body = sectionBody(s, ans, (rerender) => { save(); if (rerender) viewPredict(i); });
      card.appendChild(body); w.appendChild(card);
      const next = h(`<button class="btn btn-primary">${i === SECTIONS.length - 1 ? 'Review →' : 'Next →'}</button>`);
      next.onclick = () => { location.hash = '#predict-' + (i + 1); };
      navIn.appendChild(next);
    } else {
      const miss = missing(ans);
      const card = h(`<div class="card"><p class="muted small" style="margin:0">Last step · ${esc(draft.name)}</p><h2 class="section-title">Review your calls</h2>
        <p class="muted" style="margin-top:0">${miss.length ? `${miss.length} still to fill in — tap any gap to jump to it.` : 'All done. Once you lock in, that’s it — no changes. Then you get to see everyone else’s picks.'}</p></div>`);
      SECTIONS.forEach((s, k) => {
        const box = h(`<div class="mt"><label class="lbl">${esc(s.title)}</label></div>`);
        s.qs.forEach((q) => {
          const v = ans[q.id];
          const row = h(`<div class="kv"><span class="k">${esc(q.slot || q.label)}</span><span class="v ${v ? '' : 'missing'}">${v ? esc(displayValue(q, v)) : (q.optional ? '—' : 'Missing')}</span></div>`);
          if (!v) { row.style.cursor = 'pointer'; row.onclick = () => { location.hash = '#predict-' + k; }; }
          box.appendChild(row);
        });
        card.appendChild(box);
      });
      w.appendChild(card);
      const submit = h(`<button class="btn btn-primary" ${miss.length ? 'disabled' : ''}>Lock it in ✓</button>`);
      submit.onclick = async () => {
        if (!(await askConfirm('Lock in your predictions? You can’t change them after this.', 'Lock it in'))) return;
        submit.disabled = true; submit.textContent = 'Saving…';
        const tok = token();
        try {
          const r = await rpc('pred_submit', { p_comp: COMP, p_season: STATE.season, p_name: draft.name, p_answers: ans, p_token: tok });
          store.set(LS_ME, { season: STATE.season, name: draft.name, token: tok }); store.del(LS_DRAFT);
          void r; location.hash = '#done';
        } catch (err) { toast(err.message, true); submit.disabled = false; submit.textContent = 'Lock it in ✓'; }
      };
      navIn.appendChild(submit);
    }
    w.appendChild(nav);
    app.innerHTML = ''; app.appendChild(w); window.scrollTo(0, 0);
  }

  function viewDone(kind) {
    const me = store.get(LS_ME) || {};
    app.innerHTML = '';
    app.appendChild(h(`<div class="wrap"><section class="hero center" style="padding-top:30px">
      <span class="pill"><span class="dot"></span>You’re in</span>
      <h1>Locked in,<br/><span class="lime">${esc(me.name || 'legend')}.</span></h1>
      <p style="margin:0 auto">Your predictions are saved and final. You’ve earned your look at everyone else’s picks.</p>
      <div class="row mt" style="justify-content:center"><a class="btn btn-primary" href="#ledger">See everyone’s picks →</a></div>
    </section></div>`));
  }

  // Ledger: before lock = who's in; after lock = everyone's picks + table
  let LEDGER_SEASON = null; // null = current season
  async function viewLedger() {
    await loadState(LEDGER_SEASON);
    const me = myEntry();
    const entries = await rpc('pred_entries_list', { p_comp: COMP, p_season: STATE.season, ...(me ? { p_name: me.name, p_token: me.token } : {}) });
    const canSee = entries.length > 0 && entries.every((e) => e.answers);
    const w = h(`<div class="wrap"><section class="hero"><span class="pill"><span class="dot"></span>The ledger · ${esc(STATE.title)}</span>
      <h1>${canSee ? 'Receipts.' : 'Who’s in.'}</h1></section></div>`);
    if ((STATE.seasons || []).length > 1) {
      const pick = h(`<div class="row mb"><label class="lbl" style="margin:0">Season</label><select class="input" style="width:auto;padding:8px 12px"></select></div>`);
      const sel = pick.querySelector('select');
      STATE.seasons.forEach((x) => { const o = document.createElement('option'); o.value = x.season; o.textContent = x.title + (x.is_current ? ' (current)' : ''); o.selected = x.season === STATE.season; sel.appendChild(o); });
      sel.onchange = () => { const x = STATE.seasons.find((y) => y.season === sel.value); LEDGER_SEASON = x && x.is_current ? null : sel.value; viewLedger(); };
      w.appendChild(pick);
    }
    if (!canSee) {
      const c = h(`<div class="card"><p class="muted" style="margin-top:0">${STATE.locked ? 'Predictions are closed.' : 'No copying homework — you only see everyone’s picks once you’ve locked in your own.'} ${entries.length} in so far:</p><div></div>
        ${!STATE.locked && !me ? '<a class="btn btn-primary mt" href="#home">Make my predictions →</a>' : ''}</div>`);
      entries.forEach((e) => c.children[1].appendChild(h(`<span class="chip">${esc(e.name)}</span>`)));
      if (!entries.length) c.children[1].appendChild(h(`<p class="muted">Nobody yet. Be first.</p>`));
      w.appendChild(c);
    } else {
      w.appendChild(renderLedger(entries, STATE.results || {}));
    }
    app.innerHTML = ''; app.appendChild(w);
  }

  function renderLedger(entries, res) {
    const out = h(`<div></div>`);
    const anyResult = Object.values(res).some((v) => v !== '' && v != null);
    const ranked = rankEntries(entries, res);
    const table = h(`<div class="card"><label class="lbl">${anyResult ? 'Standings' : 'Entries'}</label>
      <p class="muted small" style="margin-top:0">${anyResult ? `Points so far out of ${MAX_PTS}. Ties split by the champions’ points total, then Golden Boot goals.` : 'Scores appear here as results are confirmed through the season.'}</p>
      <table class="table"><thead><tr><th>#</th><th>Name</th><th class="num">Hits</th><th class="num">Pts</th></tr></thead><tbody></tbody></table></div>`);
    const tb = table.querySelector('tbody');
    ranked.forEach((e, k) => tb.appendChild(h(`<tr><td>${k + 1}</td><td><strong>${esc(e.name)}</strong></td><td class="num">${anyResult ? e.s.hits : '—'}</td><td class="num"><strong>${anyResult ? e.s.pts : '—'}</strong></td></tr>`)));
    out.appendChild(table);

    const picks = h(`<div class="card"><label class="lbl">Everyone’s picks</label></div>`);
    for (const s of SECTIONS) {
      const det = h(`<details class="acc"><summary><span>${esc(s.title)}</span><span class="muted">▾</span></summary><div></div></details>`);
      const body = det.lastElementChild;
      for (const q of s.qs) {
        const qBox = h(`<div class="mb"><div class="q-label">${esc(s.layout === 'pitch' ? 'TOTS · ' + q.slot : q.label)}</div></div>`);
        if (res[q.id]) qBox.appendChild(h(`<div class="answer">✓ Actual: ${esc(displayValue(q, res[q.id]))}</div>`));
        if (q.type === 'text' || q.type === 'number') {
          ranked.forEach((e) => { const v = (e.answers || {})[q.id]; if (v) qBox.appendChild(h(`<div class="pick-row"><span class="muted">${esc(e.name)}</span><span>${esc(v)}</span></div>`)); });
        } else {
          const counts = {};
          ranked.forEach((e) => { const v = (e.answers || {})[q.id]; if (v) (counts[v] ||= []).push(e); });
          const sorted = Object.entries(counts).sort((a, b) => b[1].length - a[1].length);
          const bars = h(`<div class="bars"></div>`);
          sorted.forEach(([v, who]) => {
            const sample = who[0].s.per[q.id];
            const mark = sample === null || sample === undefined ? '' : sample > 0 ? ` <span class="tick">✓${sample}</span>` : ' <span class="cross">✗</span>';
            bars.appendChild(h(`<div class="b"><span><strong>${esc(shortValue(q, v))}</strong>${mark} <span class="muted small">— ${esc(who.map((x) => x.name).join(', '))}</span></span><span class="muted small">${who.length}</span><span class="track"><i style="width:${(who.length / ranked.length) * 100}%"></i></span></div>`));
          });
          qBox.appendChild(bars);
        }
        body.appendChild(qBox);
      }
      picks.appendChild(det);
    }
    out.appendChild(picks);
    return out;
  }

  // Admin
  async function viewAdmin() {
    const pin = sessionStorage.getItem(SS_PIN);
    const w = h(`<div class="wrap"><section class="hero"><span class="pill">Admin</span><h1>Control room.</h1></section></div>`);
    if (!pin) {
      const f = h(`<form class="card"><label class="lbl" for="pin">Admin PIN</label><input id="pin" class="input" type="password" inputmode="numeric" autocomplete="off" /><button class="btn btn-primary mt">Enter</button></form>`);
      f.onsubmit = async (e) => {
        e.preventDefault(); const p = f.querySelector('#pin').value.trim();
        try { await rpc('pred_admin_get', { p_pin: p, p_comp: COMP }); sessionStorage.setItem(SS_PIN, p); viewAdmin(); } catch (err) { toast(err.message, true); }
      };
      w.appendChild(f); app.innerHTML = ''; app.appendChild(w); return;
    }
    let data;
    try { data = await rpc('pred_admin_get', { p_pin: pin, p_comp: COMP }); } catch (err) { sessionStorage.removeItem(SS_PIN); toast(err.message, true); return viewAdmin(); }
    const { settings, entries } = data;
    const results = settings.results || {};

    const lock = h(`<div class="card"><label class="lbl">${esc(settings.title)} · status</label>
      <p style="margin:0 0 12px;font-size:20px;font-weight:800">${settings.locked ? '🔒 Closed — no new entries, picks are public' : '🟢 Open — taking predictions'}</p>
      <div class="row"><button class="btn ${settings.locked ? 'btn-ghost' : 'btn-primary'}" data-lock>${settings.locked ? 'Re-open predictions' : 'Close predictions'}</button>
      <button class="btn btn-ghost btn-sm" data-csv>Download CSV</button><button class="btn btn-ghost btn-sm" data-out>Log out</button></div>
      <p class="muted small mt">Season over and results entered? Start the next one — this season stays viewable as an archive on the ledger.</p>
      <button class="btn btn-ghost btn-sm" data-new>Start new season</button></div>`);
    lock.querySelector('[data-lock]').onclick = async () => {
      if (!settings.locked && !(await askConfirm(`Close predictions? No new entries after this, and all ${entries.length} entries become public.`, 'Close predictions'))) return;
      try { await rpc('pred_admin_set_lock', { p_pin: pin, p_comp: COMP, p_season: settings.season, p_locked: !settings.locked }); toast(settings.locked ? 'Re-opened' : 'Locked'); viewAdmin(); } catch (err) { toast(err.message, true); }
    };
    lock.querySelector('[data-csv]').onclick = () => downloadCsv(entries, results);
    lock.querySelector('[data-out]').onclick = () => { sessionStorage.removeItem(SS_PIN); location.hash = '#home'; };
    lock.querySelector('[data-new]').onclick = async () => {
      const season = await askText('New season label (e.g. 2027/28)', '');
      if (!season || !season.trim()) return;
      const title = await askText('Title shown to everyone', `${settings.title.replace(/\s*\S+$/, '')} ${season.trim()}`);
      if (!title || !title.trim()) return;
      if (!(await askConfirm(`Start "${title.trim()}"? ${settings.title} will be closed and archived.`, 'Start season'))) return;
      try { await rpc('pred_admin_new_season', { p_pin: pin, p_comp: COMP, p_season: season.trim(), p_title: title.trim() }); toast('New season started'); viewAdmin(); } catch (err) { toast(err.message, true); }
    };
    w.appendChild(lock);

    const list = h(`<div class="card"><label class="lbl">Entries (${entries.length})</label></div>`);
    entries.forEach((e) => {
      const miss = missing(e.answers || {}).length;
      const row = h(`<div class="kv"><span><strong>${esc(e.name)}</strong> <span class="muted small">· ${new Date(e.updated_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}${miss ? ` · ${miss} blank` : ''}</span></span>
        <span class="row"><button class="btn btn-ghost btn-sm" data-ren>Rename</button><button class="btn btn-danger btn-sm" data-del>Delete</button></span></div>`);
      row.querySelector('[data-del]').onclick = async () => {
        if (!(await askConfirm(`Delete ${e.name}'s entry? They can then submit again under that name.`, 'Delete'))) return;
        try { await rpc('pred_admin_delete_entry', { p_pin: pin, p_id: e.id }); viewAdmin(); } catch (err) { toast(err.message, true); }
      };
      row.querySelector('[data-ren]').onclick = async () => {
        const n = await askText('New name', e.name); if (!n || !n.trim()) return;
        try { await rpc('pred_admin_rename_entry', { p_pin: pin, p_id: e.id, p_name: n.trim() }); viewAdmin(); } catch (err) { toast(err.message, true); }
      };
      list.appendChild(row);
    });
    if (!entries.length) list.appendChild(h(`<p class="muted">No entries yet.</p>`));
    w.appendChild(list);

    const resCard = h(`<div class="card"><label class="lbl">Season results</label>
      <p class="muted small" style="margin-top:0">Fill these in as things are decided (cup finals, final table, PFA Team of the Year). Scores recalculate instantly. For Signing / Flop / Worst Signing / Over- & Underachievers, enter the group’s verdict.</p></div>`);
    let dirty = false;
    const saveBtn = h(`<button class="btn btn-primary">Save results</button>`);
    saveBtn.onclick = async () => {
      saveBtn.disabled = true;
      try { await rpc('pred_admin_set_results', { p_pin: pin, p_comp: COMP, p_season: settings.season, p_results: results }); dirty = false; toast('Results saved'); renderPreview(); } catch (err) { toast(err.message, true); }
      saveBtn.disabled = false;
    };
    const resBody = h(`<div></div>`);
    const drawResults = () => {
      resBody.innerHTML = '';
      SECTIONS.forEach((s) => {
        if (s.id === 'tb') { // tiebreak numbers only; no hot-take result
          const box = h(`<div class="mt"><label class="lbl">${esc(s.title)}</label></div>`);
          s.qs.filter((q) => q.type === 'number').forEach((q) => box.appendChild(questionEl(q, results, () => { dirty = true; }, { showPts: false })));
          resBody.appendChild(box); return;
        }
        const box = h(`<div class="mt"><label class="lbl">${esc(s.title)}</label></div>`);
        box.appendChild(sectionBody(s, results, (rerender) => { dirty = true; if (rerender) drawResults(); }, { showPts: false }));
        resBody.appendChild(box);
      });
    };
    drawResults();
    resCard.appendChild(resBody);
    resCard.appendChild(h(`<div class="mt"></div>`)).appendChild(saveBtn);
    w.appendChild(resCard);

    const preview = h(`<div class="mt"></div>`);
    const renderPreview = () => { preview.innerHTML = ''; preview.appendChild(h(`<label class="lbl">Ledger preview</label>`)); preview.appendChild(renderLedger(entries, results)); };
    renderPreview();
    w.appendChild(preview);
    window.onbeforeunload = () => (dirty ? 'Unsaved results' : undefined);
    app.innerHTML = ''; app.appendChild(w);
  }

  function downloadCsv(entries, results) {
    const cols = ALL_QS;
    const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = ['Name', 'Submitted', ...cols.map((q) => (q.slot ? 'TOTS ' + q.slot + ' (' + q.id + ')' : q.label))];
    const rows = [head.map(cell).join(',')];
    rows.push(['ACTUAL RESULT', '', ...cols.map((q) => displayValue(q, results[q.id]))].map(cell).join(','));
    entries.forEach((e) => rows.push([e.name, e.updated_at, ...cols.map((q) => displayValue(q, (e.answers || {})[q.id]))].map(cell).join(',')));
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'sotg-pl-predictions-2026-27.csv'; a.click();
  }

  // ── Router ─────────────────────────────────────────────────────────────
  async function route() {
    window.onbeforeunload = null;
    const raw = location.hash.replace(/^#\/?/, '');
    const path = raw.replace(/\//g, '-') || 'home';
    document.querySelectorAll('.navlink').forEach((a) => a.classList.toggle('active', a.dataset.route === (path.startsWith('ledger') ? 'ledger' : 'home')));
    try {
      if (path.startsWith('predict-')) await viewPredict(parseInt(path.split('-')[1], 10));
      else if (path.startsWith('done')) viewDone();
      else if (path.startsWith('ledger')) await viewLedger();
      else if (path.startsWith('admin')) await viewAdmin();
      else await viewHome();
    } catch (err) {
      console.error(err);
      app.innerHTML = `<div class="wrap"><div class="card"><p><strong>Couldn’t reach the server.</strong></p><p class="muted">${esc(err.message)}</p><button class="btn btn-ghost" onclick="location.reload()">Try again</button></div></div>`;
    }
  }
  window.addEventListener('hashchange', route);

  const logo = document.getElementById('logo');
  const syncLogo = () => { logo.src = document.documentElement.classList.contains('light') ? '/logo-dark.svg' : '/logo.svg'; };
  document.getElementById('theme').onclick = () => {
    const light = document.documentElement.classList.toggle('light');
    try { localStorage.setItem('sotg-theme', light ? 'light' : 'dark'); } catch {}
    syncLogo();
  };
  syncLogo();
  route();

  // exposed for testing
  window.__PL = { scoreEntry, ALL_QS, SECTIONS, MAX_PTS };
})();

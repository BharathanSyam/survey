/* Survey Tool respondent page v1 — built file, do not edit by hand */
/* ==========================================================================
   SHARED LOGIC — identical copy runs in the Apps Script server and on the
   respondent page, so both always agree on variables, visibility and scores.
   ========================================================================== */

var SV = (function () {
  'use strict';

  var MISSING_NOT_SHOWN = -1;
  var MISSING_UNANSWERED = -2;
  var CODE_DK = 98;
  var CODE_PNTS = 99;

  var TYPES = {
    short_text: { answer: true, kind: 'text', secs: 20 },
    paragraph: { answer: true, kind: 'open', secs: 45 },
    single: { answer: true, kind: 'choice', secs: 20 },
    checkbox: { answer: true, kind: 'choice', secs: 20 },
    dropdown: { answer: true, kind: 'choice', secs: 20 },
    linear_scale: { answer: true, kind: 'scale', secs: 6 },
    mc_grid: { answer: true, kind: 'grid', secs: 6 },
    checkbox_grid: { answer: true, kind: 'grid', secs: 10 },
    date: { answer: true, kind: 'text', secs: 15 },
    time: { answer: true, kind: 'text', secs: 15 },
    file_upload: { answer: true, kind: 'open', secs: 45 },
    likert_emoji: { answer: true, kind: 'scale', secs: 6 },
    star_rating: { answer: true, kind: 'scale', secs: 6 },
    slider: { answer: true, kind: 'scale', secs: 8 },
    semantic_diff: { answer: true, kind: 'grid', secs: 6 },
    nps: { answer: true, kind: 'scale', secs: 8 },
    info: { answer: false, kind: 'info', secs: 10 },
    stimulus: { answer: false, kind: 'info', secs: 30 },
    consent: { answer: true, kind: 'choice', secs: 20 },
    phone: { answer: true, kind: 'text', secs: 20 },
    end: { answer: false, kind: 'info', secs: 0 }
  };

  /* ---------- small helpers ---------- */
  function str(v) { return v === undefined || v === null ? '' : String(v).trim(); }
  function yes(v) { v = str(v).toLowerCase(); return v === 'yes' || v === 'y' || v === 'true' || v === '1'; }
  function isNum(v) { return v !== '' && v !== null && v !== undefined && !isNaN(Number(v)) && typeof v !== 'boolean'; }
  function num(v) { return isNum(v) ? Number(v) : v; }
  function isEmpty(v) {
    if (v === undefined || v === null || v === '') return true;
    if (Array.isArray(v)) return v.length === 0;
    if (typeof v === 'object') { for (var k in v) if (!isEmpty(v[k])) return false; return true; }
    return false;
  }

  /** "min=0;max=100;left=Not at all" -> {min:'0', max:'100', left:'Not at all'} */
  function parseSettings(s) {
    var out = {};
    str(s).split(';').forEach(function (part) {
      var i = part.indexOf('=');
      if (i < 0) { if (part.trim()) out[part.trim().toLowerCase()] = 'yes'; return; }
      out[part.slice(0, i).trim().toLowerCase()] = part.slice(i + 1).trim();
    });
    return out;
  }

  /** "1=Yes;2=No" -> [{code:1,en:'Yes',ml:''}] ; "1=Yes|അതെ" gives Malayalam too */
  function parseInlineChoices(s) {
    return str(s).split(';').filter(function (p) { return p.indexOf('=') > 0; }).map(function (p) {
      var i = p.indexOf('=');
      var labels = p.slice(i + 1).split('|');
      return { code: num(p.slice(0, i).trim()), en: labels[0].trim(), ml: (labels[1] || '').trim(), img: '', special: '' };
    });
  }

  function isInline(s) { return str(s).indexOf('=') > 0; }

  /* ---------- seeded random (same order on resume) ---------- */
  function hash(s) {
    var h = 1779033703 ^ s.length;
    for (var i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    return function () { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return (h ^= h >>> 16) >>> 0; };
  }
  function rng(seed) {
    var a = hash(String(seed))();
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, seed) {
    var a = arr.slice(), r = rng(seed);
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function rotate(arr, k) {
    if (!arr.length) return arr.slice();
    k = ((k % arr.length) + arr.length) % arr.length;
    return arr.slice(k).concat(arr.slice(0, k));
  }

  /* ======================================================================
     show_if expressions
     ====================================================================== */
  function tokenize(src) {
    var toks = [], i = 0, s = String(src);
    while (i < s.length) {
      var c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === '(' || c === ')' || c === ',' || c === '[' || c === ']') { toks.push({ t: c }); i++; continue; }
      var two = s.substr(i, 2);
      if (two === '>=' || two === '<=' || two === '!=' || two === '<>' || two === '==') { toks.push({ t: 'op', v: two === '<>' ? '!=' : two === '==' ? '=' : two }); i += 2; continue; }
      if (c === '=' || c === '>' || c === '<') { toks.push({ t: 'op', v: c }); i++; continue; }
      if (c === '"' || c === "'") {
        var j = s.indexOf(c, i + 1); if (j < 0) throw new Error('Missing closing quote');
        toks.push({ t: 'val', v: s.slice(i + 1, j) }); i = j + 1; continue;
      }
      var m = /^-?\d+(\.\d+)?/.exec(s.slice(i));
      if (m && (c !== '-' || !toks.length || toks[toks.length - 1].t !== 'id')) { toks.push({ t: 'val', v: Number(m[0]) }); i += m[0].length; continue; }
      m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(s.slice(i));
      if (m) {
        var w = m[0].toLowerCase();
        if (w === 'and' || w === 'or' || w === 'not' || w === 'in' || w === 'answered' || w === 'is') toks.push({ t: w });
        else toks.push({ t: 'id', v: m[0] });
        i += m[0].length; continue;
      }
      throw new Error('Unexpected character "' + c + '"');
    }
    return toks;
  }

  function parseExpr(src) {
    if (!str(src)) return null;
    var toks = tokenize(src), p = 0;
    function peek(t) { return toks[p] && toks[p].t === t; }
    function eat(t) { if (!peek(t)) throw new Error('Expected ' + t + (toks[p] ? ' near "' + (toks[p].v || toks[p].t) + '"' : ' at end')); return toks[p++]; }
    function orE() { var l = andE(); while (peek('or')) { p++; l = { k: 'or', a: l, b: andE() }; } return l; }
    function andE() { var l = notE(); while (peek('and')) { p++; l = { k: 'and', a: l, b: notE() }; } return l; }
    function notE() { if (peek('not')) { p++; return { k: 'not', a: notE() }; } return cmp(); }
    function value() {
      if (peek('val')) return toks[p++].v;
      if (peek('id')) return toks[p++].v; // bare word compares as text: brand = Apple
      throw new Error('Expected a value');
    }
    function list() {
      var br = peek('['); if (br) p++;
      var vals = [value()];
      while (peek(',')) { p++; vals.push(value()); }
      if (br) eat(']');
      return vals;
    }
    function cmp() {
      if (peek('(')) { p++; var e = orE(); eat(')'); return e; }
      var id = eat('id').v;
      if (peek('is')) p++;
      if (peek('answered')) { p++; return { k: 'ans', id: id }; }
      if (peek('not') && toks[p + 1] && toks[p + 1].t === 'answered') { p += 2; return { k: 'not', a: { k: 'ans', id: id } }; }
      if (peek('not') && toks[p + 1] && toks[p + 1].t === 'in') { p += 2; return { k: 'not', a: { k: 'in', id: id, vals: list() } }; }
      if (peek('in')) { p++; return { k: 'in', id: id, vals: list() }; }
      var op = eat('op').v;
      return { k: 'cmp', id: id, op: op, v: value() };
    }
    var ast = orE();
    if (p < toks.length) throw new Error('Unexpected "' + (toks[p].v || toks[p].t) + '"');
    return ast;
  }

  function exprRefs(ast, out) {
    out = out || [];
    if (!ast) return out;
    if (ast.id) out.push(ast.id);
    if (ast.a) exprRefs(ast.a, out);
    if (ast.b) exprRefs(ast.b, out);
    return out;
  }

  function eq(a, b) {
    if (isNum(a) && isNum(b)) return Number(a) === Number(b);
    return str(a).toLowerCase() === str(b).toLowerCase();
  }
  function evalExpr(ast, get) {
    if (!ast) return true;
    switch (ast.k) {
      case 'or': return evalExpr(ast.a, get) || evalExpr(ast.b, get);
      case 'and': return evalExpr(ast.a, get) && evalExpr(ast.b, get);
      case 'not': return !evalExpr(ast.a, get);
      case 'ans': return !isEmpty(get(ast.id));
      case 'in': {
        var v = get(ast.id); if (isEmpty(v)) return false;
        var arr = Array.isArray(v) ? v : [v];
        return arr.some(function (x) { return ast.vals.some(function (y) { return eq(x, y); }); });
      }
      case 'cmp': {
        var val = get(ast.id); if (isEmpty(val)) return false;
        if (Array.isArray(val)) {
          var has = val.some(function (x) { return eq(x, ast.v); });
          if (ast.op === '=') return has;
          if (ast.op === '!=') return !has;
          return false;
        }
        if (ast.op === '=') return eq(val, ast.v);
        if (ast.op === '!=') return !eq(val, ast.v);
        var a = isNum(val) ? Number(val) : str(val), b = isNum(ast.v) ? Number(ast.v) : str(ast.v);
        if (ast.op === '>') return a > b;
        if (ast.op === '<') return a < b;
        if (ast.op === '>=') return a >= b;
        if (ast.op === '<=') return a <= b;
      }
    }
    return false;
  }

  /* ======================================================================
     Questionnaire definition helpers
     ====================================================================== */

  /** Choice list for a question (resolved at publish time into q.opts) */
  function choicesOf(q) { return q.opts || []; }

  function rowsOf(q) { return q.rows || []; }

  /** numeric answer range of a scale-like question, for reverse scoring */
  function rangeOf(q) {
    var s = q.settings || {};
    switch (q.type) {
      case 'linear_scale': return [Number(s.from || 1), Number(s.to || 5)];
      case 'likert_emoji': return [1, Number(s.points || 5)];
      case 'star_rating': return [1, Number(s.stars || 5)];
      case 'slider': return [Number(s.min || 0), Number(s.max || 100)];
      case 'nps': return [0, 10];
      case 'semantic_diff': return [1, Number(s.points || 7)];
      default: {
        var codes = choicesOf(q).filter(function (o) { return !o.special && isNum(o.code); }).map(function (o) { return Number(o.code); });
        if (!codes.length) return null;
        return [Math.min.apply(null, codes), Math.max.apply(null, codes)];
      }
    }
  }

  function codeLabels(q) {
    var out = {};
    choicesOf(q).forEach(function (o) { out[o.code] = o.en; });
    var s = q.settings || {};
    if (q.type === 'likert_emoji' && !choicesOf(q).length) {
      var pts = Number(s.points || 5);
      for (var i = 1; i <= pts; i++) out[i] = String(i);
    }
    return out;
  }

  function measureOf(q, fallback) {
    if (q.measure) return q.measure;
    if (fallback) return fallback;
    var k = (TYPES[q.type] || {}).kind;
    if (q.type === 'slider' || (q.type === 'short_text' && (q.settings || {}).format === 'number')) return 'scale';
    if (k === 'scale' || k === 'grid') return 'ordinal';
    return 'nominal';
  }

  /**
   * Variables a question produces in the Responses sheet.
   * Each: {name, label, kind:'num'|'str', labels:{code:label}, measure, qid}
   */
  function varsFor(q) {
    var t = q.type, id = q.id, s = q.settings || {}, lab = q.var_label || str(q.text_en).slice(0, 60);
    var V = [];
    function add(name, label, kind, labels, measure) { V.push({ name: name, label: label, kind: kind, labels: labels || {}, measure: measure || measureOf(q), qid: id }); }
    var hasOther = choicesOf(q).some(function (o) { return o.special === 'other'; }) || yes(s.other);
    switch (t) {
      case 'info': case 'stimulus': case 'end': case 'phone': return V;
      case 'short_text':
        add(id, lab, s.format === 'number' ? 'num' : 'str', {}, s.format === 'number' ? 'scale' : 'nominal'); break;
      case 'paragraph': case 'date': case 'time': case 'file_upload':
        add(id, lab, 'str', {}, 'nominal'); break;
      case 'single': case 'dropdown':
        add(id, lab, allNumericCodes(q) ? 'num' : 'str', codeLabels(q));
        if (hasOther) add(id + '_other', lab + ' (other, text)', 'str', {}, 'nominal');
        break;
      case 'checkbox':
        choicesOf(q).forEach(function (o) {
          add(id + '_' + safeCode(o.code), lab + ': ' + o.en, 'num', { 0: 'Not selected', 1: 'Selected' }, 'nominal');
        });
        if (hasOther) add(id + '_other', lab + ' (other, text)', 'str', {}, 'nominal');
        break;
      case 'consent':
        add(id, lab, 'num', { 1: 'Agree', 0: 'Do not agree' }, 'nominal'); break;
      case 'mc_grid':
        rowsOf(q).forEach(function (r) { add(id + '_' + safeCode(r.code), lab + ': ' + r.en, allNumericCodes(q) ? 'num' : 'str', codeLabels(q)); });
        break;
      case 'checkbox_grid':
        rowsOf(q).forEach(function (r) {
          choicesOf(q).forEach(function (o) {
            add(id + '_' + safeCode(r.code) + '_' + safeCode(o.code), lab + ': ' + r.en + ': ' + o.en, 'num', { 0: 'Not selected', 1: 'Selected' }, 'nominal');
          });
        });
        break;
      case 'semantic_diff':
        rowsOf(q).forEach(function (r) { add(id + '_' + safeCode(r.code), lab + ': ' + r.en + ' / ' + (r.en2 || ''), 'num', {}, 'ordinal'); });
        break;
      case 'nps':
        add(id, lab, 'num', { 0: '0 Not at all likely', 10: '10 Extremely likely' }, 'scale'); break;
      case 'slider':
        add(id, lab, 'num', {}, 'scale'); break;
      default:
        add(id, lab, 'num', codeLabels(q));
    }
    return V;
  }

  function safeCode(c) { return String(c).replace(/[^A-Za-z0-9_]/g, '_'); }
  function allNumericCodes(q) { var o = choicesOf(q); return o.length > 0 && o.every(function (x) { return isNum(x.code); }); }

  /** Derived and quality variables computed by the server */
  function derivedVars(def) {
    var V = [];
    scaleNames(def).forEach(function (sc) {
      V.push({ name: 'score_' + sc, label: 'Scale score: ' + sc + ' (' + scaleRule(def, sc) + ')', kind: 'num', labels: {}, measure: 'scale', derived: true });
    });
    def.questions.forEach(function (q) {
      if (q.type === 'nps') V.push({ name: q.id + '_grp', label: 'NPS group: ' + q.id, kind: 'num', labels: { 1: 'Detractor', 2: 'Passive', 3: 'Promoter' }, measure: 'ordinal', derived: true });
    });
    if (def.blocks.some(function (b) { return b.position === 'shuffle'; })) V.push({ name: 'order_blocks', label: 'Order of sections shown', kind: 'str', labels: {}, measure: 'nominal', derived: true });
    def.blocks.forEach(function (b) {
      if (b.randomise === 'yes' || b.randomise === 'latin') V.push({ name: 'order_' + b.id, label: 'Order shown in ' + b.id, kind: 'str', labels: {}, measure: 'nominal', derived: true });
    });
    def.questions.forEach(function (q) {
      if (yes(q.shuffle_options)) V.push({ name: 'order_' + q.id, label: 'Option order shown for ' + q.id, kind: 'str', labels: {}, measure: 'nominal', derived: true });
    });
    return V;
  }

  var FLAG_VARS = [
    { name: 'flag_speeder', label: 'Speeder: under 40% of median complete duration', kind: 'num', labels: { 0: 'No', 1: 'Yes' }, measure: 'nominal' },
    { name: 'flag_straightline', label: 'Same answer on every item of a 6+ item scale', kind: 'num', labels: { 0: 'No', 1: 'Yes' }, measure: 'nominal' },
    { name: 'fail_attention', label: 'Number of attention checks failed', kind: 'num', labels: {}, measure: 'scale' },
    { name: 'dup_device', label: 'Same device as an earlier response', kind: 'num', labels: { 0: 'No', 1: 'Yes' }, measure: 'nominal' },
    { name: 'dup_phone', label: 'Same phone number as an earlier response', kind: 'num', labels: { 0: 'No', 1: 'Yes' }, measure: 'nominal' },
    { name: 'flag_short_text', label: 'Required open answers under 3 words (count)', kind: 'num', labels: {}, measure: 'scale' }
  ];

  var META_VARS = [
    { name: 'resp_id', label: 'Respondent ID', kind: 'str', measure: 'nominal' },
    { name: 'status', label: 'Response status', kind: 'str', measure: 'nominal' },
    { name: 'start_time', label: 'Start time (India time)', kind: 'str', measure: 'nominal' },
    { name: 'end_time', label: 'End time (India time)', kind: 'str', measure: 'nominal' },
    { name: 'duration_sec', label: 'Duration in seconds', kind: 'num', measure: 'scale' },
    { name: 'lang', label: 'Language at submit', kind: 'str', measure: 'nominal' },
    { name: 'lang_switches', label: 'Number of language switches', kind: 'num', measure: 'scale' },
    { name: 'condition', label: 'Experimental condition', kind: 'str', measure: 'nominal' },
    { name: 'src', label: 'Link source', kind: 'str', measure: 'nominal' },
    { name: 'device', label: 'Device type', kind: 'str', measure: 'nominal' },
    { name: 'screen_width', label: 'Screen width (px)', kind: 'num', measure: 'scale' },
    { name: 'browser', label: 'Browser', kind: 'str', measure: 'nominal' },
    { name: 'q_version', label: 'Questionnaire version', kind: 'str', measure: 'nominal' },
    { name: 'consent', label: 'Consent given', kind: 'num', labels: { 1: 'Yes', 0: 'No' }, measure: 'nominal' },
    { name: 'consent_version', label: 'Consent text version', kind: 'str', measure: 'nominal' },
    { name: 'last_block', label: 'Last section finished', kind: 'str', measure: 'nominal' },
    { name: 'pct_complete', label: 'Percent of visible questions answered', kind: 'num', measure: 'scale' },
    { name: 'last_seen', label: 'Time of last checkpoint (India time)', kind: 'str', measure: 'nominal' },
    { name: 'completion_code', label: 'Completion code shown', kind: 'str', measure: 'nominal' },
    { name: 'ext_id', label: 'Per-respondent link id (&id=)', kind: 'str', measure: 'nominal' }
  ];
  /** Columns kept in the sheet but never exported */
  var PRIVATE_COLS = ['device_id'];

  function allVars(def) {
    var V = [];
    def.questions.forEach(function (q) { V = V.concat(varsFor(q)); });
    return META_VARS.concat(V, derivedVars(def), FLAG_VARS);
  }

  function scaleNames(def) {
    var seen = {}, out = [];
    def.questions.forEach(function (q) { if (q.scale && !seen[q.scale]) { seen[q.scale] = 1; out.push(q.scale); } });
    return out;
  }
  function scaleRule(def, sc) {
    var rule = (def.settings && def.settings.scale_scoring) || 'mean';
    def.questions.forEach(function (q) { if (q.scale === sc && q.settings && q.settings.score) rule = q.settings.score; });
    return rule === 'sum' ? 'sum' : 'mean';
  }

  /* ======================================================================
     Display order and visibility
     ====================================================================== */

  /** Order of blocks for this respondent. Blocks with position=shuffle trade places among themselves. */
  function blockOrder(def, seed) {
    var ids = def.blocks.map(function (b) { return b.id; });
    var slots = [], movable = [];
    def.blocks.forEach(function (b, i) { if (b.position === 'shuffle') { slots.push(i); movable.push(b.id); } });
    if (movable.length > 1) {
      var sh = shuffle(movable, seed + ':blocks');
      slots.forEach(function (slot, i) { ids[slot] = sh[i]; });
    }
    return ids;
  }

  /** Order of items within a block: groups (settings group=x) move together; fixed=yes items keep their place. */
  function itemOrder(def, blockId, seed, seq) {
    var b = blockById(def, blockId);
    var items = def.questions.filter(function (q) { return q.block === blockId; });
    if (!b || (b.randomise !== 'yes' && b.randomise !== 'latin')) return items.map(function (q) { return q.id; });
    var units = [], byGroup = {}, slots = [];
    items.forEach(function (q, i) {
      var g = (q.settings || {}).group;
      if ((q.settings || {}).fixed === 'yes') return;
      if (g) { if (!byGroup[g]) { byGroup[g] = []; units.push(byGroup[g]); slots.push(i); } byGroup[g].push(q.id); }
      else { units.push([q.id]); slots.push(i); }
    });
    var ordered = b.randomise === 'latin' ? rotate(units, seq || 0) : shuffle(units, seed + ':' + blockId);
    // rebuild: fixed items stay at their index, movable units fill the movable positions in new order
    var out = [], u = 0;
    var fixedAt = {};
    items.forEach(function (q, i) { if ((q.settings || {}).fixed === 'yes') fixedAt[i] = q.id; });
    var used = {};
    for (var i = 0; i < items.length; i++) {
      if (fixedAt[i]) { out.push(fixedAt[i]); continue; }
      if (slots.indexOf(i) >= 0 && u < ordered.length) { ordered[u++].forEach(function (id) { out.push(id); used[id] = 1; }); }
    }
    return out;
  }

  function optionOrder(q, seed) {
    var opts = choicesOf(q);
    if (!yes(q.shuffle_options)) return opts.map(function (o) { return o.code; });
    var pinned = opts.filter(function (o) { return o.special; });
    var free = opts.filter(function (o) { return !o.special; });
    return shuffle(free, seed + ':' + q.id).concat(pinned).map(function (o) { return o.code; });
  }

  function blockById(def, id) { for (var i = 0; i < def.blocks.length; i++) if (def.blocks[i].id === id) return def.blocks[i]; return null; }
  function qById(def, id) { if (!def._qmap) { def._qmap = {}; def.questions.forEach(function (q) { def._qmap[q.id] = q; }); } return def._qmap[id] || null; }

  /** Value lookup for show_if, piping and quotas */
  function getter(def, answers, extra) {
    extra = extra || {};
    return function (id) {
      if (id in extra) return extra[id];
      var q = qById(def, id);
      if (q) {
        var v = answers[id];
        if (Array.isArray(v)) return v.map(num);
        if (v && typeof v === 'object') return isEmpty(v) ? undefined : v;
        return v === undefined || v === null || v === '' ? undefined : num(v);
      }
      // grid / checkbox sub-variable: q_row or q_code
      var i = id.lastIndexOf('_');
      while (i > 0) {
        var base = id.slice(0, i), rest = id.slice(i + 1), bq = qById(def, base);
        if (bq) {
          var val = answers[base];
          if (val === undefined) return undefined;
          if (bq.type === 'checkbox') return (val || []).some(function (c) { return safeCode(c) === rest; }) ? 1 : 0;
          if (val && typeof val === 'object' && !Array.isArray(val)) {
            for (var k in val) if (safeCode(k) === rest) return Array.isArray(val[k]) ? val[k].map(num) : num(val[k]);
          }
          return undefined;
        }
        i = id.lastIndexOf('_', i - 1);
      }
      return undefined;
    };
  }

  function compiled(def, key, src) {
    def._ast = def._ast || {};
    if (!(key in def._ast)) { try { def._ast[key] = parseExpr(src); } catch (e) { def._ast[key] = null; } }
    return def._ast[key];
  }

  /**
   * Which blocks and items this respondent sees, given answers so far.
   * state: {answers, condition, orders:{blocks:[...], <blockId>:[qids]}}
   * Returns {blocks:[{id, items:[qid...]}], hidden:{qid:true}, endAt: qid|null}
   */
  function visibility(def, state) {
    var answers = state.answers || {};
    var get = getter(def, answers, { condition: state.condition || '', lang: state.lang || 'en', src: state.src || '' });
    var orders = state.orders || {};
    var bOrder = orders.blocks || def.blocks.map(function (b) { return b.id; });
    var out = { blocks: [], shown: {}, endAt: null };
    var ended = false;
    bOrder.forEach(function (bid) {
      var b = blockById(def, bid); if (!b) return;
      if (ended && !b.debrief) return;
      if (b.condition && !matchCondition(b.condition, state.condition)) return;
      if (b.show_if && !evalExpr(compiled(def, 'b:' + bid, b.show_if), get)) return;
      var ids = orders[bid] || def.questions.filter(function (q) { return q.block === bid; }).map(function (q) { return q.id; });
      var vis = [];
      ids.forEach(function (qid) {
        if (ended && !b.debrief) return;
        var q = qById(def, qid); if (!q) return;
        if (q.condition && !matchCondition(q.condition, state.condition)) return;
        if (q.type === 'phone' && str((def.settings || {}).collect_phone || 'no').toLowerCase() === 'no') return;
        if (q.show_if && !evalExpr(compiled(def, 'q:' + qid, q.show_if), get)) return;
        vis.push(qid); out.shown[qid] = true;
        if (q.type === 'end') { ended = true; out.endAt = qid; }
      });
      out.blocks.push({ id: bid, items: vis });
    });
    return out;
  }

  function matchCondition(spec, cond) {
    return str(spec).split(/[,;]/).map(function (s) { return s.trim().toLowerCase(); }).indexOf(str(cond).toLowerCase()) >= 0;
  }

  function answerable(q) { return q && TYPES[q.type] && TYPES[q.type].answer; }

  function isAnswered(q, v) {
    if (q.type === 'mc_grid' || q.type === 'semantic_diff') return v && rowsOf(q).every(function (r) { return !isEmpty(v[r.code]); });
    if (q.type === 'checkbox_grid') return v && rowsOf(q).some(function (r) { return !isEmpty(v[r.code]); });
    return !isEmpty(v);
  }

  function progress(def, state) {
    var vis = visibility(def, state), total = 0, done = 0;
    Object.keys(vis.shown).forEach(function (qid) {
      var q = qById(def, qid);
      if (!answerable(q)) return;
      total++; if (isAnswered(q, (state.answers || {})[qid])) done++;
    });
    return { total: total, done: done, pct: total ? Math.round(100 * done / total) : 0, vis: vis };
  }

  /**
   * Turn the raw answers into one value per variable.
   * blocksDone: list of block ids finished; final=true marks every visible block finished.
   */
  function flatten(def, state, final) {
    var vis = visibility(def, state), out = {};
    var answers = state.answers || {};
    var done = {};
    (state.blocksDone || []).forEach(function (b) { done[b] = true; });
    var visBlocks = {};
    vis.blocks.forEach(function (b) { visBlocks[b.id] = b; });
    def.questions.forEach(function (q) {
      var vars = varsFor(q); if (!vars.length) return;
      var blockFinished = final || done[q.block];
      var shown = !!vis.shown[q.id];
      if (!blockFinished && !(final === false && shown && isAnswered(q, answers[q.id]))) {
        // block not finished yet: leave blank
        return;
      }
      if (!shown) { vars.forEach(function (v) { out[v.name] = v.kind === 'num' ? MISSING_NOT_SHOWN : MISSING_NOT_SHOWN; }); return; }
      var a = answers[q.id];
      var unanswered = !isAnswered(q, a) && q.type !== 'checkbox_grid' ? true : (q.type === 'checkbox_grid' && isEmpty(a));
      switch (q.type) {
        case 'checkbox':
          choicesOf(q).forEach(function (o) {
            out[q.id + '_' + safeCode(o.code)] = unanswered ? MISSING_UNANSWERED : ((a || []).some(function (c) { return String(c) === String(o.code); }) ? 1 : 0);
          });
          if (out.hasOwnProperty(q.id + '_other') || vars.some(function (v) { return v.name === q.id + '_other'; })) out[q.id + '_other'] = answers[q.id + '_other'] || '';
          break;
        case 'single': case 'dropdown':
          out[q.id] = unanswered ? MISSING_UNANSWERED : num(a);
          if (vars.some(function (v) { return v.name === q.id + '_other'; })) out[q.id + '_other'] = answers[q.id + '_other'] || '';
          break;
        case 'mc_grid': case 'semantic_diff':
          rowsOf(q).forEach(function (r) {
            var v = a ? a[r.code] : undefined;
            out[q.id + '_' + safeCode(r.code)] = isEmpty(v) ? MISSING_UNANSWERED : num(v);
          });
          break;
        case 'checkbox_grid':
          rowsOf(q).forEach(function (r) {
            var sel = a ? (a[r.code] || []) : [];
            choicesOf(q).forEach(function (o) {
              out[q.id + '_' + safeCode(r.code) + '_' + safeCode(o.code)] = unanswered ? MISSING_UNANSWERED : (sel.some(function (c) { return String(c) === String(o.code); }) ? 1 : 0);
            });
          });
          break;
        case 'file_upload':
          out[q.id] = unanswered ? MISSING_UNANSWERED : (a && a.url ? a.url : str(a));
          break;
        default:
          var kind = vars[0].kind;
          if (unanswered) out[q.id] = MISSING_UNANSWERED;
          else out[q.id] = kind === 'num' ? num(a) : str(a);
      }
    });
    return out;
  }

  /** Scores, NPS groups and quality flags computed from flattened values */
  function derive(def, flat) {
    var d = {};
    var missing = function (v) { return v === '' || v === undefined || v === null || v < 0 || v === MISSING_NOT_SHOWN || v === MISSING_UNANSWERED; };
    scaleNames(def).forEach(function (sc) {
      var vals = [], raw = [];
      def.questions.forEach(function (q) {
        if (q.scale !== sc) return;
        varsFor(q).forEach(function (v) {
          var x = flat[v.name];
          if (missing(x) || !isNum(x)) return;
          x = Number(x);
          var specials = choicesOf(q).filter(function (o) { return o.special === 'dk' || o.special === 'pnts'; }).map(function (o) { return Number(o.code); });
          if (specials.indexOf(x) >= 0) return;
          raw.push(x);
          var r = rangeOf(q);
          if (yes(q.reverse) && r) x = r[0] + r[1] - x;
          vals.push(x);
        });
      });
      var rule = scaleRule(def, sc);
      d['score_' + sc] = vals.length ? round(rule === 'sum' ? sum(vals) : sum(vals) / vals.length, 3) : '';
    });
    def.questions.forEach(function (q) {
      if (q.type !== 'nps') return;
      var v = flat[q.id];
      d[q.id + '_grp'] = missing(v) || !isNum(v) ? '' : (v <= 6 ? 1 : v <= 8 ? 2 : 3);
    });
    // attention checks
    var fails = 0;
    def.questions.forEach(function (q) {
      var c = str(q.check).toLowerCase();
      if (c.indexOf('attention') !== 0) return;
      var want = c.split('=')[1];
      var v = flat[q.id];
      if (v === MISSING_NOT_SHOWN || v === undefined || v === '') return;
      if (want === undefined) return;
      if (!eq(v, want)) fails++;
    });
    d.fail_attention = fails;
    // straight-lining on scales of 6+ answered items
    var sl = 0;
    scaleNames(def).forEach(function (sc) {
      var vals = [];
      def.questions.forEach(function (q) {
        if (q.scale !== sc) return;
        varsFor(q).forEach(function (v) { var x = flat[v.name]; if (!missing(x)) vals.push(String(x)); });
      });
      if (vals.length >= 6 && vals.every(function (x) { return x === vals[0]; })) sl = 1;
    });
    d.flag_straightline = sl;
    // short required open text
    var st = 0;
    def.questions.forEach(function (q) {
      if (!yes(q.required)) return;
      if (q.type !== 'paragraph' && !(q.type === 'short_text' && !(q.settings || {}).format)) return;
      var v = flat[q.id];
      if (typeof v === 'string' && v && v.trim().split(/\s+/).length < 3) st++;
    });
    d.flag_short_text = st;
    return d;
  }

  function sum(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s; }
  function round(x, n) { var p = Math.pow(10, n); return Math.round(x * p) / p; }

  /** Cronbach's alpha from rows of item values (numbers; rows with any missing skipped) */
  function cronbach(rows) {
    rows = rows.filter(function (r) { return r.every(function (x) { return isNum(x); }); });
    if (rows.length < 2 || !rows[0] || rows[0].length < 2) return null;
    var k = rows[0].length;
    function variance(a) { var m = sum(a) / a.length; return sum(a.map(function (x) { return (x - m) * (x - m); })) / (a.length - 1); }
    var itemVar = 0;
    for (var j = 0; j < k; j++) itemVar += variance(rows.map(function (r) { return Number(r[j]); }));
    var totVar = variance(rows.map(function (r) { return sum(r.map(Number)); }));
    if (!totVar) return null;
    return round((k / (k - 1)) * (1 - itemVar / totVar), 3);
  }

  /** Estimated seconds for a list of question ids */
  function estimateSecs(def, qids) {
    var t = 0;
    qids.forEach(function (id) {
      var q = qById(def, id); if (!q) return;
      var base = (TYPES[q.type] || {}).secs || 10;
      if (q.type === 'mc_grid' || q.type === 'semantic_diff' || q.type === 'checkbox_grid') base = base * Math.max(1, rowsOf(q).length);
      if (q.type === 'stimulus' && q.mediaInfo) base = Math.max(base, Number(q.mediaInfo.min_view || 0), Number(q.mediaInfo.duration || 0));
      t += base;
    });
    return t;
  }

  function label(obj, field, lang) {
    if (!obj) return '';
    var ml = obj[field + '_ml'];
    if (lang === 'ml' && str(ml)) return ml;
    return obj[field + '_en'] !== undefined ? obj[field + '_en'] : (obj[field] || '');
  }

  return {
    TYPES: TYPES, MISSING_NOT_SHOWN: MISSING_NOT_SHOWN, MISSING_UNANSWERED: MISSING_UNANSWERED,
    CODE_DK: CODE_DK, CODE_PNTS: CODE_PNTS,
    META_VARS: META_VARS, FLAG_VARS: FLAG_VARS, PRIVATE_COLS: PRIVATE_COLS,
    str: str, yes: yes, isNum: isNum, num: num, isEmpty: isEmpty,
    parseSettings: parseSettings, parseInlineChoices: parseInlineChoices, isInline: isInline,
    rng: rng, shuffle: shuffle, rotate: rotate,
    parseExpr: parseExpr, exprRefs: exprRefs, evalExpr: evalExpr,
    varsFor: varsFor, derivedVars: derivedVars, allVars: allVars, safeCode: safeCode,
    scaleNames: scaleNames, scaleRule: scaleRule, rangeOf: rangeOf,
    blockOrder: blockOrder, itemOrder: itemOrder, optionOrder: optionOrder,
    blockById: blockById, qById: qById, getter: getter, visibility: visibility,
    matchCondition: matchCondition, answerable: answerable, isAnswered: isAnswered,
    progress: progress, flatten: flatten, derive: derive, cronbach: cronbach,
    estimateSecs: estimateSecs, label: label, measureOf: measureOf
  };
})();

/* ==========================================================================
   Respondent page: utilities, words in both languages, icons
   ========================================================================== */
(function () {
  'use strict';
  var W = window;
  var App = W.SurveyApp = W.SurveyApp || {};

  /* ---------- DOM ---------- */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (k === 'style') el.setAttribute('style', v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { add(el, x); }); return; }
    el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  /** Safe rich text: escapes HTML, then **bold**, *italic* and line breaks */
  function rich(s) {
    return esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>').replace(/\n/g, '<br>');
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* ---------- storage that never throws ---------- */
  var mem = {};
  var store = {
    get: function (k) { try { var v = W.localStorage.getItem(k); return v === null ? (mem[k] || null) : v; } catch (e) { return mem[k] || null; } },
    set: function (k, v) { mem[k] = v; try { W.localStorage.setItem(k, v); } catch (e) { } },
    del: function (k) { delete mem[k]; try { W.localStorage.removeItem(k); } catch (e) { } },
    json: function (k) { try { return JSON.parse(store.get(k) || 'null'); } catch (e) { return null; } }
  };

  function uid(n) {
    var a = 'abcdefghijkmnopqrstuvwxyz0123456789', s = '';
    var buf = (W.crypto && W.crypto.getRandomValues) ? W.crypto.getRandomValues(new Uint8Array(n)) : null;
    for (var i = 0; i < n; i++) s += a.charAt((buf ? buf[i] : Math.floor(Math.random() * 256)) % a.length);
    return s;
  }

  var reduceMotion = W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- words ---------- */
  var T = {
    en: {
      start: 'Start', cont: 'Continue', next: 'Next', ok: 'OK', back: 'Back', finish: 'Finish', submit: 'Submit',
      choose_lang: 'Choose your language', minutes: 'about {n} minutes', min_short: '{n} min',
      part: 'Part {i} of {n}', required: 'Please answer this question.', required_rows: 'Please answer every row.',
      agree: 'I agree to take part', disagree: 'I do not agree', adult: 'I am 18 years or older',
      consent_title: 'Before you begin', researcher: 'Researcher', contact: 'Questions about the study?',
      declined_title: 'Thank you', declined: 'You chose not to take part. Nothing you entered has been kept.', changed_mind: 'Changed your mind? Start again',
      save_later: 'Save and finish later', resume_title: 'Finish later', resume_text: 'Write down this code, or send it to yourself. Open the same link later on any phone and enter it to carry on.',
      share_wa: 'Send to myself on WhatsApp', copy: 'Copy code', copied: 'Copied!', keep_going: 'Keep going now',
      have_code: 'Have a code to continue?', enter_code: 'Enter your 6-character code', resume_btn: 'Continue with code',
      bad_code: 'That code was not found. Check it and try again.', resume_off: 'Codes are not used in this study.',
      welcome_back: 'Welcome back!', welcome_back_text: 'Your answers so far are saved on this phone.', carry_on: 'Carry on',
      thanks: 'Thank you!', done_already: 'You have already taken part in this study. Thank you!',
      closed: 'This survey is not open right now.', loading: 'Loading…', saving: 'Saving your answers…',
      offline: 'No connection right now. Your answers are safe on this phone and will be sent automatically.',
      retry: 'Try again', retrying: 'Trying again…', cant_load: 'The survey could not be loaded. Check your internet connection and try again.',
      not_published: 'This survey has not been published yet.',
      other_ph: 'Please specify', choose: 'Choose…', search: 'Search', no_match: 'No matches',
      max_n: 'You can choose up to {n}.', min_n: 'Please choose at least {n}.',
      num_range: 'Please enter a number from {a} to {b}.', num_only: 'Please enter a number.',
      email_bad: 'Please enter a valid email address.', phone_bad: 'Please enter a valid 10-digit mobile number.',
      min_words: 'Please write at least {n} words.', words: '{n} words', chars_left: '{n} characters left',
      tap_slider: 'Tap or drag on the line', your_answer: 'Your answer',
      take_photo: 'Take photo', choose_file: 'Choose file', remove: 'Remove', uploading: 'Uploading…', uploaded: 'Uploaded',
      too_big: 'This file is too large (maximum {n} MB).', upload_failed: 'Upload failed. Check your connection and try again.', wrong_type: 'This type of file is not allowed.',
      tap_play: 'Tap to play', watch_all: 'Please watch until the end to continue.', replay: 'Watch again',
      wait_secs: 'You can continue in {n} s', times_up: 'Time is up',
      cheer25: 'Great start, a quarter done!', cheer50: 'Halfway there, thank you!', cheer75: 'Almost done, just a little more!',
      your_code: 'Your completion code', your_scores: 'Your results', not_likely: 'Not at all likely', very_likely: 'Extremely likely',
      quota_full: 'Thank you. We already have enough responses from people like you.',
      screened: 'Thank you. This study is looking for a different group of people.',
      saved_tick: 'Saved', text_size: 'Text size', lang_switch: 'മലയാളം', of: 'of', stars_of: '{n} of {m} stars',
      agree_c: 'Agree', disagree_c: 'Do not agree', next_q: 'Next', test_mode: 'TEST', test_condition: 'Condition', test_jump: 'Jump to question', test_reset: 'Start over',
      age_gate: 'Please confirm you are 18 or older.'
    },
    ml: {
      start: 'ആരംഭിക്കുക', cont: 'തുടരുക', next: 'അടുത്തത്', ok: 'ശരി', back: 'പിന്നോട്ട്', finish: 'പൂർത്തിയാക്കുക', submit: 'സമർപ്പിക്കുക',
      choose_lang: 'ഭാഷ തിരഞ്ഞെടുക്കുക', minutes: 'ഏകദേശം {n} മിനിറ്റ്', min_short: '{n} മിനിറ്റ്',
      part: 'ഭാഗം {i} / {n}', required: 'ഈ ചോദ്യത്തിന് ഉത്തരം നൽകുക.', required_rows: 'എല്ലാ വരികൾക്കും ഉത്തരം നൽകുക.',
      agree: 'പങ്കെടുക്കാൻ ഞാൻ സമ്മതിക്കുന്നു', disagree: 'ഞാൻ സമ്മതിക്കുന്നില്ല', adult: 'എനിക്ക് 18 വയസ്സോ അതിൽ കൂടുതലോ ഉണ്ട്',
      consent_title: 'തുടങ്ങുന്നതിന് മുമ്പ്', researcher: 'ഗവേഷകർ', contact: 'പഠനത്തെക്കുറിച്ച് ചോദ്യങ്ങളുണ്ടോ?',
      declined_title: 'നന്ദി', declined: 'പങ്കെടുക്കേണ്ടെന്ന് നിങ്ങൾ തീരുമാനിച്ചു. നിങ്ങൾ നൽകിയ ഒന്നും സൂക്ഷിച്ചിട്ടില്ല.', changed_mind: 'മനസ്സ് മാറിയോ? വീണ്ടും ആരംഭിക്കുക',
      save_later: 'സേവ് ചെയ്ത് പിന്നീട് പൂർത്തിയാക്കുക', resume_title: 'പിന്നീട് പൂർത്തിയാക്കാം', resume_text: 'ഈ കോഡ് എഴുതിവയ്ക്കുക, അല്ലെങ്കിൽ നിങ്ങൾക്കുതന്നെ അയയ്ക്കുക. പിന്നീട് ഏത് ഫോണിലും ഇതേ ലിങ്ക് തുറന്ന് കോഡ് നൽകി തുടരാം.',
      share_wa: 'വാട്ട്‌സ്ആപ്പിൽ എനിക്കുതന്നെ അയയ്ക്കുക', copy: 'കോഡ് പകർത്തുക', copied: 'പകർത്തി!', keep_going: 'ഇപ്പോൾ തുടരുക',
      have_code: 'തുടരാനുള്ള കോഡ് ഉണ്ടോ?', enter_code: '6 അക്ഷരമുള്ള കോഡ് നൽകുക', resume_btn: 'കോഡ് ഉപയോഗിച്ച് തുടരുക',
      bad_code: 'ഈ കോഡ് കണ്ടെത്തിയില്ല. പരിശോധിച്ച് വീണ്ടും ശ്രമിക്കുക.', resume_off: 'ഈ പഠനത്തിൽ കോഡുകൾ ഉപയോഗിക്കുന്നില്ല.',
      welcome_back: 'വീണ്ടും സ്വാഗതം!', welcome_back_text: 'ഇതുവരെയുള്ള ഉത്തരങ്ങൾ ഈ ഫോണിൽ സേവ് ചെയ്തിട്ടുണ്ട്.', carry_on: 'തുടരുക',
      thanks: 'നന്ദി!', done_already: 'നിങ്ങൾ ഈ പഠനത്തിൽ ഇതിനകം പങ്കെടുത്തിട്ടുണ്ട്. നന്ദി!',
      closed: 'ഈ സർവേ ഇപ്പോൾ ലഭ്യമല്ല.', loading: 'ലോഡ് ചെയ്യുന്നു…', saving: 'ഉത്തരങ്ങൾ സേവ് ചെയ്യുന്നു…',
      offline: 'ഇപ്പോൾ കണക്ഷൻ ഇല്ല. ഉത്തരങ്ങൾ ഈ ഫോണിൽ സുരക്ഷിതമാണ്, കണക്ഷൻ വരുമ്പോൾ സ്വയം അയയ്ക്കും.',
      retry: 'വീണ്ടും ശ്രമിക്കുക', retrying: 'വീണ്ടും ശ്രമിക്കുന്നു…', cant_load: 'സർവേ ലോഡ് ചെയ്യാനായില്ല. ഇന്റർനെറ്റ് കണക്ഷൻ പരിശോധിച്ച് വീണ്ടും ശ്രമിക്കുക.',
      not_published: 'ഈ സർവേ ഇതുവരെ പ്രസിദ്ധീകരിച്ചിട്ടില്ല.',
      other_ph: 'വ്യക്തമാക്കുക', choose: 'തിരഞ്ഞെടുക്കുക…', search: 'തിരയുക', no_match: 'ഒന്നും കണ്ടെത്തിയില്ല',
      max_n: 'പരമാവധി {n} എണ്ണം തിരഞ്ഞെടുക്കാം.', min_n: 'കുറഞ്ഞത് {n} എണ്ണം തിരഞ്ഞെടുക്കുക.',
      num_range: '{a} മുതൽ {b} വരെയുള്ള ഒരു സംഖ്യ നൽകുക.', num_only: 'ഒരു സംഖ്യ നൽകുക.',
      email_bad: 'ശരിയായ ഇമെയിൽ വിലാസം നൽകുക.', phone_bad: 'ശരിയായ 10 അക്ക മൊബൈൽ നമ്പർ നൽകുക.',
      min_words: 'കുറഞ്ഞത് {n} വാക്കുകൾ എഴുതുക.', words: '{n} വാക്കുകൾ', chars_left: '{n} അക്ഷരങ്ങൾ കൂടി',
      tap_slider: 'വരയിൽ തൊടുകയോ വലിക്കുകയോ ചെയ്യുക', your_answer: 'നിങ്ങളുടെ ഉത്തരം',
      take_photo: 'ഫോട്ടോ എടുക്കുക', choose_file: 'ഫയൽ തിരഞ്ഞെടുക്കുക', remove: 'നീക്കം ചെയ്യുക', uploading: 'അപ്‌ലോഡ് ചെയ്യുന്നു…', uploaded: 'അപ്‌ലോഡ് ചെയ്തു',
      too_big: 'ഫയൽ വളരെ വലുതാണ് (പരമാവധി {n} MB).', upload_failed: 'അപ്‌ലോഡ് പരാജയപ്പെട്ടു. കണക്ഷൻ പരിശോധിച്ച് വീണ്ടും ശ്രമിക്കുക.', wrong_type: 'ഈ തരം ഫയൽ അനുവദനീയമല്ല.',
      tap_play: 'പ്ലേ ചെയ്യാൻ ടാപ്പ് ചെയ്യുക', watch_all: 'തുടരാൻ വീഡിയോ മുഴുവൻ കാണുക.', replay: 'വീണ്ടും കാണുക',
      wait_secs: '{n} സെക്കൻഡിനുശേഷം തുടരാം', times_up: 'സമയം കഴിഞ്ഞു',
      cheer25: 'നല്ല തുടക്കം, നാലിലൊന്ന് കഴിഞ്ഞു!', cheer50: 'പകുതി കഴിഞ്ഞു, നന്ദി!', cheer75: 'ഏകദേശം കഴിഞ്ഞു, കുറച്ചുകൂടി മാത്രം!',
      your_code: 'നിങ്ങളുടെ പൂർത്തീകരണ കോഡ്', your_scores: 'നിങ്ങളുടെ ഫലങ്ങൾ', not_likely: 'ഒട്ടും സാധ്യതയില്ല', very_likely: 'വളരെയധികം സാധ്യത',
      quota_full: 'നന്ദി. നിങ്ങളെപ്പോലുള്ളവരിൽ നിന്ന് ആവശ്യത്തിന് ഉത്തരങ്ങൾ ഇതിനകം ലഭിച്ചു.',
      screened: 'നന്ദി. ഈ പഠനം മറ്റൊരു വിഭാഗം ആളുകളെയാണ് അന്വേഷിക്കുന്നത്.',
      saved_tick: 'സേവ് ചെയ്തു', text_size: 'അക്ഷര വലുപ്പം', lang_switch: 'English', of: '/', stars_of: '{m}-ൽ {n} നക്ഷത്രം',
      agree_c: 'സമ്മതിക്കുന്നു', disagree_c: 'സമ്മതിക്കുന്നില്ല', next_q: 'അടുത്തത്', test_mode: 'TEST', test_condition: 'Condition', test_jump: 'Jump to question', test_reset: 'Start over',
      age_gate: 'നിങ്ങൾക്ക് 18 വയസ്സോ അതിൽ കൂടുതലോ ഉണ്ടെന്ന് സ്ഥിരീകരിക്കുക.'
    }
  };
  function t(key, vars, lang) {
    lang = lang || (App.st && App.st.lang) || 'en';
    var s = (T[lang] && T[lang][key]) || T.en[key] || key;
    if (vars) Object.keys(vars).forEach(function (k) { s = s.replace('{' + k + '}', vars[k]); });
    return s;
  }

  /* ---------- icons (inline SVG, colour from CSS) ---------- */
  var I = {
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    warn: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M12 7v6" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="16.8" r="1.4" fill="#fff"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="13.5" y="5" width="4" height="14" rx="1" fill="currentColor"/></svg>',
    replay: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5a7 7 0 1 1-6.6 4.7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M4 4v5h5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" stroke-linejoin="round"/></svg>',
    camera: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l1.6-2.4h6.8L17 8h3v11H4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="13.2" r="3.4" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    file: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l4 4v14H6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M14 3v4h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    globe: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 12h18M12 3c2.5 2.6 3.6 5.6 3.6 9s-1.1 6.4-3.6 9c-2.5-2.6-3.6-5.6-3.6-9S9.5 5.6 12 3z" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    wa: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 8.5c.3 2.9 2.6 5.3 5.6 6l1.2-1.4-2-1-1 .9c-1-.5-1.9-1.3-2.4-2.4l.9-1-1-2z" fill="currentColor"/></svg>',
    party: '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="#E3F6F2"/><path d="M19 47l9-25 15 15z" fill="#FFC542" stroke="#0B7A6C" stroke-width="2.5" stroke-linejoin="round"/><path d="M36 18c2-4 6-5 9-3M44 26c3-2 7-1 8 2M40 13l1-4M50 20l4-2" stroke="#FF6B5B" stroke-width="2.5" stroke-linecap="round" fill="none"/><circle cx="47" cy="34" r="2.2" fill="#3D5AFE"/><circle cx="30" cy="16" r="2" fill="#0B7A6C"/></svg>',
    thumb: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 21H4V10h3zM7 10l4-7c1.4 0 2.4 1.1 2.2 2.5L12.6 9H19a2 2 0 0 1 2 2.4l-1.4 7.2A3 3 0 0 1 16.7 21H7" fill="currentColor"/></svg>',
    heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5S3.5 15 3.5 9.2A4.7 4.7 0 0 1 12 6.4a4.7 4.7 0 0 1 8.5 2.8C20.5 15 12 20.5 12 20.5z" fill="currentColor"/></svg>'
  };
  function icon(name, cls) { var s = h('span', { class: 'ic' + (cls ? ' ' + cls : ''), html: I[name] || '' }); return s; }

  /** Face drawn for an emoji Likert point: mood from -1 (sad) to +1 (happy) */
  function face(mood, fill) {
    var curve = Math.round(mood * 7);
    var mouth = 'M8 ' + (15.5 - curve * 0.25) + ' Q12 ' + (15.5 + curve * 0.6) + ' 16 ' + (15.5 - curve * 0.25);
    var brows = mood < -0.6 ? '<path d="M7.3 8.2l2.6 1M16.7 8.2l-2.6 1" stroke="#1E2433" stroke-width="1.4" stroke-linecap="round"/>' : '';
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10.5" fill="' + fill + '"/>' + brows +
      '<circle cx="8.8" cy="10.3" r="1.35" fill="#1E2433"/><circle cx="15.2" cy="10.3" r="1.35" fill="#1E2433"/>' +
      '<path d="' + mouth + '" fill="none" stroke="#1E2433" stroke-width="1.7" stroke-linecap="round"/></svg>';
  }
  var FACE_COLORS = { 5: ['#F28B82', '#FBC777', '#D5D9E2', '#A8DDB5', '#5CC489'], 7: ['#F28B82', '#F7A97E', '#FBC777', '#D5D9E2', '#C2E6B0', '#A8DDB5', '#5CC489'] };
  function faceColors(n) {
    if (FACE_COLORS[n]) return FACE_COLORS[n];
    var base = FACE_COLORS[5], out = [];
    for (var i = 0; i < n; i++) out.push(base[Math.round(i * 4 / Math.max(1, n - 1))]);
    return out;
  }

  /* ---------- device info for metadata ---------- */
  function deviceInfo() {
    var ua = navigator.userAgent || '';
    var w = Math.min(W.screen ? W.screen.width : W.innerWidth, W.innerWidth || 9999);
    var device = /iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua)) ? 'tablet' : /Mobi|Android|iPhone/i.test(ua) ? 'mobile' : 'desktop';
    var browser = /WhatsApp/i.test(ua) ? 'whatsapp' : /FBAN|FBAV|FB_IAB/i.test(ua) ? 'facebook' : /Instagram/i.test(ua) ? 'instagram' :
      /SamsungBrowser/i.test(ua) ? 'samsung' : /EdgA?\//i.test(ua) ? 'edge' : /Firefox|FxiOS/i.test(ua) ? 'firefox' : /CriOS|Chrome/i.test(ua) ? (/; wv\)/.test(ua) ? 'android_webview' : 'chrome') :
      /Safari/i.test(ua) ? 'safari' : 'other';
    return { device: device, screen_width: Math.round(w), browser: browser };
  }

  App.util = { h: h, add: add, esc: esc, rich: rich, $: $, $$: $$, store: store, uid: uid, t: t, T: T, icon: icon, I: I, face: face, faceColors: faceColors, deviceInfo: deviceInfo, reduceMotion: reduceMotion };
})();

/* ==========================================================================
   Respondent page: state, saving on the phone, talking to the server
   ========================================================================== */
(function () {
  'use strict';
  var W = window, App = W.SurveyApp, U = App.util;

  var params = {};
  (W.location.search || '').replace(/^\?/, '').split('&').forEach(function (p) {
    if (!p) return; var i = p.indexOf('=');
    var k = decodeURIComponent(i < 0 ? p : p.slice(0, i)), v = i < 0 ? '' : decodeURIComponent(p.slice(i + 1).replace(/\+/g, ' '));
    params[k] = v;
  });
  var cfg = W.SURVEY || {};
  App.cfg = {
    api: params.api || cfg.api || '',
    code: cfg.code || params.code || '',
    preview: params.preview || cfg.preview || '',
    media_base: cfg.media_base || '',
    src: (params.src || '').replace(/[^\w-]/g, '').slice(0, 30),
    ext_id: (params.id || '').replace(/[^\w-]/g, '').slice(0, 60),
    lang: params.lang === 'ml' || params.lang === 'en' ? params.lang : ''
  };

  /* ---------- server calls ---------- */
  function request(body, timeoutMs) {
    // text/plain keeps this a "simple" request, which browsers allow cross-site
    return new Promise(function (resolve, reject) {
      var done = false;
      var timer = setTimeout(function () { if (!done) { done = true; reject(new Error('timeout')); } }, timeoutMs || 30000);
      var opts = body ? { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), redirect: 'follow' } : { method: 'GET', redirect: 'follow' };
      var url = App.cfg.api + (body ? '' : (App.cfg.api.indexOf('?') >= 0 ? '&' : '?') + 'action=config' + (App.cfg.preview ? '&preview=' + encodeURIComponent(App.cfg.preview) : '') + '&t=' + Date.now());
      fetch(url, opts).then(function (r) { return r.text(); }).then(function (txt) {
        if (done) return; done = true; clearTimeout(timer);
        var j; try { j = JSON.parse(txt); } catch (e) { return reject(new Error('bad_response')); }
        resolve(j);
      }).catch(function (e) { if (!done) { done = true; clearTimeout(timer); reject(e); } });
    });
  }

  /** Retry with growing waits while the server is busy or the phone is offline */
  function call(body, opt) {
    opt = opt || {};
    var tries = 0, max = opt.tries || 6;
    return new Promise(function (resolve, reject) {
      function attempt() {
        tries++;
        request(body, opt.timeout).then(function (j) {
          if (j && j.busy && tries < max) return later();
          resolve(j);
        }).catch(function (e) {
          if (tries < max) return later();
          reject(e);
        });
      }
      function later() {
        var wait = Math.min(30000, 1000 * Math.pow(2, tries - 1)) * (0.75 + Math.random() * 0.5);
        if (opt.onRetry) opt.onRetry(tries);
        setTimeout(attempt, wait);
      }
      attempt();
    });
  }
  App.call = call;
  App.loadConfig = function () { return call(null, { tries: 4, timeout: 20000 }); };

  /* ---------- state kept on the phone ---------- */
  function key() { return 'svy:' + (App.cfg.code || 'study') + (App.preview ? ':test' : ''); }
  App.newState = function () {
    return {
      v: 1, status: 'new', lang: App.cfg.lang || '', lang_switches: 0, answers: {}, orders: {}, blocksDone: [], block: '', focus: '',
      timings: {}, firstSeen: {}, started: 0, src: App.cfg.src, ext_id: App.cfg.ext_id, outbox: [], cheered: [], q_version: ''
    };
  };
  App.load = function () {
    var s = U.store.json(key());
    App.st = s && s.v === 1 ? s : App.newState();
    if (!App.st.src && App.cfg.src) App.st.src = App.cfg.src;
    return App.st;
  };
  var saveTimer = null;
  App.save = function (now) {
    clearTimeout(saveTimer);
    var write = function () { U.store.set(key(), JSON.stringify(App.st)); };
    if (now) write(); else saveTimer = setTimeout(write, 150);
  };
  App.reset = function () { U.store.del(key()); App.st = App.newState(); };
  App.deviceId = function () {
    var id = U.store.get('svy:device');
    if (!id) { id = U.uid(16); U.store.set('svy:device', id); }
    return id;
  };
  App.markDone = function () { if (!App.preview) U.store.set('svy:done:' + App.cfg.code, '1'); };
  App.isDoneHere = function () { return !App.preview && U.store.get('svy:done:' + App.cfg.code) === '1'; };

  /* ---------- the outbox: checkpoints and the final submit ---------- */
  var flushing = false, listeners = [];
  App.onOutbox = function (fn) { listeners.push(fn); };
  function notify(ev, data) { listeners.forEach(function (fn) { try { fn(ev, data); } catch (e) { } }); }

  App.payload = function (action, extra) {
    var st = App.st;
    var prog = SV.progress(App.def, st);
    var body = {
      action: action, resp_id: st.resp_id, secret: st.secret, q_version: st.q_version,
      last_block: st.blocksDone[st.blocksDone.length - 1] || '', pct: prog.pct,
      state: {
        answers: st.answers, condition: st.condition, lang: st.lang, lang_switches: st.lang_switches,
        orders: st.orders, blocksDone: st.blocksDone, block: st.block, src: st.src
      },
      timings: App.timingsOut()
    };
    if (extra) Object.keys(extra).forEach(function (k) { body[k] = extra[k]; });
    return body;
  };

  App.queue = function (body) {
    var box = App.st.outbox;
    // only the newest checkpoint matters
    if (body.action === 'checkpoint') for (var i = box.length - 1; i >= 0; i--) if (box[i].action === 'checkpoint') box.splice(i, 1);
    box.push(body);
    App.save(true);
    return App.flush();
  };

  var retryWait = 1000, retryTimer = null;
  App.flush = function () {
    if (flushing) return Promise.resolve();
    var box = App.st.outbox;
    if (!box.length) { notify('idle'); return Promise.resolve(); }
    flushing = true;
    notify('saving');
    var item = box[0];
    return request(item, 30000).then(function (j) {
      flushing = false;
      if (j && j.busy) throw new Error('busy');
      if (!j || (!j.ok && !j.already)) {
        // the server refused this item; it cannot succeed by retrying
        box.shift(); App.save(true);
        notify('rejected', { item: item, res: j });
        return App.flush();
      }
      box.shift(); App.save(true);
      retryWait = 1000;
      notify('saved', { item: item, res: j });
      return App.flush();
    }).catch(function () {
      flushing = false;
      notify('offline');
      clearTimeout(retryTimer);
      retryTimer = setTimeout(App.flush, retryWait * (0.75 + Math.random() * 0.5));
      retryWait = Math.min(30000, retryWait * 2);
    });
  };
  W.addEventListener('online', function () { retryWait = 1000; App.flush(); });

  /* ---------- time on each question ---------- */
  var cur = null, curStart = 0, visible = !document.hidden;
  App.timeFocus = function (id) {
    var now = performance.now();
    if (cur && visible) App.addTime('t_' + cur, now - curStart);
    cur = id; curStart = now;
    if (id && !App.st.firstSeen[id]) App.st.firstSeen[id] = Date.now();
  };
  App.addTime = function (k, ms) { App.st.timings[k] = (App.st.timings[k] || 0) + Math.round(ms); };
  App.firstAnswer = function (id) {
    var k = 'fa_' + id;
    if (App.st.timings[k] === undefined && App.st.firstSeen[id]) App.st.timings[k] = Date.now() - App.st.firstSeen[id];
  };
  document.addEventListener('visibilitychange', function () {
    var now = performance.now();
    if (document.hidden) { if (cur) App.addTime('t_' + cur, now - curStart); visible = false; App.save(true); }
    else { visible = true; curStart = now; }
  });
  App.timingsOut = function () {
    var o = {};
    Object.keys(App.st.timings).forEach(function (k) { o[k] = App.st.timings[k]; });
    if (cur && visible) o['t_' + cur] = (o['t_' + cur] || 0) + Math.round(performance.now() - curStart);
    if (App.st.started) o.total_ms = Date.now() - App.st.started;
    return o;
  };

  /* ---------- text helpers ---------- */
  App.L = function (obj, field) { return SV.label(obj, field, App.st.lang); };
  App.setting = function (k) {
    var d = App.def;
    var ml = d.settings_ml && d.settings_ml[k];
    return App.st.lang === 'ml' && ml ? ml : (d.settings[k] || '');
  };
  App.optLabel = function (o) { return App.st.lang === 'ml' && o.ml ? o.ml : o.en; };
  /** {q_id} inserts an earlier answer in the respondent's language */
  App.pipe = function (text) {
    return String(text || '').replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, function (m, id) {
      var q = SV.qById(App.def, id);
      if (!q) return m;
      var v = App.st.answers[id];
      if (SV.isEmpty(v)) return '…';
      var opts = q.opts || [];
      var lab = function (c) { for (var i = 0; i < opts.length; i++) if (String(opts[i].code) === String(c)) return opts[i].special === 'other' && App.st.answers[id + '_other'] ? App.st.answers[id + '_other'] : App.optLabel(opts[i]); return c; };
      if (Array.isArray(v)) return v.map(lab).join(', ');
      if (typeof v === 'object') return '';
      return opts.length ? lab(v) : String(v);
    });
  };
  App.mediaSrc = function (src) {
    if (!src) return '';
    if (/^(https?:|data:|blob:)/.test(src)) return src;
    return (App.cfg.media_base || '') + src.replace(/^\/+/, '');
  };
})();

/* ==========================================================================
   Respondent page: one renderer per question type
   Each renderer gets ctx = {q, get(), set(value, advance), setOther(text), card}
   and returns the element to place in the card body.
   ========================================================================== */
(function () {
  'use strict';
  var App = window.SurveyApp, U = App.util, h = U.h, t = U.t;
  var types = App.types = {};
  App.okTypes = { short_text: 1, paragraph: 1, checkbox: 1, slider: 1, date: 1, time: 1, file_upload: 1, checkbox_grid: 1, phone: 1, dropdown: 0, info: 1 };

  function S(q) { return q.settings || {}; }
  function sml(q, k) { var s = S(q); return App.st.lang === 'ml' && s[k + '_ml'] ? s[k + '_ml'] : (s[k] || ''); }
  function orderedOpts(q) {
    var order = App.st.orders['opt:' + q.id];
    var opts = (q.opts || []).slice();
    if (!order) return opts;
    return order.map(function (c) { for (var i = 0; i < opts.length; i++) if (String(opts[i].code) === String(c)) return opts[i]; return null; }).filter(Boolean);
  }
  function codeEq(a, b) { return String(a) === String(b); }
  function optButton(o, role, selected, onClick, extraCls) {
    var b = h('button', { type: 'button', class: 'opt ' + (extraCls || '') + (o.img ? ' has-img' : ''), role: role, 'aria-checked': selected ? 'true' : 'false', 'data-code': o.code, onclick: onClick });
    if (o.img) b.appendChild(h('img', { src: App.mediaSrc(o.img), alt: '', loading: 'lazy' }));
    b.appendChild(h('span', { class: 'mark' + (role === 'checkbox' ? ' sq' : '') }, U.icon('check')));
    b.appendChild(h('span', { class: 'opt-label', text: App.pipe(App.optLabel(o)) }));
    return b;
  }
  function otherBox(ctx) {
    var inp = h('input', { type: 'text', class: 'text-in other-in', maxlength: 120, placeholder: t('other_ph'), value: App.st.answers[ctx.q.id + '_other'] || '', 'aria-label': t('other_ph') });
    inp.addEventListener('input', function () { ctx.setOther(inp.value); });
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); ctx.ok(); } });
    return inp;
  }

  /* ---------- single choice ---------- */
  types.single = function (ctx) {
    var q = ctx.q, cols = Number(S(q).columns) || ((q.opts || []).some(function (o) { return o.img; }) ? 2 : 1);
    var wrap = h('div', { class: 'opts cols-' + cols, role: 'radiogroup' });
    var other = null;
    function draw() {
      wrap.innerHTML = '';
      var v = ctx.get();
      orderedOpts(q).forEach(function (o) {
        wrap.appendChild(optButton(o, 'radio', codeEq(v, o.code), function () {
          var isOther = o.special === 'other';
          ctx.set(o.code, !isOther);
          draw();
          if (isOther && other) setTimeout(function () { other.focus(); }, 50);
        }));
        if (o.special === 'other' && codeEq(v, o.code)) { other = otherBox(ctx); wrap.appendChild(other); }
      });
    }
    draw();
    return wrap;
  };

  /* ---------- several choices ---------- */
  types.checkbox = function (ctx) {
    var q = ctx.q, s = S(q), max = Number(s.max) || 0;
    var cols = Number(s.columns) || ((q.opts || []).some(function (o) { return o.img; }) ? 2 : 1);
    var wrap = h('div', { class: 'opts cols-' + cols, role: 'group' });
    function draw() {
      wrap.innerHTML = '';
      var v = (ctx.get() || []).slice();
      orderedOpts(q).forEach(function (o) {
        var on = v.some(function (c) { return codeEq(c, o.code); });
        wrap.appendChild(optButton(o, 'checkbox', on, function () {
          var cur = (ctx.get() || []).slice();
          var excl = o.special === 'none' || codeEq(s.exclusive, o.code);
          if (on) cur = cur.filter(function (c) { return !codeEq(c, o.code); });
          else {
            if (excl) cur = [o.code];
            else {
              cur = cur.filter(function (c) { var oo = find(q, c); return !(oo && (oo.special === 'none' || codeEq(s.exclusive, c))); });
              if (max && cur.length >= max) { ctx.error(t('max_n', { n: max })); return; }
              cur.push(o.code);
            }
          }
          ctx.error('');
          ctx.set(cur, false);
          draw();
        }));
        if (o.special === 'other' && on) wrap.appendChild(otherBox(ctx));
      });
    }
    draw();
    return wrap;
  };
  function find(q, code) { for (var i = 0; i < (q.opts || []).length; i++) if (codeEq(q.opts[i].code, code)) return q.opts[i]; return null; }

  /* ---------- searchable dropdown (bottom sheet) ---------- */
  types.dropdown = function (ctx) {
    var q = ctx.q;
    var btn = h('button', { type: 'button', class: 'dd-btn', 'aria-haspopup': 'listbox' });
    var other = h('div');
    function label() {
      var v = ctx.get(), o = find(q, v);
      btn.innerHTML = '';
      btn.appendChild(h('span', { class: o ? 'dd-val' : 'dd-ph', text: o ? App.optLabel(o) : t('choose') }));
      btn.appendChild(U.icon('down'));
      other.innerHTML = '';
      if (o && o.special === 'other') other.appendChild(otherBox(ctx));
    }
    btn.addEventListener('click', function () { openSheet(q, ctx.get(), function (code) { var o = find(q, code); ctx.set(code, !(o && o.special === 'other')); label(); }); });
    label();
    return h('div', { class: 'dd' }, btn, other);
  };
  function openSheet(q, current, pick) {
    var list = h('div', { class: 'sheet-list', role: 'listbox' });
    var search = h('input', { type: 'search', class: 'text-in sheet-search', placeholder: t('search'), 'aria-label': t('search'), autocomplete: 'off' });
    var close = function () { overlay.classList.remove('open'); setTimeout(function () { overlay.remove(); }, 200); document.body.classList.remove('noscroll'); };
    var overlay = h('div', { class: 'sheet-overlay', onclick: function (e) { if (e.target === overlay) close(); } },
      h('div', { class: 'sheet', role: 'dialog', 'aria-label': App.pipe(App.L(q, 'text')) },
        h('div', { class: 'sheet-head' }, h('div', { class: 'sheet-title', text: App.pipe(App.L(q, 'text')) }), h('button', { type: 'button', class: 'sheet-x', 'aria-label': 'Close', onclick: close, text: '×' })),
        (q.opts || []).length > 7 ? search : null, list));
    function draw() {
      var f = search.value.trim().toLowerCase();
      list.innerHTML = '';
      var n = 0;
      orderedOpts(q).forEach(function (o) {
        if (f && (o.en + ' ' + (o.ml || '')).toLowerCase().indexOf(f) < 0) return;
        n++;
        list.appendChild(h('button', { type: 'button', role: 'option', class: 'sheet-item' + (codeEq(current, o.code) ? ' on' : ''), 'aria-selected': codeEq(current, o.code) ? 'true' : 'false', onclick: function () { pick(o.code); close(); } },
          h('span', { text: App.optLabel(o) }), codeEq(current, o.code) ? U.icon('check') : null));
      });
      if (!n) list.appendChild(h('div', { class: 'sheet-empty', text: t('no_match') }));
    }
    search.addEventListener('input', draw);
    draw();
    document.body.appendChild(overlay);
    document.body.classList.add('noscroll');
    requestAnimationFrame(function () { overlay.classList.add('open'); });
    var on = list.querySelector('.on'); if (on) on.scrollIntoView({ block: 'center' });
  }

  /* ---------- row of numbers ---------- */
  types.linear_scale = function (ctx) {
    var q = ctx.q, s = S(q), from = Number(s.from || 1), to = Number(s.to || 5);
    var row = h('div', { class: 'scale-row n' + (to - from + 1), role: 'radiogroup' });
    function draw() {
      row.innerHTML = '';
      for (var i = from; i <= to; i++) (function (i) {
        row.appendChild(h('button', { type: 'button', class: 'num-btn', role: 'radio', 'aria-checked': codeEq(ctx.get(), i) ? 'true' : 'false', text: String(i), onclick: function () { ctx.set(i, true); draw(); } }));
      })(i);
    }
    draw();
    return h('div', {}, row, ends(sml(q, 'left'), sml(q, 'right')));
  };
  function ends(l, r) { return (l || r) ? h('div', { class: 'ends' }, h('span', { text: l }), h('span', { text: r })) : null; }

  /* ---------- emoji / icon Likert ---------- */
  types.likert_emoji = function (ctx) {
    var q = ctx.q, s = S(q), opts = (q.opts || []).filter(function (o) { return !o.special; });
    var pts = opts.length || Number(s.points || 5);
    if (!opts.length) for (var i = 1; i <= pts; i++) opts.push({ code: i, en: String(i), ml: '' });
    var specials = (q.opts || []).filter(function (o) { return o.special; });
    var colors = U.faceColors(pts), kind = s.icons || 'faces';
    var row = h('div', { class: 'likert n' + pts, role: 'radiogroup' });
    var extra = h('div', { class: 'opts likert-extra' });
    function draw() {
      row.innerHTML = ''; extra.innerHTML = '';
      opts.forEach(function (o, idx) {
        var mood = pts > 1 ? (idx / (pts - 1)) * 2 - 1 : 0;
        var sel = codeEq(ctx.get(), o.code);
        var pic;
        if (kind === 'thumbs') pic = h('span', { class: 'lk-ic thumb', style: 'transform:rotate(' + Math.round(180 - (idx / Math.max(1, pts - 1)) * 180) + 'deg);color:' + colors[idx], html: U.I.thumb });
        else if (kind === 'hearts') pic = h('span', { class: 'lk-ic heart', style: 'color:' + colors[idx] + ';transform:scale(' + (0.6 + 0.4 * idx / Math.max(1, pts - 1)) + ')', html: U.I.heart });
        else pic = h('span', { class: 'lk-ic', html: U.face(mood, colors[idx]) });
        row.appendChild(h('button', { type: 'button', class: 'lk', role: 'radio', 'aria-checked': sel ? 'true' : 'false', 'aria-label': App.optLabel(o), onclick: function () { ctx.set(o.code, true); draw(); } },
          pic, h('span', { class: 'lk-label', text: App.optLabel(o) })));
      });
      specials.forEach(function (o) { extra.appendChild(optButton(o, 'radio', codeEq(ctx.get(), o.code), function () { ctx.set(o.code, true); draw(); }, 'slim')); });
    }
    draw();
    return h('div', {}, row, specials.length ? extra : null);
  };

  /* ---------- stars ---------- */
  types.star_rating = function (ctx) {
    var n = Number(S(ctx.q).stars || 5);
    var row = h('div', { class: 'stars', role: 'radiogroup' });
    var cap = h('div', { class: 'star-cap', 'aria-live': 'polite' });
    function draw() {
      row.innerHTML = '';
      var v = Number(ctx.get()) || 0;
      for (var i = 1; i <= n; i++) (function (i) {
        row.appendChild(h('button', { type: 'button', class: 'star' + (i <= v ? ' on' : ''), role: 'radio', 'aria-checked': i === v ? 'true' : 'false', 'aria-label': t('stars_of', { n: i, m: n }), html: U.I.star, onclick: function () { ctx.set(i, true); draw(); } }));
      })(i);
      cap.textContent = v ? t('stars_of', { n: v, m: n }) : '';
    }
    draw();
    return h('div', {}, row, cap);
  };

  /* ---------- slider without a starting handle ---------- */
  types.slider = function (ctx) {
    var q = ctx.q, s = S(q), min = Number(s.min || 0), max = Number(s.max || 100), step = Number(s.step || 1);
    var v = ctx.get();
    var touched = v !== undefined && v !== '' && v !== null;
    var inp = h('input', { type: 'range', min: min, max: max, step: step, value: touched ? v : (min + max) / 2, class: 'slider' + (touched ? '' : ' untouched'), 'aria-label': App.pipe(App.L(q, 'text')) });
    var bubble = h('div', { class: 'slider-val', 'aria-live': 'polite' });
    var hint = h('div', { class: 'slider-hint', text: t('tap_slider') });
    function show() {
      var x = Number(inp.value);
      var pct = (x - min) / (max - min || 1) * 100;
      inp.style.setProperty('--p', pct + '%');
      if (s.show_value !== 'no' && !inp.classList.contains('untouched')) {
        bubble.textContent = (s.prefix || '') + x.toLocaleString('en-IN') + (s.suffix || '');
        bubble.style.left = 'calc(' + pct + '% + ' + (12 - pct * 0.24) + 'px)';
        bubble.hidden = false;
      } else bubble.hidden = true;
      hint.hidden = !inp.classList.contains('untouched');
    }
    function touch() { inp.classList.remove('untouched'); ctx.set(Number(inp.value), false); show(); }
    inp.addEventListener('input', touch);
    inp.addEventListener('change', touch);
    inp.addEventListener('pointerdown', function () { if (inp.classList.contains('untouched')) setTimeout(touch, 0); });
    show();
    return h('div', { class: 'slider-wrap' }, h('div', { class: 'slider-track-wrap' }, bubble, inp), ends(sml(q, 'left') || ((s.prefix || '') + min), sml(q, 'right') || ((s.prefix || '') + max)), hint);
  };

  /* ---------- semantic differential: one card per pair ---------- */
  types.semantic_diff = function (ctx) {
    var q = ctx.q, pts = Number(S(q).points || 7);
    var wrap = h('div', { class: 'rows' });
    (q.rows || []).forEach(function (r, ri) {
      var card = h('div', { class: 'row-card', 'data-row': r.code });
      var left = App.st.lang === 'ml' && r.ml ? r.ml : r.en, right = App.st.lang === 'ml' && r.ml2 ? r.ml2 : r.en2;
      var btns = h('div', { class: 'sd-row n' + pts, role: 'radiogroup', 'aria-label': left + ' / ' + right });
      function draw() {
        btns.innerHTML = '';
        var cur = (ctx.get() || {})[r.code];
        for (var i = 1; i <= pts; i++) (function (i) {
          var dist = Math.abs(i - (pts + 1) / 2) / ((pts - 1) / 2);
          btns.appendChild(h('button', { type: 'button', class: 'sd-dot', role: 'radio', style: '--s:' + (0.62 + 0.38 * dist), 'aria-checked': codeEq(cur, i) ? 'true' : 'false', 'aria-label': String(i), onclick: function () {
            var v = Object.assign({}, ctx.get() || {}); v[r.code] = i; ctx.set(v, false); draw(); ctx.nextRow(card, ri === q.rows.length - 1);
          } }, h('span')));
        })(i);
      }
      draw();
      card.appendChild(h('div', { class: 'sd-labels' }, h('span', { text: left }), h('span', { text: right })));
      card.appendChild(btns);
      wrap.appendChild(card);
    });
    return wrap;
  };

  /* ---------- NPS 0 to 10 ---------- */
  types.nps = function (ctx) {
    var row = h('div', { class: 'nps', role: 'radiogroup' });
    var colors = ['#F8C9C4', '#F8C9C4', '#F8C9C4', '#F8C9C4', '#F8C9C4', '#F8C9C4', '#F8C9C4', '#FCE3A8', '#FCE3A8', '#BDE7CB', '#BDE7CB'];
    function draw() {
      row.innerHTML = '';
      for (var i = 0; i <= 10; i++) (function (i) {
        row.appendChild(h('button', { type: 'button', class: 'num-btn nps-btn', role: 'radio', style: '--c:' + colors[i], 'aria-checked': codeEq(ctx.get(), i) ? 'true' : 'false', text: String(i), onclick: function () { ctx.set(i, true); draw(); } }));
      })(i);
    }
    draw();
    return h('div', {}, row, ends(sml(ctx.q, 'left') || t('not_likely'), sml(ctx.q, 'right') || t('very_likely')));
  };

  /* ---------- grids: one small card per row ---------- */
  function grid(ctx, multi) {
    var q = ctx.q, wrap = h('div', { class: 'rows' });
    (q.rows || []).forEach(function (r, ri) {
      var card = h('div', { class: 'row-card', 'data-row': r.code });
      var opts = h('div', { class: 'chips', role: multi ? 'group' : 'radiogroup' });
      function draw() {
        opts.innerHTML = '';
        var cur = (ctx.get() || {})[r.code];
        (q.opts || []).forEach(function (o) {
          var on = multi ? (cur || []).some(function (c) { return codeEq(c, o.code); }) : codeEq(cur, o.code);
          opts.appendChild(h('button', { type: 'button', class: 'chip', role: multi ? 'checkbox' : 'radio', 'aria-checked': on ? 'true' : 'false', onclick: function () {
            var v = Object.assign({}, ctx.get() || {});
            if (multi) {
              var list = (v[r.code] || []).slice();
              if (on) list = list.filter(function (c) { return !codeEq(c, o.code); }); else list.push(o.code);
              v[r.code] = list;
              ctx.set(v, false); draw();
            } else { v[r.code] = o.code; ctx.set(v, false); draw(); ctx.nextRow(card, ri === q.rows.length - 1); }
          } }, multi ? h('span', { class: 'mark sq' }, U.icon('check')) : null, h('span', { text: App.optLabel(o) })));
        });
      }
      draw();
      card.appendChild(h('div', { class: 'row-label', text: App.st.lang === 'ml' && r.ml ? r.ml : r.en }));
      card.appendChild(opts);
      wrap.appendChild(card);
    });
    return wrap;
  }
  types.mc_grid = function (ctx) { return grid(ctx, false); };
  types.checkbox_grid = function (ctx) { return grid(ctx, true); };

  /* ---------- text ---------- */
  types.short_text = function (ctx) {
    var s = S(ctx.q), f = s.format;
    var inp = h('input', {
      class: 'text-in', type: f === 'email' ? 'email' : f === 'phone' ? 'tel' : 'text', inputmode: f === 'number' ? (String(s.min || 0).indexOf('-') === 0 || s.decimals ? 'decimal' : 'numeric') : f === 'phone' ? 'tel' : f === 'email' ? 'email' : null,
      maxlength: s.maxlength || (f === 'number' ? 12 : 200), autocomplete: 'off', placeholder: t('your_answer'), 'aria-label': App.pipe(App.L(ctx.q, 'text')),
      value: ctx.get() === undefined ? '' : ctx.get()
    });
    inp.addEventListener('input', function () {
      var v = inp.value;
      if (f === 'number') { v = v.replace(/[^\d.\-]/g, ''); if (v !== inp.value) inp.value = v; }
      ctx.set(f === 'number' && v !== '' && !isNaN(Number(v)) ? Number(v) : v, false);
    });
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); ctx.ok(); } });
    return inp;
  };
  types.paragraph = function (ctx) {
    var s = S(ctx.q), max = Number(s.maxlength || 1000);
    var ta = h('textarea', { class: 'text-in para', rows: 3, maxlength: max, placeholder: t('your_answer'), 'aria-label': App.pipe(App.L(ctx.q, 'text')) });
    ta.value = ctx.get() || '';
    var count = h('div', { class: 'count' });
    function grow() { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight + 2, 360) + 'px'; }
    function upd() {
      var words = ta.value.trim() ? ta.value.trim().split(/\s+/).length : 0;
      count.textContent = (s.min_words ? t('words', { n: words }) + ' · ' : '') + t('chars_left', { n: max - ta.value.length });
    }
    ta.addEventListener('input', function () { grow(); upd(); ctx.set(ta.value, false); });
    setTimeout(grow, 0); upd();
    return h('div', {}, ta, count);
  };
  types.date = function (ctx) {
    var s = S(ctx.q);
    function d(x) { if (!x) return null; if (x === 'today') { var n = new Date(); return new Date(n.getTime() - n.getTimezoneOffset() * 60000).toISOString().slice(0, 10); } return x; }
    var inp = h('input', { type: 'date', class: 'text-in', min: d(s.min), max: d(s.max), value: ctx.get() || '', 'aria-label': App.pipe(App.L(ctx.q, 'text')) });
    inp.addEventListener('change', function () { ctx.set(inp.value, false); });
    inp.addEventListener('input', function () { ctx.set(inp.value, false); });
    return inp;
  };
  types.time = function (ctx) {
    var inp = h('input', { type: 'time', class: 'text-in', value: ctx.get() || '', 'aria-label': App.pipe(App.L(ctx.q, 'text')) });
    inp.addEventListener('change', function () { ctx.set(inp.value, false); });
    inp.addEventListener('input', function () { ctx.set(inp.value, false); });
    return inp;
  };
  types.phone = function (ctx) {
    var inp = h('input', { type: 'tel', class: 'text-in phone-in', inputmode: 'numeric', maxlength: 10, autocomplete: 'tel-national', placeholder: '98765 43210', value: ctx.get() || '', 'aria-label': App.pipe(App.L(ctx.q, 'text')) });
    inp.addEventListener('input', function () { var v = inp.value.replace(/\D/g, '').slice(0, 10); if (v !== inp.value) inp.value = v; ctx.set(v, false); });
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); ctx.ok(); } });
    return h('div', { class: 'phone' }, h('span', { class: 'cc', text: '+91' }), inp);
  };

  /* ---------- consent item inside the questionnaire ---------- */
  types.consent = function (ctx) {
    var wrap = h('div', { class: 'opts' });
    function draw() {
      wrap.innerHTML = '';
      [[1, t('agree_c')], [0, t('disagree_c')]].forEach(function (p) {
        wrap.appendChild(optButton({ code: p[0], en: p[1] }, 'radio', codeEq(ctx.get(), p[0]), function () { ctx.set(p[0], true); draw(); }));
      });
    }
    draw();
    return wrap;
  };

  /* ---------- file upload ---------- */
  types.file_upload = function (ctx) {
    var s = S(ctx.q), maxMb = Number(s.max_mb || 5), allow = (s.types || 'image,pdf');
    var accept = allow.split(',').map(function (x) { x = x.trim(); return x === 'image' ? 'image/*' : x === 'pdf' ? 'application/pdf' : ''; }).filter(Boolean).join(',');
    var status = h('div', { class: 'up-status', 'aria-live': 'polite' });
    var preview = h('div', { class: 'up-preview' });
    var cam = h('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true });
    var pick = h('input', { type: 'file', accept: accept, hidden: true });
    var btns = h('div', { class: 'up-btns' },
      allow.indexOf('image') >= 0 ? h('button', { type: 'button', class: 'btn-soft', onclick: function () { cam.click(); } }, U.icon('camera'), h('span', { text: t('take_photo') })) : null,
      h('button', { type: 'button', class: 'btn-soft', onclick: function () { pick.click(); } }, U.icon('file'), h('span', { text: t('choose_file') })));
    function showDone(v) {
      preview.innerHTML = '';
      if (!v || !v.url) return;
      preview.appendChild(h('div', { class: 'up-done' }, U.icon('check'), h('span', { text: (v.name || '') + ' · ' + t('uploaded') }),
        h('button', { type: 'button', class: 'link-btn', text: t('remove'), onclick: function () { ctx.set('', false); showDone(null); } })));
    }
    function handle(file) {
      if (!file) return;
      ctx.error('');
      if (!/^image\//.test(file.type) && file.type !== 'application/pdf') return ctx.error(t('wrong_type'));
      if (!App.st.resp_id) return ctx.error(t('upload_failed'));
      var go = function (blob, name) {
        if (blob.size > maxMb * 1048576) return ctx.error(t('too_big', { n: maxMb }));
        status.textContent = t('uploading');
        btns.classList.add('busy');
        var r = new FileReader();
        r.onload = function () {
          App.call({ action: 'upload', resp_id: App.st.resp_id, secret: App.st.secret, qid: ctx.q.id, name: name, mime: blob.type, max_mb: maxMb, data: String(r.result).split(',')[1] }, { tries: 3, timeout: 90000 })
            .then(function (j) {
              btns.classList.remove('busy'); status.textContent = '';
              if (!j.ok) return ctx.error(j.error === 'too_large' ? t('too_big', { n: maxMb }) : t('upload_failed'));
              var v = { url: j.url, name: name };
              ctx.set(v, false); showDone(v); ctx.ok();
            }).catch(function () { btns.classList.remove('busy'); status.textContent = ''; ctx.error(t('upload_failed')); });
        };
        r.readAsDataURL(blob);
      };
      if (/^image\/(jpeg|png|webp)/.test(file.type)) shrink(file, function (b) { go(b, file.name.replace(/\.\w+$/, '') + '.jpg'); });
      else go(file, file.name);
    }
    cam.addEventListener('change', function () { handle(cam.files[0]); cam.value = ''; });
    pick.addEventListener('change', function () { handle(pick.files[0]); pick.value = ''; });
    showDone(ctx.get());
    return h('div', { class: 'upload' }, btns, cam, pick, status, preview);
  };
  /** Phone photos are huge; send a 1600 px JPEG instead */
  function shrink(file, cb) {
    var img = new Image(), url = URL.createObjectURL(file);
    img.onload = function () {
      var scale = Math.min(1, 1600 / Math.max(img.width, img.height));
      var c = document.createElement('canvas');
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(function (b) { cb(b || file); }, 'image/jpeg', 0.85);
    };
    img.onerror = function () { URL.revokeObjectURL(url); cb(file); };
    img.src = url;
  }

  types.info = function () { return null; };
  types.end = function () { return null; };
  types.stimulus = function (ctx) { return App.media.stimulus(ctx); };

  /* ---------- checks before moving on ---------- */
  App.checkAnswer = function (q, v, forContinue) {
    var s = S(q);
    var required = q.required || (q.type === 'phone' && String(App.def.settings.collect_phone).toLowerCase() === 'required');
    var empty = !SV.isAnswered(q, v);
    if (q.type === 'checkbox_grid') empty = SV.isEmpty(v) || !(q.rows || []).some(function (r) { return v[r.code] && v[r.code].length; });
    if (empty) {
      if (required && forContinue) return (q.type === 'mc_grid' || q.type === 'semantic_diff') && !SV.isEmpty(v) ? t('required_rows') : t('required');
      if ((q.type === 'mc_grid' || q.type === 'semantic_diff') && !SV.isEmpty(v) && required) return t('required_rows');
      return '';
    }
    if (q.type === 'short_text' && s.format === 'number') {
      if (isNaN(Number(v))) return t('num_only');
      var mn = s.min !== undefined ? Number(s.min) : -Infinity, mx = s.max !== undefined ? Number(s.max) : Infinity;
      if (Number(v) < mn || Number(v) > mx) return t('num_range', { a: s.min, b: s.max });
    }
    if (q.type === 'short_text' && s.format === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return t('email_bad');
    if (q.type === 'phone' && !/^[6-9]\d{9}$/.test(String(v))) return t('phone_bad');
    if (q.type === 'paragraph' && s.min_words && String(v).trim().split(/\s+/).length < Number(s.min_words)) return t('min_words', { n: s.min_words });
    if (q.type === 'checkbox' && s.min && v.length < Number(s.min) && !(v.length === 1 && (find(q, v[0]) || {}).special === 'none')) return t('min_n', { n: s.min });
    return '';
  };
})();

/* ==========================================================================
   Respondent page: stimulus screens (video, audio, image, YouTube)
   ========================================================================== */
(function () {
  'use strict';
  var App = window.SurveyApp, U = App.util, h = U.h, t = U.t;

  function rec(mid, k, v) { App.st.timings['st_' + mid + '_' + k] = v; App.save(); }
  function bump(mid, k, by) { var key = 'st_' + mid + '_' + k; App.st.timings[key] = Math.round(((App.st.timings[key] || 0) + by) * 100) / 100; }

  /** Media shown above an ordinary question (no viewing rules) */
  function inline(m) {
    if (!m) return null;
    var src = App.mediaSrc(m.src);
    var cap = App.L(m, 'caption');
    if (m.type === 'image') return h('figure', { class: 'q-media' }, h('img', { src: src, alt: cap || '', loading: 'lazy' }), cap ? h('figcaption', { text: cap }) : null);
    if (m.type === 'video') return h('figure', { class: 'q-media' }, h('video', { src: src, controls: true, playsinline: true, preload: 'metadata', poster: m.poster ? App.mediaSrc(m.poster) : null }), cap ? h('figcaption', { text: cap }) : null);
    if (m.type === 'audio') return h('figure', { class: 'q-media' }, h('audio', { src: src, controls: true, preload: 'metadata' }));
    return null;
  }

  function stimulus(ctx) {
    var m = App.def.media[ctx.q.media];
    if (!m) return h('div', { class: 'q-err show', text: 'Missing media: ' + ctx.q.media });
    if (m.type === 'image') return imageStim(ctx, m);
    if (m.type === 'youtube') return youtubeStim(ctx, m);
    return playerStim(ctx, m);
  }

  /* ---------- MP4 video or audio with our own controls ---------- */
  function playerStim(ctx, m) {
    var mid = m.id, isAudio = m.type === 'audio';
    var el = h(isAudio ? 'audio' : 'video', { src: App.mediaSrc(m.src), playsinline: true, 'webkit-playsinline': true, preload: 'auto', poster: !isAudio && m.poster ? App.mediaSrc(m.poster) : null });
    var bar = h('div', { class: 'vbar' }, h('span'));
    var note = h('div', { class: 'stim-note', 'aria-live': 'polite' });
    var big = h('button', { type: 'button', class: 'vplay', 'aria-label': t('tap_play') }, U.icon('play'), h('span', { text: t('tap_play') }));
    var replay = h('button', { type: 'button', class: 'btn-soft vreplay', hidden: true, onclick: function () { el.currentTime = 0; bump(mid, 'replays', 1); el.play(); } }, U.icon('replay'), h('span', { text: t('replay') }));
    var stage = h('div', { class: 'vstage' + (isAudio ? ' audio' : '') }, isAudio ? h('div', { class: 'audio-art', html: U.I.play }) : null, el, big);
    var maxReached = 0, last = 0;
    var done = App.st.timings['st_' + mid + '_completed'] === 1;
    ctx.satisfied(!m.must_watch || done);
    if (m.must_watch && !done) note.textContent = t('watch_all');
    function toggle() { if (el.paused) el.play(); else el.pause(); }
    big.addEventListener('click', function () { el.play(); });
    stage.addEventListener('click', function (e) { if (e.target !== big && !big.contains(e.target)) toggle(); });
    el.addEventListener('play', function () {
      big.classList.add('hide'); replay.hidden = true;
      if (!App.st.timings['st_' + mid + '_started']) rec(mid, 'started', 1);
      last = el.currentTime;
    });
    el.addEventListener('pause', function () { if (!el.ended) big.classList.remove('hide'); App.save(); });
    el.addEventListener('timeupdate', function () {
      var cur = el.currentTime, d = cur - last;
      if (d > 0 && d < 1.5) bump(mid, 'watched', d);
      last = cur;
      if (cur > maxReached) maxReached = cur;
      if (el.duration) bar.firstChild.style.width = (cur / el.duration * 100) + '%';
    });
    el.addEventListener('seeking', function () {
      if (m.no_seek && el.currentTime > maxReached + 0.4) el.currentTime = maxReached;
      last = el.currentTime;
    });
    el.addEventListener('ended', function () {
      rec(mid, 'completed', 1);
      bar.firstChild.style.width = '100%';
      replay.hidden = false; note.textContent = '';
      ctx.satisfied(true);
      if (App.layout !== 'one_per_screen') setTimeout(function () { ctx.advance(); }, 600);
    });
    if (m.fixed_exposure) ctx.onFocus(function () { setTimeout(function () { el.pause(); ctx.satisfied(true); ctx.advance(); }, m.fixed_exposure * 1000); });
    ctx.onBlur(function () { if (!el.paused) el.pause(); });
    var cap = App.L(m, 'caption');
    return h('div', { class: 'stim' }, stage, bar, h('div', { class: 'stim-foot' }, cap ? h('div', { class: 'stim-cap', text: cap }) : h('span'), replay), note);
  }

  /* ---------- image with minimum view time or fixed exposure ---------- */
  function imageStim(ctx, m) {
    var mid = m.id;
    var img = h('img', { src: App.mediaSrc(m.src), alt: App.L(m, 'caption') || '' });
    var note = h('div', { class: 'stim-note', 'aria-live': 'polite' });
    var box = h('div', { class: 'istage' }, img);
    var need = m.min_view || 0, shown = Number(App.st.timings['st_' + mid + '_viewed_ms'] || 0) / 1000;
    var timer = null, t0 = 0;
    var ok = !need || shown >= need;
    ctx.satisfied(ok && !m.fixed_exposure);
    if (m.fixed_exposure && App.st.timings['st_' + mid + '_completed'] === 1) { box.classList.add('gone'); note.textContent = t('times_up'); ctx.satisfied(true); }
    function tick() {
      var el = shown + (performance.now() - t0) / 1000;
      if (m.fixed_exposure) {
        if (el >= m.fixed_exposure) { stop(); box.classList.add('gone'); note.textContent = t('times_up'); rec(mid, 'completed', 1); ctx.satisfied(true); setTimeout(ctx.advance, 400); }
        return;
      }
      var left = Math.ceil(need - el);
      if (left > 0) note.textContent = t('wait_secs', { n: left });
      else { note.textContent = ''; stop(); rec(mid, 'completed', 1); ctx.satisfied(true); }
    }
    function stop() { if (timer) { shown += (performance.now() - t0) / 1000; rec(mid, 'viewed_ms', Math.round(shown * 1000)); clearInterval(timer); timer = null; } }
    ctx.onFocus(function () {
      if (!App.st.timings['st_' + mid + '_started']) rec(mid, 'started', 1);
      if (timer || (ok && !m.fixed_exposure) || box.classList.contains('gone')) return;
      t0 = performance.now(); timer = setInterval(tick, 250); tick();
    });
    ctx.onBlur(stop);
    var cap = App.L(m, 'caption');
    return h('div', { class: 'stim' }, box, cap ? h('div', { class: 'stim-cap', text: cap }) : null, note);
  }

  /* ---------- unlisted YouTube ---------- */
  var ytReady = null;
  function loadYT() {
    if (ytReady) return ytReady;
    ytReady = new Promise(function (res) {
      if (window.YT && window.YT.Player) return res();
      window.onYouTubeIframeAPIReady = res;
      document.head.appendChild(h('script', { src: 'https://www.youtube.com/iframe_api' }));
    });
    return ytReady;
  }
  function ytId(src) { var m = /(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/.exec(src); return m ? m[1] : src; }
  function youtubeStim(ctx, m) {
    var mid = m.id, holder = h('div'), note = h('div', { class: 'stim-note', 'aria-live': 'polite' });
    var done = App.st.timings['st_' + mid + '_completed'] === 1;
    ctx.satisfied(!m.must_watch || done);
    if (m.must_watch && !done) note.textContent = t('watch_all');
    var poll = null, last = 0;
    loadYT().then(function () {
      var p = new window.YT.Player(holder, {
        videoId: ytId(m.src), playerVars: { playsinline: 1, rel: 0, modestbranding: 1, controls: m.no_seek ? 0 : 1, disablekb: m.no_seek ? 1 : 0, fs: 0 },
        events: {
          onStateChange: function (e) {
            if (e.data === 1) {
              if (!App.st.timings['st_' + mid + '_started']) rec(mid, 'started', 1);
              clearInterval(poll); last = p.getCurrentTime();
              poll = setInterval(function () { var c = p.getCurrentTime(), d = c - last; if (d > 0 && d < 2) bump(mid, 'watched', d); last = c; }, 1000);
            } else clearInterval(poll);
            if (e.data === 0) { rec(mid, 'completed', 1); note.textContent = ''; ctx.satisfied(true); setTimeout(ctx.advance, 600); }
          }
        }
      });
      ctx.onBlur(function () { try { p.pauseVideo(); } catch (e) { } });
    });
    var cap = App.L(m, 'caption');
    return h('div', { class: 'stim' }, h('div', { class: 'yt' }, holder), cap ? h('div', { class: 'stim-cap', text: cap }) : null, note);
  }

  App.media = { stimulus: stimulus, inline: inline };
})();

/* ==========================================================================
   Respondent page: screens and the flow through the questionnaire
   ========================================================================== */
(function () {
  'use strict';
  var W = window, App = W.SurveyApp, U = App.util, h = U.h, t = U.t, $ = U.$, $$ = U.$$;
  var root;
  var cards = {};      // q_id -> {el, q, hooks}
  var curId = '';
  var progUntil = 0;
  var advanceTimer = null;

  /* ---------- fonts and page setup ---------- */
  function addFont(href) { if ($('link[href="' + href + '"]')) return; document.head.appendChild(h('link', { rel: 'stylesheet', href: href })); }
  function fonts() {
    addFont('https://fonts.googleapis.com/css2?family=Baloo+Chettan+2:wght@500;600;700&family=Noto+Sans:wght@400;500;600;700&display=swap');
    if (App.st && App.st.lang === 'ml') addFont('https://fonts.googleapis.com/css2?family=Noto+Sans+Malayalam:wght@400;500;600;700&display=swap');
  }
  function applyLang() {
    document.documentElement.lang = App.st.lang === 'ml' ? 'ml' : 'en';
    document.documentElement.classList.toggle('ml', App.st.lang === 'ml');
    fonts();
  }
  function applyBig() { document.documentElement.classList.toggle('big', U.store.get('svy:big') === '1'); }
  if (U.reduceMotion) document.documentElement.classList.add('reduce');

  function screen(cls) {
    root.innerHTML = '';
    var main = h('main', { class: 'screen ' + (cls || '') });
    root.appendChild(main);
    W.scrollTo(0, 0);
    return main;
  }
  function langs() { return String(App.def.settings.languages || 'en').toLowerCase().indexOf('ml') >= 0; }

  /* ---------- boot ---------- */
  function boot() {
    root = document.getElementById('app') || document.body.appendChild(h('div', { id: 'app' }));
    applyBig();
    App.st = App.newState(); App.st.lang = App.cfg.lang || 'en';
    applyLang();
    var m = screen('center');
    m.appendChild(h('div', { class: 'loader' }, h('span'), h('span'), h('span')));
    m.appendChild(h('p', { class: 'muted', text: t('loading') }));
    if (!App.cfg.api) { failScreen('This page is missing its web app address (api).'); return; }
    var cacheKey = 'svy:def:' + (App.cfg.code || App.cfg.api) + (App.cfg.preview ? ':test' : '');
    App.loadConfig().then(function (res) {
      if (!res || !res.ok) { failScreen(res && res.error === 'not_published' ? t('not_published') : (res && res.error) || t('cant_load')); return; }
      U.store.set(cacheKey, JSON.stringify(res));
      start(res);
    }).catch(function () {
      // offline: carry on with the copy saved on this phone, if the respondent already started
      var cached = U.store.json(cacheKey);
      if (cached && cached.def) {
        App.cfg.code = App.cfg.code || cached.def.settings.short_code;
        var saved = U.store.json('svy:' + App.cfg.code + (cached.preview ? ':test' : ''));
        if (saved && (saved.status === 'active' || saved.status === 'submitting' || saved.status === 'done')) { cached.status = 'open'; start(cached); return; }
      }
      failScreen(t('cant_load'), true);
    });
    function start(res) {
      App.def = res.def; App.preview = !!res.preview; App.status = res.status;
      App.layout = App.def.settings.layout === 'one_per_screen' ? 'one_per_screen' : 'auto_scroll';
      if (!App.cfg.code) App.cfg.code = App.def.settings.short_code;
      App.load();
      if (!App.st.lang) App.st.lang = App.cfg.lang || 'en';
      if (!langs()) App.st.lang = 'en';
      applyLang();
      document.title = App.setting('title') || document.title;
      if (App.preview) testBar();
      route();
      if (App.st.outbox.length) App.flush();
    }
  }

  function failScreen(msg, canRetry) {
    var m = screen('center');
    m.appendChild(h('div', { class: 'card msg' }, U.icon('warn', 'big warn'), h('p', { text: msg }),
      canRetry ? h('button', { type: 'button', class: 'btn', text: t('retry'), onclick: boot }) : null));
  }

  function route() {
    var st = App.st;
    if (st.status === 'done') return finalScreen();
    if (st.status === 'submitting') return savingScreen();
    if (st.status === 'declined') return declinedScreen();
    if (st.status === 'active' && st.resp_id) {
      if (App.status === 'closed') return closedScreen();
      return welcomeBack();
    }
    if (App.isDoneHere() && App.def.settings.one_per_device !== 'no') return messageScreen(t('thanks'), t('done_already'), 'party');
    if (App.status !== 'open') return closedScreen();
    welcome();
  }

  /* ---------- welcome ---------- */
  function estimateMinutes() {
    var d = App.def;
    var ids = d.questions.filter(function (q) { return !q.condition; }).map(function (q) { return q.id; });
    var arm = d.conditions.length ? d.questions.filter(function (q) { return SV.matchCondition(q.condition, d.conditions[0].name); }).map(function (q) { return q.id; }) : [];
    return Math.max(1, Math.round(SV.estimateSecs(d, ids.concat(arm)) / 60));
  }
  function langPicker(onChange) {
    if (!langs()) return null;
    var wrap = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': t('choose_lang') });
    [['en', 'English'], ['ml', 'മലയാളം']].forEach(function (p) {
      wrap.appendChild(h('button', { type: 'button', role: 'radio', class: 'seg-btn' + (p[0] === 'ml' ? ' ml-font' : ''), 'aria-checked': App.st.lang === p[0] ? 'true' : 'false', text: p[1], onclick: function () {
        if (App.st.lang !== p[0]) { App.st.lang = p[0]; App.save(); applyLang(); onChange(); }
      } }));
    });
    return h('div', { class: 'lang-pick' }, h('div', { class: 'lbl', html: U.I.globe + '<span>' + U.esc(t('choose_lang')) + '</span>' }), wrap);
  }
  function welcome() {
    var m = screen('welcome');
    var s = App.setting;
    var code = h('div', { class: 'code-entry', hidden: true });
    m.appendChild(h('div', { class: 'hero' }, h('div', { class: 'hero-art', html: heroArt() })));
    m.appendChild(h('div', { class: 'card welcome-card' },
      h('h1', { class: 'title', text: s('title') }),
      s('description') ? h('p', { class: 'lead', text: s('description') }) : null,
      h('div', { class: 'meta-row' }, h('span', { class: 'pill' }, U.icon('clock'), h('span', { text: t('minutes', { n: estimateMinutes() }) })),
        h('span', { class: 'pill' }, U.icon('lock'), h('span', { text: App.st.lang === 'ml' ? 'സ്വകാര്യം' : 'Private' }))),
      s('welcome_note') ? h('p', { class: 'note', html: U.rich(s('welcome_note')) }) : null,
      langPicker(welcome),
      h('button', { type: 'button', class: 'btn big', text: t('start'), onclick: consent }),
      App.def.settings.allow_resume === 'yes' ? h('button', { type: 'button', class: 'link-btn center', text: t('have_code'), onclick: function () { code.hidden = !code.hidden; if (!code.hidden) $('input', code).focus(); } }) : null,
      code));
    var inp = h('input', { class: 'text-in code-in', maxlength: 8, autocomplete: 'off', autocapitalize: 'characters', placeholder: 'ABC123', 'aria-label': t('enter_code') });
    var err = h('div', { class: 'q-err', role: 'alert' });
    var go = h('button', { type: 'button', class: 'btn', text: t('resume_btn'), onclick: function () {
      var c = inp.value.trim().toUpperCase();
      if (c.length < 6) { showErr(err, t('bad_code')); return; }
      go.disabled = true; go.textContent = t('loading');
      App.call({ action: 'resume', code: c }, { tries: 3 }).then(function (j) {
        go.disabled = false; go.textContent = t('resume_btn');
        if (!j.ok) { showErr(err, j.error === 'resume_off' ? t('resume_off') : j.error === 'already_done' ? t('done_already') : j.closed ? t('closed') : t('bad_code')); return; }
        var lang = App.st.lang;
        App.reset();
        var st = App.st, sv = j.state || {};
        st.resp_id = j.resp_id; st.secret = j.secret; st.code = j.code; st.condition = j.condition;
        st.answers = sv.answers || {}; st.orders = sv.orders || {}; st.blocksDone = sv.blocksDone || []; st.block = sv.block || '';
        st.lang = lang; st.lang_switches = sv.lang_switches || 0; st.q_version = j.q_version || App.def.version;
        st.status = 'active'; st.started = Date.now(); st.src = sv.src || App.cfg.src;
        if (!st.orders.blocks) computeOrders();
        nextUnfinished();
        App.save(true);
        renderBlock();
      }).catch(function () { go.disabled = false; go.textContent = t('resume_btn'); showErr(err, t('cant_load')); });
    } });
    code.appendChild(h('label', { class: 'small', text: t('enter_code') })); code.appendChild(inp); code.appendChild(err); code.appendChild(go);
  }
  function heroArt() {
    return '<svg viewBox="0 0 320 150" aria-hidden="true"><defs><linearGradient id="hg" x1="0" x2="1"><stop offset="0" stop-color="#0B7A6C"/><stop offset="1" stop-color="#14A08E"/></linearGradient></defs>' +
      '<rect x="0" y="0" width="320" height="150" rx="28" fill="url(#hg)"/>' +
      '<circle cx="270" cy="30" r="46" fill="#FFC542" opacity=".9"/><circle cx="40" cy="135" r="38" fill="#FF6B5B" opacity=".85"/>' +
      '<rect x="92" y="34" width="136" height="88" rx="14" fill="#fff"/><rect x="108" y="50" width="70" height="9" rx="4.5" fill="#0B7A6C"/>' +
      '<rect x="108" y="68" width="104" height="8" rx="4" fill="#E3F6F2"/><rect x="108" y="84" width="90" height="8" rx="4" fill="#E3F6F2"/>' +
      '<circle cx="114" cy="105" r="6" fill="#FF6B5B"/><circle cx="132" cy="105" r="6" fill="#FFC542"/><circle cx="150" cy="105" r="6" fill="#0B7A6C"/>' +
      '<path d="M236 92l10 10 20-24" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  function showErr(el, msg) { el.innerHTML = ''; if (msg) { el.appendChild(U.icon('warn')); el.appendChild(h('span', { text: msg })); } el.classList.toggle('show', !!msg); }

  function welcomeBack() {
    var m = screen('center');
    m.appendChild(h('div', { class: 'card msg' },
      h('div', { class: 'msg-art', html: U.I.party }),
      h('h1', { class: 'title', text: t('welcome_back') }),
      h('p', { text: t('welcome_back_text') }),
      langPicker(welcomeBack),
      h('button', { type: 'button', class: 'btn big', text: t('carry_on'), onclick: function () { App.st.started = App.st.started || Date.now(); renderBlock(true); } })));
  }

  function closedScreen() { messageScreen(App.setting('title'), App.setting('closed_message') || t('closed'), 'clock'); }

  function messageScreen(title, text, art, extra) {
    var m = screen('center');
    m.appendChild(h('div', { class: 'card msg' },
      art === 'party' ? h('div', { class: 'msg-art', html: U.I.party }) : U.icon(art || 'clock', 'big'),
      h('h1', { class: 'title', text: title }), h('p', { html: U.rich(text) }), extra || null));
    return m;
  }

  /* ---------- consent ---------- */
  function consent() {
    var m = screen('consent');
    var s = App.setting, d = App.def.settings;
    var adult = false;
    var err = h('div', { class: 'q-err', role: 'alert' });
    var tick = h('button', { type: 'button', class: 'opt tick', role: 'checkbox', 'aria-checked': 'false', onclick: function () {
      adult = !adult; tick.setAttribute('aria-checked', adult ? 'true' : 'false'); if (adult) showErr(err, '');
    } }, h('span', { class: 'mark sq' }, U.icon('check')), h('span', { class: 'opt-label', text: t('adult') }));
    var who = [s('researcher'), s('institution')].filter(Boolean).join(', ');
    var items = [
      s('consent_purpose'), s('consent_involves'), s('consent_voluntary'), s('consent_storage'),
      String(d.collect_phone || 'no').toLowerCase() !== 'no' ? s('consent_phone_reason') : ''
    ].filter(Boolean);
    var agreeBtn = h('button', { type: 'button', class: 'btn big', text: t('agree'), onclick: function () {
      if (!adult) { showErr(err, t('age_gate')); tick.focus(); return; }
      startRespondent(agreeBtn);
    } });
    m.appendChild(h('div', { class: 'card consent-card' },
      h('div', { class: 'kicker', text: t('consent_title') }),
      h('h1', { class: 'title sm', text: s('title') }),
      who ? h('p', { class: 'muted', text: t('researcher') + ': ' + who }) : null,
      h('ul', { class: 'consent-list' }, items.map(function (x) { return h('li', { html: U.rich(x) }); })),
      d.contact_email ? h('p', { class: 'small' }, h('span', { text: t('contact') + ' ' }), h('a', { href: 'mailto:' + d.contact_email, text: d.contact_email })) : null,
      langPicker(consent),
      tick, err,
      agreeBtn,
      h('button', { type: 'button', class: 'btn ghost', text: t('disagree'), onclick: decline })));
  }

  function decline() {
    App.call({ action: 'decline', preview: App.cfg.preview }, { tries: 3 }).catch(function () { });
    App.st.status = 'declined'; App.save(true);
    declinedScreen();
  }
  function declinedScreen() {
    messageScreen(t('declined_title'), t('declined'), 'party',
      h('button', { type: 'button', class: 'link-btn center', text: t('changed_mind'), onclick: function () { var l = App.st.lang; App.reset(); App.st.lang = l; App.save(true); welcome(); } }));
  }

  function startRespondent(btn) {
    btn.disabled = true; btn.textContent = t('loading');
    var info = U.deviceInfo();
    var body = {
      action: 'start', device_id: App.deviceId(), lang: App.st.lang, lang_switches: App.st.lang_switches, src: App.st.src, ext_id: App.cfg.ext_id,
      device: info.device, screen_width: info.screen_width, browser: info.browser, preview: App.cfg.preview, condition: App.testCondition || ''
    };
    App.call(body, { tries: 6, onRetry: function () { btn.textContent = t('retrying'); } }).then(function (j) {
      if (j.closed) return closedScreen();
      if (j.quota_full) { App.st.status = 'done'; App.st.final = { type: 'quota' }; App.save(true); return finalScreen(); }
      if (!j.ok) { btn.disabled = false; btn.textContent = t('agree'); return failScreen(j.error || t('cant_load'), true); }
      var st = App.st;
      st.resp_id = j.resp_id; st.secret = j.secret; st.code = j.code || ''; st.condition = j.condition || ''; st.seq = j.seq || 0;
      st.q_version = App.def.version; st.started = Date.now(); st.status = 'active';
      computeOrders();
      nextUnfinished();
      App.save(true);
      renderBlock();
    }).catch(function () {
      btn.disabled = false; btn.textContent = t('agree');
      var box = $('.consent-card .q-err'); if (box) showErr(box, t('offline'));
    });
  }

  function computeOrders() {
    var st = App.st, d = App.def, seed = st.resp_id || 'x';
    st.orders = st.orders || {};
    st.orders.blocks = SV.blockOrder(d, seed);
    d.blocks.forEach(function (b) { if (b.randomise === 'yes' || b.randomise === 'latin') st.orders[b.id] = SV.itemOrder(d, b.id, seed, st.seq); });
    d.questions.forEach(function (q) { if (SV.yes(q.shuffle_options)) st.orders['opt:' + q.id] = SV.optionOrder(q, seed); });
  }

  function visibleBlocks() { return SV.visibility(App.def, App.st).blocks; }
  function nextUnfinished() {
    var vb = visibleBlocks();
    var b = vb.filter(function (x) { return App.st.blocksDone.indexOf(x.id) < 0; })[0];
    App.st.block = b ? b.id : (vb.length ? vb[vb.length - 1].id : '');
  }

  /* ---------- header ---------- */
  function header() {
    var bar = h('div', { class: 'pbar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('span'));
    var label = h('div', { class: 'plabel' });
    var saved = h('div', { class: 'saved', 'aria-live': 'polite' });
    var hd = h('header', { class: 'top' }, bar, h('div', { class: 'top-row' }, label, saved,
      langs() ? h('button', { type: 'button', class: 'tb-btn' + (App.st.lang === 'ml' ? '' : ' ml-font'), text: t('lang_switch'), 'aria-label': 'Language', onclick: switchLang }) : null,
      h('button', { type: 'button', class: 'tb-btn', 'aria-label': t('text_size'), 'aria-pressed': U.store.get('svy:big') === '1' ? 'true' : 'false', onclick: function () {
        var on = U.store.get('svy:big') !== '1'; U.store.set('svy:big', on ? '1' : '0'); applyBig(); this.setAttribute('aria-pressed', on ? 'true' : 'false');
        if (curId && cards[curId]) setTimeout(function () { scrollToEl(cards[curId].el, true); }, 50);
      } }, h('span', { class: 'aa', text: 'A' }), h('span', { class: 'aa plus', text: '+' }))));
    return hd;
  }
  function switchLang() {
    App.st.lang = App.st.lang === 'ml' ? 'en' : 'ml';
    App.st.lang_switches = (App.st.lang_switches || 0) + 1;
    App.save(true); applyLang();
    var keep = curId;
    renderBlock(false, keep);
  }
  function updateProgress() {
    var p = SV.progress(App.def, App.st);
    var bar = $('.pbar'); if (!bar) return p;
    bar.firstChild.style.width = Math.max(3, p.pct) + '%';
    bar.setAttribute('aria-valuenow', p.pct);
    var b = SV.blockById(App.def, App.st.block);
    $('.plabel').textContent = (b ? App.L(b, 'title') : '') + ' · ' + p.pct + '%';
    return p;
  }
  App.onOutbox(function (ev, data) {
    var el = $('.saved');
    if (el) {
      if (ev === 'saving') { el.className = 'saved busy'; el.textContent = t('saving'); }
      else if (ev === 'offline') { el.className = 'saved off'; el.textContent = App.st.lang === 'ml' ? 'ഓഫ്‌ലൈൻ' : 'Offline'; el.title = t('offline'); }
      else { el.className = 'saved ok'; el.innerHTML = ''; el.appendChild(U.icon('check')); el.appendChild(h('span', { text: t('saved_tick') })); }
    }
    if (ev === 'saved' && data.res && data.res.quota_full) {
      App.st.status = 'done'; App.st.final = { type: 'quota', quota: data.res.quota }; App.save(true); finalScreen();
    }
    if ((ev === 'saved' || ev === 'rejected') && data.item.action === 'submit') {
      var r = data.res || {};
      App.st.status = 'done';
      App.st.final = App.st.final || {};
      App.st.final.code = r.completion_code || ''; App.st.final.scores = r.scores || null;
      App.markDone(); App.save(true);
      finalScreen();
    }
    if (ev === 'offline' && App.st.status === 'submitting') { var o = $('.saving-off'); if (o) o.hidden = false; }
  });

  /* ---------- a section ---------- */
  function renderBlock(resume, keepFocus) {
    var st = App.st, d = App.def;
    cards = {}; curId = '';
    var vb = visibleBlocks();
    if (!vb.some(function (b) { return b.id === st.block; })) nextUnfinished();
    var bid = st.block, b = SV.blockById(d, bid);
    var idx = vb.map(function (x) { return x.id; }).indexOf(bid);
    var main = screen('block ' + (App.layout === 'one_per_screen' ? 'ops' : 'auto'));
    root.insertBefore(header(), main);
    main.classList.add('enter');
    var ids = (st.orders && st.orders[bid]) || d.questions.filter(function (q) { return q.block === bid; }).map(function (q) { return q.id; });
    var secs = SV.estimateSecs(d, (vb[idx] || { items: [] }).items);
    main.appendChild(h('section', { class: 'card intro-card' },
      h('div', { class: 'kicker' }, h('span', { text: t('part', { i: idx + 1, n: vb.length }) }), secs >= 30 ? h('span', { class: 'dot-sep', text: t('min_short', { n: Math.max(1, Math.round(secs / 60)) }) }) : null),
      h('h2', { class: 'sec-title', text: App.L(b, 'title') }),
      App.L(b, 'intro') ? h('p', { class: 'lead', html: U.rich(App.pipe(App.L(b, 'intro'))) }) : null));
    var list = h('div', { class: 'qs' });
    main.appendChild(list);
    ids.forEach(function (qid) { var q = SV.qById(d, qid); if (q) list.appendChild(makeCard(q)); });
    var cont = h('button', { type: 'button', class: 'btn big cont', onclick: onContinue });
    var foot = h('div', { class: 'block-foot' }, cont,
      d.settings.allow_resume === 'yes' && st.code ? h('button', { type: 'button', class: 'link-btn center', text: t('save_later'), onclick: saveLater }) : null);
    main.appendChild(foot);
    if (App.layout === 'one_per_screen') main.appendChild(h('nav', { class: 'ops-nav' },
      h('button', { type: 'button', class: 'btn ghost', text: t('back'), onclick: opsBack }),
      h('button', { type: 'button', class: 'btn', text: t('next'), onclick: opsNext })));
    st.blockStart = Date.now();
    refresh();
    var first = keepFocus && cards[keepFocus] ? keepFocus : (st.focus && cards[st.focus] && !cards[st.focus].el.classList.contains('is-hidden') ? st.focus : firstOpen());
    setCurrent(first || '', false);
    if (keepFocus && cards[keepFocus]) scrollToEl(cards[keepFocus].el, true);
    else if (resume && first && cards[first]) setTimeout(function () { scrollToEl(cards[first].el); }, 300);
    else W.scrollTo(0, 0);
    App.save();
  }

  function firstOpen() {
    var ids = order();
    for (var i = 0; i < ids.length; i++) { var c = cards[ids[i]]; if (c && SV.answerable(c.q) && !SV.isAnswered(c.q, App.st.answers[c.q.id])) return ids[i]; }
    return ids[0] || '';
  }
  /** visible, reachable card ids in screen order */
  function order() {
    return $$('.qs > .q').filter(function (el) { return !el.classList.contains('is-hidden') && !el.classList.contains('is-gated'); }).map(function (el) { return el.getAttribute('data-q'); });
  }

  function makeCard(q) {
    var hooks = { focus: [], blur: [], ok: true };
    var el = h('section', { class: 'card q t-' + q.type, id: 'q-' + q.id, 'data-q': q.id, tabindex: '-1' });
    var textEl = h('h3', { class: 'q-text' });
    var helpEl = h('p', { class: 'q-help' });
    var err = h('div', { class: 'q-err', role: 'alert' });
    function drawText() {
      textEl.innerHTML = U.rich(App.pipe(App.L(q, 'text')));
      var req = q.required || (q.type === 'phone' && String(App.def.settings.collect_phone).toLowerCase() === 'required');
      if (req && SV.answerable(q)) textEl.appendChild(h('span', { class: 'req', 'aria-label': 'required', text: ' *' }));
      var help = App.L(q, 'help');
      helpEl.innerHTML = help ? U.rich(App.pipe(help)) : '';
      helpEl.hidden = !help;
    }
    var ctx = {
      q: q, card: el,
      get: function () { return App.st.answers[q.id]; },
      set: function (v, adv) { answer(q, v, adv); },
      setOther: function (txt) { App.st.answers[q.id + '_other'] = txt; App.save(); },
      error: function (msg) { showErr(err, msg); el.classList.toggle('has-error', !!msg); },
      ok: function () { onOk(q); },
      nextRow: function (rowCard, last) { rowAdvance(q, rowCard, last); },
      satisfied: function (yes) { hooks.ok = yes; el.classList.toggle('unsatisfied', !yes); if (cards[q.id]) refresh(); },
      advance: function () { advance(q.id); },
      onFocus: function (fn) { hooks.focus.push(fn); }, onBlur: function (fn) { hooks.blur.push(fn); }
    };
    if (q.media && q.type !== 'stimulus') el.appendChild(App.media.inline(App.def.media[q.media]));
    el.appendChild(textEl); el.appendChild(helpEl);
    drawText();
    var body = (App.types[q.type] || function () { return null; })(ctx);
    if (body) el.appendChild(h('div', { class: 'q-body' }, body));
    el.appendChild(err);
    if (App.okTypes[q.type] || q.type === 'stimulus' || (q.type === 'end' && false)) {
      el.appendChild(h('div', { class: 'ok-row' }, h('button', { type: 'button', class: 'ok-btn', onclick: function () { onOk(q); } }, h('span', { text: q.type === 'info' || q.type === 'stimulus' ? t('next_q') : t('ok') }), U.icon('down'))));
    }
    el.addEventListener('pointerdown', function () { if (curId !== q.id && App.layout !== 'one_per_screen') setCurrent(q.id, false); }, { passive: true });
    el.addEventListener('focusin', function () { if (curId !== q.id && App.layout !== 'one_per_screen') setCurrent(q.id, false); });
    cards[q.id] = { el: el, q: q, hooks: hooks, drawText: drawText, ctx: ctx, piped: /\{[A-Za-z]/.test(q.text_en + q.text_ml + (q.help_en || '') + (q.help_ml || '')) };
    return el;
  }

  function answer(q, v, adv) {
    var st = App.st;
    st.answers[q.id] = v;
    if (q.type === 'single' || q.type === 'dropdown') {
      var o = (q.opts || []).filter(function (x) { return String(x.code) === String(v); })[0];
      if (!o || o.special !== 'other') delete st.answers[q.id + '_other'];
    }
    App.firstAnswer(q.id);
    var c = cards[q.id];
    if (c && c.el.classList.contains('has-error')) {
      var e = App.checkAnswer(q, v, false);
      c.ctx.error(e);
    }
    App.save();
    refresh(q.id);
    if (adv) {
      clearTimeout(advanceTimer);
      advanceTimer = setTimeout(function () {
        if (App.checkAnswer(q, st.answers[q.id], false)) return;
        advance(q.id);
      }, App.layout === 'one_per_screen' ? 450 : 380);
    }
  }

  function refresh(changedId) {
    var st = App.st;
    var vis = SV.visibility(App.def, st);
    var gate = false;
    $$('.qs > .q').forEach(function (el) {
      var id = el.getAttribute('data-q'), c = cards[id];
      var shown = !!vis.shown[id];
      el.classList.toggle('is-hidden', !shown);
      el.classList.toggle('is-gated', shown && gate);
      if (shown && c && c.q.type === 'stimulus' && !c.hooks.ok) gate = true;
      if (shown && c && c.q.type === 'end') gate = true; // nothing after a screen-out message
      if (changedId && c && c.piped && id !== changedId) c.drawText();
    });
    var cont = $('.cont');
    if (cont) {
      var vb = vis.blocks.map(function (b) { return b.id; });
      var here = vb.indexOf(st.block);
      var last = here === vb.length - 1;
      cont.textContent = last ? t('finish') : t('cont');
      var gatedStim = $$('.qs > .q.t-stimulus.unsatisfied').some(function (el) { return !el.classList.contains('is-hidden'); });
      cont.classList.toggle('dim', gatedStim);
      var endShown = $$('.qs > .q.t-end').some(function (el) { return !el.classList.contains('is-hidden'); });
      $('.block-foot').classList.toggle('ended', endShown);
    }
    updateProgress();
    if (curId && cards[curId] && cards[curId].el.classList.contains('is-hidden')) { var o = order(); setCurrent(o.filter(function (id) { return id; })[0] || '', false); }
    else markStates();
  }

  function markStates() {
    var ids = $$('.qs > .q').map(function (el) { return el.getAttribute('data-q'); });
    var pos = ids.indexOf(curId);
    ids.forEach(function (id, i) {
      var el = cards[id].el;
      el.classList.toggle('is-current', i === pos);
      el.classList.toggle('is-done', pos >= 0 ? i < pos : curId === '__end');
      el.classList.toggle('is-upcoming', pos >= 0 && i > pos);
    });
    var foot = $('.block-foot'); if (foot) foot.classList.toggle('is-current', curId === '__end');
  }

  function setCurrent(id, scroll) {
    if (id === curId) { if (scroll && cards[id]) scrollToEl(cards[id].el); return; }
    var prev = cards[curId];
    if (prev) prev.hooks.blur.forEach(function (f) { try { f(); } catch (e) { } });
    curId = id;
    App.timeFocus(cards[id] ? id : null);
    App.st.focus = cards[id] ? id : '';
    markStates();
    var c = cards[id];
    if (c) c.hooks.focus.forEach(function (f) { try { f(); } catch (e) { } });
    if (scroll) {
      if (c) scrollToEl(c.el);
      else if (id === '__end') scrollToEl($('.block-foot'));
    }
    if (App.layout === 'one_per_screen') W.scrollTo(0, 0);
  }

  function scrollToEl(el, instant) {
    if (!el || App.layout === 'one_per_screen') return;
    var r = el.getBoundingClientRect(), vh = W.innerHeight, head = ($('.top') || { offsetHeight: 0 }).offsetHeight;
    var y = W.pageYOffset + r.top - head - Math.max(12, (vh - head - r.height) / 2);
    if (r.height > vh - head - 24) y = W.pageYOffset + r.top - head - 12;
    progUntil = Date.now() + 900;
    W.scrollTo({ top: Math.max(0, y), behavior: instant || U.reduceMotion ? 'auto' : 'smooth' });
  }

  function advance(fromId) {
    var ids = order(), i = ids.indexOf(fromId);
    var next = i >= 0 ? ids[i + 1] : ids[0];
    if (next) setCurrent(next, true);
    else setCurrent('__end', true);
  }

  function rowAdvance(q, rowCard, last) {
    var c = cards[q.id];
    clearTimeout(advanceTimer);
    advanceTimer = setTimeout(function () {
      if (last) {
        var missing = (q.rows || []).filter(function (r) { return SV.isEmpty((App.st.answers[q.id] || {})[r.code]); });
        if (missing.length) { var m = c.el.querySelector('.row-card[data-row="' + missing[0].code + '"]'); if (m) scrollToEl(m); return; }
        advance(q.id); return;
      }
      var nxt = rowCard.nextElementSibling;
      if (nxt && App.layout !== 'one_per_screen') scrollToEl(nxt);
    }, 320);
  }

  function onOk(q) {
    var c = cards[q.id];
    if (q.type === 'stimulus' && !c.hooks.ok) { c.el.classList.add('shake'); setTimeout(function () { c.el.classList.remove('shake'); }, 500); return; }
    var e = App.checkAnswer(q, App.st.answers[q.id], q.required || q.type === 'phone');
    c.ctx.error(e);
    if (e) return;
    advance(q.id);
  }

  /* ---------- manual scrolling moves the highlight ---------- */
  var ticking = false;
  W.addEventListener('scroll', function () {
    if (ticking || App.layout === 'one_per_screen' || !$('.qs')) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      if (Date.now() < progUntil) return;
      var mid = W.innerHeight * 0.45, best = null, bestD = 1e9;
      order().forEach(function (id) {
        var r = cards[id].el.getBoundingClientRect();
        var d = r.top <= mid && r.bottom >= mid ? 0 : Math.min(Math.abs(r.top - mid), Math.abs(r.bottom - mid));
        if (d < bestD) { bestD = d; best = id; }
      });
      var foot = $('.block-foot');
      if (foot) { var fr = foot.getBoundingClientRect(); if (fr.top < W.innerHeight * 0.6 && fr.bottom > 0 && W.innerHeight + W.pageYOffset >= document.body.scrollHeight - 4) best = '__end'; }
      if (best && best !== curId) setCurrent(best, false);
    });
  }, { passive: true });

  /* ---------- one question per screen ---------- */
  function opsNext() {
    var c = cards[curId];
    if (c) {
      if (c.q.type === 'stimulus' && !c.hooks.ok) return onOk(c.q);
      var e = App.checkAnswer(c.q, App.st.answers[c.q.id], true);
      c.ctx.error(e);
      if (e) return;
    }
    var ids = order(), i = ids.indexOf(curId);
    if (curId === '__end' || i === ids.length - 1) return onContinue();
    setCurrent(ids[i + 1], false);
  }
  function opsBack() {
    var ids = order(), i = ids.indexOf(curId);
    if (curId === '__end') return setCurrent(ids[ids.length - 1], false);
    if (i > 0) setCurrent(ids[i - 1], false);
  }

  /* ---------- end of a section ---------- */
  function onContinue() {
    var st = App.st, ids = order();
    var gated = $$('.qs > .q.t-stimulus.unsatisfied').filter(function (el) { return !el.classList.contains('is-hidden'); })[0];
    if (gated) { setCurrent(gated.getAttribute('data-q'), true); gated.classList.add('shake'); setTimeout(function () { gated.classList.remove('shake'); }, 500); return; }
    for (var i = 0; i < ids.length; i++) {
      var c = cards[ids[i]];
      var e = App.checkAnswer(c.q, st.answers[c.q.id], true);
      if (e) { c.ctx.error(e); setCurrent(ids[i], true); if (App.layout === 'one_per_screen') W.scrollTo(0, 0); return; }
    }
    App.timeFocus(null);
    App.addTime('tb_' + st.block, Date.now() - (st.blockStart || Date.now()));
    if (st.blocksDone.indexOf(st.block) < 0) st.blocksDone.push(st.block);
    var vis = SV.visibility(App.def, st);
    var vb = vis.blocks.map(function (b) { return b.id; });
    var next = vb.slice(vb.indexOf(st.block) + 1).filter(function (b) { return st.blocksDone.indexOf(b) < 0; })[0];
    if (!next) return submit(vis.endAt ? 'screened_out' : 'complete', vis.endAt);
    App.queue(App.payload('checkpoint'));
    var before = SV.progress(App.def, st).pct;
    st.block = next; st.focus = '';
    App.save(true);
    renderBlock();
    cheer(before);
  }

  function cheer(pct) {
    if (App.def.settings.encouragement === 'no') return;
    var st = App.st, hit = null;
    [25, 50, 75].forEach(function (n) { if (pct >= n && st.cheered.indexOf(n) < 0) { st.cheered.push(n); hit = n; } });
    if (hit) toast(t('cheer' + hit));
  }
  function toast(msg) {
    var el = h('div', { class: 'toast', role: 'status' }, h('span', { class: 'toast-ic', html: '★' }), h('span', { text: msg }));
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('show'); });
    setTimeout(function () { el.classList.remove('show'); setTimeout(function () { el.remove(); }, 400); }, 2600);
  }

  function submit(status, endQ) {
    var st = App.st;
    st.final = { type: status === 'screened_out' ? 'screened' : 'complete', endQ: endQ || '' };
    st.status = 'submitting';
    App.queue(App.payload('submit', { status: status }));
    App.save(true);
    if (st.status === 'submitting') savingScreen();
  }

  function savingScreen() {
    var m = screen('center');
    var off = h('div', { class: 'saving-off', hidden: true }, h('p', { class: 'small', text: t('offline') }),
      h('button', { type: 'button', class: 'btn ghost', text: t('retry'), onclick: function () { App.flush(); } }));
    m.appendChild(h('div', { class: 'card msg' }, h('div', { class: 'loader' }, h('span'), h('span'), h('span')), h('p', { text: t('saving') }), off));
    if (App.st.outbox.length) App.flush(); else { App.st.status = 'done'; App.save(true); finalScreen(); }
  }

  /* ---------- the last screen ---------- */
  function finalScreen() {
    var st = App.st, f = st.final || { type: 'complete' };
    cards = {}; curId = '';
    if (f.type === 'quota') {
      var qt = (App.def.quotas || []).filter(function (x) { return x.name === f.quota; })[0];
      return messageScreen(t('thanks'), (qt && App.L(qt, 'message')) || App.setting('quota_full_message') || t('quota_full'), 'party');
    }
    if (f.type === 'screened') {
      var eq = f.endQ && SV.qById(App.def, f.endQ);
      return messageScreen(t('thanks'), (eq && App.pipe(App.L(eq, 'text'))) || App.setting('screenout_message') || t('screened'), 'party');
    }
    var extra = h('div');
    if (f.code) extra.appendChild(h('div', { class: 'code-box' }, h('div', { class: 'small', text: t('your_code') }), h('div', { class: 'code', text: f.code }),
      h('button', { type: 'button', class: 'btn ghost', text: t('copy'), onclick: function () { copy(f.code, this); } })));
    if (f.scores && Object.keys(f.scores).length) {
      var ul = h('ul', { class: 'scores' });
      Object.keys(f.scores).forEach(function (k) { if (f.scores[k] !== '') ul.appendChild(h('li', {}, h('span', { text: k }), h('strong', { text: String(f.scores[k]) }))); });
      extra.appendChild(h('div', { class: 'small', text: t('your_scores') })); extra.appendChild(ul);
    }
    messageScreen(t('thanks'), App.setting('thankyou_message') || '', 'party', extra);
    if (!U.reduceMotion && !st.confettiShown) { st.confettiShown = true; App.save(true); confetti(); }
  }

  function copy(text, btn) {
    var done = function () { if (btn) { var o = btn.textContent; btn.textContent = t('copied'); setTimeout(function () { btn.textContent = o; }, 1500); } };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { fallback(); });
    else fallback();
    function fallback() { var ta = h('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) { } ta.remove(); done(); }
  }

  /* ---------- save and finish later ---------- */
  function saveLater() {
    var st = App.st;
    App.queue(App.payload('checkpoint'));
    var link = W.location.origin + W.location.pathname + (App.cfg.preview ? W.location.search : '');
    var msg = (App.setting('title') || '') + '\n' + t('enter_code') + ': ' + st.code + '\n' + link;
    var close = function () { ov.remove(); document.body.classList.remove('noscroll'); };
    var ov = h('div', { class: 'sheet-overlay open center', onclick: function (e) { if (e.target === ov) close(); } },
      h('div', { class: 'card modal', role: 'dialog', 'aria-label': t('resume_title') },
        h('h2', { class: 'sec-title', text: t('resume_title') }),
        h('p', { text: t('resume_text') }),
        h('div', { class: 'code big-code', text: st.code }),
        h('a', { class: 'btn wa', href: 'https://wa.me/?text=' + encodeURIComponent(msg), target: '_blank', rel: 'noopener' }, U.icon('wa'), h('span', { text: t('share_wa') })),
        h('button', { type: 'button', class: 'btn ghost', text: t('copy'), onclick: function () { copy(st.code, this); } }),
        h('button', { type: 'button', class: 'link-btn center', text: t('keep_going'), onclick: close })));
    document.body.appendChild(ov);
    document.body.classList.add('noscroll');
  }

  /* ---------- confetti ---------- */
  function confetti() {
    var c = h('canvas', { class: 'confetti', 'aria-hidden': 'true' });
    document.body.appendChild(c);
    var ctx = c.getContext('2d'), dpr = W.devicePixelRatio || 1;
    c.width = W.innerWidth * dpr; c.height = W.innerHeight * dpr; ctx.scale(dpr, dpr);
    var colors = ['#FF6B5B', '#FFC542', '#0B7A6C', '#3D5AFE', '#5CC489'];
    var ps = [];
    for (var i = 0; i < 140; i++) ps.push({ x: W.innerWidth / 2 + (Math.random() - 0.5) * 80, y: W.innerHeight * 0.35, vx: (Math.random() - 0.5) * 12, vy: -Math.random() * 13 - 4, r: Math.random() * 6 + 4, c: colors[i % colors.length], a: Math.random() * 6, va: (Math.random() - 0.5) * 0.3 });
    var t0 = performance.now();
    (function frame(now) {
      var el = now - t0;
      ctx.clearRect(0, 0, W.innerWidth, W.innerHeight);
      ps.forEach(function (p) {
        p.vy += 0.32; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.a += p.va;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c; ctx.globalAlpha = Math.max(0, 1 - el / 3200);
        ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); ctx.restore();
      });
      if (el < 3200) requestAnimationFrame(frame); else c.remove();
    })(t0);
  }

  /* ---------- preview tools ---------- */
  function testBar() {
    var d = App.def;
    var panel = h('div', { class: 'test-panel', hidden: true });
    var condSel = h('select', { 'aria-label': 'condition' }, h('option', { value: '', text: '(assign normally)' }), d.conditions.map(function (c) { return h('option', { value: c.name, text: c.name, selected: App.st.condition === c.name || App.testCondition === c.name }); }));
    condSel.addEventListener('change', function () {
      App.testCondition = condSel.value;
      if (App.st.resp_id && condSel.value) { App.st.condition = condSel.value; App.save(true); renderBlock(); }
    });
    var jump = h('select', { 'aria-label': 'jump' }, h('option', { value: '', text: '—' }), d.questions.map(function (q) { return h('option', { value: q.id, text: q.block + ' · ' + q.id + ' (' + q.type + ')' }); }));
    jump.addEventListener('change', function () {
      var q = SV.qById(d, jump.value); if (!q) return;
      if (!App.st.resp_id) { alert('Agree to the consent screen first.'); return; }
      App.st.status = 'active'; App.st.block = q.block; App.st.focus = q.id; App.save(true);
      renderBlock(true, q.id);
      panel.hidden = true;
    });
    panel.appendChild(h('label', {}, h('span', { text: t('test_condition') }), condSel));
    panel.appendChild(h('label', {}, h('span', { text: t('test_jump') }), jump));
    panel.appendChild(h('div', { class: 'small', text: 'Respondent ' + (App.st.resp_id || '(not started)') + ' · version ' + d.version }));
    panel.appendChild(h('button', { type: 'button', class: 'btn ghost', text: t('test_reset'), onclick: function () { App.reset(); W.location.reload(); } }));
    document.body.appendChild(h('div', { class: 'test-bar' }, h('button', { type: 'button', class: 'test-pill', text: 'TEST', onclick: function () { panel.hidden = !panel.hidden; } }), panel));
  }

  W.addEventListener('pagehide', function () { App.timeFocus(curId && cards[curId] ? curId : null); App.save(true); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

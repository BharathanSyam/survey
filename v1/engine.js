/* Survey Tool engine — shared by the respondent page and the Apps Script.
 * Pure functions only: no DOM, no Google services.
 * Keep this file identical in both places (the build script copies it). */
var Engine = (function () {
  'use strict';

  var ENGINE_VERSION = '1.0.0';

  var TYPES = ['short_text', 'paragraph', 'single', 'checkbox', 'dropdown', 'linear_scale',
    'mc_grid', 'checkbox_grid', 'date', 'time', 'file_upload', 'likert_emoji', 'star_rating',
    'slider', 'semantic_diff', 'nps', 'info', 'stimulus', 'consent', 'phone'];

  // Types whose screen moves on by itself 250 ms after a tap (when auto_advance is on).
  var AUTO_ADVANCE = { single: 1, likert_emoji: 1, star_rating: 1, linear_scale: 1, nps: 1, mc_grid: 1, consent: 1 };
  // Types that produce no answer column.
  var NO_DATA = { info: 1, stimulus: 1, phone: 1 };
  // Settings keys that are valid per type (anything else gets a validator warning).
  var TYPE_SETTINGS = {
    short_text: ['maxlength', 'format', 'min', 'max', 'placeholder', 'placeholder_ml', 'screenout_codes'],
    paragraph: ['maxlength', 'min_words', 'placeholder', 'placeholder_ml'],
    single: ['other', 'columns', 'screenout_codes', 'other_label', 'other_label_ml'],
    checkbox: ['min', 'max', 'exclusive', 'other', 'columns', 'other_label', 'other_label_ml'],
    dropdown: ['search', 'other', 'screenout_codes', 'placeholder', 'placeholder_ml'],
    linear_scale: ['from', 'to', 'left', 'right', 'left_ml', 'right_ml', 'screenout_codes'],
    mc_grid: ['rows', 'choices', 'label', 'label_ml', 'layout'],
    checkbox_grid: ['rows', 'choices', 'label', 'label_ml'],
    date: ['min', 'max'],
    time: [],
    file_upload: ['types', 'max_mb'],
    likert_emoji: ['points', 'icons', 'label', 'label_ml', 'layout'],
    star_rating: ['stars', 'label', 'label_ml'],
    slider: ['min', 'max', 'step', 'show_value', 'left', 'right', 'left_ml', 'right_ml', 'start'],
    semantic_diff: ['pairs', 'points'],
    nps: ['left', 'right', 'left_ml', 'right_ml', 'subject', 'subject_ml'],
    info: [],
    stimulus: [],
    consent: ['agree', 'agree_ml', 'disagree', 'disagree_ml'],
    phone: []
  };
  var COMMON_SETTINGS = ['label', 'label_ml', 'screenout_codes'];

  var MISSING = { NOT_SHOWN: -1, UNANSWERED: -2, DONT_KNOW: 98, PREFER_NOT: 99 };
  var SPECIAL_CODES = { 98: 1, 99: 1, 96: 1 };

  var META_VARS = [
    ['resp_id', 'string', 'Respondent ID', 'nominal'],
    ['status', 'string', 'Response status', 'nominal'],
    ['start_time', 'string', 'Start time (India time)', 'scale'],
    ['end_time', 'string', 'End time (India time)', 'scale'],
    ['duration_sec', 'numeric', 'Total duration in seconds', 'scale'],
    ['lang', 'string', 'Language at submit', 'nominal'],
    ['lang_switches', 'numeric', 'Number of language switches', 'scale'],
    ['condition', 'string', 'Experimental condition', 'nominal'],
    ['src', 'string', 'Link source', 'nominal'],
    ['device', 'string', 'Device type', 'nominal'],
    ['screen_width', 'numeric', 'Screen width in pixels', 'scale'],
    ['browser', 'string', 'Browser', 'nominal'],
    ['q_version', 'string', 'Questionnaire version', 'nominal'],
    ['consent', 'numeric', 'Consent given', 'nominal'],
    ['consent_time', 'string', 'Consent time (India time)', 'scale'],
    ['consent_version', 'string', 'Consent text version', 'nominal'],
    ['last_block', 'string', 'Last section finished', 'nominal'],
    ['pct_complete', 'numeric', 'Percent of visible questions answered', 'scale'],
    ['last_seen', 'string', 'Time of last checkpoint', 'scale']
  ];
  var FLAG_VARS = [
    ['flag_speeder', 'Speeder: duration under 40% of median'],
    ['flag_straightline', 'Straight-lining on a long scale or grid'],
    ['fail_attention', 'Number of attention checks failed'],
    ['dup_device', 'Same device as an earlier response'],
    ['dup_phone', 'Same phone number as an earlier response'],
    ['flag_short_text', 'Required open answer under 3 words']
  ];

  // ---------------------------------------------------------------- helpers
  function str(v) { return v === null || v === undefined ? '' : String(v).trim(); }
  function yes(v) { v = str(v).toLowerCase(); return v === 'yes' || v === 'y' || v === 'true' || v === '1'; }
  function isNum(v) { return v !== '' && v !== null && v !== undefined && !isNaN(Number(v)) && typeof v !== 'boolean'; }
  function toNum(v) { return isNum(v) ? Number(v) : v; }
  function list(v) { return str(v).split(/\s*,\s*/).filter(function (x) { return x !== ''; }); }
  function blankish(v) {
    if (v === null || v === undefined || v === '') return true;
    if (Array.isArray(v)) return v.length === 0;
    if (typeof v === 'object') return Object.keys(v).length === 0;
    return false;
  }
  function words(s) { return str(s).split(/\s+/).filter(Boolean).length; }
  function bi(en, ml) { en = str(en); ml = str(ml); return { en: en, ml: ml }; }
  function pick(t, lang) { if (!t) return ''; if (typeof t === 'string') return t; return (lang === 'ml' && t.ml) ? t.ml : (t.en || t.ml || ''); }
  function shuffle(a, rnd) {
    rnd = rnd || Math.random; a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function round(n, d) { var p = Math.pow(10, d || 0); return Math.round(n * p) / p; }
  function median(arr) {
    var a = arr.filter(isNum).map(Number).sort(function (x, y) { return x - y; });
    if (!a.length) return null; var m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }

  // "min=0;max=100;left=Not at all" -> {min:'0', max:'100', left:'Not at all'}
  function parseSettings(s) {
    var out = {};
    str(s).split(';').forEach(function (p) {
      p = p.trim(); if (!p) return;
      var i = p.indexOf('=');
      if (i < 0) out[p.toLowerCase()] = 'yes';
      else out[p.slice(0, i).trim().toLowerCase()] = p.slice(i + 1).trim();
    });
    return out;
  }

  // "1=Yes|അതെ;2=No|ഇല്ല" -> options
  function parseInlineChoices(s) {
    return str(s).split(';').map(function (p) { return p.trim(); }).filter(Boolean).map(function (p) {
      var i = p.indexOf('='); var code = i < 0 ? p : p.slice(0, i).trim(); var lab = i < 0 ? p : p.slice(i + 1).trim();
      var parts = lab.split('|');
      return { code: toNum(code), label: bi(parts[0], parts[1] || '') };
    });
  }
  function isInlineChoices(s) { return /=/.test(str(s)); }

  // ---------------------------------------------------------------- expressions
  // Grammar: or/and/not, brackets, comparisons = != <> > < >= <=, "in" lists,
  // "answered" / "not answered". Left side is a q_id (or variable name, or
  // condition/lang/src); right side is a number, 'quoted text' or a bare word.
  function tokenize(src) {
    var toks = [], i = 0, s = str(src);
    while (i < s.length) {
      var c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === '(' || c === ')' || c === ',') { toks.push({ t: c }); i++; continue; }
      var two = s.substr(i, 2);
      if (two === '>=' || two === '<=' || two === '!=' || two === '<>' || two === '==') { toks.push({ t: 'op', v: two === '==' ? '=' : (two === '<>' ? '!=' : two) }); i += 2; continue; }
      if (c === '=' || c === '>' || c === '<') { toks.push({ t: 'op', v: c }); i++; continue; }
      if (c === '"' || c === "'" || c === '‘' || c === '’' || c === '“' || c === '”') {
        var close = (c === '‘' || c === '’') ? /['’‘]/ : (c === '“' || c === '”') ? /["”“]/ : new RegExp(c);
        var j = i + 1; while (j < s.length && !close.test(s[j])) j++;
        if (j >= s.length) throw new Error('A quote is not closed');
        toks.push({ t: 'str', v: s.slice(i + 1, j) }); i = j + 1; continue;
      }
      var m = /^-?\d+(\.\d+)?/.exec(s.slice(i));
      if (m && (c === '-' ? !toks.length || toks[toks.length - 1].t !== 'id' : true)) { toks.push({ t: 'num', v: Number(m[0]) }); i += m[0].length; continue; }
      m = /^[A-Za-z_ഀ-ൿ][A-Za-z0-9_.ഀ-ൿ-]*/.exec(s.slice(i));
      if (m) {
        var w = m[0], lw = w.toLowerCase();
        if (lw === 'and' || lw === 'or' || lw === 'not' || lw === 'in' || lw === 'answered' || lw === 'is') toks.push({ t: lw });
        else toks.push({ t: 'id', v: w });
        i += w.length; continue;
      }
      throw new Error('Unexpected character "' + c + '"');
    }
    return toks;
  }

  function parseExpr(src) {
    var toks = tokenize(src), p = 0;
    if (!toks.length) return null;
    function peek(t) { return toks[p] && toks[p].t === t; }
    function eat(t) { if (!peek(t)) throw new Error('Expected ' + t + (toks[p] ? ' near "' + (toks[p].v || toks[p].t) + '"' : ' at the end')); return toks[p++]; }
    function or() { var l = and(); while (peek('or')) { p++; l = { op: 'or', a: l, b: and() }; } return l; }
    function and() { var l = not(); while (peek('and')) { p++; l = { op: 'and', a: l, b: not() }; } return l; }
    function not() { if (peek('not') && !(toks[p + 1] && (toks[p + 1].t === 'answered'))) { p++; return { op: 'not', a: not() }; } return prim(); }
    function value() {
      var t = toks[p];
      if (!t) throw new Error('Missing value at the end');
      if (t.t === 'num' || t.t === 'str' || t.t === 'id') { p++; return t.t === 'id' ? t.v : t.v; }
      throw new Error('Expected a value near "' + (t.v || t.t) + '"');
    }
    function vlist() {
      var paren = peek('('); if (paren) p++;
      var vals = [value()]; while (peek(',')) { p++; vals.push(value()); }
      if (paren) eat(')');
      return vals;
    }
    function prim() {
      if (peek('(')) { p++; var e = or(); eat(')'); return e; }
      var id = eat('id').v;
      if (peek('is')) p++;
      if (peek('answered')) { p++; return { op: 'answered', id: id }; }
      if (peek('not')) {
        p++;
        if (peek('answered')) { p++; return { op: 'not_answered', id: id }; }
        if (peek('in')) { p++; return { op: 'not_in', id: id, vals: vlist() }; }
        throw new Error('Expected "answered" or "in" after "not"');
      }
      if (peek('in')) { p++; return { op: 'in', id: id, vals: vlist() }; }
      var op = eat('op').v;
      return { op: op, id: id, val: value() };
    }
    var ast = or();
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
  function cmp(v, op, b) {
    if (blankish(v)) return false;
    if (Array.isArray(v)) {
      var has = v.some(function (x) { return eq(x, b); });
      if (op === '=') return has; if (op === '!=') return !has; return false;
    }
    if (op === '=') return eq(v, b);
    if (op === '!=') return !eq(v, b);
    if (!isNum(v) || !isNum(b)) return false;
    v = Number(v); b = Number(b);
    if (op === '>') return v > b; if (op === '<') return v < b; if (op === '>=') return v >= b; if (op === '<=') return v <= b;
    return false;
  }
  function evalExpr(ast, get) {
    if (!ast) return true;
    switch (ast.op) {
      case 'or': return evalExpr(ast.a, get) || evalExpr(ast.b, get);
      case 'and': return evalExpr(ast.a, get) && evalExpr(ast.b, get);
      case 'not': return !evalExpr(ast.a, get);
      case 'answered': return !blankish(get(ast.id));
      case 'not_answered': return blankish(get(ast.id));
      case 'in': return ast.vals.some(function (b) { return cmp(get(ast.id), '=', b); });
      case 'not_in': var v = get(ast.id); if (blankish(v)) return false; return !ast.vals.some(function (b) { return cmp(v, '=', b); });
      default: return cmp(get(ast.id), ast.op, ast.val);
    }
  }
  var exprCache = {};
  function test(src, get) {
    src = str(src); if (!src) return true;
    var ast = exprCache[src];
    if (ast === undefined) { try { ast = parseExpr(src); } catch (e) { ast = null; } exprCache[src] = ast; }
    return evalExpr(ast, get);
  }

  // ---------------------------------------------------------------- build questionnaire
  // data = {settings:{key:value}, questions:[row objects], choices:[...], blocks:[...], conditions:[...], media:[...]}
  function buildQuestionnaire(data) {
    var S = data.settings || {};
    var lists = {};
    (data.choices || []).forEach(function (r) {
      var name = str(r.list_name); if (!name) return;
      (lists[name] = lists[name] || []).push({ code: toNum(str(r.code)), label: bi(r.label_en, r.label_ml), image: str(r.image) });
    });
    function resolveList(spec) {
      spec = str(spec); if (!spec) return [];
      if (lists[spec]) return lists[spec].map(function (o) { return { code: o.code, label: o.label, image: o.image }; });
      if (isInlineChoices(spec)) return parseInlineChoices(spec);
      return [];
    }
    var blocks = (data.blocks || []).filter(function (b) { return str(b.block_id); }).map(function (b, i) {
      return {
        id: str(b.block_id), title: bi(b.title_en, b.title_ml), intro: bi(b.intro_en, b.intro_ml),
        order: isNum(b.order) ? Number(b.order) : i + 1,
        randomise: (str(b.randomise_items).toLowerCase() || 'no').replace(/^y$/, 'yes'),
        position: str(b.position).toLowerCase() || 'fixed',
        condition: list(b.condition), show_if: str(b.show_if), icon: str(b.icon),
        intro_card: str(b.intro_card) === '' ? true : yes(b.intro_card)
      };
    });
    blocks.forEach(function (b) { if (b.randomise === 'true') b.randomise = 'yes'; if (b.randomise === 'false') b.randomise = 'no'; });
    blocks.sort(function (a, b) { return a.order - b.order; });

    var questions = (data.questions || []).filter(function (r) { return str(r.q_id); }).map(function (r) {
      var type = str(r.type).toLowerCase();
      var set = parseSettings(r.settings);
      var q = {
        id: str(r.q_id), block: str(r.block), type: type,
        text: bi(r.text_en, r.text_ml), help: bi(r.help_en, r.help_ml),
        required: yes(r.required), set: set, show_if: str(r.show_if), condition: list(r.condition),
        media: str(r.media), shuffle: yes(r.shuffle_options), scale: str(r.scale), reverse: yes(r.reverse),
        var_label: str(r.var_label), measure: str(r.measure).toLowerCase()
      };
      var chk = str(r.check);
      if (chk) {
        var ci = chk.indexOf('=');
        q.check = { kind: (ci < 0 ? chk : chk.slice(0, ci)).trim().toLowerCase(), code: ci < 0 ? null : toNum(chk.slice(ci + 1).trim()) };
      }
      if (/^(single|checkbox|dropdown)$/.test(type)) {
        q.options = resolveList(r.choices);
        if (set.other) {
          var oc = set.other.toLowerCase() === 'yes' ? 96 : toNum(set.other);
          q.other = oc;
          if (!q.options.some(function (o) { return eq(o.code, oc); })) {
            q.options.push({ code: oc, label: bi(set.other_label || 'Other (please specify)', set.other_label_ml || 'മറ്റുള്ളവ (വ്യക്തമാക്കുക)'), image: '' });
          }
        }
        if (type === 'checkbox') {
          var ex = list(set.exclusive).map(toNum);
          q.options.forEach(function (o) { if (eq(o.code, 98) || eq(o.code, 99)) ex.push(o.code); });
          q.exclusive = ex;
        }
      } else if (type === 'mc_grid' || type === 'checkbox_grid') {
        q.rows = resolveList(set.rows);
        q.options = resolveList(set.choices || r.choices);
      } else if (type === 'semantic_diff') {
        q.pairs = resolveList(set.pairs || r.choices).map(function (o) {
          var en = str(o.label.en).split('|'), ml = str(o.label.ml).split('|');
          return { code: o.code, left: bi(en[0], ml[0] || ''), right: bi(en[1] || '', ml[1] || '') };
        });
        q.points = Number(set.points || 7);
      } else if (type === 'likert_emoji') {
        q.points = Number(set.points || 5);
        q.options = resolveList(r.choices);
        if (!q.options.length) q.options = defaultLikert(q.points);
      } else if (type === 'linear_scale') {
        var f = Number(set.from || 1), t = Number(set.to || 5);
        q.options = []; for (var k = f; k <= t; k++) q.options.push({ code: k, label: bi(String(k), String(k)) });
        if (str(r.choices)) q.options = resolveList(r.choices);
      } else if (type === 'star_rating') {
        q.points = Number(set.stars || 5);
      } else if (type === 'nps') {
        q.options = []; for (var n = 0; n <= 10; n++) q.options.push({ code: n, label: bi(String(n), String(n)) });
      } else if (type === 'consent') {
        q.options = [{ code: 1, label: bi(set.agree || 'I agree', set.agree_ml || 'ഞാൻ സമ്മതിക്കുന്നു') }, { code: 0, label: bi(set.disagree || 'I do not agree', set.disagree_ml || 'ഞാൻ സമ്മതിക്കുന്നില്ല') }];
      }
      if (set.screenout_codes) q.screenout = list(set.screenout_codes).map(toNum);
      return q;
    });

    var conditions = (data.conditions || []).filter(function (c) { return str(c.arm); }).map(function (c) {
      return { id: str(c.arm), label: str(c.label) || str(c.arm), weight: isNum(c.weight) ? Number(c.weight) : 1, target_n: isNum(c.target_n) ? Number(c.target_n) : null };
    });
    var allocation = 'balanced';
    (data.conditions || []).some(function (c) { if (str(c.allocation)) { allocation = str(c.allocation).toLowerCase(); return true; } return false; });

    var media = {};
    (data.media || []).forEach(function (m) {
      var id = str(m.media_id); if (!id) return;
      var type = str(m.type).toLowerCase() || 'image';
      media[id] = {
        id: id, type: type, file: str(m.file), label: bi(m.label_en, m.label_ml), caption: bi(m.caption_en, m.caption_ml),
        min_view_sec: isNum(m.min_view_sec) ? Number(m.min_view_sec) : 0,
        must_watch: str(m.must_watch_to_end) === '' ? (type === 'video' || type === 'youtube' || type === 'audio') : yes(m.must_watch_to_end),
        no_seek: str(m.no_seek) === '' ? true : yes(m.no_seek),
        fixed_exposure_sec: isNum(m.fixed_exposure_sec) ? Number(m.fixed_exposure_sec) : 0,
        sound_check: yes(m.sound_check), poster: str(m.poster)
      };
    });

    var quotas = [];
    Object.keys(S).forEach(function (k) {
      if (!/^quota_\d+$/.test(k) || !str(S[k])) return;
      var v = str(S[k]); var i = v.lastIndexOf('=>');
      if (i < 0) return;
      quotas.push({ id: k, expr: v.slice(0, i).trim(), cap: Number(v.slice(i + 2).trim()) });
    });

    var scoring = {};
    var sc = parseSettings(S.scale_scoring);
    Object.keys(sc).forEach(function (k) { scoring[k] = sc[k].toLowerCase(); });
    (data.scales || []).forEach(function (r) { if (str(r.scale_name) && str(r.scoring) && !scoring[str(r.scale_name)]) scoring[str(r.scale_name)] = str(r.scoring).toLowerCase(); });

    return {
      engine: ENGINE_VERSION,
      study: str(S.study_code),
      version: data.version || 'draft',
      published: data.published || '',
      settings: publicSettings(S),
      blocks: blocks, questions: questions, conditions: conditions, allocation: allocation,
      media: media, quotas: quotas, scoring: scoring
    };
  }

  // Settings safe to send to respondents (never preview keys or folder ids).
  var PRIVATE_SETTINGS = { preview_key: 1, upload_folder_id: 1, export_folder_id: 1, daily_summary_email: 1, web_app_url: 1 };
  function publicSettings(S) {
    var out = {};
    Object.keys(S).forEach(function (k) { if (!PRIVATE_SETTINGS[k] && !/^quota_/.test(k)) out[k] = S[k] instanceof Date ? S[k].toISOString() : str(S[k]); });
    return out;
  }

  function defaultLikert(points) {
    var five = [['Strongly disagree', 'ഒട്ടും യോജിക്കുന്നില്ല'], ['Disagree', 'യോജിക്കുന്നില്ല'], ['Neither agree nor disagree', 'അഭിപ്രായമില്ല'], ['Agree', 'യോജിക്കുന്നു'], ['Strongly agree', 'പൂർണ്ണമായും യോജിക്കുന്നു']];
    var seven = [['Strongly disagree', 'ഒട്ടും യോജിക്കുന്നില്ല'], ['Disagree', 'യോജിക്കുന്നില്ല'], ['Somewhat disagree', 'കുറച്ച് വിയോജിക്കുന്നു'], ['Neither agree nor disagree', 'അഭിപ്രായമില്ല'], ['Somewhat agree', 'കുറച്ച് യോജിക്കുന്നു'], ['Agree', 'യോജിക്കുന്നു'], ['Strongly agree', 'പൂർണ്ണമായും യോജിക്കുന്നു']];
    var src = points === 7 ? seven : five;
    return src.map(function (l, i) { return { code: i + 1, label: bi(l[0], l[1]) }; });
  }

  // ---------------------------------------------------------------- variables (codebook)
  function qIndex(Q) { var m = {}; Q.questions.forEach(function (q, i) { q._i = i; m[q.id] = q; }); return m; }
  function blockIndex(Q) { var m = {}; Q.blocks.forEach(function (b) { m[b.id] = b; }); return m; }

  function shortLabel(q) {
    if (q.var_label) return q.var_label;
    var t = str(q.text.en).replace(/\{[^}]*\}/g, '…');
    return t.length > 120 ? t.slice(0, 117) + '...' : t;
  }
  function valueLabels(opts) { return (opts || []).map(function (o) { return [o.code, o.label.en, o.label.ml]; }); }
  function npsGroupName(Q, q) {
    var n = Q.questions.filter(function (x) { return x.type === 'nps'; }).length;
    return n === 1 ? 'nps_group' : q.id + '_group';
  }
  function scaleRange(q) {
    if (q.type === 'star_rating') return [1, q.points || 5];
    if (q.type === 'nps') return [0, 10];
    if (q.type === 'slider') return [Number(q.set.min || 0), Number(q.set.max || 100)];
    var codes = (q.options || []).map(function (o) { return o.code; }).filter(function (c) { return isNum(c) && !SPECIAL_CODES[c]; }).map(Number);
    if (!codes.length) return [1, q.points || 5];
    return [Math.min.apply(null, codes), Math.max.apply(null, codes)];
  }
  function defaultMeasure(q) {
    if (q.measure) return q.measure;
    if (/^(likert_emoji|linear_scale|star_rating|semantic_diff|mc_grid)$/.test(q.type)) return 'ordinal';
    if (q.type === 'slider' || q.type === 'nps') return 'scale';
    if (q.type === 'short_text' && q.set.format === 'number') return 'scale';
    return 'nominal';
  }

  // Returns [{name, kind, type:'numeric'|'string', label, values:[[code,en,ml]], measure, q, block, text_en, text_ml, show_if}]
  function variables(Q) {
    var out = [];
    META_VARS.forEach(function (m) { out.push({ name: m[0], kind: 'meta', type: m[1], label: m[2], measure: m[3], values: m[0] === 'consent' ? [[1, 'Agreed', 'സമ്മതിച്ചു'], [0, 'Did not agree', 'സമ്മതിച്ചില്ല']] : [] }); });
    if (yes(Q.settings.allow_ids)) out.push({ name: 'ext_id', kind: 'meta', type: 'string', label: 'ID from personal link', measure: 'nominal', values: [] });
    if (str(Q.settings.completion_code).toLowerCase() === 'random') out.push({ name: 'completion_code', kind: 'meta', type: 'string', label: 'Completion code shown', measure: 'nominal', values: [] });
    Q.questions.forEach(function (q) {
      if (NO_DATA[q.type]) return;
      var base = { kind: 'answer', q: q.id, block: q.block, text_en: q.text.en, text_ml: q.text.ml, show_if: q.show_if, qtype: q.type };
      function add(o) { var v = {}; Object.keys(base).forEach(function (k) { v[k] = base[k]; }); Object.keys(o).forEach(function (k) { v[k] = o[k]; }); out.push(v); }
      var lab = shortLabel(q), meas = defaultMeasure(q);
      switch (q.type) {
        case 'short_text':
          add({ name: q.id, type: q.set.format === 'number' ? 'numeric' : 'string', label: lab, values: [], measure: q.set.format === 'number' ? (q.measure || 'scale') : 'nominal' }); break;
        case 'paragraph': case 'date': case 'time': case 'file_upload':
          add({ name: q.id, type: 'string', label: lab, values: [], measure: 'nominal' }); break;
        case 'single': case 'dropdown':
          add({ name: q.id, type: 'numeric', label: lab, values: valueLabels(q.options), measure: meas });
          if (q.other !== undefined) add({ name: q.id + '_other', type: 'string', label: lab + ' (other, text)', values: [], measure: 'nominal' });
          break;
        case 'checkbox':
          q.options.forEach(function (o) { add({ name: q.id + '_' + o.code, type: 'numeric', label: lab + ': ' + o.label.en, values: [[1, 'Selected', 'തിരഞ്ഞെടുത്തു'], [0, 'Not selected', 'തിരഞ്ഞെടുത്തില്ല']], measure: 'nominal', option: o.code }); });
          if (q.other !== undefined) add({ name: q.id + '_other', type: 'string', label: lab + ' (other, text)', values: [], measure: 'nominal' });
          break;
        case 'mc_grid':
          q.rows.forEach(function (r) { add({ name: q.id + '_' + r.code, type: 'numeric', label: lab + ': ' + r.label.en, values: valueLabels(q.options), measure: meas, row: r.code, text_en: q.text.en + ' — ' + r.label.en, text_ml: (q.text.ml || q.text.en) + ' — ' + (r.label.ml || r.label.en) }); });
          break;
        case 'checkbox_grid':
          q.rows.forEach(function (r) { q.options.forEach(function (o) { add({ name: q.id + '_' + r.code + '_' + o.code, type: 'numeric', label: lab + ': ' + r.label.en + ': ' + o.label.en, values: [[1, 'Selected', 'തിരഞ്ഞെടുത്തു'], [0, 'Not selected', 'തിരഞ്ഞെടുത്തില്ല']], measure: 'nominal', row: r.code, option: o.code }); }); });
          break;
        case 'semantic_diff':
          q.pairs.forEach(function (pr) {
            var vl = []; for (var k = 1; k <= q.points; k++) vl.push([k, k === 1 ? pr.left.en : (k === q.points ? pr.right.en : String(k)), k === 1 ? (pr.left.ml || pr.left.en) : (k === q.points ? (pr.right.ml || pr.right.en) : String(k))]);
            add({ name: q.id + '_' + pr.code, type: 'numeric', label: lab + ': ' + pr.left.en + ' – ' + pr.right.en, values: vl, measure: q.measure || 'ordinal', row: pr.code });
          });
          break;
        case 'likert_emoji': case 'linear_scale':
          add({ name: q.id, type: 'numeric', label: lab, values: valueLabels(q.options), measure: meas }); break;
        case 'star_rating':
          var sv = []; for (var s = 1; s <= q.points; s++) sv.push([s, s + (s === 1 ? ' star' : ' stars'), s + ' നക്ഷത്രം']);
          add({ name: q.id, type: 'numeric', label: lab, values: sv, measure: meas }); break;
        case 'slider':
          add({ name: q.id, type: 'numeric', label: lab, values: [], measure: 'scale' }); break;
        case 'nps':
          add({ name: q.id, type: 'numeric', label: lab, values: [[0, 'Not at all likely', 'ഒട്ടും സാധ്യതയില്ല'], [10, 'Extremely likely', 'വളരെയധികം സാധ്യത']], measure: q.measure || 'scale' });
          break;
        case 'consent':
          add({ name: q.id, type: 'numeric', label: lab, values: [[1, 'Agreed', 'സമ്മതിച്ചു'], [0, 'Did not agree', 'സമ്മതിച്ചില്ല']], measure: 'nominal' }); break;
      }
    });
    // derived
    scaleNames(Q).forEach(function (s) {
      out.push({ name: 'score_' + s, kind: 'derived', type: 'numeric', label: 'Scale score: ' + s + ' (' + scoringRule(Q, s) + ')', values: [], measure: 'scale', scale: s });
    });
    Q.questions.forEach(function (q) {
      if (q.type === 'nps') out.push({ name: npsGroupName(Q, q), kind: 'derived', type: 'numeric', label: 'NPS group for ' + q.id, values: [[1, 'Detractor (0-6)', 'Detractor'], [2, 'Passive (7-8)', 'Passive'], [3, 'Promoter (9-10)', 'Promoter']], measure: 'ordinal', q: q.id });
    });
    if (Q.blocks.some(function (b) { return b.position === 'shuffle' || b.position === 'latin'; }))
      out.push({ name: 'order_blocks', kind: 'derived', type: 'string', label: 'Order of sections shown', values: [], measure: 'nominal' });
    Q.blocks.forEach(function (b) {
      if (b.randomise === 'yes' || b.randomise === 'latin') out.push({ name: 'order_' + b.id, kind: 'derived', type: 'string', label: 'Order of items shown in ' + b.id, values: [], measure: 'nominal', block: b.id });
    });
    if (Q.questions.filter(function (q) { return q.type === 'stimulus'; }).length > 1)
      out.push({ name: 'order_stimuli', kind: 'derived', type: 'string', label: 'Order of stimuli shown', values: [], measure: 'nominal' });
    FLAG_VARS.forEach(function (f) {
      out.push({ name: f[0], kind: 'flag', type: 'numeric', label: f[1], values: f[0] === 'fail_attention' ? [] : [[1, 'Flagged', 'Flagged'], [0, 'Not flagged', 'Not flagged']], measure: f[0] === 'fail_attention' ? 'scale' : 'nominal' });
    });
    return out;
  }

  function scaleNames(Q) {
    var seen = {}, out = [];
    Q.questions.forEach(function (q) { if (q.scale && !seen[q.scale]) { seen[q.scale] = 1; out.push(q.scale); } });
    return out;
  }
  function scoringRule(Q, s) { return (Q.scoring && Q.scoring[s]) === 'sum' ? 'sum' : 'mean'; }

  // ---------------------------------------------------------------- data row
  // rec: {answers, shown:[q ids], orders:{blocks:[], items:{}}, stim_order:[], meta fields...}
  function numericValid(v) { return isNum(v) && Number(v) >= 0 && !SPECIAL_CODES[Number(v)]; }

  function scaleItems(Q, s) {
    var items = [];
    Q.questions.forEach(function (q) {
      if (q.scale !== s) return;
      if (q.type === 'mc_grid' || q.type === 'semantic_diff') {
        (q.rows || q.pairs).forEach(function (r) { items.push({ q: q, row: r.code }); });
      } else items.push({ q: q });
    });
    return items;
  }
  function itemValue(rec, it) {
    var a = rec.answers[it.q.id];
    if (it.row !== undefined) return a && typeof a === 'object' ? a[it.row] : undefined;
    return a;
  }
  function computeScores(Q, rec) {
    var shown = toSet(rec.shown), out = {};
    scaleNames(Q).forEach(function (s) {
      var items = scaleItems(Q, s), vals = [], anyShown = false;
      items.forEach(function (it) {
        if (!shown[it.q.id]) return; anyShown = true;
        var v = itemValue(rec, it); if (!numericValid(v)) return;
        v = Number(v);
        if (it.q.reverse) { var r = it.q.type === 'semantic_diff' ? [1, it.q.points] : scaleRange(it.q); v = r[0] + r[1] - v; }
        vals.push(v);
      });
      if (!anyShown) out['score_' + s] = MISSING.NOT_SHOWN;
      else if (!vals.length) out['score_' + s] = MISSING.UNANSWERED;
      else { var sum = vals.reduce(function (a, b) { return a + b; }, 0); out['score_' + s] = scoringRule(Q, s) === 'sum' ? round(sum, 3) : round(sum / vals.length, 3); }
    });
    return out;
  }
  function npsGroup(v) { if (!numericValid(v)) return null; v = Number(v); return v <= 6 ? 1 : (v <= 8 ? 2 : 3); }
  function toSet(arr) { var s = {}; (arr || []).forEach(function (x) { s[x] = 1; }); return s; }

  function buildRow(Q, rec, vars) {
    vars = vars || variables(Q);
    var qi = qIndex(Q), shown = toSet(rec.shown), A = rec.answers || {}, row = {};
    var scores = computeScores(Q, rec);
    var flags = qualityFlags(Q, rec);
    vars.forEach(function (v) {
      var val;
      if (v.kind === 'meta') val = rec[v.name];
      else if (v.kind === 'answer') {
        var q = qi[v.q], a = A[v.q], isShown = !!shown[v.q], isStr = v.type === 'string';
        var miss = isStr ? '' : (isShown ? MISSING.UNANSWERED : MISSING.NOT_SHOWN);
        if (/_other$/.test(v.name) && v.name === v.q + '_other') {
          val = isShown ? str(A[v.q + '_other']) : '';
        } else if (q.type === 'checkbox') {
          val = !isShown ? miss : (blankish(a) ? MISSING.UNANSWERED : (a.some(function (x) { return eq(x, v.option); }) ? 1 : 0));
        } else if (q.type === 'checkbox_grid') {
          var ra = a && a[v.row];
          val = !isShown ? miss : (blankish(ra) ? MISSING.UNANSWERED : (ra.some(function (x) { return eq(x, v.option); }) ? 1 : 0));
        } else if (q.type === 'mc_grid' || q.type === 'semantic_diff') {
          var rv = a && a[v.row];
          val = !isShown ? miss : (blankish(rv) ? MISSING.UNANSWERED : toNum(rv));
        } else {
          val = !isShown ? miss : (blankish(a) ? miss : (isStr ? str(a) : toNum(a)));
          if (isShown && !blankish(a) && !isStr && !isNum(a)) val = MISSING.UNANSWERED;
        }
      } else if (v.kind === 'derived') {
        if (v.scale) val = scores[v.name];
        else if (v.name === 'order_blocks') val = ((rec.orders && rec.orders.blocks) || []).join('|');
        else if (v.name === 'order_stimuli') val = (rec.stim_order || []).join('|');
        else if (/^order_/.test(v.name)) val = ((rec.orders && rec.orders.items && rec.orders.items[v.block]) || []).join('|');
        else if (v.q) { var nv = A[v.q]; val = !shown[v.q] ? MISSING.NOT_SHOWN : (npsGroup(nv) || MISSING.UNANSWERED); }
      } else if (v.kind === 'flag') {
        val = flags[v.name] !== undefined ? flags[v.name] : (rec[v.name] !== undefined ? rec[v.name] : 0);
      }
      row[v.name] = val === undefined || val === null ? '' : val;
    });
    return row;
  }

  function qualityFlags(Q, rec) {
    var shown = toSet(rec.shown), A = rec.answers || {}, f = { flag_straightline: 0, fail_attention: 0, flag_short_text: 0 };
    // straight-lining: a scale (or grid / semantic differential) with 6+ items, all answered identically
    var groups = scaleNames(Q).map(function (s) { return scaleItems(Q, s); });
    Q.questions.forEach(function (q) {
      if ((q.type === 'mc_grid' || q.type === 'semantic_diff') && !q.scale) groups.push((q.rows || q.pairs).map(function (r) { return { q: q, row: r.code }; }));
    });
    groups.forEach(function (items) {
      if (items.length < 6) return;
      var vals = items.map(function (it) { return shown[it.q.id] ? itemValue(rec, it) : undefined; });
      if (vals.every(numericValid) && vals.every(function (v) { return eq(v, vals[0]); })) f.flag_straightline = 1;
    });
    Q.questions.forEach(function (q) {
      if (!shown[q.id]) return;
      if (q.check && q.check.kind === 'attention' && q.check.code !== null) {
        var a = A[q.id];
        var ok = Array.isArray(a) ? (a.length === 1 && eq(a[0], q.check.code)) : eq(a, q.check.code);
        if (!ok) f.fail_attention++;
      }
      if (q.required && (q.type === 'paragraph' || (q.type === 'short_text' && !q.set.format)) && !blankish(A[q.id]) && words(A[q.id]) < 3) f.flag_short_text = 1;
    });
    return f;
  }

  // ---------------------------------------------------------------- flow
  // Latin square (balanced / Williams design). Returns permutation of 0..n-1 for row k.
  function latinRow(n, k) {
    if (n <= 1) return n === 1 ? [0] : [];
    var first = [0], lo = 1, hi = n - 1, toggle = true;
    while (first.length < n) { if (toggle) first.push(lo++); else first.push(hi--); toggle = !toggle; }
    var rows = n % 2 === 0 ? n : 2 * n;
    var r = ((k % rows) + rows) % rows;
    var base = first.map(function (x) { return (x + (r % n)) % n; });
    return r >= n ? base.reverse() : base;
  }

  // Decide orders for a respondent (blocks + items + options). ctx: {latin: int, rnd}
  function makeOrders(Q, ctx) {
    var rnd = ctx.rnd || Math.random, latin = ctx.latin || 0;
    var main = Q.blocks.filter(function (b) { return b.position !== 'debrief'; });
    var slotsS = [], slotsL = [];
    main.forEach(function (b, i) { if (b.position === 'shuffle') slotsS.push(i); if (b.position === 'latin') slotsL.push(i); });
    var ids = main.map(function (b) { return b.id; });
    var sh = shuffle(slotsS.map(function (i) { return ids[i]; }), rnd);
    slotsS.forEach(function (slot, j) { ids[slot] = sh[j]; });
    var perm = latinRow(slotsL.length, latin), lat = slotsL.map(function (i) { return main[i].id; });
    slotsL.forEach(function (slot, j) { ids[slot] = lat[perm[j]]; });
    var items = {}, options = {};
    Q.blocks.forEach(function (b) {
      var qs = Q.questions.filter(function (q) { return q.block === b.id; }).map(function (q) { return q.id; });
      if (b.randomise === 'yes') items[b.id] = shuffle(qs, rnd);
      else if (b.randomise === 'latin') { var p = latinRow(qs.length, latin); items[b.id] = p.map(function (i) { return qs[i]; }); }
      else items[b.id] = qs;
    });
    Q.questions.forEach(function (q) {
      if (!q.shuffle || !q.options) return;
      var pinned = function (o) { return eq(o.code, q.other) || (q.exclusive || []).some(function (e) { return eq(e, o.code); }) || SPECIAL_CODES[o.code]; };
      var free = q.options.filter(function (o) { return !pinned(o); }), fixed = q.options.filter(pinned);
      options[q.id] = shuffle(free, rnd).concat(fixed).map(function (o) { return o.code; });
    });
    return { blocks: ids, debrief: Q.blocks.filter(function (b) { return b.position === 'debrief'; }).map(function (b) { return b.id; }), items: items, options: options };
  }

  // Ordered list of screens (before visibility). Each: {id, kind:'intro'|'q', block, q, row}
  function buildFlow(Q, orders, opts) {
    opts = opts || {};
    var qi = qIndex(Q), bi_ = blockIndex(Q), flow = [];
    function addBlock(bid, debrief) {
      var b = bi_[bid]; if (!b) return;
      var hasText = b.title.en || b.intro.en;
      if (!debrief && b.intro_card && hasText) flow.push({ id: 'intro:' + bid, kind: 'intro', block: bid });
      (orders.items[bid] || []).forEach(function (qid) {
        var q = qi[qid]; if (!q) return;
        if (q.type === 'phone' && opts.collect_phone === 'no') return;
        if (q.type === 'stimulus' && Q.media[q.media] && Q.media[q.media].sound_check) flow.push({ id: 'sc:' + qid, kind: 'soundcheck', block: bid, q: qid, debrief: debrief });
        if (q.type === 'mc_grid' || q.type === 'checkbox_grid') {
          q.rows.forEach(function (r, i) { flow.push({ id: 'q:' + qid + ':' + r.code, kind: 'q', block: bid, q: qid, row: r.code, rowIndex: i, debrief: debrief }); });
        } else flow.push({ id: 'q:' + qid, kind: 'q', block: bid, q: qid, debrief: debrief });
      });
    }
    orders.blocks.forEach(function (bid) { addBlock(bid, false); });
    if (opts.includeDebrief) orders.debrief.forEach(function (bid) { addBlock(bid, true); });
    return flow;
  }

  // Getter for expressions over the current answers.
  function getter(Q, state) {
    var qi = Q._qi || (Q._qi = qIndex(Q));
    return function (id) {
      if (id === 'condition') return state.condition;
      if (id === 'lang') return state.lang;
      if (id === 'src') return state.src;
      var A = state.answers || {};
      if (qi[id]) return A[id];
      // variable names: checkbox option (q_code), grid row (q_row), grid cell (q_row_code), other text
      var m = /^(.*)_([^_]+)$/.exec(id);
      if (m && qi[m[1]]) {
        var q = qi[m[1]], a = A[m[1]];
        if (m[2] === 'other') return A[id];
        if (q.type === 'checkbox') return blankish(a) ? undefined : (a.some(function (x) { return eq(x, m[2]); }) ? 1 : 0);
        if (a && typeof a === 'object') return a[m[2]];
      }
      var m2 = /^(.*)_([^_]+)_([^_]+)$/.exec(id);
      if (m2 && qi[m2[1]] && qi[m2[1]].type === 'checkbox_grid') {
        var ra = (A[m2[1]] || {})[m2[2]]; return blankish(ra) ? undefined : (ra.some(function (x) { return eq(x, m2[3]); }) ? 1 : 0);
      }
      return undefined;
    };
  }

  function armMatch(list_, cond) { return !list_.length || list_.some(function (a) { return eq(a, cond); }); }
  function blockVisible(Q, b, state, get) {
    if (!b) return true;
    return armMatch(b.condition, state.condition) && test(b.show_if, get || getter(Q, state));
  }
  function questionVisible(Q, q, state, get) {
    if (!q) return false;
    get = get || getter(Q, state);
    var b = (Q._bi || (Q._bi = blockIndex(Q)))[q.block];
    return blockVisible(Q, b, state, get) && armMatch(q.condition, state.condition) && test(q.show_if, get);
  }
  function screenVisible(Q, sc, state) {
    var get = getter(Q, state);
    if (sc.kind === 'intro') {
      var b = (Q._bi || (Q._bi = blockIndex(Q)))[sc.block];
      if (!blockVisible(Q, b, state, get)) return false;
      // hide an intro card if nothing in its block is visible
      var qi = Q._qi || (Q._qi = qIndex(Q));
      return (state.orders.items[sc.block] || []).some(function (qid) { return questionVisible(Q, qi[qid], state, get) && !(qi[qid].type === 'phone' && state.collect_phone === 'no'); });
    }
    var q = (Q._qi || (Q._qi = qIndex(Q)))[sc.q];
    return questionVisible(Q, q, state, get);
  }

  // Answered check for a screen.
  function isAnswered(q, a, row) {
    if (row !== undefined) { var r = a && a[row]; return !blankish(r); }
    if (q.type === 'semantic_diff') return a && q.pairs.every(function (p) { return !blankish(a[p.code]); });
    return !blankish(a);
  }
  function answerable(q) { return !NO_DATA[q.type] || q.type === 'phone'; }

  // Piping: replace {q_id} with the answer's label in the given language.
  function pipe(Q, text, state, lang) {
    if (!text || text.indexOf('{') < 0) return text;
    var qi = Q._qi || (Q._qi = qIndex(Q));
    return text.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, function (m, id) {
      var q = qi[id], a = (state.answers || {})[id];
      if (!q) { var g = getter(Q, state)(id); return blankish(g) ? '…' : String(g); }
      if (blankish(a)) return '…';
      var lab = function (code) {
        if (q.other !== undefined && eq(code, q.other) && str(state.answers[id + '_other'])) return state.answers[id + '_other'];
        var o = (q.options || []).filter(function (x) { return eq(x.code, code); })[0]; return o ? pick(o.label, lang) : String(code);
      };
      if (Array.isArray(a)) return a.map(lab).join(', ');
      if (typeof a === 'object') return '…';
      if (q.options && q.type !== 'nps' && q.type !== 'linear_scale') return lab(a);
      return String(a);
    });
  }

  // ---------------------------------------------------------------- assignment & quotas
  // counts: {arm: {assigned, complete}}
  function assignCondition(Q, counts, rnd) {
    rnd = rnd || Math.random;
    var arms = Q.conditions.filter(function (c) { var k = counts[c.id] || {}; return !(c.target_n && (k.complete || 0) >= c.target_n) && c.weight > 0; });
    if (!Q.conditions.length) return '';
    if (!arms.length) return null;
    var alloc = Q.allocation;
    if (alloc === 'random') return arms[Math.floor(rnd() * arms.length)].id;
    if (alloc === 'weighted') {
      var tot = arms.reduce(function (s, c) { return s + c.weight; }, 0), x = rnd() * tot;
      for (var i = 0; i < arms.length; i++) { x -= arms[i].weight; if (x < 0) return arms[i].id; }
      return arms[arms.length - 1].id;
    }
    // balanced: fewest completes (relative to weight), ties by fewest assigned, then random
    var best = null;
    shuffle(arms, rnd).forEach(function (c) {
      var k = counts[c.id] || {}, sc = [(k.complete || 0) / c.weight, (k.assigned || 0) / c.weight];
      if (!best || sc[0] < best.sc[0] - 1e-9 || (Math.abs(sc[0] - best.sc[0]) < 1e-9 && sc[1] < best.sc[1] - 1e-9)) best = { id: c.id, sc: sc };
    });
    return best.id;
  }
  function matchingQuotas(Q, state) {
    var get = getter(Q, state);
    return (Q.quotas || []).filter(function (qt) {
      var refs = exprRefs(safeParse(qt.expr));
      // a quota applies only once every question it refers to is answered
      if (refs.some(function (r) { return r !== 'condition' && blankish(get(r)); })) return false;
      return test(qt.expr, get);
    }).map(function (qt) { return qt.id; });
  }
  function safeParse(e) { try { return parseExpr(e); } catch (x) { return null; } }

  // ---------------------------------------------------------------- estimates
  function estimateSeconds(Q) {
    var sec = 30; // welcome + consent
    Q.questions.forEach(function (q) {
      switch (q.type) {
        case 'likert_emoji': case 'linear_scale': case 'star_rating': case 'slider': case 'nps': sec += 6; break;
        case 'mc_grid': case 'checkbox_grid': sec += 6 * (q.rows || []).length; break;
        case 'semantic_diff': sec += 6 * (q.pairs || []).length; break;
        case 'single': case 'checkbox': case 'dropdown': case 'consent': sec += 20; break;
        case 'paragraph': case 'file_upload': sec += 45; break;
        case 'short_text': case 'phone': sec += q.set.format === 'number' ? 10 : 20; break;
        case 'date': case 'time': sec += 12; break;
        case 'info': sec += 10; break;
        case 'stimulus': var m = Q.media[q.media]; sec += m ? Math.max(m.min_view_sec || 0, m.fixed_exposure_sec || 0, m.type === 'image' ? 8 : 45) : 30; break;
      }
    });
    Q.blocks.forEach(function (b) { if (b.intro_card && (b.title.en || b.intro.en)) sec += 4; });
    return sec;
  }
  function blockSeconds(Q, bid) {
    var sub = { questions: Q.questions.filter(function (q) { return q.block === bid; }), blocks: [], media: Q.media };
    return estimateSeconds(sub) - 30;
  }

  // ---------------------------------------------------------------- validator
  // data: same shape as buildQuestionnaire input, but with _row numbers on each row.
  // prev: previous published questionnaire (or null). hasData(varName) -> bool
  function validate(data, prev, hasData) {
    var issues = [];
    function add(level, sheet, row, msg) { issues.push({ level: level, sheet: sheet, row: row || '', msg: msg }); }
    var S = data.settings || {};
    var mlOn = /ml/i.test(str(S.languages) || 'en,ml');   // Malayalam switched off: no Malayalam warnings
    var Q;
    try { Q = buildQuestionnaire(data); } catch (e) { add('error', 'Questions', '', 'Could not read the questionnaire: ' + e.message); return { issues: issues }; }
    var listNames = {};
    (data.choices || []).forEach(function (r) {
      var n = str(r.list_name); if (!n) return;
      listNames[n] = (listNames[n] || 0) + 1;
      if (!isNum(r.code) || String(Number(r.code)) !== str(r.code) || Number(r.code) % 1 !== 0) add('error', 'Choices', r._row, 'List "' + n + '": code "' + str(r.code) + '" must be a whole number.');
      if (!str(r.label_en)) add('error', 'Choices', r._row, 'List "' + n + '": code ' + str(r.code) + ' has no English label.');
      if (mlOn && !str(r.label_ml)) add('warning', 'Choices', r._row, 'List "' + n + '": code ' + str(r.code) + ' has no Malayalam label (English will be shown).');
    });
    var codesSeen = {};
    (data.choices || []).forEach(function (r) { var k = str(r.list_name) + '|' + str(r.code); if (str(r.list_name)) { if (codesSeen[k]) add('error', 'Choices', r._row, 'List "' + str(r.list_name) + '" uses code ' + str(r.code) + ' twice.'); codesSeen[k] = 1; } });

    // Settings
    ['study_title_en', 'study_code'].forEach(function (k) { if (!str(S[k])) add('error', 'Settings', '', 'Settings "' + k + '" is empty.'); });
    if (str(S.study_code) && !/^[a-z0-9][a-z0-9_-]*$/i.test(str(S.study_code))) add('error', 'Settings', '', 'study_code should be letters and digits only, e.g. cb01.');
    if (mlOn && !str(S.study_title_ml)) add('warning', 'Settings', '', 'study_title_ml (Malayalam title) is empty.');
    if (str(S.languages) && !/^(en|en,ml)$/i.test(str(S.languages))) add('error', 'Settings', '', 'languages must be en,ml (English and Malayalam) or en (English only).');
    if (!mlOn && str(S.default_lang).toLowerCase() === 'ml') add('warning', 'Settings', '', 'default_lang is ml but Malayalam is switched off (languages = en); English will be used.');
    ['open_date', 'close_date'].forEach(function (k) { if (str(S[k]) && !/^\d{4}-\d{2}-\d{2}$/.test(dateStr(S[k]))) add('error', 'Settings', '', k + ' must be a date like 2026-11-30.'); });
    if (str(S.collect_phone) && !/^(no|optional|required)$/i.test(str(S.collect_phone))) add('error', 'Settings', '', 'collect_phone must be no, optional or required.');
    ['consent_purpose', 'consent_time', 'consent_voluntary', 'consent_data'].forEach(function (k) {
      if (!str(S[k + '_en'])) add('error', 'Settings', '', k + '_en is empty (needed for the consent screen).');
      else if (mlOn && !str(S[k + '_ml'])) add('warning', 'Settings', '', k + '_ml is empty (English will be shown).');
    });
    if (!str(S.researcher_email) && !str(S.researcher_phone)) add('warning', 'Settings', '', 'Add researcher_email so respondents can contact you.');
    Q.quotas.forEach(function (qt) {
      try { parseExpr(qt.expr); } catch (e) { add('error', 'Settings', '', qt.id + ': ' + e.message); }
      if (!isNum(qt.cap)) add('error', 'Settings', '', qt.id + ': put the cap after =>, e.g. gender = 1 => 300');
    });

    // Blocks
    var blockIds = {};
    (data.blocks || []).forEach(function (b) {
      var id = str(b.block_id); if (!id) return;
      if (blockIds[id]) add('error', 'Blocks', b._row, 'Block "' + id + '" is listed twice.');
      blockIds[id] = 1;
      var pos = str(b.position).toLowerCase();
      if (pos && !/^(fixed|shuffle|latin|debrief)$/.test(pos)) add('error', 'Blocks', b._row, 'Block "' + id + '": position must be fixed, shuffle, latin or debrief.');
      var rnd = str(b.randomise_items).toLowerCase();
      if (rnd && !/^(yes|no|latin)$/.test(rnd)) add('error', 'Blocks', b._row, 'Block "' + id + '": randomise_items must be yes, no or latin.');
      if (mlOn && ((str(b.title_en) && !str(b.title_ml)) || (str(b.intro_en) && !str(b.intro_ml)))) add('warning', 'Blocks', b._row, 'Block "' + id + '": Malayalam title or intro is missing.');
      list(b.condition).forEach(function (a) { if (!Q.conditions.some(function (c) { return c.id === a; })) add('error', 'Blocks', b._row, 'Block "' + id + '": condition "' + a + '" is not in the Conditions sheet.'); });
    });

    // Conditions
    var allocs = {};
    (data.conditions || []).forEach(function (c) { if (str(c.allocation)) allocs[str(c.allocation).toLowerCase()] = 1; });
    Object.keys(allocs).forEach(function (a) { if (!/^(random|balanced|weighted)$/.test(a)) add('error', 'Conditions', '', 'allocation must be random, balanced or weighted (found "' + a + '").'); });
    if (Object.keys(allocs).length > 1) add('warning', 'Conditions', '', 'Different allocation methods are listed; the first one (' + Q.allocation + ') is used for all arms.');

    // Questions
    var seen = {}, order = {}, varNames = {};
    var rows = (data.questions || []).filter(function (r) { return str(r.q_id) || str(r.type) || str(r.text_en); });
    rows.forEach(function (r, i) { if (str(r.q_id)) order[str(r.q_id)] = i; });
    var phoneRows = 0, openText = 0, runScale = 0, maxRun = 0;
    rows.forEach(function (r, i) {
      var id = str(r.q_id), type = str(r.type).toLowerCase(), row = r._row, where = id ? '"' + id + '"' : 'row ' + row;
      if (!id) { add('error', 'Questions', row, 'This row has no q_id.'); return; }
      if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(id)) add('error', 'Questions', row, where + ': q_id must start with a letter and use only letters, digits and _.');
      if (id.length > 50) add('warning', 'Questions', row, where + ': q_id is long; SPSS names work best under 30 characters.');
      if (seen[id.toLowerCase()]) add('error', 'Questions', row, where + ': this q_id is used twice.');
      seen[id.toLowerCase()] = 1;
      if (/^(condition|lang|src|status|consent|resp_id)$/i.test(id)) add('error', 'Questions', row, where + ': this q_id is reserved; choose another name.');
      if (!str(r.block)) add('error', 'Questions', row, where + ': block is empty.');
      else if (!blockIds[str(r.block)]) add('error', 'Questions', row, where + ': block "' + str(r.block) + '" is not in the Blocks sheet.');
      if (str(r.show_if)) {
        try {
          var refs = exprRefs(parseExpr(r.show_if));
          refs.forEach(function (ref) {
            if (/^(condition|lang|src)$/.test(ref)) return;
            var base = order[ref] !== undefined ? ref : baseOf(ref, order);
            if (base === null) add('error', 'Questions', row, where + ': show_if refers to "' + ref + '", which does not exist.');
            else if (order[base] >= i) add('error', 'Questions', row, where + ': show_if refers to "' + ref + '", which comes later (or is this question).');
          });
        } catch (e) { add('error', 'Questions', row, where + ': show_if cannot be read: ' + e.message); }
      }
      if (TYPES.indexOf(type) < 0) { add('error', 'Questions', row, where + ': unknown type "' + str(r.type) + '".'); return; }
      if (!str(r.text_en) && type !== 'stimulus' && type !== 'phone') add('error', 'Questions', row, where + ': text_en is empty.');
      if (mlOn && str(r.text_en) && !str(r.text_ml)) add('warning', 'Questions', row, where + ': Malayalam text is missing (English will be shown).');
      if (mlOn && str(r.help_en) && !str(r.help_ml)) add('warning', 'Questions', row, where + ': Malayalam help text is missing.');
      if (words(r.text_en) > 20 && type !== 'info' && type !== 'consent') add('warning', 'Questions', row, where + ': the question has ' + words(r.text_en) + ' words; aim for under 20.');
      if (str(r.required) && !/^(yes|no|y|n|true|false)$/i.test(str(r.required))) add('error', 'Questions', row, where + ': required must be yes or no.');
      var set = parseSettings(r.settings), allowed = (TYPE_SETTINGS[type] || []).concat(COMMON_SETTINGS);
      Object.keys(set).forEach(function (k) { if (allowed.indexOf(k) < 0) add('warning', 'Questions', row, where + ': setting "' + k + '" is not used by type ' + type + '.'); });
      if (set.layout && !/^(auto|list)$/i.test(set.layout)) add('error', 'Questions', row, where + ': layout must be auto or list.');
      var q = Q.questions.filter(function (x) { return x.id === id; })[0];
      var needsChoices = /^(single|checkbox|dropdown)$/.test(type);
      if (needsChoices) {
        var ch = str(r.choices);
        if (!ch) add('error', 'Questions', row, where + ': choices is empty.');
        else if (!listNames[ch] && !isInlineChoices(ch)) add('error', 'Questions', row, where + ': choice list "' + ch + '" is not in the Choices sheet.');
      }
      if (type === 'mc_grid' || type === 'checkbox_grid') {
        if (!set.rows) add('error', 'Questions', row, where + ': add rows=<list name> in settings.');
        else if (!listNames[set.rows] && !isInlineChoices(set.rows)) add('error', 'Questions', row, where + ': rows list "' + set.rows + '" is not in Choices.');
        var cl = set.choices || str(r.choices);
        if (!cl) add('error', 'Questions', row, where + ': add a choices list.');
        else if (!listNames[cl] && !isInlineChoices(cl)) add('error', 'Questions', row, where + ': choice list "' + cl + '" is not in Choices.');
      }
      if (type === 'semantic_diff') {
        var pl = set.pairs || str(r.choices);
        if (!pl) add('error', 'Questions', row, where + ': add pairs=<list name>; each label is written "Cheap | Expensive".');
        else if (!listNames[pl] && !isInlineChoices(pl)) add('error', 'Questions', row, where + ': pairs list "' + pl + '" is not in Choices.');
        else if (q && q.pairs.some(function (p) { return !p.right.en; })) add('error', 'Questions', row, where + ': each pair label needs a | between the two ends, e.g. Cheap | Expensive.');
      }
      if (type === 'likert_emoji' && set.points && !/^(5|7)$/.test(set.points)) add('error', 'Questions', row, where + ': points must be 5 or 7.');
      if (type === 'likert_emoji' && q && str(r.choices) && q.options.length !== q.points) add('error', 'Questions', row, where + ': the choice list has ' + q.options.length + ' options but points=' + q.points + '.');
      if ((type === 'stimulus') && !str(r.media)) add('error', 'Questions', row, where + ': stimulus needs a media id.');
      if (str(r.media) && !Q.media[str(r.media)]) add('error', 'Questions', row, where + ': media "' + str(r.media) + '" is not in the Media sheet.');
      if (type === 'phone') {
        phoneRows++;
        if (!/^(optional|required)$/i.test(str(S.collect_phone))) add('warning', 'Questions', row, where + ': collect_phone is "no" in Settings, so this phone question will be skipped.');
      }
      list(r.condition).forEach(function (a) { if (!Q.conditions.some(function (c) { return c.id === a; })) add('error', 'Questions', row, where + ': condition "' + a + '" is not in the Conditions sheet.'); });
      (str(r.text_en) + ' ' + str(r.text_ml)).replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, function (m, ref) {
        if (order[ref] === undefined) add('error', 'Questions', row, where + ': {' + ref + '} in the text refers to a q_id that does not exist.');
        else if (order[ref] >= i) add('error', 'Questions', row, where + ': {' + ref + '} in the text refers to a later question.');
        return m;
      });
      if (str(r.check)) {
        var c = str(r.check).toLowerCase();
        if (!/^(attention=-?\d+|manipulation(=-?\d+)?)$/.test(c)) add('error', 'Questions', row, where + ': check must look like attention=4 or manipulation.');
      }
      if (yes(r.reverse) && !str(r.scale)) add('warning', 'Questions', row, where + ': reverse=yes has no effect without a scale name.');
      if (str(r.measure) && !/^(nominal|ordinal|scale)$/i.test(str(r.measure))) add('error', 'Questions', row, where + ': measure must be nominal, ordinal or scale.');
      if (q && q.options) q.options.forEach(function (o) { if (!str(o.label.ml) && !isNum(o.label.en)) { /* reported in Choices */ } });
      if (type === 'paragraph') { openText++; }
      // fatigue: consecutive grid/scale items
      var isScaleish = /^(likert_emoji|linear_scale|star_rating|slider|semantic_diff|mc_grid|checkbox_grid|nps)$/.test(type);
      var n = isScaleish ? ((type === 'mc_grid' || type === 'checkbox_grid') && q ? q.rows.length : (type === 'semantic_diff' && q ? q.pairs.length : 1)) : 0;
      if (i > 0 && str(rows[i - 1].block) !== str(r.block)) runScale = 0; // a section intro card breaks the run
      runScale = isScaleish ? runScale + n : 0; if (runScale > maxRun) maxRun = runScale;
      if (runScale > 7 && isScaleish && (runScale - n) <= 7) add('warning', 'Questions', row, where + ': more than 7 grid or scale items in a row; add a different kind of screen to reduce fatigue.');
      if (q) variableNames(q, Q).forEach(function (vn) { if (varNames[vn.toLowerCase()]) add('error', 'Questions', row, where + ': creates the variable "' + vn + '", which another question also creates.'); varNames[vn.toLowerCase()] = 1; });
    });
    (data.blocks || []).forEach(function (b) {
      var id = str(b.block_id); if (!id || !str(b.show_if)) return;
      try {
        exprRefs(parseExpr(b.show_if)).forEach(function (ref) {
          if (/^(condition|lang|src)$/.test(ref)) return;
          if (order[ref] === undefined && baseOf(ref, order) === null) add('error', 'Blocks', b._row, 'Block "' + id + '": show_if refers to "' + ref + '", which does not exist.');
        });
      } catch (e) { add('error', 'Blocks', b._row, 'Block "' + id + '": show_if cannot be read: ' + e.message); }
      if (str(b.position).toLowerCase() === 'debrief') return;
    });
    var debriefIds = {}; Q.blocks.forEach(function (b) { if (b.position === 'debrief') debriefIds[b.id] = 1; });
    Q.questions.forEach(function (q) { if (debriefIds[q.block] && q.type !== 'info' && q.type !== 'stimulus') add('warning', 'Questions', '', '"' + q.id + '" is in a debrief section, which is shown after answers are saved, so its answer is not stored. Use info screens there.'); });
    if (/^(optional|required)$/i.test(str(S.collect_phone)) && !phoneRows) add('warning', 'Questions', '', 'collect_phone is on, but there is no question of type phone.');
    if (openText > 3) add('warning', 'Questions', '', openText + ' paragraph questions; keep open text to a few, and optional unless essential.');
    var scaleCount = {};
    Q.questions.forEach(function (q) { if (q.scale) scaleCount[q.scale] = (scaleCount[q.scale] || 0) + 1; });

    // time estimate
    var est = Math.round(estimateSeconds(Q) / 60);
    var target = Number(S.target_minutes || 15);
    if (est > target) add('warning', 'Settings', '', 'Estimated time is about ' + est + ' minutes, above your target of ' + target + '.');

    // compare with the last published version
    if (prev) {
      var pv = variables(prev), dv = variables(Q), dvi = {};
      dv.forEach(function (v) { dvi[v.name] = v; });
      pv.forEach(function (v) {
        if (v.kind !== 'answer') return;
        var d = dvi[v.name];
        if (!d) {
          if (hasData && hasData(v.name)) add('error', 'Questions', '', 'Variable "' + v.name + '" already has data but is no longer in the questionnaire. Put the question back, or hide it with a condition instead of deleting it.');
          else add('warning', 'Questions', '', 'Variable "' + v.name + '" from the published version has been removed.');
          return;
        }
        var pc = (v.values || []).map(function (x) { return x[0] + '=' + x[1]; }).join(';');
        var dc = (d.values || []).map(function (x) { return x[0] + '=' + x[1]; }).join(';');
        if (pc !== dc && v.values.length) add('warning', 'Questions', '', 'The codes or labels of "' + v.name + '" have changed since the last published version. Check this is intended: data already collected keeps the old codes.');
        if (v.type !== d.type) add('warning', 'Questions', '', '"' + v.name + '" changed from ' + v.type + ' to ' + d.type + '.');
      });
    }
    return { issues: issues, estimate_minutes: est, questionnaire: Q };
  }
  function baseOf(ref, order) {
    var m = /^(.*)_([^_]+)$/.exec(ref); if (m && order[m[1]] !== undefined) return m[1];
    var m2 = /^(.*)_([^_]+)_([^_]+)$/.exec(ref); if (m2 && order[m2[1]] !== undefined) return m2[1];
    return null;
  }
  function variableNames(q, Q) {
    var fake = { questions: [q], blocks: [], conditions: [], settings: {}, media: {}, scoring: {} };
    return variables(fake).filter(function (v) { return v.kind === 'answer'; }).map(function (v) { return v.name; });
  }
  function dateStr(v) {
    if (v instanceof Date) { var d = new Date(v.getTime() + 330 * 60000); return d.toISOString().slice(0, 10); }
    return str(v).slice(0, 10);
  }

  // ---------------------------------------------------------------- misc
  var RESUME_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  function makeCode(n, rnd) { rnd = rnd || Math.random; var s = ''; for (var i = 0; i < n; i++) s += RESUME_ALPHABET[Math.floor(rnd() * RESUME_ALPHABET.length)]; return s; }
  function normCode(c) { return str(c).toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1'); }
  function validPhone(p) { var d = str(p).replace(/[^\d]/g, ''); if (d.length === 12 && d.slice(0, 2) === '91') d = d.slice(2); if (d.length === 11 && d[0] === '0') d = d.slice(1); return /^[6-9]\d{9}$/.test(d) ? d : null; }

  // Cronbach's alpha. rows: array of arrays (respondents x items), complete cases only.
  function cronbachAlpha(rows) {
    rows = rows.filter(function (r) { return r.every(numericValid); }).map(function (r) { return r.map(Number); });
    if (rows.length < 2 || !rows[0] || rows[0].length < 2) return null;
    var k = rows[0].length;
    function variance(a) { var m = a.reduce(function (s, x) { return s + x; }, 0) / a.length; return a.reduce(function (s, x) { return s + (x - m) * (x - m); }, 0) / (a.length - 1); }
    var itemVar = 0;
    for (var j = 0; j < k; j++) itemVar += variance(rows.map(function (r) { return r[j]; }));
    var totVar = variance(rows.map(function (r) { return r.reduce(function (s, x) { return s + x; }, 0); }));
    if (!totVar) return null;
    return round((k / (k - 1)) * (1 - itemVar / totVar), 3);
  }
  // Items of a scale as variable names, with reversal info, for reliability.
  function scaleItemVars(Q, s) {
    return scaleItems(Q, s).map(function (it) {
      var name = it.row !== undefined ? it.q.id + '_' + it.row : it.q.id;
      var r = it.q.type === 'semantic_diff' ? [1, it.q.points] : scaleRange(it.q);
      return { name: name, reverse: it.q.reverse, lo: r[0], hi: r[1] };
    });
  }

  return {
    ENGINE_VERSION: ENGINE_VERSION, TYPES: TYPES, AUTO_ADVANCE: AUTO_ADVANCE, NO_DATA: NO_DATA, MISSING: MISSING, TYPE_SETTINGS: TYPE_SETTINGS,
    META_VARS: META_VARS, FLAG_VARS: FLAG_VARS,
    str: str, yes: yes, isNum: isNum, toNum: toNum, list: list, blankish: blankish, words: words, pick: pick, shuffle: shuffle, round: round, median: median, eq: eq,
    parseSettings: parseSettings, parseInlineChoices: parseInlineChoices, parseExpr: parseExpr, evalExpr: evalExpr, exprRefs: exprRefs, test: test,
    buildQuestionnaire: buildQuestionnaire, publicSettings: publicSettings, variables: variables, buildRow: buildRow, computeScores: computeScores,
    qualityFlags: qualityFlags, npsGroup: npsGroup, scaleNames: scaleNames, scaleItemVars: scaleItemVars, scoringRule: scoringRule,
    latinRow: latinRow, makeOrders: makeOrders, buildFlow: buildFlow, getter: getter, screenVisible: screenVisible, questionVisible: questionVisible,
    blockVisible: blockVisible, isAnswered: isAnswered, answerable: answerable, pipe: pipe, qIndex: qIndex, blockIndex: blockIndex,
    assignCondition: assignCondition, matchingQuotas: matchingQuotas, estimateSeconds: estimateSeconds, blockSeconds: blockSeconds,
    validate: validate, makeCode: makeCode, normCode: normCode, validPhone: validPhone, cronbachAlpha: cronbachAlpha, dateStr: dateStr,
    scaleRange: scaleRange, npsGroupName: npsGroupName, defaultLikert: defaultLikert
  };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Engine;

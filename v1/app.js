/* Survey Tool respondent page — v1.
 * Needs engine.js loaded first. Configure with window.SURVEY = { api, study } (the study page does this),
 * or ?api=...&study=... in the address. */
(function () {
  'use strict';
  var E = window.Engine;
  var CFG = window.SURVEY || {};
  var URLP = new URLSearchParams(location.search);
  var API = URLP.get('api') || CFG.api || '';
  var STUDY = CFG.study || URLP.get('study') || '';
  var PREVIEW = URLP.get('preview') || CFG.preview || '';
  var SRC = (URLP.get('src') || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 30);
  var EXT = (URLP.get('id') || '').slice(0, 60);
  var ROOT = CFG.site || siteRoot();
  var KEY = 'svy:' + (STUDY || 'x') + (PREVIEW ? ':preview' : '');
  var DEVKEY = 'svy:device';
  var root = document.getElementById('app');

  var Q = null, S = null, STATUS = 'open', FLOW = [], DEBRIEF = [];
  var V = { shownAt: 0, err: '', timer: null, enc: '', busy: false, overlay: '', uploads: {}, stim: {}, timers: [] };

  // ------------------------------------------------------------------ text
  var T = {
    en: {
      start: 'Start survey', research: 'Research study', about_min: 'About {n} minutes', about_1min: 'About 1 minute', anonymous: 'Anonymous', confidential: 'Confidential',
      finish_any: 'Finish later anytime', choose_lang: 'Choose your language', have_code: 'Have a resume code?', enter_code: 'Enter your 6-character code',
      cont: 'Continue', welcome_back: 'Welcome back', welcome_back_txt: 'Your answers are saved on this phone. Continue where you stopped.',
      consent: 'Consent', before: 'Before you begin', read_summary: 'Please read this short summary.', purpose: 'Purpose', time: 'Time', your_choice: 'Your choice',
      your_answers: 'Your answers', phone_number: 'Phone number', full_sheet: 'Read the full information sheet', agree: 'I agree to take part',
      disagree: 'I do not agree', next: 'Next', submit: 'Submit', saved_device: 'Saved on this device',
      not_sent: 'Saved on this device · will send when online', finish_later: 'Finish later', part: 'Part {x} of {y}', n_q: '{n} questions', one_q: '1 question',
      moves_on: 'Moves on as soon as you choose', choose_one: 'Please choose an answer to continue.', please_answer: 'Please answer this question to continue.',
      at_least: 'Please choose at least {n}.', up_to: 'You can choose up to {n}.', describe: 'Please describe', other_needed: 'Please type your answer for "{o}".',
      number_needed: 'Please enter a number.', between: 'Please enter a number from {a} to {b}.', email_needed: 'Please enter a valid email address.',
      phone_needed: 'Please enter a 10-digit mobile number starting with 6, 7, 8 or 9.', min_words: 'Please write at least {n} words.',
      date_range: 'Please choose a date between {a} and {b}.', each_row: 'Please answer every row.', tap_drag: 'Tap or drag on the line to answer',
      you_chose: 'You chose <b>{n}</b>. Tap another number to change it.', nps_l: 'Not at all likely', nps_r: 'Extremely likely', stars_of: '{n} of {m} stars',
      tap_choose: 'Tap to choose', search: 'Search', no_match: 'No matches', take_photo: 'Take a photo', choose_file: 'Choose a file', uploading: 'Uploading…',
      uploaded: 'Uploaded', upload_failed: 'Upload failed — tap Retry', retry: 'Retry', too_big: 'That file is larger than {n} MB. Please choose a smaller one.',
      bad_type: 'Please choose an image or a PDF.', remove: 'Remove', wait_upload: 'Please wait for the upload to finish.', upload_hint: 'Images or PDF, up to {n} MB',
      next_in: 'Next (in {t})', watch_first: 'Watch the video to continue', no_skip: 'Skipping forward is turned off for this video.', tap_play: 'Tap to play',
      auto_in: 'This screen moves on by itself in {t}.', look_in: 'Next appears in {t}', sound_check: 'Sound check', sound_q: 'Tap Play. Can you hear the tone?',
      play_tone: 'Play tone', can_hear: 'Yes, I can hear it', cannot_hear: 'No, I can’t hear it', sound_tip: 'Turn up the volume and switch off silent mode, then play again. Headphones also work.',
      anyway: 'Continue anyway', enc25: 'Great start — a quarter done!', enc50: 'Halfway there, thank you!', enc75: 'Almost done — just a little more.',
      later_t: 'Finish later', later_txt: 'Use this code to continue on any phone. Your answers are kept until {d}.', later_txt2: 'Use this code to continue on any phone.',
      send_wa: 'Send code to my WhatsApp', cont_now: 'Continue now', copied: 'Copied', wa_msg: 'My code to continue the survey "{t}" is {c}. Continue here: {u}',
      sending: 'Sending your answers…', fail_t: 'Not sent yet', fail: 'Your answers are safe on this phone, but we could not reach the server. Check your internet and tap Try again. If you close this page, they will be sent next time you open the link on this phone.',
      try_again: 'Try again', thanks: 'Thank you!', questions_q: 'Questions about this study?', share: 'Share this survey', comp_code: 'Your completion code',
      your_scores: 'Your scores', closed_t: 'Survey closed', not_open_t: 'Not open yet', opens: 'It opens on {d}.', screened_t: 'Thank you', quota_t: 'Thank you',
      declined_t: 'Thank you', dup_t: 'Already completed', conn_t: 'Can’t connect', conn: 'Please check your internet connection and try again.',
      start_fail: 'Could not start the survey. Check your internet and tap again.', code_nf: 'That code was not found. Please check it and try again.',
      code_done: 'That survey has already been submitted. Thank you!', code_closed: 'The study has closed, so resume codes no longer work.', loading: 'Loading…',
      back: 'Back', bigger: 'Larger text', lang: 'Language', optional: 'Optional', close: 'Close', preview: 'Preview — answers are saved as test', not_pub: 'This survey has not been published yet.',
      not_cfg: 'This page is not connected to a study yet.', item: 'Item', of: '{x} of {y}', agree_q: 'I agree', disagree_q: 'I do not agree', default_thanks: 'Your responses have been recorded.',
      checking_code: 'Checking…', starting: 'Starting…', pick_one: 'Choose one', jump: 'Jump to', cond: 'Condition', restart: 'Restart preview', test_tools: 'Test tools',
      progress: 'Progress', tap_to_go: 'Tap an answer. The next question opens by itself.', tap_again: 'Tap your answer again to move on', start_part: 'Start part {x}',
      quick_break: 'Quick break', pop_txt: 'Pop the bubbles if you like, or just continue.', popped: '{n} of {m} popped', all_popped: 'All popped. Nicely done!',
      breathe_txt: 'Rest your eyes for a moment. Breathe with the circle.', breathe_in: 'Breathe in', breathe_out: 'Breathe out',
      recap: 'About {m} more minutes to go.', recap1: 'About 1 more minute to go.', did_you_know: 'Did you know?'
    },
    ml: {
      start: 'സർവേ ആരംഭിക്കുക', research: 'ഗവേഷണ പഠനം', about_min: 'ഏകദേശം {n} മിനിറ്റ്', about_1min: 'ഏകദേശം 1 മിനിറ്റ്', anonymous: 'പേര് ആവശ്യമില്ല', confidential: 'രഹസ്യമായി സൂക്ഷിക്കും',
      finish_any: 'പിന്നീട് പൂർത്തിയാക്കാം', choose_lang: 'ഭാഷ തിരഞ്ഞെടുക്കുക', have_code: 'തുടരാനുള്ള കോഡ് ഉണ്ടോ?', enter_code: 'നിങ്ങളുടെ 6 അക്ഷര കോഡ് നൽകുക',
      cont: 'തുടരുക', welcome_back: 'വീണ്ടും സ്വാഗതം', welcome_back_txt: 'നിങ്ങളുടെ ഉത്തരങ്ങൾ ഈ ഫോണിൽ സേവ് ചെയ്തിട്ടുണ്ട്. നിർത്തിയിടത്തുനിന്ന് തുടരാം.',
      consent: 'സമ്മതം', before: 'ആരംഭിക്കുന്നതിന് മുമ്പ്', read_summary: 'ഈ ചെറിയ സംഗ്രഹം വായിക്കുക.', purpose: 'ലക്ഷ്യം', time: 'സമയം', your_choice: 'നിങ്ങളുടെ ഇഷ്ടം',
      your_answers: 'നിങ്ങളുടെ ഉത്തരങ്ങൾ', phone_number: 'ഫോൺ നമ്പർ', full_sheet: 'പൂർണ്ണ വിവരപത്രിക വായിക്കുക', agree: 'പങ്കെടുക്കാൻ ഞാൻ സമ്മതിക്കുന്നു',
      disagree: 'ഞാൻ സമ്മതിക്കുന്നില്ല', next: 'അടുത്തത്', submit: 'സമർപ്പിക്കുക', saved_device: 'ഈ ഫോണിൽ സേവ് ചെയ്തു',
      not_sent: 'ഈ ഫോണിൽ സേവ് ചെയ്തു · ഓൺലൈനാകുമ്പോൾ അയയ്ക്കും', finish_later: 'പിന്നീട്', part: 'ഭാഗം {x} / {y}', n_q: '{n} ചോദ്യങ്ങൾ', one_q: '1 ചോദ്യം',
      moves_on: 'തിരഞ്ഞെടുത്താലുടൻ അടുത്തതിലേക്ക് പോകും', choose_one: 'തുടരാൻ ഒരു ഉത്തരം തിരഞ്ഞെടുക്കുക.', please_answer: 'തുടരാൻ ഈ ചോദ്യത്തിന് ഉത്തരം നൽകുക.',
      at_least: 'കുറഞ്ഞത് {n} എണ്ണം തിരഞ്ഞെടുക്കുക.', up_to: 'പരമാവധി {n} എണ്ണം തിരഞ്ഞെടുക്കാം.', describe: 'വ്യക്തമാക്കുക', other_needed: '"{o}" എന്നതിനുള്ള ഉത്തരം ടൈപ്പ് ചെയ്യുക.',
      number_needed: 'ഒരു സംഖ്യ നൽകുക.', between: '{a} മുതൽ {b} വരെയുള്ള ഒരു സംഖ്യ നൽകുക.', email_needed: 'ശരിയായ ഇമെയിൽ വിലാസം നൽകുക.',
      phone_needed: '6, 7, 8 അല്ലെങ്കിൽ 9-ൽ തുടങ്ങുന്ന 10 അക്ക മൊബൈൽ നമ്പർ നൽകുക.', min_words: 'കുറഞ്ഞത് {n} വാക്കുകൾ എഴുതുക.',
      date_range: '{a} മുതൽ {b} വരെയുള്ള ഒരു തീയതി തിരഞ്ഞെടുക്കുക.', each_row: 'എല്ലാ വരികൾക്കും ഉത്തരം നൽകുക.', tap_drag: 'ഉത്തരം നൽകാൻ വരയിൽ തൊടുകയോ നീക്കുകയോ ചെയ്യുക',
      you_chose: 'നിങ്ങൾ <b>{n}</b> തിരഞ്ഞെടുത്തു. മാറ്റാൻ മറ്റൊരു സംഖ്യയിൽ തൊടുക.', nps_l: 'ഒട്ടും സാധ്യതയില്ല', nps_r: 'വളരെയധികം സാധ്യത', stars_of: '{m}-ൽ {n} നക്ഷത്രം',
      tap_choose: 'തിരഞ്ഞെടുക്കാൻ തൊടുക', search: 'തിരയുക', no_match: 'ഒന്നും കണ്ടെത്തിയില്ല', take_photo: 'ഫോട്ടോ എടുക്കുക', choose_file: 'ഫയൽ തിരഞ്ഞെടുക്കുക', uploading: 'അപ്‌ലോഡ് ചെയ്യുന്നു…',
      uploaded: 'അപ്‌ലോഡ് ചെയ്തു', upload_failed: 'അപ്‌ലോഡ് പരാജയപ്പെട്ടു — വീണ്ടും ശ്രമിക്കുക', retry: 'വീണ്ടും', too_big: 'ഈ ഫയൽ {n} MB-യിൽ കൂടുതലാണ്. ചെറിയ ഫയൽ തിരഞ്ഞെടുക്കുക.',
      bad_type: 'ഒരു ചിത്രമോ PDF-ഓ തിരഞ്ഞെടുക്കുക.', remove: 'നീക്കുക', wait_upload: 'അപ്‌ലോഡ് പൂർത്തിയാകുന്നതുവരെ കാത്തിരിക്കുക.', upload_hint: 'ചിത്രം അല്ലെങ്കിൽ PDF, {n} MB വരെ',
      next_in: 'അടുത്തത് ({t})', watch_first: 'തുടരാൻ വീഡിയോ കാണുക', no_skip: 'ഈ വീഡിയോയിൽ മുന്നോട്ട് നീക്കാൻ കഴിയില്ല.', tap_play: 'പ്ലേ ചെയ്യാൻ തൊടുക',
      auto_in: '{t} കഴിഞ്ഞ് ഈ സ്ക്രീൻ തനിയെ മാറും.', look_in: '{t} കഴിഞ്ഞ് അടുത്തത് ബട്ടൺ വരും', sound_check: 'ശബ്ദ പരിശോധന', sound_q: 'പ്ലേ അമർത്തുക. ശബ്ദം കേൾക്കാമോ?',
      play_tone: 'ശബ്ദം പ്ലേ ചെയ്യുക', can_hear: 'അതെ, കേൾക്കാം', cannot_hear: 'ഇല്ല, കേൾക്കുന്നില്ല', sound_tip: 'ശബ്ദം കൂട്ടുക, സൈലന്റ് മോഡ് ഓഫാക്കുക, വീണ്ടും പ്ലേ ചെയ്യുക. ഹെഡ്‌ഫോണും ഉപയോഗിക്കാം.',
      anyway: 'എന്നാലും തുടരുക', enc25: 'നല്ല തുടക്കം — നാലിലൊന്ന് പൂർത്തിയായി!', enc50: 'പകുതി പൂർത്തിയായി, നന്ദി!', enc75: 'ഏകദേശം കഴിഞ്ഞു — കുറച്ചുകൂടി മാത്രം.',
      later_t: 'പിന്നീട് പൂർത്തിയാക്കുക', later_txt: 'ഏത് ഫോണിലും തുടരാൻ ഈ കോഡ് ഉപയോഗിക്കുക. {d} വരെ ഉത്തരങ്ങൾ സൂക്ഷിക്കും.', later_txt2: 'ഏത് ഫോണിലും തുടരാൻ ഈ കോഡ് ഉപയോഗിക്കുക.',
      send_wa: 'കോഡ് എന്റെ വാട്ട്സ്ആപ്പിലേക്ക് അയയ്ക്കുക', cont_now: 'ഇപ്പോൾ തുടരുക', copied: 'പകർത്തി', wa_msg: '"{t}" സർവേ തുടരാനുള്ള എന്റെ കോഡ് {c} ആണ്. ഇവിടെ തുടരാം: {u}',
      sending: 'ഉത്തരങ്ങൾ അയയ്ക്കുന്നു…', fail_t: 'ഇതുവരെ അയച്ചിട്ടില്ല', fail: 'നിങ്ങളുടെ ഉത്തരങ്ങൾ ഈ ഫോണിൽ സുരക്ഷിതമാണ്, പക്ഷേ സെർവറുമായി ബന്ധപ്പെടാനായില്ല. ഇന്റർനെറ്റ് പരിശോധിച്ച് വീണ്ടും ശ്രമിക്കുക. ഈ പേജ് അടച്ചാൽ, അടുത്ത തവണ ഈ ഫോണിൽ ലിങ്ക് തുറക്കുമ്പോൾ അയയ്ക്കും.',
      try_again: 'വീണ്ടും ശ്രമിക്കുക', thanks: 'നന്ദി!', questions_q: 'ഈ പഠനത്തെക്കുറിച്ച് സംശയങ്ങളുണ്ടോ?', share: 'ഈ സർവേ പങ്കിടുക', comp_code: 'നിങ്ങളുടെ പൂർത്തീകരണ കോഡ്',
      your_scores: 'നിങ്ങളുടെ സ്കോറുകൾ', closed_t: 'സർവേ അവസാനിച്ചു', not_open_t: 'ഇതുവരെ തുറന്നിട്ടില്ല', opens: '{d}-ന് തുറക്കും.', screened_t: 'നന്ദി', quota_t: 'നന്ദി',
      declined_t: 'നന്ദി', dup_t: 'ഇതിനകം പൂർത്തിയാക്കി', conn_t: 'കണക്റ്റ് ചെയ്യാനാകുന്നില്ല', conn: 'ഇന്റർനെറ്റ് കണക്ഷൻ പരിശോധിച്ച് വീണ്ടും ശ്രമിക്കുക.',
      start_fail: 'സർവേ ആരംഭിക്കാനായില്ല. ഇന്റർനെറ്റ് പരിശോധിച്ച് വീണ്ടും തൊടുക.', code_nf: 'ഈ കോഡ് കണ്ടെത്തിയില്ല. പരിശോധിച്ച് വീണ്ടും ശ്രമിക്കുക.',
      code_done: 'ഈ സർവേ ഇതിനകം സമർപ്പിച്ചു. നന്ദി!', code_closed: 'പഠനം അവസാനിച്ചതിനാൽ കോഡുകൾ ഇനി പ്രവർത്തിക്കില്ല.', loading: 'ലോഡ് ചെയ്യുന്നു…',
      back: 'പിന്നോട്ട്', bigger: 'വലിയ അക്ഷരം', lang: 'ഭാഷ', optional: 'ഐച്ഛികം', close: 'അടയ്ക്കുക', preview: 'പ്രിവ്യൂ — ഉത്തരങ്ങൾ ടെസ്റ്റായി സേവ് ചെയ്യും', not_pub: 'ഈ സർവേ ഇതുവരെ പ്രസിദ്ധീകരിച്ചിട്ടില്ല.',
      not_cfg: 'ഈ പേജ് ഇതുവരെ ഒരു പഠനവുമായി ബന്ധിപ്പിച്ചിട്ടില്ല.', item: 'ഇനം', of: '{x} / {y}', agree_q: 'ഞാൻ സമ്മതിക്കുന്നു', disagree_q: 'ഞാൻ സമ്മതിക്കുന്നില്ല', default_thanks: 'നിങ്ങളുടെ ഉത്തരങ്ങൾ രേഖപ്പെടുത്തി.',
      checking_code: 'പരിശോധിക്കുന്നു…', starting: 'ആരംഭിക്കുന്നു…', pick_one: 'ഒന്ന് തിരഞ്ഞെടുക്കുക', jump: 'Jump to', cond: 'Condition', restart: 'Restart preview', test_tools: 'Test tools',
      progress: 'പുരോഗതി', tap_to_go: 'ഒരു ഉത്തരം തൊടുക. അടുത്ത ചോദ്യം തനിയെ തുറക്കും.', tap_again: 'മുന്നോട്ട് പോകാൻ ഉത്തരത്തിൽ വീണ്ടും തൊടുക', start_part: 'ഭാഗം {x} ആരംഭിക്കുക',
      quick_break: 'ചെറിയ ഇടവേള', pop_txt: 'വേണമെങ്കിൽ കുമിളകൾ പൊട്ടിക്കാം, അല്ലെങ്കിൽ തുടരാം.', popped: '{m}-ൽ {n} പൊട്ടി', all_popped: 'എല്ലാം പൊട്ടി. കൊള്ളാം!',
      breathe_txt: 'ഒരു നിമിഷം കണ്ണുകൾക്ക് വിശ്രമം നൽകൂ. വൃത്തത്തോടൊപ്പം ശ്വസിക്കൂ.', breathe_in: 'ശ്വാസം എടുക്കൂ', breathe_out: 'ശ്വാസം വിടൂ',
      recap: 'ഇനി ഏകദേശം {m} മിനിറ്റ്.', recap1: 'ഇനി ഏകദേശം 1 മിനിറ്റ്.', did_you_know: 'നിങ്ങൾക്കറിയാമോ?'
    }
  };
  function t(k, vars) {
    var s = (T[lang()] && T[lang()][k]) || T.en[k] || k;
    if (vars) Object.keys(vars).forEach(function (v) { s = s.split('{' + v + '}').join(vars[v]); });
    return s;
  }
  function lang() { return (S && S.lang) || 'en'; }
  function L(obj) { return E.pick(obj, lang()); }
  function set(k) { return Q ? E.str(Q.settings[k]) : ''; }
  function setL(k) { return lang() === 'ml' && set(k + '_ml') ? set(k + '_ml') : set(k + '_en'); }
  function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function qset(q, k) { return lang() === 'ml' && q.set[k + '_ml'] ? q.set[k + '_ml'] : q.set[k]; }
  function pipe(s) { return E.pipe(Q, s, S, lang()); }
  function fmtSec(s, down) { s = Math.max(0, down ? Math.floor(s + 0.25) : Math.ceil(s)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  function fmtDate(d) {
    if (!d) return '';
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d); if (!m) return d;
    var dt = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12));
    try { return dt.toLocaleDateString(lang() === 'ml' ? 'ml-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }); } catch (e) { return d; }
  }

  // ------------------------------------------------------------------ icons
  var IP = {
    chevL: '<path d="m15 18-6-6 6-6"/>', chevR: '<path d="m9 18 6-6-6-6"/>', chevD: '<path d="m6 9 6 6 6-6"/>', check: '<path d="M20 6 9 17l-5-5"/>', arrowR: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
    save: '<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>', user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    db: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14a8 3 0 0 0 16 0V5"/><path d="M4 12a8 3 0 0 0 16 0"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
    bag: '<path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8z"/><path d="M9 10V7a3 3 0 0 1 6 0v3"/>', chart: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
    star: '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
    play: '<path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5z" fill="currentColor" stroke="none"/>',
    pause: '<rect x="6" y="4.5" width="4" height="15" rx="1.2" fill="currentColor" stroke="none"/><rect x="14" y="4.5" width="4" height="15" rx="1.2" fill="currentColor" stroke="none"/>',
    tag: '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r="1.2"/>',
    home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>', money: '<rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4"/><path d="M12 8h.01"/>', lock: '<rect width="16" height="10" x="4" y="11" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    vol: '<path d="M11 4.7a.7.7 0 0 0-1.2-.5L6.4 7.6A1.4 1.4 0 0 1 5.4 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.4a1.4 1.4 0 0 1 1 .4l3.4 3.4a.7.7 0 0 0 1.2-.5z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.4 18.4a9 9 0 0 0 0-12.8"/>',
    volx: '<path d="M11 4.7a.7.7 0 0 0-1.2-.5L6.4 7.6A1.4 1.4 0 0 1 5.4 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.4a1.4 1.4 0 0 1 1 .4l3.4 3.4a.7.7 0 0 0 1.2-.5z"/><path d="m22 9-6 6"/><path d="m16 9 6 6"/>',
    copy: '<rect width="13" height="13" x="9" y="9" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
    mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
    camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
    file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>', x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>', alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    thumb: '<path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/>',
    building: '<rect width="16" height="20" x="4" y="2" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"/>',
    headphones: '<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/>',
    sparkle: '<path d="M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.14-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0l1.58 6.14a2 2 0 0 0 1.44 1.44l6.14 1.58a.5.5 0 0 1 0 .96l-6.14 1.58a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0z"/>',
    image: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>'
  };
  function icon(name, size, extra) {
    size = size || 20;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + (extra || '') + '>' + (IP[name] || IP.info) + '</svg>';
  }
  var FACE5 = ['#B42318', '#C2410C', '#6B7280', '#2E8A57', '#1F7A45'];
  var FACE7 = ['#B42318', '#C2410C', '#B7791F', '#6B7280', '#4D8B3A', '#2E8A57', '#1F7A45'];
  function face(i, n, kind) {
    var col = (n === 7 ? FACE7 : FACE5)[Math.round(i * ((n === 7 ? 7 : 5) - 1) / (n - 1))] || '#6B7280';
    var c = n > 1 ? (i / (n - 1)) * 2 - 1 : 0; // -1 .. 1
    if (kind === 'thumbs') {
      var rot = c < -0.2 ? 180 : (c > 0.2 ? 0 : 90);
      return '<svg class="face" viewBox="0 0 24 24" fill="none" stroke="' + col + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><g transform="rotate(' + rot + ' 12 12)">' + IP.thumb + '</g></svg>';
    }
    if (kind === 'hearts') {
      var op = (0.15 + 0.85 * (i / Math.max(n - 1, 1))).toFixed(2);
      return '<svg class="face" viewBox="0 0 24 24" fill="' + col + '" fill-opacity="' + op + '" stroke="' + col + '" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true">' + IP.heart + '</svg>';
    }
    var y = 15.6, cy = y + 3.4 * c;
    var mouth = Math.abs(c) < 0.05 ? '<path d="M8.5 15.6h7"/>' : '<path d="M8.2 ' + (y - c * 0.6).toFixed(2) + ' Q12 ' + cy.toFixed(2) + ' 15.8 ' + (y - c * 0.6).toFixed(2) + '"/>';
    return '<svg class="face" viewBox="0 0 24 24" fill="none" stroke="' + col + '" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="8.8" cy="9.6" r=".9" fill="' + col + '" stroke="none"/><circle cx="15.2" cy="9.6" r=".9" fill="' + col + '" stroke="none"/>' + mouth + '</svg>';
  }

  // ------------------------------------------------------------------ storage & transport
  function lsGet(k) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { } }
  var persistT = null;
  function persist(now) {
    clearTimeout(persistT);
    var go = function () { if (S) lsSet(KEY, S); };
    if (now) go(); else persistT = setTimeout(go, 200);
  }
  function deviceToken() {
    var d = null; try { d = localStorage.getItem(DEVKEY); } catch (e) { }
    if (!d) { d = 'd' + E.makeCode(15).toLowerCase(); try { localStorage.setItem(DEVKEY, d); } catch (e) { } }
    return d;
  }
  function siteRoot() {
    var here = location.href.split(/[?#]/)[0].replace(/[^/]*$/, '');
    return /\/v\d+\/$/.test(here) ? here.replace(/v\d+\/$/, '') : here;
  }
  function mediaUrl(f) { if (!f) return ''; if (/^(https?:|data:|blob:)/.test(f)) return f; return ROOT + String(f).replace(/^\/+/, ''); }

  function rawCall(payload) {
    if (window.google && google.script && google.script.run) {
      return new Promise(function (res, rej) { google.script.run.withSuccessHandler(function (s) { try { res(JSON.parse(s)); } catch (e) { rej(e); } }).withFailureHandler(rej).gsApi(JSON.stringify(payload)); });
    }
    if (typeof CFG.mockApi === 'function') {
      return new Promise(function (res, rej) {
        setTimeout(function () { try { if (CFG.offline) throw new Error('offline'); res(JSON.parse(JSON.stringify(CFG.mockApi(JSON.parse(JSON.stringify(payload)))))); } catch (e) { rej(e); } }, CFG.mockDelay || 120);
      });
    }
    return fetch(API, { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow', credentials: 'omit' })
      .then(function (r) { return r.text(); })
      .then(function (txt) { var j; try { j = JSON.parse(txt); } catch (e) { throw new Error('busy'); } return j; });
  }
  // Retries with growing waits when the network fails or the server is busy.
  function call(payload, opts) {
    opts = opts || {};
    var tries = opts.retries === undefined ? 4 : opts.retries, n = 0;
    payload.study = STUDY; if (PREVIEW) payload.preview = PREVIEW;
    return new Promise(function (resolve, reject) {
      function attempt() {
        rawCall(payload).then(function (r) {
          if (r && r.ok === false && (r.error === 'busy' || r.retry)) throw new Error('busy');
          resolve(r);
        }).catch(function (e) {
          if (n++ >= tries) return reject(e);
          var wait = Math.min(30000, 1000 * Math.pow(2, n - 1)) * (0.75 + Math.random() * 0.5);
          setTimeout(attempt, wait);
        });
      }
      attempt();
    });
  }

  // ------------------------------------------------------------------ boot
  function boot() {
    if (!document.querySelector('link[data-inter]')) {
      var pc = document.createElement('link'); pc.rel = 'preconnect'; pc.href = 'https://fonts.gstatic.com'; pc.crossOrigin = ''; document.head.appendChild(pc);
      var l = document.createElement('link'); l.rel = 'stylesheet'; l.setAttribute('data-inter', '1');
      l.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap'; document.head.appendChild(l);
    }
    S = lsGet(KEY) || fresh();
    applyPrefs();
    if (!API && typeof CFG.mockApi !== 'function' && !(window.google && google.script)) return renderMessage('info', t('not_cfg'), '');
    renderLoading();
    var cached = lsGet('svy:q:' + KEY);
    call({ action: 'load', version: S.resp_id ? S.q_version : '' }, { retries: 2 }).then(function (r) {
      if (!r || !r.ok) {
        if (r && r.status === 'not_published') return renderMessage('info', t('not_pub'), '');
        throw new Error('load');
      }
      Q = r.q; STATUS = r.status;
      lsSet('svy:q:' + KEY, { q: Q, status: STATUS });
      afterLoad();
    }).catch(function () {
      if (cached && cached.q && S.resp_id) { Q = cached.q; STATUS = 'open'; afterLoad(); return; }
      renderMessage('alert', t('conn_t'), t('conn'), { label: t('try_again'), act: 'reload' });
    });
  }
  function fresh() {
    return { v: 1, lang: null, fs: 1, answers: {}, shown: {}, timings: {}, first: {}, stim: {}, sound: {}, orders: null, stim_order: [], history: [], cur: null,
      phase: 'welcome', lang_switches: 0, src: SRC, ext_id: EXT, enc: {}, done_blocks: {}, contact: {}, last_block: '', uploads: {} };
  }
  function langs() { var l = set('languages') || 'en,ml'; return /ml/.test(l) ? ['en', 'ml'] : ['en']; }
  function afterLoad() {
    if (!S.lang || langs().indexOf(S.lang) < 0) S.lang = URLP.get('lang') === 'ml' && langs().length > 1 ? 'ml' : (set('default_lang') === 'ml' && langs().length > 1 ? 'ml' : 'en');
    if (!S.src && SRC) S.src = SRC;
    applyPrefs();
    if (PREVIEW) document.title = '[Preview] ' + (set('study_title_en') || document.title);
    else if (set('study_title_en')) document.title = setL('study_title');
    if (S.phase === 'end' && S.end) return renderEnd();
    if (!PREVIEW && lsGet('svy:done:' + STUDY) && !S.resp_id && set('duplicate_device') !== 'flag') { S.end = { kind: 'duplicate' }; return renderEnd(); }
    if (S.resp_id) setupFlow();
    if (S.phase === 'sending') return submit();
    if (S.phase === 'debrief') return render();
    if (!S.resp_id && STATUS !== 'open') { S.end = { kind: STATUS === 'not_open' ? 'not_open' : 'closed' }; return renderEnd(); }
    if (S.resp_id && S.phase === 'survey') S.phase = 'welcome';
    render();
    flushPending();
  }
  function applyPrefs() {
    document.documentElement.style.setProperty('--fs', S && S.fs ? S.fs : 1);
    var ml = S && S.lang === 'ml';
    document.body.classList.toggle('lang-ml', ml);
    document.documentElement.lang = ml ? 'ml' : 'en';
    if (ml && !document.querySelector('link[data-ml]')) {
      var l = document.createElement('link'); l.rel = 'stylesheet'; l.setAttribute('data-ml', '1');
      l.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+Malayalam:wght@400;500;600;700&display=swap'; document.head.appendChild(l);
    }
    document.body.classList.toggle('reduce-motion', !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches));
  }

  // ------------------------------------------------------------------ flow helpers
  function phoneMode() { var m = set('collect_phone').toLowerCase(); return m === 'optional' || m === 'required' ? m : 'no'; }
  function engState() { return { answers: S.answers, condition: S.condition, lang: S.lang, src: S.src, orders: S.orders, collect_phone: phoneMode() }; }
  function setupFlow() {
    if (!S.orders) return;
    FLOW = E.buildFlow(Q, S.orders, { collect_phone: phoneMode() });
    DEBRIEF = E.buildFlow(Q, S.orders, { includeDebrief: true, collect_phone: phoneMode() }).filter(function (s) { return s.debrief; });
  }
  function qById(id) { var m = Q._qi || (Q._qi = E.qIndex(Q)); return m[id]; }
  function blockById(id) { var m = Q._bi || (Q._bi = E.blockIndex(Q)); return m[id]; }
  function visible(sc) { return E.screenVisible(Q, sc, engState()); }
  function screenById(id) { var all = FLOW.concat(DEBRIEF); for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i]; return null; }
  function curScreen() { return screenById(S.cur); }
  function visibleFlow() { return FLOW.filter(visible); }
  function mainBlocks() {
    var seen = {}, out = [];
    visibleFlow().forEach(function (s) { if (!seen[s.block]) { seen[s.block] = 1; out.push(s.block); } });
    return out;
  }
  function progress(sc) {
    var vf = visibleFlow().filter(function (s) { return s.kind !== 'intro'; });
    if (!sc) return 0;
    var i = -1;
    for (var k = 0; k < vf.length; k++) if (vf[k].id === sc.id) { i = k; break; }
    if (i < 0 && sc.kind === 'intro') { for (var j = 0; j < vf.length; j++) if (FLOW.indexOf(vf[j]) > FLOW.indexOf(sc)) { i = j; break; } }
    if (i < 0) i = vf.length;
    return vf.length ? Math.round((i / vf.length) * 100) : 0;
  }
  function answerFor(sc) { var q = qById(sc.q); var a = S.answers[q.id]; return sc.row !== undefined ? (a || {})[sc.row] : a; }

  // ------------------------------------------------------------------ render core
  function render(anim) {
    clearTimers();
    if (!S) return;
    if (S.phase === 'welcome') return renderWelcome();
    if (S.phase === 'consent') return renderConsent();
    if (S.phase === 'end') return renderEnd();
    if (S.phase === 'sending') return renderSending();
    if (S.brk && S.phase === 'survey') return renderBreak(anim);
    var sc = curScreen();
    if (!sc) { var vf = visibleFlow(); if (!vf.length) return finish('complete'); S.cur = vf[0].id; sc = vf[0]; }
    if (sc.kind === 'intro') return renderIntro(sc, anim);
    if (sc.kind === 'soundcheck') return renderSoundCheck(sc, anim);
    return renderQuestion(sc, anim);
  }
  function paint(html, anim, after) {
    var main = root.querySelector('.content');
    var doit = function () {
      root.innerHTML = html + (V.overlay || '') + devTools();
      var c = root.querySelector('.content');
      if (c && anim !== false) { c.classList.add('screen-in'); if (V.dir) c.classList.add(V.dir); }
      if (anim === true) { var bar = root.querySelector('.bar'); if (bar) bar.classList.add('bump'); }
      if (anim !== false) { var mn = root.querySelector('.main'); if (mn) mn.scrollTop = 0; window.scrollTo(0, 0); }
      afterPaint();
      if (after) after();
    };
    if (main && anim === true && !document.body.classList.contains('reduce-motion')) { main.classList.add('screen-out'); if (V.dir) main.classList.add(V.dir); setTimeout(doit, 110); }
    else doit();
  }
  function refresh() { // same screen, keep scroll
    var mn0 = root.querySelector('.main'), y = mn0 ? mn0.scrollTop : 0, foc = document.activeElement && document.activeElement.getAttribute('data-key');
    render(false);
    var c = root.querySelector('.content'); if (c) c.classList.remove('screen-in');
    var mn1 = root.querySelector('.main'); if (mn1) mn1.scrollTop = y;
    if (foc) { var el = root.querySelector('[data-key="' + foc + '"]'); if (el) try { el.focus({ preventScroll: true }); } catch (e) { } }
  }
  function frame(top, body, bottom) {
    return '<div class="frame">' + (PREVIEW ? '<div class="preview-flag">' + esc(t('preview')) + '</div>' : '') + top + '<main class="main"><div class="content" data-screen="' + esc(S && (S.phase === 'survey' || S.phase === 'debrief') ? (S.brk && S.phase === 'survey' ? 'break:' + S.brk.th : S.cur) : (S ? S.phase : '')) + '">' + body + '</div></main>' + (bottom || '') + '</div>';
  }
  function langSeg() {
    if (langs().length < 2) return '';
    return '<div class="seg" role="group" aria-label="' + esc(t('lang')) + '"><button data-act="lang" data-v="en" aria-pressed="' + (lang() === 'en') + '">EN</button><button class="ml" data-act="lang" data-v="ml" aria-pressed="' + (lang() === 'ml') + '" lang="ml">മല</button></div>';
  }
  function topbar(opts) {
    opts = opts || {};
    var h = '<header class="topbar"><div class="topbar-row">' +
      '<button class="backpill" data-act="back"' + (opts.noBack ? ' hidden' : '') + '>' + icon('chevL', 22, ' stroke-width="2.4"') + '<span>' + esc(t('back')) + '</span></button>' +
      (opts.title ? '<div class="topbar-title">' + esc(opts.title) + '</div>' : '<div class="spacer"></div>') +
      (opts.fwd ? '<button class="fwdpill" data-act="next" aria-label="' + esc(t('next')) + '"><span>' + esc(t('next')) + '</span>' + icon('chevR', 22, ' stroke-width="2.4"') + '</button>' : '') +
      langSeg() + '<button class="aplus" data-act="aplus" aria-pressed="' + (S.fs > 1) + '" aria-label="' + esc(t('bigger')) + '">A+</button></div>';
    if (opts.progress !== undefined) {
      h += '<div class="progress"><div class="bar" role="progressbar" aria-label="' + esc(t('progress')) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + opts.progress + '"><i style="width:' + opts.progress + '%"></i></div></div>';
    }
    return h + '</header>';
  }
  function bottombar(o) {
    o = o || {};
    var h = '<footer class="bottombar">';
    if (o.pre) h += o.pre;
    if (o.save) {
      var pend = S.pending && S.pending.length;
      h += '<div class="savestate' + (pend ? ' warn' : '') + '">' + icon('check', 16) + '<span>' + esc(pend ? t('not_sent') : t('saved_device')) + '</span>' +
        (o.later && S.resume_code && set('allow_resume') !== 'no' ? '<button class="later" data-act="later">' + esc(t('finish_later')) + '</button>' : '') + '</div>';
    }
    if (o.hint) h += '<div class="autohint">' + icon('zap', 16) + '<span>' + esc(o.hint) + '</span></div>';
    (o.buttons || []).forEach(function (b) {
      h += '<button class="btn' + (b.outline ? ' outline' : '') + '" data-act="' + b.act + '"' + (b.disabled ? ' aria-disabled="true"' : '') + (b.id ? ' id="' + b.id + '"' : '') + '>' + b.html + '</button>';
    });
    return h + '</footer>';
  }
  function errHtml() { return V.err ? '<div class="err" role="alert">' + icon('alert', 18) + '<span>' + esc(V.err) + '</span></div>' : ''; }
  function renderLoading() { root.innerHTML = '<div class="frame"><div class="loading"><div><span class="spin"></span><p>' + esc(t('loading')) + '</p></div></div></div>'; }
  function renderMessage(ic, title, text, btn) {
    root.innerHTML = frame('', '<div class="end"><div class="donecircle neutral"><div>' + icon(ic, 44) + '</div></div><h1>' + esc(title) + '</h1><p>' + esc(text) + '</p></div>',
      btn ? bottombar({ buttons: [{ act: btn.act, html: esc(btn.label) }] }) : '');
  }

  // ------------------------------------------------------------------ welcome
  function estMinutes() { var m = Number(set('estimated_minutes')) || Math.round(E.estimateSeconds(Q) / 60); return Math.max(1, m); }
  function renderWelcome() {
    var inProgress = !!S.resp_id && S.cur;
    var logo = set('logo_url');
    var inst = setL('institution');
    var hero = '<div class="hero">' +
      (logo || inst ? '<div class="logochip">' + (logo ? '<img src="' + esc(mediaUrl(logo)) + '" alt="">' : icon('building', 20)) + (inst ? '<span>' + esc(inst) + '</span>' : '') + '</div>' : '') +
      '<p class="kicker">' + esc(t('research')) + '</p><h1>' + esc(setL('study_title') || 'Survey') + '</h1></div>';
    var body = '';
    if (inProgress) {
      body += '<div class="welcomeback"><h2>' + esc(t('welcome_back')) + '</h2><p class="muted" style="margin:0">' + esc(t('welcome_back_txt')) + '</p></div>';
    }
    var desc = setL('description');
    if (desc) body += '<p class="lead">' + esc(desc) + '</p>';
    var m = estMinutes();
    body += '<div class="chips"><span class="chip2">' + icon('clock', 18) + esc(m === 1 ? t('about_1min') : t('about_min', { n: m })) + '</span>' +
      '<span class="chip2">' + icon('shield', 18) + esc(phoneMode() === 'no' ? t('anonymous') : t('confidential')) + '</span>' +
      (set('allow_resume') !== 'no' ? '<span class="chip2">' + icon('save', 18) + esc(t('finish_any')) + '</span>' : '') + '</div>';
    if (langs().length > 1) {
      body += '<p class="label">' + esc(t('choose_lang')) + '</p><div class="langpick" role="radiogroup">' +
        '<button class="opt" role="radio" data-act="lang" data-v="en" aria-checked="' + (lang() === 'en') + '"><span>English</span>' + (lang() === 'en' ? icon('check', 22) : '') + '</button>' +
        '<button class="opt" role="radio" data-act="lang" data-v="ml" aria-checked="' + (lang() === 'ml') + '" lang="ml"><span class="ml">മലയാളം</span>' + (lang() === 'ml' ? icon('check', 22) : '') + '</button></div>';
    }
    if (!inProgress && set('allow_resume') !== 'no') {
      body += V.resumeOpen ? '<div class="resumebox"><label class="label" for="rc">' + esc(t('enter_code')) + '</label><div class="rowf"><input id="rc" class="field" data-key="rc" inputmode="text" autocomplete="off" autocapitalize="characters" maxlength="7" placeholder="ABC-123" value="' + esc(V.rc || '') + '"><button class="btn" data-act="resume-go" style="min-width:110px">' + esc(V.busy ? t('checking_code') : t('cont')) + '</button></div>' + errHtml() + '</div>'
        : '<button class="linkbtn" data-act="resume-open">' + esc(t('have_code')) + '</button>';
    }
    var btn = inProgress ? { act: 'continue', html: esc(t('cont')) + ' ' + icon('arrowR', 20) } : { act: 'to-consent', html: esc(t('start')) + ' ' + icon('arrowR', 20) };
    root.innerHTML = '<div class="frame">' + (PREVIEW ? '<div class="preview-flag">' + esc(t('preview')) + '</div>' : '') + hero + '<main class="main"><div class="content screen-in">' + body + '</div></main>' + bottombar({ buttons: [btn] }) + '</div>' + (V.overlay || '') + devTools();
    afterPaint();
  }

  // ------------------------------------------------------------------ consent
  function renderConsent() {
    var items = [['target', t('purpose'), setL('consent_purpose')], ['clock', t('time'), setL('consent_time')], ['user', t('your_choice'), setL('consent_voluntary')], ['db', t('your_answers'), setL('consent_data')]];
    if (phoneMode() !== 'no' && setL('consent_phone')) items.push(['phone', t('phone_number'), setL('consent_phone')]);
    var body = '<h1 class="big">' + esc(t('before')) + '</h1><p class="muted" style="margin:0 0 8px">' + esc(t('read_summary')) + '</p><ul class="clist">' +
      items.filter(function (i) { return i[2]; }).map(function (i) { return '<li><span class="ico">' + icon(i[0], 22) + '</span><div><b>' + esc(i[1]) + '</b><p>' + esc(i[2]) + '</p></div></li>'; }).join('') + '</ul>' +
      (setL('consent_full') ? '<button class="linkbtn" data-act="fullsheet">' + esc(t('full_sheet')) + '</button>' : '');
    paint(frame(topbar({ title: t('consent') }), body, bottombar({ pre: errHtml(), buttons: [
      { act: 'agree', html: V.busy ? '<span class="spin"></span> ' + esc(t('starting')) : esc(t('agree')), id: 'agree' },
      { act: 'disagree', html: esc(t('disagree')), outline: true }] })), S._anim);
  }

  // ------------------------------------------------------------------ section intro
  var BLOCK_ICON = { bag: 'bag', chart: 'chart', user: 'user', star: 'star', play: 'play', shield: 'shield', tag: 'tag', home: 'home', chat: 'chat', money: 'money', info: 'info' };
  function renderIntro(sc, anim) {
    var b = blockById(sc.block), blocks = mainBlocks(), x = blocks.indexOf(sc.block) + 1, y = blocks.length;
    var screens = visibleFlow().filter(function (s) { return s.block === sc.block && s.kind === 'q'; });
    var nq = screens.filter(function (s) { var q = qById(s.q); return q.type !== 'info' && q.type !== 'stimulus'; }).length;
    var qs = {}; screens.forEach(function (s) { qs[s.q] = qById(s.q); });
    var secs = E.estimateSeconds({ questions: Object.keys(qs).map(function (k) { return qs[k]; }), blocks: [], media: Q.media }) - 30;
    var mins = Math.max(1, Math.round(secs / 60));
    var pct = progress(sc);
    var segs = '<div class="segs">' + blocks.map(function (bid, i) { return '<i class="' + (i < x - 1 ? 'done' : (i === x - 1 ? 'now' : '')) + '"></i>'; }).join('') + '</div>';
    var body = segs + '<div class="bigico">' + icon(BLOCK_ICON[b.icon] || 'chat', 34, ' stroke-width="1.8"') + '</div>' +
      '<p class="eyebrow">' + esc(t('part', { x: x, y: y })) + '</p><h1 class="big">' + esc(L(b.title)) + '</h1>' +
      (L(b.intro) ? '<p class="lead" style="margin-bottom:0">' + esc(pipe(L(b.intro))) + '</p>' : '') +
      '<div class="meta">' + (nq ? '<span>' + icon('chat', 18) + esc(nq === 1 ? t('one_q') : t('n_q', { n: nq })) + '</span>' : '') +
      '<span>' + icon('clock', 18) + esc(mins === 1 ? t('about_1min') : t('about_min', { n: mins })) + '</span></div>' +
      '<button class="btn intro-go" data-act="next">' + esc(t('start_part', { x: x })) + ' ' + icon('arrowR', 20) + '</button>';
    paint(frame(topbar({ progress: pct, label: t('part', { x: x, y: y }), noBack: !S.history.length }), body, bottombar({ save: true, later: true })), anim);
  }

  // ------------------------------------------------------------------ questions
  function isLast(sc) {
    var i = FLOW.indexOf(sc);
    for (var j = i + 1; j < FLOW.length; j++) if (visible(FLOW[j])) return false;
    return true;
  }
  function nextLabel(sc) { return isLast(sc) && !sc.debrief ? t('submit') : t('next'); }
  function renderQuestion(sc, anim) {
    var q = qById(sc.q), b = blockById(sc.block);
    if (!sc.debrief) { S.shown[q.id] = 1; }
    var pct = sc.debrief ? 100 : progress(sc);
    var w = widget(q, sc), answered = isComplete(q, sc), auto = autoMode(q, sc);
    var body = '<div class="qzone">';
    if (V.enc) body += '<div class="encourage">' + icon('sparkle', 18) + esc(V.enc) + '</div>';
    if (q.media && q.type !== 'stimulus') body += mediaBlock(q.media);
    var wbody = auto ? w.body.replace('class="opts', 'class="opts auto') : w.body;
    body += w.head + '</div><div class="tray">' + wbody + '<div id="errbox">' + errHtml() + '</div></div>';
    var btn = { act: 'next', html: esc(nextLabel(sc)), disabled: !answered && needsAnswer(q, sc) };
    if (w.lock) btn = { act: 'next', html: w.lock, disabled: true, id: 'nextbtn' };
    if (w.hideNext || auto) btn = null;
    var top = topbar({ progress: pct, label: b ? L(b.title) : '', noBack: !S.history.length || sc.debrief, fwd: auto && answered });
    paint(frame(top, body, bottombar({ save: !sc.debrief, later: !sc.debrief, buttons: btn ? [btn] : [], hint: auto ? (answered ? t('tap_again') : t('tap_to_go')) : '' })), anim, w.after);
  }
  // Screens that move on by themselves show no Next button (it confused people); a small Next pill appears in the top bar once answered.
  function autoMode(q, sc) {
    if (!E.AUTO_ADVANCE[q.type] || set('auto_advance') === 'no') return false;
    if (q.other !== undefined && E.eq(answerFor(sc), q.other)) return false;
    return true;
  }
  function needsAnswer(q, sc) {
    if (q.type === 'info' || q.type === 'stimulus') return false;
    if (q.type === 'phone') return phoneMode() === 'required' || q.required;
    return q.required;
  }
  function isComplete(q, sc) {
    if (q.type === 'phone') return !!(S.contact && E.validPhone(S.contact.phone));
    var a = answerFor(sc);
    if (q.type === 'semantic_diff') return E.isAnswered(q, a);
    return !E.blankish(a);
  }
  function qHead(q, eyebrow) {
    var lab = eyebrow || qset(q, 'label');
    return '<div class="qhead">' + (lab ? '<p class="eyebrow">' + esc(pipe(lab)) + '</p>' : '') +
      '<h1 class="qtext" id="qt">' + esc(pipe(L(q.text))) + '</h1>' + (L(q.help) ? '<p class="help">' + esc(pipe(L(q.help))) + '</p>' : '') + '</div>';
  }
  function optLabel(o) { return L(o.label); }
  function orderedOptions(q) {
    var ord = S.orders && S.orders.options && S.orders.options[q.id];
    if (!ord) return q.options;
    var by = {}; q.options.forEach(function (o) { by[o.code] = o; });
    return ord.map(function (c) { return by[c]; }).filter(Boolean);
  }
  function mediaBlock(id) {
    var m = Q.media[id]; if (!m) return '';
    if (m.type === 'image') return '<figure class="media"><img src="' + esc(mediaUrl(m.file)) + '" alt="' + esc(L(m.caption)) + '">' + (L(m.caption) ? '<figcaption class="cap">' + esc(L(m.caption)) + '</figcaption>' : '') + '</figure>';
    return '';
  }
  function widget(q, sc) {
    var a = answerFor(sc), auto = E.AUTO_ADVANCE[q.type] && set('auto_advance') !== 'no';
    switch (q.type) {
      case 'single': return wSingle(q, a, auto);
      case 'checkbox': return wCheckbox(q, a);
      case 'dropdown': return wDropdown(q, a);
      case 'short_text': return wShort(q, a);
      case 'paragraph': return wParagraph(q, a);
      case 'linear_scale': return wLinear(q, a, auto);
      case 'likert_emoji': return wLikert(q, a, auto);
      case 'star_rating': return wStars(q, a, auto);
      case 'nps': return wNps(q, a, auto);
      case 'slider': return wSlider(q, a);
      case 'semantic_diff': return wSemDiff(q, a);
      case 'mc_grid': return wGridRow(q, sc, auto, false);
      case 'checkbox_grid': return wGridRow(q, sc, false, true);
      case 'date': case 'time': return wDate(q, a);
      case 'file_upload': return wUpload(q, a);
      case 'info': return { head: qHead(q), body: '' };
      case 'consent': return wConsentQ(q, a, auto);
      case 'phone': return wPhone(q);
      case 'stimulus': return wStimulus(q, sc);
    }
    return { head: qHead(q), body: '<p class="muted">Unknown question type: ' + esc(q.type) + '</p>' };
  }
  function autoHint() { return ''; }
  // Long lists of short labels go in two columns (read top to bottom, then the second column) to avoid scrolling.
  function colsClass(opts) {
    if (opts.length < 7 || opts.some(function (o) { return o.image; })) return '';
    return opts.every(function (o) { return optLabel(o).length <= 22; }) ? ' cols' : '';
  }
  function otherBox(q, show) {
    if (q.other === undefined || !show) return '';
    return '<div class="other-box"><input class="field" data-in="other" data-q="' + esc(q.id) + '" data-key="other_' + esc(q.id) + '" maxlength="200" placeholder="' + esc(t('describe')) + '" value="' + esc(S.answers[q.id + '_other'] || '') + '"></div>';
  }
  function wSingle(q, a, auto) {
    var opts = orderedOptions(q), imgs = opts.some(function (o) { return o.image; });
    var cols = imgs && q.set.columns === '2';
    var h = '<div class="opts' + (cols ? ' cols2' : colsClass(opts)) + '" role="radiogroup" aria-labelledby="qt">' + opts.map(function (o) {
      var on = E.eq(a, o.code);
      if (o.image) return '<button class="opt imgopt" role="radio" aria-checked="' + on + '" data-act="pick" data-q="' + esc(q.id) + '" data-v="' + esc(o.code) + '"><img src="' + esc(mediaUrl(o.image)) + '" alt=""><span class="row"><span class="radio"></span><span class="lab">' + esc(optLabel(o)) + '</span></span></button>';
      return '<button class="opt" role="radio" aria-checked="' + on + '" data-act="pick" data-q="' + esc(q.id) + '" data-v="' + esc(o.code) + '"><span class="radio"></span><span class="lab">' + esc(optLabel(o)) + '</span></button>';
    }).join('') + '</div>' + otherBox(q, q.other !== undefined && E.eq(a, q.other));
    return { head: qHead(q), body: h, hint: autoHint(auto && !(q.other !== undefined && E.eq(a, q.other))) };
  }
  function wCheckbox(q, a) {
    a = a || [];
    var opts = orderedOptions(q);
    var h = '<div class="opts' + colsClass(opts) + '" role="group" aria-labelledby="qt">' + opts.map(function (o) {
      var on = a.some(function (x) { return E.eq(x, o.code); });
      return '<button class="opt" role="checkbox" aria-checked="' + on + '" data-act="toggle" data-q="' + esc(q.id) + '" data-v="' + esc(o.code) + '"><span class="cbox">' + (on ? icon('check', 15, ' stroke-width="3"') : '') + '</span><span class="lab">' + esc(optLabel(o)) + '</span></button>';
    }).join('') + '</div>' + otherBox(q, q.other !== undefined && a.some(function (x) { return E.eq(x, q.other); }));
    return { head: qHead(q), body: h };
  }
  function wDropdown(q, a) {
    var o = q.options.filter(function (x) { return E.eq(x.code, a); })[0];
    var h = '<button class="select-btn' + (o ? ' filled' : '') + '" data-act="dd-open" data-q="' + esc(q.id) + '"><span class="lab' + (o ? '' : ' ph') + '">' + esc(o ? optLabel(o) : (qset(q, 'placeholder') || t('tap_choose'))) + '</span>' + icon('chevD', 20) + '</button>' +
      otherBox(q, q.other !== undefined && E.eq(a, q.other));
    return { head: qHead(q), body: h };
  }
  function wShort(q, a) {
    var f = q.set.format, type = f === 'email' ? 'email' : (f === 'phone' ? 'tel' : 'text');
    var im = f === 'number' ? 'decimal' : (f === 'phone' ? 'tel' : (f === 'email' ? 'email' : 'text'));
    var h = '<input class="field" data-in="text" data-q="' + esc(q.id) + '" data-key="t_' + esc(q.id) + '" type="' + type + '" inputmode="' + im + '"' +
      (q.set.maxlength ? ' maxlength="' + esc(q.set.maxlength) + '"' : '') + ' placeholder="' + esc(qset(q, 'placeholder') || '') + '" value="' + esc(a === undefined ? '' : a) + '" autocomplete="off" enterkeyhint="next">';
    return { head: qHead(q), body: h };
  }
  function wParagraph(q, a) {
    var max = Number(q.set.maxlength || 0);
    var h = '<textarea class="field" data-in="text" data-q="' + esc(q.id) + '" data-key="t_' + esc(q.id) + '"' + (max ? ' maxlength="' + max + '"' : '') + ' placeholder="' + esc(qset(q, 'placeholder') || '') + '">' + esc(a || '') + '</textarea>' +
      (max ? '<div class="counter" id="cnt_' + esc(q.id) + '">' + String(a || '').length + '/' + max + '</div>' : '');
    return { head: qHead(q), body: h, after: function () { autosize(root.querySelector('textarea')); } };
  }
  function autosize(el) { if (!el) return; el.style.height = 'auto'; el.style.height = Math.max(132, el.scrollHeight + 4) + 'px'; }
  function wLinear(q, a, auto) {
    var n = q.options.length, cols = n <= 7 ? n : Math.ceil(n / 2);
    var h = '<div class="linear" role="radiogroup" aria-labelledby="qt" style="grid-template-columns:repeat(' + cols + ',1fr)">' + q.options.map(function (o) {
      return '<button class="scalebtn" role="radio" aria-checked="' + E.eq(a, o.code) + '" data-act="pick" data-q="' + esc(q.id) + '" data-v="' + esc(o.code) + '">' + esc(optLabel(o)) + '</button>';
    }).join('') + '</div><div class="ends"><span>' + esc(qset(q, 'left') || '') + '</span><span>' + esc(qset(q, 'right') || '') + '</span></div>';
    return { head: qHead(q), body: h, hint: autoHint(auto) };
  }
  // Ordinal lists (Likert). Write the list from the lowest to the highest answer (Strongly disagree first).
  //  - five points: one row, lowest at the left, highest at the right
  //  - any other length: a vertical list with the highest answer on top
  //  - "Don't know" / "Prefer not to say" (98, 99) always come last, below the scale
  //  - Questions sheet setting  layout=list  shows the list exactly as written; shuffled lists are never reordered
  function isSpecialOpt(o) { return o.code === 98 || o.code === 99; }
  function scaleParts(q) {
    var all = orderedOptions(q), shuffled = !!(S.orders && S.orders.options && S.orders.options[q.id]);
    var main = all.filter(function (o) { return !isSpecialOpt(o); }), extra = all.filter(isSpecialOpt);
    var listed = shuffled || String(q.set.layout || '').toLowerCase() === 'list';
    return { main: main, extra: extra, row: !listed && main.length === 5, top: !listed };
  }
  function wLikert(q, a, auto) {
    var P = scaleParts(q), n = P.main.length, kind = q.set.icons || 'faces', ml = lang() === 'ml';
    var attrs = function (o) { return ' role="radio" aria-checked="' + E.eq(a, o.code) + '" data-act="pick" data-q="' + esc(q.id) + '" data-v="' + esc(o.code) + '"'; };
    var lead = function (o) { return ml ? '<span class="num">' + esc(o.code) + '</span>' : face(P.main.indexOf(o), n, kind); };
    var listBtn = function (o) { return '<button class="opt"' + attrs(o) + '>' + lead(o) + '<span class="lab">' + esc(optLabel(o)) + '</span></button>'; };
    var extraBtn = function (o) { return '<button class="opt"' + attrs(o) + '><span class="radio"></span><span class="lab">' + esc(optLabel(o)) + '</span></button>'; };
    var h = '<div class="lik" role="radiogroup" aria-labelledby="qt">';
    if (P.row) {
      h += '<div class="lrow">' + P.main.map(function (o) { return '<button class="lbtn"' + attrs(o) + '>' + lead(o) + '<span class="llab">' + esc(optLabel(o)) + '</span></button>'; }).join('') + '</div>';
      if (P.extra.length) h += '<div class="opts lextra">' + P.extra.map(extraBtn).join('') + '</div>';
    } else {
      h += '<div class="opts">' + (P.top ? P.main.slice().reverse() : P.main).map(listBtn).join('') + P.extra.map(extraBtn).join('') + '</div>';
    }
    return { head: qHead(q), body: h + '</div>', hint: autoHint(auto) };
  }
  function wStars(q, a, auto) {
    var n = q.points || 5, v = Number(a) || 0;
    var h = '<div class="stars" role="radiogroup" aria-labelledby="qt">';
    for (var i = 1; i <= n; i++) h += '<button class="star' + (i <= v ? ' on' : '') + '" role="radio" aria-checked="' + (i === v) + '" aria-label="' + esc(t('stars_of', { n: i, m: n })) + '" data-act="pick" data-q="' + esc(q.id) + '" data-v="' + i + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round">' + IP.star + '</svg></button>';
    h += '</div><div class="starlab">' + (v ? esc(t('stars_of', { n: v, m: n })) : '') + '</div>';
    return { head: qHead(q), body: h, hint: autoHint(auto) };
  }
  var NPSC = ['#B42318', '#B93A18', '#BF5218', '#C66A18', '#C98A1C', '#B79A22', '#8E9A2A', '#6C9632', '#4D8B3A', '#2E8A57', '#1F7A45'];
  function wNps(q, a, auto) {
    var h = '<div class="nps" role="radiogroup" aria-labelledby="qt">' + q.options.map(function (o) {
      return '<button class="scalebtn" style="--c:' + NPSC[o.code] + '" role="radio" aria-checked="' + E.eq(a, o.code) + '" data-act="pick" data-q="' + esc(q.id) + '" data-v="' + o.code + '">' + o.code + '</button>';
    }).join('') + '</div><div class="ends"><span>' + esc(qset(q, 'left') || t('nps_l')) + '</span><span>' + esc(qset(q, 'right') || t('nps_r')) + '</span></div>' +
      (E.blankish(a) ? '' : '<div class="chosen">' + t('you_chose', { n: esc(a) }) + '</div>');
    return { head: qHead(q), body: h, hint: '' };
  }
  function wSlider(q, a) {
    var min = Number(q.set.min || 0), max = Number(q.set.max || 100), touched = !E.blankish(a);
    var v = touched ? Number(a) : min, pct = ((v - min) / (max - min)) * 100;
    var showVal = q.set.show_value !== 'no';
    var h = '<div class="slider' + (touched ? '' : ' untouched') + '" role="slider" tabindex="0" data-q="' + esc(q.id) + '" data-key="sl_' + esc(q.id) + '" aria-labelledby="qt" aria-valuemin="' + min + '" aria-valuemax="' + max + '" aria-valuenow="' + (touched ? v : '') + '">' +
      '<div class="track"><div class="fill" style="width:' + pct + '%"></div><div class="thumb" style="left:' + pct + '%">' + (showVal ? '<div class="bubble">' + (touched ? esc(v) : '') + '</div>' : '') + '</div></div></div>' +
      '<div class="ends"><span>' + esc(qset(q, 'left') || min) + '</span><span>' + esc(qset(q, 'right') || max) + '</span></div>' +
      (touched ? '' : '<div class="slider-hint">' + esc(t('tap_drag')) + '</div>');
    return { head: qHead(q), body: h, after: function () { bindSlider(q); } };
  }
  function wSemDiff(q, a) {
    a = a || {};
    var h = q.pairs.map(function (p) {
      var row = '';
      for (var k = 1; k <= q.points; k++) row += '<button class="sd-dot" role="radio" aria-checked="' + E.eq(a[p.code], k) + '" aria-label="' + k + '" data-act="sd" data-q="' + esc(q.id) + '" data-r="' + esc(p.code) + '" data-v="' + k + '">' + k + '</button>';
      return '<div class="sd-pair" role="radiogroup" aria-label="' + esc(L(p.left) + ' – ' + L(p.right)) + '"><div class="sd-ends"><span>' + esc(L(p.left)) + '</span><span>' + esc(L(p.right)) + '</span></div><div class="sd-row">' + row + '</div></div>';
    }).join('');
    return { head: qHead(q), body: h };
  }
  function wGridRow(q, sc, auto, multi) {
    var rows = q.rows, i = sc.rowIndex, row = rows[i], all = S.answers[q.id] || {}, a = all[row.code];
    var prev = '';
    if (i > 0) {
      var pr = rows[i - 1], pa = all[pr.code];
      if (!E.blankish(pa)) {
        var lab = multi ? (pa || []).map(function (c) { var o = q.options.filter(function (x) { return E.eq(x.code, c); })[0]; return o ? optLabel(o) : c; }).join(', ') : ((q.options.filter(function (x) { return E.eq(x.code, pa); })[0] || {}).label);
        prev = '<span class="prev">' + icon('check', 16) + esc(L(pr.label) + ': ' + (typeof lab === 'object' ? L(lab) : lab)) + '</span>';
      }
    }
    var head = '<div class="qhead" style="margin-bottom:14px"><p class="eyebrow">' + esc(pipe(L(q.text))) + '</p>' +
      (prev ? '<div class="rowhead">' + prev + '</div>' : '') +
      '<div class="minisegs">' + rows.map(function (r, k) { return '<i class="' + (k < i ? 'done' : (k === i ? 'now' : '')) + '"></i>'; }).join('') + '</div>' +
      '<h1 class="rowtitle" id="qt">' + esc(L(row.label)) + '</h1>' + (L(q.help) && i === 0 ? '<p class="help" style="margin-top:-12px;margin-bottom:16px">' + esc(L(q.help)) + '</p>' : '') + '</div>';
    var P = multi ? null : scaleParts(q);
    var gattrs = function (o, on) { return ' role="' + (multi ? 'checkbox' : 'radio') + '" aria-checked="' + on + '" data-act="' + (multi ? 'gtoggle' : 'gpick') + '" data-q="' + esc(q.id) + '" data-r="' + esc(row.code) + '" data-v="' + esc(o.code) + '"'; };
    var isOn = function (o) { return multi ? (a || []).some(function (x) { return E.eq(x, o.code); }) : E.eq(a, o.code); };
    var gbtn = function (o) {
      var on = isOn(o), lead = multi ? '<span class="cbox">' + (on ? icon('check', 15, ' stroke-width="3"') : '') + '</span>' : '<span class="num">' + esc(o.code) + '</span>';
      return '<button class="opt"' + gattrs(o, on) + '>' + lead + '<span class="lab">' + esc(optLabel(o)) + '</span></button>';
    };
    var body;
    if (!multi && P.row) {
      body = '<div class="lik" role="radiogroup" aria-labelledby="qt"><div class="lrow">' + P.main.map(function (o) { return '<button class="lbtn"' + gattrs(o, isOn(o)) + '><span class="num">' + esc(o.code) + '</span><span class="llab">' + esc(optLabel(o)) + '</span></button>'; }).join('') + '</div>' +
        (P.extra.length ? '<div class="opts lextra">' + P.extra.map(gbtn).join('') + '</div>' : '') + '</div>';
    } else {
      var list = multi ? q.options : (P.top ? P.main.slice().reverse() : P.main).concat(P.extra);
      body = '<div class="opts" role="' + (multi ? 'group' : 'radiogroup') + '" aria-labelledby="qt">' + list.map(gbtn).join('') + '</div>';
    }
    return { head: head, body: body, hint: autoHint(auto) };
  }
  function today() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function dlim(v) { return v === 'today' ? today() : (v || ''); }
  function wDate(q, a) {
    var h = '<input class="field" type="' + q.type + '" data-in="text" data-q="' + esc(q.id) + '" data-key="t_' + esc(q.id) + '"' +
      (q.type === 'date' && q.set.min ? ' min="' + esc(dlim(q.set.min)) + '"' : '') + (q.type === 'date' && q.set.max ? ' max="' + esc(dlim(q.set.max)) + '"' : '') + ' value="' + esc(a || '') + '">';
    return { head: qHead(q), body: h };
  }
  function wConsentQ(q, a, auto) {
    var h = '<div class="opts" role="radiogroup" aria-labelledby="qt">' + q.options.map(function (o) {
      return '<button class="opt" role="radio" aria-checked="' + E.eq(a, o.code) + '" data-act="pick" data-q="' + esc(q.id) + '" data-v="' + o.code + '"><span class="ico" style="width:36px;height:36px">' + icon(o.code === 1 ? 'check' : 'x', 20) + '</span><span class="lab">' + esc(optLabel(o)) + '</span></button>';
    }).join('') + '</div>';
    return { head: qHead(q), body: h, hint: autoHint(auto) };
  }
  function wPhone(q) {
    var v = (S.contact && S.contact.phone) || '';
    var h = '<div class="phonewrap"><span class="pre">+91</span><input class="field" data-in="phone" data-key="ph" type="tel" inputmode="numeric" autocomplete="tel-national" maxlength="12" placeholder="98765 43210" value="' + esc(v) + '"></div>';
    if (!q.text.en) q = Object.assign({}, q, { text: { en: 'Your mobile number', ml: 'നിങ്ങളുടെ മൊബൈൽ നമ്പർ' } });
    return { head: qHead(q), body: h };
  }

  // ---- uploads
  function wUpload(q, a) {
    var u = V.uploads[q.id] || S.uploads[q.id], max = Number(q.set.max_mb || set('max_upload_mb') || 5);
    var types = (q.set.types || 'image,pdf').split(',').map(function (x) { return x.trim(); });
    var accept = types.map(function (x) { return x === 'image' ? 'image/*' : (x === 'pdf' ? 'application/pdf' : x); }).join(',');
    var h;
    if (u && (u.state || a)) {
      var st = u.state === 'uploading' ? '<span class="st"><span class="spin" style="width:14px;height:14px;border-width:2px"></span>' + esc(t('uploading')) + '</span>'
        : (u.state === 'error' ? '<span class="st" style="color:var(--error)">' + icon('alert', 14) + esc(u.msg || t('upload_failed')) + '</span>' : '<span class="st ok">' + icon('check', 14) + esc(t('uploaded')) + '</span>');
      h = '<div class="upl">' + (u.thumb ? '<img src="' + esc(u.thumb) + '" alt="">' : '<span class="fi">' + icon('file', 26) + '</span>') + '<div class="info"><div class="name">' + esc(u.name || 'file') + '</div>' + st + '</div>' +
        (u.state === 'error' ? '<button class="btn outline" style="width:auto;min-height:40px" data-act="up-retry" data-q="' + esc(q.id) + '">' + esc(t('retry')) + '</button>' : '<button class="iconbtn" data-act="up-remove" data-q="' + esc(q.id) + '" aria-label="' + esc(t('remove')) + '">' + icon('x', 20) + '</button>') + '</div>';
    } else {
      var img = types.indexOf('image') >= 0;
      h = '<div class="drop">' + icon('upload', 28) + '<div class="small muted" style="margin-top:6px">' + esc(t('upload_hint', { n: max })) + '</div><div class="btns">' +
        (img ? '<label class="btn">' + icon('camera', 20) + esc(t('take_photo')) + '<input type="file" class="sr" accept="image/*" capture="environment" data-in="file" data-q="' + esc(q.id) + '"></label>' : '') +
        '<label class="btn outline">' + icon('file', 20) + esc(t('choose_file')) + '<input type="file" class="sr" accept="' + esc(accept) + '" data-in="file" data-q="' + esc(q.id) + '"></label></div></div>';
    }
    if (V.uploadErr && V.uploadErr[q.id]) h += '<div class="err">' + icon('alert', 18) + '<span>' + esc(V.uploadErr[q.id]) + '</span></div>';
    return { head: qHead(q), body: h };
  }
  function handleFile(q, file) {
    var max = Number(q.set.max_mb || set('max_upload_mb') || 5);
    V.uploadErr = V.uploadErr || {}; V.uploadErr[q.id] = '';
    if (!/^image\/|application\/pdf/.test(file.type)) { V.uploadErr[q.id] = t('bad_type'); return refresh(); }
    var go = function (blob, thumb) {
      if (blob.size > max * 1024 * 1024) { V.uploadErr[q.id] = t('too_big', { n: max }); return refresh(); }
      var rd = new FileReader();
      rd.onload = function () {
        var data = String(rd.result).split(',')[1];
        V.uploads[q.id] = { state: 'uploading', name: file.name, thumb: thumb, data: data, mime: blob.type || file.type };
        firstAnswer(q.id);
        refresh(); doUpload(q);
      };
      rd.readAsDataURL(blob);
    };
    if (/^image\//.test(file.type) && file.size > 1.2 * 1024 * 1024 && window.createImageBitmap) {
      createImageBitmap(file).then(function (bmp) {
        var scale = Math.min(1, 1800 / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
        c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
        c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
        c.toBlob(function (b) { go(b || file, c.toDataURL('image/jpeg', 0.5)); }, 'image/jpeg', 0.85);
      }).catch(function () { go(file, ''); });
    } else if (/^image\//.test(file.type)) {
      go(file, URL.createObjectURL(file));
    } else go(file, '');
  }
  function doUpload(q) {
    var u = V.uploads[q.id]; if (!u) return;
    u.state = 'uploading';
    call({ action: 'upload', resp_id: S.resp_id, code: S.resume_code, q_id: q.id, name: u.name, mime: u.mime, data: u.data, max_mb: q.set.max_mb }, { retries: 3 }).then(function (r) {
      if (!r || !r.ok) { u.state = 'error'; u.msg = r && r.error === 'too_large' ? t('too_big', { n: q.set.max_mb || 5 }) : (r && r.error === 'type' ? t('bad_type') : ''); }
      else { u.state = 'done'; S.answers[q.id] = r.url; S.uploads[q.id] = { state: 'done', name: u.name, thumb: (u.thumb && u.thumb.length < 60000 && u.thumb.indexOf('blob:') !== 0) ? u.thumb : '' }; delete u.data; persist(); }
      if (curScreen() && curScreen().q === q.id) refresh();
    }).catch(function () { u.state = 'error'; if (curScreen() && curScreen().q === q.id) refresh(); });
  }

  // ---- stimulus
  function wStimulus(q, sc) {
    var m = Q.media[q.media] || {}, st = S.stim[m.id] || (S.stim[m.id] = { started: 0, completed: 0, watched: 0, replays: 0, screen_ms: 0 });
    if (S.stim_order.indexOf(m.id) < 0) S.stim_order.push(m.id);
    var head = qHead(q, qset(q, 'label'));
    var cap = L(m.caption) ? '<p class="cap muted small" style="text-align:center;margin-top:8px">' + esc(L(m.caption)) + '</p>' : '';
    var body = '', lock = null, hideNext = false, after;
    if (m.type === 'video' || m.type === 'audio') {
      var isA = m.type === 'audio';
      body = '<div class="player paused' + (isA ? ' audio-vis' : '') + '" id="player">' + (L(m.label) ? '<span class="chip">' + esc(L(m.label)) + '</span>' : '') +
        (isA ? '<audio id="vid" preload="auto" src="' + esc(mediaUrl(m.file)) + '"></audio>' : '<video id="vid" playsinline webkit-playsinline preload="auto"' + (m.poster ? ' poster="' + esc(mediaUrl(m.poster)) + '"' : '') + ' src="' + esc(mediaUrl(m.file)) + '"></video>') +
        '<button class="big" data-act="vplay" aria-label="' + esc(t('tap_play')) + '">' + icon('play', 30) + '</button>' +
        '<div class="controls"><div class="pbar"><i id="pbar"></i></div><span id="vtime">0:00</span><button class="mute" data-act="vmute" aria-label="mute">' + icon('vol', 18) + '</button></div></div>' + cap;
      if (m.no_seek) body += '<div class="note">' + icon('lock', 18) + '<span>' + esc(t('no_skip')) + '</span></div>';
      if (m.must_watch && !st.completed) lock = icon('lock', 18) + ' ' + esc(t('watch_first'));
      if (m.fixed_exposure_sec) { hideNext = true; body += '<div class="note">' + icon('clock', 18) + '<span id="fixedmsg">' + esc(t('auto_in', { t: fmtSec(m.fixed_exposure_sec) })) + '</span></div>'; }
      after = function () { bindVideo(q, m, st); };
    } else if (m.type === 'youtube') {
      var vid = ytId(m.file);
      body = '<div class="player" id="player">' + (L(m.label) ? '<span class="chip">' + esc(L(m.label)) + '</span>' : '') + '<div id="yt"></div></div>' + cap;
      if (m.must_watch && !st.completed) lock = icon('lock', 18) + ' ' + esc(t('watch_first'));
      after = function () { bindYouTube(q, m, st, vid); };
    } else {
      body = '<figure class="media" style="margin:0"><img src="' + esc(mediaUrl(m.file)) + '" alt="' + esc(L(m.caption)) + '"></figure>' + cap;
      var need = Math.max(m.min_view_sec || 0, 0);
      if (m.fixed_exposure_sec) { hideNext = true; body += '<div class="note">' + icon('clock', 18) + '<span id="fixedmsg">' + esc(t('auto_in', { t: fmtSec(m.fixed_exposure_sec) })) + '</span></div>'; }
      else if (need && !st.completed) lock = icon('lock', 18) + ' ' + esc(t('look_in', { t: fmtSec(need) }));
      st.started = 1;
      after = function () { bindImageStim(q, m, st); };
    }
    return { head: head, body: body, lock: lock, hideNext: hideNext, after: after };
  }
  function ytId(u) { var m = /(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{6,})/.exec(u || ''); return m ? m[1] : u; }
  function unlockNext(sc) {
    var b = document.getElementById('nextbtn'); if (!b) return;
    b.removeAttribute('aria-disabled'); b.innerHTML = esc(nextLabel(sc));
  }
  function setLock(text) { var b = document.getElementById('nextbtn'); if (b) b.innerHTML = icon('lock', 18) + ' ' + esc(text); }
  function bindImageStim(q, m, st) {
    var sc = curScreen(), t0 = Date.now();
    if (m.fixed_exposure_sec) {
      every(250, function () {
        var left = m.fixed_exposure_sec - (Date.now() - t0) / 1000, el = document.getElementById('fixedmsg');
        if (el) el.textContent = t('auto_in', { t: fmtSec(left) });
        if (left <= 0) { st.completed = 1; clearTimers(); next(); }
      });
    } else if (m.min_view_sec && !st.completed) {
      every(250, function () {
        var left = m.min_view_sec - (Date.now() - t0) / 1000;
        if (left <= 0) { st.completed = 1; clearTimers(); unlockNext(sc); persist(); } else setLock(t('look_in', { t: fmtSec(left) }));
      });
    } else st.completed = 1;
  }
  function bindVideo(q, m, st) {
    var v = document.getElementById('vid'), box = document.getElementById('player'), sc = curScreen();
    if (!v) return;
    var maxT = 0, lastT = 0, t0 = Date.now();
    V.video = v;
    var update = function () {
      var d = v.duration || 0, cur = v.currentTime || 0;
      var pb = document.getElementById('pbar'); if (pb && d) pb.style.width = (cur / d * 100) + '%';
      var tm = document.getElementById('vtime'); if (tm) tm.textContent = fmtSec(cur, 1) + (d ? ' / ' + fmtSec(d, 1) : '');
      if (m.must_watch && !st.completed) setLock(d ? t('next_in', { t: fmtSec(d - Math.max(maxT, cur)) }) : t('watch_first'));
    };
    v.addEventListener('loadedmetadata', update);
    v.addEventListener('play', function () {
      if (st.completed && !st._counted) { st.replays++; st._counted = 1; }
      st.started = 1; box.classList.add('playing'); box.classList.remove('paused'); firstAnswer(q.id);
      box.querySelector('.big').innerHTML = icon('pause', 30);
    });
    v.addEventListener('pause', function () { box.classList.remove('playing'); box.classList.add('paused'); box.querySelector('.big').innerHTML = icon('play', 30); });
    v.addEventListener('timeupdate', function () {
      var cur = v.currentTime;
      if (m.no_seek && cur > maxT + 1.2) { v.currentTime = maxT; return; }
      var dlt = cur - lastT; if (dlt > 0 && dlt < 1.5 && !v.paused) st.watched = E.round((st.watched || 0) + dlt, 2);
      lastT = cur; if (cur > maxT) maxT = cur;
      update(); persist();
    });
    v.addEventListener('seeking', function () { if (m.no_seek && v.currentTime > maxT + 1.2) v.currentTime = maxT; });
    v.addEventListener('ended', function () {
      st.completed = 1; st._counted = 0; maxT = v.duration || maxT; persist();
      if (m.must_watch) unlockNext(sc);
      box.classList.remove('playing'); box.classList.add('paused'); box.querySelector('.big').innerHTML = icon('play', 30);
    });
    box.addEventListener('click', function (e) { if (e.target.closest('.controls') || e.target.closest('.big')) return; toggleVideo(); });
    if (m.fixed_exposure_sec) every(250, function () {
      var left = m.fixed_exposure_sec - (Date.now() - t0) / 1000, el = document.getElementById('fixedmsg');
      if (el) el.textContent = t('auto_in', { t: fmtSec(left) });
      if (left <= 0) { clearTimers(); try { v.pause(); } catch (e) { } next(); }
    });
    update();
  }
  function toggleVideo() { var v = V.video; if (!v) return; if (v.paused) { var p = v.play(); if (p && p.catch) p.catch(function () { }); } else v.pause(); }
  function bindYouTube(q, m, st, vid) {
    var sc = curScreen();
    var make = function () {
      try {
        var started = Date.now(), poll;
        V.yt = new YT.Player('yt', { videoId: vid, playerVars: { rel: 0, modestbranding: 1, playsinline: 1, controls: m.no_seek ? 0 : 1, disablekb: m.no_seek ? 1 : 0 },
          events: { onStateChange: function (e) {
            if (e.data === 1) { st.started = 1; firstAnswer(q.id); clearInterval(poll); var last = V.yt.getCurrentTime(); poll = setInterval(function () { var c = V.yt.getCurrentTime(); var d = c - last; if (d > 0 && d < 1.5) st.watched = E.round(st.watched + d, 2); last = c; }, 500); V.timers.push({ i: poll }); }
            if (e.data === 2) clearInterval(poll);
            if (e.data === 0) { clearInterval(poll); if (st.completed) st.replays++; st.completed = 1; persist(); unlockNext(sc); }
          } } });
      } catch (e) { unlockNext(sc); }
    };
    if (window.YT && YT.Player) make();
    else {
      window.onYouTubeIframeAPIReady = make;
      if (!document.querySelector('script[data-yt]')) { var s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; s.setAttribute('data-yt', '1'); s.onerror = function () { unlockNext(sc); }; document.head.appendChild(s); }
    }
  }

  // ---- sound check
  function renderSoundCheck(sc, anim) {
    var q = qById(sc.q), res = S.sound[q.id], tries = V.soundTries || 0;
    var body = '<div style="text-align:center;padding-top:10px"><div class="bigico" style="margin:10px auto 22px">' + icon('headphones', 36, ' stroke-width="1.8"') + '</div>' +
      '<p class="eyebrow">' + esc(t('sound_check')) + '</p><h1 class="qtext">' + esc(t('sound_q')) + '</h1></div>' +
      '<div style="display:grid;gap:12px;margin-top:24px"><button class="btn outline" data-act="tone">' + icon('vol', 20) + esc(t('play_tone')) + '</button></div>' +
      (V.toned ? '<div class="opts" style="margin-top:22px"><button class="opt" data-act="hear" data-v="1" aria-checked="' + (res === 1) + '"><span class="ico" style="width:36px;height:36px">' + icon('check', 20) + '</span><span class="lab">' + esc(t('can_hear')) + '</span></button>' +
        '<button class="opt" data-act="hear" data-v="0" aria-checked="' + (res === 0) + '"><span class="ico" style="width:36px;height:36px">' + icon('x', 20) + '</span><span class="lab">' + esc(t('cannot_hear')) + '</span></button></div>' : '') +
      (res === 0 ? '<div class="note">' + icon('info', 18) + '<span>' + esc(t('sound_tip')) + '</span></div>' : '');
    var btns = res === 0 && tries >= 2 ? [{ act: 'sound-skip', html: esc(t('anyway')), outline: true }] : [];
    paint(frame(topbar({ progress: progress(sc), label: L(blockById(sc.block).title), noBack: !S.history.length }), body, bottombar({ buttons: btns })), anim);
  }
  function playTone() {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext, ctx = V.actx || (V.actx = new Ctx());
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = 660; g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.4);
      o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 1.5);
    } catch (e) { }
  }

  // ---- slider
  function bindSlider(q) {
    var el = root.querySelector('.slider[data-q="' + q.id + '"]'); if (!el) return;
    var min = Number(q.set.min || 0), max = Number(q.set.max || 100), step = Number(q.set.step || 1);
    var setFromX = function (x) {
      var r = el.querySelector('.track').getBoundingClientRect();
      var f = Math.min(1, Math.max(0, (x - r.left) / r.width));
      var v = min + Math.round((f * (max - min)) / step) * step;
      v = Math.min(max, Math.max(min, E.round(v, 4)));
      setSlider(q, el, v, min, max);
    };
    el.addEventListener('pointerdown', function (e) { el.setPointerCapture && el.setPointerCapture(e.pointerId); el._drag = true; setFromX(e.clientX); e.preventDefault(); });
    el.addEventListener('pointermove', function (e) { if (el._drag) setFromX(e.clientX); });
    var up = function () { if (el._drag) { el._drag = false; updateNextState(); } };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('keydown', function (e) {
      var cur = E.isNum(S.answers[q.id]) ? Number(S.answers[q.id]) : Math.round((min + max) / 2);
      var d = { ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step, PageUp: step * 10, PageDown: -step * 10 }[e.key];
      if (d === undefined) return; e.preventDefault();
      setSlider(q, el, Math.min(max, Math.max(min, cur + (E.blankish(S.answers[q.id]) ? 0 : d))), min, max); updateNextState();
    });
  }
  function setSlider(q, el, v, min, max) {
    S.answers[q.id] = v; firstAnswer(q.id); clearErr();
    var pct = ((v - min) / (max - min)) * 100;
    el.classList.remove('untouched');
    el.querySelector('.fill').style.width = pct + '%'; el.querySelector('.thumb').style.left = pct + '%';
    var b = el.querySelector('.bubble'); if (b) b.textContent = v;
    el.setAttribute('aria-valuenow', v);
    var h = root.querySelector('.slider-hint'); if (h) h.remove();
    persist();
  }

  // ------------------------------------------------------------------ validation
  function validate(sc) {
    var q = qById(sc.q), a = answerFor(sc), req = needsAnswer(q, sc);
    if (q.type === 'phone') {
      var p = (S.contact && S.contact.phone) || '';
      if (!p) return req ? t('phone_needed') : '';
      return E.validPhone(p) ? '' : t('phone_needed');
    }
    if (q.type === 'file_upload') { var u = V.uploads[q.id]; if (u && u.state === 'uploading') return t('wait_upload'); }
    if (q.type === 'semantic_diff') { if (req && !E.isAnswered(q, a)) return t('each_row'); return ''; }
    if (E.blankish(a)) return req ? (/^(single|dropdown|likert_emoji|linear_scale|star_rating|nps|mc_grid|consent|checkbox|checkbox_grid)$/.test(q.type) ? t('choose_one') : t('please_answer')) : '';
    if (q.type === 'checkbox' || q.type === 'checkbox_grid') {
      var n = (a || []).length, mn = Number(q.set.min || 0), mx = Number(q.set.max || 0);
      var exclusive = (a || []).some(function (x) { return (q.exclusive || []).some(function (e) { return E.eq(e, x); }); });
      if (mn && n < mn && !exclusive) return t('at_least', { n: mn });
      if (mx && n > mx) return t('up_to', { n: mx });
    }
    if (q.other !== undefined) {
      var picked = Array.isArray(a) ? a.some(function (x) { return E.eq(x, q.other); }) : E.eq(a, q.other);
      if (picked && !E.str(S.answers[q.id + '_other'])) { var oo = q.options.filter(function (o) { return E.eq(o.code, q.other); })[0]; return t('other_needed', { o: oo ? optLabel(oo) : 'Other' }); }
    }
    if (q.type === 'short_text') {
      var f = q.set.format, s = E.str(a);
      if (f === 'number') {
        var num = Number(s.replace(/,/g, ''));
        if (!/^-?\d+(\.\d+)?$/.test(s.replace(/,/g, ''))) return t('number_needed');
        var lo = q.set.min !== undefined ? Number(q.set.min) : -Infinity, hi = q.set.max !== undefined ? Number(q.set.max) : Infinity;
        if (num < lo || num > hi) return t('between', { a: q.set.min || lo, b: q.set.max || hi });
      }
      if (f === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)) return t('email_needed');
      if (f === 'phone' && !E.validPhone(s)) return t('phone_needed');
    }
    if (q.type === 'paragraph' && q.set.min_words && E.words(a) < Number(q.set.min_words)) return t('min_words', { n: q.set.min_words });
    if (q.type === 'date') {
      var mn2 = dlim(q.set.min), mx2 = dlim(q.set.max);
      if ((mn2 && a < mn2) || (mx2 && a > mx2)) return t('date_range', { a: fmtDate(mn2) || '…', b: fmtDate(mx2) || '…' });
    }
    return '';
  }
  function showErr(msg) {
    V.err = msg;
    var box = document.getElementById('errbox');
    if (box) { box.innerHTML = errHtml(); var e = box.firstChild; if (e) { e.classList.add('shake'); try { e.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (x) { } } }
    else refresh();
  }
  function clearErr() { if (V.err) { V.err = ''; var box = document.getElementById('errbox'); if (box) box.innerHTML = ''; } }
  function updateNextState() {
    var sc = curScreen(); if (!sc || sc.kind !== 'q') return;
    var q = qById(sc.q), b = root.querySelector('.bottombar .btn[data-act="next"]');
    if (!b || b.id === 'nextbtn') return;
    if (!isComplete(q, sc) && needsAnswer(q, sc)) b.setAttribute('aria-disabled', 'true'); else b.removeAttribute('aria-disabled');
  }

  // ------------------------------------------------------------------ answers
  function firstAnswer(key) { if (S.first[key] === undefined && V.shownAt) S.first[key] = Math.round(performance.now() - V.shownAt); }
  function scheduleAuto(sc) {
    if (set('auto_advance') === 'no') return;
    clearTimeout(V.timer);
    var id = sc.id;
    V.timer = setTimeout(function () { if (S.cur === id && S.phase !== 'end') next(); }, 250);
  }
  function codeOf(el) { return E.toNum(el.getAttribute('data-v')); }

  // ------------------------------------------------------------------ navigation
  function leave() {
    if (V.shownAt && S.cur) { S.timings[S.cur] = Math.round((S.timings[S.cur] || 0) + performance.now() - V.shownAt); }
    var st = S.cur && curScreen();
    if (st && st.kind === 'q') { var q = qById(st.q); if (q.type === 'stimulus' && S.stim[q.media]) S.stim[q.media].screen_ms = (S.stim[q.media].screen_ms || 0) + Math.round(performance.now() - V.shownAt); }
    if (V.video) { try { V.video.pause(); } catch (e) { } V.video = null; }
    if (V.yt && V.yt.destroy) { try { V.yt.destroy(); } catch (e) { } V.yt = null; }
    V.shownAt = 0; V.err = ''; V.enc = ''; V.toned = false; V.soundTries = 0;
    clearTimeout(V.timer); clearTimers();
  }
  function show(id, anim, dir) {
    leave();
    V.dir = dir || 'fwd';
    S.cur = id;
    var sc = curScreen();
    if (sc && !sc.debrief && set('breaks') === 'no') {
      var p = progress(sc);
      [75, 50, 25].some(function (th) { if (p >= th && !S.enc[th]) { S.enc[th] = 1; V.enc = t('enc' + th); return true; } return false; });
      if (V.enc) Object.keys({ 25: 1, 50: 1, 75: 1 }).forEach(function (k) { if (p >= Number(k)) S.enc[k] = 1; });
    }
    persist();
    render(anim === undefined ? true : anim);
  }
  function next() {
    if (S.phase === 'consent' || S.phase === 'welcome') return;
    var sc = curScreen(); if (!sc) return;
    if (sc.kind === 'q') {
      var err = validate(sc); if (err) return showErr(err);
      var q = qById(sc.q);
      if (q.screenout && !sc.debrief && q.screenout.some(function (c) { return E.eq(c, S.answers[q.id]); })) { leave(); return finish('screened_out'); }
    }
    if (sc.kind === 'soundcheck' && S.sound[sc.q] !== 1 && !V.soundSkip) return;
    var list = sc.debrief ? DEBRIEF : FLOW, i = list.indexOf(sc), nx = null;
    for (var j = i + 1; j < list.length; j++) if (sc.debrief || visible(list[j])) { nx = list[j]; break; }
    if (sc.debrief) { if (nx) { S.history.push(sc.id); return show(nx.id); } leave(); S.phase = 'end'; persist(true); return renderEnd(); }
    if (!nx || nx.block !== sc.block) { S.done_blocks[sc.block] = 1; S.last_block = sc.block; if (nx) checkpoint(); }
    if (!nx) { leave(); return finish('complete'); }
    S.history.push(sc.id);
    var th = breakDue(nx);
    if (th) { leave(); V.dir = 'fwd'; S.brk = { th: th, to: nx.id }; persist(); return render(true); }
    show(nx.id);
  }
  function back() {
    if (S.phase === 'consent') { S.phase = 'welcome'; V.err = ''; return render(); }
    if (S.brk) { endBreak(); }
    while (S.history.length) {
      var id = S.history.pop(), sc = screenById(id);
      if (sc && visible(sc)) return show(id, true, 'back');
    }
  }

  // ------------------------------------------------------------------ short breaks at 25, 50 and 75%
  // Optional, take a few seconds, store no answers (only their time, as t_break_25 and so on).
  function breakDue(nx) {
    if (set('breaks') === 'no' || PREVIEW && V.devJumping) return 0;
    var p = progress(nx), due = 0;
    [25, 50, 75].forEach(function (th) { if (p >= th && !S.enc[th]) { S.enc[th] = 1; due = th; } });
    return due;
  }
  function endBreak() {
    if (!S.brk) return null;
    if (V.shownAt) S.timings['break_' + S.brk.th] = Math.round((S.timings['break_' + S.brk.th] || 0) + performance.now() - V.shownAt);
    var to = S.brk.to; delete S.brk; V.shownAt = 0; clearTimers();
    return to;
  }
  function renderBreak(anim) {
    var th = S.brk.th, body = '<div class="brk"><p class="eyebrow">' + esc(t('quick_break')) + '</p><h1>' + esc(t('enc' + th)) + '</h1>', after = null;
    if (th === 25) {
      var spots = [[22, 28], [62, 20], [40, 52], [78, 58], [20, 76], [60, 82]], cols = ['#8CCFA6', '#4DAB78', '#F2C879', '#9BD3C2', '#B7DFA0', '#E9B96A'];
      V.popped = V.popped || 0;
      body += '<p>' + esc(t('pop_txt')) + '</p><div class="pond" aria-label="bubbles">' + spots.map(function (xy, i) {
        return '<button class="bub" data-act="pop" aria-label="bubble ' + (i + 1) + '" style="left:' + xy[0] + '%;top:' + xy[1] + '%;--c:' + cols[i] + ';animation-delay:' + (i * 0.35) + 's"></button>';
      }).join('') + '</div><p id="popcount">' + esc(t('popped', { n: 0, m: spots.length })) + '</p>';
      V.popped = 0;
    } else if (th === 50) {
      body += '<p>' + esc(t('breathe_txt')) + '</p><div class="breath" aria-hidden="true"></div><div class="breath-word" id="bw">' + esc(t('breathe_in')) + '</div>';
      after = function () { var k = 0; every(4000, function () { var el = document.getElementById('bw'); if (el) el.textContent = t(k++ % 2 ? 'breathe_out' : 'breathe_in'); }); };
    } else {
      var facts = (setL('fun_facts') || '').split('|').map(function (x) { return x.trim(); }).filter(Boolean);
      var vf = visibleFlow().filter(function (s) { return s.kind === 'q'; }), done = 0, left = 0;
      var target = screenById(S.brk.to), ti = FLOW.indexOf(target);
      vf.forEach(function (s) { if (FLOW.indexOf(s) < ti) done++; else left++; });
      var mins = Math.max(1, Math.round(left * 9 / 60));
      body += '<div class="starsrow" aria-hidden="true">' + [0, 1, 2].map(function () { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">' + IP.star + '</svg>'; }).join('') + '</div>' +
        '<p>' + esc(mins === 1 ? t('recap1', { n: done }) : t('recap', { n: done, m: mins })) + '</p>' +
        (facts.length ? '<div class="fact">' + icon('sparkle', 22) + '<div><b>' + esc(t('did_you_know')) + '</b><div class="muted">' + esc(facts[Math.floor(Math.random() * facts.length)]) + '</div></div></div>' : '');
    }
    body += '</div>';
    var target2 = screenById(S.brk.to);
    paint(frame(topbar({ progress: progress(target2), label: t('quick_break') }), body, bottombar({ buttons: [{ act: 'brk-go', html: esc(t('cont')) + ' ' + icon('arrowR', 20) }] })), anim, after);
  }

  // ------------------------------------------------------------------ server sync
  function deviceType() {
    var ua = navigator.userAgent || '';
    if (/iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return 'tablet';
    if (/Mobi|Android|iPhone|iPod/i.test(ua)) return 'mobile';
    if (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua)) return 'tablet';
    return 'desktop';
  }
  function browser() {
    var ua = navigator.userAgent || '';
    var list = [['WhatsApp', /WhatsApp/i], ['Instagram', /Instagram/i], ['Facebook', /FBAN|FBAV|FB_IAB/i], ['Samsung', /SamsungBrowser/i], ['Edge', /Edg\//], ['Opera', /OPR\//], ['Chrome', /Chrome|CriOS/], ['Firefox', /Firefox|FxiOS/], ['Safari', /Safari/]];
    for (var i = 0; i < list.length; i++) if (list[i][1].test(ua)) return list[i][0] + (/; wv\)/.test(ua) ? ' (in-app)' : '');
    return 'Other';
  }
  function visibleQuestions() {
    var st = engState(), mode = phoneMode();
    return Q.questions.filter(function (q) {
      if (blockById(q.block) && blockById(q.block).position === 'debrief') return false;
      if (q.type === 'phone' && mode === 'no') return false;
      return E.questionVisible(Q, q, st);
    });
  }
  function buildRec(status) {
    var vq = visibleQuestions(), answers = {}, shown = [], answerable = 0, answered = 0;
    vq.forEach(function (q) {
      if (!S.shown[q.id]) return;
      if (q.type === 'phone') return;
      shown.push(q.id);
      if (!E.blankish(S.answers[q.id])) answers[q.id] = S.answers[q.id];
      if (q.other !== undefined && S.answers[q.id + '_other']) answers[q.id + '_other'] = S.answers[q.id + '_other'];
    });
    vq.forEach(function (q) { if (E.NO_DATA[q.type]) return; answerable++; if (S.shown[q.id] && E.isAnswered(q, S.answers[q.id])) answered++; });
    var phoneVisible = vq.some(function (q) { return q.type === 'phone'; });
    var rec = {
      status: status, q_version: Q.version, lang: S.lang, lang_switches: S.lang_switches, condition: S.condition || '', src: S.src, ext_id: S.ext_id,
      device_type: deviceType(), screen_width: Math.round(window.screen && screen.width || window.innerWidth), browser: browser(),
      last_block: S.last_block || '', pct_complete: answerable ? Math.round(answered / answerable * 100) : 100,
      answers: answers, shown: shown, orders: { blocks: S.orders.blocks, items: S.orders.items }, stim_order: S.stim_order,
      timings: S.timings, first: S.first, stim: S.stim, sound: S.sound,
      cur: S.cur, history: S.history, enc: S.enc, done_blocks: S.done_blocks, options: S.orders.options, latin: S.latin, uploads: S.uploads
    };
    if (phoneVisible && S.contact && E.validPhone(S.contact.phone)) rec.contact = { phone: S.contact.phone };
    return rec;
  }
  function checkpoint() {
    if (!S.resp_id) return Promise.resolve();
    var rec = buildRec('partial');
    S.pending = [1]; persist(true);
    return call({ action: 'save', resp_id: S.resp_id, code: S.resume_code, rec: rec, final: false }, { retries: 3 }).then(function (r) {
      S.pending = []; S.lastSync = Date.now(); persist(true);
      if (r && r.ok && r.status === 'quota_full' && S.phase === 'survey') { leave(); S.end = { kind: 'quota_full' }; afterFinal(); }
      updateSaveState();
    }).catch(function () { updateSaveState(); });
  }
  function updateSaveState() { var el = root.querySelector('.savestate span'); if (el) { var p = S.pending && S.pending.length; el.textContent = p ? t('not_sent') : t('saved_device'); el.parentNode.classList.toggle('warn', !!p); } }
  function flushPending() { if (S.pending && S.pending.length && S.resp_id && S.phase === 'survey') checkpoint(); }
  window.addEventListener('online', function () { if (S && S.phase === 'sending') submit(); else flushPending(); });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'hidden' || !S || !S.resp_id || S.phase !== 'survey' || PREVIEW) return;
    persist(true);
    if (S.lastSync && Date.now() - S.lastSync < 60000) return;
    if (navigator.sendBeacon && API && typeof CFG.mockApi !== 'function') {
      try { navigator.sendBeacon(API, new Blob([JSON.stringify({ action: 'save', study: STUDY, resp_id: S.resp_id, code: S.resume_code, rec: buildRec('partial'), final: false })], { type: 'text/plain' })); S.lastSync = Date.now(); } catch (e) { }
    }
  });

  function startSurvey() {
    if (V.busy) return;
    V.busy = true; refreshConsentBtn();
    var force = PREVIEW && V.forceCond ? V.forceCond : '';
    call({ action: 'start', device: deviceToken(), src: S.src, ext_id: S.ext_id, lang: S.lang, device_type: deviceType(), screen_width: Math.round(window.screen && screen.width || window.innerWidth), browser: browser(), q_version: Q.version, force_condition: force }, { retries: 3 }).then(function (r) {
      V.busy = false;
      if (!r || !r.ok) {
        var st = r && r.status;
        if (st === 'duplicate' || st === 'quota_full' || st === 'closed' || st === 'not_open' || st === 'full') { S.end = { kind: st === 'full' ? 'closed' : st }; S.phase = 'end'; persist(true); return renderEnd(); }
        V.err = t('start_fail'); return render(false);
      }
      S.resp_id = r.resp_id; S.resume_code = r.resume_code; S.condition = r.condition; S.latin = r.latin; S.q_version = Q.version; S.started = Date.now();
      S.orders = E.makeOrders(Q, { latin: r.latin });
      S.phase = 'survey'; V.err = '';
      setupFlow();
      var vf = visibleFlow();
      if (!vf.length) return finish('complete');
      persist(true);
      show(vf[0].id);
    }).catch(function () { V.busy = false; V.err = t('start_fail'); render(false); });
  }
  function refreshConsentBtn() { var b = document.getElementById('agree'); if (b) b.innerHTML = '<span class="spin"></span> ' + esc(t('starting')); }

  function finish(status) {
    S.final_status = status; S.phase = 'sending'; persist(true);
    submit();
  }
  function renderSending() {
    root.innerHTML = frame('', '<div class="loading"><div><span class="spin"></span><p>' + esc(t('sending')) + '</p></div></div>', '') + devTools();
  }
  function submit() {
    renderSending();
    var rec = buildRec(S.final_status || 'complete');
    call({ action: 'save', resp_id: S.resp_id, code: S.resume_code, rec: rec, final: true }, { retries: 5 }).then(function (r) {
      if (!r || !r.ok) {
        if (r && (r.error === 'auth' || r.error === 'unknown')) { S.end = { kind: 'complete' }; return afterFinal(); }
        throw new Error('save');
      }
      S.end = { kind: r.status === 'complete' ? 'complete' : (r.status || S.final_status), code: r.completion_code || '' };
      S.pending = [];
      afterFinal();
    }).catch(function () {
      root.innerHTML = frame('', '<div class="end"><div class="donecircle neutral"><div>' + icon('save', 44) + '</div></div><h1>' + esc(t('fail_t')) + '</h1><p>' + esc(t('fail')) + '</p></div>',
        bottombar({ buttons: [{ act: 'resubmit', html: esc(t('try_again')) }] })) + devTools();
    });
  }
  function afterFinal() {
    if (!PREVIEW && S.end.kind === 'complete') lsSet('svy:done:' + STUDY, 1);
    var deb = DEBRIEF.filter(function (s) { return armOk(s); });
    if (deb.length && S.end.kind !== 'declined') { S.phase = 'debrief'; S.history = []; persist(true); return show(deb[0].id); }
    S.phase = 'end'; persist(true); renderEnd();
  }
  function armOk(s) { var q = qById(s.q); return !q || E.questionVisible(Q, q, engState()); }

  // ------------------------------------------------------------------ end screens
  function renderEnd() {
    clearTimers();
    var e = S.end || { kind: 'complete' }, k = e.kind;
    var title, text, ic = 'check', neutral = false, conf = false;
    if (k === 'complete') { title = t('thanks'); text = setL('thankyou') || t('default_thanks'); conf = true; }
    else if (k === 'screened_out') { title = t('screened_t'); text = setL('screenout_msg'); neutral = true; ic = 'info'; }
    else if (k === 'quota_full') { title = t('quota_t'); text = setL('quotafull_msg'); neutral = true; ic = 'info'; }
    else if (k === 'declined') { title = t('declined_t'); text = setL('declined_msg'); neutral = true; ic = 'info'; }
    else if (k === 'duplicate') { title = t('dup_t'); text = setL('duplicate_msg'); neutral = true; }
    else if (k === 'not_open') { title = t('not_open_t'); text = (setL('closed_msg') || '') + (set('open_date') ? ' ' + t('opens', { d: fmtDate(set('open_date')) }) : ''); neutral = true; ic = 'clock'; }
    else { title = t('closed_t'); text = setL('closed_msg'); neutral = true; ic = 'lock'; }
    var body = '<div class="end"><div class="donecircle' + (neutral ? ' neutral' : '') + '"><div>' + icon(ic, 52, ' stroke-width="2.6"') + '</div></div><h1>' + esc(title) + '</h1><p>' + esc(text || '') + '</p>';
    if (k === 'complete' && e.code) body += '<div class="card">' + icon('tag', 20) + '<div><div class="t">' + esc(t('comp_code')) + '</div><div class="v" style="font-size:1.4rem;letter-spacing:.08em">' + esc(e.code) + '</div></div></div>';
    if (k === 'complete' && set('show_scores_at_end') === 'yes' && Q) {
      var rec = { answers: S.answers, shown: Object.keys(S.shown) }, sc = E.computeScores(Q, rec), keys = Object.keys(sc).filter(function (x) { return sc[x] >= 0; });
      if (keys.length) body += '<div class="scores"><p class="label">' + esc(t('your_scores')) + '</p>' + keys.map(function (x) { return '<div><span>' + esc(x.replace(/^score_/, '')) + '</span><b>' + esc(sc[x]) + '</b></div>'; }).join('') + '</div>';
    }
    var contact = set('researcher_email') || set('researcher_phone');
    if (contact && Q) body += '<div class="card">' + icon('mail', 20) + '<div><div class="t">' + esc(t('questions_q')) + '</div><div class="v">' + (set('researcher_email') ? '<a href="mailto:' + esc(set('researcher_email')) + '">' + esc(set('researcher_email')) + '</a>' : esc(set('researcher_phone'))) + '</div></div></div>';
    body += '</div>';
    var share = (k === 'complete' || k === 'duplicate') && Q ? bottombar({ buttons: [{ act: 'share', html: icon('share', 20) + esc(t('share')) }] }) : '';
    root.innerHTML = frame('', body, share) + (V.overlay || '') + devTools();
    var c = root.querySelector('.content'); if (c) c.classList.add('screen-in');
    if (conf && !V.confettiDone && !document.body.classList.contains('reduce-motion')) { V.confettiDone = 1; confetti(); }
  }
  function confetti() {
    var cols = ['#8CCFA6', '#2F8F5B', '#F2C879', '#B7DFA0', '#6FBF93'], h = '<div class="confetti" aria-hidden="true">';
    for (var i = 0; i < 26; i++) {
      var x = (Math.random() * 120 - 60).toFixed(0) + 'px', l = (8 + Math.random() * 84).toFixed(1) + '%';
      h += '<i style="left:' + l + ';background:' + cols[i % cols.length] + ';--x:' + x + ';--r:' + (Math.random() * 540 - 270).toFixed(0) + 'deg;--d:' + (2.2 + Math.random() * 1.6).toFixed(2) + 's;--delay:' + (Math.random() * 0.5).toFixed(2) + 's;width:' + (Math.random() < .5 ? 8 : 5) + 'px;height:' + (Math.random() < .5 ? 4 : 8) + 'px"></i>';
    }
    var d = document.createElement('div'); d.innerHTML = h + '</div>'; var el = d.firstChild; document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 4500);
  }

  // ------------------------------------------------------------------ overlays
  function openLater() {
    var code = S.resume_code || '', pretty = code.slice(0, 3) + '-' + code.slice(3);
    var close = set('close_date');
    var link = studyLink();
    V.overlay = '<div class="overlay" data-act="overlay-bg"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="lt"><div class="handle"></div><h2 id="lt">' + esc(t('later_t')) + '</h2>' +
      '<p class="muted" style="margin:0">' + esc(close ? t('later_txt', { d: fmtDate(close) }) : t('later_txt2')) + '</p>' +
      '<div class="codebox"><span class="code">' + esc(pretty) + '</span><button class="iconbtn" data-act="copy-code" aria-label="copy">' + icon('copy', 22) + '</button></div>' +
      '<a class="btn" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent(t('wa_msg', { t: setL('study_title'), c: pretty, u: link })) + '">' + icon('share', 20) + esc(t('send_wa')) + '</a>' +
      '<button class="btn outline" data-act="overlay-close">' + esc(t('cont_now')) + '</button></div></div>';
    refresh();
    checkpoint();
  }
  function studyLink() { if (CFG.link) return CFG.link; var u = location.href.split('#')[0].replace(/[?&](src|preview|id|lang)=[^&]*/g, '').replace(/\?&/, '?').replace(/\?$/, ''); return u; }
  function openFullSheet() {
    V.overlay = '<div class="full" role="dialog" aria-modal="true"><div class="fhead"><button class="iconbtn" data-act="overlay-close" aria-label="' + esc(t('close')) + '">' + icon('x', 22) + '</button><div class="topbar-title">' + esc(t('full_sheet')) + '</div></div>' +
      '<div class="fbody"><p class="fulltext">' + esc(setL('consent_full')) + '</p>' + (set('researcher_email') ? '<p><a href="mailto:' + esc(set('researcher_email')) + '">' + esc(set('researcher_email')) + '</a></p>' : '') + '</div></div>';
    refresh();
  }
  function openDropdown(q) {
    V.dd = q.id; V.ddq = '';
    V.overlay = ddHtml(q);
    refresh();
    setTimeout(function () { var i = document.getElementById('ddsearch'); if (i && q.options.length > 8) i.focus(); }, 50);
  }
  function ddHtml(q) {
    var a = S.answers[q.id], f = (V.ddq || '').toLowerCase();
    var opts = orderedOptions(q).filter(function (o) { return !f || (o.label.en + ' ' + o.label.ml).toLowerCase().indexOf(f) >= 0; });
    var showSearch = q.set.search !== 'no' && q.options.length > 6;
    return '<div class="full" role="dialog" aria-modal="true"><div class="fhead"><button class="iconbtn" data-act="overlay-close" aria-label="' + esc(t('close')) + '">' + icon('x', 22) + '</button>' +
      (showSearch ? '<div class="searchwrap">' + icon('search', 18) + '<input id="ddsearch" class="field" data-in="ddsearch" placeholder="' + esc(t('search')) + '" value="' + esc(V.ddq || '') + '" autocomplete="off"></div>' : '<div class="topbar-title">' + esc(pipe(L(q.text))) + '</div>') + '</div>' +
      '<div class="fbody"><div class="list" role="listbox" id="ddlist">' + (opts.length ? opts.map(function (o) {
        return '<button role="option" aria-selected="' + E.eq(a, o.code) + '" data-act="dd-pick" data-q="' + esc(q.id) + '" data-v="' + esc(o.code) + '"><span style="flex:1">' + esc(optLabel(o)) + '</span>' + (E.eq(a, o.code) ? icon('check', 20) : '') + '</button>';
      }).join('') : '<div class="empty">' + esc(t('no_match')) + '</div>') + '</div></div></div>';
  }
  function toast(msg) { var d = document.createElement('div'); d.className = 'toast'; d.textContent = msg; document.body.appendChild(d); setTimeout(function () { d.remove(); }, 1600); }

  // ------------------------------------------------------------------ preview tools
  function devTools() {
    if (!PREVIEW || !Q) return '';
    if (!V.devOpen) return '<button class="devbtn" data-act="dev" aria-label="' + esc(t('test_tools')) + '">' + icon('gear', 22) + '</button>';
    var opts = FLOW.map(function (s) {
      var q = s.q ? qById(s.q) : null, vis = S.orders ? visible(s) : true;
      var lab = s.kind === 'intro' ? '▸ ' + s.block : (q ? q.id + (s.row !== undefined ? ' [' + s.row + ']' : '') + ' · ' + q.type : s.id);
      return '<option value="' + esc(s.id) + '"' + (s.id === S.cur ? ' selected' : '') + '>' + esc(lab + (vis ? '' : '  (hidden)')) + '</option>';
    }).join('');
    var conds = Q.conditions.map(function (c) { return '<option value="' + esc(c.id) + '"' + (c.id === S.condition ? ' selected' : '') + '>' + esc(c.id + ' — ' + c.label) + '</option>'; }).join('');
    return '<div class="overlay" data-act="dev-bg"><div class="sheet dev"><div class="handle"></div><h2>' + esc(t('test_tools')) + '</h2>' +
      '<p class="muted small" style="margin:0">resp_id ' + esc(S.resp_id || '—') + ' · version ' + esc(Q.version) + ' · ' + esc(S.condition || 'no condition') + '</p>' +
      (S.resp_id ? '<label for="devjump">' + esc(t('jump')) + '</label><select id="devjump" data-in="devjump">' + opts + '</select>' : '<p class="muted small">Start the survey to jump between questions.</p>') +
      (Q.conditions.length ? '<label for="devcond">' + esc(t('cond')) + '</label><select id="devcond" data-in="devcond"><option value="">(random)</option>' + conds + '</select>' : '') +
      '<div style="margin-top:18px"><button class="btn outline" data-act="dev-restart">' + esc(t('restart')) + '</button><button class="btn ghost" data-act="dev">' + esc(t('close')) + '</button></div></div></div>';
  }

  // ------------------------------------------------------------------ events
  function afterPaint() {
    if (S && (S.phase === 'survey' || S.phase === 'debrief')) V.shownAt = V.shownAt || performance.now();
  }
  function every(ms, fn) { var id = setInterval(fn, ms); V.timers.push({ i: id }); fn(); }
  function clearTimers() { (V.timers || []).forEach(function (x) { clearInterval(x.i); }); V.timers = []; }

  root.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el || !root.contains(el)) return;
    var act = el.getAttribute('data-act');
    if (el.getAttribute('aria-disabled') === 'true' && act === 'next') {
      var sc0 = curScreen();
      if (sc0 && sc0.kind === 'q') { var er = validate(sc0); showErr(er || t('please_answer')); }
      return;
    }
    var q = el.getAttribute('data-q') ? qById(el.getAttribute('data-q')) : null, sc = curScreen();
    switch (act) {
      case 'reload': location.reload(); break;
      case 'lang':
        var nl = el.getAttribute('data-v');
        if (nl !== S.lang) { S.lang = nl; if (S.resp_id) S.lang_switches = (S.lang_switches || 0) + 1; applyPrefs(); persist(); if (S.phase === 'survey' || S.phase === 'debrief') { if (V.overlay && V.dd) V.overlay = ddHtml(qById(V.dd)); refresh(); } else render(false); }
        break;
      case 'aplus': S.fs = S.fs > 1 ? 1 : 1.2; applyPrefs(); persist(); refresh(); break;
      case 'back': back(); break;
      case 'to-consent': S.phase = 'consent'; V.err = ''; persist(); S._anim = true; render(); S._anim = false; break;
      case 'continue':
        S.phase = 'survey'; setupFlow();
        var cs = curScreen();
        if (!cs || !visible(cs)) { var vf = visibleFlow(); cs = vf[0]; }
        show(cs.id); flushPending(); break;
      case 'resume-open': V.resumeOpen = true; render(false); setTimeout(function () { var i = document.getElementById('rc'); if (i) i.focus(); }, 30); break;
      case 'resume-go': doResume(); break;
      case 'fullsheet': openFullSheet(); break;
      case 'agree': startSurvey(); break;
      case 'disagree':
        call({ action: 'decline' }, { retries: 2 }).catch(function () { });
        var keepLang = lang(); S = fresh(); S.lang = keepLang; S.end = { kind: 'declined' }; S.phase = 'end'; persist(true); renderEnd(); break;
      case 'next': next(); break;
      case 'brk-go': var to = endBreak(); if (to) show(to); break;
      case 'pop':
        if (!el.classList.contains('popped')) {
          el.classList.add('popped'); V.popped = (V.popped || 0) + 1;
          var pc = document.getElementById('popcount'), tot = root.querySelectorAll('.bub').length;
          if (pc) pc.textContent = V.popped >= tot ? t('all_popped') : t('popped', { n: V.popped, m: tot });
        }
        break;
      case 'pick':
        var v = codeOf(el);
        S.answers[q.id] = v; firstAnswer(q.id); clearErr();
        if (q.type === 'single' && q.other !== undefined && !E.eq(v, q.other)) delete S.answers[q.id + '_other'];
        persist(); refresh(); flashSel(el);
        if (E.AUTO_ADVANCE[q.type] && !(q.other !== undefined && E.eq(v, q.other)) && set('auto_advance') !== 'no') scheduleAuto(sc);
        else updateNextState();
        break;
      case 'toggle':
        var c = codeOf(el), arr = (S.answers[q.id] || []).slice(), has = arr.some(function (x) { return E.eq(x, c); });
        var excl = (q.exclusive || []).some(function (x) { return E.eq(x, c); });
        if (has) arr = arr.filter(function (x) { return !E.eq(x, c); });
        else {
          if (excl) arr = [c];
          else {
            arr = arr.filter(function (x) { return !(q.exclusive || []).some(function (e2) { return E.eq(e2, x); }); });
            if (q.set.max && arr.length >= Number(q.set.max)) { showErr(t('up_to', { n: q.set.max })); return; }
            arr.push(c);
          }
        }
        S.answers[q.id] = arr; firstAnswer(q.id); clearErr();
        if (q.other !== undefined && !arr.some(function (x) { return E.eq(x, q.other); })) delete S.answers[q.id + '_other'];
        persist(); refresh(); break;
      case 'gpick':
        var all = Object.assign({}, S.answers[q.id] || {}); all[el.getAttribute('data-r')] = codeOf(el);
        S.answers[q.id] = all; firstAnswer(q.id + '_' + el.getAttribute('data-r')); clearErr(); persist(); refresh(); flashSel(el);
        if (set('auto_advance') !== 'no') scheduleAuto(sc); break;
      case 'gtoggle':
        var all2 = Object.assign({}, S.answers[q.id] || {}), r = el.getAttribute('data-r'), cc = codeOf(el), ar = (all2[r] || []).slice();
        ar = ar.some(function (x) { return E.eq(x, cc); }) ? ar.filter(function (x) { return !E.eq(x, cc); }) : ar.concat([cc]);
        all2[r] = ar; S.answers[q.id] = all2; firstAnswer(q.id + '_' + r); clearErr(); persist(); refresh(); break;
      case 'sd':
        var o = Object.assign({}, S.answers[q.id] || {}); o[el.getAttribute('data-r')] = codeOf(el);
        S.answers[q.id] = o; firstAnswer(q.id); clearErr(); persist(); refresh(); break;
      case 'dd-open': openDropdown(q); break;
      case 'dd-pick':
        S.answers[q.id] = codeOf(el); firstAnswer(q.id); clearErr();
        if (q.other !== undefined && !E.eq(S.answers[q.id], q.other)) delete S.answers[q.id + '_other'];
        V.overlay = ''; V.dd = null; persist(); refresh(); updateNextState(); break;
      case 'overlay-close': V.overlay = ''; V.dd = null; refresh(); break;
      case 'overlay-bg': if (e.target === el) { V.overlay = ''; refresh(); } break;
      case 'later': openLater(); break;
      case 'copy-code':
        var cd = S.resume_code.slice(0, 3) + '-' + S.resume_code.slice(3);
        (navigator.clipboard ? navigator.clipboard.writeText(cd) : Promise.reject()).then(function () { toast(t('copied')); }).catch(function () { toast(cd); });
        break;
      case 'up-remove': delete V.uploads[q.id]; delete S.uploads[q.id]; delete S.answers[q.id]; persist(); refresh(); break;
      case 'up-retry': doUpload(q); refresh(); break;
      case 'vplay': toggleVideo(); break;
      case 'vmute': if (V.video) { V.video.muted = !V.video.muted; el.innerHTML = icon(V.video.muted ? 'volx' : 'vol', 18); } break;
      case 'tone': playTone(); V.toned = true; if (!S.first['sound_' + sc.q]) firstAnswer('sound_' + sc.q); refresh(); break;
      case 'hear':
        var hv = Number(el.getAttribute('data-v')); S.sound[sc.q] = hv; V.soundTries = (V.soundTries || 0) + (hv ? 0 : 1); persist();
        if (hv === 1) { V.soundSkip = false; next(); } else refresh(); break;
      case 'sound-skip': V.soundSkip = true; next(); V.soundSkip = false; break;
      case 'resubmit': submit(); break;
      case 'share': doShare(); break;
      case 'dev': V.devOpen = !V.devOpen; refreshAny(); break;
      case 'dev-bg': if (e.target === el) { V.devOpen = false; refreshAny(); } break;
      case 'dev-restart': lsDel(KEY); location.reload(); break;
    }
  });
  function refreshAny() { if (S.phase === 'end') renderEnd(); else if (S.phase === 'sending') renderSending(); else refresh(); }
  function flashSel(el) {
    var sel = el.getAttribute('data-act') === 'pick' || el.getAttribute('data-act') === 'gpick' ? root.querySelector('[data-act="' + el.getAttribute('data-act') + '"][data-v="' + el.getAttribute('data-v') + '"]' + (el.getAttribute('data-r') ? '[data-r="' + el.getAttribute('data-r') + '"]' : '')) : null;
    if (sel && (sel.classList.contains('opt') || sel.classList.contains('lbtn'))) sel.classList.add('flash');
  }
  root.addEventListener('input', function (e) {
    var el = e.target, kind = el.getAttribute('data-in'); if (!kind) return;
    var qid = el.getAttribute('data-q');
    if (kind === 'text') { S.answers[qid] = el.value; if (el.value === '') delete S.answers[qid]; firstAnswer(qid); clearErr(); persist(); updateNextState(); if (el.tagName === 'TEXTAREA') { autosize(el); var cn = document.getElementById('cnt_' + qid); if (cn) cn.textContent = el.value.length + '/' + el.getAttribute('maxlength'); } }
    else if (kind === 'other') { S.answers[qid + '_other'] = el.value; clearErr(); persist(); }
    else if (kind === 'phone') { var d = el.value.replace(/[^\d ]/g, ''); if (d !== el.value) el.value = d; S.contact = { phone: d.replace(/\s/g, '') }; firstAnswer('phone'); clearErr(); persist(); updateNextState(); }
    else if (kind === 'ddsearch') {
      V.ddq = el.value; var q = qById(V.dd); var tmp = document.createElement('div'); tmp.innerHTML = ddHtml(q);
      var nl = tmp.querySelector('#ddlist'), ol = document.getElementById('ddlist'); if (nl && ol) ol.innerHTML = nl.innerHTML; V.overlay = ddHtml(q);
    }
    else if (el.id === 'rc') { V.rc = el.value; }
  });
  root.addEventListener('change', function (e) {
    var el = e.target, kind = el.getAttribute('data-in');
    if (kind === 'file' && el.files && el.files[0]) handleFile(qById(el.getAttribute('data-q')), el.files[0]);
    if (kind === 'text' && (el.type === 'date' || el.type === 'time')) { S.answers[el.getAttribute('data-q')] = el.value; if (!el.value) delete S.answers[el.getAttribute('data-q')]; persist(); updateNextState(); }
    if (kind === 'devjump') { V.devOpen = false; endBreak(); S.history.push(S.cur); show(el.value); }
    if (kind === 'devcond') {
      V.forceCond = el.value;
      if (S.resp_id && el.value) { S.condition = el.value; persist(); V.devOpen = false; refreshAny(); toast('Condition: ' + el.value); }
      else toast('Applies when the preview starts');
    }
  });
  root.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.matches && e.target.matches('input.field[data-in="text"], input.field[data-in="phone"], input.field[data-in="other"]')) { e.preventDefault(); next(); }
    if (e.key === 'Enter' && e.target.id === 'rc') { e.preventDefault(); doResume(); }
    if (e.key === 'Escape' && V.overlay) { V.overlay = ''; refresh(); }
  });

  function doResume() {
    var code = E.normCode(V.rc || (document.getElementById('rc') || {}).value);
    if (code.length !== 6) { V.err = t('code_nf'); return render(false); }
    V.busy = true; V.err = ''; render(false);
    call({ action: 'resume', code: code }, { retries: 2 }).then(function (r) {
      V.busy = false;
      if (!r || !r.ok) { V.err = r && r.error === 'finished' ? t('code_done') : (r && r.error === 'closed' ? t('code_closed') : t('code_nf')); return render(false); }
      if (r.q) Q = r.q;
      var st = r.state || {}, ns = fresh();
      ns.lang = S.lang; ns.fs = S.fs;
      ns.resp_id = r.resp_id; ns.resume_code = r.resume_code; ns.q_version = r.q_version || Q.version;
      ns.answers = st.answers || {}; ns.condition = st.condition || ''; ns.latin = st.latin || 0; ns.src = st.src || S.src;
      ns.shown = {}; (st.shown || []).forEach(function (id) { ns.shown[id] = 1; });
      ns.timings = st.timings || {}; ns.first = st.first || {}; ns.stim = st.stim || {}; ns.sound = st.sound || {}; ns.stim_order = st.stim_order || [];
      ns.lang_switches = st.lang_switches || 0; ns.last_block = st.last_block || ''; ns.done_blocks = st.done_blocks || {}; ns.enc = st.enc || {}; ns.uploads = st.uploads || {};
      ns.orders = st.orders && st.orders.blocks ? { blocks: st.orders.blocks, items: st.orders.items || {}, options: st.options || {}, debrief: Q.blocks.filter(function (b) { return b.position === 'debrief'; }).map(function (b) { return b.id; }) } : E.makeOrders(Q, { latin: ns.latin });
      ns.history = st.history || []; ns.cur = st.cur || null; ns.phase = 'survey';
      S = ns; setupFlow();
      var cs = curScreen();
      if (!cs || !visible(cs)) { var vf = visibleFlow(); cs = vf.filter(function (s) { return s.kind === 'q' && !S.shown[s.q]; })[0] || vf[vf.length - 1]; }
      persist(true);
      show(cs.id);
    }).catch(function () { V.busy = false; V.err = t('conn'); render(false); });
  }
  function doShare() {
    var link = studyLink(), text = setL('invite') || setL('study_title');
    if (navigator.share) navigator.share({ title: setL('study_title'), text: text, url: link }).catch(function () { });
    else window.open('https://wa.me/?text=' + encodeURIComponent(text + ' ' + link), '_blank');
  }

  // expose a little for tests and the demo page
  window.SurveyApp = {
    state: function () { return S; }, questionnaire: function () { return Q; }, flow: function () { return FLOW; },
    current: function () { if (S && S.brk && S.phase === 'survey') return { phase: 'survey', screen: { id: 'break:' + S.brk.th, kind: 'break' } }; var sc = S && curScreen(); return { phase: S && S.phase, end: S && S.end, screen: sc ? { id: sc.id, kind: sc.kind, q: sc.q, row: sc.row, debrief: !!sc.debrief, type: sc.q ? qById(sc.q).type : null } : null }; }
  };

  // ------------------------------------------------------------------ on-screen keyboard
  // While the keyboard is open the page is sized to the part of the screen still visible above it, and the field being
  // typed in is scrolled to the middle of that area, so the keyboard never covers what is being typed.
  (function () {
    var vv = window.visualViewport, docEl = document.documentElement, base = 0, lastW = window.innerWidth, pend = 0;
    function isField(el) { return !!el && /^(INPUT|TEXTAREA)$/.test(el.tagName) && !/^(checkbox|radio|button|file|range|submit|image|reset)$/i.test(el.type || ''); }
    function reveal() {
      var el = document.activeElement; if (!isField(el)) return;
      var box = el.closest('.phonewrap') || el;
      try { box.scrollIntoView({ block: el.tagName === 'TEXTAREA' ? 'end' : 'center', inline: 'nearest' }); } catch (e) { }
    }
    function update() {
      pend = 0;
      var h = vv ? vv.height : window.innerHeight, top = vv ? vv.offsetTop : 0;
      if (window.innerWidth !== lastW) { lastW = window.innerWidth; base = 0; }      // rotated: measure again
      base = Math.max(base, h, window.innerHeight);
      var open = base - h > 120 && isField(document.activeElement);
      docEl.style.setProperty('--vvh', Math.round(h) + 'px'); docEl.style.setProperty('--vvt', Math.round(top) + 'px');
      document.body.classList.toggle('kb-open', open);
      if (open) reveal();
    }
    function soon() { if (!pend) pend = requestAnimationFrame(update); }
    if (vv) { vv.addEventListener('resize', soon); vv.addEventListener('scroll', soon); }
    window.addEventListener('resize', soon);
    document.addEventListener('focusin', function (e) { if (isField(e.target)) { soon(); setTimeout(update, 120); setTimeout(update, 400); } });
    document.addEventListener('focusout', function () { setTimeout(update, 150); });
    document.addEventListener('input', function (e) { if (isField(e.target) && document.body.classList.contains('kb-open')) reveal(); });
  })();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

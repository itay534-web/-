/* כל השונה הלכות - תשפ"ז | אפליקציה מקומית (ללא אינטרנט) */
(function () {
  'use strict';

  var DATA = window.HALACHOT;
  var DAYS = DATA.days;
  var N = DAYS.length;
  var DAY_MS = 86400000;
  var START = Date.UTC(DATA.start[0], DATA.start[1] - 1, DATA.start[2]); // א' תשרי תשפ"ז = 12.9.2026

  var HEB_MONTHS = [['תשרי', 30], ['מרחשון', 30], ['כסלו', 30], ['טבת', 29], ['שבט', 30], ["אדר א'", 30], ["אדר ב'", 29],
    ['ניסן', 30], ['אייר', 29], ['סיון', 30], ['תמוז', 29], ['אב', 30], ['אלול', 29]];
  var GREG_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  var WEEKDAY_LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
  // 9 מצבי הפס. במרכז (4) = התאמה אוטומטית כך שהכול נכנס בעמוד אחד
  var STEP_SCALE = [0.70, 0.78, 0.86, 0.93, 1, 1.12, 1.26, 1.42, 1.62];
  var MAX_FIT_PX = 34;   // תקרת גודל לימים קצרים
  var MIN_FIT_PX = 10;   // רצפה; אם עדיין לא נכנס - מופעלת גלילה

  function $(id) { return document.getElementById(id); }

  /* ---------- אחסון מקומי ---------- */
  function load(key, def) {
    try { var v = localStorage.getItem(key); return v === null ? def : JSON.parse(v); } catch (e) { return def; }
  }
  function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* ignore */ }
  }

  var state = {
    idx: 0,
    step: load('kh_step', 4),
    bold: load('kh_bold', false),
    read: load('kh_read', {}),
    rem: load('kh_rem', { on: false, time: '08:00' }),
    hl: null,           // ביטוי הדגשה אחרי חיפוש
    panel: null,
    calMonth: 0,
    activeDay: null     // היום (אינדקס) בזמן הפעילות האחרונה
  };
  if (typeof state.step !== 'number' || state.step < 0 || state.step > 8) state.step = 4;

  /* ---------- תאריכים ---------- */
  function rawTodayIndex() {
    var d = new Date();
    var u = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.round((u - START) / DAY_MS);
  }
  function clampIdx(i) { return Math.max(0, Math.min(N - 1, i)); }
  function dateOf(i) { return new Date(START + i * DAY_MS); }

  function hebLetters(n) {
    var ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
    var tens = ['', 'י', 'כ', 'ל'];
    if (n === 15) return 'טו';
    if (n === 16) return 'טז';
    return tens[Math.floor(n / 10)] + ones[n % 10];
  }

  var MONTH_START = [];
  (function () { var s = 0; for (var m = 0; m < HEB_MONTHS.length; m++) { MONTH_START.push(s); s += HEB_MONTHS[m][1]; } })();
  function monthOf(i) {
    for (var m = HEB_MONTHS.length - 1; m >= 0; m--) if (i >= MONTH_START[m]) return m;
    return 0;
  }

  /* ---------- עזרים ---------- */
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.hidden = true; }, 3200);
  }
  var QUOTES = /["'׳״”“’‘`]/g;
  function norm(s) { return String(s).replace(QUOTES, '').replace(/\s+/g, ' ').toLowerCase(); }

  function buildHl(tokens) {
    if (!tokens.length) return null;
    var parts = tokens.map(function (tk) {
      return tk.split('').map(function (ch) { return ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('["\'׳״”“]*');
    });
    try { return new RegExp('(' + parts.join('|') + ')', 'g'); } catch (e) { return null; }
  }
  function hlText(text) {
    if (!state.hl) return esc(text);
    var out = '', last = 0, m;
    state.hl.lastIndex = 0;
    while ((m = state.hl.exec(text)) !== null) {
      if (m[0] === '') { state.hl.lastIndex++; continue; }
      out += esc(text.slice(last, m.index)) + '<mark>' + esc(m[0]) + '</mark>';
      last = m.index + m[0].length;
    }
    return out + esc(text.slice(last));
  }

  /* ---------- תצוגת היום ---------- */
  function render() {
    var d = DAYS[state.idx];
    var head = '<span class="h">' + esc(d.h) + '</span>' + (d.s ? ' <span class="s">— ' + esc(d.s) + '</span>' : '');
    $('dateLine').innerHTML = head;

    var html = '';
    for (var i = 0; i < d.d.length; i++) html += '<p class="ded">' + hlText(d.d[i]) + '</p>';
    for (var j = 0; j < d.b.length; j++) html += '<p class="' + d.b[j][0] + '">' + hlText(d.b[j][1]) + '</p>';
    $('content').innerHTML = html;
    $('content').className = state.bold ? 'bold' : '';

    updateReadBtn();
    var t = rawTodayIndex();
    $('btnToday').className = 'tbtn' + (t === state.idx ? ' hidden' : '');
    fit();
    $('page').scrollTop = 0;
  }

  function fit() {
    var page = $('page'), c = $('content'), hd = $('dateLine');
    var scale = STEP_SCALE[state.step];
    var hpx = Math.max(14, Math.min(21, 17 * scale));
    hd.style.fontSize = hpx + 'px';
    page.className = '';
    var cs = window.getComputedStyle(page);
    var avail = page.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    if (avail <= 0) return;

    function fits(px) { c.style.fontSize = px + 'px'; return c.offsetHeight <= avail; }
    var best;
    if (fits(MAX_FIT_PX)) best = MAX_FIT_PX;
    else {
      var lo = MIN_FIT_PX, hi = MAX_FIT_PX;
      if (!fits(lo)) best = lo;
      else {
        for (var k = 0; k < 8; k++) { var mid = (lo + hi) / 2; if (fits(mid)) lo = mid; else hi = mid; }
        best = lo;
      }
    }
    var size = Math.max(8, Math.min(70, best * scale));
    c.style.fontSize = size + 'px';
    if (c.offsetHeight > avail + 1) page.className = 'scroll'; // רק כשהמשתמש הגדיל ידנית (או יום ארוך במיוחד)
  }

  function go(i, keepHl) {
    state.idx = clampIdx(i);
    if (!keepHl) state.hl = null;
    render();
  }
  function goToday() {
    var t = rawTodayIndex();
    if (t < 0) { toast('התאריך הנוכחי לפני תחילת הספר (א׳ תשרי תשפ״ז). מוצג היום הראשון.'); }
    else if (t >= N) { toast('התאריך הנוכחי אחרי סוף הספר (תשפ״ז). מוצג היום האחרון.'); }
    state.activeDay = t;
    go(clampIdx(t));
  }

  /* ---------- קראתי ---------- */
  function updateReadBtn() {
    var b = $('btnRead'), done = !!state.read[state.idx];
    b.className = done ? 'done' : '';
    b.textContent = done ? '✓ נקרא' : 'סמן כנקרא';
  }
  function toggleRead() {
    if (state.read[state.idx]) delete state.read[state.idx]; else state.read[state.idx] = 1;
    save('kh_read', state.read);
    updateReadBtn();
  }

  /* ---------- חלוניות ---------- */
  var PANELS = { display: 'panelDisplay', bell: 'panelBell', search: 'panelSearch', cal: 'panelCal' };
  function openPanel(name) {
    closePanel(true);
    state.panel = name;
    $('overlay').hidden = false;
    $(PANELS[name]).hidden = false;
    if (name === 'display') { $('chkBold').checked = state.bold; layoutSlider(); }
    if (name === 'bell') loadBellUi();
    if (name === 'search') { setTimeout(function () { $('q').focus(); }, 60); }
    if (name === 'cal') { state.calMonth = monthOf(state.idx); renderCal(); }
  }
  function closePanel(silent) {
    state.panel = null;
    $('overlay').hidden = true;
    for (var k in PANELS) $(PANELS[k]).hidden = true;
    if (!silent) { var q = $('q'); if (q) q.blur(); }
  }

  /* ---------- פס גודל כתב ---------- */
  function layoutSlider() {
    var tr = $('track');
    if (!tr.firstChild) {
      for (var i = 0; i < 9; i++) {
        var dot = document.createElement('i');
        dot.style.left = 'calc(13px + (100% - 26px) * ' + (i / 8) + ')';
        tr.appendChild(dot);
      }
    }
    $('thumb').style.left = 'calc(13px + (100% - 26px) * ' + (state.step / 8) + ')';
    $('slider').setAttribute('aria-valuenow', state.step);
  }
  function stepFromEvent(e) {
    var r = $('slider').getBoundingClientRect();
    var x = (e.clientX - r.left - 13) / Math.max(1, r.width - 26);
    return Math.max(0, Math.min(8, Math.round(x * 8)));
  }
  function setStep(s, persist) {
    if (s === state.step && !persist) return;
    state.step = s; layoutSlider(); fit();
    if (persist) save('kh_step', s);
  }
  function initSlider() {
    var sl = $('slider'), dragging = false;
    sl.addEventListener('pointerdown', function (e) {
      dragging = true;
      try { sl.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
      setStep(stepFromEvent(e), false);
      e.preventDefault();
    });
    sl.addEventListener('pointermove', function (e) { if (dragging) setStep(stepFromEvent(e), false); });
    function end() { if (dragging) { dragging = false; save('kh_step', state.step); } }
    sl.addEventListener('pointerup', end);
    sl.addEventListener('pointercancel', end);
    sl.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { setStep(Math.min(8, state.step + 1), true); e.preventDefault(); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { setStep(Math.max(0, state.step - 1), true); e.preventDefault(); }
    });
    $('chkBold').addEventListener('change', function () {
      state.bold = this.checked; save('kh_bold', state.bold); fit();
      $('content').className = state.bold ? 'bold' : '';
      fit();
    });
  }

  /* ---------- תזכורת ---------- */
  function nativeLN() {
    var C = window.Capacitor;
    return (C && C.Plugins && C.Plugins.LocalNotifications) ? C.Plugins.LocalNotifications : null;
  }
  function isNative() {
    var C = window.Capacitor;
    return !!(C && typeof C.isNativePlatform === 'function' && C.isNativePlatform());
  }
  function loadBellUi() {
    $('chkRem').checked = !!state.rem.on;
    $('remTime').value = state.rem.time || '08:00';
    $('remMsg').textContent = state.rem.on ? ('תזכורת פעילה בכל יום בשעה ' + state.rem.time + '.') : 'התזכורת כבויה.';
  }
  function remBody() { return 'הגיע הזמן ללמוד את שתי ההלכות של היום 📖'; }

  function applyReminder(showMsgs) {
    var msg = $('remMsg');
    var parts = (state.rem.time || '08:00').split(':');
    var hh = parseInt(parts[0], 10), mm = parseInt(parts[1], 10);
    var LN = nativeLN();
    if (LN && isNative()) {
      return LN.requestPermissions().then(function (p) {
        if (!p || p.display !== 'granted') {
          if (showMsgs) msg.textContent = 'לא אושרה הרשאת התראות. אפשר לאשר בהגדרות המכשיר ← אפליקציות ← כל השונה הלכות ← התראות.';
          return;
        }
        var ch = LN.createChannel ? LN.createChannel({ id: 'daily', name: 'תזכורת יומית', description: 'תזכורת ללמוד את ההלכות', importance: 4, visibility: 1, vibration: true }).catch(function () {}) : Promise.resolve();
        return ch.then(function () { return LN.cancel({ notifications: [{ id: 1 }] }).catch(function () {}); }).then(function () {
          if (!state.rem.on) { if (showMsgs) msg.textContent = 'התזכורת בוטלה.'; return; }
          return LN.schedule({
            notifications: [{
              id: 1,
              title: 'כל השונה הלכות',
              body: remBody(),
              channelId: 'daily',
              schedule: { on: { hour: hh, minute: mm }, allowWhileIdle: true }
            }]
          }).then(function () { if (showMsgs) msg.textContent = 'נשמר. תקפוץ התראה בכל יום בשעה ' + state.rem.time + '.'; });
        });
      }).catch(function (err) {
        if (showMsgs) msg.textContent = 'שגיאה בהגדרת התזכורת: ' + (err && err.message ? err.message : err);
      });
    }
    // מצב דפדפן (בדיקה בלבד): התראה תקפוץ רק כשהדף פתוח
    if (showMsgs) {
      if (!state.rem.on) { msg.textContent = 'התזכורת בוטלה.'; return Promise.resolve(); }
      if (window.Notification && Notification.permission === 'default') { try { Notification.requestPermission(); } catch (e) { /* ignore */ } }
      msg.textContent = 'נשמר. (בדפדפן התזכורת פועלת רק כשהעמוד פתוח; בהתקנה כאפליקציה בטלפון היא תקפוץ גם כשהאפליקציה סגורה.)';
    }
    return Promise.resolve();
  }
  function saveReminder() {
    state.rem = { on: $('chkRem').checked, time: $('remTime').value || '08:00' };
    save('kh_rem', state.rem);
    applyReminder(true);
  }
  // גיבוי לדפדפן בלבד
  var lastFired = '';
  setInterval(function () {
    if (isNative() || !state.rem.on) return;
    var d = new Date();
    var hm = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    var key = d.toDateString() + hm;
    if (hm === state.rem.time && key !== lastFired) {
      lastFired = key;
      if (window.Notification && Notification.permission === 'granted') { try { new Notification('כל השונה הלכות', { body: remBody() }); } catch (e) { toast(remBody()); } }
      else toast(remBody());
    }
  }, 20000);

  /* ---------- חיפוש ---------- */
  var searchIndex = null;
  function buildSearchIndex() {
    searchIndex = DAYS.map(function (d) {
      var t = [d.h, d.s].concat(d.d);
      for (var i = 0; i < d.b.length; i++) t.push(d.b[i][1]);
      return norm(t.join(' '));
    });
  }
  function doSearch() {
    var q = norm($('q').value).trim();
    var box = $('results'), info = $('qInfo');
    box.innerHTML = '';
    if (q.length < 2) { info.textContent = q.length ? 'הקלד לפחות 2 אותיות.' : ''; return; }
    if (!searchIndex) buildSearchIndex();
    var tokens = q.split(' ').filter(Boolean);
    var found = [];
    for (var i = 0; i < N; i++) {
      var txt = searchIndex[i], ok = true, first = -1;
      for (var k = 0; k < tokens.length; k++) {
        var p = txt.indexOf(tokens[k]);
        if (p < 0) { ok = false; break; }
        if (first < 0 || p < first) first = p;
      }
      if (ok) found.push([i, first]);
    }
    info.textContent = found.length ? ('נמצאו ' + found.length + ' ימים' + (found.length > 120 ? ' (מוצגים 120 הראשונים)' : '')) : 'לא נמצאו תוצאות.';
    var re = buildHl(tokens), frag = document.createDocumentFragment();
    found.slice(0, 120).forEach(function (f) {
      var txt = searchIndex[f[0]];
      var s = Math.max(0, f[1] - 40), e = Math.min(txt.length, f[1] + 110);
      var snip = (s > 0 ? '…' : '') + txt.slice(s, e) + (e < txt.length ? '…' : '');
      var h = '', last = 0, m;
      var rx = new RegExp(re.source, 'g');
      while ((m = rx.exec(snip)) !== null) {
        if (m[0] === '') { rx.lastIndex++; continue; }
        h += esc(snip.slice(last, m.index)) + '<mark>' + esc(m[0]) + '</mark>';
        last = m.index + m[0].length;
      }
      h += esc(snip.slice(last));
      var div = document.createElement('div');
      div.className = 'r';
      div.innerHTML = '<div class="rh">' + esc(DAYS[f[0]].h) + '</div><div class="rs">' + h + '</div>';
      div.addEventListener('click', function () {
        state.hl = buildHl(tokens);
        closePanel();
        go(f[0], true);
      });
      frag.appendChild(div);
    });
    box.appendChild(frag);
  }

  /* ---------- לוח שנה עברי + לועזי ---------- */
  function gregRange(m) {
    var a = dateOf(MONTH_START[m]), b = dateOf(MONTH_START[m] + HEB_MONTHS[m][1] - 1);
    var an = GREG_MONTHS[a.getUTCMonth()], bn = GREG_MONTHS[b.getUTCMonth()];
    if (a.getUTCFullYear() !== b.getUTCFullYear()) return an + ' ' + a.getUTCFullYear() + ' – ' + bn + ' ' + b.getUTCFullYear();
    if (an === bn) return an + ' ' + a.getUTCFullYear();
    return an + ' – ' + bn + ' ' + a.getUTCFullYear();
  }
  function renderCal() {
    var m = state.calMonth, len = HEB_MONTHS[m][1], s = MONTH_START[m];
    $('calMonth').textContent = HEB_MONTHS[m][0] + ' תשפ״ז';
    $('calGreg').textContent = gregRange(m);
    var grid = $('calGrid'), html = '', i;
    for (i = 0; i < 7; i++) html += '<div class="wd">' + WEEKDAY_LETTERS[i] + '</div>';
    var offset = dateOf(s).getUTCDay(); // 0=ראשון
    for (i = 0; i < offset; i++) html += '<div class="cell empty"></div>';
    var today = rawTodayIndex(), readCount = 0;
    for (i = 0; i < len; i++) {
      var idx = s + i, g = dateOf(idx), gd = g.getUTCDate();
      var cls = 'cell';
      if (state.read[idx]) { cls += ' read'; readCount++; }
      if (idx === today) cls += ' today';
      if (idx === state.idx) cls += ' cur';
      var gl = gd === 1 ? (gd + '/' + (g.getUTCMonth() + 1)) : String(gd);
      html += '<button class="' + cls + '" data-i="' + idx + '"><span class="h">' + hebLetters(i + 1) + '</span><span class="g">' + gl + '</span></button>';
    }
    grid.innerHTML = html;
    $('calStat').textContent = 'נקראו ' + readCount + ' מתוך ' + len + ' ימים בחודש זה.';
  }

  /* ---------- אירועים ---------- */
  function init() {
    $('btnPrev').addEventListener('click', function () { go(state.idx - 1); });
    $('btnNext').addEventListener('click', function () { go(state.idx + 1); });
    $('btnToday').addEventListener('click', goToday);
    $('btnRead').addEventListener('click', toggleRead);
    $('btnDisplay').addEventListener('click', function () { state.panel === 'display' ? closePanel() : openPanel('display'); });
    $('btnBell').addEventListener('click', function () { state.panel === 'bell' ? closePanel() : openPanel('bell'); });
    $('btnSearch').addEventListener('click', function () { state.panel === 'search' ? closePanel() : openPanel('search'); });
    $('btnCal').addEventListener('click', function () { state.panel === 'cal' ? closePanel() : openPanel('cal'); });
    $('overlay').addEventListener('click', function () { closePanel(); });
    $('btnRemSave').addEventListener('click', saveReminder);
    var qt; $('q').addEventListener('input', function () { clearTimeout(qt); qt = setTimeout(doSearch, 150); });
    $('calPrev').addEventListener('click', function () { if (state.calMonth > 0) { state.calMonth--; renderCal(); } });
    $('calNext').addEventListener('click', function () { if (state.calMonth < HEB_MONTHS.length - 1) { state.calMonth++; renderCal(); } });
    $('calGrid').addEventListener('click', function (e) {
      var t = e.target;
      while (t && t !== this && !(t.getAttribute && t.getAttribute('data-i'))) t = t.parentNode;
      if (t && t.getAttribute && t.getAttribute('data-i') !== null) { closePanel(); go(parseInt(t.getAttribute('data-i'), 10)); }
    });
    initSlider();

    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', function () { setTimeout(fit, 200); });
    document.addEventListener('keydown', function (e) {
      if (state.panel) { if (e.key === 'Escape') closePanel(); return; }
      if (e.key === 'ArrowRight') go(state.idx - 1);
      if (e.key === 'ArrowLeft') go(state.idx + 1);
    });

    // חזרה אוטומטית ליום הנוכחי כשהאפליקציה נפתחת מחדש ביום חדש
    function onResume() {
      var t = rawTodayIndex();
      if (t !== state.activeDay) { state.activeDay = t; go(clampIdx(t)); }
      else fit();
    }
    document.addEventListener('visibilitychange', function () { if (!document.hidden) onResume(); });
    var C = window.Capacitor;
    if (C && C.Plugins) {
      if (C.Plugins.App) {
        try {
          C.Plugins.App.addListener('backButton', function () {
            if (state.panel) closePanel();
            else if (C.Plugins.App.exitApp) C.Plugins.App.exitApp();
          });
          C.Plugins.App.addListener('appStateChange', function (s) { if (s && s.isActive) onResume(); });
        } catch (e) { /* ignore */ }
      }
      if (C.Plugins.LocalNotifications) {
        try { C.Plugins.LocalNotifications.addListener('localNotificationActionPerformed', function () { goToday(); }); } catch (e) { /* ignore */ }
      }
    }

    // פתיחה: תמיד על היום הנוכחי
    goToday();
    if (state.rem.on && isNative()) applyReminder(false); // מרענן את ההתראה המתוזמנת
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

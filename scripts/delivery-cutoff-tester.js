/*!
 * delivery-cutoff-tester.js
 * ТЕСТОВЫЙ скрипт: подмена текущего момента (даты и времени).
 *   input[name="cutoff-date"] — какой день считать сегодняшним
 *   input[name="cutoff-time"] — сколько сейчас времени
 * Подменённое время считается местным временем каждого города.
 * Отсечка при этом остаётся боевой (CONFIG.defaults.cutoffHour в delivery-date.js).
 *
 * На боевую страницу не ставить. Подключать ПОСЛЕ delivery-date.js и delivery-datepicker.js
 * Проверка в консоли: NCDM_CUTOFF_TESTER.VERSION
 */
(function () {
  'use strict';

  if (!window.NCDM_DELIVERY) {
    console.error('[cutoff-tester] Сначала подключите delivery-date.js');
    return;
  }

  var CORE = window.NCDM_DELIVERY;

  var CONFIG = {
    timeSelector: 'input[name="cutoff-time"]',
    dateSelector: 'input[name="cutoff-date"]',
    storeKeyTime: 'ncdm-cutoff-time',
    storeKeyDate: 'ncdm-cutoff-date',
    showPanel: true,

    // Обёртка вокруг тестовых полей, чтобы посетитель понимал, что это не часть заказа
    box: {
      enabled: true,
      title: 'Тестовый блок',
      subtitle: 'Подставьте любые дату и время — скрипт посчитает так, будто сейчас именно они по местному времени города. Отсечка остаётся боевой.',
      resetLabel: 'Сбросить на реальное сейчас',

      // Палитра. Нарочно нейтрально-холодная: жёлтый — фирменный цвет сайта,
      // тестовый блок не должен с ним конкурировать.
      theme: {
        background: 'rgba(0, 0, 0, 0.28)',        // затемнение поверх фона страницы
        border: 'rgba(255, 255, 255, 0.16)',
        accent: '#8ab4f8',
        text: '#e8eaed',
        muted: 'rgba(232, 234, 237, 0.62)',
        inputBg: 'rgba(255, 255, 255, 0.06)',
        inputBorder: 'rgba(255, 255, 255, 0.24)',
        panelBg: 'rgba(0, 0, 0, 0.32)',
        error: '#ff8a80'
      }
    }
  };

  var WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

  // Текущее состояние подмены
  var state = { time: null, date: null };

  /** Город для полей по умолчанию: выбранный в корзине или первый из настроек. */
  function defaultCity() {
    return CORE.getSelectedCity() || Object.keys(CORE.CONFIG.cities)[0];
  }

  // ==================== ПЕРЕХВАТ ЯДРА ====================

  /**
   * Функции ядра умеют принимать «сейчас» снаружи, а пикер зовёт их через
   * свойства объекта — поэтому подменить дату можно обёрткой, не трогая боевые файлы.
   */
  var origGetMin = CORE.getMinDeliveryDate;
  var origGetLate = CORE.getLateDeliveryDate;
  var origAllowed = CORE.isDateAllowed;
  var origIsBefore = CORE.isBeforeCutoff;

  /** «Сейчас» в городе: подменённые поля поверх реального местного времени. */
  function fakeNow(city) {
    var real = CORE.getNow(city);
    if (state.date == null && state.time == null) return real;

    return {
      date: state.date == null ? real.date : state.date,
      hour: state.time == null ? real.hour : state.time.h,
      minute: state.time == null ? real.minute : state.time.m
    };
  }

  CORE.getMinDeliveryDate = function (city, now) {
    return origGetMin(city, now || fakeNow(city));
  };

  CORE.getLateDeliveryDate = function (city, now) {
    return origGetLate(city, now || fakeNow(city));
  };

  CORE.isDateAllowed = function (city, date, now) {
    return origAllowed(city, date, now || fakeNow(city));
  };

  CORE.isBeforeCutoff = function (city, now) {
    return origIsBefore(city, now || fakeNow(city));
  };

  // ==================== ХРАНИЛИЩЕ ====================

  function load(key) {
    try { return window.sessionStorage.getItem(key); } catch (e) { return null; }
  }

  function save(key, value) {
    try {
      if (value == null) window.sessionStorage.removeItem(key);
      else window.sessionStorage.setItem(key, value);
    } catch (e) {}
  }

  // ==================== РАЗБОР ЗНАЧЕНИЙ ====================

  /** Понимает '11:00', '11.30', '9' -> { h, m } */
  function parseTime(str) {
    var m = /^\s*(\d{1,2})\s*(?:[:.\s]\s*(\d{1,2}))?\s*$/.exec(String(str == null ? '' : str));
    if (!m) return null;

    var h = +m[1];
    var min = m[2] ? +m[2] : 0;
    if (h > 23 || min > 59) return null;

    return { h: h, m: min };
  }

  /** Понимает '2026-07-31' и '31.07.2026' -> timestamp (UTC-полночь) */
  function parseDate(str) {
    if (!String(str == null ? '' : str).trim()) return null;
    var ts = CORE.toTimestamp(str);
    return isNaN(ts) ? null : ts;
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function fmtTime(t) { return pad(t.h) + ':' + pad(t.m); }

  function fmtDate(ts, input) {
    var d = new Date(ts);
    // поле type="date" понимает только ISO
    if (input && input.type === 'date') return CORE.toISO(ts);
    return pad(d.getUTCDate()) + '.' + pad(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear();
  }

  function weekdayOf(ts) { return WEEKDAYS[new Date(ts).getUTCDay()]; }

  // ==================== ПРИМЕНЕНИЕ ====================

  /**
   * Поля задают подменённое «сейчас», отсечка остаётся боевой.
   * Ядро сравнивает now.hour < cutoffHour — при целой отсечке это точно:
   * 13:59 -> 13 < 14 (до), 14:00 -> 14 < 14 неверно (после).
   */
  function applyState() {
    if (window.NCDM_DELIVERY_PICKER) window.NCDM_DELIVERY_PICKER.scan();

    renderPanel();
  }

  // ==================== ВЫДЕЛЕНИЕ ТЕСТОВОГО БЛОКА ====================

  function injectStyles() {
    if (document.getElementById('ncdm-test-box-styles')) return;

    var t = CONFIG.box.theme;
    var style = document.createElement('style');
    style.id = 'ncdm-test-box-styles';

    // !important нужен точечно: Тильда пишет цвет и рамку полей инлайном,
    // а инлайн-стиль обычным правилом не перебить. Всё ограничено .ncdm-test-box,
    // поэтому боевые поля формы не затрагиваются.
    style.textContent = [
      '.ncdm-test-box{width:100%;flex:1 1 100%;box-sizing:border-box;',
        'background:' + t.background + ';border:1px dashed ' + t.border + ';',
        'border-radius:12px;padding:18px 20px;margin:0 0 22px;}',

      '.ncdm-test-box__head{display:flex;align-items:center;justify-content:space-between;',
        'gap:12px;flex-wrap:wrap;margin-bottom:6px;}',
      '.ncdm-test-box__title{font:600 12px/1.3 inherit;letter-spacing:.08em;',
        'text-transform:uppercase;color:' + t.accent + ';}',
      '.ncdm-test-box__subtitle{font:12px/1.5 inherit;color:' + t.muted + ';margin-bottom:18px;}',
      '.ncdm-test-box__reset{border:1px solid ' + t.inputBorder + ';background:transparent;',
        'color:' + t.accent + ';font:12px/1 inherit;padding:7px 11px;border-radius:6px;',
        'cursor:pointer;white-space:nowrap;transition:background-color .15s ease;}',
      '.ncdm-test-box__reset:hover{background:rgba(255,255,255,.07);}',

      '.ncdm-test-box .t-input-group{margin-bottom:14px;}',
      '.ncdm-test-box .t-input-group:last-child{margin-bottom:0;}',

      // подписи полей и пояснения под ними
      '.ncdm-test-box .t-input-title,.ncdm-test-box .t-input-title *{',
        'color:' + t.text + ' !important;opacity:1 !important;}',
      '.ncdm-test-box .t-input-subtitle,.ncdm-test-box .t-input-subtitle *,',
      '.ncdm-test-box .t-text,.ncdm-test-box .t-text *{',
        'color:' + t.muted + ' !important;opacity:1 !important;}',

      // сами поля ввода
      '.ncdm-test-box .t-input{background-color:' + t.inputBg + ' !important;',
        'border:1px solid ' + t.inputBorder + ' !important;color:' + t.text + ' !important;',
        'box-shadow:none !important;}',
      '.ncdm-test-box .t-input:focus{border-color:' + t.accent + ' !important;}',
      '.ncdm-test-box .t-input::placeholder{color:' + t.muted + ' !important;opacity:1;}',
      '.ncdm-test-box .t-input::-webkit-input-placeholder{color:' + t.muted + ' !important;}',

      // сводка
      '.ncdm-cutoff-panel{margin-top:10px;padding:12px 14px;border-radius:8px;',
        'background:' + t.panelBg + ';border:1px solid ' + t.border + ';',
        'font:12px/1.6 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;',
        'color:' + t.text + ';white-space:pre;overflow-x:auto;}',
      '.ncdm-cutoff-panel.is-error{color:' + t.error + ';border-color:' + t.error + ';}'
    ].join('');

    document.head.appendChild(style);
  }

  function groupOf(input) {
    return input ? input.closest('.t-input-group') : null;
  }

  /** Тестовые поля + описание перед ними, в порядке DOM. */
  function collectGroups() {
    var groups = [];

    [CONFIG.dateSelector, CONFIG.timeSelector].forEach(function (sel) {
      var group = groupOf(document.querySelector(sel));
      if (group && groups.indexOf(group) === -1) groups.push(group);
    });

    if (!groups.length) return groups;

    // ставим в порядке расположения на странице
    groups.sort(function (a, b) {
      return (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1;
    });

    // подхватываем текстовые блоки-описания, идущие непосредственно перед ними
    var prev = groups[0].previousElementSibling;
    while (prev && prev.matches && prev.matches('.t-input-group[data-field-type="tx"]')) {
      groups.unshift(prev);
      prev = prev.previousElementSibling;
    }

    return groups;
  }

  function wrapTestFields() {
    if (!CONFIG.box.enabled) return;

    var groups = collectGroups();
    if (!groups.length) return;

    // уже обёрнуто — выходим (важно: функция дёргается на каждую перерисовку корзины)
    var parent = groups[0].parentNode;
    if (parent && parent.classList && parent.classList.contains('ncdm-test-box')) return;

    injectStyles();

    var box = document.createElement('div');
    box.className = 'ncdm-test-box';

    var head = document.createElement('div');
    head.className = 'ncdm-test-box__head';

    var title = document.createElement('div');
    title.className = 'ncdm-test-box__title';
    title.textContent = CONFIG.box.title;

    // type="button" обязателен: внутри формы Тильды кнопка по умолчанию сабмитит
    var resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'ncdm-test-box__reset';
    resetBtn.textContent = CONFIG.box.resetLabel;
    resetBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      reset();
    });

    head.appendChild(title);
    head.appendChild(resetBtn);

    var subtitle = document.createElement('div');
    subtitle.className = 'ncdm-test-box__subtitle';
    subtitle.textContent = CONFIG.box.subtitle;

    box.appendChild(head);
    box.appendChild(subtitle);

    groups[0].parentNode.insertBefore(box, groups[0]);
    groups.forEach(function (group) { box.appendChild(group); });
  }

  // ==================== ПАНЕЛЬ ====================

  var errors = { time: null, date: null };

  function getPanel() {
    var anchor = document.querySelector(CONFIG.timeSelector) ||
                 document.querySelector(CONFIG.dateSelector);
    if (!anchor) return null;

    var panel = anchor.parentNode.querySelector('.ncdm-cutoff-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.className = 'ncdm-cutoff-panel';
      anchor.parentNode.appendChild(panel);
    }
    return panel;
  }

  function padRight(str, len) {
    while (str.length < len) str += ' ';
    return str;
  }

  function renderPanel() {
    if (!CONFIG.showPanel) return;

    var panel = getPanel();
    if (!panel) return;

    var problems = [];
    if (errors.time) problems.push('Не понял время: «' + errors.time + '». Формат 14:00');
    if (errors.date) problems.push('Не понял дату: «' + errors.date + '». Формат 31.07.2026');

    var faked = state.date != null || state.time != null;
    var selected = CORE.getSelectedCity();

    var lines = [
      'Режим теста    : ' + (faked ? 'время подменено' : 'реальное время'),
      ''
    ];

    // По строке на город: местное время, отсечка, ближайшая доставка
    Object.keys(CORE.CONFIG.cities).forEach(function (city) {
      var cfg = CORE.getCityConfig(city);
      var now = fakeNow(city);
      var min = CORE.getMinDeliveryDate(city);

      lines.push(
        (city === selected ? '▸ ' : '  ') + padRight(city, 13) +
        ' UTC+' + cfg.utcOffset +
        '  ' + pad(now.hour) + ':' + pad(now.minute) +
        ' ' + weekdayOf(now.date) + ' ' + CORE.toISO(now.date) +
        '  ' + (CORE.isBeforeCutoff(city) ? 'до' : 'после') + ' ' + pad(cfg.cutoffHour) + ':00' +
        '  → ' + weekdayOf(min) + ' ' + CORE.toISO(min)
      );
    });

    if (problems.length) lines = problems.concat('', lines);

    panel.classList.toggle('is-error', problems.length > 0);
    panel.textContent = lines.join('\n');
  }

  // ==================== ОБНОВЛЕНИЕ ПО ПОЛЯМ ====================

  function refreshTime(persist) {
    var input = document.querySelector(CONFIG.timeSelector);
    if (!input) return;

    var raw = String(input.value || '').trim();

    if (!raw) { // пусто — работаем от реального времени
      state.time = null;
      errors.time = null;
      if (persist) save(CONFIG.storeKeyTime, null);
      applyState();
      return;
    }

    var time = parseTime(raw);
    errors.time = time ? null : raw;

    if (time) {
      state.time = time;
      if (persist) save(CONFIG.storeKeyTime, fmtTime(time));
    }

    applyState();
  }

  function refreshDate(persist) {
    var input = document.querySelector(CONFIG.dateSelector);
    if (!input) return;

    var raw = String(input.value || '').trim();

    if (!raw) { // пусто — работаем от реальной даты
      state.date = null;
      errors.date = null;
      if (persist) save(CONFIG.storeKeyDate, null);
      applyState();
      return;
    }

    var ts = parseDate(raw);
    errors.date = ts == null ? raw : null;

    if (ts != null) {
      state.date = ts;
      if (persist) save(CONFIG.storeKeyDate, CORE.toISO(ts));
    }

    applyState();
  }

  // ==================== ПРИВЯЗКА ====================

  function bindTime() {
    var input = document.querySelector(CONFIG.timeSelector);
    if (!input || input._ncdmCutoffBound) return;

    input._ncdmCutoffBound = true;
    input.autocomplete = 'off';
    if (input.type !== 'time') input.placeholder = 'Сейчас, напр. 14:00';

    if (!parseTime(input.value)) {
      var now = CORE.getNow(defaultCity());
      input.value = load(CONFIG.storeKeyTime) || (pad(now.hour) + ':' + pad(now.minute));
    }

    input.addEventListener('input', function () { refreshTime(true); });
    input.addEventListener('change', function () { refreshTime(true); });

    refreshTime(false);
  }

  function bindDate() {
    var input = document.querySelector(CONFIG.dateSelector);
    if (!input || input._ncdmCutoffBound) return;

    input._ncdmCutoffBound = true;
    input.autocomplete = 'off';
    if (input.type !== 'date') input.placeholder = 'Сегодня, напр. 31.07.2026';

    if (parseDate(input.value) == null) {
      var stored = load(CONFIG.storeKeyDate);
      input.value = fmtDate(stored ? CORE.toTimestamp(stored) : CORE.getNow(defaultCity()).date, input);
    }

    input.addEventListener('input', function () { refreshDate(true); });
    input.addEventListener('change', function () { refreshDate(true); });

    refreshDate(false);
  }

  function bind() {
    injectStyles();
    wrapTestFields();
    bindTime();
    bindDate();
  }

  /** Сброс на боевые условия: реальные дата и время */
  function reset() {
    state.time = null;
    state.date = null;
    errors.time = null;
    errors.date = null;
    save(CONFIG.storeKeyTime, null);
    save(CONFIG.storeKeyDate, null);

    var realNow = CORE.getNow(defaultCity());
    var timeInput = document.querySelector(CONFIG.timeSelector);
    if (timeInput) timeInput.value = pad(realNow.hour) + ':' + pad(realNow.minute);

    var dateInput = document.querySelector(CONFIG.dateSelector);
    if (dateInput) dateInput.value = fmtDate(realNow.date, dateInput);

    if (timeInput) refreshTime(false); else applyState();
  }

  bind();
  document.addEventListener('DOMContentLoaded', bind);
  window.addEventListener('load', bind);

  // корзина Тильды перерисовывается — перепривязываемся; заодно пересчитываем
  // дробный порог, он зависит от текущей минуты
  setInterval(function () {
    bind();
    applyState();
  }, 15000);

  // корзина Тильды перерисовывается динамически; свои же мутации пропускаем
  var rebindTimer = null;
  new MutationObserver(function (records) {
    for (var i = 0; i < records.length; i++) {
      var t = records[i].target;
      if (t.closest && t.closest('.ncdm-test-box')) continue;
      clearTimeout(rebindTimer);
      rebindTimer = setTimeout(bind, 150);
      return;
    }
  }).observe(document.documentElement, { childList: true, subtree: true });

  console.log('[cutoff-tester] активен');

  window.NCDM_CUTOFF_TESTER = {
    VERSION: 'fitbox-1.0.0',
    CONFIG: CONFIG,
    reset: reset,
    wrap: wrapTestFields,
    parseTime: parseTime,
    parseDate: parseDate,

    /** Подменить время: NCDM_CUTOFF_TESTER.set('16:45'), null — реальное */
    set: function (value) {
      var input = document.querySelector(CONFIG.timeSelector);
      if (input) { input.value = value == null ? '' : value; refreshTime(true); return; }
      state.time = value == null ? null : parseTime(value);
      applyState();
    },

    /** NCDM_CUTOFF_TESTER.setDate('31.07.2026'), без аргумента — вернуть реальную */
    setDate: function (value) {
      var input = document.querySelector(CONFIG.dateSelector);
      if (input) { input.value = value == null ? '' : value; refreshDate(true); return; }
      state.date = value == null ? null : parseDate(value);
      applyState();
    },

    /** Текущее состояние подмены */
    getState: function () {
      return {
        time: state.time ? fmtTime(state.time) : null,
        date: state.date == null ? null : CORE.toISO(state.date),
        cutoffHour: CORE.CONFIG.defaults.cutoffHour
      };
    }
  };
})();

/*!
 * delivery-cutoff-tester.js
 * ТЕСТОВЫЙ скрипт: подмена текущего момента (даты и времени).
 * Подменённое время считается местным временем каждого города.
 * Отсечка при этом остаётся боевой (CONFIG.defaults.cutoffHour в delivery-date.js).
 *
 * Тестовый блок сам встраивается в форму любой корзины Тильды (T706):
 * всплывающей и полноэкранной (двухстадийной) — перед полем даты доставки,
 * а если его нет — в начало формы. Свои поля создаются без name и в заказ не уходят.
 * Если в форме есть поля Тильды cutoff-date / cutoff-time — используются они.
 *
 * На боевую страницу не ставить. Подключать ПОСЛЕ delivery-date.js
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
    timeSelector: 'input[name="cutoff-time"], input[data-ncdm-cutoff="time"]',
    dateSelector: 'input[name="cutoff-date"], input[data-ncdm-cutoff="date"]',

    // Перед этим полем встаёт тестовый блок
    anchorSelector: 'input[name="date"], input[data-delivery-date]',
    // Формы корзины, в которые встраиваться, даже если поля даты нет
    formSelector: '.t706 form',

    storeKeyTime: 'ncdm-cutoff-time',
    storeKeyDate: 'ncdm-cutoff-date',
    showPanel: true,

    // Обёртка вокруг тестовых полей, чтобы посетитель понимал, что это не часть заказа
    box: {
      title: 'Тестовый блок',
      subtitle: 'Подставьте любые дату и время — скрипт посчитает так, будто сейчас именно они по местному времени города. Пустое поле — реальное значение. Отсечка остаётся боевой.',
      resetLabel: 'Сбросить на реальное сейчас',
      dateLabel: 'Какой день считать сегодняшним',
      timeLabel: 'Сколько сейчас времени',

      // Палитра под светлую корзину. Нарочно холодная: не путается с элементами заказа
      theme: {
        background: '#f2f6fc',
        border: '#b9c7dc',
        accent: '#1a56db',
        text: '#1f2933',
        muted: '#5b6675',
        inputBg: '#ffffff',
        inputBorder: '#b9c7dc',
        panelBg: '#ffffff',
        error: '#c62828'
      }
    }
  };

  var WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

  // Текущее состояние подмены: null — реальное значение
  var state = { time: null, date: null };
  var errors = { time: null, date: null };

  /** Город для подсказок по умолчанию: выбранный в корзине или первый из настроек. */
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

  /** Понимает '14:00', '13.30', '9' -> { h, m } */
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

  function padRight(str, len) {
    while (str.length < len) str += ' ';
    return str;
  }

  // ==================== ПРИМЕНЕНИЕ ====================

  function applyState() {
    if (window.NCDM_DELIVERY_PICKER) window.NCDM_DELIVERY_PICKER.scan();
    renderPanels();
    renderPlaceholders();
  }

  /** Значение из поля -> состояние. kind: 'time' | 'date' */
  function readInput(kind, input, persist) {
    var raw = String(input.value || '').trim();
    var storeKey = kind === 'time' ? CONFIG.storeKeyTime : CONFIG.storeKeyDate;

    if (!raw) { // пусто — работаем от реального значения
      state[kind] = null;
      errors[kind] = null;
      if (persist) save(storeKey, null);
    } else {
      var value = kind === 'time' ? parseTime(raw) : parseDate(raw);
      errors[kind] = value == null ? raw : null;

      if (value != null) {
        state[kind] = value;
        if (persist) save(storeKey, kind === 'time' ? fmtTime(value) : CORE.toISO(value));
      }
    }

    // в других корзинах на странице — то же значение
    var selector = kind === 'time' ? CONFIG.timeSelector : CONFIG.dateSelector;
    Array.prototype.forEach.call(document.querySelectorAll(selector), function (other) {
      if (other !== input) other.value = input.value;
    });

    applyState();
  }

  // ==================== СТИЛИ ====================

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
        'border-radius:12px;padding:18px 20px;margin:0 0 22px;color:' + t.text + ';}',

      '.ncdm-test-box__head{display:flex;align-items:center;justify-content:space-between;',
        'gap:12px;flex-wrap:wrap;margin-bottom:6px;}',
      '.ncdm-test-box__title{font:600 12px/1.3 inherit;letter-spacing:.08em;',
        'text-transform:uppercase;color:' + t.accent + ';}',
      '.ncdm-test-box__subtitle{font:12px/1.5 inherit;color:' + t.muted + ';margin-bottom:16px;}',
      '.ncdm-test-box__reset{border:1px solid ' + t.inputBorder + ';background:transparent;',
        'color:' + t.accent + ';font:12px/1 inherit;padding:7px 11px;border-radius:6px;',
        'cursor:pointer;white-space:nowrap;transition:background-color .15s ease;}',
      '.ncdm-test-box__reset:hover{background:rgba(26,86,219,.07);}',

      '.ncdm-test-box__fields{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px;}',
      '.ncdm-test-box__field{flex:1 1 180px;min-width:0;}',
      '.ncdm-test-box__label{display:block;font:12px/1.4 inherit;color:' + t.muted + ';margin-bottom:6px;}',

      '.ncdm-test-box .t-input-group{margin-bottom:14px;}',
      '.ncdm-test-box .t-input-title,.ncdm-test-box .t-input-title *{',
        'color:' + t.text + ' !important;opacity:1 !important;}',
      '.ncdm-test-box .t-input-subtitle,.ncdm-test-box .t-input-subtitle *{',
        'color:' + t.muted + ' !important;opacity:1 !important;}',

      // поля ввода: свои и перенесённые поля Тильды
      '.ncdm-test-box .t-input,.ncdm-test-box__input{width:100%;box-sizing:border-box;height:44px;',
        'padding:0 14px;border-radius:8px;font:14px/1 inherit;outline:none;',
        'background-color:' + t.inputBg + ' !important;border:1px solid ' + t.inputBorder + ' !important;',
        'color:' + t.text + ' !important;box-shadow:none !important;}',
      '.ncdm-test-box .t-input:focus,.ncdm-test-box__input:focus{border-color:' + t.accent + ' !important;}',
      '.ncdm-test-box .t-input::placeholder,.ncdm-test-box__input::placeholder{color:' + t.muted + ' !important;opacity:1;}',

      // сводка
      '.ncdm-cutoff-panel{padding:12px 14px;border-radius:8px;',
        'background:' + t.panelBg + ';border:1px solid ' + t.border + ';',
        'font:12px/1.6 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;',
        'color:' + t.text + ';white-space:pre;overflow-x:auto;}',
      '.ncdm-cutoff-panel.is-error{color:' + t.error + ';border-color:' + t.error + ';}'
    ].join('');

    document.head.appendChild(style);
  }

  // ==================== ПОИСК КОРЗИН ====================

  /** Все формы корзины на странице: с полем даты доставки и формы T706. */
  function findForms() {
    var forms = [];

    function add(form) {
      if (form && forms.indexOf(form) === -1) forms.push(form);
    }

    Array.prototype.forEach.call(document.querySelectorAll(CONFIG.anchorSelector), function (input) {
      add(input.closest('form'));
    });
    Array.prototype.forEach.call(document.querySelectorAll(CONFIG.formSelector), add);

    return forms;
  }

  /** Тип корзины — для сводки. */
  function cartTypeOf(form) {
    if (form.closest('.t706__cartpage')) return 'полноэкранная (двухстадийная)';
    if (form.closest('.t706__cartwin')) return 'всплывающее окно';
    return 'форма на странице';
  }

  // ==================== ТЕСТОВЫЙ БЛОК ====================

  function createField(kind) {
    var field = document.createElement('div');
    field.className = 'ncdm-test-box__field';

    var label = document.createElement('label');
    label.className = 'ncdm-test-box__label';
    label.textContent = kind === 'time' ? CONFIG.box.timeLabel : CONFIG.box.dateLabel;

    // без name: Тильда не отправит поле вместе с заказом
    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'ncdm-test-box__input';
    input.setAttribute('data-ncdm-cutoff', kind);
    input.setAttribute('inputmode', 'numeric');

    label.appendChild(input);
    field.appendChild(label);
    return field;
  }

  /** Тестовые поля Тильды + описание перед ними, в порядке DOM. */
  function collectTildaGroups(form) {
    var groups = [];

    ['input[name="cutoff-date"]', 'input[name="cutoff-time"]'].forEach(function (sel) {
      var input = form.querySelector(sel);
      var group = input ? input.closest('.t-input-group') : null;
      if (group && groups.indexOf(group) === -1) groups.push(group);
    });

    if (!groups.length) return groups;

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

  /** Куда вставить блок: перед полем даты доставки, иначе в начало полей формы. */
  function insertBox(form, box) {
    var anchor = form.querySelector(CONFIG.anchorSelector);
    var anchorGroup = anchor ? (anchor.closest('.t-input-group') || anchor) : null;

    if (anchorGroup && anchorGroup.parentNode) {
      anchorGroup.parentNode.insertBefore(box, anchorGroup);
      return;
    }

    var inputsBox = form.querySelector('.t-form__inputsbox') || form;
    inputsBox.insertBefore(box, inputsBox.firstChild);
  }

  function buildBox(form) {
    if (form.querySelector('.ncdm-test-box')) return;

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

    var tildaGroups = collectTildaGroups(form);

    // блок встаёт до переноса полей, иначе якорем может оказаться перенесённое поле
    insertBox(form, box);

    if (tildaGroups.length) {
      tildaGroups.forEach(function (group) { box.appendChild(group); });
    } else {
      var fields = document.createElement('div');
      fields.className = 'ncdm-test-box__fields';
      fields.appendChild(createField('date'));
      fields.appendChild(createField('time'));
      box.appendChild(fields);
    }

    if (CONFIG.showPanel) {
      var panel = document.createElement('div');
      panel.className = 'ncdm-cutoff-panel';
      panel._ncdmForm = form;
      box.appendChild(panel);
    }

    bindInputs(box);
  }

  function bindInputs(scope) {
    [['time', CONFIG.timeSelector], ['date', CONFIG.dateSelector]].forEach(function (pair) {
      var kind = pair[0];

      Array.prototype.forEach.call(scope.querySelectorAll(pair[1]), function (input) {
        if (input._ncdmCutoffBound) return;
        input._ncdmCutoffBound = true;
        input.autocomplete = 'off';

        // подставляем уже действующую подмену (например, после перезагрузки страницы)
        if (state[kind] != null) {
          input.value = kind === 'time' ? fmtTime(state.time) : fmtDate(state.date, input);
        } else if (!String(input.value || '').trim()) {
          input.value = '';
        }

        input.addEventListener('input', function () { readInput(kind, input, true); });
        input.addEventListener('change', function () { readInput(kind, input, true); });
      });
    });
  }

  /** Плейсхолдеры показывают реальное «сейчас» — пустое поле означает именно его. */
  function renderPlaceholders() {
    var now = CORE.getNow(defaultCity());

    Array.prototype.forEach.call(document.querySelectorAll(CONFIG.timeSelector), function (input) {
      input.placeholder = 'Сейчас: ' + pad(now.hour) + ':' + pad(now.minute) + ', формат 14:00';
    });
    Array.prototype.forEach.call(document.querySelectorAll(CONFIG.dateSelector), function (input) {
      if (input.type !== 'date') input.placeholder = 'Сегодня: ' + fmtDate(now.date) + ', формат 31.07.2026';
    });
  }

  // ==================== СВОДКА ====================

  function renderPanels() {
    var problems = [];
    if (errors.time) problems.push('Не понял время: «' + errors.time + '». Формат 14:00');
    if (errors.date) problems.push('Не понял дату: «' + errors.date + '». Формат 31.07.2026');

    var faked = state.date != null || state.time != null;

    Array.prototype.forEach.call(document.querySelectorAll('.ncdm-cutoff-panel'), function (panel) {
      var form = panel._ncdmForm || panel.closest('form') || document;
      var selected = CORE.getSelectedCity(form);

      var lines = [
        'Корзина        : ' + (form === document ? '—' : cartTypeOf(form)),
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
    });
  }

  // ==================== ЗАПУСК ====================

  function ensureBoxes() {
    findForms().forEach(buildBox);
    bindInputs(document); // поля Тильды вне блока, если блок по какой-то причине не встал
    applyState();
  }

  /** Сброс на боевые условия: реальные дата и время */
  function reset() {
    state.time = null;
    state.date = null;
    errors.time = null;
    errors.date = null;
    save(CONFIG.storeKeyTime, null);
    save(CONFIG.storeKeyDate, null);

    Array.prototype.forEach.call(
      document.querySelectorAll(CONFIG.timeSelector + ',' + CONFIG.dateSelector),
      function (input) { input.value = ''; }
    );

    applyState();
  }

  // подмена, сохранённая до перезагрузки страницы
  state.time = parseTime(load(CONFIG.storeKeyTime));
  state.date = parseDate(load(CONFIG.storeKeyDate));

  ensureBoxes();
  document.addEventListener('DOMContentLoaded', ensureBoxes);
  window.addEventListener('load', ensureBoxes);

  // реальное время идёт: обновляем сводку и плейсхолдеры
  setInterval(applyState, 15000);

  // корзина Тильды перерисовывается динамически; свои мутации и календарь пропускаем
  var rebindTimer = null;
  new MutationObserver(function (records) {
    for (var i = 0; i < records.length; i++) {
      var t = records[i].target;
      if (t.closest && (t.closest('.ncdm-test-box') || t.closest('.litepicker'))) continue;
      clearTimeout(rebindTimer);
      rebindTimer = setTimeout(function () { findForms().forEach(buildBox); }, 150);
      return;
    }
  }).observe(document.documentElement, { childList: true, subtree: true });

  console.log('[cutoff-tester] активен');

  window.NCDM_CUTOFF_TESTER = {
    VERSION: 'fitbox-1.1.0',
    CONFIG: CONFIG,
    reset: reset,
    wrap: ensureBoxes,
    parseTime: parseTime,
    parseDate: parseDate,

    /** Подменить время: NCDM_CUTOFF_TESTER.set('16:45'), null — реальное */
    set: function (value) {
      state.time = value == null ? null : parseTime(value);
      Array.prototype.forEach.call(document.querySelectorAll(CONFIG.timeSelector), function (input) {
        input.value = state.time ? fmtTime(state.time) : '';
      });
      save(CONFIG.storeKeyTime, state.time ? fmtTime(state.time) : null);
      applyState();
    },

    /** NCDM_CUTOFF_TESTER.setDate('31.07.2026'), без аргумента — вернуть реальную */
    setDate: function (value) {
      state.date = value == null ? null : parseDate(value);
      Array.prototype.forEach.call(document.querySelectorAll(CONFIG.dateSelector), function (input) {
        input.value = state.date == null ? '' : fmtDate(state.date, input);
      });
      save(CONFIG.storeKeyDate, state.date == null ? null : CORE.toISO(state.date));
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

/*!
 * delivery-datepicker.js
 *
 * Календарь выбора даты доставки для корзины Тильды — на Litepicker.
 * Требует подключённого ПЕРВЫМ delivery-date.js (window.NCDM_DELIVERY).
 *
 * В форме корзины нужно поле «Input» с именем переменной date.
 * Дата уходит в заказ как ДД.ММ.ГГГГ и сохраняется в orders.delivery_date.
 */
(function () {
  'use strict';

  if (!window.NCDM_DELIVERY) {
    console.error('[delivery-datepicker] Сначала подключите delivery-date.js');
    return;
  }

  var CORE = window.NCDM_DELIVERY;

  // ==================== НАСТРОЙКИ ====================

  var CONFIG = {
    // Litepicker сам подставляет свой CSS — отдельный файл стилей не нужен
    lib: 'https://cdn.jsdelivr.net/npm/litepicker@2.0.12/dist/litepicker.js',

    dateInput: 'input[name="date"], input[data-delivery-date]',
    form: '.t706__form, .t-form, form',
    submit: 'button[type="submit"], input[type="submit"], .t-submit',

    inline: false,           // true — календарь всегда раскрыт под полем
    gap: 6,                  // отступ всплывающего календаря от поля, px
    notifyTilda: false,      // слать ли форме событие change после выбора даты
    maxDaysAhead: 60,
    autoSelectFirst: false,
    lockWhenNoCity: true,    // блокировать submit, пока не выбран город

    placeholderEmpty: 'Сначала выберите город',
    placeholderReady: 'Выберите дату доставки',

    accent: '#111111',
    zIndex: 100000000
  };

  var DAY = 86400000;

  // ==================== ЗАГРУЗКА БИБЛИОТЕКИ ====================

  var libPromise = null;

  function loadLib() {
    if (libPromise) return libPromise;

    libPromise = new Promise(function (resolve, reject) {
      if (window.Litepicker) return resolve();

      var script = document.createElement('script');
      script.src = CONFIG.lib;
      script.onload = function () { resolve(); };
      script.onerror = function () { reject(new Error('Litepicker не загрузился')); };
      document.head.appendChild(script);
    });

    return libPromise;
  }

  function injectStyles() {
    if (document.getElementById('ncdm-cal-styles')) return;

    var style = document.createElement('style');
    style.id = 'ncdm-cal-styles';
    style.textContent = [
      // шрифт проекта даёт класс t-text (см. setup в attach)
      '.litepicker{z-index:' + CONFIG.zIndex + ' !important;',
        '--litepicker-is-start-color-bg:' + CONFIG.accent + ';',
        '--litepicker-is-end-color-bg:' + CONFIG.accent + ';',
        '--litepicker-is-today-color:' + CONFIG.accent + ';',
        '--litepicker-button-prev-month-color-hover:' + CONFIG.accent + ';',
        '--litepicker-button-next-month-color-hover:' + CONFIG.accent + ';}',
      '.litepicker .day-item.is-locked{text-decoration:line-through;opacity:.35;}',
      '.ncdm-dp-hint{font-size:12px;line-height:1.4;margin-top:6px;opacity:.65;}',
      '.ncdm-dp-input{cursor:pointer;}',
      '.ncdm-dp-input:disabled,.ncdm-dp-input[disabled]{cursor:not-allowed;}',
      '.ncdm-submit-locked{opacity:.45 !important;pointer-events:none !important;',
        'cursor:not-allowed !important;transition:opacity .2s ease;}'
    ].join('');
    document.head.appendChild(style);
  }

  // ==================== ХЕЛПЕРЫ ====================

  /** Litepicker отдаёт свой DateTime — приводим к обычному Date. */
  function toJsDate(value) {
    if (!value) return null;
    return value.toJSDate ? value.toJSDate() : value;
  }

  /** UTC-полночь -> локальный Date (Litepicker работает с локальными датами). */
  function tsToDate(ts) {
    var d = new Date(ts);
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }

  /** «2 октября» */
  function formatRu(ts) {
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric', month: 'long', timeZone: 'UTC'
    }).format(new Date(ts));
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function getForm(input) { return input.closest(CONFIG.form) || document; }
  function getCity(input) { return CORE.getSelectedCity(getForm(input)); }

  function isVisible(el) {
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  }

  function getHint(input) {
    var hint = input.parentNode.querySelector('.ncdm-dp-hint');
    if (!hint) {
      hint = document.createElement('div');
      hint.className = 'ncdm-dp-hint t-text'; // t-text — шрифт проекта Тильды
      input.parentNode.appendChild(hint);
    }
    return hint;
  }

  /**
   * До отсечки: «Закажите до 14:00 — доставим 2 октября. После 14:00 — 3 октября».
   * После отсечки: «Ближайшая доставка — 3 октября».
   */
  function getHintText(city, min) {
    var cutoff = pad(CORE.getCityConfig(city).cutoffHour) + ':00';

    if (CORE.isBeforeCutoff(city)) {
      var late = CORE.getLateDeliveryDate(city);
      if (late !== min) {
        return 'Закажите до ' + cutoff + ' — доставим ' + formatRu(min) +
          '. После ' + cutoff + ' — ' + formatRu(late) + '.';
      }
    }

    return 'Ближайшая доставка — ' + formatRu(min) + '.';
  }

  /**
   * Сообщаем Тильде о новом значении поля.
   *
   * ВАЖНО: Litepicker сам слушает 'change' на своём инпуте, чтобы разбирать
   * введённую руками дату. Диспатч 'change' из обработчика 'selected' заставляет
   * библиотеку заново эмитить 'selected' — и стек уходит в бесконечную рекурсию.
   * Флаг закрывает повторный вход, пока не отработают все синхронные обработчики.
   */
  function commit(input) {
    if (input._ncdmBusy) return;
    input._ncdmBusy = true;

    try {
      // Событие уходит на ФОРМУ, а не на инпут. Тильда его увидит (она слушает
      // всплытие), а Litepicker — нет, потому что её слушатель висит на инпуте.
      if (CONFIG.notifyTilda) {
        getForm(input).dispatchEvent(new Event('change', { bubbles: true }));
      }
    } finally {
      setTimeout(function () { input._ncdmBusy = false; }, 0);
    }

    updateSubmit(input);
  }

  // ==================== БЛОКИРОВКА SUBMIT ====================

  function isDateValid(input) {
    var city = getCity(input);
    if (!city) return !CONFIG.lockWhenNoCity;
    if (!isVisible(input)) return true;           // поле скрыто — не мешаем
    return CORE.isDateAllowed(city, input.value);
  }

  function updateSubmit(input) {
    var form = getForm(input);
    if (form === document) return;

    var valid = isDateValid(input);

    Array.prototype.forEach.call(form.querySelectorAll(CONFIG.submit), function (btn) {
      btn.classList.toggle('ncdm-submit-locked', !valid);
      if ('disabled' in btn) btn.disabled = !valid;
      btn.setAttribute('aria-disabled', String(!valid));
    });
  }

  // Тильда иногда вешает обработчик не на сам <button> — страхуемся в фазе capture
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest(CONFIG.submit);
    if (!btn || !btn.classList.contains('ncdm-submit-locked')) return;
    e.preventDefault();
    e.stopPropagation();
  }, true);

  document.addEventListener('submit', function (e) {
    var input = e.target.querySelector && e.target.querySelector(CONFIG.dateInput);
    if (input && !isDateValid(input)) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  // ==================== ИНИЦИАЛИЗАЦИЯ ПОЛЯ ====================

  function attach(input) {
    if (input._ncdmPicker) return;

    if (input.type === 'date') input.type = 'text';
    input.readOnly = true;                    // ввод только через календарь
    input.setAttribute('inputmode', 'none');  // не поднимать клавиатуру на мобильных
    input.autocomplete = 'off';
    input.classList.add('ncdm-dp-input');

    // Календарь живёт внутри блока поля, а не в body: в корзине Тильды прокручивается
    // не страница, а сама корзина, и календарь из body оставался висеть на месте
    var anchor = input.parentNode;
    if (window.getComputedStyle(anchor).position === 'static') anchor.style.position = 'relative';

    // Открытием и закрытием управляет ТОЛЬКО библиотека.
    // Свои обработчики click/focus здесь вешать нельзя: клик даёт focus,
    // и два обработчика начинают гасить друг друга — календарь моргает.
    var picker = new window.Litepicker({
      element: input,
      parentEl: CONFIG.inline ? null : anchor,
      singleMode: true,
      inlineMode: CONFIG.inline,
      format: 'DD.MM.YYYY',
      lang: 'ru-RU',
      firstDay: 1,
      numberOfMonths: 1,
      numberOfColumns: 1,
      autoApply: true,
      minDate: new Date(),

      lockDaysFilter: function (date) {
        var city = getCity(input);
        if (!city) return true;
        return !CORE.isDateAllowed(city, toJsDate(date));
      },

      setup: function (p) {
        // повторный вход отсекается внутри commit(), иначе Litepicker
        // поймает свой же 'change' и уронит стек рекурсией
        p.on('selected', function () { commit(input); });

        // у контейнеров Тильды шрифт не задан — t-text даёт шрифт проекта
        p.on('render', function (ui) { ui.classList.add('t-text'); });

        // Litepicker считает координаты от страницы даже с parentEl —
        // ставим календарь под полем относительно его блока
        p.on('show', function () {
          if (CONFIG.inline) return;
          p.ui.style.top = (input.offsetTop + input.offsetHeight + CONFIG.gap) + 'px';
          p.ui.style.left = input.offsetLeft + 'px';
        });
      }
    });

    input._ncdmPicker = picker;
    input._ncdmKey = '';
    sync(input);
  }

  /**
   * Пересчёт под текущий город и время.
   * Ключ состояния обязателен: без него setOptions() дёргался бы на каждое
   * событие страницы и пользоваться календарём было бы невозможно.
   */
  function sync(input) {
    var picker = input._ncdmPicker;
    if (!picker) return;

    var city = getCity(input);
    var min = city ? CORE.getMinDeliveryDate(city) : null;
    var key = (city || 'none') + '|' + (min ? CORE.toISO(min) : '') +
      '|' + (city && CORE.isBeforeCutoff(city) ? 'before' : 'after');

    if (key === input._ncdmKey) return;
    input._ncdmKey = key;

    var hint = getHint(input);

    if (!city) {
      // город не выбран — поле именно disabled, иначе оно ловит фокус
      // и Тильда уводит свой плавающий плейсхолдер наверх
      picker.clearSelection();
      picker.hide();
      input.value = '';
      input.disabled = true;
      input.placeholder = CONFIG.placeholderEmpty;
      hint.textContent = '';
      return;
    }

    input.disabled = false;
    input.placeholder = CONFIG.placeholderReady;

    picker.setOptions({
      minDate: tsToDate(min),
      maxDate: tsToDate(min + CONFIG.maxDaysAhead * DAY)
    });

    // ранее выбранная дата могла стать недоступной: сменили город или наступила отсечка
    var current = toJsDate(picker.getDate());
    if (current && !CORE.isDateAllowed(city, current)) {
      picker.clearSelection();
      input.value = '';
    }

    if (!picker.getDate()) {
      if (CONFIG.autoSelectFirst) picker.setDate(tsToDate(min));
      else picker.gotoDate(tsToDate(min));
    }

    hint.textContent = getHintText(city, min);
  }

  // ==================== НАБЛЮДЕНИЕ ЗА КОРЗИНОЙ ====================

  var timer = null;

  function scan() {
    clearTimeout(timer);
    timer = setTimeout(function () {
      if (!document.querySelector(CONFIG.dateInput)) return;

      loadLib().then(function () {
        injectStyles();
        Array.prototype.forEach.call(document.querySelectorAll(CONFIG.dateInput), function (input) {
          if (input._ncdmPicker) sync(input); else attach(input);
          updateSubmit(input);
        });
      })['catch'](function (e) { console.error('[delivery-datepicker]', e); });
    }, 100);
  }

  // корзина Тильды перерисовывается динамически; мутации самого календаря пропускаем
  new MutationObserver(function (records) {
    for (var i = 0; i < records.length; i++) {
      var t = records[i].target;
      if (t.closest && t.closest('.litepicker')) continue;
      scan();
      return;
    }
  }).observe(document.documentElement, { childList: true, subtree: true });

  // смена города: реагируем на change чего угодно, кроме самого поля даты
  document.addEventListener('change', function (e) {
    if (e.target.matches && e.target.matches(CONFIG.dateInput)) return;
    scan();
  }, true);

  window.addEventListener('load', scan);
  setInterval(scan, 60000); // подхватить наступление отсечки на открытой странице

  scan();

  window.NCDM_DELIVERY_PICKER = {
    VERSION: 'fitbox-1.0.2', // проверка в консоли: NCDM_DELIVERY_PICKER.VERSION
    CONFIG: CONFIG,
    scan: scan,
    updateSubmit: updateSubmit,
    isDateValid: isDateValid
  };
})();

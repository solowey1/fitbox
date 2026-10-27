/*!
 * delivery-datepicker.js
 *
 * Календарь выбора даты доставки для корзины Тильды — на Litepicker.
 * Требует подключённого ПЕРВЫМ delivery-date.js (window.NCDM_DELIVERY).
 *
 * В форме корзины нужно поле «Input» с именем переменной date.
 * Дата уходит в заказ как ДД.ММ.ГГГГ и сохраняется в orders.delivery_date.
 *
 * Скрипт подключён на всех страницах с корзиной, поэтому здесь же правило корзины
 * «каждый товар — на своей странице»:
 * - блюда «Собери своё меню» (артикул D<id>-<ГГГГММДД>) оформляются только на странице конструктора;
 * - программы питания — только на остальных страницах (не в конструкторе);
 * - товар «Доставка» (FBC-DELIVERY) ведёт delivery-cost.js по товарам страницы — он свой везде.
 * Чужие для страницы товары в корзине полупрозрачные, заказ блокируется —
 * с предупреждением, ссылкой на нужную страницу и кнопкой «Убрать из корзины».
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
    zIndex: 100000000,

    // каждый товар — на своей странице: блюда конструктора — в конструкторе, программы — вне его
    pageRules: {
      constructorPage: '#constructor.fbc',   // разметка конструктора
      constructorSku: /^D\d+(?:-\d{8})?$/i, // блюда конструктора
      deliverySku: 'FBC-DELIVERY',           // доставка (delivery-cost.js) — своя на любой странице
      cartList: '.t706__cartwin-products, .t706__sidebar-products, .t706__cartpage-products',
      cartForm: '.t706 form',
      cartContinue: '.t706__sidebar-continue, .t706__cartpage-open-form',
      // на странице конструктора нельзя оформить программы питания
      onConstructorPage: {
        url: '/',
        texts: {
          warning: 'Программы питания оформляются на странице программ, а здесь — только блюда конструктора. ' +
            'Перейдите к программам или уберите их из корзины.',
          go: 'Перейти к программам',
          remove: 'Убрать из корзины'
        }
      },
      // на остальных страницах нельзя оформить блюда конструктора
      onOtherPages: {
        url: '/constructor',
        texts: {
          warning: 'Блюда из «Собери своё меню» оформляются только на странице конструктора. ' +
            'Перейдите в конструктор или уберите их из корзины.',
          go: 'Перейти в конструктор',
          remove: 'Убрать из корзины'
        }
      }
    }
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
        'cursor:not-allowed !important;transition:opacity .2s ease;}',
      '.ncdm-cart-guard{margin:0 0 16px;padding:10px 14px;font-size:13px;line-height:1.4;',
        'color:#b3261e;background:#fdecea;border-radius:10px;}',
      '.t706 form .ncdm-cart-guard{margin:8px 0;}',
      '.ncdm-cart-guard p{margin:0;}',
      '.ncdm-cart-guard-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;}',
      '.ncdm-cart-guard-button{display:inline-block;padding:8px 16px;font:inherit;font-size:13px;',
        'font-weight:500;line-height:1.2;text-decoration:none;border:1px solid #e5383b;border-radius:20px;',
        'cursor:pointer;transition:background-color .2s ease,color .2s ease;}',
      '.ncdm-cart-guard-go{color:#fff !important;background:#e5383b;}',
      '.ncdm-cart-guard-go:hover{color:#e5383b !important;background:transparent;}',
      '.ncdm-cart-guard-remove{color:#e5383b;background:transparent;}',
      '.ncdm-cart-guard-remove:hover{color:#fff;background:#e5383b;}',
      // товар, который нельзя оформить на этой странице: полупрозрачный, удалить его можно
      '.t706__product.ncdm-cart-row-foreign{opacity:.45;transition:opacity .2s ease;}',
      '.t706__product.ncdm-cart-row-foreign .t706__product-plusminus{pointer-events:none;}'
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

    var valid = isDateValid(input) && !guard.isBlocked();

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
    var blocked = guard.isBlocked() && e.target.matches && e.target.matches(CONFIG.pageRules.cartForm);
    if (blocked || (input && !isDateValid(input))) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  // ==================== КАЖДЫЙ ТОВАР — НА СВОЕЙ СТРАНИЦЕ ====================

  var guard = (function () {
    var RULE = CONFIG.pageRules;

    function products() {
      return (window.tcart && Array.isArray(window.tcart.products)) ? window.tcart.products : [];
    }

    /** Удалённый товар Тильда 4 секунды держит с deleted: 'yes' — он уже не в корзине */
    function isInCart(product) {
      return !!product && product.deleted !== 'yes' && (parseInt(product.quantity, 10) || 0) > 0;
    }

    function isConstructorPage() {
      return !!document.querySelector(RULE.constructorPage);
    }

    /** Правила и тексты этой страницы */
    function pageRule() {
      return isConstructorPage() ? RULE.onConstructorPage : RULE.onOtherPages;
    }

    /** Товар нельзя оформить на этой странице */
    function isForeign(product) {
      if (!product || String(product.sku) === RULE.deliverySku) return false;
      var isConstructorItem = RULE.constructorSku.test(String(product.sku || ''));
      return isConstructorPage() ? !isConstructorItem : isConstructorItem;
    }

    function foreignCount() {
      return products().filter(function (product) {
        return isInCart(product) && isForeign(product);
      }).length;
    }

    function isBlocked() {
      return foreignCount() > 0;
    }

    /** Убрать чужие товары и перерисовать корзину — как это делает сама Тильда */
    function removeAll() {
      if (typeof window.tcart__syncProductsObject__LStoObj === 'function') {
        window.tcart__syncProductsObject__LStoObj();
      }
      if (!window.tcart) return;
      window.tcart.products = products().filter(function (product) {
        return !isForeign(product);
      });
      ['tcart__updateTotalProductsinCartObj', 'tcart__reDrawCartIcon', 'tcart__saveLocalObj',
        'tcart__reDrawProducts', 'tcart__reDrawTotal'].forEach(function (name) {
        if (typeof window[name] === 'function') window[name]();
      });
      check();
    }

    /** Строки корзины с чужими товарами — полупрозрачные (класс, а не style: Тильда строки перерисовывает) */
    function markRows(list) {
      var all = products();
      Array.prototype.forEach.call(list.querySelectorAll('.t706__product[data-cart-product-i]'), function (row) {
        var product = all[parseInt(row.getAttribute('data-cart-product-i'), 10)];
        row.classList.toggle('ncdm-cart-row-foreign', isInCart(product) && isForeign(product));
      });
    }

    function createWarning() {
      var box = document.createElement('div');
      box.className = 'ncdm-cart-guard t-text';

      var rule = pageRule();
      var text = document.createElement('p');
      text.textContent = rule.texts.warning;

      var actions = document.createElement('div');
      actions.className = 'ncdm-cart-guard-actions';

      var go = document.createElement('a');
      go.className = 'ncdm-cart-guard-button ncdm-cart-guard-go';
      go.href = rule.url;
      go.textContent = rule.texts.go;

      var remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'ncdm-cart-guard-button ncdm-cart-guard-remove';
      remove.textContent = rule.texts.remove;
      remove.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        removeAll();
      });

      actions.appendChild(go);
      actions.appendChild(remove);
      box.appendChild(text);
      box.appendChild(actions);
      return box;
    }

    /**
     * Вставляем, только если предупреждения ещё нет: иначе MutationObserver крутил бы scan по кругу.
     * Тексты зависят от страницы, а она за время жизни скрипта не меняется
     */
    function placeWarning(parent, before, show) {
      var current = null;
      Array.prototype.forEach.call(parent.children, function (child) {
        if (child.classList.contains('ncdm-cart-guard')) current = child;
      });
      if (!show) {
        if (current) current.remove();
        return;
      }
      if (!current) parent.insertBefore(createWarning(), before);
    }

    /**
     * «Оформить заказ» на первом шаге полноэкранной корзины. disabled снимаем только свой
     * (data-ncdm-disabled), чтобы не сбить блокировку самой Тильды — например, по минимальной сумме
     */
    function lockContinue(locked) {
      Array.prototype.forEach.call(document.querySelectorAll(RULE.cartContinue), function (btn) {
        btn.classList.toggle('ncdm-submit-locked', locked);
        if (locked) {
          if (!btn.disabled) {
            btn.disabled = true;
            btn.setAttribute('data-ncdm-disabled', '1');
          }
          btn.setAttribute('aria-disabled', 'true');
        } else if (btn.hasAttribute('data-ncdm-disabled')) {
          btn.disabled = false;
          btn.removeAttribute('data-ncdm-disabled');
          btn.removeAttribute('aria-disabled');
        }
      });
    }

    function lockSubmit(locked) {
      Array.prototype.forEach.call(document.querySelectorAll(RULE.cartForm), function (form) {
        var submit = form.querySelector(CONFIG.submit);
        if (submit) {
          var anchor = submit.closest('.t-form__submit') || submit;
          placeWarning(anchor.parentNode, anchor, locked);
        }

        // в форме с полем даты кнопку ведёт updateSubmit, он учитывает isBlocked()
        if (form.querySelector(CONFIG.dateInput)) return;
        Array.prototype.forEach.call(form.querySelectorAll(CONFIG.submit), function (btn) {
          btn.classList.toggle('ncdm-submit-locked', locked);
          if ('disabled' in btn) btn.disabled = locked;
          btn.setAttribute('aria-disabled', String(locked));
        });
      });
    }

    function check() {
      var locked = isBlocked();
      if (locked) injectStyles();

      Array.prototype.forEach.call(document.querySelectorAll(RULE.cartList), function (list) {
        placeWarning(list, list.firstChild, locked);
        markRows(list);
      });
      lockContinue(locked);
      lockSubmit(locked);
      Array.prototype.forEach.call(document.querySelectorAll(CONFIG.dateInput), updateSubmit);
    }

    return { isBlocked: isBlocked, check: check };
  })();

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

  // ==================== ПОЛЯ ФОРМЫ КОРЗИНЫ ====================

  /**
   * Ошибка Тильды: когда ширина окна пересекает 960px (поворот экрана, масштаб браузера,
   * открытые DevTools), она заново вызывает tcart__init — тот прячет все поля формы,
   * а показать их tcart__initAuthAndDelivery() уже не может: она отрабатывает один раз.
   * Корзина остаётся без полей до перезагрузки. Если поля спрятаны целиком уже после
   * инициализации, повторяем её принудительно — это вызов самой Тильды, со всеми её проверками.
   */
  var lastFieldsRestore = 0;

  function restoreFormFields() {
    if (!window.tcart_isAuthInited || typeof window.tcart__initAuthAndDelivery !== 'function') return;

    // блок способа оплаты сайт стилизует сам — его style не показатель
    var groups = document.querySelectorAll('.t706 .t-input-group:not(.t-input-group_pm)');
    if (!groups.length) return;
    for (var i = 0; i < groups.length; i++) {
      if (groups[i].style.display !== 'none') return;
    }

    // заказ только для авторизованных: поля прячет сама Тильда, так и должно быть
    var auth = window.tcartAuthState || {};
    var required = auth.lkpSettings && auth.lkpSettings.auth_required === 'required';
    if (required && !(auth.mauser && auth.mauser.token)) return;

    // пока Тильда ждёт ответа об авторизации, поля тоже скрыты — не дёргаем её чаще раза в 3 секунды
    if (Date.now() - lastFieldsRestore < 3000) return;
    lastFieldsRestore = Date.now();

    window.tcart__initAuthAndDelivery(true);
  }

  // ==================== НАБЛЮДЕНИЕ ЗА КОРЗИНОЙ ====================

  var timer = null;

  function scan() {
    clearTimeout(timer);
    timer = setTimeout(function () {
      restoreFormFields();
      guard.check();
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

  // корзину могли поменять в другой вкладке
  window.addEventListener('storage', function (e) {
    if (e.key !== 'tcart') return;
    if (typeof window.tcart__syncProductsObject__LStoObj === 'function') {
      window.tcart__syncProductsObject__LStoObj();
    }
    scan();
  });

  window.addEventListener('load', scan);
  setInterval(scan, 60000); // подхватить наступление отсечки на открытой странице

  scan();

  window.NCDM_DELIVERY_PICKER = {
    VERSION: 'fitbox-1.3.0', // проверка в консоли: NCDM_DELIVERY_PICKER.VERSION
    CONFIG: CONFIG,
    scan: scan,
    updateSubmit: updateSubmit,
    isDateValid: isDateValid,
    isCartBlocked: guard.isBlocked
  };
})();

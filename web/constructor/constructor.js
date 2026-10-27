/*!
 * constructor.js
 *
 * Конструктор «Собери своё меню» для Tilda.
 * Блюда и приёмы пищи — с бэкенда (GET /api/tilda/constructor). Блюда выбираются
 * на дни меню (все дни подряд, начиная с ближайшего дня доставки) и лежат в корзине Тильды (T706):
 * артикул D<id>-<ГГГГММДД> (день меню), опции «День», «Доставка» (ДД.ММ.ГГГГ), «Вес», «КБЖУ».
 * На день без доставки блюда привозят в ближайший предыдущий день доставки.
 *
 * Два режима:
 * - на странице есть #constructor — рисуем конструктор (только в городах из CONFIG.cities);
 * - на любой странице — работаем с корзиной: группируем блюда конструктора по датам,
 *   блокируем заказ, если выбран город без конструктора или дата доставки уже недоступна.
 *
 * Даты доставки считает delivery-date.js (window.NCDM_DELIVERY), стоимость доставки —
 * delivery-cost.js (window.FITBOX_DELIVERY: товар «Доставка», зона по адресу, строка над «Итого»);
 * если их нет на странице, скрипты подгружаются сами. Программы питания в корзине на этой
 * странице блокирует delivery-datepicker.js (правило «каждый товар — на своей странице»).
 *
 * Проверка в консоли: FITBOX_CONSTRUCTOR.VERSION, FITBOX_CONSTRUCTOR.debug()
 */
(() => {
  'use strict';

  // Второй экземпляр этой версии на странице ничего не делает.
  // Свой флаг, а не FITBOX_CONSTRUCTOR: его выставляют и старые копии скрипта.
  // По той же причине классы блокировки заказа отличаются от старых (fbc-submit-locked):
  // старая копия, вставленная на страницу, не должна снимать нашу блокировку.
  if (window.__FITBOX_CONSTRUCTOR_LOADED__) return;
  window.__FITBOX_CONSTRUCTOR_LOADED__ = true;

  // ==================== НАСТРОЙКИ ====================

  const CONFIG = {
    apiBaseUrl: 'https://app.fitbox.su/api', // можно переопределить: <div id="constructor" data-api="...">

    // Где работает конструктор — значения поля «Город» в корзине
    cities: ['Казань'],

    // Город страницы: data-city у #constructor, иначе по поддомену
    subdomains: {
      '': 'Ульяновск',
      'kzn': 'Казань',
      'smr': 'Самара',
      'tlt': 'Тольятти',
      'dmt': 'Димитровград'
    },

    containerSelector: '#constructor',
    cartFormSelector: '.t706 form',
    cartListSelector: '.t706__cartwin-products, .t706__sidebar-products, .t706__cartpage-products',
    // «Оформить заказ» на первом шаге полноэкранной корзины (дальше — форма с отправкой)
    cartContinueSelector: '.t706__sidebar-continue, .t706__cartpage-open-form',
    citySelector: 'select[name="city"]',
    dateFieldSelector: 'input[name="date"]',
    submitSelector: 'button[type="submit"], input[type="submit"], .t-submit',

    // ▼ Сколько дней подряд показывать в блоке «Выберите день», начиная с ближайшего дня доставки.
    //   Дни без доставки тоже видны: блюда на них привозят в предыдущий день доставки.
    //   Дни без меню видны, но неактивны.
    daysToShow: 7,

    // ▼ КБЖУ: в карточках, в окне блюда («На порцию» / «На 100 г»), в плашке внизу,
    //   в опциях товара в корзине и в подзаголовке страницы. false — временно скрыто
    showNutrition: false,

    // Товар «Доставка» — его ведёт delivery-cost.js (там же цена, порог бесплатной доставки и зоны)
    deliverySku: 'FBC-DELIVERY',

    // Цвета подписей о доставке
    colors: {
      text: '#121212',    // доставка в выбранный день
      earlier: '#F9982F', // доставка раньше выбранного дня
      need: '#EE4F4D',    // «До бесплатной доставки …»
      free: '#28AF0F'     // «Бесплатная доставка»
    },

    skuPrefix: 'D',
    menuCacheMinutes: 5, // как долго помнить меню по датам для проверки корзины (на сервере кэш тоже 5 минут)
    allLabel: 'Все',
    thumbnailWidth: 600, // ширина фото в карточке, px (карточка ~240 px, запас под ретину)

    // Названия опций товара в корзине Тильды (видны покупателю и в письме с заказом).
    // «Доставка» — дата ДД.ММ.ГГГГ: по ней бэкенд сохраняет дату доставки позиции
    optionLabels: {
      date: 'День',
      delivery: 'Доставка',
      legacyDate: 'Дата доставки', // так называлась опция дня в старых корзинах
      weight: 'Вес',
      nutrition: 'КБЖУ'
    },

    texts: {
      unavailable: 'Конструктор меню пока работает только в Казани.',
      empty: 'Скоро здесь появятся блюда. Загляните чуть позже.',
      noMenu: 'Меню на ближайшие дни ещё не составлено. Загляните чуть позже.',
      dayNoMenu: 'Нет меню на этот день',
      error: 'Не удалось загрузить меню.',
      noDates: 'Не удалось загрузить даты доставки.',
      retry: 'Попробовать ещё раз',
      daysTitle: 'Выберите день',
      cityLocked: 'Блюда из конструктора пока доставляем только в Казань. Выберите Казань или уберите эти блюда из корзины.',
      // блюда в корзине на дни, на которые доставка уже недоступна, или которых больше нет в меню на свой день
      unavailableDays: 'Больше нельзя выбрать блюда на следующие дни: {dates}.',
      unavailableRemove: 'Уберите следующие блюда из корзины:',
      unavailableRemoveButton: 'Убрать из корзины',
      // в корзине Тильды
      cartWarning: 'Часть блюд больше нельзя заказать на выбранные дни. Удалите их, чтобы оформить заказ.',
      cartRowUnavailable: 'Недоступно на этот день',
      cartRemoveDay: 'Удалить блюда за этот день',
      cartRemoveUnavailable: 'Удалить недоступные блюда',
      add: 'Добавить',
      dayEmpty: 'пока пусто',
      noNutrition: 'КБЖУ уточняется',
      // доставка
      deliveryOn: 'Доставка ',
      toFree: 'До бесплатной доставки {sum}',
      freeDelivery: 'Бесплатная доставка',
      // сумма для бесплатной доставки набрана, но адрес в платной зоне
      zoneOnly: 'Доставка {sum} — за зону'
    }
  };

  // ==================== УТИЛИТЫ ====================

  const formatPrice = (value) => `${Math.round(value).toLocaleString('ru-RU')} ₽`;

  const plural = (n, one, few, many) => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
    return many;
  };

  /** Элемент с классами и текстом. Данные с сервера — только через textContent. */
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  };

  const getSiteCity = () => {
    const parts = window.location.hostname.split('.');
    const subdomain = parts.length > 2 && parts[0] !== 'www' ? parts[0] : '';
    return CONFIG.subdomains[subdomain] || null;
  };

  const isCityAllowed = (city) => CONFIG.cities.indexOf(city) !== -1;

  // ---------- даты ----------

  /** 'ГГГГ-ММ-ДД' -> Date в UTC-полночь (как в delivery-date.js) */
  const isoToDate = iso => new Date(`${iso}T00:00:00Z`);

  const formatDate = (iso, options) => new Intl.DateTimeFormat('ru-RU', { timeZone: 'UTC', ...options })
    .format(isoToDate(iso));

  const capitalize = text => text.charAt(0).toUpperCase() + text.slice(1);

  /** «Пятница, 23 октября» */
  const formatDayLong = iso => capitalize(`${formatDate(iso, { weekday: 'long' })}, ${formatDate(iso, { day: 'numeric', month: 'long' })}`);

  /** «Пт, 23 октября» */
  const formatDayShort = iso => capitalize(`${formatDate(iso, { weekday: 'short' })}, ${formatDate(iso, { day: 'numeric', month: 'long' })}`);

  /** «23.10.2026» — формат поля даты в корзине */
  const formatDayField = iso => iso.split('-').reverse().join('.');

  /** «1 ноября» */
  const formatDayMonth = iso => formatDate(iso, { day: 'numeric', month: 'long' });

  const DAY_MS = 86400000;
  const addDays = (iso, n) => new Date(isoToDate(iso).getTime() + n * DAY_MS).toISOString().slice(0, 10);

  // ---------- иконка ----------

  /** Иконка truck (lucide.dev), цвет — currentColor */
  const truckIcon = (className) => {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    // размеры и линии — атрибутами, чтобы иконка не зависела от стилей страницы
    [['viewBox', '0 0 24 24'], ['width', '16'], ['height', '16'], ['fill', 'none'], ['stroke', 'currentColor'],
      ['stroke-width', '2'], ['stroke-linecap', 'round'], ['stroke-linejoin', 'round'], ['aria-hidden', 'true']]
      .forEach(([name, value]) => svg.setAttribute(name, value));
    svg.setAttribute('class', className || 'fbc-truck');
    [
      ['path', { d: 'M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2' }],
      ['path', { d: 'M15 18H9' }],
      ['path', { d: 'M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14' }],
      ['circle', { cx: '17', cy: '18', r: '2' }],
      ['circle', { cx: '7', cy: '18', r: '2' }]
    ].forEach(([tag, attrs]) => {
      const node = document.createElementNS(ns, tag);
      Object.keys(attrs).forEach(name => node.setAttribute(name, attrs[name]));
      svg.appendChild(node);
    });
    return svg;
  };

  // ---------- артикул ----------

  /** D124-20261023: блюдо 124 на 23 октября 2026 */
  const skuFor = (dish, iso) => `${CONFIG.skuPrefix}${dish.id}-${iso.replace(/-/g, '')}`;

  const parseSku = (sku) => {
    const match = new RegExp(`^${CONFIG.skuPrefix}(\\d+)(?:-(\\d{4})(\\d{2})(\\d{2}))?$`, 'i').exec(String(sku || ''));
    if (!match) return null;
    return {
      dishId: parseInt(match[1], 10),
      iso: match[2] ? `${match[2]}-${match[3]}-${match[4]}` : null
    };
  };

  // ==================== ДАТЫ ДОСТАВКИ ====================

  /**
   * Общие скрипты доставки обычно уже подключены на сайте (календарь и стоимость в корзине),
   * иначе подгружаем их с того же сервера, что и API.
   */
  const loaders = {};

  const loadShared = (apiBaseUrl, file, globalName) => {
    if (window[globalName]) return Promise.resolve(window[globalName]);
    if (loaders[file]) return loaders[file];

    loaders[file] = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `${new URL(apiBaseUrl).origin}/web/shared/${file}`;
      script.onload = () => (window[globalName] ? resolve(window[globalName]) : reject(new Error(`${globalName} не найден`)));
      script.onerror = () => {
        loaders[file] = null;
        reject(new Error(`${file} не загрузился`));
      };
      document.head.appendChild(script);
    });

    return loaders[file];
  };

  /** Ядро расчёта дат */
  const loadDeliveryCore = apiBaseUrl => loadShared(apiBaseUrl, 'delivery-date.js', 'NCDM_DELIVERY');

  /** Стоимость доставки — после ядра дат: без него она не считается */
  const loadDeliveryCost = apiBaseUrl => loadDeliveryCore(apiBaseUrl)
    .then(() => loadShared(apiBaseUrl, 'delivery-cost.js', 'FITBOX_DELIVERY'));

  /**
   * Дни в блоке «Выберите день»: все дни подряд, начиная с ближайшего дня доставки.
   * Покупатель планирует, что будет есть каждый день, а не только в дни доставки.
   */
  const getMenuDays = (core, city) => {
    const min = core.getMinDeliveryDate(city);
    if (min === null || isNaN(min)) return [];
    const first = core.toISO(min);
    return Array.from({ length: CONFIG.daysToShow }, (_, index) => addDays(first, index));
  };

  /**
   * День доставки для дня меню: сам день, если в него возим, иначе ближайший предыдущий
   * день доставки (2 ноября доставки нет — привезём 1 ноября). null — доставить уже не успеваем.
   */
  const deliveryDayFor = (core, city, iso) => {
    if (!core || !city || !iso) return null;
    const min = core.getMinDeliveryDate(city);
    if (min === null || isNaN(min)) return null;

    for (let day = iso, guard = 0; guard < 31; day = addDays(day, -1), guard++) {
      if (core.isDateAllowed(city, day)) return day;
      if (isoToDate(day).getTime() <= min) return null; // раньше ближайшей доставки искать незачем
    }
    return null;
  };

  // ==================== МЕНЮ ПО ДАТАМ ====================

  /**
   * Какие блюда продаются в какую дату (цикл меню + исключения на дату — считает сервер).
   * Нужно и конструктору, и проверке корзины на любой странице: блюдо могли убрать
   * из меню на свой день уже после того, как его положили в корзину.
   */
  const menuByDate = {
    entries: new Map(), // `${город}|${дата}` -> { ids: Set, at }
    pending: new Set(),

    key: (city, iso) => `${city}|${iso}`,

    get(city, iso) {
      const entry = this.entries.get(this.key(city, iso));
      if (!entry || Date.now() - entry.at > CONFIG.menuCacheMinutes * 60000) return null;
      return entry.ids;
    },

    remember(city, availability) {
      Object.keys(availability || {}).forEach((iso) => {
        this.entries.set(this.key(city, iso), { ids: new Set(availability[iso]), at: Date.now() });
      });
    },

    /** Загрузить меню на даты, которых нет в памяти; после загрузки — callback */
    ensure(apiBaseUrl, city, dates, callback) {
      const missing = dates.filter(iso => !this.get(city, iso) && !this.pending.has(this.key(city, iso)));
      if (!missing.length) return;

      missing.forEach(iso => this.pending.add(this.key(city, iso)));
      const query = `city=${encodeURIComponent(city)}&dates=${missing.join(',')}`;

      fetch(`${apiBaseUrl}/tilda/constructor?${query}`, { headers: { Accept: 'application/json' } })
        .then(response => (response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))))
        .then((data) => {
          this.remember(city, data.availability);
          callback();
        })
        .catch(error => console.warn('[constructor] меню по датам не загрузилось', error))
        .then(() => missing.forEach(iso => this.pending.delete(this.key(city, iso))));
    }
  };

  // ==================== КОРЗИНА ТИЛЬДЫ ====================

  /**
   * Удалённый в корзине товар Тильда 4 секунды держит с deleted: 'yes' (можно вернуть),
   * в подсчётах он уже не участвует — как и у самой Тильды
   */
  const isInCart = product => product && product.deleted !== 'yes' && (parseInt(product.quantity, 10) || 0) > 0;

  /** Товар «Доставка» — его ведёт delivery-cost.js */
  const isDeliveryProduct = product => !!product && String(product.sku) === CONFIG.deliverySku;

  /** Свои действия после функций корзины Тильды: она вызывает их по глобальному имени */
  const afterTildaCall = (name, callback) => {
    const hook = () => {
      const original = window[name];
      if (typeof original !== 'function') return false;

      // уже обёрнута этой версией — добавляем обработчик в общий список
      // (флаг старых копий _fbcHooked не учитываем: их обработчики про новые артикулы не знают)
      if (original._fbcCallbacks) {
        original._fbcCallbacks.push(callback);
        return true;
      }

      const callbacks = [callback];
      const wrapped = function () {
        const result = original.apply(this, arguments);
        callbacks.forEach(cb => cb());
        return result;
      };
      wrapped._fbcCallbacks = callbacks;
      window[name] = wrapped;
      return true;
    };

    // скрипт корзины Тильда подгружает асинхронно
    if (!hook()) {
      const timer = setInterval(() => {
        if (hook()) {
          clearInterval(timer);
          callback();
        }
      }, 300);
      setTimeout(() => clearInterval(timer), 30000);
    }
  };

  const cart = {
    isReady() {
      return !!window.tcart && typeof window.tcart__addProduct === 'function';
    },

    products() {
      return (window.tcart && Array.isArray(window.tcart.products)) ? window.tcart.products : [];
    },

    quantity(sku) {
      return this.products().reduce((sum, product) => (
        isInCart(product) && String(product.sku) === sku ? sum + parseInt(product.quantity, 10) : sum
      ), 0);
    },

    /** Блюда конструктора в корзине: { product, dishId, iso, quantity } */
    constructorItems() {
      return this.products().reduce((items, product) => {
        if (!isInCart(product)) return items;
        const parsed = parseSku(product.sku);
        if (parsed) items.push({ product, dishId: parsed.dishId, iso: parsed.iso, quantity: parseInt(product.quantity, 10) });
        return items;
      }, []);
    },

    /** Есть ли товары не из конструктора (программы питания); «Доставка» — своя */
    hasOtherProducts() {
      return this.products().some(product => isInCart(product) && !parseSku(product.sku) && !isDeliveryProduct(product));
    },

    /** Перерисовать корзину и сохранить — то же, что делает Тильда после своих изменений */
    commit() {
      ['tcart__updateTotalProductsinCartObj', 'tcart__reDrawCartIcon', 'tcart__saveLocalObj',
        'tcart__reDrawProducts', 'tcart__reDrawTotal'].forEach((name) => {
        if (typeof window[name] === 'function') window[name]();
      });
    },

    options(dish, iso) {
      const options = [{ option: CONFIG.optionLabels.date, variant: formatDayLong(iso) }];
      // дата доставки — ДД.ММ.ГГГГ: по ней бэкенд сохраняет дату доставки позиции заказа
      const delivery = deliveryDayFor(window.NCDM_DELIVERY, state.city || getSiteCity(), iso);
      if (delivery) options.push({ option: CONFIG.optionLabels.delivery, variant: formatDayField(delivery) });
      options.push({ option: CONFIG.optionLabels.weight, variant: `${dish.weight} г` });
      if (dish.nutrition && CONFIG.showNutrition) {
        const p = dish.nutrition.portion;
        options.push({
          option: CONFIG.optionLabels.nutrition,
          variant: `${p.calories} ккал, Б ${p.proteins} / Ж ${p.fats} / У ${p.carbohydrates}`
        });
      }
      return options;
    },

    add(dish, iso, quantity) {
      // Корзина с «открывать после добавления» открывалась бы на каждый «+»:
      // атрибут проверяется синхронно внутри tcart__addProduct, поэтому снимаем его на время вызова
      const cartBlock = document.querySelector('.t706');
      const openOnOrder = cartBlock && cartBlock.getAttribute('data-opencart-onorder');
      if (openOnOrder) cartBlock.removeAttribute('data-opencart-onorder');

      try {
        window.tcart__addProduct({
          name: dish.title,
          price: dish.price,
          quantity,
          sku: skuFor(dish, iso),
          img: dish.image || '',
          options: this.options(dish, iso),
          url: window.location.href.split('#')[0]
        });
      } finally {
        if (openOnOrder) cartBlock.setAttribute('data-opencart-onorder', openOnOrder);
      }

      // если корзина открыта, новое блюдо должно сразу появиться в её списке
      ['tcart__reDrawProducts', 'tcart__reDrawTotal'].forEach((name) => {
        if (typeof window[name] === 'function') window[name]();
      });
    },

    setQuantity(dish, iso, quantity) {
      if (!this.isReady()) return;

      if (typeof window.tcart__syncProductsObject__LStoObj === 'function') {
        window.tcart__syncProductsObject__LStoObj();
      }

      const sku = skuFor(dish, iso);
      const products = this.products();
      const index = products.findIndex(product => product && String(product.sku) === sku);

      if (index === -1) {
        if (quantity > 0) this.add(dish, iso, quantity);
        return;
      }

      if (quantity <= 0) {
        products.splice(index, 1);
      } else {
        const product = products[index];
        // блюдо удалили в корзине, но таймер «вернуть» ещё идёт — отменяем удаление
        if (product.deleted === 'yes') delete product.deleted;
        product.quantity = quantity;
        product.amount = typeof window.tcart__roundPrice === 'function'
          ? window.tcart__roundPrice(product.price * quantity)
          : product.price * quantity;
      }

      this.commit();
    },

    /** Убрать товары по артикулам (кнопка «Удалить блюда за этот день» в корзине) */
    remove(skus) {
      if (!this.isReady()) return;
      if (typeof window.tcart__syncProductsObject__LStoObj === 'function') {
        window.tcart__syncProductsObject__LStoObj();
      }
      const remove = new Set(skus);
      window.tcart.products = this.products().filter(product => !product || !remove.has(String(product.sku)));
      this.commit();
    },

    open() {
      if (typeof window.tcart__openCart === 'function') window.tcart__openCart();
    },

    /** Любое изменение корзины (в том числе из самой корзины Тильды) заканчивается tcart__saveLocalObj */
    onChange(callback) {
      afterTildaCall('tcart__saveLocalObj', callback);

      // изменения корзины в другой вкладке
      window.addEventListener('storage', (event) => {
        if (event.key !== 'tcart') return;
        if (typeof window.tcart__syncProductsObject__LStoObj === 'function') {
          window.tcart__syncProductsObject__LStoObj();
        }
        callback();
      });
    }
  };

  // ==================== ДОСТАВКА ====================

  /** План доставки по корзине — у delivery-cost.js; пока он не загрузился — null */
  const deliveryPlan = () => (window.FITBOX_DELIVERY ? window.FITBOX_DELIVERY.plan() : null);

  // ---------- подписи «Доставка 1 ноября», «До бесплатной доставки …» ----------

  /** В выбранный день — всё тёмным; раньше выбранного дня — иконка и дата оранжевым. Дата — полужирным */
  const deliveryOnNote = (iso, deliveryIso) => {
    const note = el('div', 'fbc-delivery-note');
    note.classList.toggle('is-earlier', deliveryIso !== iso);
    const text = el('span', 'fbc-delivery-note-text', CONFIG.texts.deliveryOn);
    text.append(el('b', 'fbc-delivery-note-date', formatDayMonth(deliveryIso)));
    note.append(truckIcon(), text);
    return note;
  };

  /** До порога — сколько осталось; порог набран — бесплатно или только надбавка за зону */
  const freeDeliveryNote = (day) => {
    let status = 'is-need';
    let text = CONFIG.texts.toFree.replace('{sum}', formatPrice(day.left));
    if (day.base === 0) {
      status = day.cost === 0 ? 'is-free' : 'is-zone';
      text = day.cost === 0 ? CONFIG.texts.freeDelivery : CONFIG.texts.zoneOnly.replace('{sum}', formatPrice(day.cost));
    }
    const note = el('div', `fbc-delivery-note ${status}`);
    note.append(truckIcon(), el('span', 'fbc-delivery-note-text', text));
    return note;
  };

  /** Стили подписей о доставке (цвета из CONFIG.colors) и подписей кнопок дней */
  const injectDeliveryStyles = () => {
    if (document.getElementById('fbc-delivery-styles')) return;
    const c = CONFIG.colors;
    const style = document.createElement('style');
    style.id = 'fbc-delivery-styles';
    style.textContent = [
      `.fbc-delivery-note{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:500;line-height:1.3;color:${c.text};}`,
      '.fbc-delivery-note .fbc-truck{flex:none;display:block;}',
      `.fbc-delivery-note.is-earlier .fbc-truck,.fbc-delivery-note.is-earlier .fbc-delivery-note-date{color:${c.earlier};}`,
      '.fbc-delivery-note-date{font-weight:700;}',
      `.fbc-delivery-note.is-need{color:${c.need};}`,
      `.fbc-delivery-note.is-free{color:${c.free};}`,
      `.fbc-delivery-note.is-zone{color:${c.text};}`,
      // под выбором дня в конструкторе
      '.fbc-days-delivery{margin-top:12px;}',
      '.fbc-days-delivery .fbc-delivery-note{font-size:14px;}',
      // под датой в корзине
      '.fbc-cart-date .fbc-delivery-note{flex-basis:100%;margin-top:4px;}',
      // кнопки дней: полные названия на десктопе, короткие — до 960 px (сетка Тильды).
      // Здесь, а не в constructor.css: стили страницы вставлены в блок на Тильде
      '.fbc-day .fbc-day-short{display:none;}',
      '@media screen and (max-width:960px){.fbc-day .fbc-day-long{display:none;}.fbc-day .fbc-day-short{display:inline;}}'
    ].join('');
    document.head.appendChild(style);
  };

  // ==================== КОРЗИНА: ГРУППЫ ПО ДАТАМ ====================

  /**
   * После каждой перерисовки корзины раскладываем блюда конструктора по датам
   * под заголовками «Пятница, 23 октября». Массив товаров Тильды не трогаем —
   * только переставляем готовые строки, у них остаются data-cart-product-i и обработчики.
   * В строке блюда прячем артикул, день и дату доставки (они в заголовке), вес остаётся,
   * КБЖУ — если не скрыто (CONFIG.showNutrition; так и у товаров, добавленных раньше).
   * Под датой — «Доставка 1 ноября» (если в этот день не возим) и «До бесплатной доставки …»
   * у первой даты каждого дня доставки. Товар «Доставка» (скрыт) — в конце списка, его ведёт delivery-cost.js.
   */
  const cartView = {
    injectStyles() {
      if (document.getElementById('fbc-cart-styles')) return;
      const style = document.createElement('style');
      style.id = 'fbc-cart-styles';
      style.textContent = [
        '.fbc-cart-date{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:4px 12px;',
        'margin:24px 0 4px;padding-bottom:8px;font-size:16px;font-weight:600;',
        'line-height:1.3;border-bottom:1px solid rgba(0,0,0,.1);}',
        '.fbc-cart-date:first-child,.fbc-cart-warning+.fbc-cart-date{margin-top:0;}',
        '.fbc-cart-date-remove{flex:none;padding:6px 12px;font:inherit;font-size:13px;font-weight:500;',
        'line-height:1.2;color:#e5383b;background:transparent;border:1px solid #e5383b;border-radius:20px;',
        'cursor:pointer;transition:background-color .2s ease,color .2s ease;}',
        '.fbc-cart-date-remove:hover{color:#fff;background:#e5383b;}',
        '.fbc-cart-warning{margin:0 0 16px;padding:10px 14px;font-size:13px;line-height:1.4;',
        'color:#b3261e;background:#fdecea;border-radius:10px;}',
        '.fbc-cart-row-note{margin-top:4px;font-size:12px;font-weight:500;color:#e5383b;}',
        // блюдо, которое уже нельзя заказать: полупрозрачное, как и чужие для страницы товары
        '.t706__product.fbc-cart-row-unavailable{opacity:.45;}',
        '.t706__product-title__option .fbc-hidden,.t706__product-title__option.fbc-hidden{display:none !important;}'
      ].join('');
      document.head.appendChild(style);
    },

    decorate() {
      const products = cart.products();
      const labels = CONFIG.optionLabels;
      const hiddenLabels = [labels.date, labels.delivery, labels.legacyDate]
        .concat(CONFIG.showNutrition ? [] : [labels.nutrition])
        .map(label => `${label}:`);
      const core = window.NCDM_DELIVERY;
      const city = getCartCity();

      // что уже нельзя заказать: пометки у блюд, кнопки у дат, предупреждение сверху
      const { unavailable } = findUnavailable(cart.constructorItems(), city, () => refreshCart());
      const unavailableSkus = new Set(unavailable.map(item => String(item.product.sku)));
      const plan = deliveryPlan();

      document.querySelectorAll(CONFIG.cartListSelector).forEach((list) => {
        list.querySelectorAll('.fbc-cart-date, .fbc-cart-warning, .fbc-cart-row-note').forEach(node => node.remove());

        const rows = Array.prototype.filter.call(list.children, row => row.classList.contains('t706__product'));
        const others = [];
        const groups = new Map();

        rows.forEach((row) => {
          const product = products[parseInt(row.getAttribute('data-cart-product-i'), 10)];
          if (isDeliveryProduct(product)) return;

          const parsed = product && parseSku(product.sku);
          if (!parsed || !parsed.iso) {
            others.push(row);
            return;
          }

          row.querySelectorAll('.t706__product-title__option').forEach((option) => {
            if (option.textContent.trim() === String(product.sku)) option.classList.add('fbc-hidden');
            option.querySelectorAll('div').forEach((line) => {
              const text = line.textContent.trim();
              if (hiddenLabels.some(label => text.indexOf(label) === 0)) line.classList.add('fbc-hidden');
            });
          });

          const isUnavailable = unavailableSkus.has(String(product.sku));
          row.classList.toggle('fbc-cart-row-unavailable', isUnavailable);
          const title = row.querySelector('.t706__product-title');
          if (isUnavailable && title) title.appendChild(el('div', 'fbc-cart-row-note', CONFIG.texts.cartRowUnavailable));

          if (!groups.has(parsed.iso)) groups.set(parsed.iso, []);
          groups.get(parsed.iso).push(row);
        });

        if (!groups.size) return;

        this.injectStyles();

        if (unavailable.length) {
          list.insertBefore(el('div', 'fbc-cart-warning t-text', CONFIG.texts.cartWarning), list.firstChild);
        }

        // остальные товары (программы) — первыми, затем дни по порядку
        others.forEach(row => list.appendChild(row));
        Array.from(groups.keys()).sort().forEach((iso) => {
          const header = el('div', 'fbc-cart-date t-name');
          header.append(el('span', null, formatDayLong(iso)));

          const dayItems = cart.constructorItems().filter(item => item.iso === iso);
          const dayUnavailable = dayItems.filter(item => unavailableSkus.has(String(item.product.sku)));
          if (dayUnavailable.length) {
            // весь день недоступен — «удалить блюда за этот день», иначе — только недоступные блюда
            const label = dayUnavailable.length === dayItems.length ? CONFIG.texts.cartRemoveDay : CONFIG.texts.cartRemoveUnavailable;
            const remove = el('button', 'fbc-cart-date-remove', label);
            remove.type = 'button';
            remove.addEventListener('click', (event) => {
              event.preventDefault();
              event.stopPropagation();
              cart.remove(dayUnavailable.map(item => String(item.product.sku)));
            });
            header.append(remove);
          }

          // «Доставка 1 ноября» и «До бесплатной доставки …» — только для дней, которые ещё можно заказать
          const deliveryIso = dayUnavailable.length === dayItems.length ? null : deliveryDayFor(core, city, iso);
          if (deliveryIso) {
            if (deliveryIso !== iso) header.append(deliveryOnNote(iso, deliveryIso));
            const day = plan && plan.byIso.get(deliveryIso);
            // у дня доставки одна сумма на все его дни меню — показываем её под первым из них
            if (day && day.menuDays[0] === iso) header.append(freeDeliveryNote(day));
          }

          list.appendChild(header);
          groups.get(iso).forEach(row => list.appendChild(row));
        });
      });

      // товар «Доставка» с заголовком — снова в конец списка
      if (window.FITBOX_DELIVERY) window.FITBOX_DELIVERY.decorateCart();
    },

    init() {
      afterTildaCall('tcart__reDrawProducts', () => this.decorate());
    }
  };

  // ==================== КОРЗИНА: ПРОВЕРКИ ПЕРЕД ЗАКАЗОМ ====================

  /**
   * - блюда конструктора можно заказать только в городах из CONFIG.cities;
   * - день доставки блюда должен быть ещё доступен (после 14:00 ближайший день уходит);
   * - если в корзине только блюда конструктора, в поле «Дата доставки» подставляем
   *   самую раннюю дату блюд (выбор покупателя не перебиваем).
   * Отправку блокируем своим классом и перехватом клика/submit — так не мешаем
   * календарю доставки, который управляет disabled у той же кнопки.
   */
  const getApiBase = () => ((state.root && state.root.getAttribute('data-api')) || CONFIG.apiBaseUrl).replace(/\/$/, '');

  /**
   * Блюда корзины, которых нет в меню на их дату. Меню на нужные даты берётся из памяти,
   * чего нет — догружается, после загрузки проверка повторяется (onLoaded).
   * Пока меню не загружено, блюдо не считается проблемным: заказ не блокируем «на всякий случай».
   */
  const notInMenuItems = (items, city, staleDates, onLoaded) => {
    const dated = items.filter(item => item.iso && staleDates.indexOf(item.iso) === -1);
    if (!dated.length || !city) return [];

    menuByDate.ensure(getApiBase(), city, Array.from(new Set(dated.map(item => item.iso))), onLoaded);

    return dated.filter((item) => {
      const ids = menuByDate.get(city, item.iso);
      return ids && !ids.has(item.dishId);
    });
  };

  /** Город заказа: поле «Город» в корзине, иначе город страницы */
  const getCartCity = () => {
    const select = document.querySelector(`${CONFIG.cartFormSelector} ${CONFIG.citySelector}`);
    return (select && select.value) || state.city || getSiteCity();
  };

  /**
   * Блюда корзины, которые уже нельзя заказать в городе:
   * stale — дни, на которые доставка недоступна (прошла отсечка);
   * notInMenu — блюда, которых нет в меню на свой день;
   * unavailable — все такие блюда вместе. onLoaded — когда догрузится меню на даты.
   * В городе без конструктора не считаем: там заказ блокируется целиком.
   */
  const findUnavailable = (items, city, onLoaded) => {
    const core = window.NCDM_DELIVERY;
    if (!isCityAllowed(city)) return { stale: [], notInMenu: [], unavailable: [] };

    // день меню, который уже не успеваем доставить (ни в сам день, ни в предыдущий день доставки)
    const stale = !core ? [] : Array.from(new Set(
      items.filter(item => item.iso && !deliveryDayFor(core, city, item.iso)).map(item => item.iso)
    )).sort();
    const notInMenu = notInMenuItems(items, city, stale, onLoaded);
    const unavailable = items.filter(item => item.iso && stale.indexOf(item.iso) !== -1).concat(notInMenu);

    return { stale, notInMenu, unavailable };
  };

  /** Корзина целиком: группы по датам и проверки (после загрузки меню, смены города и т. п.) */
  const refreshCart = () => {
    cartView.decorate();
    cartGuard.check();
  };

  /**
   * Что из корзины уже нельзя заказать: блюда на дни, на которые доставка недоступна,
   * и блюда, которых больше нет в меню на свой день. null — всё в порядке.
   */
  const unavailableSummary = (items, staleDates, notInMenu) => {
    const unavailable = items
      .filter(item => item.iso && staleDates.indexOf(item.iso) !== -1)
      .concat(notInMenu)
      .sort((a, b) => a.iso.localeCompare(b.iso));
    if (!unavailable.length) return null;

    const unique = list => list.filter((value, index) => list.indexOf(value) === index);
    return {
      dates: unique(unavailable.map(item => item.iso)),
      dishes: unique(unavailable.map(item => item.product.name)),
      skus: unique(unavailable.map(item => String(item.product.sku)))
    };
  };

  /**
   * «Больше нельзя выбрать блюда на следующие дни: …» + список блюд
   * и кнопка «Убрать из корзины» — удаляет все перечисленные блюда одним кликом
   */
  const fillUnavailable = (container, summary) => {
    const dates = summary.dates.map(iso => formatDate(iso, { day: 'numeric', month: 'long' })).join(', ');
    const list = el('ul', 'fbc-unavailable-list');
    summary.dishes.forEach(name => list.append(el('li', null, name)));

    // type="button": внутри формы корзины кнопка по умолчанию отправила бы заказ
    const removeButton = el('button', 'fbc-unavailable-button', CONFIG.texts.unavailableRemoveButton);
    removeButton.type = 'button';
    removeButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      cart.remove(summary.skus);
    });

    container.textContent = '';
    container.append(
      el('p', 'fbc-unavailable-days', CONFIG.texts.unavailableDays.replace('{dates}', dates)),
      el('p', 'fbc-unavailable-remove', CONFIG.texts.unavailableRemove),
      list,
      removeButton
    );
  };

  const cartGuard = {
    /** content: текст, функция заполнения элемента или пусто — убрать сообщение */
    setMessage(form, key, anchor, content) {
      let message = form.querySelector(`.fbc-cart-error[data-key="${key}"]`);
      if (!content) {
        if (message) message.remove();
        return;
      }
      if (!message) {
        message = el('div', 'fbc-cart-error t-text');
        message.setAttribute('data-key', key);
        anchor.parentNode.insertBefore(message, anchor.nextSibling);
      }
      if (typeof content === 'function') content(message);
      else message.textContent = content;
    },

    /**
     * Поле «Дата доставки» остаётся видимым. Если в корзине только блюда конструктора,
     * подставляем самую раннюю дату доставки блюд, но не перебиваем дату, которую покупатель выбрал сам:
     * свою подстановку помним в data-fbc-auto-date и меняем только её.
     */
    syncDateField(form, items, city) {
      const input = form.querySelector(CONFIG.dateFieldSelector);
      if (!input) return;

      const onlyConstructor = items.length > 0 && !cart.hasOtherProducts();
      const dates = items.map(item => deliveryDayFor(window.NCDM_DELIVERY, city, item.iso)).filter(Boolean).sort();
      const auto = input.getAttribute('data-fbc-auto-date');
      const value = input.value.trim();

      // Календарь доставки (Litepicker) при пересчёте переписывает поле своей выбранной датой,
      // поэтому дату ставим через него, а без календаря — прямо в поле
      const picker = input._ncdmPicker;

      if (onlyConstructor && dates.length) {
        const earliest = formatDayField(dates[0]);
        if (value && value !== auto) return;

        if (value !== earliest) {
          const [year, month, day] = dates[0].split('-').map(Number);
          if (picker) picker.setDate(new Date(year, month - 1, day));
          else input.value = earliest;
        }
        input.setAttribute('data-fbc-auto-date', earliest);
      } else if (auto) {
        // блюд конструктора не осталось — убираем свою подстановку, если её не меняли
        if (value === auto) {
          if (picker) picker.clearSelection();
          input.value = '';
        }
        input.removeAttribute('data-fbc-auto-date');
      } else {
        return;
      }

      // календарь доставки пересчитает подсказку и блокировку кнопки
      if (window.NCDM_DELIVERY_PICKER) window.NCDM_DELIVERY_PICKER.scan();
    },

    check() {
      const items = cart.constructorItems();

      document.querySelectorAll(CONFIG.cartFormSelector).forEach((form) => {
        const select = form.querySelector(CONFIG.citySelector);
        const city = select ? select.value : getSiteCity();
        const submit = form.querySelector(CONFIG.submitSelector);

        const wrongCity = items.length > 0 && !isCityAllowed(city);

        // даты, на которые доставка уже недоступна, и блюда, которых нет в меню на свой день
        const { stale, notInMenu } = findUnavailable(items, city, () => refreshCart());

        if (select) {
          const anchor = select.closest('.t-input-group') || select;
          this.setMessage(form, 'city', anchor.lastElementChild || anchor, wrongCity ? CONFIG.texts.cityLocked : '');
        }

        if (submit) {
          const anchor = submit.closest('.t-form__submit') || submit;
          const summary = unavailableSummary(items, stale, notInMenu);
          this.setMessage(form, 'unavailable', anchor.previousElementSibling || anchor,
            summary ? node => fillUnavailable(node, summary) : '');
        }

        const locked = wrongCity || stale.length > 0 || notInMenu.length > 0;
        form.querySelectorAll(CONFIG.submitSelector).forEach((button) => {
          button.classList.toggle('fbc-order-locked', locked);
        });
        form.classList.toggle('fbc-order-form-locked', locked);

        this.syncDateField(form, items, city);
      });

      this.lockContinue(findUnavailable(items, getCartCity(), () => refreshCart()).unavailable.length > 0);
    },

    /**
     * «Оформить заказ» на первом шаге корзины: пока есть недоступные блюда, не пускаем к форме.
     * disabled ставим и снимаем только свой (data-fbc-disabled), чтобы не сбить блокировку
     * самой Тильды (например, по минимальной сумме заказа).
     */
    lockContinue(locked) {
      document.querySelectorAll(CONFIG.cartContinueSelector).forEach((button) => {
        button.classList.toggle('fbc-order-locked', locked);
        if (locked) {
          if (!button.disabled) {
            button.disabled = true;
            button.setAttribute('data-fbc-disabled', '1');
          }
          button.setAttribute('aria-disabled', 'true');
        } else if (button.hasAttribute('data-fbc-disabled')) {
          button.disabled = false;
          button.removeAttribute('data-fbc-disabled');
          button.removeAttribute('aria-disabled');
        }
      });
    },

    injectStyles() {
      if (document.getElementById('fbc-guard-styles')) return;
      const style = document.createElement('style');
      style.id = 'fbc-guard-styles';
      style.textContent = [
        '.fbc-cart-error{margin:8px 0;font-size:13px;line-height:1.4;color:#e5383b;}',
        // предупреждение о недоступных блюдах — в корзине и в конструкторе
        '.fbc-cart-error p,.fbc-days-note p{margin:0;}',
        '.fbc-unavailable-remove{margin-top:6px !important;}',
        '.fbc-unavailable-list{margin:4px 0 0;padding-left:20px;list-style:disc;}',
        '.fbc-unavailable-list li{margin:2px 0;}',
        '.fbc-unavailable-button{margin-top:10px;padding:8px 16px;font:inherit;font-size:13px;font-weight:500;',
        'line-height:1.2;color:#fff;background:#e5383b;border:1px solid #e5383b;border-radius:20px;',
        'cursor:pointer;transition:background-color .2s ease,color .2s ease;}',
        '.fbc-unavailable-button:hover{color:#e5383b;background:transparent;}',
        '.fbc-order-locked{opacity:.45 !important;pointer-events:none !important;cursor:not-allowed !important;}'
      ].join('');
      document.head.appendChild(style);
    },

    init() {
      this.injectStyles();

      document.addEventListener('change', (event) => {
        if (event.target.matches && event.target.matches(CONFIG.citySelector)) this.check();
      }, true);

      document.addEventListener('click', (event) => {
        const next = event.target.closest && event.target.closest(CONFIG.cartContinueSelector);
        if (next && next.classList.contains('fbc-order-locked')) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }

        const button = event.target.closest && event.target.closest(CONFIG.submitSelector);
        if (!button) return;

        // перед проверкой формы Тильдой: заполнить скрытое поле даты, учесть отсечку
        this.check();

        if (!button.classList.contains('fbc-order-locked')) return;
        event.preventDefault();
        event.stopPropagation();
      }, true);

      document.addEventListener('submit', (event) => {
        if (!event.target.classList || !event.target.classList.contains('fbc-order-form-locked')) return;
        event.preventDefault();
        event.stopPropagation();
      }, true);

      // Тильда сама включает «Оформить заказ» (минимальная сумма и т. п.) — возвращаем нашу блокировку
      afterTildaCall('tcart__unblockSidebarContinueButton', () => this.check());

      // наступление отсечки на открытой странице
      setInterval(() => this.check(), 60000);

      this.check();
    }
  };

  // ==================== КОНСТРУКТОР ====================

  const state = {
    root: null,
    city: null,
    days: [],           // ['2026-10-23', ...] — ближайшие дни доставки
    availability: new Map(), // день -> Set(id блюд в меню этого дня)
    selectedDay: null,
    mealTypes: [],
    dishes: [],
    dishesById: new Map(),
    selectedTypes: new Set(),
    // dishId -> элементы со счётчиком этого блюда (одно блюдо бывает в нескольких разделах)
    steppers: new Map(),
    dialog: null,
    imageObserver: null
  };

  const ui = {};

  const apiUrl = () => (state.root.getAttribute('data-api') || CONFIG.apiBaseUrl).replace(/\/$/, '');

  /** Блюда и меню на дни доставки: availability — какие блюда продаются в каждый день */
  const loadData = async (days) => {
    const query = `city=${encodeURIComponent(state.city)}&dates=${days.join(',')}`;
    const response = await fetch(`${apiUrl()}/tilda/constructor?${query}`, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  };

  // ---------- изображения ----------

  /** Уменьшенная копия с CDN Тильды: оригиналы фото ~1700 px, для карточки это лишнее */
  const thumbnail = (src, width) => {
    const match = /^https:\/\/static\.tildacdn\.com\/(tild[^/]+)\/(.+)$/.exec(src || '');
    return match ? `https://thb.tildacdn.com/${match[1]}/-/resize/${width}x/${match[2]}` : src;
  };

  /** Фон ставим только после загрузки, до этого — мерцающая заглушка; миниатюра не загрузилась — берём оригинал */
  const loadImage = (image) => {
    const original = image.getAttribute('data-src');
    const show = (url) => {
      image.style.backgroundImage = `url("${url}")`;
      image.classList.add('is-loaded');
      image.removeAttribute('data-src');
    };

    const preload = new Image();
    preload.onload = () => show(preload.src);
    preload.onerror = () => {
      if (preload.src === original) return;
      preload.src = original;
    };
    preload.src = thumbnail(original, CONFIG.thumbnailWidth);
  };

  const initImageObserver = () => {
    if (!('IntersectionObserver' in window)) return null;

    return new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        loadImage(entry.target);
      });
    }, { rootMargin: '200px', threshold: 0.01 });
  };

  const lazyImage = (className, src) => {
    const image = el('span', className);
    if (!src) {
      image.classList.add('is-empty');
      return image;
    }
    image.setAttribute('data-src', src);
    if (state.imageObserver) state.imageObserver.observe(image);
    else loadImage(image);
    return image;
  };

  // ---------- счётчик +/- (на выбранный день) ----------

  const dishQuantity = dish => cart.quantity(skuFor(dish, state.selectedDay));

  const createStepper = (dish) => {
    const wrapper = el('div', 'fbc-stepper');

    const addButton = el('button', 'fbc-btn fbc-btn-add', CONFIG.texts.add);
    addButton.type = 'button';
    addButton.addEventListener('click', (event) => {
      event.stopPropagation();
      cart.setQuantity(dish, state.selectedDay, 1);
    });

    const minus = el('button', 'fbc-stepper-btn', '−');
    minus.type = 'button';
    minus.setAttribute('aria-label', `Убрать одно: ${dish.title}`);
    minus.addEventListener('click', (event) => {
      event.stopPropagation();
      cart.setQuantity(dish, state.selectedDay, dishQuantity(dish) - 1);
    });

    const count = el('span', 'fbc-stepper-count', '0');
    count.setAttribute('aria-live', 'polite');

    const plus = el('button', 'fbc-stepper-btn', '+');
    plus.type = 'button';
    plus.setAttribute('aria-label', `Добавить ещё: ${dish.title}`);
    plus.addEventListener('click', (event) => {
      event.stopPropagation();
      cart.setQuantity(dish, state.selectedDay, dishQuantity(dish) + 1);
    });

    const controls = el('div', 'fbc-stepper-controls');
    controls.append(minus, count, plus);
    wrapper.append(addButton, controls);

    // клик по счётчику (в том числе между кнопками) не должен открывать карточку блюда
    wrapper.addEventListener('click', event => event.stopPropagation());

    if (!state.steppers.has(dish.id)) state.steppers.set(dish.id, []);
    state.steppers.get(dish.id).push(wrapper);

    return wrapper;
  };

  const updateStepper = (wrapper, quantity) => {
    wrapper.classList.toggle('is-active', quantity > 0);
    wrapper.querySelector('.fbc-stepper-count').textContent = String(quantity);
  };

  // ---------- карточка ----------

  const nutritionLine = (nutrition) => {
    if (!nutrition) return CONFIG.texts.noNutrition;
    const p = nutrition.portion;
    return `${p.calories} ккал · Б ${p.proteins} · Ж ${p.fats} · У ${p.carbohydrates}`;
  };

  const createCard = (dish) => {
    const card = el('article', 'fbc-card');
    card.setAttribute('data-dish-id', dish.id);

    const open = el('button', 'fbc-card-open');
    open.type = 'button';
    open.setAttribute('aria-label', `Подробнее: ${dish.title}`);
    // внутри button допустимы только строчные элементы — заголовок оформлен span
    open.append(lazyImage('fbc-card-image', dish.image), el('span', 'fbc-card-title', dish.title));
    // окно блюда — по клику на любое место карточки (кнопка выше остаётся для клавиатуры:
    // её клик всплывает сюда же); счётчик и «Добавить» клик дальше не пускают
    card.addEventListener('click', () => openDialog(dish));

    const meta = el('div', 'fbc-card-meta', `${dish.weight} г`);

    const price = el('div', 'fbc-price');
    price.append(el('span', 'fbc-price-current', formatPrice(dish.price)));
    if (dish.oldPrice && dish.oldPrice > dish.price) {
      price.append(el('span', 'fbc-price-old', formatPrice(dish.oldPrice)));
    }

    const footer = el('div', 'fbc-card-footer');
    footer.append(price, createStepper(dish));

    card.append(open, meta);
    // КБЖУ временно скрыто: CONFIG.showNutrition
    if (CONFIG.showNutrition) card.append(el('div', 'fbc-card-nutrition', nutritionLine(dish.nutrition)));
    card.append(footer);
    return card;
  };

  // ---------- подробности блюда ----------

  const nutritionGrid = (title, values) => {
    const section = el('div', 'fbc-dialog-section');
    section.append(el('h5', 'fbc-dialog-subtitle', title));

    const grid = el('div', 'fbc-dialog-grid');
    [
      ['Калории', `${values.calories} ккал`],
      ['Белки', `${values.proteins} г`],
      ['Жиры', `${values.fats} г`],
      ['Углеводы', `${values.carbohydrates} г`]
    ].forEach(([label, value]) => {
      const item = el('div', 'fbc-dialog-grid-item');
      item.append(el('span', 'fbc-dialog-grid-label', label), el('span', 'fbc-dialog-grid-value', value));
      grid.append(item);
    });

    section.append(grid);
    return section;
  };

  const closeDialog = () => {
    if (!state.dialog) return;
    const dialog = state.dialog;
    state.dialog = null;
    // счётчик диалога больше не обновляем
    state.steppers.forEach((list, id) => {
      state.steppers.set(id, list.filter(stepper => !dialog.contains(stepper)));
    });
    if (dialog.open) dialog.close();
    dialog.remove();
  };

  const openDialog = (dish) => {
    closeDialog();

    const dialog = el('dialog', 'fbc-dialog');
    dialog.setAttribute('aria-label', dish.title);

    // крестик — SVG, а не символ «×»: у глифа своя посадка в шрифте, он стоит не по центру
    // и при повороте на ховере заметно уезжает
    const close = el('button', 'fbc-dialog-close');
    close.type = 'button';
    close.setAttribute('aria-label', 'Закрыть');
    const svgNs = 'http://www.w3.org/2000/svg';
    const cross = document.createElementNS(svgNs, 'svg');
    // размеры и линии — атрибутами: крестик верный и со старыми стилями на странице
    [['viewBox', '0 0 24 24'], ['width', '18'], ['height', '18'], ['aria-hidden', 'true'],
      ['fill', 'none'], ['stroke', 'currentColor'], ['stroke-width', '2.2'], ['stroke-linecap', 'round']]
      .forEach(([name, value]) => cross.setAttribute(name, value));
    cross.style.display = 'block';
    const crossPath = document.createElementNS(svgNs, 'path');
    crossPath.setAttribute('d', 'M6 6l12 12M18 6L6 18');
    cross.appendChild(crossPath);
    close.appendChild(cross);
    close.addEventListener('click', closeDialog);

    const body = el('div', 'fbc-dialog-body');
    if (dish.image) {
      const image = el('img', 'fbc-dialog-image');
      image.src = dish.image;
      image.alt = dish.title;
      body.append(image);
    }

    body.append(el('h3', 'fbc-dialog-title', dish.title));
    body.append(el('div', 'fbc-dialog-meta', `${dish.weight} г · ${formatDayShort(state.selectedDay)}`));

    // «На порцию» и «На 100 г» временно скрыты: CONFIG.showNutrition
    if (dish.nutrition && CONFIG.showNutrition) {
      body.append(nutritionGrid(`На порцию ${dish.weight} г`, dish.nutrition.portion));
      body.append(nutritionGrid('На 100 г', dish.nutrition.per100));
    }

    if (dish.ingredients.length) {
      const section = el('div', 'fbc-dialog-section');
      section.append(el('h5', 'fbc-dialog-subtitle', 'Состав'));
      section.append(el('p', 'fbc-dialog-ingredients', dish.ingredients.join(', ')));
      body.append(section);
    }

    const price = el('div', 'fbc-price');
    price.append(el('span', 'fbc-price-current', formatPrice(dish.price)));
    if (dish.oldPrice && dish.oldPrice > dish.price) {
      price.append(el('span', 'fbc-price-old', formatPrice(dish.oldPrice)));
    }

    const footer = el('div', 'fbc-dialog-footer');
    const stepper = createStepper(dish);
    updateStepper(stepper, dishQuantity(dish));
    footer.append(price, stepper);

    dialog.append(close, body, footer);

    // клик по подложке закрывает окно
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) closeDialog();
    });
    dialog.addEventListener('close', closeDialog);

    document.body.append(dialog);
    state.dialog = dialog;
    dialog.showModal();
  };

  // ---------- дни меню ----------

  /**
   * Блок «Выберите день» — создаём сами, чтобы не менять разметку на странице.
   * Под днями — «Доставка 1 ноября»: когда привезут блюда выбранного дня
   */
  const ensureDaysBlock = () => {
    let block = state.root.querySelector('.fbc-days');
    if (!block) {
      block = el('div', 'fbc-days');
      const choose = el('div', 'fbc-choose');
      choose.append(el('span', null, CONFIG.texts.daysTitle), el('div', 'fbc-choose-line'));
      const list = el('div', 'fbc-day-list');
      list.setAttribute('role', 'group');
      list.setAttribute('aria-label', CONFIG.texts.daysTitle);
      block.append(choose, list, el('div', 'fbc-days-note'));
      ui.filters.parentNode.insertBefore(block, ui.filters);
    }

    if (!block.querySelector('.fbc-days-delivery')) {
      const delivery = el('div', 'fbc-days-delivery');
      delivery.setAttribute('aria-live', 'polite');
      block.insertBefore(delivery, block.querySelector('.fbc-days-note'));
    }
    return block;
  };

  const renderDayDelivery = () => {
    const deliveryIso = deliveryDayFor(window.NCDM_DELIVERY, state.city, state.selectedDay);
    ui.daysDelivery.textContent = '';
    ui.daysDelivery.hidden = !deliveryIso;
    if (deliveryIso) ui.daysDelivery.append(deliveryOnNote(state.selectedDay, deliveryIso));
  };

  const dayCounts = () => cart.constructorItems().reduce((counts, item) => {
    if (item.iso) counts.set(item.iso, (counts.get(item.iso) || 0) + item.quantity);
    return counts;
  }, new Map());

  const renderDays = () => {
    ui.dayList.textContent = '';
    const counts = dayCounts();

    state.days.forEach((iso) => {
      const chip = el('button', 'fbc-day');
      chip.type = 'button';
      const isActive = iso === state.selectedDay;
      chip.classList.toggle('is-active', isActive);
      chip.setAttribute('aria-pressed', String(isActive));
      chip.setAttribute('aria-label', formatDayLong(iso));

      // «Четверг» / «29 октября» на десктопе, «Чт» / «29 окт» — на вертикальном планшете и уже
      const variants = (className, long, short) => {
        const node = el('span', className);
        node.append(el('span', 'fbc-day-long', long), el('span', 'fbc-day-short', short));
        return node;
      };
      chip.append(
        variants('fbc-day-weekday',
          capitalize(formatDate(iso, { weekday: 'long' })),
          capitalize(formatDate(iso, { weekday: 'short' }))),
        variants('fbc-day-date',
          formatDayMonth(iso),
          formatDate(iso, { day: 'numeric', month: 'short' }).replace('.', ''))
      );
      const count = counts.get(iso) || 0;
      if (count) chip.append(el('span', 'fbc-day-count', String(count)));

      // день без меню виден (чтобы было понятно, что доставка в этот день есть), но неактивен
      if (!dishesForDay(iso).length) {
        chip.disabled = true;
        chip.classList.add('is-empty');
        chip.title = CONFIG.texts.dayNoMenu;
        chip.setAttribute('aria-label', `${formatDayLong(iso)}: ${CONFIG.texts.dayNoMenu.toLowerCase()}`);
      }

      chip.addEventListener('click', () => {
        if (iso === state.selectedDay) return;
        state.selectedDay = iso;
        renderMenu();
      });
      ui.dayList.append(chip);
    });

    renderDayDelivery();

    // блюда в корзине на дни, которые уже не успеваем доставить,
    // и блюда, которых больше нет в меню на свой день
    const items = cart.constructorItems();
    const stale = Array.from(counts.keys())
      .filter(iso => !deliveryDayFor(window.NCDM_DELIVERY, state.city, iso))
      .sort();
    const notInMenu = notInMenuItems(items, state.city, stale, () => renderDays());
    const summary = unavailableSummary(items, stale, notInMenu);
    ui.daysNote.hidden = !summary;
    if (summary) fillUnavailable(ui.daysNote, summary);
    else ui.daysNote.textContent = '';
  };

  /** Блюда, которые продаются в выбранный день */
  const dishesForDay = (iso) => {
    const ids = state.availability.get(iso);
    return ids ? state.dishes.filter(dish => ids.has(dish.id)) : [];
  };

  /** Меню выбранного дня: фильтр приёмов, разделы, счётчики */
  const renderMenu = () => {
    renderChips();
    renderSections();
    applyFilter();
    syncWithCart();
  };

  // ---------- фильтр и разделы ----------

  const renderChips = () => {
    ui.chips.textContent = '';

    const makeChip = (label, count, isActive, onClick) => {
      const chip = el('button', 'fbc-chip');
      chip.type = 'button';
      chip.setAttribute('aria-pressed', String(isActive));
      chip.classList.toggle('is-active', isActive);
      chip.append(el('span', 'fbc-chip-label', label));
      if (count !== null) chip.append(el('span', 'fbc-chip-count', String(count)));
      chip.addEventListener('click', onClick);
      return chip;
    };

    ui.chips.append(makeChip(CONFIG.allLabel, null, state.selectedTypes.size === 0, () => {
      state.selectedTypes.clear();
      renderChips();
      applyFilter();
    }));

    const dishes = dishesForDay(state.selectedDay);
    state.mealTypes.forEach((type) => {
      const count = dishes.filter(dish => dish.mealTypes.indexOf(type.slug) !== -1).length;
      if (!count) return; // приёма нет в меню этого дня
      ui.chips.append(makeChip(type.title, count, state.selectedTypes.has(type.slug), () => {
        if (state.selectedTypes.has(type.slug)) state.selectedTypes.delete(type.slug);
        else state.selectedTypes.add(type.slug);
        renderChips();
        applyFilter();
      }));
    });
  };

  const renderSections = () => {
    ui.sections.textContent = '';
    state.steppers.clear();

    const dayDishes = dishesForDay(state.selectedDay);
    state.mealTypes.forEach((type) => {
      const dishes = dayDishes.filter(dish => dish.mealTypes.indexOf(type.slug) !== -1);
      if (!dishes.length) return;

      const section = el('section', 'fbc-section');
      section.setAttribute('data-meal-type', type.slug);

      const head = el('div', 'fbc-section-head');
      head.append(el('h3', 'fbc-section-title', type.title));
      head.append(el('span', 'fbc-section-count', `${dishes.length} ${plural(dishes.length, 'блюдо', 'блюда', 'блюд')}`));

      const grid = el('div', 'fbc-grid');
      dishes.forEach(dish => grid.append(createCard(dish)));

      section.append(head, grid);
      ui.sections.append(section);
    });
  };

  /** Без выбранных приёмов показываем все разделы */
  const applyFilter = () => {
    ui.sections.querySelectorAll('.fbc-section').forEach((section) => {
      const slug = section.getAttribute('data-meal-type');
      section.hidden = state.selectedTypes.size > 0 && !state.selectedTypes.has(slug);
    });
  };

  // ---------- итоговая плашка ----------

  const renderBar = () => {
    const items = cart.constructorItems();

    const summarize = list => list.reduce((acc, item) => {
      const dish = state.dishesById.get(item.dishId);
      acc.count += item.quantity;
      acc.total += dish ? dish.price * item.quantity : (parseFloat(item.product.amount) || 0);
      if (dish && dish.nutrition) {
        acc.hasNutrition = true;
        Object.keys(acc.nutrition).forEach((key) => {
          acc.nutrition[key] += dish.nutrition.portion[key] * item.quantity;
        });
      }
      return acc;
    }, { count: 0, total: 0, hasNutrition: false, nutrition: { calories: 0, proteins: 0, fats: 0, carbohydrates: 0 } });

    const all = summarize(items);
    const day = summarize(items.filter(item => item.iso === state.selectedDay));
    const daysWithDishes = new Set(items.map(item => item.iso)).size;

    ui.bar.hidden = all.count === 0;
    if (!all.count) return;

    const dayTitle = formatDayShort(state.selectedDay);
    ui.barCount.textContent = day.count
      ? `${dayTitle}: ${day.count} ${plural(day.count, 'блюдо', 'блюда', 'блюд')}`
      : `${dayTitle}: ${CONFIG.texts.dayEmpty}`;
    ui.barTotal.textContent = day.count ? formatPrice(day.total) : '';

    const n = day.nutrition;
    ui.barNutrition.textContent = day.hasNutrition
      ? `${Math.round(n.calories)} ккал · Б ${Math.round(n.proteins)} · Ж ${Math.round(n.fats)} · У ${Math.round(n.carbohydrates)}`
      : '';

    // итог по всем дням — если выбрано больше одного дня или текущий пуст
    const showAll = daysWithDishes > 1 || !day.count;
    ui.barAll.hidden = !showAll;
    ui.barAll.textContent = showAll
      ? `Всего: ${all.count} ${plural(all.count, 'блюдо', 'блюда', 'блюд')} на ${daysWithDishes} ${plural(daysWithDishes, 'день', 'дня', 'дней')} · ${formatPrice(all.total)}`
      : '';
  };

  /** Счётчики на карточках, дни и плашка — из корзины Тильды */
  const syncWithCart = () => {
    if (!ui.bar || !state.selectedDay) return; // на странице нет конструктора или он ещё не загружен

    state.steppers.forEach((list, dishId) => {
      const dish = state.dishesById.get(dishId);
      const quantity = dish ? dishQuantity(dish) : 0;
      list.forEach(stepper => updateStepper(stepper, quantity));
    });
    renderDays();
    renderBar();
  };

  // ---------- состояния ----------

  const showStatus = (text, withRetry) => {
    ui.status.textContent = '';
    ui.status.hidden = false;

    if (text === null) {
      ui.status.append(el('span', 'fbc-loader'));
      return;
    }

    ui.status.append(el('p', 'fbc-status-text', text));
    if (withRetry) {
      const retry = el('button', 'fbc-btn fbc-btn-outline', CONFIG.texts.retry);
      retry.type = 'button';
      retry.addEventListener('click', start);
      ui.status.append(retry);
    }
  };

  const buildLayout = () => {
    const root = state.root;
    ui.filters = root.querySelector('.fbc-filters');
    ui.chips = root.querySelector('.fbc-chips');
    ui.sections = root.querySelector('.fbc-sections');
    ui.status = root.querySelector('.fbc-status');
    ui.bar = root.querySelector('.fbc-bar');
    ui.barCount = root.querySelector('.fbc-bar-count');
    ui.barTotal = root.querySelector('.fbc-bar-total');
    ui.barNutrition = root.querySelector('.fbc-bar-nutrition');
    ui.barButton = root.querySelector('.fbc-bar-button');

    // КБЖУ временно скрыто: CONFIG.showNutrition (разметку на странице не трогаем)
    if (!CONFIG.showNutrition) {
      ui.barNutrition.hidden = true;
      root.querySelectorAll('.fbc-subtitle').forEach((subtitle) => { subtitle.hidden = true; });
    }

    // строка «Всего: …» — создаём сами, чтобы не менять разметку на странице
    ui.barAll = root.querySelector('.fbc-bar-all');
    if (!ui.barAll) {
      ui.barAll = el('div', 'fbc-bar-all');
      ui.barNutrition.parentNode.appendChild(ui.barAll);
    }

    const days = ensureDaysBlock();
    ui.days = days;
    ui.dayList = days.querySelector('.fbc-day-list');
    ui.daysDelivery = days.querySelector('.fbc-days-delivery');
    ui.daysNote = days.querySelector('.fbc-days-note');

    ui.barButton.addEventListener('click', () => cart.open());
  };

  async function start() {
    showStatus(null);
    ui.sections.textContent = '';
    ui.chips.textContent = '';
    ui.days.hidden = true;

    // сначала дни (от ближайшего дня доставки по правилам города), потом меню на эти дни
    let core;
    try {
      core = await loadDeliveryCore(apiUrl());
    } catch (error) {
      console.error('[constructor]', error);
      showStatus(CONFIG.texts.noDates, true);
      return;
    }

    state.days = getMenuDays(core, state.city);
    if (!state.days.length) {
      ui.filters.hidden = true;
      showStatus(CONFIG.texts.noDates, true);
      return;
    }

    let data;
    try {
      data = await loadData(state.days);
    } catch (error) {
      console.error('[constructor]', error);
      showStatus(CONFIG.texts.error, true);
      return;
    }

    state.mealTypes = data.mealTypes || [];
    state.dishes = data.dishes || [];
    state.dishesById = new Map(state.dishes.map(dish => [dish.id, dish]));
    state.availability = new Map(Object.keys(data.availability || {}).map(iso => [iso, new Set(data.availability[iso])]));
    menuByDate.remember(state.city, data.availability);

    // без блюд нечего фильтровать — пустые блоки «Выберите…» не показываем
    ui.filters.hidden = !state.dishes.length;

    if (!state.dishes.length) {
      showStatus(CONFIG.texts.noMenu);
      return;
    }

    // выбранный день остаётся, если в нём есть меню; иначе — первый день с меню
    if (!dishesForDay(state.selectedDay).length) {
      state.selectedDay = state.days.find(iso => dishesForDay(iso).length);
    }

    ui.status.hidden = true;
    ui.days.hidden = false;
    renderMenu();
    // ядро дат и меню могли загрузиться только сейчас
    cartGuard.check();
    cartView.decorate();
  }

  const initConstructor = () => {
    state.root = document.querySelector(CONFIG.containerSelector);
    if (!state.root || state.root._fbcInited) return;
    state.root._fbcInited = true;

    buildLayout();

    // data-city в разметке надёжнее поддомена: на предпросмотре Тильды (*.tilda.ws) поддомена города нет
    state.city = state.root.getAttribute('data-city') || getSiteCity();
    if (!isCityAllowed(state.city)) {
      ui.filters.hidden = true;
      ui.days.hidden = true;
      showStatus(CONFIG.texts.unavailable);
      return;
    }

    state.imageObserver = initImageObserver();
    injectDeliveryStyles();
    start();

    // стоимость доставки: подписи в корзине пересчитываются вместе с ней (зона, дата, товары)
    loadDeliveryCost(apiUrl())
      .then((delivery) => {
        delivery.onUpdate(() => cartView.decorate());
        delivery.update();
      })
      .catch(error => console.error('[constructor]', error));

    // наступление отсечки на открытой странице: ближайший день ушёл, добавился новый —
    // загружаем меню заново (выбранный день сохранится, если он ещё доступен)
    setInterval(() => {
      if (!window.NCDM_DELIVERY || !state.days.length) return;
      const days = getMenuDays(window.NCDM_DELIVERY, state.city);
      if (days.join() !== state.days.join()) start();
    }, 60000);
  };

  // ==================== ЗАПУСК ====================

  const init = () => {

    cart.onChange(() => {
      syncWithCart();
      cartGuard.check();
    });
    cartView.init();
    cartGuard.init();
    initConstructor();

    // другой город — другие правила доставки
    document.addEventListener('change', (event) => {
      if (event.target.matches && event.target.matches(CONFIG.citySelector)) cartView.decorate();
    }, true);

    window.FITBOX_CONSTRUCTOR = {
      VERSION: 'fitbox-1.5.1',
      CONFIG,
      reload: () => state.root && start(),
      debug: () => ({
        pageCity: state.city || getSiteCity(),
        allowed: isCityAllowed(state.city || getSiteCity()),
        cartReady: cart.isReady(),
        dishes: state.dishes.length,
        days: state.days,
        selectedDay: state.selectedDay,
        inCart: cart.constructorItems().map(item => `${item.product.sku} × ${item.quantity}`),
        delivery: window.FITBOX_DELIVERY ? window.FITBOX_DELIVERY.debug() : 'delivery-cost.js не загружен'
      })
    };
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

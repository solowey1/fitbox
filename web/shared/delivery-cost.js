/*!
 * delivery-cost.js
 *
 * Стоимость доставки в корзине Тильды (T706) — на всех страницах с корзиной.
 * Требует delivery-date.js (window.NCDM_DELIVERY) — дни доставки города.
 *
 * Доставка считается за каждый день доставки:
 * - конструктор («Собери своё меню»): блюда дня без доставки едут в предыдущий день доставки
 *   и входят в его сумму; сумма дня доставки меньше CONFIG.constructor.freeFrom —
 *   CONFIG.constructor.price, иначе бесплатно;
 * - программы питания: доставка бесплатная, дни доставки — с даты из поля корзины
 *   на «Кол-во дней» программы;
 * - надбавка за зону (по адресу в корзине, зоны — с карты города) — за каждый день доставки,
 *   в том числе бесплатный.
 * Считаются только товары, которые оформляются на этой странице (правило delivery-datepicker.js):
 * на странице конструктора — блюда, на остальных — программы.
 *
 * Итог — товар «Доставка» (артикул FBC-DELIVERY) в корзине: Тильде он нужен для суммы заказа,
 * в списке товаров он скрыт. Над «Итого» — строка «Доставка» с подсказкой по дням.
 * Под «Подъездом» и «Этажом» — поле «Зона доставки».
 *
 * API для constructor.js: FITBOX_DELIVERY.plan(), .deliveryDayFor(city, iso), .decorateCart().
 * Проверка в консоли: FITBOX_DELIVERY.VERSION, FITBOX_DELIVERY.debug()
 */
(() => {
  'use strict';

  if (window.FITBOX_DELIVERY) return;

  // ==================== НАСТРОЙКИ ====================

  const CONFIG = {
    apiBaseUrl: 'https://app.fitbox.su/api',

    sku: 'FBC-DELIVERY',
    title: 'Доставка',

    // ▼ Конструктор: стоимость доставки за день и сумма блюд дня доставки, с которой она бесплатная, ₽
    constructor: {
      price: 250,
      freeFrom: 1050
    },

    // ▼ Где есть карта зон доставки (бэкенд: GET /api/tilda/delivery-zone) — значения поля «Город»
    zoneCities: ['Ульяновск', 'Казань', 'Самара', 'Тольятти'],

    // ▼ Цвет зоны на карте → цвет и название в корзине. В разных городах одна надбавка
    //   бывает разного цвета, поэтому подпись — по цвету, который покупатель видит на карте.
    //   Цвета нет в списке — квадратик цветом с карты и подпись «Зона доставки».
    zoneColors: {
      '#1bad03': { color: '#28AF0F', name: 'Зеленая' },
      '#56db40': { color: '#28AF0F', name: 'Зеленая' },
      '#ffd21e': { color: '#F9982F', name: 'Желтая' },
      '#ff931e': { color: '#E7802F', name: 'Оранжевая' },
      '#e6761b': { color: '#E7802F', name: 'Оранжевая' },
      '#ed4543': { color: '#EE4F4D', name: 'Красная' },
      '#82cdff': { color: '#4FB0F0', name: 'Голубая' },
      '#1e98ff': { color: '#1E98FF', name: 'Синяя' },
      '#f371d1': { color: '#F371D1', name: 'Розовая' },
      '#97a100': { color: '#97A100', name: 'Оливковая' },
      '#b51eff': { color: '#B51EFF', name: 'Фиолетовая' }
    },

    constructorPage: '#constructor.fbc',
    constructorSku: /^D\d+-(\d{4})(\d{2})(\d{2})$/i, // блюдо конструктора на день меню
    programDaysOption: 'Кол-во дней',

    subdomains: {
      '': 'Ульяновск',
      'kzn': 'Казань',
      'smr': 'Самара',
      'tlt': 'Тольятти',
      'dmt': 'Димитровград'
    },

    cartForm: '.t706 form',
    cartList: '.t706__cartwin-products, .t706__sidebar-products, .t706__cartpage-products',
    citySelector: 'select[name="city"]',
    dateField: 'input[name="date"]',
    addressFields: {
      street: 'input[name="street"]',
      house: 'input[name="house"]',
      corpus: 'input[name="corpus"]'
    },
    zoneAfterField: 'input[name="floor"]', // поле зоны — под «Подъездом» и «Этажом»
    zoneDelay: 900, // пауза после ввода адреса перед запросом зоны, мс

    // Названия опций товара «Доставка» (видны в письме с заказом)
    optionLabels: {
      days: 'Дни доставки',
      zone: 'Зона'
    },

    texts: {
      free: 'бесплатно',
      totalFree: 'Бесплатно',
      info: 'Стоимость доставки по дням',
      tipFree: 'Бесплатная доставка:',
      tipPaid: 'Платная доставка:',
      tipNoZone: '* без учёта зоны доставки',
      zoneTitle: 'Зона доставки',
      zone: '{name} зона',
      zoneUnnamed: 'Зона доставки',
      zoneFree: 'бесплатно',
      zoneIdle: 'Укажите улицу и дом — определим зону доставки',
      zoneLoading: 'Определяем зону доставки…',
      zoneApprox: 'Дом не нашли на карте, зона — по улице',
      zoneOutside: 'Адрес вне зон доставки — стоимость уточнит менеджер',
      zoneNotFound: 'Не нашли адрес на карте — проверьте улицу и дом',
      zoneError: 'Не удалось определить зону — стоимость уточнит менеджер'
    }
  };

  // ==================== УТИЛИТЫ ====================

  const DAY_MS = 86400000;

  const formatPrice = value => `${Math.round(value).toLocaleString('ru-RU')} ₽`;

  const plural = (n, one, few, many) => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
    return many;
  };

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  };

  const isoToDate = iso => new Date(`${iso}T00:00:00Z`);
  const addDays = (iso, n) => new Date(isoToDate(iso).getTime() + n * DAY_MS).toISOString().slice(0, 10);
  /** «1 ноября» */
  const formatDayMonth = iso => new Intl.DateTimeFormat('ru-RU', { timeZone: 'UTC', day: 'numeric', month: 'long' })
    .format(isoToDate(iso));

  /** «29.10.2026» → '2026-10-29' */
  const fieldToIso = (value) => {
    const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(String(value || '').trim());
    if (!match) return null;
    return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  };

  const svgIcon = (className, nodes) => {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    // размеры и линии — атрибутами, чтобы иконка не зависела от стилей страницы
    [['viewBox', '0 0 24 24'], ['width', '16'], ['height', '16'], ['fill', 'none'], ['stroke', 'currentColor'],
      ['stroke-width', '2'], ['stroke-linecap', 'round'], ['stroke-linejoin', 'round'], ['aria-hidden', 'true']]
      .forEach(([name, value]) => svg.setAttribute(name, value));
    svg.setAttribute('class', className);
    nodes.forEach(([tag, attrs]) => {
      const node = document.createElementNS(ns, tag);
      Object.keys(attrs).forEach(name => node.setAttribute(name, attrs[name]));
      svg.appendChild(node);
    });
    return svg;
  };

  /** Иконка info (lucide.dev) */
  const infoIcon = () => svgIcon('fbd-info-icon', [
    ['circle', { cx: '12', cy: '12', r: '10' }],
    ['path', { d: 'M12 16v-4' }],
    ['path', { d: 'M12 8h.01' }]
  ]);

  const getSiteCity = () => {
    const parts = window.location.hostname.split('.');
    const subdomain = parts.length > 2 && parts[0] !== 'www' ? parts[0] : '';
    return CONFIG.subdomains[subdomain] || null;
  };

  // ==================== КОРЗИНА ТИЛЬДЫ ====================

  /** Удалённый товар Тильда 4 секунды держит с deleted: 'yes' — он уже не в корзине */
  const isInCart = product => !!product && product.deleted !== 'yes' && (parseInt(product.quantity, 10) || 0) > 0;
  const isDeliveryProduct = product => !!product && String(product.sku) === CONFIG.sku;

  const products = () => ((window.tcart && Array.isArray(window.tcart.products)) ? window.tcart.products : []);
  const isCartReady = () => !!window.tcart && typeof window.tcart__addProduct === 'function';

  /** Перерисовать корзину и сохранить — то же, что делает Тильда после своих изменений */
  const commit = () => {
    ['tcart__updateTotalProductsinCartObj', 'tcart__reDrawCartIcon', 'tcart__saveLocalObj',
      'tcart__reDrawProducts', 'tcart__reDrawTotal'].forEach((name) => {
      if (typeof window[name] === 'function') window[name]();
    });
  };

  /**
   * Свои действия после функций корзины Тильды (она вызывает их по глобальному имени).
   * Общий список обработчиков _fbcCallbacks — тот же, что у constructor.js: функцию оборачиваем один раз.
   */
  const afterTildaCall = (name, callback) => {
    const hook = () => {
      const original = window[name];
      if (typeof original !== 'function') return false;
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

  const cartForm = () => document.querySelector(CONFIG.cartForm);

  /** Город доставки: поле «Город» в корзине, иначе — по поддомену */
  const getCartCity = () => {
    const select = document.querySelector(`${CONFIG.cartForm} ${CONFIG.citySelector}`) || document.querySelector(CONFIG.citySelector);
    return (select && select.value) || getSiteCity();
  };

  const isConstructorPage = () => !!document.querySelector(CONFIG.constructorPage);

  // ==================== ДНИ ДОСТАВКИ ====================

  /**
   * День доставки для дня меню: сам день, если в него возим, иначе ближайший предыдущий
   * день доставки (2 ноября доставки нет — привезём 1 ноября). null — доставить уже не успеваем.
   */
  const deliveryDayFor = (city, iso) => {
    const core = window.NCDM_DELIVERY;
    if (!core || !city || !iso) return null;
    const min = core.getMinDeliveryDate(city);
    if (min === null || isNaN(min)) return null;

    for (let day = iso, guard = 0; guard < 31; day = addDays(day, -1), guard++) {
      if (core.isDateAllowed(city, day)) return day;
      if (isoToDate(day).getTime() <= min) return null; // раньше ближайшей доставки искать незачем
    }
    return null;
  };

  /** Первый день доставки программ: дата из поля корзины, если на неё можно заказать, иначе — ближайшая */
  const programStart = (city) => {
    const core = window.NCDM_DELIVERY;
    const field = document.querySelector(`${CONFIG.cartForm} ${CONFIG.dateField}`) || document.querySelector(CONFIG.dateField);
    const chosen = fieldToIso(field && field.value);
    if (chosen && core.isDateAllowed(city, chosen)) return chosen;
    const min = core.getMinDeliveryDate(city);
    return (min === null || isNaN(min)) ? null : core.toISO(min);
  };

  /**
   * Дни меню товаров этой страницы: [{ iso, sum }].
   * Конструктор — день меню из артикула D<id>-<ГГГГММДД>, сумма блюд дня.
   * Программы — дни подряд с первого дня доставки на самую длинную программу, суммы нет.
   */
  const menuDays = (city) => {
    const own = products().filter(product => isInCart(product) && !isDeliveryProduct(product));

    if (isConstructorPage()) {
      const byIso = new Map();
      own.forEach((product) => {
        const match = CONFIG.constructorSku.exec(String(product.sku || ''));
        if (!match) return;
        const iso = `${match[1]}-${match[2]}-${match[3]}`;
        byIso.set(iso, (byIso.get(iso) || 0) + (parseFloat(product.price) || 0) * parseInt(product.quantity, 10));
      });
      return { kind: 'constructor', days: Array.from(byIso, ([iso, sum]) => ({ iso, sum })) };
    }

    const programs = own.filter(product => !CONFIG.constructorSku.test(String(product.sku || '')) && !/^D\d+$/i.test(String(product.sku || '')));
    if (!programs.length || !window.NCDM_DELIVERY) return { kind: 'programs', days: [] };

    const length = Math.max(...programs.map((product) => {
      const option = (product.options || []).find(item => item && item.option === CONFIG.programDaysOption);
      return Math.max(1, parseInt(option && option.variant, 10) || 1);
    }));
    const start = programStart(city);
    if (!start) return { kind: 'programs', days: [] };
    return { kind: 'programs', days: Array.from({ length }, (_, index) => ({ iso: addDays(start, index), sum: 0 })) };
  };

  // ==================== ЗОНА ДОСТАВКИ ====================

  const zone = {
    status: 'idle', // idle | loading | found | outside | not_found | error
    surcharge: 0,
    color: null,
    precise: true,
    key: '',
    cache: new Map(), // адрес -> ответ API
    timer: null
  };

  const isZoneCity = city => CONFIG.zoneCities.indexOf(city) !== -1;

  /** Цвет и подпись зоны по цвету на карте */
  const zoneInfo = () => {
    const known = CONFIG.zoneColors[String(zone.color || '').toLowerCase()];
    const name = known ? CONFIG.texts.zone.replace('{name}', known.name) : CONFIG.texts.zoneUnnamed;
    const price = zone.surcharge ? `+${formatPrice(zone.surcharge)}` : CONFIG.texts.zoneFree;
    return {
      color: known ? known.color : (zone.color || '#e6e6e6'),
      name,
      label: `${name} (${price})`
    };
  };

  // ==================== ПЛАН ДОСТАВКИ ====================

  /**
   * Дни доставки с ценой: [{ iso, menuDays, sum, base, surcharge, cost, left }],
   * total — итог для товара «Доставка», zoneKnown — надбавка зоны уже учтена.
   */
  const plan = () => {
    const city = getCartCity();
    const { kind, days } = menuDays(city);
    const byDelivery = new Map();

    days.forEach((day) => {
      const iso = deliveryDayFor(city, day.iso);
      if (!iso) return; // день уже недоступен — такой заказ всё равно заблокирован
      if (!byDelivery.has(iso)) byDelivery.set(iso, { iso, menuDays: [], sum: 0 });
      const delivery = byDelivery.get(iso);
      delivery.menuDays.push(day.iso);
      delivery.sum += day.sum;
    });

    const surcharge = zone.status === 'found' ? zone.surcharge : 0;
    const { price, freeFrom } = CONFIG.constructor;
    const result = Array.from(byDelivery.values())
      .sort((a, b) => a.iso.localeCompare(b.iso))
      .map((day) => {
        const base = kind === 'constructor' && day.sum < freeFrom ? price : 0;
        return {
          ...day,
          menuDays: day.menuDays.sort(),
          base,
          surcharge,
          cost: base + surcharge,
          left: kind === 'constructor' ? Math.max(0, freeFrom - day.sum) : 0
        };
      });

    return {
      kind,
      city,
      days: result,
      byIso: new Map(result.map(day => [day.iso, day])),
      surcharge,
      zoneKnown: !isZoneCity(city) || zone.status === 'found',
      total: result.reduce((sum, day) => sum + day.cost, 0)
    };
  };

  // ==================== ТОВАР «ДОСТАВКА» ====================

  const deliveryProduct = {
    options(current) {
      const days = current.days
        .map(day => `${formatDayMonth(day.iso)} — ${day.cost ? formatPrice(day.cost) : CONFIG.texts.free}`)
        .join(', ');
      const options = [{ option: CONFIG.optionLabels.days, variant: days }];

      if (current.surcharge) {
        const count = current.days.length;
        options.push({
          option: CONFIG.optionLabels.zone,
          variant: `${zoneInfo().name}, +${formatPrice(current.surcharge)}${count > 1 ? ` × ${count} ${plural(count, 'день', 'дня', 'дней')}` : ''}`
        });
      }
      return options;
    },

    /** Привести товар «Доставка» к плану. Если ничего не поменялось, корзину не трогаем (иначе — цикл) */
    sync() {
      if (!isCartReady() || !window.NCDM_DELIVERY) return;

      const current = plan();
      const list = products();
      const index = list.findIndex(isDeliveryProduct);

      if (current.total <= 0) {
        if (index !== -1) {
          list.splice(index, 1);
          commit();
        }
        return;
      }

      const next = {
        name: CONFIG.title,
        price: current.total,
        quantity: 1,
        amount: current.total,
        sku: CONFIG.sku,
        img: '',
        options: this.options(current)
      };

      const existing = list[index];
      if (existing && existing.deleted !== 'yes' && Number(existing.price) === next.price
        && parseInt(existing.quantity, 10) === 1 && JSON.stringify(existing.options) === JSON.stringify(next.options)) {
        return;
      }

      // не через tcart__addProduct: та покажет «Товар добавлен» и откроет корзину
      if (existing) {
        Object.assign(existing, next);
        delete existing.deleted;
      } else {
        list.push({ ...next, ts: Math.floor(Date.now() / 1000) });
      }
      commit();
    }
  };

  // ==================== ПОДСКАЗКА ПО ДНЯМ ====================

  /**
   * Нативный popover: одна подсказка на страницу, в body — Тильда перерисовывает строки итога.
   * Плавное появление и скрытие — CSS (@starting-style, transition display/overlay).
   */
  const tip = {
    node: null,
    anchor: null,
    supported: typeof HTMLElement !== 'undefined' && Object.prototype.hasOwnProperty.call(HTMLElement.prototype, 'popover'),

    ensure() {
      if (this.node) return this.node;
      const node = el('div', 'fbd-tip');
      node.id = 'fbd-delivery-tip';
      node.setAttribute('role', 'tooltip');
      if (this.supported) {
        node.setAttribute('popover', 'auto');
        node.addEventListener('toggle', (event) => {
          if (event.newState === 'open') this.position();
        });
      } else {
        node.hidden = true;
      }
      document.body.appendChild(node);
      this.node = node;
      return node;
    },

    isOpen() {
      if (!this.node) return false;
      return this.supported ? this.node.matches(':popover-open') : this.node.classList.contains('is-open');
    },

    fill() {
      const node = this.ensure();
      const current = plan();
      node.textContent = '';

      const section = (title, days, withPrice) => {
        if (!days.length) return;
        const box = el('div', 'fbd-tip-section');
        box.append(el('div', 'fbd-tip-title', title));
        days.forEach((day) => {
          const text = withPrice ? `• ${formatDayMonth(day.iso)} – ${formatPrice(day.cost)}` : `• ${formatDayMonth(day.iso)}`;
          box.append(el('div', 'fbd-tip-day', text));
        });
        node.append(box);
      };

      section(CONFIG.texts.tipFree, current.days.filter(day => !day.cost), false);
      section(CONFIG.texts.tipPaid, current.days.filter(day => day.cost), true);
      if (!current.zoneKnown) node.append(el('div', 'fbd-tip-note', CONFIG.texts.tipNoZone));
    },

    /** Под иконкой, от её левого края; не выходя за экран */
    position() {
      if (!this.node || !this.anchor || !this.anchor.isConnected) return;
      const gap = 8;
      const margin = 12;
      const rect = this.anchor.getBoundingClientRect();
      const width = this.node.offsetWidth;
      const height = this.node.offsetHeight;
      let left = rect.left - 6;
      left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
      let top = rect.bottom + gap;
      if (top + height > window.innerHeight - margin && rect.top - gap - height > margin) top = rect.top - gap - height;
      this.node.style.left = `${Math.round(left)}px`;
      this.node.style.top = `${Math.round(top)}px`;
    },

    toggle(anchor) {
      this.anchor = anchor;
      this.fill();
      // подсказка — в body, где у Тильды шрифт не задан: берём шрифт строки корзины
      this.node.style.fontFamily = getComputedStyle(anchor.closest('.t706__cartwin-totalamount-row') || anchor).fontFamily;
      if (this.supported) {
        // кнопка связана с подсказкой через popovertarget — открывает и закрывает браузер
        return;
      }
      const open = !this.isOpen();
      this.node.hidden = false;
      this.node.classList.toggle('is-open', open);
      if (open) this.position();
    },

    close() {
      if (!this.isOpen()) return;
      if (this.supported) this.node.hidePopover();
      else this.node.classList.remove('is-open');
    },

    init() {
      document.addEventListener('click', (event) => {
        const button = event.target.closest && event.target.closest('.fbd-info');
        if (button) {
          this.toggle(button);
          return;
        }
        // запасной вариант без popover: клик мимо подсказки закрывает её
        if (!this.supported && this.node && !this.node.contains(event.target)) this.close();
      }, true);
      window.addEventListener('resize', () => this.close());
      window.addEventListener('scroll', () => this.isOpen() && this.position(), true);
    }
  };

  // ==================== СТРОКА «ДОСТАВКА» НАД «ИТОГО» ====================

  const totalRow = {
    render() {
      const current = isCartReady() && window.NCDM_DELIVERY ? plan() : null;
      const showPrice = value => (typeof window.tcart__showPrice === 'function'
        ? window.tcart__showPrice(value, 'acceptzero')
        : formatPrice(value));

      document.querySelectorAll('.t706__cartwin-totalamount-list').forEach((list) => {
        let row = list.querySelector('.fbd-total-delivery');
        const total = list.querySelector('.t706__cartwin-totalamount-row_total');
        if (!current || !current.days.length || !total) {
          if (row) row.remove();
          return;
        }

        if (!row) {
          // разметка — как у строк Тильды (скидка, доставка), чтобы взять их стили
          row = el('div', 't706__cartwin-totalamount-row fbd-total-delivery');
          const label = el('div', 't706__cartwin-totalamount-info_label');
          label.append(el('span', 't706__cartwin-totalamount-info_label-text', CONFIG.title));
          const button = el('button', 'fbd-info');
          button.type = 'button';
          button.setAttribute('aria-label', CONFIG.texts.info);
          if (tip.supported) button.setAttribute('popovertarget', tip.ensure().id);
          button.append(infoIcon());
          label.append(button);
          row.append(label, el('div', 't706__cartwin-totalamount-info_value'));
        }
        // цену форматирует сама Тильда (валюта проекта), текст «Бесплатно» — наш
        const value = row.querySelector('.t706__cartwin-totalamount-info_value');
        if (current.total) value.innerHTML = showPrice(current.total);
        else value.textContent = CONFIG.texts.totalFree;

        if (row.nextElementSibling !== total) list.insertBefore(row, total);
        if (typeof window.tcart__markFlexTotalsRowBeforeTotal === 'function') {
          window.tcart__markFlexTotalsRowBeforeTotal(list.parentNode);
        }
      });

      // подсказка открыта — содержимое по новому плану
      if (tip.isOpen()) {
        if (!current || !current.days.length) tip.close();
        else tip.fill();
      }
    }
  };

  // ==================== СПИСОК ТОВАРОВ: «ДОСТАВКА» СКРЫТА ====================

  /**
   * Товар «Доставка» нужен Тильде (сумма заказа, письмо), покупателю — нет: строка товара
   * и её заголовок «Доставка» (как у дат конструктора) всегда скрыты, в конце списка.
   */
  const decorateCart = () => {
    const list = products();
    document.querySelectorAll(CONFIG.cartList).forEach((container) => {
      container.querySelectorAll('.fbd-delivery-head').forEach(node => node.remove());
      Array.prototype.filter.call(container.children, row => row.classList.contains('t706__product')).forEach((row) => {
        const product = list[parseInt(row.getAttribute('data-cart-product-i'), 10)];
        if (!isDeliveryProduct(product)) {
          row.classList.remove('fbd-delivery-row');
          return;
        }
        row.classList.add('fbd-delivery-row');
        container.appendChild(el('div', 'fbd-delivery-head t-name', CONFIG.title));
        container.appendChild(row);
      });
    });
  };

  // ==================== ПОЛЕ «ЗОНА ДОСТАВКИ» ====================

  const zoneField = {
    address(form) {
      const value = selector => ((form.querySelector(selector) || {}).value || '').trim();
      const fields = CONFIG.addressFields;
      return { street: value(fields.street), house: value(fields.house), corpus: value(fields.corpus) };
    },

    /**
     * Поле под «Подъездом» и «Этажом». Класс t-input-group не ставим: по таким блокам
     * Тильда (и restoreFormFields в delivery-datepicker.js) судит о полях формы
     */
    ensure(form) {
      const input = form.querySelector(CONFIG.zoneAfterField);
      const anchor = input && (input.closest('.t-input-group') || input);
      if (!anchor) return null;

      let group = form.querySelector('.fbd-zone-group');
      if (!group) {
        group = el('div', 'fbd-zone-group');
        const row = el('div', 'fbd-zone t-text');
        row.append(el('span', 'fbd-zone-swatch'), el('span', 'fbd-zone-text'));
        group.append(el('div', 'fbd-zone-title t-input-title t-descr t-descr_md', CONFIG.texts.zoneTitle),
          row, el('div', 'fbd-zone-hint t-text'));
      }
      if (group.previousElementSibling !== anchor) anchor.parentNode.insertBefore(group, anchor.nextSibling);
      return { group, anchor };
    },

    render() {
      const form = cartForm();
      if (!form) return;

      const show = isZoneCity(getCartCity()) && window.NCDM_DELIVERY && plan().days.length > 0;
      if (!show) {
        const existing = form.querySelector('.fbd-zone-group');
        if (existing) existing.hidden = true;
        return;
      }

      const parts = this.ensure(form);
      if (!parts) return;
      const { group, anchor } = parts;
      // Тильда спрятала поля формы — прячем и зону
      group.hidden = anchor.style.display === 'none';

      const info = zone.status === 'found' ? zoneInfo() : null;
      const texts = {
        idle: CONFIG.texts.zoneIdle,
        loading: CONFIG.texts.zoneLoading,
        found: info && info.label,
        outside: CONFIG.texts.zoneOutside,
        not_found: CONFIG.texts.zoneNotFound,
        error: CONFIG.texts.zoneError
      };

      group.setAttribute('data-status', zone.status);
      group.querySelector('.fbd-zone-swatch').style.backgroundColor = info ? info.color : '';
      group.querySelector('.fbd-zone-text').textContent = texts[zone.status] || '';
      const hint = group.querySelector('.fbd-zone-hint');
      hint.textContent = zone.status === 'found' && !zone.precise ? CONFIG.texts.zoneApprox : '';
      hint.hidden = !hint.textContent;
    },

    set(status, data) {
      zone.status = status;
      zone.surcharge = (data && data.surcharge) || 0;
      zone.color = (data && data.color) || null;
      zone.precise = !data || data.precise !== false;
      update();
    },

    apply(data) {
      const statuses = { found: 'found', outside: 'outside', not_found: 'not_found', no_zones: 'idle' };
      this.set(statuses[data.status] || 'error', data);
    },

    /** Запрос зоны по адресу из формы; один и тот же адрес не запрашиваем дважды */
    lookup() {
      const form = cartForm();
      if (!form) return;

      const city = getCartCity();
      const address = this.address(form);
      if (!isZoneCity(city) || !address.street || !address.house) {
        zone.key = '';
        if (zone.status !== 'idle') this.set('idle');
        else this.render();
        return;
      }

      const key = [city, address.street, address.house, address.corpus].join('|').toLowerCase();
      if (key === zone.key && zone.status !== 'error') return;
      zone.key = key;

      if (zone.cache.has(key)) {
        this.apply(zone.cache.get(key));
        return;
      }

      this.set('loading');
      const query = new URLSearchParams({ city, ...address });
      fetch(`${CONFIG.apiBaseUrl}/tilda/delivery-zone?${query}`, { headers: { Accept: 'application/json' } })
        .then(response => (response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))))
        .then((data) => {
          zone.cache.set(key, data);
          if (zone.key === key) this.apply(data);
        })
        .catch((error) => {
          console.warn('[delivery-cost] зона доставки не определилась', error);
          if (zone.key === key) this.set('error');
        });
    },

    schedule() {
      clearTimeout(zone.timer);
      zone.timer = setTimeout(() => this.lookup(), CONFIG.zoneDelay);
    }
  };

  // ==================== СТИЛИ ====================

  const injectStyles = () => {
    if (document.getElementById('fbd-styles')) return;
    const style = document.createElement('style');
    style.id = 'fbd-styles';
    style.textContent = [
      // товар «Доставка» и его заголовок — только для Тильды
      '.t706__product.fbd-delivery-row,.fbd-delivery-head{display:none !important;}',
      '.fbd-delivery-head{margin:24px 0 4px;padding-bottom:8px;font-size:16px;font-weight:600;',
      'line-height:1.3;border-bottom:1px solid rgba(0,0,0,.1);}',
      // иконка info у строки «Доставка»
      '.fbd-total-delivery .t706__cartwin-totalamount-info_label{display:inline-flex;align-items:center;gap:6px;}',
      '.fbd-info{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;',
      'margin:-4px 0;padding:0;color:inherit;background:none;border:0;border-radius:50%;opacity:.55;',
      'cursor:pointer;transition:opacity .2s ease;}',
      '.fbd-info:hover,.fbd-info:focus-visible{opacity:1;}',
      '.fbd-info-icon{display:block;}',
      // подсказка
      '.fbd-tip{position:fixed;inset:auto;margin:0;box-sizing:border-box;max-width:min(280px,calc(100vw - 24px));',
      'padding:12px 14px;font-size:13px;font-weight:400;line-height:1.45;color:#fff;background:#121212;',
      'border:0;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.18);z-index:2147483000;',
      'opacity:0;transform:translateY(4px);',
      'transition:opacity .2s ease,transform .2s ease,overlay .2s ease allow-discrete,display .2s ease allow-discrete;}',
      '.fbd-tip:popover-open,.fbd-tip.is-open{opacity:1;transform:none;}',
      '@starting-style{.fbd-tip:popover-open{opacity:0;transform:translateY(4px);}}',
      '.fbd-tip:not([popover]){display:block;pointer-events:none;}',
      '.fbd-tip:not([popover]).is-open{pointer-events:auto;}',
      '.fbd-tip-section+.fbd-tip-section{margin-top:10px;}',
      '.fbd-tip-title{font-weight:600;}',
      '.fbd-tip-note{margin-top:10px;font-size:12px;opacity:.7;}',
      // поле «Зона доставки» в форме корзины
      '.fbd-zone-group{clear:both;width:100%;box-sizing:border-box;margin-bottom:25px;}',
      '.fbd-zone-group .fbd-zone-title{padding-bottom:5px;}',
      '.fbd-zone{display:flex;align-items:center;gap:10px;font-size:15px;line-height:1.35;}',
      '.fbd-zone-swatch{flex:none;width:18px;height:18px;border-radius:4px;background:#e6e6e6;}',
      '.fbd-zone-group[data-status="loading"] .fbd-zone-swatch{animation:fbd-zone-pulse 1s ease-in-out infinite;}',
      '.fbd-zone-group:not([data-status="found"]) .fbd-zone-text{opacity:.6;}',
      '.fbd-zone-hint{margin-top:4px;font-size:12px;line-height:1.4;opacity:.6;}',
      '@keyframes fbd-zone-pulse{50%{opacity:.4;}}'
    ].join('');
    document.head.appendChild(style);
  };

  // ==================== ЗАПУСК ====================

  const listeners = [];

  /** Пересчитать всё: товар, строку итога, поле зоны; сообщить constructor.js */
  const update = () => {
    deliveryProduct.sync();
    totalRow.render();
    zoneField.render();
    listeners.forEach(callback => callback());
  };

  const init = () => {
    if (!window.NCDM_DELIVERY) {
      console.error('[delivery-cost] Сначала подключите delivery-date.js');
    }
    injectStyles();
    tip.init();

    // любое изменение корзины заканчивается tcart__saveLocalObj
    afterTildaCall('tcart__saveLocalObj', update);
    // строку «Доставка» Тильда стирает при каждом пересчёте суммы
    afterTildaCall('tcart__reDrawTotal', () => totalRow.render());
    afterTildaCall('tcart__reDrawProducts', decorateCart);

    window.addEventListener('storage', (event) => {
      if (event.key !== 'tcart') return;
      if (typeof window.tcart__syncProductsObject__LStoObj === 'function') window.tcart__syncProductsObject__LStoObj();
      update();
    });

    const fields = CONFIG.addressFields;
    const addressSelector = [fields.street, fields.house, fields.corpus].join(', ');
    ['input', 'change'].forEach((type) => {
      document.addEventListener(type, (event) => {
        const target = event.target;
        if (!target.matches) return;
        if (target.matches(addressSelector)) zoneField.schedule();
        else if (target.matches(CONFIG.citySelector)) zoneField.lookup();
        // от даты зависят дни доставки программ
        if (type === 'change' && (target.matches(CONFIG.citySelector) || target.matches(CONFIG.dateField))) update();
      }, true);
    });
    // дату ставит календарь (delivery-datepicker.js) без события change, адрес — браузер или Тильда;
    // поля формы Тильда показывает и прячет сама (шаги корзины) — поле зоны следует за «Этажом»
    setTimeout(() => zoneField.lookup(), 1500);
    let lastDate = null;
    setInterval(() => {
      const field = document.querySelector(CONFIG.dateField);
      const value = field ? field.value : null;
      if (value !== lastDate) {
        lastDate = value;
        update();
      } else {
        zoneField.render();
      }
    }, 1000);
    // отсечка на открытой странице: ближайший день доставки уходит
    setInterval(update, 60000);
  };

  window.FITBOX_DELIVERY = {
    VERSION: 'fitbox-1.0.0',
    CONFIG,
    plan,
    deliveryDayFor,
    decorateCart,
    update,
    /** Обработчик после каждого пересчёта (constructor.js перерисовывает подписи о доставке) */
    onUpdate: callback => listeners.push(callback),
    debug: () => ({
      city: getCartCity(),
      page: isConstructorPage() ? 'constructor' : 'programs',
      plan: plan(),
      zone: { ...zone, cache: zone.cache.size },
      popover: tip.supported
    })
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

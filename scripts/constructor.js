/*!
 * constructor.js
 *
 * Конструктор «Собери своё меню» для Tilda.
 * Блюда и приёмы пищи — с бэкенда (GET /api/tilda/constructor), выбранные блюда
 * лежат в корзине Тильды (T706) с артикулом D<id>.
 *
 * Два режима:
 * - на странице есть #constructor — рисуем конструктор (только в городах из CONFIG.cities);
 * - на любой странице — следим за корзиной: если в ней блюда конструктора, а в поле
 *   «Город» выбран город, где конструктор не работает, отправка заказа блокируется.
 *
 * Проверка в консоли: FITBOX_CONSTRUCTOR.VERSION, FITBOX_CONSTRUCTOR.debug()
 */
(() => {
  'use strict';

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
    citySelector: 'select[name="city"]',
    submitSelector: 'button[type="submit"], input[type="submit"], .t-submit',

    skuPrefix: 'D',
    allLabel: 'Все',
    thumbnailWidth: 600, // ширина фото в карточке, px (карточка ~240 px, запас под ретину)

    texts: {
      unavailable: 'Конструктор меню пока работает только в Казани.',
      empty: 'Скоро здесь появятся блюда. Загляните чуть позже.',
      error: 'Не удалось загрузить меню.',
      retry: 'Попробовать ещё раз',
      cityLocked: 'Блюда из конструктора пока доставляем только в Казань. Выберите Казань или уберите эти блюда из корзины.',
      add: 'Добавить',
      checkout: 'Оформить',
      noNutrition: 'КБЖУ уточняется'
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

  const isConstructorSku = (sku) => new RegExp(`^${CONFIG.skuPrefix}\\d+$`, 'i').test(String(sku || ''));

  // ==================== КОРЗИНА ТИЛЬДЫ ====================

  /**
   * Удалённый в корзине товар Тильда 4 секунды держит с deleted: 'yes' (можно вернуть),
   * в подсчётах он уже не участвует — как и у самой Тильды
   */
  const isInCart = product => product && product.deleted !== 'yes' && (parseInt(product.quantity, 10) || 0) > 0;

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

    constructorProducts() {
      return this.products().filter(product => isInCart(product) && isConstructorSku(product.sku));
    },

    /** Перерисовать корзину и сохранить — то же, что делает Тильда после своих изменений */
    commit() {
      ['tcart__updateTotalProductsinCartObj', 'tcart__reDrawCartIcon', 'tcart__saveLocalObj',
        'tcart__reDrawProducts', 'tcart__reDrawTotal'].forEach((name) => {
        if (typeof window[name] === 'function') window[name]();
      });
    },

    add(dish, quantity) {
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
          sku: dish.sku,
          img: dish.image || '',
          options: [],
          url: window.location.href.split('#')[0]
        });
      } finally {
        if (openOnOrder) cartBlock.setAttribute('data-opencart-onorder', openOnOrder);
      }
    },

    setQuantity(dish, quantity) {
      if (!this.isReady()) return;

      if (typeof window.tcart__syncProductsObject__LStoObj === 'function') {
        window.tcart__syncProductsObject__LStoObj();
      }

      const products = this.products();
      const index = products.findIndex(product => product && String(product.sku) === dish.sku);

      if (index === -1) {
        if (quantity > 0) this.add(dish, quantity);
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

    open() {
      if (typeof window.tcart__openCart === 'function') window.tcart__openCart();
    },

    /**
     * Узнаём о любых изменениях корзины (в том числе из самой корзины Тильды):
     * все они заканчиваются вызовом tcart__saveLocalObj
     */
    onChange(callback) {
      const hook = () => {
        const original = window.tcart__saveLocalObj;
        if (typeof original !== 'function') return false;
        if (original._fbcHooked) return true;

        const wrapped = function () {
          const result = original.apply(this, arguments);
          callback();
          return result;
        };
        wrapped._fbcHooked = true;
        window.tcart__saveLocalObj = wrapped;
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

  // ==================== ЗАЩИТА КОРЗИНЫ ПО ГОРОДУ ====================

  /**
   * Блюда конструктора можно заказать только в городах из CONFIG.cities.
   * Блокируем отправку своим классом и перехватом клика/submit — так не мешаем
   * календарю доставки, который управляет disabled у той же кнопки.
   */
  const cityGuard = {
    check() {
      const hasDishes = cart.constructorProducts().length > 0;

      document.querySelectorAll(CONFIG.cartFormSelector).forEach((form) => {
        const select = form.querySelector(CONFIG.citySelector);
        if (!select) return;

        const locked = hasDishes && !isCityAllowed(select.value);
        const group = select.closest('.t-input-group') || select.parentNode;
        let message = group.querySelector('.fbc-city-error');

        if (locked && !message) {
          message = el('div', 'fbc-city-error t-text', CONFIG.texts.cityLocked);
          group.appendChild(message);
        } else if (!locked && message) {
          message.remove();
        }

        form.querySelectorAll(CONFIG.submitSelector).forEach((button) => {
          button.classList.toggle('fbc-submit-locked', locked);
        });
        form.classList.toggle('fbc-form-locked', locked);
      });
    },

    init() {
      document.addEventListener('change', (event) => {
        if (event.target.matches && event.target.matches(CONFIG.citySelector)) this.check();
      }, true);

      document.addEventListener('click', (event) => {
        const button = event.target.closest && event.target.closest(CONFIG.submitSelector);
        if (!button || !button.classList.contains('fbc-submit-locked')) return;
        event.preventDefault();
        event.stopPropagation();
      }, true);

      document.addEventListener('submit', (event) => {
        if (!event.target.classList || !event.target.classList.contains('fbc-form-locked')) return;
        event.preventDefault();
        event.stopPropagation();
      }, true);

      this.check();
    }
  };

  // ==================== КОНСТРУКТОР ====================

  const state = {
    root: null,
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

  const loadData = async () => {
    const response = await fetch(`${apiUrl()}/tilda/constructor`, { headers: { Accept: 'application/json' } });
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

  // ---------- счётчик +/- ----------

  const createStepper = (dish) => {
    const wrapper = el('div', 'fbc-stepper');

    const addButton = el('button', 'fbc-btn fbc-btn-add', CONFIG.texts.add);
    addButton.type = 'button';
    addButton.addEventListener('click', (event) => {
      event.stopPropagation();
      cart.setQuantity(dish, 1);
    });

    const minus = el('button', 'fbc-stepper-btn', '−');
    minus.type = 'button';
    minus.setAttribute('aria-label', `Убрать одно: ${dish.title}`);
    minus.addEventListener('click', (event) => {
      event.stopPropagation();
      cart.setQuantity(dish, cart.quantity(dish.sku) - 1);
    });

    const count = el('span', 'fbc-stepper-count', '0');
    count.setAttribute('aria-live', 'polite');

    const plus = el('button', 'fbc-stepper-btn', '+');
    plus.type = 'button';
    plus.setAttribute('aria-label', `Добавить ещё: ${dish.title}`);
    plus.addEventListener('click', (event) => {
      event.stopPropagation();
      cart.setQuantity(dish, cart.quantity(dish.sku) + 1);
    });

    const controls = el('div', 'fbc-stepper-controls');
    controls.append(minus, count, plus);
    wrapper.append(addButton, controls);

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
    open.addEventListener('click', () => openDialog(dish));

    const meta = el('div', 'fbc-card-meta', `${dish.weight} г`);
    const nutrition = el('div', 'fbc-card-nutrition', nutritionLine(dish.nutrition));

    const price = el('div', 'fbc-price');
    price.append(el('span', 'fbc-price-current', formatPrice(dish.price)));
    if (dish.oldPrice && dish.oldPrice > dish.price) {
      price.append(el('span', 'fbc-price-old', formatPrice(dish.oldPrice)));
    }

    const footer = el('div', 'fbc-card-footer');
    footer.append(price, createStepper(dish));

    card.append(open, meta, nutrition, footer);
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

    const close = el('button', 'fbc-dialog-close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', 'Закрыть');
    close.addEventListener('click', closeDialog);

    const body = el('div', 'fbc-dialog-body');
    if (dish.image) {
      const image = el('img', 'fbc-dialog-image');
      image.src = dish.image;
      image.alt = dish.title;
      body.append(image);
    }

    body.append(el('h3', 'fbc-dialog-title', dish.title));
    body.append(el('div', 'fbc-dialog-meta', `${dish.weight} г`));

    if (dish.nutrition) {
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
    updateStepper(stepper, cart.quantity(dish.sku));
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

    state.mealTypes.forEach((type) => {
      const count = state.dishes.filter(dish => dish.mealTypes.indexOf(type.slug) !== -1).length;
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

    state.mealTypes.forEach((type) => {
      const dishes = state.dishes.filter(dish => dish.mealTypes.indexOf(type.slug) !== -1);
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
    let count = 0;
    let total = 0;
    const nutrition = { calories: 0, proteins: 0, fats: 0, carbohydrates: 0 };
    let hasNutrition = false;

    cart.constructorProducts().forEach((product) => {
      const quantity = parseInt(product.quantity, 10) || 0;
      const dish = state.dishesById.get(parseInt(String(product.sku).slice(CONFIG.skuPrefix.length), 10));

      count += quantity;
      total += dish ? dish.price * quantity : (parseFloat(product.amount) || 0);

      if (dish && dish.nutrition) {
        hasNutrition = true;
        Object.keys(nutrition).forEach((key) => {
          nutrition[key] += dish.nutrition.portion[key] * quantity;
        });
      }
    });

    ui.bar.hidden = count === 0;
    if (!count) return;

    ui.barCount.textContent = `${count} ${plural(count, 'блюдо', 'блюда', 'блюд')}`;
    ui.barTotal.textContent = formatPrice(total);
    ui.barNutrition.textContent = hasNutrition
      ? `${Math.round(nutrition.calories)} ккал · Б ${Math.round(nutrition.proteins)} · Ж ${Math.round(nutrition.fats)} · У ${Math.round(nutrition.carbohydrates)}`
      : '';
  };

  /** Счётчики на карточках и плашка — из корзины Тильды */
  const syncWithCart = () => {
    if (!ui.bar) return; // на странице нет конструктора — только защита корзины

    state.steppers.forEach((list, dishId) => {
      const dish = state.dishesById.get(dishId);
      const quantity = dish ? cart.quantity(dish.sku) : 0;
      list.forEach(stepper => updateStepper(stepper, quantity));
    });
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
    ui.chips = root.querySelector('.fbc-chips');
    ui.sections = root.querySelector('.fbc-sections');
    ui.status = root.querySelector('.fbc-status');
    ui.bar = root.querySelector('.fbc-bar');
    ui.barCount = root.querySelector('.fbc-bar-count');
    ui.barTotal = root.querySelector('.fbc-bar-total');
    ui.barNutrition = root.querySelector('.fbc-bar-nutrition');
    ui.barButton = root.querySelector('.fbc-bar-button');

    ui.barButton.addEventListener('click', () => cart.open());
  };

  async function start() {
    showStatus(null);
    ui.sections.textContent = '';
    ui.chips.textContent = '';

    try {
      const data = await loadData();

      state.mealTypes = data.mealTypes || [];
      state.dishes = data.dishes || [];
      state.dishesById = new Map(state.dishes.map(dish => [dish.id, dish]));

      if (!state.dishes.length) {
        showStatus(CONFIG.texts.empty);
        return;
      }

      ui.status.hidden = true;
      renderChips();
      renderSections();
      applyFilter();
      syncWithCart();
    } catch (error) {
      console.error('[constructor]', error);
      showStatus(CONFIG.texts.error, true);
    }
  }

  const initConstructor = () => {
    state.root = document.querySelector(CONFIG.containerSelector);
    if (!state.root || state.root._fbcInited) return;
    state.root._fbcInited = true;

    buildLayout();

    // data-city в разметке надёжнее поддомена: на предпросмотре Тильды (*.tilda.ws) поддомена города нет
    const city = state.root.getAttribute('data-city') || getSiteCity();
    if (!isCityAllowed(city)) {
      state.root.querySelector('.fbc-filters').hidden = true;
      showStatus(CONFIG.texts.unavailable);
      return;
    }

    state.imageObserver = initImageObserver();
    start();
  };

  // ==================== ЗАПУСК ====================

  const init = () => {
    cart.onChange(() => {
      syncWithCart();
      cityGuard.check();
    });
    cityGuard.init();
    initConstructor();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.FITBOX_CONSTRUCTOR = {
    VERSION: 'fitbox-1.0.0',
    CONFIG,
    reload: () => state.root && start(),
    debug: () => ({
      pageCity: (state.root && state.root.getAttribute('data-city')) || getSiteCity(),
      allowed: isCityAllowed((state.root && state.root.getAttribute('data-city')) || getSiteCity()),
      cartReady: cart.isReady(),
      dishes: state.dishes.length,
      inCart: cart.constructorProducts().map(p => `${p.sku} × ${p.quantity}`)
    })
  };
})();

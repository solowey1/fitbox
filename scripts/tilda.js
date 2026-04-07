// ====================
// КОНФИГУРАЦИЯ
// ====================
const API_BASE_URL = 'https://app.fitbox.su/api';

// Константы
const CYCLE_IN_DAYS = 28;

/**
 * Константы для кэширования
 */
const CACHE_TTL = 60 * 60 * 1000; // 60 минут в миллисекундах
const CACHE_PREFIX = 'fitbox_cache_';

// DOM элементы
const blockMenu = document.getElementById('menu');
const blockTarget = document.getElementById('target');

// Глобальные переменные
window.menuData = null;
window.currentProgram = null;
window.selectedDays = null; // Сохраняем выбранное количество дней
let swiperProgramm = null;
let imageObserver = null; // Intersection Observer для lazy loading изображений

// Функция очистки кэша доступна глобально (можно вызвать из консоли)
window.clearFitboxCache = () => {
  try {
    const keys = Object.keys(localStorage);
    let count = 0;
    keys.forEach(key => {
      if (key.startsWith('fitbox_cache_')) {
        localStorage.removeItem(key);
        count++;
      }
    });
    console.info(`✓ Кэш очищен (удалено записей: ${count})`);
    console.info('⟳ Обновите страницу для загрузки свежих данных');
    return `Удалено ${count} записей из кэша`;
  } catch (error) {
    console.error('Ошибка при очистке кэша:', error);
    return 'Ошибка при очистке кэша';
  }
};

// ====================
// API ФУНКЦИИ
// ====================

/**
 * Получить все данные для меню
 */
const getMenuData = async () => {
  try {
    // Определяем поддомен из URL
    const hostname = window.location.hostname;
    const parts = hostname.split('.');
    const subdomain = parts.length > 2 ? parts[0] : '';

    // Формируем ключ кэша с учетом поддомена
    const cacheKey = `menu_${subdomain}`;

    // Проверяем кэш
    const cachedData = getFromCache(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    // console.log('⟳ Загрузка данных меню с сервера...');

    const response = await fetch(`${API_BASE_URL}/tilda/menu?subdomain=${subdomain}`, {
      method: 'GET',
      mode: 'cors',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Сохраняем в кэш
    saveToCache(cacheKey, data);

    return data;
  } catch (error) {
    console.error('Ошибка при получении данных меню:', error);
    throw error;
  }
};

/**
 * Получить блюда для программы
 */
const getProgramDishes = async (programId, week = null, day = null) => {
  try {
    // Формируем ключ кэша с учетом параметров
    const cacheKey = `dishes_${programId}_${week || 'all'}_${day || 'all'}`;

    // Проверяем кэш
    const cachedData = getFromCache(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    // console.log(`⟳ Загрузка блюд программы ${programId} с сервера...`);

    let url = `${API_BASE_URL}/tilda/menu/${programId}/dishes`;
    const params = new URLSearchParams();
    if (week) params.append('week', week);
    if (day) params.append('day', day);

    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    const response = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Сохраняем в кэш
    saveToCache(cacheKey, data);

    return data;
  } catch (error) {
    console.error(`Ошибка при получении блюд программы ${programId}:`, error);
    return { dishes: [] };
  }
};

// ====================
// УТИЛИТЫ
// ====================

/**
 * Получить данные из localStorage кэша
 */
const getFromCache = (key) => {
  try {
    const cached = localStorage.getItem(CACHE_PREFIX + key);
    if (!cached) return null;

    const data = JSON.parse(cached);
    const now = Date.now();

    // Проверяем, не истек ли срок действия кэша
    if (now - data.timestamp > CACHE_TTL) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }

    // console.log(`✓ Данные загружены из кэша: ${key}`);
    return data.value;
  } catch (error) {
    console.error('Ошибка при чтении кэша:', error);
    return null;
  }
};

/**
 * Сохранить данные в localStorage кэш
 */
const saveToCache = (key, value) => {
  try {
    const data = {
      value: value,
      timestamp: Date.now()
    };
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(data));
    // console.log(`✓ Данные сохранены в кэш: ${key} (TTL: 60 мин)`);
  } catch (error) {
    console.error('Ошибка при сохранении в кэш:', error);
  }
};

/**
 * Очистить весь кэш Fitbox
 */
const clearCache = () => {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(CACHE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
    console.info('✓ Кэш очищен');
  } catch (error) {
    console.error('Ошибка при очистке кэша:', error);
  }
};

/**
 * Инициализация Intersection Observer для lazy loading изображений
 */
const initImageObserver = () => {
  // Проверяем поддержку браузером
  if (!('IntersectionObserver' in window)) {
    console.warn('IntersectionObserver не поддерживается, изображения загружаются сразу');
    return null;
  }

  // Создаем observer с порогом 0.01 (начинаем загрузку когда элемент на 1% виден)
  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const imageElement = entry.target;
        const imageUrl = imageElement.getAttribute('data-lazy-bg');

        if (imageUrl) {
          // Загружаем изображение
          imageElement.style.backgroundImage = `url(${imageUrl})`;
          imageElement.classList.add('lazy-loaded');

          // Удаляем data-атрибут
          imageElement.removeAttribute('data-lazy-bg');

          // Прекращаем наблюдение за этим элементом
          observer.unobserve(imageElement);
        }
      }
    });
  }, {
    rootMargin: '50px', // Начинаем загрузку за 50px до появления в viewport
    threshold: 0.01
  });

  return observer;
};

/**
 * Вычислить текущую неделю в цикле
 * День начинается в 00:00 (точность до дня)
 */
const getCurrentWeekInCycle = (startDate) => {
  // Создаем даты с обнуленным временем (начало дня 00:00:00)
  const start = new Date(startDate);
  const today = new Date();
  const diffTime = today.getTime() - start.getTime();

  if (diffTime < 0) return 1;

  // Количество полных дней с момента старта
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  // Номер недели в цикле (1-4)
  const weekInCycle = (Math.floor(diffDays / 7) % 4) + 1;

  return weekInCycle;
};

/**
 * Вычислить текущий день в цикле
 * День начинается в 00:00 (точность до дня)
 */
const getCurrentDayInCycle = (startDate) => {
  // Создаем даты с обнуленным временем (начало дня 00:00:00)
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffTime = today.getTime() - start.getTime();

  if (diffTime < 0) return 1;

  // Количество полных дней с момента старта
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  // День недели (1-7)
  const dayInCycle = (diffDays % 7) + 1;

  return dayInCycle;
};

/**
 * Форматировать дату
 */
const formatDate = (date) => {
  const d = new Date(date);
  const months = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
  ];

  const day = d.getDate();
  const month = months[d.getMonth()];
  const year = d.getFullYear();

  return `${day} ${month} ${year} года`;
};

/**
 * Добавить символ рубля
 */
const addRubleSymbol = (amount) => {
  return `${amount} ₽`;
};

/**
 * Создать изображение из DOM-элемента (через html2canvas)
 */
const createImageFrom = (selector) => {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (!element) {
      reject('Элемент не найден');
      return;
    }

    if (typeof html2canvas === 'undefined') {
      reject('html2canvas не загружен');
      return;
    }

    html2canvas(element, { logging: false, useCORS: true })
      .then(canvas => {
        resolve(canvas.toDataURL('image/png'));
      })
      .catch(error => {
        reject('Ошибка при создании изображения: ' + error.message);
      });
  });
};

/**
 * Получить массив цен программы для текущего города
 */
const getProgramPrices = (program) => {
  if (!program || !program.prices) return [];
  const cityId = window.menuData?.currentCity?.id;
  if (cityId && program.prices[cityId]) return program.prices[cityId];
  // Fallback: первый доступный город
  const keys = Object.keys(program.prices);
  return keys.length > 0 ? program.prices[keys[0]] : [];
};

/**
 * Получить текущую выбранную цену программы
 */
const getSelectedPrice = () => {
  const program = window.currentProgram;
  const prices = getProgramPrices(program);
  if (prices.length === 0) return null;
  return prices.find(p => p.days === window.selectedDays) || prices[0] || null;
};

/**
 * Callback добавления товара в корзину
 */
const summaryCartBtnCallback = async () => {
  summaryCartBtnListen(false);

  const program = window.currentProgram;
  const selectedPrice = getSelectedPrice();

  if (!program || !selectedPrice) {
    summaryCartBtnListen(true);
    return;
  }

  const caloriesText = program.nutrition.caloriesFrom && program.nutrition.caloriesTo
    ? `${program.nutrition.caloriesFrom}-${program.nutrition.caloriesTo}`
    : '';

  const productOptions = [
    { 'option': 'Кол-во дней', 'variant': String(selectedPrice.days) },
    { 'option': 'Калории', 'variant': caloriesText }
  ];

  const product = {
    img: '',
    lid: '',
    name: program.title,
    options: productOptions,
    pack_label: '',
    pack_m: '',
    pack_x: '',
    pack_y: '',
    pack_z: '',
    price: selectedPrice.price,
    quantity: 1,
    recid: '',
    sku: program.id,
    url: ''
  };

  const selector = window.innerWidth > 960
    ? '.summary-program-logo'
    : '.swiper-slide-active .menu-program-logo';

  try {
    const productImage = await createImageFrom(selector);
    product.img = productImage;
    tcart__addProduct(product);
  } catch (error) {
    console.error(error);
    tcart__addProduct(product);
  } finally {
    summaryCartBtnListen(true);
  }
};

/**
 * Управление обработчиком кнопки корзины
 */
const summaryCartBtnListen = (enable = true) => {
  const summaryCartBtn = blockMenu.querySelector('.menu-button.summary-button[name="cart"]');
  if (!summaryCartBtn) return;

  if (enable) {
    summaryCartBtn.removeAttribute('disabled');
    summaryCartBtn.removeEventListener('click', summaryCartBtnCallback);
    summaryCartBtn.addEventListener('click', summaryCartBtnCallback);
  } else {
    summaryCartBtn.setAttribute('disabled', true);
    summaryCartBtn.removeEventListener('click', summaryCartBtnCallback);
  }
};

// ====================
// РЕНДЕРИНГ UI
// ====================

/**
 * Отрендерить кнопки выбора программы
 */
const renderProgramButtons = (programs) => {
  const wrapper = document.querySelector('.program-buttons-wrapper');
  if (!wrapper) return;

  // Очищаем существующие кнопки
  wrapper.innerHTML = '';

  programs.forEach(program => {
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'program';
    input.id = `program-${program.sort}`;
    input.value = program.title;
    input.hidden = true;

    const span = document.createElement('span');
    span.textContent = program.title;

    const label = document.createElement('label');
    label.classList.add('menu-button', 'program');
    label.setAttribute('for', `program-${program.sort}`);
    label.setAttribute('data-program-id', program.id);
    label.appendChild(input);
    label.appendChild(span);

    // Добавляем обработчик клика
    label.addEventListener('click', () => {
      setActiveProgram(program);
    });

    wrapper.appendChild(label);
  });
};

/**
 * Отрендерить кнопки целей
 */
const renderTargetButtons = (programs) => {
  const wrapper = blockTarget?.querySelector('.target-buttons-wrapper');
  if (!wrapper) return;

  // Очищаем существующие кнопки
  wrapper.innerHTML = '';

  programs.forEach(program => {
    const button = document.createElement('div');
    button.classList.add('target-button');
    button.setAttribute('data-program-id', program.id);

    const emoji = document.createElement('span');
    emoji.classList.add('target-button-emoji');
    emoji.textContent = program.emoji;

    const text = document.createElement('span');
    text.classList.add('target-button-text');
    text.textContent = program.slogan;

    button.appendChild(emoji);
    button.appendChild(text);

    // Добавляем обработчик клика
    button.addEventListener('click', () => {
      setActiveProgram(program);
    });

    wrapper.appendChild(button);
  });
};

/**
 * Отрендерить слайдер программ
 */
const renderProgramSlider = (programs) => {
  const swiperWrapper = document.querySelector('.swiper-programm .swiper-wrapper');
  if (!swiperWrapper) return;

  // Очищаем существующие слайды
  swiperWrapper.innerHTML = '';

  programs.forEach(program => {
    const slide = document.createElement('div');
    slide.classList.add('swiper-slide');

    const wrapper = document.createElement('div');
    wrapper.classList.add('program-info-wrapper');
    wrapper.setAttribute('data-type', 'slider');
    wrapper.setAttribute('data-program-id', program.id);

    const logo = document.createElement('div');
    logo.classList.add('program-logo', 'menu-program-logo');
    logo.innerHTML = `
      <span class="program-logo-emoji">${program.emoji}</span>
      <span class="program-logo-text">${program.slogan}</span>
    `;

    const title = document.createElement('h2');
    title.classList.add('program-title-text');
    title.textContent = program.title;

    const text = document.createElement('div');
    text.classList.add('program-content-text');
    text.textContent = program.description;

    const button = document.createElement('a');
    button.classList.add('menu-button', 'summary-button');
    button.setAttribute('href', '#popup:calc');
    button.textContent = 'Калькулятор калорий';

    wrapper.appendChild(logo);
    wrapper.appendChild(title);
    wrapper.appendChild(text);
    wrapper.appendChild(button);
    slide.appendChild(wrapper);
    swiperWrapper.appendChild(slide);
  });

  // Инициализируем Swiper
  if (typeof Swiper !== 'undefined') {
    swiperProgramm = new Swiper('.swiper-programm', {
      autoplay: false,
      loop: true,
      navigation: {
        nextEl: '.swiper-button-next',
        prevEl: '.swiper-button-prev',
      },
      slidesPerView: 1,
      on: {
        slideChange: function () {
          // Используем флаг, чтобы избежать циклических вызовов
          if (this.params.programmaticSlide) {
            this.params.programmaticSlide = false;
            return;
          }

          setTimeout(() => {
            const activeSlide = this.slides[this.activeIndex];
            const programId = activeSlide.querySelector('.program-info-wrapper')?.getAttribute('data-program-id');
            if (programId) {
              const program = window.menuData.programs.find(p => p.id === parseInt(programId));
              if (program && window.currentProgram?.id !== program.id) {
                setActiveProgram(program);
              }
            }
          }, 20);
        }
      }
    });
  }
};

/**
 * Обновить информацию о программе в summary блоке
 */
const updateProgramSummary = (program) => {
  if (!program) return;

  // Обновляем лого и название
  document.querySelectorAll('.program-logo-emoji').forEach(el => {
    el.textContent = program.emoji;
  });

  document.querySelectorAll('.program-logo-text').forEach(el => {
    el.textContent = program.slogan;
  });

  document.querySelectorAll('.program-title-text').forEach(el => {
    el.textContent = program.title;
    el.setAttribute('data-program-id', program.id);
  });

  // Обновляем характеристики
  const caloriesText = program.nutrition.caloriesFrom && program.nutrition.caloriesTo
    ? `${program.nutrition.caloriesFrom}-${program.nutrition.caloriesTo}`
    : '';

  document.querySelectorAll('.program-title-descr.calories').forEach(el => {
    el.textContent = caloriesText;
  });

  const bjuText = program.nutrition.proteins && program.nutrition.fats && program.nutrition.carbohydrates
    ? `${program.nutrition.proteins}/${program.nutrition.fats}/${program.nutrition.carbohydrates} б/ж/у`
    : '';

  document.querySelectorAll('.program-title-descr.bju').forEach(el => {
    el.textContent = bjuText;
  });

  document.querySelectorAll('.program-title-descr.count span').forEach(el => {
    el.textContent = program.dishesPerDay;
  });

  document.querySelectorAll('.program-content-text.text').forEach(el => {
    el.textContent = program.description;
  });

  // Обновляем кнопки дней и цены
  renderDaysButtons(program);
};

/**
 * Отрендерить кнопки выбора количества дней
 */
const renderDaysButtons = (program) => {
  const daysForm = document.querySelector('.program-days-form');
  if (!daysForm) return;

  // Очищаем существующие кнопки
  daysForm.innerHTML = '';

  // Получаем цены для текущего города
  const prices = getProgramPrices(program);

  // Пытаемся найти сохраненный выбор в текущей программе
  let selectedPrice = null;
  if (window.selectedDays) {
    selectedPrice = prices.find(p => p.days === window.selectedDays);
  }
  // Если не нашли или не было выбора, берем первый
  if (!selectedPrice && prices.length > 0) {
    selectedPrice = prices[0];
  }

  prices.forEach((price, index) => {
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'days';
    input.id = `days-${index + 1}`;
    input.value = price.price;
    input.hidden = true;

    const label = document.createElement('label');
    label.classList.add('menu-button', 'days');
    label.setAttribute('for', `days-${index + 1}`);
    label.setAttribute('data-days-count', price.days);
    // label.textContent = price.label;
    label.appendChild(input);

    // Обработчик клика
    label.addEventListener('click', () => {
      // Сохраняем выбранное количество дней
      window.selectedDays = price.days;
      updatePriceSummary(price);
      document.querySelectorAll('.menu-button.days').forEach(btn => btn.classList.remove('active'));
      label.classList.add('active');
    });

    daysForm.appendChild(label);

    // Выбираем сохраненную или первую опцию
    if (selectedPrice && price.days === selectedPrice.days) {
      input.checked = true;
      label.classList.add('active');
      updatePriceSummary(price);
      window.selectedDays = price.days;
    }
  });
};

/**
 * Обновить информацию о цене
 */
const updatePriceSummary = (price) => {
  const wrapper = document.querySelector('.program-amount-wrapper');
  if (!wrapper) return;

  const currentEl = wrapper.querySelector('.program-amount.current');
  const oldEl = wrapper.querySelector('.program-amount.old');
  const discountEl = wrapper.querySelector('.program-amount.discount');
  const dayPriceEl = wrapper.querySelector('.program-amount.day-price');

  if (currentEl) currentEl.textContent = addRubleSymbol(price.price);
  if (dayPriceEl) dayPriceEl.textContent = addRubleSymbol(price.pricePerDay) + ' в день';

  if (price.oldPrice) {
    wrapper.classList.add('has-discount');
    if (oldEl) {
      oldEl.textContent = addRubleSymbol(price.oldPrice);
      oldEl.style.display = '';
    }
    if (discountEl) {
      discountEl.textContent = addRubleSymbol(price.price - price.oldPrice);
      discountEl.style.display = '';
    }
  } else {
    wrapper.classList.remove('has-discount');
    if (oldEl) oldEl.style.display = 'none';
    if (discountEl) discountEl.style.display = 'none';
  }
};

/**
 * Установить активную программу
 */
const setActiveProgram = (program) => {
  if (!program) return;

  window.currentProgram = program;

  // Обновляем активные классы кнопок программ
  document.querySelectorAll('.menu-button.program').forEach(btn => {
    btn.classList.remove('active');
    if (btn.getAttribute('data-program-id') == program.id) {
      btn.classList.add('active');
    }
  });

  // Обновляем активные классы кнопок целей
  document.querySelectorAll('.target-button').forEach(btn => {
    btn.classList.remove('active');
    if (btn.getAttribute('data-program-id') == program.id) {
      btn.classList.add('active');
    }
  });

  // Обновляем summary блок
  updateProgramSummary(program);

  // Активируем кнопку корзины
  summaryCartBtnListen(true);

  // Переключаем слайдер (если он уже не на нужном слайде)
  if (swiperProgramm) {
    const index = program.sort - 1;
    const currentRealIndex = swiperProgramm.realIndex;

    if (currentRealIndex !== index) {
      // Устанавливаем флаг, чтобы slideChange не вызывал setActiveProgram
      swiperProgramm.params.programmaticSlide = true;
      swiperProgramm.slideToLoop(index);
    }
  }

  // Загружаем блюда для выбранной программы
  const select = document.querySelector('select[name="week"]');
  const currentWeek = select ? parseInt(select.value) : null;
  loadAndRenderDishes(program.id, currentWeek);
};

/**
 * Переключить отображаемую неделю
 */
const switchWeek = (weekNumber) => {
  const programWrapper = document.querySelector('.program-wrapper');
  if (!programWrapper) return;

  // Скрываем все недели
  const allWeeks = programWrapper.querySelectorAll('.week-wrapper');
  allWeeks.forEach(week => week.classList.add('hidden'));

  // Показываем выбранную неделю
  const selectedWeek = programWrapper.querySelector(`.week-wrapper[data-week-number="${weekNumber}"]`);
  if (selectedWeek) {
    selectedWeek.classList.remove('hidden');
  }
};

/**
 * Отрендерить селект недель
 */
const renderWeekSelect = () => {
  const select = document.querySelector('select[name="week"]');
  if (!select) return;

  // Включаем селект, если он был disabled
  select.disabled = false;

  select.innerHTML = '';

  // Определяем текущую неделю
  const currentWeek = window.menuData && window.menuData.currentCity
    ? getCurrentWeekInCycle(window.menuData.currentCity.startedAt)
    : 1;

  for (let i = 1; i <= 4; i++) {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = `${i} неделя`;
    if (i === currentWeek) {
      option.selected = true;
    }
    select.appendChild(option);
  }

  // Удаляем старые обработчики перед добавлением нового
  const newSelect = select.cloneNode(true);
  select.parentNode.replaceChild(newSelect, select);

  // Устанавливаем выбранную неделю после клонирования
  newSelect.value = currentWeek;

  // Добавляем обработчик изменения недели
  newSelect.addEventListener('change', (e) => {
    const weekNumber = parseInt(e.target.value);
    switchWeek(weekNumber);
  });
};

/**
 * Отрендерить карточку блюда
 */
const renderDishCard = (dish) => {
  const card = document.createElement('div');
  card.classList.add('dish-card');
  card.id = `dish-${dish.id}`;
  card.style.cursor = 'pointer';

  const image = document.createElement('div');
  image.classList.add('dish-card-image');

  // Lazy loading для изображений
  if (dish.image) {
    if (imageObserver) {
      // Используем lazy loading через Intersection Observer
      image.setAttribute('data-lazy-bg', dish.image);
      imageObserver.observe(image);
    } else {
      // Fallback: загружаем сразу если Observer не поддерживается
      image.style.backgroundImage = `url(${dish.image})`;
    }
  }

  const content = document.createElement('div');
  content.classList.add('dish-card-content');

  const name = document.createElement('h5');
  name.classList.add('dish-card-name');
  name.textContent = dish.title;

  const ingredients = document.createElement('div');
  ingredients.classList.add('dish-card-ingredients');
  // Выводим массив ингредиентов через запятую (без количества)
  if (dish.ingredients && dish.ingredients.length > 0) {
    ingredients.textContent = dish.ingredients.join(', ');
  } else {
    ingredients.textContent = 'Нет информации об ингредиентах';
  }

  const nutrition = document.createElement('div');
  nutrition.classList.add('dish-card-nutrition');

  if (dish.nutrition && dish.nutrition.calories > 0) {
    const nutritionText = `на 100 г: ${dish.nutrition.calories} ккал, ${dish.nutrition.proteins}/${dish.nutrition.fats}/${dish.nutrition.carbohydrates} б/ж/у`;
    nutrition.textContent = nutritionText;
  } else {
    nutrition.textContent = 'Нет данных о питательности';
  }

  content.appendChild(name);
  content.appendChild(ingredients);
  content.appendChild(nutrition);

  card.appendChild(image);
  card.appendChild(content);

  // Делаем всю карточку кликабельной
  card.addEventListener('click', () => {
    showDishModal(dish);
  });

  return card;
};

/**
 * Показать модальное окно с составом блюда
 */
const showDishModal = (dish) => {
  // Проверяем, есть ли уже dialog, если есть - удаляем
  const existingDialog = document.querySelector('#dish-dialog ');
  if (existingDialog) {
    existingDialog.remove();
  }

  // Создаем элемент dialog
  const dialog = document.createElement('dialog');
  dialog.id = 'dish-dialog';

  const closeButton = document.createElement('button');
  closeButton.classList.add('dish-dialog-close');

  // Создаём элемент SVG
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('height', '24px');
  svg.setAttribute('viewBox', '0 -960 960 960');
  svg.setAttribute('width', '24px');
  svg.setAttribute('fill', '#121212');

  // Создаём элемент path и задаём атрибут d
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M480-424 284-228q-11 11-28 11t-28-11q-11-11-11-28t11-28l196-196-196-196q-11-11-11-28t11-28q11-11 28-11t28 11l196 196 196-196q11-11 28-11t28 11q11 11 11 28t-11 28L536-480l196 196q11 11 11 28t-11 28q-11 11-28 11t-28-11L480-424Z');

  // Добавляем path в SVG
  svg.appendChild(path);

  // Добавляем SVG в кнопку
  closeButton.appendChild(svg);

  // Обработчик закрытия диалога
  closeButton.addEventListener('click', () => {
    dialog.close();
    dialog.remove();
  });

  const title = document.createElement('h3');
  title.classList.add('dish-dialog-title');
  title.textContent = dish.title;

  // Изображение блюда
  if (dish.image) {
    const image = document.createElement('div');
    image.classList.add('dish-dialog-image');
    const img = document.createElement('img');
    img.src = dish.image;
    img.alt = dish.title;
    image.appendChild(img);
    dialog.appendChild(closeButton);
    dialog.appendChild(title);
    dialog.appendChild(image);
  } else {
    dialog.appendChild(closeButton);
    dialog.appendChild(title);
  }

  // Секция состава
  const ingredientsSection = document.createElement('div');
  ingredientsSection.classList.add('dish-dialog-section');

  const ingredientsTitle = document.createElement('h4');
  ingredientsTitle.textContent = 'Состав:';

  const ingredientsText = document.createElement('p');
  ingredientsText.classList.add('dish-dialog-ingredients');
  ingredientsText.textContent = dish.ingredients.join(', ') ||dish.ingredientsText || 'Нет информации';

  ingredientsSection.appendChild(ingredientsTitle);
  ingredientsSection.appendChild(ingredientsText);
  dialog.appendChild(ingredientsSection);

  // Пищевая ценность
  if (dish.nutrition && dish.nutrition.calories > 0) {
    const nutritionSection = document.createElement('div');
    nutritionSection.classList.add('dish-dialog-section');

    const nutritionTitle = document.createElement('h4');
    nutritionTitle.textContent = 'Пищевая ценность на 100 г:';

    const nutritionGrid = document.createElement('div');
    nutritionGrid.classList.add('dish-dialog-nutrition-grid');

    const nutritionItems = [
      { label: 'Калорийность', value: `${dish.nutrition.calories} ккал` },
      { label: 'Белки', value: `${dish.nutrition.proteins} г` },
      { label: 'Жиры', value: `${dish.nutrition.fats} г` },
      { label: 'Углеводы', value: `${dish.nutrition.carbohydrates} г` }
    ];

    nutritionItems.forEach(item => {
      const itemDiv = document.createElement('div');
      itemDiv.classList.add('dish-dialog-nutrition-item');

      const itemLabel = document.createElement('span');
      itemLabel.classList.add('dish-dialog-nutrition-label');
      itemLabel.textContent = item.label;

      const itemValue = document.createElement('span');
      itemValue.classList.add('dish-dialog-nutrition-value');
      itemValue.textContent = item.value;

      itemDiv.appendChild(itemLabel);
      itemDiv.appendChild(itemValue);
      nutritionGrid.appendChild(itemDiv);
    });

    nutritionSection.appendChild(nutritionTitle);
    nutritionSection.appendChild(nutritionGrid);
    dialog.appendChild(nutritionSection);
  }

  // Общий вес блюда
  if (dish.totalWeight) {
    const weightInfo = document.createElement('p');
    weightInfo.classList.add('dish-dialog-weight');
    weightInfo.textContent = `Общий вес блюда: ${dish.totalWeight} г`;
    dialog.appendChild(weightInfo);
  }

  // Добавляем dialog в body
  document.body.appendChild(dialog);

  // Открываем модальное окно
  dialog.showModal();

  // Закрытие по клику на backdrop
  dialog.addEventListener('click', (e) => {
    const rect = dialog.getBoundingClientRect();
    if (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    ) {
      dialog.close();
      dialog.remove();
    }
  });

  // Удаляем dialog после закрытия
  dialog.addEventListener('close', () => {
    dialog.remove();
  });
};

/**
 * Получить текст даты для дня
 */
const getDayDateText = (startDate, weekNumber, dayNumber) => {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Вычисляем количество дней с момента старта
  const diffTime = today.getTime() - start.getTime();
  const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

  // Количество полных 4-недельных циклов (CYCLE_IN_DAYS по умолчанию 28 дней)
  const fullCycles = Math.floor(diffDays / CYCLE_IN_DAYS);

  // Вычисляем день с учётом текущего цикла
  const dayToAdd = fullCycles * CYCLE_IN_DAYS + (weekNumber - 1) * 7 + dayNumber - 1;

  const currentDate = new Date(start);
  currentDate.setDate(start.getDate() + dayToAdd);

  const months = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
  ];

  const day = currentDate.getDate();
  const month = months[currentDate.getMonth()];
  const year = currentDate.getFullYear();

  return `Рацион питания на ${day} ${month} ${year} года`;
};

/**
 * Загрузить и отобразить блюда для программы
 */
const loadAndRenderDishes = async (programId, weekNumber = null) => {
  try {
    const contentWrapper = document.querySelector('.content-wrapper');
    if (!contentWrapper) return;

    // Показываем индикатор загрузки
    contentWrapper.innerHTML = '<div class="loading">Загрузка блюд...</div>';

    const program = window.menuData.programs.find(p => p.id === programId);
    if (!program) return;

    // Определяем текущую неделю, если не указана
    const currentWeek = weekNumber || getCurrentWeekInCycle(program.startedAt || window.menuData.currentCity.startedAt);

    // Загружаем блюда
    const dishesData = await getProgramDishes(programId);

    // console.log('Полученные данные блюд:', dishesData);

    if (!dishesData || !dishesData.dishes || dishesData.dishes.length === 0) {
      contentWrapper.innerHTML = '<div class="no-dishes">Блюда для этой программы пока не добавлены</div>';
      return;
    }

    // Группируем блюда по неделям и дням
    const dishesByWeek = {};
    dishesData.dishes.forEach(dish => {
      // console.log('Обработка блюда:', dish.title, {
      //   ingredients: dish.ingredients,
      //   ingredientsText: dish.ingredientsText,
      //   nutrition: dish.nutrition,
      //   totalWeight: dish.totalWeight,
      //   image: dish.image,
      //   weekNumber: dish.weekNumber,
      //   dayOfWeek: dish.dayOfWeek
      // });
      const week = dish.weekNumber || 1;
      const day = dish.dayOfWeek || 1;

      if (!dishesByWeek[week]) {
        dishesByWeek[week] = {};
      }
      if (!dishesByWeek[week][day]) {
        dishesByWeek[week][day] = [];
      }
      dishesByWeek[week][day].push(dish);
    });

    // Создаем обертку для программы
    const programWrapper = document.createElement('div');
    programWrapper.classList.add('program-wrapper');
    programWrapper.id = `program-${programId}`;

    // Создаем обертки для недель
    for (let w = 1; w <= 4; w++) {
      const weekWrapper = document.createElement('div');
      weekWrapper.classList.add('week-wrapper');
      weekWrapper.setAttribute('data-week-number', w);

      // Скрываем неактивные недели
      if (w !== currentWeek) {
        weekWrapper.classList.add('hidden');
      }

      // Создаем дни для каждой недели
      for (let d = 1; d <= 7; d++) {
        const dayWrapper = document.createElement('div');
        dayWrapper.classList.add('day-wrapper');
        dayWrapper.setAttribute('data-day-number', d);

        const dayTitle = document.createElement('div');
        dayTitle.classList.add('day-title');
        dayTitle.textContent = getDayDateText(
          program.startedAt || window.menuData.currentCity.startedAt,
          w,
          d
        );

        const dishesWrapper = document.createElement('div');
        dishesWrapper.classList.add('dishes-wrapper');

        // Добавляем блюда для этого дня
        if (dishesByWeek[w] && dishesByWeek[w][d]) {
          dishesByWeek[w][d]
            .sort((a, b) => (a.dishNumber || 0) - (b.dishNumber || 0))
            .forEach(dish => {
              const dishCard = renderDishCard(dish);
              dishesWrapper.appendChild(dishCard);
            });
        }

        dayWrapper.appendChild(dayTitle);
        dayWrapper.appendChild(dishesWrapper);
        weekWrapper.appendChild(dayWrapper);
      }

      programWrapper.appendChild(weekWrapper);
    }

    contentWrapper.innerHTML = '';
    contentWrapper.appendChild(programWrapper);

  } catch (error) {
    console.error('Ошибка при загрузке блюд:', error);
    const contentWrapper = document.querySelector('.content-wrapper');
    if (contentWrapper) {
      contentWrapper.innerHTML = '<div class="error">Не удалось загрузить блюда</div>';
    }
  }
};

// ====================
// ИНИЦИАЛИЗАЦИЯ
// ====================

/**
 * Инициализация приложения
 */
const initApp = async () => {
  try {
    // Инициализируем Intersection Observer для lazy loading изображений
    imageObserver = initImageObserver();

    // console.log('Загрузка данных меню...');

    // Получаем все данные
    window.menuData = await getMenuData();

    // console.log('Данные получены:', window.menuData);

    // Рендерим UI
    renderProgramButtons(window.menuData.programs);
    renderTargetButtons(window.menuData.programs);
    renderProgramSlider(window.menuData.programs);
    renderWeekSelect();

    // Устанавливаем первую программу как активную
    if (window.menuData.programs.length > 0) {
      setActiveProgram(window.menuData.programs[0]);
    }

    // console.info('Приложение инициализировано');

  } catch (error) {
    console.error('Ошибка при инициализации:', error);

    // Показываем сообщение об ошибке пользователю
    const errorMessage = document.createElement('div');
    errorMessage.style.cssText = 'padding: 20px; background: #ffebee; color: #c62828; text-align: center;';
    errorMessage.textContent = 'Не удалось загрузить данные меню. Пожалуйста, обновите страницу.';

    const menuElement = document.getElementById('menu');
    if (menuElement) {
      menuElement.prepend(errorMessage);
    }
  }
};

// Запускаем приложение после загрузки DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

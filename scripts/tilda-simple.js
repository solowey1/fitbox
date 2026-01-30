/**
 * Упрощенный скрипт для Tilda
 * Использует единый эндпоинт /api/tilda/menu для получения всех данных
 */

// ====================
// КОНФИГУРАЦИЯ
// ====================
const API_BASE_URL = 'https://fitbox.necodim.ru/api';

// DOM элементы
const blockMenu = document.getElementById('menu');
const blockTarget = document.getElementById('target');

// Глобальные переменные
window.menuData = null;
window.currentProgram = null;
let swiperProgramm = null;

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
 * Вычислить текущую неделю в цикле
 */
const getCurrentWeekInCycle = (startDate) => {
  const start = new Date(startDate);
  const today = new Date();
  const diffTime = today.getTime() - start.getTime();

  if (diffTime < 0) return 1;

  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const weekInCycle = Math.floor(diffDays / 7) % 4 + 1;

  return weekInCycle;
};

/**
 * Вычислить текущий день в цикле
 */
const getCurrentDayInCycle = (startDate) => {
  const start = new Date(startDate);
  const today = new Date();
  const diffTime = today.getTime() - start.getTime();

  if (diffTime < 0) return 1;

  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
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

  program.prices.forEach((price, index) => {
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
    label.textContent = price.label;
    label.appendChild(input);

    // Обработчик клика
    label.addEventListener('click', () => {
      updatePriceSummary(price);
      document.querySelectorAll('.menu-button.days').forEach(btn => btn.classList.remove('active'));
      label.classList.add('active');
    });

    daysForm.appendChild(label);
  });

  // Выбираем первую цену по умолчанию
  if (program.prices.length > 0) {
    const firstLabel = daysForm.querySelector('label');
    const firstInput = daysForm.querySelector('input');
    if (firstLabel && firstInput) {
      // Программно выбираем первую опцию без триггера события клика
      firstInput.checked = true;
      firstLabel.classList.add('active');
      updatePriceSummary(program.prices[0]);
    }
  }
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

  select.innerHTML = '';

  for (let i = 1; i <= 4; i++) {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = `${i} неделя`;
    select.appendChild(option);
  }

  // Устанавливаем текущую неделю
  if (window.menuData && window.menuData.currentCity) {
    const currentWeek = getCurrentWeekInCycle(window.menuData.currentCity.startedAt);
    select.value = currentWeek;
  }

  // Удаляем старые обработчики перед добавлением нового
  const newSelect = select.cloneNode(true);
  select.parentNode.replaceChild(newSelect, select);

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

  const image = document.createElement('div');
  image.classList.add('dish-card-image');
  if (dish.image) {
    image.style.backgroundImage = `url(${dish.image})`;
  }
  image.setAttribute('loading', 'lazy');

  const content = document.createElement('div');
  content.classList.add('dish-card-content');

  const name = document.createElement('h5');
  name.classList.add('dish-card-name');
  name.textContent = dish.title;

  const ingredients = document.createElement('div');
  ingredients.classList.add('dish-card-ingredients');
  ingredients.textContent = dish.ingredientsText || 'Нет информации';

  const calories = document.createElement('div');
  calories.classList.add('dish-card-calories');
  calories.textContent = dish.calories ? `${dish.calories} ккал` : '';

  content.appendChild(name);
  content.appendChild(ingredients);
  content.appendChild(calories);

  card.appendChild(image);
  card.appendChild(content);

  return card;
};

/**
 * Получить текст даты для дня
 */
const getDayDateText = (startDate, weekNumber, dayNumber) => {
  const start = new Date(startDate);
  const dayToAdd = (weekNumber - 1) * 7 + dayNumber - 1;

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

    console.log('Полученные данные блюд:', dishesData);

    if (!dishesData || !dishesData.dishes || dishesData.dishes.length === 0) {
      contentWrapper.innerHTML = '<div class="no-dishes">Блюда для этой программы пока не добавлены</div>';
      return;
    }

    // Группируем блюда по неделям и дням
    const dishesByWeek = {};
    dishesData.dishes.forEach(dish => {
      console.log('Обработка блюда:', dish.title, {
        ingredientsText: dish.ingredientsText,
        calories: dish.calories,
        weekNumber: dish.weekNumber,
        dayOfWeek: dish.dayOfWeek
      });
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
    console.log('Загрузка данных меню...');

    // Получаем все данные
    window.menuData = await getMenuData();

    console.log('Данные получены:', window.menuData);

    // Рендерим UI
    renderProgramButtons(window.menuData.programs);
    renderTargetButtons(window.menuData.programs);
    renderProgramSlider(window.menuData.programs);
    renderWeekSelect();

    // Устанавливаем первую программу как активную
    if (window.menuData.programs.length > 0) {
      setActiveProgram(window.menuData.programs[0]);
    }

    console.log('Приложение инициализировано');

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

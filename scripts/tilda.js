// ====================
// КОНФИГУРАЦИЯ API
// ====================
const API_BASE_URL = 'https://fitbox.necodim.ru/api';

// Стандартные настройки при загрузке страницы (выбранные программа и количество дней)
const defaultSettings = {
  program: 'Офис',
  days: 7,
  maxDays: 7,
  maxWeeks: 4,
};

// Города
const CITY = {
  KAZAN: 'Казань',
  SAMARA: 'Самара',
  TOLYATTI: 'Тольятти',
  DMITROVGRAD: 'Дмитровград',
  ULYANOVSK: 'Ульяновск',
};

// Данные о городах
const CITIES = {
  [CITY.KAZAN]: {
    subdomain: 'kzn',
  },
  [CITY.SAMARA]: {
    subdomain: 'smr',
  },
  [CITY.TOLYATTI]: {
    subdomain: 'tlt',
  },
  [CITY.DMITROVGRAD]: {
    subdomain: 'dmt',
  },
  [CITY.ULYANOVSK]: {
    subdomain: '',
  },
};

const CONFIG_PROGRAMM = {
  classname: 'swiper-programm',
}

window.programs = new Array();
const blockMenu = document.getElementById('menu');
const blockTarget = document.getElementById('target');
let swiperProgramm;
let _program = new Object();

Object.defineProperty(window, 'program', {
  get: function () {
    return _program;
  },
  set: function (currentProgram) {
    if (_program !== currentProgram) {
      targetActivate(currentProgram);
      swiperGoTo(currentProgram);
      programBtnActivate(currentProgram);
      _program = currentProgram;
    }
  }
});

const createImageFrom = (selector) => {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (!element) {
      reject('Элемент не найден');
      return;
    }

    html2canvas(element, { logging: true, letterRendering: 1, useCORS: true })
      .then(canvas => {
        resolve(canvas.toDataURL('image/png'));
      })
      .catch(error => {
        reject('Ошибка при создании изображения: ' + error.message);
      });
  });
}

const scrollToElement = (elementOrSelector) => {
  const element = elementOrSelector instanceof HTMLElement ? elementOrSelector : document.querySelector(elementOrSelector);
  if (element) {
    element.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }
}

// Функция для прокрутки к текущему дню
const scrollToCurrentDay = (weekNumber, dayNumber) => {
  // Находим нужную неделю
  const weekWrapper = document.querySelector(`.week-wrapper[data-week-number="${weekNumber}"]`);

  if (!weekWrapper) {
    console.warn(`Неделя ${weekNumber} не найдена`);
    return false;
  }

  // Находим нужный день относительно даты старта
  const currentDayNumber = getCurrentDayInCycle(window.programs[0].start);
  const dayWrapper = weekWrapper.querySelector(`.day-wrapper[data-day-number="${currentDayNumber}"]`);

  if (!dayWrapper) {
    console.warn(`День ${currentDayNumber} не найден в неделе ${weekNumber}`);
    return false;
  }

  // Прокручиваем к элементу
  setTimeout(() => {
    dayWrapper.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'center'
    });
  }, 250);

  return true;
}

const getVisibleElement = (selector) => {
  const elements = document.querySelectorAll(selector);
  let visibleElement;

  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    if (isElementInViewport(element)) {
      if (!visibleElement) {
        visibleElement = element;
      }
    }
  }

  return visibleElement;
}

const isElementInViewport = (element) => {
  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

const getMaxValue = (programs, key) => {
  const allDishes = programs.flatMap(item => item.dishes);
  const maxKeyValue = allDishes.reduce((max, dish) => dish[key] > max ? dish[key] : max, allDishes[0][key]);
  return maxKeyValue;
}

// ====================
// API ФУНКЦИИ
// ====================

const apiFetch = async (endpoint) => {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'GET',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Ошибка при запросе к API:', error);
    throw error;
  }
}

const getCities = async () => {
  try {
    const cities = await apiFetch('/cities');
    return cities;
  } catch (error) {
    console.error('Ошибка при получении городов:', error);
    return [];
  }
}

const getPrograms = async () => {
  try {
    const programs = await apiFetch('/programs');
    return programs;
  } catch (error) {
    console.error('Ошибка при получении программ питания:', error);
    return [];
  }
}

const getProgramWithPrices = async (programId) => {
  try {
    const program = await apiFetch(`/programs/${programId}/prices`);
    return program;
  } catch (error) {
    console.error(`Ошибка при получении цен для программы ${programId}:`, error);
    return null;
  }
}

const getDishes = async (programId) => {
  try {
    const response = await apiFetch(`/tilda/menu/${programId}/dishes`);
    return response.dishes || [];
  } catch (error) {
    console.error(`Ошибка при получении блюд для программы ${programId}:`, error);
    return [];
  }
}

const setPrograms = async () => {
  try {
    const programs = await getPrograms();
    const transformedPrograms = await transformProgramsData(programs);
    window.programs = transformedPrograms;

    const firstProgram = window.programs.find(program => program.sort === 2);
    _program = firstProgram || window.programs[0];
    return transformedPrograms;
  } catch (error) {
    console.error(`Ошибка при составлении массива всех программ:`, error);
    return [];
  }
}

const setDishes = async (programId) => {
  try {
    const dishes = await getDishes(programId);
    const transformedDishes = await transformDishesData(dishes);
    return transformedDishes;
  } catch (error) {
    console.error(`Ошибка при составлении данных блюд для программы ${programId}:`, error);
    return [];
  }
}

// ====================
// ТРАНСФОРМАЦИЯ ДАННЫХ
// ====================

const transformProgramsData = async (programs) => {
  const result = [];

  // Получаем город для определения даты старта
  const cities = await getCities();
  const currentCity = getCityNameBySubdomain();
  const cityData = cities.find(city => city.title === currentCity);

  for (const program of programs) {
    // Получаем полную информацию с ценами
    const programWithPrices = await getProgramWithPrices(program.id);

    // Формируем описание калорийности
    const caloriesText = programWithPrices.data?.calories_from && programWithPrices.data?.calories_to
      ? `${programWithPrices.data.calories_from}-${programWithPrices.data.calories_to}`
      : '';

    // Формируем БЖУ
    const bjuText = programWithPrices.data?.proteins && programWithPrices.data?.fats && programWithPrices.data?.carbohydrates
      ? `${programWithPrices.data.proteins}/${programWithPrices.data.fats}/${programWithPrices.data.carbohydrates} б/ж/у`
      : '';

    // Определяем количество блюд в день (берем из первой цены или дефолтное значение)
    const dishesCount = getDishesCountByProgram(program.title);

    const transformedProgram = {
      id: programWithPrices.id,
      name: programWithPrices.title,
      info: {
        emoji: programWithPrices.emoji || '',
        slogan: getProgramSlogan(programWithPrices.title),
        calories: caloriesText,
        text: getProgramDescription(programWithPrices.title),
        bju: bjuText,
        count: dishesCount
      },
      sort: programWithPrices.sort,
      prices: transformPrices(programWithPrices.prices || []),
      start: cityData?.started_at || programWithPrices.cities?.[0]?.started_at || new Date().toISOString(),
    };

    result.push(transformedProgram);
  }

  return result.sort((a, b) => a.sort - b.sort);
}

const transformPrices = (prices) => {
  return prices.map(price => ({
    amount: {
      current: parseFloat(price.price),
      old: price.old_price ? parseFloat(price.old_price) : null,
    },
    days: price.days,
    text: price.days === 1 ? 'Пробный день' : `${price.days} дней`
  }));
}

const transformDishesData = (dishes) => {
  return dishes.map(dish => {
    // API возвращает уже готовый URL изображения или null
    const imageUrl = dish.image || '';
    const caloriesText = dish.calories ? `${dish.calories} ккал` : '';

    return {
      'id': dish.id,
      'image': imageUrl,
      'name': dish.title || '',
      'ingredients': dish.ingredientsText || 'Нет информации',
      'calories': caloriesText,
      'week': dish.weekNumber || 1,
      'day': dish.dayOfWeek || 1,
      'number': dish.dishNumber || 1,
    };
  });
}

// ====================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ====================

const getProgramSlogan = (programName) => {
  const slogans = {
    'Офис': 'Кушай на работе',
    'Баланс': 'Баланс во всём',
    'Фитнес': 'Будь в форме',
    'Классик мини': 'Оптимальный выбор',
    'Классик': 'Классика вкуса',
    'Классик +': 'Максимум энергии'
  };
  return slogans[programName] || '';
}

const getProgramDescription = (programName) => {
  const descriptions = {
    'Офис': 'Трехразовое питание на 800-900 ккал/день разнообразит ваш привычный рацион и поможет избежать ежедневных вопросов «что бы сегодня поесть?»',
    'Баланс': 'Сбалансированное питание для поддержания веса и хорошего самочувствия',
    'Фитнес': 'Идеально подходит для тех, кто ведет активный образ жизни и следит за фигурой',
    'Классик мини': 'Полноценное питание с оптимальной калорийностью',
    'Классик': 'Классическое пятиразовое питание для поддержания активности в течение дня',
    'Классик +': 'Усиленное питание для людей с высокими энергетическими затратами'
  };
  return descriptions[programName] || '';
}

const getDishesCountByProgram = (programName) => {
  const counts = {
    'Офис': 3,
    'Баланс': 4,
    'Фитнес': 4,
    'Классик мини': 4,
    'Классик': 5,
    'Классик +': 6
  };
  return counts[programName] || 3;
}

const getCityNameBySubdomain = (subdomain = null) => {
  // Если субдомен не передан, извлекаем его из window.location
  if (subdomain === null) {
    if (typeof window === 'undefined') {
      console.warn('window.location недоступен в этой среде');
      return CITY.ULYANOVSK; // По умолчанию возвращаем Ульяновск
    }

    const hostname = window.location.hostname;
    // Извлекаем поддомен (первая часть до первой точки)
    const parts = hostname.split('.');
    subdomain = parts.length > 2 ? parts[0] : '';
  }

  // Находим город по поддомену
  const cityName = Object.keys(CITIES).find(city =>
    CITIES[city].subdomain === subdomain
  );

  return cityName || CITY.ULYANOVSK;
}

const targetActivate = (program) => {
  const targetBtns = blockTarget.querySelectorAll('.target-button');
  targetBtns.forEach(btn => btn.classList.remove('active'));
  setTimeout(() => {
    const currentButton = blockTarget.querySelector(`.target-button[data-program-id="${program.id}"]`);
    currentButton && currentButton.classList.add('active');
    setSummary();
  });
}

const swiperGoTo = (program) => {
  const index = program.sort - 1;
  swiperProgramm.slideToLoop(index);
}

const programBtnActivate = (program) => {
  const programBtns = blockMenu.querySelectorAll('.menu-button.program');
  programBtns.forEach(btn => btn.classList.remove('active'));
  setTimeout(() => {
    const currentButton = blockMenu.querySelector(`.menu-button.program[data-program-id="${program.id}"]`);
    currentButton && currentButton.classList.add('active');
    setSummary();
  });
}

const getProgramById = (id) => {
  const program = window.programs.find(program => program.id === parseInt(id));
  return program;
}

const getCurrentProgramId = () => {
  const labelProgram = document.querySelector('.menu-button.program.active');
  if (labelProgram) {
    const programId = labelProgram.getAttribute('data-program-id');
    return programId;
  }
  return null;
}

const getProgramWrapper = () => {
  const currentProgramWrapper = document.getElementById(window.program.id);
  return currentProgramWrapper;
}

const getWeekNumber = () => {
  const currentWeek = document.querySelector('select[name="week"]');
  if (!!currentWeek) {
    return currentWeek.value;
  }
  return false;
}

const getDaysPrices = () => {
  const programId = getCurrentProgramId();
  const currentDaysValue = getDaysCount();
  if (programId && currentDaysValue) {
    const currentProgram = getProgramById(programId);
    const currentDaysPrices = currentProgram.prices.find(obj => obj.days === parseInt(currentDaysValue, 10));
    if (currentDaysPrices && currentDaysPrices.amount && currentDaysPrices.amount.current) {
      return currentDaysPrices.amount;
    }
    return false;
  }
  return false;
}

const getDaysCount = () => {
  const currentDaysLabel = getDaysBtn();
  if (!!currentDaysLabel) {
    return currentDaysLabel.getAttribute('data-days-count');
  }
  return false;
}

const getDaysBtn = () => {
  const currentDaysInput = document.querySelector('input[name="days"]:checked');
  if (!!currentDaysInput) {
    return currentDaysInput.parentNode;
  }
  return false;
}

const triggerActiveRadioEvent = () => {
  const activeRadio = document.querySelector('input[name="days"]:checked');

  if (activeRadio) {
    const changeEvent = new Event('change', { bubbles: true });
    activeRadio.dispatchEvent(changeEvent);
    return true;
  }

  console.warn('Активный radio не найден');
  return false;
}

const targetBtnsCallback = (e) => {
  const btn = e.target.classList.contains('target-button') ? e.target : e.target.closest('.target-button');
  if (!btn.classList.contains('active')) {
    const programId = btn.getAttribute('data-program-id');
    const program = getProgramById(programId);
    window.program = program;
    triggerActiveRadioEvent();
  }
}

const targetBtnsListen = (boolean = true) => {
  const targetBtns = document.querySelectorAll('.target-button');
  if (boolean) {
    targetBtns.forEach(btn => {
      btn.removeAttribute('disabled');
      btn.removeEventListener('click', targetBtnsCallback);
      btn.addEventListener('click', targetBtnsCallback);
    });
  } else {
    targetBtns.forEach(btn => {
      btn.setAttribute('disabled', true);
      btn.removeEventListener('click', targetBtnsCallback)
    });
  }
}

const programBtnsCallback = (e) => {
  const btn = e.target.closest('label');
  if (!btn.classList.contains('active')) {
    const programId = btn.getAttribute('data-program-id');
    const program = getProgramById(programId);
    window.program = program;
    triggerActiveRadioEvent();
  }
}

const programBtnsListen = (boolean = true) => {
  const programBtns = document.querySelectorAll('.menu-button.program');
  if (boolean) {
    programBtns.forEach(btn => {
      btn.removeAttribute('disabled');
      btn.removeEventListener('click', programBtnsCallback);
      btn.addEventListener('click', programBtnsCallback);
    });
  } else {
    programBtns.forEach(btn => {
      btn.setAttribute('disabled', true);
      btn.removeEventListener('click', programBtnsCallback)
    });
  }
}

const selectCallback = (e) => {
  const value = e.target.value;
  const currentProgramWrapper = getProgramWrapper();
  scrollToElement(currentProgramWrapper);
  const weeks = currentProgramWrapper.querySelectorAll('.week-wrapper');
  weeks.forEach(week => week.classList.add('hidden'));
  const newActiveWeek = Array.from(weeks).find(week => week.getAttribute('data-week-number') == value);
  if (newActiveWeek) {
    newActiveWeek.classList.remove('hidden');
  }
}

const weekNumberToggle = (boolean = true) => {
  const select = document.querySelector('select[name="week"]');
  if (boolean) {
    select.removeAttribute('disabled');
    select.removeEventListener('change', selectCallback);
    select.addEventListener('change', selectCallback);
  } else {
    select.setAttribute('disabled', true);
    select.removeEventListener('change', selectCallback);
  }
}

const setWeekNumber = (currentWeek = 1) => {
  const select = document.querySelector('select[name="week"]');
  select.value = currentWeek;
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

const addRubleSymbol = (text = '') => {
  return [text, '₽'].filter(Boolean).join(' ');
}

const daysBtnsCallback = (e) => {
  const btn = e.target || e.target.closest('label');
  const daysBtns = document.querySelectorAll('.menu-button.days');
  daysBtns.forEach(btn => btn.classList.remove('active'));
  setTimeout(() => {
    const summaryAmountWrapper = document.querySelector('.program-amount-wrapper');
    const amountCurrent = summaryAmountWrapper.querySelector('.program-amount.current');
    const amountOld = summaryAmountWrapper.querySelector('.program-amount.old');
    const amountDiscount = summaryAmountWrapper.querySelector('.program-amount.discount');
    const amountDayPrice = summaryAmountWrapper.querySelector('.program-amount.day-price');

    const currentDaysPrices = getDaysPrices();
    const daysCount = getDaysCount();
    const dayPrice = Math.ceil(currentDaysPrices.current / parseInt(daysCount, 10));

    amountCurrent.innerHTML = addRubleSymbol(currentDaysPrices.current);
    amountDayPrice.innerHTML = addRubleSymbol(dayPrice) + ' в день';

    if (currentDaysPrices.old) {
      summaryAmountWrapper.classList.add('has-discount');
      amountOld.innerHTML = addRubleSymbol(currentDaysPrices.old);
      amountDiscount.innerHTML = addRubleSymbol(currentDaysPrices.current - currentDaysPrices.old);
      amountOld.style.display = '';
      amountDiscount.style.display = '';
    } else {
      summaryAmountWrapper.classList.remove('has-discount');
      amountOld.innerHTML = '';
      amountDiscount.innerHTML = '';
      amountOld.style.display = 'none';
      amountDiscount.style.display = 'none';
    }
    btn.classList.add('active');
  });
}

const daysBtnsListen = (boolean = true) => {
  const daysBtns = document.querySelectorAll('.menu-button.days');
  if (boolean) {
    daysBtns.forEach(btn => {
      btn.removeAttribute('disabled');
      btn.removeEventListener('click', daysBtnsCallback);
      btn.addEventListener('click', daysBtnsCallback);
    });
  } else {
    daysBtns.forEach(btn => {
      btn.setAttribute('disabled', true);
      btn.removeEventListener('click', daysBtnsCallback)
    });
  }
}

const summaryCartBtnCallback = async () => {
  summaryCartBtnListen(false);
  const productName = window.program.name;
  const currentDaysPrices = getDaysPrices();
  const productPrice = currentDaysPrices.current;
  const productId = window.program.id;
  const productOptions = [{ 'option': 'Кол-во дней', 'variant': getDaysCount() }, { 'option': 'Калории', 'variant': window.program.info.calories }];
  const product = {
    img: '',
    lid: '',
    name: productName,
    options: productOptions,
    pack_label: '',
    pack_m: '',
    pack_x: '',
    pack_y: '',
    pack_z: '',
    price: productPrice,
    quantity: 1,
    recid: '',
    sku: productId,
    url: ''
  }
  const selector = window.innerWidth > 960 ? '.summary-program-logo' : '.swiper-slide-active .menu-program-logo';
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

const summaryCartBtnListen = (boolean = true) => {
  const summaryCartBtn = blockMenu.querySelector('.menu-button.summary-button[name="cart"]');
  if (boolean) {
    summaryCartBtn.removeAttribute('disabled');
    summaryCartBtn.removeEventListener('click', summaryCartBtnCallback);
    summaryCartBtn.addEventListener('click', summaryCartBtnCallback);
  } else {
    summaryCartBtn.setAttribute('disabled', true);
    summaryCartBtn.removeEventListener('click', summaryCartBtnCallback);
  }
}

const setActiveProgram = () => {
  const programWrappers = blockMenu.querySelectorAll('.program-wrapper');
  programWrappers.forEach(programWrapper => programWrapper.classList.add('hidden'));
  const weeks = blockMenu.querySelectorAll('.week-wrapper');
  weeks.forEach(week => week.classList.add('hidden'));
  setTimeout(() => {
    const newActiveProgram = getProgramWrapper();
    const newActiveWeekNumber = getWeekNumber();
    const newActiveWeek = newActiveProgram.querySelector(`.week-wrapper[data-week-number="${newActiveWeekNumber}"]`);
    newActiveWeek && newActiveWeek.classList.remove('hidden');
    newActiveProgram && newActiveProgram.classList.remove('hidden');
  });
}

const setSummary = () => {
  setActiveProgram();

  const summaryEmoji = blockMenu.querySelectorAll('.program-logo-emoji');
  const summarySlogan = blockMenu.querySelectorAll('.program-logo-text');
  const summaryTitle = document.querySelectorAll('.program-title-text');
  const summaryCalories = blockMenu.querySelectorAll('.program-title-descr.calories');
  const summaryBju = blockMenu.querySelectorAll('.program-title-descr.bju');
  const summaryCount = blockMenu.querySelectorAll('.program-title-descr.count span');
  const summaryText = document.querySelectorAll('.program-content-text.text');
  const summaryDaysBtns = blockMenu.querySelectorAll('input[name="days"]');

  const program = window.programs.find(program => program.name === window.program.name);
  if (!!program) {
    summaryEmoji.forEach(el => el.innerHTML = program.info?.emoji || '');
    summarySlogan.forEach(el => el.innerHTML = program.info?.slogan || '');
    summaryTitle.forEach(el => {
      el.innerHTML = program.name || '';
      el.setAttribute('data-program-id', program.id);
    });
    summaryCalories.forEach(el => el.innerHTML = program.info?.calories ? program.info?.calories : '');
    summaryText.forEach(el => el.innerHTML = program.info?.text ? program.info?.text : '');
    summaryBju.forEach(el => el.innerHTML = program.info?.bju ? program.info?.bju : 'Нет информации');
    summaryCount.forEach(el => el.innerHTML = program.info?.count ? program.info?.count : '');

    program.prices.forEach((price, i) => {
      if (summaryDaysBtns[i] && price.days == summaryDaysBtns[i].closest('label').getAttribute('data-days-count')) {
        summaryDaysBtns[i].setAttribute('value', price.amount.current);
      }
    });
    daysBtnsListen();
    summaryCartBtnListen();

    const currentDaysPrices = getDaysPrices();
    const currentPrice = currentDaysPrices.current ? currentDaysPrices.current : summaryDaysBtns[0].value;
    const currentDaysBtn = getDaysBtn() ? getDaysBtn() : Array.from(summaryDaysBtns).find(btn => btn.value == currentPrice);
    currentDaysBtn && currentDaysBtn.click();
  }
}

const getDiffDaysInCycle = (startDate) => {
  const start = new Date(startDate);
  const today = new Date();

  const diffTime = today.getTime() - start.getTime();

  if (diffTime < 0) {
    return 1;
  }

  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

const getCurrentWeekInCycle = (startDate) => {
  const diffDays = getDiffDaysInCycle(startDate);
  const weekInCycle = Math.floor(diffDays / 7) % 4 + 1;
  return weekInCycle;
}

const getCurrentDayInCycle = (startDate) => {
  const diffDays = getDiffDaysInCycle(startDate);
  const dayInCycle = (diffDays % 7) + 1;
  return dayInCycle;
}

const getDateText = (date = null) => {
  let currentDate = date;

  if (!currentDate) {
    currentDate = new Date();
  }

  const months = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
  ];

  const day = currentDate.getDate();
  const month = months[currentDate.getMonth()];
  const year = currentDate.getFullYear();

  return `${day} ${month} ${year} года`;
}

const getCurrentDateText = (dayNumber, dateText, weekNumber) => {
  const date = new Date(dateText);
  const dayToAdd = (weekNumber - 1) * 7 + dayNumber - 1;

  const currentDate = new Date(date);
  currentDate.setDate(date.getDate() + dayToAdd);
  const text = getDateText(currentDate);
  return text;
}

const getDayTitle = (dayNumber, dateText, weekNumber) => {
  const currentDate = getCurrentDateText(dayNumber, dateText, weekNumber);
  const result = 'Рацион питания на ' + currentDate;
  return result;
}

const renderDishCard = (data, wrapper) => {
  const card = document.createElement('div');
  card.classList.add('dish-card');
  card.id = data.id;
  const image = document.createElement('div');
  image.classList.add('dish-card-image');
  image.style.backgroundImage = `url(${data.image})`;
  image.setAttribute('loading', 'lazy');
  const content = document.createElement('div');
  content.classList.add('dish-card-content');
  const name = document.createElement('h5');
  name.classList.add('dish-card-name');
  name.innerHTML = data.name;
  const ingredients = document.createElement('div');
  ingredients.classList.add('dish-card-ingredients');
  ingredients.innerHTML = data.ingredients;
  const calories = document.createElement('div');
  calories.classList.add('dish-card-calories');
  calories.innerHTML = data.calories;
  content.appendChild(name);
  content.appendChild(ingredients);
  content.appendChild(calories);
  card.appendChild(image);
  card.appendChild(content);
  wrapper.appendChild(card);
}

const renderDishWrapper = (dayNumber, dateText, weekNumber, wrapper) => {
  const dishWrapper = document.createElement('div');
  dishWrapper.classList.add('dishes-wrapper');
  const dayTitle = document.createElement('div');
  dayTitle.classList.add('day-title');
  dayTitle.innerHTML = getDayTitle(dayNumber, dateText, weekNumber);
  const dayWrapper = document.createElement('div');
  dayWrapper.classList.add('day-wrapper');
  dayWrapper.setAttribute('data-day-number', dayNumber);
  dayWrapper.appendChild(dayTitle);
  dayWrapper.appendChild(dishWrapper);
  wrapper.appendChild(dayWrapper);
  return dishWrapper;
}

const renderWeekWrapper = (weekNumber, wrapper) => {
  const week = document.createElement('div');
  week.classList.add('week-wrapper', 'hidden');
  week.setAttribute('data-week-number', weekNumber);
  wrapper.appendChild(week);
  return week;
}

const renderWeeks = (programWrapper, program) => {
  for (let i = 0; i < defaultSettings.maxWeeks; i++) {
    const weekNumber = i + 1;
    const week = renderWeekWrapper(weekNumber, programWrapper);
    for (let k = 0; k < defaultSettings.maxDays; k++) {
      const dayNumber = k + 1;
      const dateText = program.start;
      const dishWrapper = renderDishWrapper(dayNumber, dateText, weekNumber, week);
    }
  }
}

const renderWeekOptions = () => {
  for (let i = 0; i < defaultSettings.maxWeeks; i++) {
    const select = document.querySelector('select[name="week"]');
    const option = document.createElement('option');
    option.value = i + 1;
    option.innerHTML = `${i + 1} неделя`;
    select.appendChild(option);
  }
}

const renderProgramWrapper = (program) => {
  const programWrapper = document.createElement('div');
  renderWeeks(programWrapper, program);
  const contentWrapper = document.querySelector('.content-wrapper');
  contentWrapper.appendChild(programWrapper);

  programWrapper.classList.add('program-wrapper', 'hidden');
  programWrapper.setAttribute('id', program.id);
  programWrapper.setAttribute('data-program-name', program.name);
  programWrapper.setAttribute('data-sort', program.sort);
}

const renderCards = async (program) => {
  program.dishes = await setDishes(program.id);
  if (program && Array.isArray(program.dishes) && program.dishes.length > 0) {
    program.dishes.forEach(dish => {
      const programWrapper = document.querySelector(`.program-wrapper#${program.id}`);
      const week = programWrapper.querySelector(`.week-wrapper[data-week-number="${dish.week}"]`);
      if (week) {
        const day = week.querySelector(`.day-wrapper[data-day-number="${dish.day}"] .dishes-wrapper`);
        if (day) renderDishCard(dish, day);
      }
    });
  } else {
    console.warn(`Программа ${program.name} не содержит блюд`);
  }
}

const renderBtns = (program) => {
  const input = document.createElement('input');
  input.type = 'radio';
  input.name = 'program';
  input.id = 'program-' + program.sort;
  input.value = program.name;
  input.hidden = true;

  const span = document.createElement('span');
  span.innerHTML = program.name;

  const label = document.createElement('label');
  label.classList.add('menu-button', 'program');
  label.setAttribute('for', 'program-' + program.sort);
  label.setAttribute('data-program-id', program.id);
  label.disabled = true;
  label.appendChild(input);
  label.appendChild(span);

  const programButtonsWrapper = document.querySelector('.program-buttons-wrapper');
  programButtonsWrapper.appendChild(label);
}

const renderTargetBtns = (program) => {
  const emoji = document.createElement('span');
  emoji.classList.add('target-button-emoji');
  emoji.innerHTML = program.info?.emoji;
  const text = document.createElement('span');
  text.classList.add('target-button-text');
  text.innerHTML = program.info?.slogan;

  const button = document.createElement('div');
  button.classList.add('target-button');
  button.setAttribute('data-program-id', program.id);
  button.appendChild(emoji);
  button.appendChild(text);

  const wrapper = blockTarget.querySelector('.target-buttons-wrapper');
  wrapper.appendChild(button);
}

const renderSlide = (program) => {
  const swiperWrapper = document.querySelector(`.${CONFIG_PROGRAMM.classname} .swiper-wrapper`);
  const slide = document.createElement('div');
  slide.classList.add('swiper-slide');

  const programWrapper = document.createElement('div');
  programWrapper.classList.add('program-info-wrapper');
  programWrapper.setAttribute('data-type', 'slider');
  programWrapper.setAttribute('data-program-id', program.id);

  const logoEmoji = document.createElement('span');
  logoEmoji.classList.add('program-logo-emoji');
  logoEmoji.innerHTML = program.info?.emoji || '';

  const logoText = document.createElement('span');
  logoText.classList.add('program-logo-text');
  logoText.innerHTML = program.info?.slogan || '';

  const logoWrapper = document.createElement('div');
  logoWrapper.classList.add('program-logo', 'menu-program-logo');
  logoWrapper.appendChild(logoEmoji);
  logoWrapper.appendChild(logoText);

  const title = document.createElement('h2');
  title.classList.add('program-title-text');
  title.innerHTML = program.name || '';

  const text = document.createElement('div');
  text.classList.add('program-content-text');
  text.innerHTML = program.info?.text || '';

  const button = document.createElement('a');
  button.classList.add('menu-button', 'summary-button');
  button.setAttribute('href', '#popup:calc');
  button.innerHTML = 'Калькулятор калорий';

  programWrapper.appendChild(logoWrapper);
  programWrapper.appendChild(title);
  programWrapper.appendChild(text);
  programWrapper.appendChild(button);
  slide.appendChild(programWrapper);
  swiperWrapper.appendChild(slide);
}

const renderSlider = () => {
  const element = document.querySelector(`.${CONFIG_PROGRAMM.classname}`);
  swiperProgramm = new Swiper(element, {
    autoplay: false,
    loop: true,
    navigation: {
      nextEl: '.swiper-button-next',
      prevEl: '.swiper-button-prev',
    },
    slidesPerView: 1,
  });
  swiperProgramm.on('slideChange', function (e) {
    setTimeout(() => {
      const slideActive = e.slides.find(slide => slide.classList.contains('swiper-slide-active'));
      const programId = slideActive.querySelector('.program-info-wrapper').getAttribute('data-program-id');
      const program = getProgramById(programId);
      window.program = program;
    }, 20);
  });
}

const renderAll = async () => {
  const programs = await setPrograms();

  // Проверяем, что программы загружены
  if (!programs || programs.length === 0) {
    console.error('Не удалось загрузить программы питания');
    return;
  }

  const targetBtns = blockTarget.querySelectorAll('.target-button');
  targetBtns.forEach(btn => btn.remove());
  const programBtns = blockMenu.querySelectorAll('.menu-button.program');
  programBtns.forEach(btn => btn.remove());
  const currentWeekNumber = getCurrentWeekInCycle(programs[0].start);

  for (let i = 0; i < programs.length; i++) {
    const currentProgram = programs.find(program => program.sort === i + 1);
    renderTargetBtns(currentProgram);
    renderSlide(currentProgram);
    renderBtns(currentProgram);
    renderProgramWrapper(currentProgram);
  }

  renderSlider();
  window.program = window.programs.find(program => program.sort === 1);
  const currentProgramWrapper = getProgramWrapper();
  const currentWeek = currentProgramWrapper.querySelector(`.week-wrapper[data-week-number="${currentWeekNumber}"]`);
  currentWeek && currentWeek.classList.remove('hidden');
  currentProgramWrapper.classList.remove('hidden');
  weekNumberToggle();
  setWeekNumber(currentWeekNumber);
  targetBtnsListen();
  programBtnsListen();
  setSummary();

  for (let i = 0; i < programs.length; i++) {
    const currentProgram = programs.find(program => program.sort === i + 1);
    await renderCards(currentProgram);
  }
}

const letsGo = async () => {
  renderWeekOptions();
  blockMenu.querySelector(`input[name="program"][value="${defaultSettings.program}"]`) && blockMenu.querySelector(`input[name="program"][value="${defaultSettings.program}"]`).click();
  blockMenu.querySelector(`[data-days-count="${defaultSettings.days}"]`) && blockMenu.querySelector(`[data-days-count="${defaultSettings.days}"]`).click();
  try {
    await renderAll();
  } catch (error) {
    console.error('Ошибка при инициализации:', error);
  }
}

letsGo();

if (window.innerWidth <= 980) {
  document.addEventListener('scroll', function () {
    const windowHeight = window.innerHeight;

    // Появление нижней плашки
    const programInfo = blockMenu.querySelector('#program-info');
    const summaryWrapper = blockMenu.querySelector('.summary-wrapper');
    const summaryWrapperHeight = Math.ceil(summaryWrapper.getBoundingClientRect().height);
    const programContentTextBottom = programInfo.getBoundingClientRect().bottom + summaryWrapperHeight + 0;
    if (programContentTextBottom <= windowHeight) {
      summaryWrapper.classList.add('sticky');
    } else {
      summaryWrapper.classList.remove('sticky');
    }

    // Появление кнопки «Изменить»
    const programButtonsWrapper = blockMenu.querySelector('.program-buttons-wrapper');
    const chooseProgramButton = blockMenu.querySelector('.menu-button.choose-program');
    const programButtonsWrapperBottom = programButtonsWrapper.getBoundingClientRect().top + 20;
    if (programButtonsWrapperBottom < 0) {
      chooseProgramButton.classList.add('visible');
    } else {
      chooseProgramButton.classList.remove('visible');
    }
  });
}

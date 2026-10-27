# Файлы для Tilda

Всё, что стоит на сайтах Тильды, лежит в `web/` — по страницам:

```
web/
  shared/        delivery-date.js, delivery-datepicker.js, delivery-cost.js — на всех страницах с корзиной;
                 cart.css — копия стилей корзины (общий блок rec720385276)
  programs/      главная fitbox.su и поддомены: programs.html, programs.css, programs.js;
                 target.html — блок «Выбор цели» (сейчас отключён)
  constructor/   «Собери своё меню» (kzn.fitbox.su/constructor): constructor.html, .css, .js
  dev/           delivery-cutoff-tester.js — только для проверки отсечки
  legacy/        tilda-old.js — старая версия скрипта программ
```

Сервер отдаёт папку по адресу `https://app.fitbox.su/web/…` (кэш браузера — 1 час).
`.html` и `.css` вставляются в блоки T123 (CSS — внутри тега `style`), `.js` подключаются ссылкой —
после деплоя обновляются сами, ничего вставлять на Тильде не нужно.

## Что где стоит на Тильде

| Где | Что вставлено |
|-----|---------------|
| Каждый сайт (fitbox.su, kzn, smr, tlt, dmt) → Настройки сайта → Ещё → HTML-код в HEAD | `<script>` с `web/shared/delivery-date.js`, `web/shared/delivery-datepicker.js`, `web/shared/delivery-cost.js` |
| Главная (оригиналы блоков, на поддоменах — их копии): T123 rec1935240611 | `web/programs/programs.css` внутри тега `style` |
| Главная: T123 rec1935240641 | `web/programs/programs.html` (подключает `programs.js` и html2canvas) |
| Конструктор: T123 rec5076266601 | `web/constructor/constructor.css` внутри тега `style` |
| Конструктор: T123 rec5076274801 | `web/constructor/constructor.html` (подключает `constructor.js`) |
| Все сайты: общий блок T123 rec720385276 | `web/shared/cart.css` внутри тега `style` |

## Программы питания (главная)

**Файлы:** `web/programs/programs.html` (разметка), `programs.css` (стили), `programs.js` (логика).

Два блока T123:
1. стили — содержимое `programs.css` внутри тега `style`;
2. разметка — `programs.html` целиком. В конце файла подключены html2canvas и
   `https://app.fitbox.su/web/programs/programs.js`.

`programs.js` — упрощённая версия с единым API: два запроса к `/api/tilda/menu`,
город по поддомену, данные кэшируются в localStorage на 60 минут.

Блок «Выбор цели» сейчас отключён. Чтобы включить, вставьте `web/programs/target.html`
в начало `programs.html` — стили слайдера уже в `programs.css`, скрипт найдёт блок сам.

### tilda-old.js (Legacy)

Оригинальная версия с множеством запросов к API — только для обратной совместимости.
**URL:** `https://app.fitbox.su/web/legacy/tilda-old.js`

### delivery-date.js + delivery-datepicker.js (дата доставки в корзине)

**Описание:** календарь выбора даты доставки в корзине Тильды (T706) с подсказкой
«Закажите до 14:00 — доставим 2 октября. После 14:00 — 3 октября».

**Правила** задаются в `CONFIG` файла `delivery-date.js`:
- `defaults` — общие правила: часовой пояс по умолчанию (`utcOffset`), отсечка (`cutoffHour`),
  через сколько дней доставка до и после отсечки, выходные дни, праздники, `overrides`;
- `cities` — правила городов, ключ — значение поля «Город» в корзине. Город может
  переопределить любое общее правило; для города не из списка действуют `defaults`.

Отсечка считается по местному времени города, а не по времени браузера.
Город берётся из `select[name="city"]` корзины, если поля нет — по поддомену.

**Подключение** — на всех страницах с корзиной (программы и «Собери своё меню»),
удобнее всего в «Настройки сайта → Ещё → HTML-код для вставки внутрь HEAD»:

```html
<script src="https://app.fitbox.su/web/shared/delivery-date.js"></script>
<script src="https://app.fitbox.su/web/shared/delivery-datepicker.js"></script>
<script src="https://app.fitbox.su/web/shared/delivery-cost.js"></script>
```

Дни доставки во всех городах — вт, чт, пт и вс (`defaults.closedWeekdays` в `delivery-date.js`).

**В форме корзины** нужно поле «Input» с именем переменной `date`, обязательное.
Дата уходит в заказ как `ДД.ММ.ГГГГ` и сохраняется в `orders.delivery_date`.

**Каждый товар — на своей странице.** Корзина общая для всех страниц поддомена, поэтому
`delivery-datepicker.js` следит и за этим:
- на странице конструктора (`#constructor.fbc`) нельзя оформить программы питания;
- на остальных страницах — блюда конструктора (`D<id>-<ГГГГММДД>`).

Товар «Доставка» (`FBC-DELIVERY`) свой на любой странице: `delivery-cost.js` пересчитывает его
по товарам этой страницы.

Чужие для страницы товары в корзине полупрозрачные, над списком товаров и над кнопкой отправки —
предупреждение со ссылкой на нужную страницу и кнопкой «Убрать из корзины», «Оформить заказ»
и отправка формы заблокированы (полупрозрачные). Настройки и тексты — `CONFIG.pageRules`.

**Проверка в консоли:** `NCDM_DELIVERY.debugCity()`, `NCDM_DELIVERY.debugTable()`,
`NCDM_DELIVERY_PICKER.isCartBlocked()`.

### delivery-cost.js (стоимость доставки в корзине)

Доставка считается за каждый день доставки, только по товарам этой страницы:
- **конструктор** — 250 ₽, если блюд за день доставки меньше чем на 1050 ₽, иначе 0;
- **программы** — доставка бесплатная; дни доставки — с даты из поля `date`
  (если поля нет — с ближайшей) на «Кол-во дней» самой длинной программы;
- **надбавка за зону** — за каждый день доставки, в том числе бесплатный. Зона — по адресу
  из корзины (`GET /api/tilda/delivery-zone`) в городах с картой зон (`CONFIG.zoneCities`).

В корзине: поле «Зона доставки» под «Подъездом» и «Этажом» (квадратик цвета зоны и подпись),
строка «Доставка» над «Итого» с иконкой ⓘ — подсказка с бесплатными и платными днями
(нативный popover, плавно появляется и скрывается). Итог — товар «Доставка» (`FBC-DELIVERY`):
он нужен Тильде для суммы заказа и письма, в списке товаров скрыт вместе со своим заголовком.

**Проверка в консоли:** `FITBOX_DELIVERY.debug()`.

### delivery-cutoff-tester.js (только для тестовой страницы)

Подменяет текущие дату и время, чтобы проверить календарь до и после отсечки.
Подключается после двух скриптов выше. Тестовый блок сам встраивается в форму
корзины перед полем даты доставки. На боевые страницы не ставить.
**URL:** `https://app.fitbox.su/web/dev/delivery-cutoff-tester.js`

### constructor.js (страница «Собери своё меню»)

**Описание:** конструктор меню из отдельных блюд — дни меню, фильтр «Выберите приемы», карточки
с ценой и весом (КБЖУ временно скрыто — `CONFIG.showNutrition`), счётчик +/−, окно с составом,
итоговая плашка с суммой, подписи о доставке под датами в корзине
(см. «Дни меню и доставка» в [CONSTRUCTOR_MENU.md](./CONSTRUCTOR_MENU.md)). Стоимость доставки
считает `delivery-cost.js`; если его нет на странице, конструктор подгружает его сам.
Данные — `GET /api/tilda/constructor`, выбранные блюда лежат в корзине Тильды
с артикулом `D<id>`.

**Где работает:** только в городах из `CONFIG.cities` (сейчас Казань). Город страницы
задаётся атрибутом `data-city` у `#constructor`, иначе — по поддомену.

**Подключение на странице** (сайт kzn.fitbox.su):
1. Блок T123: разметка из `web/constructor/constructor.html` (подключает
   `https://app.fitbox.su/web/constructor/constructor.js`), стили из
   `web/constructor/constructor.css` — внутри тега `style` в соседнем T123.
2. Корзина T706 — та же, что на остальных страницах, с полем `date`
   и скриптами доставки (`delivery-date.js`, `delivery-datepicker.js`, `delivery-cost.js`).

**Защита корзины.** Если в корзине есть блюда конструктора, а в поле «Город» выбран
город не из `CONFIG.cities`, отправка заказа блокируется с пояснением под полем города.
На остальных страницах сайта заказ с блюдами конструктора блокирует `delivery-datepicker.js`
(см. выше) — `constructor.js` подключать туда не нужно.

**Данные блюда** (заполняются в админке): `in_constructor`, `price`, `weight`
и хотя бы один приём пищи в `dish_meal_types`. Без цены или веса блюдо не показывается.

**Проверка в консоли:** `FITBOX_CONSTRUCTOR.debug()`.

## Требования

### HTML структура

Скрипт ожидает следующую структуру HTML на странице (`web/programs/programs.html`,
блок «Выбор цели» — `web/programs/target.html`, необязателен):

```html
<!-- Блок с кнопками выбора цели -->
<div id="target">
  <div class="target-buttons-wrapper">
    <!-- Кнопки будут сгенерированы скриптом -->
  </div>
</div>

<!-- Основное меню -->
<div id="menu">
  <!-- Кнопки выбора программы -->
  <form class="program-buttons-wrapper">
    <!-- Кнопки будут сгенерированы скриптом -->
  </form>

  <!-- Информация о программе -->
  <div id="program-info" class="program-info-wrapper">
    <div class="program-logo menu-program-logo">
      <span class="program-logo-emoji"></span>
      <span class="program-logo-text"></span>
    </div>
    <div class="program-title">
      <h2 class="program-title-text"></h2>
      <span class="program-title-descr calories"></span>
      <span class="program-title-descr bju"></span>
      <span class="program-title-descr count">Блюд в день: <span></span></span>
    </div>
  </div>

  <!-- Селект недель -->
  <select name="week"></select>

  <!-- Summary блок с ценами -->
  <div class="summary-wrapper">
    <div class="program-days-wrapper">
      <h4 class="program-days-title">Количество дней</h4>
      <form class="program-days-form">
        <!-- Кнопки будут сгенерированы скриптом -->
      </form>
    </div>

    <div class="program-amount-wrapper">
      <span class="program-amount current"></span>
      <span class="program-amount old"></span>
      <span class="program-amount discount"></span>
      <span class="program-amount day-price"></span>
    </div>
  </div>
</div>
```

### Зависимости

**Обязательные:**
- Нет! Скрипт использует только нативный JavaScript

**Опциональные:**
- **Inter** (шрифт)
  ```html
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap" rel="stylesheet">
  ```

- **Swiper.js** (для слайдера программ)
  ```html
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swiper@12/swiper-bundle.min.css"/>
  <script src="https://cdn.jsdelivr.net/npm/swiper@12/swiper-bundle.min.js"></script>
  ```

- **html2canvas** (для скриншота карточки товара в корзине)
  ```html
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.3.2/html2canvas.min.js"></script>
  ```

## Конфигурация

### Изменение API URL

По умолчанию используется [https://app.fitbox.su/api](https://app.fitbox.su/api). Для изменения поменяйте в скрипте `web/programs/programs.js`:

```javascript
const API_BASE_URL = 'https://app.fitbox.su/api';
```

### Настройка городов

Города определяются автоматически по поддомену:

| Поддомен | Город |
|----------|-------|
| ` ` (пусто) | Ульяновск |
| `kzn` | Казань |
| `smr` | Самара |
| `tlt` | Тольятти |
| `dmt` | Дмитровград |

## Кэширование

Скрипт автоматически кэширует данные в localStorage на **60 минут**, что значительно ускоряет загрузку страницы при повторных визитах.

### Очистка кэша

Если нужно обновить данные принудительно, откройте консоль браузера (F12) и выполните:

```javascript
window.clearFitboxCache(); // Очистить кэш
```

Затем обновите страницу (F5) для загрузки свежих данных.

## Отладка

### Проверка загрузки данных

Откройте консоль браузера (F12) и выполните:

```javascript
console.log(window.menuData); // Все данные меню
console.log(window.currentProgram); // Текущая выбранная программа
```

### Проверка кэша

В консоли будут видны сообщения:
```
✓ Данные загружены из кэша: menu_
✓ Данные сохранены в кэш: dishes_1_all_all (TTL: 60 мин)
⟳ Загрузка данных меню с сервера...
```

### Типичные ошибки

**1. "Не удалось загрузить данные меню"**

Причины:
- API сервер недоступен
- CORS ошибка
- Неправильный URL в конфигурации

Решение:
```javascript
// Проверьте в консоли
fetch('https://app.fitbox.su/api/tilda/menu')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
```

**2. Swiper не работает**

Причина: Библиотека Swiper не подключена

Решение: Добавьте перед скриптом:
```html
<script src="https://cdn.jsdelivr.net/npm/swiper@12/swiper-bundle.min.js"></script>
```

**3. Кнопки не генерируются**

Причина: Неправильная HTML структура

Решение: Проверьте наличие элементов:
```javascript
console.log(document.getElementById('menu')); // Должен быть найден
console.log(document.querySelector('.program-buttons-wrapper')); // Должен быть найден
```

## Производительность

### Оптимизация загрузки

1. **Используйте async/defer** при подключении скрипта:
```html
<script src="https://app.fitbox.su/web/programs/programs.js" defer></script>
```

2. **Включите кэширование** на стороне сервера (уже настроено: 1 час)

3. **Используйте CDN** для статики (Cloudflare автоматически кэширует)

## Версионирование

При обновлении скрипта используйте версионирование в URL:

```html
<!-- Без версии (всегда последняя, обновится у посетителей в течение часа) -->
<script src="https://app.fitbox.su/web/programs/programs.js"></script>

<!-- С версией — новая версия сразу, но ссылку на Тильде нужно менять -->
<script src="https://app.fitbox.su/web/programs/programs.js?v=1.0.0"></script>
```

## Поддержка

При возникновении проблем:

1. Проверьте консоль браузера (F12)
2. Проверьте доступность API: https://app.fitbox.su/api/tilda/menu
3. Убедитесь, что HTML структура соответствует требованиям
4. Проверьте подключение зависимостей (Swiper, html2canvas)

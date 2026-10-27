# Tilda API Documentation

## Обзор

Специальный публичный API эндпоинт для Tilda frontend, который возвращает все необходимые данные для отображения меню в оптимизированном формате.

**Базовый URL:** `https://app.fitbox.su/api/tilda`

**Аутентификация:** Не требуется (публичный доступ)

## Основные преимущества

✅ **Два запроса вместо множества** - все данные (программы, города, цены) в одном ответе, блюда для программы в другом
✅ **Оптимизированная структура** - данные готовы к использованию на фронтенде
✅ **Автоматическое определение города** - по поддомену сайта
✅ **Минимальная логика на фронтенде** - вся обработка на бэкенде
✅ **Без авторизации** - публичный доступ для чтения

## Эндпоинты

### 1. Получить все данные для меню

```
GET /api/tilda/menu
```

Возвращает полную информацию о программах питания, городах и ценах.

#### Query параметры

| Параметр | Тип | Описание | Пример |
|----------|-----|----------|--------|
| `subdomain` | string | Поддомен города (опционально) | `kzn`, `smr`, `tlt`, `dmt` или пусто для Ульяновска |
| `city` | string | Название города (опционально) | `Казань`, `Самара`, `Тольятти` |

**Примечание:** Если параметры не указаны, система автоматически определит город по URL страницы.

#### Пример запроса

```bash
# Без параметров (автоопределение города)
curl https://app.fitbox.su/api/tilda/menu

# С указанием поддомена
curl https://app.fitbox.su/api/tilda/menu?subdomain=kzn

# С указанием города
curl https://app.fitbox.su/api/tilda/menu?city=Казань
```

#### Пример ответа

```json
{
  "cities": [
    {
      "id": 1,
      "title": "Ульяновск",
      "sort": 1,
      "startedAt": "2026-01-04T00:00:00.000Z",
      "subdomain": ""
    },
    {
      "id": 2,
      "title": "Казань",
      "sort": 2,
      "startedAt": "2026-01-05T00:00:00.000Z",
      "subdomain": "kzn"
    }
  ],
  "currentCity": {
    "id": 1,
    "title": "Ульяновск",
    "sort": 1,
    "startedAt": "2026-01-04T00:00:00.000Z",
    "subdomain": ""
  },
  "programs": [
    {
      "id": 1,
      "title": "Офис",
      "emoji": "👩‍💼",
      "sort": 1,
      "description": "Трехразовое питание на 800-900 ккал/день...",
      "slogan": "Кушай на работе",
      "dishesPerDay": 3,
      "nutrition": {
        "caloriesFrom": 800,
        "caloriesTo": 900,
        "proteins": 47,
        "fats": 32,
        "carbohydrates": 88
      },
      "prices": [
        {
          "id": 1,
          "days": 1,
          "price": 1000,
          "oldPrice": null,
          "label": "Пробный день",
          "pricePerDay": 1000
        },
        {
          "id": 2,
          "days": 5,
          "price": 4900,
          "oldPrice": 5000,
          "label": "5 дней",
          "pricePerDay": 980
        }
      ],
      "cities": [
        {
          "id": 1,
          "title": "Ульяновск",
          "startedAt": "2026-01-04T00:00:00.000Z"
        }
      ],
      "startedAt": "2026-01-04T00:00:00.000Z"
    }
  ],
  "meta": {
    "totalDishes": 140,
    "totalPrograms": 6,
    "totalCities": 5,
    "maxWeeks": 4,
    "maxDays": 7,
    "generatedAt": "2026-01-27T17:30:00.000Z"
  }
}
```

### 2. Получить блюда для программы

```
GET /api/tilda/menu/:programId/dishes
```

Возвращает список блюд для конкретной программы питания.

#### Path параметры

| Параметр | Тип | Описание |
|----------|-----|----------|
| `programId` | integer | ID программы питания |

#### Query параметры

| Параметр | Тип | Описание | Пример |
|----------|-----|----------|--------|
| `week` | integer | Номер недели (1-4) | `1`, `2`, `3`, `4` |
| `day` | integer | День недели (1-7) | `1` (понедельник), `7` (воскресенье) |

#### Пример запроса

```bash
# Все блюда программы
curl https://app.fitbox.su/api/tilda/menu/1/dishes

# Блюда на конкретный день
curl https://app.fitbox.su/api/tilda/menu/1/dishes?day=1

# Блюда на конкретную неделю
curl https://app.fitbox.su/api/tilda/menu/1/dishes?week=1
```

#### Пример ответа

```json
{
  "programId": 1,
  "dishes": [
    {
      "id": 1,
      "title": "Творожная запеканка с малиной и йогурт",
      "image": "https://app.fitbox.su/uploads/dishes/image.png",
      "dayOfWeek": 1,
      "week": 1,
      "mealType": "breakfast",
      "sort": 0
    },
    {
      "id": 2,
      "title": "Куриная грудка с грибами и пенне",
      "image": "https://app.fitbox.su/uploads/dishes/image2.png",
      "dayOfWeek": 1,
      "week": 1,
      "mealType": "lunch",
      "sort": 0
    }
  ],
  "meta": {
    "totalDishes": 21,
    "week": 1,
    "day": null
  }
}
```

### 3. Получить детальную информацию о блюде

```
GET /api/tilda/dishes/:dishId
```

Возвращает полную информацию о блюде, включая ингредиенты и пищевую ценность.

#### Path параметры

| Параметр | Тип | Описание |
|----------|-----|----------|
| `dishId` | integer | ID блюда |

#### Пример запроса

```bash
curl https://app.fitbox.su/api/tilda/dishes/1
```

#### Пример ответа

```json
{
  "id": 1,
  "title": "Творожная запеканка с малиной и йогурт",
  "image": "https://app.fitbox.su/uploads/dishes/image.png",
  "ingredients": [
    {
      "id": 175,
      "title": "творог",
      "quantity": "150.00",
      "calories": "159.00",
      "proteins": "16.70",
      "fats": "9.00",
      "carbohydrates": "2.00"
    },
    {
      "id": 82,
      "title": "малина",
      "quantity": "40.00",
      "calories": "46.00",
      "proteins": "0.80",
      "fats": "0.50",
      "carbohydrates": "8.30"
    }
  ],
  "ingredientsText": "творог (150г), малина (40г), йогурт (50г)...",
  "nutrition": {
    "calories": 320,
    "proteins": 28.5,
    "fats": 15.2,
    "carbohydrates": 22.1
  }
}
```

### 4. Получить блюда конструктора «Собери своё меню»

```
GET /api/tilda/constructor
GET /api/tilda/constructor?city=Казань&dates=2026-10-25,2026-10-27
```

Возвращает приёмы пищи (фильтр «Выберите приемы») и блюда конструктора. Кэш — 5 минут.

С параметром `dates` (до 31 даты `ГГГГ-ММ-ДД` через запятую) в ответе есть `availability` —
какие блюда продаются в каждую дату по меню конструктора (4-недельный цикл + исключения на дату
+ остатки меню предыдущего дня, см. [CONSTRUCTOR_MENU.md](./CONSTRUCTOR_MENU.md)), а в `dishes` — только блюда, доступные хотя бы
в одну из дат. `city` — город, от даты старта которого считается неделя цикла (по умолчанию первый).

```json
{
  "city": "Казань",
  "availability": { "2026-10-25": [], "2026-10-27": [41, 55, 124] },
  "mealTypes": [...],
  "dishes": [...]
}
```

Без `dates` — все блюда конструктора без привязки к датам (для старых версий скрипта).

В ответ попадают только блюда, у которых:
- включён `dishes.in_constructor`;
- заполнены `dishes.price` и `dishes.weight`;
- указан хотя бы один приём пищи (`dish_meal_types`).

Приёмы пищи без блюд в ответ не попадают, поэтому пустые разделы на сайте не показываются.
КБЖУ на 100 г считается по ингредиентам, КБЖУ порции — пропорционально `weight`.
Если у блюда не заполнена граммовка ингредиентов, `nutrition` равен `null`.

#### Пример ответа

```json
{
  "mealTypes": [
    { "id": 1, "slug": "breakfast", "title": "Завтраки", "sort": 10 },
    { "id": 5, "slug": "main", "title": "Вторые блюда", "sort": 50 }
  ],
  "dishes": [
    {
      "id": 4,
      "sku": "D4",
      "title": "Чикенболлы с соусом «Тропикана» с рисом по-мексикански",
      "image": "https://static.tildacdn.com/...",
      "price": 450,
      "oldPrice": null,
      "weight": 250,
      "mealTypes": ["main"],
      "ingredients": ["курица", "рис", "фасоль красная"],
      "nutrition": {
        "per100": { "calories": 220, "proteins": 10.9, "fats": 5.8, "carbohydrates": 31.5 },
        "portion": { "calories": 550, "proteins": 27.3, "fats": 14.5, "carbohydrates": 78.7 }
      }
    }
  ],
  "meta": { "totalDishes": 1, "generatedAt": "2026-10-19T12:00:00.000Z" }
}
```

`sku` передаётся в корзину Тильды как есть. Вебхук заказа отличает блюда по префиксу `D`:
`"5"` — программа питания, `"D4"` — блюдо конструктора (`order_items.dish_id`).
В корзине у блюда артикул `D<id>-<ГГГГММДД>` — день меню (`order_items.menu_date`), а опция
«Доставка» (`ДД.ММ.ГГГГ`) — день доставки (`order_items.delivery_date`). Товар `FBC-DELIVERY` —
стоимость доставки (конструктора или надбавка за зону у программ), сохраняется в `orders.delivery_price`,
в позиции заказа не попадает.

### 5. Зона доставки по адресу

```
GET /api/tilda/delivery-zone?city=Казань&street=Беломорская улица&house=6&corpus=
```

Определяет зону доставки по адресу из корзины: геокодирует адрес и ищет точку в полигонах
с карты зон (`src/data/delivery-zones.json`). Кэш — сутки.

| `status` | Что значит |
|---|---|
| `found` | Адрес в зоне: `surcharge` — надбавка, ₽ (0 — бесплатная зона), `zone` — название полигона, `color` — цвет зоны на карте |
| `outside` | Адрес найден, но вне всех зон |
| `not_found` | Геокодер не нашёл адрес |
| `no_zones` | Для города карты зон нет |

```json
{ "status": "found", "city": "Казань", "surcharge": 150, "zone": "Зона доставки + 150 рублей",
  "color": "#ffd21e", "point": [55.8649, 49.0861], "address": "6, Беломорская улица, …", "precise": true }
```

`precise: false` — дом не найден, точка стоит на улице.

**Геокодер:** по умолчанию Nominatim (OpenStreetMap) — без ключа, не чаще 1 запроса в секунду
(сервер выстраивает запросы в очередь и запоминает ответы). Если задать
`YANDEX_GEOCODER_API_KEY` в `.env`, используется Геокодер Яндекса.

**Зоны поменяли на карте** — выгрузить заново и перезапустить сервер:

```bash
node scripts/update-delivery-zones.js
```

Надбавка берётся из названия полигона («Зона доставки + 200 рублей», «Бесплатная зона доставки»),
цвет — из заливки полигона. Карты — по одной на город (блок с картой на главной сайта):
Ульяновск, Казань, Самара, Тольятти; у Димитровграда карты нет. Адреса карт — `MAPS`
в `scripts/update-delivery-zones.js`.

Цвет на карте в корзине превращается в название и цвет зоны (`CONFIG.zoneColors`
в `web/shared/delivery-cost.js`): одна и та же надбавка в разных городах бывает разного цвета,
поэтому подпись совпадает с тем, что покупатель видит на карте своего города.

## Примеры использования

### JavaScript (Vanilla)

```javascript
// Получить все данные меню
const menuData = await fetch('https://app.fitbox.su/api/tilda/menu')
  .then(res => res.json());

console.log('Текущий город:', menuData.currentCity.title);
console.log('Программы:', menuData.programs);

// Получить блюда для программы
const programId = menuData.programs[0].id;
const dishes = await fetch(`https://app.fitbox.su/api/tilda/menu/${programId}/dishes?week=1`)
  .then(res => res.json());

console.log('Блюда на неделю:', dishes.dishes);
```

### jQuery

```javascript
// Получить данные меню
$.getJSON('https://app.fitbox.su/api/tilda/menu', function(data) {
  console.log('Программы:', data.programs);

  // Отобразить программы
  data.programs.forEach(function(program) {
    $('#programs-list').append(
      '<div>' + program.emoji + ' ' + program.title + '</div>'
    );
  });
});
```

### Tilda HTML Block

```html
<script>
// Автоматически определяет город по поддомену
fetch('https://app.fitbox.su/api/tilda/menu')
  .then(response => response.json())
  .then(data => {
    // Рендерим программы
    const programsHtml = data.programs.map(program => `
      <div class="program-card">
        <span class="emoji">${program.emoji}</span>
        <h3>${program.title}</h3>
        <p>${program.description}</p>
        <div class="prices">
          ${program.prices.map(price => `
            <button data-price="${price.price}">
              ${price.label} - ${price.price}₽
            </button>
          `).join('')}
        </div>
      </div>
    `).join('');

    document.getElementById('programs-container').innerHTML = programsHtml;
  })
  .catch(error => {
    console.error('Ошибка загрузки:', error);
  });
</script>
```

## Структура данных

### Program (Программа)

```typescript
interface Program {
  id: number;
  title: string;
  emoji: string;
  sort: number;
  description: string;
  slogan: string;
  dishesPerDay: number;
  nutrition: Nutrition;
  prices: Price[];
  cities: City[];
  startedAt: string; // ISO 8601 дата
}
```

### Nutrition (Пищевая ценность)

```typescript
interface Nutrition {
  caloriesFrom: number | null;
  caloriesTo: number | null;
  proteins: number | null;
  fats: number | null;
  carbohydrates: number | null;
}
```

### Price (Цена)

```typescript
interface Price {
  id: number;
  days: number;
  price: number;
  oldPrice: number | null;
  label: string; // "Пробный день" или "5 дней"
  pricePerDay: number;
}
```

### City (Город)

```typescript
interface City {
  id: number;
  title: string;
  sort: number;
  startedAt: string; // ISO 8601 дата
  subdomain: string; // "kzn", "smr", "tlt", "dmt", ""
}
```

### Dish (Блюдо)

```typescript
interface Dish {
  id: number;
  title: string;
  image: string | null;
  dayOfWeek: number; // 1-7
  week: number; // 1-4
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  sort: number;
}
```

## Маппинг городов и поддоменов

| Город | Поддомен | URL |
|-------|----------|-----|
| Ульяновск | ` ` (пусто) | `fitbox.su` |
| Казань | `kzn` | `kzn.fitbox.su` |
| Самара | `smr` | `smr.fitbox.su` |
| Тольятти | `tlt` | `tlt.fitbox.su` |
| Дмитровград | `dmt` | `dmt.fitbox.su` |

## Коды ошибок

### 404 Not Found

```json
{
  "error": "Not found",
  "message": "Блюдо не найдено"
}
```

### 500 Internal Server Error

```json
{
  "error": "Internal server error",
  "message": "Не удалось получить данные для меню"
}
```

## Best Practices

1. **Кэширование** - В официальном скрипте tilda.js уже реализовано кэширование в localStorage на 60 минут. При самостоятельной интеграации рекомендуется кэшировать данные меню на 10-15 минут
2. **Обработка ошибок** - Всегда обрабатывайте ошибки сети и показывайте пользователю понятные сообщения
3. **Lazy loading** - Загружайте блюда программы только когда пользователь выбирает программу
4. **Оптимизация изображений** - Используйте lazy loading для изображений блюд (реализовано в tilda.js)
5. **Автоопределение города** - Не передавайте параметр subdomain, если работаете на нужном поддомене

## Миграция со старого API

### Было (старый подход)

```javascript
// Множество запросов
const programs = await fetch('/api/programs').then(r => r.json());
const cities = await fetch('/api/cities').then(r => r.json());

for (const program of programs) {
  const prices = await fetch(`/api/programs/${program.id}/prices`).then(r => r.json());
  const dishes = await fetch(`/api/dishes?program_id=${program.id}`).then(r => r.json());
  // ...
}
```

### Стало (новый подход)

```javascript
// Один запрос для всего
const menuData = await fetch('/api/tilda/menu').then(r => r.json());

// Все данные уже есть:
// - menuData.programs (с ценами)
// - menuData.cities
// - menuData.currentCity

// Блюда загружаем отдельно при необходимости
const dishes = await fetch(`/api/tilda/menu/${programId}/dishes?week=1`)
  .then(r => r.json());
```

## FAQ

**Q: Нужна ли авторизация для доступа к Tilda API?**
A: Нет, все эндпоинты `/api/tilda/*` публичные и не требуют API ключа.

**Q: Можно ли использовать этот API для других фронтендов, не только Tilda?**
A: Да, API универсален и подходит для любого фронтенда.

**Q: Как часто обновляются данные?**
A: Данные обновляются в реальном времени. В официальном скрипте tilda.js кэширование настроено на 60 минут в localStorage.

**Q: Можно ли получить блюда всех программ одним запросом?**
A: Нет, блюда загружаются отдельно для каждой программы, чтобы не перегружать первый запрос.

**Q: Что делать, если изображение блюда отсутствует?**
A: Поле `image` будет `null`. Используйте placeholder изображение на фронтенде.

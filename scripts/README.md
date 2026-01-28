# Скрипты для Tilda

## Подключение скрипта на Tilda

### Вариант 1: Подключение через CDN (рекомендуется)

Добавьте в Tilda Zero Block или в настройки страницы (T123 → Настройки → Дополнительно → HTML-код для вставки внутри <head>):

```html
<!-- Упрощенный скрипт для меню Fitbox -->
<script src="https://jade-oak-9eb2.tunnl.gg/scripts/tilda-simple.js"></script>
```

### Вариант 2: Inline скрипт (если CDN недоступен)

Скопируйте содержимое файла `tilda-simple.js` и вставьте в Zero Block:

```html
<script>
// Вставьте сюда содержимое tilda-simple.js
</script>
```

## Доступные скрипты

### tilda-simple.js (Рекомендуется)

**Размер:** ~15 KB
**Описание:** Упрощенная версия с использованием единого API эндпоинта

**Особенности:**
- ✅ Один запрос вместо множества
- ✅ Автоопределение города по поддомену
- ✅ Минимальная логика на фронтенде
- ✅ ~400 строк кода вместо 1000+

**URL:** `https://jade-oak-9eb2.tunnl.gg/scripts/tilda-simple.js`

### tilda.js (Legacy)

**Размер:** ~40 KB
**Описание:** Оригинальная версия с множеством запросов к API

**Использовать только для:**
- Обратной совместимости со старыми страницами
- Специфических кастомизаций

**URL:** `https://jade-oak-9eb2.tunnl.gg/scripts/tilda.js`

## Требования

### HTML структура

Скрипт ожидает следующую структуру HTML на странице:

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
- **Swiper.js** (для слайдера программ)
  ```html
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css"/>
  <script src="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js"></script>
  ```

- **html2canvas** (для скриншота карточки товара в корзине)
  ```html
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.3.2/html2canvas.min.js"></script>
  ```

## Конфигурация

### Изменение API URL

По умолчанию используется туннель. Для продакшена измените:

```javascript
// В начале файла tilda-simple.js
const API_BASE_URL = 'https://api.fitbox.su/api';
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

## Отладка

### Проверка загрузки данных

Откройте консоль браузера (F12) и выполните:

```javascript
console.log(window.menuData); // Все данные меню
console.log(window.currentProgram); // Текущая выбранная программа
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
fetch('https://jade-oak-9eb2.tunnl.gg/api/tilda/menu')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
```

**2. Swiper не работает**

Причина: Библиотека Swiper не подключена

Решение: Добавьте перед скриптом:
```html
<script src="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js"></script>
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
<script src="https://jade-oak-9eb2.tunnl.gg/scripts/tilda-simple.js" defer></script>
```

2. **Включите кэширование** на стороне сервера (уже настроено: 1 час)

3. **Используйте CDN** для статики (Cloudflare автоматически кэширует)

### Размеры файлов

| Файл | Размер (несжатый) | Размер (gzip) |
|------|-------------------|---------------|
| tilda-simple.js | ~15 KB | ~4 KB |
| tilda.js | ~40 KB | ~10 KB |

## Версионирование

При обновлении скрипта используйте версионирование в URL:

```html
<!-- Без версии (всегда последняя) -->
<script src="https://jade-oak-9eb2.tunnl.gg/scripts/tilda-simple.js"></script>

<!-- С версией (рекомендуется для продакшена) -->
<script src="https://jade-oak-9eb2.tunnl.gg/scripts/tilda-simple.js?v=1.0.0"></script>
```

## Миграция

### С tilda.js на tilda-simple.js

1. Замените URL скрипта
2. Проверьте работу на тестовой странице
3. Обновите на всех страницах

**Никаких изменений в HTML не требуется!**

## Поддержка

При возникновении проблем:

1. Проверьте консоль браузера (F12)
2. Проверьте доступность API: https://jade-oak-9eb2.tunnl.gg/api/tilda/menu
3. Убедитесь, что HTML структура соответствует требованиям
4. Проверьте подключение зависимостей (Swiper, html2canvas)

# Скрипты для Tilda

## Подключение скрипта на Tilda

### Вариант 1: Подключение через CDN (рекомендуется)

Добавьте в Tilda Zero Block или в настройки страницы (T123 → Настройки → Дополнительно → HTML-код для вставки внутри <head>):

```html
<!-- Скрипт для меню Fitbox -->
<script src="https://app.fitbox.su/scripts/tilda.js"></script>
```

### Вариант 2: Inline скрипт (если CDN недоступен)

Скопируйте содержимое файла `tilda.js` и вставьте в Zero Block:

```html
<script>
// Вставьте сюда содержимое tilda.js
</script>
```

## Доступные скрипты

### tilda.js (Рекомендуется)

**Описание:** Упрощенная версия с использованием единого API эндпоинта

**Особенности:**
- ✅ Два запроса вместо множества
- ✅ Автоопределение города по поддомену
- ✅ Минимальная логика на фронтенде

**URL:** `https://app.fitbox.su/scripts/tilda.js`

### tilda-old.js (Legacy)

**Описание:** Оригинальная версия с множеством запросов к API

**Использовать только для:**
- Обратной совместимости со старыми страницами
- Специфических кастомизаций

**URL:** `https://app.fitbox.su/scripts/tilda-old.js`

## Требования

### HTML структура

Скрипт ожидает следующую структуру HTML на странице (`public/web/html/target.html`):

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
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css"/>
  <script src="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js"></script>
  ```

- **html2canvas** (для скриншота карточки товара в корзине)
  ```html
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.3.2/html2canvas.min.js"></script>
  ```

## Конфигурация

### Изменение API URL

По умолчанию используется [https://app.fitbox.su/api](https://app.fitbox.su/api). Для изменения поменяйте в скрипте `scripts/tilda.js`:

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
<script src="https://app.fitbox.su/scripts/tilda.js" defer></script>
```

2. **Включите кэширование** на стороне сервера (уже настроено: 1 час)

3. **Используйте CDN** для статики (Cloudflare автоматически кэширует)

## Версионирование

При обновлении скрипта используйте версионирование в URL:

```html
<!-- Без версии (всегда последняя) -->
<script src="https://app.fitbox.su/scripts/tilda.js"></script>

<!-- С версией (рекомендуется для продакшена) -->
<script src="https://app.fitbox.su/scripts/tilda.js?v=1.0.0"></script>
```

## Поддержка

При возникновении проблем:

1. Проверьте консоль браузера (F12)
2. Проверьте доступность API: https://app.fitbox.su/api/tilda/menu
3. Убедитесь, что HTML структура соответствует требованиям
4. Проверьте подключение зависимостей (Swiper, html2canvas)

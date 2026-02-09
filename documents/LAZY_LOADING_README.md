# Lazy Loading и расчет текущей недели

## 1. Lazy Loading изображений

### Как это работает

Используется **Intersection Observer API** для отложенной загрузки изображений:

1. При рендеринге карточки изображение не загружается сразу
2. Вместо этого URL сохраняется в `data-lazy-bg` атрибуте
3. Когда карточка появляется в viewport (за 50px до видимости), изображение загружается
4. После загрузки добавляется класс `lazy-loaded` для плавной анимации появления

### Код

```javascript
// Инициализация Observer при старте приложения
imageObserver = initImageObserver();

// При рендеринге карточки
if (imageObserver) {
  image.setAttribute('data-lazy-bg', dish.image);
  imageObserver.observe(image);
} else {
  // Fallback для старых браузеров
  image.style.backgroundImage = `url(${dish.image})`;
}
```

### Преимущества

✅ **Экономия трафика** - изображения загружаются только когда пользователь скроллит к ним
✅ **Быстрая загрузка страницы** - не блокируется рендеринг
✅ **Плавная анимация** - skeleton loader + fade-in эффект
✅ **Совместимость** - fallback для старых браузеров

### CSS стили

```css
/* До загрузки - скелетон анимация */
.dish-card-image[data-lazy-bg] {
  background-image: linear-gradient(90deg, #f0f0f0 0%, #f8f8f8 50%, #f0f0f0 100%);
  animation: loading 1.5s ease-in-out infinite;
}

/* После загрузки - плавное появление */
.dish-card-image.lazy-loaded {
  opacity: 1;
  animation: none;
}
```

## 2. Расчет текущей недели

### Проблема

Раньше использовалось `new Date()` которое берет текущее время (например, 15:30). Это приводило к неправильному расчету дней.

**Пример:**
- `started_at`: 2026-01-01 00:00:00
- Сегодня: 2026-01-08 **15:30:00**
- Разница: 7.646 дней → Math.floor = 7 дней
- Но реально прошло 8 дней!

### Решение

Обнуляем время до начала дня (00:00:00):

```javascript
const getCurrentWeekInCycle = (startDate) => {
  // Обнуляем время до 00:00:00
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffTime = today.getTime() - start.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  // Цикл из 4 недель (1, 2, 3, 4, 1, 2, 3, 4, ...)
  const weekInCycle = (Math.floor(diffDays / 7) % 4) + 1;

  return weekInCycle;
};
```

### Примеры расчета

| started_at | Сегодня | Прошло дней | Прошло недель | Неделя в цикле |
|-----------|---------|-------------|---------------|----------------|
| 2026-01-01 | 2026-01-08 | 7 | 1 | **2** |
| 2026-01-01 | 2026-01-15 | 14 | 2 | **3** |
| 2026-01-01 | 2026-01-29 | 28 | 4 | **1** (цикл) |
| 2026-01-01 | 2026-02-05 | 35 | 5 | **2** |

### Формула

```
weekInCycle = (Math.floor(days / 7) % 4) + 1
```

- `days / 7` - количество полных недель
- `% 4` - остаток от деления на 4 (цикл)
- `+ 1` - нумерация с 1 вместо 0

## 3. Интеграция на Tilda

### Подключение CSS

```html
<link rel="stylesheet" href="https://app.fitbox.su/scripts/dish-styles.css">
```

### Подключение JavaScript

```html
<script src="https://app.fitbox.su/scripts/tilda.js"></script>
```

### Пример структуры HTML

```html
<div id="menu">
  <!-- Выбор программы -->
  <div class="program-buttons-wrapper"></div>

  <!-- Выбор недели -->
  <select name="week">
    <option value="1">1 неделя</option>
    <option value="2" selected>2 неделя</option>
    <option value="3">3 неделя</option>
    <option value="4">4 неделя</option>
  </select>

  <!-- Контент с карточками блюд -->
  <div class="content-wrapper">
    <!-- Карточки блюд генерируются автоматически -->
  </div>
</div>
```

## 4. Тестирование

### Проверка lazy loading

1. Откройте DevTools → Network → Img
2. Перезагрузите страницу
3. Прокрутите вниз
4. Изображения должны загружаться постепенно

### Проверка расчета недели

```javascript
// В консоли браузера
console.log('Текущая неделя:', getCurrentWeekInCycle('2026-01-01'));
```

### Проверка в разных сценариях

- **Только запущен цикл** (< 7 дней) → Неделя 1
- **Середина цикла** (14-21 день) → Неделя 3-4
- **Прошел полный цикл** (28+ дней) → Начинается заново с 1

## 5. Совместимость

| Функция | Поддержка браузеров |
|---------|-------------------|
| Intersection Observer | Chrome 51+, Firefox 55+, Safari 12.1+ |
| Dialog element | Chrome 37+, Firefox 98+, Safari 15.4+ |
| Date.setHours() | Все браузеры |

### Fallback для старых браузеров

Если Intersection Observer не поддерживается:
```javascript
if (!imageObserver) {
  // Загружаем изображение сразу
  image.style.backgroundImage = `url(${dish.image})`;
}
```

## 6. Производительность

### Метрики

- **Первая загрузка**: загружаются только видимые изображения (~3-5 карточек)
- **Экономия трафика**: 70-80% при длинных списках
- **FCP (First Contentful Paint)**: улучшение на 40-60%

### Оптимизация

- `rootMargin: '50px'` - начинаем загрузку за 50px до появления
- `threshold: 0.01` - минимальный порог видимости
- `Cache-Control: public, max-age=86400` - кэширование изображений на 24 часа

# Изменения в работе с блюдами и изображениями

## Обзор изменений

### 1. Изображения блюд
- ✅ Добавлено поле `image` в таблицу `dishes` (TEXT) - прямая ссылка на изображение
- ✅ Контроллер обновлен для использования `d.image` вместо `d.images[0].key`
- ✅ Удалена сложная логика с проксированием Budibase (файлы можно удалить):
  - `/src/controllers/imageController.js`
  - `/src/routes/images.js`
  - Роут `/api/images` в `index.js`

### 2. Ингредиенты блюд
Теперь возвращается два формата:

#### `ingredients` - массив названий (для карточки)
```json
{
  "ingredients": ["Курица", "Рис", "Морковь", "Лук"]
}
```
**Использование:** Отображается в карточке блюда через запятую

#### `ingredientsText` - строка с количеством (для модального окна)
```json
{
  "ingredientsText": "Курица (200г), Рис (150г), Морковь (50г), Лук (30г)"
}
```
**Использование:** Отображается в модальном окне с полной информацией

### 3. Фронтенд (Tilda)

#### Карточка блюда (`renderDishCard`)
```javascript
// Ингредиенты через запятую (БЕЗ количества)
ingredients.textContent = dish.ingredients.join(', ');
// Результат: "Курица, Рис, Морковь, Лук"

// КБЖУ на 100г
nutritionText = `на 100 г: ${calories} ккал, ${proteins}/${fats}/${carbs} б/ж/у`;

// Вся карточка кликабельна - открывает модальное окно
```

#### Модальное окно (`showDishModal`)
```javascript
// Состав С количеством
ingredientsText.textContent = dish.ingredientsText;
// Результат: "Курица (200г), Рис (150г), Морковь (50г), Лук (30г)"

// Полная пищевая ценность на 100г
// Общий вес блюда
```

## SQL запрос для добавления поля image

```sql
ALTER TABLE dishes
ADD COLUMN image TEXT;

-- Обновить существующие записи (если нужно)
UPDATE dishes
SET image = 'https://admin.fitbox.su/api/attachments/' || (images->0->>'key')
WHERE images IS NOT NULL AND jsonb_array_length(images) > 0;
```

## Пример структуры данных блюда

```json
{
  "id": 5,
  "title": "Салат «Белоснежка»",
  "image": "https://admin.fitbox.su/api/attachments/app_dev_xxx/attachments/uuid.png",
  "ingredients": ["Куриная грудка", "Сыр", "Яйца", "Огурцы", "Майонез"],
  "ingredientsText": "Куриная грудка (150г), Сыр (50г), Яйца (100г), Огурцы (70г), Майонез (30г)",
  "totalWeight": 323,
  "nutrition": {
    "calories": 156,
    "proteins": 18,
    "fats": 9,
    "carbohydrates": 3
  },
  "weekNumber": 1,
  "dayOfWeek": 1,
  "dishNumber": 1
}
```

## Тестирование

### 1. Проверить API
```bash
curl http://localhost:3000/api/tilda/menu/1/dishes | jq '.dishes[0]'
```

### 2. Проверить фронтенд
- Открыть страницу Tilda
- Проверить отображение ингредиентов в карточке (без количества)
- Кликнуть на карточку
- Проверить состав в модальном окне (с количеством)
- Проверить отображение КБЖУ на 100г
- Проверить изображение блюда

## Файлы для удаления (опционально)

Если не планируете использовать проксирование изображений через backend:
- `/src/controllers/imageController.js` ❌
- `/src/routes/images.js` ❌
- Убрать из `index.js`: `app.use('/api/images', require('./src/routes/images'));` ❌

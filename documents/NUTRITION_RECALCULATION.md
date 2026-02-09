# Система автоматического пересчета питательности программ

## Описание

Калории и БЖУ для каждой программы питания рассчитываются автоматически на основе ингредиентов блюд.
Система пересчитывает данные для всех 6 программ и сохраняет результаты в JSONB поле `data` таблицы `nutrition_programs`.

## Как это работает

### Логика расчета

Для каждой программы питания:
1. Берутся все блюда из `nutrition_program_dishes`
2. Для каждого блюда суммируются калории и БЖУ всех ингредиентов
3. Вычисляются:
   - **calories_from**: минимальное значение калорий в день
   - **calories_to**: максимальное значение калорий в день
   - **proteins**: среднее значение белков в день
   - **fats**: среднее значение жиров в день
   - **carbohydrates**: среднее значение углеводов в день

### Формула расчета

Для каждого ингредиента:
```
Значение = (значение_на_100г * количество_в_граммах) / 100
```

Например:
```
Калории блюда = Σ (ingredient.calories * dish_ingredient.quantity / 100)
```

---

## Использование

### 1. Автоматический пересчет (Cron)

Система автоматически пересчитывает питательность **каждый день в 03:00** (по московскому времени).

**Изменить расписание:**
Отредактируйте файл [index.js:65-68](index.js#L65-L68):
```javascript
const nutritionCronJob = new CronJob(
  '0 3 * * *', // Измените это расписание
  // ...
);
```

**Формат cron:**
- `'0 3 * * *'` - каждый день в 03:00
- `'0 */6 * * *'` - каждые 6 часов
- `'0 0 * * 0'` - каждое воскресенье в полночь

---

### 2. Ручной запуск через терминал

```bash
cd /Users/solowey/Documents/Сайты/Fitbox/dev/backend
node scripts/recalculate-nutrition.js
```

**Вывод:**
```
🔄 Начинаю пересчет питательности программ...

📊 Результаты пересчета:
────────────────────────────────────────────────────────────────────
✅ Офис:
   Калории: 800-900 ккал
   БЖУ: 47/32/88 г
✅ Баланс:
   Калории: 1050-1150 ккал
   БЖУ: 58/41/113 г
...
────────────────────────────────────────────────────────────────────

✨ Пересчет завершен за 0.34 сек
📝 Обновлено программ: 6/6
```

---

### 3. Через API endpoint

**Endpoint:** `GET /api/admin/recalculate-nutrition`

**Требуется:** API ключ в заголовке `X-Admin-Key`

#### Пример через curl:

```bash
curl -X GET http://localhost:3000/api/admin/recalculate-nutrition \
  -H "X-Admin-Key: fitbox-admin-key-2024"
```

#### Пример через JavaScript (fetch):

```javascript
const response = await fetch('http://localhost:3000/api/admin/recalculate-nutrition', {
  method: 'GET',
  headers: {
    'X-Admin-Key': 'fitbox-admin-key-2024'
  }
});

const result = await response.json();
console.log(result);
```

**Ответ:**
```json
{
  "success": true,
  "message": "Питательность программ успешно пересчитана",
  "data": {
    "duration": 0.34,
    "programs": [
      {
        "id": 1,
        "title": "Офис",
        "updated": true,
        "nutrition": {
          "caloriesFrom": 800,
          "caloriesTo": 900,
          "proteins": 47,
          "fats": 32,
          "carbohydrates": 88
        }
      }
      // ...
    ]
  }
}
```

---

### 4. Интеграция с Budibase

#### Шаг 1: Создайте REST API запрос

В Budibase создайте новый REST API:
- **URL:** `http://localhost:3000/api/admin/recalculate-nutrition`
- **Method:** GET
- **Headers:**
  - Key: `X-Admin-Key`
  - Value: `fitbox-admin-key-2024`

#### Шаг 2: Добавьте кнопку

Создайте кнопку с действием:
1. **Action:** Execute Query
2. **Query:** (выберите созданный REST API запрос)
3. **Success message:** "Питательность успешно пересчитана!"

#### Шаг 3: Добавьте таблицу с результатами (опционально)

Отобразите результаты в таблице, используя:
- **Data source:** Response от API запроса
- **Columns:** title, caloriesFrom, caloriesTo, proteins, fats, carbohydrates

---

## Настройка API ключа

По умолчанию используется ключ: `fitbox-admin-key-2024`

**Изменить ключ:**

1. Добавьте в `.env`:
   ```env
   ADMIN_API_KEY=your-secure-key-here
   ```

2. Или измените в [adminController.js:18](src/controllers/adminController.js#L18):
   ```javascript
   const expectedKey = process.env.ADMIN_API_KEY || 'your-key-here';
   ```

---

## Установка зависимостей

После клонирования репозитория установите зависимости:

```bash
npm install
```

Это установит пакет `cron` версии ^3.1.8, необходимый для работы автоматического пересчета.

---

## Миграция БД

Перед первым использованием примените SQL миграцию:

```bash
psql -U $DB_USER -d $DB_NAME -f migrations/004_recalculate_nutrition_function.sql
```

Или через скрипт миграции (если есть):
```bash
npm run migrate
```

Это создаст SQL функцию `recalculate_program_nutrition()` в базе данных.

---

## Отладка

### Проверить, работает ли cron:

```bash
# Запустите сервер
npm run dev

# Вы должны увидеть:
# ⏱️  Cron задача настроена: пересчет питательности каждый день в 03:00
```

### Проверить SQL функцию вручную:

```sql
-- Подключитесь к БД
psql -U fitbox_user -d fitbox

-- Вызовите функцию
SELECT * FROM recalculate_program_nutrition();
```

### Логи

Все операции пересчета логируются в консоль с префиксами:
- `🔄` - начало пересчета
- `✅` - успешное обновление программы
- `⚠️` - программа без данных
- `❌` - ошибка
- `⏰ [CRON]` - автоматический запуск через cron

---

## Структура файлов

```
backend/
├── migrations/
│   └── 004_recalculate_nutrition_function.sql  # SQL функция
├── scripts/
│   └── recalculate-nutrition.js                # Скрипт пересчета
├── src/
│   ├── controllers/
│   │   ├── adminController.js                  # API endpoint
│   │   └── tildaController.js                  # Читает данные из JSONB
│   └── routes/
│       └── admin.js                            # Роуты админки
└── index.js                                    # Настройка cron
```

---

## FAQ

**Q: Как часто нужно пересчитывать данные?**
A: Зависит от частоты изменений ингредиентов. Для редких изменений достаточно раз в день.

**Q: Можно ли отключить автоматический пересчет?**
A: Да, закомментируйте блок с `CronJob` в [index.js:65-82](index.js#L65-L82).

**Q: Что будет, если в программе нет блюд?**
A: Функция вернет `updated: false` и не изменит данные программы.

**Q: Безопасно ли вызывать пересчет во время работы сайта?**
A: Да, операция выполняется быстро (~0.3 сек) и не блокирует другие запросы.

**Q: Как проверить текущие значения в БД?**
A:
```sql
SELECT title, data FROM nutrition_programs;
```

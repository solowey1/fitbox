# Fitbox Backend API

Backend API для сервиса доставки готовой еды Fitbox.

## Технологии

- Node.js + Express.js
- PostgreSQL
- CORS, dotenv

## Структура базы данных

### Основные таблицы:
- **cities** - города, в которых работает сервис
- **nutrition_programs** - программы питания
- **prices** - цены для программ питания (разные периоды)
- **dishes** - блюда
- **ingredients** - ингредиенты
- **orders** - заказы
- **order_items** - элементы заказов (связь заказов с программами)
- **dish_ingredients** - связь блюд и ингредиентов
- **nutrition_program_dishes** - меню программ по дням недели

## Установка и запуск

### 1. Установка зависимостей

```bash
npm install
```

### 2. Настройка базы данных PostgreSQL

Создайте базу данных PostgreSQL:

```bash
createdb fitbox
createdb baserow
# или
psql -U postgres -c "CREATE DATABASE fitbox; CREATE DATABASE baserow;"
```

### 3. Настройка переменных окружения

Создайте файл `.env` на основе `.env.example`:

```bash
cp .env.example .env
```

Отредактируйте `.env` и укажите свои данные:

```env
PORT=3000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_NAME=fitbox
DB_USER=postgres
DB_PASSWORD=ваш_пароль

CORS_ORIGIN=http://localhost:5173
```

### 4. Запуск миграций

Примените миграции для создания таблиц:

```bash
npm run migrate
```

Этот скрипт автоматически выполнит все миграции из папки `migrations/` в алфавитном порядке.

**Альтернативно**, можно запустить миграции отдельно:

```bash
# Только создание таблиц
npm run migrate:schema

# Только тестовые данные
npm run migrate:seed
```

Или вручную через psql:

```bash
psql -U postgres -d fitbox -f migrations/001_initial_schema.sql
psql -U postgres -d fitbox -f migrations/002_seed_data.sql
```

### 5. Запуск сервера

**Режим разработки** (с автоперезагрузкой):
```bash
npm run dev
```

**Продакшен**:
```bash
npm start
```

Сервер запустится на `http://localhost:3000`

## API Endpoints

### Cities (Города)
- `GET /api/cities` - получить все города
- `GET /api/cities/:id` - получить город по ID
- `POST /api/cities` - создать город
- `PUT /api/cities/:id` - обновить город
- `DELETE /api/cities/:id` - удалить город

### Nutrition Programs (Программы питания)
- `GET /api/programs` - получить все программы (query: `?city_id=1`)
- `GET /api/programs/:id` - получить программу по ID
- `GET /api/programs/:id/prices` - получить программу с ценами
- `POST /api/programs` - создать программу
- `PUT /api/programs/:id` - обновить программу
- `DELETE /api/programs/:id` - удалить программу

### Dishes (Блюда)
- `GET /api/dishes` - получить все блюда
- `GET /api/dishes/:id` - получить блюдо по ID
- `GET /api/dishes/:id/ingredients` - получить блюдо с ингредиентами
- `POST /api/dishes` - создать блюдо
- `PUT /api/dishes/:id` - обновить блюдо
- `DELETE /api/dishes/:id` - удалить блюдо

### Orders (Заказы)
- `GET /api/orders` - получить все заказы
- `GET /api/orders/:id` - получить заказ по ID с элементами
- `POST /api/orders` - создать заказ
- `PUT /api/orders/:id` - обновить заказ
- `DELETE /api/orders/:id` - удалить заказ

### Health Check
- `GET /health` - проверка работоспособности сервера

## Примеры использования

### Создание города

```bash
curl -X POST http://localhost:3000/api/cities \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Москва",
    "descr": "Столица России",
    "started_at": "2024-01-01"
  }'
```

### Создание программы питания

```bash
curl -X POST http://localhost:3000/api/programs \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Баланс",
    "emoji": "⚖️",
    "data": {
      "calories_from": 1200,
      "calories_to": 1500,
      "proteins": 100,
      "fats": 50,
      "carbohydrates": 150
    },
    "city_id": 1,
    "sort": 1
  }'
```

### Создание заказа

```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Иван Иванов",
    "phone": "+7 999 123-45-67",
    "city": "Москва",
    "address": "ул. Ленина, д. 1, кв. 10",
    "comment": "Доставка после 18:00",
    "promocode": "SALE10",
    "current_price": 5400,
    "items": [
      {
        "nutrition_program_id": 1,
        "price_id": 1,
        "quantity": 1,
        "price": 5400
      }
    ]
  }'
```

## Структура проекта

```
backend/
├── migrations/           # SQL миграции
│   └── 001_initial_schema.sql
├── public/
│   └── uploads/         # Загруженные изображения
├── src/
│   ├── config/          # Конфигурация (БД)
│   │   └── database.js
│   ├── controllers/     # Контроллеры API
│   │   ├── citiesController.js
│   │   ├── dishesController.js
│   │   ├── nutritionProgramsController.js
│   │   └── ordersController.js
│   ├── routes/          # Маршруты API
│   │   ├── cities.js
│   │   ├── dishes.js
│   │   ├── nutritionPrograms.js
│   │   └── orders.js
│   ├── middleware/      # Middleware (будущие)
│   └── models/          # Модели (будущие)
├── .env                 # Переменные окружения (не в git)
├── .env.example         # Пример переменных
├── .gitignore
├── package.json
├── index.js            # Точка входа
└── README.md
```

## Дальнейшее развитие

- Добавить валидацию входящих данных
- Добавить аутентификацию и авторизацию
- Добавить логирование запросов
- Добавить rate limiting
- Добавить загрузку изображений
- Добавить пагинацию для списков
- Добавить фильтрацию и сортировку
- Добавить тесты

# Fitbox Backend API

Backend API для сервиса доставки готовой еды Fitbox.

## Технологии

- Node.js + Express.js 5
- PostgreSQL
- Redis (опционально, для кэширования)
- ioredis, pg, dotenv, cors

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

Этот скрипт выполнит создание схемы базы данных из `migrations/001_initial_schema.sql`

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

## Управление (Docker)

Для управления приложением на сервере используется скрипт `manage.sh`.

При первом деплое сделать исполняемым:
```bash
chmod +x manage.sh
```

Команды:
```bash
./manage.sh start       # Запустить приложение
./manage.sh stop        # Остановить приложение
./manage.sh restart     # Перезапустить приложение
./manage.sh update      # Обновить код из GitHub, пересобрать и перезапустить
./manage.sh migrate     # Запустить миграции БД
./manage.sh logs        # Логи приложения (по умолчанию 100 строк)
./manage.sh logs 500    # Логи — последние 500 строк
./manage.sh status      # Статус контейнеров
./manage.sh help        # Справка
```

## Документация

Подробная документация находится в папке [documents/](./documents/):

- **[Быстрый старт](./documents/QUICKSTART.md)** - минимальная инструкция для запуска
- **[Структура проекта](./documents/PROJECT_STRUCTURE.md)** - подробное описание архитектуры
- **[API примеры](./documents/API_EXAMPLES.md)** - примеры всех запросов к API
- **[Аутентификация](./documents/API_AUTHENTICATION.md)** - настройка и использование API ключа
- **[Кэширование](./documents/CACHING.md)** - Redis и in-memory кэш
- **[Питательность программ](./documents/NUTRITION_RECALCULATION.md)** - система автоматического пересчета
- **[Tilda API](./documents/TILDA_API.md)** - API для Tilda frontend
- **[Подключение к Tilda](./documents/TILDA_CONNECT.md)** - установка скриптов на Tilda
- **[Lazy Loading](./documents/LAZY_LOADING_README.md)** - оптимизация загрузки изображений

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

### Tilda API (публичный, без аутентификации)
- `GET /api/tilda/menu` - все данные меню (программы, города, цены)
- `GET /api/tilda/menu/:programId/dishes` - блюда программы
- `GET /api/tilda/dishes/:dishId` - детали блюда с ингредиентами

### Cache Management (требует API ключ)
- `POST /api/cache/clear` - очистить кэш
- `GET /api/cache/stats` - статистика кэша

### Health Check
- `GET /health` - проверка работоспособности сервера

> 📝 **Примечание:** POST, PUT, DELETE запросы требуют API ключ. Подробнее в [API_AUTHENTICATION.md](./documents/API_AUTHENTICATION.md)

## Примеры использования

### Получить данные (публичный доступ)

```bash
# Получить программы питания
curl http://localhost:3000/api/programs

# Получить меню для Tilda
curl http://localhost:3000/api/tilda/menu
```

### Создать данные (требует API ключ)

```bash
# Создать программу питания
curl -X POST http://localhost:3000/api/programs \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"title": "Баланс", "emoji": "⚖️", "sort": 1}'
```

> 📖 **Больше примеров:** [documents/API_EXAMPLES.md](./documents/API_EXAMPLES.md)

## Структура проекта

```
backend/
├── documents/           # 📚 Документация
├── migrations/          # 🗄️  SQL миграции
├── public/              # 📦 Статические файлы (HTML, CSS)
├── scripts/             # 🔧 Вспомогательные скрипты (migrate, tilda)
├── src/
│   ├── config/          # ⚙️  Конфигурация (БД)
│   ├── controllers/     # 🎮 Контроллеры API
│   ├── routes/          # 🛣️  Маршруты API
│   └── middleware/      # 🔒 Middleware (auth, cache, cors)
├── .env                 # 🔐 Переменные окружения (не в git)
├── package.json
└── index.js             # 🚀 Точка входа
```

> 📖 **Подробнее:** [documents/PROJECT_STRUCTURE.md](./documents/PROJECT_STRUCTURE.md)

## Реализованные фичи

✅ **Аутентификация** - API ключ для защищенных операций
✅ **Кэширование** - Redis/In-memory кэш для оптимизации
✅ **CORS** - настроенная политика безопасности
✅ **Tilda API** - специальный публичный API для фронтенда
✅ **Статические файлы** - раздача скриптов и стилей

## Дальнейшее развитие

- Валидация данных (joi/express-validator)
- JWT токены для пользователей
- Логирование (morgan/winston)
- Rate limiting
- Пагинация и фильтрация
- Unit/Integration тесты
- API документация (Swagger)

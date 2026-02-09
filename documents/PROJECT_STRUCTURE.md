# Структура проекта Fitbox Backend

```
backend/
│
├── documents/                      # Документация
│   ├── API_AUTHENTICATION.md       # Аутентификация и доступ по API
│   ├── API_EXAMPLES.md             # Примеры запросов к API
│   ├── CACHING.md                  # Кэширование с Redis/In-memory
│   ├── LAZY_LOADING_README.md      # Lazy loading изображений и расчет недели
│   ├── PROJECT_STRUCTURE.md        # Структура проекта (этот файл)
│   ├── QUICKSTART.md               # Быстрый старт
│   ├── TILDA_API.md                # API для Tilda frontend
│   └── TILDA_CONNECT.md            # Подключение скриптов на Tilda
│
├── migrations/                     # SQL миграции базы данных
│   └── 001_initial_schema.sql      # Создание всех таблиц с индексами и триггерами
│   # Примечание: тестовые данные в .bak файлах для справки
│
├── public/                         # Статические файлы
│   └── uploads/                    # Загруженные изображения блюд (сейчас хранятся на Tilda)
│
├── scripts/                        # Вспомогательные скрипты
│   ├── migrate.js                  # Скрипт запуска миграций
│   ├── test-db.js                  # Проверка подключения к БД
│   ├── tilda.js                    # Скрипт для Tilda (текущая версия)
│   └── tilda_old.js                # Устаревший скрипт для обратной совместимости
│
├── src/                            # Исходный код приложения
│   ├── config/                     # Конфигурация
│   │   └── database.js             # Настройка подключения к PostgreSQL
│   │
│   ├── controllers/                # Контроллеры (бизнес-логика)
│   │   ├── citiesController.js             # CRUD для городов
│   │   ├── dishesController.js             # CRUD для блюд
│   │   ├── nutritionProgramsController.js  # CRUD для программ питания
│   │   ├── ordersController.js             # CRUD для заказов
│   │   └── tildaController.js              # API для Tilda frontend
│   │
│   ├── routes/                     # Маршруты API
│   │   ├── cities.js               # /api/cities
│   │   ├── dishes.js               # /api/dishes
│   │   ├── nutritionPrograms.js    # /api/programs
│   │   ├── orders.js               # /api/orders
│   │   └── tilda.js                # /api/tilda (публичный API для Tilda)
│   │
│   ├── middleware/                 # Middleware
│   │   ├── authMiddleware.js       # Аутентификация по API ключу
│   │   ├── cacheMiddleware.js      # Кэширование (Redis/In-memory)
│   │   └── corsMiddleware.js       # CORS конфигурация
│   │
│   └── models/                     # Модели (пусто, для будущего расширения)
│
├── .env                            # Переменные окружения (не в git)
├── .env.example                    # Пример переменных окружения
├── .gitignore                      # Игнорируемые файлы для git
├── package.json                    # Зависимости и скрипты npm
├── README.md                       # Основная документация
└── index.js                        # Точка входа приложения
```

## Описание основных компонентов

### index.js
Точка входа приложения. Настраивает Express, подключает middleware (CORS, JSON parsing), регистрирует маршруты и запускает HTTP-сервер.

### src/config/database.js
Создает пул подключений к PostgreSQL с использованием библиотеки `pg`. Экспортирует функцию `query` для выполнения SQL-запросов.

### src/controllers/
Содержит бизнес-логику для каждой сущности:
- Обработка входящих данных
- Выполнение SQL-запросов через database.js
- Формирование ответов (JSON)
- Обработка ошибок

### src/routes/
Определяет HTTP endpoints для каждой сущности:
- GET - получение данных
- POST - создание записей
- PUT - обновление записей
- DELETE - удаление записей

### migrations/
SQL-файлы для создания и изменения структуры БД:
- `001_initial_schema.sql` - создает все таблицы с `IF NOT EXISTS`
- `002_seed_data.sql` - добавляет тестовые данные

## База данных

### Основные таблицы:

1. **cities** - города обслуживания
2. **nutrition_programs** - программы питания (Баланс, Fit, Масса и т.д.)
3. **prices** - цены для программ (5, 10, 20 дней)
4. **dishes** - блюда
5. **ingredients** - ингредиенты
6. **orders** - заказы клиентов

### Связующие таблицы:

1. **order_items** - связь заказов с программами питания
2. **dish_ingredients** - связь блюд и ингредиентов (с количеством в граммах)
3. **nutrition_program_dishes** - меню программ по дням недели и типам приема пищи

### Особенности:

- Все таблицы имеют `created_at` и `updated_at` с автоматическим обновлением через триггеры
- Используются индексы для оптимизации запросов
- Каскадное удаление для связанных записей (`ON DELETE CASCADE`)

## API Endpoints

### Cities
- `GET /api/cities` - список всех городов
- `GET /api/cities/:id` - город по ID
- `POST /api/cities` - создать город
- `PUT /api/cities/:id` - обновить город
- `DELETE /api/cities/:id` - удалить город

### Nutrition Programs
- `GET /api/programs` - все программы (фильтр по city_id)
- `GET /api/programs/:id` - программа по ID
- `GET /api/programs/:id/prices` - программа с ценами
- `POST /api/programs` - создать программу
- `PUT /api/programs/:id` - обновить программу
- `DELETE /api/programs/:id` - удалить программу

### Dishes
- `GET /api/dishes` - все блюда
- `GET /api/dishes/:id` - блюдо по ID
- `GET /api/dishes/:id/ingredients` - блюдо с ингредиентами
- `POST /api/dishes` - создать блюдо
- `PUT /api/dishes/:id` - обновить блюдо
- `DELETE /api/dishes/:id` - удалить блюдо

### Orders
- `GET /api/orders` - все заказы
- `GET /api/orders/:id` - заказ по ID с элементами
- `POST /api/orders` - создать заказ (с транзакцией)
- `PUT /api/orders/:id` - обновить заказ
- `DELETE /api/orders/:id` - удалить заказ

### Tilda API (публичный, без аутентификации)
- `GET /api/tilda/menu` - все данные меню (программы, города, цены)
- `GET /api/tilda/menu/:programId/dishes` - блюда программы
- `GET /api/tilda/dishes/:dishId` - детали блюда с ингредиентами

### Cache Management (требует API ключ)
- `POST /api/cache/clear` - очистить кэш
- `GET /api/cache/stats` - статистика кэша

### Utility
- `GET /health` - проверка работы сервера

## NPM Scripts

```bash
npm start          # Запуск продакшен сервера
npm run dev        # Запуск с автоперезагрузкой (nodemon)
npm run test:db    # Проверка подключения к БД
npm run migrate    # Запуск миграций (создание схемы БД)
```

## Технологический стек

- **Node.js** - серверная среда выполнения JavaScript
- **Express.js 5** - веб-фреймворк для создания API
- **PostgreSQL** - реляционная база данных
- **pg** - PostgreSQL клиент для Node.js
- **ioredis** - клиент Redis для кэширования (опционально)
- **dotenv** - управление переменными окружения
- **cors** - обработка CORS-запросов
- **nodemon** (dev) - автоперезагрузка при разработке

## Переменные окружения

```env
# Сервер
PORT=3000                          # Порт сервера
NODE_ENV=development               # Окружение (development/production)

# PostgreSQL
DB_HOST=localhost                  # Хост PostgreSQL
DB_PORT=5432                       # Порт PostgreSQL
DB_NAME=fitbox                     # Имя базы данных
DB_USER=postgres                   # Пользователь БД
DB_PASSWORD=                       # Пароль БД

# Безопасность
API_KEY=                           # API ключ для защищенных операций (POST/PUT/DELETE)
CORS_ORIGIN=http://localhost:5173  # Разрешенный origin для CORS

# Redis (опционально)
REDIS_HOST=localhost               # Хост Redis
REDIS_PORT=6379                    # Порт Redis
REDIS_PASSWORD=                    # Пароль Redis
CACHE_TTL=600                      # Время жизни кэша (секунды)
```

## Дальнейшее развитие

### Реализовано:

✅ **Аутентификация** - API ключ для защищенных операций (POST/PUT/DELETE)
✅ **Кэширование** - Redis/In-memory для публичных API эндпоинтов
✅ **CORS** - настроенная политика CORS
✅ **Статические файлы** - раздача скриптов и изображений

### Рекомендуемые улучшения:

1. **Валидация данных** - joi или express-validator
2. **JWT токены** - для аутентификации пользователей (сейчас только API ключ для админов)
3. **Логирование** - morgan или winston
4. **Rate limiting** - защита от перегрузки
5. **Загрузка файлов** - multer для изображений
6. **Пагинация** - для списков
7. **Тесты** - jest, supertest
8. **API документация** - Swagger/OpenAPI

### Потенциальные фичи:

- Админ-панель для управления данными
- Система уведомлений (email, SMS)
- Интеграция с платежными системами
- Отслеживание статуса заказа
- Система скидок и промокодов (расширенная)
- Отзывы и рейтинги блюд
- Рекомендательная система
- Аналитика и отчеты

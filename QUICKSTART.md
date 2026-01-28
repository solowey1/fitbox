# Быстрый старт

## 1. Установка зависимостей
```bash
npm install
```

## 2. Настройка базы данных

Создайте базу данных PostgreSQL:
```bash
createdb fitbox
```

Или если нужен пароль:
```bash
psql -U postgres
CREATE DATABASE fitbox;
CREATE DATABASE baserow;
\q
```

## 3. Настройка переменных окружения

Отредактируйте файл `.env` и укажите пароль от вашей БД (если есть):
```env
DB_PASSWORD=ваш_пароль
```

## 4. Запуск миграций

Создайте таблицы и заполните тестовыми данными:
```bash
npm run migrate
```

## 5. Запуск сервера

```bash
npm run dev
```

Сервер запустится на `http://localhost:3000`

## 6. Проверка работы

Откройте в браузере или curl:
```bash
curl http://localhost:3000/health
```

Должно вернуться:
```json
{"status":"ok","message":"Server is running"}
```

## 7. Тестовые запросы

### Получить все города
```bash
curl http://localhost:3000/api/cities
```

### Получить программы питания
```bash
curl http://localhost:3000/api/nutrition-programs
```

### Получить программу с ценами
```bash
curl http://localhost:3000/api/nutrition-programs/1/prices
```

### Получить все блюда
```bash
curl http://localhost:3000/api/dishes
```

### Получить блюдо с ингредиентами
```bash
curl http://localhost:3000/api/dishes/1/ingredients
```

## Готово!

Теперь можно подключать фронтенд к API на `http://localhost:3000`

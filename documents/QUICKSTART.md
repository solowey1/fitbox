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

```bash
# Проверка работы API
curl http://localhost:3000/api/cities
curl http://localhost:3000/api/programs
```

## Готово!

Сервер запущен на `http://localhost:3000`

**Дальнейшие шаги:**
- Примеры запросов: [documents/API_EXAMPLES.md](./API_EXAMPLES.md)
- Подключение к Tilda: [documents/TILDA_CONNECT.md](./TILDA_CONNECT.md)
- Полная документация: [README.md](../README.md)

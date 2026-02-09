# API Аутентификация

## Обзор

API использует двухуровневую систему безопасности:
- **Публичные операции (GET)** - доступны без аутентификации
- **Мутирующие операции (POST, PUT, PATCH, DELETE)** - требуют API ключ

## Настройка API ключа

### 1. Генерация API ключа

Используйте криптографически стойкий генератор для создания ключа:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Добавление ключа в .env

```env
API_KEY=ваш_сгенерированный_ключ_здесь
```

**Важно:**
- Никогда не коммитьте файл `.env` в репозиторий
- Используйте разные ключи для разработки и продакшена
- Храните ключи в безопасном месте (password manager, secrets manager)

## Использование API ключа

### Способ 1: Заголовок X-API-Key (рекомендуется)

```bash
curl -X POST https://app.fitbox.su/api/programs \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"title":"Новая программа"}'
```

### Способ 2: Authorization заголовок

```bash
curl -X POST https://app.fitbox.su/api/programs \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"title":"Новая программа"}'
```

### Способ 3: Query параметр (НЕ рекомендуется)

```bash
curl -X POST "https://app.fitbox.su/api/programs?api_key=your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"title":"Новая программа"}'
```

**Примечание:** Query параметры логируются в истории браузера и серверных логах, поэтому этот способ менее безопасен.

## Примеры использования

### JavaScript/TypeScript (Fetch API)

```javascript
const API_KEY = process.env.API_KEY; // Храните в переменных окружения!

// Публичный запрос (без ключа)
const programs = await fetch('https://app.fitbox.su/api/programs');
const data = await programs.json();

// Защищенный запрос (с ключом)
const response = await fetch('https://app.fitbox.su/api/programs', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY
  },
  body: JSON.stringify({
    title: 'Новая программа',
    emoji: '🏃',
    sort: 1
  })
});
```

### Node.js (Axios)

```javascript
const axios = require('axios');

const api = axios.create({
  baseURL: 'https://app.fitbox.su/api',
  headers: {
    'X-API-Key': process.env.API_KEY
  }
});

// Защищенный запрос
const response = await api.post('/programs', {
  title: 'Новая программа',
  emoji: '🏃'
});
```

### Python (requests)

```python
import os
import requests

API_KEY = os.getenv('API_KEY')

# Защищенный запрос
response = requests.post(
    'https://app.fitbox.su/api/programs',
    headers={'X-API-Key': API_KEY},
    json={'title': 'Новая программа', 'emoji': '🏃'}
)
```

## Матрица доступа к эндпоинтам

| Метод | Эндпоинт | Требуется ключ | Описание |
|-------|----------|----------------|----------|
| GET | `/api/cities` | ❌ | Получить список городов |
| GET | `/api/cities/:id` | ❌ | Получить город по ID |
| POST | `/api/cities` | ✅ | Создать город |
| PUT | `/api/cities/:id` | ✅ | Обновить город |
| DELETE | `/api/cities/:id` | ✅ | Удалить город |
| GET | `/api/programs` | ❌ | Получить программы питания |
| GET | `/api/programs/:id` | ❌ | Получить программу по ID |
| GET | `/api/programs/:id/prices` | ❌ | Получить программу с ценами |
| POST | `/api/programs` | ✅ | Создать программу |
| PUT | `/api/programs/:id` | ✅ | Обновить программу |
| DELETE | `/api/programs/:id` | ✅ | Удалить программу |
| POST | `/api/programs/:id/cities/:cityId` | ✅ | Привязать программу к городу |
| DELETE | `/api/programs/:id/cities/:cityId` | ✅ | Отвязать программу от города |
| GET | `/api/dishes` | ❌ | Получить блюда |
| GET | `/api/dishes/:id` | ❌ | Получить блюдо по ID |
| GET | `/api/dishes/:id/ingredients` | ❌ | Получить блюдо с ингредиентами |
| POST | `/api/dishes` | ✅ | Создать блюдо |
| PUT | `/api/dishes/:id` | ✅ | Обновить блюдо |
| DELETE | `/api/dishes/:id` | ✅ | Удалить блюдо |
| GET | `/api/orders` | ❌ | Получить заказы |
| GET | `/api/orders/:id` | ❌ | Получить заказ по ID |
| POST | `/api/orders` | ❌ | Создать заказ (публично) |
| PUT | `/api/orders/:id` | ✅ | Обновить заказ |
| DELETE | `/api/orders/:id` | ✅ | Удалить заказ |

## Коды ошибок

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "API key is required for this operation"
}
```

**Причина:** API ключ не был передан в запросе

**Решение:** Добавьте заголовок `X-API-Key` с вашим ключом

### 403 Forbidden
```json
{
  "error": "Forbidden",
  "message": "Invalid API key"
}
```

**Причина:** Передан неверный API ключ

**Решение:** Проверьте правильность API ключа в `.env` файле

### 500 Internal Server Error
```json
{
  "error": "Server configuration error",
  "message": "API key is not configured"
}
```

**Причина:** API ключ не настроен на сервере

**Решение:** Администратор должен добавить `API_KEY` в `.env` файл на сервере

## Best Practices

1. **Храните ключи в безопасности**
   - Используйте переменные окружения
   - Не коммитьте `.env` файлы
   - Используйте secrets managers для продакшена

2. **Ротация ключей**
   - Регулярно меняйте API ключи (раз в 3-6 месяцев)
   - Немедленно меняйте ключи при компрометации

3. **Используйте HTTPS**
   - Всегда используйте HTTPS для защиты ключей при передаче
   - Никогда не передавайте ключи по HTTP

4. **Логирование**
   - Не логируйте API ключи
   - Логируйте попытки несанкционированного доступа

5. **Мониторинг**
   - Отслеживайте подозрительную активность
   - Настройте алерты на множественные неудачные попытки аутентификации

## Тестирование локально

```bash
# 1. Настройте API ключ в .env
echo "API_KEY=test-key-12345" >> .env

# 2. Запустите сервер
npm start

# 3. Протестируйте публичный эндпоинт (без ключа)
curl http://localhost:3000/api/programs

# 4. Протестируйте защищенный эндпоинт (без ключа - должна быть ошибка)
curl -X POST http://localhost:3000/api/programs \
  -H "Content-Type: application/json" \
  -d '{"title":"Test"}'

# 5. Протестируйте защищенный эндпоинт (с ключом - должно работать)
curl -X POST http://localhost:3000/api/programs \
  -H "Content-Type: application/json" \
  -H "X-API-Key: test-key-12345" \
  -d '{"title":"Test"}'
```

## FAQ

**Q: Нужен ли API ключ для чтения данных (GET запросы)?**
A: Нет, все GET запросы доступны публично без аутентификации.

**Q: Как защитить POST /api/orders для создания заказов клиентами?**
A: Сейчас этот эндпоинт публичный. Если нужна защита, добавьте `authMiddleware` в роут или реализуйте другую систему аутентификации (например, JWT для пользователей).

**Q: Могу ли я использовать несколько API ключей?**
A: В текущей реализации поддерживается только один ключ. Для множественных ключей нужно расширить middleware.

**Q: Что делать, если ключ скомпрометирован?**
A: Немедленно сгенерируйте новый ключ, обновите `.env` на сервере и перезапустите приложение.

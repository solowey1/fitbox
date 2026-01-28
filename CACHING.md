# Кэширование API

## Обзор

Система кэширования поддерживает два режима:
1. **Redis** (рекомендуется для продакшена)
2. **In-memory** (автоматический fallback, если Redis недоступен)

## Установка Redis (опционально)

### Вариант 1: Локальная установка

**macOS:**
```bash
brew install redis
brew services start redis
```

**Ubuntu/Debian:**
```bash
sudo apt-get install redis-server
sudo systemctl start redis
```

**Docker:**
```bash
docker run -d -p 6379:6379 --name redis redis:alpine
```

### Вариант 2: Использование без Redis

Если Redis не установлен, система автоматически использует in-memory кэш. Это подходит для:
- Разработки
- Малых нагрузок
- Тестирования

**Ограничения in-memory кэша:**
- ❌ Кэш очищается при перезапуске сервера
- ❌ Не масштабируется на несколько инстансов
- ✅ Не требует дополнительных зависимостей

## Установка ioredis

Для использования Redis установите клиент:

```bash
npm install ioredis
```

## Конфигурация

Добавьте в `.env`:

```env
# Redis (опционально)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Время жизни кэша по умолчанию (секунды)
CACHE_TTL=600
```

## Как работает кэширование

### 1. Автоматическое кэширование GET запросов

Tilda API эндпоинты автоматически кэшируются:

| Эндпоинт | TTL | Описание |
|----------|-----|----------|
| `/api/tilda/menu` | 10 мин | Все данные меню |
| `/api/tilda/menu/:id/dishes` | 15 мин | Блюда программы |
| `/api/tilda/dishes/:id` | 30 мин | Детали блюда |

### 2. Автоматическая инвалидация

При изменении данных через защищенные API (с API ключом), кэш автоматически очищается:

```javascript
// При создании/обновлении/удалении программы
POST   /api/programs          → Очищает весь кэш
PUT    /api/programs/:id      → Очищает весь кэш
DELETE /api/programs/:id      → Очищает весь кэш
```

### 3. Ручная очистка кэша

**Очистить весь кэш:**
```bash
curl -X POST https://api.fitbox.su/api/cache/clear \
  -H "X-API-Key: your-api-key"
```

**Очистить кэш по паттерну:**
```bash
curl -X POST "https://api.fitbox.su/api/cache/clear?pattern=cache:/api/tilda/*" \
  -H "X-API-Key: your-api-key"
```

**Получить статистику кэша:**
```bash
curl https://api.fitbox.su/api/cache/stats
```

Пример ответа:
```json
{
  "cacheType": "redis",
  "timestamp": "2026-01-27T18:00:00.000Z",
  "keys": 42,
  "hits": 1523,
  "misses": 87,
  "hitRate": "94.59%"
}
```

## Интеграция с NocoDB

### Вопрос: Нужен ли общий Redis для NocoDB и Backend?

**Ответ: НЕТ, используйте отдельные инстансы Redis**

### Рекомендуемая архитектура:

```
┌─────────────────────────────────────────┐
│           Ваше приложение               │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────┐      ┌──────────────┐ │
│  │   Backend   │      │   NocoDB     │ │
│  │   (Node.js) │      │              │ │
│  └──────┬──────┘      └──────┬───────┘ │
│         │                    │         │
│         │                    │         │
│  ┌──────▼──────┐      ┌──────▼───────┐ │
│  │  Redis #1   │      │  Redis #2    │ │
│  │  (Backend)  │      │  (NocoDB)    │ │
│  │  Port: 6379 │      │  Port: 6380  │ │
│  └─────────────┘      └──────────────┘ │
│         │                    │         │
│         └────────┬───────────┘         │
│                  │                     │
│           ┌──────▼──────┐              │
│           │  PostgreSQL │              │
│           └─────────────┘              │
└─────────────────────────────────────────┘
```

### Почему отдельные Redis?

1. **Изоляция данных** - разные структуры кэша
2. **Независимое масштабирование** - разные настройки TTL
3. **Безопасность** - разные политики доступа
4. **Отказоустойчивость** - проблемы одного не влияют на другой

### Запуск двух Redis (Docker)

```bash
# Redis для Backend (порт 6379)
docker run -d \
  --name redis-backend \
  -p 6379:6379 \
  redis:alpine

# Redis для NocoDB (порт 6380)
docker run -d \
  --name redis-nocodb \
  -p 6380:6379 \
  redis:alpine
```

### Конфигурация Backend (.env)

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

### Конфигурация NocoDB

```env
NC_REDIS_URL=redis://localhost:6380
```

## Очистка кэша при изменениях в NocoDB

### Проблема

Когда менеджеры изменяют данные через NocoDB, ваш backend кэш не знает об этом.

### Решения

#### Вариант 1: Webhook от NocoDB (рекомендуется)

NocoDB поддерживает webhooks при изменении данных:

1. Настройте webhook в NocoDB:
   - URL: `https://api.fitbox.su/api/cache/clear`
   - Method: POST
   - Headers: `X-API-Key: your-api-key`

2. При изменении данных в NocoDB автоматически очищается кэш

#### Вариант 2: Короткий TTL

Используйте короткое время жизни кэша (например, 5 минут):

```env
CACHE_TTL=300
```

**Плюсы:**
- Просто
- Данные обновляются максимум через 5 минут

**Минусы:**
- Больше нагрузка на БД
- Меньше эффект от кэширования

#### Вариант 3: PostgreSQL LISTEN/NOTIFY

Слушайте изменения в базе напрямую:

```javascript
// В вашем backend
const { Pool } = require('pg');
const pool = new Pool({...});

const client = await pool.connect();
await client.query('LISTEN data_changed');

client.on('notification', async (msg) => {
  if (msg.channel === 'data_changed') {
    await clearCache('cache:*');
    console.log('Cache cleared due to DB change');
  }
});

// Триггер в PostgreSQL
CREATE OR REPLACE FUNCTION notify_data_change()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('data_changed', '');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER nutrition_programs_changed
AFTER INSERT OR UPDATE OR DELETE ON nutrition_programs
FOR EACH ROW EXECUTE FUNCTION notify_data_change();
```

**Плюсы:**
- Мгновенная инвалидация
- Не зависит от NocoDB

**Минусы:**
- Требует настройки триггеров в БД

#### Вариант 4: Cron задача

Очищайте кэш по расписанию:

```bash
# Добавьте в crontab (каждые 15 минут)
*/15 * * * * curl -X POST https://api.fitbox.su/api/cache/clear \
  -H "X-API-Key: your-api-key"
```

## Мониторинг кэша

### Метрики для отслеживания

1. **Hit Rate** - процент попаданий в кэш
   - Хорошо: > 80%
   - Плохо: < 50%

2. **Keys Count** - количество ключей в кэше
   - Следите за ростом

3. **Memory Usage** (для Redis)
   ```bash
   redis-cli info memory
   ```

### Логирование

В консоли сервера вы увидите:
```
✓ Cache HIT: cache:/api/tilda/menu
✗ Cache MISS: cache:/api/tilda/menu
✓ Cache invalidated: 15 keys (pattern: cache:*)
```

## Best Practices

### 1. Правильный TTL

| Тип данных | Рекомендуемый TTL | Обоснование |
|------------|-------------------|-------------|
| Меню/программы | 10-15 минут | Меняется редко |
| Блюда | 15-30 минут | Меняется очень редко |
| Цены | 5-10 минут | Может меняться чаще |
| Статика (изображения) | 1 час+ | Почти не меняется |

### 2. Использование паттернов

При очистке кэша используйте точные паттерны:

```javascript
// Плохо - очищает весь кэш
await clearCache('cache:*');

// Хорошо - только данные меню
await clearCache('cache:/api/tilda/menu*');

// Еще лучше - только конкретная программа
await clearCache('cache:/api/tilda/menu/1/*');
```

### 3. Версионирование API

При критических изменениях в API меняйте версию и очищайте кэш:

```bash
# После деплоя новой версии
curl -X POST https://api.fitbox.su/api/cache/clear \
  -H "X-API-Key: your-api-key"
```

### 4. Разделение кэша по окружениям

Используйте префиксы для разных окружений:

```javascript
const cacheKey = `${process.env.NODE_ENV}:cache:${req.originalUrl}`;
// development:cache:/api/tilda/menu
// production:cache:/api/tilda/menu
```

## Troubleshooting

### Redis не подключается

**Проблема:**
```
Redis error, fallback to memory cache: connect ECONNREFUSED 127.0.0.1:6379
```

**Решение:**
1. Проверьте, запущен ли Redis: `redis-cli ping` (должно вернуть `PONG`)
2. Проверьте порт: `netstat -an | grep 6379`
3. Проверьте конфигурацию в `.env`

### Кэш не очищается

**Проблема:** После изменения данных старые данные в кэше

**Решение:**
1. Проверьте, что middleware применен к роутам
2. Проверьте логи: должны быть сообщения "Cache invalidated"
3. Очистите кэш вручную:
   ```bash
   curl -X POST http://localhost:3000/api/cache/clear \
     -H "X-API-Key: your-api-key"
   ```

### Кэш слишком большой

**Проблема:** Redis использует много памяти

**Решение:**
1. Уменьшите TTL в `.env`
2. Настройте eviction policy в Redis:
   ```bash
   redis-cli config set maxmemory 100mb
   redis-cli config set maxmemory-policy allkeys-lru
   ```

## FAQ

**Q: Нужно ли устанавливать Redis?**
A: Нет, система работает с in-memory кэшем. Redis рекомендуется для продакшена.

**Q: Как узнать, используется Redis или memory?**
A: Проверьте логи при старте сервера или запросите `/api/cache/stats`

**Q: Можно ли отключить кэширование?**
A: Да, установите `CACHE_TTL=0` в `.env` или удалите middleware из роутов

**Q: Очищается ли кэш при рестарте сервера?**
A: In-memory - да, Redis - нет (данные сохраняются)

**Q: Как кэшировать для разных городов?**
A: Уже реализовано - ключ кэша включает query параметры (subdomain)

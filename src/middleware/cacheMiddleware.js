/**
 * Middleware для кэширования ответов API
 * Поддерживает как Redis, так и in-memory кэширование
 *
 * Установка Redis (опционально):
 * npm install ioredis
 *
 * Конфигурация в .env:
 * REDIS_HOST=localhost
 * REDIS_PORT=6379
 * REDIS_PASSWORD=your-password (опционально)
 * CACHE_TTL=600 (время жизни кэша в секундах, по умолчанию 10 минут)
 */

let redis = null;
let memoryCache = new Map();

// Попытка подключения к Redis
try {
  const Redis = require('ioredis');
  redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    retryStrategy: (times) => {
      if (times > 3) {
        console.warn('Redis недоступен, используется in-memory кэш');
        return null; // Прекращаем попытки переподключения
      }
      return Math.min(times * 100, 3000);
    }
  });

  redis.on('error', (err) => {
    console.warn('Redis error, fallback to memory cache:', err.message);
    redis = null;
  });

  redis.on('connect', () => {
    console.log('✓ Redis connected');
  });
} catch (err) {
  console.log('Redis не установлен, используется in-memory кэш');
  redis = null;
}

/**
 * Получить значение из кэша
 */
const getCacheValue = async (key) => {
  if (redis) {
    try {
      const value = await redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (err) {
      console.error('Redis get error:', err);
      return null;
    }
  } else {
    // In-memory кэш
    const cached = memoryCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }
    memoryCache.delete(key);
    return null;
  }
};

/**
 * Установить значение в кэш
 */
const setCacheValue = async (key, value, ttl) => {
  if (redis) {
    try {
      await redis.set(key, JSON.stringify(value), 'EX', ttl);
    } catch (err) {
      console.error('Redis set error:', err);
    }
  } else {
    // In-memory кэш
    memoryCache.set(key, {
      value,
      expiresAt: Date.now() + (ttl * 1000)
    });
  }
};

/**
 * Удалить значение из кэша
 */
const deleteCacheValue = async (key) => {
  if (redis) {
    try {
      await redis.del(key);
    } catch (err) {
      console.error('Redis del error:', err);
    }
  } else {
    memoryCache.delete(key);
  }
};

/**
 * Очистить весь кэш или по паттерну
 */
const clearCache = async (pattern = '*') => {
  if (redis) {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      return keys.length;
    } catch (err) {
      console.error('Redis clear error:', err);
      return 0;
    }
  } else {
    // Очищаем in-memory кэш
    if (pattern === '*') {
      const size = memoryCache.size;
      memoryCache.clear();
      return size;
    } else {
      // Примитивный pattern matching для memory cache
      let count = 0;
      const regex = new RegExp(pattern.replace('*', '.*'));
      for (const key of memoryCache.keys()) {
        if (regex.test(key)) {
          memoryCache.delete(key);
          count++;
        }
      }
      return count;
    }
  }
};

/**
 * Middleware для кэширования GET запросов
 *
 * @param {number} ttl - Время жизни кэша в секундах (по умолчанию из .env или 600)
 * @param {function} keyGenerator - Функция для генерации ключа кэша (опционально)
 */
const cacheMiddleware = (ttl = null, keyGenerator = null) => {
  const cacheTTL = ttl || parseInt(process.env.CACHE_TTL) || 600; // 10 минут по умолчанию

  return async (req, res, next) => {
    // Кэшируем только GET запросы
    if (req.method !== 'GET') {
      return next();
    }

    // Генерируем ключ кэша
    const cacheKey = keyGenerator
      ? keyGenerator(req)
      : `cache:${req.originalUrl}`;

    try {
      // Пытаемся получить из кэша
      const cachedData = await getCacheValue(cacheKey);

      if (cachedData) {
        console.log(`✓ Cache HIT: ${cacheKey}`);
        return res.json(cachedData);
      }

      console.log(`✗ Cache MISS: ${cacheKey}`);

      // Перехватываем res.json для сохранения в кэш
      const originalJson = res.json.bind(res);
      res.json = async (data) => {
        // Сохраняем в кэш только успешные ответы
        if (res.statusCode >= 200 && res.statusCode < 300) {
          await setCacheValue(cacheKey, data, cacheTTL);
        }
        return originalJson(data);
      };

      next();
    } catch (err) {
      console.error('Cache middleware error:', err);
      next();
    }
  };
};

/**
 * Middleware для инвалидации кэша при мутирующих операциях
 * Автоматически очищает кэш при POST, PUT, PATCH, DELETE
 */
const cacheInvalidationMiddleware = (pattern = '*') => {
  return async (req, res, next) => {
    // Только для мутирующих операций
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      // Перехватываем res.json для очистки кэша после успешного ответа
      const originalJson = res.json.bind(res);
      res.json = async (data) => {
        // Очищаем кэш только при успешном ответе
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const cleared = await clearCache(pattern);
          console.log(`✓ Cache invalidated: ${cleared} keys (pattern: ${pattern})`);
        }
        return originalJson(data);
      };
    }

    next();
  };
};

/**
 * Эндпоинт для ручной очистки кэша (защищен authMiddleware)
 */
const createClearCacheEndpoint = () => {
  return async (req, res) => {
    try {
      const { pattern = '*' } = req.query;
      const cleared = await clearCache(pattern);

      res.json({
        success: true,
        message: `Cache cleared successfully`,
        keysCleared: cleared,
        pattern: pattern,
        cacheType: redis ? 'redis' : 'memory'
      });
    } catch (err) {
      console.error('Clear cache error:', err);
      res.status(500).json({
        success: false,
        error: 'Failed to clear cache',
        message: err.message
      });
    }
  };
};

/**
 * Получить статистику кэша
 */
const getCacheStats = () => {
  return async (req, res) => {
    try {
      let stats = {
        cacheType: redis ? 'redis' : 'memory',
        timestamp: new Date().toISOString()
      };

      if (redis) {
        const info = await redis.info('stats');
        const keyCount = await redis.dbsize();
        stats = {
          ...stats,
          keys: keyCount,
          hits: parseInt(info.match(/keyspace_hits:(\d+)/)?.[1] || 0),
          misses: parseInt(info.match(/keyspace_misses:(\d+)/)?.[1] || 0),
        };
        stats.hitRate = stats.hits + stats.misses > 0
          ? ((stats.hits / (stats.hits + stats.misses)) * 100).toFixed(2) + '%'
          : '0%';
      } else {
        // In-memory stats
        stats = {
          ...stats,
          keys: memoryCache.size,
          message: 'In-memory cache (consider installing Redis for production)'
        };
      }

      res.json(stats);
    } catch (err) {
      console.error('Cache stats error:', err);
      res.status(500).json({
        error: 'Failed to get cache stats',
        message: err.message
      });
    }
  };
};

// Экспортируем
module.exports = {
  cacheMiddleware,
  cacheInvalidationMiddleware,
  createClearCacheEndpoint,
  getCacheStats,
  clearCache,
  getCacheValue,
  setCacheValue,
  deleteCacheValue
};

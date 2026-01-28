/**
 * Middleware для аутентификации запросов с использованием API ключа
 * Защищает мутирующие операции (POST, PUT, PATCH, DELETE) от несанкционированного доступа
 *
 * Использование:
 * - Добавьте API_KEY в .env файл
 * - Применяйте middleware к защищенным роутам
 * - Клиент должен передавать ключ в заголовке: X-API-Key: your-api-key
 */

const authMiddleware = (req, res, next) => {
  // Разрешаем GET и OPTIONS запросы без аутентификации (публичное чтение данных)
  if (req.method === 'GET' || req.method === 'OPTIONS') {
    return next();
  }

  // Проверяем наличие API ключа в переменных окружения
  const serverApiKey = process.env.API_KEY;

  if (!serverApiKey) {
    console.error('API_KEY не настроен в переменных окружения');
    return res.status(500).json({
      error: 'Server configuration error',
      message: 'API key is not configured'
    });
  }

  // Получаем ключ из заголовков (поддерживаем несколько вариантов)
  const clientApiKey = req.headers['x-api-key'] ||
                       req.headers['authorization']?.replace('Bearer ', '') ||
                       req.query.api_key; // Опционально: из query параметра (менее безопасно)

  // Проверяем наличие ключа в запросе
  if (!clientApiKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'API key is required for this operation'
    });
  }

  // Проверяем соответствие ключей
  if (clientApiKey !== serverApiKey) {
    console.warn('Invalid API key attempt:', {
      ip: req.ip,
      method: req.method,
      path: req.path,
      timestamp: new Date().toISOString()
    });

    return res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid API key'
    });
  }

  // Ключ валиден, продолжаем обработку запроса
  next();
};

module.exports = authMiddleware;

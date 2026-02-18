/**
 * Middleware для проверки API-ключа Тильды при создании заказов.
 * Тильда отправляет вебхуки с данными заказа — этот middleware
 * гарантирует, что запрос пришёл именно от Тильды.
 *
 * Клиент должен передавать ключ в заголовке: X-Tilda-Api-Key: <ключ>
 */

const tildaMiddleware = (req, res, next) => {
  const serverKey = process.env.TILDA_API_KEY;

  if (!serverKey) {
    console.error('TILDA_API_KEY не настроен в переменных окружения');
    return res.status(500).json({
      error: 'Server configuration error',
      message: 'Tilda API key is not configured',
    });
  }

  const clientKey = req.headers['x-tilda-api-key'];

  if (!clientKey) {
    console.warn('Order request without Tilda API key:', {
      ip: req.ip,
      timestamp: new Date().toISOString(),
    });
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Tilda API key is required',
    });
  }

  if (clientKey !== serverKey) {
    console.warn('Invalid Tilda API key attempt:', {
      ip: req.ip,
      timestamp: new Date().toISOString(),
    });
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid Tilda API key',
    });
  }

  next();
};

module.exports = tildaMiddleware;

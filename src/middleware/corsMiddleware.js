const cors = require('cors');

const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Разрешенные домены
    const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').filter(Boolean);

    // Всегда разрешаем localhost для разработки
    const defaultAllowed = [
      'http://localhost:3000',
      'http://localhost:3010',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3010'
    ];

    const allAllowed = [...defaultAllowed, ...allowedOrigins];

    // Если origin не указан (например, Postman) или в списке разрешенных - пропускаем
    if (!origin || allAllowed.includes(origin)) {
      callback(null, true);
    } else {
      console.warn('CORS request from:', origin, '- allowed origins:', allAllowed);
      callback(null, true); // Временно разрешаем все для отладки
    }
  },
  credentials: true,
  // Разрешаем все методы для CORS (защита на уровне authMiddleware)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  // Разрешаем заголовки для аутентификации и стандартные заголовки
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  optionsSuccessStatus: 204,
  preflightContinue: false,
});

module.exports = corsMiddleware;

const cors = require('cors');

const corsMiddleware = cors({
  origin: process.env.NODE_ENV === 'production'
    ? (origin, callback) => {
      const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',');
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.error('CORS blocked:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    }
    : '*', // В разработке разрешаем всё
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

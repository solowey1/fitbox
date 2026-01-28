const express = require('express');
const corsMiddleware = require('./src/middleware/corsMiddleware');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(corsMiddleware);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Статические файлы для загрузки изображений
app.use('/uploads', express.static('public/uploads'));

// Статические скрипты для Tilda (с правильными заголовками)
app.use('/scripts', express.static('scripts', {
  setHeaders: (res, path) => {
    if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Кэш на 1 час
    }
  }
}));

// Routes
app.use('/api/cities', require('./src/routes/cities'));
app.use('/api/programs', require('./src/routes/nutritionPrograms'));
app.use('/api/dishes', require('./src/routes/dishes'));
app.use('/api/orders', require('./src/routes/orders'));
app.use('/api/tilda', require('./src/routes/tilda')); // Публичный API для Tilda frontend

// Cache management (защищено authMiddleware)
const authMiddleware = require('./src/middleware/authMiddleware');
const { createClearCacheEndpoint, getCacheStats } = require('./src/middleware/cacheMiddleware');
app.post('/api/cache/clear', authMiddleware, createClearCacheEndpoint());
app.get('/api/cache/stats', getCacheStats());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Database: ${process.env.DB_NAME || 'fitbox'}`);
});

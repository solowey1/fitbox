const express = require('express');
const corsMiddleware = require('./src/middleware/corsMiddleware');
const initCronJobs = require('./src/cron');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(corsMiddleware);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Статические файлы для загрузки изображений
app.use('/uploads', express.static('public/uploads'));

// Файлы для Tilda: web/<страница>/… → https://app.fitbox.su/web/<страница>/…
const webHeaders = (res, filePath) => {
  if (filePath.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  if (filePath.endsWith('.css')) res.setHeader('Content-Type', 'text/css; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600'); // Кэш на 1 час
};
app.use('/web', express.static('web', { setHeaders: webHeaders }));

// Старые адреса /scripts/*.js — пока на Тильде не заменили код блоков и HEAD.
// Отдаём только эти файлы: серверные скрипты из scripts/ наружу не видны.
const legacyScripts = {
  'constructor.js': 'web/constructor/constructor.js',
  'delivery-date.js': 'web/shared/delivery-date.js',
  'delivery-datepicker.js': 'web/shared/delivery-datepicker.js',
  'delivery-cutoff-tester.js': 'web/dev/delivery-cutoff-tester.js',
  'tilda.js': 'web/programs/programs.js',
  'tilda-old.js': 'web/legacy/tilda-old.js'
};
app.get('/scripts/:file', (req, res, next) => {
  const file = legacyScripts[req.params.file];
  if (!file) return next();
  res.sendFile(file, { root: __dirname, headers: { 'Cache-Control': 'public, max-age=3600' } }, (error) => {
    if (error) next(error);
  });
});

// Routes
app.use('/api/cities', require('./src/routes/cities'));
app.use('/api/programs', require('./src/routes/nutritionPrograms'));
app.use('/api/dishes', require('./src/routes/dishes'));
app.use('/api/orders', require('./src/routes/orders'));
app.use('/api/tilda', require('./src/routes/tilda')); // Публичный API для Tilda frontend
app.use('/api/admin', require('./src/routes/admin')); // Административные функции

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

  initCronJobs();
});

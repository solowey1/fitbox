const express = require('express');
const router = express.Router();
const { cacheMiddleware } = require('../middleware/cacheMiddleware');
const {
  getTildaMenu,
  getProgramDishes,
  getDishDetails
} = require('../controllers/tildaController');

/**
 * Публичные роуты для Tilda frontend
 * Все эндпоинты доступны без аутентификации
 * Кэшируются на 10 минут (600 секунд)
 */

// Получить все данные для меню (программы, города, цены)
// Кэш: 10 минут
router.get('/menu', cacheMiddleware(600), getTildaMenu);

// Получить блюда для конкретной программы
// Кэш: 15 минут (блюда меняются реже)
router.get('/menu/:programId/dishes', cacheMiddleware(900), getProgramDishes);

// Получить детальную информацию о блюде
// Кэш: 30 минут (детали блюда меняются очень редко)
router.get('/dishes/:dishId', cacheMiddleware(1800), getDishDetails);

module.exports = router;

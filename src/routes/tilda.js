const express = require('express');
const router = express.Router();
const { cacheMiddleware } = require('../middleware/cacheMiddleware');
const {
  getTildaMenu,
  getProgramDishes,
  getDishDetails,
  getConstructorMenu
} = require('../controllers/tildaController');
const { getDeliveryZone } = require('../controllers/deliveryZoneController');

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

// Блюда и приёмы пищи для конструктора «Собери своё меню», меню по датам (?dates=&city=)
// Кэш: 5 минут — изменения меню в Budibase появляются на сайте не позже чем через 5 минут
router.get('/constructor', cacheMiddleware(300), getConstructorMenu);

// Зона доставки по адресу из корзины (?city=&street=&house=&corpus=) — надбавка к доставке конструктора
// Кэш: сутки — адрес и зоны меняются редко, а геокодер просит не дёргать его без нужды
router.get('/delivery-zone', cacheMiddleware(86400), getDeliveryZone);

module.exports = router;

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
  getAllCities,
  getCityById,
  createCity,
  updateCity,
  deleteCity,
} = require('../controllers/citiesController');

// Публичные роуты (GET) - доступны без аутентификации
router.get('/', getAllCities);
router.get('/:id', getCityById);

// Защищенные роуты - требуют API ключ
router.post('/', authMiddleware, createCity);
router.put('/:id', authMiddleware, updateCity);
router.delete('/:id', authMiddleware, deleteCity);

module.exports = router;

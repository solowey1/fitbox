const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
  getAllDishes,
  getDishById,
  getDishWithIngredients,
  createDish,
  updateDish,
  deleteDish,
} = require('../controllers/dishesController');

// Публичные роуты (GET) - доступны без аутентификации
router.get('/', getAllDishes);
router.get('/:id', getDishById);
router.get('/:id/ingredients', getDishWithIngredients);

// Защищенные роуты - требуют API ключ
router.post('/', authMiddleware, createDish);
router.put('/:id', authMiddleware, updateDish);
router.delete('/:id', authMiddleware, deleteDish);

module.exports = router;

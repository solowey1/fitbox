const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
  getAllOrders,
  getOrderById,
  createOrder,
  updateOrder,
  deleteOrder,
} = require('../controllers/ordersController');

// Публичные роуты (GET) - доступны без аутентификации
router.get('/', getAllOrders);
router.get('/:id', getOrderById);

// POST для создания заказа может быть публичным (для фронтенда)
// Если хотите защитить - добавьте authMiddleware
router.post('/', createOrder);

// Защищенные роуты - требуют API ключ (только для администрирования)
router.put('/:id', authMiddleware, updateOrder);
router.delete('/:id', authMiddleware, deleteOrder);

module.exports = router;

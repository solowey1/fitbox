const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const tildaMiddleware = require('../middleware/tildaMiddleware');
const {
  getAllOrders,
  getOrderById,
  createOrder,
  updateOrder,
  deleteOrder,
} = require('../controllers/ordersController');

// Защищенные роуты - требуют API ключ Тильды
router.get('/', tildaMiddleware, getAllOrders);
router.get('/:id', tildaMiddleware, getOrderById);
router.post('/', tildaMiddleware, createOrder);

// Защищенные роуты - требуют API ключ (только для администрирования)
router.put('/:id', authMiddleware, updateOrder);
router.delete('/:id', authMiddleware, deleteOrder);

module.exports = router;

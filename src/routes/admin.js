/**
 * Роуты для административных функций
 */

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

/**
 * GET /api/admin/recalculate-nutrition
 * Пересчитать питательность всех программ
 * Требует заголовок: X-Admin-Key
 */
router.get('/recalculate-nutrition', adminController.recalculateNutritionEndpoint);

module.exports = router;

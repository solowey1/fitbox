const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { cacheInvalidationMiddleware } = require('../middleware/cacheMiddleware');
const {
  getAllNutritionPrograms,
  getNutritionProgramById,
  getNutritionProgramWithPrices,
  createNutritionProgram,
  updateNutritionProgram,
  deleteNutritionProgram,
  addProgramToCity,
  removeProgramFromCity,
} = require('../controllers/nutritionProgramsController');

// Публичные роуты (GET) - доступны без аутентификации
router.get('/', getAllNutritionPrograms);
router.get('/:id', getNutritionProgramById);
router.get('/:id/prices', getNutritionProgramWithPrices);

// Защищенные роуты - требуют API ключ
// Автоматически очищают кэш при изменениях
router.post('/', authMiddleware, cacheInvalidationMiddleware('cache:*'), createNutritionProgram);
router.put('/:id', authMiddleware, cacheInvalidationMiddleware('cache:*'), updateNutritionProgram);
router.delete('/:id', authMiddleware, cacheInvalidationMiddleware('cache:*'), deleteNutritionProgram);

// Управление связями программ и городов
router.post('/:programId/cities/:cityId', authMiddleware, cacheInvalidationMiddleware('cache:*'), addProgramToCity);
router.delete('/:programId/cities/:cityId', authMiddleware, cacheInvalidationMiddleware('cache:*'), removeProgramFromCity);

module.exports = router;

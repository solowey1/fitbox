/**
 * Контроллер для административных функций
 */

const recalculateNutrition = require('../../scripts/recalculate-nutrition');

/**
 * Пересчитать питательность всех программ
 * GET /api/admin/recalculate-nutrition
 *
 * Требует API ключ в заголовке: X-Admin-Key
 */
const recalculateNutritionEndpoint = async (req, res) => {
  try {
    // Простая проверка API ключа
    const adminKey = req.headers['x-admin-key'];
    const expectedKey = process.env.ADMIN_API_KEY || 'fitbox-admin-key-2024';

    if (adminKey !== expectedKey) {
      return res.status(403).json({
        success: false,
        message: 'Доступ запрещен. Неверный API ключ.'
      });
    }

    console.log('📞 API: Получен запрос на пересчет питательности');

    // Вызываем функцию пересчета
    const result = await recalculateNutrition();

    res.json({
      success: true,
      message: 'Питательность программ успешно пересчитана',
      data: result
    });

  } catch (error) {
    console.error('Ошибка в API пересчета питательности:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка при пересчете питательности',
      error: error.message
    });
  }
};

module.exports = {
  recalculateNutritionEndpoint
};

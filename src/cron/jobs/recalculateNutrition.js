const recalculateNutrition = require('../../../scripts/recalculate-nutrition');

module.exports = {
  name: 'Пересчет КБЖУ программ питатания',
  schedule: '0 3 * * *',
  task: async () => {
    console.log('\n[CRON] Запуск автоматического пересчета КБЖУ программ питания...');
    try {
      await recalculateNutrition();
      console.log('[CRON] Автоматический пересчет КБЖУ завершен успешно\n');
    } catch (error) {
      console.error('[CRON] Ошибка при автоматическом пересчете КБЖУ:', error);
    }
  }
};

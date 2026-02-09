/**
 * Скрипт для пересчета питательности программ
 * Вызывает SQL функцию recalculate_program_nutrition()
 *
 * Использование:
 * - Вручную: node scripts/recalculate-nutrition.js
 * - Автоматически: через cron в server.js
 * - Через API: GET /api/admin/recalculate-nutrition
 */

const db = require('../src/config/database');

const recalculateNutrition = async () => {
  try {
    console.log('🔄 Начинаю пересчет питательности программ...');

    const startTime = Date.now();

    // Вызываем SQL функцию
    const result = await db.query('SELECT * FROM recalculate_program_nutrition()');

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    // Выводим результаты
    console.log('\n📊 Результаты пересчета:');
    console.log('─'.repeat(100));

    result.rows.forEach(row => {
      if (row.updated) {
        console.log(`✅ ${row.program_title}:`);
        console.log(`   Калории: ${row.calories_from}-${row.calories_to} ккал`);
        console.log(`   БЖУ: ${row.proteins}/${row.fats}/${row.carbohydrates} г`);
      } else {
        console.log(`⚠️  ${row.program_title}: нет данных для пересчета`);
      }
    });

    console.log('─'.repeat(100));
    console.log(`\n✨ Пересчет завершен за ${duration} сек`);
    console.log(`📝 Обновлено программ: ${result.rows.filter(r => r.updated).length}/${result.rows.length}\n`);

    return {
      success: true,
      duration: parseFloat(duration),
      programs: result.rows.map(row => ({
        id: row.program_id,
        title: row.program_title,
        updated: row.updated,
        nutrition: row.updated ? {
          caloriesFrom: row.calories_from,
          caloriesTo: row.calories_to,
          proteins: row.proteins,
          fats: row.fats,
          carbohydrates: row.carbohydrates
        } : null
      }))
    };

  } catch (error) {
    console.error('❌ Ошибка при пересчете питательности:', error);
    throw error;
  }
};

// Если скрипт запущен напрямую (не через require)
if (require.main === module) {
  recalculateNutrition()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Критическая ошибка:', error);
      process.exit(1);
    });
}

module.exports = recalculateNutrition;

const { CronJob } = require('cron');

// Ночной пересчёт КБЖУ (jobs/recalculateNutrition) отключён: КБЖУ программ задано вручную
// (nutrition_programs.data) и пересчёт по ингредиентам его перезаписывал. Нужен пересчёт — вернуть
// require('./jobs/recalculateNutrition') в список или запустить вручную: GET /api/admin/recalculate-nutrition.
const jobs = [];

const initCronJobs = () => {
  if (process.env.CRON_ENABLED !== 'true') {
    console.log('[CRON] Cron-задачи отключены (CRON_ENABLED != true)');
    return;
  }

  jobs.forEach(({ name, schedule, timezone, task }) => {
    timezone = timezone || 'Europe/Moscow';
    new CronJob(schedule, task, null, true, timezone);
    console.log(`[CRON] ${name}: ${schedule} (${timezone})`);
  });
};

module.exports = initCronJobs;

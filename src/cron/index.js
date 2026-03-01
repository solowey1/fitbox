const { CronJob } = require('cron');

const jobs = [
  require('./jobs/recalculateNutrition'),
];

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

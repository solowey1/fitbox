const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

/**
 * Запуск миграций с учётом уже применённых.
 *
 * Применённые миграции хранятся в таблице schema_migrations (имя файла + дата).
 * Каждая новая миграция выполняется в отдельной транзакции, поэтому
 * BEGIN/COMMIT внутри самих .sql файлов не нужны.
 *
 * Параметры:
 *   --baseline=009  отметить миграции с номером <= 009 как применённые, не выполняя их.
 *                   Нужно один раз для существующей БД, где миграции применялись вручную.
 *   --dry-run       только показать, какие миграции будут применены
 */

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'fitbox',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});

const getArg = (name) => {
  const arg = process.argv.find(a => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!arg) return null;
  return arg.includes('=') ? arg.split('=')[1] : true;
};

// Номер миграции из имени файла: 009_add_... -> 9
const getMigrationNumber = (file) => parseInt(file.split('_')[0], 10);

async function runMigrations() {
  const migrationsDir = path.join(__dirname, '../migrations');
  const baseline = getArg('baseline');
  const dryRun = getArg('dry-run');

  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    // Отметить старые миграции как применённые без выполнения
    if (baseline) {
      const baselineNumber = parseInt(baseline, 10);
      if (isNaN(baselineNumber)) {
        throw new Error(`Некорректное значение --baseline: ${baseline}`);
      }

      const baselineFiles = files.filter(file => getMigrationNumber(file) <= baselineNumber);
      for (const file of baselineFiles) {
        await client.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING',
          [file]
        );
        console.log(`📌 ${file} отмечена как применённая`);
      }
      console.log('');
    }

    const appliedResult = await client.query('SELECT filename FROM schema_migrations');
    const applied = new Set(appliedResult.rows.map(row => row.filename));

    // Защита: если БД уже заполнена, а учёт миграций пуст — старые миграции
    // нельзя выполнять повторно (007 и 009 не идемпотентны)
    if (applied.size === 0) {
      const existing = await client.query(`SELECT to_regclass('public.dishes') AS dishes`);
      if (existing.rows[0].dishes) {
        throw new Error(
          'В БД уже есть таблицы, но schema_migrations пуста. ' +
          'Укажите, какие миграции уже применены, например: --baseline=009'
        );
      }
    }

    const pending = files.filter(file => !applied.has(file));

    if (pending.length === 0) {
      console.log('✅ Новых миграций нет');
      return;
    }

    console.log(`🔄 Миграций к применению: ${pending.length}\n`);

    for (const file of pending) {
      if (dryRun) {
        console.log(`⏭️  ${file} (dry-run)`);
        continue;
      }

      console.log(`⏳ Executing ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`${file}: ${error.message}`);
      }

      console.log(`✅ ${file} completed\n`);
    }

    console.log('🎉 All migrations completed successfully!');
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch(error => {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
});

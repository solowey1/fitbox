const { pool } = require('../src/config/database');

async function testConnection() {
  try {
    console.log('🔄 Testing database connection...\n');

    const result = await pool.query('SELECT NOW() as current_time, version()');

    console.log('✅ Database connection successful!');
    console.log('📅 Current time:', result.rows[0].current_time);
    console.log('🗄️  PostgreSQL version:', result.rows[0].version.split(',')[0]);

    // Проверка существования таблиц
    const tablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    if (tablesResult.rows.length > 0) {
      console.log('\n📊 Existing tables:');
      tablesResult.rows.forEach(row => {
        console.log(`  - ${row.table_name}`);
      });
    } else {
      console.log('\n⚠️  No tables found. Run migrations first: npm run migrate');
    }

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('\nMake sure:');
    console.error('1. PostgreSQL is running');
    console.error('2. Database "fitbox" exists');
    console.error('3. Connection settings in .env are correct');
    process.exit(1);
  }
}

testConnection();

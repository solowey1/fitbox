const db = require('../config/database');

// Получить все программы питания
const getAllNutritionPrograms = async (req, res) => {
  try {
    const { city_id } = req.query;

    let query = `
      SELECT np.*,
             array_agg(DISTINCT cnp.city_id) FILTER (WHERE cnp.city_id IS NOT NULL) as city_ids,
             array_agg(DISTINCT c.title) FILTER (WHERE c.title IS NOT NULL) as city_names
      FROM nutrition_programs np
      LEFT JOIN city_nutrition_programs cnp ON np.id = cnp.nutrition_program_id
      LEFT JOIN cities c ON cnp.city_id = c.id
    `;

    const params = [];

    if (city_id) {
      query += ' WHERE cnp.city_id = $1';
      params.push(city_id);
    }

    query += ' GROUP BY np.id ORDER BY np.sort ASC, np.created_at DESC';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching nutrition programs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Получить программу питания по ID
const getNutritionProgramById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT np.*,
              array_agg(DISTINCT cnp.city_id) FILTER (WHERE cnp.city_id IS NOT NULL) as city_ids,
              array_agg(DISTINCT c.title) FILTER (WHERE c.title IS NOT NULL) as city_names
       FROM nutrition_programs np
       LEFT JOIN city_nutrition_programs cnp ON np.id = cnp.nutrition_program_id
       LEFT JOIN cities c ON cnp.city_id = c.id
       WHERE np.id = $1
       GROUP BY np.id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Nutrition program not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching nutrition program:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Получить программу с ценами
const getNutritionProgramWithPrices = async (req, res) => {
  try {
    const { id } = req.params;
    const { city_id } = req.query;

    const programResult = await db.query(
      `SELECT np.*,
              array_agg(DISTINCT cnp.city_id) FILTER (WHERE cnp.city_id IS NOT NULL) as city_ids,
              array_agg(DISTINCT c.title) FILTER (WHERE c.title IS NOT NULL) as city_names
       FROM nutrition_programs np
       LEFT JOIN city_nutrition_programs cnp ON np.id = cnp.nutrition_program_id
       LEFT JOIN cities c ON cnp.city_id = c.id
       WHERE np.id = $1
       GROUP BY np.id`,
      [id]
    );

    if (programResult.rows.length === 0) {
      return res.status(404).json({ error: 'Nutrition program not found' });
    }

    const pricesResult = await db.query(
      'SELECT * FROM prices WHERE nutrition_program_id = $1 ORDER BY days ASC',
      [id]
    );

    const response = {
      ...programResult.rows[0],
      prices: pricesResult.rows,
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching nutrition program with prices:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Создать программу питания
const createNutritionProgram = async (req, res) => {
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    const { title, emoji, data, city_ids, sort } = req.body;

    // Создать программу питания
    const programResult = await client.query(
      'INSERT INTO nutrition_programs (title, emoji, data, sort) VALUES ($1, $2, $3, $4) RETURNING *',
      [title, emoji, JSON.stringify(data), sort || 0]
    );

    const programId = programResult.rows[0].id;

    // Привязать к городам, если указаны
    if (city_ids && city_ids.length > 0) {
      for (const cityId of city_ids) {
        await client.query(
          'INSERT INTO city_nutrition_programs (city_id, nutrition_program_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [cityId, programId]
        );
      }
    }

    await client.query('COMMIT');

    // Получить полную информацию о программе
    const fullProgramResult = await db.query(
      `SELECT np.*,
              array_agg(DISTINCT cnp.city_id) FILTER (WHERE cnp.city_id IS NOT NULL) as city_ids,
              array_agg(DISTINCT c.title) FILTER (WHERE c.title IS NOT NULL) as city_names
       FROM nutrition_programs np
       LEFT JOIN city_nutrition_programs cnp ON np.id = cnp.nutrition_program_id
       LEFT JOIN cities c ON cnp.city_id = c.id
       WHERE np.id = $1
       GROUP BY np.id`,
      [programId]
    );

    res.status(201).json(fullProgramResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating nutrition program:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

// Обновить программу питания
const updateNutritionProgram = async (req, res) => {
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { title, emoji, data, city_ids, sort } = req.body;

    // Обновить программу
    const result = await client.query(
      'UPDATE nutrition_programs SET title = $1, emoji = $2, data = $3, sort = $4 WHERE id = $5 RETURNING *',
      [title, emoji, JSON.stringify(data), sort, id]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Nutrition program not found' });
    }

    // Обновить связи с городами, если указаны
    if (city_ids !== undefined) {
      // Удалить старые связи
      await client.query(
        'DELETE FROM city_nutrition_programs WHERE nutrition_program_id = $1',
        [id]
      );

      // Добавить новые связи
      if (city_ids.length > 0) {
        for (const cityId of city_ids) {
          await client.query(
            'INSERT INTO city_nutrition_programs (city_id, nutrition_program_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [cityId, id]
          );
        }
      }
    }

    await client.query('COMMIT');

    // Получить полную информацию о программе
    const fullProgramResult = await db.query(
      `SELECT np.*,
              array_agg(DISTINCT cnp.city_id) FILTER (WHERE cnp.city_id IS NOT NULL) as city_ids,
              array_agg(DISTINCT c.title) FILTER (WHERE c.title IS NOT NULL) as city_names
       FROM nutrition_programs np
       LEFT JOIN city_nutrition_programs cnp ON np.id = cnp.nutrition_program_id
       LEFT JOIN cities c ON cnp.city_id = c.id
       WHERE np.id = $1
       GROUP BY np.id`,
      [id]
    );

    res.json(fullProgramResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating nutrition program:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

// Удалить программу питания
const deleteNutritionProgram = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM nutrition_programs WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Nutrition program not found' });
    }

    res.json({ message: 'Nutrition program deleted successfully' });
  } catch (error) {
    console.error('Error deleting nutrition program:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Привязать программу к городу
const addProgramToCity = async (req, res) => {
  try {
    const { programId, cityId } = req.params;

    await db.query(
      'INSERT INTO city_nutrition_programs (city_id, nutrition_program_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [cityId, programId]
    );

    res.json({ message: 'Program added to city successfully' });
  } catch (error) {
    console.error('Error adding program to city:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Отвязать программу от города
const removeProgramFromCity = async (req, res) => {
  try {
    const { programId, cityId } = req.params;

    const result = await db.query(
      'DELETE FROM city_nutrition_programs WHERE city_id = $1 AND nutrition_program_id = $2 RETURNING *',
      [cityId, programId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Program-city relation not found' });
    }

    res.json({ message: 'Program removed from city successfully' });
  } catch (error) {
    console.error('Error removing program from city:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getAllNutritionPrograms,
  getNutritionProgramById,
  getNutritionProgramWithPrices,
  createNutritionProgram,
  updateNutritionProgram,
  deleteNutritionProgram,
  addProgramToCity,
  removeProgramFromCity,
};

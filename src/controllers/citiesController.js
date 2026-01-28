const db = require('../config/database');

// Получить все города
const getAllCities = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM cities ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching cities:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Получить город по ID
const getCityById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM cities WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'City not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching city:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Создать новый город
const createCity = async (req, res) => {
  try {
    const { title, descr, started_at } = req.body;

    const result = await db.query(
      'INSERT INTO cities (title, descr, started_at) VALUES ($1, $2, $3) RETURNING *',
      [title, descr, started_at]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating city:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Обновить город
const updateCity = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, descr, started_at } = req.body;

    const result = await db.query(
      'UPDATE cities SET title = $1, descr = $2, started_at = $3 WHERE id = $4 RETURNING *',
      [title, descr, started_at, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'City not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating city:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Удалить город
const deleteCity = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query('DELETE FROM cities WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'City not found' });
    }

    res.json({ message: 'City deleted successfully' });
  } catch (error) {
    console.error('Error deleting city:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getAllCities,
  getCityById,
  createCity,
  updateCity,
  deleteCity,
};

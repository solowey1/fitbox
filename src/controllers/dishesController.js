const db = require('../config/database');

// Получить все блюда
const getAllDishes = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM dishes ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching dishes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Получить блюдо по ID
const getDishById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query('SELECT * FROM dishes WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dish not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching dish:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Получить блюдо с ингредиентами
const getDishWithIngredients = async (req, res) => {
  try {
    const { id } = req.params;

    const dishResult = await db.query('SELECT * FROM dishes WHERE id = $1', [id]);

    if (dishResult.rows.length === 0) {
      return res.status(404).json({ error: 'Dish not found' });
    }

    const ingredientsResult = await db.query(
      `SELECT i.*, di.quantity
       FROM ingredients i
       JOIN dish_ingredients di ON i.id = di.ingredient_id
       WHERE di.dish_id = $1`,
      [id]
    );

    const response = {
      ...dishResult.rows[0],
      ingredients: ingredientsResult.rows,
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching dish with ingredients:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Создать блюдо
const createDish = async (req, res) => {
  try {
    const { title, images } = req.body;

    const result = await db.query(
      'INSERT INTO dishes (title, images) VALUES ($1, $2) RETURNING *',
      [title, JSON.stringify(images || [])]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating dish:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Обновить блюдо
const updateDish = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, images } = req.body;

    const result = await db.query(
      'UPDATE dishes SET title = $1, images = $2 WHERE id = $3 RETURNING *',
      [title, JSON.stringify(images), id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dish not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating dish:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Удалить блюдо
const deleteDish = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query('DELETE FROM dishes WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dish not found' });
    }

    res.json({ message: 'Dish deleted successfully' });
  } catch (error) {
    console.error('Error deleting dish:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getAllDishes,
  getDishById,
  getDishWithIngredients,
  createDish,
  updateDish,
  deleteDish,
};

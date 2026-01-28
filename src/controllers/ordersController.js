const db = require('../config/database');

// Получить все заказы
const getAllOrders = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM orders ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Получить заказ по ID
const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    const orderResult = await db.query('SELECT * FROM orders WHERE id = $1', [id]);

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Получить элементы заказа с информацией о программах питания
    const itemsResult = await db.query(
      `SELECT oi.*, np.title as program_title, p.days
       FROM order_items oi
       JOIN nutrition_programs np ON oi.nutrition_program_id = np.id
       JOIN prices p ON oi.price_id = p.id
       WHERE oi.order_id = $1`,
      [id]
    );

    const response = {
      ...orderResult.rows[0],
      items: itemsResult.rows,
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Создать заказ
const createOrder = async (req, res) => {
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    const { name, phone, city, address, comment, promocode, current_price, items } = req.body;

    // Создать заказ
    const orderResult = await client.query(
      `INSERT INTO orders (name, phone, city, address, comment, promocode, current_price)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, phone, city, address, comment, promocode, current_price]
    );

    const orderId = orderResult.rows[0].id;

    // Добавить элементы заказа
    if (items && items.length > 0) {
      for (const item of items) {
        await client.query(
          `INSERT INTO order_items (order_id, nutrition_program_id, price_id, quantity, price)
           VALUES ($1, $2, $3, $4, $5)`,
          [orderId, item.nutrition_program_id, item.price_id, item.quantity || 1, item.price]
        );
      }
    }

    await client.query('COMMIT');

    // Получить полный заказ с элементами
    const fullOrderResult = await db.query(
      `SELECT o.*,
              json_agg(json_build_object(
                'id', oi.id,
                'nutrition_program_id', oi.nutrition_program_id,
                'price_id', oi.price_id,
                'quantity', oi.quantity,
                'price', oi.price,
                'program_title', np.title,
                'days', p.days
              )) as items
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       LEFT JOIN nutrition_programs np ON oi.nutrition_program_id = np.id
       LEFT JOIN prices p ON oi.price_id = p.id
       WHERE o.id = $1
       GROUP BY o.id`,
      [orderId]
    );

    res.status(201).json(fullOrderResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

// Обновить заказ
const updateOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, city, address, comment, promocode, current_price } = req.body;

    const result = await db.query(
      `UPDATE orders
       SET name = $1, phone = $2, city = $3, address = $4, comment = $5, promocode = $6, current_price = $7
       WHERE id = $8 RETURNING *`,
      [name, phone, city, address, comment, promocode, current_price, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Удалить заказ
const deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query('DELETE FROM orders WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ message: 'Order deleted successfully' });
  } catch (error) {
    console.error('Error deleting order:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getAllOrders,
  getOrderById,
  createOrder,
  updateOrder,
  deleteOrder,
};

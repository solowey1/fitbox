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
       LEFT JOIN nutrition_programs np ON oi.nutrition_program_id = np.id
       LEFT JOIN prices p ON oi.price_id = p.id
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

// Создать заказ (парсинг данных от Тильды)
const createOrder = async (req, res) => {
  const body = req.body;

  // Тестовый запрос от Тильды — отвечаем 200
  if (!body.name && !body.phone && !body.payment) {
    return res.json({ success: true });
  }

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    const payment = body.payment || {};
    const products = payment.products || [];

    // Определяем communicate_type и communicate
    const communicateType = body.communicate || null;
    let communicate = null;
    if (communicateType) {
      // Тильда отправляет поле с именем типа связи в нижнем регистре (telegram, whatsapp и т.д.)
      communicate = body[communicateType.toLowerCase()] || null;
    }

    // Создать заказ
    const orderResult = await client.query(
      `INSERT INTO orders (
        name, email, phone, communicate, communicate_type,
        city, street, house, corpus, flat, entrance, floor,
        comment, promocode, source, payment_system,
        tilda_order_id, total_amount, current_price, tilda_raw_data
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
      RETURNING *`,
      [
        body.name || null,
        body.email || null,
        body.phone || null,
        communicate,
        communicateType,
        body.city || null,
        body.street || null,
        body.house || null,
        body.corpus || null,
        body.flat || null,
        body.entrance || null,
        body.floor || null,
        body.comment || null,
        body['Промокод'] || body.promocode || null,
        body.source || null,
        body.paymentsystem || null,
        payment.orderid || null,
        payment.amount ? parseFloat(payment.amount) : null,
        payment.amount ? parseFloat(payment.amount) : null,
        JSON.stringify(body),
      ]
    );

    const orderId = orderResult.rows[0].id;

    // Добавить элементы заказа
    for (const product of products) {
      const nutritionProgramId = product.sku ? parseInt(product.sku, 10) : null;

      // Найти price_id по nutrition_program_id и кол-ву дней из опций
      let priceId = null;
      if (nutritionProgramId && product.options) {
        const daysOption = product.options.find(
          (opt) => opt.option === 'Кол-во дней'
        );
        if (daysOption) {
          const parsed = parseInt(String(daysOption.variant).replace(/\D/g, ''), 10);
          const days = (!isNaN(parsed) && parsed > 0) ? parsed : 1;
          const priceResult = await client.query(
            'SELECT id FROM prices WHERE nutrition_program_id = $1 AND days = $2 LIMIT 1',
            [nutritionProgramId, days]
          );
          if (priceResult.rows.length > 0) {
            priceId = priceResult.rows[0].id;
          }
        }
      }

      await client.query(
        `INSERT INTO order_items (order_id, nutrition_program_id, price_id, quantity, price)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          orderId,
          nutritionProgramId,
          priceId,
          product.quantity || 1,
          product.amount ? parseFloat(product.amount) : null,
        ]
      );
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
    const {
      name, email, phone, communicate, communicate_type,
      city, street, house, corpus, flat, entrance, floor,
      comment, promocode, source, payment_system, current_price,
    } = req.body;

    const result = await db.query(
      `UPDATE orders
       SET name = $1, email = $2, phone = $3, communicate = $4, communicate_type = $5,
           city = $6, street = $7, house = $8, corpus = $9, flat = $10,
           entrance = $11, floor = $12, comment = $13, promocode = $14,
           source = $15, payment_system = $16, current_price = $17
       WHERE id = $18 RETURNING *`,
      [
        name, email, phone, communicate, communicate_type,
        city, street, house, corpus, flat, entrance, floor,
        comment, promocode, source, payment_system, current_price,
        id,
      ]
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

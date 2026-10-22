const db = require('../config/database');

/**
 * Дата доставки из корзины Тильды: 'ДД.ММ.ГГГГ' (календарь) или 'ГГГГ-ММ-ДД'.
 * Возвращает 'ГГГГ-ММ-ДД' или null, если дата не указана или некорректна.
 */
const parseDeliveryDate = (value) => {
  const str = String(value || '').trim();
  let match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(str);
  let year, month, day;

  if (match) {
    [, day, month, year] = match.map(Number);
  } else {
    match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
    if (!match) return null;
    [, year, month, day] = match.map(Number);
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;

  return date.toISOString().slice(0, 10);
};

/**
 * Разбор SKU товара из корзины Тильды:
 * - '5'            → программа питания с id 5
 * - 'D12-20261023' → блюдо конструктора с id 12 на 23.10.2026
 * - 'D12'          → блюдо конструктора без даты (старые корзины)
 */
const parseSku = (sku) => {
  const str = String(sku || '').trim();

  const dish = /^D(\d+)(?:-(\d{4})(\d{2})(\d{2}))?$/i.exec(str);
  if (dish) {
    return {
      dishId: parseInt(dish[1], 10),
      nutritionProgramId: null,
      deliveryDate: dish[2] ? parseDeliveryDate(`${dish[2]}-${dish[3]}-${dish[4]}`) : null,
    };
  }

  if (/^\d+$/.test(str)) return { dishId: null, nutritionProgramId: parseInt(str, 10), deliveryDate: null };

  return { dishId: null, nutritionProgramId: null, deliveryDate: null };
};

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
      `SELECT oi.*, np.title as program_title, d.title as dish_title, p.days
       FROM order_items oi
       LEFT JOIN nutrition_programs np ON oi.nutrition_program_id = np.id
       LEFT JOIN dishes d ON oi.dish_id = d.id
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

    // Дата доставки заказа: из поля корзины, а если его нет (в корзине только блюда
    // конструктора, у каждого своя дата) — самая ранняя дата блюд
    const itemDates = products
      .map(product => parseSku(product.sku).deliveryDate)
      .filter(Boolean)
      .sort();
    const orderDeliveryDate = parseDeliveryDate(body.date) || itemDates[0] || null;

    // Создать заказ
    const orderResult = await client.query(
      `INSERT INTO orders (
        name, email, phone, communicate, communicate_type,
        city, street, house, corpus, flat, entrance, floor,
        comment, promocode, source, payment_system,
        tilda_order_id, total_amount, current_price, tilda_raw_data, delivery_date
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
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
        orderDeliveryDate,
      ]
    );

    const orderId = orderResult.rows[0].id;

    // Найти city_id по названию города из заказа
    let orderCityId = null;
    if (body.city) {
      const cityResult = await client.query(
        'SELECT id FROM cities WHERE title = $1 LIMIT 1',
        [body.city]
      );
      if (cityResult.rows.length > 0) {
        orderCityId = cityResult.rows[0].id;
      }
    }

    // Добавить элементы заказа
    for (const product of products) {
      const { dishId, nutritionProgramId, deliveryDate } = parseSku(product.sku);

      if (!dishId && !nutritionProgramId) {
        console.warn('Order item with unknown SKU:', { orderId, sku: product.sku, name: product.name });
      }

      // Найти price_id по nutrition_program_id, кол-ву дней и городу
      let priceId = null;
      if (nutritionProgramId && product.options) {
        const daysOption = product.options.find(
          (opt) => opt.option === 'Кол-во дней'
        );
        if (daysOption) {
          const parsed = parseInt(String(daysOption.variant).replace(/\D/g, ''), 10);
          const days = (!isNaN(parsed) && parsed > 0) ? parsed : 1;
          const priceResult = await client.query(
            'SELECT id FROM prices WHERE nutrition_program_id = $1 AND days = $2 AND city_id = $3 LIMIT 1',
            [nutritionProgramId, days, orderCityId]
          );
          if (priceResult.rows.length > 0) {
            priceId = priceResult.rows[0].id;
          }
        }
      }

      await client.query(
        `INSERT INTO order_items (order_id, nutrition_program_id, dish_id, price_id, quantity, price, delivery_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          orderId,
          nutritionProgramId,
          dishId,
          priceId,
          product.quantity || 1,
          product.amount ? parseFloat(product.amount) : null,
          deliveryDate,
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
                'dish_id', oi.dish_id,
                'delivery_date', oi.delivery_date,
                'price_id', oi.price_id,
                'quantity', oi.quantity,
                'price', oi.price,
                'program_title', np.title,
                'dish_title', d.title,
                'days', p.days
              )) as items
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       LEFT JOIN nutrition_programs np ON oi.nutrition_program_id = np.id
       LEFT JOIN dishes d ON oi.dish_id = d.id
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
      comment, promocode, source, payment_system, current_price, delivery_date,
    } = req.body;

    const result = await db.query(
      `UPDATE orders
       SET name = $1, email = $2, phone = $3, communicate = $4, communicate_type = $5,
           city = $6, street = $7, house = $8, corpus = $9, flat = $10,
           entrance = $11, floor = $12, comment = $13, promocode = $14,
           source = $15, payment_system = $16, current_price = $17, delivery_date = $18
       WHERE id = $19 RETURNING *`,
      [
        name, email, phone, communicate, communicate_type,
        city, street, house, corpus, flat, entrance, floor,
        comment, promocode, source, payment_system, current_price,
        parseDeliveryDate(delivery_date),
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

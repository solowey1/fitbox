/**
 * Контроллер для Tilda frontend
 * Предоставляет оптимизированные эндпоинты для работы с фронтендом
 */

const db = require('../config/database');

/**
 * Получить все данные для меню Tilda в одном запросе
 * GET /api/tilda/menu
 *
 * Возвращает:
 * - Список городов с датами старта
 * - Все программы питания с ценами
 * - Базовую информацию о блюдах для каждой программы
 *
 * Query параметры:
 * - subdomain: поддомен города (kzn, smr, tlt, dmt или пусто для Ульяновска)
 * - city: название города (альтернатива subdomain)
 */
const getTildaMenu = async (req, res) => {
  try {
    const { subdomain, city } = req.query;

    // Маппинг поддоменов на города
    const subdomainMap = {
      'kzn': 'Казань',
      'smr': 'Самара',
      'tlt': 'Тольятти',
      'dmt': 'Дмитровград',
      '': 'Ульяновск'
    };

    // Определяем город
    let currentCity = city || (subdomain !== undefined ? subdomainMap[subdomain] : null);

    // 1. Получаем все города
    const citiesResult = await db.query(`
      SELECT
        id,
        title,
        sort,
        started_at
      FROM cities
      ORDER BY sort ASC
    `);

    const cities = citiesResult.rows.map(city => ({
      id: city.id,
      title: city.title,
      sort: city.sort,
      startedAt: city.started_at,
      subdomain: Object.keys(subdomainMap).find(key => subdomainMap[key] === city.title) || ''
    }));

    // Если город не указан, берем первый
    if (!currentCity && cities.length > 0) {
      currentCity = cities[0].title;
    }

    // Находим текущий город
    const cityData = cities.find(c => c.title === currentCity) || cities[0];

    // 2. Получаем все программы питания с ценами
    const programsResult = await db.query(`
      SELECT
        np.id,
        np.title,
        np.emoji,
        np.data,
        np.sort,
        np.created_at,
        np.updated_at,
        COALESCE(
          (
            SELECT json_agg(DISTINCT city_obj)
            FROM (
              SELECT jsonb_build_object(
                'id', c.id,
                'title', c.title,
                'startedAt', c.started_at
              ) as city_obj
              FROM city_nutrition_programs cnp2
              JOIN cities c ON cnp2.city_id = c.id
              WHERE cnp2.nutrition_program_id = np.id
            ) cities_subquery
          ),
          '[]'
        ) as cities,
        COALESCE(
          (
            SELECT json_agg(price_obj ORDER BY (price_obj->>'days')::int)
            FROM (
              SELECT jsonb_build_object(
                'id', p.id,
                'days', p.days,
                'price', p.price,
                'oldPrice', p.old_price
              ) as price_obj
              FROM prices p
              WHERE p.nutrition_program_id = np.id
            ) prices_subquery
          ),
          '[]'
        ) as prices
      FROM nutrition_programs np
      ORDER BY np.sort ASC
    `);

    // 3. Формируем ответ в удобном для фронтенда формате
    const programs = programsResult.rows.map(program => {
      const data = program.data || {};

      // Формируем описание программы
      const descriptions = {
        'Офис': 'Трехразовое питание на 800-900 ккал/день разнообразит ваш привычный рацион и поможет избежать ежедневных вопросов «что бы сегодня поесть?»',
        'Баланс': 'Сбалансированное питание для поддержания веса и хорошего самочувствия',
        'Фитнес': 'Идеально подходит для тех, кто ведет активный образ жизни и следит за фигурой',
        'Классик мини': 'Полноценное питание с оптимальной калорийностью',
        'Классик': 'Классическое пятиразовое питание для поддержания активности в течение дня',
        'Классик +': 'Усиленное питание для людей с высокими энергетическими затратами'
      };

      const slogans = {
        'Офис': 'Кушай на работе',
        'Баланс': 'Баланс во всём',
        'Фитнес': 'Будь в форме',
        'Классик мини': 'Оптимальный выбор',
        'Классик': 'Классика вкуса',
        'Классик +': 'Максимум энергии'
      };

      const dishesCount = {
        'Офис': 3,
        'Баланс': 4,
        'Фитнес': 4,
        'Классик мини': 4,
        'Классик': 5,
        'Классик +': 6
      };

      return {
        id: program.id,
        title: program.title,
        emoji: program.emoji,
        sort: program.sort,
        description: descriptions[program.title] || '',
        slogan: slogans[program.title] || '',
        dishesPerDay: dishesCount[program.title] || 3,
        nutrition: {
          caloriesFrom: data.calories_from || null,
          caloriesTo: data.calories_to || null,
          proteins: data.proteins || null,
          fats: data.fats || null,
          carbohydrates: data.carbohydrates || null,
        },
        prices: (program.prices || []).map(price => ({
          id: price.id,
          days: price.days,
          price: parseFloat(price.price),
          oldPrice: price.oldPrice ? parseFloat(price.oldPrice) : null,
          label: price.days === 1 ? 'Пробный день' : `${price.days} дней`,
          pricePerDay: Math.ceil(parseFloat(price.price) / price.days)
        })),
        cities: program.cities || [],
        // Дата старта для текущего города
        startedAt: cityData ? cityData.startedAt : null
      };
    });

    // 4. Получаем информацию о блюдах (только базовую для меню)
    // Примечание: полные данные блюд лучше получать отдельным запросом при необходимости
    const dishesCountResult = await db.query(`
      SELECT
        COUNT(DISTINCT d.id) as total_dishes
      FROM dishes d
    `);

    // Формируем итоговый ответ
    const response = {
      cities: cities,
      currentCity: cityData,
      programs: programs,
      meta: {
        totalDishes: parseInt(dishesCountResult.rows[0]?.total_dishes || 0),
        totalPrograms: programs.length,
        totalCities: cities.length,
        maxWeeks: 4,
        maxDays: 7,
        generatedAt: new Date().toISOString()
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Ошибка при получении данных для Tilda:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Не удалось получить данные для меню'
    });
  }
};

/**
 * Получить блюда для конкретной программы
 * GET /api/tilda/menu/:programId/dishes
 *
 * Query параметры:
 * - week: номер недели (1-4), опционально
 * - day: день недели (1-7), опционально
 */
const getProgramDishes = async (req, res) => {
  try {
    const { programId } = req.params;
    const { week, day } = req.query;

    let query = `
      SELECT
        d.id,
        d.title,
        d.images,
        npd.day_of_week,
        npd.meal_type,
        npd.sort as meal_sort
      FROM nutrition_program_dishes npd
      JOIN dishes d ON npd.dish_id = d.id
      WHERE npd.nutrition_program_id = $1
    `;

    const params = [programId];

    if (day) {
      query += ` AND npd.day_of_week = $${params.length + 1}`;
      params.push(parseInt(day));
    }

    query += ` ORDER BY npd.day_of_week, npd.meal_type, npd.sort`;

    const result = await db.query(query, params);

    // Группируем блюда по дням и неделям
    const dishes = result.rows.map(row => {
      // Определяем неделю (циклически повторяем меню каждые 4 недели)
      const weekNumber = week ? parseInt(week) : null;

      return {
        id: row.id,
        title: row.title,
        image: row.images && row.images.length > 0
          ? `${req.protocol}://${req.get('host')}/${row.images[0].path}`
          : null,
        dayOfWeek: row.day_of_week,
        week: weekNumber || Math.ceil(row.day_of_week / 7),
        mealType: row.meal_type,
        sort: row.meal_sort
      };
    });

    res.json({
      programId: parseInt(programId),
      dishes: dishes,
      meta: {
        totalDishes: dishes.length,
        week: week ? parseInt(week) : null,
        day: day ? parseInt(day) : null
      }
    });
  } catch (error) {
    console.error('Ошибка при получении блюд программы:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Не удалось получить блюда программы'
    });
  }
};

/**
 * Получить детальную информацию о блюде
 * GET /api/tilda/dishes/:dishId
 */
const getDishDetails = async (req, res) => {
  try {
    const { dishId } = req.params;

    const result = await db.query(`
      SELECT
        d.id,
        d.title,
        d.images,
        d.created_at,
        d.updated_at,
        COALESCE(
          json_agg(
            jsonb_build_object(
              'id', i.id,
              'title', i.title,
              'quantity', di.quantity,
              'calories', i.calories,
              'proteins', i.proteins,
              'fats', i.fats,
              'carbohydrates', i.carbohydrates
            ) ORDER BY di.id
          ) FILTER (WHERE i.id IS NOT NULL),
          '[]'
        ) as ingredients
      FROM dishes d
      LEFT JOIN dish_ingredients di ON d.id = di.dish_id
      LEFT JOIN ingredients i ON di.ingredient_id = i.id
      WHERE d.id = $1
      GROUP BY d.id, d.title, d.images, d.created_at, d.updated_at
    `, [dishId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Блюдо не найдено'
      });
    }

    const dish = result.rows[0];

    // Вычисляем общую пищевую ценность
    const totalNutrition = (dish.ingredients || []).reduce((acc, ing) => {
      const quantity = parseFloat(ing.quantity) / 100; // Переводим в граммы
      return {
        calories: acc.calories + (parseFloat(ing.calories) * quantity),
        proteins: acc.proteins + (parseFloat(ing.proteins) * quantity),
        fats: acc.fats + (parseFloat(ing.fats) * quantity),
        carbohydrates: acc.carbohydrates + (parseFloat(ing.carbohydrates) * quantity)
      };
    }, { calories: 0, proteins: 0, fats: 0, carbohydrates: 0 });

    // Формируем строку ингредиентов
    const ingredientsText = (dish.ingredients || [])
      .map(ing => `${ing.title} (${ing.quantity}г)`)
      .join(', ');

    res.json({
      id: dish.id,
      title: dish.title,
      image: dish.images && dish.images.length > 0
        ? `${req.protocol}://${req.get('host')}/${dish.images[0].path}`
        : null,
      ingredients: dish.ingredients || [],
      ingredientsText: ingredientsText,
      nutrition: {
        calories: Math.round(totalNutrition.calories),
        proteins: Math.round(totalNutrition.proteins * 10) / 10,
        fats: Math.round(totalNutrition.fats * 10) / 10,
        carbohydrates: Math.round(totalNutrition.carbohydrates * 10) / 10
      }
    });
  } catch (error) {
    console.error('Ошибка при получении деталей блюда:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Не удалось получить информацию о блюде'
    });
  }
};

module.exports = {
  getTildaMenu,
  getProgramDishes,
  getDishDetails
};

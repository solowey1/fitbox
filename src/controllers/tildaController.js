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
        np.description,
        np.slogan,
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
        ) as prices,
        COALESCE(
          (
            SELECT COUNT(DISTINCT dish_number)
            FROM nutrition_program_dishes npd
            WHERE npd.nutrition_program_id = np.id
              AND npd.day_of_week = 1
              AND npd.week_number = 1
          ),
          0
        ) as dishes_per_day
      FROM nutrition_programs np
      ORDER BY np.sort ASC
    `);

    // 3. Формируем ответ в удобном для фронтенда формате
    const programs = programsResult.rows.map(program => {
      const data = program.data || {};

      return {
        id: program.id,
        title: program.title,
        emoji: program.emoji,
        sort: program.sort,
        description: program.description || '',
        slogan: program.slogan || '',
        dishesPerDay: parseInt(program.dishes_per_day) || 0,
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

    // Получаем коэффициент порции для программы
    const coeffResult = await db.query(
      'SELECT COALESCE(portion_coefficient, 1.0) as portion_coefficient FROM nutrition_programs WHERE id = $1',
      [programId]
    );
    const portionCoefficient = coeffResult.rows.length > 0
      ? parseFloat(coeffResult.rows[0].portion_coefficient)
      : 1.0;

    let query = `
      SELECT
        d.id,
        d.title,
        d.image,
        npd.day_of_week,
        npd.week_number,
        npd.dish_number,
        COALESCE(
          (
            SELECT string_agg(i.title || ' (' || ROUND(di.quantity * $2) || ' г)', ', ')
            FROM dish_ingredients di
            JOIN ingredients i ON di.ingredient_id = i.id
            WHERE di.dish_id = d.id
          ),
          'Нет информации'
        ) as ingredients_text,
        -- Массив названий ингредиентов (без количества) для карточки
        COALESCE(
          (
            SELECT json_agg(i.title ORDER BY di.id)
            FROM dish_ingredients di
            JOIN ingredients i ON di.ingredient_id = i.id
            WHERE di.dish_id = d.id
          ),
          '[]'
        ) as ingredients,
        -- Общий вес блюда (сумма всех ингредиентов с учётом коэффициента порции)
        COALESCE(
          (
            SELECT ROUND(SUM(di.quantity * $2))
            FROM dish_ingredients di
            WHERE di.dish_id = d.id
          ),
          0
        ) as total_weight,
        -- Общая калорийность блюда (с учётом коэффициента порции)
        COALESCE(
          (
            SELECT SUM(
              (i.calories * di.quantity * $2 / 100)::numeric(10,2)
            )
            FROM dish_ingredients di
            JOIN ingredients i ON di.ingredient_id = i.id
            WHERE di.dish_id = d.id
          ),
          0
        ) as total_calories,
        -- Общие белки блюда
        COALESCE(
          (
            SELECT SUM(
              (i.proteins * di.quantity * $2 / 100)::numeric(10,2)
            )
            FROM dish_ingredients di
            JOIN ingredients i ON di.ingredient_id = i.id
            WHERE di.dish_id = d.id
          ),
          0
        ) as total_proteins,
        -- Общие жиры блюда
        COALESCE(
          (
            SELECT SUM(
              (i.fats * di.quantity * $2 / 100)::numeric(10,2)
            )
            FROM dish_ingredients di
            JOIN ingredients i ON di.ingredient_id = i.id
            WHERE di.dish_id = d.id
          ),
          0
        ) as total_fats,
        -- Общие углеводы блюда
        COALESCE(
          (
            SELECT SUM(
              (i.carbohydrates * di.quantity * $2 / 100)::numeric(10,2)
            )
            FROM dish_ingredients di
            JOIN ingredients i ON di.ingredient_id = i.id
            WHERE di.dish_id = d.id
          ),
          0
        ) as total_carbohydrates
      FROM nutrition_program_dishes npd
      JOIN dishes d ON npd.dish_id = d.id
      WHERE npd.nutrition_program_id = $1
    `;

    const params = [programId, portionCoefficient];

    if (day) {
      params.push(parseInt(day));
      query += ` AND npd.day_of_week = $${params.length}`;
    }

    query += ` ORDER BY npd.day_of_week, npd.week_number, npd.dish_number`;

    const result = await db.query(query, params);

    // Логируем первую строку для отладки
    if (result.rows.length > 0) {
      console.log('Первая строка из БД:', {
        id: result.rows[0].id,
        title: result.rows[0].title,
        ingredients_text: result.rows[0].ingredients_text,
        total_weight: result.rows[0].total_weight,
        total_calories: result.rows[0].total_calories,
        day_of_week: result.rows[0].day_of_week,
        week_number: result.rows[0].week_number
      });
    }

    // Группируем блюда по дням и неделям
    const dishes = result.rows.map((row, index) => {
      const totalWeight = parseFloat(row.total_weight) || 0;

      // Пересчитываем КБЖУ на 100г
      const caloriesPer100g = totalWeight > 0
        ? Math.round((parseFloat(row.total_calories) / totalWeight) * 100)
        : 0;
      const proteinsPer100g = totalWeight > 0
        ? Math.round((parseFloat(row.total_proteins) / totalWeight) * 100)
        : 0;
      const fatsPer100g = totalWeight > 0
        ? Math.round((parseFloat(row.total_fats) / totalWeight) * 100)
        : 0;
      const carbohydratesPer100g = totalWeight > 0
        ? Math.round((parseFloat(row.total_carbohydrates) / totalWeight) * 100)
        : 0;

      // Логируем каждую строку для отладки (только первые 3)
      if (index < 3) {
        console.log('Маппинг строки:', {
          title: row.title,
          total_weight: totalWeight,
          raw_calories: row.total_calories,
          calories_per_100g: caloriesPer100g,
          proteins_per_100g: proteinsPer100g,
          fats_per_100g: fatsPer100g,
          carbs_per_100g: carbohydratesPer100g
        });
      }

      return {
        id: row.id,
        title: row.title,
        image: row.image || '',
        dayOfWeek: row.day_of_week,
        weekNumber: row.week_number,
        dishNumber: row.dish_number,
        ingredients: row.ingredients || [],
        ingredientsText: row.ingredients_text || 'Нет информации',
        totalWeight: Math.round(totalWeight),
        nutrition: {
          calories: caloriesPer100g,
          proteins: proteinsPer100g,
          fats: fatsPer100g,
          carbohydrates: carbohydratesPer100g
        }
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
        d.image,
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
      GROUP BY d.id, d.title, d.image, d.created_at, d.updated_at
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
      .map(ing => `${ing.title} (${ing.quantity} г)`)
      .join(', ');

    res.json({
      id: dish.id,
      title: dish.title,
      image: dish.image || '',
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

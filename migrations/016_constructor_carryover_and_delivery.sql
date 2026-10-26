-- Конструктор: остатки производства и доставка.
--
-- 1. Блюда хранятся несколько дней, поэтому на дату продаётся меню этой даты
--    и меню предыдущего дня. Отдельно остатки не помечаются: у блюда источник того дня,
--    из меню которого оно пришло (цикл / добавлено на дату). Стоп-лист на дату убирает
--    блюдо и из вчерашнего меню; блюдо, убранное вчера, сегодня тоже не продаётся.
-- 2. День меню и день доставки теперь разные: на день без доставки блюда привозят
--    накануне. У позиции заказа — день меню (menu_date) и день доставки (delivery_date).
-- 3. Стоимость доставки конструктора приходит в корзине отдельным товаром «Доставка» —
--    сохраняем её в orders.delivery_price.
--
-- Транзакцию открывает scripts/migrate.js.

-- ─── Меню на дату с остатками предыдущих дней ────────────────────────────

-- p_carryover_days — сколько предыдущих дней добавлять (1 = только вчера)
CREATE OR REPLACE FUNCTION constructor_menu_with_carryover(
    p_date DATE,
    p_city_id INTEGER,
    p_carryover_days INTEGER DEFAULT 1
)
RETURNS TABLE(dish_id INTEGER, source TEXT, removed BOOLEAN)
LANGUAGE sql STABLE AS $$
    WITH today AS (
        SELECT * FROM constructor_menu_on(p_date, p_city_id)
    ),
    earlier AS (
        -- если блюдо было в нескольких прошлых днях — источник самого позднего
        SELECT DISTINCT ON (m.dish_id) m.dish_id, m.source
        FROM generate_series(1, GREATEST(p_carryover_days, 0)) AS back(days)
        CROSS JOIN LATERAL constructor_menu_on(p_date - back.days, p_city_id) m
        WHERE NOT m.removed
        ORDER BY m.dish_id, back.days
    )
    SELECT today.dish_id, today.source, today.removed
    FROM today
    UNION ALL
    -- блюда прошлых дней, которых нет в меню даты (если есть — решает строка даты, в том числе стоп-лист)
    SELECT earlier.dish_id, earlier.source, FALSE
    FROM earlier
    WHERE earlier.dish_id NOT IN (SELECT today.dish_id FROM today)
      AND NOT EXISTS (
          SELECT 1 FROM constructor_menu_exceptions e
          WHERE e.menu_date = p_date
            AND e.dish_id = earlier.dish_id
            AND e.action = 'убрать'
            AND (e.city_id IS NULL OR e.city_id = p_city_id)
      )
$$;

COMMENT ON FUNCTION constructor_menu_with_carryover(DATE, INTEGER, INTEGER) IS
'Меню конструктора на дату: меню даты + блюда предыдущих дней (остатки производства), с пометкой стоп-листа';

-- ─── Представления для Budibase: с учётом остатков ───────────────────────

-- «Что увидит покупатель»: меню на 14 дней вперёд по каждому городу
CREATE OR REPLACE VIEW constructor_menu_calendar AS
SELECT
    c.id AS city_id,
    c.title AS city,
    day::DATE AS menu_date,
    w.short_title AS weekday,
    cd.week_number AS cycle_week,
    m.dish_id,
    TRIM(d.title) AS dish,
    d.price,
    m.source,
    CASE
        WHEN m.removed THEN 'убрано на эту дату (стоп-лист)'
        ELSE COALESCE(constructor_dish_problem(d.id), 'в продаже')
    END AS status
FROM cities c
CROSS JOIN generate_series(CURRENT_DATE, CURRENT_DATE + 13, INTERVAL '1 day') AS day
CROSS JOIN LATERAL constructor_cycle_day(day::DATE, c.id) cd
CROSS JOIN LATERAL constructor_menu_with_carryover(day::DATE, c.id) m
JOIN dishes d ON d.id = m.dish_id
JOIN weekdays w ON w.id = EXTRACT(ISODOW FROM day)::INTEGER
ORDER BY c.sort, menu_date, d.title;

-- «Проблемы»: дни с малым выбором (с учётом остатков) и блюда меню, которые нельзя продать
CREATE OR REPLACE VIEW constructor_menu_problems AS
WITH days AS (
    SELECT c.id AS city_id, c.title AS city, c.sort, day::DATE AS menu_date
    FROM cities c
    CROSS JOIN generate_series(CURRENT_DATE, CURRENT_DATE + 13, INTERVAL '1 day') AS day
),
on_sale AS (
    SELECT days.city_id, days.menu_date, COUNT(m.dish_id) FILTER (
        WHERE NOT m.removed AND constructor_dish_problem(m.dish_id) IS NULL
    ) AS dishes
    FROM days
    LEFT JOIN LATERAL constructor_menu_with_carryover(days.menu_date, days.city_id) m ON TRUE
    GROUP BY days.city_id, days.menu_date
)
SELECT
    'мало блюд на день' AS problem,
    days.city,
    days.menu_date,
    NULL::TEXT AS dish,
    'в продаже ' || on_sale.dishes || ' (меньше 3)' AS details,
    days.sort AS city_sort
FROM days
JOIN on_sale ON on_sale.city_id = days.city_id AND on_sale.menu_date = days.menu_date
WHERE on_sale.dishes < 3

UNION ALL

SELECT
    'блюдо в меню нельзя продать',
    COALESCE(c.title, 'Все города'),
    NULL::DATE,
    TRIM(d.title),
    constructor_dish_problem(d.id) || ' — неделя ' || cm.week_number || ', ' || w.title,
    COALESCE(c.sort, 0)
FROM constructor_menu cm
JOIN dishes d ON d.id = cm.dish_id
JOIN weekdays w ON w.id = cm.day_of_week
LEFT JOIN cities c ON c.id = cm.city_id
WHERE constructor_dish_problem(d.id) IS NOT NULL

UNION ALL

SELECT
    'блюдо в меню нельзя продать',
    COALESCE(c.title, 'Все города'),
    e.menu_date,
    TRIM(d.title),
    constructor_dish_problem(d.id) || ' — добавлено на дату',
    COALESCE(c.sort, 0)
FROM constructor_menu_exceptions e
JOIN dishes d ON d.id = e.dish_id
LEFT JOIN cities c ON c.id = e.city_id
WHERE e.action = 'добавить'
  AND e.menu_date >= CURRENT_DATE
  AND constructor_dish_problem(d.id) IS NOT NULL

ORDER BY city_sort, menu_date NULLS FIRST, problem, dish;

-- ─── Заказы: день меню и стоимость доставки ──────────────────────────────

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS menu_date DATE;

COMMENT ON COLUMN order_items.menu_date IS
'День меню блюда конструктора (из артикула D<id>-<ГГГГММДД>): на какой день покупатель выбрал блюдо';

COMMENT ON COLUMN order_items.delivery_date IS
'Дата доставки блюда конструктора: опция «Доставка» товара, для старых корзин — дата из артикула. Для программ — NULL, дата в orders.delivery_date';

ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_price DECIMAL(10, 2);

COMMENT ON COLUMN orders.delivery_price IS
'Стоимость доставки конструктора (товар «Доставка» в корзине), с надбавкой за зону';

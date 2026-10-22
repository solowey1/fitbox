-- Меню конструктора по дням: 4-недельный цикл, как у программ питания,
-- плюс исключения на конкретные даты (стоп-лист и дополнительные блюда).
--
-- Цикл привязан к дате старта города (cities.started_at), как и меню программ на сайте:
--   дней от старта = дата − started_at
--   неделя цикла   = (дней / 7) mod 4 + 1
--   день недели    = дней mod 7 + 1   (1 = понедельник, если started_at — понедельник)
--
-- city_id = NULL — строка действует во всех городах; с городом — только в нём.
-- Транзакцию открывает scripts/migrate.js.

-- ─── Справочник дней недели (для выпадающих списков в Budibase) ──────────

CREATE TABLE IF NOT EXISTS weekdays (
    id SMALLINT PRIMARY KEY CHECK (id BETWEEN 1 AND 7),
    title VARCHAR(20) NOT NULL,
    short_title VARCHAR(4) NOT NULL
);

INSERT INTO weekdays (id, title, short_title) VALUES
    (1, 'Понедельник', 'Пн'),
    (2, 'Вторник', 'Вт'),
    (3, 'Среда', 'Ср'),
    (4, 'Четверг', 'Чт'),
    (5, 'Пятница', 'Пт'),
    (6, 'Суббота', 'Сб'),
    (7, 'Воскресенье', 'Вс')
ON CONFLICT (id) DO NOTHING;

-- ─── Цикл меню конструктора ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS constructor_menu (
    id SERIAL PRIMARY KEY,
    city_id INTEGER REFERENCES cities(id) ON DELETE CASCADE, -- NULL = все города
    week_number SMALLINT NOT NULL CHECK (week_number BETWEEN 1 AND 4),
    day_of_week SMALLINT NOT NULL REFERENCES weekdays(id),
    dish_id INTEGER NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- одно блюдо в один день цикла — один раз (для всех городов и для каждого города отдельно)
CREATE UNIQUE INDEX IF NOT EXISTS constructor_menu_unique
    ON constructor_menu (COALESCE(city_id, 0), week_number, day_of_week, dish_id);
CREATE INDEX IF NOT EXISTS idx_constructor_menu_day ON constructor_menu (week_number, day_of_week);

COMMENT ON TABLE constructor_menu IS
'Меню конструктора по 4-недельному циклу: в какой день цикла какое блюдо продаётся. city_id NULL — во всех городах';

-- ─── Исключения на конкретные даты ───────────────────────────────────────

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'constructor_exception_action') THEN
        CREATE TYPE constructor_exception_action AS ENUM ('убрать', 'добавить');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS constructor_menu_exceptions (
    id SERIAL PRIMARY KEY,
    city_id INTEGER REFERENCES cities(id) ON DELETE CASCADE, -- NULL = все города
    menu_date DATE NOT NULL,
    dish_id INTEGER NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
    action constructor_exception_action NOT NULL DEFAULT 'убрать',
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS constructor_menu_exceptions_unique
    ON constructor_menu_exceptions (COALESCE(city_id, 0), menu_date, dish_id);
CREATE INDEX IF NOT EXISTS idx_constructor_menu_exceptions_date ON constructor_menu_exceptions (menu_date);

COMMENT ON TABLE constructor_menu_exceptions IS
'Исключения из цикла на конкретную дату: «убрать» — стоп-лист, «добавить» — блюдо сверх цикла';

DROP TRIGGER IF EXISTS update_constructor_menu_updated_at ON constructor_menu;
CREATE TRIGGER update_constructor_menu_updated_at BEFORE UPDATE ON constructor_menu
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_constructor_menu_exceptions_updated_at ON constructor_menu_exceptions;
CREATE TRIGGER update_constructor_menu_exceptions_updated_at BEFORE UPDATE ON constructor_menu_exceptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── Меню на дату ────────────────────────────────────────────────────────

-- День цикла для даты в городе: неделя 1–4 и день 1–7
CREATE OR REPLACE FUNCTION constructor_cycle_day(p_date DATE, p_city_id INTEGER)
RETURNS TABLE(week_number INTEGER, day_of_week INTEGER)
LANGUAGE sql STABLE AS $$
    SELECT (n / 7) + 1, (n % 7) + 1
    FROM (
        SELECT (((p_date - c.started_at::DATE) % 28) + 28) % 28 AS n
        FROM cities c
        WHERE c.id = p_city_id AND c.started_at IS NOT NULL
    ) cycle
$$;

-- Блюда меню на дату в городе: цикл + «добавить», с пометкой «убрать» (removed)
CREATE OR REPLACE FUNCTION constructor_menu_on(p_date DATE, p_city_id INTEGER)
RETURNS TABLE(dish_id INTEGER, source TEXT, removed BOOLEAN)
LANGUAGE sql STABLE AS $$
    WITH cycle AS (
        SELECT * FROM constructor_cycle_day(p_date, p_city_id)
    ),
    menu AS (
        SELECT cm.dish_id, 'цикл'::TEXT AS source
        FROM constructor_menu cm
        JOIN cycle ON cm.week_number = cycle.week_number AND cm.day_of_week = cycle.day_of_week
        WHERE cm.city_id IS NULL OR cm.city_id = p_city_id
        UNION
        SELECT e.dish_id, 'добавлено на дату'::TEXT
        FROM constructor_menu_exceptions e
        WHERE e.menu_date = p_date
          AND e.action = 'добавить'
          AND (e.city_id IS NULL OR e.city_id = p_city_id)
    ),
    stop_list AS (
        SELECT e.dish_id
        FROM constructor_menu_exceptions e
        WHERE e.menu_date = p_date
          AND e.action = 'убрать'
          AND (e.city_id IS NULL OR e.city_id = p_city_id)
    )
    SELECT DISTINCT ON (menu.dish_id)
        menu.dish_id,
        menu.source,
        menu.dish_id IN (SELECT dish_id FROM stop_list)
    FROM menu
    ORDER BY menu.dish_id, menu.source DESC -- «цикл» важнее «добавлено», если блюдо и там и там
$$;

-- Можно ли продавать блюдо в конструкторе (без учёта даты)
CREATE OR REPLACE FUNCTION constructor_dish_problem(p_dish_id INTEGER)
RETURNS TEXT
LANGUAGE sql STABLE AS $$
    SELECT CASE
        WHEN NOT d.in_constructor THEN 'выключено в конструкторе (in_constructor)'
        WHEN d.price IS NULL THEN 'нет цены'
        WHEN d.weight IS NULL THEN 'нет веса'
        WHEN NOT EXISTS (SELECT 1 FROM dish_meal_types dmt WHERE dmt.dish_id = d.id) THEN 'не указан приём пищи'
        ELSE NULL
    END
    FROM dishes d
    WHERE d.id = p_dish_id
$$;

-- ─── Представления для Budibase ──────────────────────────────────────────

-- Меню цикла с названиями — для просмотра и поиска
CREATE OR REPLACE VIEW constructor_menu_view AS
SELECT
    cm.id,
    COALESCE(c.title, 'Все города') AS city,
    cm.week_number,
    cm.day_of_week,
    w.title AS weekday,
    cm.dish_id,
    TRIM(d.title) AS dish,
    d.price,
    d.weight,
    d.in_constructor,
    (SELECT string_agg(mt.title, ', ' ORDER BY mt.sort)
     FROM dish_meal_types dmt JOIN meal_types mt ON mt.id = dmt.meal_type_id
     WHERE dmt.dish_id = d.id) AS meal_types,
    COALESCE(constructor_dish_problem(d.id), 'в продаже') AS status,
    cm.comment
FROM constructor_menu cm
JOIN dishes d ON d.id = cm.dish_id
JOIN weekdays w ON w.id = cm.day_of_week
LEFT JOIN cities c ON c.id = cm.city_id
ORDER BY cm.week_number, cm.day_of_week, d.title;

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
CROSS JOIN LATERAL constructor_menu_on(day::DATE, c.id) m
JOIN dishes d ON d.id = m.dish_id
JOIN weekdays w ON w.id = EXTRACT(ISODOW FROM day)::INTEGER
ORDER BY c.sort, menu_date, d.title;

-- «Проблемы»: дни с малым выбором и блюда меню, которые нельзя продать
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
    LEFT JOIN LATERAL constructor_menu_on(days.menu_date, days.city_id) m ON TRUE
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

-- ─── Начальное наполнение: дни цикла из меню программ ────────────────────
-- Для блюд, уже включённых в конструктор, — в те же дни цикла, что и в программах.
-- Дополнительные блюда менеджер добавляет в constructor_menu сам.

INSERT INTO constructor_menu (city_id, week_number, day_of_week, dish_id, comment)
SELECT DISTINCT NULL::INTEGER, npd.week_number, npd.day_of_week, npd.dish_id, 'из меню программ'
FROM nutrition_program_dishes npd
JOIN dishes d ON d.id = npd.dish_id
WHERE d.in_constructor
  AND npd.week_number BETWEEN 1 AND 4
  AND NOT EXISTS (
      SELECT 1 FROM constructor_menu cm
      WHERE cm.city_id IS NULL
        AND cm.week_number = npd.week_number
        AND cm.day_of_week = npd.day_of_week
        AND cm.dish_id = npd.dish_id
  );

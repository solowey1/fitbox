-- Конструктор «Собери своё меню».
--
-- 1. Приёмы пищи (фильтр «Выберите приемы»). Одно блюдо может относиться к нескольким приёмам.
-- 2. Поля блюда для конструктора: вес порции, цена, флаг in_constructor.
-- 3. Позиции заказа могут быть отдельными блюдами, а не только программами; у позиции — день меню
--    (menu_date) и день доставки (delivery_date); у заказа — дата первой доставки и стоимость доставки.
-- 4. Меню по 4-недельному циклу, как у программ питания, плюс исключения на конкретные даты
--    (стоп-лист и дополнительные блюда). Цикл привязан к дате старта города (cities.started_at):
--      дней от старта = дата − started_at
--      неделя цикла   = (дней / 7) mod 4 + 1
--      день недели    = дней mod 7 + 1   (1 = понедельник, если started_at — понедельник)
--    city_id = NULL — строка действует во всех городах; с городом — только в нём.
-- 5. Блюда хранятся несколько дней, поэтому на дату продаётся меню этой даты и меню предыдущего дня.
--    Отдельно остатки не помечаются: у блюда источник того дня, из меню которого оно пришло
--    (цикл / добавлено на дату). Стоп-лист на дату убирает блюдо и из вчерашнего меню;
--    блюдо, убранное вчера, сегодня тоже не продаётся.
-- 6. День меню и день доставки разные: на день без доставки блюда привозят накануне.
--    Стоимость доставки приходит в корзине отдельным товаром «Доставка» — сохраняем в orders.delivery_price.
-- 7. Данные: все блюда включены в конструктор (приём пищи, вес, цена), меню конструктора = расписание программ.
--
-- Транзакцию открывает scripts/migrate.js, BEGIN/COMMIT здесь не нужны.

-- ─── Приёмы пищи ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS meal_types (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(50) NOT NULL UNIQUE, -- ключ для фронтенда
    title VARCHAR(100) NOT NULL,      -- название раздела на сайте
    sort INTEGER DEFAULT 0,           -- порядок разделов и фильтров
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO meal_types (slug, title, sort) VALUES
    ('breakfast', 'Завтраки', 10),
    ('snack', 'Перекусы', 20),
    ('salad', 'Салаты', 30),
    ('soup', 'Супы', 40),
    ('main', 'Вторые блюда', 50),
    ('dessert', 'Десерты', 60),
    ('drink', 'Напитки', 70)
ON CONFLICT (slug) DO NOTHING;

-- Связь блюд и приёмов пищи (many-to-many).
-- Без UNIQUE (dish_id, meal_type_id): Budibase при редактировании связей
-- ловит duplicate key (см. dish_ingredients в 001). Дубли схлопываются в запросах API.
CREATE TABLE IF NOT EXISTS dish_meal_types (
    id SERIAL PRIMARY KEY,
    dish_id INTEGER NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
    meal_type_id INTEGER NOT NULL REFERENCES meal_types(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dish_meal_types_dish_id ON dish_meal_types(dish_id);
CREATE INDEX IF NOT EXISTS idx_dish_meal_types_meal_type_id ON dish_meal_types(meal_type_id);

-- ─── Блюда ───────────────────────────────────────────────────────────────────

ALTER TABLE dishes ADD COLUMN IF NOT EXISTS weight INTEGER;
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS in_constructor BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2);
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS price_old NUMERIC(10, 2);

ALTER TABLE dishes DROP CONSTRAINT IF EXISTS dishes_weight_positive;
ALTER TABLE dishes ADD CONSTRAINT dishes_weight_positive CHECK (weight IS NULL OR weight > 0);

ALTER TABLE dishes DROP CONSTRAINT IF EXISTS dishes_price_non_negative;
ALTER TABLE dishes ADD CONSTRAINT dishes_price_non_negative CHECK (
    (price IS NULL OR price >= 0) AND (price_old IS NULL OR price_old >= 0)
);

CREATE INDEX IF NOT EXISTS idx_dishes_in_constructor ON dishes(in_constructor) WHERE in_constructor;

COMMENT ON COLUMN dishes.weight IS
'Вес порции в граммах для конструктора. КБЖУ порции = КБЖУ на 100 г (по ингредиентам) × weight / 100';
COMMENT ON COLUMN dishes.in_constructor IS
'Блюдо доступно в конструкторе «Собери своё меню» (показывается только при заполненных price и weight)';
COMMENT ON COLUMN dishes.price IS 'Цена блюда в конструкторе, одна для всех городов';
COMMENT ON COLUMN dishes.price_old IS 'Старая цена (зачёркнутая) в конструкторе';

-- ─── Заказы ──────────────────────────────────────────────────────────────────

-- Позиция заказа — либо программа (nutrition_program_id), либо блюдо из конструктора (dish_id)
ALTER TABLE order_items ALTER COLUMN nutrition_program_id DROP NOT NULL;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS dish_id INTEGER REFERENCES dishes(id) ON DELETE SET NULL;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS menu_date DATE;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS delivery_date DATE;

CREATE INDEX IF NOT EXISTS idx_order_items_dish_id ON order_items(dish_id);
CREATE INDEX IF NOT EXISTS idx_order_items_delivery_date ON order_items(delivery_date);

COMMENT ON COLUMN order_items.menu_date IS
'День меню блюда конструктора (из артикула D<id>-<ГГГГММДД>): на какой день покупатель выбрал блюдо';
COMMENT ON COLUMN order_items.delivery_date IS
'Дата доставки блюда конструктора: опция «Доставка» товара, для старых корзин — дата из артикула. Для программ — NULL, дата в orders.delivery_date';

-- Дата первой доставки из календаря в корзине (поле формы date, формат ДД.ММ.ГГГГ)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_date DATE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_price DECIMAL(10, 2);

COMMENT ON COLUMN orders.delivery_date IS 'Дата доставки, выбранная клиентом в корзине';
COMMENT ON COLUMN orders.delivery_price IS
'Стоимость доставки конструктора (товар «Доставка» в корзине), с надбавкой за зону';

-- ─── Триггеры updated_at ─────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS update_meal_types_updated_at ON meal_types;
CREATE TRIGGER update_meal_types_updated_at BEFORE UPDATE ON meal_types FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_dish_meal_types_updated_at ON dish_meal_types;
CREATE TRIGGER update_dish_meal_types_updated_at BEFORE UPDATE ON dish_meal_types FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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

-- ─── Представления для Budibase: календарь и проблемы (с учётом остатков) ─────

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

-- ─── Данные: все блюда — в конструкторе ──────────────────────────────────────
--
-- Для каждого блюда: приём пищи, вес порции, цена, in_constructor = TRUE.
-- Приёмы проверены вручную; вес — сумма граммовок ингредиентов (коэф. 1.0), а у блюд без ингредиентов
-- подобран по похожим блюдам (помечен «вес подобран»). Цена — 350 ₽: цена одного блюда стандартной порции
-- в программах по ставке пробного дня («Офис» 1050 ₽ / 3 блюда = 350 ₽; «Баланс», «Фитнес» — 337,5 ₽,
-- «Классик мини» — 290 ₽); блюдо поштучно — без пакетной скидки, поэтому взята верхняя граница.
-- Меню конструктора — как в программах: каждое блюдо в тот день 4-недельного цикла, когда его
-- готовят для программ (nutrition_program_dishes), во всех городах.
-- Остатки предыдущего дня добавляет constructor_menu_with_carryover.

CREATE TEMP TABLE constructor_dishes_seed (
    dish_id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    meal_type TEXT NOT NULL,
    weight INTEGER NOT NULL
) ON COMMIT DROP;

INSERT INTO constructor_dishes_seed (dish_id, title, meal_type, weight) VALUES
    (1, 'Творожная запеканка с малиной и йогурт', 'Завтраки', 300),  -- вес подобран
    (2, 'Рулет с творогом и яблоками', 'Десерты', 270),  -- вес подобран
    (3, 'Томатный суп с креветками', 'Супы', 350),
    (4, 'Чикенболлы с соусом «Тропикана» с рисом по-мексикански', 'Вторые блюда', 315),
    (5, 'Салат «Белоснежка»', 'Салаты', 323),
    (6, 'Творожная шарлотка с фруктами и йогуртом', 'Завтраки', 300),  -- вес подобран
    (7, 'Рисовый блинчик с клубничным творогом', 'Завтраки', 337),
    (8, 'Куриная грудка с грибами и пенне', 'Вторые блюда', 360),
    (9, 'Фрикадельки с мясным соусом и рисом басмати', 'Вторые блюда', 330),  -- вес подобран
    (10, 'Рулет с курицей, курагой и орехами', 'Вторые блюда', 250),
    (11, 'ПП-шаурма на тарелке', 'Перекусы', 300),
    (12, 'Кекс с яблоками и изюмом', 'Десерты', 293),
    (13, 'Оджахури с курицей', 'Вторые блюда', 345),
    (14, 'Вок с курицей', 'Вторые блюда', 365),
    (15, 'Рыбная запеканка с цветной капустой', 'Вторые блюда', 355),
    (16, 'Полба на молоке с тыквой и карамельные яблоки', 'Завтраки', 335),
    (17, 'Овсяный крамбл с яблоком и конфитюром', 'Десерты', 355),
    (18, 'Фрикадельки из индейки по-шведски в сливочном соусе с пюре и клюквенным соусом', 'Вторые блюда', 350),
    (19, 'Кальмар в сливочном соусе и рисом басмати', 'Вторые блюда', 315),
    (20, 'Винегрет с сухариками', 'Салаты', 293),
    (21, 'Каша Дружба с изюмом', 'Завтраки', 237),
    (22, 'Сырники с ягодным соусом', 'Завтраки', 340),
    (23, 'Рулет с ветчиной в сливочном соусе и томатные спагетти', 'Вторые блюда', 260),
    (24, 'Кебабы куриные с бэби-картофелем и чесночным соусом', 'Вторые блюда', 330),
    (25, 'Рыбная котлетка и салат из свеклы и апельсина', 'Вторые блюда', 353),
    (26, 'Каша овсяная сливочная с малиной и пряностями', 'Завтраки', 283),
    (27, 'Онигири с курицей', 'Перекусы', 278),
    (28, 'Мак-н-чиз с митболлами', 'Вторые блюда', 320),
    (29, 'Рис-боул с креветками и кунжутным соусом', 'Вторые блюда', 320),
    (30, 'Суп-пюре с брокколи и курицей', 'Супы', 320),
    (31, 'Творожный крем с фруктами и мюсли', 'Завтраки', 330),
    (32, 'Тарт тыквенный с ягодно-сметанным соусом', 'Десерты', 250),
    (33, 'Паприкаш и гречка с овощами', 'Вторые блюда', 310),
    (34, 'Чикенстроганов с грибами и картофель Айдахо', 'Вторые блюда', 340),
    (35, 'Овощное рагу', 'Вторые блюда', 270),
    (36, 'Протеиновый завтрак', 'Завтраки', 280),
    (37, 'Шоколадный творожный крем с яблочным конфитюром', 'Десерты', 295),
    (38, 'Тефтели в перечном соусе с чечевичным пюре', 'Вторые блюда', 335),
    (39, 'Грибной крем-суп с шампиньонами и куриным филе', 'Супы', 440),
    (40, 'Теплый салат с картофелем и маслинами', 'Салаты', 330),
    (41, 'Сэндвич-ролл с горбушей и яйцом', 'Перекусы', 305),
    (42, 'Запеканка с брокколи и цветной капустой', 'Перекусы', 335),
    (43, 'Фрикадельки с овощами по-итальянски со спагетти', 'Вторые блюда', 310),
    (44, 'Рамен с курицей', 'Супы', 380),
    (45, 'Картофельный салат с курицей', 'Салаты', 345),
    (46, 'Испанский боул', 'Завтраки', 300),
    (47, 'Конверт-ролл болоньезе', 'Перекусы', 315),
    (48, 'Тропик киноа-боул с курицей под соусом "манго-чили"', 'Вторые блюда', 320),
    (49, 'Говядина в соусе барбекю и рисом по-мексикански', 'Вторые блюда', 340),
    (50, 'Свекольный салат с фетой', 'Салаты', 290),
    (51, 'Боул "Деревенский"', 'Завтраки', 300),
    (52, 'Турецкая лепешка с сыром', 'Перекусы', 200),
    (53, 'Митлов в грибном соусе с гречкой', 'Вторые блюда', 280),
    (54, 'Котлеты по-татарски с пюре, соусом из катыка и пажитником', 'Вторые блюда', 330),
    (55, 'Цезарь с курицей', 'Салаты', 285),
    (56, 'Кукурузная полента на сливках с тыквой и яблоками', 'Завтраки', 265),
    (57, 'Американский сэндвич', 'Перекусы', 330),
    (58, 'Цыпленок карри с ананасами и суши-рисом', 'Вторые блюда', 355),
    (59, 'Котлета с соусом «Болоньезе» и картофельным пюре', 'Вторые блюда', 265),
    (60, 'Кето-курица в сырной шапке, морковью-мини, кабачком и перцем', 'Вторые блюда', 300),
    (61, 'Овсяная каша на топленом молоке с фруктовым топпингом', 'Завтраки', 295),
    (62, 'Шоколадные маффины с апельсиновым джемом', 'Десерты', 290),
    (63, 'Сырный крем-суп с фрикадельками', 'Супы', 280),
    (64, 'Курица с опятами и картофельное пюре', 'Вторые блюда', 340),
    (65, 'Люля-кебаб в соусе с пармезаном', 'Вторые блюда', 310),
    (66, 'Овсянка с шоколадом  и ягодным конфитюром', 'Завтраки', 295),
    (67, 'Даниш с заварным кремом и фруктами', 'Десерты', 267),
    (68, 'Паэлья с куриным бедром и овощами', 'Вторые блюда', 340),
    (69, 'Курочка в соусе чили-апельсин и кус-кус с овощами', 'Вторые блюда', 330),
    (70, 'Паровая котлета с моцареллой с брокколи', 'Вторые блюда', 295),
    (71, 'Рис по-тайски с яйцом', 'Завтраки', 290),
    (72, 'Апельсиновый кекс', 'Десерты', 270),
    (73, 'Азу с гречкой', 'Вторые блюда', 355),
    (74, 'Чечевичный суп с куриными фрикадельками', 'Супы', 348),
    (75, 'Творожная паста с тостом из злакового хлеба и томатами', 'Перекусы', 297),
    (76, 'Рисовая каша с ягодным соусом', 'Завтраки', 240),
    (77, 'Штрудель с овощами и курицей', 'Вторые блюда', 315),
    (78, 'Паста болоньезе', 'Вторые блюда', 300),
    (79, 'Куриное филе с соусом "чак-чак" и рисом жасмин', 'Вторые блюда', 320),
    (80, 'Греческий салат', 'Салаты', 335),
    (81, 'Курица су-вид с овощами гриль и соусом "Айвар"', 'Вторые блюда', 300),
    (82, 'Сэндвич-ролл цезарь', 'Салаты', 320),
    (83, 'Курица терияки на рисе с овощами', 'Вторые блюда', 285),
    (84, 'Средиземноморский боул с курицей и булгуром', 'Вторые блюда', 320),
    (85, 'Салат «Грин энерджи»', 'Салаты', 305),
    (86, 'Творожная запеканка с грушей и ягодами', 'Завтраки', 317),
    (87, 'Кесадилья с говядиной', 'Перекусы', 325),
    (88, 'Цыпленок в кисло-сладком соусе и соба', 'Вторые блюда', 335),
    (89, 'Тыквенный крем-суп с гренками', 'Супы', 410),
    (90, 'Вечерний боул с яйцом и фетой', 'Салаты', 305),
    (91, 'Фриттата с брокколи и курицей', 'Завтраки', 335),
    (92, 'Творожный крем с грушево-анансовым конфитюром', 'Десерты', 275),
    (93, 'Куриная котлета в сырном соусе и гречка', 'Вторые блюда', 245),
    (94, 'Тушеная говядина с курагой, черносливом и кус-кус с овощами', 'Вторые блюда', 340),
    (95, 'Кабачок запеченный с ветчиной и сыром', 'Вторые блюда', 305),
    (96, 'Мультизлаковая каша с грушей и кокосом', 'Завтраки', 242),
    (97, 'Творожный пирог с ягодой', 'Десерты', 340),
    (98, 'Паста с песто и курицей в соусе «Бешамель»', 'Вторые блюда', 265),
    (99, 'Рис по-испански с цыпленком в перечном соусе', 'Вторые блюда', 360),
    (100, 'Ленивые голубцы в овощном соусе', 'Вторые блюда', 315),
    (101, 'Каша пшённая с курагой и орехами', 'Завтраки', 222),
    (102, 'Банановые маффины с клубничной начинкой', 'Десерты', 300),
    (103, 'Паста Рома с куриным филе', 'Вторые блюда', 295),
    (104, 'Булгур с фаршем, черносливом и паприкой', 'Вторые блюда', 365),
    (105, 'Салат деревенский с курицей', 'Салаты', 315),
    (106, 'Гречневая каша на сливках с черносливом и орехами', 'Завтраки', 307),
    (107, 'Рулет с шоколадным творогом и грушей', 'Десерты', 305),
    (108, 'Курица в сливках с грибами и булгур с перцем', 'Вторые блюда', 290),
    (109, 'Том Ям с курицей с рисом', 'Супы', 440),
    (110, 'Котлеты паровые с овощами', 'Вторые блюда', 333),
    (111, 'Рисовая каша с кусочками ананаса', 'Завтраки', 307),
    (112, 'Онигири с говядиной', 'Перекусы', 332),
    (113, 'Гречка с цыпленком по-азиатски', 'Вторые блюда', 330),
    (114, 'Оладьи печеночные и спагетти с соусом «Бешамель»', 'Вторые блюда', 335),
    (115, 'Летний салат с редисом и йогуртом', 'Салаты', 313),
    (116, 'Высокобелковая каша на кокосовом молоке', 'Завтраки', 280),
    (117, 'Творожная запеканка с шоколадной начинкой', 'Десерты', 257),
    (118, 'Говядина Бургиньон с орзо', 'Вторые блюда', 391),
    (119, 'Фобо с говядиной', 'Супы', 392),
    (120, 'Котлеты из индейки с овощами и соусом «Паприка»', 'Вторые блюда', 345),
    (121, 'Гречка с грибами и белым соусом', 'Завтраки', 282),
    (122, 'Ванильно-яблочная шарлотка', 'Десерты', 317),
    (123, 'Тефтели с грибами и фузилли и зеленым соусом', 'Вторые блюда', 325),
    (124, 'Борщ с говядиной', 'Супы', 365),
    (125, 'Поке с бедром цыпленка', 'Вторые блюда', 360),
    (126, 'Овсяная каша с вареньем и орехами', 'Завтраки', 277),
    (127, 'Чиабатта с курицей су-вид и соусом Песто', 'Перекусы', 250),
    (128, 'Мясо по-французски с индейкой', 'Вторые блюда', 325),
    (129, 'Удон с курицей в соусе «Том-ям»', 'Вторые блюда', 290),
    (130, 'Оладьи из мяса курицы с овощами', 'Вторые блюда', 280),
    (131, 'Рисовая запеканка с горбушей', 'Завтраки', 312),
    (132, 'Гирос с курицей', 'Перекусы', 300),
    (133, 'Говядина томленая с черносливом и алтайской гречкой', 'Вторые блюда', 330),
    (134, 'Митболлы барбекю с фарфалле и базиликом', 'Вторые блюда', 325),
    (135, 'Котлета в сырном соусе со свеклой', 'Вторые блюда', 315),
    (136, 'Шакшука классическая', 'Завтраки', 280),
    (137, 'Ванильные сырники с изюмом', 'Завтраки', 292),
    (138, 'Рис с цыпленком «Унаги»', 'Вторые блюда', 295),
    (139, 'Суп гороховый с куриным бедром', 'Супы', 250),
    (140, 'Шопский салат с курицей', 'Салаты', 300);  -- вес подобран

-- Проверка: блюдо с таким id — то самое (название без учёта кавычек), приём пищи существует
DO $$
DECLARE
    problem TEXT;
BEGIN
    SELECT string_agg(format('%s «%s»', c.dish_id, c.title), '; ') INTO problem
    FROM constructor_dishes_seed c
    LEFT JOIN dishes d ON d.id = c.dish_id
    WHERE d.id IS NULL
       OR regexp_replace(TRIM(d.title), '["«»]', '', 'g') <> regexp_replace(c.title, '["«»]', '', 'g');
    IF problem IS NOT NULL THEN
        RAISE EXCEPTION 'Не совпадают блюда: %', problem;
    END IF;

    SELECT string_agg(DISTINCT c.meal_type, ', ') INTO problem
    FROM constructor_dishes_seed c
    LEFT JOIN meal_types mt ON mt.title = c.meal_type
    WHERE mt.id IS NULL;
    IF problem IS NOT NULL THEN
        RAISE EXCEPTION 'Нет приёмов пищи: %', problem;
    END IF;
END $$;

UPDATE dishes d SET
    in_constructor = TRUE,
    weight = c.weight,
    price = COALESCE(d.price, 350)
FROM constructor_dishes_seed c
WHERE d.id = c.dish_id;

-- Без UNIQUE (dish_id, meal_type_id): добавляем только недостающие связи
INSERT INTO dish_meal_types (dish_id, meal_type_id)
SELECT c.dish_id, mt.id
FROM constructor_dishes_seed c
JOIN meal_types mt ON mt.title = c.meal_type
WHERE NOT EXISTS (
    SELECT 1 FROM dish_meal_types dmt
    WHERE dmt.dish_id = c.dish_id AND dmt.meal_type_id = mt.id
);

-- Меню конструктора = расписание программ
INSERT INTO constructor_menu (city_id, week_number, day_of_week, dish_id, comment)
SELECT DISTINCT NULL::INTEGER, p.week_number, p.day_of_week, p.dish_id, 'как в меню программ'
FROM nutrition_program_dishes p
WHERE p.week_number BETWEEN 1 AND 4;

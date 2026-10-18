-- Конструктор «Собери своё меню»
-- 1. Приёмы пищи (фильтр «Выберите приемы»). Одно блюдо может относиться к нескольким приёмам.
-- 2. Поля блюда для конструктора: вес порции, цена, флаги использования.
-- 3. Позиции заказа могут быть отдельными блюдами, а не только программами.
-- 4. Дата доставки, выбранная в корзине.
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
-- ловит duplicate key (см. 008). Дубли схлопываются в запросах API.
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
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS in_program BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS in_constructor BOOLEAN NOT NULL DEFAULT FALSE;

-- price и price_old в проде уже есть (добавлены вручную как real), на чистой БД их нет.
-- Приводим к numeric, чтобы цены считались без ошибок округления.
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2);
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS price_old NUMERIC(10, 2);
ALTER TABLE dishes ALTER COLUMN price TYPE NUMERIC(10, 2) USING price::NUMERIC(10, 2);
ALTER TABLE dishes ALTER COLUMN price_old TYPE NUMERIC(10, 2) USING price_old::NUMERIC(10, 2);

ALTER TABLE dishes DROP CONSTRAINT IF EXISTS dishes_weight_positive;
ALTER TABLE dishes ADD CONSTRAINT dishes_weight_positive CHECK (weight IS NULL OR weight > 0);

ALTER TABLE dishes DROP CONSTRAINT IF EXISTS dishes_price_non_negative;
ALTER TABLE dishes ADD CONSTRAINT dishes_price_non_negative CHECK (
    (price IS NULL OR price >= 0) AND (price_old IS NULL OR price_old >= 0)
);

CREATE INDEX IF NOT EXISTS idx_dishes_in_constructor ON dishes(in_constructor) WHERE in_constructor;

COMMENT ON COLUMN dishes.weight IS
'Вес порции в граммах для конструктора. КБЖУ порции = КБЖУ на 100 г (по ингредиентам) × weight / 100';
COMMENT ON COLUMN dishes.in_program IS
'Блюдо используется в программах питания. Снятый флаг = черновик: блюдо скрыто из меню программ, даже если есть в nutrition_program_dishes';
COMMENT ON COLUMN dishes.in_constructor IS
'Блюдо доступно в конструкторе «Собери своё меню» (показывается только при заполненных price и weight)';
COMMENT ON COLUMN dishes.price IS 'Цена блюда в конструкторе, одна для всех городов';
COMMENT ON COLUMN dishes.price_old IS 'Старая цена (зачёркнутая) в конструкторе';

-- ─── Позиции заказа ──────────────────────────────────────────────────────────

-- Позиция заказа — либо программа (nutrition_program_id), либо блюдо из конструктора (dish_id)
ALTER TABLE order_items ALTER COLUMN nutrition_program_id DROP NOT NULL;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS dish_id INTEGER REFERENCES dishes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_order_items_dish_id ON order_items(dish_id);

-- Дата первой доставки из календаря в корзине (поле формы date, формат ДД.ММ.ГГГГ)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_date DATE;

COMMENT ON COLUMN orders.delivery_date IS 'Дата доставки, выбранная клиентом в корзине';

-- ─── Триггеры updated_at ─────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS update_meal_types_updated_at ON meal_types;
CREATE TRIGGER update_meal_types_updated_at BEFORE UPDATE ON meal_types FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_dish_meal_types_updated_at ON dish_meal_types;
CREATE TRIGGER update_dish_meal_types_updated_at BEFORE UPDATE ON dish_meal_types FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

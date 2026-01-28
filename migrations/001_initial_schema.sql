-- Создание таблиц для проекта Fitbox

-- Таблица городов
CREATE TABLE IF NOT EXISTS cities (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    sort INTEGER DEFAULT 0,
    started_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица программ питания (БЕЗ привязки к городу)
CREATE TABLE IF NOT EXISTS nutrition_programs (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    emoji VARCHAR(10),
    data JSONB NOT NULL, -- { calories_from, calories_to, proteins, fats, carbohydrates }
    sort INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Связь городов и программ питания (many-to-many)
CREATE TABLE IF NOT EXISTS city_nutrition_programs (
    id SERIAL PRIMARY KEY,
    city_id INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
    nutrition_program_id INTEGER NOT NULL REFERENCES nutrition_programs(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(city_id, nutrition_program_id)
);

-- Таблица цен для программ питания
CREATE TABLE IF NOT EXISTS prices (
    id SERIAL PRIMARY KEY,
    nutrition_program_id INTEGER NOT NULL REFERENCES nutrition_programs(id) ON DELETE CASCADE,
    days INTEGER NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    old_price DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица блюд
CREATE TABLE IF NOT EXISTS dishes (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    images JSONB, -- Массив URL изображений: [{"path":"download/noco/p4abb31hvuzym5i/mt9rajh3b75ospb/c2alndpm9q88won/000010 Tvoroznaa zapekanka s malinoj i jogurt_Llor1.png","title":"000010 Tvoroznaa zapekanka s malinoj i jogurt.png","mimetype":"image/png","size":362717,"width":500,"height":365,"id":"atp4numailg582v7"}]
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица ингредиентов
CREATE TABLE IF NOT EXISTS ingredients (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    calories DECIMAL(10, 2),
    proteins DECIMAL(10, 2),
    fats DECIMAL(10, 2),
    carbohydrates DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Связь блюд и ингредиентов с количеством
CREATE TABLE IF NOT EXISTS dish_ingredients (
    id SERIAL PRIMARY KEY,
    dish_id INTEGER NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
    ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    quantity DECIMAL(10, 2) NOT NULL, -- количество в граммах
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(dish_id, ingredient_id)
);

-- Связь программ питания, дней недели и блюд
CREATE TABLE IF NOT EXISTS nutrition_program_dishes (
    id SERIAL PRIMARY KEY,
    nutrition_program_id INTEGER NOT NULL REFERENCES nutrition_programs(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 1 AND day_of_week <= 7), -- 1=Понедельник, 7=Воскресенье
    meal_type VARCHAR(50) NOT NULL, -- 'breakfast', 'lunch', 'dinner', 'snack'
    dish_id INTEGER NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
    sort INTEGER DEFAULT 0, -- порядок отображения блюд
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица заказов
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    city VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    comment TEXT,
    promocode VARCHAR(100),
    current_price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Элементы заказа (связь заказов с программами питания и ценами)
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    nutrition_program_id INTEGER NOT NULL REFERENCES nutrition_programs(id) ON DELETE RESTRICT,
    price_id INTEGER NOT NULL REFERENCES prices(id) ON DELETE RESTRICT,
    quantity INTEGER DEFAULT 1,
    price DECIMAL(10, 2) NOT NULL, -- цена на момент заказа
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для улучшения производительности
CREATE INDEX IF NOT EXISTS idx_city_nutrition_programs_city_id ON city_nutrition_programs(city_id);
CREATE INDEX IF NOT EXISTS idx_city_nutrition_programs_program_id ON city_nutrition_programs(nutrition_program_id);
CREATE INDEX IF NOT EXISTS idx_prices_nutrition_program_id ON prices(nutrition_program_id);
CREATE INDEX IF NOT EXISTS idx_dish_ingredients_dish_id ON dish_ingredients(dish_id);
CREATE INDEX IF NOT EXISTS idx_dish_ingredients_ingredient_id ON dish_ingredients(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_nutrition_program_dishes_program_id ON nutrition_program_dishes(nutrition_program_id);
CREATE INDEX IF NOT EXISTS idx_nutrition_program_dishes_dish_id ON nutrition_program_dishes(dish_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_nutrition_program_id ON order_items(nutrition_program_id);

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Триггеры для автоматического обновления updated_at
CREATE TRIGGER update_cities_updated_at BEFORE UPDATE ON cities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_nutrition_programs_updated_at BEFORE UPDATE ON nutrition_programs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_city_nutrition_programs_updated_at BEFORE UPDATE ON city_nutrition_programs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_prices_updated_at BEFORE UPDATE ON prices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_dishes_updated_at BEFORE UPDATE ON dishes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ingredients_updated_at BEFORE UPDATE ON ingredients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_dish_ingredients_updated_at BEFORE UPDATE ON dish_ingredients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_nutrition_program_dishes_updated_at BEFORE UPDATE ON nutrition_program_dishes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_order_items_updated_at BEFORE UPDATE ON order_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

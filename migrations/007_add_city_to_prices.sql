-- Миграция: привязка цен к городам
-- Позволяет задавать разные цены для одной программы питания в разных городах

-- 1. Добавляем колонку city_id
ALTER TABLE prices ADD COLUMN city_id INTEGER REFERENCES cities(id) ON DELETE CASCADE;

-- 2. Дублируем существующие цены на все города, в которых доступна программа
INSERT INTO prices (nutrition_program_id, city_id, days, price, old_price)
SELECT p.nutrition_program_id, cnp.city_id, p.days, p.price, p.old_price
FROM prices p
JOIN city_nutrition_programs cnp ON cnp.nutrition_program_id = p.nutrition_program_id
WHERE p.city_id IS NULL;

-- 3. Удаляем старые записи без города
DELETE FROM prices WHERE city_id IS NULL;

-- 4. Делаем city_id обязательным
ALTER TABLE prices ALTER COLUMN city_id SET NOT NULL;

-- 5. Уникальность: одна цена на комбинацию программа + город + кол-во дней
ALTER TABLE prices ADD CONSTRAINT prices_unique_program_city_days
  UNIQUE (nutrition_program_id, city_id, days);

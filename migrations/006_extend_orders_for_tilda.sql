-- Расширение таблицы orders для приёма данных от Тильды

-- Новые контактные поля
ALTER TABLE orders ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS communicate VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS communicate_type VARCHAR(50);

-- Информация о заказе
ALTER TABLE orders ADD COLUMN IF NOT EXISTS source VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_system VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tilda_order_id VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10, 2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tilda_raw_data JSONB;

-- Разбиваем address на отдельные поля
ALTER TABLE orders ADD COLUMN IF NOT EXISTS street VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS house VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS corpus VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS flat VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS entrance VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS floor VARCHAR(50);

-- Удаляем старое поле address (заменено отдельными полями)
ALTER TABLE orders DROP COLUMN IF EXISTS address;

-- Делаем current_price nullable (заменяется на total_amount)
ALTER TABLE orders ALTER COLUMN current_price DROP NOT NULL;

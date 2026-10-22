-- Дата доставки у позиции заказа.
-- Блюда конструктора выбираются на конкретные дни: артикул D<id>-<ГГГГММДД>.
-- У программ питания дата одна на весь заказ — orders.delivery_date.
-- Транзакцию открывает scripts/migrate.js.

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS delivery_date DATE;

COMMENT ON COLUMN order_items.delivery_date IS
'Дата доставки блюда конструктора (из артикула D<id>-<ГГГГММДД>); для программ — NULL, дата в orders.delivery_date';

CREATE INDEX IF NOT EXISTS idx_order_items_delivery_date ON order_items(delivery_date);

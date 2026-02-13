-- Добавляем коэффициент порции для программ питания
-- Коэффициент умножается на граммовку ингредиентов при отображении блюд
-- Например: 1.0 = без изменений (Офис), 1.3 = порции на 30% больше (Классик/Классик+)

ALTER TABLE nutrition_programs
ADD COLUMN IF NOT EXISTS portion_coefficient DECIMAL(4,2) NOT NULL DEFAULT 1.0;

COMMENT ON COLUMN nutrition_programs.portion_coefficient IS
'Множитель порции: 1.0 = стандарт, >1.0 = увеличенные порции';

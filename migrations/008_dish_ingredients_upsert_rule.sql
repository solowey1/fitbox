-- Миграция: убираем уникальный constraint с dish_ingredients
-- Решает проблему "Duplicate key value violates unique constraint"
-- при редактировании ингредиентов блюда через Budibase

-- Убираем уникальное ограничение
ALTER TABLE dish_ingredients DROP CONSTRAINT IF EXISTS dish_ingredients_dish_id_ingredient_id_key;

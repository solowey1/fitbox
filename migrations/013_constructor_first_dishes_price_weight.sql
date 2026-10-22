-- Вес и цена для первых 20 блюд конструктора (миграция 012), чтобы конструктор
-- в Казани начал показывать блюда. Без цены и веса блюдо не попадает в API.
--
-- Вес — сумма граммовок ингредиентов блюда (базовая порция, коэффициент 1.0).
-- Цена — 350 ₽: цена одного блюда стандартной порции в программах Казани
-- по ставке пробного дня: «Офис» 1050 ₽ / 3 блюда = 350 ₽
-- («Баланс», «Фитнес» — 337,5 ₽, «Классик мини» — 290 ₽). Блюдо поштучно —
-- покупка без пакетной скидки, поэтому взята верхняя граница.
--
-- Заполняются только пустые поля: значения, введённые в админке, не перезаписываются.
-- Транзакцию открывает scripts/migrate.js.

WITH first_dishes(id) AS (
    VALUES (12), (14), (21), (22), (26), (30), (41), (50), (55), (57),
           (62), (73), (78), (80), (83), (101), (112), (122), (124), (139)
),
ingredient_weight AS (
    SELECT di.dish_id, ROUND(SUM(di.quantity))::INTEGER AS weight
    FROM dish_ingredients di
    WHERE di.dish_id IN (SELECT id FROM first_dishes)
    GROUP BY di.dish_id
    HAVING SUM(di.quantity) > 0
)
UPDATE dishes d
SET weight = COALESCE(d.weight, iw.weight),
    price = COALESCE(d.price, 350)
FROM ingredient_weight iw
WHERE d.id = iw.dish_id
  AND d.in_constructor
  AND (d.weight IS NULL OR d.price IS NULL);

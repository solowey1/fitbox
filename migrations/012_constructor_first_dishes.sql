-- Первые блюда конструктора «Собери своё меню» (тест в Казани)
-- 20 блюд, у которых приём пищи однозначен и заполнена граммовка ингредиентов.
-- Блюда включаются в конструктор (in_constructor) и получают приём пищи.
-- Цену и вес (dishes.price, dishes.weight) заполняют в админке: без них блюдо
-- в конструкторе не показывается.
-- Транзакцию открывает scripts/migrate.js.

CREATE TEMP TABLE constructor_first_dishes (dish_id INTEGER, title TEXT, meal_type TEXT) ON COMMIT DROP;

INSERT INTO constructor_first_dishes (dish_id, title, meal_type) VALUES
    -- Завтраки
    (21, 'Каша Дружба с изюмом', 'breakfast'),
    (22, 'Сырники с ягодным соусом', 'breakfast'),
    (26, 'Каша овсяная сливочная с малиной и пряностями', 'breakfast'),
    (101, 'Каша пшённая с курагой и орехами', 'breakfast'),
    -- Перекусы
    (41, 'Сэндвич-ролл с горбушей и яйцом', 'snack'),
    (57, 'Американский сэндвич', 'snack'),
    (112, 'Онигири с говядиной', 'snack'),
    -- Салаты
    (50, 'Свекольный салат с фетой', 'salad'),
    (55, 'Цезарь с курицей', 'salad'),
    (80, 'Греческий салат', 'salad'),
    -- Супы
    (30, 'Суп-пюре с брокколи и курицей', 'soup'),
    (124, 'Борщ с говядиной', 'soup'),
    (139, 'Суп гороховый с куриным бедром', 'soup'),
    -- Вторые блюда
    (14, 'Вок с курицей', 'main'),
    (73, 'Азу с гречкой', 'main'),
    (78, 'Паста болоньезе', 'main'),
    (83, 'Курица терияки на рисе с овощами', 'main'),
    -- Десерты
    (12, 'Кекс с яблоками и изюмом', 'dessert'),
    (62, 'Шоколадные маффины с апельсиновым джемом', 'dessert'),
    (122, 'Ванильно-яблочная шарлотка', 'dessert');

-- Защита: id должен указывать на то же блюдо, что и при подготовке миграции
DO $$
DECLARE
    mismatched TEXT;
BEGIN
    SELECT string_agg(c.dish_id || ' «' || c.title || '»', ', ')
    INTO mismatched
    FROM constructor_first_dishes c
    LEFT JOIN dishes d ON d.id = c.dish_id AND trim(d.title) = c.title
    WHERE d.id IS NULL;

    IF mismatched IS NOT NULL THEN
        RAISE EXCEPTION 'Блюда не найдены или переименованы: %', mismatched;
    END IF;
END $$;

INSERT INTO dish_meal_types (dish_id, meal_type_id)
SELECT c.dish_id, mt.id
FROM constructor_first_dishes c
JOIN meal_types mt ON mt.slug = c.meal_type
WHERE NOT EXISTS (
    SELECT 1 FROM dish_meal_types dmt
    WHERE dmt.dish_id = c.dish_id AND dmt.meal_type_id = mt.id
);

UPDATE dishes
SET in_constructor = TRUE
WHERE id IN (SELECT dish_id FROM constructor_first_dishes)
  AND NOT in_constructor;

-- Функция для пересчета питательности программ на основе ингредиентов блюд
-- Вызывается вручную через API или автоматически через cron

CREATE OR REPLACE FUNCTION recalculate_program_nutrition()
RETURNS TABLE(
  program_id INTEGER,
  program_title VARCHAR,
  calories_from INTEGER,
  calories_to INTEGER,
  proteins INTEGER,
  fats INTEGER,
  carbohydrates INTEGER,
  updated BOOLEAN
) AS $$
DECLARE
  program_record RECORD;
  dish_stats RECORD;
  min_calories INTEGER;
  max_calories INTEGER;
  avg_proteins NUMERIC;
  avg_fats NUMERIC;
  avg_carbs NUMERIC;
BEGIN
  -- Проходим по всем программам питания
  FOR program_record IN SELECT id, title FROM nutrition_programs ORDER BY id LOOP

    -- Вычисляем статистику по блюдам программы
    SELECT
      MIN(daily_calories)::INTEGER as min_cal,
      MAX(daily_calories)::INTEGER as max_cal,
      ROUND(AVG(daily_proteins))::INTEGER as avg_prot,
      ROUND(AVG(daily_fats))::INTEGER as avg_fat,
      ROUND(AVG(daily_carbs))::INTEGER as avg_carb
    INTO dish_stats
    FROM (
      -- Для каждого дня программы считаем суммарные калории и БЖУ
      SELECT
        npd.day_of_week,
        npd.week_number,
        SUM(
          COALESCE(
            (
              SELECT SUM((i.calories * di.quantity / 100))
              FROM dish_ingredients di
              JOIN ingredients i ON i.id = di.ingredient_id
              WHERE di.dish_id = d.id
            ),
            0
          )
        ) as daily_calories,
        SUM(
          COALESCE(
            (
              SELECT SUM((i.proteins * di.quantity / 100))
              FROM dish_ingredients di
              JOIN ingredients i ON i.id = di.ingredient_id
              WHERE di.dish_id = d.id
            ),
            0
          )
        ) as daily_proteins,
        SUM(
          COALESCE(
            (
              SELECT SUM((i.fats * di.quantity / 100))
              FROM dish_ingredients di
              JOIN ingredients i ON i.id = di.ingredient_id
              WHERE di.dish_id = d.id
            ),
            0
          )
        ) as daily_fats,
        SUM(
          COALESCE(
            (
              SELECT SUM((i.carbohydrates * di.quantity / 100))
              FROM dish_ingredients di
              JOIN ingredients i ON i.id = di.ingredient_id
              WHERE di.dish_id = d.id
            ),
            0
          )
        ) as daily_carbs
      FROM nutrition_program_dishes npd
      JOIN dishes d ON d.id = npd.dish_id
      WHERE npd.nutrition_program_id = program_record.id
      GROUP BY npd.day_of_week, npd.week_number
    ) daily_stats;

    -- Если есть данные, обновляем программу
    IF dish_stats.min_cal IS NOT NULL THEN
      min_calories := dish_stats.min_cal;
      max_calories := dish_stats.max_cal;
      avg_proteins := dish_stats.avg_prot;
      avg_fats := dish_stats.avg_fat;
      avg_carbs := dish_stats.avg_carb;

      -- Обновляем JSONB поле data
      UPDATE nutrition_programs
      SET data = jsonb_build_object(
        'calories_from', min_calories,
        'calories_to', max_calories,
        'proteins', avg_proteins,
        'fats', avg_fats,
        'carbohydrates', avg_carbs
      )
      WHERE id = program_record.id;

      -- Возвращаем результат
      RETURN QUERY SELECT
        program_record.id,
        program_record.title,
        min_calories,
        max_calories,
        avg_proteins::INTEGER,
        avg_fats::INTEGER,
        avg_carbs::INTEGER,
        TRUE;
    ELSE
      -- Нет данных для этой программы
      RETURN QUERY SELECT
        program_record.id,
        program_record.title,
        0,
        0,
        0,
        0,
        0,
        FALSE;
    END IF;

  END LOOP;

  RETURN;
END;
$$ LANGUAGE plpgsql;

-- Комментарий к функции
COMMENT ON FUNCTION recalculate_program_nutrition() IS
'Пересчитывает калории и БЖУ для всех программ питания на основе ингредиентов блюд.
Возвращает таблицу с результатами пересчета для каждой программы.';

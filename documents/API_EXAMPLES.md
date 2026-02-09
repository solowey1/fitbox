# API Examples / Примеры запросов к API

## Health Check

```bash
curl http://localhost:3000/health
```

## Cities (Города)

### Получить все города
```bash
curl http://localhost:3000/api/cities
```

### Получить город по ID
```bash
curl http://localhost:3000/api/cities/1
```

### Создать город
```bash
curl -X POST http://localhost:3000/api/cities \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Екатеринбург",
    "descr": "Столица Урала",
    "started_at": "2024-04-01"
  }'
```

### Обновить город
```bash
curl -X PUT http://localhost:3000/api/cities/1 \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Москва",
    "descr": "Столица России, обновленное описание",
    "started_at": "2024-01-01"
  }'
```

### Удалить город
```bash
curl -X DELETE http://localhost:3000/api/cities/1
```

---

## Nutrition Programs (Программы питания)

### Получить все программы питания
```bash
curl http://localhost:3000/api/programs
```

### Получить программы для конкретного города
```bash
curl "http://localhost:3000/api/programs?city_id=1"
```

### Получить программу по ID
```bash
curl http://localhost:3000/api/programs/1
```

### Получить программу с ценами
```bash
curl http://localhost:3000/api/programs/1/prices
```

### Создать программу питания
```bash
curl -X POST http://localhost:3000/api/programs \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Детокс",
    "emoji": "🥬",
    "data": {
      "calories_from": 800,
      "calories_to": 1000,
      "proteins": 60,
      "fats": 30,
      "carbohydrates": 80
    },
    "city_id": 1,
    "sort": 5
  }'
```

### Обновить программу питания
```bash
curl -X PUT http://localhost:3000/api/programs/1 \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Баланс Плюс",
    "emoji": "⚖️",
    "data": {
      "calories_from": 1300,
      "calories_to": 1600,
      "proteins": 110,
      "fats": 55,
      "carbohydrates": 160
    },
    "city_id": 1,
    "sort": 1
  }'
```

### Удалить программу питания
```bash
curl -X DELETE http://localhost:3000/api/programs/1
```

---

## Dishes (Блюда)

### Получить все блюда
```bash
curl http://localhost:3000/api/dishes
```

### Получить блюдо по ID
```bash
curl http://localhost:3000/api/dishes/1
```

### Получить блюдо с ингредиентами
```bash
curl http://localhost:3000/api/dishes/1/ingredients
```

### Создать блюдо
```bash
curl -X POST http://localhost:3000/api/dishes \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Стейк из говядины с овощами гриль",
    "image": "/uploads/chicken-updated.jpg"
  }'
```

### Обновить блюдо
```bash
curl -X PUT http://localhost:3000/api/dishes/1 \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Куриная грудка с бурым рисом и брокколи",
    "image": "/uploads/chicken-updated.jpg"
  }'
```

### Удалить блюдо
```bash
curl -X DELETE http://localhost:3000/api/dishes/1
```

---

## Orders (Заказы)

### Получить все заказы
```bash
curl http://localhost:3000/api/orders
```

### Получить заказ по ID с элементами
```bash
curl http://localhost:3000/api/orders/1
```

### Создать заказ
```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Мария Петрова",
    "phone": "+7 999 888-77-66",
    "city": "Москва",
    "address": "ул. Тверская, д. 10, кв. 25",
    "comment": "Домофон не работает, позвоните за 10 минут",
    "promocode": "NEWUSER",
    "current_price": 4800,
    "items": [
      {
        "nutrition_program_id": 1,
        "price_id": 2,
        "quantity": 1,
        "price": 4800
      }
    ]
  }'
```

### Создать заказ с несколькими программами
```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Алексей Смирнов",
    "phone": "+7 999 777-66-55",
    "city": "Москва",
    "address": "ул. Ленина, д. 5, оф. 301",
    "comment": "Доставка на работу, с 9 до 18",
    "promocode": "",
    "current_price": 10000,
    "items": [
      {
        "nutrition_program_id": 1,
        "price_id": 2,
        "quantity": 1,
        "price": 4800
      },
      {
        "nutrition_program_id": 2,
        "price_id": 5,
        "quantity": 1,
        "price": 5200
      }
    ]
  }'
```

### Обновить заказ
```bash
curl -X PUT http://localhost:3000/api/orders/1 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Иван Иванов",
    "phone": "+7 999 123-45-67",
    "city": "Москва",
    "address": "ул. Ленина, д. 1, кв. 10",
    "comment": "Обновленный комментарий: доставка после 19:00",
    "promocode": "SALE10",
    "current_price": 2500
  }'
```

### Удалить заказ
```bash
curl -X DELETE http://localhost:3000/api/orders/1
```

---

## Примеры ответов

### Успешный ответ (города)
```json
[
  {
    "id": 1,
    "title": "Москва",
    "descr": "Столица России, крупнейший город страны",
    "started_at": "2024-01-01T00:00:00.000Z",
    "created_at": "2024-01-13T12:00:00.000Z",
    "updated_at": "2024-01-13T12:00:00.000Z"
  }
]
```

### Программа с ценами
```json
{
  "id": 1,
  "title": "Баланс",
  "emoji": "⚖️",
  "data": {
    "calories_from": 1200,
    "calories_to": 1500,
    "proteins": 100,
    "fats": 50,
    "carbohydrates": 150
  },
  "city_id": 1,
  "city_name": "Москва",
  "sort": 1,
  "prices": [
    {
      "id": 1,
      "nutrition_program_id": 1,
      "days": 5,
      "price": "2500.00",
      "old_price": "3000.00"
    },
    {
      "id": 2,
      "nutrition_program_id": 1,
      "days": 10,
      "price": "4800.00",
      "old_price": "5500.00"
    }
  ]
}
```

### Блюдо с ингредиентами
```json
{
  "id": 1,
  "title": "Куриная грудка с рисом и овощами",
  "image": "uploads/dish1.jpg",
  "ingredients": [
    {
      "id": 1,
      "title": "Куриная грудка",
      "calories": "165.00",
      "proteins": "31.00",
      "fats": "3.60",
      "carbohydrates": "0.00",
      "quantity": "150.00"
    },
    {
      "id": 2,
      "title": "Рис бурый",
      "calories": "111.00",
      "proteins": "2.60",
      "fats": "0.90",
      "carbohydrates": "23.00",
      "quantity": "100.00"
    }
  ]
}
```

### Заказ с элементами
```json
{
  "id": 1,
  "name": "Иван Иванов",
  "phone": "+7 999 123-45-67",
  "city": "Москва",
  "address": "ул. Ленина, д. 1, кв. 10",
  "comment": "Доставка после 18:00",
  "promocode": "SALE10",
  "current_price": "2500.00",
  "created_at": "2024-01-13T15:30:00.000Z",
  "updated_at": "2024-01-13T15:30:00.000Z",
  "items": [
    {
      "id": 1,
      "nutrition_program_id": 1,
      "price_id": 1,
      "quantity": 1,
      "price": "2500.00",
      "program_title": "Баланс",
      "days": 5
    }
  ]
}
```

### Ошибка 404
```json
{
  "error": "City not found"
}
```

### Ошибка 500
```json
{
  "error": "Internal server error"
}
```

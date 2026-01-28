# Используем официальный образ Node.js
FROM node:24-alpine

# Создаём рабочую директорию
WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm ci --only=production

# Копируем код приложения
COPY . .

# Экспонируем порт
EXPOSE 3000

# Запускаем приложение
CMD ["node", "index.js"]

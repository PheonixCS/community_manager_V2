# Сборка React приложения
FROM node:16-alpine as build

WORKDIR /app

# Сначала копируем и устанавливаем зависимости для кеширования слоев
COPY package*.json ./
RUN npm install

# Затем копируем остальные файлы
COPY . .

# Создаем .env с переменными окружения
RUN echo "REACT_APP_API_URL=http://localhost:5000" > .env

# Собираем проект
RUN npm run build

# Настройка Nginx для раздачи статических файлов
FROM nginx:alpine

# Копируем собранное приложение из предыдущего шага
COPY --from=build /app/build /usr/share/nginx/html

# Копируем конфигурацию Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

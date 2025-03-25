FROM node:16-alpine

WORKDIR /usr/src/app

# Копируем файлы package*.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install --omit=dev

# Копируем исходники приложения и yt-dlp
COPY . .
COPY yt-dlp.exe .

# Делаем yt-dlp.exe исполняемым
RUN chmod +x yt-dlp.exe

# Открываем порт 5000
EXPOSE 5000

# Запускаем приложение
CMD ["node", "app.js"]

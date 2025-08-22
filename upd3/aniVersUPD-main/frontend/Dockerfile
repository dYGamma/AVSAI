# --- Этап 1: Сборка ---
FROM node:18-alpine AS build

WORKDIR /app

# Копируем package.json и устанавливаем зависимости
COPY package*.json ./
RUN npm install

# Копируем остальные файлы проекта
COPY . .

# Собираем production-билд
RUN npm run build

# --- Этап 2: Раздача через Nginx ---
FROM nginx:stable-alpine

# Копируем собранные файлы из этапа сборки
COPY --from=build /app/build /usr/share/nginx/html

# Удаляем стандартную конфигурацию Nginx
RUN rm /etc/nginx/conf.d/default.conf

# Создаем свою конфигурацию для корректной работы React Router
COPY nginx.conf /etc/nginx/conf.d

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

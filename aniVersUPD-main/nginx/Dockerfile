FROM nginx:stable-alpine

# Удаляем стандартную конфигурацию Nginx
RUN rm /etc/nginx/conf.d/default.conf

# Копируем нашу кастомную конфигурацию
COPY nginx.conf /etc/nginx/conf.d

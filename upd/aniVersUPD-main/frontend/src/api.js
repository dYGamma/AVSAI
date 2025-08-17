// ./frontend/src/api.js
import axios from 'axios';

export const API_URL = '/api';

const api = axios.create({
  withCredentials: true, // Разрешаем отправку cookie (refreshToken хранится в httpOnly cookie)
  baseURL: API_URL,
});

// Request interceptor — добавляем заголовок Authorization только если есть токен
api.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem('token');
    if (token) {
      if (!config.headers) config.headers = {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  } catch (e) {
    // На случай, если localStorage недоступен
    return config;
  }
}, (error) => {
  return Promise.reject(error);
});

// Response interceptor — при 401 пробуем обновить accessToken через /api/refresh
api.interceptors.response.use((response) => {
  return response;
}, async (error) => {
  try {
    const originalRequest = error?.config;
    const status = error?.response?.status;

    // Если уже ретрайнули — не заходим в цикл
    if (status === 401 && originalRequest && !originalRequest._isRetry) {
      originalRequest._isRetry = true;
      try {
        // Запрашиваем обновление токена. Сервер использует httpOnly refresh cookie.
        const refreshResponse = await axios.get(`${API_URL}/refresh`, { withCredentials: true });
        const newAccessToken = refreshResponse?.data?.accessToken;
        if (newAccessToken) {
          localStorage.setItem('token', newAccessToken);
          // Повторяем исходный запрос с новым токеном
          if (!originalRequest.headers) originalRequest.headers = {};
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return api.request(originalRequest);
        }
      } catch (refreshError) {
        // Если refresh не удался — чистим локальный токен
        localStorage.removeItem('token');
        console.log('Refresh token failed or user not authorized');
        throw refreshError;
      }
    }
  } catch (e) {
    // Если что-то пошло не так при обработке ошибки — пробрасываем оригинальную ошибку
    console.error('Interceptor error handling failed', e);
  }
  throw error;
});

export default api;

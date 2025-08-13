// Подключаем сервис для работы с пользователями, который содержит всю бизнес-логику.
const UserService = require('../services/user.service');
// Подключаем express-validator для проверки данных, приходящих от клиента.
const { validationResult } = require('express-validator');
// Подключаем кастомный класс для обработки ошибок.
const ApiError = require('../exceptions/api.error');

class UserController {

    /**
     * Регистрация нового пользователя.
     */
    async register(req, res, next) {
        try {
            // Проверяем, были ли ошибки валидации (например, email некорректен).
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return next(ApiError.BadRequest('Ошибка при валидации', errors.array()));
            }
            // Получаем email и пароль из тела запроса.
            const { email, password } = req.body;
            // Вызываем сервис для регистрации.
            const userData = await UserService.register(email, password);
            // Сохраняем refresh-токен в httpOnly cookie для безопасности.
            res.cookie('refreshToken', userData.refreshToken, { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true });
            // Возвращаем данные пользователя и токены на клиент.
            return res.json(userData);
        } catch (e) {
            // Передаем ошибку в следующий middleware.
            next(e);
        }
    }

    /**
     * Вход пользователя в систему.
     */
    async login(req, res, next) {
        try {
            const { email, password } = req.body;
            const userData = await UserService.login(email, password);
            res.cookie('refreshToken', userData.refreshToken, { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true });
            return res.json(userData);
        } catch (e) {
            next(e);
        }
    }

    /**
     * Выход пользователя из системы.
     */
    async logout(req, res, next) {
        try {
            // Получаем refresh-токен из cookie.
            const { refreshToken } = req.cookies;
            // Вызываем сервис для удаления токена из базы данных.
            const token = await UserService.logout(refreshToken);
            // Удаляем cookie у клиента.
            res.clearCookie('refreshToken');
            // Возвращаем успешный ответ.
            return res.json(token);
        } catch (e) {
            next(e);
        }
    }

    /**
     * Обновление access-токена с помощью refresh-токена.
     */
    async refresh(req, res, next) {
        try {
            const { refreshToken } = req.cookies;
            const userData = await UserService.refresh(refreshToken);
            res.cookie('refreshToken', userData.refreshToken, { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true });
            return res.json(userData);
        } catch (e) {
            next(e);
        }
    }

    /**
     * Получение списка аниме для авторизованного пользователя.
     */
    async getAnimeList(req, res, next) {
        try {
            // ID пользователя берется из access-токена (добавляется в authMiddleware).
            const userId = req.user.id;
            const animeList = await UserService.getAnimeList(userId);
            return res.json(animeList);
        } catch (e) {
            next(e);
        }
    }

    /**
     * Добавление/обновление статуса аниме в списке пользователя.
     */
    async updateAnimeStatus(req, res, next) {
        try {
            const { shikimori_id, status, animeData } = req.body;
            const userId = req.user.id;
            const updatedList = await UserService.updateAnimeStatus(userId, shikimori_id, status, animeData);
            return res.json(updatedList);
        } catch (e) {
            next(e);
        }
    }

    /**
     * Удаление аниме из списка пользователя.
     */
    async removeAnimeFromList(req, res, next) {
        try {
            const { shikimori_id } = req.params;
            const userId = req.user.id;
            const updatedList = await UserService.removeAnimeFromList(userId, shikimori_id);
            return res.json(updatedList);
        } catch (e) {
            next(e);
        }
    }
}

// Экспортируем экземпляр класса, чтобы использовать его в роутах.
module.exports = new UserController();

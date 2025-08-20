// backend/controllers/user.controller.js
const UserService = require('../services/user.service');
const { validationResult } = require('express-validator');
const ApiError = require('../exceptions/api.error');
const UserDto = require('../dtos/user.dto');
const TokenService = require('../services/token.service');

/**
 * Контроллер для управления пользователями / профилями
 * - делает basic-check входных данных
 * - возвращает удобный DTO для фронтенда
 * - аккуратно логирует ошибки, не раскрывая лишнего
 */
class UserController {
    // Регистрация
    async register(req, res, next) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return next(ApiError.BadRequest('Ошибка при валидации', errors.array()));
            }

            const { email, password } = req.body;
            if (!email || !password) {
                return next(ApiError.BadRequest('Email и пароль обязательны'));
            }

            const userData = await UserService.register(email, password);

            // Сохраняем refreshToken в httpOnly cookie
            res.cookie('refreshToken', userData.refreshToken, {
                maxAge: 30 * 24 * 60 * 60 * 1000,
                httpOnly: true,
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
                secure: process.env.NODE_ENV === 'production'
            });

            return res.json(userData);
        } catch (e) {
            console.error('Register error:', e?.message || e);
            next(e);
        }
    }

    // Вход
    async login(req, res, next) {
        try {
            const { email, password } = req.body;
            if (!email || !password) {
                return next(ApiError.BadRequest('Email и пароль обязательны'));
            }

            const userData = await UserService.login(email, password);

            res.cookie('refreshToken', userData.refreshToken, {
                maxAge: 30 * 24 * 60 * 60 * 1000,
                httpOnly: true,
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
                secure: process.env.NODE_ENV === 'production'
            });

            return res.json(userData);
        } catch (e) {
            console.error('Login error:', e?.message || e);
            next(e);
        }
    }

    // Выход
    async logout(req, res, next) {
        try {
            const { refreshToken } = req.cookies;
            await UserService.logout(refreshToken);
            res.clearCookie('refreshToken', {
                httpOnly: true,
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
                secure: process.env.NODE_ENV === 'production'
            });
            return res.json({ ok: true });
        } catch (e) {
            console.error('Logout error:', e?.message || e);
            next(e);
        }
    }

    // Обновление access token (refresh)
    async refresh(req, res, next) {
        try {
            const { refreshToken } = req.cookies;
            const userData = await UserService.refresh(refreshToken);

            res.cookie('refreshToken', userData.refreshToken, {
                maxAge: 30 * 24 * 60 * 60 * 1000,
                httpOnly: true,
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
                secure: process.env.NODE_ENV === 'production'
            });

            return res.json(userData);
        } catch (e) {
            // Часто здесь просто отсутствует валидный refreshToken — логируем аккуратно
            console.info('Refresh error:', e?.message || e);
            next(e);
        }
    }

    // Публичный профиль пользователя (по id)
    async getUserProfile(req, res, next) {
        try {
            const userId = req.params.id;
            if (!userId) return next(ApiError.BadRequest('Не указан id пользователя'));

            const user = await UserService.getUserById(userId);
            if (!user) return next(ApiError.BadRequest('Профиль не найден'));

            const dto = new UserDto(user);

            // friends: краткая инфа (если сохранено в user.friends)
            dto.friends = (user.friends || []).map(f => ({
                _id: f._id,
                nickname: f.nickname,
                avatar_url: f.avatar_url || null,
                email: f.email || null,
                sticker: f.sticker || null
            }));

            // Определим, является ли текущий пользователь другом (если есть access token)
            let isFriend = false;
            let requestPending = false;
            try {
                const authHeader = req.headers.authorization;
                if (authHeader && typeof authHeader === 'string') {
                    const token = authHeader.split(' ')[1];
                    const userData = TokenService.validateAccessToken(token);
                    if (userData && user.friends && user.friends.length) {
                        isFriend = !!user.friends.find(f => String(f._id) === String(userData.id));
                    }
                }
            } catch (e) {
                // игнорируем ошибки декодирования токена
                console.debug('Token decode failed in getUserProfile:', e?.message || e);
            }

            return res.json({ ...dto, isFriend, requestPending });
        } catch (e) {
            console.error('getUserProfile error:', e?.message || e);
            next(e);
        }
    }

    // Обновление профиля текущего пользователя
    async updateProfile(req, res, next) {
        try {
            const userId = req.user?.id;
            if (!userId) return next(ApiError.UnauthorizedError());

            // Ограничиваем набор полей, которые можно обновлять (безопасность)
            const allowed = ['nickname', 'bio', 'social', 'sticker', 'theme', 'displayName'];
            const updates = {};
            for (const key of allowed) {
                if (req.body[key] !== undefined) updates[key] = req.body[key];
            }

            const updatedUser = await UserService.updateProfile(userId, updates);
            if (!updatedUser) return next(ApiError.BadRequest('Не удалось обновить профиль'));

            const dto = new UserDto(updatedUser);
            return res.json(dto);
        } catch (e) {
            console.error('updateProfile error:', e?.message || e);
            next(e);
        }
    }

    // Загрузка аватара (multer кладёт файл в req.file)
    async uploadAvatar(req, res, next) {
        try {
            if (!req.user || !req.user.id) return next(ApiError.UnauthorizedError());
            if (!req.file) return next(ApiError.BadRequest('Файл не получен'));

            // Формируем путь для доступа: предполагаем, что /uploads/* обслуживается статически
            const filename = req.file.filename || req.file?.originalname;
            const filePath = `/uploads/${filename}`;

            const updatedUser = await UserService.setAvatar(req.user.id, filePath);
            if (!updatedUser) return next(ApiError.BadRequest('Не удалось сохранить аватар'));

            return res.json({ avatar_url: filePath, user: new UserDto(updatedUser) });
        } catch (e) {
            console.error('uploadAvatar error:', e?.message || e);
            next(e);
        }
    }

    // Загрузка обложки/фона профиля
    async uploadCover(req, res, next) {
        try {
            if (!req.user || !req.user.id) return next(ApiError.UnauthorizedError());
            if (!req.file) return next(ApiError.BadRequest('Файл не получен'));

            const filename = req.file.filename || req.file?.originalname;
            const filePath = `/uploads/${filename}`;

            const updatedUser = await UserService.setCover(req.user.id, filePath);
            if (!updatedUser) return next(ApiError.BadRequest('Не удалось сохранить обложку'));

            return res.json({ cover_url: filePath, user: new UserDto(updatedUser) });
        } catch (e) {
            console.error('uploadCover error:', e?.message || e);
            next(e);
        }
    }

    // Отправить заявку в друзья (упрощённая реализация)
    async requestFriend(req, res, next) {
        try {
            const fromUserId = req.user?.id;
            const toUserId = req.params.id;
            if (!fromUserId) return next(ApiError.UnauthorizedError());
            if (!toUserId) return next(ApiError.BadRequest('Не указан id получателя'));

            await UserService.sendFriendRequest(fromUserId, toUserId);
            return res.json({ ok: true });
        } catch (e) {
            console.error('requestFriend error:', e?.message || e);
            next(e);
        }
    }

    // Принять заявку в друзья
    async acceptFriend(req, res, next) {
        try {
            const userId = req.user?.id;
            const fromUserId = req.params.id;
            if (!userId) return next(ApiError.UnauthorizedError());
            if (!fromUserId) return next(ApiError.BadRequest('Не указан id отправителя'));

            await UserService.acceptFriend(userId, fromUserId);
            return res.json({ ok: true });
        } catch (e) {
            console.error('acceptFriend error:', e?.message || e);
            next(e);
        }
    }

    // Удалить друга
    async removeFriend(req, res, next) {
        try {
            const userId = req.user?.id;
            const friendId = req.params.id;
            if (!userId) return next(ApiError.UnauthorizedError());
            if (!friendId) return next(ApiError.BadRequest('Не указан id друга'));

            await UserService.removeFriend(userId, friendId);
            return res.json({ ok: true });
        } catch (e) {
            console.error('removeFriend error:', e?.message || e);
            next(e);
        }
    }

    // Статистика (публичная)
    async getStats(req, res, next) {
        try {
            const userId = req.params.id;
            if (!userId) return next(ApiError.BadRequest('Не указан id пользователя'));
            const data = await UserService.getStats(userId);
            return res.json(data || {});
        } catch (e) {
            console.error('getStats error:', e?.message || e);
            next(e);
        }
    }

    // Недавно просмотренное (публичная)
    async getRecent(req, res, next) {
        try {
            const userId = req.params.id;
            if (!userId) return next(ApiError.BadRequest('Не указан id пользователя'));
            const data = await UserService.getRecent(userId);
            return res.json(data || []);
        } catch (e) {
            console.error('getRecent error:', e?.message || e);
            next(e);
        }
    }

    // Динамика просмотра (публичная)
    async getDynamics(req, res, next) {
        try {
            const userId = req.params.id;
            if (!userId) return next(ApiError.BadRequest('Не указан id пользователя'));
            const days = parseInt(req.query.days, 10) || 14;
            const data = await UserService.getDynamics(userId, days);
            return res.json(data || []);
        } catch (e) {
            console.error('getDynamics error:', e?.message || e);
            next(e);
        }
    }

    // Получить список пользователя (защищённый)
    async getAnimeList(req, res, next) {
        try {
            const userId = req.user?.id;
            if (!userId) return next(ApiError.UnauthorizedError());
            const animeList = await UserService.getAnimeList(userId);
            return res.json(animeList || []);
        } catch (e) {
            console.error('getAnimeList error:', e?.message || e);
            next(e);
        }
    }

    // Добавить/обновить статус аниме в списке (защищённый)
    async updateAnimeStatus(req, res, next) {
        try {
            const userId = req.user?.id;
            if (!userId) return next(ApiError.UnauthorizedError());

            const { shikimori_id, mal_id, status, animeData } = req.body;
            const idToUse = shikimori_id || mal_id || (animeData && (animeData.mal_id || animeData.shikimori_id));
            if (!idToUse || !status) return next(ApiError.BadRequest('Неверные данные'));

            const updatedList = await UserService.updateAnimeStatus(userId, String(idToUse), status, animeData || {});
            return res.json(updatedList || []);
        } catch (e) {
            console.error('updateAnimeStatus error:', e?.message || e);
            next(e);
        }
    }

    // Удалить аниме из списка (защищённый)
    async removeAnimeFromList(req, res, next) {
        try {
            const userId = req.user?.id;
            if (!userId) return next(ApiError.UnauthorizedError());

            // Поддержка параметра маршрута как mal_id или shikimori_id
            const malId = req.params.mal_id || req.params.shikimori_id || req.params.id;
            if (!malId) return next(ApiError.BadRequest('Не указан id аниме'));

            const updatedList = await UserService.removeAnimeFromList(userId, String(malId));
            return res.json(updatedList || []);
        } catch (e) {
            console.error('removeAnimeFromList error:', e?.message || e);
            next(e);
        }
    }
}

module.exports = new UserController();

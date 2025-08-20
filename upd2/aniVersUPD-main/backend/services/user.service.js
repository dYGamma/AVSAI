// backend/services/user.service.js
const UserModel = require('../models/user.model');
const bcrypt = require('bcryptjs');
const TokenService = require('./token.service');
const UserDto = require('../dtos/user.dto');
const ApiError = require('../exceptions/api.error');
const mongoose = require('mongoose');

/**
 * UserService — отвечаем за регистрацию / аутентификацию и операции над профилями
 * В этой доработке:
 *  - защищаемся от ошибок уникальных индексов (E11000) и возвращаем понятную ошибку
 *  - избегаем записи userId: null (схема должна хранить userId только когда он есть)
 *  - более аккуратно работаем с токенами (логируем ошибки сохранения)
 *  - убран расчёт stat.on_hold (если в схеме не используется)
 */
class UserService {
    /**
     * Регистрация нового пользователя
     * @param {string} email
     * @param {string} password
     * @returns {Promise<{accessToken: string, refreshToken: string, user: UserDto}>}
     */
    async register(email, password) {
        const normalizedEmail = String(email).trim().toLowerCase();

        // Быстрая проверка на существующего пользователя по email (race condition всё равно возможна)
        const candidate = await UserModel.findOne({ email: normalizedEmail });
        if (candidate) {
            throw ApiError.BadRequest(`Пользователь с почтовым адресом ${normalizedEmail} уже существует`);
        }

        try {
            const saltRounds = 10;
            const hashPassword = await bcrypt.hash(password, saltRounds);

            // Не записываем userId вообще — оставляем undefined, чтобы sparse/partial индексы не индексировали null
            const doc = {
                email: normalizedEmail,
                password: hashPassword,
                anime_list: []
                // Не устанавливаем userId: null
            };

            const user = await UserModel.create(doc);

            // DTO — минимальный набор полей для токенов/фронта
            const userDto = new UserDto(user);
            const tokens = TokenService.generateTokens({ ...userDto });

            // Попытка сохранить refresh token; логируем, но если сохранение упало — откатим регистрацию (опционально)
            try {
                await TokenService.saveToken(userDto.id, tokens.refreshToken);
            } catch (tokenErr) {
                // логируем, удаляем созданного пользователя (чтобы не оставлять "мёртвую" учётку без токенов)
                console.error('Failed to save refresh token after registration, removing created user. tokenErr:', tokenErr);
                try {
                    await UserModel.findByIdAndDelete(user._id);
                } catch (cleanupErr) {
                    console.error('Failed to cleanup user after token save failure:', cleanupErr);
                }
                throw ApiError.BadRequest('Не удалось завершить регистрацию (проблема с сохранением сессии). Попробуйте позже.');
            }

            return { ...tokens, user: userDto };
        } catch (err) {
            // Логируем полную ошибку для дебага
            console.error('UserService.register error:', err);

            // Если это дубликат уникального индекса — распознаём поле и вернём понятную ошибку
            if (err && err.code === 11000) {
                // err.keyValue чаще содержит поле/значение; fallback на keyPattern
                const dupField = err.keyValue ? Object.keys(err.keyValue)[0] : (err.keyPattern ? Object.keys(err.keyPattern)[0] : null);
                if (dupField) {
                    if (dupField === 'email') {
                        throw ApiError.BadRequest('Пользователь с таким email уже существует');
                    }
                    if (dupField === 'userId') {
                        throw ApiError.BadRequest('Пользователь с таким внешним userId уже зарегистрирован');
                    }
                    throw ApiError.BadRequest(`Значение поля "${dupField}" уже используется`);
                }
                // универсальная ошибка дубликата
                throw ApiError.BadRequest('Нарушение уникального ограничения при регистрации (дубликат).');
            }

            // Если это validation error от mongoose — вернём содержимое
            if (err && err.name === 'ValidationError') {
                const messages = Object.values(err.errors || {}).map(e => e.message);
                throw ApiError.BadRequest(messages.join('; ') || 'Ошибка валидации при регистрации');
            }

            throw ApiError.BadRequest('Ошибка регистрации пользователя');
        }
    }

    /**
     * Вход пользователя
     * @param {string} email
     * @param {string} password
     */
    async login(email, password) {
        const normalizedEmail = String(email).trim().toLowerCase();
        console.log(`Login attempt for: ${normalizedEmail}`);

        const user = await UserModel.findOne({ email: normalizedEmail });
        if (!user) {
            console.warn(`Login failed: user not found (${normalizedEmail})`);
            throw ApiError.BadRequest('Неверный логин или пароль');
        }

        try {
            const isPassEquals = await bcrypt.compare(password, user.password);
            if (!isPassEquals) {
                console.warn(`Login failed: incorrect password for ${normalizedEmail}`);
                throw ApiError.BadRequest('Неверный логин или пароль');
            }

            const userDto = new UserDto(user);
            const tokens = TokenService.generateTokens({ ...userDto });

            try {
                await TokenService.saveToken(userDto.id, tokens.refreshToken);
            } catch (saveErr) {
                console.error('Failed to save refresh token on login:', saveErr);
                // Мы считаем это критичной проблемой — сообщаем пользователю
                throw ApiError.BadRequest('Не удалось сохранить сессию. Попробуйте снова.');
            }

            return { ...tokens, user: userDto };
        } catch (err) {
            console.error('UserService.login error (compare/hash):', err);
            throw ApiError.BadRequest('Неверный логин или пароль');
        }
    }

    /**
     * Удаление refresh токена (logout)
     */
    async logout(refreshToken) {
        const token = await TokenService.removeToken(refreshToken);
        return token;
    }

    /**
     * Обновление access/refresh токенов
     */
    async refresh(refreshToken) {
        if (!refreshToken) {
            throw ApiError.UnauthorizedError();
        }
        const userData = TokenService.validateRefreshToken(refreshToken);
        const tokenFromDb = await TokenService.findToken(refreshToken);
        if (!userData || !tokenFromDb) {
            throw ApiError.UnauthorizedError();
        }
        const user = await UserModel.findById(userData.id);
        if (!user) throw ApiError.UnauthorizedError();

        const userDto = new UserDto(user);
        const tokens = TokenService.generateTokens({ ...userDto });
        await TokenService.saveToken(userDto.id, tokens.refreshToken);

        return { ...tokens, user: userDto };
    }

    /**
     * Список аниме пользователя
     */
    async getAnimeList(userId) {
        const user = await UserModel.findById(userId);
        if (!user) throw ApiError.BadRequest('Пользователь не найден');
        return user.anime_list || [];
    }

    /**
     * Добавление / обновление аниме в списке пользователя
     * animeData — объект с полями title, poster_url, episodes_total, и др.
     */
    async updateAnimeStatus(userId, shikimori_id, status, animeData = {}) {
        const user = await UserModel.findById(userId);
        if (!user) throw ApiError.BadRequest('Пользователь не найден');

        const key = String(shikimori_id);
        const animeIndex = user.anime_list.findIndex(item => String(item.shikimori_id) === key);

        if (animeIndex > -1) {
            // Обновляем статус и, возможно, другую информацию
            user.anime_list[animeIndex].status = status;
            if (animeData.title !== undefined) user.anime_list[animeIndex].title = animeData.title;
            if (animeData.poster_url !== undefined) user.anime_list[animeIndex].poster_url = animeData.poster_url;
            if (animeData.episodes_total !== undefined) user.anime_list[animeIndex].episodes_total = animeData.episodes_total;
        } else {
            // Добавляем новый
            user.anime_list.push({
                shikimori_id: key,
                title: animeData.title || '',
                poster_url: animeData.poster_url || '',
                episodes_total: animeData.episodes_total || 0,
                status: status
            });
        }

        await user.save();
        return user.anime_list;
    }

    /**
     * Удаление аниме из списка
     */
    async removeAnimeFromList(userId, shikimori_id) {
        const user = await UserModel.findById(userId);
        if (!user) throw ApiError.BadRequest('Пользователь не найден');

        const key = String(shikimori_id);
        user.anime_list = user.anime_list.filter(item => String(item.shikimori_id) !== key);
        await user.save();
        return user.anime_list;
    }

    /**
     * Получение публичного профиля пользователя по id (populate friends)
     */
    async getUserById(id) {
        if (!id) throw ApiError.BadRequest('Не указан id пользователя');
        if (!mongoose.Types.ObjectId.isValid(id)) throw ApiError.BadRequest('Неверный id пользователя');

        // Если друзья хранятся как ObjectId, популяция даёт краткую информацию
        const user = await UserModel.findById(id).populate('friends', 'nickname avatar_url email sticker').lean();
        if (!user) throw ApiError.BadRequest('Пользователь не найден');
        return user;
    }

    /**
     * Обновление профиля (nickname, bio, social_links, sticker, avatar_url, cover_url и т.д.)
     * Публичные поля, которые можно обновлять, перечислены в контроллере.
     */
    async updateProfile(userId, updates) {
        const user = await UserModel.findById(userId);
        if (!user) throw ApiError.BadRequest('Пользователь не найден');

        // Поля, которые разрешаем обновлять
        const allowed = ['nickname', 'bio', 'avatar_url', 'cover_url', 'social_links', 'sticker', 'theme', 'displayName'];
        let changed = false;
        for (const key of allowed) {
            if (updates[key] !== undefined) {
                user[key] = updates[key];
                changed = true;
            }
        }

        if (changed) {
            await user.save();
        }
        return user;
    }

    /**
     * Установить аватар пользователя (путь к файлу)
     */
    async setAvatar(userId, avatarUrl) {
        const user = await UserModel.findById(userId);
        if (!user) throw ApiError.BadRequest('Пользователь не найден');
        user.avatar_url = avatarUrl;
        await user.save();
        return user;
    }

    /**
     * Установить обложку / фон пользователя (путь к файлу)
     */
    async setCover(userId, coverUrl) {
        const user = await UserModel.findById(userId);
        if (!user) throw ApiError.BadRequest('Пользователь не найден');
        user.cover_url = coverUrl;
        await user.save();
        return user;
    }

    /**
     * Отправка заявки в друзья (упрощённо)
     */
    async sendFriendRequest(fromUserId, toUserId) {
        if (!mongoose.Types.ObjectId.isValid(fromUserId) || !mongoose.Types.ObjectId.isValid(toUserId)) {
            throw ApiError.BadRequest('Неверный id пользователя');
        }

        const fromUser = await UserModel.findById(fromUserId);
        const toUser = await UserModel.findById(toUserId);
        if (!fromUser || !toUser) throw ApiError.BadRequest('Пользователь не найден');

        const alreadyFriend = (toUser.friends || []).some(f => String(f) === String(fromUserId));
        if (alreadyFriend) return toUser;

        if (Array.isArray(toUser.friend_requests)) {
            const alreadyRequested = toUser.friend_requests.some(r => String(r) === String(fromUserId));
            if (!alreadyRequested) {
                toUser.friend_requests.push(fromUserId);
                await toUser.save();
            }
        } else {
            toUser.friends = toUser.friends || [];
            if (!toUser.friends.some(f => String(f) === String(fromUserId))) {
                toUser.friends.push(fromUserId);
                await toUser.save();
            }
        }

        return toUser;
    }

    /**
     * Принять заявку в друзья
     */
    async acceptFriend(userId, fromUserId) {
        if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(fromUserId)) {
            throw ApiError.BadRequest('Неверный id пользователя');
        }

        const user = await UserModel.findById(userId);
        const fromUser = await UserModel.findById(fromUserId);
        if (!user || !fromUser) throw ApiError.BadRequest('Пользователь не найден');

        user.friends = user.friends || [];
        fromUser.friends = fromUser.friends || [];

        if (!user.friends.some(f => String(f) === String(fromUserId))) user.friends.push(fromUserId);
        if (!fromUser.friends.some(f => String(f) === String(userId))) fromUser.friends.push(userId);

        if (Array.isArray(user.friend_requests)) {
            user.friend_requests = user.friend_requests.filter(r => String(r) !== String(fromUserId));
        }

        await user.save();
        await fromUser.save();
        return user;
    }

    /**
     * Удалить друга
     */
    async removeFriend(userId, friendId) {
        if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(friendId)) {
            throw ApiError.BadRequest('Неверный id пользователя');
        }

        const user = await UserModel.findById(userId);
        if (!user) throw ApiError.BadRequest('Пользователь не найден');

        user.friends = (user.friends || []).filter(f => String(f) !== String(friendId));
        await user.save();
        return user;
    }

    /**
     * Статистика по списку пользователя
     */
    async getStats(userId) {
        const user = await UserModel.findById(userId);
        if (!user) throw ApiError.BadRequest('Пользователь не найден');

        const list = user.anime_list || [];
        // Берём только те статусы, которые перечислены в схеме
        const stats = {
            total: list.length,
            watching: list.filter(a => a.status === 'watching').length,
            planned: list.filter(a => a.status === 'planned').length,
            completed: list.filter(a => a.status === 'completed').length,
            dropped: list.filter(a => a.status === 'dropped').length
        };
        return stats;
    }

    /**
     * Недавно просмотренное
     */
    async getRecent(userId, limit = 10) {
        const user = await UserModel.findById(userId).lean();
        if (!user) throw ApiError.BadRequest('Пользователь не найден');

        if (Array.isArray(user.watch_history) && user.watch_history.length > 0) {
            const sorted = user.watch_history
                .slice()
                .sort((a, b) => new Date(b.at) - new Date(a.at));
            return sorted.slice(0, limit);
        }

        if (Array.isArray(user.recent) && user.recent.length > 0) {
            return user.recent.slice(0, limit);
        }

        const candidates = (user.anime_list || [])
            .filter(a => a.last_watched_at)
            .map(a => ({ shikimori_id: a.shikimori_id, title: a.title, last_watched_at: a.last_watched_at }))
            .sort((a, b) => new Date(b.last_watched_at) - new Date(a.last_watched_at))
            .slice(0, limit);

        return candidates;
    }

    /**
     * Динамика просмотров за последние N дней
     */
    async getDynamics(userId, days = 14) {
        const user = await UserModel.findById(userId).lean();
        if (!user) throw ApiError.BadRequest('Пользователь не найден');

        if (!Array.isArray(user.watch_history) || user.watch_history.length === 0) {
            const result = [];
            const now = new Date();
            for (let i = days - 1; i >= 0; i--) {
                const d = new Date(now);
                d.setDate(now.getDate() - i);
                result.push({ date: d.toISOString().slice(0, 10), count: 0 });
            }
            return result;
        }

        const map = new Map();
        const now = new Date();
        for (let i = 0; i < days; i++) {
            const d = new Date();
            d.setDate(now.getDate() - i);
            const key = d.toISOString().slice(0, 10);
            map.set(key, 0);
        }

        for (const ev of user.watch_history) {
            if (!ev || !ev.at) continue;
            const dateKey = new Date(ev.at).toISOString().slice(0, 10);
            if (map.has(dateKey)) {
                map.set(dateKey, map.get(dateKey) + 1);
            }
        }

        const keys = Array.from(map.keys()).sort();
        const result = keys.map(k => ({ date: k, count: map.get(k) || 0 }));
        return result;
    }
}

module.exports = new UserService();

// backend/services/user.service.js
const UserModel = require('../models/user.model');
// Переключаемся на bcryptjs — не требует нативной сборки
const bcrypt = require('bcryptjs');
const TokenService = require('./token.service');
const UserDto = require('../dtos/user.dto');
const ApiError = require('../exceptions/api.error');

class UserService {
    async register(email, password) {
        const normalizedEmail = String(email).trim().toLowerCase();

        const candidate = await UserModel.findOne({ email: normalizedEmail });
        if (candidate) {
            throw ApiError.BadRequest(`Пользователь с почтовым адресом ${normalizedEmail} уже существует`);
        }

        try {
            const saltRounds = 10; // безопасный default
            const hashPassword = await bcrypt.hash(password, saltRounds);

            const user = await UserModel.create({
                email: normalizedEmail,
                password: hashPassword,
                anime_list: []
            });

            const userDto = new UserDto(user);
            const tokens = TokenService.generateTokens({ ...userDto });
            await TokenService.saveToken(userDto.id, tokens.refreshToken);

            return { ...tokens, user: userDto };
        } catch (err) {
            console.error('UserService.register error:', err);
            throw ApiError.BadRequest('Ошибка регистрации пользователя');
        }
    }

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
            await TokenService.saveToken(userDto.id, tokens.refreshToken);

            return { ...tokens, user: userDto };
        } catch (err) {
            // если bcrypt.compare выбросил что-то — логируем и возвращаем дружелюбную ошибку
            console.error('UserService.login error (compare/hash):', err);
            throw ApiError.BadRequest('Неверный логин или пароль');
        }
    }

    async logout(refreshToken) {
        const token = await TokenService.removeToken(refreshToken);
        return token;
    }

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
        const userDto = new UserDto(user);
        const tokens = TokenService.generateTokens({ ...userDto });
        await TokenService.saveToken(userDto.id, tokens.refreshToken);

        return { ...tokens, user: userDto };
    }

    // Методы для списков
    async getAnimeList(userId) {
        const user = await UserModel.findById(userId);
        return user?.anime_list || [];
    }

    async updateAnimeStatus(userId, shikimori_id, status, animeData) {
        const user = await UserModel.findById(userId);
        if (!user) throw ApiError.BadRequest('Пользователь не найден');

        const animeIndex = user.anime_list.findIndex(item => item.shikimori_id === shikimori_id);

        if (animeIndex > -1) {
            user.anime_list[animeIndex].status = status;
        } else {
            user.anime_list.push({ ...animeData, shikimori_id, status });
        }
        await user.save();
        return user.anime_list;
    }

    async removeAnimeFromList(userId, shikimori_id) {
        const user = await UserModel.findById(userId);
        if (!user) throw ApiError.BadRequest('Пользователь не найден');

        user.anime_list = user.anime_list.filter(item => item.shikimori_id !== shikimori_id);
        await user.save();
        return user.anime_list;
    }

    // Публичный профиль
    async getUserById(id) {
        const user = await UserModel.findById(id).populate('friends', 'nickname avatar_url email sticker');
        if (!user) throw ApiError.BadRequest('Пользователь не найден');
        return user;
    }

    async updateProfile(userId, updates) {
        const user = await UserModel.findById(userId);
        if (!user) throw ApiError.BadRequest('Пользователь не найден');

        if (updates.nickname !== undefined) user.nickname = updates.nickname;
        if (updates.bio !== undefined) user.bio = updates.bio;
        if (updates.avatar_url !== undefined) user.avatar_url = updates.avatar_url;
        if (updates.cover_url !== undefined) user.cover_url = updates.cover_url;
        if (updates.social_links !== undefined) user.social_links = updates.social_links;
        if (updates.sticker !== undefined) user.sticker = updates.sticker;

        await user.save();
        return user;
    }

    async setAvatar(userId, avatarUrl) {
        const user = await UserModel.findById(userId);
        if (!user) throw ApiError.BadRequest('Пользователь не найден');
        user.avatar_url = avatarUrl;
        await user.save();
        return user;
    }

    async setCover(userId, coverUrl) {
        const user = await UserModel.findById(userId);
        if (!user) throw ApiError.BadRequest('Пользователь не найден');
        user.cover_url = coverUrl;
        await user.save();
        return user;
    }

    // Друзья (простая логика)
    async sendFriendRequest(fromUserId, toUserId) {
        const fromUser = await UserModel.findById(fromUserId);
        const toUser = await UserModel.findById(toUserId);
        if (!fromUser || !toUser) throw ApiError.BadRequest('Пользователь не найден');

        if (toUser.friends.includes(fromUserId)) return toUser;

        toUser.friends.push(fromUserId);
        await toUser.save();
        return toUser;
    }

    async acceptFriend(userId, fromUserId) {
        const user = await UserModel.findById(userId);
        const fromUser = await UserModel.findById(fromUserId);
        if (!user || !fromUser) throw ApiError.BadRequest('Пользователь не найден');

        if (!user.friends.includes(fromUserId)) user.friends.push(fromUserId);
        if (!fromUser.friends.includes(userId)) fromUser.friends.push(userId);

        await user.save();
        await fromUser.save();
        return user;
    }

    async removeFriend(userId, friendId) {
        const user = await UserModel.findById(userId);
        if (!user) throw ApiError.BadRequest('Пользователь не найден');

        user.friends = user.friends.filter(f => f.toString() !== friendId.toString());
        await user.save();
        return user;
    }

    async getStats(userId) {
        const user = await UserModel.findById(userId);
        if (!user) throw ApiError.BadRequest('Пользователь не найден');

        const stats = {
            total: user.anime_list.length,
            watching: user.anime_list.filter(a => a.status === 'watching').length,
            planned: user.anime_list.filter(a => a.status === 'planned').length,
            completed: user.anime_list.filter(a => a.status === 'completed').length,
            dropped: user.anime_list.filter(a => a.status === 'dropped').length,
            on_hold: user.anime_list.filter(a => a.status === 'on_hold').length,
        };
        return stats;
    }

    // Заглушки — можно расширить
    async getRecent(userId) {
        return [];
    }

    async getDynamics(userId, days = 14) {
        return [];
    }
}

module.exports = new UserService();

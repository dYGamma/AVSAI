const UserModel = require('../models/user.model');
const bcrypt = require('bcrypt');
const TokenService = require('./token.service');
const UserDto = require('../dtos/user.dto');
const ApiError = require('../exceptions/api.error');

class UserService {
    async register(email, password) {
        const candidate = await UserModel.findOne({ email });
        if (candidate) {
            throw ApiError.BadRequest(`Пользователь с почтовым адресом ${email} уже существует`);
        }
        const hashPassword = await bcrypt.hash(password, 3);
        const user = await UserModel.create({ email, password: hashPassword, anime_list: [] });

        const userDto = new UserDto(user);
        const tokens = TokenService.generateTokens({ ...userDto });
        await TokenService.saveToken(userDto.id, tokens.refreshToken);

        return { ...tokens, user: userDto };
    }

    async login(email, password) {
        const user = await UserModel.findOne({ email });
        if (!user) {
            throw ApiError.BadRequest('Пользователь с таким email не найден');
        }
        const isPassEquals = await bcrypt.compare(password, user.password);
        if (!isPassEquals) {
            throw ApiError.BadRequest('Неверный пароль');
        }
        const userDto = new UserDto(user);
        const tokens = TokenService.generateTokens({ ...userDto });
        await TokenService.saveToken(userDto.id, tokens.refreshToken);

        return { ...tokens, user: userDto };
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
    
    // Методы для работы со списками
    async getAnimeList(userId) {
        const user = await UserModel.findById(userId);
        return user.anime_list;
    }

    async updateAnimeStatus(userId, shikimori_id, status, animeData) {
        const user = await UserModel.findById(userId);
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
        user.anime_list = user.anime_list.filter(item => item.shikimori_id !== shikimori_id);
        await user.save();
        return user.anime_list;
    }
}

module.exports = new UserService();

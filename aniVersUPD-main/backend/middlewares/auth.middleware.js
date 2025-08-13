const TokenService = require('../services/token.service');

module.exports = function (req, res, next) {
    try {
        const authorizationHeader = req.headers.authorization;
        if (!authorizationHeader) {
            return next(new Error('Пользователь не авторизован'));
        }

        const accessToken = authorizationHeader.split(' ')[1];
        if (!accessToken) {
            return next(new Error('Пользователь не авторизован'));
        }

        const userData = TokenService.validateAccessToken(accessToken);
        if (!userData) {
            return next(new Error('Пользователь не авторизован'));
        }

        req.user = userData;
        next();
    } catch (e) {
        return next(new Error('Пользователь не авторизован'));
    }
};

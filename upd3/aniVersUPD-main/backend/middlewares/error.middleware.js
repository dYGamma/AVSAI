const ApiError = require('../exceptions/api.error');

// Middleware, который отлавливает все ошибки в приложении.
module.exports = function (err, req, res, next) {
    console.error(err);
    if (err instanceof ApiError) {
        return res.status(err.status).json({ message: err.message, errors: err.errors });
    }
    return res.status(500).json({ message: 'Непредвиденная ошибка сервера' });
};

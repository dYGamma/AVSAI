const Router = require('express').Router;
const router = new Router();
const { body } = require('express-validator');

const ApiController = require('../controllers/api.controller');
const UserController = require('../controllers/user.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// --- Маршруты для каталога (Jikan API) ---
router.get('/anime', ApiController.getAnimeList); 
router.get('/anime/:id', ApiController.getAnimeDetails);

// --- НОВЫЙ МАРШРУТ для получения плеера (Kodik API) ---
router.get('/player/:shikimori_id', ApiController.getPlayerLink);

// --- Маршруты для Аутентификации (без изменений) ---
router.post('/register', body('email').isEmail(), body('password').isLength({ min: 3, max: 32 }), UserController.register);
router.post('/login', UserController.login);
router.post('/logout', UserController.logout);
router.get('/refresh', UserController.refresh);

// --- Маршруты для списков пользователя (без изменений) ---
router.get('/list', authMiddleware, UserController.getAnimeList);
router.post('/list', authMiddleware, UserController.updateAnimeStatus);
router.delete('/list/:mal_id', authMiddleware, UserController.removeAnimeFromList);

module.exports = router;

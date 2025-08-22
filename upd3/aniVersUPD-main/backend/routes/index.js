const Router = require('express').Router;
const router = new Router();
const { body } = require('express-validator');
const path = require('path');
const multer = require('multer');

const ApiController = require('../controllers/api.controller');
const UserController = require('../controllers/user.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// Настройка multer (сохраняем в backend/uploads)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '..', 'uploads'));
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname);
        const name = `${Date.now()}-${Math.random().toString(36).substring(2,8)}${ext}`;
        cb(null, name);
    }
});
const upload = multer({ storage });

// --- Маршруты для каталога (Jikan API) ---
router.get('/anime', ApiController.getAnimeList); 
router.get('/anime/:id', ApiController.getAnimeDetails);

// --- Плеер (Kodik) ---
router.get('/player/:shikimori_id', ApiController.getPlayerLink);

// --- Аутентификация ---
router.post('/register', body('email').isEmail(), body('password').isLength({ min: 3, max: 32 }), UserController.register);
router.post('/login', UserController.login);
router.post('/logout', UserController.logout);
router.get('/refresh', UserController.refresh);

// --- Списки пользователя ---
router.get('/list', authMiddleware, UserController.getAnimeList);
router.post('/list', authMiddleware, UserController.updateAnimeStatus);
router.delete('/list/:mal_id', authMiddleware, UserController.removeAnimeFromList);

// --- Профили и загрузки файлов ---
router.get('/users/:id', UserController.getUserProfile);
router.put('/users/me', authMiddleware, UserController.updateProfile);
router.post('/users/me/avatar', authMiddleware, upload.single('avatar'), UserController.uploadAvatar);
router.post('/users/me/cover', authMiddleware, upload.single('cover'), UserController.uploadCover);

// Друзья (простейшая реализация)
router.post('/users/:id/request-friend', authMiddleware, UserController.requestFriend);
router.post('/users/:id/accept-friend', authMiddleware, UserController.acceptFriend);
router.delete('/users/:id/friend', authMiddleware, UserController.removeFriend);

// Доп. конечные точки для профиля (статистика/недавно)
router.get('/users/:id/stats', UserController.getStats);
router.get('/users/:id/recent', UserController.getRecent);
router.get('/users/:id/dynamics', UserController.getDynamics);

module.exports = router;

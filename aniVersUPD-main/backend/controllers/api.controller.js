const axios = require('axios');
const ApiError = require('../exceptions/api.error');

const JIKAN_API_URL = 'https://api.jikan.moe/v4';
const KODIK_API_URL = 'https://kodikapi.com';
const KODIK_TOKEN = process.env.KODIK_API_TOKEN;

class ApiController {
    /**
     * Получает списки аниме (топы, поиск) из Jikan API.
     */
    async getAnimeList(req, res, next) {
        try {
            const { data } = await axios.get(`${JIKAN_API_URL}/anime`, {
                params: { ...req.query }
            });
            return res.json(data);
        } catch (e) {
            console.error('Ошибка при запросе к Jikan API (list):', e.message);
            next(new Error('Внешний сервис Jikan недоступен.'));
        }
    }

    /**
     * Получает детальную информацию об одном аниме из Jikan API.
     */
    async getAnimeDetails(req, res, next) {
        try {
            const { data } = await axios.get(`${JIKAN_API_URL}/anime/${req.params.id}/full`);
            return res.json(data.data);
        } catch (e) {
            console.error('Ошибка при запросе к Jikan API (details):', e.message);
            next(ApiError.BadRequest('Аниме с таким ID не найдено в базе Jikan.'));
        }
    }

    /**
     * Получает ссылку на плеер от Kodik API.
     * Это "мост" между двумя сервисами.
     */
    async getPlayerLink(req, res, next) {
        try {
            // Проверяем, настроен ли токен на сервере.
            if (!KODIK_TOKEN || KODIK_TOKEN === 'ВАШ_ТОКЕН_ОТ_KODIK_API') {
                throw ApiError.BadRequest('Просмотр недоступен: KODIK_API_TOKEN не настроен на сервере.');
            }

            const { data } = await axios.get(`${KODIK_API_URL}/search`, {
                params: {
                    token: KODIK_TOKEN,
                    shikimori_id: req.params.shikimori_id,
                    with_episodes: true, // Получаем информацию об эпизодах
                }
            });

            if (data.results && data.results.length > 0) {
                // Возвращаем только то, что нужно - ссылку на плеер и эпизоды
                const animeData = data.results[0];
                return res.json({
                    player_link: animeData.link,
                    episodes_total: animeData.episodes_total || animeData.episodes_count,
                });
            } else {
                return next(ApiError.BadRequest('Плеер для этого аниме не найден в базе Kodik.'));
            }
        } catch (e) {
            next(e);
        }
    }
}

module.exports = new ApiController();

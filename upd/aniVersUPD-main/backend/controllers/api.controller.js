// ./backend/controllers/api.controller.js

const axios = require('axios');
const ApiError = require('../exceptions/api.error');

const JIKAN_API_URL = 'https://api.jikan.moe/v4';
const KODIK_API_URL = 'https://kodikapi.com';
const KODIK_TOKEN = process.env.KODIK_API_TOKEN || '';

class ApiController {
    /**
     * GET /api/anime
     * Прокси-запрос к Jikan для получения списка/поиска аниме.
     * Параметры передаются напрямую из req.query (order_by, status, limit и т.д.)
     */
    async getAnimeList(req, res, next) {
        try {
            const { data } = await axios.get(`${JIKAN_API_URL}/anime`, {
                params: { ...req.query },
                timeout: 10000,
            });
            return res.json(data);
        } catch (e) {
            console.error('Ошибка при запросе к Jikan API (list):', e.message, e.response?.data || '');
            return next(ApiError.BadRequest('Внешний сервис Jikan недоступен или вернул ошибку.'));
        }
    }

    /**
     * GET /api/anime/:id
     * Возвращает подробную информацию об аниме (Jikan /anime/:id/full).
     */
    async getAnimeDetails(req, res, next) {
        try {
            const { data } = await axios.get(`${JIKAN_API_URL}/anime/${req.params.id}/full`, {
                timeout: 10000,
            });
            // Jikan возвращает объект { data: {...} }
            return res.json(data.data);
        } catch (e) {
            console.error('Ошибка при запросе к Jikan API (details):', e.message, e.response?.data || '');
            return next(ApiError.BadRequest('Аниме с таким ID не найдено во внешнем сервисе Jikan.'));
        }
    }

    /**
     * GET /api/player/:shikimori_id
     * Получает ссылку на плеер от Kodik API.
     *
     * Поддерживает:
     *  - /player/:shikimori_id
     *  - /player/:id   (если передали mal_id, попробуем извлечь shikimori_id из Jikan)
     *  - /player?shikimori_id=...
     */
    async getPlayerLink(req, res, next) {
        try {
            // Проверяем токен Kodik
            if (!KODIK_TOKEN || KODIK_TOKEN === 'ВАШ_ТОКЕН_ОТ_KODIK_API') {
                return next(ApiError.BadRequest('Просмотр недоступен: KODIK_API_TOKEN не настроен на сервере.'));
            }

            // Приоритеты: params.shikimori_id -> query.shikimori_id -> params.id (mal_id)
            let shikimoriId = req.params.shikimori_id || req.query.shikimori_id;

            // Если передали просто :id (mal_id), попробуем получить external ссылки из Jikan и извлечь shikimori id
            const possibleMalId = req.params.id || (req.params.shikimori_id && !/^\d+$/.test(req.params.shikimori_id) ? undefined : undefined);

            if (!shikimoriId && req.params.id) {
                // Попытка получить external links из Jikan и найти shikimori ссылку
                try {
                    const jikanRes = await axios.get(`${JIKAN_API_URL}/anime/${req.params.id}/full`, { timeout: 10000 });
                    const animeData = jikanRes.data?.data;
                    // В Jikan внешние ссылки могут быть в animeData?.external или animeData?.relations
                    const externals = animeData?.external || [];

                    // Ищем URL, содержащий shikimori
                    for (const ext of externals) {
                        if (!ext || !ext.url) continue;
                        const url = String(ext.url);
                        // Примеры: https://shikimori.org/animes/12345 или https://shikimori.one/animes/12345
                        const m = url.match(/shikimori\.[^/]+\/(?:animes|anime)\/(\d+)/i);
                        if (m && m[1]) {
                            shikimoriId = m[1];
                            break;
                        }
                        // Иногда ссылка может быть вида https://shikimori.org/redirect/anime/12345 или т.п.
                        const m2 = url.match(/shikimori\.[^/]+\/.*?(\d{3,})/i);
                        if (m2 && m2[1]) {
                            shikimoriId = m2[1];
                            break;
                        }
                    }

                    // Если не нашли в external, можно попробовать искать по именам (title), но это ненадёжно.
                    // Поэтому если shikimoriId всё ещё нет — мы вернём понятную ошибку ниже.
                } catch (jikanErr) {
                    console.warn('Не удалось достать данные из Jikan для извлечения shikimori_id:', jikanErr.message);
                    // не останавливаем выполнение — дадим понятную ошибку ниже, если shikimoriId не найден
                }
            }

            if (!shikimoriId) {
                return next(ApiError.BadRequest('Для получения плеера нужен shikimori_id. Передайте /api/player/:shikimori_id или ?shikimori_id=... (если у вас только mal_id, нужно сначала получить shikimori_id).'));
            }

            // Запрашиваем Kodik
            const axiosConfig = {
                params: {
                    token: KODIK_TOKEN,
                    shikimori_id: shikimoriId,
                    with_episodes: true,
                },
                timeout: 10000,
            };

            let kodikRes;
            try {
                kodikRes = await axios.get(`${KODIK_API_URL}/search`, axiosConfig);
            } catch (err) {
                console.error('Kodik request failed:', err.message, err.response?.data || '');
                // Если внешний сервис вернул body с сообщением — отдаём пользователю понятную ошибку
                if (err.response && err.response.data) {
                    const extMsg = err.response.data?.error || JSON.stringify(err.response.data);
                    return next(ApiError.BadRequest(`Kodik API error: ${extMsg}`));
                }
                return next(ApiError.BadRequest('Ошибка при запросе внешнего сервиса Kodik.'));
            }

            const data = kodikRes.data;
            if (data?.results && data.results.length > 0) {
                const animeData = data.results[0];
                // Возвращаем минимально необходимую информацию
                return res.json({
                    player_link: animeData.link,
                    episodes_total: animeData.episodes_total || animeData.episodes_count || 1,
                    title: animeData.title || null,
                    raw: animeData,
                });
            } else {
                return next(ApiError.BadRequest('Плеер для этого аниме не найден в базе Kodik.'));
            }
        } catch (e) {
            console.error('Неожиданная ошибка в getPlayerLink:', e);
            return next(ApiError.BadRequest('Ошибка при получение плеера.'));
        }
    }
}

module.exports = new ApiController();

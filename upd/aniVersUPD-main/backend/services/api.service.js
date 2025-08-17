// ./backend/services/api.service.js
const axios = require('axios');
const JIKAN_API_URL = 'https://api.jikan.moe/v4';

// Обертка для запросов к Jikan API с обработкой ошибок
const jikanApi = axios.create({
    baseURL: JIKAN_API_URL,
});

const handleApiRequest = async (req, res, endpoint) => {
    try {
        const response = await jikanApi.get(endpoint, { params: req.query });
        res.json(response.data);
    } catch (error) {
        console.error(`Error fetching from Jikan API: ${endpoint}`, error.message);
        res.status(error.response?.status || 500).json({ message: 'Error fetching data from external API' });
    }
};

class ApiService {
    async searchAnime(req, res) {
        await handleApiRequest(req, res, '/anime');
    }

    async getTopAnime(req, res) {
        await handleApiRequest(req, res, '/top/anime');
    }

    async getAnimeById(req, res) {
        await handleApiRequest(req, res, `/anime/${req.params.id}/full`);
    }

    async getAnimeCharacters(req, res) {
        await handleApiRequest(req, res, `/anime/${req.params.id}/characters`);
    }

    async getAnimePictures(req, res) {
        await handleApiRequest(req, res, `/anime/${req.params.id}/pictures`);
    }
}

module.exports = new ApiService();

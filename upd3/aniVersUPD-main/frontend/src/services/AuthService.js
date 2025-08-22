import api from '../api';

export default class AuthService {
    static async login(email, password) {
        return api.post('/login', { email, password });
    }

    static async register(email, password) {
        return api.post('/register', { email, password });
    }

    static async logout() {
        return api.post('/logout');
    }

    // Проверка авторизации при загрузке приложения
    static async checkAuth() {
        return api.get('/refresh');
    }
}

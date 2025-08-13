import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../App';
import AuthService from '../services/AuthService';
import { CogIcon, LogoutIcon } from '@heroicons/react/outline';

const ProfilePage = () => {
    const { auth, setAuth } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleLogout = async () => {
        try {
            await AuthService.logout();
            localStorage.removeItem('token');
            setAuth({ isAuth: false, user: null, isLoading: false });
            navigate('/'); // Перенаправляем на главную после выхода
        } catch (e) {
            console.error('Logout failed', e);
        }
    };

    if (!auth.user) {
        return null; // или Loader
    }

    return (
        <div className="p-4">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">Профиль</h1>
                <button className="p-2 rounded-full hover:bg-dark-card">
                    <CogIcon className="w-6 h-6 text-gray-300" />
                </button>
            </div>
            <div className="flex items-center space-x-4 bg-dark-card p-4 rounded-lg mb-6">
                <img src={`https://i.pravatar.cc/150?u=${auth.user.id}`} alt="Avatar" className="w-16 h-16 rounded-full" />
                <div>
                    <h2 className="font-bold text-lg">{auth.user.email}</h2>
                    <p className="text-sm text-gray-400">на проекте с 8 авг. 2025 г.</p>
                </div>
            </div>

            {/* Здесь будет статистика */}
            <div className="bg-dark-card p-4 rounded-lg mb-6">
                 <h3 className="font-bold mb-4">Статистика</h3>
                 <p className="text-sm text-gray-400">Раздел в разработке...</p>
            </div>

            {/* ИСПРАВЛЕНИЕ: Добавлена кнопка выхода */}
            <button 
                onClick={handleLogout}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
                <LogoutIcon className="w-5 h-5" />
                Выйти
            </button>
        </div>
    );
};

export default ProfilePage;

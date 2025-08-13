import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import ListItemCard from '../components/ListItemCard';
import Loader from '../components/Loader';
import { SearchIcon, BellIcon, CogIcon } from '@heroicons/react/outline';

// Определяем конфигурацию для каждой вкладки
const TABS_CONFIG = {
    latest: {
        label: 'Последнее',
        params: { order_by: 'start_date', sort: 'desc', limit: 20 }
    },
    airing: {
        label: 'Онгоинги',
        params: { status: 'airing', order_by: 'popularity', limit: 20 }
    },
    upcoming: {
        label: 'Анонсы',
        params: { status: 'upcoming', order_by: 'popularity', limit: 20 }
    }
};

// Компонент для вкладок теперь будет управлять активным состоянием
const HomeTabs = ({ activeTab, setActiveTab }) => (
    <div className="flex space-x-4 border-b border-gray-800 mb-4">
        {Object.entries(TABS_CONFIG).map(([key, { label }]) => (
            <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`pb-2 text-sm font-medium transition-colors ${
                    activeTab === key
                        ? 'border-b-2 border-brand-purple text-white'
                        : 'text-gray-500 hover:text-white'
                }`}
            >
                {label}
            </button>
        ))}
    </div>
);

// Вспомогательный компонент BetaBlock без изменений
const BetaBlock = () => ( <div className="bg-dark-card rounded-lg p-4 mb-4"> <h3 className="font-bold text-yellow-400">Бета-тест 9.0</h3> <p className="text-sm text-gray-300 mt-1">Это предварительная версия, которая находится на этапе разработки.</p> <button className="w-full bg-yellow-500 text-black font-bold py-2 rounded-lg mt-3 hover:bg-yellow-600 transition-colors"> Подробнее </button> </div> );

const MainPage = () => {
    const [animeList, setAnimeList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();
    // Состояние для хранения активной вкладки
    const [activeTab, setActiveTab] = useState('latest');

    // Функция загрузки теперь зависит от активной вкладки
    const fetchAnime = useCallback(async (tab) => {
        try {
            setLoading(true);
            setError(null);
            const config = TABS_CONFIG[tab];
            const response = await api.get('/anime', { params: config.params });
            setAnimeList(response.data.data);
        } catch (err) {
            setError(`Не удалось загрузить "${TABS_CONFIG[tab].label}"`);
            console.error(`Ошибка в MainPage для вкладки ${tab}:`, err);
        } finally {
            setLoading(false);
        }
    }, []);

    // useEffect теперь будет перезапускать загрузку при смене вкладки
    useEffect(() => {
        fetchAnime(activeTab);
    }, [activeTab, fetchAnime]);
    
    return (
        <div className="p-4">
            {/* Шапка без изменений */}
            <header className="flex items-center justify-between mb-4">
                <div className="relative flex-grow">
                    <SearchIcon className="w-5 h-5 text-gray-500 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input type="text" placeholder="Поиск аниме" className="w-full bg-dark-card border border-gray-700 rounded-full py-2.5 pl-11 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-purple" />
                </div>
                <div className="flex items-center ml-2">
                    <button className="p-2 rounded-full hover:bg-dark-card"><CogIcon className="w-6 h-6 text-gray-300" /></button>
                    <button className="p-2 rounded-full hover:bg-dark-card"><BellIcon className="w-6 h-6 text-gray-300" /></button>
                </div>
            </header>

            {/* Передаем управление состоянием в компонент вкладок */}
            <HomeTabs activeTab={activeTab} setActiveTab={setActiveTab} />
            <BetaBlock />

            {loading && <Loader />}
            {error && <p className="text-red-500 text-center my-4">{error}</p>}
            
            <div className="space-y-4">
                {!loading && animeList && animeList.map(anime => (
                    <ListItemCard
                        key={anime.mal_id}
                        anime={anime}
                        onClick={() => navigate(`/anime/${anime.mal_id}`)}
                    />
                ))}
            </div>
        </div>
    );
};

export default MainPage;


import React, { useState } from 'react';
import { useParams, useLocation, Navigate } from 'react-router-dom';

const WatchPage = () => {
    const { id } = useParams(); // mal_id из URL
    const location = useLocation(); // Хук для доступа к данным, переданным при навигации

    // Пытаемся получить данные о плеере, которые были переданы со страницы AnimePage
    const playerData = location.state?.playerData;
    const animeTitle = location.state?.animeTitle || 'Просмотр';

    // Состояние для хранения номера текущего выбранного эпизода
    const [selectedEpisode, setSelectedEpisode] = useState(1);

    // Если на эту страницу зашли напрямую по URL, без данных о плеере,
    // то мы не можем ничего показать. Перенаправляем пользователя обратно
    // на страницу аниме, чтобы он мог нажать кнопку "Смотреть" снова.
    if (!playerData) {
        return <Navigate to={`/anime/${id}`} />;
    }

    // Формируем URL для встраиваемого плеера Kodik
    const playerUrl = `https:${playerData.player_link}?shikimori_id=${id}&e=${selectedEpisode}`;

    return (
        <div className="p-4 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-4">{animeTitle} - Серия {selectedEpisode}</h1>
            
            {/* Iframe с плеером */}
            <div className="aspect-video mb-6 bg-black rounded-lg shadow-lg">
                <iframe
                    src={playerUrl}
                    frameBorder="0"
                    allowFullScreen
                    className="w-full h-full rounded-lg"
                    title={`Плеер для ${animeTitle}`}
                ></iframe>
            </div>

            {/* Блок с кнопками для выбора эпизодов */}
            <div>
                <h2 className="font-bold mb-3 text-lg">Эпизоды:</h2>
                <div className="flex flex-wrap gap-2">
                    {/* Создаем массив кнопок от 1 до общего числа эпизодов */}
                    {Array.from({ length: playerData.episodes_total || 1 }, (_, i) => i + 1).map(ep => (
                        <button
                            key={ep}
                            onClick={() => setSelectedEpisode(ep)}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                                selectedEpisode === ep 
                                ? 'bg-brand-purple text-white' // Стиль для активного эпизода
                                : 'bg-dark-card text-gray-300 hover:bg-gray-600'
                            }`}
                        >
                            {ep}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default WatchPage;

import React, { useState, useEffect, useCallback, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import Loader from '../components/Loader';
import { PlayIcon } from '@heroicons/react/solid';
import { AuthContext } from '../App';

const AnimePage = () => {
    const { id } = useParams(); // mal_id из URL
    const navigate = useNavigate();
    const [anime, setAnime] = useState(null);
    const [loading, setLoading] = useState(true);
    const [playerError, setPlayerError] = useState(''); // Состояние для ошибки плеера
    const [userList, setUserList] = useState([]);
    const { auth } = useContext(AuthContext);

    // Функция для загрузки данных об аниме с Jikan API
    const fetchAnimeData = useCallback(async () => {
        try {
            setLoading(true);
            const { data } = await api.get(`/anime/${id}`);
            setAnime(data);

            // Если пользователь авторизован, загружаем его список
            if (auth.isAuth) {
                const listRes = await api.get('/list');
                setUserList(listRes.data);
            }
        } catch (err) {
            console.error("Ошибка загрузки данных аниме:", err);
        } finally {
            setLoading(false);
        }
    }, [id, auth.isAuth]);

    // Вызываем загрузку данных при первом рендере или изменении ID
    useEffect(() => {
        fetchAnimeData();
    }, [fetchAnimeData]);

    // Функция для обновления статуса аниме в списке пользователя
    const handleStatusUpdate = async (newStatus) => {
        if (!anime || !auth.isAuth) return;

        // Собираем данные для отправки на бэкенд
        const animeData = {
            title: anime.title,
            image_url: anime.images.jpg.image_url,
            episodes: anime.episodes,
        };

        try {
            const currentStatus = userList.find(item => item.mal_id === parseInt(id))?.status;
            // Если пользователь выбирает тот же статус, это значит "удалить из списка"
            if (currentStatus === newStatus) {
                await api.delete(`/list/${id}`);
            } else {
                await api.post('/list', { mal_id: parseInt(id), status: newStatus, animeData });
            }
            // Обновляем список после изменения
            const listRes = await api.get('/list');
            setUserList(listRes.data);
        } catch (error) {
            console.error("Не удалось обновить статус:", error);
        }
    };

    // Обработчик нажатия на кнопку "Смотреть"
    const handleWatchClick = async () => {
        setPlayerError(''); // Сбрасываем предыдущую ошибку
        try {
            // Запрашиваем плеер у нашего бэкенда, передавая ID аниме
            const { data } = await api.get(`/player/${id}`);
            // Если все успешно, переходим на страницу просмотра
            // и передаем ей полученные данные о плеере и название аниме
            navigate(`/watch/${id}`, { 
                state: { 
                    playerData: data, 
                    animeTitle: anime.title 
                } 
            });
        } catch (err) {
            console.error("Ошибка получения плеера:", err);
            // Устанавливаем ошибку для отображения пользователю
            setPlayerError(err.response?.data?.message || 'Просмотр временно недоступен');
        }
    };

    // Отображение загрузчика, пока данные не получены
    if (loading) return <Loader />;
    // Отображение ошибки, если аниме не найдено
    if (!anime) return <p className="text-center mt-10">Не удалось загрузить информацию об аниме.</p>;
    
    const statusMap = { watching: 'Смотрю', completed: 'Просмотрено', on_hold: 'Отложено', dropped: 'Брошено', planned: 'В планах' };
    const currentStatus = userList.find(item => item.mal_id === parseInt(id))?.status;

    return (
        <div>
            <div className="h-48 md:h-64 w-full">
                <img src={anime.images?.jpg?.large_image_url} alt="Banner" className="w-full h-full object-cover opacity-30" />
            </div>
            <div className="p-4 -mt-24">
                <div className="flex flex-col md:flex-row gap-6">
                    <img src={anime.images?.jpg?.large_image_url} alt={anime.title} className="w-40 md:w-56 rounded-lg object-cover self-start shadow-2xl" />
                    <div className="flex-1 mt-16 md:mt-24">
                        <h1 className="text-2xl md:text-3xl font-bold text-white">{anime.title}</h1>
                        <h2 className="text-lg text-gray-400 mb-4">{anime.title_english}</h2>
                    </div>
                </div>

                <div className="flex items-center gap-2 my-6">
                    <button 
                        onClick={handleWatchClick}
                        className="flex-grow bg-brand-purple text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 hover:bg-purple-600 transition-colors"
                    >
                        <PlayIcon className="w-6 h-6"/>
                        Смотреть
                    </button>
                    
                    {auth.isAuth && (
                        <select
                            value={currentStatus || 'none'}
                            onChange={(e) => handleStatusUpdate(e.target.value)}
                            className="appearance-none bg-dark-card text-white font-bold py-3 px-4 rounded-lg hover:bg-gray-600 transition-colors cursor-pointer"
                        >
                            <option value="none" disabled>{currentStatus ? statusMap[currentStatus] : 'Добавить'}</option>
                            {Object.entries(statusMap).map(([key, value]) => (<option key={key} value={key}>{value}</option>))}
                            {currentStatus && <option value={currentStatus}>Удалить из списка</option>}
                        </select>
                    )}
                </div>

                {/* Отображение ошибки, если плеер не найден */}
                {playerError && <p className="text-center text-red-500 my-2">{playerError}</p>}
                
                <p className="text-gray-300 mb-6 text-sm">{anime.synopsis}</p>
            </div>
        </div>
    );
};

export default AnimePage;

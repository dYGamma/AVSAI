import React, { useState, useEffect, useMemo, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../App'; // Импортируем AuthContext
import api from '../api';
import ListItemCard from '../components/ListItemCard';
import Loader from '../components/Loader';
import { SearchIcon } from '@heroicons/react/solid';

// Убираем вкладку 'on_hold', так как её нет в схеме на бэкенде
const TABS = [
    { key: 'all', label: 'Всё' },
    { key: 'watching', label: 'Смотрю' },
    { key: 'planned', label: 'В планах' },
    { key: 'completed', label: 'Просмотрено' },
    { key: 'dropped', label: 'Брошено' },
];

// Добавляем опции для сортировки
const SORT_OPTIONS = [
    { key: 'added_desc', label: 'По добавлению (новые)' },
    { key: 'title_asc', label: 'По алфавиту (А-Я)' },
    { key: 'year_desc', label: 'По году (новые)' },
];

const BookmarksPage = () => {
    const [fullList, setFullList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('added_desc'); // Новое состояние для сортировки
    const navigate = useNavigate();

    // Используем AuthContext для получения актуальной информации о пользователе
    const { auth } = useContext(AuthContext);
    const user = auth?.user;
    const userId = user?.id || user?._id; // Поддерживаем оба варианта ID

    useEffect(() => {
        const fetchList = async () => {
            // Если ID пользователя есть, загружаем его список
            if (userId) {
                try {
                    setLoading(true);
                    const response = await api.get(`/users/${userId}/list`);
                    
                    // ДОБАВЛЕНО: Логируем ответ от API для диагностики
                    console.log('Ответ от API /list:', response.data);

                    // ДОБАВЛЕНО: Проверяем, что полученные данные - это массив
                    if (Array.isArray(response.data)) {
                        setFullList(response.data);
                    } else {
                        console.error("Ожидался массив, но получен другой тип данных:", response.data);
                        setFullList([]); // Устанавливаем пустой массив в случае неверного формата
                    }

                } catch (err) {
                    console.error("Failed to fetch user list:", err);
                    setFullList([]); // В случае ошибки устанавливаем пустой список
                } finally {
                    setLoading(false);
                }
            } else {
                // Если пользователя нет, прекращаем загрузку
                setLoading(false);
                setFullList([]);
            }
        };

        // Запускаем загрузку только после того, как статус авторизации определён
        if (!auth.isLoading) {
            fetchList();
        }
    }, [userId, auth.isLoading]); // Перезапускаем эффект при изменении ID пользователя или статуса загрузки auth

    const sortedAndFilteredList = useMemo(() => {
        // 1. Фильтрация по вкладке и поиску
        let list = activeTab === 'all' ? fullList : fullList.filter(item => item.status === activeTab);
        if (searchTerm) {
            const lowercasedFilter = searchTerm.toLowerCase();
            list = list.filter(item =>
                item.title?.toLowerCase().includes(lowercasedFilter)
            );
        }

        // 2. Сортировка
        const sortedList = [...list]; // Создаем копию для сортировки
        switch (sortBy) {
            case 'title_asc':
                sortedList.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
                break;
            case 'year_desc':
                // Примечание: для этой сортировки необходимо, чтобы в объекте anime был ключ 'year'
                // Добавим проверку на наличие данных, чтобы избежать ошибок
                sortedList.sort((a, b) => (b.year || 0) - (a.year || 0));
                break;
            case 'added_desc':
                // API по умолчанию возвращает массив в порядке добавления (старые -> новые)
                // Для сортировки "сначала новые" мы его просто переворачиваем.
                // Это более надежно, чем reverse(), который мутирует массив.
                return sortedList.slice().reverse();
            default:
                return sortedList;
        }

        return sortedList;
    }, [activeTab, fullList, searchTerm, sortBy]);

    // Показываем главный лоадер, пока проверяется авторизация
    if (auth.isLoading) {
        return <Loader />;
    }

    // Если пользователь не авторизован, показываем предложение войти
    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center text-center h-64">
                <h2 className="text-xl font-bold mb-2">Войдите, чтобы увидеть свои закладки</h2>
                <p className="text-gray-400 mb-4">Здесь будет ваш список аниме.</p>
                <Link to="/login" className="px-6 py-2 rounded-lg bg-brand-purple text-white font-bold">
                    Войти
                </Link>
            </div>
        );
    }

    return (
        <div className="p-4 max-w-4xl mx-auto main-with-bottom-space app-safe-bottom">
            <div className="flex flex-col md:flex-row gap-4 mb-4">
                <div className="relative flex-grow">
                    <SearchIcon className="w-5 h-5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Поиск в закладках..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-dark-card border border-gray-700 rounded-lg py-2 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-purple"
                    />
                </div>
                <div className="flex-shrink-0">
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="w-full md:w-auto bg-dark-card border border-gray-700 rounded-lg py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-brand-purple"
                    >
                        {SORT_OPTIONS.map(option => (
                            <option key={option.key} value={option.key}>{option.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="flex overflow-x-auto space-x-1 mb-4 pb-2">
                {TABS.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors duration-200 ${
                            activeTab === tab.key ? 'bg-brand-purple text-white' : 'bg-dark-card text-gray-300 hover:bg-gray-700'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {loading ? <Loader /> : (
                <>
                    {sortedAndFilteredList.length === 0 ? (
                        <p className="text-center text-gray-400 mt-8">
                            {searchTerm ? 'Ничего не найдено по вашему запросу.' : 'В этом списке пока пусто.'}
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {sortedAndFilteredList.map(anime => (
                                <ListItemCard
                                    // Используем shikimori_id, так как он приходит с бэкенда
                                    key={anime.shikimori_id}
                                    anime={anime}
                                    onClick={() => navigate(`/anime/${anime.shikimori_id}`)}
                                />
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default BookmarksPage;

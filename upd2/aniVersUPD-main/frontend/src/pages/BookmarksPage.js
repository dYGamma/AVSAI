import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import ListItemCard from '../components/ListItemCard';
import Loader from '../components/Loader';
import { SearchIcon } from '@heroicons/react/solid';

const TABS = [
    { key: 'all', label: 'Всё' },
    { key: 'watching', label: 'Смотрю' },
    { key: 'planned', label: 'В планах' },
    { key: 'completed', label: 'Просмотрено' },
    { key: 'on_hold', label: 'Отложено' },
    { key: 'dropped', label: 'Брошено' },
];

const BookmarksPage = () => {
    const [fullList, setFullList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const userId = localStorage.getItem('userId');
    const navigate = useNavigate();

    useEffect(() => {
        const fetchList = async () => {
            if (!userId) { setLoading(false); return; }
            try {
                setLoading(true);
                const response = await api.get(`/users/${userId}/list`);
                setFullList(response.data);
            } catch (err) { console.error(err); }
            finally { setLoading(false); }
        };
        fetchList();
    }, [userId]);

    const filteredList = useMemo(() => {
        let list = activeTab === 'all' ? fullList : fullList.filter(item => item.status === activeTab);
        if (searchTerm) {
            list = list.filter(item => item.title.toLowerCase().includes(searchTerm.toLowerCase()));
        }
        return list;
    }, [activeTab, fullList, searchTerm]);

    return (
        <div className="p-4">
            <div className="relative mb-4">
                <SearchIcon className="w-5 h-5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                    type="text"
                    placeholder="Поиск в избранном..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-dark-card border border-gray-700 rounded-lg py-2 pl-10 pr-4"
                />
            </div>

            <div className="flex overflow-x-auto space-x-1 mb-4">
                {TABS.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap ${
                            activeTab === tab.key ? 'bg-brand-purple text-white' : 'bg-dark-card text-gray-300'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {loading && <Loader />}
            {!loading && filteredList.length === 0 ? (
                <p className="text-center text-gray-400 mt-8">В этом списке пока пусто.</p>
            ) : (
                <div className="space-y-4">
                    {filteredList.map(anime => (
                        <ListItemCard
                            key={anime.mal_id}
                            anime={anime}
                            onClick={() => navigate(`/anime/${anime.mal_id}`)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default BookmarksPage;

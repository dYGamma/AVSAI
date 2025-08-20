// ./frontend/src/pages/MainPage.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import ListItemCard from '../components/ListItemCard';
import Loader from '../components/Loader';
import { SearchIcon, BellIcon, CogIcon } from '@heroicons/react/outline';

/**
 * Конфигурация вкладок. Значения params передаются в /api/anime.
 */
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
  },
  completed: {
    label: 'Завершённые',
    params: { status: 'complete', order_by: 'start_date', sort: 'desc', limit: 20 }
  }
};

// Компонент вкладок (управление внешним состоянием)
const HomeTabs = ({ activeTab, setActiveTab }) => (
  <div className="flex space-x-4 border-b border-gray-800 mb-4 overflow-x-auto">
    {Object.entries(TABS_CONFIG).map(([key, { label }]) => (
      <button
        key={key}
        onClick={() => setActiveTab(key)}
        className={`pb-2 text-sm font-medium transition-colors whitespace-nowrap ${
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

/**
 * Обновлённый BetaBlock:
 * - текст: "Версия 1.0 в разработке"
 * - кнопка "Подробнее" ведёт в Telegram (открытие в новой вкладке)
 */
const BetaBlock = () => (
  <div className="bg-dark-card rounded-lg p-4 mb-4">
    <div className="flex items-start justify-between">
      <div>
        <h3 className="font-bold text-white">Версия 1.0 в разработке</h3>
        <p className="text-sm text-gray-300 mt-1">
          Это предварительная версия. Подписывайтесь, чтобы быть в курсе обновлений и релизов.
        </p>
      </div>
      <div className="ml-4 flex-shrink-0">
        <a
          href="https://t.me/+5OOwLImxzEA5MzAy"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-brand-purple px-3 py-2 rounded-md text-sm font-semibold text-white hover:opacity-95 transition"
        >
          Подробнее
        </a>
      </div>
    </div>
  </div>
);

/**
 * MainPage — поддерживает infinite scroll и поиск.
 */
const MainPage = () => {
  const [animeList, setAnimeList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const [activeTab, setActiveTab] = useState('latest');

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState(''); // дебаунс-версия терма

  const pageRef = useRef(1);
  const hasNextRef = useRef(true);
  const observerRef = useRef(null);
  const sentinelRef = useRef(null);
  const requestIdRef = useRef(0); // чтобы отбросить устаревшие ответы

  const navigate = useNavigate();

  // Дебаунс для поиска (500ms)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 500);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Сброс состояния при смене вкладки или поискового терма
  useEffect(() => {
    pageRef.current = 1;
    hasNextRef.current = true;
    setAnimeList([]);
    setError(null);
  }, [activeTab, debouncedSearch]);

  // Основная функция загрузки (append либо replace в зависимости от page)
  const fetchAnime = useCallback(async (page = 1) => {
    // requestId — чтобы отличать результаты предыдущих запросов
    const thisRequestId = ++requestIdRef.current;

    const isFirstPage = page === 1;
    try {
      if (isFirstPage) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      const config = TABS_CONFIG[activeTab] || TABS_CONFIG.latest;
      const params = {
        ...config.params,
        page,
      };

      // Если в поиске — добавляем q (Jikan expects q=...)
      if (debouncedSearch) {
        params.q = debouncedSearch;
      }

      const res = await api.get('/anime', { params });

      // Игнорируем устаревшие ответы
      if (thisRequestId !== requestIdRef.current) return;

      // Jikan возвращает { data: [...], pagination: { has_next_page } }
      const dataArray = res.data?.data || [];
      const pagination = res.data?.pagination || {};
      const hasNext = typeof pagination.has_next_page === 'boolean' ? pagination.has_next_page : (dataArray.length === (params.limit || 20));

      setAnimeList(prev => (isFirstPage ? dataArray : [...prev, ...dataArray]));
      hasNextRef.current = hasNext;
      pageRef.current = page;
    } catch (err) {
      console.error('Ошибка в MainPage fetchAnime:', err);
      setError(`Не удалось загрузить "${TABS_CONFIG[activeTab]?.label || 'Результаты'}"`);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [activeTab, debouncedSearch]);

  // Начальная загрузка / перезагрузка при смене вкладки или поиска
  useEffect(() => {
    fetchAnime(1);
  }, [fetchAnime, activeTab, debouncedSearch]);

  // IntersectionObserver для бесконечной подгрузки
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return;
    const onIntersect = (entries) => {
      if (entries[0].isIntersecting && hasNextRef.current && !loadingMore && !loading) {
        const nextPage = pageRef.current + 1;
        fetchAnime(nextPage);
      }
    };

    observerRef.current = new IntersectionObserver(onIntersect, { root: null, rootMargin: '200px', threshold: 0.1 });
    const node = sentinelRef.current;
    if (node) observerRef.current.observe(node);

    return () => {
      if (observerRef.current && node) observerRef.current.unobserve(node);
      observerRef.current = null;
    };
  }, [fetchAnime, loadingMore, loading]);

  return (
    <div className="p-4">
      {/* Шапка */}
      <header className="flex items-center justify-between mb-4">
        <div className="relative flex-grow">
          <SearchIcon className="w-5 h-5 text-gray-500 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Поиск аниме"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-dark-card border border-gray-700 rounded-full py-2.5 pl-11 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-purple"
          />
        </div>
        <div className="flex items-center ml-2">
          <button className="p-2 rounded-full hover:bg-dark-card"><CogIcon className="w-6 h-6 text-gray-300" /></button>
          <button className="p-2 rounded-full hover:bg-dark-card"><BellIcon className="w-6 h-6 text-gray-300" /></button>
        </div>
      </header>

      {/* Вкладки */}
      <HomeTabs activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Подсказка про поиск */}
      {debouncedSearch ? (
        <p className="text-sm text-gray-400 mb-3">Результаты поиска по «{debouncedSearch}»</p>
      ) : null}

      {/* Блок с информацией о версии и ссылкой на Telegram */}
      <BetaBlock />

      {/* Состояния загрузки / ошибки */}
      {loading && <Loader />}
      {error && <p className="text-red-500 text-center my-4">{error}</p>}

      {/* Список */}
      <div className="space-y-4">
        {!loading && animeList && animeList.map(anime => (
          <ListItemCard
            key={anime.mal_id || anime.malId || anime.id}
            anime={anime}
            onClick={() => navigate(`/anime/${anime.mal_id || anime.malId || anime.id}`)}
          />
        ))}
      </div>

      {/* Сентинел для IntersectionObserver */}
      <div ref={sentinelRef} />

      {/* Индикатор загрузки при подгрузке */}
      {loadingMore && (
        <div className="flex justify-center items-center py-6">
          <div className="w-10 h-10 border-4 border-dashed rounded-full animate-spin border-brand-purple"></div>
        </div>
      )}

      {/* Если данных нет и не loading - показать пустой экран */}
      {!loading && animeList.length === 0 && !error && (
        <p className="text-center text-gray-400 mt-8">Ничего не найдено.</p>
      )}
    </div>
  );
};

export default MainPage;

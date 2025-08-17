// /frontend/src/pages/WatchPage.js
import React, { useState, useEffect } from 'react';
import { useParams, useLocation, Navigate } from 'react-router-dom';
import api from '../api';
import Loader from '../components/Loader';

const WatchPage = () => {
  const { id } = useParams(); // mal_id из URL
  const location = useLocation(); // данные, переданные при navigate()

  // Инициализация состояний (хуки вызываются всегда)
  const [playerData, setPlayerData] = useState(location.state?.playerData || null);
  const [animeTitle, setAnimeTitle] = useState(location.state?.animeTitle || 'Просмотр');
  const [selectedEpisode, setSelectedEpisode] = useState(1);
  const [loading, setLoading] = useState(!location.state?.playerData);
  const [error, setError] = useState('');

  useEffect(() => {
    // Если playerData уже есть (переход с AnimePage), ничего не делаем
    if (playerData) {
      setLoading(false);
      return;
    }

    let mounted = true;

    const fetchPlayer = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get(`/player/${id}`);
        if (!mounted) return;
        // Ожидаем формат { player_link, episodes_total, ... }
        setPlayerData(data);
        // Если сервер вернул название — используем его (иначе оставим текущий animeTitle)
        if (data.title) setAnimeTitle(data.title);
        // Сбросим выбранную серию на 1 по-умолчанию
        setSelectedEpisode(1);
      } catch (e) {
        // Логируем и показываем сообщение
        console.error('WatchPage: failed to fetch player', e);
        setError(e.response?.data?.message || 'Не удалось получить плеер для этого аниме');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchPlayer();

    return () => {
      mounted = false;
    };
  }, [id, playerData]);

  // Пока загружается — показываем лоадер
  if (loading) return <Loader />;

  // Если есть ошибка — перенаправим на страницу аниме (можно изменить на отображение ошибки)
  if (error) {
    // Можно показывать компонент с кнопкой назад, но для простоты возвращаем на страницу аниме:
    return <Navigate to={`/anime/${id}`} replace />;
  }

  // Если после загрузки playerData всё ещё отсутствует — тоже уходим назад
  if (!playerData) {
    return <Navigate to={`/anime/${id}`} replace />;
  }

  // Построение корректного URL плеера:
  // Kodik возвращает иногда ссылку без протокола (например "//kodik...") или относительную.
  let rawLink = playerData.player_link || '';
  let playerUrl = '';
  if (/^https?:\/\//i.test(rawLink)) {
    playerUrl = `${rawLink}${rawLink.includes('?') ? '&' : '?'}shikimori_id=${id}&e=${selectedEpisode}`;
  } else if (rawLink.startsWith('//')) {
    playerUrl = `https:${rawLink}${rawLink.includes('?') ? '&' : '?'}shikimori_id=${id}&e=${selectedEpisode}`;
  } else {
    // дефолт — добавляем https:
    playerUrl = `https:${rawLink}${rawLink.includes('?') ? '&' : '?'}shikimori_id=${id}&e=${selectedEpisode}`;
  }

  const episodesTotal = playerData.episodes_total || playerData.episodes_count || 1;

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">{animeTitle} — Серия {selectedEpisode}</h1>

      <div className="aspect-video mb-6 bg-black rounded-lg shadow-lg overflow-hidden">
        {/* iframe плеера */}
        <iframe
          src={playerUrl}
          frameBorder="0"
          allowFullScreen
          className="w-full h-full rounded-lg"
          title={`Плеер для ${animeTitle}`}
        />
      </div>

      <div className="mb-6">
        <h2 className="font-bold mb-3 text-lg">Эпизоды:</h2>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: episodesTotal }, (_, i) => i + 1).map((ep) => (
            <button
              key={ep}
              onClick={() => setSelectedEpisode(ep)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                selectedEpisode === ep
                  ? 'bg-brand-purple text-white'
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

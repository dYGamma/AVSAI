// ./frontend/src/pages/AnimePage.js
import React, { useState, useEffect, useCallback, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import axios from 'axios';
import Loader from '../components/Loader';
import { PlayIcon } from '@heroicons/react/solid';
import { AuthContext } from '../App';

/**
 * Страница просмотра информации об аниме.
 * Использует:
 *  - /api/anime/:id  (бэкенд -> Jikan /anime/{id}/full)
 *  - /api/player/:id (бэкенд -> Kodik) — для плеера
 *
 * Дополнительно (необязательно, могут блокироваться CORS):
 *  - https://api.jikan.moe/v4/anime/:id/characters
 *  - https://api.jikan.moe/v4/anime/:id/pictures
 *  - https://api.jikan.moe/v4/anime/:id/recommendations
 *
 * Компонент устойчив к ошибкам: если внешний вызов упал — показываем то, что есть.
 */

const JIKAN_BASE = 'https://api.jikan.moe/v4';

const MetaItem = ({ title, children }) => (
  <div className="flex items-start space-x-3">
    <div className="min-w-[1px] text-sm text-gray-400 w-40 md:w-56">{title}</div>
    <div className="text-sm text-gray-300">{children}</div>
  </div>
);

const Tag = ({ children }) => (
  <span className="inline-block text-xs px-2 py-1 bg-dark-card rounded-md text-gray-300 mr-2 mb-2">
    {children}
  </span>
);

const AnimePage = () => {
  const { id } = useParams(); // mal_id
  const navigate = useNavigate();
  const { auth } = useContext(AuthContext);

  const [anime, setAnime] = useState(null);
  const [loading, setLoading] = useState(true);

  // Доп. данные
  const [playerData, setPlayerData] = useState(null); // от нашего бэкенда /player/:id
  const [pictures, setPictures] = useState([]); // from Jikan /pictures
  const [characters, setCharacters] = useState([]); // from Jikan /characters (для озвучки)
  const [recommendations, setRecommendations] = useState([]);
  const [isNewEpisode, setIsNewEpisode] = useState(false);
  const [newEpisodesList, setNewEpisodesList] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');

  // Загрузка основной информации об аниме
  const fetchAnime = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const { data } = await api.get(`/anime/${id}`);
      // ApiController возвращает data.data (у нас в backend getAnimeDetails -> res.json(data.data))
      // Но на фронтенде в прошлой реализации в setAnime(data) использовали value как "data".
      // Здесь проверяем, вдруг ответ обернут.
      const payload = data && (data.title || data.data) ? (data.title ? data : data) : data;
      setAnime(payload);
    } catch (err) {
      console.error('Ошибка загрузки данных аниме:', err);
      setErrorMsg('Не удалось загрузить информацию об аниме.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Попытка получить плеер (Kodik) — для подсказок о новых эпизодах и перехода на просмотр
  const fetchPlayer = useCallback(async () => {
    try {
      const { data } = await api.get(`/player/${id}`);
      setPlayerData(data);
      return data;
    } catch (err) {
      // Это нормальная ситуация (плеер может быть не настроен/не найден)
      console.warn('Kodik player unavailable:', err?.response?.data || err.message);
      setPlayerData(null);
      return null;
    }
  }, [id]);

  // Получить дополнительные данные напрямую из Jikan (фотки, characters, recommendations)
  const fetchJikanExtras = useCallback(async () => {
    // CORS может помешать — оборачиваем в try/catch
    try {
      // pictures
      try {
        const picsRes = await axios.get(`${JIKAN_BASE}/anime/${id}/pictures`);
        setPictures(picsRes.data?.data || []);
      } catch (e) {
        setPictures([]);
        // не ломаем загрузку
      }

      // characters (для voice actors)
      try {
        const charsRes = await axios.get(`${JIKAN_BASE}/anime/${id}/characters`);
        setCharacters(charsRes.data?.data || []);
      } catch (e) {
        setCharacters([]);
      }

      // recommendations
      try {
        const recRes = await axios.get(`${JIKAN_BASE}/anime/${id}/recommendations`);
        setRecommendations(recRes.data?.data || []);
      } catch (e) {
        setRecommendations([]);
      }
    } catch (e) {
      // игнорируем
      console.warn('Extras load failed', e);
    }
  }, [id]);

  // При монтировании — грузим данные
  useEffect(() => {
    (async () => {
      await fetchAnime();
      const p = await fetchPlayer();
      await fetchJikanExtras();

      // Проверим, есть ли "новые" эпизоды: если есть playerData.episodes_total и он > anime.episodes
      try {
        const localEpisodes = Number((await api.get(`/anime/${id}`)).data?.episodes) || (anime?.episodes || 0);
        // note: мы повторно вызывали /anime для episodes — немного избыточно, но надёжно
        const player = p || playerData;
        const playerCount = player?.episodes_total ? Number(player.episodes_total) : null;
        if (playerCount && playerCount > localEpisodes) {
          setIsNewEpisode(true);
          // формируем список новых эпизодов (например последние 5)
          const from = localEpisodes + 1;
          const to = playerCount;
          const list = [];
          for (let ep = from; ep <= to; ep++) {
            // Попробуем взять "озвучил" из characters (не идеально, но попытаемся)
            // Ищем первого VA в characters для какого-нибудь главного персонажа (best-effort)
            let va = 'неизвестно';
            if (characters && characters.length) {
              // Берём первое совпадение voice_actors[0]?.person?.name
              const firstWithVA = characters.find(c => c.voice_actors && c.voice_actors.length);
              if (firstWithVA) {
                va = firstWithVA.voice_actors[0].person?.name || va;
              }
            }
            list.push({ ep, va });
          }
          setNewEpisodesList(list);
        } else {
          setIsNewEpisode(false);
          setNewEpisodesList([]);
        }
      } catch (e) {
        // ignore
        setIsNewEpisode(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchAnime, fetchPlayer, fetchJikanExtras, id]);

  // Обработчик нажатия "Смотреть" — запрашиваем плеер и переходим
  const handleWatchClick = async () => {
    try {
      setErrorMsg('');
      const { data } = await api.get(`/player/${id}`);
      // Перенаправляем на страницу просмотра, передавая данные в state
      navigate(`/watch/${id}`, {
        state: { playerData: data, animeTitle: anime?.title || anime?.title_english || 'Просмотр' }
      });
    } catch (err) {
      console.error('Ошибка получения плеера:', err);
      setErrorMsg(err.response?.data?.message || 'Просмотр временно недоступен');
    }
  };

  // Добавление аниме в список пользователя (как раньше)
  const handleAddToList = async (newStatus = 'planned') => {
    if (!auth.isAuth) {
      navigate('/login');
      return;
    }
    try {
      // animeData для бэкенда
      const animeData = {
        title: anime.title,
        image_url: anime.images?.jpg?.image_url || anime.images?.jpg?.large_image_url,
        episodes: anime.episodes,
      };
      await api.post('/list', { shikimori_id: Number(id), status: newStatus, animeData });
      // можно обновить UI (например, показать уведомление)
      alert('Сохранено в список');
    } catch (e) {
      console.error('Не удалось добавить в список:', e);
      alert('Не удалось добавить в список.');
    }
  };

  if (loading) return <Loader />;

  if (!anime) {
    return <p className="text-center mt-10">Не удалось загрузить информацию об аниме.</p>;
  }

  // Helpers извлечения свойств с учётом возможной структуры (data или просто объект)
  const A = anime;
  const title = A.title || A.title_english || 'Без названия';
  const synopsis = A.synopsis || 'Описание отсутствует.';
  const imageUrl = A.images?.jpg?.large_image_url || A.images?.jpg?.image_url || A.image_url || '';
  const type = A.type || A.media_type || 'N/A';
  const episodes = A.episodes || A.episodes_count || null;
  const duration = A.duration || (A.duration ? A.duration : null);
  const season = A.season || (A.aired?.prop?.from ? `${A.aired.prop.from.year}` : '');
  const seasonLabel = A.season ? `${A.season} ${A.year || ''}` : (A.aired?.string || '');
  const source = A.source || 'N/A';
  const studios = (A.studios || []).map(s => s.name).join(', ');
  const producers = (A.producers || []).map(p => p.name).join(', ');
  const genres = (A.genres || []).map(g => g.name);
  const ratingScore = A.score;
  const rank = A.rank;
  const popularity = A.popularity;
  const members = A.members;

  // schedule: if published dates/airing info exist
  let schedule = '—';
  if (A.status) {
    schedule = A.status;
    if (A.broadcast) schedule = A.broadcast; // sometimes Jikan has broadcast like "Sundays at 01:00 (JST)"
  }

  // trailer link
  const trailerUrl = A.trailer?.url || (A.trailer && A.trailer.embed_url) || null;

  return (
    <div className="p-4">
      {/* Banner / cover */}
      <div className="relative w-full h-48 md:h-64 rounded-lg overflow-hidden bg-gradient-to-r from-[#0f1724]/60 to-transparent">
        {imageUrl ? (
          <img src={imageUrl} alt={title} className="w-full h-full object-cover opacity-40" />
        ) : (
          <div className="w-full h-full bg-dark-card flex items-center justify-center text-gray-500">Нет обложки</div>
        )}
        <div className="absolute inset-0 p-4 flex flex-col justify-end">
          <h1 className="text-2xl md:text-3xl font-bold text-white drop-shadow-md">{title}</h1>
          {A.title_english && <h2 className="text-sm text-gray-300">{A.title_english}</h2>}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Left column: poster + actions */}
        <div className="md:col-span-1">
          <div className="sticky top-20">
            <img src={imageUrl} alt={title} className="w-full rounded-lg shadow-2xl object-cover" />
            <div className="mt-4 space-y-3">
              <button
                onClick={handleWatchClick}
                className="w-full bg-brand-purple text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 hover:bg-purple-600 transition-colors"
              >
                <PlayIcon className="w-5 h-5" />
                Смотреть
              </button>

              <button
                onClick={() => handleAddToList('planned')}
                className="w-full bg-dark-card text-white font-semibold py-3 px-4 rounded-lg border border-gray-700 hover:bg-gray-700 transition"
              >
                Добавить в список
              </button>

              {trailerUrl && (
                <a href={trailerUrl} target="_blank" rel="noopener noreferrer" className="block text-center text-sm text-gray-300 underline mt-2">
                  Смотреть трейлер
                </a>
              )}

              {errorMsg && <p className="text-sm text-red-500 mt-2">{errorMsg}</p>}
            </div>
          </div>
        </div>

        {/* Right column: details */}
        <div className="md:col-span-3">
          {/* New episodes banner */}
          {isNewEpisode && newEpisodesList.length > 0 && (
            <div className="mb-4 p-3 bg-yellow-500 rounded-lg text-black">
              <div className="font-bold">Версята, новая серия вышла!</div>
              <div className="mt-2 space-y-1 text-sm">
                {newEpisodesList.map(item => (
                  <div key={item.ep} className="flex items-center justify-between">
                    <div>Серия {item.ep} : <span className="font-semibold">{item.va}</span></div>
                    <div>
                      <button
                        onClick={() => {
                          // Если у нас есть playerData — перейдём на просмотр и передадим эпизод
                          if (playerData) {
                            navigate(`/watch/${id}`, { state: { playerData, animeTitle: title, selectedEpisode: item.ep } });
                          } else {
                            // Попробуем запросить плеер и перейти
                            handleWatchClick();
                          }
                        }}
                        className="text-xs px-2 py-1 bg-dark-card rounded-md text-gray-200"
                      >
                        Открыть плеер
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metadata block */}
          <div className="bg-dark-card p-4 rounded-lg mb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MetaItem title="Страна / Сезон">
                {A.source === 'Original' ? `${A.aired?.string || seasonLabel}` : (A.aired?.string || seasonLabel) || '—'}
              </MetaItem>

              <MetaItem title="Эпизоды / Длительность">
                {episodes ? `${episodes} эп. по ${duration || '—'}` : (duration ? `~${duration}` : '—')}
              </MetaItem>

              <MetaItem title="Тип / Расписание">
                <span>{type}{schedule ? `, ${schedule}` : ''}</span>
              </MetaItem>

              <MetaItem title="Первоисточник">
                {source || '—'}
              </MetaItem>

              <MetaItem title="Студии / Автор / Режиссёр">
                <div>
                  <div className="text-sm">{studios || '—'}</div>
                  {/* Иногда staff info вложен в A.staff — не всегда доступно */}
                  {A.staff && A.staff.length > 0 && (
                    <div className="text-xs text-gray-400 mt-2">
                      {A.staff.slice(0, 3).map(s => `${s.name}${s.positions ? ` (${s.positions.join(',')})` : ''}`).join('; ')}
                    </div>
                  )}
                </div>
              </MetaItem>

              <MetaItem title="Жанры">
                <div className="flex flex-wrap">
                  {genres && genres.length ? genres.map(g => <Tag key={g}>{g}</Tag>) : '—'}
                </div>
              </MetaItem>
            </div>
          </div>

          {/* Synopsis */}
          <div className="bg-dark-bg p-4 rounded-lg mb-4">
            <h3 className="font-bold text-white text-lg mb-2">Описание</h3>
            <p className="text-gray-300 text-sm whitespace-pre-line">{synopsis}</p>
          </div>

          {/* Видео / трейлеры / внешние ссылки */}
          <div className="bg-dark-card p-4 rounded-lg mb-4">
            <h3 className="font-bold text-white mb-3">Видео</h3>
            <div className="flex flex-wrap gap-2">
              {trailerUrl && (
                <a href={trailerUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-2 bg-gray-800 rounded-md text-sm text-gray-300">
                  Трейлер
                </a>
              )}
              {(A.external || []).map((ext, idx) => (
                <a key={idx} href={ext.url} target="_blank" rel="noopener noreferrer" className="px-3 py-2 bg-gray-800 rounded-md text-sm text-gray-300">
                  {ext.name || 'Внешняя ссылка'}
                </a>
              ))}
              {/* possible promo videos */}
              {A.trailer?.embed_url && (
                <a href={A.trailer.embed_url} target="_blank" rel="noopener noreferrer" className="px-3 py-2 bg-gray-800 rounded-md text-sm text-gray-300">
                  Встроенный трейлер
                </a>
              )}
            </div>
          </div>

          {/* Rating */}
          <div className="bg-dark-bg p-4 rounded-lg mb-4">
            <h3 className="font-bold text-white mb-2">Рейтинг</h3>
            <div className="flex flex-col md:flex-row md:items-center md:space-x-6">
              <div className="text-2xl font-bold text-white">{ratingScore || '—'}</div>
              <div className="text-sm text-gray-400">
                <div>Rank: {rank || '—'}</div>
                <div>Popularity: {popularity || '—'}</div>
                <div>Members: {members || '—'}</div>
              </div>
            </div>
          </div>

          {/* Pictures gallery */}
          <div className="bg-dark-card p-4 rounded-lg mb-4">
            <h3 className="font-bold text-white mb-3">Кадры</h3>
            {pictures && pictures.length > 0 ? (
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                {pictures.slice(0, 12).map((pic, i) => (
                  <a key={i} href={pic.jpg?.image_url || pic.image_url} target="_blank" rel="noopener noreferrer" className="block rounded overflow-hidden">
                    <img src={pic.jpg?.small_image_url || pic.jpg?.image_url || pic.image_url} alt={`pic-${i}`} className="w-full h-24 object-cover rounded" />
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-sm">Кадры недоступны.</p>
            )}
          </div>

          {/* Related / Releases */}
          <div className="bg-dark-bg p-4 rounded-lg mb-4">
            <h3 className="font-bold text-white mb-3">Релизы / Связанные</h3>
            {A.relations && A.relations.length ? (
              <div className="space-y-2">
                {A.relations.map((rel, idx) => (
                  <div key={idx} className="text-sm text-gray-300">
                    <div className="text-xs text-gray-400 mb-1">{rel.relation}</div>
                    <div className="flex flex-wrap gap-2">
                      {rel.entry.map(e => (
                        <button
                          key={e.mal_id}
                          onClick={() => navigate(`/anime/${e.mal_id}`)}
                          className="px-2 py-1 text-xs bg-dark-card rounded"
                        >
                          {e.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-sm">Нет связанных релизов.</p>
            )}
          </div>

          {/* Recommendations */}
          <div className="bg-dark-card p-4 rounded-lg mb-8">
            <h3 className="font-bold text-white mb-3">Рекомендации</h3>
            {recommendations && recommendations.length ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {recommendations.slice(0, 8).map(rec => {
                  const recAnime = rec.entry || rec;
                  return (
                    <div key={recAnime.mal_id || recAnime.uid} className="bg-dark-bg rounded p-2 text-sm">
                      <div className="font-semibold">{recAnime.title || recAnime.name}</div>
                      <div className="text-xs text-gray-400">Рейтинг: {rec.recommended_count || '-'}</div>
                      <button
                        onClick={() => navigate(`/anime/${recAnime.mal_id}`)}
                        className="mt-2 text-xs underline text-gray-300"
                      >
                        Подробнее
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-400 text-sm">Похожих аниме не найдено.</p>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default AnimePage;

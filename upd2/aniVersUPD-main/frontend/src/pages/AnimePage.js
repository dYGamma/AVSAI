// ./frontend/src/pages/AnimePage.js
import React, { useState, useEffect, useCallback, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import axios from 'axios';
import Loader from '../components/Loader';
import { PlayIcon } from '@heroicons/react/solid';
import { AuthContext } from '../App';

/**
 * AnimePage — страница информации об аниме.
 * Улучшения:
 *  - унифицированные классы .btn/.btn-primary/.card/.bottom-panel
 *  - мобильный bottom sheet, блокирующий прокрутку
 *  - синхронизация статуса в списке пользователя
 *  - удалён статус "on_hold"
 */

const JIKAN_BASE = 'https://api.jikan.moe/v4';

const MetaItem = ({ title, children }) => (
  <div className="flex items-start space-x-3">
    <div className="min-w-[1px] text-sm text-muted-2 w-40 md:w-56">{title}</div>
    <div className="text-sm text-gray-300">{children}</div>
  </div>
);

const Tag = ({ children }) => (
  <span className="inline-block text-xs px-2 py-1 bg-dark-card rounded-md text-gray-300 mr-2 mb-2">
    {children}
  </span>
);

// mapping statuses to Russian labels
const STATUS_LABELS = {
  watching: 'Смотрю',
  planned: 'В планах',
  completed: 'Завершено',
  dropped: 'Брошено'
};

const STATUS_ORDER = ['watching', 'planned', 'completed', 'dropped'];

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

  // Состояние списка пользователя
  const [currentStatus, setCurrentStatus] = useState(null); // 'watching' | 'planned' | 'completed' | 'dropped' | null
  const [menuOpen, setMenuOpen] = useState(false); // для десктопа - dropdown, для мобилки - bottom sheet
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  const [busy, setBusy] = useState(false);

  // Отслеживаем размер экрана (не условно — hook всегда вызывается)
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Блокировка скролла при открытой мобильной панели
  useEffect(() => {
    if (menuOpen && isMobile) {
      document.body.classList.add('no-scroll');
    } else {
      document.body.classList.remove('no-scroll');
    }
    return () => document.body.classList.remove('no-scroll');
  }, [menuOpen, isMobile]);

  // Загрузка основной информации об аниме
  // Теперь возвращает payload (чтобы использовать его синхронно ниже)
  const fetchAnime = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const { data } = await api.get(`/anime/${id}`);
      // Поддержка возможных форматов ответа
      const payload = data && (data.data || data.title || data.name) ? (data.data ? data.data : data) : data;
      setAnime(payload);
      return payload;
    } catch (err) {
      console.error('Ошибка загрузки данных аниме:', err);
      setErrorMsg('Не удалось загрузить информацию об аниме.');
      setAnime(null);
      return null;
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
    try {
      // pictures
      try {
        const picsRes = await axios.get(`${JIKAN_BASE}/anime/${id}/pictures`);
        setPictures(picsRes.data?.data || []);
      } catch (e) {
        setPictures([]);
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
      console.warn('Extras load failed', e);
    }
  }, [id]);

  // Получить текущий статус аниме у пользователя (если авторизован)
  const fetchUserAnimeStatus = useCallback(async () => {
    if (!auth?.isAuth) {
      setCurrentStatus(null);
      return null;
    }
    try {
      const { data } = await api.get('/list'); // возвращает массив user's list
      const list = data || [];
      const entry = list.find(item => {
        if (!item) return false;
        if (String(item.mal_id) === String(id)) return true;
        if (String(item.shikimori_id) === String(id)) return true;
        return false;
      });
      setCurrentStatus(entry?.status || null);
      return entry || null;
    } catch (e) {
      console.warn('Failed to fetch user list or not authorized:', e);
      setCurrentStatus(null);
      return null;
    }
  }, [auth, id]);

  // При загрузке страницы — грузим все данные (fetchAnime возвращает payload)
  useEffect(() => {
    (async () => {
      const payload = await fetchAnime();
      const player = await fetchPlayer();
      await fetchJikanExtras();
      await fetchUserAnimeStatus();

      // Проверим новые эпизоды (best-effort) — используем payload, а не внешний anime стейт
      try {
        const localEpisodes = Number(payload?.episodes) || 0;
        const playerCount = player?.episodes_total ? Number(player.episodes_total) : null;
        if (playerCount && playerCount > localEpisodes) {
          setIsNewEpisode(true);
          const from = localEpisodes + 1;
          const to = playerCount;
          const list = [];
          for (let ep = from; ep <= to; ep++) {
            let va = 'неизвестно';
            if (characters && characters.length) {
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
        setIsNewEpisode(false);
        setNewEpisodesList([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchAnime, fetchPlayer, fetchJikanExtras, fetchUserAnimeStatus, id]);

  // Обработчик нажатия "Смотреть" — запрашиваем плеер и переходим
  const handleWatchClick = async (selectedEpisode = null) => {
    try {
      setErrorMsg('');
      const { data } = await api.get(`/player/${id}`);
      navigate(`/watch/${id}`, {
        state: { playerData: data, animeTitle: anime?.title || anime?.title_english || 'Просмотр', selectedEpisode }
      });
    } catch (err) {
      console.error('Ошибка получения плеера:', err);
      setErrorMsg(err.response?.data?.message || 'Просмотр временно недоступен');
    }
  };

  // Обновление статуса аниме (POST /list)
  const updateStatus = async (status) => {
    if (!auth?.isAuth) {
      navigate('/login');
      return;
    }
    if (!status) return;
    setBusy(true);
    try {
      // animeData для бэкенда
      const animeData = {
        title: anime?.title || anime?.name || '',
        image_url: anime?.images?.jpg?.image_url || anime?.image_url || '',
        episodes: anime?.episodes || null
      };
      // используем mal_id — сервер в user.service допускает shikimori_id или mal_id
      await api.post('/list', { mal_id: Number(id), status, animeData });
      // Синхронизируем локально и с сервером
      setCurrentStatus(status);
      setMenuOpen(false);
      // остаточная проверка: обновим статус с сервера (на всякий случай)
      fetchUserAnimeStatus().catch(() => {});
      alert(`Статус обновлён: ${STATUS_LABELS[status]}`);
    } catch (e) {
      console.error('Не удалось обновить статус:', e);
      alert('Не удалось сохранить статус.');
    } finally {
      setBusy(false);
    }
  };

  // Удаление аниме из списка (DELETE /list/:mal_id)
  const removeFromList = async () => {
    if (!auth?.isAuth) {
      navigate('/login');
      return;
    }
    setBusy(true);
    try {
      await api.delete(`/list/${id}`);
      setCurrentStatus(null);
      setMenuOpen(false);
      // синхронизируем
      fetchUserAnimeStatus().catch(() => {});
      alert('Аниме удалено из списка');
    } catch (e) {
      console.error('Не удалось удалить из списка:', e);
      alert('Не удалось удалить из списка.');
    } finally {
      setBusy(false);
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
    if (A.broadcast) schedule = A.broadcast;
  }

  // trailer link
  const trailerUrl = A.trailer?.url || (A.trailer && A.trailer.embed_url) || null;

  // UI for status button (label)
  const statusLabel = currentStatus ? STATUS_LABELS[currentStatus] : 'Добавить в список';

  // Render dropdown for desktop
  const DesktopStatusDropdown = () => (
    <div className="relative inline-block text-left">
      <button
        onClick={() => setMenuOpen(prev => !prev)}
        className="w-full btn btn-dark"
        aria-expanded={menuOpen}
      >
        <span className="flex-1 text-left">{statusLabel}</span>
      </button>

      {menuOpen && (
        <div
          className="absolute mt-2 right-0 w-48 bg-dark-card border border-gray-700 rounded-lg shadow-lg p-2 z-50 dropdown"
          style={{ minWidth: 180 }}
        >
          <div className="text-xs text-muted px-2 pb-2">Выберите статус</div>
          <div className="space-y-2">
            {STATUS_ORDER.map(s => (
              <button
                key={s}
                onClick={() => updateStatus(s)}
                className={`w-full text-left px-3 py-2 rounded ${currentStatus === s ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-800'}`}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
            <div className="border-t border-gray-700 mt-2 pt-2">
              {currentStatus && (
                <button onClick={removeFromList} className="w-full text-left px-3 py-2 rounded text-red-400 hover:bg-gray-800">
                  Удалить из списка
                </button>
              )}
              <button onClick={() => setMenuOpen(false)} className="w-full text-left px-3 py-2 rounded text-gray-400 hover:bg-gray-800">
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Mobile bottom sheet
  const MobileStatusSheet = () => (
    <>
      <div className="bottom-panel fixed-bottom-sheet animate-slide-up z-60">
        <div className="sheet-handle" />
        <div className="mt-2">
          <div className="flex items-center justify-between px-2">
            <div>
              <div className="text-sm font-semibold">Статус в списке</div>
              <div className="text-xs text-muted">Выберите статус для этого аниме</div>
            </div>
            <button onClick={() => setMenuOpen(false)} className="text-sm text-muted">Закрыть</button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 px-2">
            {STATUS_ORDER.map(s => (
              <button
                key={s}
                onClick={() => updateStatus(s)}
                disabled={busy}
                className={`btn ${currentStatus === s ? 'btn-primary' : 'btn-ghost'} w-full`}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>

          <div className="px-2 mt-4">
            {currentStatus && (
              <button onClick={removeFromList} className="w-full py-3 rounded-lg btn-ghost" style={{ borderColor: 'rgba(255,50,50,0.18)', color: 'var(--danger)' }}>
                Удалить из списка
              </button>
            )}
          </div>
        </div>
      </div>

      {/* полупрозрачный backdrop */}
      <div onClick={() => setMenuOpen(false)} className="modal-backdrop z-50" />
    </>
  );

  return (
    <div className="p-4 main-with-bottom-space">
      {/* Banner / cover */}
      <div className="relative w-full h-48 md:h-64 rounded-lg overflow-hidden card">
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
                onClick={() => handleWatchClick(null)}
                className="w-full btn btn-primary flex items-center justify-center gap-2"
              >
                <PlayIcon className="w-5 h-5" />
                <span>Смотреть</span>
              </button>

              {/* Статус: на десктопе dropdown, на мобилке — кнопка, открывающая bottom sheet */}
              {!isMobile ? (
                <DesktopStatusDropdown />
              ) : (
                <>
                  <button
                    onClick={() => setMenuOpen(true)}
                    className="w-full btn btn-dark mt-2"
                  >
                    {statusLabel}
                  </button>
                </>
              )}

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
            <div className="mb-4 p-3 bg-yellow-500 rounded-lg text-black pulse-accent">
              <div className="font-bold">Версята, новая серия вышла!</div>
              <div className="mt-2 space-y-1 text-sm">
                {newEpisodesList.map(item => (
                  <div key={item.ep} className="flex items-center justify-between">
                    <div>Серия {item.ep} : <span className="font-semibold">{item.va}</span></div>
                    <div>
                      <button
                        onClick={() => {
                          if (playerData) {
                            navigate(`/watch/${id}`, { state: { playerData, animeTitle: title, selectedEpisode: item.ep } });
                          } else {
                            handleWatchClick(item.ep);
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
          <div className="bg-dark-card p-4 rounded-lg mb-4 card">
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

      {/* Mobile sheet render */}
      {isMobile && menuOpen && <MobileStatusSheet />}
    </div>
  );
};

export default AnimePage;

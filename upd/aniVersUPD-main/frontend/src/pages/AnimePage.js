// ./frontend/src/pages/AnimePage.js
import React, { useState, useEffect, useCallback, useContext, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import axios from 'axios';
import Loader from '../components/Loader';
import { PlayIcon, ChevronDownIcon, XIcon } from '@heroicons/react/solid';
import { AuthContext } from '../App';

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

// Убрали on_hold (Отложено)
const STATUS_LABELS = {
  watching: 'Смотрю',
  planned: 'В планах',
  completed: 'Завершено',
  dropped: 'Брошено'
};

const NAV_OFFSET = 64; // смещение для мобильного bottom-sheet: высота нижней навигации (поправь при необходимости)

const AnimePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { auth } = useContext(AuthContext);

  const [anime, setAnime] = useState(null);
  const [loading, setLoading] = useState(true);

  const [playerData, setPlayerData] = useState(null);
  const [pictures, setPictures] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [isNewEpisode, setIsNewEpisode] = useState(false);
  const [newEpisodesList, setNewEpisodesList] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');

  // menu state
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(null);

  const menuButtonRef = useRef(null);
  const menuRef = useRef(null);

  // dynamic portal position
  const [portalStyle, setPortalStyle] = useState({ top: 0, left: 0, transformOrigin: 'top left' });

  const safeGetAnimeObj = (respData) => {
    if (!respData) return null;
    if (respData.data && typeof respData.data === 'object') return respData.data;
    return respData;
  };

  const fetchAnime = useCallback(async () => {
    try {
      const res = await api.get(`/anime/${id}`);
      const payload = safeGetAnimeObj(res.data);
      setAnime(payload || null);
    } catch (err) {
      console.error('Ошибка загрузки данных аниме:', err);
      setErrorMsg('Не удалось загрузить информацию об аниме.');
      setAnime(null);
    }
  }, [id]);

  const fetchPlayer = useCallback(async () => {
    try {
      const res = await api.get(`/player/${id}`);
      setPlayerData(res.data || null);
      return res.data || null;
    } catch (err) {
      console.warn('Kodik player unavailable:', err?.response?.data || err.message);
      setPlayerData(null);
      return null;
    }
  }, [id]);

  const fetchJikanExtras = useCallback(async () => {
    try {
      const picsRes = await axios.get(`${JIKAN_BASE}/anime/${id}/pictures`);
      setPictures(picsRes.data?.data || []);
    } catch (e) {
      setPictures([]);
    }

    try {
      const charsRes = await axios.get(`${JIKAN_BASE}/anime/${id}/characters`);
      setCharacters(charsRes.data?.data || []);
    } catch (e) {
      setCharacters([]);
    }

    try {
      const recRes = await axios.get(`${JIKAN_BASE}/anime/${id}/recommendations`);
      setRecommendations(recRes.data?.data || []);
    } catch (e) {
      setRecommendations([]);
    }
  }, [id]);

  const fetchUserListAndSync = useCallback(async () => {
    if (!auth?.isAuth) {
      setSelectedStatus(null);
      return;
    }
    try {
      const res = await api.get('/list');
      const list = res.data || [];
      const entry = list.find(item => {
        const possibleIds = [
          item.shikimori_id,
          item.mal_id,
          item.id,
          item.animeId,
        ].map(String).filter(Boolean);
        return possibleIds.includes(String(id));
      });
      if (entry && entry.status) {
        setSelectedStatus(entry.status);
      } else {
        setSelectedStatus(null);
      }
    } catch (e) {
      setSelectedStatus(null);
    }
  }, [auth?.isAuth, id]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setErrorMsg('');
    (async () => {
      try {
        await Promise.all([fetchAnime(), fetchPlayer(), fetchJikanExtras()]);
        if (mounted) await fetchUserListAndSync();
      } catch (e) {
        console.warn('Some requests failed', e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [fetchAnime, fetchPlayer, fetchJikanExtras, fetchUserListAndSync]);

  useEffect(() => {
    try {
      if (!anime) {
        setIsNewEpisode(false);
        setNewEpisodesList([]);
        return;
      }
      const localEpisodes = Number(anime.episodes) || 0;
      const playerCount = playerData?.episodes_total ? Number(playerData.episodes_total) : null;
      if (playerCount && playerCount > localEpisodes) {
        setIsNewEpisode(true);
        const from = localEpisodes + 1;
        const to = playerCount;
        const list = [];
        for (let ep = from; ep <= to; ep++) {
          let va = 'неизвестно';
          if (characters && characters.length) {
            const firstWithVA = characters.find(c => Array.isArray(c.voice_actors) && c.voice_actors.length);
            if (firstWithVA) va = firstWithVA.voice_actors[0]?.person?.name || va;
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
  }, [anime, playerData, characters]);

  // Position portal dropdown for desktop
  const updatePortalPosition = useCallback(() => {
    const btn = menuButtonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const dropdownWidth = 240; // px (approx)
    const dropdownHeight = 220; // estimate
    const margin = 8;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    let left = rect.left + window.scrollX;
    if (left + dropdownWidth + margin > viewportW + window.scrollX) {
      left = Math.max(window.scrollX + margin, viewportW + window.scrollX - dropdownWidth - margin);
    }
    const spaceBelow = viewportH - rect.bottom;
    const spaceAbove = rect.top;
    let top;
    let transformOrigin = 'top left';
    if (spaceBelow >= dropdownHeight + margin) {
      top = rect.bottom + window.scrollY + margin;
      transformOrigin = 'top left';
    } else if (spaceAbove >= dropdownHeight + margin) {
      top = rect.top + window.scrollY - dropdownHeight - margin;
      transformOrigin = 'bottom left';
    } else {
      if (spaceBelow >= spaceAbove) {
        top = rect.bottom + window.scrollY + margin;
        transformOrigin = 'top left';
      } else {
        top = Math.max(window.scrollY + margin, rect.top + window.scrollY - dropdownHeight - margin);
        transformOrigin = 'bottom left';
      }
    }
    setPortalStyle({ top, left, transformOrigin, width: dropdownWidth });
  }, []);

  // when opening menu, compute position and add listeners to update on resize/scroll
  useEffect(() => {
    if (!menuOpen) return;
    updatePortalPosition();
    const onResize = () => updatePortalPosition();
    const onScroll = () => updatePortalPosition();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll);
    };
  }, [menuOpen, updatePortalPosition]);

  // Click outside to close (works for portal + mobile)
  useEffect(() => {
    const handleDocClick = (e) => {
      if (menuOpen) {
        const btn = menuButtonRef.current;
        const menuEl = menuRef.current;
        if (btn && btn.contains(e.target)) return;
        if (menuEl && menuEl.contains(e.target)) return;
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleDocClick);
    return () => document.removeEventListener('mousedown', handleDocClick);
  }, [menuOpen]);

  // Запретить скролл фона на мобильных, когда bottom-sheet открыт
  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    let touchHandler = null;
    if (menuOpen && isMobile) {
      // Запрещаем прокрутку страницы
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      // Для iOS/Android дополнительно блокируем touchmove (passive:false)
      touchHandler = function (e) { e.preventDefault(); };
      document.addEventListener('touchmove', touchHandler, { passive: false });
      return () => {
        document.body.style.overflow = prevOverflow || '';
        document.removeEventListener('touchmove', touchHandler);
      };
    }
    return () => {};
  }, [menuOpen]);

  const handleWatchClick = async (selectedEpisode = null) => {
    try {
      setErrorMsg('');
      const res = await api.get(`/player/${id}`);
      const player = res.data;
      navigate(`/watch/${id}`, {
        state: { playerData: player, animeTitle: anime?.title || anime?.title_english || 'Просмотр', selectedEpisode }
      });
    } catch (err) {
      console.error('Ошибка получения плеера:', err);
      setErrorMsg(err.response?.data?.message || 'Просмотр временно недоступен');
    }
  };

  const handleAddToList = async (newStatus = 'planned') => {
    if (!auth?.isAuth) {
      navigate('/login');
      return;
    }
    try {
      const animeData = {
        title: anime?.title || anime?.title_english || '',
        image_url: anime?.images?.jpg?.image_url || anime?.images?.jpg?.large_image_url || anime?.image_url || '',
        episodes: anime?.episodes || 0
      };
      await api.post('/list', { shikimori_id: Number(id), status: newStatus, animeData });
      setSelectedStatus(newStatus);
      setMenuOpen(false);
      try { await fetchUserListAndSync(); } catch (e) {}
      alert(`Сохранено: ${STATUS_LABELS[newStatus] || newStatus}`);
    } catch (e) {
      console.error('Не удалось добавить в список:', e);
      alert('Не удалось добавить в список.');
    }
  };

  if (loading) return <Loader />;

  if (!anime) {
    return <p className="text-center mt-10">Не удалось загрузить информацию об аниме.</p>;
  }

  const A = anime;
  const title = A.title || A.title_english || 'Без названия';
  const synopsis = A.synopsis || 'Описание отсутствует.';
  const imageUrl = A.images?.jpg?.large_image_url || A.images?.jpg?.image_url || A.image_url || '';
  const type = A.type || A.media_type || 'N/A';
  const episodes = A.episodes || A.episodes_count || null;
  const duration = A.duration || null;
  const seasonLabel = A.season ? `${A.season} ${A.year || ''}` : (A.aired?.string || '');
  const source = A.source || 'N/A';
  const studios = (A.studios || []).map(s => s.name).join(', ');
  const genres = (A.genres || []).map(g => g.name);
  const ratingScore = A.score;
  const rank = A.rank;
  const popularity = A.popularity;
  const members = A.members;
  let schedule = '—';
  if (A.status) {
    schedule = A.status;
    if (A.broadcast) schedule = A.broadcast;
  }
  const trailerUrl = A.trailer?.url || (A.trailer && A.trailer.embed_url) || null;

  const statusButtonLabel = selectedStatus ? (STATUS_LABELS[selectedStatus] || selectedStatus) : 'Выбрать статус';

  // Desktop portal dropdown
  const DesktopDropdownPortal = () => {
    if (!menuOpen) return null;
    if (window.innerWidth < 768) return null;
    const style = {
      position: 'absolute',
      top: portalStyle.top,
      left: portalStyle.left,
      width: portalStyle.width || 240,
      transformOrigin: portalStyle.transformOrigin || 'top left',
      zIndex: 9999
    };
    return createPortal(
      <div ref={menuRef} style={style} className="bg-dark-bg border border-gray-700 rounded-md shadow-lg overflow-auto" role="menu" aria-hidden={!menuOpen}>
        {Object.keys(STATUS_LABELS).map(key => (
          <button
            key={key}
            onClick={() => handleAddToList(key)}
            className="w-full text-left px-3 py-2 hover:bg-dark-card text-sm text-gray-200"
          >
            {STATUS_LABELS[key]}
          </button>
        ))}
      </div>,
      document.body
    );
  };

  return (
    <div className="p-4">
      {/* Banner */}
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
        {/* Left */}
        <div className="md:col-span-1">
          <div className="sticky top-20">
            <img src={imageUrl} alt={title} className="w-full rounded-lg shadow-2xl object-cover" />
            <div className="mt-4 space-y-3">
              <button
                onClick={() => handleWatchClick(null)}
                className="w-full bg-brand-purple text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 hover:bg-purple-600 transition-colors"
              >
                <PlayIcon className="w-5 h-5" />
                Смотреть
              </button>

              <button
                onClick={() => handleAddToList('planned')}
                className="w-full bg-dark-card text-white font-semibold py-3 px-4 rounded-lg border border-gray-700 hover:bg-gray-700 transition mt-2"
              >
                Добавить в список
              </button>

              <div className="relative mt-2">
                <button
                  ref={menuButtonRef}
                  onClick={() => setMenuOpen(prev => !prev)}
                  aria-expanded={menuOpen}
                  className="w-full flex items-center justify-between px-3 py-2 bg-dark-card rounded-md border border-gray-700 text-sm text-gray-300"
                >
                  {statusButtonLabel}
                  <ChevronDownIcon className="w-4 h-4 ml-2" />
                </button>

                <DesktopDropdownPortal />

                {/* Mobile bottom-sheet (small screens) — привязан к нижней навигации, блокирует скролл */}
                {menuOpen && window.innerWidth < 768 && (
                  <div className="md:hidden">
                    <div className="fixed inset-0 z-50">
                      <div className="absolute inset-0 bg-black/50" onClick={() => setMenuOpen(false)} />
                      <div
                        className="absolute left-0 right-0 bg-dark-bg border-t border-gray-700 rounded-t-xl overflow-auto p-3"
                        style={{
                          bottom: NAV_OFFSET, // привязка к низу навигации
                          maxHeight: `calc(60vh)`,
                        }}
                        ref={menuRef}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium text-white">Выберите статус</div>
                          <button onClick={() => setMenuOpen(false)} className="p-1 rounded-md">
                            <XIcon className="w-5 h-5 text-gray-300" />
                          </button>
                        </div>
                        <div className="space-y-1">
                          {Object.keys(STATUS_LABELS).map(key => (
                            <button
                              key={key}
                              onClick={() => handleAddToList(key)}
                              className="w-full text-left px-3 py-3 hover:bg-dark-card rounded text-sm"
                            >
                              {STATUS_LABELS[key]}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {trailerUrl && (
                <a href={trailerUrl} target="_blank" rel="noopener noreferrer" className="block text-center text-sm text-gray-300 underline mt-2">
                  Смотреть трейлер
                </a>
              )}

              {errorMsg && <p className="text-sm text-red-500 mt-2">{errorMsg}</p>}
            </div>
          </div>
        </div>

        {/* Right */}
        <div className="md:col-span-3">
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

          <div className="bg-dark-card p-4 rounded-lg mb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MetaItem title="Страна / Сезон">
                {A.aired?.string || seasonLabel || '—'}
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

          <div className="bg-dark-bg p-4 rounded-lg mb-4">
            <h3 className="font-bold text-white text-lg mb-2">Описание</h3>
            <p className="text-gray-300 text-sm whitespace-pre-line">{synopsis}</p>
          </div>

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

          <div className="bg-dark-card p-4 rounded-lg mb-8">
            <h3 className="font-bold text-white mb-3">Рекомендации</h3>
            {recommendations && recommendations.length ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {recommendations.slice(0, 8).map((rec) => {
                  const recAnime = rec.entry || rec;
                  const recId = recAnime.mal_id || recAnime.uid || recAnime.id;
                  const recTitle = recAnime.title || recAnime.name;
                  return (
                    <div key={recId || recTitle} className="bg-dark-bg rounded p-2 text-sm">
                      <div className="font-semibold">{recTitle}</div>
                      <div className="text-xs text-gray-400">Рейтинг: {rec.recommended_count || '-'}</div>
                      <button
                        onClick={() => navigate(`/anime/${recAnime.mal_id || recAnime.uid || recAnime.id}`)}
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

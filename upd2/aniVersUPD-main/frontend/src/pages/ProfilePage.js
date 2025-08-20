// ./frontend/src/pages/ProfilePage.js
import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { AuthContext } from '../App';
import Sparkline from '../components/Sparkline';
import ProfileEditModal from '../components/ProfileEditModal';
import Loader from '../components/Loader';
import { UserIcon } from '@heroicons/react/outline';

const ProfilePage = () => {
  const params = useParams();
  const { auth, setAuth } = useContext(AuthContext);
  const navigate = useNavigate();

  // Надёжно получаем id целевого профиля: либо из URL, либо из авторизованного юзера (.id или ._id)
  const targetId = params.id || auth?.user?.id || auth?.user?._id || null;

  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [dynamics, setDynamics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [friendLoading, setFriendLoading] = useState(false);

  // Не редиректим до тех пор, пока не известен статус авторизации (auth.isLoading)
  useEffect(() => {
    // Если контекст предоставляет флаг загрузки — используем его.
    // Если нет — будем действовать аккуратно (не сразу редиректим).
    const isAuthLoaded = auth?.isLoading === false || typeof auth?.isLoading === 'undefined';
    if (!targetId && isAuthLoaded) {
      navigate('/login');
    }
  }, [targetId, navigate, auth]);

  const isMe = Boolean(auth?.user && String(auth.user.id || auth.user._id) === String(targetId));

  const fetchProfile = useCallback(async () => {
    if (!targetId) return;
    try {
      setLoading(true);
      const res = await api.get(`/users/${targetId}`);
      // поддерживаем варианты: res.data или res.data.user
      const payload = res?.data?.user ? res.data.user : res?.data ? res.data : null;
      setProfile(payload);
    } catch (err) {
      console.error('fetchProfile error', err);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [targetId]);

  const fetchStats = useCallback(async () => {
    if (!targetId) return;
    try {
      const res = await api.get(`/users/${targetId}/stats`);
      setStats(res?.data ?? null);
    } catch (err) {
      console.error('fetchStats error', err);
      setStats(null);
    }
  }, [targetId]);

  const fetchRecent = useCallback(async () => {
    if (!targetId) return;
    try {
      const res = await api.get(`/users/${targetId}/recent`);
      setRecent(res?.data || []);
    } catch (err) {
      console.error('fetchRecent error', err);
      setRecent([]);
    }
  }, [targetId]);

  const fetchDynamics = useCallback(async () => {
    if (!targetId) return;
    try {
      const res = await api.get(`/users/${targetId}/dynamics?days=14`);
      setDynamics(res?.data || []);
    } catch (err) {
      console.error('fetchDynamics error', err);
      setDynamics([]);
    }
  }, [targetId]);

  // Загружаем всё при монтировании / когда targetId изменится
  useEffect(() => {
    fetchProfile();
    fetchStats();
    fetchRecent();
    fetchDynamics();
  }, [fetchProfile, fetchStats, fetchRecent, fetchDynamics]);

  const openEdit = () => setEditing(true);

  const handleSave = async (data) => {
    try {
      const res = await api.put('/users/me', data);
      const saved = res?.data ?? res;
      // обновляем auth.user если редактируем свой профиль
      if (isMe) {
        setAuth(prev => ({ ...prev, user: { ...prev?.user, ...(saved || {}) } }));
      }
      setProfile(prev => ({ ...(prev || {}), ...(saved || {}) }));
      setEditing(false);
    } catch (err) {
      console.error('Failed to save profile', err);
      alert('Не удалось сохранить профиль');
    }
  };

  const sendFriendRequest = async () => {
    if (!auth?.isAuth) return navigate('/login');
    try {
      setFriendLoading(true);
      await api.post(`/users/${targetId}/request-friend`);
      await fetchProfile();
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || 'Не удалось отправить запрос');
    } finally {
      setFriendLoading(false);
    }
  };

  const acceptFriend = async () => {
    try {
      setFriendLoading(true);
      await api.post(`/users/${targetId}/accept-friend`);
      await fetchProfile();
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || 'Не удалось принять запрос');
    } finally {
      setFriendLoading(false);
    }
  };

  const removeFriend = async () => {
    try {
      setFriendLoading(true);
      await api.delete(`/users/${targetId}/friend`);
      await fetchProfile();
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || 'Не удалось удалить из друзей');
    } finally {
      setFriendLoading(false);
    }
  };

  if (loading) return <Loader />;
  if (!profile) return <p className="text-center mt-10">Профиль не найден.</p>;

  // Sticker source (inline only). Не показываем на аватаре.
  const stickerSrc = profile?.sticker
    ? (String(profile.sticker).startsWith('http') ? profile.sticker : `/assets/stickers/${profile.sticker}.png`)
    : null;

  // avatar/cover: если относительный путь — используем как есть (nginx проксирует /uploads)
  const avatarSrc = profile?.avatar_url ? profile.avatar_url : null;
  const coverStyle = profile?.cover_url ? { backgroundImage: `url(${profile.cover_url})` } : {};

  return (
    <div className="max-w-4xl mx-auto p-4 main-with-bottom-space app-safe-bottom">
      {/* Cover */}
      <div
        className="relative rounded-lg overflow-hidden mb-6 profile-cover"
        style={{
          ...coverStyle,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundColor: '#0b1220'
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black opacity-60"></div>

        <div className="absolute left-4 bottom-4 flex items-end space-x-4">
          <div className="relative profile-avatar overflow-hidden bg-gray-800 border-4 border-dark-card rounded-full flex-shrink-0 w-24 h-24 md:w-28 md:h-28">
            {avatarSrc ? (
              <img src={avatarSrc} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <UserIcon className="w-8 h-8 md:w-10 md:h-10" />
              </div>
            )}
          </div>

          <div className="text-white">
            <div className="flex items-center gap-3">
              <h1 className="text-lg md:text-2xl font-bold leading-tight">
                {profile.nickname || profile.email}
              </h1>
              {/* Inline sticker near nickname (единственный бейдж) */}
              {stickerSrc && <img src={stickerSrc} alt="sticker-inline" className="sticker-inline" />}
            </div>
            <p className="text-sm md:text-base text-gray-300 max-w-xs md:max-w-md truncate">
              {profile.bio || '—'}
            </p>
          </div>
        </div>
      </div>

      <div className="profile-grid">
        {/* Left column: actions & social */}
        <div className="space-y-4">
          <div className="card">
            {isMe ? (
              <div className="flex items-center gap-3">
                <button onClick={openEdit} className="flex-1 py-2 rounded bg-brand-accent text-black font-bold touch-target">
                  Редактировать профиль
                </button>
                <button
                  onClick={() => {
                    localStorage.removeItem('token');
                    setAuth({ isAuth: false, user: null, isLoading: false });
                    navigate('/');
                  }}
                  className="py-2 px-3 rounded bg-red-600 text-white touch-target"
                >
                  Выйти
                </button>
              </div>
            ) : (
              <div className="flex flex-col space-y-2">
                {!profile.isFriend && !profile.requestPending && (
                  <button onClick={sendFriendRequest} disabled={friendLoading} className="py-2 rounded bg-brand-accent text-black font-bold touch-target">
                    Добавить в друзья
                  </button>
                )}
                {profile.requestPending && (
                  <button onClick={acceptFriend} disabled={friendLoading} className="py-2 rounded bg-green-600 text-white font-bold touch-target">
                    Принять запрос
                  </button>
                )}
                {profile.isFriend && (
                  <button onClick={removeFriend} disabled={friendLoading} className="py-2 rounded bg-red-600 text-white font-bold touch-target">
                    Удалить из друзей
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="card">
            <h3 className="font-bold mb-2">Социальные сети</h3>
            <div className="text-sm text-gray-300 space-y-1">
              {profile.social_links?.website && (
                <div>
                  <a className="profile-link break-words" href={profile.social_links.website} target="_blank" rel="noreferrer">
                    {profile.social_links.website}
                  </a>
                </div>
              )}
              {profile.social_links?.telegram && (
                <div>
                  <a className="profile-link" href={profile.social_links.telegram} target="_blank" rel="noreferrer">
                    Telegram
                  </a>
                </div>
              )}
              {profile.social_links?.twitter && (
                <div>
                  <a className="profile-link" href={profile.social_links.twitter} target="_blank" rel="noreferrer">
                    Twitter
                  </a>
                </div>
              )}
              {profile.social_links?.vk && (
                <div>
                  <a className="profile-link" href={profile.social_links.vk} target="_blank" rel="noreferrer">
                    VK
                  </a>
                </div>
              )}
              {profile.social_links?.discord && (
                <div>
                  Discord: <span className="text-gray-200">{profile.social_links.discord}</span>
                </div>
              )}
              {!profile.social_links && <div className="text-gray-500">Пользователь не добавил ссылки</div>}
            </div>
          </div>
        </div>

        {/* Right column: stats, recent, friends */}
        <div className="space-y-4">
          <div className="card flex items-center justify-between">
            <div>
              <h3 className="font-bold text-lg">Статистика</h3>
              <div className="flex flex-wrap items-center mt-2 gap-3 text-sm text-gray-300">
                <div>
                  Всего: <span className="font-semibold text-white">{stats?.total ?? '—'}</span>
                </div>
                <div>
                  Смотрю: <span className="font-semibold">{stats?.watching ?? 0}</span>
                </div>
                <div>
                  В планах: <span className="font-semibold">{stats?.planned ?? 0}</span>
                </div>
                <div>
                  Просмотрено: <span className="font-semibold">{stats?.completed ?? 0}</span>
                </div>
                <div>
                  Брошено: <span className="font-semibold">{stats?.dropped ?? 0}</span>
                </div>
              </div>
            </div>

            <div className="hidden md:block w-48">
              <Sparkline data={dynamics} width={180} height={50} />
            </div>
          </div>

          <div className="card">
            <h3 className="font-bold mb-3">Просмотрено недавно</h3>
            {recent.length === 0 ? (
              <p className="text-gray-400">Нет недавно просмотренных эпизодов.</p>
            ) : (
              <div className="space-y-2">
                {recent.map((r, i) => (
                  <div key={`${r.mal_id}-${r.watched_at}-${i}`} className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-white truncate text-truncate">{r.title || r.mal_id}</div>
                      <div className="text-sm text-gray-400">
                        Серия {r.episode} — {new Date(r.watched_at).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <button onClick={() => navigate(`/anime/${r.mal_id}`)} className="px-3 py-1 rounded bg-gray-700 text-white touch-target">
                        Открыть
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h3 className="font-bold mb-3">Друзья ({profile.friends?.length || 0})</h3>
            {(!profile.friends || profile.friends.length === 0) ? (
              <p className="text-gray-400">Пока нет друзей.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {profile.friends.map(friend => {
                  const friendSticker = friend.sticker || null;
                  const friendStickerSrc = friendSticker
                    ? (String(friendSticker).startsWith('http') ? friendSticker : `/assets/stickers/${friendSticker}.png`)
                    : null;
                  const friendAvatar = friend.avatar_url || `https://i.pravatar.cc/40?u=${friend._id || friend.id}`;
                  return (
                    <div key={friend._id || friend.id} className="flex items-center space-x-3 bg-gray-800 p-2 rounded">
                      <div className="relative">
                        <img src={friendAvatar} alt="a" className="w-10 h-10 rounded-full object-cover" />
                        {friendStickerSrc && <img src={friendStickerSrc} alt="st" className="sticker-small" />}
                      </div>
                      <div>
                        <div className="font-medium text-white">{friend.nickname || friend.email}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {editing && <ProfileEditModal initial={profile} onClose={() => setEditing(false)} onSave={handleSave} />}
    </div>
  );
};

export default ProfilePage;

// /frontend/src/components/AddToListButton.js
import React, { useState, useRef, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { AuthContext } from '../App';
import { PlusIcon, CheckIcon, XIcon } from '@heroicons/react/solid';

/**
 * AddToListButton
 *
 * Props:
 *  - anime: объект аниме (как возвращает Jikan)
 *  - currentStatus: строка текущего статуса пользователя для этого аниме
 *  - onChange: function(newList) -> вызывается после успешного обновления списка на бэке
 *
 * Поведение:
 *  - Если не авторизован -> перенаправляет на /login
 *  - Открывает dropdown с возможностью выбрать статус
 *  - Если выбран тот же статус -> удаляет из списка (toggle)
 *  - Вызывает POST /api/list или DELETE /api/list/:mal_id и затем получает обновлённый список /api/list
 */
const STATUSES = [
  { key: 'watching', label: 'Смотрю' },
  { key: 'planned', label: 'В планах' },
  { key: 'completed', label: 'Просмотрено' },
  { key: 'on_hold', label: 'Отложено' },
  { key: 'dropped', label: 'Брошено' },
];

const AddToListButton = ({ anime = {}, currentStatus = null, onChange = () => {} }) => {
  const { auth } = useContext(AuthContext);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const menuRef = useRef(null);

  // Закрытие при клике вне меню
  useEffect(() => {
    const handleDocClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleDocClick);
    return () => document.removeEventListener('mousedown', handleDocClick);
  }, []);

  // Подготовка данных аниме для отправки на сервер
  const animeData = {
    title: anime?.title || anime?.name || '',
    image_url: anime?.images?.jpg?.large_image_url || anime?.images?.jpg?.image_url || anime?.image_url || '',
    episodes: anime?.episodes || anime?.episodes_total || 0,
    mal_id: anime?.mal_id || anime?.id || '',
  };

  const idForDelete = animeData.mal_id || animeData.title || '';

  const ensureAuthOrRedirect = () => {
    if (!auth?.isAuth) {
      navigate('/login');
      return false;
    }
    return true;
  };

  const handlePick = async (statusKey) => {
    if (!ensureAuthOrRedirect()) return;
    setLoading(true);
    try {
      if (currentStatus === statusKey) {
        // Удаляем из списка
        await api.delete(`/list/${encodeURIComponent(idForDelete)}`);
        // Обновим список
        const listRes = await api.get('/list');
        onChange(listRes.data);
      } else {
        // Добавляем/обновляем статус
        const payload = {
          shikimori_id: String(animeData.mal_id || ''),
          mal_id: String(animeData.mal_id || ''),
          status: statusKey,
          animeData,
        };
        const res = await api.post('/list', payload);
        // Если сервер вернул список, отдадим его, иначе запросим
        if (Array.isArray(res.data)) {
          onChange(res.data);
        } else {
          const listRes = await api.get('/list');
          onChange(listRes.data);
        }
      }
      setOpen(false);
    } catch (err) {
      console.error('AddToListButton error', err);
      alert(err?.response?.data?.message || 'Не удалось обновить список');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    if (!ensureAuthOrRedirect()) return;
    if (!confirm('Удалить аниме из списка?')) return;
    setLoading(true);
    try {
      await api.delete(`/list/${encodeURIComponent(idForDelete)}`);
      const listRes = await api.get('/list');
      onChange(listRes.data);
      setOpen(false);
    } catch (err) {
      console.error('Remove error', err);
      alert('Не удалось удалить из списка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative inline-block w-full md:w-auto" ref={menuRef}>
      <button
        onClick={() => {
          if (!ensureAuthOrRedirect()) return;
          setOpen(prev => !prev);
        }}
        className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold transition-shadow w-full ${
          currentStatus ? 'bg-gray-700 text-white' : 'bg-dark-card text-gray-100'
        } hover:shadow-md`}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <PlusIcon className="w-5 h-5" />
        {currentStatus ? 'В списке' : 'Добавить в список'}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-dark-card border border-gray-700 rounded-lg shadow-lg z-50">
          <div className="p-2">
            {STATUSES.map(s => (
              <button
                key={s.key}
                onClick={() => handlePick(s.key)}
                disabled={loading}
                className={`w-full text-left px-3 py-2 rounded-md mb-1 transition-colors flex items-center justify-between ${
                  currentStatus === s.key ? 'bg-brand-purple text-white' : 'text-gray-200 hover:bg-gray-700'
                }`}
              >
                <span>{s.label}</span>
                {currentStatus === s.key ? <CheckIcon className="w-4 h-4" /> : null}
              </button>
            ))}

            <div className="mt-2 border-t border-gray-700 pt-2">
              <button
                onClick={handleRemove}
                className="w-full text-left px-3 py-2 rounded-md text-sm text-red-400 hover:bg-gray-700"
                disabled={loading}
              >
                <div className="flex items-center justify-between">
                  <span>Удалить из списка</span>
                  <XIcon className="w-4 h-4" />
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddToListButton;

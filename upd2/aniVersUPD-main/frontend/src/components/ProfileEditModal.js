// ./frontend/src/components/ProfileEditModal.js
import React, { useEffect, useRef, useState } from 'react';
import api from '../api';
import { XIcon, UploadIcon } from '@heroicons/react/outline';

const ProfileEditModal = ({ initial = {}, onClose, onSave }) => {
    const [nickname, setNickname] = useState(initial.nickname || '');
    const [bio, setBio] = useState(initial.bio || '');
    const [socialLinks, setSocialLinks] = useState(initial.social_links || {});
    const [selectedSticker, setSelectedSticker] = useState(initial.sticker || null);

    const [avatarFile, setAvatarFile] = useState(null);
    const [coverFile, setCoverFile] = useState(null);
    const [uploading, setUploading] = useState(false);

    const sheetRef = useRef(null);

    useEffect(() => {
        // Блокируем скролл и pull-to-refresh на фоне
        const prevOverflow = document.body.style.overflow;
        const prevOverscroll = document.body.style.overscrollBehavior;
        document.body.style.overflow = 'hidden';
        document.body.style.overscrollBehavior = 'none';

        const handleTouchMove = (e) => {
            // предотвращаем скролл фона при движении на модалке
            if (!sheetRef.current) return;
            if (!sheetRef.current.contains(e.target)) {
                e.preventDefault();
            }
        };
        document.addEventListener('touchmove', handleTouchMove, { passive: false });

        return () => {
            document.removeEventListener('touchmove', handleTouchMove);
            document.body.style.overflow = prevOverflow;
            document.body.style.overscrollBehavior = prevOverscroll;
        };
    }, []);

    const onAvatarChange = (e) => {
        const f = e.target.files?.[0];
        if (f) setAvatarFile(f);
    };
    const onCoverChange = (e) => {
        const f = e.target.files?.[0];
        if (f) setCoverFile(f);
    };

    const doUploadFile = async (file, endpoint) => {
        const form = new FormData();
        form.append('file', file);
        // если у вас сервер ожидает поле 'avatar'/'cover' — замените имя
        try {
            const res = await api.post(endpoint, form, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            return res.data;
        } catch (err) {
            console.error('upload error', err);
            throw err;
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setUploading(true);
        try {
            const updates = { nickname, bio, social_links: socialLinks, sticker: selectedSticker };

            // Если есть файлы — загружаем и подставляем пути
            if (avatarFile) {
                // backend route .uploadAvatar: POST /api/users/me/avatar (multer: field 'avatar')
                const avatarRes = await doUploadFile(avatarFile, '/api/users/me/avatar');
                if (avatarRes?.avatar_url) updates.avatar_url = avatarRes.avatar_url;
                if (avatarRes?.user) {
                    // опционально: обновить локальные данные
                }
            }
            if (coverFile) {
                const coverRes = await doUploadFile(coverFile, '/api/users/me/cover');
                if (coverRes?.cover_url) updates.cover_url = coverRes.cover_url;
            }

            // Отправляем остальные обновления
            await onSave(updates);
        } catch (err) {
            console.error('save profile error', err);
            alert(err.response?.data?.message || 'Ошибка при обновлении профиля');
        } finally {
            setUploading(false);
        }
    };

    // Простая верстка bottom-sheet — приклеена к низу
    return (
        <div className="fixed inset-0 z-60 flex items-end justify-center">
            {/* Фон */}
            <div onClick={onClose} className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>

            {/* Лист */}
            <div ref={sheetRef} className="relative w-full max-w-3xl bg-dark-card rounded-t-2xl p-4 shadow-2xl transform translate-y-0">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <h3 className="text-lg font-bold">Редактировать профиль</h3>
                        {/* Отображаем выбранный стикер рядом с заголовком */}
                        {selectedSticker && (
                            <img src={selectedSticker.startsWith('http') ? selectedSticker : `/assets/stickers/${selectedSticker}.png`} alt="st" className="w-6 h-6" />
                        )}
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-700">
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3">
                    <div>
                        <label className="block text-sm text-gray-300 mb-1">Ник</label>
                        <input value={nickname} onChange={(e) => setNickname(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white" />
                    </div>

                    <div>
                        <label className="block text-sm text-gray-300 mb-1">О себе</label>
                        <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"></textarea>
                    </div>

                    <div>
                        <label className="block text-sm text-gray-300 mb-1">Аватар</label>
                        <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 cursor-pointer bg-gray-700 px-3 py-2 rounded">
                                <UploadIcon className="w-4 h-4" />
                                <span className="text-sm">Выбрать</span>
                                <input onChange={onAvatarChange} accept="image/*" type="file" className="hidden" />
                            </label>
                            {avatarFile && <div className="text-sm text-gray-300 truncate">{avatarFile.name}</div>}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm text-gray-300 mb-1">Обложка</label>
                        <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 cursor-pointer bg-gray-700 px-3 py-2 rounded">
                                <UploadIcon className="w-4 h-4" />
                                <span className="text-sm">Выбрать</span>
                                <input onChange={onCoverChange} accept="image/*" type="file" className="hidden" />
                            </label>
                            {coverFile && <div className="text-sm text-gray-300 truncate">{coverFile.name}</div>}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm text-gray-300 mb-1">Стикер (бейдж)</label>
                        <div className="flex items-center gap-3">
                            <button type="button" onClick={() => setSelectedSticker('beta')} className={`px-3 py-1 rounded ${selectedSticker === 'beta' ? 'bg-brand-purple text-white' : 'bg-gray-700 text-gray-200'}`}>Бета-тестер</button>
                            {selectedSticker && <div className="text-sm text-gray-300">Выбран: <img src={`/assets/stickers/${selectedSticker}.png`} alt="st" className="inline-block w-5 h-5 ml-2 align-middle" /></div>}
                        </div>
                    </div>

                    <div className="flex items-center justify-between mt-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 rounded bg-gray-600 text-white">Отмена</button>
                        <button type="submit" disabled={uploading} className="px-4 py-2 rounded bg-brand-purple text-white">{uploading ? 'Сохраняем...' : 'Сохранить'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProfileEditModal;

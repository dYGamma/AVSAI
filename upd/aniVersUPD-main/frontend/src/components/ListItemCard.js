import React from 'react';
import { StarIcon } from '@heroicons/react/solid';

const ListItemCard = ({ anime, onClick }) => {
    // ИСПРАВЛЕНИЕ: Безопасно получаем URL изображения из структуры Jikan API
    const imageUrl = anime?.images?.jpg?.large_image_url || anime?.image_url;
    const description = anime?.synopsis || 'Нет описания.';
    
    return (
        <div onClick={onClick} className="flex bg-dark-bg space-x-4 cursor-pointer group">
            <img
                src={imageUrl}
                alt={anime.title}
                className="w-28 h-40 object-cover rounded-lg flex-shrink-0 bg-dark-card"
            />
            <div className="flex flex-col justify-between py-1 overflow-hidden">
                <div>
                    <h3 className="font-bold text-base truncate text-white group-hover:text-brand-purple transition-colors">{anime.title}</h3>
                    <div className="flex items-center text-sm text-gray-400 mt-1">
                        <span>{anime.episodes || '?'} эп.</span>
                        <span className="mx-1.5">&bull;</span>
                        <StarIcon className="w-4 h-4 text-yellow-400 mr-1" />
                        <span>{anime.score || 'N/A'}</span>
                    </div>
                    <p className="text-sm text-gray-400 mt-2 clamp-3">
                        {description}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ListItemCard;

import React from 'react';
import { Link } from 'react-router-dom';
import { StarIcon } from '@heroicons/react/solid';

const AnimeCard = ({ anime }) => {
    return (
        <Link to={`/anime/${anime.mal_id}`} className="bg-dark-card rounded-lg overflow-hidden shadow-lg hover:shadow-brand-purple/50 transition-shadow duration-300">
            <img src={anime.images.jpg.large_image_url} alt={anime.title} className="w-full h-64 object-cover" />
            <div className="p-4">
                <h3 className="font-bold text-lg truncate" title={anime.title}>{anime.title}</h3>
                <div className="flex items-center justify-between text-sm text-gray-400 mt-2">
                    <span>{anime.type}, {anime.year || 'N/A'}</span>
                    <div className="flex items-center">
                        <StarIcon className="w-4 h-4 text-yellow-400 mr-1" />
                        <span>{anime.score || 'N/A'}</span>
                    </div>
                </div>
            </div>
        </Link>
    );
};

export default AnimeCard;

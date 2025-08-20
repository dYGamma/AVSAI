import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, SearchIcon, BellIcon, CogIcon } from '@heroicons/react/outline';

// Этот компонент будет отображаться на всех страницах, кроме главной
const Header = () => {
    const navigate = useNavigate();

    return (
        <header className="bg-dark-bg sticky top-0 z-40 p-4 flex items-center justify-between">
            <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-dark-card">
                <ArrowLeftIcon className="w-6 h-6 text-gray-300" />
            </button>
            <div className="flex items-center space-x-2">
                 <button className="p-2 rounded-full hover:bg-dark-card">
                    <SearchIcon className="w-6 h-6 text-gray-300" />
                </button>
                 <button className="p-2 rounded-full hover:bg-dark-card">
                    <BellIcon className="w-6 h-6 text-gray-300" />
                </button>
                 <button className="p-2 rounded-full hover:bg-dark-card">
                    <CogIcon className="w-6 h-6 text-gray-300" />
                </button>
            </div>
        </header>
    );
};

export default Header;

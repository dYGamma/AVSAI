import React, { useContext } from 'react';
import { NavLink } from 'react-router-dom';
import { AuthContext } from '../App';
import { HomeIcon, BookmarkIcon, UserIcon, FilmIcon, SearchIcon, LoginIcon } from '@heroicons/react/outline';

const BottomNav = () => {
    const { auth } = useContext(AuthContext);

    // Динамически формируем массив кнопок в зависимости от статуса авторизации
    const navItems = [
      { path: '/', label: 'Главная', icon: HomeIcon },
      { path: '/explore', label: 'Обзор', icon: SearchIcon },
      { path: '/bookmarks', label: 'Закладки', icon: BookmarkIcon },
      { path: '/feed', label: 'Лента', icon: FilmIcon },
      // Если пользователь авторизован - показываем "Профиль", если нет - "Войти"
      auth.isAuth
        ? { path: '/profile', label: 'Профиль', icon: UserIcon }
        : { path: '/login', label: 'Войти', icon: LoginIcon }
    ];

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-dark-card border-t border-gray-700 flex justify-around items-center h-16 z-50">
            {navItems.map((item) => (
                <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                        `flex flex-col items-center justify-center text-xs w-full pt-1 transition-colors ${
                            isActive ? 'text-brand-purple' : 'text-gray-400 hover:text-white'
                        }`
                    }
                >
                    <item.icon className="h-6 w-6 mb-1" />
                    <span>{item.label}</span>
                </NavLink>
            ))}
        </nav>
    );
};

export default BottomNav;

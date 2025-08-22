import React, { useContext } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { AuthContext } from '../App';

// Этот компонент проверяет, авторизован ли пользователь.
// Если нет - перенаправляет на страницу входа.
// Если да - показывает дочерний роут (например, страницу профиля).
const ProtectedRoute = () => {
    const { auth } = useContext(AuthContext);

    if (auth.isLoading) {
        return null; // или можно показать спиннер на весь экран
    }

    return auth.isAuth ? <Outlet /> : <Navigate to="/login" />;
};

export default ProtectedRoute;

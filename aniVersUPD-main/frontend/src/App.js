import React, { useState, useEffect, createContext } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute'; // Защита роутов
import MainPage from './pages/MainPage';
import AnimePage from './pages/AnimePage';
import WatchPage from './pages/WatchPage';
import BookmarksPage from './pages/BookmarksPage';
import ProfilePage from './pages/ProfilePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ExplorePage from './pages/ExplorePage'; // Новая страница
import FeedPage from './pages/FeedPage'; // Новая страница
import AuthService from './services/AuthService';

export const AuthContext = createContext(null);

function App() {
    const [auth, setAuth] = useState({ isAuth: false, user: null, isLoading: true });

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const response = await AuthService.checkAuth();
                localStorage.setItem('token', response.data.accessToken);
                setAuth({ isAuth: true, user: response.data.user, isLoading: false });
            } catch (e) {
                setAuth({ isAuth: false, user: null, isLoading: false });
            }
        };
        checkAuth();
    }, []);

    return (
        <AuthContext.Provider value={{ auth, setAuth }}>
            <Routes>
                <Route path="/" element={<Layout />}>
                    {/* Общие роуты */}
                    <Route index element={<MainPage />} />
                    <Route path="anime/:id" element={<AnimePage />} />
                    <Route path="explore" element={<ExplorePage />} />
                    <Route path="feed" element={<FeedPage />} />

                    {/* Роуты для неавторизованных пользователей */}
                    <Route path="login" element={<LoginPage />} />
                    <Route path="register" element={<RegisterPage />} />

                    {/* Защищенные роуты */}
                    <Route element={<ProtectedRoute />}>
                        <Route path="watch/:id" element={<WatchPage />} />
                        <Route path="bookmarks" element={<BookmarksPage />} />
                        <Route path="profile" element={<ProfilePage />} />
                    </Route>
                </Route>
            </Routes>
        </AuthContext.Provider>
    );
}

export default App;

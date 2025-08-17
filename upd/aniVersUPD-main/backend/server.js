// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const path = require('path');

const router = require('./routes/index');
const errorMiddleware = require('./middlewares/error.middleware');

const PORT = process.env.PORT || 5001;
const app = express();

// Безопасная настройка strictQuery (предупреждение mongoose)
mongoose.set('strictQuery', false);

app.use(express.json());
app.use(cookieParser());
app.use(cors({
    credentials: true,
    origin: process.env.CLIENT_URL,
}));

// Раздаём загруженные файлы (аватары/обложки) по пути /uploads
// Например: GET /uploads/abcd-123.png -> backend/uploads/abcd-123.png
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API
app.use('/api', router);

// Middleware для обработки ошибок должен быть последним
app.use(errorMiddleware);

// Логируем uncaught exceptions/unhandled rejections чтобы не терять причину
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
});

const start = async () => {
    try {
        await mongoose.connect(process.env.DB_URL);
        console.log('Connected to MongoDB');
        app.listen(PORT, () => console.log(`Backend server started on PORT = ${PORT}`));
    } catch (e) {
        console.error('Failed to connect to MongoDB', e);
        process.exit(1);
    }
};

start();

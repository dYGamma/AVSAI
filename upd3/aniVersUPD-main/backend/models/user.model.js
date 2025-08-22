// ./backend/models/user.model.js
const { Schema, model } = require('mongoose');

const AnimeEntrySchema = new Schema({
    shikimori_id: { type: String, required: true },
    title: { type: String },
    poster_url: { type: String },
    episodes_total: { type: Number },
    status: {
        type: String,
        enum: ['watching', 'completed', 'dropped', 'planned'],
        required: true,
    }
}, { _id: false });

const SocialLinksSchema = new Schema({
    website: { type: String },
    telegram: { type: String },
    twitter: { type: String },
    vk: { type: String },
    discord: { type: String }
}, { _id: false });

const UserSchema = new Schema({
    // Убираем определение индекса из самого поля, чтобы задать его явно ниже.
    userId: { type: String },

    email: { type: String, unique: true, required: true, lowercase: true, trim: true },
    password: { type: String, required: true },

    // profile fields
    nickname: { type: String, default: '' },
    avatar_url: { type: String, default: '' },
    cover_url: { type: String, default: '' },
    bio: { type: String, default: '' },
    social_links: { type: SocialLinksSchema, default: {} },
    sticker: { type: String, default: null },

    // friend list: store references to other users' ObjectId
    friends: [{ type: Schema.Types.ObjectId, ref: 'User' }],

    anime_list: { type: [AnimeEntrySchema], default: [] }
}, { timestamps: true });

// Явно определяем частичный (partial) уникальный индекс.
// Это самый надёжный способ для опциональных уникальных полей.
// Индекс будет применяться только к документам, где поле `userId` существует и является строкой.
// Документы, где `userId` равен `null` или отсутствует, будут полностью проигнорированы этим индексом.
UserSchema.index(
    { userId: 1 },
    {
        unique: true,
        partialFilterExpression: { userId: { $type: 'string' } }
    }
);


module.exports = model('User', UserSchema);

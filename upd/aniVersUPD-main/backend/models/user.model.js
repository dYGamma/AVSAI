const { Schema, model } = require('mongoose');

const AnimeEntrySchema = new Schema({
    shikimori_id: { type: String, required: true },
    title: { type: String },
    poster_url: { type: String },
    episodes_total: { type: Number },
    status: {
        type: String,
        enum: ['watching', 'completed', 'on_hold', 'dropped', 'planned'],
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
    email: { type: String, unique: true, required: true },
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

    anime_list: [AnimeEntrySchema]
}, { timestamps: true });

module.exports = model('User', UserSchema);

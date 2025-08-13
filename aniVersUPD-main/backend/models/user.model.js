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

const UserSchema = new Schema({
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    anime_list: [AnimeEntrySchema]
});

module.exports = model('User', UserSchema);

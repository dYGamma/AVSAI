module.exports = class UserDto {
    email;
    id;
    nickname;
    avatar_url;
    cover_url;
    bio;
    social_links;
    sticker;

    constructor(model) {
        this.email = model.email;
        this.id = model._id;
        this.nickname = model.nickname || '';
        this.avatar_url = model.avatar_url || '';
        this.cover_url = model.cover_url || '';
        this.bio = model.bio || '';
        this.social_links = model.social_links || {};
        this.sticker = model.sticker || null;
    }
}

// Data Transfer Object - класс, который определяет, какие данные о пользователе
// можно безопасно отправлять на клиент (без пароля и другой служебной информации).
module.exports = class UserDto {
    email;
    id;

    constructor(model) {
        this.email = model.email;
        // В MongoDB id по умолчанию называется _id
        this.id = model._id;
    }
}

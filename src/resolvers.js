const argon2 = require('argon2');
const { sign } = require('jsonwebtoken');
const { User } = require('./models/user');

module.exports = {
  Query: {
    health: () => 'ok'
  },
  Mutation: {
    register: async (_, { email, password }) => {
      const hashedPassword = await argon2.hash(password);

      await User.create({
        email,
        password: hashedPassword
      });

      return true;
    },
    login: async (_, { email, password }) => {
      const user = await User.findOne({ email });

      if (!user) {
        return null;
      }

      const valid = await argon2.verify(user.password, password);

      if (!valid) {
        return null;
      }

      return sign({ userId: user.id }, process.env.JWT_SECRET, {
        expiresIn: '1d'
      });
    }
  }
};

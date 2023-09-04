const sha1 = require('sha1');
const dbClient = require('../utils/db');
const redisClient = require('../utils/redis');
const { ObjectId } = require('mongodb');

class UsersController {
  static async postNew(request, response) {
    const { email, password } = request.body;
    if (!email) {
      return response.status(400).json({ error: 'Missing email' });
    }
    if (!password) {
      return response.status(400).json({ error: 'Missing password' });
    }
    const db = dbClient.client.db(process.env.DB_DATABASE);
    const users = db.collection('users');
    const existingEmail = await users.findOne({ email });
    if (existingEmail) {
      return response.status(400).json({ error: 'Already exist' });
    }
    const hashedPassword = sha1(password);
    const userObject = {
      email,
      hashedPassword,
    };
    const insertOperation = await users.insertOne(userObject);
    const newlyCreatedUser = {
      id: insertOperation.ops[0]._id,
      email: insertOperation.ops[0].email,
    };
    return response.status(201).json(newlyCreatedUser);
  }

  static async getMe(request, response) {
    const token = request.header('X-Token');
    if (!token) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (!userId) {
      return response.status(401).json({ error: 'Unauthorized' });
    }
    const db = dbClient.client.db(process.env.DB_DATABASE);
    const users = db.collection('users');
    const user = await users.findOne({ _id: ObjectId(userId) });
    if (!user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    const userInfo = {
      id: user._id,
      email: user.email,
    };

    return response.status(201).json(userInfo);
  }
}

module.exports = UsersController;

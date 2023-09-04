const {v4} = require('uuid');
const sha1 = require('sha1');
const dbClient = require('../utils/db');
const redisClient = require('../utils/redis');

class AuthController {
  static async getConnect(request, response) {
    const header = request.header('Authorization');
    if (!header || !header.startsWith('Basic ')) {
      return response.status(401).json({ error: 'Unauthorized' });
    }
    const credentials = Buffer.from(header.slice('Basic '.length), 'base64').toString('utf-8');
    const [email, password] = credentials.split(':');

    if (!email || !password) {
      return response.status(401).json({ error: 'Unauthorized' });
    }
    const hashedPassword = sha1(password);
    const db = dbClient.client.db(process.env.DB_DATABASE);
    const users = db.collection('users');
    const user = await users.findOne({ email, hashedPassword });

    if (!user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }
    const token = v4();
    const key = `auth_${token}`;

    redisClient.set(key, user._id.toString(), 86400);
    return response.status(200).json({ token });
  }

  static async getDisconnect(request, response) {
    const token = request.header('X-Token');
    if (!token) {
      return response.status(401).json({ error: 'Unauthorized' });
    }
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (!userId) {
      return response.status(401).json({ error: 'Unauthorized' });
    }
    redisClient.del(key);
    return response.status(204).end();
  }
}

module.exports = AuthController;

const redisClient = require('../utils/redis');
const dbClient = require('../utils/db');

class AppController {
  static getStatus(request, response) {
    if (redisClient.isAlive() && dbClient.isAlive()) {
      response.status(200).json({ redis: true, db: true });
      response.end();
    }
  }

  static async getStats(request, response) {
    const users = await dbClient.nbUsers();
    const files = await dbClient.nbFiles();
    response.status(200).json({ users, files });
    response.end();
  }
}

module.exports = AppController;

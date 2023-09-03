import { MongoClient } from 'mongodb';

class DBClient {
  constructor() {
    this.host = process.env.DB_HOST || 'localhost';
    this.port = process.env.DB_PORT || 27017;
    this.database = process.env.DB_DATABASE || 'files_manager';
    this.url = `mongodb://${this.host}:${this.port}`;
    this.client = new MongoClient(this.url, { useUnifiedTopology: true });

    this.client.connect((error) => {
      if (error) {
        console.log('error connecting to db', error);
      } else {
        console.log('connected to database');
      }
    });
  }

  isAlive() {
    return this.client.isConnected();
  }

  async nbUsers() {
    const db = this.client.db(this.database);
    const userDocuments = db.collection('users');
    return userDocuments.countDocuments();
  }

  async nbFiles() {
    const db = this.client.db(this.database);
    const filesDocument = db.collection('files');
    return filesDocument.countDocuments();
  }
}

const dbClient = new DBClient();

module.exports = dbClient;

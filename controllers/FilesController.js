const { ObjectId } = require('mongodb');
const { v4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const dbClient = require('../utils/db');
const redisClient = require('../utils/redis');

class FilesController {
  static async postUpload(request, response) {
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
    const {
      name, type, parentId = 0, isPublic = false, data,
    } = request.body;
    if (!name) {
      return response.status(400).json({ error: 'Missing name' });
    }
    if (!type || !['folder', 'file', 'image'].includes(type)) {
      return response.status(400).json({ error: 'Missing type' });
    }
    if (type !== 'folder' && !data) {
      return response.status(400).json({ error: 'Missing data' });
    }

    const files = db.collection('files');
    if (parentId !== 0) {
      const parentFIle = await files.findOne({
        _id: ObjectId(parentId),
        type: 'folder',
      });
      if (!parentFIle) {
        return response.status(400).json({ error: 'Parent not found' });
      }
      if (parentFIle.type !== 'folder') {
        return response.status(400).json({ error: 'Parent is not a folder' });
      }
    }

    const fileToSave = {
      userId,
      name,
      type,
      isPublic,
      parentId,
    };

    if (type === 'file' || type === 'image') {
      const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
      const localPath = path.join(folderPath, v4());
      const fileData = Buffer.from(data, 'base64');
      fs.mkdirSync(path.dirname(localPath), { recursive: true });
      fs.writeFileSync(localPath, fileData);
      fileToSave.localPath = localPath;
    }

    const result = await files.insertOne(fileToSave);
    const createdFile = result.ops[0];
    const orderedObject = {
      id: createdFile._id,
      userId: createdFile.userId,
      name: createdFile.name,
      type: createdFile.type,
      isPublic: createdFile.isPublic,
      parentId: createdFile.parentId,
    };

    return response.status(201).json(orderedObject);
  }

  static async getShow(req, res) {
    try {
      const token = req.header('X-Token');
      if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const key = `auth_${token}`;
      const user = await redisClient.get(key);

      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const fileId = req.params.id;

      if (!fileId) {
        return res.status(404).json({ error: 'Not found' });
      }

      return res.json(fileId);
    } catch (err) {
      console.log(err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async getIndex(req, res) {
    try {
      const token = req.header('X-Token');
      if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const key = `auth_${token}`;
      const user = await redisClient.get(key);

      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const parentId = req.query.parentId || 0;
      const page = parseInt(req.query.page, 10) || 0;
      const pageMax = 20;

      const pageLine = [
        {
          $match: {
            userId: user._id,
            parentId,
          },
        },
        {
          $skip: page * pageMax,
        },
        {
          $limit: pageMax,
        },
      ];

      const files = await File.aggregate(pageLine);
      return res.json(files);
    } catch (err) {
      console.log(err);
      return res.status(500).json({
        error: 'Internal Server Error',
      });
    }
  }
}

module.exports = FilesController;

const { ObjectId } = require('mongodb');
const { v4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const dbClient = require('../utils/db');
const redisClient = require('../utils/redis');

const isValidId = (id) => {
  const size = 24;
  let i = 0;
  const charRanges = [
    [48, 57], // 0 - 9
    [97, 102], // a - f
    [65, 70], // A - F
  ];
  if (typeof id !== 'string' || id.length !== size) {
    return false;
  }
  while (i < size) {
    const c = id[i];
    const code = c.charCodeAt(0);

    if (!charRanges.some((range) => code >= range[0] && code <= range[1])) {
      return false;
    }
    i += 1;
  }
  return true;
};

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
      const parentFIle = await files.findOne({ _id: ObjectId(parentId), type: 'folder' });
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

  static async getShow(req, res){
    const { user } = req;
    const id = req.params ? req.params.id : null;
    const userId = user._id.toString();
    const file = await (await dbClient.filesCollection())
    .findOne({
      _id: new mongoDBCore.BSON.ObjectId(isValidId(id) ? id : null),
      userId: new mongoDBCore.BSON.ObjectId(isValidId(userId) ? userId : null)
    });

    if (!file){
      res.status(404).json({ error: 'Not Found'});
    }
    res.status(200).json({
      id,
      userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId === '0' ? 0 : file.parentId.toString()
    });
  }

  /**
   * @param: getIndex
   */
  static async getIndex(req, res) {
    const { user } = req;
    const parentId = req.query.parentId || '0';
    const page = /\d+/.test((req.query.page || '').toString())
    ? Number.parseInt(req.query.page, 10)
    : 0;

    const filesFilter = {
      userId: user._id,
      parentId: parentId === '0' ? parentId
      : new mongoDBCore.BSON.ObjectId(isValidId(parentId) ? parentId : null )

    };

    const files = await (await (await dbClient.filesCollection())
    .aggregate([
      { $match: filesFilter },
      { $sort: { _id: -1 } },
      { $skip: page * 20 },
      { $limit: 20 },
      {
        $project: {
          _id: 0,
          id: '$_id',
          userId: '$userId',
          name: '$name',
          type: '$type',
          isPublic: '$isPublic',
          parentId: {
            $cond: { if: { $eq: ['$parentId', '0'] }, then: 0, else: '$parentId' },
          },
        },
      },
    ])).toArray();

    res.status(200).json(files);
  }

}

module.exports = FilesController;

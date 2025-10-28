const express = require('express');
const { ensureAdmin } = require('../middleware/auth');
const { listUsers, findUserById } = require('../models/userModel');
const { getMariaPool } = require('../db/mariadb');
const { initMongo } = require('../db/mongo');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Administrative features
 */

/**
 * @swagger
 * /admin/users:
 *   get:
 *     summary: List registered users with real identities (admin only)
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Admin user list
 */
router.get('/users', ensureAdmin, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const { users, total } = await listUsers({ page, limit: 20 });
    res.render('admin/users', { users, total, page });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /admin/users/{id}:
 *   get:
 *     summary: View a user's identity (admin only)
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: User detail
 */
router.get('/users/:id', ensureAdmin, async (req, res, next) => {
  try {
    const user = await findUserById(req.params.id);
    if (!user) {
      return res.status(404).render('error', { error: new Error('사용자를 찾을 수 없습니다.') });
    }
    res.render('admin/userDetail', { user });
  } catch (error) {
    next(error);
  }
});

function extractMongoFields(document, prefix = '') {
  if (!document || typeof document !== 'object') {
    return [];
  }

  const entries = [];
  for (const [key, value] of Object.entries(document)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (value === null) {
      entries.push(path);
      continue;
    }

    if (Array.isArray(value)) {
      const arrayPath = `${path}[]`;
      entries.push(arrayPath);
      const sample = value.find(
        (item) => item && typeof item === 'object' && !(item instanceof Date)
      );
      if (sample) {
        entries.push(...extractMongoFields(sample, arrayPath));
      }
      continue;
    }

    if (value instanceof Date) {
      entries.push(path);
      continue;
    }

    if (typeof value === 'object') {
      entries.push(path);
      entries.push(...extractMongoFields(value, path));
      continue;
    }

    entries.push(path);
  }

  return entries;
}

router.get('/databases', ensureAdmin, async (req, res, next) => {
  try {
    const pool = getMariaPool();
    const databaseName = process.env.MARIADB_DATABASE || '202010832';

    const [columnRows] = await pool.query(
      `SELECT TABLE_NAME AS tableName,
              COLUMN_NAME AS columnName,
              COLUMN_TYPE AS columnType,
              IS_NULLABLE AS isNullable,
              COLUMN_DEFAULT AS columnDefault,
              COLUMN_KEY AS columnKey,
              ORDINAL_POSITION AS ordinalPosition
         FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = ?
        ORDER BY TABLE_NAME, ORDINAL_POSITION`,
      [databaseName]
    );

    const [tableStats] = await pool.query(
      `SELECT TABLE_NAME AS tableName,
              IFNULL(TABLE_ROWS, 0) AS tableRows
         FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = ?`,
      [databaseName]
    );

    const tableRowMap = new Map(tableStats.map((row) => [row.tableName, row.tableRows]));

    const mariaTablesMap = new Map();
    for (const column of columnRows) {
      if (!mariaTablesMap.has(column.tableName)) {
        const rawRowCount = tableRowMap.get(column.tableName);
        const numericRowCount = Number(rawRowCount);
        mariaTablesMap.set(column.tableName, {
          name: column.tableName,
          rowCount: Number.isFinite(numericRowCount) ? numericRowCount : 0,
          columns: []
        });
      }
      mariaTablesMap.get(column.tableName).columns.push({
        name: column.columnName,
        type: column.columnType,
        nullable: column.isNullable === 'YES',
        defaultValue: column.columnDefault,
        key: column.columnKey || ''
      });
    }

    const mariaTables = Array.from(mariaTablesMap.values());

    const mongoConnection = await initMongo();
    const collectionInfos = await mongoConnection.db.listCollections().toArray();

    const mongoCollections = [];
    for (const info of collectionInfos) {
      const collection = mongoConnection.collection(info.name);
      let sampleDocument = null;
      let documentCount = 0;

      try {
        documentCount = await collection.estimatedDocumentCount();
      } catch (error) {
        console.error(`Failed to count documents for collection ${info.name}`, error);
      }

      try {
        sampleDocument = await collection.findOne({}, { maxTimeMS: 1000 });
      } catch (error) {
        console.error(`Failed to load sample document for collection ${info.name}`, error);
      }

      const fieldSet = new Set();
      if (sampleDocument) {
        extractMongoFields(sampleDocument).forEach((field) => fieldSet.add(field));
      }

      mongoCollections.push({
        name: info.name,
        documentCount,
        fields: Array.from(fieldSet).sort()
      });
    }

    mongoCollections.sort((a, b) => a.name.localeCompare(b.name));

    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/202010832';

    res.render('admin/databaseOverview', {
      mariaTables,
      mongoCollections,
      databaseName,
      mongoUri
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

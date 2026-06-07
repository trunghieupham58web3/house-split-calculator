// Vercel Serverless Function — CRUD lịch sử tính tiền nhà trên MongoDB Atlas
// Routes (cùng origin với web):
//   GET    /api/records         -> { records: [...] }   (mới nhất trước)
//   POST   /api/records         -> lưu / cập nhật 1 bản ghi (upsert theo id)
//   DELETE /api/records         -> xoá tất cả
//   DELETE /api/records?id=...  -> xoá 1 bản ghi

const { MongoClient } = require('mongodb');

const uri    = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB || 'house_split';
const COLL    = 'records';

// Cache connection giữa các lần gọi (quan trọng cho serverless)
let cached = global._mongo;
if (!cached) cached = global._mongo = { promise: null, conn: null };

async function getDb() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = MongoClient.connect(uri, {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 8000,
    }).then((client) => ({ client, db: client.db(DB_NAME) }));
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

module.exports = async (req, res) => {
  if (!uri) {
    res.status(500).json({ error: 'Chưa cấu hình MONGODB_URI trong Environment Variables' });
    return;
  }

  try {
    const { db } = await getDb();
    const col = db.collection(COLL);

    if (req.method === 'GET') {
      const records = await col
        .find({}, { projection: { _id: 0 } })
        .sort({ savedAt: -1 })
        .limit(60)
        .toArray();
      res.status(200).json({ records });
      return;
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      if (!body.id) {
        res.status(400).json({ error: 'Thiếu trường id' });
        return;
      }
      await col.replaceOne({ id: body.id }, body, { upsert: true });
      res.status(200).json({ ok: true });
      return;
    }

    if (req.method === 'DELETE') {
      const id = req.query && req.query.id;
      if (id) await col.deleteOne({ id });
      else await col.deleteMany({});
      res.status(200).json({ ok: true });
      return;
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    res.status(405).json({ error: 'Method không được hỗ trợ' });
  } catch (e) {
    console.error('API /records error:', e);
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};

const { MongoClient } = require("mongodb");
const crypto = require("node:crypto");
const hash = (value) =>
  crypto.createHash("sha256").update(String(value)).digest("hex");
const token = () => crypto.randomBytes(32).toString("base64url");
class MongoStore {
  constructor(collection) {
    this.collection = collection;
  }
  async get(id) {
    return this.collection.findOne({ _id: id });
  }
  async create(doc) {
    await this.collection.insertOne(doc);
    return doc;
  }
  async replace(doc, revision) {
    return (
      (
        await this.collection.replaceOne(
          { _id: doc._id, revision },
          { ...doc, revision: revision + 1 },
        )
      ).modifiedCount === 1
    );
  }
  async remove(id) {
    await this.collection.deleteOne({ _id: id });
  }
  async cleanup(now) {
    return (
      await this.collection.deleteMany({
        isDemo: { $ne: true },
        expiresAt: { $lte: new Date(now) },
      })
    ).deletedCount;
  }
  async count() {
    return this.collection.countDocuments({});
  }
}
class MemoryStore {
  constructor() {
    this.docs = new Map();
  }
  async get(id) {
    return structuredClone(this.docs.get(id) || null);
  }
  async create(doc) {
    if (this.docs.has(doc._id)) throw Error("Duplicate");
    this.docs.set(doc._id, structuredClone(doc));
    return doc;
  }
  async replace(doc, revision) {
    if (this.docs.get(doc._id)?.revision !== revision) return false;
    this.docs.set(doc._id, structuredClone({ ...doc, revision: revision + 1 }));
    return true;
  }
  async remove(id) {
    this.docs.delete(id);
  }
  async cleanup(now) {
    let n = 0;
    for (const [id, d] of this.docs)
      if (!d.isDemo && +new Date(d.expiresAt) <= now) {
        this.docs.delete(id);
        n++;
      }
    return n;
  }
  async count() {
    return this.docs.size;
  }
}
let connection;
async function connect() {
  if (!process.env.MONGODB_URI) throw Error("Missing server database setting");
  if (!connection)
    connection = (async () => {
      const client = await new MongoClient(process.env.MONGODB_URI, {
        retryWrites: false,
        maxPoolSize: 3,
        serverSelectionTimeoutMS: 8000,
      }).connect();
      return new MongoStore(
        client
          .db(process.env.MONGODB_DATABASE || "portfolio-demos")
          .collection(process.env.MONGODB_COLLECTION),
      );
    })().catch((e) => {
      connection = undefined;
      throw e;
    });
  return connection;
}
module.exports = { MongoStore, MemoryStore, hash, token, connect };

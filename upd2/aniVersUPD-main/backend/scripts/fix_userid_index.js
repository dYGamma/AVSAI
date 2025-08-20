// backend/scripts/fix_userid_index.js
const { MongoClient } = require('mongodb');

async function run() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017';
  const dbName = process.env.MONGO_DBNAME || 'anime-app-db';
  const client = new MongoClient(uri, { useUnifiedTopology: true });

  try {
    console.log('Connecting to', uri);
    await client.connect();
    const db = client.db(dbName);
    const coll = db.collection('users');

    console.log('1) Unsetting userId:null (if any)...');
    const resUnset = await coll.updateMany({ userId: null }, { $unset: { userId: "" } });
    console.log(' -> modifiedCount:', resUnset.modifiedCount);

    console.log('2) Getting existing indexes...');
    const indexes = await coll.indexes();
    console.log(indexes);

    // Try drop index userId_1 if exists
    const idx = indexes.find(i => i.name === 'userId_1');
    if (idx) {
      console.log('3) Dropping index userId_1...');
      try {
        await coll.dropIndex('userId_1');
        console.log(' -> dropped userId_1');
      } catch (e) {
        console.warn(' -> failed to drop userId_1:', e.message);
      }
    } else {
      console.log('3) No userId_1 index found, skipping drop.');
    }

    console.log('4) Creating partial unique index on userId...');
    await coll.createIndex(
      { userId: 1 },
      { unique: true, partialFilterExpression: { userId: { $type: "string" } } }
    );
    console.log(' -> partial unique index created on userId');

    console.log('Done.');
  } catch (e) {
    console.error('Migration error:', e);
    process.exit(2);
  } finally {
    await client.close();
  }
}

run();

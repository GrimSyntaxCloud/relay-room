const test = require("node:test"),
  assert = require("node:assert/strict"),
  crypto = require("node:crypto");
const { MongoClient } = require("mongodb"),
  { MongoStore } = require("../lib/store.cjs");
test(
  "Mongo persistence, revision conflicts, and expiry cleanup preserve permanent samples",
  { skip: !process.env.TEST_MONGODB_URI },
  async () => {
    const client = await new MongoClient(
        process.env.TEST_MONGODB_URI,
      ).connect(),
      db = client.db(
        "recovery_test_" + crypto.randomUUID().replaceAll("-", ""),
      );
    try {
      const store = new MongoStore(db.collection("documents"));
      await store.create({
        _id: "visitor",
        revision: 0,
        isDemo: false,
        expiresAt: new Date(1000),
        value: "initial",
      });
      await store.create({
        _id: "sample",
        revision: 0,
        isDemo: true,
        expiresAt: new Date(0),
      });
      const first = await store.get("visitor"),
        second = await store.get("visitor");
      first.value = "updated";
      assert.equal(await store.replace(first, 0), true);
      second.value = "stale";
      assert.equal(await store.replace(second, 0), false);
      const restored = new MongoStore(db.collection("documents"));
      assert.equal((await restored.get("visitor")).value, "updated");
      assert.equal(await restored.cleanup(1000), 1);
      assert.ok(await restored.get("sample"));
    } finally {
      await db.dropDatabase();
      await client.close();
    }
  },
);

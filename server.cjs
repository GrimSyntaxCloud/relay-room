const { connect, MemoryStore } = require("./lib/store.cjs");
const { createApp } = require("./app.cjs");
(async () => {
  const store =
    process.env.LOCAL_DEMO === "true" ? new MemoryStore() : await connect();
  const app = createApp({ store });
  app.listen(process.env.PORT || 4391, "127.0.0.1", () =>
    console.log("Local demo ready on port " + (process.env.PORT || 4391)),
  );
})().catch(() => {
  console.error("Cannot start: check server database settings.");
  process.exitCode = 1;
});

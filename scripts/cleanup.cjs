const { connect } = require("../lib/store.cjs");
(async () => {
  const store = await connect();
  const deleted = await store.cleanup(Date.now());
  console.log(JSON.stringify({ deleted }));
  process.exit(0);
})().catch(() => {
  console.error("Cleanup failed. Check private server configuration.");
  process.exitCode = 1;
});

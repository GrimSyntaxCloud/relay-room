const express = require("express"),
  fs = require("node:fs"),
  path = require("node:path");
const { createApp } = require("../app.cjs"),
  { MemoryStore } = require("../lib/store.cjs");
const server = express();
server.get("/__test", (req, res) =>
  res
    .type("html")
    .send(
      fs
        .readFileSync(path.join(__dirname, "../public/index.html"), "utf8")
        .replace(
          '<script type="module"',
          '<script src="/test-media.js"></script><script type="module"',
        ),
    ),
);
server.get("/test-media.js", (req, res) =>
  res
    .type("application/javascript")
    .send(fs.readFileSync(path.join(__dirname, "media-fixture.js"), "utf8")),
);
server.use(createApp({ store: new MemoryStore() }));
server.listen(4394, "127.0.0.1", () =>
  console.log("Synthetic-media test fixture on 4394"),
);

const { app } = require("@azure/functions"),
  serverless = require("serverless-http");
const { connect } = require("../lib/store.cjs"),
  { createApp } = require("../app.cjs");
let pending;
app.http("api", {
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  authLevel: "anonymous",
  route: "{*path}",
  handler: async (request) => {
    try {
      const rawBody = Buffer.from(await request.arrayBuffer());
      if (rawBody.length > 41000)
        return { status: 413, jsonBody: { error: "Request too large." } };
      if (!pending)
        pending = connect()
          .then((store) =>
            serverless(createApp({ store }), {
              provider: "azure",
              request: (req) => {
                delete req.ip;
                req.socket.remoteAddress = "127.0.0.1";
              },
            }),
          )
          .catch((error) => {
            pending = undefined;
            throw error;
          });
      const url = new URL(request.url);
      const response = await (
        await pending
      )(
        { log: () => {} },
        {
          method: request.method,
          url: "/api/" + (request.params.path || ""),
          query: Object.fromEntries(url.searchParams),
          headers: Object.fromEntries(request.headers),
          rawBody,
        },
      );
      return {
        status: response.status,
        headers: response.headers,
        body: response.body,
      };
    } catch {
      return {
        status: 503,
        jsonBody: { error: "The demo is temporarily unavailable." },
        headers: { "Cache-Control": "no-store" },
      };
    }
  },
});

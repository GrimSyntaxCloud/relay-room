const express = require("express"),
  helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");
function base() {
  const app = express();
  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", "data:"],
          connectSrc: ["'self'"],
          mediaSrc: ["'self'", "blob:"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: null,
        },
      },
      referrerPolicy: { policy: "no-referrer" },
    }),
  );
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (process.env.DEMO_MAINTENANCE === "true")
      return res
        .status(503)
        .json({ error: "Brief maintenance. Please try again shortly." });
    next();
  });
  app.use(
    "/api",
    rateLimit({
      windowMs: 60000,
      limit: 180,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { error: "Too many requests. Please wait a minute." },
    }),
  );
  app.use("/api", (req, res, next) => {
    if (["POST", "PUT"].includes(req.method) && !req.is("application/json"))
      return res.status(415).json({ error: "Send application/json." });
    next();
  });
  app.use(express.json({ limit: "40kb", strict: true }));
  return app;
}
function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}
function text(value, name, max = 80) {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.trim().length > max ||
    /[\x00-\x1f]/.test(value)
  )
    fail(400, `${name} must be 1–${max} characters.`);
  return value.trim();
}
function finish(app) {
  app.use(express.static(require("node:path").resolve(__dirname, "../public")));
  app.use((req, res) => res.status(404).json({ error: "Not found." }));
  app.use((error, req, res, next) => {
    const status = error.status || 503;
    res.status(status).json({
      error:
        status < 500
          ? error.message
          : "The demo is temporarily unavailable. Please try again.",
    });
  });
  return app;
}
module.exports = { base, fail, text, finish };

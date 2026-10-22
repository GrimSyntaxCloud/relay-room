const crypto = require("node:crypto");
const { base, finish, fail, text } = require("./lib/http.cjs"),
  { hash, token } = require("./lib/store.cjs");
const ROOM_LIFETIME = 30 * 60000;
function createApp({ store, now = () => Date.now() }) {
  const app = base();
  function member(name) {
    const secret = token();
    return {
      secret,
      record: {
        id: crypto.randomUUID(),
        name: text(name, "Display name", 40),
        key: hash(secret),
        joinedAt: new Date(now()),
      },
    };
  }
  app.get("/api/health", async (req, res) => {
    await store.count();
    res.json({ status: "ok", relay: false, maxParticipants: 4 });
  });
  app.post("/api/rooms", async (req, res) => {
    const person = member(req.body?.name),
      invite = token();
    await store.cleanup(now());
    if ((await store.count()) >= 80)
      fail(503, "The free demo is at capacity. Please try later.");
    const room = {
      _id: crypto.randomUUID(),
      name: text(req.body?.roomName, "Room name", 50),
      invite: hash(invite),
      owner: person.record.id,
      participants: [person.record],
      signals: [],
      revision: 0,
      createdAt: new Date(now()),
      expiresAt: new Date(now() + ROOM_LIFETIME),
      isDemo: false,
    };
    await store.create(room);
    res
      .status(201)
      .json({
        roomId: room._id,
        invite,
        peerId: person.record.id,
        token: person.secret,
        name: room.name,
        expiresAt: room.expiresAt,
      });
  });
  async function room(id) {
    if (!/^[\da-f-]{36}$/.test(id)) fail(404, "Room not found.");
    const r = await store.get(id);
    if (!r || +new Date(r.expiresAt) <= now())
      fail(410, "This room has ended. Create a fresh invitation.");
    return r;
  }
  function auth(req, r) {
    const value = req.get("Authorization")?.match(/^Bearer ([\w-]{43})$/)?.[1];
    const p = value && r.participants.find((p) => p.key === hash(value));
    if (!p)
      fail(
        401,
        "This invitation is not a room membership. Join the room first.",
      );
    return p;
  }
  async function change(id, fn) {
    for (let i = 0; i < 4; i++) {
      const r = await room(id),
        result = fn(r);
      if (await store.replace(r, r.revision)) return result;
    }
    fail(409, "The room changed. Please retry.");
  }
  app.post("/api/rooms/:id/join", async (req, res) => {
    const person = member(req.body?.name);
    if (
      typeof req.body?.invite !== "string" ||
      !/^[-\w]{43}$/.test(req.body.invite)
    )
      fail(403, "Invalid invitation.");
    const result = await change(req.params.id, (r) => {
      if (hash(req.body.invite) !== r.invite) fail(403, "Invalid invitation.");
      if (r.participants.length >= 4)
        fail(409, "This room has reached its four-person demo limit.");
      r.participants.push(person.record);
      return {
        roomId: r._id,
        peerId: person.record.id,
        token: person.secret,
        name: r.name,
        expiresAt: r.expiresAt,
      };
    });
    res.status(201).json(result);
  });
  app.get("/api/rooms/:id", async (req, res) => {
    const r = await room(req.params.id),
      p = auth(req, r);
    res.json({
      name: r.name,
      owner: r.owner,
      expiresAt: r.expiresAt,
      participants: r.participants.map(({ id, name }) => ({ id, name })),
      signals: r.signals
        .filter((s) => s.to === p.id)
        .map(({ id, from, type, sdp }) => ({ id, from, type, sdp })),
    });
  });
  app.post("/api/rooms/:id/signals", async (req, res) => {
    const { to, type, sdp } = req.body || {};
    if (
      !["offer", "answer"].includes(type) ||
      typeof sdp !== "string" ||
      sdp.length > 32000 ||
      !sdp.startsWith("v=0")
    )
      fail(400, "Invalid session description.");
    const result = await change(req.params.id, (r) => {
      const from = auth(req, r).id;
      if (from === to || !r.participants.some((p) => p.id === to))
        fail(400, "Unknown recipient.");
      if (
        r.signals.some((s) => s.from === from && s.to === to && s.type === type)
      )
        fail(
          409,
          "Session description already sent. Rejoin to restart the connection.",
        );
      const signal = { id: crypto.randomUUID(), from, to, type, sdp };
      r.signals.push(signal);
      if (r.signals.length > 24) fail(400, "Room signaling limit reached.");
      return { id: signal.id };
    });
    res.status(201).json(result);
  });
  app.delete("/api/rooms/:id/membership", async (req, res) => {
    await change(req.params.id, (r) => {
      const p = auth(req, r);
      r.participants = r.participants.filter((v) => v.id !== p.id);
      r.signals = r.signals.filter((s) => s.from !== p.id && s.to !== p.id);
      if (p.id === r.owner) r.owner = r.participants[0]?.id || "";
      if (!r.participants.length) r.expiresAt = new Date(now());
    });
    res.json({ left: true });
  });
  app.delete("/api/rooms/:id", async (req, res) => {
    await change(req.params.id, (r) => {
      if (auth(req, r).id !== r.owner)
        fail(403, "Only the host can end the room.");
      r.expiresAt = new Date(now());
      r.signals = [];
      r.participants = [];
    });
    res.json({ ended: true });
  });
  return finish(app);
}
module.exports = { createApp, ROOM_LIFETIME };

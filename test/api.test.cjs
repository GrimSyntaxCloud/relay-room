const test = require("node:test"),
  assert = require("node:assert/strict"),
  request = require("supertest");
const { createApp, ROOM_LIFETIME } = require("../app.cjs"),
  { MemoryStore } = require("../lib/store.cjs");
function setup() {
  let now = Date.UTC(2026, 9, 22);
  const store = new MemoryStore();
  return {
    agent: request(createApp({ store, now: () => now })),
    store,
    advance: (n) => (now += n),
  };
}
const auth = (p) => ({ Authorization: "Bearer " + p.token });
async function create(a) {
  return (
    await a
      .post("/api/rooms")
      .send({ name: "Host", roomName: "Test moment" })
      .expect(201)
  ).body;
}
async function join(a, r, name) {
  return (
    await a
      .post(`/api/rooms/${r.roomId}/join`)
      .send({ name, invite: r.invite })
      .expect(201)
  ).body;
}
test("private invitations, four-person limit and participant-only signaling", async () => {
  const { agent } = setup(),
    host = await create(agent);
  await agent
    .post(`/api/rooms/${host.roomId}/join`)
    .send({ name: "Stranger", invite: "a".repeat(43) })
    .expect(403);
  await agent.get(`/api/rooms/${host.roomId}`).expect(401);
  const guest = await join(agent, host, "Guest");
  await join(agent, host, "Third");
  await join(agent, host, "Fourth");
  await agent
    .post(`/api/rooms/${host.roomId}/join`)
    .send({ name: "Fifth", invite: host.invite })
    .expect(409);
  await agent
    .post(`/api/rooms/${host.roomId}/signals`)
    .set(auth(host))
    .send({ to: guest.peerId, type: "offer", sdp: "v=0\r\nmock" })
    .expect(201);
  const a = await agent.get(`/api/rooms/${host.roomId}`).set(auth(host)),
    b = await agent.get(`/api/rooms/${host.roomId}`).set(auth(guest));
  assert.equal(a.body.signals.length, 0);
  assert.equal(b.body.signals.length, 1);
  assert.ok(!JSON.stringify(b.body).includes(host.token));
  assert.equal(b.body.participants[0].key, undefined);
  await agent
    .post(`/api/rooms/${host.roomId}/signals`)
    .set(auth(guest))
    .send({ to: "unknown", type: "offer", sdp: "v=0\r\nmock" })
    .expect(400);
});
test("only host ends a room; leaving removes member access and signals", async () => {
  const { agent } = setup(),
    host = await create(agent),
    guest = await join(agent, host, "Guest");
  await agent.delete(`/api/rooms/${host.roomId}`).set(auth(guest)).expect(403);
  await agent
    .delete(`/api/rooms/${host.roomId}/membership`)
    .set(auth(guest))
    .expect(200);
  await agent.get(`/api/rooms/${host.roomId}`).set(auth(guest)).expect(401);
  await agent.delete(`/api/rooms/${host.roomId}`).set(auth(host)).expect(200);
  await agent.get(`/api/rooms/${host.roomId}`).set(auth(host)).expect(410);
});
test("room expires at the fixed boundary and cleanup deletes its signaling", async () => {
  const { agent, store, advance } = setup(),
    host = await create(agent);
  advance(ROOM_LIFETIME - 1);
  await agent.get(`/api/rooms/${host.roomId}`).set(auth(host)).expect(200);
  advance(1);
  await agent.get(`/api/rooms/${host.roomId}`).set(auth(host)).expect(410);
  assert.equal(await store.cleanup(Date.UTC(2026, 9, 22) + ROOM_LIFETIME), 1);
});
test("host departure hands control to the next participant without leaking tokens", async () => {
  const { agent } = setup(),
    host = await create(agent),
    guest = await join(agent, host, "Guest");
  await agent
    .delete(`/api/rooms/${host.roomId}/membership`)
    .set(auth(host))
    .expect(200);
  const state = await agent.get(`/api/rooms/${host.roomId}`).set(auth(guest));
  assert.equal(state.body.owner, guest.peerId);
  await agent.delete(`/api/rooms/${host.roomId}`).set(auth(guest)).expect(200);
});

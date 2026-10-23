const motionPreference = matchMedia("(prefers-reduced-motion: reduce)");
const $ = (s) => document.querySelector(s);
let mode = "new",
  session = null,
  stream = null,
  timer = null,
  polling = false,
  starting = false,
  invite = "",
  motion = !motionPreference.matches;
const peers = new Map(),
  seen = new Set();
const mediaError = (e) =>
  ({
    NotAllowedError:
      "Camera or microphone permission was declined. Allow access in your browser, then try again.",
    NotFoundError:
      "No camera or microphone was found. Connect a device and try again.",
    NotReadableError:
      "Another application may be using your camera. Close it and try again.",
  })[e.name] ||
  e.message ||
  "The connection could not be started.";
function status(message) {
  $("#room-message").textContent = message;
}
function tab(value) {
  mode = value;
  $("#new-fields").hidden = value !== "new";
  $("#join-fields").hidden = value !== "join";
  $("#new-tab").setAttribute("aria-pressed", value === "new");
  $("#join-tab").setAttribute("aria-pressed", value === "join");
  const button = $("#start");
  const arrow = button.querySelector("svg");
  button.replaceChildren(document.createTextNode(value === "new" ? "Open a room " : "Join the moment "));
  if (arrow) button.append(arrow);
}
$("#new-tab").onclick = () => tab("new");
$("#join-tab").onclick = () => tab("join");
function parseInvite(value) {
  let code = value.trim();
  if (code.startsWith("http")) {
    const url = new URL(code);
    if (url.origin !== location.origin)
      throw Error("Use an invitation from this Relay Room demo.");
    code = url.hash.slice(1);
  }
  const match = code.match(/^([a-f\d-]{36})\.([\w-]{43})$/);
  if (!match) throw Error("Paste the complete private invitation link.");
  return { id: match[1], invite: match[2] };
}
if (location.hash) {
  try {
    parseInvite(location.href);
    $("#invite-link").value = location.href;
    tab("join");
  } catch {}
}
async function api(
  path,
  { method = "GET", body, token = session?.token } = {},
) {
  const result = await fetch("/api" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "X-Demo-Authorization": `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let data;
  try {
    data = await result.json();
  } catch {
    throw Error("The room service is unavailable. Try again in a moment.");
  }
  if (!result.ok) {
    const error = new Error(data.error || "Request failed.");
    error.status = result.status;
    throw error;
  }
  return data;
}
function controls(active) {
  for (const id of ["mic", "camera", "copy-link", "leave"])
    $("#" + id).disabled = !active;
  $("#setup-fields").hidden = active;
  $("#active-fields").hidden = !active;
}
async function start() {
  if (starting) return;
  starting = true;
  $("#start").disabled = true;
  $("#error").textContent = "";
  let obtained;
  try {
    const name = $("#display-name").value.trim();
    if (!name || name.length > 40) throw Error("Add a display name first.");
    const roomName = $("#room-name").value.trim();
    if (mode === "new" && !roomName) throw Error("Give your room a name.");
    const join = mode === "join" ? parseInvite($("#invite-link").value) : null;
    if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection)
      throw Error("This browser needs secure HTTPS and WebRTC support.");
    obtained = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 960 }, height: { ideal: 540 } },
      audio: true,
    });
    stream = obtained;
    const result = await api(join ? `/rooms/${join.id}/join` : "/rooms", {
      method: "POST",
      body: join ? { name, invite: join.invite } : { name, roomName },
      token: null,
    });
    session = result;
    invite = join?.invite || result.invite;
    $("#local-video").srcObject = stream;
    $("#local-placeholder").hidden = true;
    $("#self-name").textContent = name + " / YOU";
    $("#self-state").textContent = "LIVE";
    $("#room-title").textContent = result.name;
    $("#share-link").value =
      location.origin + location.pathname + "#" + result.roomId + "." + invite;
    $("#lifetime").textContent =
      "This room ends at " +
      new Date(result.expiresAt).toLocaleTimeString() +
      ". No recordings.";
    $("#connection-state").textContent = "● ROOM OPEN";
    controls(true);
    history.replaceState(null, "", location.pathname);
    status("You’re here. Share your invitation to bring someone closer.");
    await poll();
    timer = setInterval(poll, 3000);
  } catch (e) {
    obtained?.getTracks().forEach((t) => t.stop());
    stream = null;
    $("#error").textContent = mediaError(e);
  } finally {
    starting = false;
    $("#start").disabled = false;
  }
}
$("#start").onclick = start;
function tile(id, name) {
  const article = document.createElement("article");
  article.className = "video-tile";
  article.dataset.peer = id;
  const video = document.createElement("video");
  video.autoplay = true;
  video.playsInline = true;
  video.setAttribute("aria-label", name + " camera");
  const label = document.createElement("div");
  label.className = "video-label";
  const n = document.createElement("span"),
    state = document.createElement("span");
  n.textContent = name;
  state.textContent = "CONNECTING";
  label.append(n, state);
  article.append(video, label);
  $("#videos").append(article);
  return { article, video, state };
}
function connection(id, name) {
  if (peers.has(id)) return peers.get(id);
  const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    }),
    view = tile(id, name);
  stream.getTracks().forEach((track) => pc.addTrack(track, stream));
  const peer = { pc, ...view };
  peers.set(id, peer);
  pc.ontrack = (e) => {
    view.video.srcObject = e.streams[0];
    view.video.play().catch(() => {
      status("Tap a video tile to hear the remote audio.");
      view.video.onclick = () => view.video.play().catch(() => {});
    });
  };
  pc.onconnectionstatechange = () => {
    view.state.textContent = pc.connectionState.toUpperCase();
    if (pc.connectionState === "connected") {
      status("Connected directly. Make yourself at home.");
      $("#connection-state").textContent = "● TOGETHER";
    }
    if (["failed", "disconnected"].includes(pc.connectionState))
      status(
        "The direct connection was interrupted. A restrictive network may need a relay this free demo does not include. Leave and try another network.",
      );
  };
  peer.timeout = setTimeout(() => {
    if (pc.connectionState !== "connected")
      status(
        "Still connecting? Work networks can block direct calls. Try a different network; this free demo has no TURN relay.",
      );
  }, 30000);
  return peer;
}
async function gathered(pc) {
  if (pc.iceGatheringState === "complete") return;
  await new Promise((resolve) => {
    const timeout = setTimeout(done, 8000);
    function done() {
      clearTimeout(timeout);
      pc.removeEventListener("icegatheringstatechange", changed);
      resolve();
    }
    function changed() {
      if (pc.iceGatheringState === "complete") done();
    }
    pc.addEventListener("icegatheringstatechange", changed);
  });
}
async function sendDescription(peer, to, type) {
  if (!session || peer.pc.signalingState === "closed") return;
  const description =
    type === "offer"
      ? await peer.pc.createOffer()
      : await peer.pc.createAnswer();
  await peer.pc.setLocalDescription(description);
  await gathered(peer.pc);
  if (session)
    await api(`/rooms/${session.roomId}/signals`, {
      method: "POST",
      body: { to, type, sdp: peer.pc.localDescription.sdp },
    });
}
async function poll() {
  if (polling || !session) return;
  polling = true;
  try {
    if (Date.now() >= Date.parse(session.expiresAt)) {
      await leave(false);
      status("This 30-minute room has ended. Start a fresh moment.");
      return;
    }
    const room = await api(`/rooms/${session.roomId}`);
    $("#end-room").hidden = room.owner !== session.peerId;
    for (const [id, p] of peers) {
      if (!room.participants.some((v) => v.id === id)) {
        clearTimeout(p.timeout);
        p.pc.close();
        p.article.remove();
        peers.delete(id);
      }
    }
    for (const person of room.participants) {
      if (person.id === session.peerId) continue;
      const exists = peers.has(person.id),
        peer = connection(person.id, person.name);
      if (!exists && session.peerId < person.id)
        await sendDescription(peer, person.id, "offer");
    }
    for (const signal of room.signals) {
      if (seen.has(signal.id)) continue;
      const person = room.participants.find((p) => p.id === signal.from);
      if (!person) continue;
      const peer = connection(person.id, person.name);
      await peer.pc.setRemoteDescription({
        type: signal.type,
        sdp: signal.sdp,
      });
      if (signal.type === "offer")
        await sendDescription(peer, person.id, "answer");
      seen.add(signal.id);
    }
  } catch (e) {
    if ([401, 410].includes(e.status)) {
      await leave(false);
      status("The room has ended. You can create a fresh invitation.");
    } else {
      $("#error").textContent = e.message;
    }
  } finally {
    polling = false;
  }
}
function release() {
  clearInterval(timer);
  timer = null;
  for (const peer of peers.values()) {
    clearTimeout(peer.timeout);
    peer.pc.close();
    peer.article.remove();
  }
  peers.clear();
  seen.clear();
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  $("#local-video").srcObject = null;
  $("#local-placeholder").hidden = false;
  $("#self-state").textContent = "CAMERA OFF";
  $("#connection-state").textContent = "● ROOM ENDED";
  controls(false);
  $("#mic").setAttribute("aria-pressed", "false");
  $("#mic").innerHTML = '<span aria-hidden="true">◉</span> Mute mic';
  $("#camera").setAttribute("aria-pressed", "false");
  $("#camera").innerHTML = '<span aria-hidden="true">▣</span> Camera off';
}
async function leave(notify = true) {
  const prior = session;
  session = null;
  release();
  if (notify && prior)
    try {
      await api(`/rooms/${prior.roomId}/membership`, {
        method: "DELETE",
        token: prior.token,
      });
    } catch {}
  $("#share-link").value = "";
  status("You’ve left. Your camera and microphone are off.");
}
$("#leave").onclick = () => leave();
$("#end-room").onclick = async () => {
  if (!session || !confirm("End this room for everyone?")) return;
  try {
    await api(`/rooms/${session.roomId}`, { method: "DELETE" });
    await leave(false);
    status("Room ended for everyone.");
  } catch (e) {
    $("#error").textContent = e.message;
  }
};
$("#mic").onclick = () => {
  if (!stream) return;
  const muted = $("#mic").getAttribute("aria-pressed") !== "true";
  stream.getAudioTracks().forEach((t) => (t.enabled = !muted));
  $("#mic").setAttribute("aria-pressed", muted);
  $("#mic").innerHTML = muted
    ? '<span aria-hidden="true">◌</span> Unmute mic'
    : '<span aria-hidden="true">◉</span> Mute mic';
};
$("#camera").onclick = () => {
  if (!stream) return;
  const off = $("#camera").getAttribute("aria-pressed") !== "true";
  stream.getVideoTracks().forEach((t) => (t.enabled = !off));
  $("#camera").setAttribute("aria-pressed", off);
  $("#camera").innerHTML = off
    ? '<span aria-hidden="true">▣</span> Camera on'
    : '<span aria-hidden="true">▣</span> Camera off';
  $("#self-state").textContent = off ? "CAMERA OFF" : "LIVE";
};
$("#copy-link").onclick = async () => {
  try {
    await navigator.clipboard.writeText($("#share-link").value);
    status("Invitation copied. Share it privately with someone you trust.");
  } catch {
    $("#share-link").focus();
    $("#share-link").select();
    status("Copy the selected invitation link.");
  }
};
addEventListener("pagehide", () => {
  if (session)
    fetch(`/api/rooms/${session.roomId}/membership`, {
      method: "DELETE",
      headers: { "X-Demo-Authorization": `Bearer ${session.token}` },
      keepalive: true,
    }).catch(() => {});
  session = null;
  release();
});
// A bounded flow-field drawing: no shaders, downloads, or per-frame DOM layout.
const canvas = $("#flow"),
  ctx = canvas.getContext("2d");
let frame = 0,
  raf = 0,
  visible = true;
function draw() {
  cancelAnimationFrame(raf);
  if (!ctx || !motion || document.hidden || !visible) return;
  const width = canvas.width,
    height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.lineWidth = 0.6;
  for (let row = 0; row < 26; row++) {
    ctx.beginPath();
    for (let x = 0; x <= width; x += 12) {
      const y =
        height * 0.35 +
        row * 8 +
        Math.sin(x * 0.007 + frame * 0.004 + row * 0.12) * 40 +
        Math.sin(x * 0.003 - row * 0.09) * 80;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(160,221,201,${0.13 + row * 0.004})`;
    ctx.stroke();
  }
  frame++;
  raf = requestAnimationFrame(draw);
}
function resize() {
  canvas.width = Math.min(innerWidth, 1600);
  canvas.height = 620;
}
resize();
addEventListener("resize", resize);
document.addEventListener("visibilitychange", () => {
  cancelAnimationFrame(raf);
  draw();
});
new IntersectionObserver((entries) => {
  visible = entries[0].isIntersecting;
  cancelAnimationFrame(raf);
  draw();
}).observe(canvas);
function applyMotion() {
  document.body.classList.toggle("paused", !motion);
  $("#motion").setAttribute("aria-pressed", String(!motion));
  $("#motion").textContent = motion ? "Pause motion" : "Resume motion";
  cancelAnimationFrame(raf);
  if (!motion) ctx?.clearRect(0, 0, canvas.width, canvas.height);
  else draw();
}
$("#motion").onclick = () => {
  motion = !motion;
  applyMotion();
};
motionPreference.addEventListener("change", (event) => {
  motion = !event.matches;
  applyMotion();
});
applyMotion();

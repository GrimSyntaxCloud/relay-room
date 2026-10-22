# Relay Room

[Live demo](https://mango-sea-0c6bba80f.4.azurestaticapps.net)

A small-group video chat recovered from Andres's [`videoCallWebRTC` project](https://github.com/GrimSyntaxCloud/javaScript/tree/master/videoCallWebRTC). Make a room, share a private invitation, join with a display name, mute/unmute, pause/resume the camera, leave, or end the room as host. The free demo supports **up to four participants**.

Aurora colour, translucent panels, a liquid-morph illustration and a bounded animated flow field give the room a calm identity. Controls respond immediately to state changes. Animations pause when requested; the canvas stops when it is off-screen or the tab is hidden.

## How the call works

Native `RTCPeerConnection` replaces the obsolete SimpleWebRTC/webpack stack. A mesh creates one direct connection per participant pair. The lexicographically smaller participant ID creates each offer, avoiding simultaneous offers. ICE candidates are gathered into the session description and exchanged through a small authenticated HTTP polling API. Camera and microphone tracks stay in the browsers; there is no recording, media upload, or server-side media processing.

**Connection limitation:** the app uses Google's public STUN endpoint (`stun.l.google.com:19302`) and has **no TURN relay**. STUN and peers receive network connection metadata. Calls may fail behind restrictive corporate firewalls, VPNs or incompatible NATs; retrying on another network can help. A successful same-network test does not guarantee cross-network connectivity. No paid relay or service signup is included. See the [WebRTC TURN guide](https://webrtc.org/getting-started/turn-server).

Invitation secrets live in URL fragments, so they are not sent in page requests or referrers. Anyone with a valid invitation may join until the room is full. The server stores only a hash of the invitation and of each participant token. Poll responses disclose only signaling addressed to that participant. Signaling contains SDP/network metadata, not recordings.

Rooms expire **30 minutes after creation**; the browser ends the call when it observes expiry. This shorter lifetime is appropriate for ephemeral call setup and does not extend the existing 96-hour maximum for visitor demo data. Leaving closes peer connections and stops local tracks. Closing a tab attempts a best-effort departure; an interrupted browser may leave a membership slot until expiry. Create a fresh room if needed. The host can end the room for everyone.

## Local development

Use Node.js 22.22 or newer. `npm ci` installs the locked dependencies. `npm test` runs the regression suite. `npm run build` creates the deployment package. No global CLI or paid tool is required.

For a disposable local demo with no database account, run:

```sh
LOCAL_DEMO=true PORT=4392 npm start
```

For persistent local MongoDB, copy `.env.example` to `.env`, use a local development database, and run `npm start`. Node loads that file; it is ignored by Git. `LOCAL_DEMO=true` uses process memory, so restarting clears it. It is never enabled in the hosted app.

## Free deployment and data

GitHub Actions checks tests, dependency advisories and packaging before deploying to Azure Static Web Apps **Free**. Deployment credentials are in the repository's `azure` environment. Database settings are server-only Azure app settings. Cleanup uses a separate, collection-scoped credential in `DEMO_CLEANUP_MONGODB_URI`.

The app uses an isolated collection in the existing `portfolio-demos` database and shares its existing **400 RU/s** pool. It has no dedicated throughput. The Cosmos free tier, single-region configuration, account throughput cap and subscription spending limit must stay enabled. No subscription upgrade is authorized. If an Azure trial expires, stop rather than converting it to paid service.

Expiry is enforced by the API at the fixed deadline. Hourly cleanup physically deletes expired visitor documents on the next successful run; new-workspace/room creation also attempts cleanup. GitHub may delay scheduled runs or disable them after inactivity, so physical deletion is not guaranteed to occur at the exact deadline. Cleanup logs counts only and excludes permanent demo records.

## Design and accessibility

Original CSS, SVG and native Web Animations keep the animation layer dependency-free. System fonts, keyboard-operable controls, visible focus states, reduced-motion support and a pause-motion control are included. There are no analytics, paid assets or third-party font downloads.

## Tests and attribution

`npm test` covers invitations, membership, capacity, recipient-only signaling, host controls, departure and fixed expiry. For a local browser test without using real devices, run `node test/browser-server.cjs` and open `http://127.0.0.1:4394/__test` in two tabs. The test-only route uses animated canvas video and silent generated audio. It is excluded from Azure packages.

Original learning project: Andres Macias. Modernization, design and security implementation developed with AI assistance. Real calls require HTTPS (localhost is allowed by browsers) and camera/microphone consent. The app does not record, but it cannot prevent participants from using independent recording tools.

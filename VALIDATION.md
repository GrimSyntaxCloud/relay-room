# Validation

Five automated tests pass, including invitations, room capacity, participant-only signaling, host controls, departure, fixed expiry and real MongoDB persistence/concurrency. Two local browser participants connected using generated video and silent audio; mute/camera controls responded and leaving restored the off-camera state. No real camera or microphone was used. This does not certify every network: no TURN relay is configured. Dependency audit: zero known vulnerabilities on October 22, 2026.

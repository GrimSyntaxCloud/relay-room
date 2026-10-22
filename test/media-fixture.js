// Test-only fixture: animated canvas frames and silent generated audio, never real devices.
Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
  value: async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext("2d");
    let tick = 0;
    const interval = setInterval(() => {
      ctx.fillStyle = "#274b55";
      ctx.fillRect(0, 0, 640, 360);
      ctx.fillStyle = "#c2efdb";
      ctx.font = "32px sans-serif";
      ctx.fillText("SYNTHETIC MEDIA TEST", 100, 170);
      ctx.fillText(String(++tick), 300, 220);
    }, 100);
    const stream = canvas.captureStream(10);
    const context = new AudioContext(),
      osc = context.createOscillator(),
      gain = context.createGain(),
      destination = context.createMediaStreamDestination();
    gain.gain.value = 0;
    osc.connect(gain).connect(destination);
    osc.start();
    await context.resume();
    stream.addTrack(destination.stream.getAudioTracks()[0]);
    for (const t of stream.getTracks()) {
      const original = t.stop.bind(t);
      t.stop = () => {
        original();
        clearInterval(interval);
        context.close().catch(() => {});
      };
    }
    return stream;
  },
});

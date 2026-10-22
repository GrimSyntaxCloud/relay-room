const fs = require("node:fs");
fs.rmSync("release", { recursive: true, force: true });
fs.mkdirSync("release/api", { recursive: true });
fs.cpSync("public", "release/site", { recursive: true });
for (const name of [
  "app.cjs",
  "lib",
  "azure",
  "package.json",
  "package-lock.json",
])
  fs.cpSync(name, "release/api/" + name, { recursive: true });
fs.copyFileSync("azure/host.json", "release/api/host.json");
const pkg = JSON.parse(fs.readFileSync("release/api/package.json"));
pkg.main = "azure/functions.cjs";
pkg.engines = { node: "22.x" };
delete pkg.devDependencies;
delete pkg.scripts;
fs.writeFileSync("release/api/package.json", JSON.stringify(pkg, null, 2));
console.log("Azure static site and managed API package ready.");

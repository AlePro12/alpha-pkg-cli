const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const { substituteString } = require("../src/lib/template");
const { mkTmp, runCli } = require("./helpers");

test("template: la sustitución no rompe ${{ ... }} de GitHub Actions", () => {
  const vars = { keyName: "mi-paquete", secrets: "ROTO" };
  const src = "x: ${{ secrets.ALPHA_STORE_TOKEN }} # {keyName} ${{ github.repository }} {noExiste}";
  assert.equal(
    substituteString(src, vars),
    "x: ${{ secrets.ALPHA_STORE_TOKEN }} # mi-paquete ${{ github.repository }} {noExiste}"
  );
});

test("init --yes: genera manifiesto con targets, dotfiles y workflow de release", async () => {
  const cwd = mkTmp();
  const r = await runCli(["init", "mi-paquete", "--yes", "--target", "both"], { cwd });
  assert.equal(r.timedOut, false);
  assert.equal(r.code, 0, r.stdout + r.stderr);

  const dir = path.join(cwd, "mi-paquete");
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, "mi-paquete.appkg"), "utf8"));
  assert.deepEqual(manifest.targets, ["desktop", "saas"]);
  assert.equal(manifest.version, "0.1.0");

  for (const f of [".gitignore", ".alphaignore", ".github/workflows/release.yml", "index.js"])
    assert.ok(fs.existsSync(path.join(dir, f)), `falta ${f}`);
  assert.ok(!fs.existsSync(path.join(dir, "_gitignore")));

  const wf = fs.readFileSync(path.join(dir, ".github/workflows/release.yml"), "utf8");
  assert.ok(wf.includes("ALPHA_STORE_TOKEN: ${{ secrets.ALPHA_STORE_TOKEN }}"));
  assert.ok(wf.includes("uses: AlePro12/alpha-pkg-cli/.github/workflows/release-package.yml@main"));
  assert.ok(wf.includes("mi-paquete"));
  assert.ok(!wf.includes("{keyName}"));

  const gi = fs.readFileSync(path.join(dir, ".gitignore"), "utf8");
  for (const l of ["node_modules", "dist", ".alpharc", ".env"]) assert.ok(gi.split("\n").includes(l), l);

  // lint y build del paquete recién generado
  const lint = await runCli(["lint"], { cwd: dir });
  assert.equal(lint.code, 0, lint.stdout + lint.stderr);
  const build = await runCli(["build", "--bump", "none"], { cwd: dir });
  assert.equal(build.code, 0, build.stdout + build.stderr);
  const names = new AdmZip(path.join(dir, "dist", "mi-paquete-0.1.0.zip"))
    .getEntries()
    .map((e) => e.entryName);
  assert.ok(names.includes("mi-paquete/mi-paquete.appkg"));
  assert.ok(names.every((n) => n.startsWith("mi-paquete/")));
  assert.ok(!names.some((n) => /\.github|\.gitignore|\.alphaignore/.test(n)), names.join(","));
});

test("init: target por defecto desktop; --target inválido falla", async () => {
  const cwd = mkTmp();
  const r = await runCli(["init", "otro-pkg", "--template", "renderer"], { cwd });
  assert.equal(r.code, 0, r.stdout + r.stderr);
  const manifest = JSON.parse(fs.readFileSync(path.join(cwd, "otro-pkg", "otro-pkg.appkg"), "utf8"));
  assert.deepEqual(manifest.targets, ["desktop"]);

  const bad = await runCli(["init", "malo-pkg", "--yes", "--target", "movil"], { cwd });
  assert.equal(bad.code, 1);
  assert.match(bad.stderr, /--target/);
  assert.ok(!fs.existsSync(path.join(cwd, "malo-pkg")));
});

test("todos los templates generan un paquete que pasa lint", async () => {
  const cwd = mkTmp();
  for (const t of ["fullstack", "renderer", "report", "extension", "crud", "importer", "downbar"]) {
    const name = `pkg-${t}`;
    const r = await runCli(["init", name, "--yes", "--template", t, "--target", "saas"], { cwd });
    assert.equal(r.code, 0, t + ": " + r.stdout + r.stderr);
    const lint = await runCli(["lint", name], { cwd });
    assert.equal(lint.code, 0, t + ": " + lint.stdout + lint.stderr);
    assert.ok(!/✖/.test(lint.stdout), t + ": " + lint.stdout);
  }
});

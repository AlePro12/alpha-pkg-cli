const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { TOKEN, mkTmp, makePackage, runCli, startFakeStore } = require("./helpers");

const lastJson = (stdout) => JSON.parse(stdout.trim().split("\n").pop());
const readVersion = (dir, keyName) =>
  JSON.parse(fs.readFileSync(path.join(dir, `${keyName}.appkg`), "utf8")).version;

test("next-version: imprime SOLO la versión en stdout (patch+1 de la mayor)", async (t) => {
  const store = await startFakeStore({ packages: { "demo-pkg": ["1.4.1", "1.4.2", "1.3.9"] } });
  t.after(() => store.close());
  const dir = makePackage(mkTmp(), { folder: "repo", keyName: "demo-pkg", manifest: { version: "1.0.0" } });

  const r = await runCli(["next-version", "."], {
    cwd: dir,
    env: { ALPHA_STORE_TOKEN: TOKEN, ALPHA_STORE_URL: store.url },
  });
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.stdout, "1.4.3\n");
  const req = store.requests[0];
  assert.equal(req.path, "/api/ci/packages/demo-pkg/next-version");
  assert.equal(req.query, "?manifest=1.0.0");
  assert.equal(req.auth, `Bearer ${TOKEN}`);
});

test("next-version: manifiesto mayor gana; primera versión; --json", async (t) => {
  const store = await startFakeStore({ packages: { "demo-pkg": ["1.4.2"], nuevo: [] } });
  t.after(() => store.close());
  const root = mkTmp();
  const dir = makePackage(root, { keyName: "demo-pkg", manifest: { version: "2.0.0" } });
  const r = await runCli(["next-version", dir, "--token", TOKEN, "--store-url", store.url, "--json"]);
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), {
    keyName: "demo-pkg",
    version: "2.0.0",
    highest: "1.4.2",
    reason: "manifest",
    manifest: "2.0.0",
  });

  const dir2 = makePackage(root, { keyName: "nuevo", manifest: { version: "0.1.0" } });
  const r2 = await runCli(["next-version", dir2, "--token", TOKEN, "--store-url", store.url]);
  assert.equal(r2.stdout, "0.1.0\n");
});

test("next-version: 404, token inválido, sin token y sin permiso → exit 1 con stdout vacío", async (t) => {
  const store = await startFakeStore({ packages: { prohibido: ["1.0.0"] } });
  t.after(() => store.close());
  const root = mkTmp();
  const dir = makePackage(root, { keyName: "no-existe" });

  let r = await runCli(["next-version", dir, "--token", TOKEN, "--store-url", store.url]);
  assert.equal(r.code, 1);
  assert.equal(r.stdout, "");
  assert.match(r.stderr, /no existe en la tienda/);

  r = await runCli(["next-version", dir, "--token", "aps_malo", "--store-url", store.url]);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /Token de API inválido/);

  r = await runCli(["next-version", dir, "--store-url", store.url]);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /ALPHA_STORE_TOKEN/);
  assert.equal(r.stdout, "");

  const dir2 = makePackage(root, { keyName: "prohibido" });
  r = await runCli(["next-version", dir2, "--token", TOKEN, "--store-url", store.url]);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /no tiene permiso/);
});

test("publish con token: éxito, --version escribe manifiesto y package.json, --json", async (t) => {
  const store = await startFakeStore({ packages: { "demo-pkg": ["1.4.2"] } });
  t.after(() => store.close());
  const dir = makePackage(mkTmp(), {
    folder: "repo-clonado",
    keyName: "demo-pkg",
    files: { "package.json": JSON.stringify({ name: "demo-pkg", version: "1.0.0" }), ".env": "SECRETO=1" },
  });

  const r = await runCli(
    ["publish", ".", "--version", "1.4.3", "--yes", "--skip-existing", "--json", "--changelog", "- fix: uno\n- feat: dos", "--prerelease"],
    { cwd: dir, env: { ALPHA_STORE_TOKEN: TOKEN, ALPHA_STORE_URL: store.url } }
  );
  assert.equal(r.timedOut, false);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.deepEqual(lastJson(r.stdout), { keyName: "demo-pkg", version: "1.4.3", published: true });

  assert.equal(readVersion(dir, "demo-pkg"), "1.4.3");
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")).version, "1.4.3");
  assert.ok(fs.existsSync(path.join(dir, "dist", "demo-pkg-1.4.3.zip")));

  assert.deepEqual(store.uploads, [
    {
      via: "ci",
      keyName: "demo-pkg",
      version: "1.4.3",
      changelog: "- fix: uno\n- feat: dos",
      isPrerelease: "true",
      hasFile: true,
    },
  ]);
  // con token solo se usa el endpoint de CI (ni login ni búsqueda de admin)
  assert.deepEqual(
    store.requests.map((q) => `${q.method} ${q.path}`),
    ["POST /api/ci/packages/demo-pkg/versions"]
  );
  assert.equal(store.requests[0].auth, `Bearer ${TOKEN}`);
});

test("publish: --bump por defecto es none (no reescribe el manifiesto)", async (t) => {
  const store = await startFakeStore({ packages: { "demo-pkg": [] } });
  t.after(() => store.close());
  const dir = makePackage(mkTmp(), { keyName: "demo-pkg", manifest: { version: "3.1.4" } });
  const antes = fs.readFileSync(path.join(dir, "demo-pkg.appkg"), "utf8");

  const r = await runCli(["publish", dir, "--token", TOKEN, "--store-url", store.url, "--json"]);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.equal(fs.readFileSync(path.join(dir, "demo-pkg.appkg"), "utf8"), antes);
  assert.deepEqual(lastJson(r.stdout), { keyName: "demo-pkg", version: "3.1.4", published: true });
  assert.equal(store.uploads[0].isPrerelease, "false");
  assert.equal(store.uploads[0].changelog, "");

  // --bump patch sigue funcionando cuando se pide
  const r2 = await runCli(["publish", dir, "--token", TOKEN, "--store-url", store.url, "--bump", "patch", "--json"]);
  assert.equal(r2.code, 0, r2.stdout + r2.stderr);
  assert.equal(lastJson(r2.stdout).version, "3.1.5");
});

test("publish: 409 sin --skip-existing → exit 1; con --skip-existing → exit 0 y published:false", async (t) => {
  const store = await startFakeStore({ packages: { "demo-pkg": ["1.0.0"] } });
  t.after(() => store.close());
  const dir = makePackage(mkTmp(), { keyName: "demo-pkg", manifest: { version: "1.0.0" } });
  const base = ["publish", dir, "--token", TOKEN, "--store-url", store.url, "--yes", "--json"];

  const r = await runCli(base);
  assert.equal(r.code, 1, r.stdout + r.stderr);
  assert.match(r.stderr, /ya existe en la tienda/);
  assert.ok(!r.stdout.includes('"published"'));

  const r2 = await runCli([...base, "--skip-existing"]);
  assert.equal(r2.code, 0, r2.stdout + r2.stderr);
  assert.deepEqual(lastJson(r2.stdout), { keyName: "demo-pkg", version: "1.0.0", published: false });
  assert.equal(store.uploads.length, 0);
});

test("publish con token: paquete inexistente (404) → exit 1, no intenta crearlo", async (t) => {
  const store = await startFakeStore();
  t.after(() => store.close());
  const dir = makePackage(mkTmp(), { keyName: "fantasma" });

  const r = await runCli(["publish", dir, "--yes", "--skip-existing"], {
    env: { ALPHA_STORE_TOKEN: TOKEN, ALPHA_STORE_URL: store.url },
  });
  assert.equal(r.code, 1, r.stdout + r.stderr);
  assert.match(r.stderr, /no existe en la tienda/);
  assert.match(r.stderr, /créalo en el panel/);
  assert.ok(!store.requests.some((q) => q.path.startsWith("/api/admin")));
  assert.equal(store.packages.has("fantasma"), false);
});

test("publish con token inválido (401) → exit 1", async (t) => {
  const store = await startFakeStore({ packages: { "demo-pkg": [] } });
  t.after(() => store.close());
  const dir = makePackage(mkTmp(), { keyName: "demo-pkg" });
  const r = await runCli(["publish", dir, "--token", "aps_otro", "--store-url", store.url]);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /Token de API inválido/);
});

test("publish no interactivo sin credenciales → exit 1 rápido, sin colgarse ni escribir", async (t) => {
  const store = await startFakeStore({ packages: { "demo-pkg": [] } });
  t.after(() => store.close());
  const dir = makePackage(mkTmp(), { keyName: "demo-pkg" });

  // stdin es un pipe abierto (no TTY): sin --yes igual no debe preguntar
  for (const extra of [[], ["--yes"], ["--ci"]]) {
    const r = await runCli(["publish", dir, "--store-url", store.url, "--version", "9.9.9", ...extra], {
      timeout: 10000,
    });
    assert.equal(r.timedOut, false, "se colgó esperando input");
    assert.equal(r.code, 1, r.stdout + r.stderr);
    assert.match(r.stderr, /Faltan credenciales/);
    assert.match(r.stderr, /ALPHA_STORE_TOKEN/);
  }
  assert.equal(store.requests.length, 0);
  assert.equal(readVersion(dir, "demo-pkg"), "1.0.0");
  assert.ok(!fs.existsSync(path.join(dir, "dist")));

  // solo email, falta password: también falla sin preguntar
  const r = await runCli(["publish", dir, "--store-url", store.url, "--email", "admin@test.dev"], {
    env: { CI: "true" },
    timeout: 10000,
  });
  assert.equal(r.timedOut, false);
  assert.equal(r.code, 1);
});

test("publish admin (email/password) + --yes: crea el paquete sin preguntar y sube", async (t) => {
  const store = await startFakeStore();
  t.after(() => store.close());
  const dir = makePackage(mkTmp(), { keyName: "nuevo-pkg", manifest: { version: "0.1.0" } });

  const r = await runCli(["publish", dir, "--yes", "--json"], {
    env: {
      ALPHA_STORE_URL: store.url,
      ALPHA_STORE_EMAIL: "admin@test.dev",
      ALPHA_STORE_PASSWORD: "secreto",
    },
    timeout: 10000,
  });
  assert.equal(r.timedOut, false);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.deepEqual(lastJson(r.stdout), { keyName: "nuevo-pkg", version: "0.1.0", published: true });
  assert.deepEqual(
    store.requests.map((q) => `${q.method} ${q.path}`),
    [
      "POST /api/admin/login",
      "GET /api/admin/packages",
      "POST /api/admin/packages",
      "POST /api/admin/packages/id-nuevo-pkg/versions",
    ]
  );
  assert.deepEqual(store.uploads, [{ via: "admin", keyName: "nuevo-pkg", version: "0.1.0" }]);
});

test("publish: versión con sufijo y flags incompatibles → exit 1 antes de llamar a la tienda", async (t) => {
  const store = await startFakeStore({ packages: { "demo-pkg": [] } });
  t.after(() => store.close());
  const root = mkTmp();
  const dir = makePackage(root, { keyName: "demo-pkg" });
  const base = ["publish", dir, "--token", TOKEN, "--store-url", store.url];

  let r = await runCli([...base, "--version", "1.2.3-beta"]);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /X\.Y\.Z/);

  r = await runCli([...base, "--version", "1.2.3", "--bump", "patch"]);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /no se pueden usar juntos/);

  r = await runCli([...base, "--version", "1.2.3", "--no-build"]);
  assert.equal(r.code, 1);

  // manifiesto con sufijo: ni con --no-lint se publica
  const dir2 = makePackage(root, { folder: "beta", keyName: "demo-pkg", manifest: { version: "1.0.0-beta" } });
  r = await runCli(["publish", dir2, "--token", TOKEN, "--store-url", store.url, "--no-lint"]);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /X\.Y\.Z/);
  r = await runCli(["lint", dir2]);
  assert.equal(r.code, 1);
  assert.match(r.stdout, /X\.Y\.Z/);

  assert.equal(store.requests.length, 0);
  assert.equal(readVersion(dir, "demo-pkg"), "1.0.0");
});

test("CLI: --help, -v y `link -H` (sin chocar con la ayuda)", async () => {
  let r = await runCli(["--help"]);
  assert.equal(r.code, 0);
  for (const c of ["init", "lint", "build", "link", "unlink", "publish", "next-version"])
    assert.match(r.stdout, new RegExp(`\\b${c}\\b`));

  r = await runCli(["-v"]);
  assert.equal(r.stdout.trim(), require("../package.json").version);

  r = await runCli(["link", "-h"]);
  assert.equal(r.code, 0);
  assert.match(r.stdout, /-H, --host <url>/);

  // -H llega como host: puerto cerrado → error de conexión con ese host, exit 1
  const dir = makePackage(mkTmp(), { keyName: "demo-pkg" });
  r = await runCli(["link", dir, "-H", "http://127.0.0.1:1"], { timeout: 20000 });
  assert.equal(r.code, 1);
  assert.match(r.stdout + r.stderr, /127\.0\.0\.1:1/);
});

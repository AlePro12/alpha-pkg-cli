const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { validateManifest, readManifest } = require("../src/lib/manifest");
const { mkTmp, makePackage } = require("./helpers");

function lint(manifest, files) {
  const dir = makePackage(mkTmp(), { keyName: "pk", manifest, files });
  const issues = validateManifest(readManifest(path.join(dir, "pk.appkg")), dir);
  return {
    errors: issues.filter((i) => i.severity === "error").map((i) => i.msg),
    warnings: issues.filter((i) => i.severity === "warn").map((i) => i.msg),
  };
}
const has = (list, rx) => list.some((m) => rx.test(m));

test("manifiesto: mínimo válido sin issues", () => {
  assert.deepEqual(lint({}), { errors: [], warnings: [] });
});

test("manifiesto: versión con sufijo es error", () => {
  for (const version of ["1.2.3-beta", "1.2.3+1", "1.2", "v1.0.0"]) {
    const r = lint({ version });
    assert.ok(has(r.errors, /`version`.*X\.Y\.Z/), version);
  }
});

test("manifiesto: campos nuevos válidos no generan issues", () => {
  const r = lint(
    {
      targets: ["desktop", "saas"],
      saas: {
        main: [{ routeName: "api", routePath: "saas/index.js" }],
        renderer: [{ opcName: "X", opcPath: "saas/renderer", opcFile: "render" }],
      },
      products: ["alphaAdmin", "alphaPOS"],
      persist: ["data/", "cache/estado.json"],
      restartRequired: true,
      native: true,
      minVersion: "0.9.10",
    },
    { "saas/index.js": "", "saas/renderer/render.js": "" }
  );
  assert.deepEqual(r, { errors: [], warnings: [] });
});

test("manifiesto: targets inválidos", () => {
  assert.ok(has(lint({ targets: "saas" }).errors, /`targets`/));
  assert.ok(has(lint({ targets: [] }).errors, /`targets`/));
  assert.ok(has(lint({ targets: ["desktop", "movil"] }).errors, /"movil"/));
});

test("manifiesto: saas valida forma y archivos referenciados", () => {
  assert.ok(has(lint({ targets: ["saas"], saas: [] }).errors, /`saas` debe ser un objeto/));
  const r = lint({
    targets: ["saas"],
    saas: {
      main: [{ routeName: "api", routePath: "saas/nope.js" }],
      renderer: [{ opcName: "X", opcPath: "saas/r", opcFile: "render" }],
    },
  });
  assert.ok(has(r.errors, /saas\.main\[0\]\.routePath no existe/));
  assert.ok(has(r.errors, /saas\.renderer\[0\]\.opcFile no existe/));
  assert.ok(has(lint({ targets: ["saas"], saas: { main: {} } }).errors, /`saas\.main` debe ser un array/));
});

test("manifiesto: targets saas sin main ni saas.main → warning", () => {
  const r = lint({
    targets: ["saas"],
    main: undefined,
    renderer: [{ opcName: "X", opcPath: "renderer", opcFile: "render" }],
  }, { "renderer/render.js": "" });
  assert.deepEqual(r.errors, []);
  assert.ok(has(r.warnings, /no hay `saas\.main` ni `main`/));
  // con main de raíz no hay warning
  assert.deepEqual(lint({ targets: ["saas"] }).warnings, []);
});

test("manifiesto: targets saas + config.json → warning", () => {
  const r = lint({ targets: ["desktop", "saas"] }, { "config.json": "{}" });
  assert.ok(has(r.warnings, /en SaaS el estado va en la BD de la organización/));
  // solo desktop: sin warning
  assert.deepEqual(lint({}, { "config.json": "{}" }).warnings, []);
});

test("manifiesto: products, persist, restartRequired, native, minVersion", () => {
  assert.ok(has(lint({ products: "alphaAdmin" }).errors, /`products`/));
  assert.ok(has(lint({ products: ["ok", 3] }).errors, /`products`/));
  assert.ok(has(lint({ persist: "data" }).errors, /`persist`/));
  assert.ok(has(lint({ persist: ["../fuera"] }).errors, /persist\[0\]/));
  assert.ok(has(lint({ persist: ["a/../../b"] }).errors, /persist\[0\]/));
  assert.ok(has(lint({ persist: ["ok", "/abs"] }).errors, /persist\[1\]/));
  assert.ok(has(lint({ persist: ["C:\\abs"] }).errors, /persist\[0\]/));
  assert.ok(has(lint({ restartRequired: "si" }).errors, /`restartRequired`/));
  assert.ok(has(lint({ native: 1 }).errors, /`native`/));
  assert.ok(has(lint({ minVersion: "0.9" }).errors, /`minVersion`/));
  assert.ok(has(lint({ minVersion: "0.9.10-beta" }).errors, /`minVersion`/));
});

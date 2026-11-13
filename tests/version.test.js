const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const {
  isStrictVersion,
  bumpVersion,
  setVersion,
  syncPackageJson,
} = require("../src/lib/version");
const { mkTmp, makePackage } = require("./helpers");

test("versión: solo X.Y.Z numérico estricto", () => {
  for (const v of ["0.0.0", "1.2.3", "10.20.30"]) assert.equal(isStrictVersion(v), true, v);
  for (const v of ["1.2", "1.2.3-beta", "1.2.3+build", "v1.2.3", "1.2.3.4", "01.2.3", "1.2.x", "", null, 123])
    assert.equal(isStrictVersion(v), false, String(v));
});

test("versión: bump patch/minor/major/none", () => {
  assert.equal(bumpVersion("1.2.3", "patch"), "1.2.4");
  assert.equal(bumpVersion("1.2.3", "minor"), "1.3.0");
  assert.equal(bumpVersion("1.2.3", "major"), "2.0.0");
  assert.equal(bumpVersion("1.2.3", "none"), "1.2.3");
  assert.throws(() => bumpVersion("1.2.3-beta", "patch"), /X\.Y\.Z/);
  assert.throws(() => bumpVersion("1.2.3", "enorme"), /--bump/);
});

test("versión: setVersion escribe el manifiesto y el package.json", () => {
  const dir = makePackage(mkTmp(), {
    keyName: "pk",
    files: { "package.json": JSON.stringify({ name: "pk", version: "1.0.0" }) },
  });
  const manifestPath = path.join(dir, "pk.appkg");
  const r = setVersion(dir, manifestPath, "2.5.0");
  assert.equal(r.oldVersion, "1.0.0");
  assert.equal(r.manifestChanged, true);
  assert.equal(r.packageJsonChanged, true);
  assert.equal(JSON.parse(fs.readFileSync(manifestPath, "utf8")).version, "2.5.0");
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")).version, "2.5.0");
  assert.throws(() => setVersion(dir, manifestPath, "2.5.0-rc1"), /X\.Y\.Z/);
});

test("versión: package.json roto no se traga — devuelve el motivo", () => {
  const dir = makePackage(mkTmp(), { keyName: "pk", files: { "package.json": "{ roto" } });
  const r = syncPackageJson(dir, "1.0.1");
  assert.equal(r.changed, false);
  assert.match(r.warning, /package\.json/);
});

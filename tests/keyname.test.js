const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { resolveKeyName, findManifest } = require("../src/lib/manifest");
const { mkTmp, makePackage } = require("./helpers");

test("keyName: sale del único .appkg aunque la carpeta se llame distinto", () => {
  const dir = makePackage(mkTmp(), { folder: "repo-de-github", keyName: "mi-paquete" });
  assert.deepEqual(resolveKeyName(dir), { keyName: "mi-paquete", source: "manifest" });
  const info = findManifest(dir);
  assert.equal(info.keyName, "mi-paquete");
  assert.equal(info.manifestPath, path.join(dir, "mi-paquete.appkg"));
});

test("keyName: --key-name gana sobre el .appkg y la carpeta", () => {
  const dir = makePackage(mkTmp(), { folder: "carpeta", keyName: "uno" });
  fs.copyFileSync(path.join(dir, "uno.appkg"), path.join(dir, "dos.appkg"));
  assert.deepEqual(resolveKeyName(dir, "dos"), { keyName: "dos", source: "flag" });
  assert.equal(findManifest(dir, "dos").manifestPath, path.join(dir, "dos.appkg"));
});

test("keyName: sin .appkg cae al nombre de la carpeta (y findManifest falla claro)", () => {
  const dir = path.join(mkTmp(), "solo-carpeta");
  fs.mkdirSync(dir);
  assert.deepEqual(resolveKeyName(dir), { keyName: "solo-carpeta", source: "folder" });
  assert.throws(() => findManifest(dir), /No se encontró ningún manifiesto/);
});

test("keyName: varios .appkg → el que se llama como la carpeta; si no, error", () => {
  const dir = makePackage(mkTmp(), { folder: "uno", keyName: "uno" });
  fs.copyFileSync(path.join(dir, "uno.appkg"), path.join(dir, "otro.appkg"));
  assert.deepEqual(resolveKeyName(dir), { keyName: "uno", source: "folder" });

  const dir2 = makePackage(mkTmp(), { folder: "repo", keyName: "a" });
  fs.copyFileSync(path.join(dir2, "a.appkg"), path.join(dir2, "b.appkg"));
  assert.throws(() => resolveKeyName(dir2), /--key-name/);
});

test("keyName: --key-name con separadores o inexistente se rechaza", () => {
  const dir = makePackage(mkTmp(), { keyName: "uno" });
  assert.throws(() => resolveKeyName(dir, "../otro"), /no es válido/);
  assert.throws(() => findManifest(dir, "nope"), /nope\.appkg/);
});

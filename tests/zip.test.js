const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const { buildZip, shouldExclude, parseAlphaIgnore, listPackageFiles } = require("../src/lib/zip");
const { mkTmp, makePackage } = require("./helpers");

const SECRETOS = {
  ".alpharc": '{"password":"x"}',
  ".env": "A=1",
  ".env.local": "A=2",
  ".env.production": "A=3",
  ".gitignore": "dist",
  ".github/workflows/release.yml": "name: x",
  ".claude/settings.json": "{}",
  ".git/HEAD": "ref",
  "node_modules/dep/index.js": "",
  "dist/viejo-0.0.1.zip": "zip",
  "respaldo.zip": "zip",
  "sub/otro.zip": "zip",
  "debug.log": "log",
  ".DS_Store": "",
  ".alpha-git-token": "t",
};

function entries(zipPath) {
  return new AdmZip(zipPath).getEntries().map((e) => e.entryName).sort();
}

test("zip: exclusiones fijas", () => {
  for (const p of Object.keys(SECRETOS)) {
    const dirPart = p.includes("/") ? p.split("/")[0] + "/" : null;
    assert.ok(shouldExclude(p) || (dirPart && shouldExclude(dirPart)), `debería excluir ${p}`);
  }
  for (const p of ["index.js", "renderer/render.js", ".encryptIgnore", "env.js", "src/environment.js", "pk.appkg"])
    assert.equal(shouldExclude(p), false, `no debería excluir ${p}`);
});

test("zip: todo va bajo <keyName>/ (keyName del .appkg, no de la carpeta) y sin excluidos", () => {
  const dir = makePackage(mkTmp(), {
    folder: "nombre-del-repo",
    keyName: "mi-paquete",
    files: { ...SECRETOS, "renderer/render.js": "x", ".encryptIgnore": "# nada", "README.md": "# hola" },
  });
  const out = path.join(dir, "dist");
  const r = buildZip(dir, out, "1.0.0");
  assert.equal(path.basename(r.zipPath), "mi-paquete-1.0.0.zip");
  assert.equal(r.keyName, "mi-paquete");
  assert.deepEqual(entries(r.zipPath), [
    "mi-paquete/.encryptIgnore",
    "mi-paquete/README.md",
    "mi-paquete/index.js",
    "mi-paquete/mi-paquete.appkg",
    "mi-paquete/renderer/render.js",
  ]);
  assert.equal(r.entryCount, 5);
  assert.match(r.sha256, /^[0-9a-f]{64}$/);
});

test("zip: .alphaignore — nombre exacto, dir/, *.ext, ruta anclada y comentarios", () => {
  const dir = makePackage(mkTmp(), {
    keyName: "pk",
    files: {
      ".alphaignore": [
        "# comentario",
        "",
        "notas.txt",
        "docs/",
        "*.psd",
        "src/tmp/a.js",
        "  fixtures/  ",
      ].join("\n"),
      "notas.txt": "",
      "sub/notas.txt": "",
      "notas.txt.bak": "",
      "docs/guia.md": "",
      "sub/docs/otra.md": "",
      "arte/logo.psd": "",
      "arte/logo.png": "",
      "src/tmp/a.js": "",
      "src/tmp/b.js": "",
      "otro/src/tmp/a.js": "",
      "fixtures/x.json": "",
      "renderer/render.js": "",
    },
  });
  assert.deepEqual(listPackageFiles(dir), [
    "arte/logo.png",
    "index.js",
    "notas.txt.bak",
    "otro/src/tmp/a.js",
    "pk.appkg",
    "renderer/render.js",
    "src/tmp/b.js",
  ]);
  const r = buildZip(dir, path.join(dir, "dist"), "1.0.0");
  assert.ok(!entries(r.zipPath).some((e) => e.includes(".alphaignore")));
});

test("zip: .alphaignore no puede sacar el manifiesto", () => {
  const dir = makePackage(mkTmp(), { keyName: "pk", files: { ".alphaignore": "*.appkg\n" } });
  assert.ok(listPackageFiles(dir).includes("pk.appkg"));
});

test("zip: parseAlphaIgnore ignora vacías y comentarios", () => {
  assert.equal(parseAlphaIgnore("# a\n\n   \n#b").length, 0);
  assert.equal(parseAlphaIgnore("a\r\nb/\r\n*.c").length, 3);
});

test("zip: reconstruir no mete el zip anterior aunque --output esté dentro del paquete", () => {
  const dir = makePackage(mkTmp(), { keyName: "pk" });
  const out = path.join(dir, "salida");
  buildZip(dir, out, "1.0.0");
  const r = buildZip(dir, out, "1.0.1");
  assert.deepEqual(entries(r.zipPath), ["pk/index.js", "pk/pk.appkg"]);
  assert.ok(fs.existsSync(path.join(out, "pk-1.0.0.zip")));
});

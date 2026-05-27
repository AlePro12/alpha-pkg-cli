/**
 * Empaqueta una carpeta de paquete en un zip listo para subir al store.
 *
 * Layout del zip resultante:
 *   <keyName>/
 *   ├── <keyName>.appkg
 *   ├── index.js
 *   ├── renderer/
 *   └── ...
 *
 * Se EXCLUYEN: node_modules/, dist/, .git/, *.log, .DS_Store, .alpha-*
 * (el .gitignore del paquete no se respeta porque puede tener entradas
 * locales del dev — usamos una lista cerrada para reproducibilidad).
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const AdmZip = require("adm-zip");

const ALWAYS_EXCLUDE = [
  /(^|\/)node_modules\//,
  /(^|\/)dist\//,
  /(^|\/)\.git\//,
  /(^|\/)\.DS_Store$/,
  /(^|\/)\.alpha-git-token$/,
  /(^|\/)\.alpha-git-meta\.json$/,
  /\.log$/,
];

function shouldExclude(relPath) {
  const norm = relPath.replace(/\\/g, "/");
  return ALWAYS_EXCLUDE.some((rx) => rx.test(norm));
}

/**
 * @param {string} pkgDir   carpeta absoluta del paquete (basename = keyName)
 * @param {string} outDir   carpeta donde escribir el zip
 * @returns {{ zipPath: string, sha256: string, size: number, entryCount: number }}
 */
function buildZip(pkgDir, outDir, version) {
  const keyName = path.basename(pkgDir);
  const zip = new AdmZip();
  let entryCount = 0;

  walk(pkgDir, "", (relPath, fullPath) => {
    if (shouldExclude(relPath)) return;
    // Layout final: <keyName>/<relPath>
    const entryPath = `${keyName}/${relPath}`;
    zip.addLocalFile(fullPath, path.dirname(entryPath));
    entryCount++;
  });

  fs.mkdirSync(outDir, { recursive: true });
  const zipPath = path.join(outDir, `${keyName}-${version}.zip`);
  zip.writeZip(zipPath);

  const buf = fs.readFileSync(zipPath);
  const sha256 = crypto.createHash("sha256").update(buf).digest("hex");
  return { zipPath, sha256, size: buf.length, entryCount };
}

function walk(rootDir, relPrefix, cb) {
  const fullDir = path.join(rootDir, relPrefix);
  const entries = fs.readdirSync(fullDir, { withFileTypes: true });
  for (const entry of entries) {
    const rel = relPrefix ? path.join(relPrefix, entry.name) : entry.name;
    const full = path.join(rootDir, rel);
    if (entry.isDirectory()) {
      if (shouldExclude(rel + "/")) continue;
      walk(rootDir, rel, cb);
    } else if (entry.isFile()) {
      cb(rel, full);
    }
  }
}

module.exports = { buildZip, shouldExclude };

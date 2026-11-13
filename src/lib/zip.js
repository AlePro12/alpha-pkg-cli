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
 * Se EXCLUYEN siempre: node_modules/, dist/, .git/, .github/, .claude/,
 * *.log, *.zip, .DS_Store, .alpha-git-*, .alpharc, .env, .env.*, .gitignore
 * y .alphaignore. El .gitignore del paquete no se respeta porque puede tener
 * entradas locales del dev — usamos una lista cerrada para reproducibilidad.
 *
 * Para excluir algo más, el paquete declara un `.alphaignore` en su raíz:
 * una entrada por línea, `#` para comentarios y patrones simples:
 *   notas.txt     nombre exacto (archivo o carpeta, a cualquier profundidad)
 *   docs/         carpeta (a cualquier profundidad)
 *   *.psd         comodín `*` dentro de un nombre
 *   src/tmp/a.js  con `/` intermedia: ruta relativa a la raíz del paquete
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const AdmZip = require("adm-zip");
const { resolveKeyName } = require("./manifest");

const ALWAYS_EXCLUDE = [
  /(^|\/)node_modules\//,
  /(^|\/)dist\//,
  /(^|\/)\.git\//,
  /(^|\/)\.github\//,
  /(^|\/)\.claude\//,
  /(^|\/)\.DS_Store$/,
  /(^|\/)\.alpha-git-token$/,
  /(^|\/)\.alpha-git-meta\.json$/,
  /(^|\/)\.alpharc$/,
  /(^|\/)\.env(\.[^/]*)?$/,
  /(^|\/)\.gitignore$/,
  /(^|\/)\.alphaignore$/,
  /\.log$/,
  /\.zip$/,
];

function shouldExclude(relPath) {
  const norm = relPath.replace(/\\/g, "/");
  return ALWAYS_EXCLUDE.some((rx) => rx.test(norm));
}

function escapeRegex(s) {
  return s.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
}

/** Convierte un patrón simple (con `*`) en el fuente de un regex de segmento(s). */
function globToRegexSource(glob) {
  return glob.split("*").map(escapeRegex).join("[^/]*");
}

/**
 * Compila las líneas de un `.alphaignore` a una lista de regex que se prueban
 * contra la ruta relativa (con `/`; las carpetas llevan `/` final).
 *
 * @param {string} content
 * @returns {RegExp[]}
 */
function parseAlphaIgnore(content) {
  const rules = [];
  for (const rawLine of String(content || "").split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    line = line.replace(/\\/g, "/");

    const dirOnly = line.endsWith("/");
    if (dirOnly) line = line.replace(/\/+$/, "");
    const anchored = line.startsWith("/") || line.includes("/");
    line = line.replace(/^\/+/, "");
    if (!line) continue;

    const body = globToRegexSource(line);
    const prefix = anchored ? "^" : "(^|/)";
    // `dir/` solo casa carpetas; un nombre sin `/` final casa archivo o carpeta
    const suffix = dirOnly ? "/" : "(/|$)";
    rules.push(new RegExp(prefix + body + suffix));
  }
  return rules;
}

/** Lee `<pkgDir>/.alphaignore` si existe. */
function loadAlphaIgnore(pkgDir) {
  const file = path.join(pkgDir, ".alphaignore");
  if (!fs.existsSync(file)) return [];
  return parseAlphaIgnore(fs.readFileSync(file, "utf8"));
}

function matchesAny(rules, relPath) {
  const norm = relPath.replace(/\\/g, "/");
  return rules.some((rx) => rx.test(norm));
}

/**
 * Lista los archivos que entran al zip (rutas relativas con `/`).
 *
 * @param {string} pkgDir
 * @param {{ keyName?: string }} [opts]
 * @returns {string[]}
 */
function listPackageFiles(pkgDir, opts = {}) {
  const keyName = opts.keyName || resolveKeyName(pkgDir).keyName;
  const manifestName = `${keyName}.appkg`;
  const ignoreRules = loadAlphaIgnore(pkgDir);
  const files = [];

  const skip = (rel) => shouldExclude(rel) || matchesAny(ignoreRules, rel);

  const walk = (relDir) => {
    const entries = fs.readdirSync(path.join(pkgDir, relDir), { withFileTypes: true });
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (skip(rel + "/")) continue;
        walk(rel);
      } else if (entry.isFile()) {
        // El manifiesto no se puede excluir: sin él el zip no es un paquete
        if (rel !== manifestName && skip(rel)) continue;
        files.push(rel);
      }
    }
  };
  walk("");
  return files;
}

/**
 * @param {string} pkgDir   carpeta absoluta del paquete
 * @param {string} outDir   carpeta donde escribir el zip
 * @param {string} version
 * @param {{ keyName?: string }} [opts]  keyName ya resuelto (si no, se resuelve
 *        con resolveKeyName: único .appkg → nombre de carpeta)
 * @returns {{ zipPath: string, sha256: string, size: number, entryCount: number, keyName: string }}
 */
function buildZip(pkgDir, outDir, version, opts = {}) {
  const keyName = opts.keyName || resolveKeyName(pkgDir).keyName;
  const zip = new AdmZip();
  const files = listPackageFiles(pkgDir, { keyName });

  if (!files.includes(`${keyName}.appkg`)) {
    throw new Error(`falta ${keyName}.appkg en la raíz de ${pkgDir}`);
  }

  for (const rel of files) {
    // Layout final: <keyName>/<rel>
    const entryDir = path.posix.dirname(`${keyName}/${rel}`);
    zip.addLocalFile(path.join(pkgDir, rel), entryDir);
  }

  fs.mkdirSync(outDir, { recursive: true });
  const zipPath = path.join(outDir, `${keyName}-${version}.zip`);
  zip.writeZip(zipPath);

  const buf = fs.readFileSync(zipPath);
  const sha256 = crypto.createHash("sha256").update(buf).digest("hex");
  return { zipPath, sha256, size: buf.length, entryCount: files.length, keyName };
}

module.exports = {
  buildZip,
  shouldExclude,
  parseAlphaIgnore,
  loadAlphaIgnore,
  listPackageFiles,
};

/**
 * Versiones de paquetes Alpha: SOLO `X.Y.Z` numérico estricto.
 *
 * No se aceptan sufijos (`1.2.3-beta`, `1.2.3+build`): la tienda ordena y
 * compara versiones como tres enteros. Una pre-release se marca con el flag
 * `--prerelease` al publicar, no con un sufijo en el número.
 */
const fs = require("fs");
const path = require("path");

const STRICT_VERSION_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const VALID_BUMPS = ["patch", "minor", "major", "none"];

function isStrictVersion(v) {
  return typeof v === "string" && STRICT_VERSION_RE.test(v);
}

/** Mensaje estándar para una versión que no cumple `X.Y.Z`. */
function strictVersionMessage(v) {
  return (
    `versión "${v}" inválida: debe ser X.Y.Z numérico (sin sufijos como -beta). ` +
    `Para una pre-release usa el flag --prerelease al publicar.`
  );
}

/**
 * Incrementa una versión estricta.
 * @param {string} version  `X.Y.Z`
 * @param {"patch"|"minor"|"major"|"none"} type
 */
function bumpVersion(version, type) {
  if (!VALID_BUMPS.includes(type)) {
    throw new Error(`--bump debe ser ${VALID_BUMPS.join(" | ")}`);
  }
  if (type === "none") return version;
  if (!isStrictVersion(version)) throw new Error(strictVersionMessage(version));
  const [major, minor, patch] = version.split(".").map(Number);
  if (type === "major") return `${major + 1}.0.0`;
  if (type === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

/**
 * Sincroniza la versión en el `package.json` del paquete (si existe).
 * No lanza: un package.json ilegible no debe tumbar el build, pero se avisa
 * con el motivo.
 *
 * @returns {{ changed: boolean, warning: string|null }}
 */
function syncPackageJson(pkgDir, version) {
  const pkgJsonPath = path.join(pkgDir, "package.json");
  if (!fs.existsSync(pkgJsonPath)) return { changed: false, warning: null };
  try {
    const pj = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
    if (pj.version === version) return { changed: false, warning: null };
    pj.version = version;
    fs.writeFileSync(pkgJsonPath, JSON.stringify(pj, null, 2) + "\n");
    return { changed: true, warning: null };
  } catch (e) {
    return {
      changed: false,
      warning: `no se pudo sincronizar la versión en package.json: ${e.message}`,
    };
  }
}

/**
 * Fija la versión del paquete: escribe el manifiesto y el package.json.
 *
 * @param {string} pkgDir
 * @param {string} manifestPath
 * @param {string} version  `X.Y.Z`
 * @returns {{ oldVersion: string|undefined, version: string, manifestChanged: boolean,
 *             packageJsonChanged: boolean, warning: string|null }}
 */
function setVersion(pkgDir, manifestPath, version) {
  if (!isStrictVersion(version)) throw new Error(strictVersionMessage(version));
  // require diferido: manifest.js también usa este módulo
  const { readManifest, writeManifest } = require("./manifest");
  const manifest = readManifest(manifestPath);
  const oldVersion = manifest.version;
  const manifestChanged = oldVersion !== version;
  if (manifestChanged) {
    manifest.version = version;
    writeManifest(manifestPath, manifest);
  }
  const sync = syncPackageJson(pkgDir, version);
  return {
    oldVersion,
    version,
    manifestChanged,
    packageJsonChanged: sync.changed,
    warning: sync.warning,
  };
}

module.exports = {
  STRICT_VERSION_RE,
  VALID_BUMPS,
  isStrictVersion,
  strictVersionMessage,
  bumpVersion,
  syncPackageJson,
  setVersion,
};

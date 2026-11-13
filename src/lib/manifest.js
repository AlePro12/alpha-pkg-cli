/**
 * Manifest helpers — leer, validar y escribir `<keyName>.appkg`.
 *
 * Un paquete Alpha tiene `<keyName>.appkg` en su raíz. La carpeta suele
 * llamarse igual que el keyName, pero no es obligatorio (ver resolveKeyName).
 * El manifest es JSON puro (sin BOM, sin comentarios).
 */
const fs = require("fs");
const path = require("path");
const { isStrictVersion, strictVersionMessage } = require("./version");

const CATEGORIES = [
  "inventory",
  "sales",
  "purchases",
  "reports",
  "utils",
  "integrations",
  "pos",
  "other",
];
const SUPPORTED_EXTENSION_MODELS = ["VenCore/Facturas", "ComCore/Compras"];
const TARGETS = ["desktop", "saas"];
const DEFAULT_TARGETS = ["desktop"];
const DEFAULT_PRODUCTS = ["alphaAdmin"];

/**
 * Lista los `*.appkg` de la raíz del paquete (ordenados).
 */
function listManifests(pkgDir) {
  try {
    return fs
      .readdirSync(pkgDir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith(".appkg") && e.name.length > 6)
      .map((e) => e.name)
      .sort();
  } catch (e) {
    throw new Error(`No se pudo leer ${pkgDir}: ${e.message}`);
  }
}

/**
 * Resuelve el keyName del paquete, en este orden:
 *   1. `override` (flag `--key-name`)
 *   2. el único `*.appkg` de la carpeta (su nombre sin extensión)
 *   3. el nombre de la carpeta
 *
 * El punto 2 es lo que permite publicar desde CI, donde el checkout queda en
 * una carpeta con el nombre del repo y no con el del paquete.
 *
 * @param {string} pkgDir       ruta absoluta a la carpeta del paquete
 * @param {string} [override]   valor de `--key-name`
 * @returns {{ keyName: string, source: "flag"|"manifest"|"folder" }}
 */
function resolveKeyName(pkgDir, override) {
  if (override !== undefined && override !== null && override !== "") {
    const keyName = String(override).trim();
    if (!keyName || /[\\/]/.test(keyName) || keyName === "." || keyName === "..") {
      throw new Error(`--key-name "${override}" no es válido`);
    }
    return { keyName, source: "flag" };
  }

  const folderName = path.basename(pkgDir);
  const manifests = listManifests(pkgDir);
  if (manifests.length === 1) {
    return { keyName: manifests[0].slice(0, -".appkg".length), source: "manifest" };
  }
  if (manifests.length > 1 && !manifests.includes(`${folderName}.appkg`)) {
    throw new Error(
      `Hay varios manifiestos en ${pkgDir} (${manifests.join(", ")}) y ninguno se llama ` +
        `como la carpeta. Indica cuál usar con --key-name <keyName>.`
    );
  }
  return { keyName: folderName, source: "folder" };
}

/**
 * Localiza el manifest dentro de una carpeta de paquete.
 *
 * @param {string} pkgDir       ruta absoluta a la carpeta del paquete
 * @param {string} [keyNameOverride]  valor de `--key-name`
 * @returns {{ keyName: string, manifestPath: string, source: string }}
 */
function findManifest(pkgDir, keyNameOverride) {
  const { keyName, source } = resolveKeyName(pkgDir, keyNameOverride);
  const manifestPath = path.join(pkgDir, `${keyName}.appkg`);
  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      source === "flag"
        ? `No se encontró ${keyName}.appkg en ${pkgDir} (keyName dado con --key-name).`
        : `No se encontró ningún manifiesto .appkg en ${pkgDir}. ` +
            `Debe existir <keyName>.appkg en la raíz del paquete.`
    );
  }
  return { keyName, manifestPath, source };
}

function readManifest(manifestPath) {
  let raw;
  try {
    raw = fs.readFileSync(manifestPath, "utf8");
  } catch (e) {
    throw new Error(`No se pudo leer ${manifestPath}: ${e.message}`);
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(`${manifestPath} no es JSON válido: ${e.message}`);
  }
}

function writeManifest(manifestPath, manifest) {
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
}

/** Targets efectivos del manifiesto (default implícito: solo desktop). */
function getTargets(manifest) {
  return Array.isArray(manifest.targets) && manifest.targets.length > 0
    ? manifest.targets
    : DEFAULT_TARGETS;
}

/** `true` si la ruta es relativa y no se sale de la carpeta del paquete. */
function isSafeRelativePath(p) {
  if (typeof p !== "string" || p.trim() === "") return false;
  if (path.posix.isAbsolute(p) || path.win32.isAbsolute(p)) return false;
  return !p.split(/[\\/]+/).includes("..");
}

function validateMainList(list, label, pkgDir, err) {
  if (!Array.isArray(list)) {
    err(`\`${label}\` debe ser un array`);
    return;
  }
  list.forEach((m, i) => {
    if (!m || typeof m !== "object") {
      err(`${label}[${i}] debe ser un objeto`);
      return;
    }
    if (!m.routeName) err(`${label}[${i}].routeName requerido`);
    if (!m.routePath) {
      err(`${label}[${i}].routePath requerido`);
    } else if (!m.routePath.endsWith(".js")) {
      err(
        `${label}[${i}].routePath debe terminar en .js (NO .js-alpcrt; el store encripta automáticamente)`
      );
    } else if (pkgDir) {
      const filePath = path.join(pkgDir, m.routePath);
      const encryptedPath = filePath + "-alpcrt";
      if (!fs.existsSync(filePath) && !fs.existsSync(encryptedPath)) {
        err(`${label}[${i}].routePath no existe: ${m.routePath}`);
      }
    }
  });
}

function validateRendererList(list, label, pkgDir, err) {
  if (!Array.isArray(list)) {
    err(`\`${label}\` debe ser un array`);
    return;
  }
  list.forEach((r, i) => {
    if (!r || typeof r !== "object") {
      err(`${label}[${i}] debe ser un objeto`);
      return;
    }
    if (!r.opcName) err(`${label}[${i}].opcName requerido`);
    if (!r.opcFile) err(`${label}[${i}].opcFile requerido`);
    if (!r.opcPath) err(`${label}[${i}].opcPath requerido`);
    if (pkgDir && r.opcFile && r.opcPath) {
      // `opcFile` se declara sin extensión (convención de los templates),
      // pero toleramos que el usuario incluya ".js" para no romper el lint.
      const base = r.opcFile.endsWith(".js") ? r.opcFile.slice(0, -3) : r.opcFile;
      const filePath = path.join(pkgDir, r.opcPath, base + ".js");
      const encryptedPath = filePath + "-alpcrt";
      if (!fs.existsSync(filePath) && !fs.existsSync(encryptedPath)) {
        err(`${label}[${i}].opcFile no existe: ${r.opcPath}/${base}.js`);
      }
    }
  });
}

/**
 * Valida el manifest contra el schema esperado por AlphaPackageMgr.
 * Retorna lista de issues (severidad warn | error).
 */
function validateManifest(manifest, pkgDir) {
  const issues = [];
  const err = (msg) => issues.push({ severity: "error", msg });
  const warn = (msg) => issues.push({ severity: "warn", msg });

  // Campos requeridos
  if (!manifest.name) err("Falta `name`");
  if (!manifest.version) err("Falta `version`");
  else if (!isStrictVersion(manifest.version))
    err("`version`: " + strictVersionMessage(manifest.version));

  if (!manifest.author) warn("Falta `author`");
  if (!manifest.description) warn("Falta `description`");

  // Categoría
  if (manifest.category && !CATEGORIES.includes(manifest.category)) {
    warn(
      `\`category\` "${manifest.category}" no es estándar. Soportados: ${CATEGORIES.join(", ")}`
    );
  }

  // internal: paquete privado que no aparece en el catálogo público; solo se
  // instala en los ActCodes que el admin active desde el panel del store.
  if (manifest.internal !== undefined && typeof manifest.internal !== "boolean") {
    err("`internal` debe ser true o false");
  }

  // native / restartRequired: banderas booleanas
  if (manifest.native !== undefined && typeof manifest.native !== "boolean") {
    err("`native` debe ser true o false");
  }
  if (
    manifest.restartRequired !== undefined &&
    typeof manifest.restartRequired !== "boolean"
  ) {
    err("`restartRequired` debe ser true o false");
  }

  // minVersion: versión mínima de Alpha Administrativo
  if (manifest.minVersion !== undefined && !isStrictVersion(manifest.minVersion)) {
    err(`\`minVersion\` debe ser X.Y.Z numérico: ${JSON.stringify(manifest.minVersion)}`);
  }

  // targets: dónde corre el paquete (default implícito ["desktop"])
  let targetsOk = true;
  if (manifest.targets !== undefined) {
    if (!Array.isArray(manifest.targets) || manifest.targets.length === 0) {
      targetsOk = false;
      err(`\`targets\` debe ser un array no vacío con valores de: ${TARGETS.join(", ")}`);
    } else {
      const bad = manifest.targets.filter((t) => !TARGETS.includes(t));
      if (bad.length > 0) {
        targetsOk = false;
        err(
          `\`targets\` tiene valores no soportados: ${bad
            .map((t) => JSON.stringify(t))
            .join(", ")}. Soportados: ${TARGETS.join(", ")}`
        );
      }
    }
  }
  const targetsSaas = targetsOk && getTargets(manifest).includes("saas");

  // products: productos Alpha donde aplica (default implícito ["alphaAdmin"])
  if (manifest.products !== undefined) {
    if (
      !Array.isArray(manifest.products) ||
      manifest.products.some((p) => typeof p !== "string" || p.trim() === "")
    ) {
      err("`products` debe ser un array de strings");
    }
  }

  // persist: rutas (relativas al paquete) que sobreviven a una actualización
  if (manifest.persist !== undefined) {
    if (!Array.isArray(manifest.persist)) {
      err("`persist` debe ser un array de rutas relativas");
    } else {
      manifest.persist.forEach((p, i) => {
        if (!isSafeRelativePath(p)) {
          err(
            `persist[${i}] debe ser una ruta relativa dentro del paquete (sin ".." ni absoluta): ${JSON.stringify(p)}`
          );
        }
      });
    }
  }

  // saas: overrides de main/renderer para el target SaaS
  let saasOk = true;
  if (manifest.saas !== undefined) {
    if (!manifest.saas || typeof manifest.saas !== "object" || Array.isArray(manifest.saas)) {
      saasOk = false;
      err("`saas` debe ser un objeto { main?: [...], renderer?: [...] }");
    } else {
      if (manifest.saas.main !== undefined)
        validateMainList(manifest.saas.main, "saas.main", pkgDir, err);
      if (manifest.saas.renderer !== undefined)
        validateRendererList(manifest.saas.renderer, "saas.renderer", pkgDir, err);
      if (targetsOk && !targetsSaas)
        warn('`saas` se ignora: `targets` no incluye "saas"');
    }
  }

  if (targetsSaas && pkgDir && fs.existsSync(path.join(pkgDir, "config.json"))) {
    warn(
      "Existe `config.json` en la raíz del paquete: en SaaS el estado va en la BD de la organización, no en la carpeta del paquete"
    );
  }

  // engine: "arpt" → reporte AlphaReport Engine (no usa main/renderer)
  if (manifest.engine === "arpt") {
    if (!manifest.arptFile) err("`arptFile` requerido cuando `engine: \"arpt\"`");
    else if (!manifest.arptFile.endsWith(".arpt"))
      err(`\`arptFile\` debe terminar en .arpt: ${manifest.arptFile}`);
    else if (pkgDir) {
      const arptPath = path.join(pkgDir, manifest.arptFile);
      if (!fs.existsSync(arptPath)) err(`\`arptFile\` no existe: ${manifest.arptFile}`);
    }
    if (manifest.report !== true)
      warn("Reportes .arpt suelen tener `report: true` también (no crítico)");
    if (manifest.main)
      warn("`main[]` se ignora cuando `engine: \"arpt\"` — bórralo");
    if (manifest.renderer)
      warn("`renderer[]` se ignora cuando `engine: \"arpt\"` — bórralo");
    return issues; // saltar validación de main/renderer/extensions
  }

  // main[] / renderer[]
  if (manifest.main) validateMainList(manifest.main, "main", pkgDir, err);
  if (manifest.renderer) validateRendererList(manifest.renderer, "renderer", pkgDir, err);

  if (targetsSaas && !manifest.main && !(saasOk && manifest.saas && manifest.saas.main)) {
    warn(
      '`targets` incluye "saas" pero no hay `saas.main` ni `main`: el paquete no tendrá backend en SaaS'
    );
  }

  // extensions[]
  if (manifest.extensions) {
    if (!Array.isArray(manifest.extensions)) {
      err("`extensions` debe ser un array");
    } else {
      manifest.extensions.forEach((e, i) => {
        if (!e.model) err(`extensions[${i}].model requerido`);
        else if (!SUPPORTED_EXTENSION_MODELS.includes(e.model))
          warn(
            `extensions[${i}].model "${e.model}" no es estándar. Soportados: ${SUPPORTED_EXTENSION_MODELS.join(
              ", "
            )}`
          );
      });
    }
  }

  if (!manifest.main && !manifest.renderer && !manifest.extensions) {
    warn("El paquete no declara `main`, `renderer` ni `extensions` — no hará nada");
  }

  return issues;
}

module.exports = {
  CATEGORIES,
  SUPPORTED_EXTENSION_MODELS,
  TARGETS,
  DEFAULT_TARGETS,
  DEFAULT_PRODUCTS,
  listManifests,
  resolveKeyName,
  findManifest,
  readManifest,
  writeManifest,
  validateManifest,
  getTargets,
  isSafeRelativePath,
};

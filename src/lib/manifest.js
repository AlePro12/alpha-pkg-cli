/**
 * Manifest helpers — leer, validar y escribir `<keyName>.appkg`.
 *
 * Un paquete Alpha vive en una carpeta `<keyName>/` con `<keyName>.appkg`
 * adentro. El manifest es JSON puro (sin BOM, sin comentarios).
 */
const fs = require("fs");
const path = require("path");

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

/**
 * Localiza el manifest dentro de una carpeta de paquete.
 * Asume que el directorio se llama igual que el keyName.
 *
 * @param {string} pkgDir  ruta absoluta a la carpeta del paquete
 * @returns {{ keyName: string, manifestPath: string }}
 */
function findManifest(pkgDir) {
  const keyName = path.basename(pkgDir);
  const manifestPath = path.join(pkgDir, `${keyName}.appkg`);
  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      `No se encontró ${keyName}.appkg en ${pkgDir}. ` +
        `El manifest debe llamarse igual que la carpeta (${keyName}.appkg).`
    );
  }
  return { keyName, manifestPath };
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
  else if (!/^\d+\.\d+\.\d+/.test(manifest.version))
    err(`\`version\` no es semver: ${manifest.version}`);

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

  // main[]
  if (manifest.main) {
    if (!Array.isArray(manifest.main)) {
      err("`main` debe ser un array");
    } else {
      manifest.main.forEach((m, i) => {
        if (!m.routeName) err(`main[${i}].routeName requerido`);
        if (!m.routePath) {
          err(`main[${i}].routePath requerido`);
        } else if (!m.routePath.endsWith(".js")) {
          err(
            `main[${i}].routePath debe terminar en .js (NO .js-alpcrt; el store encripta automáticamente)`
          );
        } else if (pkgDir) {
          const filePath = path.join(pkgDir, m.routePath);
          const encryptedPath = filePath + "-alpcrt";
          if (!fs.existsSync(filePath) && !fs.existsSync(encryptedPath)) {
            err(`main[${i}].routePath no existe: ${m.routePath}`);
          }
        }
      });
    }
  }

  // renderer[]
  if (manifest.renderer) {
    if (!Array.isArray(manifest.renderer)) {
      err("`renderer` debe ser un array");
    } else {
      manifest.renderer.forEach((r, i) => {
        if (!r.opcName) err(`renderer[${i}].opcName requerido`);
        if (!r.opcFile) err(`renderer[${i}].opcFile requerido`);
        if (!r.opcPath) err(`renderer[${i}].opcPath requerido`);
        if (pkgDir && r.opcFile && r.opcPath) {
          // `opcFile` se declara sin extensión (convención de los templates),
          // pero toleramos que el usuario incluya ".js" para no romper el lint.
          const base = r.opcFile.endsWith(".js") ? r.opcFile.slice(0, -3) : r.opcFile;
          const filePath = path.join(pkgDir, r.opcPath, base + ".js");
          const encryptedPath = filePath + "-alpcrt";
          if (!fs.existsSync(filePath) && !fs.existsSync(encryptedPath)) {
            err(`renderer[${i}].opcFile no existe: ${r.opcPath}/${base}.js`);
          }
        }
      });
    }
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
  findManifest,
  readManifest,
  writeManifest,
  validateManifest,
};

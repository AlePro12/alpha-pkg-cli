/**
 * Resuelve credenciales del store en orden:
 *   1. CLI flags
 *   2. env vars (ALPHA_STORE_URL, ALPHA_STORE_TOKEN, ALPHA_STORE_EMAIL,
 *      ALPHA_STORE_PASSWORD)
 *   3. .alpharc en cwd
 *   4. .alpharc en HOME
 *   5. defaults razonables (storeUrl producción)
 *
 * `token` es un token de API de la tienda (empieza por `aps_`); en `.alpharc`
 * se llama `storeToken`.
 */
const fs = require("fs");
const path = require("path");
const os = require("os");

const DEFAULT_STORE_URL = "https://store.alphadministrativo.app";

function readRc(filePath) {
  if (!fs.existsSync(filePath)) return null;
  let raw;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (e) {
    console.warn(`[alpha-pkg] no se pudo leer ${filePath} (se ignora): ${e.message}`);
    return null;
  }
  try {
    const rc = JSON.parse(raw);
    if (!rc || typeof rc !== "object" || Array.isArray(rc)) {
      console.warn(`[alpha-pkg] ${filePath} debe ser un objeto JSON (se ignora)`);
      return null;
    }
    return rc;
  } catch (e) {
    console.warn(`[alpha-pkg] ${filePath} no es JSON válido (se ignora): ${e.message}`);
    return null;
  }
}

function resolveConfig(flags = {}) {
  const cwdRc = readRc(path.join(process.cwd(), ".alpharc")) || {};
  const homeRc = readRc(path.join(os.homedir(), ".alpharc")) || {};

  const cfg = {
    storeUrl:
      flags.storeUrl ||
      process.env.ALPHA_STORE_URL ||
      cwdRc.storeUrl ||
      homeRc.storeUrl ||
      DEFAULT_STORE_URL,
    token:
      flags.token ||
      process.env.ALPHA_STORE_TOKEN ||
      cwdRc.storeToken ||
      homeRc.storeToken,
    email:
      flags.email || process.env.ALPHA_STORE_EMAIL || cwdRc.email || homeRc.email,
    password:
      flags.password ||
      process.env.ALPHA_STORE_PASSWORD ||
      cwdRc.password ||
      homeRc.password,
  };

  return cfg;
}

module.exports = { resolveConfig, readRc, DEFAULT_STORE_URL };

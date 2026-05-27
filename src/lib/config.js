/**
 * Resuelve credenciales del store en orden:
 *   1. CLI flags
 *   2. env vars (ALPHA_STORE_URL, ALPHA_STORE_EMAIL, ALPHA_STORE_PASSWORD)
 *   3. .alpharc en cwd
 *   4. .alpharc en HOME
 *   5. defaults razonables (storeUrl producción)
 */
const fs = require("fs");
const path = require("path");
const os = require("os");

const DEFAULT_STORE_URL = "https://store.alphadministrativo.app";

function readRc(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (e) {
    console.warn(`[alpha-pkg] .alpharc inválido en ${filePath}: ${e.message}`);
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

module.exports = { resolveConfig, DEFAULT_STORE_URL };

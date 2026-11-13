const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const { findManifest, readManifest } = require("../lib/manifest");
const StoreClient = require("../lib/store-client");
const { describeCiError } = require("../lib/store-client");
const { resolveConfig } = require("../lib/config");
const { isStrictVersion, strictVersionMessage } = require("../lib/version");

function fail(msg) {
  console.error(chalk.red("✖"), msg);
  process.exit(1);
}

/**
 * `alpha-pkg next-version [dir]` — pregunta a la tienda qué versión toca
 * publicar. La tienda es la fuente de verdad del número.
 *
 * stdout lleva SOLO la versión (o el JSON con --json), para usarlo como
 * `VERSION=$(alpha-pkg next-version .)`. Todo lo demás va a stderr.
 */
async function nextVersion(targetPath, opts) {
  const pkgDir = path.resolve(process.cwd(), targetPath || ".");
  if (!fs.existsSync(pkgDir)) fail(`No existe: ${pkgDir}`);

  const cfg = resolveConfig({ storeUrl: opts.storeUrl, token: opts.token });
  if (!cfg.token) {
    fail(
      "next-version requiere un token de API de la tienda: define ALPHA_STORE_TOKEN o usa --token <t>."
    );
  }

  let manifestInfo, manifest;
  try {
    manifestInfo = findManifest(pkgDir, opts.keyName);
    manifest = readManifest(manifestInfo.manifestPath);
  } catch (e) {
    fail(e.message);
  }
  const keyName = manifestInfo.keyName;
  if (!isStrictVersion(manifest.version)) {
    fail(`${keyName}.appkg: ${strictVersionMessage(manifest.version)}`);
  }

  const client = new StoreClient({ storeUrl: cfg.storeUrl, token: cfg.token });
  let data;
  try {
    data = await client.nextVersion(keyName, manifest.version);
  } catch (e) {
    fail(describeCiError(e, keyName));
  }
  if (!isStrictVersion(data.version)) {
    fail(`La tienda devolvió una versión inválida: ${JSON.stringify(data.version)}`);
  }

  if (opts.json) {
    console.log(
      JSON.stringify({
        keyName,
        version: data.version,
        highest: data.highest === undefined ? null : data.highest,
        reason: data.reason === undefined ? null : data.reason,
        manifest: manifest.version,
      })
    );
  } else {
    console.error(
      chalk.gray(
        `${keyName}: manifiesto ${manifest.version}, mayor publicada ${data.highest || "ninguna"} → ${data.version} (${data.reason || "?"})`
      )
    );
    console.log(data.version);
  }
}

module.exports = nextVersion;

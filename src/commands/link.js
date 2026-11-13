const fs = require("fs");
const path = require("path");
const axios = require("axios");
const chalk = require("chalk");
const ora = require("ora");
const { findManifest, readManifest } = require("../lib/manifest");

/**
 * `alpha-pkg link [path]` — pide al desktop Alpha Admin (default
 * http://localhost:4545) que symlinkee la carpeta del paquete dentro de
 * su packages_PATH. Permite iterar sin copiar archivos.
 *
 * Requiere DevMode activo en LocalSettings de Alpha Admin.
 */
async function link(targetPath, opts) {
  const pkgDir = path.resolve(process.cwd(), targetPath || ".");

  if (!fs.existsSync(pkgDir)) {
    console.error(chalk.red("✖"), `No existe: ${pkgDir}`);
    process.exit(1);
  }

  // Validar que es un paquete Alpha antes de pegarle al desktop
  let manifestInfo, manifest;
  try {
    manifestInfo = findManifest(pkgDir, opts.keyName);
    manifest = readManifest(manifestInfo.manifestPath);
  } catch (e) {
    console.error(chalk.red("✖"), e.message);
    process.exit(1);
  }

  const host = (opts.host || "http://localhost:4545").replace(/\/$/, "");
  console.log("");
  console.log(chalk.cyan("Linking en Alpha Admin local:"));
  console.log(`  ${chalk.gray("host    ")} ${host}`);
  console.log(`  ${chalk.gray("paquete ")} ${chalk.bold(manifestInfo.keyName)} ${chalk.gray("v" + manifest.version)}`);
  console.log(`  ${chalk.gray("source  ")} ${pkgDir}`);
  console.log("");

  const spin = ora("Solicitando link al desktop").start();
  try {
    const res = await axios.post(
      `${host}/pkg/dev/link`,
      { path: pkgDir, keyName: manifestInfo.keyName },
      { timeout: 15000, validateStatus: () => true }
    );

    if (res.status === 200 && res.data?.ok) {
      spin.succeed(
        `Linked: packages/${res.data.keyName} → ${res.data.target}`
      );
      console.log("");
      console.log(chalk.green("✓"), "El paquete ya está montado en Alpha Admin");
      console.log(chalk.gray("  Edita los archivos en este folder; el backend recarga al guardar"));
      console.log(chalk.gray("  (hotReload solo aplica a .js planos — los .js-alpcrt no se recargan)"));
      console.log("");
      console.log(chalk.gray("Para desinstalar el link:"));
      console.log("  " + chalk.cyan(`alpha-pkg unlink ${manifestInfo.keyName}`));
    } else {
      spin.fail(formatError(res));
      if (res.data?.code === "dev_mode_off") {
        console.log("");
        console.log(chalk.yellow("Habilitar DevMode:"));
        console.log("  1. En Alpha Admin: Configuración → DevMode = true");
        console.log("  2. O exporta " + chalk.cyan("ALPHA_DEV_MODE=true") + " antes de arrancar Alpha");
      }
      if (res.data?.code === "not_localhost") {
        console.log("");
        console.log(chalk.yellow("Solo se permiten requests locales (loopback/LAN)."));
      }
      process.exit(1);
    }
  } catch (e) {
    spin.fail(
      e.code === "ECONNREFUSED"
        ? `No se pudo contactar Alpha Admin en ${host} — ¿está corriendo?`
        : e.message
    );
    process.exit(1);
  }
}

async function unlink(keyName, opts) {
  if (!keyName) {
    console.error(chalk.red("✖"), "keyName requerido");
    console.error(chalk.gray("  Ejemplo: alpha-pkg unlink mi-paquete"));
    process.exit(1);
  }

  const host = (opts.host || "http://localhost:4545").replace(/\/$/, "");
  const spin = ora(`Removiendo link de ${keyName}`).start();
  try {
    const res = await axios.post(
      `${host}/pkg/dev/unlink`,
      { keyName },
      { timeout: 15000, validateStatus: () => true }
    );
    if (res.status === 200 && res.data?.ok) {
      spin.succeed(`Unlinked: ${res.data.keyName} (tu carpeta original no fue tocada)`);
    } else {
      spin.fail(formatError(res));
      process.exit(1);
    }
  } catch (e) {
    spin.fail(
      e.code === "ECONNREFUSED"
        ? `No se pudo contactar Alpha Admin en ${host} — ¿está corriendo?`
        : e.message
    );
    process.exit(1);
  }
}

function formatError(res) {
  const body = res.data;
  if (typeof body === "string") return body;
  if (body?.error) return `${body.error}${body.code ? ` [${body.code}]` : ""}`;
  return `HTTP ${res.status}`;
}

module.exports = link;
module.exports.unlink = unlink;

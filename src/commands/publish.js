const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const ora = require("ora");
const prompts = require("prompts");
const { findManifest, readManifest } = require("../lib/manifest");
const StoreClient = require("../lib/store-client");
const { resolveConfig } = require("../lib/config");
const build = require("./build");

async function publish(targetPath, opts) {
  const pkgDir = path.resolve(process.cwd(), targetPath || ".");
  const cfg = resolveConfig({
    storeUrl: opts.storeUrl,
    email: opts.email,
    password: opts.password,
  });

  // Pedir credenciales si faltan
  if (!cfg.email || !cfg.password) {
    const answers = await prompts(
      [
        !cfg.email && {
          type: "text",
          name: "email",
          message: "Email admin del store",
        },
        !cfg.password && {
          type: "password",
          name: "password",
          message: "Contraseña",
        },
      ].filter(Boolean),
      { onCancel: () => process.exit(130) }
    );
    cfg.email = cfg.email || answers.email;
    cfg.password = cfg.password || answers.password;
  }

  if (!cfg.email || !cfg.password) {
    console.error(chalk.red("✖"), "email y password requeridos");
    process.exit(1);
  }

  let manifestInfo, manifest;
  try {
    manifestInfo = findManifest(pkgDir);
    manifest = readManifest(manifestInfo.manifestPath);
  } catch (e) {
    console.error(chalk.red("✖"), e.message);
    process.exit(1);
  }

  // 1. Build (a menos que --no-build)
  let zipPath;
  let version;
  if (opts.build !== false) {
    const result = await build(targetPath, {
      bump: opts.bump || "none",
      output: "./dist",
      lint: opts.lint !== false,
    });
    zipPath = result.zipPath;
    // re-leer manifest tras el bump
    manifest = readManifest(manifestInfo.manifestPath);
    version = manifest.version;
  } else {
    // Buscar el zip más reciente en ./dist
    version = manifest.version;
    zipPath = path.join(pkgDir, "dist", `${manifestInfo.keyName}-${version}.zip`);
    if (!fs.existsSync(zipPath)) {
      console.error(
        chalk.red("✖"),
        `No existe ${zipPath} — corre con --no-build solo si ya hiciste \`alpha-pkg build\``
      );
      process.exit(1);
    }
  }

  console.log("");
  console.log(chalk.cyan("Publicando al store:"));
  console.log(`  ${chalk.gray("store    ")} ${cfg.storeUrl}`);
  console.log(`  ${chalk.gray("paquete  ")} ${chalk.bold(manifestInfo.keyName)} ${chalk.gray("v" + version)}`);
  console.log(`  ${chalk.gray("zip      ")} ${zipPath}`);
  console.log("");

  const client = new StoreClient({ storeUrl: cfg.storeUrl });

  // 2. Login
  const loginSpin = ora("Iniciando sesión").start();
  let user;
  try {
    user = await client.login({ email: cfg.email, password: cfg.password });
    loginSpin.succeed(`Autenticado como ${user.email} (${user.role})`);
  } catch (e) {
    loginSpin.fail(e.message);
    process.exit(1);
  }

  // 3. Buscar package; si no existe, ofrecer crearlo
  const findSpin = ora("Buscando el paquete en el store").start();
  let pkg;
  try {
    pkg = await client.findPackageByKeyName(manifestInfo.keyName);
  } catch (e) {
    findSpin.fail(e.message);
    process.exit(1);
  }

  if (!pkg) {
    findSpin.warn(`No existe en el store: ${manifestInfo.keyName}`);
    const { create } = await prompts(
      {
        type: "confirm",
        name: "create",
        message: `¿Crear "${manifestInfo.keyName}" en el store ahora?`,
        initial: true,
      },
      { onCancel: () => process.exit(130) }
    );
    if (!create) {
      console.log(chalk.gray("Aborta. Crea el paquete desde el admin panel antes de publicar."));
      process.exit(1);
    }
    const createSpin = ora("Creando paquete en el store").start();
    try {
      pkg = await client.createPackage({
        keyName: manifestInfo.keyName,
        name: manifest.name || manifestInfo.keyName,
        description: manifest.description,
        author: manifest.author,
        category: manifest.category || "other",
        minAlphaVersion: manifest.minVersion,
        requiresCores: manifest.requiresCores || [],
        npmInstall: !!manifest.npmInstall,
        isReport: !!manifest.report,
        internal: !!manifest.internal,
        // encryptOnDownload default = false; el admin lo activa en el panel
      });
      createSpin.succeed(`Paquete creado: ${pkg._id}`);
    } catch (e) {
      createSpin.fail(e.message);
      process.exit(1);
    }
  } else {
    findSpin.succeed(`Encontrado: ${pkg.keyName} (${pkg._id})`);
  }

  // 4. Upload version
  const upSpin = ora(`Subiendo versión ${version}`).start();
  let pv;
  try {
    pv = await client.uploadVersion(pkg._id, {
      zipPath,
      version,
      changelog: opts.changelog || "",
      isPrerelease: !!opts.prerelease,
    });
    upSpin.succeed(`Versión ${version} publicada (${formatBytes(pv.fileSize)})`);
  } catch (e) {
    upSpin.fail(e.message);
    process.exit(1);
  }

  console.log("");
  console.log(chalk.green("✓"), "Listo");
  console.log(chalk.gray(`  Los clientes con licencia válida ya pueden instalar ${manifestInfo.keyName}@${version}`));
}

function formatBytes(n) {
  if (!n) return "?";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

module.exports = publish;

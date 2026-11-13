const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const ora = require("ora");
const prompts = require("prompts");
const { findManifest, readManifest } = require("../lib/manifest");
const StoreClient = require("../lib/store-client");
const { isVersionExists, describeCiError } = require("../lib/store-client");
const { resolveConfig } = require("../lib/config");
const { isNonInteractive } = require("../lib/interactive");
const {
  VALID_BUMPS,
  isStrictVersion,
  strictVersionMessage,
  setVersion,
} = require("../lib/version");
const build = require("./build");

function fail(msg, hints = []) {
  console.error(chalk.red("✖"), msg);
  for (const h of hints) console.error(chalk.gray("  " + h));
  process.exit(1);
}

/**
 * `alpha-pkg publish [path]` — sube una versión a la tienda.
 *
 * Autenticación:
 *   - con token de API (`--token` / ALPHA_STORE_TOKEN / `storeToken` en
 *     .alpharc) usa los endpoints de CI; el paquete debe existir ya.
 *   - sin token, el flujo de admin email/password (puede crear el paquete).
 *
 * En modo no interactivo (`--yes`/`--ci`, env CI o stdin sin TTY) nunca
 * pregunta: si falta algo, mensaje claro y exit 1.
 */
async function publish(targetPath, opts) {
  const pkgDir = path.resolve(process.cwd(), targetPath || ".");
  const nonInteractive = isNonInteractive(opts);
  const bump = opts.bump || "none";

  // ── Validación de flags (antes de tocar nada) ──
  if (!fs.existsSync(pkgDir)) fail(`No existe: ${pkgDir}`);
  if (!VALID_BUMPS.includes(bump)) fail(`--bump debe ser ${VALID_BUMPS.join(" | ")}`);
  if (opts.version !== undefined) {
    if (!isStrictVersion(opts.version)) fail(`--version: ${strictVersionMessage(opts.version)}`);
    if (bump !== "none") fail("--version y --bump no se pueden usar juntos");
    if (opts.build === false)
      fail("--version requiere reconstruir el zip: no se puede combinar con --no-build");
  }

  const cfg = resolveConfig({
    storeUrl: opts.storeUrl,
    token: opts.token,
    email: opts.email,
    password: opts.password,
  });
  const useToken = !!cfg.token;

  // ── Credenciales ──
  if (!useToken && (!cfg.email || !cfg.password)) {
    if (nonInteractive) {
      fail("Faltan credenciales para publicar y el modo no interactivo no pregunta.", [
        "CI: define ALPHA_STORE_TOKEN (o --token <t>) con un token de API de la tienda.",
        "Admin: define ALPHA_STORE_EMAIL y ALPHA_STORE_PASSWORD (o --email / --password).",
      ]);
    }
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
    if (!cfg.email || !cfg.password) fail("email y password requeridos");
  }

  let manifestInfo, manifest;
  try {
    manifestInfo = findManifest(pkgDir, opts.keyName);
    manifest = readManifest(manifestInfo.manifestPath);
  } catch (e) {
    fail(e.message);
  }
  const keyName = manifestInfo.keyName;

  // ── --version: fija la versión (manifiesto + package.json) antes del build ──
  if (opts.version !== undefined) {
    try {
      const r = setVersion(pkgDir, manifestInfo.manifestPath, opts.version);
      if (r.manifestChanged) {
        console.log(
          chalk.cyan("→"),
          `version ${chalk.gray(r.oldVersion || "?")} → ${chalk.bold(r.version)} (--version)`
        );
      }
      if (r.warning) console.warn(chalk.yellow("⚠"), r.warning);
    } catch (e) {
      fail(e.message);
    }
  }

  // 1. Build (a menos que --no-build)
  let zipPath;
  let version;
  if (opts.build !== false) {
    const result = await build(pkgDir, {
      bump,
      output: "./dist",
      lint: opts.lint !== false,
      keyName,
    });
    zipPath = result.zipPath;
    // re-leer manifest tras el bump
    manifest = readManifest(manifestInfo.manifestPath);
    version = manifest.version;
  } else {
    // Usar el zip ya construido en ./dist
    version = manifest.version;
    zipPath = path.join(pkgDir, "dist", `${keyName}-${version}.zip`);
    if (!fs.existsSync(zipPath)) {
      fail(
        `No existe ${zipPath} — corre con --no-build solo si ya hiciste \`alpha-pkg build\``
      );
    }
  }

  if (!isStrictVersion(version)) fail(strictVersionMessage(version));

  console.log("");
  console.log(chalk.cyan("Publicando al store:"));
  console.log(`  ${chalk.gray("store    ")} ${cfg.storeUrl}`);
  console.log(`  ${chalk.gray("paquete  ")} ${chalk.bold(keyName)} ${chalk.gray("v" + version)}`);
  console.log(`  ${chalk.gray("zip      ")} ${zipPath}`);
  console.log(`  ${chalk.gray("auth     ")} ${useToken ? "token de API" : cfg.email}`);
  console.log("");

  const upload = {
    zipPath,
    version,
    changelog: opts.changelog || "",
    isPrerelease: !!opts.prerelease,
  };

  let published;
  if (useToken) {
    published = await publishWithToken({ cfg, keyName, upload, opts });
  } else {
    published = await publishWithAdmin({ cfg, keyName, manifest, upload, opts, nonInteractive });
  }

  console.log("");
  if (published) {
    console.log(chalk.green("✓"), "Listo");
    console.log(
      chalk.gray(`  Los clientes con licencia válida ya pueden instalar ${keyName}@${version}`)
    );
  } else {
    console.log(chalk.yellow("⚠"), `Nada que publicar: ${keyName}@${version} ya estaba en la tienda`);
  }

  // --json: SIEMPRE la última línea de stdout
  if (opts.json) console.log(JSON.stringify({ keyName, version, published }));
}

/**
 * Maneja el error de un upload. Devuelve `false` (no publicado, pero OK) si
 * la versión ya existía y se pidió --skip-existing; si no, termina con exit 1.
 */
function handleUploadError(e, spin, { keyName, version, opts, message }) {
  if (isVersionExists(e)) {
    if (opts.skipExisting) {
      spin.warn(`La versión ${version} de ${keyName} ya existe en la tienda — se omite (--skip-existing)`);
      return false;
    }
    spin.fail(`La versión ${version} de ${keyName} ya existe en la tienda (409)`);
    console.error(
      chalk.gray("  Sube la versión (--version / --bump) o usa --skip-existing para no fallar.")
    );
    process.exit(1);
  }
  spin.fail(message);
  process.exit(1);
}

/** Flujo de CI: token de API, endpoints por keyName, nunca crea el paquete. */
async function publishWithToken({ cfg, keyName, upload, opts }) {
  const client = new StoreClient({ storeUrl: cfg.storeUrl, token: cfg.token });
  const upSpin = ora(`Subiendo versión ${upload.version}`).start();
  try {
    const pv = await client.uploadVersionCi(keyName, upload);
    upSpin.succeed(`Versión ${upload.version} publicada (${formatBytes(pv && pv.fileSize)})`);
    return true;
  } catch (e) {
    return handleUploadError(e, upSpin, {
      keyName,
      version: upload.version,
      opts,
      message: describeCiError(e, keyName),
    });
  }
}

/** Flujo de admin: login email/password; puede crear el paquete. */
async function publishWithAdmin({ cfg, keyName, manifest, upload, opts, nonInteractive }) {
  const client = new StoreClient({ storeUrl: cfg.storeUrl });

  // 2. Login
  const loginSpin = ora("Iniciando sesión").start();
  try {
    const user = await client.login({ email: cfg.email, password: cfg.password });
    loginSpin.succeed(`Autenticado como ${user.email} (${user.role})`);
  } catch (e) {
    loginSpin.fail(e.message);
    process.exit(1);
  }

  // 3. Buscar package; si no existe, crearlo (preguntando salvo modo no interactivo)
  const findSpin = ora("Buscando el paquete en el store").start();
  let pkg;
  try {
    pkg = await client.findPackageByKeyName(keyName);
  } catch (e) {
    findSpin.fail(e.message);
    process.exit(1);
  }

  if (!pkg) {
    findSpin.warn(`No existe en el store: ${keyName}`);
    if (!nonInteractive) {
      const { create } = await prompts(
        {
          type: "confirm",
          name: "create",
          message: `¿Crear "${keyName}" en el store ahora?`,
          initial: true,
        },
        { onCancel: () => process.exit(130) }
      );
      if (!create) {
        console.log(chalk.gray("Aborta. Crea el paquete desde el admin panel antes de publicar."));
        process.exit(1);
      }
    }
    const createSpin = ora("Creando paquete en el store").start();
    try {
      pkg = await client.createPackage({
        keyName,
        name: manifest.name || keyName,
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
  const upSpin = ora(`Subiendo versión ${upload.version}`).start();
  try {
    const pv = await client.uploadVersion(pkg._id, upload);
    upSpin.succeed(`Versión ${upload.version} publicada (${formatBytes(pv && pv.fileSize)})`);
    return true;
  } catch (e) {
    return handleUploadError(e, upSpin, {
      keyName,
      version: upload.version,
      opts,
      message: e.message,
    });
  }
}

function formatBytes(n) {
  if (!n) return "?";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

module.exports = publish;

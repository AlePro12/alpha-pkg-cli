const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const ora = require("ora");
const semver = require("semver");
const {
  findManifest,
  readManifest,
  writeManifest,
  validateManifest,
} = require("../lib/manifest");
const { buildZip } = require("../lib/zip");

const VALID_BUMPS = ["patch", "minor", "major", "none"];

async function build(targetPath, opts) {
  const pkgDir = path.resolve(process.cwd(), targetPath || ".");
  const outDir = path.resolve(pkgDir, opts.output);

  if (!fs.existsSync(pkgDir)) {
    console.error(chalk.red("✖"), `No existe: ${pkgDir}`);
    process.exit(1);
  }
  if (!VALID_BUMPS.includes(opts.bump)) {
    console.error(chalk.red("✖"), `--bump debe ser ${VALID_BUMPS.join(" | ")}`);
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

  // Lint (a menos que --no-lint)
  if (opts.lint !== false) {
    const issues = validateManifest(manifest, pkgDir);
    const errors = issues.filter((i) => i.severity === "error");
    if (errors.length > 0) {
      console.log(chalk.red("Errores de lint:"));
      for (const e of errors) console.log("  " + chalk.red("✖") + " " + e.msg);
      console.log("");
      console.log(chalk.yellow("Corrige los errores o usa --no-lint para saltar."));
      process.exit(1);
    }
    const warnings = issues.filter((i) => i.severity === "warn");
    for (const w of warnings) console.log("  " + chalk.yellow("⚠") + " " + w.msg);
  }

  // Version bump
  let oldVersion = manifest.version || "0.0.0";
  let newVersion = oldVersion;
  if (opts.bump !== "none") {
    if (!semver.valid(oldVersion)) {
      console.error(
        chalk.red("✖"),
        `version actual "${oldVersion}" no es semver válido — corrige antes de bumpear`
      );
      process.exit(1);
    }
    newVersion = semver.inc(oldVersion, opts.bump);
    manifest.version = newVersion;
    writeManifest(manifestInfo.manifestPath, manifest);
    console.log(
      chalk.cyan("→"),
      `version ${chalk.gray(oldVersion)} → ${chalk.bold(newVersion)} (${opts.bump})`
    );
  }

  // Sync version a package.json si existe
  const pkgJsonPath = path.join(pkgDir, "package.json");
  if (fs.existsSync(pkgJsonPath)) {
    try {
      const pj = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
      if (pj.version !== newVersion) {
        pj.version = newVersion;
        fs.writeFileSync(pkgJsonPath, JSON.stringify(pj, null, 2) + "\n");
        console.log(chalk.gray("  sincronizado package.json"));
      }
    } catch (_) {}
  }

  // Build zip
  const spinner = ora("Empaquetando").start();
  let result;
  try {
    result = buildZip(pkgDir, outDir, newVersion);
    spinner.succeed(
      `${manifestInfo.keyName}-${newVersion}.zip — ${formatBytes(result.size)} (${result.entryCount} archivos)`
    );
  } catch (e) {
    spinner.fail(`Error al empaquetar: ${e.message}`);
    process.exit(1);
  }

  console.log("");
  console.log(chalk.gray("  zip   "), result.zipPath);
  console.log(chalk.gray("  sha256"), chalk.gray(result.sha256));
  console.log("");
  console.log(chalk.green("✓"), "Build completo");
  console.log(
    chalk.gray("  Para publicar:") + " " + chalk.cyan("alpha-pkg publish --no-build")
  );

  return result;
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

module.exports = build;
module.exports.formatBytes = formatBytes;

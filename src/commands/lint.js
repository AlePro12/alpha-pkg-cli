const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const { findManifest, readManifest, validateManifest } = require("../lib/manifest");

async function lint(targetPath, opts = {}) {
  const pkgDir = path.resolve(process.cwd(), targetPath || ".");

  if (!fs.existsSync(pkgDir)) {
    console.error(chalk.red("✖"), `No existe: ${pkgDir}`);
    process.exit(1);
  }

  let manifestInfo;
  try {
    manifestInfo = findManifest(pkgDir, opts.keyName);
  } catch (e) {
    console.error(chalk.red("✖"), e.message);
    process.exit(1);
  }

  let manifest;
  try {
    manifest = readManifest(manifestInfo.manifestPath);
  } catch (e) {
    console.error(chalk.red("✖"), e.message);
    process.exit(1);
  }

  console.log(chalk.cyan("Validando"), chalk.bold(manifestInfo.keyName), chalk.gray(`v${manifest.version || "?"}`));
  console.log(chalk.gray("  ") + manifestInfo.manifestPath);
  console.log("");

  const issues = validateManifest(manifest, pkgDir);

  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warn");

  for (const w of warnings) {
    console.log(chalk.yellow("⚠"), w.msg);
  }
  for (const e of errors) {
    console.log(chalk.red("✖"), e.msg);
  }

  if (errors.length === 0 && warnings.length === 0) {
    console.log(chalk.green("✓"), "Sin issues. Listo para build.");
    process.exit(0);
  }

  console.log("");
  if (errors.length > 0) {
    console.log(
      chalk.red(`✖ ${errors.length} error${errors.length === 1 ? "" : "es"}`) +
        (warnings.length ? chalk.yellow(`, ${warnings.length} warning${warnings.length === 1 ? "" : "s"}`) : "")
    );
    process.exit(1);
  } else {
    console.log(chalk.yellow(`⚠ ${warnings.length} warning${warnings.length === 1 ? "" : "s"} — no bloquea build`));
    process.exit(0);
  }
}

module.exports = lint;

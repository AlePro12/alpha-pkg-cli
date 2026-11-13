const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const prompts = require("prompts");
const { copyTemplate, pascalCase } = require("../lib/template");
const { readManifest, writeManifest } = require("../lib/manifest");
const { isNonInteractive } = require("../lib/interactive");

const VALID_TEMPLATES = [
  "fullstack",
  "renderer",
  "report",
  "extension",
  "crud",
  "importer",
  "downbar",
];
const TARGET_MAP = {
  desktop: ["desktop"],
  saas: ["saas"],
  both: ["desktop", "saas"],
};
const KEYNAME_RE = /^[a-z][a-z0-9-]*[a-z0-9]$/;

async function init(name, opts) {
  // Validar keyName
  if (!KEYNAME_RE.test(name)) {
    console.error(
      chalk.red("✖"),
      `El nombre "${name}" no es válido. Usa kebab-case: minúsculas, dígitos y guiones (ej. mi-paquete).`
    );
    process.exit(1);
  }

  // Validar template
  if (!VALID_TEMPLATES.includes(opts.template)) {
    console.error(
      chalk.red("✖"),
      `Template "${opts.template}" no existe. Opciones: ${VALID_TEMPLATES.join(", ")}`
    );
    process.exit(1);
  }

  // Validar target
  const target = opts.target || "desktop";
  if (!TARGET_MAP[target]) {
    console.error(
      chalk.red("✖"),
      `--target "${target}" no existe. Opciones: ${Object.keys(TARGET_MAP).join(", ")}`
    );
    process.exit(1);
  }

  // Verificar que no exista la carpeta destino
  const destDir = path.resolve(process.cwd(), name);
  if (fs.existsSync(destDir)) {
    console.error(chalk.red("✖"), `Ya existe ${destDir}`);
    process.exit(1);
  }

  // Recolectar datos interactivamente si no vinieron por flag
  let author = opts.author;
  let description = opts.description;

  if (!isNonInteractive(opts) && (!author || !description)) {
    const answers = await prompts(
      [
        !author && {
          type: "text",
          name: "author",
          message: "Autor",
          initial: "AlphaSoft, C.A.",
        },
        !description && {
          type: "text",
          name: "description",
          message: "Descripción corta",
          initial: `Paquete ${pascalCase(name)} para Alpha Administrativo`,
        },
      ].filter(Boolean),
      { onCancel: () => process.exit(130) }
    );
    if (!author) author = answers.author;
    if (!description) description = answers.description;
  }

  // Localizar template source
  const srcDir = path.join(__dirname, "..", "templates", opts.template);
  if (!fs.existsSync(srcDir)) {
    console.error(chalk.red("✖"), `Template no encontrado: ${srcDir}`);
    process.exit(1);
  }

  console.log("");
  console.log(chalk.cyan("Generando paquete:"));
  console.log(`  ${chalk.gray("nombre   ")} ${chalk.bold(name)}`);
  console.log(`  ${chalk.gray("template ")} ${opts.template}`);
  console.log(`  ${chalk.gray("target   ")} ${TARGET_MAP[target].join(", ")}`);
  console.log(`  ${chalk.gray("destino  ")} ${destDir}`);
  console.log("");

  try {
    const vars = {
      keyName: name,
      author: author || "AlphaSoft, C.A.",
      description: description || "Paquete Alpha",
    };
    copyTemplate(srcDir, destDir, vars);
    // Archivos comunes a todos los templates: .gitignore, .alphaignore y el
    // workflow de release (no pisan lo que traiga el template).
    copyTemplate(path.join(__dirname, "..", "templates", "_common"), destDir, vars, {
      dotfiles: true,
      overwrite: false,
    });
    writeTargets(path.join(destDir, `${name}.appkg`), TARGET_MAP[target]);
  } catch (e) {
    console.error(chalk.red("✖"), `Error generando archivos: ${e.message}`);
    process.exit(1);
  }

  console.log(chalk.green("✓"), "Paquete creado");
  console.log("");
  console.log(chalk.bold("Próximos pasos:"));
  console.log(`  ${chalk.cyan("cd")} ${name}`);
  if (opts.template !== "renderer") {
    console.log(`  ${chalk.cyan("npm install")}                  ${chalk.gray("# si necesitas deps")}`);
  }
  console.log(`  ${chalk.cyan("alpha-pkg lint")}              ${chalk.gray("# valida el manifest")}`);
  console.log(`  ${chalk.cyan("alpha-pkg build")}             ${chalk.gray("# empaqueta el zip")}`);
  console.log(`  ${chalk.cyan("alpha-pkg publish")}           ${chalk.gray("# sube al store")}`);
  console.log("");
  console.log(
    chalk.gray("Release automático: ") +
      chalk.gray.italic(".github/workflows/release.yml") +
      chalk.gray(" publica en cada push a main (secreto ALPHA_STORE_TOKEN).")
  );
  console.log(
    chalk.gray("Probar en local: copia o symlink a ") +
      chalk.gray.italic("<ALPHAADMINFILES>/packages/" + name + "/")
  );
}

/** Escribe `targets` en el manifiesto recién generado (después de `category`). */
function writeTargets(manifestPath, targets) {
  const manifest = readManifest(manifestPath);
  const out = {};
  let placed = false;
  for (const [k, v] of Object.entries(manifest)) {
    if (k === "targets") continue;
    out[k] = v;
    if (k === "category") {
      out.targets = targets;
      placed = true;
    }
  }
  if (!placed) out.targets = targets;
  writeManifest(manifestPath, out);
}

module.exports = init;
module.exports.TARGET_MAP = TARGET_MAP;

const { Command } = require("commander");
const chalk = require("chalk");
const pkg = require("../package.json");

const program = new Command();

program
  .name("alpha-pkg")
  .description("CLI para desarrollar y publicar extensiones de Alpha Administrativo")
  .version(pkg.version, "-v, --version");

program
  .command("init <name>")
  .description("Scaffold un nuevo paquete Alpha")
  .option(
    "-t, --template <template>",
    "fullstack | renderer | report | extension | crud | importer | downbar",
    "fullstack"
  )
  .option("-a, --author <author>", "nombre del autor")
  .option("-d, --description <desc>", "descripción corta")
  .option("--yes", "no preguntar, usar defaults", false)
  .action(require("./commands/init"));

program
  .command("lint [path]")
  .description("Valida el manifest y los archivos referenciados")
  .action(require("./commands/lint"));

program
  .command("build [path]")
  .description("Bumpa versión y empaqueta el .zip listo para publicar")
  .option("-b, --bump <type>", "patch | minor | major | none", "patch")
  .option("-o, --output <dir>", "directorio de salida", "./dist")
  .option("--no-lint", "saltar el lint previo")
  .action(require("./commands/build"));

program
  .command("link [path]")
  .description("Crea symlink en AlphaAdmin packages/ → instala instantánea sin copiar")
  .option("-h, --host <url>", "URL del Alpha Admin local", "http://localhost:4545")
  .action(require("./commands/link"));

program
  .command("unlink [keyName]")
  .description("Remueve el symlink de un paquete dev-linked (no borra tu carpeta)")
  .option("-h, --host <url>", "URL del Alpha Admin local", "http://localhost:4545")
  .action(require("./commands/link").unlink);

program
  .command("publish [path]")
  .description("Sube el paquete al store")
  .option("-u, --store-url <url>", "URL del store")
  .option("-e, --email <email>", "email de admin")
  .option("-p, --password <password>", "contraseña admin")
  .option("--bump <type>", "patch | minor | major | none", "patch")
  .option("--no-build", "no re-construir; usar dist/ existente")
  .option("--no-lint", "saltar el lint previo al build")
  .option("--prerelease", "marcar versión como pre-release", false)
  .option("--changelog <text>", "mensaje de changelog para esta versión")
  .action(require("./commands/publish"));

program.parseAsync(process.argv).catch((err) => {
  console.error(chalk.red("✖"), err.message || err);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});

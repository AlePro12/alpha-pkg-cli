const { Command } = require("commander");
const chalk = require("chalk");
const pkg = require("../package.json");

const program = new Command();

const KEY_NAME_HELP =
  "keyName del paquete (default: el único *.appkg de la carpeta, o el nombre de la carpeta)";

program
  .name("alpha-pkg")
  .description("CLI para desarrollar y publicar extensiones de Alpha Administrativo")
  .version(pkg.version, "-v, --version")
  // Las opciones del programa solo valen ANTES del subcomando: así
  // `publish --version 1.2.3` llega a publish y no imprime la versión del CLI.
  .enablePositionalOptions();

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
  .option("--target <target>", "desktop | saas | both", "desktop")
  .option("--yes", "no preguntar, usar defaults", false)
  .action(require("./commands/init"));

program
  .command("lint [path]")
  .description("Valida el manifest y los archivos referenciados")
  .option("--key-name <keyName>", KEY_NAME_HELP)
  .action(require("./commands/lint"));

program
  .command("build [path]")
  .description("Bumpa versión y empaqueta el .zip listo para publicar")
  .option("-b, --bump <type>", "patch | minor | major | none", "patch")
  .option("-o, --output <dir>", "directorio de salida", "./dist")
  .option("--no-lint", "saltar el lint previo")
  .option("--key-name <keyName>", KEY_NAME_HELP)
  .action(require("./commands/build"));

program
  .command("link [path]")
  .description("Crea symlink en AlphaAdmin packages/ → instala instantánea sin copiar")
  .option("-H, --host <url>", "URL del Alpha Admin local", "http://localhost:4545")
  .option("--key-name <keyName>", KEY_NAME_HELP)
  .action(require("./commands/link"));

program
  .command("unlink [keyName]")
  .description("Remueve el symlink de un paquete dev-linked (no borra tu carpeta)")
  .option("-H, --host <url>", "URL del Alpha Admin local", "http://localhost:4545")
  .action(require("./commands/link").unlink);

program
  .command("publish [path]")
  .description("Sube el paquete al store")
  .option("-u, --store-url <url>", "URL del store (env ALPHA_STORE_URL)")
  .option("-t, --token <token>", "token de API de la tienda (env ALPHA_STORE_TOKEN)")
  .option("-e, --email <email>", "email de admin (si no hay token)")
  .option("-p, --password <password>", "contraseña admin (si no hay token)")
  .option("--bump <type>", "patch | minor | major | none", "none")
  .option("--version <x.y.z>", "fija la versión (manifiesto + package.json) antes del build")
  .option("--key-name <keyName>", KEY_NAME_HELP)
  .option("--no-build", "no re-construir; usar dist/ existente")
  .option("--no-lint", "saltar el lint previo al build")
  .option("--prerelease", "marcar versión como pre-release", false)
  .option("--changelog <text>", "mensaje de changelog para esta versión")
  .option("-y, --yes", "no preguntar nunca (implícito con CI=true o sin TTY)", false)
  .option("--ci", "alias de --yes", false)
  .option("--skip-existing", "si la versión ya existe en la tienda (409), terminar con 0", false)
  .option("--json", "imprimir al final una línea JSON {keyName, version, published}", false)
  .action(require("./commands/publish"));

program
  .command("next-version [dir]")
  .description("Pide a la tienda la versión a publicar y la imprime (solo la versión en stdout)")
  .option("-u, --store-url <url>", "URL del store (env ALPHA_STORE_URL)")
  .option("-t, --token <token>", "token de API de la tienda (env ALPHA_STORE_TOKEN)")
  .option("--key-name <keyName>", KEY_NAME_HELP)
  .option("--json", "imprimir {keyName, version, highest, reason, manifest}", false)
  .action(require("./commands/next-version"));

program.parseAsync(process.argv).catch((err) => {
  console.error(chalk.red("✖"), err.message || err);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});

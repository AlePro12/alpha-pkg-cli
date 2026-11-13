/**
 * ¿Se puede preguntar al usuario?
 *
 * El modo no interactivo se activa con `--yes` / `--ci`, con la variable de
 * entorno `CI` (GitHub Actions la define) o cuando stdin no es una terminal.
 * En ese modo el CLI NUNCA abre un prompt: `prompts` sin TTY se cuelga o
 * termina con código 0, que en un pipeline es peor que fallar.
 */
function envCi() {
  const v = process.env.CI;
  return !!v && v !== "false" && v !== "0";
}

function isNonInteractive(opts = {}) {
  return !!(opts.yes || opts.ci || envCi() || !process.stdin.isTTY);
}

module.exports = { isNonInteractive };

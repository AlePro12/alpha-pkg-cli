/**
 * Copia un directorio de template aplicando substituciones mustache-like:
 *   {keyName} {keyNamePascal} {author} {description} {year}
 *
 * Reemplaza en NOMBRES de archivo y en contenido. Files binarios (basado
 * en extensión) se copian sin procesar.
 *
 * OJO con los placeholders: solo se sustituye `{palabra}` exacto y solo si la
 * palabra es una variable conocida. `${{ secrets.X }}` de GitHub Actions no
 * casa (lleva espacios y llaves dobles) y queda intacto.
 *
 * Dotfiles: npm NO publica archivos `.gitignore` dentro de un paquete, así que
 * los dotfiles comunes viven en `templates/_common/` con `_` en vez de `.`
 * (`_gitignore`, `_github/`) y se renombran al copiar (`dotfiles: true`).
 */
const fs = require("fs");
const path = require("path");

const BINARY_EXTS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico",
  ".zip", ".pdf", ".woff", ".woff2", ".ttf",
]);

function pascalCase(s) {
  return s
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join("");
}

function substituteString(str, vars) {
  return str.replace(/\{(\w+)\}/g, (m, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : m
  );
}

/**
 * @param {string} srcDir
 * @param {string} destDir
 * @param {object} userVars
 * @param {{ dotfiles?: boolean, overwrite?: boolean }} [opts]
 *        dotfiles: un `_` inicial en el nombre se convierte en `.`
 *        overwrite: `false` para no pisar archivos que ya existan en destino
 */
function copyTemplate(srcDir, destDir, userVars, opts = {}) {
  const vars = {
    keyName: userVars.keyName,
    keyNamePascal: pascalCase(userVars.keyName),
    author: userVars.author || "AlphaSoft, C.A.",
    description: userVars.description || "Descripción del paquete",
    year: String(new Date().getFullYear()),
    ...userVars,
  };

  fs.mkdirSync(destDir, { recursive: true });
  walk(srcDir, destDir, vars, { dotfiles: !!opts.dotfiles, overwrite: opts.overwrite !== false });
}

function walk(srcDir, destDir, vars, opts) {
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    let destName = substituteString(entry.name, vars);
    if (opts.dotfiles && destName.startsWith("_")) destName = "." + destName.slice(1);
    const destPath = path.join(destDir, destName);

    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      walk(srcPath, destPath, vars, opts);
    } else if (entry.isFile()) {
      if (!opts.overwrite && fs.existsSync(destPath)) continue;
      copyFile(srcPath, destPath, vars);
    }
  }
}

function copyFile(srcPath, destPath, vars) {
  const ext = path.extname(srcPath).toLowerCase();
  if (BINARY_EXTS.has(ext)) {
    fs.copyFileSync(srcPath, destPath);
    return;
  }
  const content = fs.readFileSync(srcPath, "utf8");
  fs.writeFileSync(destPath, substituteString(content, vars));
}

module.exports = { copyTemplate, pascalCase, substituteString };

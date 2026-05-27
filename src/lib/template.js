/**
 * Copia un directorio de template aplicando substituciones mustache-like:
 *   {keyName} {keyNamePascal} {author} {description} {year}
 *
 * Reemplaza en NOMBRES de archivo y en contenido. Files binarios (basado
 * en extensión) se copian sin procesar.
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

function copyTemplate(srcDir, destDir, userVars) {
  const vars = {
    keyName: userVars.keyName,
    keyNamePascal: pascalCase(userVars.keyName),
    author: userVars.author || "AlphaSoft, C.A.",
    description: userVars.description || "Descripción del paquete",
    year: String(new Date().getFullYear()),
    ...userVars,
  };

  fs.mkdirSync(destDir, { recursive: true });
  walk(srcDir, destDir, vars);
}

function walk(srcDir, destDir, vars) {
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destName = substituteString(entry.name, vars);
    const destPath = path.join(destDir, destName);

    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      walk(srcPath, destPath, vars);
    } else if (entry.isFile()) {
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

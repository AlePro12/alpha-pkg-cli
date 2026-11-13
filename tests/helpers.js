/**
 * Utilidades de los tests: carpetas temporales, paquetes de prueba, ejecución
 * del CLI como proceso hijo y una tienda falsa (`http.createServer`) que
 * implementa el contrato de CI y lo mínimo del API de admin.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");

const BIN = path.join(__dirname, "..", "bin", "alpha-pkg.js");
const TOKEN = "aps_test_token";

function mkTmp(prefix = "alpha-pkg-test-") {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/**
 * Crea un paquete mínimo válido en `<root>/<folder>` con manifiesto
 * `<keyName>.appkg`.
 */
function makePackage(root, { folder, keyName = "demo-pkg", manifest = {}, files = {} } = {}) {
  const dir = path.join(root, folder || keyName);
  fs.mkdirSync(dir, { recursive: true });
  const base = {
    name: "DemoPkg",
    version: "1.0.0",
    author: "Test",
    description: "Paquete de prueba",
    category: "utils",
    main: [{ routeName: "api", routePath: "index.js" }],
    ...manifest,
  };
  fs.writeFileSync(path.join(dir, `${keyName}.appkg`), JSON.stringify(base, null, 2) + "\n");
  fs.writeFileSync(path.join(dir, "index.js"), "module.exports = {};\n");
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return dir;
}

/**
 * Corre el CLI. stdin queda como pipe ABIERTO (no TTY): si el CLI intentara
 * preguntar se colgaría y el timeout lo delata (`timedOut: true`).
 */
function runCli(args, { cwd, env = {}, timeout = 20000 } = {}) {
  return new Promise((resolve) => {
    const home = mkTmp("alpha-pkg-home-");
    const cleanEnv = { ...process.env };
    for (const k of Object.keys(cleanEnv)) {
      if (k.startsWith("ALPHA_STORE_") || k === "CI") delete cleanEnv[k];
    }
    const child = spawn(process.execPath, [BIN, ...args], {
      cwd: cwd || home,
      env: {
        ...cleanEnv,
        HOME: home,
        USERPROFILE: home,
        FORCE_COLOR: "0",
        NO_COLOR: "1",
        ...env,
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeout);
    child.on("close", (code) => {
      clearTimeout(timer);
      fs.rmSync(home, { recursive: true, force: true });
      resolve({ code, stdout, stderr, timedOut });
    });
  });
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

/** Extrae un campo de texto de un cuerpo multipart (suficiente para tests). */
function multipartField(body, name) {
  const m = body
    .toString("latin1")
    .match(new RegExp(`name="${name}"\\r\\n\\r\\n([\\s\\S]*?)\\r\\n--`));
  return m ? Buffer.from(m[1], "latin1").toString("utf8") : undefined;
}

function multipartHasFile(body, name) {
  return new RegExp(`name="${name}"; filename="[^"]+"`).test(body.toString("latin1"));
}

function cmp(a, b) {
  const x = a.split(".").map(Number);
  const y = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

/**
 * Tienda falsa.
 * @param {{ packages?: Record<string, string[]> }} [seed]  keyName → versiones publicadas
 */
async function startFakeStore(seed = {}) {
  const packages = new Map(
    Object.entries(seed.packages || {}).map(([k, v]) => [k, { _id: `id-${k}`, keyName: k, versions: [...v] }])
  );
  const requests = [];
  const uploads = [];
  const ADMIN_JWT = "jwt-admin";

  const json = (res, status, body) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    const body = await readBody(req);
    const auth = req.headers.authorization || "";
    requests.push({ method: req.method, path: url.pathname, query: url.search, auth });

    // ── Contrato de CI ──
    let m = url.pathname.match(/^\/api\/ci\/packages\/([^/]+)\/(next-version|versions)$/);
    if (m) {
      const keyName = decodeURIComponent(m[1]);
      if (auth !== `Bearer ${TOKEN}`) return json(res, 401, { error: "token inválido" });
      if (keyName === "prohibido") return json(res, 403, { error: "sin permiso" });
      const pkg = packages.get(keyName);
      if (!pkg) return json(res, 404, { error: "Paquete no encontrado", code: "package_not_found" });

      if (m[2] === "next-version" && req.method === "GET") {
        const manifest = url.searchParams.get("manifest");
        const highest = pkg.versions.slice().sort(cmp).pop() || null;
        if (!highest) return json(res, 200, { version: manifest, highest: null, reason: "first" });
        if (cmp(manifest, highest) > 0)
          return json(res, 200, { version: manifest, highest, reason: "manifest" });
        const [a, b, c] = highest.split(".").map(Number);
        return json(res, 200, { version: `${a}.${b}.${c + 1}`, highest, reason: "patch" });
      }
      if (m[2] === "versions" && req.method === "POST") {
        const version = multipartField(body, "version");
        const up = {
          via: "ci",
          keyName,
          version,
          changelog: multipartField(body, "changelog"),
          isPrerelease: multipartField(body, "isPrerelease"),
          hasFile: multipartHasFile(body, "file"),
        };
        if (!/^\d+\.\d+\.\d+$/.test(version || ""))
          return json(res, 400, { error: "versión debe ser X.Y.Z" });
        if (pkg.versions.includes(version))
          return json(res, 409, { error: "La versión ya existe", code: "version_exists" });
        pkg.versions.push(version);
        uploads.push(up);
        return json(res, 201, { version, fileSize: body.length });
      }
    }

    // ── API de admin (flujo email/password) ──
    if (url.pathname === "/api/admin/login" && req.method === "POST") {
      const { email, password } = JSON.parse(body.toString("utf8") || "{}");
      if (email === "admin@test.dev" && password === "secreto")
        return json(res, 200, { token: ADMIN_JWT, user: { email, role: "admin" } });
      return json(res, 401, { error: "credenciales inválidas" });
    }
    if (url.pathname.startsWith("/api/admin/")) {
      if (auth !== `Bearer ${ADMIN_JWT}`) return json(res, 401, { error: "no autenticado" });
      if (url.pathname === "/api/admin/packages" && req.method === "GET")
        return json(res, 200, [...packages.values()].map(({ _id, keyName }) => ({ _id, keyName })));
      if (url.pathname === "/api/admin/packages" && req.method === "POST") {
        const payload = JSON.parse(body.toString("utf8"));
        const pkg = { _id: `id-${payload.keyName}`, keyName: payload.keyName, versions: [] };
        packages.set(payload.keyName, pkg);
        return json(res, 201, { _id: pkg._id, keyName: pkg.keyName });
      }
      m = url.pathname.match(/^\/api\/admin\/packages\/([^/]+)\/versions$/);
      if (m && req.method === "POST") {
        const pkg = [...packages.values()].find((p) => p._id === m[1]);
        if (!pkg) return json(res, 404, { error: "no existe" });
        const version = multipartField(body, "version");
        if (pkg.versions.includes(version))
          return json(res, 409, { error: "La versión ya existe", code: "version_exists" });
        pkg.versions.push(version);
        uploads.push({ via: "admin", keyName: pkg.keyName, version });
        return json(res, 201, { version, fileSize: body.length });
      }
    }

    json(res, 404, { error: "ruta desconocida" });
  });

  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    packages,
    requests,
    uploads,
    close: () => new Promise((r) => server.close(r)),
  };
}

module.exports = { BIN, TOKEN, mkTmp, makePackage, runCli, startFakeStore };

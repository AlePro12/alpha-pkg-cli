/**
 * Cliente del store. Dos formas de autenticarse:
 *
 *   - Admin (interactivo): login email/password → JWT 8h, contra `/api/admin/*`
 *     (CRUD de packages + upload de versiones multipart).
 *   - CI (token de API `aps_...`): header `Authorization: Bearer <token>` contra
 *     `/api/ci/packages/:keyName/*`. Con token NO se crean paquetes: se crean
 *     en el panel y el token se emite con permiso sobre ellos.
 */
const fs = require("fs");
const axios = require("axios");
const FormData = require("form-data");

/** Error de la tienda con el status HTTP y el `code` del cuerpo (si vino). */
class StoreError extends Error {
  constructor(message, { status, code, data } = {}) {
    super(message);
    this.name = "StoreError";
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

function bodyError(res) {
  const d = res.data;
  if (d && typeof d === "object" && d.error) return String(d.error);
  if (typeof d === "string" && d.trim()) return d.trim().slice(0, 200);
  if (d && typeof d === "object") return JSON.stringify(d);
  return `HTTP ${res.status}`;
}

function bodyCode(res) {
  return res.data && typeof res.data === "object" ? res.data.code : undefined;
}

/** Un 409 al subir una versión significa que esa versión ya existe. */
function isVersionExists(err) {
  return !!err && (err.status === 409 || err.code === "version_exists");
}

/**
 * Traduce un error de los endpoints de CI a un mensaje accionable.
 * @param {Error} err
 * @param {string} keyName
 * @returns {string}
 */
function describeCiError(err, keyName) {
  if (!err || err.status === undefined) {
    // Sin respuesta HTTP: red, DNS, timeout…
    return `No se pudo contactar la tienda: ${err && err.message ? err.message : err}`;
  }
  if (err.status === 401) {
    return (
      "Token de API inválido o vencido (401). Revisa ALPHA_STORE_TOKEN / --token " +
      "(los tokens de la tienda empiezan por `aps_`)."
    );
  }
  if (err.status === 403) {
    return `El token de API no tiene permiso sobre el paquete "${keyName}" (403).`;
  }
  if (err.status === 404 && (err.code === "package_not_found" || !err.code)) {
    return (
      `El paquete "${keyName}" no existe en la tienda. Con token de API no se crean ` +
      "paquetes: créalo en el panel de la tienda (y da permiso al token sobre él) " +
      "y vuelve a intentar."
    );
  }
  return err.message;
}

class StoreClient {
  /**
   * @param {{ storeUrl: string, token?: string }} opts  `token` = token de API (CI)
   */
  constructor({ storeUrl, token }) {
    if (!storeUrl) throw new Error("StoreClient: storeUrl requerido");
    this.baseUrl = storeUrl.replace(/\/+$/, "");
    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: 60000,
      validateStatus: () => true,
    });
    this.token = token || null;
  }

  _auth() {
    return this.token ? { Authorization: `Bearer ${this.token}` } : {};
  }

  // ───────────────────────── Admin (email/password) ─────────────────────────

  async login({ email, password }) {
    const res = await this.http.post("/api/admin/login", { email, password });
    if (res.status !== 200) {
      throw new StoreError(`Login falló (${res.status}): ${bodyError(res)}`, {
        status: res.status,
        code: bodyCode(res),
      });
    }
    this.token = res.data.token;
    return res.data.user;
  }

  /** Busca un package por keyName. Devuelve null si no existe. */
  async findPackageByKeyName(keyName) {
    const res = await this.http.get("/api/admin/packages", {
      params: { q: keyName, includeInactive: "true" },
      headers: this._auth(),
    });
    if (res.status !== 200 || !Array.isArray(res.data)) {
      throw new StoreError(`Buscar package falló (${res.status}): ${bodyError(res)}`, {
        status: res.status,
        code: bodyCode(res),
      });
    }
    return res.data.find((p) => p.keyName === keyName) || null;
  }

  async createPackage(payload) {
    const res = await this.http.post("/api/admin/packages", payload, {
      headers: { ...this._auth() },
    });
    if (res.status !== 201) {
      throw new StoreError(`Crear package falló (${res.status}): ${bodyError(res)}`, {
        status: res.status,
        code: bodyCode(res),
      });
    }
    return res.data;
  }

  /**
   * Sube una versión nueva: multipart con `file` (.zip) + body fields.
   */
  async uploadVersion(packageId, { zipPath, version, changelog, isPrerelease }) {
    const form = new FormData();
    form.append("version", version);
    if (changelog) form.append("changelog", changelog);
    if (isPrerelease) form.append("isPrerelease", "true");
    form.append("file", fs.createReadStream(zipPath));

    return this._postVersion(`/api/admin/packages/${packageId}/versions`, form);
  }

  // ───────────────────────────── CI (token de API) ───────────────────────────

  /**
   * Pide a la tienda la versión a publicar.
   * Regla del servidor: si la versión del manifiesto es mayor que la mayor
   * histórica usa la del manifiesto; si no, patch+1 de la mayor histórica.
   *
   * @returns {Promise<{ version: string, highest: string|null, reason: string }>}
   */
  async nextVersion(keyName, manifestVersion) {
    const res = await this.http.get(
      `/api/ci/packages/${encodeURIComponent(keyName)}/next-version`,
      { params: { manifest: manifestVersion }, headers: this._auth() }
    );
    if (res.status !== 200) {
      throw new StoreError(
        `Consultar la próxima versión falló (${res.status}): ${bodyError(res)}`,
        { status: res.status, code: bodyCode(res), data: res.data }
      );
    }
    if (!res.data || typeof res.data.version !== "string") {
      throw new StoreError(
        `La tienda respondió sin \`version\`: ${bodyError(res)}`,
        { status: res.status, data: res.data }
      );
    }
    return res.data;
  }

  /**
   * Sube una versión por los endpoints de CI (por keyName, sin id de paquete).
   */
  async uploadVersionCi(keyName, { zipPath, version, changelog, isPrerelease }) {
    const form = new FormData();
    form.append("version", version);
    form.append("changelog", changelog || "");
    form.append("isPrerelease", isPrerelease ? "true" : "false");
    form.append("file", fs.createReadStream(zipPath));

    return this._postVersion(
      `/api/ci/packages/${encodeURIComponent(keyName)}/versions`,
      form
    );
  }

  async _postVersion(url, form) {
    const res = await this.http.post(url, form, {
      headers: { ...this._auth(), ...form.getHeaders() },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    if (res.status !== 201) {
      throw new StoreError(`Upload falló (${res.status}): ${bodyError(res)}`, {
        status: res.status,
        code: bodyCode(res),
        data: res.data,
      });
    }
    return res.data;
  }
}

module.exports = StoreClient;
module.exports.StoreClient = StoreClient;
module.exports.StoreError = StoreError;
module.exports.isVersionExists = isVersionExists;
module.exports.describeCiError = describeCiError;

/**
 * Cliente del store admin API. Login con bcrypt → JWT 8h; CRUD packages;
 * upload de versiones multipart.
 */
const fs = require("fs");
const axios = require("axios");
const FormData = require("form-data");

class StoreClient {
  constructor({ storeUrl }) {
    if (!storeUrl) throw new Error("StoreClient: storeUrl requerido");
    this.baseUrl = storeUrl.replace(/\/$/, "");
    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: 60000,
      validateStatus: () => true,
    });
    this.token = null;
  }

  _auth() {
    return this.token ? { Authorization: `Bearer ${this.token}` } : {};
  }

  async login({ email, password }) {
    const res = await this.http.post("/api/admin/login", { email, password });
    if (res.status !== 200) {
      throw new Error(
        `Login falló (${res.status}): ${res.data?.error || JSON.stringify(res.data)}`
      );
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
    if (res.status !== 200) {
      throw new Error(`Buscar package falló: ${res.data?.error || res.status}`);
    }
    return res.data.find((p) => p.keyName === keyName) || null;
  }

  async createPackage(payload) {
    const res = await this.http.post("/api/admin/packages", payload, {
      headers: { ...this._auth() },
    });
    if (res.status !== 201) {
      throw new Error(
        `Crear package falló (${res.status}): ${res.data?.error || JSON.stringify(res.data)}`
      );
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

    const res = await this.http.post(
      `/api/admin/packages/${packageId}/versions`,
      form,
      {
        headers: { ...this._auth(), ...form.getHeaders() },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      }
    );

    if (res.status !== 201) {
      throw new Error(
        `Upload falló (${res.status}): ${res.data?.error || JSON.stringify(res.data)}`
      );
    }
    return res.data;
  }
}

module.exports = StoreClient;

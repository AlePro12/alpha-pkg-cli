// Backend CRUD del paquete {keyName} — wired al componente CardArchivo
//
// CardArchivo espera estos endpoints (todos relativos a `host`):
//   GET    /<host>{Codp}   → {status:"success", data:{...}}   buscar uno
//   GET    /<host>         → array de items o {data:[...]}    listar (Nuevo busca codps libres)
//   POST   /<host>         → {status:"success", alertas?}     crear (Codp ya viene en body)
//   PUT    /<host>         → {status:"success", alertas?}     actualizar (Codp ya viene en body)
//   DELETE /<host>{Codp}   → {ok:true}                        eliminar

const main = (AlphaRequire) => {
  const express = AlphaRequire("express");
  const mongoose = AlphaRequire("mongoose");
  // Para usar la BD por-empresa real:
  //   const EmpDbMgr = AlphaRequire("../EmpDbMgr");

  const router = express.Router();

  const ItemSchema = new mongoose.Schema(
    {
      Codp: { type: String, required: true, index: true, unique: true },
      Descripcion: { type: String, default: "" },
      Cantidad: { type: Number, default: 0 },
      Activo: { type: Boolean, default: true },
    },
    { timestamps: true }
  );

  // Cache de Model por empresa (Mongoose rechaza re-registrar modelos)
  const modelCache = new Map();
  async function getModel(empresaId) {
    if (!empresaId) empresaId = "default";
    if (modelCache.has(empresaId)) return modelCache.get(empresaId);
    // Modo real (multi-empresa):
    //   const conn = await EmpDbMgr.ConnectToEmpDb(empresaId);
    //   const Model = conn.db.model("{keyNamePascal}Items", ItemSchema);
    // Modo demo (default connection con sufijo por empresa):
    const Model = mongoose.model(
      "{keyNamePascal}Items_" + empresaId,
      ItemSchema
    );
    modelCache.set(empresaId, Model);
    return Model;
  }

  // GET / — listar (usado por CardArchivo para buscar codps libres y por
  // la tabla "Buscar" si está visible). Devolvemos array directo.
  router.get("/", async (req, res) => {
    try {
      const Model = await getModel(req.headers["empresa"]);
      const rows = await Model.find({ Activo: true }).sort({ Codp: 1 }).lean();
      res.json(rows);
    } catch (e) {
      res.status(500).json({ status: "error", message: e.message });
    }
  });

  // GET /:codp — buscar uno. Shape requerido: {status:"success", data:{...}}
  router.get("/:codp", async (req, res) => {
    try {
      const Model = await getModel(req.headers["empresa"]);
      const row = await Model.findOne({ Codp: req.params.codp, Activo: true }).lean();
      if (!row) {
        // CardArchivo trata cualquier respuesta NO-success como "no encontrado"
        // y muestra el form en modo Nuevo automáticamente.
        return res.json({ status: "not_found" });
      }
      res.json({ status: "success", data: row });
    } catch (e) {
      res.status(500).json({ status: "error", message: e.message });
    }
  });

  // POST / — crear. Body trae todos los campos + Codp.
  router.post("/", async (req, res) => {
    try {
      const Model = await getModel(req.headers["empresa"]);
      const data = { ...req.body };

      const existing = await Model.findOne({ Codp: data.Codp }).lean();
      if (existing) {
        return res.status(409).json({
          status: "error",
          message: "Ya existe un registro con ese código",
        });
      }

      await Model.create(data);
      res.json({
        status: "success",
        data,
        alertas: [], // [{ nivel: "warn"|"error", mensaje: "..." }] si necesitas
      });
    } catch (e) {
      res.status(500).json({ status: "error", message: e.message });
    }
  });

  // PUT / — actualizar. Body trae todos los campos + Codp.
  router.put("/", async (req, res) => {
    try {
      const Model = await getModel(req.headers["empresa"]);
      const data = { ...req.body };
      const updated = await Model.findOneAndUpdate(
        { Codp: data.Codp },
        data,
        { new: true }
      ).lean();
      if (!updated) {
        return res
          .status(404)
          .json({ status: "error", message: "No encontrado" });
      }
      res.json({ status: "success", data: updated, alertas: [] });
    } catch (e) {
      res.status(500).json({ status: "error", message: e.message });
    }
  });

  // DELETE /:codp — soft delete (Activo: false)
  router.delete("/:codp", async (req, res) => {
    try {
      const Model = await getModel(req.headers["empresa"]);
      const updated = await Model.findOneAndUpdate(
        { Codp: req.params.codp },
        { Activo: false },
        { new: true }
      );
      if (!updated) {
        return res
          .status(404)
          .json({ status: "error", message: "No encontrado" });
      }
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ status: "error", message: e.message });
    }
  });

  return router;
};

module.exports = { main };

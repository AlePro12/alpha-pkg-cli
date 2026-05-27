// Importador {keyName} — XLSX/CSV → preview → commit
//
// Flujo: el frontend sube el archivo en base64. /preview lo parsea y devuelve
// las primeras N filas + total. /commit lo inserta a la BD de la empresa.

const main = (AlphaRequire) => {
  const express = AlphaRequire("express");
  const XLSX = AlphaRequire("xlsx");

  const router = express.Router();
  router.use(express.json({ limit: "50mb" })); // archivos grandes en base64

  // Parsea el archivo (xlsx, xls, csv) a array de objetos
  function parseFile(base64, fileName = "data.xlsx") {
    const buf = Buffer.from(base64.split(";base64,").pop(), "base64");
    const wb = XLSX.read(buf, { type: "buffer" });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) throw new Error("Archivo sin hojas");
    return XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null });
  }

  // POST /preview — body {file: "data:...;base64,..."}
  router.post("/preview", (req, res) => {
    try {
      const rows = parseFile(req.body.file, req.body.fileName);
      res.json({
        total: rows.length,
        sample: rows.slice(0, 20),
        columns: rows.length > 0 ? Object.keys(rows[0]) : [],
      });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // POST /commit — body {file, mapping}
  // mapping: { destField: sourceColumn } para renombrar columnas
  router.post("/commit", async (req, res) => {
    try {
      const empresaId = req.headers["empresa"];
      if (!empresaId) return res.status(400).json({ error: "Header `empresa` requerido" });

      const rows = parseFile(req.body.file);
      const mapping = req.body.mapping || {};

      const mapped = rows.map((r) => {
        const out = {};
        if (Object.keys(mapping).length === 0) return r;
        for (const [dest, src] of Object.entries(mapping)) {
          out[dest] = r[src];
        }
        return out;
      });

      // TODO: aquí harías el bulk insert real, p.ej.:
      //   const EmpDbMgr = AlphaRequire("../EmpDbMgr");
      //   const ProductosGeneralSchema = AlphaRequire("../../models/InvCore/ProductosGeneral");
      //   const conn = await EmpDbMgr.ConnectToEmpDb(empresaId);
      //   const Model = conn.db.model("ProductosGenerals", ProductosGeneralSchema);
      //   const result = await Model.insertMany(mapped, { ordered: false });

      // Por ahora simulamos:
      const result = { inserted: mapped.length, sample: mapped.slice(0, 5) };

      res.json({ ok: true, ...result });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
};

module.exports = { main };

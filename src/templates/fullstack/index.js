// Backend del paquete {keyName} ({keyNamePascal})
//
// Se mountea bajo /pkgs/{keyName}/api/* en el servidor de AlphaAdmin.
// La función `main(AlphaRequire)` retorna un express Router.

const main = (AlphaRequire) => {
  const express = AlphaRequire("express");
  const router = express.Router();

  console.log("[{keyName}] backend cargado");

  // Endpoint de health para probar
  router.get("/ping", (req, res) => {
    res.json({
      ok: true,
      pkg: "{keyName}",
      ts: new Date().toISOString(),
    });
  });

  // Ejemplo: leer datos de la empresa activa
  router.get("/empresa-activa", (req, res) => {
    // AlphaApi_Fetch desde el frontend inyecta el header `empresa` con el id
    // de la empresa activa de la sesión del usuario.
    const empresaId = req.headers["empresa"];
    res.json({ empresaId });
  });

  // Para acceder a colecciones de la BD por-empresa:
  //   const EmpDbMgr = AlphaRequire("../EmpDbMgr");
  //   const Schema   = AlphaRequire("../../models/InvCore/ProductosGeneral");
  //   const conn     = await EmpDbMgr.ConnectToEmpDb(empresaId);
  //   const Model    = conn.db.model("ProductosGenerals", Schema);

  return router;
};

module.exports = { main };

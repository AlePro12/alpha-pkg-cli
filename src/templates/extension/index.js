// Backend del paquete extension {keyName}
//
// Provee el datasource para el campo SelectBy "Paciente" inyectado en
// VenCore/Facturas. El frontend lo consume vía /pkgs/{keyName}/api/pacientes.

const main = (AlphaRequire) => {
  const express = AlphaRequire("express");
  const router = express.Router();

  // Endpoint mock — reemplázalo con query a tu colección real.
  // Convención multi-empresa: el header `empresa` lleva el id activo.
  //   const EmpDbMgr = AlphaRequire("../EmpDbMgr");
  //   const PacientesSchema = AlphaRequire("../../models/InvCore/Pacientes");
  //   const conn = await EmpDbMgr.ConnectToEmpDb(req.headers["empresa"]);
  //   const Pacientes = conn.db.model("Pacientes", PacientesSchema);
  //   const rows = await Pacientes.find({}).limit(200).lean();
  router.get("/pacientes", (req, res) => {
    res.json({
      data: [
        { Codp: "P0001", Nombre: "María Pérez", Cedula: "V-12345678" },
        { Codp: "P0002", Nombre: "Juan García", Cedula: "V-87654321" },
      ],
    });
  });

  return router;
};

module.exports = { main };

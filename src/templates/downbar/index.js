// Backend del widget {keyName} (DownBar)
//
// Provee el endpoint que el widget consulta para mostrar el contador/badge.

const main = (AlphaRequire) => {
  const express = AlphaRequire("express");
  const router = express.Router();

  // GET /count — número que el widget muestra en el badge
  router.get("/count", (req, res) => {
    // TODO: aquí queryeas tu colección real, p.ej. notificaciones pendientes
    res.json({ count: Math.floor(Math.random() * 10) });
  });

  // GET /items — lista que se muestra al hacer click en el widget
  router.get("/items", (req, res) => {
    res.json({
      items: [
        { id: 1, title: "Nuevo pedido #102", at: new Date().toISOString() },
        { id: 2, title: "Stock bajo: Producto X", at: new Date().toISOString() },
      ],
    });
  });

  return router;
};

module.exports = { main };

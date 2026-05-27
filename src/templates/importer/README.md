# {keyNamePascal} — Importador

> {description}

Patrón Alpha de **importador**: upload de archivo XLSX/XLS/CSV → preview con
las primeras 20 filas → commit que inserta a la BD.

## Flujo

1. Usuario selecciona archivo (`<input type="file">`)
2. Frontend lo lee como `data URL` (base64) y lo envía a `/preview`
3. Backend parsea con `xlsx` y devuelve `{total, sample, columns}`
4. Usuario revisa → clic en "Confirmar"
5. `/commit` recibe el archivo de nuevo + mapping opcional y hace `insertMany`

## Personalización mínima

Edita `index.js` para apuntar al modelo real:

```js
const EmpDbMgr = AlphaRequire("../EmpDbMgr");
const ProductosGeneralSchema = AlphaRequire("../../models/InvCore/ProductosGeneral");

const conn = await EmpDbMgr.ConnectToEmpDb(empresaId);
const Model = conn.db.model("ProductosGenerals", ProductosGeneralSchema);
const result = await Model.insertMany(mapped, { ordered: false });
```

Y opcionalmente pasa un `mapping` desde el renderer para renombrar columnas:

```js
await AlphaApi_Fetch("/pkgs/{keyName}/api/commit", "POST", {
  file: file.base64,
  mapping: {
    Codp: "Código",           // dest: source
    Descripcion: "Descripción",
    Existencia: "Stock",
  },
});
```

## Dependencias

`xlsx@^0.18.5` — `npmInstall: true` en el manifest hace que `installPackageStore`
ejecute `npm install` automáticamente tras descargar.

## Comandos

```bash
npm install               # antes del primer build, para tener xlsx local
alpha-pkg lint
alpha-pkg build
alpha-pkg publish --bump=patch
```

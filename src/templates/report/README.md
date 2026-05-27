# {keyNamePascal} — Reporte AlphaReport Engine

> {description}

Reporte basado en el **AlphaReport Engine** (`.arpt`). Soporta PDF (react-pdf
declarativo o pdfkit imperativo) + Excel. Hot-reload incluido.

Ver `docs/AlphaReport-Engine.md` del cliente para la documentación completa.

## Estructura

```
{keyName}/
├── {keyName}.appkg      # manifest (engine: "arpt", para CLI y store)
├── {keyName}.arpt       # ← el reporte real (metadata + generatePDF + generateExcel)
└── README.md
```

El archivo `.arpt` debe ir al final en `REPORTS_PATH` del cliente.
El AlphaReport Engine lo enumera vía `GET /api/ReportCore/alpha/list` y lo
visualiza en `/home/reportcore/alpha/{keyNamePascal}`.

## Probar local (manual)

```bash
# Mac: REPORTS_PATH usualmente está en
#   ~/Library/Application Support/ALPHAADMINFILES/Reports/
# Windows:
#   %appdata%/ALPHAADMINFILES/Reports/

# Symlink (recomendado — editas el .arpt y el cliente lo refresca al instante)
ln -sf "$(pwd)/{keyName}.arpt" "$REPORTS_PATH/{keyName}.arpt"

# O copia (vas a tener que re-copiar cada vez que edites)
cp {keyName}.arpt "$REPORTS_PATH/"
```

Después abre Alpha Admin → Reportes → `{keyNamePascal}`.

> **Nota**: a diferencia de los paquetes regulares, los `.arpt` viven directo
> en `REPORTS_PATH` (no en `packages_PATH/<keyName>/`). El AlphaReport Engine
> enumera **solo archivos raíz** (no recursivo) más el subdir `mod/` (overrides
> con prioridad).

## API del `.arpt`

### `exports.metadata`

Objeto plano O función async `(ctx) => metadata`. La función permite cargar
opciones de select desde la DB:

```js
exports.metadata = async function (ctx) {
  const { models, empresaId } = ctx;
  const almacenes = await models.getModel("Almacenes")
    .find({ empresa: empresaId }).select("Codp Descripcion").lean();
  return {
    name: "...",
    parameters: [
      { name: "Almacen", type: "select", options: almacenes.map(...) },
    ],
  };
};
```

### Tipos de parámetros

| `type` | Validaciones soportadas |
|---|---|
| `text` | `required`, `minLength`, `maxLength`, `pattern` + `patternMessage` |
| `textarea` | `required`, `rows`, `minLength`, `maxLength` |
| `number` | `required`, `min`, `max`, `step` |
| `date` | `required`, `minDate`, `maxDate`, `validate(value, allValues)` |
| `checkbox` | `default: true \| false` |
| `select` | `options: [...]`, `default` |
| `multiselect` | `options`, `minSelect`, `maxSelect` |

Cualquier campo acepta también `validate: (value, allValues) => null \| "msg"`.

### `exports.generatePDF(ctx)` — react-pdf

Devuelve `<Document>` de `@react-pdf/renderer`. **Declarativo, OK <500 filas.**

### `exports.generatePdfKit(ctx, outputPath)` — pdfkit (rápido)

Imperativo. **60x más rápido** para datasets grandes. Si exportas esta
función, el engine la usa en vez de `generatePDF` automáticamente.

Helpers disponibles via `require(ctx.utilsPath)`:
`createPdf`, `drawHeader`, `drawFooter`, `Table`, `drawTotalsRow`, `drawSectionTitle`,
`drawSummaryBox`, `drawGroupHeader`.

### `exports.generateExcel(ctx)` — exceljs

Devuelve `await workbook.xlsx.writeBuffer()`. Si tu paquete necesita `exceljs`,
ponlo en `package.json` y marca `npmInstall: true` en el `.appkg`.

## Contexto (`ctx`)

```js
{
  params: { Titulo: "...", FechaInicio: "...", ... },
  empresaId: "64f...",
  models: { Facturas, ProductosGeneral, Kardex, getModel(name) },
  moneda: MonedaUtils,
  getEmpresaInfo: async () => ({ nombre, rif, direccion, logo, ... }),
  utilsPath: "/.../path/to/pdfkit-utils",  // solo para generatePdfKit
  log, warn, error: (msg) => console.{log,warn,error}(`[ReportID] ${msg}`),
}
```

## Comandos

```bash
alpha-pkg lint
alpha-pkg build                 # zipa con el .arpt adentro
alpha-pkg publish --bump=patch  # sube al store (categoría reports)
```

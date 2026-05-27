# `@alphasoft/alpha-pkg`

CLI para desarrollar, validar, empaquetar y publicar extensiones de Alpha Administrativo.

## Instalación

```bash
npm install -g @alphasoft/alpha-pkg
```

Verifica:

```bash
alpha-pkg --version
```

## Comandos

### `alpha-pkg init <name>`

Crea un nuevo paquete con la estructura estándar Alpha.

```bash
alpha-pkg init mi-paquete                       # template fullstack (default)
alpha-pkg init mi-paquete --template=renderer   # solo UI, sin backend
alpha-pkg init mi-paquete --template=report     # helper de reporte
alpha-pkg init mi-paquete --author="Juan Pérez" --description="..."
alpha-pkg init mi-paquete --yes                 # no preguntar, usar defaults
```

**Convención de nombres**: kebab-case (minúsculas + dígitos + guiones). Ej: `inventario-helper`, `factura-electronica`. Esto es el `keyName`, debe ser único en el store.

Templates disponibles:

| Template    | Para qué                                                                                                        |
| ----------- | --------------------------------------------------------------------------------------------------------------- |
| `fullstack` | Backend (`index.js`) + renderer (`render.js`) + manifest. Default.                                              |
| `renderer`  | Solo UI, sin backend. Consume APIs estándar del cliente.                                                        |
| `report`    | Helper de reporte (`report: true`, se monta en `/ReportDataLoad/`).                                             |
| `extension` | Inyecta campos custom + handlers (`onClienteChange`, etc.) en VenCore/Facturas o ComCore/Compras. Sin renderer. |
| `crud`      | DataGrid + Dialog + 5 endpoints REST + EmpDbMgr pattern. UI base para módulos de negocio.                       |
| `importer`  | XLSX/CSV upload + preview + commit. `xlsx` lib + `npmInstall: true`.                                            |
| `downbar`   | Widget compacto para la barra inferior (`PackageLoaderDownBar`). Badge + popover + polling.                     |

### `alpha-pkg lint [path]`

Valida el manifest y los archivos referenciados.

```bash
alpha-pkg lint              # en cwd
alpha-pkg lint ./mi-paquete # carpeta específica
```

Reporta:

- **Errores** (bloquean publish): campos requeridos faltantes, semver inválido, archivos referenciados que no existen, schema inválido.
- **Warnings** (no bloquean): categoría no estándar, `extensions.model` desconocido, sin `main`/`renderer`/`extensions` declarado.

### `alpha-pkg build [path]`

Empaqueta el zip listo para publicar.

```bash
alpha-pkg build                  # bumpa patch + zips
alpha-pkg build --bump=minor
alpha-pkg build --bump=none      # no bumpear versión
alpha-pkg build --output=./dist  # custom output
alpha-pkg build --no-lint        # saltar lint (no recomendado)
```

Produce `./dist/<keyName>-<version>.zip` excluyendo:

- `node_modules/`, `dist/`, `.git/`, `*.log`, `.DS_Store`
- `.alpha-git-token`, `.alpha-git-meta.json` (sidecars del cliente)

Sincroniza la versión en `package.json` si existe.

### `alpha-pkg link [path]`

**Iteración instantánea** — symlinkea tu carpeta de desarrollo dentro de
`packages/` de Alpha Admin local. Sin copiar archivos: editas en tu repo y
el cliente lo ve al instante (con `hotReload: true` el backend se recarga
solo al guardar).

```bash
alpha-pkg link                                 # cwd
alpha-pkg link ./mi-paquete
alpha-pkg link --host=http://localhost:4545    # cambiar host de Alpha Admin
```

Requisitos:

- Alpha Admin local corriendo
- **DevMode habilitado** en Configuración → DevMode = `true` (o `ALPHA_DEV_MODE=true`)
- Request desde localhost/LAN (rechaza requests remotas por seguridad)

### `alpha-pkg unlink <keyName>`

Remueve el symlink. **NO toca tu carpeta original** (distinto de `/pkg/uninstall`
que hace rm -rf en la carpeta real).

```bash
alpha-pkg unlink mi-paquete
```

### `alpha-pkg publish [path]`

Sube el paquete al store. Hace `build` automáticamente (a menos que `--no-build`).

```bash
alpha-pkg publish                                       # interactivo
alpha-pkg publish --bump=minor --changelog="Fix bug X"
alpha-pkg publish --no-build                            # usa ./dist/ ya construido
alpha-pkg publish --prerelease                          # marca como pre-release
alpha-pkg publish --store-url=https://store.alphadministrativo.app \
                  --email=admin@example.com --password=...
```

Si el paquete no existe en el store, ofrece crearlo desde el manifest local.

## Configuración

En orden de precedencia:

1. **Flags CLI** (`--store-url`, `--email`, `--password`)
2. **Variables de entorno**: `ALPHA_STORE_URL`, `ALPHA_STORE_EMAIL`, `ALPHA_STORE_PASSWORD`
3. **`.alpharc`** en cwd
4. **`.alpharc`** en `$HOME`
5. Defaults (`storeUrl = https://store.alphadministrativo.app`)

Ejemplo `.alpharc`:

```json
{
  "storeUrl": "https://store.alphadministrativo.app",
  "email": "dev@mi-empresa.com"
}
```

> **No commits el password en `.alpharc`** si vives en repo público. Mejor `ALPHA_STORE_PASSWORD` en tu shell o keychain del SO.

## Flujo recomendado

```bash
# Día 1: nuevo paquete
alpha-pkg init mi-paquete --template=fullstack
cd mi-paquete
npm install                  # si necesitas deps
git init && git add -A && git commit -m "init"

# Iteración
# ...editas index.js / renderer/render.js...
alpha-pkg lint               # antes de cada commit
alpha-pkg build --bump=none  # probar el zip localmente

# Probar en local (DevMode)
# 1. activa LocalConfig.DevMode = "true" en tu AlphaAdmin
# 2. en la tab "Paquetes Personalizados" del store, clona/symlink este repo
# 3. abre el módulo desde el sidebar

# Publicar al store
alpha-pkg publish --bump=patch --changelog="Bugfix descripción"
```

## Estructura generada

```
mi-paquete/
├── mi-paquete.appkg     # manifest (DENTRO de la carpeta, convención v1+)
├── index.js             # backend Express router (omitir si renderer-only)
├── renderer/
│   └── render.js        # frontend (function __Module)
├── package.json         # si tienes deps npm
├── .encryptIgnore       # patrones a no encriptar al publicar (opcional)
├── .gitignore
└── README.md
```

---

# Reference — Escribiendo paquetes Alpha

Esta sección contiene lo crítico que necesitas para escribir un paquete que
cargue correctamente. Si algo no está aquí, consulta el doc completo en el
repo del cliente: `docs/Contexto - Extensiones JS.md`.

## El manifest `.appkg`

Vive **dentro** de la carpeta (`mi-paquete/mi-paquete.appkg`). Es JSON puro.

```json
{
  "name": "MiPaquete",
  "version": "1.0.0",
  "author": "Tu Nombre",
  "description": "Hace X y Y",
  "category": "utils",
  "minVersion": "0.9.10",
  "requiresCores": ["VenCore"],
  "npmInstall": false,

  "main": [{ "routeName": "api", "routePath": "index.js", "hotReload": true }],
  "renderer": [
    {
      "opcName": "MiPaquete",
      "opcPath": "renderer",
      "opcMain": "index",
      "opcFile": "render",
      "opcType": "page",
      "Icon": "ph:cube"
    }
  ],
  "downbar": [
    /* widgets en barra inferior, opcional */
  ],
  "extensions": [
    /* inject de campos en Facturas/Compras, opcional */
  ]
}
```

| Campo           | Significado                                                            |
| --------------- | ---------------------------------------------------------------------- |
| `routeName`     | URL pública será `/pkgs/<keyName>/<routeName>/...`                     |
| `routePath`     | Archivo `.js` relativo al folder del paquete                           |
| `hotReload`     | `true` → chokidar recarga el archivo al guardar (solo en `.js` planos) |
| `opcName`       | nombre visible en sidebar                                              |
| `opcFile`       | nombre del archivo del renderer (sin `.js`)                            |
| `Icon`          | iconify id (recomendado `ph:*` Phosphor)                               |
| `requiresCores` | el cliente solo descarga si `Empresa.Cores` los incluye                |
| `npmInstall`    | si `true`, el cliente corre `npm install` tras descomprimir            |

`routePath` y `opcFile` declaran `.js` aunque el store los encripte a `.js-alpcrt`
— el desktop resuelve ambos automáticamente. **No declares `.js-alpcrt`**.

## Backend (`main`) — API del paquete

El archivo `routePath` (típicamente `index.js`) exporta `{ main }` que devuelve
un `express.Router`.

```js
const main = (AlphaRequire) => {
  const express = AlphaRequire("express");
  const router = express.Router();

  router.get("/items", async (req, res) => {
    const empresaId = req.headers["empresa"]; // ← inyectado automáticamente
    res.json({ empresaId, items: [] });
  });

  return router;
};

module.exports = { main };
```

**`AlphaRequire(name)`** te da acceso a `require()` desde el contexto del
cliente Alpha — incluye `express`, `mongoose`, y todo lo que tenga en su
`node_modules` (puedes pedir libs del core de Alpha como `EmpDbMgr`).

### Multi-empresa: `EmpDbMgr`

Cada empresa vive en su propia BD MongoDB (`Alp_<EmpresaId>`). Para escribir/leer
datos de una empresa:

```js
const main = (AlphaRequire) => {
  const EmpDbMgr = AlphaRequire("../EmpDbMgr");
  const Schema = AlphaRequire("../../models/InvCore/ProductosGeneral");

  router.get("/productos", async (req, res) => {
    const conn = await EmpDbMgr.ConnectToEmpDb(req.headers["empresa"]);
    const Productos = conn.db.model("ProductosGenerals", Schema);
    res.json(await Productos.find({}).limit(50).lean());
  });
  // ...
};
```

| Path desde `controllers/StoragePkg/`     | Acceso                 |
| ---------------------------------------- | ---------------------- |
| `AlphaRequire("../EmpDbMgr")`            | Conexiones por empresa |
| `AlphaRequire("../../models/InvCore/X")` | Schemas de inventario  |
| `AlphaRequire("../../models/VenCore/X")` | Schemas de ventas      |
| `AlphaRequire("../../utils/X")`          | Utilidades del core    |

### Hot-reload y timers

`hotReload: true` re-ejecuta `main()` al guardar el `.js`. **Si arrancas un
`setInterval`, guarda el id a nivel de módulo** y limpia antes de re-crear,
si no acumulas timers duplicados:

```js
let _intervalId = null; // top-level, sobrevive a re-requires

const main = (AlphaRequire) => {
  if (_intervalId) clearInterval(_intervalId);
  _intervalId = setInterval(() => syncCycle(), 5 * 60 * 1000);
  return router;
};
```

## Renderer — gotchas críticos

### 1. Una sola `function __Module` por archivo

El `PackageLoader` del cliente transforma así:

```js
const code = cd
  .replace('"use strict";', "")
  .replace("function __Module", "(function") // ← solo la PRIMERA ocurrencia
  .trim();
```

Implica:

- ❌ NO declares helpers / sub-componentes / constantes **fuera** de `__Module`
- ❌ NO uses `import` / `export` en el renderer
- ✅ TODO vive dentro de `function __Module`

### 2. Sub-componentes con estado → `useMemo` para fijar referencia

Si declaras `function MiSub()` adentro de `__Module` y lo usas como `<MiSub />`,
cada render crea una nueva referencia → React la trata como tipo distinto →
desmonta + monta → `useEffect` dispara cada vez → si hace `setState` en el
padre → **loop infinito**.

```js
function __Module({ MUI, Deps }) {
  const { useState, useMemo } = Deps.React;

  // La fábrica corre UNA vez; la referencia es estable entre renders.
  const MiSub = useMemo(
    () =>
      function MiSub({ items, onAdd }) {
        const [q, setQ] = useState("");
        return (
          <MUI.TextField value={q} onChange={(e) => setQ(e.target.value)} />
        );
      },
    [],
  );

  return <MiSub items={items} onAdd={handleAdd} />;
}
```

Si el sub NO necesita estado, una función pura que devuelve JSX es OK
(`const renderHeader = () => <MUI.AppBar />`).

### 3. Callbacks a sub-componentes → `useCallback`

Sin memoizar, cada render crea una nueva fn → si el sub la usa como dep de
`useEffect`, se re-corre cada render. `setState` en la callback → loop.

```js
const handleAdd = useCallback(async (id) => { ... }, [refrescar]);
return <MiSub onAdd={handleAdd} />;
```

### 4. El ErrorBoundary enmascara errores con "process is not defined"

El `ErrorBoundary` del cliente referencia `process.env.*` que en el browser
no existe. Cuando tu renderer lanza CUALQUIER error y entra al boundary, ESE
se rompe y muestra `ReferenceError: process is not defined`. El error real
queda oculto.

Cuando veas ese mensaje, **NO lo tomes literal**. Mira la consola del browser
para el `console.log` que `PackageLoader` imprime con el código FINAL
post-transform — ahí está el error real.

### 5. JSX `&&` con `0` renderiza "0"

```jsx
{
  count && <Badge>{count}</Badge>;
} // ❌ si count===0 renderiza "0"
{
  count > 0 && <Badge>{count}</Badge>;
} // ✅
```

## Renderer — props inyectadas

```js
function __Module({ MUI, Deps, Utils, Contexts }) {
  // MUI: componentes estándar @mui/material
  //   MUI.Button, MUI.Card, MUI.Stack, MUI.TextField, ...

  // Deps: utilidades varias
  const {
    React, // React puro (usar React.useState etc.)
    xDataGrid, // @mui/x-data-grid
    ALPHA, // Componentes nativos Alpha (CardArchivo, SelectBy, etc.)
    AlphaApi_Fetch, // axios wrapper que incluye token + header empresa
    NiceModal, // @ebay/nice-modal-react
    toast, // react-toastify
    moment, // moment.js
    Icon, // @iconify/react
    ReportViewer, // visor de PDFs/.mrt
    useFormulas, // hook de cálculos numéricos Alpha
    Recharts, // { LineChart, BarChart, PieChart, ... }
  } = Deps;

  // Utils
  const { useRecover, fCurrency, navigate } = Utils;

  // Contexts (usar con React.useContext)
  const {
    UserContext, // sesión + permisos del usuario
    DivisaContext, // moneda activa (Local / Extranjera)
    ConfigAlphaContext, // settings core
    ConfigAllContext, // todas las configuraciones del cliente
  } = Contexts;

  const user = React.useContext(UserContext);
  // ...
}
```

## Llamadas al API

Todo HTTP desde el renderer pasa por `Deps.AlphaApi_Fetch` — un wrapper de
axios que automáticamente inyecta el token de sesión y el header `empresa`:

```js
Deps.AlphaApi_Fetch("/pkgs/mi-paquete/api/items", "GET")
  .then((res) => {
    // res.status — código HTTP
    // res.data   — body parseado
  });

Deps.AlphaApi_Fetch("/pkgs/mi-paquete/api/items", "POST", { Codp: "X", ... });
Deps.AlphaApi_Fetch("/pkgs/mi-paquete/api/items/X", "DELETE");
```

## Componentes Alpha reusables (`Deps.ALPHA`)

| Componente           | Uso                                                                             |
| -------------------- | ------------------------------------------------------------------------------- |
| `ALPHA.CardArchivo`  | Patrón archivo maestro (selector + tabs + form + buscar) — usar template `crud` |
| `ALPHA.SelectBy`     | Dropdown con datasource HTTP, búsqueda, OtherFields                             |
| `ALPHA.Searchcm`     | Diálogo de búsqueda avanzada con columnas custom                                |
| `ALPHA.CodpSelector` | Input de código con autocomplete + Nuevo libre                                  |

El template `crud` muestra el uso de `CardArchivo` end-to-end con backend wireado.

## Inyectar campos en Facturas / Compras (`extensions[]`)

Sin renderer propio — solo agrega el bloque `extensions[]` al manifest. Los
campos capturados se guardan automáticamente en `Factura.Totalizar.ExtraData`
(o `Compra.Totalizar.ExtraData`) sin tocar schema.

```json
"extensions": [
  {
    "model": "VenCore/Facturas",
    "fields": [
      {
        "name": "MedicoTratante",
        "label": "Médico Tratante",
        "type": "String",
        "ui": "TextField"
      },
      {
        "name": "PacienteCodigo",
        "label": "Paciente",
        "type": "String",
        "ui": "SelectBy",
        "selectByProps": {
          "Url": "/pkgs/mi-paquete/api/pacientes",
          "OtherFields": ["Nombre", "Cedula"]
        }
      }
    ],
    "events": [
      {
        "on": "onClienteChange",
        "action": "Factura.Totalizar.ExtraData = Factura.Totalizar.ExtraData || {}; if (sourceValue && sourceValue.Nombre) { Factura.Totalizar.ExtraData.ClienteNombre = sourceValue.Nombre; } return Factura;"
      }
    ]
  }
]
```

| `ui`        | Props extra                               |
| ----------- | ----------------------------------------- |
| `TextField` | —                                         |
| `SelectBy`  | `selectByProps: { Url, OtherFields }`     |
| `SearchCM`  | `searchcmProps: { titulo, Url, columns }` |

**`events[].action`** es código JS evaluado con `new Function()` en el browser.
Mantenlo corto y puro. Para lógica compleja expón un endpoint en `main` y
llámalo con `AlphaApi_Fetch`. Es **obligatorio** retornar el objeto principal
modificado (`return Factura;` o `return Compra;`).

Eventos disponibles (subset): `onClienteChange`, `onProveedorChange`, `onItemAdd`.

## Reportes — AlphaReport Engine (`engine: "arpt"`)

Usa el template `report`. El `.arpt` exporta:

- `metadata` — objeto o función async `(ctx) => metadata`
- `generatePDF(ctx)` → `<Document>` de `@react-pdf/renderer` (declarativo)
- `generatePdfKit(ctx, outputPath)` → imperativo, **60x más rápido** para datasets grandes
- `generateExcel(ctx)` → `await workbook.xlsx.writeBuffer()`

```js
exports.metadata = {
  name: "Mi Reporte",
  parameters: [
    { name: "Titulo", type: "text", label: "Título", required: true },
    { name: "FechaInicio", type: "date", label: "Desde", required: true },
    { name: "Tipo", type: "select", options: ["A", "B"], default: "A" },
  ],
};

exports.generatePDF = async function (ctx) {
  const { params, getEmpresaInfo, models, empresaId } = ctx;
  const empresa = await getEmpresaInfo();
  // ...return <Document>...
};
```

`ctx` incluye: `params`, `empresaId`, `models.{Facturas, ProductosGeneral, ...}`,
`getEmpresaInfo()`, `moneda`, `log/warn/error`. Para `generatePdfKit` también
`utilsPath` con helpers `createPdf`, `Table`, `drawHeader`, `drawFooter`.

Tipos de parámetros: `text` · `textarea` · `number` · `date` · `checkbox` ·
`select` · `multiselect`. Todos soportan `required`, `validate(value, allValues)`.

## Encriptacion (`.js-alpcrt` y `.appkg-cr`)

Al subir un paquete con `encryptOnDownload: true`, el store re-encripta los
`.js` y el manifest **al momento de cada descarga** usando una clave
derivada de `(Serial, ActCode, keyName)` del comprador. Un paquete copiado
de otra máquina no puede ejecutarse.

### `.encryptIgnore`

Archivo opcional con globs simples (`*` wildcard). Lo que liste NO se
encripta. `package.json` y `node_modules/` se ignoran siempre.

```
# .encryptIgnore
docs/*.md
secrets.json
dist/*.bundle.js
```

### Reglas para devs

- **No declares `.js-alpcrt`** en el manifest — declara `.js`. El cliente
  resuelve automáticamente.
- **Hot-reload no funciona con encriptados** — los `.js-alpcrt` son inmutables
  en producción.
- El plaintext **nunca toca disco** del cliente: se compila en memoria vía
  `Module._compile()`. Si tu paquete tiene timers o estado top-level, asegúrate
  de que sobrevivan a re-imports.

## DevMode — iteración instantánea

Para iterar sin re-publicar tras cada cambio:

1. **En Alpha Admin**: Configuración → `DevMode = true` (o `ALPHA_DEV_MODE=true`)
2. **En tu repo**: `alpha-pkg link` — symlinkea tu carpeta en `packages/`
3. Editas archivos → el backend recarga al guardar (con `hotReload: true`)
4. Renderer: clic "Refrescar" arriba de la página (no hay hot-reload del frontend)
5. Cuando termines: `alpha-pkg unlink mi-paquete`

## Checklist antes de publicar

- [ ] `alpha-pkg lint` pasa sin errores
- [ ] Una sola `function __Module` por archivo, todo adentro
- [ ] Sub-componentes con estado en `useMemo`
- [ ] Callbacks a subs con `useCallback`
- [ ] `setInterval` en backend protegido con `clearInterval` (id top-level)
- [ ] `requiresCores` declara los cores que usas (`VenCore`, `InvCore`, etc.)
- [ ] `minVersion` está a la altura de la API que usas
- [ ] `.encryptIgnore` si tienes assets que no deben encriptarse
- [ ] Cerrado y reabierto la página tras editar el renderer

---

## Troubleshooting

### CLI

| Error                                   | Causa probable                                                                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `No se encontró <keyName>.appkg`        | El manifest no vive dentro de la carpeta. Mover.                                                              |
| `version no es semver`                  | Editar manifest manualmente con un formato válido (ej. `1.0.0`).                                              |
| `Login falló (401)`                     | Credenciales admin incorrectas o el store no tiene admins seeded.                                             |
| `Buscar package falló (401)`            | Token expiró. Vuelve a correr `publish`.                                                                      |
| `Upload falló (400) zip inválido`       | El zip no contiene `<keyName>.appkg` adentro. Verifica con `unzip -l dist/...`.                               |
| `No se pudo contactar Alpha Admin en X` | El cliente no está corriendo, o `--host` apunta a un puerto erróneo (default 4545).                           |
| `DevMode no está habilitado`            | Activa `DevMode = true` en Configuración del cliente, o `export ALPHA_DEV_MODE=true` antes de arrancar Alpha. |
| `EPERM al crear symlink` (Windows)      | Habilita "Developer Mode" del SO o corre Alpha Admin como administrador.                                      |

### Renderer

| Síntoma                                                         | Posible causa                                                                                                                            |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `ReferenceError: process is not defined`                        | Tu renderer lanza un error — el ErrorBoundary del cliente lo enmascara. Mira la consola del browser para el código FINAL post-transform. |
| Página en blanco / pantalla gris                                | Probablemente declaraste algo fuera de `function __Module`. Mueve TODO adentro.                                                          |
| Loop infinito de re-renders / fetches                           | Sub-componente declarado sin `useMemo` o callback sin `useCallback` — gotchas 2 y 3 arriba.                                              |
| `Cannot read properties of undefined (reading 'X')` en `Deps.X` | Esa dependencia no está inyectada. Revisa "Renderer — props inyectadas".                                                                 |
| `0` aparece donde esperabas nada                                | `{count && <X/>}` con count=0. Usar `{count > 0 && <X/>}`.                                                                               |

### Backend (`main`)

| Síntoma                                                | Posible causa                                                                                                                                     |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cambios al guardar `index.js` no se reflejan           | `hotReload: true` no está en el manifest, o el paquete está encriptado.                                                                           |
| `setInterval` corre 2x, 3x... tras cada save           | No estás haciendo `clearInterval` con id a nivel de módulo — ver "Hot-reload y timers".                                                           |
| `mongoose.model "Schema hasn't been registered"`       | Estás usando el modelo del core con `require()` normal en vez de via `EmpDbMgr.ConnectToEmpDb()`.                                                 |
| 404 al pegarle a `/pkgs/<kn>/api/...` recién instalado | El paquete quedó después del catch-all SPA. Reinicia Alpha Admin (o ya está fixed: el hoister lo reordena automáticamente — si pasa, abre issue). |

## Licencia

MIT — AlphaSoft, C.A.

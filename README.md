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

| Template | Para qué |
|---|---|
| `fullstack` | Backend (`index.js`) + renderer (`render.js`) + manifest. Default. |
| `renderer` | Solo UI, sin backend. Consume APIs estándar del cliente. |
| `report` | Helper de reporte (`report: true`, se monta en `/ReportDataLoad/`). |
| `extension` | Inyecta campos custom + handlers (`onClienteChange`, etc.) en VenCore/Facturas o ComCore/Compras. Sin renderer. |
| `crud` | DataGrid + Dialog + 5 endpoints REST + EmpDbMgr pattern. UI base para módulos de negocio. |
| `importer` | XLSX/CSV upload + preview + commit. `xlsx` lib + `npmInstall: true`. |
| `downbar` | Widget compacto para la barra inferior (`PackageLoaderDownBar`). Badge + popover + polling. |

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

## Convenciones críticas

- **Manifest adentro de la carpeta**: `mi-paquete/mi-paquete.appkg` (no afuera).
- **routePath en el manifest**: declarar `.js` aunque el store lo encripte a `.js-alpcrt`. El desktop resuelve ambos automáticamente.
- **Renderer**: una sola `function __Module` por archivo, todo adentro. Ver `docs/Contexto - Extensiones JS.md` del cliente para gotchas detallados.
- **No commits** el `.alpha-git-token` ni `.alpha-git-meta.json` (sidecars que el cliente genera al clonar via DevMode).

## Troubleshooting

| Error | Causa probable |
|---|---|
| `No se encontró <keyName>.appkg` | El manifest no vive dentro de la carpeta. Mover. |
| `version no es semver` | Editar manifest manualmente con un formato válido (ej. `1.0.0`). |
| `Login falló (401)` | Credenciales admin incorrectas o el store no tiene admins seeded. |
| `Buscar package falló (401)` | Token expiró. Vuelve a correr `publish`. |
| `Upload falló (400) zip inválido` | El zip no contiene `<keyName>.appkg` adentro. Verifica con `unzip -l dist/...`. |

## Licencia

MIT — AlphaSoft, C.A.

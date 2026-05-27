# {keyNamePascal}

> {description}

**Tipo**: extensión — inyecta campos custom + eventos en módulos del core
(VenCore/Facturas o ComCore/Compras). NO renderiza páginas propias.

## Cómo funciona

El bloque `extensions[]` del `.appkg` declara:

1. **`fields[]`** — campos dinámicos en la UI. Lo capturado se guarda en
   `Factura.Totalizar.ExtraData` (o `Compra.Totalizar.ExtraData`) en Mongo,
   sin necesidad de modificar el schema.
2. **`events[]`** — handlers JS evaluados en el frontend cuando ocurre algo
   en la UI (ej. `onClienteChange`). Recibe `sourceValue` y el objeto
   principal (`Factura`/`Compra`). Debe retornar el objeto modificado.

Ver `docs/Contexto - Extensiones JS.md` del cliente para la lista completa
de `ui` types (`TextField` | `SelectBy` | `SearchCM`), `selectByProps`,
`searchcmProps`, y eventos disponibles.

## UI types soportados

| `ui` | Para qué | Props extra |
|---|---|---|
| `TextField` | input texto plano | — |
| `SelectBy` | dropdown con datasource | `selectByProps: {Url, OtherFields}` |
| `SearchCM` | búsqueda avanzada con dialog | `searchcmProps: {titulo, Url, columns}` |

## Eventos soportados (subset)

| `on` | Cuándo | Variables disponibles |
|---|---|---|
| `onClienteChange` | usuario cambia el Cliente en Factura | `sourceValue, Factura` |
| `onProveedorChange` | usuario cambia el Proveedor en Compra | `sourceValue, Compra` |
| `onItemAdd` | se agrega un item al detalle | `sourceValue, Factura, item` |

> ⚠️ El código del `action` se evalúa con `new Function()` en el browser.
> Mantenlo **corto y puro** (sin async, sin imports). Si necesitas lógica
> compleja, expón un endpoint en `main` y llámalo con `AlphaApi_Fetch`.

## Comandos

```bash
alpha-pkg lint
alpha-pkg build
alpha-pkg publish --bump=patch
```

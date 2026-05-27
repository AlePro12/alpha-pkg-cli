# {keyNamePascal} — CRUD con CardArchivo

> {description}

Patrón estándar Alpha de **archivo maestro** usando el componente nativo
`Deps.ALPHA.CardArchivo`. Trae sin escribir código:

- Selector de Código (`Codp`) con autocomplete y validación de existencia
- Tabs configurables con form de inputs
- Botones **Nuevo** (genera próximo Codp libre), **Guardar**, **Eliminar**
- Atajos: `Esc` (cancelar), `Ctrl+S` / `Ctrl+G` (guardar)
- Tabla "Buscar" con `Campos` para listar registros existentes
- Auditoría visual + dirty tracking + confirmación al cerrar con cambios

Backend del paquete provee los 5 endpoints que CardArchivo consume.

## Contrato con CardArchivo (lo que provee `index.js`)

| Operación | HTTP | URL | Body / Response |
|---|---|---|---|
| Buscar uno | GET | `{host}{Codp}` | → `{status:"success", data:{...}}` o `{status:"not_found"}` |
| Listar | GET | `{host}/` | → array de items (usado para Nuevo y búsqueda) |
| Crear | POST | `{host}` | body = record con Codp → `{status:"success", alertas:[]}` |
| Actualizar | PUT | `{host}` | body = record con Codp → `{status:"success", alertas:[]}` |
| Eliminar | DELETE | `{host}{Codp}` | → `{ok:true}` (soft delete via `Activo: false`) |

`{host}` en este template = `/pkgs/{keyName}/items/` (el `routeName` del manifest es `items`).

## Props clave de CardArchivo

```jsx
<CardArchivo
  Empresa="NONE"                              // contexto, "NONE" = global
  host="/pkgs/{keyName}/items/"               // base URL del CRUD
  hostSearch="/pkgs/{keyName}/items/"         // suele ser igual a host
  titleAllow                                  // muestra título del registro
  Tabs={[{ index: 0, label: "Datos" }]}      // tabs del form
  TabsContainer={[{                           // contenido por tab
    Tab: 0,
    Content: [
      { input: { id: "Descripcion", label: "Descripción",
                 type: "text", handleChange: InputChangeMaestro } },
      // type: "text" | "number" | "date" | "select" | etc.
      // stack: true  → input en la siguiente fila
    ],
  }]}
  Campos={[                                   // columnas tabla "Buscar"
    { field: "Codp", headerName: "Código", width: 150 },
    ...
  ]}
  data={{ Codp: "", Descripcion: "", Cantidad: 0 }}  // shape inicial
  policy="MiPaquete"                          // opcional: gate de permisos
                                              //   (Allow("MiPaquete/New" | "/Edit"))
/>
```

## Inputs avanzados

Además de `text`/`number`/`date`, `CardArchivo` integra:
- `SelectBy` — dropdown desde URL (`OtherFields` para info adicional)
- `SearchCM` — búsqueda con dialog (`searchcmProps`)
- `Checkbox`, `Switch`
- `currency` (con respeto al format de `Divisa`)

Ver ejemplos en otros paquetes oficiales o en el código de `CardArchivo.jsx`.

## Personalización mínima

1. Edita `ItemSchema` en `index.js` con tus campos reales.
2. Agrega/quita inputs en `TabsContainer[0].Content`.
3. Ajusta `Campos` (columnas de la tabla Buscar).
4. Cambia `data` con los defaults de tu registro.

## Para usar BD por-empresa real

Descomenta en `index.js`:
```js
const EmpDbMgr = AlphaRequire("../EmpDbMgr");
const conn = await EmpDbMgr.ConnectToEmpDb(empresaId);
const Model = conn.db.model("{keyNamePascal}Items", ItemSchema);
```

## Comandos

```bash
alpha-pkg lint
alpha-pkg build
alpha-pkg publish --bump=patch
```

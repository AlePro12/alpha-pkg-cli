# {keyNamePascal} — Widget DownBar

> {description}

Widget compacto que aparece en la **barra inferior** de Alpha Admin
(`PackageLoaderDownBar.jsx`). NO es página completa — pensado para:

- Badges/contadores con polling (ej. notificaciones, pedidos pendientes)
- Atajos rápidos a modales (`NiceModal`)
- Acciones de un solo clic

## Estructura

```
{keyName}/
├── {keyName}.appkg       # manifest con bloque `downbar[]`
├── index.js              # backend opcional (datasource del widget)
├── downbar/
│   └── widget.js         # function __Module compacta
└── README.md
```

## Diferencias vs renderer normal

| | Renderer normal | DownBar widget |
|---|---|---|
| Loader | `PackageLoader.jsx` | `PackageLoaderDownBar.jsx` |
| Ruta estática | `/pkgs/renderer/<kn>/` | `/pkgs/downbar/<kn>/` |
| Bloque manifest | `renderer[]` | `downbar[]` |
| Tamaño UI | Página completa | Compacta (icono + popover/badge) |

Puedes declarar **ambos** (renderer + downbar) en el mismo manifest si tu
paquete ofrece página principal Y widget de acceso rápido.

## Comandos

```bash
alpha-pkg lint
alpha-pkg build
alpha-pkg publish --bump=patch
```

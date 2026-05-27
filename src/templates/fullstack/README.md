# {keyNamePascal}

> {description}

Paquete (extensión) para Alpha Administrativo.

## Estructura

```
{keyName}/
├── {keyName}.appkg       # manifest del paquete
├── index.js              # backend (Express router)
├── renderer/
│   └── render.js         # frontend (function __Module)
├── package.json
├── .encryptIgnore        # archivos a no encriptar al publicar
└── .gitignore
```

## Desarrollo

```bash
# Instala deps locales si las necesitas
npm install

# Valida el manifest y archivos referenciados
alpha-pkg lint

# Empaqueta listo para publicar (bumpa versión patch)
alpha-pkg build

# Sube al store (requiere credenciales admin)
alpha-pkg publish --bump=patch
```

## Probar local (DevMode)

1. Activa DevMode en tu AlphaAdmin: `LocalConfig.DevMode = "true"`.
2. En la tab "Paquetes Personalizados" del store del cliente, clona este repo (o cópialo a `packages/{keyName}/`).
3. Abre el módulo desde la sección que corresponda (definida por `renderer[].CoreSite` si aplica, o desde la sub-sección "Paquetes" del sidebar).

## Convenciones críticas (renderer)

- Una sola `function __Module` por archivo. Todo lo demás adentro.
- Sub-componentes con estado: envolver en `useMemo(() => function X() {}, [])` para fijar la referencia.
- Callbacks a sub-componentes: `useCallback`.
- No `import` / `export` en el renderer — el código se evalúa como expresión vía `string-to-react-component`.
- Acceso a libs: `MUI.*`, `Deps.*`, `Utils.*`, `Contexts.*` (inyectados como props).

Ver `docs/Contexto - Extensiones JS.md` del repo del cliente para todos los gotchas.

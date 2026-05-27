// Renderer-only del paquete {keyName}
// Una sola function __Module por archivo, todo adentro.

function __Module({ MUI, Deps, Contexts }) {
  const React = Deps.React;
  const { UserContext } = Contexts;
  const user = React.useContext(UserContext);

  return (
    <MUI.Card variant="outlined" sx={{ borderRadius: 2 }}>
      <MUI.CardHeader
        title={
          <MUI.Typography variant="h6" sx={{ fontWeight: 600 }}>
            {keyNamePascal}
          </MUI.Typography>
        }
        subheader={`Bienvenido ${user?.usuario?.Nombre || ""}`}
      />
      <MUI.CardContent>
        <MUI.Typography variant="body2" color="text.secondary">
          Renderer-only generado por <code>alpha-pkg init --template=renderer</code>.
          Edita <code>renderer/render.js</code> para tu UI.
        </MUI.Typography>
      </MUI.CardContent>
    </MUI.Card>
  );
}

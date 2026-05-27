// Renderer del paquete {keyName} ({keyNamePascal})
//
// IMPORTANTE: una sola function __Module por archivo. NO declarar nada
// fuera (helpers, sub-componentes, constantes — todo adentro).
// Ver docs/Contexto - Extensiones JS.md para gotchas críticos.

function __Module({ MUI, Deps, Utils, Contexts }) {
  const React = Deps.React;
  const { useState, useEffect, useCallback } = React;
  const { AlphaApi_Fetch, toast } = Deps;
  const { UserContext } = Contexts;

  const user = React.useContext(UserContext);
  const [pingData, setPingData] = useState(null);
  const [loading, setLoading] = useState(false);

  const handlePing = useCallback(async () => {
    setLoading(true);
    try {
      const res = await AlphaApi_Fetch("/pkgs/{keyName}/api/ping", "GET");
      setPingData(res.data);
      toast.success("Ping ok");
    } catch (e) {
      toast.error("Falló el ping");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    handlePing();
  }, [handlePing]);

  return (
    <MUI.Card variant="outlined" sx={{ borderRadius: 2 }}>
      <MUI.CardHeader
        title={<MUI.Typography variant="h6" sx={{ fontWeight: 600 }}>{keyNamePascal}</MUI.Typography>}
        subheader={`Bienvenido ${user?.usuario?.Nombre || ""}`}
      />
      <MUI.CardContent>
        <MUI.Stack spacing={2}>
          <MUI.Typography variant="body2" color="text.secondary">
            Este es el renderer inicial generado por <code>alpha-pkg init</code>.
            Modifica <code>renderer/render.js</code> para construir tu UI.
          </MUI.Typography>
          {pingData && (
            <MUI.Alert severity="success" sx={{ borderRadius: 2 }}>
              Backend respondió: <code>{JSON.stringify(pingData)}</code>
            </MUI.Alert>
          )}
        </MUI.Stack>
      </MUI.CardContent>
      <MUI.CardActions>
        <MUI.Button
          size="small"
          variant="contained"
          disableElevation
          onClick={handlePing}
          disabled={loading}
          sx={{ textTransform: "none", borderRadius: 1.5 }}
        >
          {loading ? "Pingeando…" : "Ping al backend"}
        </MUI.Button>
      </MUI.CardActions>
    </MUI.Card>
  );
}

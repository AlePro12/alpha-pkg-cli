// Widget downbar {keyName}
//
// Renderizado por PackageLoaderDownBar.jsx. NO es página completa: es un
// elemento compacto que se apila en la barra inferior de Alpha.
// Una sola function __Module por archivo (gotcha #1).

function __Module({ MUI, Deps }) {
  const React = Deps.React;
  const { useState, useEffect, useCallback } = React;
  const { AlphaApi_Fetch, NiceModal } = Deps;

  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);

  const refresh = useCallback(async () => {
    try {
      const res = await AlphaApi_Fetch("/pkgs/{keyName}/api/count", "GET");
      setCount(res.data?.count || 0);
    } catch (e) {
      // silencioso — los widgets fallidos no deben molestar al usuario
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 60000); // refresca cada minuto
    return () => clearInterval(id);
  }, [refresh]);

  const handleClick = useCallback(async () => {
    try {
      const res = await AlphaApi_Fetch("/pkgs/{keyName}/api/items", "GET");
      setItems(res.data?.items || []);
      setOpen(true);
    } catch (e) {}
  }, []);

  return (
    <>
      <MUI.Tooltip title="{keyNamePascal}">
        <MUI.IconButton size="small" onClick={handleClick}>
          <MUI.Badge badgeContent={count > 0 ? count : 0} color="primary" max={99}>
            <span role="img" aria-label="bell" style={{ fontSize: 18 }}>
              🔔
            </span>
          </MUI.Badge>
        </MUI.IconButton>
      </MUI.Tooltip>

      <MUI.Popover
        open={open}
        anchorReference="anchorPosition"
        anchorPosition={{ top: window.innerHeight - 80, left: window.innerWidth - 360 }}
        onClose={() => setOpen(false)}
        PaperProps={{ sx: { width: 340, borderRadius: 2, p: 1 } }}
      >
        <MUI.Typography variant="overline" sx={{ px: 1, color: "text.secondary" }}>
          {keyNamePascal}
        </MUI.Typography>
        {items.length === 0 ? (
          <MUI.Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: "center" }}>
            Sin items
          </MUI.Typography>
        ) : (
          <MUI.List dense>
            {items.map((it) => (
              <MUI.ListItem key={it.id} button>
                <MUI.ListItemText
                  primary={it.title}
                  secondary={new Date(it.at).toLocaleTimeString()}
                />
              </MUI.ListItem>
            ))}
          </MUI.List>
        )}
      </MUI.Popover>
    </>
  );
}

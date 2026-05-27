// Importador {keyName} — UI con drop zone, preview y commit
// Una sola function __Module por archivo (gotcha #1).

function __Module({ MUI, Deps }) {
  const React = Deps.React;
  const { useState, useCallback } = React;
  const { AlphaApi_Fetch, toast } = Deps;

  const [file, setFile] = useState(null); // { name, base64 }
  const [preview, setPreview] = useState(null); // { total, sample, columns }
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [result, setResult] = useState(null);

  const handleFile = useCallback((e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      setFile({ name: f.name, base64: reader.result });
      setPreview(null);
      setResult(null);
    };
    reader.readAsDataURL(f);
  }, []);

  const handlePreview = useCallback(async () => {
    if (!file) return;
    setLoading(true);
    try {
      const res = await AlphaApi_Fetch("/pkgs/{keyName}/api/preview", "POST", {
        file: file.base64,
        fileName: file.name,
      });
      setPreview(res.data);
      toast.success(`${res.data.total} filas detectadas`);
    } catch (e) {
      toast.error("Error al parsear el archivo");
    } finally {
      setLoading(false);
    }
  }, [file]);

  const handleCommit = useCallback(async () => {
    if (!file) return;
    setCommitting(true);
    try {
      const res = await AlphaApi_Fetch("/pkgs/{keyName}/api/commit", "POST", {
        file: file.base64,
        // Sin mapping → usa las columnas tal cual. Personaliza si necesitas
        // renombrar campos antes de insertar:
        //   mapping: { Codp: "Código", Descripcion: "Descripción" }
      });
      setResult(res.data);
      toast.success(`Importado: ${res.data.inserted} filas`);
    } catch (e) {
      toast.error("Error al importar");
    } finally {
      setCommitting(false);
    }
  }, [file]);

  return (
    <MUI.Stack spacing={2}>
      <MUI.Card variant="outlined" sx={{ borderRadius: 2 }}>
        <MUI.CardHeader title={<MUI.Typography variant="h6" sx={{ fontWeight: 600 }}>{keyNamePascal}</MUI.Typography>} subheader="Sube un .xlsx, .xls o .csv para importar" />
        <MUI.CardContent>
          <MUI.Stack spacing={2}>
            <MUI.Button
              variant="outlined"
              component="label"
              sx={{ textTransform: "none", borderRadius: 1.5, alignSelf: "flex-start" }}
            >
              {file ? `📎 ${file.name}` : "Seleccionar archivo"}
              <input type="file" hidden accept=".xlsx,.xls,.csv" onChange={handleFile} />
            </MUI.Button>

            {file && (
              <MUI.Stack direction="row" spacing={1}>
                <MUI.Button
                  variant="contained"
                  disableElevation
                  onClick={handlePreview}
                  disabled={loading}
                  sx={{ textTransform: "none", borderRadius: 1.5 }}
                >
                  {loading ? "Procesando…" : "Previsualizar"}
                </MUI.Button>
                {preview && (
                  <MUI.Button
                    variant="contained"
                    color="success"
                    disableElevation
                    onClick={handleCommit}
                    disabled={committing}
                    sx={{ textTransform: "none", borderRadius: 1.5 }}
                  >
                    {committing ? "Importando…" : `Confirmar (${preview.total} filas)`}
                  </MUI.Button>
                )}
              </MUI.Stack>
            )}
          </MUI.Stack>
        </MUI.CardContent>
      </MUI.Card>

      {preview && (
        <MUI.Card variant="outlined" sx={{ borderRadius: 2 }}>
          <MUI.CardHeader
            title={`Preview (primeras ${preview.sample.length} de ${preview.total})`}
            subheader={`Columnas: ${preview.columns.join(", ")}`}
          />
          <MUI.CardContent>
            <MUI.TableContainer sx={{ maxHeight: 400 }}>
              <MUI.Table size="small" stickyHeader>
                <MUI.TableHead>
                  <MUI.TableRow>
                    {preview.columns.map((c) => (
                      <MUI.TableCell key={c} sx={{ fontWeight: 600 }}>
                        {c}
                      </MUI.TableCell>
                    ))}
                  </MUI.TableRow>
                </MUI.TableHead>
                <MUI.TableBody>
                  {preview.sample.map((row, i) => (
                    <MUI.TableRow key={i}>
                      {preview.columns.map((c) => (
                        <MUI.TableCell key={c}>{String(row[c] ?? "")}</MUI.TableCell>
                      ))}
                    </MUI.TableRow>
                  ))}
                </MUI.TableBody>
              </MUI.Table>
            </MUI.TableContainer>
          </MUI.CardContent>
        </MUI.Card>
      )}

      {result && (
        <MUI.Alert severity="success" sx={{ borderRadius: 2 }}>
          ✓ {result.inserted} filas importadas correctamente.
        </MUI.Alert>
      )}
    </MUI.Stack>
  );
}

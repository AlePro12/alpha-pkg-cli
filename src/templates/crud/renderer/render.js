// CRUD renderer del paquete {keyName} — usa el componente nativo CardArchivo
//
// CardArchivo (Deps.ALPHA.CardArchivo) es el patrón estándar de archivo
// maestro en Alpha: selector de Codp con autocomplete + tabs con form +
// botones Nuevo/Eliminar/Guardar + atajos (Esc, Ctrl+S, Ctrl+G).
// Backend en index.js de este paquete provee los endpoints que espera.
//
// Una sola function __Module por archivo (gotcha #1). Helpers y subs adentro.

function __Module({ Deps }) {
  const React = Deps.React;
  const CardArchivo = Deps.ALPHA.CardArchivo;

  // Handler estándar de inputs — actualiza el estado interno del form.
  const InputChangeMaestro = (e, SetDataProd) => {
    SetDataProd((state) => ({ ...state, [e.target.name]: e.target.value }));
  };

  return (
    <CardArchivo
      Empresa="NONE"
      host="/pkgs/{keyName}/items/"
      hostSearch="/pkgs/{keyName}/items/"
      titleAllow
      Tabs={[
        { index: 0, label: "Datos" },
      ]}
      TabsContainer={[
        {
          Tab: 0,
          Content: [
            {
              input: {
                id: "Descripcion",
                label: "Descripción",
                type: "text",
                handleChange: InputChangeMaestro,
              },
            },
            {
              input: {
                id: "Cantidad",
                label: "Cantidad",
                type: "number",
                handleChange: InputChangeMaestro,
                stack: true,
              },
            },
          ],
        },
      ]}
      Campos={[
        { field: "Codp", headerName: "Código", width: 150 },
        { field: "Descripcion", headerName: "Descripción", width: 300 },
        { field: "Cantidad", headerName: "Cantidad", width: 120 },
      ]}
      data={{
        Codp: "",
        Descripcion: "",
        Cantidad: 0,
      }}
    />
  );
}

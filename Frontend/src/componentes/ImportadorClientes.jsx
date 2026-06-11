import { useState } from "react";
import * as XLSX from "xlsx";
import { normNombre, crearCliente } from "../utilidades/clientes";

// Detecta automáticamente qué columna puede ser nombre, teléfono, DNI, dirección
function detectarColumnas(headers) {
  const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const sugerencias = { nombre: null, telefono: null, dni: null, direccion: null };

  headers.forEach((h, i) => {
    const s = norm(h);
    if (sugerencias.nombre === null && (s.includes("nombre") || s.includes("titular") || s.includes("cliente") || s.includes("dueno") || s.includes("razon"))) sugerencias.nombre = i;
    if (sugerencias.telefono === null && (s.includes("tel") || s.includes("cel") || s.includes("fono") || s.includes("phone"))) sugerencias.telefono = i;
    if (sugerencias.dni === null && (s.includes("dni") || s.includes("documento") || s.includes("cuit") || s.includes("cuil"))) sugerencias.dni = i;
    if (sugerencias.direccion === null && (s.includes("direc") || s.includes("domicilio") || s.includes("calle"))) sugerencias.direccion = i;
  });

  return sugerencias;
}

export default function ImportadorClientes({ onImportar }) {
  const [mostrar, setMostrar] = useState(false);
  const [vista, setVista] = useState("idle"); // idle | mapeando | preview | importado
  const [headers, setHeaders] = useState([]);
  const [filas, setFilas] = useState([]);
  const [mapeo, setMapeo] = useState({ nombre: null, telefono: null, dni: null, direccion: null });
  const [preview, setPreview] = useState([]);
  const [resultado, setResultado] = useState(null);

  function leerArchivo(e) {
    const archivo = e.target.files[0];
    if (!archivo) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target.result, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const datos = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });

      // Buscar la primera fila que tenga al menos 2 celdas con contenido (encabezados)
      let iHeader = 0;
      for (let i = 0; i < Math.min(10, datos.length); i++) {
        const noVacias = datos[i].filter((c) => String(c).trim()).length;
        if (noVacias >= 2) { iHeader = i; break; }
      }

      const hdrs = datos[iHeader].map((h) => String(h).trim());
      let rows = datos.slice(iHeader + 1).filter((r) => r.some((c) => String(c).trim()));

      // Si es el formato de historial de services (col0=PATENTE, col1=TITULAR),
      // filtrar solo las filas que tienen patente en col0 para no tomar filas de continuación de service
      const esFormatoService =
        hdrs[0]?.toUpperCase().includes("PATENTE") &&
        hdrs[1]?.toUpperCase().includes("TITULAR");
      if (esFormatoService) {
        const PATRON_PATENTE = /^[A-Z]{2,3}[-\s]?\d{3}[-\s]?[A-Z]{0,2}$|^[A-Z]{3}[-\s]?\d{3}$|^[A-Z]{2,3}\d{3,4}[A-Z]{0,2}$/i;
        rows = rows.filter((r) => PATRON_PATENTE.test(String(r[0] || "").trim().replace(/\s/g, "")));
      }

      setHeaders(hdrs);
      setFilas(rows);
      setMapeo(detectarColumnas(hdrs));
      setVista("mapeando");
    };
    reader.readAsArrayBuffer(archivo);
  }

  function generarPreview() {
    if (mapeo.nombre === null) return;
    const prev = filas.slice(0, 6).map((r) => ({
      nombre: String(r[mapeo.nombre] || "").trim(),
      telefono: mapeo.telefono !== null ? String(r[mapeo.telefono] || "").trim() : "",
      dni: mapeo.dni !== null ? String(r[mapeo.dni] || "").trim() : "",
      direccion: mapeo.direccion !== null ? String(r[mapeo.direccion] || "").trim() : "",
    })).filter((c) => c.nombre);
    setPreview(prev);
    setVista("preview");
  }

  function importar() {
    const clientes = JSON.parse(localStorage.getItem("cuentasCorrientes") || "[]");
    const existentes = new Set(clientes.map((c) => normNombre(c.nombre)));

    let agregados = 0;
    let duplicados = 0;

    const nuevos = [];
    filas.forEach((r) => {
      const nombre = String(r[mapeo.nombre] || "").trim();
      if (!nombre) return;
      const norm = normNombre(nombre);
      if (existentes.has(norm)) { duplicados++; return; }
      existentes.add(norm);
      nuevos.push(crearCliente({
        nombre,
        telefono: mapeo.telefono !== null ? String(r[mapeo.telefono] || "").trim() : "",
        dni: mapeo.dni !== null ? String(r[mapeo.dni] || "").trim() : "",
        direccion: mapeo.direccion !== null ? String(r[mapeo.direccion] || "").trim() : "",
      }));
      agregados++;
    });

    const actualizados = [...clientes, ...nuevos];
    localStorage.setItem("cuentasCorrientes", JSON.stringify(actualizados));
    if (onImportar) onImportar(actualizados);

    setResultado({ agregados, duplicados });
    setVista("importado");
  }

  function cerrar() {
    setMostrar(false);
    setVista("idle");
    setHeaders([]);
    setFilas([]);
    setMapeo({ nombre: null, telefono: null, dni: null, direccion: null });
    setPreview([]);
    setResultado(null);
  }

  const opcionesCol = [
    { value: -1, label: "— No usar —" },
    ...headers.map((h, i) => ({ value: i, label: `Columna ${i + 1}: "${h}"` })),
  ];

  return (
    <>
      <button className="boton-guardar" onClick={() => setMostrar(true)}>
        📥 Importar clientes
      </button>

      {mostrar && (
        <div className="overlay-ingreso" onClick={cerrar}>
          <div className="modal-ingreso" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-ingreso-header">
              <h2>Importar clientes desde Excel</h2>
              <button className="boton-cerrar-modal" onClick={cerrar}>✕</button>
            </div>

            <div className="modal-ingreso-body">

              {vista === "idle" && (
                <>
                  <p style={{ marginBottom: 14, color: "#555", fontSize: "0.9rem" }}>
                    Podés importar desde cualquier Excel — la lista de services, una agenda, lo que sea. Elegís qué columna es el nombre y cuáles son opcionales.
                  </p>
                  <input type="file" accept=".xls,.xlsx" onChange={leerArchivo} className="input-caja" />
                </>
              )}

              {vista === "mapeando" && (
                <>
                  <p style={{ marginBottom: 14, color: "#555", fontSize: "0.9rem" }}>
                    Se detectaron <strong>{headers.length} columnas</strong> y <strong>{filas.length} filas</strong>. Indicá cuál corresponde a cada campo:
                  </p>

                  {[
                    { key: "nombre", label: "Nombre del cliente", requerido: true },
                    { key: "telefono", label: "Teléfono", requerido: false },
                    { key: "dni", label: "DNI / CUIT", requerido: false },
                    { key: "direccion", label: "Dirección", requerido: false },
                  ].map(({ key, label, requerido }) => (
                    <div key={key} className="campo-ingreso">
                      <label>{label} {requerido && <span style={{ color: "#ef4444" }}>*</span>}</label>
                      <select
                        className="input-caja"
                        value={mapeo[key] !== null ? mapeo[key] : -1}
                        onChange={(e) => setMapeo({ ...mapeo, [key]: Number(e.target.value) === -1 ? null : Number(e.target.value) })}
                      >
                        {opcionesCol.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  ))}

                  <button
                    className="boton-confirmar-caja"
                    style={{ marginTop: 8 }}
                    disabled={mapeo.nombre === null}
                    onClick={generarPreview}
                  >
                    Ver preview →
                  </button>
                </>
              )}

              {vista === "preview" && (
                <>
                  <p style={{ marginBottom: 10, color: "#555", fontSize: "0.9rem" }}>
                    Vista previa de los primeros registros:
                  </p>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", marginBottom: 16 }}>
                    <thead>
                      <tr style={{ background: "#f3f4f6" }}>
                        <th style={{ padding: "6px 8px", textAlign: "left" }}>Nombre</th>
                        {mapeo.telefono !== null && <th style={{ padding: "6px 8px", textAlign: "left" }}>Teléfono</th>}
                        {mapeo.dni !== null && <th style={{ padding: "6px 8px", textAlign: "left" }}>DNI</th>}
                        {mapeo.direccion !== null && <th style={{ padding: "6px 8px", textAlign: "left" }}>Dirección</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((c, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid #f0f0f0" }}>
                          <td style={{ padding: "5px 8px" }}>{c.nombre}</td>
                          {mapeo.telefono !== null && <td style={{ padding: "5px 8px" }}>{c.telefono}</td>}
                          {mapeo.dni !== null && <td style={{ padding: "5px 8px" }}>{c.dni}</td>}
                          {mapeo.direccion !== null && <td style={{ padding: "5px 8px" }}>{c.direccion}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p style={{ fontSize: "0.85rem", color: "#666", marginBottom: 12 }}>
                    Total a importar: <strong>{filas.filter((r) => String(r[mapeo.nombre] || "").trim()).length}</strong> clientes. Los duplicados se saltean automáticamente.
                  </p>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button className="boton-cancelar" onClick={() => setVista("mapeando")}>← Volver</button>
                    <button className="boton-confirmar-caja" onClick={importar}>Importar</button>
                  </div>
                </>
              )}

              {vista === "importado" && resultado && (
                <>
                  <div style={{ textAlign: "center", padding: "20px 0" }}>
                    <div style={{ fontSize: "2rem", marginBottom: 8 }}>✅</div>
                    <p style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: 6 }}>
                      {resultado.agregados} clientes importados
                    </p>
                    {resultado.duplicados > 0 && (
                      <p style={{ color: "#888", fontSize: "0.9rem" }}>
                        {resultado.duplicados} duplicados salteados
                      </p>
                    )}
                  </div>
                  <button className="boton-confirmar-caja" style={{ width: "100%" }} onClick={cerrar}>
                    Listo
                  </button>
                </>
              )}

            </div>
          </div>
        </div>
      )}
    </>
  );
}

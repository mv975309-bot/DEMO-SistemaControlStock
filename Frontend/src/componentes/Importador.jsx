import { useState } from "react";
import ReactDOM from "react-dom";
import * as XLSX from "xlsx";
import "../estilos/Importador.css";
import { detectarCategoria } from "../utilidades/categorias";
import { calcularPrecios } from "../utilidades/proveedores";
import { upsertProductos, upsertProveedores, getProveedores } from "../lib/db";

function Importador({ productos: productosActuales = [], onImportar, abierto, onCerrar }) {
  const [vista, setVista] = useState("idle"); // idle | mapeando | categorias | confirmando
  const [filas, setFilas] = useState([]);
  const [proveedor, setProveedor] = useState("");
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState("");
  const [categorias, setCategorias] = useState([]); // [{nombre, cantidad, seleccionada}]
  const [proveedoresGuardados, setProveedoresGuardados] = useState({});

  // Cargar proveedores desde Supabase al montar
  useState(() => {
    getProveedores().then((nombres) => {
      const mapa = {};
      nombres.forEach((n) => { mapa[n] = { nombre: n }; });
      setProveedoresGuardados(mapa);
    }).catch(() => {
      // fallback a localStorage
      const data = localStorage.getItem("proveedores");
      if (data) setProveedoresGuardados(JSON.parse(data));
    });
  });
  function leerArchivo(e) {
    const archivo = e.target.files[0];
    if (!archivo) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const workbook = XLSX.read(ev.target.result, { type: "array" });
      const hoja = workbook.Sheets[workbook.SheetNames[0]];
      const datos = XLSX.utils.sheet_to_json(hoja, { header: 1 });

        const filasProducto = [];
      let categoriaActual = "";
      let marcaActual = "";

      // Detectar formato ABC: header "CODIGO, CODIGO PROVEEDOR, DESCRIPCION, PRECIO DE LISTA"
      const esFormatoABC = datos.some(
        (f) => String(f[0] || "").trim() === "CODIGO" && String(f[2] || "").trim() === "DESCRIPCION"
      );

      if (esFormatoABC) {
        // Formato ABC: col0=código, col2=descripción, col3=precio, col6=RUBRO PADRE, col7=MARCA
        for (let i = 0; i < datos.length; i++) {
          const fila = datos[i];
          const col0 = String(fila[0] || "").trim();
          const col2 = String(fila[2] || "").trim();
          const col3 = String(fila[3] || "").trim();
          const col6 = String(fila[6] || "").trim(); // RUBRO PADRE (nombre legible)
          const col7 = String(fila[7] || "").trim(); // MARCA
          const pl = parseFloat(col3);

          if (!col0 || col0 === "CODIGO" || !col2 || !pl || pl <= 0) continue;

          // Categoría: primero el nombre del producto (más específico), luego el rubro del Excel
          const categoria = detectarCategoria(col2) || detectarCategoria(col6) || col6 || "Otros";

          const nombreTemp = proveedorSeleccionado || "";
          const { precioPublico: pp, precioMecanico: pm } = calcularPrecios(pl);

          filasProducto.push({
            codigo: col0,
            nombre: col2,
            categoria,
            precioLista: pl,
            precioPublico: pp,
            precioMecanico: pm,
            marca: col7 || proveedorSeleccionado || proveedor, // MARCA real del producto
            stock: 0,
            stockMinimo: 3,
          });
        }
      } else {
        // Formato Robra/Maine/Impocar y otros: código en col1, nombre en col2, precio en col4
        for (let i = 0; i < datos.length; i++) {
          const fila = datos[i];

          // Fila de categoría/marca: col0 tiene texto, col1 vacía
          if (
            fila[0] &&
            typeof fila[0] === "string" &&
            !fila[1] &&
            fila[0].length > 3 &&
            !fila[0].includes("PRECIO") &&
            !fila[0].includes("LISTA") &&
            !fila[0].includes("IVA") &&
            !fila[0].includes("Emitida") &&
            !fila[0].includes("AVISO") &&
            !fila[0].includes("---")
          ) {
            const partes = fila[0].split("-");
            const textoCategoria =
              partes.length > 1 ? partes.slice(1).join("-").trim() : fila[0].trim();
            categoriaActual = detectarCategoria(textoCategoria) || textoCategoria;

            // Extraer marca: primera palabra del texto de categoría (ej: "ERCIF", "MASTERFILT", "PURFLUX")
            const primeraPalabra = textoCategoria.split(/\s+/)[0];
            if (primeraPalabra && primeraPalabra.length > 2 && !/^\d+$/.test(primeraPalabra)) {
              marcaActual = primeraPalabra;
            }
          }

          // Fila de producto: col1=código, col2=nombre, col4=precio (número o string numérico)
          const col1 = String(fila[1] || "").trim();
          const col2 = String(fila[2] || "").trim();
          const pl = parseFloat(fila[4]);

          if (
            col1 &&
            col2 &&
            pl > 0 &&
            col1 !== "CODIGO" &&
            !col1.includes("---")
          ) {
            const nombreTemp = proveedorSeleccionado || "";
            const { precioPublico: pp, precioMecanico: pm } = calcularPrecios(pl);

            filasProducto.push({
              codigo: col1,
              nombre: col2,
              categoria: categoriaActual,
              precioLista: pl,
              precioPublico: pp,
              precioMecanico: pm,
              marca: marcaActual || proveedorSeleccionado || proveedor,
              stock: 0,
              stockMinimo: 3,
            });
          }
        }
      }
      
      const mapaFilas = {};
      filasProducto.forEach((f) => {
        mapaFilas[f.codigo] = f;
      });
      const filasUnicas = Object.values(mapaFilas);
      setFilas(filasUnicas);

      // Construir lista de categorías únicas con conteo y ejemplo
      const mapaCats = {};
      filasUnicas.forEach((f) => {
        const cat = f.categoria || "(Sin categoría)";
        if (!mapaCats[cat]) mapaCats[cat] = { nombre: cat, cantidad: 0, seleccionada: true, ejemplo: f.nombre };
        mapaCats[cat].cantidad++;
      });
      const catsOrdenadas = Object.values(mapaCats).sort((a, b) =>
        a.nombre.localeCompare(b.nombre)
      );
      setCategorias(catsOrdenadas);

      if (proveedorSeleccionado && proveedoresGuardados[proveedorSeleccionado]) {
        // Ya conocemos el proveedor — ir a categorías si hay muchos productos
        setVista(filasUnicas.length > 500 ? "categorias" : "confirmando");
      } else {
        setVista("mapeando");
      }
    };

    reader.readAsArrayBuffer(archivo);
  }

  function guardarYImportar() {
    if (!proveedor.trim()) return;

    const nuevosProveedores = {
      ...proveedoresGuardados,
      [proveedor]: { nombre: proveedor },
    };
    setProveedoresGuardados(nuevosProveedores);
    upsertProveedores([proveedor]).catch(console.error);

    // Si hay muchos productos, mostrar selector de categorías antes de importar
    if (filas.length > 500) {
      setVista("categorias");
    } else {
      importar();
    }
  }

  // Filas filtradas por categorías seleccionadas
  function filasSeleccionadas() {
    const catsActivas = new Set(
      categorias.filter((c) => c.seleccionada).map((c) => c.nombre)
    );
    return filas.filter((f) => catsActivas.has(f.categoria || "(Sin categoría)"));
  }

  function toggleCategoria(nombre) {
    setCategorias((prev) =>
      prev.map((c) => (c.nombre === nombre ? { ...c, seleccionada: !c.seleccionada } : c))
    );
  }

  function toggleTodas(valor) {
    setCategorias((prev) => prev.map((c) => ({ ...c, seleccionada: valor })));
  }

  async function importar() {
    try {
      const productosExistentes = productosActuales;
      const nombreProveedor = proveedor || proveedorSeleccionado;

      const mapaExistentes = {};
      productosExistentes.forEach((p) => {
        const cod = String(p.codigo || "").trim();
        if (cod) mapaExistentes[cod] = p;
      });

      let agregados = 0;
      let actualizados = 0;

      // Usar filas filtradas por categorías si venimos del paso de selección
      const filasAImportar = categorias.length > 0 ? filasSeleccionadas() : filas;

      filasAImportar.forEach((fila) => {
        const codigoNorm = String(fila.codigo || "").trim();
        if (!codigoNorm) return;

        const { precioPublico, precioMecanico } = calcularPrecios(fila.precioLista);

        const filaFinal = {
          ...fila,
          marca: fila.marca || nombreProveedor,
          precioPublico,
          precioMecanico,
        };

        if (mapaExistentes[codigoNorm]) {
          mapaExistentes[codigoNorm] = {
            ...mapaExistentes[codigoNorm],
            precioLista: filaFinal.precioLista,
            precioPublico: filaFinal.precioPublico,
            precioMecanico: filaFinal.precioMecanico,
            marca: filaFinal.marca || mapaExistentes[codigoNorm].marca,
            proveedor: nombreProveedor || mapaExistentes[codigoNorm].proveedor,
          };
          actualizados++;
        } else {
          mapaExistentes[codigoNorm] = {
            id: crypto.randomUUID(),
            ...filaFinal,
            proveedor: nombreProveedor,
          };
          agregados++;
        }
      });

      const productosFinales = Object.values(mapaExistentes);

      // Solo upsertear los que vienen del Excel, deduplicados por id Y por codigo
      const codigosImportados = new Set(filasAImportar.map(f => String(f.codigo||"").trim()));
      const vistosId = new Set();
      const vistosCod = new Set();
      const paraSubir = productosFinales.filter(p => {
        if (!codigosImportados.has(String(p.codigo||"").trim())) return false;
        const kid = String(p.id);
        const kcod = String(p.codigo||"").trim();
        if (vistosId.has(kid) || vistosCod.has(kcod)) return false;
        vistosId.add(kid);
        vistosCod.add(kcod);
        return true;
      });

      try {
        await upsertProductos(paraSubir);
      } catch (err) {
        alert("❌ Error guardando en Supabase: " + err.message);
        return;
      }

      // Guardar proveedor en Supabase
      if (nombreProveedor) {
        await upsertProveedores([nombreProveedor]).catch(console.error);
      }

      onImportar(productosFinales);

      alert(`✅ Importación completa:\n${agregados} productos nuevos\n${actualizados} precios actualizados`);
      cerrar();
    } catch (err) {
      console.error("Error en importar:", err);
      alert(`❌ Error al importar: ${err.message}`);
    }
  }

  function cerrar() {
    setVista("idle");
    setFilas([]);
    setProveedor("");
    setProveedorSeleccionado("");
    setCategorias([]);
    onCerrar?.();
  }

  return (
    <>
      {abierto && ReactDOM.createPortal(
        <div className="importador-overlay" onClick={cerrar}>
          <div className="importador-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, flex: 1 }}>Importar lista de precios</h2>
              <button onClick={cerrar} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#6b7280", lineHeight: 1, padding: "0 0 0 16px", flexShrink: 0 }}>✕</button>
            </div>

            {vista === "idle" && (
              <div className="importador-body">
                {Object.keys(proveedoresGuardados).length > 0 && (
                  <div className="importador-seccion">
                    <p className="importador-label">¿Es de un proveedor ya configurado?</p>
                    <select
                      className="input-producto"
                      value={proveedorSeleccionado}
                      onChange={(e) => setProveedorSeleccionado(e.target.value)}
                    >
                      <option value="">Nuevo proveedor</option>
                      {Object.keys(proveedoresGuardados).map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="importador-seccion">
                  <p className="importador-label">Seleccioná el archivo Excel</p>
                  <input
                    type="file"
                    accept=".xls,.xlsx"
                    onChange={leerArchivo}
                    className="input-archivo"
                  />
                </div>
              </div>
            )}

            {vista === "mapeando" && (
              <div className="importador-body">
                <p className="importador-exito">
                  ✅ Se detectaron <strong>{filas.length} productos</strong>
                </p>
                <div className="importador-seccion">
                  <p className="importador-label">Nombre del proveedor</p>
                  <input
                    type="text"
                    placeholder="Ej: ERCIF, Motorex, etc."
                    value={proveedor}
                    onChange={(e) => setProveedor(e.target.value)}
                    className="input-producto"
                  />
                </div>
                <div className="importador-preview">
                  <p className="importador-label">Vista previa (primeros 5):</p>
                  <table className="tabla-preview">
                    <thead>
                      <tr>
                        <th>Código</th>
                        <th>Nombre</th>
                        <th>Categoría</th>
                        <th>P. Lista</th>
                        <th>P. Público</th>
                        <th>P. Mecánico</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filas.slice(0, 5).map((f, i) => (
                        <tr key={i}>
                          <td>{f.codigo}</td>
                          <td>{f.nombre}</td>
                          <td>{f.categoria}</td>
                          <td>${f.precioLista}</td>
                          <td>${f.precioPublico}</td>
                          <td>${f.precioMecanico}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  onClick={guardarYImportar}
                  className="boton-guardar"
                  disabled={!proveedor.trim()}
                >
                  Guardar proveedor e importar
                </button>
              </div>
            )}

            {vista === "categorias" && (
              <div className="importador-body">
                <p className="importador-exito">
                  ✅ <strong>{filas.length} productos</strong> detectados en{" "}
                  <strong>{categorias.length} categorías</strong>
                </p>
                <p className="importador-label" style={{ margin: "10px 0 6px" }}>
                  Seleccioná qué categorías importar:
                </p>

                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <button className="boton-guardar" style={{ fontSize: 12, padding: "4px 10px" }}
                    onClick={() => toggleTodas(true)}>Marcar todas</button>
                  <button className="boton-guardar" style={{ fontSize: 12, padding: "4px 10px", background: "#6b7280" }}
                    onClick={() => toggleTodas(false)}>Desmarcar todas</button>
                  <span style={{ marginLeft: "auto", fontSize: 13, color: "#6b7280", alignSelf: "center" }}>
                    {filasSeleccionadas().length} productos seleccionados
                  </span>
                </div>

                <div style={{ maxHeight: 320, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
                  {categorias.map((cat) => (
                    <label key={cat.nombre} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "8px 12px", borderBottom: "1px solid #f3f4f6",
                      cursor: "pointer", background: cat.seleccionada ? "#f0fdf4" : "white"
                    }}>
                      <input type="checkbox" checked={cat.seleccionada}
                        onChange={() => toggleCategoria(cat.nombre)} />
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{cat.nombre}</span>
                        {cat.ejemplo && cat.ejemplo !== cat.nombre && (
                          <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 8 }}>
                            ej: {cat.ejemplo.slice(0, 40)}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: 12, color: "#9ca3af", whiteSpace: "nowrap" }}>{cat.cantidad} prod.</span>
                    </label>
                  ))}
                </div>

                <button
                  onClick={importar}
                  className="boton-guardar"
                  style={{ marginTop: 14 }}
                  disabled={filasSeleccionadas().length === 0}
                >
                  Importar {filasSeleccionadas().length} productos
                </button>
              </div>
            )}

            {vista === "confirmando" && (
              <div className="importador-body">
                <p className="importador-exito">
                  ✅ Se detectaron <strong>{filas.length} productos</strong> de{" "}
                  <strong>{proveedorSeleccionado}</strong>
                </p>
                <p className="importador-label">
                  Los precios existentes se actualizarán automáticamente.
                </p>
                <button onClick={() => setVista("categorias")} className="boton-guardar"
                  style={{ background: "#6b7280", marginBottom: 8 }}>
                  Filtrar por categorías
                </button>
                <button onClick={importar} className="boton-guardar">
                  Importar todo ({filas.length} productos)
                </button>
              </div>
            )}
          </div>
        </div>
      , document.body)}
    </>
  );
}

export default Importador;
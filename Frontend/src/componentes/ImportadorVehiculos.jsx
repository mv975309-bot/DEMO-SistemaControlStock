import { useState } from "react";
import * as XLSX from "xlsx";
import "../estilos/ImportadorVehiculos.css";
import { normNombre, buscarClientePorNombre, crearCliente } from "../utilidades/clientes";

function excelFechaALocal(valor) {
  if (!valor) return "-";
  if (typeof valor === "string" && valor.includes("/")) return valor;
  if (typeof valor === "number") {
    const fecha = new Date(Math.round((valor - 25569) * 86400 * 1000));
    // Compensar offset de zona horaria para que no muestre el día anterior
    const fechaLocal = new Date(fecha.getTime() + fecha.getTimezoneOffset() * 60000);
    return fechaLocal.toLocaleDateString("es-AR");
  }
  return String(valor);
}

const ES_PATENTE = /^[A-Z]{2,3}[-\s]?\d{3}[-\s]?[A-Z]{0,2}$|^[A-Z]{3}[-\s]?\d{3}$|^[A-Z]{2,3}\d{3,4}[A-Z]{0,2}$/i;

function esPatente(str) {
  return str && ES_PATENTE.test(str.replace(/\s/g, ""));
}

function ImportadorVehiculos({ onImportar }) {
  const [mostrar, setMostrar] = useState(false);
  const [vista, setVista] = useState("idle");
  const [preview, setPreview] = useState([]);
  const [rawData, setRawData] = useState([]);

  function leerArchivo(e) {
    const archivo = e.target.files[0];
    if (!archivo) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const workbook = XLSX.read(ev.target.result, { type: "array" });
      const hoja = workbook.Sheets[workbook.SheetNames[0]];
      const datos = XLSX.utils.sheet_to_json(hoja, { header: 1, raw: true });
      const resultado = parsearExcel(datos);
      setRawData(resultado);
      setPreview(resultado.slice(0, 5));
      setVista("confirmando");
    };
    reader.readAsArrayBuffer(archivo);
  }

  function parsearExcel(datos) {
    // mapaPatentes agrupa todas las filas de la misma patente
    const mapaPatentes = {};
    const ordenPatentes = [];
    let vehiculoActual = null;

    for (let i = 0; i < datos.length; i++) {
      const fila = datos[i];
      if (!fila || fila.length === 0) continue;
      const col0 = String(fila[0] || "").trim();

      if (col0 === "PATENTE" || col0.includes("Control") || col0.includes("CAMBIO")) continue;
      if (!col0 && !vehiculoActual) continue;

      if (esPatente(col0)) {
        const patente = col0.toUpperCase();
        const titular = normNombre(String(fila[1] || "").trim());
        const modelo  = normNombre(String(fila[2] || "").trim());
        const telefono = String(fila[4] || "").trim();

        if (!mapaPatentes[patente]) {
          mapaPatentes[patente] = { patente, modelo, titulares: [], services: [] };
          ordenPatentes.push(patente);
        }

        vehiculoActual = mapaPatentes[patente];

        // Agregar titular si es distinto al último registrado
        if (titular) {
          const ultimo = vehiculoActual.titulares[vehiculoActual.titulares.length - 1];
          if (!ultimo || normNombre(ultimo.nombre) !== titular) {
            vehiculoActual.titulares.push({ nombre: titular, telefono });
          }
        }

        // Service en la misma fila
        const km = fila[3];
        const fecha = fila[5];
        if (fecha) {
          vehiculoActual.services.push({
            kilometraje: km ? String(km).trim() : "-",
            fecha: excelFechaALocal(fecha),
            aceite: String(fila[6] || "-").trim(),
            litros: String(fila[7] || "-").trim(),
            filtroAceite: String(fila[8] || "-").trim(),
            filtroAire: String(fila[9] || "-").trim(),
            filtroCombustible: String(fila[10] || "-").trim(),
            filtroHabitaculo: String(fila[11] || "-").trim(),
            observaciones: String(fila[12] || "").trim(),
          });
        }
      } else if (vehiculoActual) {
        // Fila de continuación: puede tener titular en col1 (cambio de dueño)
        const titularCol1 = normNombre(String(fila[1] || "").trim());
        if (titularCol1) {
          const ultimo = vehiculoActual.titulares[vehiculoActual.titulares.length - 1];
          if (!ultimo || normNombre(ultimo.nombre) !== titularCol1) {
            vehiculoActual.titulares.push({ nombre: titularCol1, telefono: String(fila[4] || "").trim() });
          }
        }

        const fecha = fila[5];
        if (!fecha) continue;

        vehiculoActual.services.push({
          kilometraje: fila[3] ? String(fila[3]).trim() : "-",
          fecha: excelFechaALocal(fecha),
          aceite: String(fila[6] || "-").trim(),
          litros: String(fila[7] || "-").trim(),
          filtroAceite: String(fila[8] || "-").trim(),
          filtroAire: String(fila[9] || "-").trim(),
          filtroCombustible: String(fila[10] || "-").trim(),
          filtroHabitaculo: String(fila[11] || "-").trim(),
          observaciones: String(fila[12] || "").trim(),
        });
      }
    }

    return ordenPatentes.map((p) => mapaPatentes[p]);
  }

  function importar() {
    const vehiculosExistentes = JSON.parse(localStorage.getItem("vehiculos") || "[]");
    const servicesExistentes  = JSON.parse(localStorage.getItem("services") || "[]");
    const cuentasExistentes   = JSON.parse(localStorage.getItem("cuentasCorrientes") || "[]");

    const mapaVehiculos = {};
    vehiculosExistentes.forEach((v) => {
      mapaVehiculos[v.patente.toUpperCase().trim()] = v;
    });

    // Mapa mutable de clientes para buscar/crear durante la importación
    const cuentasMutable = [...cuentasExistentes];

    function obtenerOCrearCliente(nombre, telefono) {
      if (!nombre || nombre === "-") return null;
      let c = buscarClientePorNombre(cuentasMutable, nombre);
      if (!c) {
        c = crearCliente({ nombre, telefono: telefono && telefono !== "-" ? telefono : "" });
        cuentasMutable.push(c);
      }
      return c;
    }

    const nuevosServices = [...servicesExistentes];
    let vehiculosAgregados = 0;
    let servicesAgregados = 0;
    const hoy = new Date().toLocaleDateString("es-AR");

    rawData.forEach((vehiculo) => {
      const patente = vehiculo.patente.toUpperCase().trim();

      if (!mapaVehiculos[patente]) {
        // Vehículo nuevo: construir historialDuenos desde los titulares
        const titulares = vehiculo.titulares; // [{nombre, telefono}]
        const historialDuenos = [];
        let clienteIdActual = null;

        titulares.forEach((t, idx) => {
          const cliente = obtenerOCrearCliente(t.nombre, t.telefono);
          if (!cliente) return;
          const esUltimo = idx === titulares.length - 1;
          historialDuenos.push({
            clienteId: cliente.id,
            nombre: cliente.nombre,
            desde: hoy,
            hasta: esUltimo ? null : hoy,
          });
          if (esUltimo) clienteIdActual = cliente.id;
        });

        mapaVehiculos[patente] = {
          id: Date.now() + Math.random(),
          patente,
          modelo: vehiculo.modelo,
          clienteId: clienteIdActual,
          historialDuenos,
          // dueno legacy para compatibilidad
          dueno: titulares.length > 0 ? titulares[titulares.length - 1].nombre : "",
        };
        vehiculosAgregados++;
      } else {
        // Vehículo ya existente: agregar nuevos titulares al historial si aparecen
        const v = mapaVehiculos[patente];
        vehiculo.titulares.forEach((t, idx) => {
          const cliente = obtenerOCrearCliente(t.nombre, t.telefono);
          if (!cliente) return;
          const yaEnHistorial = (v.historialDuenos || []).some((h) => h.clienteId === cliente.id);
          if (!yaEnHistorial) {
            (v.historialDuenos = v.historialDuenos || []).push({
              clienteId: cliente.id,
              nombre: cliente.nombre,
              desde: hoy,
              hasta: idx === vehiculo.titulares.length - 1 ? null : hoy,
            });
          }
          // El último siempre es el propietario actual
          if (idx === vehiculo.titulares.length - 1) {
            v.clienteId = cliente.id;
            v.dueno = cliente.nombre;
          }
        });
      }

      const vehiculoId = mapaVehiculos[patente].id;
      vehiculo.services.forEach((s) => {
        nuevosServices.push({
          id: Date.now() + Math.random(),
          vehiculoId,
          fecha: s.fecha,
          kilometraje: s.kilometraje,
          aceite: s.aceite !== "-" ? `${s.aceite}${s.litros !== "-" ? ` (${s.litros}L)` : ""}` : "-",
          filtroAceite: s.filtroAceite,
          filtroAire: s.filtroAire,
          filtroCombustible: s.filtroCombustible,
          filtroHabitaculo: s.filtroHabitaculo,
          observaciones: s.observaciones,
        });
        servicesAgregados++;
      });
    });

    const vehiculosFinales = Object.values(mapaVehiculos);
    const clientesNuevos = cuentasMutable.length - cuentasExistentes.length;

    localStorage.setItem("vehiculos", JSON.stringify(vehiculosFinales));
    localStorage.setItem("services", JSON.stringify(nuevosServices));
    localStorage.setItem("cuentasCorrientes", JSON.stringify(cuentasMutable));
    onImportar(vehiculosFinales, nuevosServices);

    alert(`✅ Importación completa:\n${vehiculosAgregados} vehículos nuevos\n${servicesAgregados} services importados\n${clientesNuevos} clientes creados`);
    cerrar();
  }

  function cerrar() {
    setMostrar(false);
    setVista("idle");
    setPreview([]);
    setRawData([]);
  }

  return (
    <div>
      <button onClick={() => setMostrar(true)} className="boton-importar-vehiculos">
        📥 Importar Excel
      </button>

      {mostrar && (
        <div className="importador-overlay">
          <div className="importador-modal">
            <div className="importador-header">
              <h2>Importar historial de services</h2>
              <button onClick={cerrar} className="importador-cerrar">✖</button>
            </div>

            {vista === "idle" && (
              <div className="importador-body">
                <p className="importador-label">Seleccioná el archivo Excel de Luscher HNOS</p>
                <input type="file" accept=".xls,.xlsx" onChange={leerArchivo} className="input-archivo" />
              </div>
            )}

            {vista === "confirmando" && (
              <div className="importador-body">
                <p className="importador-exito">
                  ✅ Se detectaron <strong>{rawData.length} vehículos</strong> con un total de{" "}
                  <strong>{rawData.reduce((acc, v) => acc + v.services.length, 0)} services</strong>
                </p>
                <p style={{ fontSize: "0.85rem", color: "#6b7280", marginTop: 6 }}>
                  {rawData.filter((v) => v.titulares.length > 1).length} vehículos con más de un dueño registrado
                </p>

                <p className="importador-label" style={{ marginTop: 16 }}>Vista previa (primeros 5 vehículos):</p>

                <div className="preview-vehiculos">
                  {preview.map((v, i) => (
                    <div key={i} className="preview-vehiculo-card">
                      <div className="preview-vehiculo-header">
                        <strong>{v.patente}</strong>
                        <span>{v.modelo}</span>
                        <span>
                          {v.titulares.length > 0
                            ? v.titulares[v.titulares.length - 1].nombre
                            : "Sin titular"}
                          {v.titulares.length > 1 && (
                            <span style={{ fontSize: "0.75rem", color: "#f59e0b", marginLeft: 6 }}>
                              ({v.titulares.length} dueños)
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="preview-services-count">
                        {v.services.length} service{v.services.length !== 1 ? "s" : ""}
                        {v.services.length > 0 && (
                          <span className="preview-ultimo">
                            — Último: {v.services[v.services.length - 1].fecha} ({v.services[v.services.length - 1].kilometraje} km)
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <button onClick={importar} className="boton-guardar" style={{ marginTop: 20 }}>
                  Confirmar importación
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ImportadorVehiculos;

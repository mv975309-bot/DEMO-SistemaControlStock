import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../estilos/Vehiculos.css";
import ImportadorVehiculos from "../componentes/ImportadorVehiculos";
import { migrarDuenosAClienteId, normNombre } from "../utilidades/clientes";
import { getClientes, upsertCliente, upsertClientes, getVehiculos, upsertVehiculo, upsertVehiculos, deleteVehiculo, getServices, upsertService, upsertServices, deleteService, getPresupuestos, upsertPresupuesto, upsertTurno, getProductos } from "../lib/db";
import InputProductoCategoria from "../componentes/InputProductoCategoria";

function norm(str) {
  return (str || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function Vehiculos() {
  const navigate = useNavigate();

  const [clientes, setClientes] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [services, setServices] = useState([]);
  const [productos, setProductos] = useState([]);
  const [catalogoProductos, setCatalogoProductos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [presupuestos, setPresupuestos] = useState([]);

  useEffect(() => {
    Promise.all([getClientes(), getVehiculos(), getServices(), getPresupuestos(), getProductos()])
      .then(([cs, vs, ss, ps, prods]) => {
        setClientes(cs);
        setVehiculos(vs);
        setServices(ss);
        setPresupuestos(ps);
        setCatalogoProductos(prods);
        setCargando(false);
      })
      .catch(console.error);
  }, []);

  // Migración automática al montar: dueno texto → clienteId
  useEffect(() => {
    const sinMigrar = vehiculos.some((v) => !v.clienteId && v.dueno && v.dueno !== "-");
    if (!sinMigrar) return;
    const { vehiculosActualizados, clientesActualizados, stats } = migrarDuenosAClienteId(vehiculos, clientes);
    setVehiculos(vehiculosActualizados);
    setClientes(clientesActualizados);
    upsertVehiculos(vehiculosActualizados).catch(console.error);
    upsertClientes(clientesActualizados).catch(console.error);
    if (stats.creados > 0) console.log(`Migración: ${stats.matcheados} matcheados, ${stats.creados} clientes creados`);
  }, []);

  const [presupuestoVinculado, setPresupuestoVinculado] = useState(null);
  const [alertasStock, setAlertasStock] = useState({});

  // Estados formulario vehiculo
  const [mostrarFormVehiculo, setMostrarFormVehiculo] = useState(false);
  const [patente, setPatente] = useState("");
  const [clienteIdNuevo, setClienteIdNuevo] = useState("");
  const [busquedaClienteNuevo, setBusquedaClienteNuevo] = useState("");
  const [modelo, setModelo] = useState("");

  // Modal cambiar dueño
  const [modalCambiarDueno, setModalCambiarDueno] = useState(false);
  const [busquedaNuevoDueno, setBusquedaNuevoDueno] = useState("");
  const [clienteIdNuevoDueno, setClienteIdNuevoDueno] = useState("");

  // Estados formulario service
  const [vehiculoSeleccionado, setVehiculoSeleccionado] = useState(null);
  const [mostrarFormService, setMostrarFormService] = useState(false);
  const [fecha, setFecha] = useState(new Date().toLocaleDateString("es-AR"));
  const [kilometraje, setKilometraje] = useState("");
  const [aceite, setAceite] = useState("");
  const [filtroAceite, setFiltroAceite] = useState("");
  const [filtroAire, setFiltroAire] = useState("");
  const [filtroCombustible, setFiltroCombustible] = useState("");
  const [filtroHabitaculo, setFiltroHabitaculo] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [manoDeObra, setManoDeObra] = useState("");
  const [proximoService, setProximoService] = useState("");

  // Modal agendar turno
  const [modalAgenda, setModalAgenda] = useState(false);
  const [agendaTurnoGuardado, setAgendaTurnoGuardado] = useState(null);
  const [agendaFecha, setAgendaFecha] = useState("");
  const [agendaHora, setAgendaHora] = useState("");
  const [agendaTipo, setAgendaTipo] = useState("");
  const [agendaTipoOtro, setAgendaTipoOtro] = useState("");

  const TIPOS_SERVICE_AGENDA = [
    "Cambio de aceite y filtros",
    "Revisión general",
    "Frenos",
    "Correa de distribución",
    "Embrague",
    "Suspensión",
    "Alineación y balanceo",
    "Batería",
    "Otro",
  ];

  function abrirModalAgenda() {
    const hoy = new Date().toISOString().split("T")[0];
    setAgendaFecha(hoy);
    setAgendaHora("");
    setAgendaTipo("");
    setAgendaTipoOtro("");
    setModalAgenda(true);
  }

  function guardarTurnoAgenda(e) {
    e.preventDefault();
    if (!agendaFecha || !agendaHora || !agendaTipo) return;
    const tipoFinal = agendaTipo === "Otro" ? agendaTipoOtro.trim() || "Otro" : agendaTipo;
    const cliente = mapaClientes[vehiculoSeleccionado.clienteId];
    const nuevo = {
      id: Date.now(),
      vehiculoId: vehiculoSeleccionado.id,
      patente: vehiculoSeleccionado.patente,
      dueno: cliente?.nombre || vehiculoSeleccionado.dueno || "",
      modelo: vehiculoSeleccionado.modelo || "",
      fecha: agendaFecha,
      hora: agendaHora,
      tipoService: tipoFinal,
      estado: "pendiente",
    };
    upsertTurno(nuevo).catch(console.error);
    setAgendaTurnoGuardado(nuevo);
  }

  // Busqueda
  const [busqueda, setBusqueda] = useState("");
  const [busquedaActiva, setBusquedaActiva] = useState("");
  const [fechaFiltro, setFechaFiltro] = useState(""); // yyyy-mm-dd

  const listaRef = useRef(null);

  // Resetear scroll de la lista cuando cambia la búsqueda activa
  useEffect(() => {
    if (listaRef.current) listaRef.current.scrollTop = 0;
  }, [busquedaActiva]);

  function ejecutarBusqueda() {
    setBusquedaActiva(busqueda.trim());
  }

  // Al abrir el form de service, buscar presupuesto pendiente para ese vehículo
  useEffect(() => {
    if (!mostrarFormService || !vehiculoSeleccionado) {
      setPresupuestoVinculado(null);
      setAlertasStock({});
      return;
    }

    const pendientes = presupuestos
      .filter((p) => p.vehiculoId === vehiculoSeleccionado.id && p.estado === "pendiente")
      .sort((a, b) => b.id - a.id);

    if (pendientes.length === 0) {
      setPresupuestoVinculado(null);
      setAlertasStock({});
      return;
    }

    const pres = pendientes[0];
    setPresupuestoVinculado(pres);

    const alertas = {};
    const CAMPOS = [
      { key: "aceite", setter: setAceite },
      { key: "filtroAceite", setter: setFiltroAceite },
      { key: "filtroAire", setter: setFiltroAire },
      { key: "filtroCombustible", setter: setFiltroCombustible },
      { key: "filtroHabitaculo", setter: setFiltroHabitaculo },
    ];

    CAMPOS.forEach(({ key, setter }) => {
      const campo = pres.camposService?.[key];
      if (!campo) return;
      const prod = productos.find((p) => p.id === campo.productoId);
      if (!prod || Number(prod.stock || 0) <= 0) {
        // Sin stock: no pre-cargar, guardar hint
        alertas[key] = { nombre: campo.nombre, codigo: campo.codigo };
      } else {
        // Con stock: pre-cargar con el código del producto
        setter(campo.codigo || campo.nombre || "");
      }
    });

    setAlertasStock(alertas);
  }, [mostrarFormService, vehiculoSeleccionado]);

  function agregarVehiculo(e) {
    e.preventDefault();
    if (!patente.trim()) return;

    const existe = vehiculos.find(
      (v) => v.patente.toLowerCase() === patente.toLowerCase().trim()
    );
    if (existe) {
      alert("Ya existe un vehículo con esa patente.");
      return;
    }

    const clienteVinculado = clientes.find((c) => c.id === Number(clienteIdNuevo));
    const nuevo = {
      id: Date.now(),
      patente: patente.toUpperCase().trim(),
      modelo: modelo.trim(),
      clienteId: clienteVinculado ? clienteVinculado.id : null,
      historialDuenos: clienteVinculado ? [{
        clienteId: clienteVinculado.id,
        nombre: clienteVinculado.nombre,
        desde: new Date().toLocaleDateString("es-AR"),
        hasta: null,
      }] : [],
    };

    setVehiculos([...vehiculos, nuevo]);
    upsertVehiculo(nuevo).catch(console.error);
    setPatente("");
    setClienteIdNuevo("");
    setBusquedaClienteNuevo("");
    setModelo("");
    setMostrarFormVehiculo(false);
  }

  function cambiarDueno() {
    if (!vehiculoSeleccionado || !clienteIdNuevoDueno) return;
    const nuevoCliente = clientes.find((c) => c.id === Number(clienteIdNuevoDueno));
    if (!nuevoCliente) return;

    const hoy = new Date().toLocaleDateString("es-AR");
    const historialActualizado = (vehiculoSeleccionado.historialDuenos || []).map((h) =>
      h.hasta === null ? { ...h, hasta: hoy } : h
    );
    historialActualizado.push({ clienteId: nuevoCliente.id, nombre: nuevoCliente.nombre, desde: hoy, hasta: null });

    const vehiculoActualizado = { ...vehiculoSeleccionado, clienteId: nuevoCliente.id, historialDuenos: historialActualizado };
    const actualizados = vehiculos.map((v) =>
      v.id === vehiculoSeleccionado.id ? vehiculoActualizado : v
    );
    setVehiculos(actualizados);
    upsertVehiculo(vehiculoActualizado).catch(console.error);
    setVehiculoSeleccionado(vehiculoActualizado);
    setModalCambiarDueno(false);
    setBusquedaNuevoDueno("");
    setClienteIdNuevoDueno("");
  }

  function agregarService(e) {
    e.preventDefault();
    if (!vehiculoSeleccionado) return;

    const nuevoService = {
      id: Date.now(),
      vehiculoId: vehiculoSeleccionado.id,
      fecha,
      kilometraje,
      aceite: aceite.trim() || "-",
      filtroAceite: filtroAceite.trim() || "-",
      filtroAire: filtroAire.trim() || "-",
      filtroCombustible: filtroCombustible.trim() || "-",
      filtroHabitaculo: filtroHabitaculo.trim() || "-",
      observaciones: observaciones.trim(),
      manoDeObra: manoDeObra || "",
      proximoService: proximoService.trim(),
    };

    setServices([nuevoService, ...services]);
    upsertService(nuevoService).catch(console.error);

    // Imprimir la orden de servicio
    imprimirService({
      vehiculo: vehiculoSeleccionado,
      fecha,
      kilometraje,
      aceite: aceite.trim() || "-",
      filtroAceite: filtroAceite.trim() || "-",
      filtroAire: filtroAire.trim() || "-",
      filtroCombustible: filtroCombustible.trim() || "-",
      filtroHabitaculo: filtroHabitaculo.trim() || "-",
      observaciones: observaciones.trim(),
      manoDeObra,
      proximoService: proximoService.trim(),
      presupuesto: presupuestoVinculado,
      productosLista: productos,
    });

    // Cerrar el presupuesto vinculado si existe
    if (presupuestoVinculado) {
      const presupuestoCerrado = { ...presupuestoVinculado, estado: "cerrado" };
      setPresupuestos(presupuestos.map((p) =>
        p.id === presupuestoVinculado.id ? presupuestoCerrado : p
      ));
      upsertPresupuesto(presupuestoCerrado).catch(console.error);
    }

    limpiarFormService();
  }

  function limpiarFormService() {
    setFecha(new Date().toLocaleDateString("es-AR"));
    setKilometraje("");
    setAceite("");
    setFiltroAceite("");
    setFiltroAire("");
    setFiltroCombustible("");
    setFiltroHabitaculo("");
    setObservaciones("");
    setManoDeObra("");
    setProximoService("");
    setPresupuestoVinculado(null);
    setAlertasStock({});
    setMostrarFormService(false);
  }

  function imprimirService({ vehiculo, fecha, kilometraje, aceite, filtroAceite, filtroAire, filtroCombustible, filtroHabitaculo, observaciones, manoDeObra, proximoService, presupuesto, productosLista }) {
    function formatPrecio(n) {
      return Number(n || 0).toLocaleString("es-AR", { minimumFractionDigits: 0 });
    }

    function getPrecioYDetalle(campoTexto, key) {
      // Si hay presupuesto con ese campo, usar sus datos
      if (presupuesto?.camposService?.[key]) {
        const c = presupuesto.camposService[key];
        const cant = key === "aceite" ? (presupuesto.cantidadAceite || 1) : 1;
        const detalle = key === "aceite"
          ? `${cant}L. ${c.nombre}`
          : `${c.codigo ? c.codigo + " - " : ""}${c.nombre}`;
        return { detalle, monto: (c.precio || 0) * cant };
      }
      // Sin presupuesto: buscar por código en catálogo
      if (!campoTexto || campoTexto === "-") return { detalle: "", monto: 0 };
      const prod = productosLista.find(
        (p) => (p.codigo || "").toLowerCase() === campoTexto.toLowerCase().trim()
      );
      return {
        detalle: prod ? prod.nombre : campoTexto,
        monto: prod ? Number(prod.precioPublico || 0) : 0,
      };
    }

    const aceiteInfo    = getPrecioYDetalle(aceite, "aceite");
    const fAceiteInfo   = getPrecioYDetalle(filtroAceite, "filtroAceite");
    const fAireInfo     = getPrecioYDetalle(filtroAire, "filtroAire");
    const fCombInfo     = getPrecioYDetalle(filtroCombustible, "filtroCombustible");
    const fHabitInfo    = getPrecioYDetalle(filtroHabitaculo, "filtroHabitaculo");
    const mdo           = Number(manoDeObra || 0);

    // Otros ítems del presupuesto
    const otrosItems = presupuesto?.otrosItems || [];

    const totalItems =
      aceiteInfo.monto + fAceiteInfo.monto + fAireInfo.monto +
      fCombInfo.monto + fHabitInfo.monto +
      otrosItems.reduce((a, i) => a + i.precio * i.cantidad, 0) + mdo;

    function filaProducto(label, detalle, monto) {
      return `<tr>
        <td class="col-prod">${label}</td>
        <td class="col-det">${detalle || ""}</td>
        <td class="col-monto">${monto > 0 ? "$" + formatPrecio(monto) : ""}</td>
      </tr>`;
    }

    const filasOtros = otrosItems.map((i) =>
      filaProducto("Otros", `${i.nombre} x${i.cantidad}`, i.precio * i.cantidad)
    ).join("") || filaProducto("Otros", "", 0);

    function buildOrden() {
      return `
      <div class="orden">
        <div class="encabezado">
          <div class="empresa">
            <div class="empresa-nombre">MI EMPRESA</div>
            <div class="empresa-sub"></div>
            <div class="empresa-sub"></div>
          </div>
          <div class="titulo-fecha">
            <div class="titulo">ORDEN DE SERVICIO</div>
            <div class="fecha-val">${fecha}</div>
          </div>
        </div>

        <table class="datos-cliente">
          <tr><td class="dc-label">CLIENTE</td><td class="dc-val">${mapaClientes[vehiculo.clienteId]?.nombre || vehiculo.dueno || ""}</td></tr>
          <tr><td class="dc-label">VEHÍCULO</td><td class="dc-val">${vehiculo.modelo || ""} — ${vehiculo.patente || ""}</td></tr>
          <tr><td class="dc-label">KILÓMETROS</td><td class="dc-val">${kilometraje || ""}</td></tr>
          ${proximoService ? `<tr><td class="dc-label">PRÓX. SERVICE</td><td class="dc-val">${proximoService}</td></tr>` : ""}
        </table>

        <table class="tabla-items">
          <thead>
            <tr><th class="col-prod">Producto</th><th class="col-det">Detalle</th><th class="col-monto">Monto</th></tr>
          </thead>
          <tbody>
            ${filaProducto("Aceite de motor", aceiteInfo.detalle, aceiteInfo.monto)}
            ${filaProducto("Filtro de Aceite", fAceiteInfo.detalle, fAceiteInfo.monto)}
            ${filaProducto("Filtro de Aire", fAireInfo.detalle, fAireInfo.monto)}
            ${filaProducto("Filtro de Combustible", fCombInfo.detalle, fCombInfo.monto)}
            ${filaProducto("Filtro de Habitáculo", fHabitInfo.detalle, fHabitInfo.monto)}
            ${filasOtros}
            ${filaProducto("Mano de obra", "", mdo)}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="2" class="total-label">TOTAL</td>
              <td class="total-monto">$${formatPrecio(totalItems)}</td>
            </tr>
          </tfoot>
        </table>

        <div class="observaciones-row">
          <span class="obs-label">Observaciones:</span>
          <span class="obs-val">${observaciones || ""}</span>
        </div>

        <div class="gracias">GRACIAS POR CONFIAR EN NOSOTROS</div>
      </div>`;
    }

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Orden de Servicio</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: A4 portrait; margin: 8mm; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #111; }

    .pagina { display: flex; flex-direction: column; height: 277mm; }

    .orden {
      flex: 1;
      border: 1.5px solid #333;
      padding: 8px 10px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .orden + .orden {
      margin-top: 4px;
      border-top: 2px dashed #aaa;
    }

    /* Encabezado */
    .encabezado { display: flex; justify-content: space-between; align-items: flex-start; }
    .empresa-nombre { font-size: 15px; font-weight: 800; letter-spacing: .03em; }
    .empresa-sub { font-size: 10px; color: #555; margin-top: 1px; }
    .titulo { font-size: 14px; font-weight: 700; text-align: right; }
    .fecha-val { font-size: 11px; text-align: right; color: #444; margin-top: 3px; }

    /* Datos cliente */
    .datos-cliente { width: 100%; border-collapse: collapse; margin-top: 2px; }
    .datos-cliente tr { border-bottom: 1px solid #e5e7eb; }
    .dc-label { font-weight: 700; font-size: 10px; text-transform: uppercase; color: #555; padding: 3px 6px 3px 0; width: 110px; }
    .dc-val { font-size: 11px; padding: 3px 0; }

    /* Tabla items */
    .tabla-items { width: 100%; border-collapse: collapse; margin-top: 4px; }
    .tabla-items th { background: #f3f4f6; padding: 4px 6px; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; border-bottom: 1.5px solid #d1d5db; text-align: left; }
    .tabla-items td { padding: 3px 6px; border-bottom: 1px solid #f0f0f0; }
    .col-prod { width: 130px; font-weight: 500; }
    .col-det { }
    .col-monto { width: 80px; text-align: right; font-weight: 500; }
    tfoot td { border-top: 1.5px solid #374151; border-bottom: none; padding-top: 5px; font-weight: 700; }
    .total-label { text-align: right; font-size: 12px; }
    .total-monto { text-align: right; font-size: 13px; }

    /* Observaciones */
    .observaciones-row { font-size: 10px; color: #555; min-height: 16px; }
    .obs-label { font-weight: 700; margin-right: 4px; }

    /* Pie */
    .gracias { text-align: center; font-size: 10px; color: #888; letter-spacing: .05em; margin-top: auto; padding-top: 4px; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="pagina">
    ${buildOrden()}
    ${buildOrden()}
  </div>
</body>
</html>`;

    const ventana = window.open("", "_blank");
    ventana.document.write(html);
    ventana.document.close();
    ventana.focus();
    // Esperar a que el contenido esté listo antes de imprimir
    if (ventana.document.readyState === "complete") {
      ventana.print();
    } else {
      let impreso = false;
      const doPrint = () => { if (!impreso) { impreso = true; ventana.print(); } };
      ventana.onload = doPrint;
      setTimeout(doPrint, 1500);
    }
  }

  function eliminarVehiculo(id) {
    if (!window.confirm("¿Seguro que querés eliminar este vehículo y todos sus services?")) return;
    const servicesToDelete = services.filter((s) => s.vehiculoId === id);
    setVehiculos(vehiculos.filter((v) => v.id !== id));
    setServices(services.filter((s) => s.vehiculoId !== id));
    deleteVehiculo(id).catch(console.error);
    servicesToDelete.forEach((s) => deleteService(s.id).catch(console.error));
    if (vehiculoSeleccionado?.id === id) setVehiculoSeleccionado(null);
  }

  const MAX_SIN_BUSQUEDA = 50;
  const textoBusqueda = norm(busquedaActiva);

  // Mapa clienteId → nombre para mostrar en lista
  const mapaClientes = Object.fromEntries(clientes.map((c) => [c.id, c]));

  // Convertir yyyy-mm-dd al formato es-AR sin ceros adelante (igual que toLocaleDateString)
  const fechaFiltroLocal = fechaFiltro
    ? (() => {
        const [y, m, d] = fechaFiltro.split("-").map(Number);
        return new Date(y, m - 1, d).toLocaleDateString("es-AR");
      })()
    : "";

  // IDs de vehículos con service en la fecha buscada
  const vehiculosConFecha = fechaFiltroLocal
    ? new Set(services.filter((s) => s.fecha === fechaFiltroLocal).map((s) => s.vehiculoId))
    : null;

  const vehiculosFiltrados = (textoBusqueda || vehiculosConFecha)
    ? vehiculos.filter((v) => {
        if (vehiculosConFecha && !vehiculosConFecha.has(v.id)) return false;
        if (!textoBusqueda) return true;
        const clienteNombreV = norm(mapaClientes[v.clienteId]?.nombre || v.dueno || "");
        return (
          norm(v.patente).includes(textoBusqueda) ||
          clienteNombreV.includes(textoBusqueda) ||
          norm(v.modelo).includes(textoBusqueda)
        );
      })
    : vehiculos.slice(-MAX_SIN_BUSQUEDA).reverse();

  const servicesDelVehiculo = vehiculoSeleccionado
    ? services.filter((s) => s.vehiculoId === vehiculoSeleccionado.id)
    : [];

  if (cargando) return <div style={{padding:40, textAlign:"center", color:"#6b7280"}}>Cargando...</div>;

  return (
    <div className="contenedor-vehiculos">
        <div className="header-vehiculos">
            <h1>Vehículos y Service</h1>
            <div style={{ display: "flex", gap: "10px" }}>
                <ImportadorVehiculos onImportar={(vehiculos, services) => {
                    setVehiculos(vehiculos);
                    setServices(services);
                    upsertVehiculos(vehiculos).catch(console.error);
                    upsertServices(services).catch(console.error);
                }} />
            <button onClick={() => setMostrarFormVehiculo(!mostrarFormVehiculo)}
                className="boton-guardar">
                {mostrarFormVehiculo ? "Cerrar" : "Nuevo vehículo"}
            </button>
            </div>
        </div>

      {mostrarFormVehiculo && (
        <form onSubmit={agregarVehiculo} className="formulario-vehiculo">
          <input
            type="text"
            placeholder="Patente"
            value={patente}
            onChange={(e) => setPatente(e.target.value)}
            className="input-producto"
            required
          />
          <div style={{ position: "relative" }}>
            <input
              type="text"
              placeholder="Buscar cliente (dueño)..."
              value={busquedaClienteNuevo}
              onChange={(e) => { setBusquedaClienteNuevo(e.target.value); setClienteIdNuevo(""); }}
              className="input-producto"
              style={{ margin: 0 }}
            />
            {busquedaClienteNuevo && !clienteIdNuevo && (
              <ul style={{ position: "absolute", zIndex: 100, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6, width: "100%", maxHeight: 180, overflowY: "auto", margin: 0, padding: 0, listStyle: "none" }}>
                {clientes.filter((c) => norm(c.nombre).includes(norm(busquedaClienteNuevo))).slice(0, 8).map((c) => (
                  <li key={c.id} style={{ padding: "7px 12px", cursor: "pointer" }}
                    onClick={() => { setClienteIdNuevo(c.id); setBusquedaClienteNuevo(c.nombre); }}>
                    {c.nombre}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <input
            type="text"
            placeholder="Modelo (ej: Ford Focus 2015)"
            value={modelo}
            onChange={(e) => setModelo(e.target.value)}
            className="input-producto"
          />
          <button type="submit" className="boton-guardar">
            Guardar vehículo
          </button>
        </form>
      )}

      <div className="layout-vehiculos">
        {/* Lista de vehiculos */}
        <div className="panel-vehiculos">
          <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
            <input
              type="text"
              placeholder="Buscar por patente, dueño o modelo..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") ejecutarBusqueda(); }}
              className="input-producto"
              style={{ margin: 0, flex: 1 }}
            />
            <button onClick={ejecutarBusqueda} className="boton-guardar" style={{ whiteSpace: "nowrap" }}>
              Buscar
            </button>
          </div>
          <div style={{ display: "flex", gap: "8px", marginBottom: "12px", alignItems: "center" }}>
            <input
              type="date"
              value={fechaFiltro}
              onChange={(e) => setFechaFiltro(e.target.value)}
              className="input-producto"
              style={{ margin: 0, flex: 1 }}
            />
            {fechaFiltro && (
              <button
                onClick={() => setFechaFiltro("")}
                className="boton-cancelar"
                style={{ whiteSpace: "nowrap" }}
              >
                ✕ Limpiar fecha
              </button>
            )}
          </div>

          <p className="sin-datos" style={{ marginBottom: "8px", fontSize: "0.85rem" }}>
            {(textoBusqueda || fechaFiltroLocal)
              ? `${vehiculosFiltrados.length} resultado${vehiculosFiltrados.length !== 1 ? "s" : ""} de ${vehiculos.length}`
              : `Últimos ${vehiculosFiltrados.length} de ${vehiculos.length} vehículos`}
          </p>

          {vehiculosFiltrados.length === 0 ? (
            <p className="sin-datos">No se encontraron vehículos.</p>
          ) : (
            <div className="lista-vehiculos" ref={listaRef}>
              {vehiculosFiltrados.map((v) => {
                const cantServices = services.filter((s) => s.vehiculoId === v.id).length;
                const seleccionado = vehiculoSeleccionado?.id === v.id;
                return (
                  <div
                    key={v.id}
                    className={`tarjeta-vehiculo ${seleccionado ? "vehiculo-activo" : ""}`}
                    onClick={() => {
                      setVehiculoSeleccionado(v);
                      setMostrarFormService(false);
                    }}
                  >
                    <div className="vehiculo-info">
                      <span className="vehiculo-patente">{v.patente}</span>
                      <span className="vehiculo-modelo">{v.modelo}</span>
                      <span className="vehiculo-dueno">
                        {mapaClientes[v.clienteId]?.nombre || v.dueno || "Sin dueño"}
                      </span>
                      <span className="vehiculo-services">{cantServices} service{cantServices !== 1 ? "s" : ""}</span>
                    </div>
                    <button
                      className="boton-eliminar-vehiculo"
                      onClick={(e) => { e.stopPropagation(); eliminarVehiculo(v.id); }}
                    >
                      ✖
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Panel de services */}
        <div className="panel-services">
          {!vehiculoSeleccionado ? (
            <div className="sin-datos">Seleccioná un vehículo para ver sus services.</div>
          ) : (
            <>
              <div className="header-services">
                <div>
                  <h2>{vehiculoSeleccionado.patente} — {vehiculoSeleccionado.modelo}</h2>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                    <p className="vehiculo-dueno-header">
                      {mapaClientes[vehiculoSeleccionado.clienteId]?.nombre || vehiculoSeleccionado.dueno || "Sin dueño"}
                    </p>
                    <button
                      type="button"
                      onClick={() => { setModalCambiarDueno(true); setBusquedaNuevoDueno(""); setClienteIdNuevoDueno(""); }}
                      style={{ fontSize: "0.75rem", padding: "2px 8px", background: "#f3f4f6", border: "1px solid #d1d5db", borderRadius: 4, cursor: "pointer", color: "#374151" }}
                    >
                      Cambiar dueño
                    </button>
                  </div>
                  {/* Historial de dueños */}
                  {(vehiculoSeleccionado.historialDuenos || []).length > 1 && (
                    <details style={{ marginTop: 4 }}>
                      <summary style={{ fontSize: "0.78rem", color: "#6b7280", cursor: "pointer" }}>
                        Historial de dueños ({vehiculoSeleccionado.historialDuenos.length})
                      </summary>
                      <ul style={{ margin: "4px 0 0 12px", padding: 0, listStyle: "none", fontSize: "0.78rem", color: "#6b7280" }}>
                        {[...vehiculoSeleccionado.historialDuenos].reverse().map((h, i) => (
                          <li key={i}>
                            {h.nombre} — desde {h.desde}{h.hasta ? ` hasta ${h.hasta}` : " (actual)"}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={abrirModalAgenda}
                    style={{ background: "#eef2ff", border: "1px solid #c7d2fe", color: "#4f46e5", borderRadius: 6, padding: "6px 12px", cursor: "pointer", fontSize: "0.85rem", fontWeight: 600 }}
                  >
                    📅 Agendar turno
                  </button>
                  <button
                    onClick={() => setMostrarFormService(!mostrarFormService)}
                    className="boton-guardar"
                  >
                    {mostrarFormService ? "Cancelar" : "Nuevo service"}
                  </button>
                </div>
              </div>

              {mostrarFormService && (
                <form onSubmit={agregarService} className="formulario-service">
                  {presupuestoVinculado && (
                    <div className="banner-presupuesto-vinculado">
                      📋 Presupuesto pendiente vinculado: <strong>{presupuestoVinculado.clienteNombre}</strong>
                      {Object.keys(alertasStock).length > 0 && (
                        <span className="banner-sin-stock">
                          {" "}· {Object.keys(alertasStock).length} producto{Object.keys(alertasStock).length > 1 ? "s" : ""} sin stock — completá vos esos campos
                        </span>
                      )}
                    </div>
                  )}
                  <div className="service-fila">
                    <div className="service-campo">
                      <label>Fecha</label>
                      <input type="text" value={fecha}
                        onChange={(e) => setFecha(e.target.value)}
                        className="input-producto" />
                    </div>
                    <div className="service-campo">
                      <label>Kilometraje</label>
                      <input type="number" placeholder="Km"
                        value={kilometraje}
                        onChange={(e) => setKilometraje(e.target.value)}
                        className="input-producto" />
                    </div>
                  </div>

                  <div className="service-fila">
                    <div className="service-campo">
                      <label>Aceite {alertasStock.aceite && <span className="hint-sin-stock">sin stock — era: {alertasStock.aceite.codigo || alertasStock.aceite.nombre}</span>}</label>
                      <InputProductoCategoria
                        value={aceite}
                        onChange={(e) => setAceite(e.target.value)}
                        productos={catalogoProductos}
                        categorias={["Aceites"]}
                        placeholder={alertasStock.aceite ? `Elegí reemplazo (era: ${alertasStock.aceite.codigo || alertasStock.aceite.nombre})` : "Código o marca"}
                        className={`input-producto${alertasStock.aceite ? " input-sin-stock" : ""}`} />
                    </div>
                    <div className="service-campo">
                      <label>Filtro aceite {alertasStock.filtroAceite && <span className="hint-sin-stock">sin stock — era: {alertasStock.filtroAceite.codigo || alertasStock.filtroAceite.nombre}</span>}</label>
                      <InputProductoCategoria
                        value={filtroAceite}
                        onChange={(e) => setFiltroAceite(e.target.value)}
                        productos={catalogoProductos}
                        categorias={["Filtros aceite"]}
                        placeholder={alertasStock.filtroAceite ? `Elegí reemplazo (era: ${alertasStock.filtroAceite.codigo || alertasStock.filtroAceite.nombre})` : "Código"}
                        className={`input-producto${alertasStock.filtroAceite ? " input-sin-stock" : ""}`} />
                    </div>
                  </div>

                  <div className="service-fila">
                    <div className="service-campo">
                      <label>Filtro aire {alertasStock.filtroAire && <span className="hint-sin-stock">sin stock — era: {alertasStock.filtroAire.codigo || alertasStock.filtroAire.nombre}</span>}</label>
                      <InputProductoCategoria
                        value={filtroAire}
                        onChange={(e) => setFiltroAire(e.target.value)}
                        productos={catalogoProductos}
                        categorias={["Filtros aire"]}
                        placeholder={alertasStock.filtroAire ? `Elegí reemplazo (era: ${alertasStock.filtroAire.codigo || alertasStock.filtroAire.nombre})` : "Código"}
                        className={`input-producto${alertasStock.filtroAire ? " input-sin-stock" : ""}`} />
                    </div>
                    <div className="service-campo">
                      <label>Filtro combustible {alertasStock.filtroCombustible && <span className="hint-sin-stock">sin stock — era: {alertasStock.filtroCombustible.codigo || alertasStock.filtroCombustible.nombre}</span>}</label>
                      <InputProductoCategoria
                        value={filtroCombustible}
                        onChange={(e) => setFiltroCombustible(e.target.value)}
                        productos={catalogoProductos}
                        categorias={["Filtros combustible"]}
                        placeholder={alertasStock.filtroCombustible ? `Elegí reemplazo (era: ${alertasStock.filtroCombustible.codigo || alertasStock.filtroCombustible.nombre})` : "Código"}
                        className={`input-producto${alertasStock.filtroCombustible ? " input-sin-stock" : ""}`} />
                    </div>
                  </div>

                  <div className="service-fila">
                    <div className="service-campo">
                      <label>Filtro habitáculo {alertasStock.filtroHabitaculo && <span className="hint-sin-stock">sin stock — era: {alertasStock.filtroHabitaculo.codigo || alertasStock.filtroHabitaculo.nombre}</span>}</label>
                      <InputProductoCategoria
                        value={filtroHabitaculo}
                        onChange={(e) => setFiltroHabitaculo(e.target.value)}
                        productos={catalogoProductos}
                        categorias={["Filtros habitáculo"]}
                        placeholder={alertasStock.filtroHabitaculo ? `Elegí reemplazo (era: ${alertasStock.filtroHabitaculo.codigo || alertasStock.filtroHabitaculo.nombre})` : "Código"}
                        className={`input-producto${alertasStock.filtroHabitaculo ? " input-sin-stock" : ""}`} />
                    </div>
                    <div className="service-campo">
                      <label>Mano de obra ($)</label>
                      <input type="number" placeholder="Opcional"
                        value={manoDeObra}
                        onChange={(e) => setManoDeObra(e.target.value)}
                        className="input-producto" />
                    </div>
                  </div>

                  <div className="service-fila">
                    <div className="service-campo">
                      <label>Observaciones</label>
                      <input type="text" placeholder="Opcional"
                        value={observaciones}
                        onChange={(e) => setObservaciones(e.target.value)}
                        className="input-producto" />
                    </div>
                    <div className="service-campo">
                      <label>Próximo service</label>
                      <input type="text" placeholder="Ej: 310.000 km o jun/2026"
                        value={proximoService}
                        onChange={(e) => setProximoService(e.target.value)}
                        className="input-producto" />
                    </div>
                  </div>

                  <button type="submit" className="boton-guardar">
                    Guardar service
                  </button>
                </form>
              )}

              {servicesDelVehiculo.length === 0 ? (
                <p className="sin-datos" style={{ marginTop: "20px" }}>
                  Este vehículo no tiene services registrados.
                </p>
              ) : (
                <div className="tabla-wrapper" style={{ marginTop: "20px" }}>
                  <table className="tabla-services">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Km</th>
                        <th>Aceite</th>
                        <th>F. Aceite</th>
                        <th>F. Aire</th>
                        <th>F. Combustible</th>
                        <th>F. Habitáculo</th>
                        <th>Observaciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {servicesDelVehiculo.map((s) => (
                        <tr key={s.id}>
                          <td>{s.fecha}</td>
                          <td>{s.kilometraje}</td>
                          <td>{s.aceite}</td>
                          <td>{s.filtroAceite}</td>
                          <td>{s.filtroAire}</td>
                          <td>{s.filtroCombustible}</td>
                          <td>{s.filtroHabitaculo}</td>
                          <td>{s.observaciones || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal cambiar dueño */}
      {modalCambiarDueno && vehiculoSeleccionado && (
        <div className="overlay-ingreso" onClick={() => setModalCambiarDueno(false)}>
          <div className="modal-ingreso" onClick={(e) => e.stopPropagation()}>
            <div className="modal-ingreso-header">
              <h2>Cambiar dueño</h2>
              <button className="boton-cerrar-modal" onClick={() => setModalCambiarDueno(false)}>✕</button>
            </div>
            <div className="modal-ingreso-body">
              <p style={{ marginBottom: 12, color: "#666", fontSize: "0.9rem" }}>
                Vehículo: <strong>{vehiculoSeleccionado.patente} — {vehiculoSeleccionado.modelo}</strong>
                <br />Dueño actual: <strong>{mapaClientes[vehiculoSeleccionado.clienteId]?.nombre || vehiculoSeleccionado.dueno || "Sin dueño"}</strong>
              </p>
              <div className="campo-ingreso" style={{ position: "relative" }}>
                <label>Nuevo dueño</label>
                <input
                  type="text"
                  className="input-caja"
                  placeholder="Buscar cliente..."
                  value={busquedaNuevoDueno}
                  onChange={(e) => { setBusquedaNuevoDueno(e.target.value); setClienteIdNuevoDueno(""); }}
                />
                {busquedaNuevoDueno && !clienteIdNuevoDueno && (
                  <ul style={{ position: "absolute", zIndex: 100, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6, width: "100%", maxHeight: 180, overflowY: "auto", margin: 0, padding: 0, listStyle: "none" }}>
                    {clientes.filter((c) => norm(c.nombre).includes(norm(busquedaNuevoDueno))).slice(0, 8).map((c) => (
                      <li key={c.id} style={{ padding: "7px 12px", cursor: "pointer" }}
                        onClick={() => { setClienteIdNuevoDueno(c.id); setBusquedaNuevoDueno(c.nombre); }}>
                        {c.nombre}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <button className="boton-cancelar" onClick={() => setModalCambiarDueno(false)}>Cancelar</button>
                <button className="boton-confirmar-caja" disabled={!clienteIdNuevoDueno} onClick={cambiarDueno}>
                  Confirmar cambio
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal agendar turno */}
      {modalAgenda && vehiculoSeleccionado && (
        <div className="overlay-ingreso" onClick={() => { setModalAgenda(false); setAgendaTurnoGuardado(null); }}>
          <div className="modal-ingreso" onClick={(e) => e.stopPropagation()}>
            <div className="modal-ingreso-header">
              <h2>{agendaTurnoGuardado ? "Turno guardado" : "Agendar turno"}</h2>
              <button className="boton-cerrar-modal" onClick={() => { setModalAgenda(false); setAgendaTurnoGuardado(null); }}>✕</button>
            </div>

            {agendaTurnoGuardado ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "20px 0 8px" }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#d1fae5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", color: "#059669", fontWeight: 700 }}>✓</div>
                <p style={{ margin: 0, fontWeight: 700, color: "#111827" }}>
                  {agendaTurnoGuardado.patente} — {agendaTurnoGuardado.hora}
                </p>
                <p style={{ margin: 0, color: "#6b7280", fontSize: "0.9rem" }}>{agendaTurnoGuardado.tipoService}</p>
                <p style={{ margin: "8px 0 0", color: "#374151", fontSize: "0.95rem" }}>¿Querés crear un presupuesto para este turno?</p>
                <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                  <button className="boton-cancelar" onClick={() => { setModalAgenda(false); setAgendaTurnoGuardado(null); }}>No, cerrar</button>
                  <button
                    className="boton-confirmar-caja"
                    onClick={() => {
                      setModalAgenda(false);
                      setAgendaTurnoGuardado(null);
                      navigate("/presupuestos", {
                        state: {
                          desdeAgenda: true,
                          vehiculoId: vehiculoSeleccionado.id,
                          clienteId: vehiculoSeleccionado.clienteId || null,
                        },
                      });
                    }}
                  >
                    Sí, crear presupuesto →
                  </button>
                </div>
              </div>
            ) : (
            <form onSubmit={guardarTurnoAgenda}>
              <div className="modal-ingreso-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <p style={{ margin: 0, color: "#666", fontSize: "0.9rem" }}>
                  Vehículo: <strong>{vehiculoSeleccionado.patente} — {vehiculoSeleccionado.modelo}</strong>
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className="campo-ingreso">
                    <label>Fecha</label>
                    <input
                      type="date"
                      className="input-caja"
                      value={agendaFecha}
                      onChange={(e) => setAgendaFecha(e.target.value)}
                      required
                    />
                  </div>
                                    <div className="campo-ingreso">
                    <label>Turno</label>
                    <div className="toggle-turno">
                      <button type="button"
                        className={agendaHora === "Mañana" ? "toggle-turno-activo" : ""}
                        onClick={() => setAgendaHora("Mañana")}>
                        Mañana
                      </button>
                      <button type="button"
                        className={agendaHora === "Tarde" ? "toggle-turno-activo" : ""}
                        onClick={() => setAgendaHora("Tarde")}>
                        Tarde
                      </button>
                    </div>
                  </div>
                </div>
                <div className="campo-ingreso">
                  <label>Tipo de service</label>
                  <select
                    className="input-caja"
                    value={agendaTipo}
                    onChange={(e) => setAgendaTipo(e.target.value)}
                    required
                  >
                    <option value="">Selección...</option>
                    {TIPOS_SERVICE_AGENDA.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                {agendaTipo === "Otro" && (
                  <div className="campo-ingreso">
                    <label>Describir</label>
                    <input
                      type="text"
                      className="input-caja"
                      placeholder="Ej: Cambio de correas"
                      value={agendaTipoOtro}
                      onChange={(e) => setAgendaTipoOtro(e.target.value)}
                    />
                  </div>
                )}
                <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                  <button type="button" className="boton-cancelar" onClick={() => { setModalAgenda(false); setAgendaTurnoGuardado(null); }}>Cancelar</button>
                  <button type="submit" className="boton-confirmar-caja">
                    Guardar turno
                  </button>
                </div>
              </div>
            </form>
            )}
          </div>
        </div>
      )}

      {/* Modal cambiar dueño */}
      {modalCambiarDueno && vehiculoSeleccionado && (
        <div className="overlay-ingreso" onClick={() => setModalCambiarDueno(false)}>
          <div className="modal-ingreso" onClick={(e) => e.stopPropagation()}>
            <div className="modal-ingreso-header">
              <h2>Cambiar dueño</h2>
              <button className="boton-cerrar-modal" onClick={() => setModalCambiarDueno(false)}>X</button>
            </div>
            <div className="modal-ingreso-body">
              <p style={{ marginBottom: 12, color: "#666", fontSize: "0.9rem" }}>
                Vehiculo: <strong>{vehiculoSeleccionado.patente} - {vehiculoSeleccionado.modelo}</strong>
                <br />Dueno actual: <strong>{mapaClientes[vehiculoSeleccionado.clienteId]?.nombre || vehiculoSeleccionado.dueno || "Sin dueno"}</strong>
              </p>
              <div className="campo-ingreso" style={{ position: "relative" }}>
                <label>Nuevo dueno</label>
                <input
                  type="text"
                  className="input-caja"
                  placeholder="Buscar cliente..."
                  value={busquedaNuevoDueno}
                  onChange={(e) => { setBusquedaNuevoDueno(e.target.value); setClienteIdNuevoDueno(""); }}
                />
                {busquedaNuevoDueno && !clienteIdNuevoDueno && (
                  <ul style={{ position: "absolute", zIndex: 100, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6, width: "100%", maxHeight: 180, overflowY: "auto", margin: 0, padding: 0, listStyle: "none" }}>
                    {clientes.filter((c) => norm(c.nombre).includes(norm(busquedaNuevoDueno))).slice(0, 8).map((c) => (
                      <li key={c.id} style={{ padding: "7px 12px", cursor: "pointer" }}
                        onClick={() => { setClienteIdNuevoDueno(c.id); setBusquedaNuevoDueno(c.nombre); }}>
                        {c.nombre}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <button className="boton-cancelar" onClick={() => setModalCambiarDueno(false)}>Cancelar</button>
                <button className="boton-confirmar-caja" disabled={!clienteIdNuevoDueno} onClick={cambiarDueno}>
                  Confirmar cambio
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Vehiculos;

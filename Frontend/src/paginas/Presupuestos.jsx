import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "../estilos/Presupuestos.css";
import { getPresupuestos, upsertPresupuesto, deletePresupuesto, getClientes, getVehiculos, getProductos } from "../lib/db";

function sinAcentos(str) {
  return (str || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function norm(s) {
  return (s || "").toUpperCase().replace(/[-\s]/g, "").trim();
}

function fechaHoy() {
  return new Date().toLocaleDateString("es-AR");
}

function formatPrecio(n) {
  return `$${Number(n).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function imprimirPresupuesto(p, camposService) {
  const filas = CAMPOS_SERVICE.map((c) => {
    const campo = p.camposService?.[c.key];
    if (!campo) return "";
    const cant = c.key === "aceite" ? (p.cantidadAceite || 1) : 1;
    return `
      <tr>
        <td>${c.label}</td>
        <td>${campo.codigo || ""}</td>
        <td>${campo.nombre}</td>
        <td style="text-align:center">${cant}</td>
        <td style="text-align:right">${formatPrecio(campo.precio)}</td>
        <td style="text-align:right">${formatPrecio(campo.precio * cant)}</td>
      </tr>`;
  }).join("");

  const filasOtros = (p.otrosItems || []).map((item) => `
    <tr>
      <td>Otros</td>
      <td>${item.codigo || ""}</td>
      <td>${item.nombre}</td>
      <td style="text-align:center">${item.cantidad}</td>
      <td style="text-align:right">${formatPrecio(item.precio)}</td>
      <td style="text-align:right">${formatPrecio(item.precio * item.cantidad)}</td>
    </tr>`).join("");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Presupuesto</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 13px; color: #111; padding: 32px; }
    .encabezado { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; }
    .empresa h1 { font-size: 22px; font-weight: 700; }
    .empresa p { color: #555; font-size: 12px; margin-top: 2px; }
    .pres-info { text-align: right; }
    .pres-info h2 { font-size: 18px; font-weight: 700; color: #2563eb; }
    .pres-info p { color: #555; font-size: 12px; margin-top: 2px; }
    .datos { display: flex; gap: 40px; background: #f9fafb; border-radius: 8px; padding: 14px 18px; margin-bottom: 24px; }
    .dato label { font-size: 10px; text-transform: uppercase; letter-spacing: .05em; color: #888; font-weight: 700; display: block; margin-bottom: 3px; }
    .dato span { font-size: 13px; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th { background: #f3f4f6; padding: 9px 10px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; border-bottom: 2px solid #e5e7eb; }
    td { padding: 9px 10px; border-bottom: 1px solid #f3f4f6; }
    tfoot td { border-top: 2px solid #e5e7eb; border-bottom: none; font-weight: 700; padding-top: 12px; font-size: 14px; }
    .obs { margin-top: 16px; background: #f9fafb; border-radius: 6px; padding: 12px 14px; font-size: 12px; color: #555; }
    .pie { margin-top: 40px; text-align: center; font-size: 11px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="encabezado">
    <div class="empresa">
      <h1>Lüscher Hnos.</h1>
      <p>Lubricentro y service automotor</p>
    </div>
    <div class="pres-info">
      <h2>Presupuesto</h2>
      <p>Fecha: ${p.fecha}</p>
    </div>
  </div>

  <div class="datos">
    <div class="dato"><label>Cliente</label><span>${p.clienteNombre}</span></div>
    <div class="dato"><label>Vehículo</label><span>${p.vehiculoPatente} — ${p.vehiculoModelo}</span></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Ítem</th><th>Código</th><th>Descripción</th><th style="text-align:center">Cant.</th>
        <th style="text-align:right">Precio unit.</th><th style="text-align:right">Subtotal</th>
      </tr>
    </thead>
    <tbody>${filas}${filasOtros}</tbody>
    <tfoot>
      <tr>
        <td colspan="5" style="text-align:right">TOTAL</td>
        <td style="text-align:right">${formatPrecio(p.total)}</td>
      </tr>
    </tfoot>
  </table>

  ${p.observaciones ? `<div class="obs"><strong>Observaciones:</strong> ${p.observaciones}</div>` : ""}

  <div class="pie">Este presupuesto tiene validez de 7 días a partir de la fecha de emisión.</div>
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

function compartirWhatsapp(p) {
  const lineas = [];
  lineas.push(`*Presupuesto — Lüscher Hnos.*`);
  lineas.push(`📅 Fecha: ${p.fecha}`);
  lineas.push(`👤 Cliente: ${p.clienteNombre}`);
  lineas.push(`🚗 Vehículo: ${p.vehiculoPatente} — ${p.vehiculoModelo}`);
  lineas.push("");
  lineas.push("*Detalle:*");

  CAMPOS_SERVICE.forEach((c) => {
    const campo = p.camposService?.[c.key];
    if (!campo) return;
    const cant = c.key === "aceite" ? (p.cantidadAceite || 1) : 1;
    lineas.push(`${c.icono} ${c.label}: ${campo.nombre} x${cant} — ${formatPrecio(campo.precio * cant)}`);
  });

  (p.otrosItems || []).forEach((item) => {
    lineas.push(`📦 ${item.nombre} x${item.cantidad} — ${formatPrecio(item.precio * item.cantidad)}`);
  });

  lineas.push("");
  lineas.push(`*TOTAL: ${formatPrecio(p.total)}*`);
  if (p.observaciones) lineas.push(`\n_${p.observaciones}_`);
  lineas.push("\n_Válido por 7 días._");

  const texto = encodeURIComponent(lineas.join("\n"));
  window.open(`https://wa.me/?text=${texto}`, "_blank");
}

const CAMPOS_SERVICE = [
  { key: "aceite",           label: "Aceite",               icono: "🛢️", categorias: ["Aceites"] },
  { key: "filtroAceite",     label: "Filtro de aceite",     icono: "🔧", categorias: ["Filtros aceite"] },
  { key: "filtroAire",       label: "Filtro de aire",       icono: "💨", categorias: ["Filtros aire"] },
  { key: "filtroCombustible",label: "Filtro de combustible",icono: "⛽", categorias: ["Filtros combustible"] },
  { key: "filtroHabitaculo", label: "Filtro de habitáculo", icono: "🌬️", categorias: ["Filtros habitáculo"] },
];

function BuscadorProducto({ label, icono, value, onSelect, onClear, productos, tipoPrecio, categorias = [] }) {
  const [busqueda, setBusqueda] = useState("");

  const resultados = busqueda.trim()
    ? productos.filter((p) => {
        const enCategoria = categorias.length === 0 || categorias.some((cat) =>
          (p.categoria || "").toLowerCase().includes(cat.toLowerCase())
        );
        const coincide =
          p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
          (p.codigo || "").toLowerCase().includes(busqueda.toLowerCase());
        return enCategoria && coincide;
      }).slice(0, 6)
    : [];

  function seleccionar(p) {
    const precio = tipoPrecio === "mecanico" ? Number(p.precioMecanico) : Number(p.precioPublico);
    onSelect({ productoId: p.id, codigo: p.codigo, nombre: p.nombre, precio });
    setBusqueda("");
  }

  return (
    <div className="campo-service-pres">
      <label className="label-service-pres">
        <span>{icono}</span> {label}
      </label>
      {value ? (
        <div className="producto-seleccionado-pres">
          <span className="prod-sel-codigo">{value.codigo}</span>
          <span className="prod-sel-nombre">{value.nombre}</span>
          <span className="prod-sel-precio">{formatPrecio(value.precio)}</span>
          <button className="boton-quitar-pres" onClick={onClear}>✖</button>
        </div>
      ) : (
        <div style={{ position: "relative" }}>
          <input
            type="text"
            className="input-pres"
            placeholder={`Buscar ${label.toLowerCase()}...`}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          {resultados.length > 0 && (
            <ul className="dropdown-productos-pres">
              {resultados.map((p) => (
                <li key={p.id} onClick={() => seleccionar(p)} className="dropdown-item-pres">
                  <span className="dropdown-codigo-pres">{p.codigo}</span>
                  <span className="dropdown-nombre-pres">{p.nombre}</span>
                  <span className="dropdown-precio-pres">
                    {formatPrecio(tipoPrecio === "mecanico" ? p.precioMecanico : p.precioPublico)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function Presupuestos() {
  const location = useLocation();
  const navigate = useNavigate();

  const [presupuestos, setPresupuestos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(true);

  const [vista, setVista] = useState("lista");
  const [presupuestoRecienGuardado, setPresupuestoRecienGuardado] = useState(null);
  const [presupuestoActivo, setPresupuestoActivo] = useState(null);

  // Form
  const [clienteId, setClienteId] = useState("");
  const [clienteNombreBusqueda, setClienteNombreBusqueda] = useState("");
  const [vehiculoId, setVehiculoId] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [camposService, setCamposService] = useState({
    aceite: null,
    filtroAceite: null,
    filtroAire: null,
    filtroCombustible: null,
    filtroHabitaculo: null,
  });
  const [cantidadAceite, setCantidadAceite] = useState(1);
  const [otrosItems, setOtrosItems] = useState([]);
  const [busquedaOtros, setBusquedaOtros] = useState("");
  const [errorForm, setErrorForm] = useState("");

  // Filtros lista
  const [busquedaLista, setBusquedaLista] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");

  useEffect(() => {
    Promise.all([getPresupuestos(), getClientes(), getVehiculos(), getProductos()])
      .then(([ps, cs, vs, prods]) => {
        setPresupuestos(ps);
        setClientes(cs);
        setVehiculos(vs);
        setProductos(prods);
      })
      .catch(console.error)
      .finally(() => setCargando(false));
  }, []);

  // Pre-cargar desde agenda: si se navegó desde un turno
  useEffect(() => {
    const state = location.state;
    if (!state?.desdeAgenda) return;
    if (state.clienteId) {
      const cliente = clientes.find((c) => c.id === state.clienteId);
      if (cliente) {
        setClienteId(String(cliente.id));
        setClienteNombreBusqueda(cliente.nombre);
      }
    }
    if (state.vehiculoId) {
      setVehiculoId(String(state.vehiculoId));
    }
    setVista("nuevo");
    // Limpiar el state para que no se repita al navegar
    window.history.replaceState({}, "");
  }, []);

  const clienteSeleccionado = clientes.find((c) => c.id === Number(clienteId));
  const tipoPrecio = clienteSeleccionado?.tipoPrecio || "publico";

  // Vehículos del cliente: primero por clienteId (nuevo modelo), luego fallback fuzzy por nombre
  const vehiculosDelCliente = clienteSeleccionado
    ? vehiculos.filter((v) => {
        if (v.clienteId) return v.clienteId === clienteSeleccionado.id;
        // fallback legacy: matching por nombre
        const dueno = sinAcentos((v.dueno || "").toLowerCase().trim());
        const cliente = sinAcentos(clienteSeleccionado.nombre.toLowerCase().trim());
        if (!dueno || !cliente) return false;
        if (dueno === cliente) return true;
        if (dueno.includes(cliente) || cliente.includes(dueno)) return true;
        const palabrasDueno = dueno.split(/\s+/);
        const palabrasCliente = cliente.split(/\s+/);
        return palabrasDueno.filter((p) => palabrasCliente.includes(p) && p.length > 2).length >= 2;
      })
    : [];

  // Al seleccionar vehículo, pre-cargar filtros del último service
  useEffect(() => {
    if (!vehiculoId) return;

    const services = JSON.parse(localStorage.getItem("services") || "[]");
    const servicesDelVehiculo = services
      .filter((s) => s.vehiculoId === Number(vehiculoId))
      .sort((a, b) => {
        const parseDate = (d) => {
          if (!d || d === "-") return 0;
          const parts = d.split("/");
          if (parts.length === 3) return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).getTime();
          return 0;
        };
        return parseDate(b.fecha) - parseDate(a.fecha);
      });

    if (servicesDelVehiculo.length === 0) return;

    const ultimo = servicesDelVehiculo[0];
    const tipoPrecio = clienteSeleccionado?.tipoPrecio || "publico";

    const norm = (s) => (s || "").toUpperCase().replace(/[-\s]/g, "").trim();

    function buscarProducto(codigo) {
      if (!codigo || codigo === "-") return null;
      // Tomar el primer token (antes de espacio o paréntesis)
      const codigoBase = codigo.split(/[\s(]/)[0].trim();
      const codigoNorm = norm(codigoBase);
      if (!codigoNorm) return null;
      // Buscar exacto primero, luego fuzzy sin guiones/espacios
      const prod = productos.find((p) => {
        const pNorm = norm(p.codigo || "");
        return pNorm === codigoNorm || norm(p.codigo || "") === norm(codigo);
      });
      if (!prod) return null;
      const precio = tipoPrecio === "mecanico" ? Number(prod.precioMecanico) : Number(prod.precioPublico);
      return { productoId: prod.id, codigo: prod.codigo, nombre: prod.nombre, precio };
    }

    // El aceite se guarda como "MARCA (XL)" — extraer litros del paréntesis
    const aceiteRaw = ultimo.aceite || "";
    const aceiteMatch = aceiteRaw.match(/\(([0-9.]+)L?\)/i);
    const litros = aceiteMatch ? parseFloat(aceiteMatch[1]) : 1;

    const nuevoCampos = {
      aceite: buscarProducto(aceiteRaw),
      filtroAceite: buscarProducto(ultimo.filtroAceite),
      filtroAire: buscarProducto(ultimo.filtroAire),
      filtroCombustible: buscarProducto(ultimo.filtroCombustible),
      filtroHabitaculo: buscarProducto(ultimo.filtroHabitaculo),
    };

    setCamposService(nuevoCampos);
    if (litros > 0) setCantidadAceite(litros);
  }, [vehiculoId, productos, clienteSeleccionado]);

  // Otros productos
  const resultadosOtros = busquedaOtros.trim()
    ? productos.filter(
        (p) =>
          p.nombre.toLowerCase().includes(busquedaOtros.toLowerCase()) ||
          (p.codigo || "").toLowerCase().includes(busquedaOtros.toLowerCase())
      ).slice(0, 8)
    : [];

  function agregarOtro(p) {
    const yaExiste = otrosItems.find((i) => i.productoId === p.id);
    if (yaExiste) {
      setOtrosItems(otrosItems.map((i) =>
        i.productoId === p.id ? { ...i, cantidad: i.cantidad + 1 } : i
      ));
    } else {
      const precio = tipoPrecio === "mecanico" ? Number(p.precioMecanico) : Number(p.precioPublico);
      setOtrosItems([...otrosItems, { productoId: p.id, codigo: p.codigo, nombre: p.nombre, precio, cantidad: 1 }]);
    }
    setBusquedaOtros("");
  }

  function quitarOtro(productoId) {
    setOtrosItems(otrosItems.filter((i) => i.productoId !== productoId));
  }

  function cambiarCantidadOtro(productoId, cantidad) {
    if (cantidad < 1) return;
    setOtrosItems(otrosItems.map((i) => i.productoId === productoId ? { ...i, cantidad } : i));
  }

  // Total
  const totalService = CAMPOS_SERVICE.reduce((acc, c) => {
    const campo = camposService[c.key];
    if (!campo) return acc;
    const cant = c.key === "aceite" ? cantidadAceite : 1;
    return acc + campo.precio * cant;
  }, 0);
  const totalOtros = otrosItems.reduce((acc, i) => acc + i.precio * i.cantidad, 0);
  const totalPresupuesto = totalService + totalOtros;

  function guardarPresupuesto() {
    setErrorForm("");
    if (!clienteId) { setErrorForm("Seleccioná un cliente."); return; }
    if (!vehiculoId) { setErrorForm("Seleccioná un vehículo."); return; }
    const tieneAlgo = Object.values(camposService).some(Boolean) || otrosItems.length > 0;
    if (!tieneAlgo) { setErrorForm("Agregá al menos un producto."); return; }

    const vehiculo = vehiculos.find((v) => v.id === Number(vehiculoId));
    const numero = presupuestos.length > 0
      ? Math.max(...presupuestos.map((p) => p.numero || 0)) + 1
      : 1;

    const nuevo = {
      id: Date.now(),
      numero,
      fecha: fechaHoy(),
      clienteId: Number(clienteId),
      clienteNombre: clienteSeleccionado.nombre,
      vehiculoId: Number(vehiculoId),
      vehiculoPatente: vehiculo?.patente || "",
      vehiculoModelo: vehiculo?.modelo || "",
      estado: "pendiente",
      camposService,
      cantidadAceite,
      otrosItems,
      total: totalPresupuesto,
      observaciones: observaciones.trim(),
    };

    setPresupuestos([nuevo, ...presupuestos]);
    upsertPresupuesto(nuevo).catch(console.error);
    setPresupuestoRecienGuardado(nuevo);
    resetForm();
    setVista("guardado");
  }

  function resetForm() {
    setClienteId(""); setClienteNombreBusqueda(""); setVehiculoId(""); setObservaciones("");
    setCamposService({ aceite: null, filtroAceite: null, filtroAire: null, filtroCombustible: null, filtroHabitaculo: null });
    setCantidadAceite(1);
    setOtrosItems([]); setBusquedaOtros(""); setErrorForm("");
  }

  function cerrarPresupuesto(id) {
    const updated = presupuestos.map((p) => p.id === id ? { ...p, estado: "cerrado" } : p);
    setPresupuestos(updated);
    const updatedPres = updated.find((p) => p.id === id);
    if (updatedPres) upsertPresupuesto(updatedPres).catch(console.error);
    if (presupuestoActivo?.id === id) setPresupuestoActivo({ ...presupuestoActivo, estado: "cerrado" });
  }

  function reabrirPresupuesto(id) {
    const updated = presupuestos.map((p) => p.id === id ? { ...p, estado: "pendiente" } : p);
    setPresupuestos(updated);
    const updatedPres = updated.find((p) => p.id === id);
    if (updatedPres) upsertPresupuesto(updatedPres).catch(console.error);
    if (presupuestoActivo?.id === id) setPresupuestoActivo({ ...presupuestoActivo, estado: "pendiente" });
  }

  function eliminarPresupuesto(id) {
    if (!window.confirm("¿Eliminar este presupuesto?")) return;
    setPresupuestos(presupuestos.filter((p) => p.id !== id));
    deletePresupuesto(id).catch(console.error);
    setPresupuestoActivo(null);
    setVista("lista");
  }

  const presupuestosFiltrados = presupuestos.filter((p) => {
    const q = busquedaLista.toLowerCase().trim();
    const coincide = !q ||
      p.clienteNombre.toLowerCase().includes(q) ||
      (p.vehiculoPatente || "").toLowerCase().includes(q) ||
      (p.vehiculoModelo || "").toLowerCase().includes(q) ||
      String(p.numero).includes(q);
    return coincide && (!filtroEstado || p.estado === filtroEstado);
  });

  if (cargando) return <div style={{padding:40, textAlign:"center", color:"#6b7280"}}>Cargando...</div>;

  // ── DETALLE ──
  if (vista === "detalle" && presupuestoActivo) {
    const p = presupuestoActivo;
    return (
      <div className="contenedor-presupuestos">
        <div className="header-presupuestos">
          <button className="boton-volver-pres" onClick={() => setVista("lista")}>← Volver</button>
          <div className="header-presupuestos-titulo">
            <h1>Presupuesto</h1>
            <span className={`badge-estado ${p.estado === "pendiente" ? "estado-pendiente" : "estado-cerrado"}`}>
              {p.estado === "pendiente" ? "Pendiente" : "Cerrado"}
            </span>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button className="boton-imprimir-pres" onClick={() => imprimirPresupuesto(p)}>🖨️ Imprimir</button>
            <button className="boton-wsp-pres" onClick={() => compartirWhatsapp(p)}>💬 WhatsApp</button>
            {p.estado === "pendiente"
              ? <button className="boton-cerrar-pres" onClick={() => cerrarPresupuesto(p.id)}>Cerrar presupuesto</button>
              : <button className="boton-reabrir-pres" onClick={() => reabrirPresupuesto(p.id)}>Reabrir</button>}
            <button className="boton-eliminar-pres" onClick={() => eliminarPresupuesto(p.id)}>Eliminar</button>
          </div>
        </div>

        <div className="detalle-pres-info">
          <div className="detalle-pres-campo">
            <span className="detalle-pres-label">Cliente</span>
            <span className="detalle-pres-valor">{p.clienteNombre}</span>
          </div>
          <div className="detalle-pres-campo">
            <span className="detalle-pres-label">Vehículo</span>
            <span className="detalle-pres-valor">{p.vehiculoPatente} — {p.vehiculoModelo}</span>
          </div>
          <div className="detalle-pres-campo">
            <span className="detalle-pres-label">Fecha</span>
            <span className="detalle-pres-valor">{p.fecha}</span>
          </div>
        </div>

        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", marginTop: 16 }}>
        <table className="tabla-pres">
          <thead>
            <tr>
              <th>Ítem</th>
              <th>Código</th>
              <th>Producto</th>
              <th>Cant.</th>
              <th>Precio unit.</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {CAMPOS_SERVICE.map((c) => {
              const campo = p.camposService?.[c.key];
              if (!campo) return null;
              const cant = c.key === "aceite" ? (p.cantidadAceite || 1) : 1;
              return (
                <tr key={c.key}>
                  <td><span style={{ marginRight: 6 }}>{c.icono}</span>{c.label}</td>
                  <td>{campo.codigo}</td>
                  <td>{campo.nombre}</td>
                  <td>{cant}</td>
                  <td>{formatPrecio(campo.precio)}</td>
                  <td>{formatPrecio(campo.precio * cant)}</td>
                </tr>
              );
            })}
            {(p.otrosItems || []).map((item, i) => (
              <tr key={`otro-${i}`}>
                <td>Otro</td>
                <td>{item.codigo}</td>
                <td>{item.nombre}</td>
                <td>{item.cantidad}</td>
                <td>{formatPrecio(item.precio)}</td>
                <td>{formatPrecio(item.precio * item.cantidad)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5} style={{ textAlign: "right", fontWeight: 600 }}>Total</td>
              <td style={{ fontWeight: 700, fontSize: "1.05rem" }}>{formatPrecio(p.total)}</td>
            </tr>
          </tfoot>
        </table>
        </div>

        {p.observaciones && (
          <div className="detalle-pres-obs">
            <span className="detalle-pres-label">Observaciones</span>
            <p>{p.observaciones}</p>
          </div>
        )}
      </div>
    );
  }

  // ── GUARDADO ──
  if (vista === "guardado" && presupuestoRecienGuardado) {
    const p = presupuestoRecienGuardado;
    return (
      <div className="contenedor-presupuestos">
        <div style={{ maxWidth: 480, margin: "60px auto", background: "white", borderRadius: 14, padding: "40px 32px", boxShadow: "0 4px 20px rgba(0,0,0,0.08)", textAlign: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#d1fae5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.8rem", color: "#059669", fontWeight: 700, margin: "0 auto 16px" }}>
            {"✓"}
          </div>
          <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#111827", marginBottom: 8 }}>
            Presupuesto guardado
          </h2>
          <p style={{ color: "#6b7280", fontSize: "0.92rem", marginBottom: 4 }}>
            {p.vehiculoPatente} {p.vehiculoModelo && `— ${p.vehiculoModelo}`}
          </p>
          <p style={{ color: "#6b7280", fontSize: "0.92rem", marginBottom: 24 }}>
            {p.clienteNombre}
          </p>
          <p style={{ color: "#374151", fontSize: "0.95rem", marginBottom: 20, fontWeight: 500 }}>
            {"¿Querés agendar un turno para este vehículo?"}
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button
              className="boton-volver-pres"
              onClick={() => { setPresupuestoRecienGuardado(null); setVista("lista"); }}
            >
              No, ver lista
            </button>
            <button
              className="boton-guardar-pres"
              onClick={() => {
                setPresupuestoRecienGuardado(null);
                navigate("/agenda", {
                  state: {
                    desdePresupuesto: true,
                    vehiculoId: p.vehiculoId,
                    clienteId: p.clienteId,
                    patente: p.vehiculoPatente,
                    tipoService: "Cambio de aceite y filtros",
                  },
                });
              }}
            >
              {"Sí, agendar turno →"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── NUEVO ──
  if (vista === "nuevo") {
    return (
      <div className="contenedor-presupuestos">
        <div className="header-presupuestos">
          <button className="boton-volver-pres" onClick={() => { resetForm(); setVista("lista"); }}>← Volver</button>
          <h1>Nuevo presupuesto</h1>
        </div>

        <div className="form-presupuesto">
          <div className="fila-dos-campos">
            <div className="campo-pres">
              <label>Cliente o patente</label>
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  className="input-pres"
                  placeholder="Buscar por nombre de cliente o patente..."
                  value={clienteNombreBusqueda}
                  onChange={(e) => {
                    setClienteNombreBusqueda(e.target.value);
                    setClienteId("");
                    setVehiculoId("");
                  }}
                />
                {clienteNombreBusqueda && !clienteId && (() => {
                  const q = clienteNombreBusqueda.toLowerCase();
                  // Resultados de clientes
                  const resClientes = clientes
                    .filter((c) => c.nombre.toLowerCase().includes(q))
                    .slice(0, 5);
                  // Resultados de vehículos por patente
                  const resVehiculos = vehiculos
                    .filter((v) => v.patente.toLowerCase().includes(q))
                    .slice(0, 4);

                  if (resClientes.length === 0 && resVehiculos.length === 0) return null;
                  return (
                    <ul className="dropdown-productos-pres">
                      {resClientes.map((c) => (
                        <li key={`c-${c.id}`} className="dropdown-item-pres" onClick={() => {
                          setClienteId(c.id);
                          setClienteNombreBusqueda(c.nombre);
                          setVehiculoId("");
                        }}>
                          <span style={{ fontSize: "0.75rem", color: "#6b7280", marginRight: 6 }}>👤</span>
                          {c.nombre}
                        </li>
                      ))}
                      {resVehiculos.map((v) => {
                        // Al elegir patente, auto-seleccionar el cliente dueño y el vehículo
                        const clienteDelVehiculo = clientes.find((c) => c.id === v.clienteId);
                        return (
                          <li key={`v-${v.id}`} className="dropdown-item-pres" onClick={() => {
                            if (clienteDelVehiculo) {
                              setClienteId(clienteDelVehiculo.id);
                              setClienteNombreBusqueda(clienteDelVehiculo.nombre);
                            }
                            setVehiculoId(v.id);
                          }}>
                            <span style={{ fontSize: "0.75rem", color: "#6b7280", marginRight: 6 }}>🚗</span>
                            {v.patente} — {v.modelo}
                            {clienteDelVehiculo && <span style={{ color: "#9ca3af", marginLeft: 6 }}>({clienteDelVehiculo.nombre})</span>}
                          </li>
                        );
                      })}
                    </ul>
                  );
                })()}
              </div>
            </div>
            <div className="campo-pres">
              <label>Vehículo</label>
              <select className="input-pres" value={vehiculoId}
                onChange={(e) => setVehiculoId(e.target.value)} disabled={!clienteId}>
                <option value="">
                  {!clienteId ? "Primero seleccioná un cliente o patente"
                    : vehiculosDelCliente.length === 0 ? "Sin vehículos asociados"
                    : "Seleccioná un vehículo"}
                </option>
                {vehiculosDelCliente.map((v) => (
                  <option key={v.id} value={v.id}>{v.patente} — {v.modelo}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="seccion-pres">
            <h3 className="titulo-seccion-pres">🔩 Service</h3>
            <div className="grilla-service-pres">
              {CAMPOS_SERVICE.map((c) => (
                <div key={c.key}>
                  <BuscadorProducto
                    label={c.label}
                    icono={c.icono}
                    value={camposService[c.key]}
                    onSelect={(prod) => setCamposService({ ...camposService, [c.key]: prod })}
                    onClear={() => setCamposService({ ...camposService, [c.key]: null })}
                    productos={productos}
                    tipoPrecio={tipoPrecio}
                    categorias={c.categorias}
                  />
                  {c.key === "aceite" && camposService.aceite && (
                    <div className="campo-litros-pres">
                      <label>Cantidad (litros)</label>
                      <input type="number" min="1" step="0.5" value={cantidadAceite}
                        onChange={(e) => setCantidadAceite(Number(e.target.value))}
                        className="input-cantidad-pres" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="seccion-pres">
            <h3 className="titulo-seccion-pres">📦 Otros productos</h3>
            <div style={{ position: "relative" }}>
              <input type="text" className="input-pres"
                placeholder="Buscar por nombre o código..."
                value={busquedaOtros}
                onChange={(e) => setBusquedaOtros(e.target.value)} />
              {resultadosOtros.length > 0 && (
                <ul className="dropdown-productos-pres">
                  {resultadosOtros.map((p) => (
                    <li key={p.id} onClick={() => agregarOtro(p)} className="dropdown-item-pres">
                      <span className="dropdown-codigo-pres">{p.codigo}</span>
                      <span className="dropdown-nombre-pres">{p.nombre}</span>
                      <span className="dropdown-precio-pres">
                        {formatPrecio(tipoPrecio === "mecanico" ? p.precioMecanico : p.precioPublico)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {otrosItems.length > 0 && (
              <table className="tabla-pres" style={{ marginTop: 12 }}>
                <thead>
                  <tr><th>Código</th><th>Producto</th><th>Precio unit.</th><th>Cantidad</th><th>Subtotal</th><th></th></tr>
                </thead>
                <tbody>
                  {otrosItems.map((item) => (
                    <tr key={item.productoId}>
                      <td>{item.codigo}</td>
                      <td>{item.nombre}</td>
                      <td>{formatPrecio(item.precio)}</td>
                      <td>
                        <input type="number" min="1" value={item.cantidad}
                          onChange={(e) => cambiarCantidadOtro(item.productoId, Number(e.target.value))}
                          className="input-cantidad-pres" />
                      </td>
                      <td>{formatPrecio(item.precio * item.cantidad)}</td>
                      <td><button className="boton-quitar-pres" onClick={() => quitarOtro(item.productoId)}>✖</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {totalPresupuesto > 0 && (
            <div className="total-pres">
              <span>Total</span>
              <span>{formatPrecio(totalPresupuesto)}</span>
            </div>
          )}

          <div className="campo-pres">
            <label>Observaciones <span style={{ color: "#999", fontSize: "0.85rem" }}>(opcional)</span></label>
            <textarea className="input-pres" rows={3}
              placeholder="Ej: válido por 7 días, incluye mano de obra..."
              value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
          </div>

          {errorForm && <p className="error-pres">{errorForm}</p>}
          <button className="boton-guardar-pres" onClick={guardarPresupuesto}>Guardar presupuesto</button>
        </div>
      </div>
    );
  }

  // ── LISTA ──
  return (
    <div className="contenedor-presupuestos">
      <div className="header-presupuestos">
        <h1>Presupuestos</h1>
        <button className="boton-nuevo-pres" onClick={() => setVista("nuevo")}>+ Nuevo presupuesto</button>
      </div>

      <div className="filtros-pres">
        <input type="text" className="input-pres"
          placeholder="Buscar por cliente, patente o número..."
          value={busquedaLista} onChange={(e) => setBusquedaLista(e.target.value)} />
        <select className="input-pres" value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)} style={{ maxWidth: "160px" }}>
          <option value="">Todos</option>
          <option value="pendiente">Pendientes</option>
          <option value="cerrado">Cerrados</option>
        </select>
      </div>

      {presupuestosFiltrados.length === 0 ? (
        <p className="sin-datos-pres">No hay presupuestos.</p>
      ) : (
        <div className="lista-presupuestos">
          {presupuestosFiltrados.map((p) => (
            <div key={p.id} className="card-pres"
              onClick={() => { setPresupuestoActivo(p); setVista("detalle"); }}>
              <div className="card-pres-header">
                <div>
                  <span className="card-pres-numero">{p.fecha}</span>
                  <span className="card-pres-cliente">{p.clienteNombre}</span>
                </div>                <span className={`badge-estado ${p.estado === "pendiente" ? "estado-pendiente" : "estado-cerrado"}`}>
                  {p.estado === "pendiente" ? "Pendiente" : "Cerrado"}
                </span>
              </div>
              <div className="card-pres-footer">
                <span className="card-pres-vehiculo">{"🚗"} {p.vehiculoPatente} — {p.vehiculoModelo}</span>
                <span className="card-pres-fecha">{p.fecha}</span>
                <span className="card-pres-total">{formatPrecio(p.total)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Presupuestos;

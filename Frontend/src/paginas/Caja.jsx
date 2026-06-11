import { useEffect, useState, useMemo } from "react";
import * as XLSX from "xlsx";
import "../estilos/Caja.css";
import { getCaja, upsertMovimiento, deleteMovimiento, getProductos, upsertProducto, getClientes, upsertCliente } from "../lib/db";

const CATEGORIAS = ["Venta", "Cobro a cliente", "Pago a proveedor", "Gasto operativo", "Otro"];
const MEDIOS_PAGO = ["Efectivo", "Transferencia", "Tarjeta débito", "Tarjeta crédito"];

function fechaHoy() {
  const hoy = new Date();
  return hoy.toISOString().split("T")[0];
}

function formatoLocal(fechaISO) {
  const [y, m, d] = fechaISO.split("-");
  return `${d}/${m}/${y}`;
}

function saldoCuenta(cuenta) {
  return cuenta.movimientos.reduce((acc, m) => {
    return m.tipoCc === "cargo" ? acc + m.monto : acc - m.monto;
  }, 0);
}

function Caja() {
  const [caja, setCaja] = useState([]);
  const [productos, setProductos] = useState([]);
  const [cuentasCorrientes, setCuentasCorrientes] = useState([]);
  const [cargando, setCargando] = useState(true);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [fechaFiltro, setFechaFiltro] = useState(fechaHoy());

  const [categoria, setCategoria] = useState("Venta");
  const [medioPago, setMedioPago] = useState("Efectivo");
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [error, setError] = useState("");

  const [tipoCliente, setTipoCliente] = useState("publico");
  const [busquedaProducto, setBusquedaProducto] = useState("");
  const [itemsVenta, setItemsVenta] = useState([]);

  const [busquedaCC, setBusquedaCC] = useState("");
  const [ccSeleccionada, setCcSeleccionada] = useState(null);
  const [montoCobro, setMontoCobro] = useState("");

  useEffect(() => {
    Promise.all([getCaja(), getProductos(), getClientes()])
      .then(([c, ps, cs]) => { setCaja(c); setProductos(ps); setCuentasCorrientes(cs); })
      .catch(console.error)
      .finally(() => setCargando(false));
  }, []);

  const productosFiltrados = useMemo(() => {
    if (!busquedaProducto.trim()) return [];
    const q = busquedaProducto.toLowerCase();
    return productos.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        (p.codigo && p.codigo.toLowerCase().includes(q))
    ).slice(0, 8);
  }, [busquedaProducto, productos]);

  const totalVenta = useMemo(() => {
    return itemsVenta.reduce((acc, item) => {
      const precio = tipoCliente === "publico" ? item.precioPublico : item.precioMecanico;
      return acc + precio * item.cantidad;
    }, 0);
  }, [itemsVenta, tipoCliente]);

  const ccFiltradas = useMemo(() => {
    if (!busquedaCC.trim()) return [];
    const q = busquedaCC.toLowerCase();
    return cuentasCorrientes.filter((c) =>
      c.nombre.toLowerCase().includes(q)
    ).slice(0, 6);
  }, [busquedaCC, cuentasCorrientes]);

  function agregarProductoVenta(producto) {
    const existe = itemsVenta.find((i) => i.id === producto.id);
    if (existe) {
      setItemsVenta(itemsVenta.map((i) =>
        i.id === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i
      ));
    } else {
      setItemsVenta([...itemsVenta, { ...producto, cantidad: 1 }]);
    }
    setBusquedaProducto("");
  }

  function cambiarCantidadItem(id, valor) {
    const num = Number(valor);
    if (num <= 0) {
      setItemsVenta(itemsVenta.filter((i) => i.id !== id));
    } else {
      setItemsVenta(itemsVenta.map((i) => (i.id === id ? { ...i, cantidad: num } : i)));
    }
  }

  function quitarItem(id) {
    setItemsVenta(itemsVenta.filter((i) => i.id !== id));
  }

  function validarVenta() {
    if (itemsVenta.length === 0) {
      setError("Agregá al menos un producto.");
      return false;
    }
    for (const item of itemsVenta) {
      const prod = productos.find((p) => p.id === item.id);
      if (!prod || Number(prod.stock) < item.cantidad) {
        setError(`Stock insuficiente para "${item.nombre}". Stock actual: ${prod?.stock ?? 0}`);
        return false;
      }
    }
    return true;
  }

  function registrarMovimiento() {
    setError("");

    if (categoria === "Venta") {
      if (!validarVenta()) return;

      const productosActualizados = productos.map((p) => {
        const item = itemsVenta.find((i) => i.id === p.id);
        if (item) return { ...p, stock: Number(p.stock) - item.cantidad };
        return p;
      });
      setProductos(productosActualizados);

      const nuevoMovimiento = {
        id: Date.now(),
        fecha: formatoLocal(fechaHoy()),
        categoria: "Venta",
        medioPago,
        descripcion: descripcion || `Venta a ${tipoCliente === "publico" ? "público" : "mecánico"}`,
        monto: totalVenta,
        tipo: "ingreso",
        tipoCliente,
        items: itemsVenta.map((i) => ({
          id: i.id,
          nombre: i.nombre,
          cantidad: i.cantidad,
          precio: tipoCliente === "publico" ? i.precioPublico : i.precioMecanico,
        })),
      };

      // Update productos stock in Supabase
      const productosActualizadosParaDB = productosActualizados.filter((p) => {
        const item = itemsVenta.find((i) => i.id === p.id);
        return !!item;
      });
      productosActualizadosParaDB.forEach((p) => upsertProducto(p).catch(console.error));
      setCaja([nuevoMovimiento, ...caja]);
      upsertMovimiento(nuevoMovimiento).catch(console.error);
      cerrarModal();
      return;
    }

    if (categoria === "Cobro a cliente") {
      if (!ccSeleccionada) {
        setError("Seleccioná una cuenta corriente.");
        return;
      }
      if (!montoCobro || Number(montoCobro) <= 0) {
        setError("Ingresá un monto válido.");
        return;
      }

      // Use state directly
      const ccFresh = cuentasCorrientes;
      const ccActual = ccFresh.find((c) => c.id === ccSeleccionada.id) || ccSeleccionada;
      const saldo = saldoCuenta(ccActual);
      if (Number(montoCobro) > saldo) {
        setError(`El monto supera el saldo de la cuenta (${formatPrecio(saldo)}).`);
        return;
      }

      const nuevoPagoCC = {
        id: Date.now(),
        fecha: formatoLocal(fechaHoy()),
        tipoCc: "pago",
        monto: Number(montoCobro),
        medioPago,
        descripcion: descripcion || `Pago de ${ccSeleccionada.nombre}`,
        items: [],
      };

      const clienteActualizadoCC = { ...ccActual, movimientos: [...(ccActual.movimientos || []), nuevoPagoCC] };
      setCuentasCorrientes(ccFresh.map((c) =>
        c.id === ccSeleccionada.id ? clienteActualizadoCC : c
      ));
      upsertCliente(clienteActualizadoCC).catch(console.error);

      const nuevoMovimiento = {
        id: Date.now() + 1,
        fecha: formatoLocal(fechaHoy()),
        categoria: "Cobro a cliente",
        medioPago,
        descripcion: descripcion || `CC - ${ccSeleccionada.nombre}`,
        monto: Number(montoCobro),
        tipo: "ingreso",
        items: [],
      };

      setCaja([nuevoMovimiento, ...caja]);
      upsertMovimiento(nuevoMovimiento).catch(console.error);
      cerrarModal();
      return;
    }

    if (!monto || Number(monto) <= 0) {
      setError("Ingresá un monto válido.");
      return;
    }

    const nuevoMovimiento = {
      id: Date.now(),
      fecha: formatoLocal(fechaHoy()),
      categoria,
      medioPago,
      descripcion,
      monto: Number(monto),
      tipo: "egreso",
      items: [],
    };

    setCaja([nuevoMovimiento, ...caja]);
    upsertMovimiento(nuevoMovimiento).catch(console.error);
    cerrarModal();
  }

  function cerrarModal() {
    setModalAbierto(false);
    setCategoria("Venta");
    setMedioPago("Efectivo");
    setDescripcion("");
    setMonto("");
    setError("");
    setTipoCliente("publico");
    setBusquedaProducto("");
    setItemsVenta([]);
    setBusquedaCC("");
    setCcSeleccionada(null);
    setMontoCobro("");
  }

  const movimientosDia = useMemo(() => {
    return caja.filter((m) => m.fecha === formatoLocal(fechaFiltro));
  }, [caja, fechaFiltro]);

  const resumen = useMemo(() => {
    const ingresos = movimientosDia
      .filter((m) => m.tipo === "ingreso")
      .reduce((acc, m) => acc + m.monto, 0);
    const egresos = movimientosDia
      .filter((m) => m.tipo === "egreso")
      .reduce((acc, m) => acc + m.monto, 0);
    return { ingresos, egresos, saldo: ingresos - egresos };
  }, [movimientosDia]);

  function exportarDia() {
    const [y, m, d] = fechaFiltro.split("-");
    const fechaStr = `${d}/${m}/${y}`;
    const movimientosExport = caja.filter((mov) => mov.fecha === fechaStr);

    if (movimientosExport.length === 0) {
      alert("No hay movimientos para este día.");
      return;
    }

    const filas = [];
    movimientosExport.forEach((mov) => {
      if (mov.items && mov.items.length > 0) {
        mov.items.forEach((item, idx) => {
          filas.push({
            Fecha: mov.fecha,
            Categoría: mov.categoria,
            "Medio de pago": mov.medioPago,
            Descripción: idx === 0 ? (mov.descripcion || "") : "",
            Producto: item.nombre,
            Cantidad: item.cantidad,
            "Precio unit.": item.precio.toFixed(2),
            Subtotal: (item.precio * item.cantidad).toFixed(2),
            "Monto total": idx === 0 ? mov.monto.toFixed(2) : "",
            Tipo: mov.tipo,
          });
        });
      } else {
        filas.push({
          Fecha: mov.fecha,
          Categoría: mov.categoria,
          "Medio de pago": mov.medioPago,
          Descripción: mov.descripcion || "",
          Producto: "",
          Cantidad: "",
          "Precio unit.": "",
          Subtotal: "",
          "Monto total": mov.monto.toFixed(2),
          Tipo: mov.tipo,
        });
      }
    });

    const ingresos = movimientosExport.filter(m => m.tipo === "ingreso").reduce((a, m) => a + m.monto, 0);
    const egresos = movimientosExport.filter(m => m.tipo === "egreso").reduce((a, m) => a + m.monto, 0);
    filas.push({});
    filas.push({ Fecha: "RESUMEN DEL DÍA" });
    filas.push({ Fecha: "Ingresos", "Monto total": ingresos.toFixed(2) });
    filas.push({ Fecha: "Egresos", "Monto total": egresos.toFixed(2) });
    filas.push({ Fecha: "Saldo", "Monto total": (ingresos - egresos).toFixed(2) });

    const ws = XLSX.utils.json_to_sheet(filas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Caja");
    XLSX.writeFile(wb, `caja_${d}-${m}-${y}.xlsx`);
  }

  function exportarExcel() {
    const [y, m] = fechaFiltro.split("-");
    const movimientosExport = caja.filter((mov) => {
      const partes = mov.fecha.split("/");
      return partes[2] === y && partes[1] === m;
    });

    if (movimientosExport.length === 0) return;

    const filas = [];
    movimientosExport.forEach((mov) => {
      if (mov.items && mov.items.length > 0) {
        mov.items.forEach((item, idx) => {
          filas.push({
            Fecha: mov.fecha,
            Categoría: mov.categoria,
            "Medio de pago": mov.medioPago,
            Descripción: idx === 0 ? (mov.descripcion || "") : "",
            Producto: item.nombre,
            Cantidad: item.cantidad,
            "Precio unit.": item.precio.toFixed(2),
            Subtotal: (item.precio * item.cantidad).toFixed(2),
            "Monto total": idx === 0 ? mov.monto.toFixed(2) : "",
            Tipo: mov.tipo,
          });
        });
      } else {
        filas.push({
          Fecha: mov.fecha,
          Categoría: mov.categoria,
          "Medio de pago": mov.medioPago,
          Descripción: mov.descripcion || "",
          Producto: "",
          Cantidad: "",
          "Precio unit.": "",
          Subtotal: "",
          "Monto total": mov.monto.toFixed(2),
          Tipo: mov.tipo,
        });
      }
    });

    const ingresosTotal = movimientosExport.filter(m => m.tipo === "ingreso").reduce((a, m) => a + m.monto, 0);
    const egresosTotal = movimientosExport.filter(m => m.tipo === "egreso").reduce((a, m) => a + m.monto, 0);

    filas.push({});
    filas.push({ Fecha: "RESUMEN DEL MES" });
    filas.push({ Fecha: "Ingresos", "Monto total": ingresosTotal.toFixed(2) });
    filas.push({ Fecha: "Egresos", "Monto total": egresosTotal.toFixed(2) });
    filas.push({ Fecha: "Saldo", "Monto total": (ingresosTotal - egresosTotal).toFixed(2) });

    const ws = XLSX.utils.json_to_sheet(filas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Caja");

    const nombreMes = new Date(y, m - 1).toLocaleString("es-AR", { month: "long" });
    XLSX.writeFile(wb, `caja_${nombreMes}_${y}.xlsx`);
  }

  function formatPrecio(n) {
    return `$${Number(n).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  if (cargando) return <div style={{padding:40, textAlign:"center", color:"#6b7280"}}>Cargando...</div>;

  return (
    <div className="contenedor-caja">
      <div className="header-caja">
        <div className="header-caja-left">
          <h1>Caja</h1>
          <div className="selector-fecha-caja">
            <label>Fecha:</label>
            <input
              type="date"
              value={fechaFiltro}
              onChange={(e) => setFechaFiltro(e.target.value)}
              className="input-fecha-caja"
            />
            <button className="boton-hoy" onClick={() => setFechaFiltro(fechaHoy())}>
              Hoy
            </button>
          </div>
        </div>
        <div className="header-caja-right">
          <button className="boton-exportar" onClick={exportarDia}>
            📥 Exportar día
          </button>
          <button className="boton-nuevo-movimiento" onClick={() => setModalAbierto(true)}>
            + Nuevo movimiento
          </button>
        </div>
      </div>

      <div className="resumen-caja">
        <div className="card-resumen ingreso">
          <span className="card-resumen-label">Ingresos del día</span>
          <span className="card-resumen-valor">{formatPrecio(resumen.ingresos)}</span>
        </div>
        <div className="card-resumen egreso">
          <span className="card-resumen-label">Egresos del día</span>
          <span className="card-resumen-valor">{formatPrecio(resumen.egresos)}</span>
        </div>
        <div className={`card-resumen saldo ${resumen.saldo >= 0 ? "positivo" : "negativo"}`}>
          <span className="card-resumen-label">Saldo del día</span>
          <span className="card-resumen-valor">{formatPrecio(resumen.saldo)}</span>
        </div>
      </div>

      <div className="tabla-caja-wrapper">
        {movimientosDia.length === 0 ? (
          <p className="sin-movimientos-caja">No hay movimientos para esta fecha.</p>
        ) : (
          <table className="tabla-caja">
            <thead>
              <tr>
                <th>Categoría</th>
                <th>Descripción</th>
                <th>Medio de pago</th>
                <th>Productos</th>
                <th>Monto</th>
                <th>Tipo</th>
              </tr>
            </thead>
            <tbody>
              {movimientosDia.map((m) => (
                <tr key={m.id}>
                  <td>{m.categoria}</td>
                  <td>{m.descripcion || "—"}</td>
                  <td>{m.medioPago}</td>
                  <td>
                    {m.items && m.items.length > 0 ? (
                      <ul className="lista-items-venta">
                        {m.items.map((item, i) => (
                          <li key={i}>
                            {item.nombre} ×{item.cantidad} ({formatPrecio(item.precio)} c/u)
                          </li>
                        ))}
                      </ul>
                    ) : "—"}
                  </td>
                  <td className={m.tipo === "ingreso" ? "monto-ingreso" : "monto-egreso"}>
                    {m.tipo === "egreso" ? "-" : ""}{formatPrecio(m.monto)}
                  </td>
                  <td>
                    <span className={`badge-caja ${m.tipo === "ingreso" ? "badge-ingreso" : "badge-egreso"}`}>
                      {m.tipo === "ingreso" ? "Ingreso" : "Egreso"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalAbierto && (
        <div className="overlay-caja" onClick={cerrarModal}>
          <div className="modal-caja" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-caja">
              <h2>Nuevo movimiento</h2>
              <button className="boton-cerrar-modal" onClick={cerrarModal}>✕</button>
            </div>

            <div className="modal-body-caja">
              <div className="campo-caja">
                <label>Categoría</label>
                <div className="selector-categorias">
                  {CATEGORIAS.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      className={`boton-categoria ${categoria === cat ? "categoria-activa" : ""}`}
                      onClick={() => { setCategoria(cat); setError(""); }}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="campo-caja">
                <label>Medio de pago</label>
                <div className="selector-medios">
                  {MEDIOS_PAGO.map((medio) => (
                    <button
                      key={medio}
                      type="button"
                      className={`boton-medio ${medioPago === medio ? "medio-activo" : ""}`}
                      onClick={() => setMedioPago(medio)}
                    >
                      {medio}
                    </button>
                  ))}
                </div>
              </div>

              {categoria === "Venta" && (
                <>
                  <div className="campo-caja">
                    <label>Tipo de cliente</label>
                    <div className="selector-tipo-cliente">
                      <button
                        type="button"
                        className={`boton-cliente ${tipoCliente === "publico" ? "cliente-activo" : ""}`}
                        onClick={() => setTipoCliente("publico")}
                      >
                        Público
                      </button>
                      <button
                        type="button"
                        className={`boton-cliente ${tipoCliente === "mecanico" ? "cliente-activo" : ""}`}
                        onClick={() => setTipoCliente("mecanico")}
                      >
                        Mecánico
                      </button>
                    </div>
                  </div>

                  <div className="campo-caja">
                    <label>Buscar producto</label>
                    <input
                      type="text"
                      placeholder="Código o nombre..."
                      value={busquedaProducto}
                      onChange={(e) => setBusquedaProducto(e.target.value)}
                      className="input-caja"
                    />
                    {productosFiltrados.length > 0 && (
                      <ul className="dropdown-productos">
                        {productosFiltrados.map((p) => (
                          <li key={p.id} onClick={() => agregarProductoVenta(p)} className="dropdown-item">
                            <span className="dropdown-codigo">{p.codigo}</span>
                            <span className="dropdown-nombre">{p.nombre}</span>
                            <span className="dropdown-precio">
                              {formatPrecio(tipoCliente === "publico" ? p.precioPublico : p.precioMecanico)}
                            </span>
                            <span className="dropdown-stock">Stock: {p.stock}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {itemsVenta.length > 0 && (
                    <div className="campo-caja">
                      <label>Productos en la venta</label>
                      <table className="tabla-items-venta">
                        <thead>
                          <tr>
                            <th>Producto</th>
                            <th>Precio</th>
                            <th>Cant.</th>
                            <th>Subtotal</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {itemsVenta.map((item) => {
                            const precio = tipoCliente === "publico" ? item.precioPublico : item.precioMecanico;
                            return (
                              <tr key={item.id}>
                                <td>{item.nombre}</td>
                                <td>{formatPrecio(precio)}</td>
                                <td>
                                  <input
                                    type="number"
                                    min="1"
                                    value={item.cantidad}
                                    onChange={(e) => cambiarCantidadItem(item.id, e.target.value)}
                                    className="input-cantidad-item"
                                  />
                                </td>
                                <td>{formatPrecio(precio * item.cantidad)}</td>
                                <td>
                                  <button className="boton-quitar-item" onClick={() => quitarItem(item.id)}>✕</button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      <div className="total-venta">
                        Total: <strong>{formatPrecio(totalVenta)}</strong>
                      </div>
                    </div>
                  )}
                </>
              )}

              {categoria === "Cobro a cliente" && (
                <>
                  <div className="campo-caja">
                    <label>Buscar cuenta corriente</label>
                    <input
                      type="text"
                      placeholder="Nombre del cliente..."
                      value={busquedaCC}
                      onChange={(e) => {
                        setBusquedaCC(e.target.value);
                        setCcSeleccionada(null);
                        setMontoCobro("");
                      }}
                      className="input-caja"
                    />
                    {ccFiltradas.length > 0 && !ccSeleccionada && (
                      <ul className="dropdown-productos">
                        {ccFiltradas.map((c) => {
                          const saldo = saldoCuenta(c);
                          return (
                            <li
                              key={c.id}
                              className="dropdown-item-cc"
                              onClick={() => {
                                setCcSeleccionada(c);
                                setBusquedaCC(c.nombre);
                              }}
                            >
                              <span className="dropdown-nombre">{c.nombre}</span>
                              <span className={`dropdown-saldo-cc ${saldo > 0 ? "saldo-deudor" : "saldo-ok"}`}>
                                {saldo > 0 ? `Debe: ${formatPrecio(saldo)}` : "Sin deuda"}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  {ccSeleccionada && (
                    <div className="info-cc-seleccionada">
                      <div className="info-cc-fila">
                        <span className="info-label">Cliente:</span>
                        <span className="info-valor">{ccSeleccionada.nombre}</span>
                      </div>
                      <div className="info-cc-fila">
                        <span className="info-label">Saldo actual:</span>
                        <span className="info-valor saldo-deudor">{formatPrecio(saldoCuenta(ccSeleccionada))}</span>
                      </div>
                    </div>
                  )}

                  {ccSeleccionada && (
                    <div className="campo-caja">
                      <label>Monto a cobrar</label>
                      <input
                        type="number"
                        placeholder="0.00"
                        value={montoCobro}
                        onChange={(e) => setMontoCobro(e.target.value)}
                        className="input-caja"
                      />
                    </div>
                  )}
                </>
              )}

              {categoria !== "Venta" && categoria !== "Cobro a cliente" && (
                <div className="campo-caja">
                  <label>Monto</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                    className="input-caja"
                  />
                </div>
              )}

              <div className="campo-caja">
                <label>Descripción <span className="opcional">(opcional)</span></label>
                <input
                  type="text"
                  placeholder="Detalle del movimiento..."
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  className="input-caja"
                />
              </div>

              {error && <p className="error-caja">{error}</p>}

              <button className="boton-confirmar-caja" onClick={registrarMovimiento}>
                Confirmar movimiento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Caja;
import { useEffect, useState, useMemo } from "react";
import { calcularPrecios } from "../utilidades/proveedores";
import "../estilos/CuentasCorrientes.css";
import { getClientes, upsertCliente, deleteCliente, getProductos, upsertMovimiento } from "../lib/db";

const DIAS_ALERTA = 15;

function fechaHoy() {
  return new Date().toLocaleDateString("es-AR");
}

function diasDesde(fechaStr) {
  if (!fechaStr) return null;
  const [d, m, y] = fechaStr.split("/");
  const fecha = new Date(`${y}-${m}-${d}`);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.floor((hoy - fecha) / (1000 * 60 * 60 * 24));
}

function CuentasCorrientes() {
  const [cuentas, setCuentas] = useState([]);
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    Promise.all([getClientes(), getProductos()])
      .then(([cs, ps]) => { setCuentas(cs); setProductos(ps); })
      .catch(console.error)
      .finally(() => setCargando(false));
  }, []);

  const [cuentaActiva, setCuentaActiva] = useState(null);
  const [modalNuevaCuenta, setModalNuevaCuenta] = useState(false);
  const [modalCargo, setModalCargo] = useState(false);
  const [modalPago, setModalPago] = useState(false);
  const [seccion, setSeccion] = useState("info");

  // Form nueva cuenta
  const [nombreNueva, setNombreNueva] = useState("");
  const [telefonoNueva, setTelefonoNueva] = useState("");
  const [direccionNueva, setDireccionNueva] = useState("");
  const [dniNueva, setDniNueva] = useState("");
  const [tipoNueva, setTipoNueva] = useState("publico");
  const [errorNueva, setErrorNueva] = useState("");

  // Edicion info cliente
  const [editandoInfo, setEditandoInfo] = useState(false);
  const [editNombre, setEditNombre] = useState("");
  const [editTelefono, setEditTelefono] = useState("");
  const [editDireccion, setEditDireccion] = useState("");
  const [editDni, setEditDni] = useState("");
  const [editTipo, setEditTipo] = useState("publico");

  // Form cargo
  const [busquedaProducto, setBusquedaProducto] = useState("");
  const [itemsCargo, setItemsCargo] = useState([]);
  const [descripcionCargo, setDescripcionCargo] = useState("");
  const [errorCargo, setErrorCargo] = useState("");

  // Form pago
  const [montoPago, setMontoPago] = useState("");
  const [medioPago, setMedioPago] = useState("Efectivo");
  const [descripcionPago, setDescripcionPago] = useState("");
  const [errorPago, setErrorPago] = useState("");

  const MEDIOS_PAGO = ["Efectivo", "Transferencia", "Tarjeta debito", "Tarjeta credito"];

  const [busquedaLista, setBusquedaLista] = useState("");
  const [busquedaActiva, setBusquedaActiva] = useState("");

  useEffect(() => {
    if (cuentaActiva) {
      const actualizada = cuentas.find((c) => c.id === cuentaActiva.id);
      if (actualizada) setCuentaActiva(actualizada);
    }
  }, [cuentas]);

  function saldoCuenta(cuenta) {
    return cuenta.movimientos.reduce((acc, m) => {
      return m.tipoCc === "cargo" ? acc + m.monto : acc - m.monto;
    }, 0);
  }

  function ultimoMovimiento(cuenta) {
    const movs = cuenta.movimientos;
    if (movs.length === 0) return null;
    return movs[movs.length - 1].fecha;
  }

  const productosFiltrados = useMemo(() => {
    if (!busquedaProducto.trim()) return [];
    const q = busquedaProducto.toLowerCase();
    return productos.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        (p.codigo && p.codigo.toLowerCase().includes(q))
    ).slice(0, 8);
  }, [busquedaProducto, productos]);

  const totalCargo = useMemo(() => {
    if (!cuentaActiva) return 0;
    return itemsCargo.reduce((acc, item) => {
      const precio = cuentaActiva.tipoPrecio === "publico"
        ? Number(item.precioPublico)
        : Number(item.precioMecanico);
      return acc + precio * item.cantidad;
    }, 0);
  }, [itemsCargo, cuentaActiva]);

  function agregarProductoCargo(producto) {
    const existe = itemsCargo.find((i) => i.id === producto.id);
    if (existe) {
      setItemsCargo(itemsCargo.map((i) =>
        i.id === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i
      ));
    } else {
      setItemsCargo([...itemsCargo, { ...producto, cantidad: 1 }]);
    }
    setBusquedaProducto("");
  }

  function cambiarCantidadItem(id, valor) {
    const num = Number(valor);
    if (num <= 0) {
      setItemsCargo(itemsCargo.filter((i) => i.id !== id));
    } else {
      setItemsCargo(itemsCargo.map((i) => (i.id === id ? { ...i, cantidad: num } : i)));
    }
  }

  function quitarItem(id) {
    setItemsCargo(itemsCargo.filter((i) => i.id !== id));
  }

  function formatPrecio(n) {
    return `$${Number(n).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function abrirCliente(cuenta) {
    setCuentaActiva(cuenta);
    setSeccion("info");
    setEditandoInfo(false);
  }

  function iniciarEdicion() {
    setEditNombre(cuentaActivaData.nombre || "");
    setEditTelefono(cuentaActivaData.telefono || "");
    setEditDireccion(cuentaActivaData.direccion || "");
    setEditDni(cuentaActivaData.dni || "");
    setEditTipo(cuentaActivaData.tipoPrecio || "publico");
    setEditandoInfo(true);
  }

  function guardarEdicion() {
    const clienteEditado = { ...cuentas.find((c) => c.id === cuentaActiva.id), nombre: editNombre.trim(), telefono: editTelefono.trim(), direccion: editDireccion.trim(), dni: editDni.trim(), tipoPrecio: editTipo };
    setCuentas(cuentas.map((c) =>
      c.id === cuentaActiva.id ? clienteEditado : c
    ));
    upsertCliente(clienteEditado).catch(console.error);
    setEditandoInfo(false);
  }

  function crearCuenta() {
    setErrorNueva("");
    if (!nombreNueva.trim()) {
      setErrorNueva("Ingresa un nombre.");
      return;
    }
    const nueva = {
      id: Date.now(),
      nombre: nombreNueva.trim(),
      telefono: telefonoNueva.trim(),
      direccion: direccionNueva.trim(),
      dni: dniNueva.trim(),
      tipoPrecio: tipoNueva,
      fechaCreacion: fechaHoy(),
      movimientos: [],
    };
    setCuentas([...cuentas, nueva]);
    upsertCliente(nueva).catch(console.error);
    setModalNuevaCuenta(false);
    setNombreNueva("");
    setTelefonoNueva("");
    setDireccionNueva("");
    setDniNueva("");
    setTipoNueva("publico");
  }

  function confirmarCargo() {
    setErrorCargo("");
    if (itemsCargo.length === 0) {
      setErrorCargo("Agrega al menos un producto.");
      return;
    }
    const nuevoCargo = {
      id: Date.now(),
      fecha: fechaHoy(),
      tipoCc: "cargo",
      monto: totalCargo,
      descripcion: descripcionCargo || `Cargo`,
      tipoCliente: cuentaActiva.tipoPrecio,
      items: itemsCargo.map((i) => ({
        id: i.id,
        nombre: i.nombre,
        cantidad: i.cantidad,
        precio: cuentaActiva.tipoPrecio === "publico" ? Number(i.precioPublico) : Number(i.precioMecanico),
        precioPublico: Number(i.precioPublico),
        precioMecanico: Number(i.precioMecanico),
        marca: i.marca,
      })),
    };
    const clienteConCargo = { ...cuentas.find((c) => c.id === cuentaActiva.id), movimientos: [...(cuentas.find((c) => c.id === cuentaActiva.id)?.movimientos || []), nuevoCargo] };
    setCuentas(cuentas.map((c) =>
      c.id === cuentaActiva.id ? clienteConCargo : c
    ));
    upsertCliente(clienteConCargo).catch(console.error);
    setModalCargo(false);
    setItemsCargo([]);
    setBusquedaProducto("");
    setDescripcionCargo("");
    setErrorCargo("");
  }

  function confirmarPago() {
    setErrorPago("");
    if (!montoPago || Number(montoPago) <= 0) {
      setErrorPago("Ingresa un monto valido.");
      return;
    }
    const nuevoPago = {
      id: Date.now(),
      fecha: fechaHoy(),
      tipoCc: "pago",
      monto: Number(montoPago),
      medioPago,
      descripcion: descripcionPago || `Pago`,
      items: [],
    };
    const clienteConPago = { ...cuentas.find((c) => c.id === cuentaActiva.id), movimientos: [...(cuentas.find((c) => c.id === cuentaActiva.id)?.movimientos || []), nuevoPago] };
    setCuentas(cuentas.map((c) =>
      c.id === cuentaActiva.id ? clienteConPago : c
    ));
    upsertCliente(clienteConPago).catch(console.error);
    const movCaja = {
      id: Date.now() + 1,
      fecha: fechaHoy(),
      categoria: "Cobro a cliente",
      medioPago,
      descripcion: `CC - ${cuentaActiva.nombre}`,
      monto: Number(montoPago),
      tipo: "ingreso",
      items: [],
    };
    upsertMovimiento(movCaja).catch(console.error);
    setModalPago(false);
    setMontoPago("");
    setMedioPago("Efectivo");
    setDescripcionPago("");
    setErrorPago("");
  }

  function actualizarPrecios() {
    const movimientosActualizados = cuentaActiva.movimientos.map((m) => {
      if (m.tipoCc !== "cargo" || !m.items) return m;
      const itemsActualizados = m.items.map((item) => {
        const prodActual = productos.find((p) => p.id === item.id);
        if (!prodActual) return item;
        const nuevoPrecio = cuentaActiva.tipoPrecio === "publico"
          ? Number(prodActual.precioPublico)
          : Number(prodActual.precioMecanico);
        return { ...item, precio: nuevoPrecio };
      });
      const nuevoMonto = itemsActualizados.reduce((acc, i) => acc + i.precio * i.cantidad, 0);
      return { ...m, items: itemsActualizados, monto: nuevoMonto };
    });
    const clienteActualizado = { ...cuentas.find((c) => c.id === cuentaActiva.id), movimientos: movimientosActualizados };
    setCuentas(cuentas.map((c) =>
      c.id === cuentaActiva.id ? clienteActualizado : c
    ));
    upsertCliente(clienteActualizado).catch(console.error);
  }

  const cuentaActivaData = cuentaActiva ? cuentas.find((c) => c.id === cuentaActiva.id) : null;
  const saldoActivo = cuentaActivaData ? saldoCuenta(cuentaActivaData) : 0;
  const diasSinPago = cuentaActivaData ? diasDesde(ultimoMovimiento(cuentaActivaData)) : null;
  const alertaVencimiento = diasSinPago !== null && diasSinPago >= DIAS_ALERTA && saldoActivo > 0;

  const q = busquedaActiva.toLowerCase().trim();
  const cuentasFiltradas = q
    ? cuentas.filter((c) =>
        (c.nombre || "").toLowerCase().includes(q) ||
        (c.dni || "").toLowerCase().includes(q) ||
        (c.telefono || "").toLowerCase().includes(q) ||
        (c.direccion || "").toLowerCase().includes(q)
      )
    : cuentas.slice(0, 50);

  if (cargando) return <div style={{padding:40, textAlign:"center", color:"#6b7280"}}>Cargando...</div>;

  return (
    <div className="contenedor-cc">
      {!cuentaActiva ? (
        <>
          <div className="header-cc">
            <h1>Clientes</h1>
            <button className="boton-nueva-cc" onClick={() => setModalNuevaCuenta(true)}>
              + Nuevo cliente
            </button>
          </div>

          {cuentas.length === 0 ? (
            <p className="sin-datos-cc">No hay clientes registrados.</p>
          ) : (
            <>
              <div className="buscador-cc-wrapper">
                <input
                  type="text"
                  placeholder="Buscar por nombre, DNI, telefono o direccion..."
                  value={busquedaLista}
                  onChange={(e) => setBusquedaLista(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") setBusquedaActiva(busquedaLista); }}
                  className="input-busqueda-cc"
                />
                <button className="boton-buscar-cc" onClick={() => setBusquedaActiva(busquedaLista)}>
                  Buscar
                </button>
              </div>
              <p style={{ fontSize: "0.85rem", color: "#9ca3af", marginBottom: 8 }}>
                {q ? `${cuentasFiltradas.length} resultado${cuentasFiltradas.length !== 1 ? "s" : ""} de ${cuentas.length}` : `Mostrando 50 de ${cuentas.length} clientes`}
              </p>
              <div className="lista-cc">
                {cuentasFiltradas.map((cuenta) => {
                  const saldo = saldoCuenta(cuenta);
                  const ultMov = ultimoMovimiento(cuenta);
                  const dias = diasDesde(ultMov);
                  const alerta = dias !== null && dias >= DIAS_ALERTA && saldo > 0;
                  return (
                    <div
                      key={cuenta.id}
                      className={`card-cc ${alerta ? "card-cc-alerta" : ""}`}
                      onClick={() => abrirCliente(cuenta)}
                    >
                      <div className="card-cc-header">
                        <div>
                          <span className="card-cc-nombre">{cuenta.nombre}</span>
                          {cuenta.telefono && (
                            <span className="card-cc-telefono">{cuenta.telefono}</span>
                          )}
                        </div>
                        <div className="card-cc-header-right">
                          <span className={`badge-tipo-precio ${cuenta.tipoPrecio === "mecanico" ? "badge-mecanico" : "badge-publico"}`}>
                            {cuenta.tipoPrecio === "mecanico" ? "Mecanico" : "Publico"}
                          </span>
                          {alerta && <span className="badge-alerta">{dias} dias sin pago</span>}
                        </div>
                      </div>
                      <div className="card-cc-footer">
                        <span className={`card-cc-saldo ${saldo > 0 ? "saldo-deudor" : "saldo-ok"}`}>
                          {saldo > 0 ? `Debe: ${formatPrecio(saldo)}` : "Sin deuda"}
                        </span>
                        <span className="card-cc-fecha">
                          {ultMov ? `Ultimo mov: ${ultMov}` : "Sin movimientos"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <div className="header-cc">
            <div className="header-cc-left">
              <button className="boton-volver-cc" onClick={() => { setCuentaActiva(null); setEditandoInfo(false); }}>
                Volver
              </button>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <h1 style={{ margin: 0 }}>{cuentaActivaData.nombre}</h1>
                  <span className={`badge-tipo-precio ${cuentaActivaData.tipoPrecio === "mecanico" ? "badge-mecanico" : "badge-publico"}`}>
                    {cuentaActivaData.tipoPrecio === "mecanico" ? "Mecanico" : "Publico"}
                  </span>
                </div>
              </div>
            </div>
            <div className="header-cc-right">
              {!editandoInfo
                ? <button className="boton-volver-cc" onClick={iniciarEdicion}>Editar</button>
                : <button className="boton-volver-cc" onClick={() => setEditandoInfo(false)}>Cancelar</button>
              }
              <button className="boton-pago-cc" onClick={() => setModalPago(true)}>Registrar pago</button>
              <button className="boton-cargo-cc" onClick={() => setModalCargo(true)}>+ Agregar cargo</button>
              <button
                className="boton-eliminar-cc"
                onClick={() => {
                  if (window.confirm(`Eliminar la cuenta de ${cuentaActivaData.nombre}?`)) {
                    setCuentas(cuentas.filter((c) => c.id !== cuentaActiva.id));
                    deleteCliente(cuentaActiva.id).catch(console.error);
                    setCuentaActiva(null);
                  }
                }}
              >🗑 Eliminar</button>
            </div>
          </div>

          {/* Info del cliente */}
          <div className="info-cliente-cc">
            {!editandoInfo ? (
              <div className="info-campos-cc">
                <div className="info-campo-cc"><span className="info-label-cc">Telefono</span><span>{cuentaActivaData.telefono || "-"}</span></div>
                <div className="info-campo-cc"><span className="info-label-cc">Direccion</span><span>{cuentaActivaData.direccion || "-"}</span></div>
                <div className="info-campo-cc"><span className="info-label-cc">DNI</span><span>{cuentaActivaData.dni || "-"}</span></div>
                <div className="info-campo-cc">
                  <span className="info-label-cc">Saldo</span>
                  <span className={saldoActivo > 0 ? "saldo-deudor" : "saldo-ok"} style={{ padding: "4px 10px", borderRadius: 8, fontWeight: 700, display: "inline-block", alignSelf: "flex-start" }}>
                    {saldoActivo > 0 ? `Debe: ${formatPrecio(saldoActivo)}` : "Sin deuda"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="form-edicion-cc">
                <div className="campo-cc"><label>Nombre</label><input className="input-cc" value={editNombre} onChange={(e) => setEditNombre(e.target.value)} /></div>
                <div className="campo-cc"><label>Telefono</label><input className="input-cc" value={editTelefono} onChange={(e) => setEditTelefono(e.target.value)} /></div>
                <div className="campo-cc"><label>Direccion</label><input className="input-cc" value={editDireccion} onChange={(e) => setEditDireccion(e.target.value)} /></div>
                <div className="campo-cc"><label>DNI</label><input className="input-cc" value={editDni} onChange={(e) => setEditDni(e.target.value)} /></div>
                <div className="campo-cc">
                  <label>Tipo de precio</label>
                  <div className="selector-tipo-cliente">
                    <button type="button" className={`boton-cliente ${editTipo === "publico" ? "cliente-activo" : ""}`} onClick={() => setEditTipo("publico")}>Publico</button>
                    <button type="button" className={`boton-cliente ${editTipo === "mecanico" ? "cliente-activo" : ""}`} onClick={() => setEditTipo("mecanico")}>Mecanico</button>
                  </div>
                </div>
                <button className="boton-confirmar-cc" onClick={guardarEdicion}>Guardar</button>
              </div>
            )}
          </div>

          {/* CC */}
          {alertaVencimiento && (
            <div className="alerta-vencimiento">
              <span>Hace {diasSinPago} dias sin pago.</span>
              <button className="boton-actualizar-precios" onClick={actualizarPrecios}>Actualizar precios</button>
            </div>
          )}

          <div className="historial-cc">
              <h2>Historial de movimientos</h2>
              {cuentaActivaData.movimientos.length === 0 ? (
                <p className="sin-datos-cc">No hay movimientos en esta cuenta.</p>
              ) : (
                <table className="tabla-cc">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Tipo</th>
                      <th>Descripcion</th>
                      <th>Detalle</th>
                      <th>Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...cuentaActivaData.movimientos].reverse().map((mov) => (
                      <tr key={mov.id}>
                        <td>{mov.fecha}</td>
                        <td>
                          <span className={`badge-cc ${mov.tipoCc === "cargo" ? "badge-cargo" : "badge-pago"}`}>
                            {mov.tipoCc === "cargo" ? "Cargo" : "Pago"}
                          </span>
                        </td>
                        <td>{mov.descripcion}</td>
                        <td>
                          {mov.items && mov.items.length > 0 && (
                            <ul className="lista-items-cc">
                              {mov.items.map((item, i) => (
                                <li key={i}>{item.nombre} x{item.cantidad} — {formatPrecio(item.precio)}</li>
                              ))}
                            </ul>
                          )}
                        </td>
                        <td className={mov.tipoCc === "cargo" ? "monto-cargo" : "monto-pago"}>
                          {mov.tipoCc === "cargo" ? "+" : "-"}{formatPrecio(mov.monto)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
        </>
      )}

      {/* Modal nueva cuenta */}
      {modalNuevaCuenta && (
        <div className="overlay-cc" onClick={() => setModalNuevaCuenta(false)}>
          <div className="modal-cc" onClick={(e) => e.stopPropagation()}>
            <div className="modal-cc-header">
              <h2>Nuevo cliente</h2>
              <button className="boton-cerrar-modal" onClick={() => setModalNuevaCuenta(false)}>x</button>
            </div>
            <div className="modal-cc-body">
              <div className="campo-cc"><label>Nombre y apellido</label><input type="text" placeholder="Ej: Juan Perez" value={nombreNueva} onChange={(e) => setNombreNueva(e.target.value)} className="input-cc" /></div>
              <div className="campo-cc"><label>Telefono (opcional)</label><input type="text" placeholder="Ej: 351-1234567" value={telefonoNueva} onChange={(e) => setTelefonoNueva(e.target.value)} className="input-cc" /></div>
              <div className="campo-cc"><label>Direccion (opcional)</label><input type="text" placeholder="Ej: Av. Colon 1234" value={direccionNueva} onChange={(e) => setDireccionNueva(e.target.value)} className="input-cc" /></div>
              <div className="campo-cc"><label>DNI (opcional)</label><input type="text" placeholder="Ej: 30123456" value={dniNueva} onChange={(e) => setDniNueva(e.target.value)} className="input-cc" /></div>
              <div className="campo-cc">
                <label>Tipo de precio</label>
                <div className="selector-tipo-cliente">
                  <button type="button" className={`boton-cliente ${tipoNueva === "publico" ? "cliente-activo" : ""}`} onClick={() => setTipoNueva("publico")}>Publico</button>
                  <button type="button" className={`boton-cliente ${tipoNueva === "mecanico" ? "cliente-activo" : ""}`} onClick={() => setTipoNueva("mecanico")}>Mecanico</button>
                </div>
              </div>
              {errorNueva && <p className="error-cc">{errorNueva}</p>}
              <button className="boton-confirmar-cc" onClick={crearCuenta}>Crear cuenta</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal cargo */}
      {modalCargo && (
        <div className="overlay-cc" onClick={() => setModalCargo(false)}>
          <div className="modal-cc modal-cc-grande" onClick={(e) => e.stopPropagation()}>
            <div className="modal-cc-header">
              <h2>Agregar cargo</h2>
              <button className="boton-cerrar-modal" onClick={() => setModalCargo(false)}>x</button>
            </div>
            <div className="modal-cc-body">
              <div className="campo-cc">
                <label>Buscar producto</label>
                <input
                  type="text"
                  placeholder="Codigo o nombre..."
                  value={busquedaProducto}
                  onChange={(e) => setBusquedaProducto(e.target.value)}
                  className="input-cc"
                />
                {productosFiltrados.length > 0 && (
                  <ul className="dropdown-productos">
                    {productosFiltrados.map((p) => (
                      <li key={p.id} onClick={() => agregarProductoCargo(p)} className="dropdown-item">
                        <span className="dropdown-codigo">{p.codigo}</span>
                        <span className="dropdown-nombre">{p.nombre}</span>
                        <span className="dropdown-precio">
                          {formatPrecio(cuentaActivaData.tipoPrecio === "publico" ? p.precioPublico : p.precioMecanico)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {itemsCargo.length > 0 && (
                <div className="campo-cc">
                  <label>Productos</label>
                  <table className="tabla-items-venta">
                    <thead>
                      <tr><th>Producto</th><th>Precio</th><th>Cant.</th><th>Subtotal</th><th></th></tr>
                    </thead>
                    <tbody>
                      {itemsCargo.map((item) => {
                        const precio = cuentaActivaData.tipoPrecio === "publico" ? Number(item.precioPublico) : Number(item.precioMecanico);
                        return (
                          <tr key={item.id}>
                            <td>{item.nombre}</td>
                            <td>{formatPrecio(precio)}</td>
                            <td><input type="number" min="1" value={item.cantidad} onChange={(e) => cambiarCantidadItem(item.id, e.target.value)} className="input-cantidad-item" /></td>
                            <td>{formatPrecio(precio * item.cantidad)}</td>
                            <td><button className="boton-quitar-item" onClick={() => quitarItem(item.id)}>x</button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="total-venta">Total: <strong>{formatPrecio(totalCargo)}</strong></div>
                </div>
              )}

              <div className="campo-cc">
                <label>Descripcion (opcional)</label>
                <input type="text" placeholder="Detalle del cargo..." value={descripcionCargo} onChange={(e) => setDescripcionCargo(e.target.value)} className="input-cc" />
              </div>
              {errorCargo && <p className="error-cc">{errorCargo}</p>}
              <button className="boton-confirmar-cc" onClick={confirmarCargo}>Confirmar cargo</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal pago */}
      {modalPago && (
        <div className="overlay-cc" onClick={() => setModalPago(false)}>
          <div className="modal-cc" onClick={(e) => e.stopPropagation()}>
            <div className="modal-cc-header">
              <h2>Registrar pago</h2>
              <button className="boton-cerrar-modal" onClick={() => setModalPago(false)}>x</button>
            </div>
            <div className="modal-cc-body">
              <div className="campo-cc"><label>Monto</label><input type="number" placeholder="0" value={montoPago} onChange={(e) => setMontoPago(e.target.value)} className="input-cc" /></div>
              <div className="campo-cc">
                <label>Medio de pago</label>
                <select value={medioPago} onChange={(e) => setMedioPago(e.target.value)} className="input-cc">
                  {MEDIOS_PAGO.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="campo-cc"><label>Descripcion (opcional)</label><input type="text" placeholder="Detalle del pago..." value={descripcionPago} onChange={(e) => setDescripcionPago(e.target.value)} className="input-cc" /></div>
              {errorPago && <p className="error-cc">{errorPago}</p>}
              <button className="boton-confirmar-cc" onClick={confirmarPago}>Confirmar pago</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CuentasCorrientes;

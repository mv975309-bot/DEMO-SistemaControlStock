import { useEffect, useState } from "react";
import "../estilos/Dashboard.css";
import { useNavigate } from "react-router-dom";
import { getProductos, getCaja, getServices, getVehiculos, getClientes } from "../lib/db";

const DIAS_ALERTA = 15;

function diasDesde(fechaStr) {
  if (!fechaStr) return null;
  const [d, m, y] = fechaStr.split("/");
  const fecha = new Date(`${y}-${m}-${d}`);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.floor((hoy - fecha) / (1000 * 60 * 60 * 24));
}

function Dashboard() {
  const [productos, setProductos] = useState([]);
  const [caja, setCaja] = useState([]);
  const [services, setServices] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    Promise.all([getProductos(), getCaja(), getServices(), getVehiculos(), getClientes()])
      .then(([ps, ca, sv, vh, cl]) => {
        setProductos(ps);
        setCaja(ca);
        setServices(sv);
        setVehiculos(vh);
        setClientes(cl);
      })
      .catch(console.error)
      .finally(() => setCargando(false));
  }, []);

  const hoy = new Date().toLocaleDateString("es-AR");
  const ayer = new Date();
  ayer.setDate(ayer.getDate() - 1);
  const ayerStr = ayer.toLocaleDateString("es-AR");

  const servicesAyer = services.filter((s) => s.fecha === ayerStr);
  const productosStockBajo = productos.filter(
    (p) => Number(p.stock) <= Number(p.stockMinimo)
  );
  const cajaHoy = caja.filter((m) => m.fecha === hoy);
  const ultimos5Caja = cajaHoy.slice(0, 5);
  const ingresosHoy = cajaHoy
    .filter((m) => m.tipo === "ingreso")
    .reduce((acc, m) => acc + m.monto, 0);
  const egresosHoy = cajaHoy
    .filter((m) => m.tipo === "egreso")
    .reduce((acc, m) => acc + m.monto, 0);

  const cuentasConAlerta = clientes.filter((c) => {
    if ((c.saldo || 0) <= 0) return false;
    const dias = diasDesde(c.ultimoMovimiento);
    return dias !== null && dias >= DIAS_ALERTA;
  });

  function formatPrecio(n) {
    return `$${Number(n).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  const navigate = useNavigate();

  const NAV_ITEMS = [
    { to: "/productos",          icono: "📦", label: "Productos",    color: "#4f46e5" },
    { to: "/caja",               icono: "💰", label: "Caja",         color: "#16a34a" },
    { to: "/cuentas-corrientes", icono: "🧾", label: "Clientes",     color: "#0891b2" },
    { to: "/vehiculos",          icono: "🚗", label: "Vehículos",    color: "#d97706" },
    { to: "/presupuestos",       icono: "📋", label: "Presupuestos", color: "#7c3aed" },
    { to: "/agenda",             icono: "📅", label: "Agenda",       color: "#db2777" },
  ];

  return (
    <div className="contenedor-dashboard">
      <div className="dashboard-top">
        <div className="dashboard-header">
          <div>
            <h1>Luscher HNOS</h1>
            <p className="dashboard-subtitulo">Control de stock</p>
          </div>
        </div>

        {/* Botones de navegación */}
        <div className="nav-grid">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.to}
              className="nav-card"
              style={{ "--nav-color": item.color }}
              onClick={() => navigate(item.to)}
            >
              <span className="nav-card-icono">{item.icono}</span>
              <span className="nav-card-label">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="dashboard-stats">
      {cargando ? (
        <p className="sin-datos" style={{ textAlign: "center", padding: "40px" }}>Cargando...</p>
      ) : (
        <>
          <div className="tarjetas">
            <div className="tarjeta">
              <p className="tarjeta-titulo">Total de productos</p>
              <p className="tarjeta-valor">{productos.length}</p>
            </div>
            <div className="tarjeta tarjeta-alerta">
              <p className="tarjeta-titulo">Stock bajo</p>
              <p className="tarjeta-valor">{productosStockBajo.length}</p>
            </div>
            <div className="tarjeta">
              <p className="tarjeta-titulo">Ingresos de hoy</p>
              <p className="tarjeta-valor" style={{ color: "#16a34a", fontSize: "20px" }}>{formatPrecio(ingresosHoy)}</p>
            </div>
            <div className="tarjeta">
              <p className="tarjeta-titulo">Egresos de hoy</p>
              <p className="tarjeta-valor" style={{ color: "#dc2626", fontSize: "20px" }}>{formatPrecio(egresosHoy)}</p>
            </div>
          </div>

          <div className="dashboard-secciones">
            <div className="seccion-dashboard">
              <div className="seccion-header">
                <h2>Movimientos de hoy</h2>
                <button onClick={() => navigate("/caja")} className="boton-ver-todos">Ver todos</button>
              </div>
              {ultimos5Caja.length === 0 ? (
                <p className="sin-datos">No hay movimientos hoy.</p>
              ) : (
                <table className="tabla-dashboard">
                  <thead>
                    <tr>
                      <th>Categoría</th>
                      <th>Descripción</th>
                      <th>Medio de pago</th>
                      <th>Monto</th>
                      <th>Tipo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ultimos5Caja.map((mov) => (
                      <tr key={mov.id}>
                        <td>{mov.categoria}</td>
                        <td>{mov.descripcion || "—"}</td>
                        <td>{mov.medioPago}</td>
                        <td className={mov.tipo === "ingreso" ? "texto-ingreso" : "texto-egreso"}>
                          {mov.tipo === "egreso" ? "-" : ""}{formatPrecio(mov.monto)}
                        </td>
                        <td>
                          <span className={`badge-tipo ${mov.tipo === "ingreso" ? "badge-entrada" : "badge-salida"}`}>
                            {mov.tipo === "ingreso" ? "Ingreso" : "Egreso"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="seccion-dashboard">
              <div className="seccion-header">
                <h2>Productos con stock bajo</h2>
                {productosStockBajo.length > 0 && (
                  <button onClick={() => navigate("/productos")} className="boton-ver-todos">Ver todos</button>
                )}
              </div>
              {productosStockBajo.length === 0 ? (
                <p className="sin-datos">No hay productos con stock bajo.</p>
              ) : (
                <table className="tabla-dashboard">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Stock actual</th>
                      <th>Stock mínimo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productosStockBajo.slice(0, 5).map((p) => (
                      <tr key={p.id}>
                        <td>{p.nombre}</td>
                        <td className="texto-stock-bajo">{p.stock}</td>
                        <td>{p.stockMinimo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="dashboard-secciones" style={{ marginTop: "30px" }}>
            <div className="seccion-dashboard">
              <div className="seccion-header">
                <h2>Services de ayer</h2>
                <button onClick={() => navigate("/vehiculos")} className="boton-ver-todos">Ver todos</button>
              </div>
              {servicesAyer.length === 0 ? (
                <p className="sin-datos">No hubo services ayer.</p>
              ) : (
                <table className="tabla-dashboard">
                  <thead>
                    <tr>
                      <th>Patente</th>
                      <th>Modelo</th>
                      <th>Km</th>
                      <th>Observaciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {servicesAyer.map((s) => {
                      const vehiculo = vehiculos.find((v) => String(v.id) === String(s.vehiculoId));
                      return (
                        <tr key={s.id}>
                          <td>{vehiculo?.patente || "-"}</td>
                          <td>{vehiculo?.modelo || "-"}</td>
                          <td>{s.kilometraje || "-"}</td>
                          <td>{s.observaciones || "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="seccion-dashboard">
              <div className="seccion-header">
                <h2>Alerta de CC en deuda</h2>
                <button onClick={() => navigate("/cuentas-corrientes")} className="boton-ver-todos">Ver todas</button>
              </div>
              {cuentasConAlerta.length === 0 ? (
                <p className="sin-datos">No hay cuentas con pagos pendientes.</p>
              ) : (
                <table className="tabla-dashboard">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Saldo</th>
                      <th>Días sin pago</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cuentasConAlerta.map((c) => {
                      const dias = diasDesde(c.ultimoMovimiento);
                      return (
                        <tr
                          key={c.id}
                          className="fila-alerta-cc"
                          onClick={() => navigate("/cuentas-corrientes")}
                          style={{ cursor: "pointer" }}
                        >
                          <td>{c.nombre}</td>
                          <td className="texto-egreso">{formatPrecio(c.saldo)}</td>
                          <td>
                            <span className="badge-dias-sin-pago">{dias} días</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
      </div>
    </div>
  );
}

export default Dashboard;

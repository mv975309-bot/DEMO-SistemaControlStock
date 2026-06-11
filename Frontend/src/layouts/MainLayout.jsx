import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import "../estilos/MainLayout.css";

const NAV_ITEMS = [
  { to: "/",                   icono: "📊", label: "Dashboard"    },
  { to: "/productos",          icono: "📦", label: "Productos"    },
  { to: "/caja",               icono: "💰", label: "Caja"         },
  { to: "/cuentas-corrientes", icono: "🧾", label: "Clientes"     },
  { to: "/vehiculos",          icono: "🚗", label: "Vehículos"    },
  { to: "/presupuestos",       icono: "📋", label: "Presupuestos" },
  { to: "/agenda",             icono: "📅", label: "Agenda"       },
];

function MainLayout({ children }) {
  const location = useLocation();
  const esDashboard = location.pathname === "/";
  const [sidebarAbierto, setSidebarAbierto] = useState(true);

  return (
    <div className="layout">
      {/* Sidebar — solo en páginas que no son el dashboard */}
      {!esDashboard && (
        <aside className={`sidebar ${sidebarAbierto ? "" : "sidebar-cerrado"}`}>
          {sidebarAbierto && (
            <>
              <div className="sidebar-header">
                <h2 className="sidebar-titulo">Mi Empresa</h2>
                <p className="sidebar-subtitulo">Control de stock</p>
              </div>
              <nav className="sidebar-nav">
                {NAV_ITEMS.map((item) => (
                  <Link key={item.to} to={item.to}
                    className={`sidebar-link ${location.pathname === item.to ? "sidebar-link-activo" : ""}`}>
                    <span className="sidebar-icono">{item.icono}</span>
                    {item.label}
                  </Link>
                ))}
              </nav>
              <div className="sidebar-footer"><p>v1.0.0</p></div>
            </>
          )}
          <button className="boton-toggle-sidebar" onClick={() => setSidebarAbierto(!sidebarAbierto)}>
            {sidebarAbierto ? "✕" : "☰"}
          </button>
        </aside>
      )}

      <main className={
        !esDashboard
          ? `contenido-principal ${sidebarAbierto ? "" : "contenido-expandido"}`
          : "contenido-principal contenido-expandido"
      }>
        {children}
      </main>

      {/* Bottom nav — solo en mobile */}
      <nav className="bottom-nav">
        {NAV_ITEMS.map((item) => (
          <Link key={item.to} to={item.to}
            className={`bottom-nav-item ${location.pathname === item.to ? "bottom-nav-activo" : ""}`}>
            <span className="bottom-nav-icono">{item.icono}</span>
            <span className="bottom-nav-label">{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

export default MainLayout;
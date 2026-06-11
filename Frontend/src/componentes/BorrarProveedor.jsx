import { useState } from "react";
import ReactDOM from "react-dom";
import "../estilos/BorrarProveedor.css";
import { deleteProductosByProveedor, deleteProductosSinProveedor } from "../lib/db";

const SIN_PROVEEDOR = "__sin_proveedor__";

function BorrarProveedor({ productos, onBorrar, abierto, onCerrar }) {
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState("");
  const [confirmando, setConfirmando] = useState(false);

  // Proveedores únicos por campo proveedor + opción sin proveedor
  const proveedores = [...new Set(productos.map((p) => p.proveedor).filter(Boolean))];
  const tieneSinProveedor = productos.some((p) => !p.proveedor);

  const cantidadProductos = proveedorSeleccionado === SIN_PROVEEDOR
    ? productos.filter((p) => !p.proveedor).length
    : productos.filter((p) => p.proveedor === proveedorSeleccionado).length;

  async function handleBorrar() {
    try {
      if (proveedorSeleccionado === SIN_PROVEEDOR) {
        await deleteProductosSinProveedor();
        onBorrar(productos.filter((p) => p.proveedor && p.proveedor.trim() !== ""));
      } else {
        await deleteProductosByProveedor(proveedorSeleccionado);
        onBorrar(productos.filter((p) => p.proveedor !== proveedorSeleccionado));
      }
    } catch (err) {
      alert("Error al eliminar: " + err.message);
    }
    cerrar();
  }

  function cerrar() {
    setProveedorSeleccionado("");
    setConfirmando(false);
    onCerrar?.();
  }

  return (
    <>
      {abierto && ReactDOM.createPortal(
        <div className="borrar-overlay" onClick={cerrar}>
          <div className="borrar-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, flex: 1 }}>Borrar lista de proveedor</h2>
              <button onClick={cerrar} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#6b7280", lineHeight: 1, padding: "0 0 0 16px", flexShrink: 0 }}>✕</button>
            </div>

            {!confirmando ? (
              <div className="borrar-body">
                <p className="borrar-label">Seleccioná el proveedor a eliminar</p>

                {proveedores.length === 0 && !tieneSinProveedor ? (
                  <p className="borrar-vacio">No hay proveedores cargados.</p>
                ) : (
                  <>
                    <select
                      className="input-producto"
                      value={proveedorSeleccionado}
                      onChange={(e) => {
                        setProveedorSeleccionado(e.target.value);
                        setConfirmando(false);
                      }}
                    >
                      <option value="">Seleccioná un proveedor</option>
                      {tieneSinProveedor && (
                        <option value={SIN_PROVEEDOR}>— Sin proveedor —</option>
                      )}
                      {proveedores.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>

                    {proveedorSeleccionado && (
                      <div className="borrar-info">
                        <p>
                          Se van a eliminar{" "}
                          <strong>{cantidadProductos} productos</strong> de{" "}
                          <strong>{proveedorSeleccionado}</strong>.
                        </p>
                        <button
                          className="boton-confirmar-borrar"
                          onMouseDown={(e) => { e.stopPropagation(); setConfirmando(true); }}
                        >
                          Continuar
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="borrar-body">
                <div className="borrar-advertencia">
                  <p>⚠️ ¿Estás seguro que querés eliminar todos los productos {proveedorSeleccionado === SIN_PROVEEDOR ? <strong>sin proveedor</strong> : <>de <strong>{proveedorSeleccionado}</strong></>}?</p>
                  <p className="borrar-advertencia-sub">Esta acción no se puede deshacer.</p>
                </div>

                <div className="borrar-botones">
                  <button
                    className="boton-cancelar"
                    onMouseDown={(e) => { e.stopPropagation(); setConfirmando(false); }}
                  >
                    Cancelar
                  </button>
                  <button
                    className="boton-eliminar"
                    onMouseDown={(e) => { e.stopPropagation(); handleBorrar(); }}
                  >
                    Sí, eliminar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      , document.body)}
    </>
  );
}

export default BorrarProveedor;
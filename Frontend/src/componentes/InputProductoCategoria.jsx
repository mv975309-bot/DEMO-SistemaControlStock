import { useState, useMemo, useRef, useEffect } from "react";

/**
 * Input con autocompletado filtrado por categoría.
 * Props:
 *   value, onChange — igual que un input normal
 *   productos       — lista completa de productos
 *   categorias      — array de strings con las categorías a mostrar (ej: ["Aceites"])
 *   placeholder, className, alertaStock
 */
function InputProductoCategoria({ value, onChange, productos = [], categorias = [], placeholder, className, alertaStock }) {
  const [abierto, setAbierto] = useState(false);
  const wrapperRef = useRef(null);

  const sugerencias = useMemo(() => {
    if (!value.trim() || value.length < 1) return [];
    const q = value.toLowerCase();
    return productos
      .filter((p) => {
        const enCategoria = categorias.length === 0 || categorias.some((cat) =>
          (p.categoria || "").toLowerCase().includes(cat.toLowerCase())
        );
        const coincide =
          (p.codigo && p.codigo.toLowerCase().includes(q)) ||
          (p.nombre && p.nombre.toLowerCase().includes(q));
        return enCategoria && coincide;
      })
      .slice(0, 8);
  }, [value, productos, categorias]);

  // Cerrar al hacer click afuera
  useEffect(() => {
    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setAbierto(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function seleccionar(producto) {
    onChange({ target: { value: producto.codigo || producto.nombre } });
    setAbierto(false);
  }

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      <input
        type="text"
        value={value}
        onChange={(e) => { onChange(e); setAbierto(true); }}
        onFocus={() => setAbierto(true)}
        placeholder={placeholder}
        className={className}
      />
      {abierto && sugerencias.length > 0 && (
        <ul style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 200,
          background: "white", border: "1px solid #e5e7eb", borderRadius: 8,
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)", listStyle: "none",
          margin: "2px 0 0", padding: "4px 0", maxHeight: 220, overflowY: "auto",
        }}>
          {sugerencias.map((p) => (
            <li
              key={p.id}
              onMouseDown={(e) => { e.preventDefault(); seleccionar(p); }}
              style={{
                padding: "8px 12px", cursor: "pointer", fontSize: 13,
                display: "flex", justifyContent: "space-between", alignItems: "center",
                gap: 8,
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "#f3f4f6"}
              onMouseLeave={(e) => e.currentTarget.style.background = "white"}
            >
              <span>
                <strong style={{ color: "#1d4ed8", marginRight: 6 }}>{p.codigo}</strong>
                <span style={{ color: "#374151" }}>{p.nombre}</span>
              </span>
              <span style={{ color: "#6b7280", fontSize: 11, whiteSpace: "nowrap" }}>
                stock: {p.stock}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default InputProductoCategoria;

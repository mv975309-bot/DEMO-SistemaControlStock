import { useEffect, useState, useMemo } from "react";
import "../estilos/Productos.css";
import Importador from "../componentes/Importador";
import { CATEGORIAS_FIJAS } from "../utilidades/categorias";
import { getProductos, upsertProducto, upsertProductos, deleteProducto, getCategorias, upsertCategorias, deleteProductosByProveedor } from "../lib/db";
import BorrarProveedor from "../componentes/BorrarProveedor";
import { calcularPrecios } from "../utilidades/proveedores";
import * as XLSX from "xlsx";

function ExportarStockBajoFn(productos) {
  const stockBajo = productos.filter((p) => Number(p.stock) <= Number(p.stockMinimo));
  if (stockBajo.length === 0) { alert("No hay productos con stock bajo."); return; }
  const filas = stockBajo.map((p) => ({ Código: p.codigo, Nombre: p.nombre, "Cantidad a pedir": "" }));
  const hoja = XLSX.utils.json_to_sheet(filas);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Stock bajo");
  XLSX.writeFile(libro, "pedido_stock_bajo.xlsx");
}

function formatPrecio(n) {
  if (n === null || n === undefined || n === "") return "-";
  return "$" + Number(n).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Productos() {
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [categoriasPersonalizadasState, setCategoriasPersonalizadasState] = useState([]);

  const [codigo, setCodigo] = useState("");
  const [nombre, setNombre] = useState("");
  const [marca, setMarca] = useState("");
  const [categoria, setCategoria] = useState("");
  const [categoriaPersonalizada, setCategoriaPersonalizada] = useState("");
  const [mostrarNuevaCategoria, setMostrarNuevaCategoria] = useState(false);
  const [precioLista, setPrecioLista] = useState("");
  const [stock, setStock] = useState("");
  const [stockMinimo, setStockMinimo] = useState("");

  const [busqueda, setBusqueda] = useState("");
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroProveedor, setFiltroProveedor] = useState("");
  const [orden, setOrden] = useState("ultimos");
  const [editandoId, setEditandoId] = useState(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);

  const [modoEdicion, setModoEdicion] = useState(false);
  const [filaEditando, setFilaEditando] = useState(null);
  const [valoresEdicion, setValoresEdicion] = useState({});

  // Modal ingreso de mercadería
  const [modalIngreso, setModalIngreso] = useState(false);
  const [busquedaIngreso, setBusquedaIngreso] = useState("");
  const [productoIngreso, setProductoIngreso] = useState(null);
  const [cantidadIngreso, setCantidadIngreso] = useState("");
  const [precioListaIngreso, setPrecioListaIngreso] = useState("");
  const [errorIngreso, setErrorIngreso] = useState("");

  const [menuAbierto, setMenuAbierto] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const [modalBorrar, setModalBorrar] = useState(false);
  const [modalImportar, setModalImportar] = useState(false);
  const [equivPopup, setEquivPopup] = useState(null); // { productoId, x, y }

  useEffect(() => {
    Promise.all([getProductos(), getCategorias()])
      .then(([ps, cats]) => { setProductos(ps); setCategoriasPersonalizadasState(cats); })
      .catch(console.error)
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    if (!menuAbierto) return;
    const cerrar = () => setMenuAbierto(false);
    window.addEventListener("scroll", cerrar, { capture: true, passive: true });
    return () => {
      window.removeEventListener("scroll", cerrar, { capture: true, passive: true });
    };
  }, [menuAbierto]);

  // Migración única: recalcular precios de todos los productos con la fórmula correcta
  useEffect(() => {
    if (localStorage.getItem("preciosMigradosV3")) return;
    setProductos((prev) => prev.map((p) => {
      if (!p.precioLista || parseFloat(p.precioLista) <= 0) return p;
      const { precioPublico, precioMecanico } = calcularPrecios(parseFloat(p.precioLista));
      return { ...p, precioPublico, precioMecanico };
    }));
    localStorage.setItem("preciosMigradosV3", "1");
  }, []);


  // Equivalencias: para cada código, buscar otros códigos usados en el mismo slot y modelo de vehículo
  const equivalencias = useMemo(() => {
    const services = JSON.parse(localStorage.getItem("services") || "[]");
    const vehiculos = JSON.parse(localStorage.getItem("vehiculos") || "[]");
    const modeloPorVehiculo = {};
    vehiculos.forEach((v) => { modeloPorVehiculo[v.id] = (v.modelo || "").trim().toUpperCase(); });

    const SLOTS = ["aceite", "filtroAceite", "filtroAire", "filtroCombustible", "filtroHabitaculo"];
    // Valores que no son códigos reales
    const NO_CODIGO = new Set(["-", "si", "no", "s", "n", "sí", "SI", "NO", "SÍ", "S", "N", "x", "X", ""]);
    function esCodigo(val) {
      if (!val) return false;
      const v = val.trim();
      if (!v || v.length < 2) return false;
      if (NO_CODIGO.has(v)) return false;
      // Filtrar variantes de "no tiene", "no posee", solo guiones, etc.
      const lower = v.toLowerCase()
        .replace(/\u00e1/g,"a").replace(/\u00e9/g,"e").replace(/\u00ed/g,"i").replace(/\u00f3/g,"o").replace(/\u00fa/g,"u");
      if (lower === "no tiene" || lower === "no posee" || lower === "no aplica" ||
          lower === "n/a" || lower === "na" || lower === "ninguno" || lower === "ninguna") return false;
      if (/^-+$/.test(v)) return false; // solo guiones
      return true;
    }
    // (modelo, slot) → Set de códigos usados
    const grupos = {};
    // código → Set de modelos donde se usó
    const codigoModelos = {};
    const normModelo = (m) => (m || "").replace(/,/g, ".");
    services.forEach((s) => {
      const modelo = normModelo(modeloPorVehiculo[s.vehiculoId]);
      if (!modelo) return;
      SLOTS.forEach((slot) => {
        const val = (s[slot] || "").trim();
        if (!esCodigo(val)) return;
        const key = modelo + "||" + slot;
        if (!grupos[key]) grupos[key] = new Set();
        grupos[key].add(val);
        if (!codigoModelos[val]) codigoModelos[val] = new Set();
        codigoModelos[val].add(modelo);
      });
    });

    // código → Set de equivalentes
    const map = {};
    Object.values(grupos).forEach((codesSet) => {
      if (codesSet.size < 2) return;
      const arr = [...codesSet];
      arr.forEach((c) => {
        if (!map[c]) map[c] = new Set();
        arr.forEach((otro) => { if (otro !== c) map[c].add(otro); });
      });
    });

    // Convertir Sets a arrays
    const equivMap = {};
    Object.entries(map).forEach(([k, v]) => { equivMap[k] = [...v]; });
    const modelosMap = {};
    Object.entries(codigoModelos).forEach(([k, v]) => { modelosMap[k] = [...v].sort(); });
    console.log("Equivalencias calculadas:", Object.keys(equivMap).length, "códigos con equiv.");
    return { equivMap, modelosMap };
  }, []);

  // Para un producto, obtener sus equivalencias buscando por código y por nombre
  function getEquivProducto(producto) {
    const { equivMap } = equivalencias;
    const byCode = producto.codigo ? (equivMap[producto.codigo] || []) : [];
    const byNombre = producto.nombre ? (equivMap[producto.nombre] || []) : [];
    const todos = [...new Set([...byCode, ...byNombre])];
    return todos.filter((e) => e !== producto.codigo && e !== producto.nombre);
  }

  // Para un producto, obtener los modelos de vehículo donde se usó
  function getModelosProducto(producto) {
    const { modelosMap } = equivalencias;
    const byCode = producto.codigo ? (modelosMap[producto.codigo] || []) : [];
    const byNombre = producto.nombre ? (modelosMap[producto.nombre] || []) : [];
    const todos = [...new Set([...byCode, ...byNombre])].sort();
    // Si un modelo es prefijo de otro más específico, quedarse solo con el más específico
    return todos.filter((m) => !todos.some((otro) => otro !== m && otro.startsWith(m) && otro[m.length] === " "));
  }




  const todasLasCategorias = [...CATEGORIAS_FIJAS, ...categoriasPersonalizadasState];

  // Usar calcularPrecios para aplicar la misma lógica que el modo edición inline y el importador
  const { precioPublico, precioMecanico } = precioLista
    ? calcularPrecios(parseFloat(precioLista), marca || "")
    : { precioPublico: null, precioMecanico: null };

  function handleCategoriaChange(e) {
    const valor = e.target.value;
    if (valor === "__nueva__") {
      setMostrarNuevaCategoria(true);
      setCategoria("");
    } else {
      setMostrarNuevaCategoria(false);
      setCategoria(valor);
    }
  }

  function guardarNuevaCategoria() {
    const nueva = categoriaPersonalizada.trim();
    if (!nueva) return;
    if (!categoriasPersonalizadasState.includes(nueva)) {
      const nuevasCats = [...categoriasPersonalizadasState, nueva];
      setCategoriasPersonalizadasState(nuevasCats);
      upsertCategorias([nueva]).catch(console.error);
    }
    setCategoria(nueva);
    setCategoriaPersonalizada("");
    setMostrarNuevaCategoria(false);
  }

  function agregarProducto(e) {
    e.preventDefault();
    const productoData = {
      codigo, nombre, marca, categoria,
      precioLista, precioPublico, precioMecanico,
      stock, stockMinimo,
    };
    if (editandoId) {
      const editado = { ...productos.find((p) => p.id === editandoId), ...productoData };
      setProductos(productos.map((p) =>
        p.id === editandoId ? editado : p
      ));
      upsertProducto(editado).catch((err) => { console.error(err); alert("Error al guardar: " + err.message); });
    } else {
      const nuevo = { id: Date.now(), ...productoData };
      setProductos([...productos, nuevo]);
      upsertProducto(nuevo).catch((err) => { console.error(err); alert("Error al guardar: " + err.message); });
    }
    limpiarFormulario();
  }

  function eliminarProducto(id) {
    setProductos(productos.filter((p) => p.id !== id));
    deleteProducto(id).catch((err) => { console.error(err); alert("Error al eliminar: " + err.message); });
  }

  function editarProducto(producto) {
    setMostrarFormulario(true);
    setCodigo(producto.codigo);
    setNombre(producto.nombre);
    setMarca(producto.marca);
    setCategoria(producto.categoria);
    setPrecioLista(producto.precioLista);
    setStock(producto.stock);
    setStockMinimo(producto.stockMinimo);
    setEditandoId(producto.id);
  }

  function limpiarFormulario() {
    setCodigo(""); setNombre(""); setMarca(""); setCategoria("");
    setCategoriaPersonalizada(""); setMostrarNuevaCategoria(false);
    setPrecioLista(""); setStock(""); setStockMinimo("");
    setEditandoId(null); setMostrarFormulario(false);
  }

  function activarEdicionFila(producto) {
    setFilaEditando(producto.id);
    setValoresEdicion({ ...producto });
  }

  function cancelarEdicionFila() {
    setFilaEditando(null);
    setValoresEdicion({});
  }

  function handleCambioEdicion(campo, valor) {
    const nuevos = { ...valoresEdicion, [campo]: valor };
    if (campo === "precioLista" && valor) {
      const { precioPublico, precioMecanico } = calcularPrecios(
        parseFloat(valor),
        nuevos.marca || ""
      );
      nuevos.precioPublico = precioPublico;
      nuevos.precioMecanico = precioMecanico;
    }
    setValoresEdicion(nuevos);
  }

  function guardarEdicionFila() {
    const productoEditado = { ...productos.find((p) => p.id === filaEditando), ...valoresEdicion };
    setProductos(productos.map((p) =>
      p.id === filaEditando ? productoEditado : p
    ));
    upsertProducto(productoEditado).catch(console.error);
    setFilaEditando(null);
    setValoresEdicion({});
  }

  // Ingreso de mercadería
  const productosBusquedaIngreso = busquedaIngreso.trim()
    ? productos.filter((p) =>
        p.nombre.toLowerCase().includes(busquedaIngreso.toLowerCase()) ||
        (p.codigo && p.codigo.toLowerCase().includes(busquedaIngreso.toLowerCase()))
      ).slice(0, 8)
    : [];

  function seleccionarProductoIngreso(p) {
    setProductoIngreso(p);
    setBusquedaIngreso(p.nombre);
    setPrecioListaIngreso("");
  }

  function confirmarIngreso() {
    setErrorIngreso("");
    if (!productoIngreso) {
      setErrorIngreso("Seleccioná un producto.");
      return;
    }
    if (!cantidadIngreso || Number(cantidadIngreso) <= 0) {
      setErrorIngreso("Ingresá una cantidad válida.");
      return;
    }

    let productoActualizado = null;
    const nuevosProductos = productos.map((p) => {
      if (p.id !== productoIngreso.id) return p;

      const nuevoStock = Number(p.stock) + Number(cantidadIngreso);

      // Si se ingresó nuevo precio lista, recalcular precios
      if (precioListaIngreso && parseFloat(precioListaIngreso) > 0) {
        const { precioPublico, precioMecanico } = calcularPrecios(
          parseFloat(precioListaIngreso),
          p.marca || ""
        );
        productoActualizado = { ...p, stock: nuevoStock, precioLista: precioListaIngreso, precioPublico, precioMecanico };
        return productoActualizado;
      }

      productoActualizado = { ...p, stock: nuevoStock };
      return productoActualizado;
    });
    setProductos(nuevosProductos);
    if (productoActualizado) upsertProducto(productoActualizado).catch(console.error);

    cerrarModalIngreso();
  }

  function cerrarModalIngreso() {
    setModalIngreso(false);
    setBusquedaIngreso("");
    setProductoIngreso(null);
    setCantidadIngreso("");
    setPrecioListaIngreso("");
    setErrorIngreso("");
  }

  const productosFiltrados = productos
    .filter((p) => {
      const textoBusqueda = busqueda.toLowerCase().trim();
      const coincideBusqueda =
        (p.nombre || "").toLowerCase().includes(textoBusqueda) ||
        (p.codigo || "").toLowerCase().includes(textoBusqueda);
      const coincideCategoria =
        filtroCategoria === "" ||
        (p.categoria || "").toLowerCase().trim() === filtroCategoria.toLowerCase().trim();
      const coincideProveedor =
        filtroProveedor === "" ||
        (p.marca || "").toLowerCase().trim() === filtroProveedor.toLowerCase().trim();
      return coincideBusqueda && coincideCategoria && coincideProveedor;
    })
    .sort((a, b) => {
      if (orden === "ultimos") return b.id - a.id;
      if (orden === "az") return a.nombre.localeCompare(b.nombre);
      if (orden === "za") return b.nombre.localeCompare(a.nombre);
      if (orden === "mayorprecio") return Number(b.precioPublico) - Number(a.precioPublico);
      if (orden === "menorprecio") return Number(a.precioPublico) - Number(b.precioPublico);
      return 0;
    });

  const filtrosActivos = filtroCategoria || filtroProveedor || orden !== "ultimos";

  const proveedoresUnicos = [...new Set(
    productos.map((p) => (p.marca || "").trim()).filter(Boolean)
  )];
  const categoriasUnicas = [...new Set(
    productos.map((p) => (p.categoria || "").trim()).filter(Boolean)
  )];

  if (cargando) return <div style={{padding:40, textAlign:"center", color:"#6b7280"}}>Cargando...</div>;

  return (
    <div className="contenedor-productos">
      <div className="header-productos">
  <h1>Productos</h1>
  <div className="header-botones">
    <div className="menu-acciones-wrapper">
      <button
        className="boton-menu-acciones"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          const rect = e.currentTarget.getBoundingClientRect();
          setMenuPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
          setMenuAbierto(!menuAbierto);
        }}
      >
        ⚙️ Acciones {menuAbierto ? "▲" : "▼"}
      </button>
      {menuAbierto && (
        <>
        <div
          style={{ position: "fixed", inset: 0, zIndex: 99 }}
          onClick={() => setMenuAbierto(false)}
        />
        <div className="dropdown-acciones" style={{ top: menuPos.top, right: menuPos.right, zIndex: 100 }}>
          <button className="boton-borrar-proveedor boton-dropdown-item"
            onMouseDown={(e) => { e.stopPropagation(); setMenuAbierto(false); setModalBorrar(true); }}>
            🗑️ Borrar lista
          </button>
          <button className="boton-importar boton-dropdown-item"
            onMouseDown={(e) => { e.stopPropagation(); setMenuAbierto(false); setModalImportar(true); }}>
            📥 Importar lista
          </button>
          <button className="boton-exportar boton-dropdown-item"
            onMouseDown={(e) => { e.stopPropagation(); setMenuAbierto(false);
              ExportarStockBajoFn(productos);
            }}>
            📤 Exportar stock bajo
          </button>
          <button
            className={`boton-modo-edicion boton-dropdown-item ${modoEdicion ? "modo-edicion-activo" : ""}`}
            onClick={() => { setModoEdicion(!modoEdicion); setFilaEditando(null); setValoresEdicion({}); setMenuAbierto(false); }}
          >
            ✏️ {modoEdicion ? "Salir de edición" : "Modo edición"}
          </button>
        </div>
        </>
      )}
      {/* Modales siempre montados fuera del dropdown */}
      <BorrarProveedor productos={productos} onBorrar={setProductos} abierto={modalBorrar} onCerrar={() => setModalBorrar(false)} />
      <Importador productos={productos} onImportar={setProductos} abierto={modalImportar} onCerrar={() => setModalImportar(false)} />
    </div>
    <button
      className="boton-ingresar-mercaderia"
      onClick={() => setModalIngreso(true)}
    >
      Ingresar mercadería
    </button>
    <button
      onClick={() => setMostrarFormulario(!mostrarFormulario)}
      className="boton-nuevo-producto"
    >
      + Nuevo producto
    </button>
  </div>
</div>

      {mostrarFormulario && (
        <div className="overlay-ingreso" onClick={limpiarFormulario}>
          <div className="modal-ingreso" onClick={(e) => e.stopPropagation()}>
            <div className="modal-ingreso-header">
              <h2>{editandoId ? "Editar producto" : "Nuevo producto"}</h2>
              <button onClick={limpiarFormulario} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#6b7280" }}>✕</button>
            </div>
            <form onSubmit={agregarProducto} className="modal-ingreso-body">
              <div className="campo-ingreso">
                <label>Código</label>
                <input type="text" placeholder="Código" value={codigo}
                  onChange={(e) => setCodigo(e.target.value)} className="input-producto" />
              </div>
              <div className="campo-ingreso">
                <label>Nombre *</label>
                <input type="text" placeholder="Nombre del producto" value={nombre}
                  onChange={(e) => setNombre(e.target.value)} className="input-producto" required />
              </div>
              <div className="campo-ingreso">
                <label>Marca</label>
                <input type="text" placeholder="Marca" value={marca}
                  onChange={(e) => setMarca(e.target.value)} className="input-producto" />
              </div>
              <div className="campo-ingreso">
                <label>Categoría</label>
                <select value={mostrarNuevaCategoria ? "__nueva__" : categoria}
                  onChange={handleCategoriaChange} className="input-producto">
                  <option value="">Seleccioná una categoría</option>
                  {todasLasCategorias.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                  <option value="__nueva__">+ Nueva categoría</option>
                </select>
                {mostrarNuevaCategoria && (
                  <div className="nueva-categoria-container" style={{ marginTop: 8 }}>
                    <input type="text" placeholder="Nueva categoría"
                      value={categoriaPersonalizada}
                      onChange={(e) => setCategoriaPersonalizada(e.target.value)}
                      className="input-producto" />
                    <button type="button" onClick={guardarNuevaCategoria} className="boton-guardar">OK</button>
                  </div>
                )}
              </div>
              <div className="campo-ingreso">
                <label>Precio de lista</label>
                <input type="number" placeholder="0" value={precioLista}
                  onChange={(e) => setPrecioLista(e.target.value)} className="input-producto" />
                {precioLista && (
                  <div className="precios-calculados" style={{ marginTop: 8 }}>
                    <div className="precio-calculado">
                      <span className="precio-label">Precio público</span>
                      <span className="precio-valor">{formatPrecio(precioPublico)}</span>
                    </div>
                    <div className="precio-calculado">
                      <span className="precio-label">Precio mecánico</span>
                      <span className="precio-valor precio-mecanico">{formatPrecio(precioMecanico)}</span>
                    </div>
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <div className="campo-ingreso" style={{ flex: 1 }}>
                  <label>Stock actual</label>
                  <input type="number" placeholder="0" value={stock}
                    onChange={(e) => setStock(e.target.value)} className="input-producto" />
                </div>
                <div className="campo-ingreso" style={{ flex: 1 }}>
                  <label>Stock mínimo</label>
                  <input type="number" placeholder="0" value={stockMinimo}
                    onChange={(e) => setStockMinimo(e.target.value)} className="input-producto" />
                </div>
              </div>
              <button type="submit" className="boton-guardar" style={{ marginTop: 8, padding: "12px", fontSize: 15, fontWeight: 700, borderRadius: 10, background: "#4f46e5", color: "white", border: "none", cursor: "pointer" }}>
                {editandoId ? "Guardar cambios" : "Guardar producto"}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="barra-filtros">
        <input
          type="text"
          placeholder="Buscar por nombre o código..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="input-producto input-busqueda"
        />
        <button
          className={`boton-filtros ${filtrosActivos ? "filtros-con-seleccion" : ""}`}
          onClick={() => setMostrarFiltros(!mostrarFiltros)}
        >
          🔽 Filtros {filtrosActivos ? "●" : ""}
        </button>
      </div>

      {mostrarFiltros && (
        <div className="panel-filtros">
          <button className="panel-filtros-cerrar" onClick={() => setMostrarFiltros(false)}>✖</button>

          <div className="filtro-grupo">
            <label className="filtro-label">Categoría</label>
            <select className="input-producto" value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}>
              <option value="">Todas</option>
              {categoriasUnicas.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="filtro-grupo">
            <label className="filtro-label">Proveedor</label>
            <select className="input-producto" value={filtroProveedor}
              onChange={(e) => setFiltroProveedor(e.target.value)}>
              <option value="">Todos</option>
              {proveedoresUnicos.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="filtro-grupo">
            <label className="filtro-label">Ordenar por</label>
            <select className="input-producto" value={orden}
              onChange={(e) => setOrden(e.target.value)}>
              <option value="ultimos">Últimos agregados</option>
              <option value="az">Nombre A-Z</option>
              <option value="za">Nombre Z-A</option>
              <option value="mayorprecio">Precio mayor a menor</option>
              <option value="menorprecio">Precio menor a mayor</option>
            </select>
          </div>

          <button className="boton-limpiar-filtros" onClick={() => {
            setFiltroCategoria("");
            setFiltroProveedor("");
            setOrden("ultimos");
          }}>
            Limpiar filtros
          </button>
        </div>
      )}

      <div className="lista-productos">
        <h2>Lista de productos ({productosFiltrados.length})</h2>
        <div className="tabla-wrapper">
          <table className="tabla-productos">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Marca</th>
                <th>Cat.</th>
                <th>P. Lista</th>
                <th>P. Público</th>
                <th>P. Mecánico</th>
                <th>Stock</th>
                <th>Mín.</th>
                <th>Equiv.</th>
              </tr>
            </thead>
            <tbody>
              {productosFiltrados.map((producto) => {
                const stockBajo = Number(producto.stock) <= Number(producto.stockMinimo);
                const estaEditando = filaEditando === producto.id;

                return (
                  <tr
                    key={producto.id}
                    className={`
                      ${stockBajo ? "fila-stock-bajo" : ""}
                      ${modoEdicion && !estaEditando ? "fila-editable" : ""}
                      ${estaEditando ? "fila-en-edicion" : ""}
                    `}
                    onClick={() => {
                      if (modoEdicion && !estaEditando && !filaEditando) {
                        activarEdicionFila(producto);
                      }
                    }}
                  >
                    <td>{estaEditando
                      ? <input className="input-inline" value={valoresEdicion.codigo || ""}
                          onChange={(e) => handleCambioEdicion("codigo", e.target.value)} />
                      : producto.codigo}
                    </td>
                    <td>{estaEditando
                      ? <input className="input-inline" value={valoresEdicion.nombre || ""}
                          onChange={(e) => handleCambioEdicion("nombre", e.target.value)} />
                      : producto.nombre}
                    </td>
                    <td>{estaEditando
                      ? <input className="input-inline" value={valoresEdicion.marca || ""}
                          onChange={(e) => handleCambioEdicion("marca", e.target.value)} />
                      : producto.marca}
                    </td>
                    <td>{estaEditando
                      ? <select className="input-inline"
                          value={valoresEdicion.categoria || ""}
                          onChange={(e) => handleCambioEdicion("categoria", e.target.value)}>
                          {todasLasCategorias.map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      : producto.categoria}
                    </td>
                    <td>{estaEditando
                      ? <input className="input-inline" type="number"
                          value={valoresEdicion.precioLista || ""}
                          onChange={(e) => handleCambioEdicion("precioLista", e.target.value)} />
                      : formatPrecio(producto.precioLista)}
                    </td>
                    <td>{estaEditando
                      ? <span className="precio-calculado-inline">{formatPrecio(valoresEdicion.precioPublico)}</span>
                      : formatPrecio(producto.precioPublico)}
                    </td>
                    <td className={estaEditando ? "" : "precio-mecanico-tabla"}>
                      {estaEditando
                        ? <span className="precio-calculado-inline precio-mecanico">{formatPrecio(valoresEdicion.precioMecanico)}</span>
                        : formatPrecio(producto.precioMecanico)}
                    </td>
                    <td className={stockBajo && !estaEditando ? "texto-stock-bajo" : ""}>
                      {estaEditando
                        ? <input className="input-inline" type="number"
                            value={valoresEdicion.stock || ""}
                            onChange={(e) => handleCambioEdicion("stock", e.target.value)} />
                        : producto.stock}
                    </td>
                    <td>{estaEditando
                      ? <input className="input-inline" type="number"
                          value={valoresEdicion.stockMinimo || ""}
                          onChange={(e) => handleCambioEdicion("stockMinimo", e.target.value)} />
                      : producto.stockMinimo}
                    </td>
                    {!estaEditando && (() => {
                      const equivs = getEquivProducto(producto);
                      const isOpen = equivPopup?.productoId === producto.id;
                      return (
                        <td className="td-equiv-icono" onClick={(ev) => ev.stopPropagation()}>
                          {equivs.length > 0 ? (
                            <button
                              className={`boton-equiv${isOpen ? " boton-equiv-activo" : ""}`}
                              title={`${equivs.length} equivalencia${equivs.length !== 1 ? "s" : ""}`}
                              onClick={(ev) => {
                                ev.stopPropagation();
                                if (isOpen) { setEquivPopup(null); return; }
                                  const rect = ev.currentTarget.getBoundingClientRect();
                                const x = Math.min(rect.left, window.innerWidth - 340);
                                const y = rect.bottom + 6;
                                setEquivPopup({ productoId: producto.id, x, y });
                              }}
                            >
                              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{verticalAlign:"middle", marginRight: 3}}>
                                <path d="M1 5h10M8 2l3 3-3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M15 11H5m3 3-3-3 3-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                              <span style={{verticalAlign:"middle"}}>{equivs.length}</span>
                            </button>
                          ) : (
                            <span className="equiv-vacio">—</span>
                          )}
                        </td>
                      );
                    })()}
                    {modoEdicion && (
                      <td className="columna-acciones">
                        {estaEditando ? (
                          <div className="botones-inline">
                            <button className="boton-guardar-inline" onClick={guardarEdicionFila}>✔</button>
                            <button className="boton-cancelar-inline" onClick={cancelarEdicionFila}>✖</button>
                          </div>
                        ) : (
                          <button className="boton-eliminar-inline" onClick={(e) => { e.stopPropagation(); eliminarProducto(producto.id); }}>
                            🗑️
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal ingreso de mercadería */}
      {modalIngreso && (
        <div className="overlay-ingreso" onClick={cerrarModalIngreso}>
          <div className="modal-ingreso" onClick={(e) => e.stopPropagation()}>
            <div className="modal-ingreso-header">
              <h2>Ingresar mercadería</h2>
              <button className="boton-cerrar-modal" onClick={cerrarModalIngreso}>✕</button>
            </div>

            <div className="modal-ingreso-body">

              <div className="campo-ingreso">
                <label>Buscar producto</label>
                <input
                  type="text"
                  placeholder="Código o nombre..."
                  value={busquedaIngreso}
                  onChange={(e) => {
                    setBusquedaIngreso(e.target.value);
                    setProductoIngreso(null);
                  }}
                  className="input-caja"
                />
                {productosBusquedaIngreso.length > 0 && !productoIngreso && (
                  <ul className="dropdown-productos">
                    {productosBusquedaIngreso.map((p) => (
                      <li key={p.id} onClick={() => seleccionarProductoIngreso(p)} className="dropdown-item-ingreso">
                        <span className="dropdown-codigo">{p.codigo}</span>
                        <span className="dropdown-nombre">{p.nombre}</span>
                        <span className="dropdown-stock">Stock: {p.stock}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {productoIngreso && (
                <div className="info-producto-ingreso">
                  <span className="info-label">Producto seleccionado:</span>
                  <span className="info-valor">{productoIngreso.nombre}</span>
                  <span className="info-label">Stock actual:</span>
                  <span className="info-valor">{productoIngreso.stock} unidades</span>
                  <span className="info-label">Precio lista actual:</span>
                  <span className="info-valor">{formatPrecio(productoIngreso.precioLista)}</span>
                </div>
              )}

              <div className="campo-ingreso">
                <label>Cantidad a ingresar</label>
                <input
                  type="number"
                  placeholder="0"
                  min="1"
                  value={cantidadIngreso}
                  onChange={(e) => setCantidadIngreso(e.target.value)}
                  className="input-caja"
                />
              </div>

              <div className="campo-ingreso">
                <label>Nuevo precio lista <span className="opcional">(opcional — si no se modifica queda el anterior)</span></label>
                <input
                  type="number"
                  placeholder={productoIngreso ? `Actual: $${productoIngreso.precioLista}` : "Precio lista..."}
                  value={precioListaIngreso}
                  onChange={(e) => setPrecioListaIngreso(e.target.value)}
                  className="input-caja"
                />
                {precioListaIngreso && parseFloat(precioListaIngreso) > 0 && productoIngreso && (() => {
                  const { precioPublico, precioMecanico } = calcularPrecios(
                    parseFloat(precioListaIngreso),
                    productoIngreso.marca || ""
                  );
                  return (
                    <div className="precios-calculados" style={{ marginTop: 8 }}>
                      <div className="precio-calculado">
                        <span className="precio-label">Precio público nuevo</span>
                        <span className="precio-valor">${precioPublico}</span>
                      </div>
                      <div className="precio-calculado">
                        <span className="precio-label">Precio mecánico nuevo</span>
                        <span className="precio-valor precio-mecanico">${precioMecanico}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {errorIngreso && <p className="error-caja">{errorIngreso}</p>}

              <button className="boton-confirmar-caja" onClick={confirmarIngreso}>
                Confirmar ingreso
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popup de equivalencias */}
      {equivPopup && (() => {
        const prod = productosFiltrados.find((p) => p.id === equivPopup.productoId)
          || productos.find((p) => p.id === equivPopup.productoId);
        const equivs = prod ? getEquivProducto(prod) : [];
        const modelos = prod ? getModelosProducto(prod) : [];
        const totalItems = equivs.length + modelos.length;
        // Usar columnas cuando hay muchos items para crecer en ancho en vez de alto
        const cols = totalItems > 30 ? 3 : totalItems > 15 ? 2 : 1;
        const popupWidth = cols === 3 ? 520 : cols === 2 ? 380 : 280;
        const rightSpace = 16;
        const topPos = Math.max(8, Math.min(equivPopup.y, window.innerHeight - (cols > 1 ? 300 : 500)));
        return (
          <>
            <div className="equiv-overlay" onClick={() => setEquivPopup(null)} />
            <div
              className="equiv-popup"
              style={{ position: "fixed", right: rightSpace, top: "50%", transform: "translateY(-50%)", zIndex: 9999, maxHeight: "88vh", width: popupWidth }}
            >
              <div className="equiv-popup-header">
                <span>Equivalencias de <strong>{prod?.codigo || prod?.nombre}</strong></span>
                <button className="equiv-popup-cerrar" onClick={() => setEquivPopup(null)}>✕</button>
              </div>
              {equivs.length > 0 && (
                <>
                  <div className="equiv-popup-seccion">Equivalentes</div>
                  <div className="equiv-popup-chips" style={cols > 1 ? { display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)` } : {}}>
                    {equivs.map((e, i) => (
                      <span
                        key={i}
                        className="chip-equiv"
                        onClick={() => { setBusqueda(e); setEquivPopup(null); }}
                        title={"Buscar: " + e}
                      >
                        {e}
                      </span>
                    ))}
                  </div>
                </>
              )}
              {modelos.length > 0 && (
                <>
                  <div className="equiv-popup-seccion">Vehículos compatibles</div>
                  <div className="equiv-popup-modelos" style={cols > 1 ? { display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)` } : {}}>
                    {modelos.map((m, i) => (
                      <span key={i} className="chip-modelo">{m}</span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        );
      })()}
    </div>
  );
}

export default Productos;
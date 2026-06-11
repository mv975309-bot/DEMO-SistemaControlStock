/**
 * exportar.js — Exporta datos del localStorage a archivos Excel
 *
 * Uso:
 *   1. En el navegador, abrir la consola (F12) y ejecutar:
 *      copy(JSON.stringify({
 *        productos: JSON.parse(localStorage.getItem('productos') || '[]'),
 *        clientes:  JSON.parse(localStorage.getItem('cuentasCorrientes') || '[]'),
 *        caja:      JSON.parse(localStorage.getItem('caja') || '[]'),
 *        vehiculos: JSON.parse(localStorage.getItem('vehiculos') || '[]'),
 *        services:  JSON.parse(localStorage.getItem('services') || '[]'),
 *      }))
 *   2. Pegar el resultado en un archivo llamado "datos.json" en esta carpeta.
 *   3. Ejecutar: node exportar.js
 *
 * Los archivos Excel se generan en la carpeta "Exportaciones/" dentro de esta carpeta.
 */

const XLSX = require("xlsx");
const path = require("path");
const fs   = require("fs");

const ARCHIVO_DATOS = path.join(__dirname, "datos.json");
const SALIDA        = path.join(__dirname, "Exportaciones");

if (!fs.existsSync(ARCHIVO_DATOS)) {
  console.error("❌ No se encontró el archivo datos.json.");
  console.error("   Seguí las instrucciones al inicio de este archivo para generarlo.");
  process.exit(1);
}

const datos = JSON.parse(fs.readFileSync(ARCHIVO_DATOS, "utf8"));

if (!fs.existsSync(SALIDA)) fs.mkdirSync(SALIDA, { recursive: true });

function guardarExcel(filas, columnas, nombreArchivo) {
  const ws = XLSX.utils.json_to_sheet(filas, { header: columnas });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Datos");
  const anchos = columnas.map((col) => ({
    wch: Math.max(col.length, ...filas.map((f) => String(f[col] ?? "").length).slice(0, 100)) + 2,
  }));
  ws["!cols"] = anchos;
  const ruta = path.join(SALIDA, nombreArchivo);
  XLSX.writeFile(wb, ruta);
  console.log(`✅ ${nombreArchivo} — ${filas.length} filas`);
}

function exportarProductos() {
  const filas = (datos.productos || []).map((p) => ({
    "Código":       p.codigo       || "",
    "Nombre":       p.nombre       || "",
    "Marca":        p.marca        || "",
    "Categoría":    p.categoria    || "",
    "Proveedor":    p.proveedor    || "",
    "P. Lista":     p.precioLista  || 0,
    "P. Público":   p.precioPublico || 0,
    "P. Mecánico":  p.precioMecanico || 0,
    "Stock":        p.stock        || 0,
    "Stock Mínimo": p.stockMinimo  || 0,
  }));
  guardarExcel(filas, ["Código","Nombre","Marca","Categoría","Proveedor","P. Lista","P. Público","P. Mecánico","Stock","Stock Mínimo"], "Productos.xlsx");
}

function exportarClientes() {
  const filas = (datos.clientes || []).map((c) => ({
    "Nombre":            c.nombre           || "",
    "Teléfono":          c.telefono         || "",
    "DNI":               c.dni              || "",
    "Dirección":         c.direccion        || "",
    "Tipo Precio":       c.tipoPrecio       || "publico",
    "Saldo":             c.saldo            || 0,
    "Último Movimiento": c.ultimoMovimiento || "",
  }));
  guardarExcel(filas, ["Nombre","Teléfono","DNI","Dirección","Tipo Precio","Saldo","Último Movimiento"], "Clientes.xlsx");
}

function exportarCaja() {
  const filas = (datos.caja || []).map((m) => ({
    "Fecha":        m.fecha       || "",
    "Tipo":         m.tipo        || "",
    "Descripción":  m.descripcion || "",
    "Medio de Pago":m.medioPago   || "",
    "Monto":        m.monto       || 0,
    "Categoría":    m.categoria   || "",
  }));
  guardarExcel(filas, ["Fecha","Tipo","Descripción","Medio de Pago","Monto","Categoría"], "Caja.xlsx");
}

function exportarVehiculos() {
  const vehiculoMap = {};
  (datos.vehiculos || []).forEach((v) => { vehiculoMap[String(v.id)] = v; });

  const filas = (datos.services || []).map((s) => {
    const v = vehiculoMap[String(s.vehiculoId)] || {};
    return {
      "Patente":            v.patente          || "",
      "Modelo":             v.modelo           || "",
      "Dueño":              v.dueno            || "",
      "Teléfono":           v.telefono         || "",
      "Fecha":              s.fecha            || "",
      "Kilometraje":        s.kilometraje      || "",
      "Aceite":             s.aceite           || "",
      "Filtro Aceite":      s.filtroAceite     || "",
      "Filtro Aire":        s.filtroAire       || "",
      "Filtro Combustible": s.filtroCombustible|| "",
      "Filtro Habitáculo":  s.filtroHabitaculo || "",
      "Observaciones":      s.observaciones    || "",
      "Próximo Service":    s.proximoService   || "",
    };
  });
  guardarExcel(filas, ["Patente","Modelo","Dueño","Teléfono","Fecha","Kilometraje","Aceite","Filtro Aceite","Filtro Aire","Filtro Combustible","Filtro Habitáculo","Observaciones","Próximo Service"], "Vehiculos.xlsx");
}

console.log(`\n🔄 Exportando datos... ${new Date().toLocaleString("es-AR")}\n`);
exportarProductos();
exportarClientes();
exportarCaja();
exportarVehiculos();
console.log(`\n✅ Listo. Archivos guardados en: ${SALIDA}\n`);

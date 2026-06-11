/**
 * db.js — Base de datos local (localStorage)
 * API 100 % compatible con el anterior (todas las funciones son async).
 * Sin dependencias externas ni conexión a internet.
 */

// ─── Utilidades ───────────────────────────────────────────────────────────────

function sid(id) { return id != null ? String(id) : null; }

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function leerLS(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function guardarLS(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

// ─── Datos de demo ────────────────────────────────────────────────────────────

function fmt(d) { return d.toLocaleDateString("es-AR"); }
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return fmt(d); }
function daysAhead(n) { const d = new Date(); d.setDate(d.getDate() + n); return fmt(d); }

const HOY = fmt(new Date());

const DEMO_CLIENTES = [
  { id: "c1", nombre: "García, Juan",      telefono: "3516001111", dni: "28500001", direccion: "Av. Colón 1234",            tipoPrecio: "publico",   saldo: 15000, ultimoMovimiento: daysAgo(40), movimientos: [] },
  { id: "c2", nombre: "López, María",      telefono: "3516002222", dni: "32100002", direccion: "Bv. San Juan 567",          tipoPrecio: "mecanico",  saldo: 0,     ultimoMovimiento: daysAgo(5),  movimientos: [] },
  { id: "c3", nombre: "Rodríguez, Carlos", telefono: "3516003333", dni: "25700003", direccion: "Calle Vélez 890",           tipoPrecio: "publico",   saldo: 8500,  ultimoMovimiento: daysAgo(25), movimientos: [] },
  { id: "c4", nombre: "Fernández, Ana",    telefono: "3516004444", dni: "35300004", direccion: "Duarte Quirós 321",         tipoPrecio: "publico",   saldo: 0,     ultimoMovimiento: daysAgo(10), movimientos: [] },
  { id: "c5", nombre: "Martínez, Pedro",   telefono: "3516005555", dni: "30900005", direccion: "Independencia 654",         tipoPrecio: "mecanico",  saldo: 22000, ultimoMovimiento: daysAgo(50), movimientos: [] },
  { id: "c6", nombre: "Sánchez, Laura",    telefono: "3516006666", dni: "27400006", direccion: "Av. Vélez Sársfield 210",   tipoPrecio: "publico",   saldo: 0,     ultimoMovimiento: daysAgo(2),  movimientos: [] },
];

const DEMO_VEHICULOS = [
  { id: "v1", patente: "ABC123", modelo: "Volkswagen Gol 2018",   clienteId: "c1", dueno: "García, Juan",      telefono: "3516001111", historialDuenos: [] },
  { id: "v2", patente: "DEF456", modelo: "Ford Focus 2020",        clienteId: "c2", dueno: "López, María",      telefono: "3516002222", historialDuenos: [] },
  { id: "v3", patente: "GHI789", modelo: "Chevrolet Cruze 2019",   clienteId: "c3", dueno: "Rodríguez, Carlos", telefono: "3516003333", historialDuenos: [] },
  { id: "v4", patente: "JKL012", modelo: "Toyota Corolla 2021",    clienteId: "c4", dueno: "Fernández, Ana",    telefono: "3516004444", historialDuenos: [] },
  { id: "v5", patente: "MNO345", modelo: "Renault Sandero 2017",   clienteId: "c5", dueno: "Martínez, Pedro",   telefono: "3516005555", historialDuenos: [] },
  { id: "v6", patente: "PQR678", modelo: "Peugeot 208 2022",       clienteId: "c6", dueno: "Sánchez, Laura",    telefono: "3516006666", historialDuenos: [] },
];

const DEMO_SERVICES = [
  { id: "s1", vehiculoId: "v1", fecha: daysAgo(1),  kilometraje: "85000",  aceite: "Castrol 10W40 1L",    filtroAceite: "Purolator PH3593A", filtroAire: "-",           filtroCombustible: "-",         filtroHabitaculo: "-",           observaciones: "Service completo",             manoDeObra: "3000", proximoService: "95000"  },
  { id: "s2", vehiculoId: "v2", fecha: daysAgo(1),  kilometraje: "42000",  aceite: "Motul 5W30 1L",       filtroAceite: "Mann W713/83",      filtroAire: "Mann C2999",  filtroCombustible: "-",         filtroHabitaculo: "Mann CUK22032", observaciones: "Filtros completos",            manoDeObra: "4500", proximoService: "52000"  },
  { id: "s3", vehiculoId: "v3", fecha: daysAgo(3),  kilometraje: "120000", aceite: "YPF Elaion 15W40 1L", filtroAceite: "Fram PH9688",       filtroAire: "Fram CA10171",filtroCombustible: "Fram P4003", filtroHabitaculo: "-",           observaciones: "",                             manoDeObra: "5000", proximoService: "130000" },
  { id: "s4", vehiculoId: "v4", fecha: daysAgo(7),  kilometraje: "28000",  aceite: "Shell Helix 0W20 1L", filtroAceite: "Toyota 04152",      filtroAire: "-",           filtroCombustible: "-",         filtroHabitaculo: "-",           observaciones: "Service de garantía",          manoDeObra: "2000", proximoService: "38000"  },
  { id: "s5", vehiculoId: "v5", fecha: daysAgo(14), kilometraje: "95000",  aceite: "Mobil 20W50 1L",      filtroAceite: "Bosch AF0048",      filtroAire: "Bosch 1457",  filtroCombustible: "-",         filtroHabitaculo: "-",           observaciones: "Ruido leve en motor, monitorear", manoDeObra: "3500", proximoService: "105000" },
];

const DEMO_PRODUCTOS = [
  { id: "p1",  codigo: "FIL001", nombre: "Filtro Aceite Purolator PH3593A",  marca: "Purolator", stock: 12, stockMinimo: 5,  precioLista: 1200, precioPublico: 2034,  precioMecanico: 1729,  categoria: "Filtros aceite",      proveedor: "AutoPartes SA" },
  { id: "p2",  codigo: "FIL002", nombre: "Filtro Aceite Mann W713/83",        marca: "Mann",      stock: 8,  stockMinimo: 3,  precioLista: 1800, precioPublico: 3051,  precioMecanico: 2593,  categoria: "Filtros aceite",      proveedor: "AutoPartes SA" },
  { id: "p3",  codigo: "FIL003", nombre: "Filtro Aire Mann C2999",            marca: "Mann",      stock: 4,  stockMinimo: 5,  precioLista: 2200, precioPublico: 3729,  precioMecanico: 3170,  categoria: "Filtros aire",        proveedor: "AutoPartes SA" },
  { id: "p4",  codigo: "ACE001", nombre: "Aceite Castrol 10W40 1L",           marca: "Castrol",   stock: 24, stockMinimo: 10, precioLista: 3500, precioPublico: 5934,  precioMecanico: 5044,  categoria: "Aceites",             proveedor: "Lubricentro Norte" },
  { id: "p5",  codigo: "ACE002", nombre: "Aceite Motul 5W30 1L",              marca: "Motul",     stock: 18, stockMinimo: 8,  precioLista: 5200, precioPublico: 8813,  precioMecanico: 7491,  categoria: "Aceites",             proveedor: "Lubricentro Norte" },
  { id: "p6",  codigo: "ACE003", nombre: "Aceite YPF Elaion 15W40 1L",        marca: "YPF",       stock: 30, stockMinimo: 10, precioLista: 2800, precioPublico: 4747,  precioMecanico: 4035,  categoria: "Aceites",             proveedor: "YPF Distribuidora" },
  { id: "p7",  codigo: "FIL004", nombre: "Filtro Combustible Fram P4003",     marca: "Fram",      stock: 2,  stockMinimo: 4,  precioLista:  900, precioPublico: 1526,  precioMecanico: 1297,  categoria: "Filtros combustible", proveedor: "AutoPartes SA" },
  { id: "p8",  codigo: "FIL005", nombre: "Filtro Habitáculo Mann CUK22032",   marca: "Mann",      stock: 6,  stockMinimo: 3,  precioLista: 1600, precioPublico: 2713,  precioMecanico: 2306,  categoria: "Filtros habitáculo",  proveedor: "AutoPartes SA" },
  { id: "p9",  codigo: "FRE001", nombre: "Pastillas Freno Bosch BP1457",      marca: "Bosch",     stock: 3,  stockMinimo: 4,  precioLista: 4500, precioPublico: 7628,  precioMecanico: 6483,  categoria: "Frenos",              proveedor: "Bosch Distribuidora" },
  { id: "p10", codigo: "ACE004", nombre: "Aceite Shell Helix 0W20 1L",        marca: "Shell",     stock: 15, stockMinimo: 6,  precioLista: 6800, precioPublico: 11528, precioMecanico: 9799,  categoria: "Aceites",             proveedor: "Lubricentro Norte" },
  { id: "p11", codigo: "FIL006", nombre: "Filtro Aire Fram CA10171",          marca: "Fram",      stock: 9,  stockMinimo: 4,  precioLista: 1950, precioPublico: 3306,  precioMecanico: 2810,  categoria: "Filtros aire",        proveedor: "AutoPartes SA" },
  { id: "p12", codigo: "ACE005", nombre: "Aceite Mobil Super 20W50 1L",       marca: "Mobil",     stock: 20, stockMinimo: 8,  precioLista: 4100, precioPublico: 6950,  precioMecanico: 5907,  categoria: "Aceites",             proveedor: "Lubricentro Norte" },
];

const DEMO_PROVEEDORES = ["AutoPartes SA", "Bosch Distribuidora", "Lubricentro Norte", "YPF Distribuidora"];

const DEMO_CATEGORIAS = ["Aceites", "Aguas", "Aditivos", "Correas", "Escobillas", "Filtros aceite", "Filtros aire", "Filtros combustible", "Filtros habitáculo", "Frenos", "Suspensión y dirección"];

const DEMO_CAJA = [
  { id: "ca1", tipo: "ingreso", descripcion: "Service Gol ABC123",               monto:  8034, medioPago: "efectivo",      fecha: HOY,        categoria: "Service"         },
  { id: "ca2", tipo: "ingreso", descripcion: "Venta filtros Focus DEF456",       monto:  5764, medioPago: "transferencia", fecha: HOY,        categoria: "Venta repuestos" },
  { id: "ca3", tipo: "egreso",  descripcion: "Compra aceites Lubricentro Norte", monto: 45000, medioPago: "transferencia", fecha: HOY,        categoria: "Compras"         },
  { id: "ca4", tipo: "ingreso", descripcion: "Service Cruze GHI789",             monto: 12728, medioPago: "tarjeta",       fecha: daysAgo(1), categoria: "Service"         },
  { id: "ca5", tipo: "egreso",  descripcion: "Alquiler local",                   monto: 80000, medioPago: "transferencia", fecha: daysAgo(2), categoria: "Gastos fijos"    },
  { id: "ca6", tipo: "ingreso", descripcion: "Venta pastillas freno Bosch",      monto:  7628, medioPago: "efectivo",      fecha: daysAgo(2), categoria: "Venta repuestos" },
  { id: "ca7", tipo: "ingreso", descripcion: "Service Corolla JKL012",           monto:  9528, medioPago: "efectivo",      fecha: daysAgo(3), categoria: "Service"         },
  { id: "ca8", tipo: "egreso",  descripcion: "Compra filtros AutoPartes SA",     monto: 32000, medioPago: "transferencia", fecha: daysAgo(4), categoria: "Compras"         },
];

const DEMO_PRESUPUESTOS = [
  {
    id: "pr1", numero: 1, fecha: daysAgo(2),
    clienteId: "c1", clienteNombre: "García, Juan",
    vehiculoId: "v1", vehiculoPatente: "ABC123", vehiculoModelo: "Volkswagen Gol 2018",
    estado: "aprobado",
    camposService: { aceite: "Castrol 10W40 1L", filtroAceite: "Purolator PH3593A" },
    cantidadAceite: 4, otrosItems: [], total: 11170, observaciones: "",
  },
  {
    id: "pr2", numero: 2, fecha: daysAgo(1),
    clienteId: "c2", clienteNombre: "López, María",
    vehiculoId: "v2", vehiculoPatente: "DEF456", vehiculoModelo: "Ford Focus 2020",
    estado: "pendiente",
    camposService: { aceite: "Motul 5W30 1L", filtroAceite: "Mann W713/83", filtroAire: "Mann C2999", filtroHabitaculo: "Mann CUK22032" },
    cantidadAceite: 5, otrosItems: [], total: 54977, observaciones: "Cliente consulta por garantía",
  },
  {
    id: "pr3", numero: 3, fecha: HOY,
    clienteId: "c3", clienteNombre: "Rodríguez, Carlos",
    vehiculoId: "v3", vehiculoPatente: "GHI789", vehiculoModelo: "Chevrolet Cruze 2019",
    estado: "pendiente",
    camposService: {}, cantidadAceite: 1,
    otrosItems: [{ nombre: "Pastillas Freno Bosch BP1457", precio: 7628, cantidad: 1 }],
    total: 7628, observaciones: "",
  },
];

const DEMO_TURNOS = [
  { id: "t1", vehiculoId: "v1", patente: "ABC123", dueno: "García, Juan",      modelo: "Volkswagen Gol 2018",  fecha: daysAhead(1), hora: "09:00", tipoService: "Service completo", estado: "pendiente" },
  { id: "t2", vehiculoId: "v3", patente: "GHI789", dueno: "Rodríguez, Carlos", modelo: "Chevrolet Cruze 2019", fecha: daysAhead(1), hora: "11:00", tipoService: "Cambio pastillas", estado: "pendiente" },
  { id: "t3", vehiculoId: "v5", patente: "MNO345", dueno: "Martínez, Pedro",   modelo: "Renault Sandero 2017", fecha: daysAhead(2), hora: "10:00", tipoService: "Service express",  estado: "pendiente" },
  { id: "t4", vehiculoId: "v2", patente: "DEF456", dueno: "López, María",      modelo: "Ford Focus 2020",      fecha: daysAgo(1),   hora: "14:00", tipoService: "Revisión general", estado: "realizado"  },
];

function seedDemoData() {
  if (localStorage.getItem("_luscher_demo_seeded")) return;
  guardarLS("cuentasCorrientes",        DEMO_CLIENTES);
  guardarLS("vehiculos",                DEMO_VEHICULOS);
  guardarLS("services",                 DEMO_SERVICES);
  guardarLS("productos",                DEMO_PRODUCTOS);
  guardarLS("proveedores",              DEMO_PROVEEDORES);
  guardarLS("categoriasPersonalizadas", DEMO_CATEGORIAS);
  guardarLS("caja",                     DEMO_CAJA);
  guardarLS("presupuestos",             DEMO_PRESUPUESTOS);
  guardarLS("turnos",                   DEMO_TURNOS);
  localStorage.setItem("_luscher_demo_seeded", "1");
}

seedDemoData();

// ─── CLIENTES ─────────────────────────────────────────────────────────────────

export async function getClientes() {
  return (leerLS("cuentasCorrientes") || []).sort((a, b) =>
    (a.nombre || "").localeCompare(b.nombre || "")
  );
}

export async function upsertCliente(cliente) {
  const lista = leerLS("cuentasCorrientes") || [];
  const idx = lista.findIndex((c) => sid(c.id) === sid(cliente.id));
  if (idx >= 0) lista[idx] = cliente;
  else lista.push({ ...cliente, id: cliente.id || genId() });
  guardarLS("cuentasCorrientes", lista);
}

export async function upsertClientes(clientes) {
  if (!clientes.length) return;
  const lista = leerLS("cuentasCorrientes") || [];
  const mapa = new Map(lista.map((c) => [sid(c.id), c]));
  clientes.forEach((c) => {
    const id = sid(c.id) || genId();
    mapa.set(id, { ...c, id });
  });
  guardarLS("cuentasCorrientes", [...mapa.values()]);
}

export async function deleteCliente(id) {
  const lista = leerLS("cuentasCorrientes") || [];
  guardarLS("cuentasCorrientes", lista.filter((c) => sid(c.id) !== sid(id)));
}

// ─── VEHÍCULOS ────────────────────────────────────────────────────────────────

export async function getVehiculos() {
  return (leerLS("vehiculos") || []).sort((a, b) =>
    (a.patente || "").localeCompare(b.patente || "")
  );
}

export async function upsertVehiculo(vehiculo) {
  const lista = leerLS("vehiculos") || [];
  const idx = lista.findIndex((v) => sid(v.id) === sid(vehiculo.id));
  if (idx >= 0) lista[idx] = vehiculo;
  else lista.push({ ...vehiculo, id: vehiculo.id || genId() });
  guardarLS("vehiculos", lista);
}

export async function upsertVehiculos(vehiculos) {
  if (!vehiculos.length) return;
  const lista = leerLS("vehiculos") || [];
  const mapa = new Map(lista.map((v) => [sid(v.id), v]));
  vehiculos.forEach((v) => {
    const id = sid(v.id) || genId();
    mapa.set(id, { ...v, id });
  });
  guardarLS("vehiculos", [...mapa.values()]);
}

export async function deleteVehiculo(id) {
  const lista = leerLS("vehiculos") || [];
  guardarLS("vehiculos", lista.filter((v) => sid(v.id) !== sid(id)));
}

// ─── SERVICES ─────────────────────────────────────────────────────────────────

export async function getServices() {
  const lista = leerLS("services") || [];
  return [...lista].reverse();
}

export async function upsertService(service) {
  const lista = leerLS("services") || [];
  const idx = lista.findIndex((s) => sid(s.id) === sid(service.id));
  if (idx >= 0) lista[idx] = service;
  else lista.push({ ...service, id: service.id || genId() });
  guardarLS("services", lista);
}

export async function upsertServices(services) {
  if (!services.length) return;
  const lista = leerLS("services") || [];
  const mapa = new Map(lista.map((s) => [sid(s.id), s]));
  services.forEach((s) => {
    const id = sid(s.id) || genId();
    mapa.set(id, { ...s, id });
  });
  guardarLS("services", [...mapa.values()]);
}

export async function deleteService(id) {
  const lista = leerLS("services") || [];
  guardarLS("services", lista.filter((s) => sid(s.id) !== sid(id)));
}

// ─── PRODUCTOS ────────────────────────────────────────────────────────────────

export async function getProductos() {
  return (leerLS("productos") || []).sort((a, b) =>
    (a.nombre || "").localeCompare(b.nombre || "")
  );
}

export async function upsertProducto(producto) {
  const lista = leerLS("productos") || [];
  const idx = lista.findIndex((p) => sid(p.id) === sid(producto.id));
  if (idx >= 0) lista[idx] = producto;
  else lista.push({ ...producto, id: producto.id || genId() });
  guardarLS("productos", lista);
}

export async function upsertProductos(productos) {
  if (!productos.length) return;
  const lista = leerLS("productos") || [];
  const mapa = new Map(lista.map((p) => [sid(p.id), p]));
  productos.forEach((p) => {
    const id = sid(p.id) || genId();
    mapa.set(id, { ...p, id });
  });
  guardarLS("productos", [...mapa.values()]);
}

export async function deleteProducto(id) {
  const lista = leerLS("productos") || [];
  guardarLS("productos", lista.filter((p) => sid(p.id) !== sid(id)));
}

export async function deleteProductosByProveedor(proveedor) {
  const lista = leerLS("productos") || [];
  guardarLS("productos", lista.filter((p) => p.proveedor !== proveedor));
}

export async function deleteProductosSinProveedor() {
  const lista = leerLS("productos") || [];
  guardarLS("productos", lista.filter((p) => p.proveedor && p.proveedor.trim() !== ""));
}

// ─── PROVEEDORES ──────────────────────────────────────────────────────────────

export async function getProveedores() {
  return (leerLS("proveedores") || []).sort();
}

export async function upsertProveedores(nombres) {
  if (!nombres.length) return;
  const actual = leerLS("proveedores") || [];
  const set = new Set([...actual, ...nombres]);
  guardarLS("proveedores", [...set].sort());
}

// ─── CATEGORIAS ───────────────────────────────────────────────────────────────

export async function getCategorias() {
  return (leerLS("categoriasPersonalizadas") || []).sort();
}

export async function upsertCategorias(nombres) {
  if (!nombres.length) return;
  const actual = leerLS("categoriasPersonalizadas") || [];
  const set = new Set([...actual, ...nombres]);
  guardarLS("categoriasPersonalizadas", [...set].sort());
}

// ─── CAJA ─────────────────────────────────────────────────────────────────────

export async function getCaja() {
  const lista = leerLS("caja") || [];
  return [...lista].reverse();
}

export async function upsertMovimiento(mov) {
  const lista = leerLS("caja") || [];
  const idx = lista.findIndex((m) => sid(m.id) === sid(mov.id));
  if (idx >= 0) lista[idx] = mov;
  else lista.push({ ...mov, id: mov.id || genId() });
  guardarLS("caja", lista);
}

export async function upsertMovimientos(movimientos) {
  if (!movimientos.length) return;
  const lista = leerLS("caja") || [];
  const mapa = new Map(lista.map((m) => [sid(m.id), m]));
  movimientos.forEach((m) => {
    const id = sid(m.id) || genId();
    mapa.set(id, { ...m, id });
  });
  guardarLS("caja", [...mapa.values()]);
}

export async function deleteMovimiento(id) {
  const lista = leerLS("caja") || [];
  guardarLS("caja", lista.filter((m) => sid(m.id) !== sid(id)));
}

// ─── PRESUPUESTOS ─────────────────────────────────────────────────────────────

export async function getPresupuestos() {
  const lista = leerLS("presupuestos") || [];
  return [...lista].reverse();
}

export async function upsertPresupuesto(presupuesto) {
  const lista = leerLS("presupuestos") || [];
  const idx = lista.findIndex((p) => sid(p.id) === sid(presupuesto.id));
  if (idx >= 0) lista[idx] = presupuesto;
  else lista.push({ ...presupuesto, id: presupuesto.id || genId() });
  guardarLS("presupuestos", lista);
}

export async function upsertPresupuestos(presupuestos) {
  if (!presupuestos.length) return;
  const lista = leerLS("presupuestos") || [];
  const mapa = new Map(lista.map((p) => [sid(p.id), p]));
  presupuestos.forEach((p) => {
    const id = sid(p.id) || genId();
    mapa.set(id, { ...p, id });
  });
  guardarLS("presupuestos", [...mapa.values()]);
}

export async function deletePresupuesto(id) {
  const lista = leerLS("presupuestos") || [];
  guardarLS("presupuestos", lista.filter((p) => sid(p.id) !== sid(id)));
}

// ─── TURNOS ───────────────────────────────────────────────────────────────────

export async function getTurnos() {
  return (leerLS("turnos") || []).sort((a, b) => {
    const cf = (a.fecha || "").localeCompare(b.fecha || "");
    return cf !== 0 ? cf : (a.hora || "").localeCompare(b.hora || "");
  });
}

export async function upsertTurno(turno) {
  const lista = leerLS("turnos") || [];
  const idx = lista.findIndex((t) => sid(t.id) === sid(turno.id));
  if (idx >= 0) lista[idx] = turno;
  else lista.push({ ...turno, id: turno.id || genId() });
  guardarLS("turnos", lista);
}

export async function upsertTurnos(turnos) {
  if (!turnos.length) return;
  const lista = leerLS("turnos") || [];
  const mapa = new Map(lista.map((t) => [sid(t.id), t]));
  turnos.forEach((t) => {
    const id = sid(t.id) || genId();
    mapa.set(id, { ...t, id });
  });
  guardarLS("turnos", [...mapa.values()]);
}

export async function deleteTurno(id) {
  const lista = leerLS("turnos") || [];
  guardarLS("turnos", lista.filter((t) => sid(t.id) !== sid(id)));
}

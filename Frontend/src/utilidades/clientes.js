// Normaliza nombre para comparación (sin acentos, mayúsculas, sin espacios extra)
export function normNombre(str) {
  return (str || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Busca cliente por nombre normalizado. Retorna el cliente o null.
export function buscarClientePorNombre(clientes, nombre) {
  const norm = normNombre(nombre);
  if (!norm) return null;
  return clientes.find((c) => normNombre(c.nombre) === norm) || null;
}

// Crea un cliente nuevo con los campos base
export function crearCliente({ nombre, telefono = "", dni = "", direccion = "" }) {
  return {
    id: Date.now() + Math.random(),
    nombre: nombre.trim(),
    telefono: telefono.trim(),
    dni: dni.trim(),
    direccion: direccion.trim(),
    tipoPrecio: "publico",
    fechaCreacion: new Date().toLocaleDateString("es-AR"),
    movimientos: [],
  };
}

/**
 * Migración única: vincula vehiculos.dueno (texto) → clienteId.
 * - Matchea por nombre normalizado contra clientes existentes.
 * - Crea clientes nuevos para los dueños que no existen.
 * - Agrega historialDuenos a cada vehículo.
 * - Retorna { vehiculosActualizados, clientesActualizados, stats }
 */
export function migrarDuenosAClienteId(vehiculos, clientes) {
  const clientesMutable = [...clientes];
  const mapaNorm = new Map();
  clientesMutable.forEach((c) => mapaNorm.set(normNombre(c.nombre), c));

  let creados = 0;
  let matcheados = 0;
  let sinDueno = 0;

  const vehiculosActualizados = vehiculos.map((v) => {
    // Ya migrado
    if (v.clienteId) return v;

    const dueno = (v.dueno || "").trim();
    if (!dueno || dueno === "-") {
      sinDueno++;
      return { ...v, historialDuenos: v.historialDuenos || [] };
    }

    const norm = normNombre(dueno);
    let cliente = mapaNorm.get(norm);

    if (!cliente) {
      cliente = crearCliente({
        nombre: dueno,
        telefono: v.telefono || "",
      });
      clientesMutable.push(cliente);
      mapaNorm.set(norm, cliente);
      creados++;
    } else {
      matcheados++;
    }

    return {
      ...v,
      clienteId: cliente.id,
      historialDuenos: [
        {
          clienteId: cliente.id,
          nombre: cliente.nombre,
          desde: v.fechaCreacion || new Date().toLocaleDateString("es-AR"),
          hasta: null,
        },
      ],
    };
  });

  return {
    vehiculosActualizados,
    clientesActualizados: clientesMutable,
    stats: { matcheados, creados, sinDueno },
  };
}

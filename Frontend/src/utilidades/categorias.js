export const CATEGORIAS_FIJAS = [
  "Filtros aceite",
  "Filtros aire",
  "Filtros combustible",
  "Filtros habitáculo",
  "Aceites",
  "Aguas",
  "Aditivos",
  "Escobillas",
  "Limpieza",
];

// Mapeo para detectar categoría automáticamente desde el Excel
export const MAPEO_CATEGORIAS = {
  // Filtros (orden importa: los específicos van primero)
  // Filtros aceite (específicos primero)
  "cartucho de aceite":       "Filtros aceite",
  "cartuchos de aceite":      "Filtros aceite",
  "unidad sellada de aceite": "Filtros aceite",
  "unidad sellada":           "Filtros aceite",
  "filtro aceite":            "Filtros aceite",
  "filtro de aceite":         "Filtros aceite",
  "f aceite":                 "Filtros aceite",
  // Filtros combustible
  "cartucho de gasoil":       "Filtros combustible",
  "cartuchos de gasoil":      "Filtros combustible",
  "filtro de combustible":    "Filtros combustible",
  "filtros de combustible":   "Filtros combustible",
  "filtro combustible":       "Filtros combustible",
  "filtro gasoil":            "Filtros combustible",
  "f combustible":            "Filtros combustible",
  "f gasoil":                 "Filtros combustible",
  // Filtros aire
  "filtros de aire":          "Filtros aire",
  "filtro de aire":           "Filtros aire",
  "filtro aire":              "Filtros aire",
  "f aire":                   "Filtros aire",
  // Filtros habitáculo (incluye typo "filttros" de ERCIF)
  "filttros de habitaculo":   "Filtros habitáculo",
  "filttros habitaculo":      "Filtros habitáculo",
  "filtros de habitaculo":    "Filtros habitáculo",
  "filtro habitaculo":        "Filtros habitáculo",
  "filtro habitáculo":        "Filtros habitáculo",
  "filtro cabina":            "Filtros habitáculo",
  "f habitaculo":             "Filtros habitáculo",
  "filtro":                   "Filtros",
  // Aceites y fluidos
  "aceite":              "Aceites",
  "agua":                "Aguas",
  "refrigerante":        "Aguas",
  "aditivo":             "Aditivos",
  "liquido":             "Aditivos",
  "líquido":             "Aditivos",
  // Frenos
  "pastilla":            "Frenos",
  "past":                "Frenos",
  "disco de freno":      "Frenos",
  "disco freno":         "Frenos",
  // Suspensión y dirección
  "rotula":              "Suspensión y dirección",
  "rótula":              "Suspensión y dirección",
  "bieleta":             "Suspensión y dirección",
  "amort":               "Amortiguadores",
  "axial":               "Suspensión y dirección",
  "extremo":             "Suspensión y dirección",
  // Transmisión y motor
  "correa":              "Correas",
  "tensor":              "Correas",
  "bomba":               "Bombas",
  "junta":               "Juntas",
  "bujia":               "Bujías",
  "bujía":               "Bujías",
  "embrague":            "Embragues",
  "rodamiento":          "Rodamientos",
  "maza":                "Rodamientos",
  // Iluminación
  "lampara":             "Lámparas",
  "lámpara":             "Lámparas",
  "lamp":                "Lámparas",
  // Herramientas
  "llave":               "Herramientas",
  "mecha":               "Herramientas",
  "sierra":              "Herramientas",
  "destornillador":      "Herramientas",
  "destor":              "Herramientas",
  "pinza":               "Herramientas",
  "alicate":             "Herramientas",
  // Suspensión y dirección
  "suspension":          "Suspensión y dirección",
  "suspensión":          "Suspensión y dirección",
  "direccion":           "Suspensión y dirección",
  "dirección":           "Suspensión y dirección",
  // Frenos
  "freno":               "Frenos",
  "disco":               "Frenos",
  // Distribución
  "distribucion":        "Distribución",
  "distribución":        "Distribución",
  "kit distribucion":    "Distribución",
  "kit distribución":    "Distribución",
  // Herramientas
  "herramienta":         "Herramientas",
  "bahco":               "Herramientas",
  "tolsen":              "Herramientas",
  "bosch herr":          "Herramientas",
  "ingco":               "Herramientas",
  "irimo":               "Herramientas",
  "bocallaves":          "Herramientas",
  "sierra":              "Herramientas",
  "dremel":              "Herramientas",
  // Otros
  "termostato":          "Termostatos",
  "flanges":             "Juntas y flanges",
  "nylon":               "Otros",
  "escobilla":           "Escobillas",
  "limpieza":            "Limpieza",
  "lubricante":          "Aceites",
};

export function detectarCategoria(textoCategoria) {
  if (!textoCategoria) return "";
  // Limpiar prefijos num\u00e9ricos tipo "183-ERCIF " o "185-"
  const limpio = textoCategoria.replace(/^\s*\d+-[A-Z]+\s+/i, "").replace(/^\s*\d+-/, "");
  const texto = limpio.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  for (const [clave, categoria] of Object.entries(MAPEO_CATEGORIAS)) {
    const claveNorm = clave.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (texto.includes(claveNorm)) {
      return categoria;
    }
  }
  return "";
}
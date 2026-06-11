// Fórmula: precio público = lista × 1.4 (ganancia) × 1.21 (IVA)
// Precio mecánico = precio público × 0.85
export function calcularPrecios(precioLista) {
  const precioPublico = parseFloat((precioLista * 1.4 * 1.21).toFixed(2));
  const precioMecanico = parseFloat((precioPublico * 0.85).toFixed(2));
  return { precioPublico, precioMecanico };
}

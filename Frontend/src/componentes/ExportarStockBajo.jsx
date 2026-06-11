import * as XLSX from "xlsx";

function ExportarStockBajo({ productos, onAbrir }) {
  function exportar() {
    onAbrir?.();
    const stockBajo = productos.filter(
      (p) => Number(p.stock) <= Number(p.stockMinimo)
    );

    if (stockBajo.length === 0) {
      alert("No hay productos con stock bajo.");
      return;
    }

    const filas = stockBajo.map((p) => ({
      Código: p.codigo,
      Nombre: p.nombre,
      "Cantidad a pedir": "",
    }));

    const hoja = XLSX.utils.json_to_sheet(filas);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Stock bajo");
    XLSX.writeFile(libro, "pedido_stock_bajo.xlsx");
  }

  return (
    <button onMouseDown={(e) => { e.stopPropagation(); exportar(); }} className="boton-exportar">
      📤 Exportar stock bajo
    </button>
  );
}

export default ExportarStockBajo;
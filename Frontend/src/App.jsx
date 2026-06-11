import { BrowserRouter, Routes, Route } from "react-router-dom";

import Dashboard from "./paginas/Dashboard";
import Productos from "./paginas/Productos";
import Caja from "./paginas/Caja";
import MainLayout from "./layouts/MainLayout";
import Vehiculos from "./paginas/Vehiculos";
import CuentasCorrientes from "./paginas/CuentasCorrientes";
import Presupuestos from "./paginas/Presupuestos";
import Agenda from "./paginas/Agenda";

function App() {
  return (
    <BrowserRouter>
      <MainLayout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/productos" element={<Productos />} />
          <Route path="/caja" element={<Caja />} />
          <Route path="/vehiculos" element={<Vehiculos />} />
          <Route path="/cuentas-corrientes" element={<CuentasCorrientes />} />
          <Route path="/presupuestos" element={<Presupuestos />} />
          <Route path="/agenda" element={<Agenda />} />
        </Routes>
      </MainLayout>
    </BrowserRouter>
  );
}

export default App;

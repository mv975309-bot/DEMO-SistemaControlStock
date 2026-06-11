import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../estilos/Agenda.css";
import { getTurnos, upsertTurno, deleteTurno, getVehiculos, getClientes } from "../lib/db";

const TIPOS_SERVICE = [
  "Cambio de aceite y filtros",
  "Revisión general",
  "Frenos",
  "Correa de distribución",
  "Embrague",
  "Suspensión",
  "Alineación y balanceo",
  "Batería",
  "Otro",
];

function norm(str) {
  return (str || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function fechaISO(date) {
  return date.toISOString().split("T")[0];
}

function lunes(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function formatFechaDia(isoStr) {
  const [y, m, d] = isoStr.split("-");
  return `${d}/${m}/${y}`;
}

function diasSemana(inicioSemana) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(inicioSemana);
    d.setDate(d.getDate() + i);
    return fechaISO(d);
  });
}

const NOMBRES_DIA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export default function Agenda() {
  const navigate = useNavigate();
  const location = useLocation();

  const [turnos, setTurnos] = useState([]);
  const [vehiculos, setVehiculos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    Promise.all([getTurnos(), getVehiculos(), getClientes()])
      .then(([t, v, c]) => { setTurnos(t); setVehiculos(v); setClientes(c); })
      .catch(console.error)
      .finally(() => setCargando(false));
  }, []);

  const mapaClientes = Object.fromEntries(clientes.map((c) => [c.id, c]));

  function duenoDe(v) {
    return mapaClientes[v.clienteId]?.nombre || v.dueno || "Sin dueño";
  }

  const [vista, setVista] = useState("dia");
  const [fechaDia, setFechaDia] = useState(fechaISO(new Date()));
  const [semanaBase, setSemanaBase] = useState(fechaISO(lunes(new Date())));

  const [modalAbierto, setModalAbierto] = useState(false);
  const [turnoGuardado, setTurnoGuardado] = useState(null);
  const [busquedaPatente, setBusquedaPatente] = useState("");
  const [vehiculoElegido, setVehiculoElegido] = useState(null);
  const [formFecha, setFormFecha] = useState("");
  const [formHora, setFormHora] = useState("");
  const [formTipo, setFormTipo] = useState("");
  const [formTipoOtro, setFormTipoOtro] = useState("");

  // Abrir modal pre-cargado si viene desde un presupuesto
  useEffect(() => {
    const state = location.state;
    if (!state?.desdePresupuesto) return;
    const vehiculo = state.vehiculoId ? vehiculos.find((v) => v.id === state.vehiculoId) : null;
    setFormFecha(fechaISO(new Date()));
    setFormHora("");
    setFormTipo(state.tipoService || "");
    setFormTipoOtro("");
    setBusquedaPatente(state.patente || "");
    setVehiculoElegido(vehiculo || null);
    setTurnoGuardado(null);
    setModalAbierto(true);
    window.history.replaceState({}, "");
  }, []);

    async function guardarTurnos(nuevos, turnoModificado) {
    setTurnos(nuevos);
    if (turnoModificado) {
      upsertTurno(turnoModificado).catch(console.error);
    }
  }

  function abrirModal(fechaInicial) {
    const f = fechaInicial || fechaDia;
    setFormFecha(f);
    setFormHora("");
    setFormTipo("");
    setFormTipoOtro("");
    setBusquedaPatente("");
    setVehiculoElegido(null);
    setTurnoGuardado(null);
    setModalAbierto(true);
  }

  function cerrarModal() {
    setModalAbierto(false);
    setTurnoGuardado(null);
  }

  function guardarTurno(e) {
    e.preventDefault();
    if (!formFecha || !formHora || !formTipo) return;
    const tipoFinal = formTipo === "Otro" ? formTipoOtro.trim() || "Otro" : formTipo;
    const nuevo = {
      id: Date.now(),
      vehiculoId: vehiculoElegido?.id || null,
      patente: vehiculoElegido?.patente || busquedaPatente.trim().toUpperCase(),
      dueno: vehiculoElegido ? duenoDe(vehiculoElegido) : "",
      modelo: vehiculoElegido?.modelo || "",
      fecha: formFecha,
      hora: formHora,
      tipoService: tipoFinal,
      estado: "pendiente",
    };
    const ordenTurno = (h) => h === "Mañana" ? 0 : 1;
    const ordenados = [...turnos, nuevo].sort((a, b) => {
      if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
      return ordenTurno(a.hora) - ordenTurno(b.hora);
    });
    guardarTurnos(ordenados, nuevo);
    setTurnoGuardado(nuevo);
  }

  function irAPresupuesto(turno) {
    cerrarModal();
    const vehiculo = vehiculos.find((v) => v.id === turno.vehiculoId);
    navigate("/presupuestos", {
      state: {
        desdeAgenda: true,
        vehiculoId: turno.vehiculoId || null,
        clienteId: vehiculo?.clienteId || null,
      },
    });
  }

  function completarTurno(id) {
    const actualizado = turnos.find((t) => t.id === id);
    if (actualizado) guardarTurnos(turnos.map((t) => t.id === id ? { ...t, estado: "completado" } : t), { ...actualizado, estado: "completado" });
  }

  function eliminarTurno(id) {
    if (!confirm("¿Eliminar este turno?")) return;
    setTurnos(turnos.filter((t) => t.id !== id));
    deleteTurno(id).catch(console.error);
  }

  const sugerenciasVehiculo = busquedaPatente.length >= 1 && !vehiculoElegido
    ? vehiculos
        .filter((v) =>
          norm(v.patente).includes(norm(busquedaPatente)) ||
          norm(duenoDe(v)).includes(norm(busquedaPatente))
        )
        .slice(0, 6)
    : [];

  function prevDia() {
    const d = new Date(fechaDia + "T00:00:00");
    d.setDate(d.getDate() - 1);
    setFechaDia(fechaISO(d));
  }
  function nextDia() {
    const d = new Date(fechaDia + "T00:00:00");
    d.setDate(d.getDate() + 1);
    setFechaDia(fechaISO(d));
  }
  function prevSemana() {
    const d = new Date(semanaBase + "T00:00:00");
    d.setDate(d.getDate() - 7);
    setSemanaBase(fechaISO(d));
  }
  function nextSemana() {
    const d = new Date(semanaBase + "T00:00:00");
    d.setDate(d.getDate() + 7);
    setSemanaBase(fechaISO(d));
  }

  const hoy = fechaISO(new Date());
  const turnosDia = turnos.filter((t) => t.fecha === fechaDia);
  const diasSem = diasSemana(semanaBase);

  function TurnoCard({ turno, compact }) {
    return (
      <div className={`turno-card ${turno.estado === "completado" ? "turno-completado" : ""} ${compact ? "turno-compact" : ""}`}>
        <div className={`turno-hora turno-hora-${(turno.hora || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")}`}>{turno.hora}</div>
        <div className="turno-cuerpo">
          <div className="turno-patente">{turno.patente || "—"}</div>
          {!compact && turno.dueno && <div className="turno-dueno">{turno.dueno}</div>}
          <div className="turno-tipo">{turno.tipoService}</div>
        </div>
        <div className="turno-acciones">
          {turno.estado === "pendiente" && (
            <button className="btn-completar" title="Marcar como completado" onClick={() => completarTurno(turno.id)}>
              {"✓"}
            </button>
          )}
          <button className="btn-eliminar-turno" title="Eliminar" onClick={() => eliminarTurno(turno.id)}>
            {"✕"}
          </button>
        </div>
      </div>
    );
  }

  if (cargando) return <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Cargando agenda...</div>;

  return (
    <div className="contenedor-agenda">
      <div className="header-agenda">
        <h1 className="titulo-agenda">Agenda de Services</h1>
        <div className="header-agenda-acciones">
          <div className="toggle-vista">
            <button className={vista === "dia" ? "toggle-activo" : ""} onClick={() => setVista("dia")}>
              Día
            </button>
            <button className={vista === "semana" ? "toggle-activo" : ""} onClick={() => setVista("semana")}>
              Semana
            </button>
          </div>
          <button className="boton-guardar" onClick={() => abrirModal()}>
            + Nuevo turno
          </button>
        </div>
      </div>

      {vista === "dia" && (
        <div className="vista-dia">
          <div className="nav-fecha">
            <button onClick={prevDia} className="btn-nav">{"‹"}</button>
            <div className="fecha-display">
              <input
                type="date"
                value={fechaDia}
                onChange={(e) => setFechaDia(e.target.value)}
                className="input-fecha-dia"
              />
              {fechaDia === hoy && <span className="badge-hoy">hoy</span>}
            </div>
            <button onClick={nextDia} className="btn-nav">{"›"}</button>
          </div>

          <div className="lista-turnos-dia">
            {turnosDia.length === 0 ? (
              <div className="sin-turnos">
                <p>No hay turnos para este día.</p>
                <button className="boton-guardar" onClick={() => abrirModal(fechaDia)}>
                  + Agregar turno
                </button>
              </div>
            ) : (
              <>
                <div className="resumen-dia">
                  <span>
                    {turnosDia.filter((t) => t.estado === "pendiente").length} pendiente
                    {turnosDia.filter((t) => t.estado === "pendiente").length !== 1 ? "s" : ""}
                  </span>
                  {turnosDia.filter((t) => t.estado === "completado").length > 0 && (
                    <span className="completados-count">
                      {" · "}
                      {turnosDia.filter((t) => t.estado === "completado").length} completado
                      {turnosDia.filter((t) => t.estado === "completado").length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                {turnosDia.map((t) => <TurnoCard key={t.id} turno={t} />)}
                <button className="boton-agregar-inline" onClick={() => abrirModal(fechaDia)}>
                  + Agregar turno a este día
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {vista === "semana" && (
        <div className="vista-semana">
          <div className="nav-fecha">
            <button onClick={prevSemana} className="btn-nav">{"‹"}</button>
            <span className="semana-label">
              {formatFechaDia(diasSem[0])} {"—"} {formatFechaDia(diasSem[6])}
            </span>
            <button onClick={nextSemana} className="btn-nav">{"›"}</button>
          </div>
          <div className="grilla-semana">
            {diasSem.map((fecha, i) => {
              const turnosDel = turnos.filter((t) => t.fecha === fecha);
              const esHoy = fecha === hoy;
              return (
                <div key={fecha} className={`columna-dia${esHoy ? " columna-hoy" : ""}`}>
                  <div className="col-dia-header">
                    <span className="col-dia-nombre">{NOMBRES_DIA[i]}</span>
                    <span className="col-dia-numero">{fecha.split("-")[2]}</span>
                    {esHoy && <span className="badge-hoy">hoy</span>}
                  </div>
                  <div className="col-dia-turnos">
                    {turnosDel.length === 0 ? (
                      <div className="col-sin-turnos">{"—"}</div>
                    ) : (
                      turnosDel.map((t) => <TurnoCard key={t.id} turno={t} compact />)
                    )}
                  </div>
                  <button
                    className="btn-agregar-semana"
                    title="Agregar turno"
                    onClick={() => { setVista("dia"); setFechaDia(fecha); abrirModal(fecha); }}
                  >
                    +
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {modalAbierto && (
        <div className="modal-overlay" onClick={cerrarModal}>
          <div className="modal-contenido" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{turnoGuardado ? "Turno guardado" : "Nuevo turno"}</h2>
              <button className="modal-cerrar" onClick={cerrarModal}>{"✕"}</button>
            </div>

            {turnoGuardado ? (
              <div className="post-guardado">
                <div className="post-guardado-check">{"✓"}</div>
                <p className="post-guardado-titulo">
                  {turnoGuardado.patente || "Turno"} {"—"} {turnoGuardado.hora}
                </p>
                <p className="post-guardado-subtitulo">{turnoGuardado.tipoService}</p>
                <p className="post-guardado-pregunta">{"¿Querés crear un presupuesto para este turno?"}</p>
                <div className="post-guardado-acciones">
                  <button className="boton-cancelar" onClick={cerrarModal}>No, cerrar</button>
                  <button className="boton-guardar" onClick={() => irAPresupuesto(turnoGuardado)}>
                    {"Sí, crear presupuesto →"}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={guardarTurno} className="form-turno">
                <div className="form-campo" style={{ position: "relative" }}>
                  <label>{"Vehículo (patente o dueño)"}</label>
                  <input
                    type="text"
                    placeholder="Buscar patente o nombre..."
                    value={vehiculoElegido ? `${vehiculoElegido.patente} — ${duenoDe(vehiculoElegido)}` : busquedaPatente}
                    onChange={(e) => { setBusquedaPatente(e.target.value); setVehiculoElegido(null); }}
                    className="input-producto"
                    autoFocus
                  />
                  {vehiculoElegido && (
                    <button type="button" className="btn-limpiar-vehiculo" onClick={() => { setVehiculoElegido(null); setBusquedaPatente(""); }}>
                      {"✕"}
                    </button>
                  )}
                  {sugerenciasVehiculo.length > 0 && (
                    <ul className="dropdown-vehiculo">
                      {sugerenciasVehiculo.map((v) => (
                        <li key={v.id} onClick={() => { setVehiculoElegido(v); setBusquedaPatente(v.patente); }}>
                          <strong>{v.patente}</strong> {"—"} {duenoDe(v)}
                          {v.modelo && <span className="sug-modelo"> {v.modelo}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="form-fila">
                  <div className="form-campo">
                    <label>Fecha</label>
                    <input
                      type="date"
                      value={formFecha}
                      onChange={(e) => setFormFecha(e.target.value)}
                      className="input-producto"
                      required
                    />
                  </div>
                  <div className="form-campo">
                    <label>Turno</label>
                    <div className="toggle-turno">
                      <button type="button"
                        className={formHora === "Mañana" ? "toggle-turno-activo" : ""}
                        onClick={() => setFormHora("Mañana")}>
                        Mañana
                      </button>
                      <button type="button"
                        className={formHora === "Tarde" ? "toggle-turno-activo" : ""}
                        onClick={() => setFormHora("Tarde")}>
                        Tarde
                      </button>
                    </div>
                  </div>
                </div>

                <div className="form-campo">
                  <label>Tipo de service</label>
                  <select
                    value={formTipo}
                    onChange={(e) => setFormTipo(e.target.value)}
                    className="input-producto"
                    required
                  >
                    <option value="">{"Selección..."}</option>
                    {TIPOS_SERVICE.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                {formTipo === "Otro" && (
                  <div className="form-campo">
                    <label>Describir</label>
                    <input
                      type="text"
                      placeholder="Ej: Cambio de correas"
                      value={formTipoOtro}
                      onChange={(e) => setFormTipoOtro(e.target.value)}
                      className="input-producto"
                    />
                  </div>
                )}

                <div className="form-acciones">
                  <button type="button" className="boton-cancelar" onClick={cerrarModal}>Cancelar</button>
                  <button type="submit" className="boton-guardar">Guardar turno</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

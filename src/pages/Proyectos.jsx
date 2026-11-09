import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useEstado } from "../estado";
import { pesos, fecha, diasHasta } from "../lib/formato";
import { Icono, Chip, Prioridad, Progreso, Vacio, Segmentos } from "../components/ui";
import { FormProyecto, FormTarea, ESTADOS_PROYECTO } from "../components/Formularios";
import { TareaFila, TareaDetalle, Responsable } from "../components/Tareas";
import Actividad from "../components/Actividad";

const FILTROS_TAREA = {
  vencidas: { titulo: "Tareas vencidas", f: (t) => t.estado !== "Hecha" && t.fecha_limite && diasHasta(t.fecha_limite) < 0 },
  bloqueadas: { titulo: "Tareas bloqueadas", f: (t) => t.estado === "Bloqueada" },
  "sin-asignar": { titulo: "Tareas sin responsable", f: (t) => t.estado !== "Hecha" && t.responsable_tipo !== "usuario" && t.responsable_tipo !== "tercero" },
};

export default function Proyectos() {
  const { ayudas, datos, permisos } = useEstado();
  const [params, setParams] = useSearchParams();
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState("activos");
  const [inmueble, setInmueble] = useState("");
  const [nuevo, setNuevo] = useState(false);
  const [abierta, setAbierta] = useState(null);
  const navegar = useNavigate();
  const filtroTareas = FILTROS_TAREA[params.get("filtro")];

  if (filtroTareas) {
    const lista = ayudas.tareas.filter(filtroTareas.f);
    return (
      <div className="pagina">
        <button className="volver" onClick={() => setParams({})}><Icono n="atras" t={18} />Proyectos</button>
        <header className="pagina-cabeza"><h1>{filtroTareas.titulo}</h1></header>
        <section className="tarjeta">
          {lista.length ? <div className="lista-tareas">{lista.map((t) => <TareaFila key={t.id} t={t} onAbrir={(x) => setAbierta(x.id)} conProyecto />)}</div>
            : <Vacio icono="check" titulo="Nada por aquí" />}
        </section>
        {abierta && <TareaDetalle tareaId={abierta} onCerrar={() => setAbierta(null)} />}
      </div>
    );
  }

  const q = busqueda.trim().toLowerCase();
  const lista = (estado === "archivados" ? datos.proyectos.filter((p) => !ayudas.activo(p)) : ayudas.proyectosActivos)
    .filter((p) => estado === "activos" ? p.estado !== "Terminado" : estado === "terminados" ? p.estado === "Terminado" : true)
    .filter((p) => !inmueble || ayudas.idsInmuebles(p).includes(inmueble))
    .filter((p) => !q || `${p.nombre} ${p.descripcion} ${p.tipo}`.toLowerCase().includes(q))
    .sort((a, b) => "AltaMediaBaja".indexOf(a.prioridad) - "AltaMediaBaja".indexOf(b.prioridad));

  return (
    <div className="pagina">
      <header className="pagina-cabeza">
        <div>
          <p className="sobretitulo">{ayudas.proyectosActivos.length} proyectos · {ayudas.tareas.filter((t) => t.estado !== "Hecha").length} tareas abiertas</p>
          <h1>Proyectos</h1>
        </div>
        {permisos.gestionar && <button className="boton" onClick={() => setNuevo(true)}><Icono n="mas" t={18} />Nuevo proyecto</button>}
      </header>

      <div className="filtros">
        <div className="buscador"><Icono n="buscar" t={18} /><input placeholder="Buscar proyecto…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} /></div>
        <select value={inmueble} onChange={(e) => setInmueble(e.target.value)} aria-label="Filtrar por inmueble">
          <option value="">Todos los inmuebles</option>
          {ayudas.inmueblesActivos.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
        </select>
        <Segmentos valor={estado} onCambio={setEstado} opciones={[["activos", "Activos"], ["terminados", "Terminados"], ...(permisos.archivar ? [["archivados", "Archivados"]] : [])]} />
      </div>

      {lista.length === 0 ? (
        <Vacio titulo="No hay proyectos con estos filtros" />
      ) : (
        <div className="rejilla-proyectos">
          {lista.map((p) => {
            const pr = ayudas.progreso(p.id);
            const inms = ayudas.idsInmuebles(p).map((id) => ayudas.inmueble(id)?.nombre).filter(Boolean);
            const vencidas = ayudas.tareasDe(p.id).filter(FILTROS_TAREA.vencidas.f).length;
            return (
              <Link key={p.id} to={`/proyectos/${p.id}`} className="tarjeta-proyecto">
                <div className="tarjeta-proyecto-cabeza">
                  <Chip v={p.estado} />
                  <Prioridad v={p.prioridad} />
                </div>
                <h3>{p.nombre}</h3>
                <p className="tenue linea-1">{inms.length > 2 ? `${inms.length} inmuebles` : inms.join(" · ")}</p>
                <div className="tarjeta-proyecto-avance">
                  <Progreso pct={pr.pct} />
                  <span>{pr.hechas}/{pr.total}</span>
                </div>
                <div className="tarjeta-proyecto-pie">
                  <Responsable r={p} />
                  {vencidas > 0 && <span className="vence vencida"><Icono n="alerta" t={14} />{vencidas} vencida{vencidas > 1 ? "s" : ""}</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
      {nuevo && <FormProyecto onCerrar={() => setNuevo(false)} onGuardado={(p) => navegar(`/proyectos/${p.id}`)} />}
    </div>
  );
}

export function ProyectoDetalle() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { ayudas, permisos, archivar, avisar, guardar } = useEstado();
  const [editar, setEditar] = useState(false);
  const [nuevaTarea, setNuevaTarea] = useState(false);
  const [abierta, setAbierta] = useState(null);
  const [verHechas, setVerHechas] = useState(false);
  const p = ayudas.proyecto(id);
  if (!p) return <div className="pagina"><Vacio titulo="Proyecto no encontrado" /></div>;
  const archivado = !ayudas.activo(p);
  const tareas = ayudas.tareasDe(id);
  const pr = ayudas.progreso(id);
  const grupos = ["En curso", "Pendiente", "Bloqueada"].map((e) => [e, tareas.filter((t) => t.estado === e)]).filter(([, l]) => l.length);
  const hechas = tareas.filter((t) => t.estado === "Hecha");
  const ordenar = (l) => [...l].sort((a, b) => (a.fecha_limite || "9999").localeCompare(b.fecha_limite || "9999"));

  async function alternarArchivo() {
    if (!archivado && !confirm(`¿Archivar el proyecto «${p.nombre}»? Sus tareas dejan de aparecer; se puede restaurar.`)) return;
    try {
      await archivar("PROYECTOS", id, archivado);
      avisar(archivado ? "Proyecto restaurado" : "Proyecto archivado");
      if (!archivado) navegar("/proyectos");
    } catch (e) {
      avisar(e.message, "error");
    }
  }

  async function cambiarEstado(e) {
    try {
      await guardar("PROYECTOS", id, { estado: e.target.value });
      avisar(`Proyecto: ${e.target.value}`);
    } catch (err) {
      avisar(err.message, "error");
    }
  }

  return (
    <div className="pagina">
      <Link to="/proyectos" className="volver"><Icono n="atras" t={18} />Proyectos</Link>
      <header className="pagina-cabeza">
        <div>
          <p className="sobretitulo">{p.tipo}{archivado && " · ARCHIVADO"}</p>
          <h1>{p.nombre}</h1>
        </div>
        <div className="acciones-cabeza">
          {permisos.gestionar && !archivado && <button className="boton boton-suave" onClick={() => setEditar(true)}><Icono n="editar" t={16} />Editar</button>}
          {permisos.gestionar && !archivado && <button className="boton" onClick={() => setNuevaTarea(true)}><Icono n="mas" t={18} />Tarea</button>}
        </div>
      </header>

      <section className="tarjeta resumen-proyecto">
        <div className="resumen-avance">
          <div className="resumen-pct"><strong>{Math.round(pr.pct * 100)}%</strong><span>{pr.hechas} de {pr.total} tareas hechas</span></div>
          <Progreso pct={pr.pct} grande />
        </div>
        <dl className="ficha ficha-columnas">
          <div><dt>Estado</dt><dd>
            {permisos.gestionar && !archivado ? (
              <select className="select-chip" value={p.estado} onChange={cambiarEstado}>{ESTADOS_PROYECTO.map((e) => <option key={e}>{e}</option>)}</select>
            ) : <Chip v={p.estado} />}
          </dd></div>
          <div><dt>Prioridad</dt><dd><Prioridad v={p.prioridad} /></dd></div>
          <div><dt>Responsable</dt><dd><Responsable r={p} /></dd></div>
          <div><dt>Fechas</dt><dd>{p.fecha_inicio ? fecha(p.fecha_inicio) : "—"} → {p.fecha_fin ? fecha(p.fecha_fin) : "—"}</dd></div>
          {permisos.verValores && <div><dt>Presupuesto</dt><dd>{p.presupuesto === "" || p.presupuesto === undefined ? "Por cotizar" : pesos(p.presupuesto)}</dd></div>}
          {permisos.verValores && <div><dt>Invertido</dt><dd>{pesos(p.invertido || 0)}</dd></div>}
          <div className="ficha-ancha"><dt>Inmuebles</dt><dd className="opciones-chips">
            {ayudas.idsInmuebles(p).map((iid) => ayudas.inmueble(iid) && <Link key={iid} to={`/inmuebles/${iid}`} className="opcion-chip">{ayudas.inmueble(iid).nombre}</Link>)}
          </dd></div>
        </dl>
        {p.descripcion && <p className="descripcion">{p.descripcion}</p>}
      </section>

      <section className="tarjeta">
        <div className="tarjeta-cabeza"><h2>Tareas</h2></div>
        {tareas.length === 0 && <Vacio icono="tareas" titulo="Este proyecto aún no tiene tareas">{permisos.gestionar && "Crea la primera con el botón «Tarea»."}</Vacio>}
        {grupos.map(([e, l]) => (
          <div key={e} className="grupo-tareas">
            <h4>{e} <span>{l.length}</span></h4>
            <div className="lista-tareas">{ordenar(l).map((t) => <TareaFila key={t.id} t={t} onAbrir={(x) => setAbierta(x.id)} />)}</div>
          </div>
        ))}
        {hechas.length > 0 && (
          <div className="grupo-tareas">
            <button className="boton-texto" onClick={() => setVerHechas((v) => !v)}>
              <Icono n={verHechas ? "atras" : "adelante"} t={16} />Hechas ({hechas.length})
            </button>
            {verHechas && <div className="lista-tareas">{hechas.map((t) => <TareaFila key={t.id} t={t} onAbrir={(x) => setAbierta(x.id)} />)}</div>}
          </div>
        )}
      </section>

      <section className="tarjeta"><Actividad entidad="PROYECTOS" id={id} /></section>

      {permisos.archivar && (
        <button className="boton-texto peligro" onClick={alternarArchivo}><Icono n="archivar" t={16} />{archivado ? "Restaurar proyecto" : "Archivar proyecto"}</button>
      )}

      {editar && <FormProyecto proyecto={p} onCerrar={() => setEditar(false)} />}
      {nuevaTarea && <FormTarea proyectoId={id} onCerrar={() => setNuevaTarea(false)} />}
      {abierta && <TareaDetalle tareaId={abierta} onCerrar={() => setAbierta(null)} />}
    </div>
  );
}

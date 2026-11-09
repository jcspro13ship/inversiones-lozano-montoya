import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useEstado } from "../estado";
import { pesos, pesosCorto, fecha, diasHasta } from "../lib/formato";
import { Icono, Chip, Prioridad, Progreso, Vacio, Segmentos, Modal } from "../components/ui";
import { FormProyecto, FormTarea, ESTADOS_PROYECTO } from "../components/Formularios";
import { TareaFila, TareaDetalle, Responsable } from "../components/Tareas";
import Actividad from "../components/Actividad";
import { Diagnostico, Escenario, FormInmueble, valorConTasas } from "./Inmuebles";

const FILTROS_TAREA = {
  vencidas: { titulo: "Tareas vencidas", f: (t) => t.estado !== "Hecha" && t.fecha_limite && diasHasta(t.fecha_limite) < 0 },
  bloqueadas: { titulo: "Tareas bloqueadas", f: (t) => t.estado === "Bloqueada" },
  "sin-asignar": { titulo: "Tareas sin responsable", f: (t) => t.estado !== "Hecha" && t.responsable_tipo !== "usuario" && t.responsable_tipo !== "tercero" },
};

const PESO_PRIORIDAD = { Alta: 0, Media: 1, Baja: 2 };

export default function Proyectos() {
  const { ayudas, datos, permisos } = useEstado();
  const [params, setParams] = useSearchParams();
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState("activos");
  const [elegir, setElegir] = useState(false);
  const [nuevo, setNuevo] = useState(null); // "inmueble" | "proyecto"
  const [abierta, setAbierta] = useState(null);
  const [escenario, setEscenario] = useState(null);
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
  const base = estado === "archivados" ? datos.proyectos.filter((p) => !ayudas.activo(p)) : ayudas.proyectosActivos;
  const lista = base
    .filter((p) => (estado === "activos" ? p.estado !== "Terminado" : estado === "terminados" ? p.estado === "Terminado" : true))
    .filter((p) => !q || `${p.nombre} ${p.descripcion} ${p.tipo}`.toLowerCase().includes(q))
    .sort((a, b) => (PESO_PRIORIDAD[a.prioridad] ?? 3) - (PESO_PRIORIDAD[b.prioridad] ?? 3));
  const deInmuebles = lista.filter(ayudas.esDeInmueble);
  const otros = lista.filter((p) => !ayudas.esDeInmueble(p));

  const tasas = escenario || datos.config?.tasas;
  const total = tasas ? ayudas.inmueblesActivos.reduce((s, i) => s + (valorConTasas(i, tasas).valor || 0), 0) : 0;
  const abiertas = ayudas.tareas.filter((t) => t.estado !== "Hecha").length;

  return (
    <div className="pagina">
      <header className="pagina-cabeza">
        <div>
          <p className="sobretitulo">{ayudas.inmueblesActivos.length} inmuebles · {ayudas.proyectosActivos.length - ayudas.proyectosActivos.filter(ayudas.esDeInmueble).length} proyectos futuros · {abiertas} tareas abiertas</p>
          <h1>Proyectos</h1>
        </div>
        {permisos.gestionar && <button className="boton" onClick={() => (permisos.editarInventario ? setElegir(true) : setNuevo("proyecto"))}><Icono n="mas" t={18} />Nuevo</button>}
      </header>

      {permisos.verValores && tasas && estado === "activos" && <Escenario base={datos.config.tasas} valor={escenario} onCambio={setEscenario} total={total} />}

      <div className="filtros">
        <div className="buscador"><Icono n="buscar" t={18} /><input placeholder="Buscar inmueble o proyecto…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} /></div>
        <Segmentos valor={estado} onCambio={setEstado} opciones={[["activos", "Activos"], ["terminados", "Terminados"], ...(permisos.archivar ? [["archivados", "Archivados"]] : [])]} />
      </div>

      {lista.length === 0 && <Vacio titulo="No hay proyectos con estos filtros" />}

      {deInmuebles.length > 0 && (
        <section className="seccion">
          <h2 className="seccion-titulo"><Icono n="edificio" t={18} />Inmuebles</h2>
          <div className="rejilla-proyectos">{deInmuebles.map((p) => <TarjetaProyecto key={p.id} p={p} tasas={tasas} />)}</div>
        </section>
      )}

      {(otros.length > 0 || estado === "activos") && (
        <section className="seccion">
          <h2 className="seccion-titulo"><Icono n="carpeta" t={18} />Proyectos futuros y otros</h2>
          {otros.length > 0 ? (
            <div className="rejilla-proyectos">{otros.map((p) => <TarjetaProyecto key={p.id} p={p} />)}</div>
          ) : (
            <div className="tarjeta"><Vacio icono="carpeta" titulo="Aún no hay proyectos futuros">{permisos.gestionar && "Crea uno con «Nuevo»: una remodelación, una compra, un proyecto urbanístico…"}</Vacio></div>
          )}
        </section>
      )}

      {elegir && (
        <Modal titulo="¿Qué quieres crear?" onCerrar={() => setElegir(false)}>
          <div className="eleccion">
            <button onClick={() => { setElegir(false); setNuevo("inmueble"); }}>
              <span className="tipo-icono"><Icono n="edificio" /></span>
              <span><strong>Un inmueble nuevo</strong><small>Se crea el inmueble con su proyecto, su diagnóstico y sus tareas.</small></span>
            </button>
            <button onClick={() => { setElegir(false); setNuevo("proyecto"); }}>
              <span className="tipo-icono tipo-residencial"><Icono n="carpeta" /></span>
              <span><strong>Un proyecto futuro u otro</strong><small>Una obra, compra, venta o proyecto que puede cubrir uno o varios inmuebles, o ninguno todavía.</small></span>
            </button>
          </div>
        </Modal>
      )}
      {nuevo === "inmueble" && <FormInmueble onCerrar={() => setNuevo(null)} />}
      {nuevo === "proyecto" && <FormProyecto onCerrar={() => setNuevo(null)} onGuardado={(p) => navegar(`/proyectos/${p.id}`)} />}
    </div>
  );
}

function TarjetaProyecto({ p, tasas }) {
  const { ayudas, permisos } = useEstado();
  const pr = ayudas.progreso(p.id);
  const vencidas = ayudas.tareasDe(p.id).filter(FILTROS_TAREA.vencidas.f).length;
  const inm = ayudas.esDeInmueble(p) ? ayudas.inmueble(ayudas.idsInmuebles(p)[0]) : null;
  const inms = ayudas.idsInmuebles(p).map((id) => ayudas.inmueble(id)?.nombre).filter(Boolean);
  const valor = inm && tasas ? valorConTasas(inm, tasas).valor : null;
  return (
    <Link to={`/proyectos/${p.id}`} className="tarjeta-proyecto">
      <div className="tarjeta-proyecto-cabeza">
        {inm ? <span className={`tipo-icono tipo-${String(inm.tipo).toLowerCase()}`}><Icono n="edificio" /></span> : <Chip v={p.estado} />}
        <Prioridad v={p.prioridad} />
      </div>
      <h3>{p.nombre}</h3>
      <p className="tenue linea-1">
        {inm ? [inm.tipo, inm.ciudad || "Ciudad sin dato"].join(" · ") : inms.length ? (inms.length > 2 ? `${inms.length} inmuebles` : inms.join(" · ")) : p.tipo}
      </p>
      {inm && permisos.verValores && (
        <div className="cifras">
          <div><span>Canon</span><strong>{pesosCorto(inm.canon_mensual)}</strong></div>
          <div><span>Valor estimado</span><strong>{valor ? pesosCorto(valor) : "Sin dato"}</strong></div>
        </div>
      )}
      <div className="tarjeta-proyecto-avance">
        <Progreso pct={pr.pct} />
        <span>{pr.hechas}/{pr.total} tareas</span>
      </div>
      <div className="tarjeta-proyecto-pie">
        <Responsable r={p} />
        {vencidas > 0 && <span className="vence vencida"><Icono n="alerta" t={14} />{vencidas} vencida{vencidas > 1 ? "s" : ""}</span>}
      </div>
    </Link>
  );
}

export function ProyectoDetalle() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const navegar = useNavigate();
  const { ayudas, permisos, archivar, avisar, guardar } = useEstado();
  const [editar, setEditar] = useState(false);
  const [nuevaTarea, setNuevaTarea] = useState(false);
  const [abierta, setAbierta] = useState(null);
  const [verHechas, setVerHechas] = useState(false);
  const p = ayudas.proyecto(id);
  if (!p) return <div className="pagina"><Vacio titulo="Proyecto no encontrado" /></div>;

  const deInmueble = ayudas.esDeInmueble(p);
  const inmuebleId = deInmueble ? ayudas.idsInmuebles(p)[0] : null;
  const vista = params.get("vista") || "tareas";
  const pestanaActividad = params.get("archivo") || "adjuntos";
  const ir = (v, extra = {}) => setParams({ vista: v, ...extra }, { replace: true });

  const archivado = !ayudas.activo(p);
  const tareas = ayudas.tareasDe(id);
  const pr = ayudas.progreso(id);
  const grupos = ["En curso", "Pendiente", "Bloqueada"].map((e) => [e, tareas.filter((t) => t.estado === e)]).filter(([, l]) => l.length);
  const hechas = tareas.filter((t) => t.estado === "Hecha");
  const ordenar = (l) => [...l].sort((a, b) => (a.fecha_limite || "9999").localeCompare(b.fecha_limite || "9999"));
  const nAdj = ayudas.adjuntosDe("PROYECTOS", id).length;
  const nCom = ayudas.comentariosDe("PROYECTOS", id).length;

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

  const pestanas = [
    ["tareas", `Tareas · ${pr.total - pr.hechas}`],
    ...(deInmueble ? [["diagnostico", "Diagnóstico inicial"]] : []),
    ["archivos", `Archivos y comentarios${nAdj + nCom ? ` · ${nAdj + nCom}` : ""}`],
  ];

  return (
    <div className="pagina">
      <Link to="/proyectos" className="volver"><Icono n="atras" t={18} />Proyectos</Link>
      <header className="pagina-cabeza">
        <div>
          <p className="sobretitulo">{deInmueble ? "Inmueble" : p.tipo}{archivado && " · ARCHIVADO"}</p>
          <h1>{p.nombre}</h1>
        </div>
        {!archivado && (
          <div className="acciones-cabeza">
            {permisos.gestionar && <button className="boton boton-suave" onClick={() => setEditar(true)}><Icono n="editar" t={16} /><span className="ocultar-movil">Editar</span></button>}
            {permisos.gestionar && <button className="boton boton-suave" onClick={() => ir("archivos", { archivo: "adjuntos" })}><Icono n="clip" t={16} />Adjuntar</button>}
            {permisos.gestionar && <button className="boton" onClick={() => setNuevaTarea(true)}><Icono n="mas" t={18} />Tarea</button>}
          </div>
        )}
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
          {!deInmueble && ayudas.idsInmuebles(p).length > 0 && (
            <div className="ficha-ancha"><dt>Inmuebles</dt><dd className="opciones-chips">
              {ayudas.idsInmuebles(p).map((iid) => {
                const inm = ayudas.inmueble(iid);
                const pi = ayudas.proyectoDeInmueble(iid);
                return inm && <Link key={iid} to={pi ? `/proyectos/${pi.id}?vista=diagnostico` : "/proyectos"} className="opcion-chip">{inm.nombre}</Link>;
              })}
            </dd></div>
          )}
        </dl>
        {p.descripcion && <p className="descripcion">{p.descripcion}</p>}
      </section>

      <Segmentos valor={vista} onCambio={(v) => ir(v)} opciones={pestanas} />

      {vista === "tareas" && (
        <section className="tarjeta">
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
      )}

      {vista === "diagnostico" && deInmueble && <Diagnostico inmuebleId={inmuebleId} />}

      {vista === "archivos" && (
        <section className="tarjeta">
          <p className="tenue">Contratos, recibos, fotos y comentarios del proyecto. Para archivos de una tarea en particular, ábrela y usa su pestaña «Adjuntos».</p>
          <Actividad key={pestanaActividad} entidad="PROYECTOS" id={id} inicial={pestanaActividad} />
        </section>
      )}

      {permisos.archivar && vista !== "diagnostico" && (
        <button className="boton-texto peligro" onClick={alternarArchivo}><Icono n="archivar" t={16} />{archivado ? "Restaurar proyecto" : "Archivar proyecto"}</button>
      )}

      {editar && <FormProyecto proyecto={p} onCerrar={() => setEditar(false)} />}
      {nuevaTarea && <FormTarea proyectoId={id} onCerrar={() => setNuevaTarea(false)} />}
      {abierta && <TareaDetalle tareaId={abierta} onCerrar={() => setAbierta(null)} />}
    </div>
  );
}

import { useState } from "react";
import { Link } from "react-router-dom";
import { useEstado } from "../estado";
import { pesos, pesosCorto, porcentaje, diasHasta } from "../lib/formato";
import { Icono, Progreso, Prioridad, Vacio } from "../components/ui";
import { TareaFila, TareaDetalle } from "../components/Tareas";

function saludo() {
  const h = new Date().getHours();
  return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
}

export default function Tablero() {
  const { sesion, datos, ayudas, permisos } = useEstado();
  const [abierta, setAbierta] = useState(null);
  const yo = sesion.usuario.id;
  const abiertas = ayudas.tareas.filter((t) => t.estado !== "Hecha");
  const mias = abiertas.filter((t) => t.responsable_tipo === "usuario" && t.responsable_usuario_id === yo)
    .sort((a, b) => (a.fecha_limite || "9999").localeCompare(b.fecha_limite || "9999"));
  const vencidas = abiertas.filter((t) => t.fecha_limite && diasHasta(t.fecha_limite) < 0);
  const sinAsignar = abiertas.filter((t) => t.responsable_tipo !== "usuario" && t.responsable_tipo !== "tercero");
  const bloqueadas = abiertas.filter((t) => t.estado === "Bloqueada");
  const c = datos.consolidado;

  return (
    <div className="pagina">
      <header className="pagina-cabeza">
        <div>
          <p className="sobretitulo">{saludo()}, {sesion.usuario.nombre.split(" ")[0]}</p>
          <h1>Resumen</h1>
        </div>
      </header>

      {permisos.verValores && c && (
        <section className="kpis">
          <div className="kpi kpi-destacado">
            <span>Valor estimado del portafolio</span>
            <strong>{pesosCorto(c.valor_estimado)}</strong>
            <small>Rango {pesosCorto(c.valor_bajo)} – {pesosCorto(c.valor_alto)}</small>
          </div>
          <div className="kpi">
            <span>Canon mensual</span>
            <strong>{pesos(c.canon_mensual)}</strong>
            <small>{pesos(c.ingreso_anual)} al año</small>
          </div>
          <div className="kpi">
            <span>Rentabilidad bruta</span>
            <strong>{porcentaje(c.rentabilidad_bruta)}</strong>
            <small>sobre el valor estimado</small>
          </div>
          <div className="kpi">
            <span>Unidades</span>
            <strong>{c.total_unidades}</strong>
            <small>{c.unidades_sin_canon} sin canon · {c.unidades_sin_contrato} sin contrato escrito</small>
          </div>
        </section>
      )}

      <section className="kpis kpis-tareas">
        <Link to="/mis-tareas" className="kpi kpi-enlace"><span>Mis tareas abiertas</span><strong>{mias.length}</strong></Link>
        <Link to="/proyectos?filtro=vencidas" className={`kpi kpi-enlace ${vencidas.length ? "kpi-alerta" : ""}`}><span>Vencidas</span><strong>{vencidas.length}</strong></Link>
        <Link to="/proyectos?filtro=bloqueadas" className="kpi kpi-enlace"><span>Bloqueadas</span><strong>{bloqueadas.length}</strong></Link>
        <Link to="/proyectos?filtro=sin-asignar" className="kpi kpi-enlace"><span>Sin responsable</span><strong>{sinAsignar.length}</strong></Link>
      </section>

      <div className="columnas">
        <section className="tarjeta">
          <div className="tarjeta-cabeza">
            <h2>Mis próximas tareas</h2>
            <Link to="/mis-tareas" className="enlace-ver">Ver todas<Icono n="adelante" t={16} /></Link>
          </div>
          {mias.length === 0 ? (
            <Vacio icono="tareas" titulo="No tienes tareas abiertas">Cuando te asignen una tarea aparecerá aquí.</Vacio>
          ) : (
            <div className="lista-tareas">
              {mias.slice(0, 6).map((t) => <TareaFila key={t.id} t={t} onAbrir={(x) => setAbierta(x.id)} conProyecto />)}
            </div>
          )}
        </section>

        <section className="tarjeta">
          <div className="tarjeta-cabeza">
            <h2>Avance por inmueble</h2>
            <Link to="/proyectos" className="enlace-ver">Proyectos<Icono n="adelante" t={16} /></Link>
          </div>
          <div className="avance-inmuebles">
            {ayudas.inmueblesActivos.map((i) => {
              const proyecto = ayudas.proyectoDeInmueble(i.id);
              const ts = ayudas.proyectosDeInmueble(i.id).flatMap((p) => ayudas.tareasDe(p.id));
              const hechas = ts.filter((t) => t.estado === "Hecha").length;
              const pct = ts.length ? hechas / ts.length : 0;
              return (
                <Link key={i.id} to={proyecto ? `/proyectos/${proyecto.id}` : "/proyectos"} className="avance-fila">
                  <div className="avance-nombre">
                    <strong>{i.nombre}</strong>
                    <Prioridad v={i.prioridad} />
                  </div>
                  <Progreso pct={pct} />
                  <small>{hechas}/{ts.length}</small>
                </Link>
              );
            })}
          </div>
        </section>
      </div>

      {permisos.verValores && datos.config?.alertas?.length > 0 && (
        <section className="tarjeta tarjeta-alerta">
          <div className="tarjeta-cabeza"><h2><Icono n="alerta" t={18} /> Verificar antes de confiar en los valores</h2></div>
          <ul className="lista-alertas">{datos.config.alertas.map((a) => <li key={a}>{a}</li>)}</ul>
        </section>
      )}

      {abierta && <TareaDetalle tareaId={abierta} onCerrar={() => setAbierta(null)} />}
    </div>
  );
}

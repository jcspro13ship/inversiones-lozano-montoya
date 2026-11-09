import { useState } from "react";
import { Link } from "react-router-dom";
import { useEstado } from "../estado";
import { diasHasta, fecha } from "../lib/formato";
import { Icono, Avatar, Chip, Prioridad, Modal } from "./ui";
import { FormTarea, ESTADOS_TAREA } from "./Formularios";
import Actividad from "./Actividad";

export function Vence({ f, hecha }) {
  if (!f) return null;
  const d = diasHasta(f);
  const clase = hecha ? "" : d < 0 ? "vencida" : d <= 3 ? "pronto" : "";
  const texto = hecha ? fecha(f) : d < 0 ? `Vencida · ${fecha(f)}` : d === 0 ? "Vence hoy" : d === 1 ? "Vence mañana" : fecha(f);
  return <span className={`vence ${clase}`}><Icono n="calendario" t={14} />{texto}</span>;
}

export function Responsable({ r, compacto }) {
  const { ayudas } = useEstado();
  const x = ayudas.responsable(r);
  if (x.tipo === "pendiente") return <span className="responsable sin-asignar"><Icono n="alerta" t={14} />Sin asignar</span>;
  return (
    <span className="responsable">
      <Avatar nombre={x.nombre} tercero={x.tipo === "tercero"} t={22} />
      {!compacto && <span>{x.nombre}{x.tipo === "tercero" && <em> · tercero</em>}</span>}
    </span>
  );
}

export function TareaFila({ t, onAbrir, conProyecto }) {
  const { ayudas, guardar, permisos, avisar } = useEstado();
  const hecha = t.estado === "Hecha";
  const nComentarios = ayudas.comentariosDe("TAREAS", t.id).length;
  const nAdjuntos = ayudas.adjuntosDe("TAREAS", t.id).length;

  async function alternar(e) {
    e.stopPropagation();
    try {
      await guardar("TAREAS", t.id, { estado: hecha ? "Pendiente" : "Hecha" });
      avisar(hecha ? "Tarea reabierta" : "Tarea terminada");
    } catch (err) {
      avisar(err.message, "error");
    }
  }

  return (
    <div className={`tarea-fila ${hecha ? "hecha" : ""}`} onClick={() => onAbrir(t)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onAbrir(t)}>
      <button className={`check ${hecha ? "marcado" : ""}`} onClick={alternar} disabled={!permisos.gestionar} aria-label={hecha ? "Reabrir tarea" : "Marcar como hecha"}>
        {hecha && <Icono n="check" t={14} />}
      </button>
      <div className="tarea-cuerpo">
        <div className="tarea-titulo">{t.titulo}</div>
        <div className="tarea-meta">
          {conProyecto && <span className="tenue">{ayudas.proyecto(t.proyecto_id)?.nombre}</span>}
          {!hecha && t.estado !== "Pendiente" && <Chip v={t.estado} />}
          <Prioridad v={t.prioridad} />
          <Vence f={t.fecha_limite} hecha={hecha} />
          {nComentarios > 0 && <span className="contador"><Icono n="mensaje" t={14} />{nComentarios}</span>}
          {nAdjuntos > 0 && <span className="contador"><Icono n="clip" t={14} />{nAdjuntos}</span>}
        </div>
      </div>
      <Responsable r={t} compacto />
    </div>
  );
}

export function TareaDetalle({ tareaId, onCerrar }) {
  const { datos, ayudas, guardar, archivar, permisos, avisar } = useEstado();
  const [editando, setEditando] = useState(false);
  const t = datos.tareas.find((x) => x.id === tareaId);
  if (!t) return null;
  const proyecto = ayudas.proyecto(t.proyecto_id);
  const unidad = datos.unidades.find((u) => u.id === t.unidad_id);
  const resp = ayudas.responsable(t);

  async function cambiarEstado(estado) {
    try {
      await guardar("TAREAS", t.id, { estado });
      avisar(`Estado: ${estado}`);
    } catch (err) {
      avisar(err.message, "error");
    }
  }

  async function archivarTarea() {
    if (!confirm("¿Archivar esta tarea? Queda en el historial y un administrador puede restaurarla.")) return;
    try {
      await archivar("TAREAS", t.id);
      avisar("Tarea archivada");
      onCerrar();
    } catch (err) {
      avisar(err.message, "error");
    }
  }

  if (editando) return <FormTarea tarea={t} onCerrar={() => setEditando(false)} />;

  return (
    <Modal titulo="Tarea" onCerrar={onCerrar} ancho={720}>
      <div className="detalle-tarea">
        <div className="detalle-tarea-cabeza">
          <h3>{t.titulo}</h3>
          {permisos.gestionar && <button className="boton boton-suave" onClick={() => setEditando(true)}><Icono n="editar" t={16} />Editar</button>}
        </div>
        {proyecto && <Link className="enlace-proyecto" to={`/proyectos/${proyecto.id}`} onClick={onCerrar}><Icono n="carpeta" t={15} />{proyecto.nombre}</Link>}

        <div className="estados-rapidos">
          {ESTADOS_TAREA.map((e) => (
            <button key={e} className={`estado-rapido estado-${e.replace(" ", "-").toLowerCase()} ${t.estado === e ? "activo" : ""}`} disabled={!permisos.gestionar || t.estado === e} onClick={() => cambiarEstado(e)}>
              {e}
            </button>
          ))}
        </div>

        <dl className="ficha">
          <div><dt>Responsable</dt><dd><Responsable r={t} />{resp.contacto && <a className="contacto" href={/@/.test(resp.contacto) ? `mailto:${resp.contacto}` : `tel:${resp.contacto.replace(/\s/g, "")}`}><Icono n="telefono" t={14} />{resp.contacto}</a>}</dd></div>
          <div><dt>Prioridad</dt><dd><Prioridad v={t.prioridad} /></dd></div>
          <div><dt>Fecha límite</dt><dd>{t.fecha_limite ? <Vence f={t.fecha_limite} hecha={t.estado === "Hecha"} /> : <span className="tenue">Sin fecha</span>}</dd></div>
          {unidad && <div><dt>Unidad</dt><dd>{unidad.unidad}</dd></div>}
          <div><dt>Creada</dt><dd>{ayudas.nombreUsuario(t.creado_por)} · {fecha(t.creado_en)}</dd></div>
          {t.completada_en && <div><dt>Terminada</dt><dd>{fecha(t.completada_en)}</dd></div>}
        </dl>
        {t.descripcion && <p className="descripcion">{t.descripcion}</p>}

        <Actividad entidad="TAREAS" id={t.id} />

        {permisos.archivar && (
          <button className="boton-texto peligro" onClick={archivarTarea}><Icono n="archivar" t={16} />Archivar tarea</button>
        )}
      </div>
    </Modal>
  );
}

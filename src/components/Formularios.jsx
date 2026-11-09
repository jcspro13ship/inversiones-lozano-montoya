import { useState } from "react";
import { useEstado } from "../estado";
import { Modal, Campo, Segmentos } from "./ui";

export const ESTADOS_TAREA = ["Pendiente", "En curso", "Bloqueada", "Hecha"];
export const ESTADOS_PROYECTO = ["Planeación", "En curso", "En pausa", "Bloqueado", "Terminado"];
export const PRIORIDADES = ["Alta", "Media", "Baja"];
export const TIPOS_PROYECTO = ["Proyecto futuro", "Compra", "Venta", "Remodelación", "Contratos", "Contratos y mantenimiento", "Contratos y cobranza", "Legal", "Legal y cobranza", "Mantenimiento", "Obra", "Eléctrico", "Financiero", "Planeación", "Verificación", "Otro"];

// Responsable: un usuario de la app o un tercero que no tiene usuario.
export function SelectorResponsable({ valor, onCambio, obligatorio }) {
  const { ayudas } = useEstado();
  const tipo = valor.responsable_tipo === "tercero" ? "tercero" : "usuario";
  const set = (cambios) => onCambio({ ...valor, ...cambios });
  return (
    <div className="selector-responsable campo-ancho">
      <span className="campo-etiqueta">Responsable{obligatorio && " *"}</span>
      <Segmentos
        opciones={[["usuario", "Usuario de la app"], ["tercero", "Tercero"]]}
        valor={tipo}
        onCambio={(t) => set({ responsable_tipo: t, ...(t === "usuario" ? { responsable_externo: "", responsable_contacto: "" } : { responsable_usuario_id: "" }) })}
      />
      {tipo === "usuario" ? (
        <select
          value={valor.responsable_usuario_id || ""}
          onChange={(e) => set({ responsable_tipo: "usuario", responsable_usuario_id: e.target.value })}
          required={obligatorio}
        >
          <option value="">Selecciona un usuario…</option>
          {ayudas.usuariosActivos.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
        </select>
      ) : (
        <div className="fila-campos">
          <input placeholder="Nombre del tercero (ej. Electricista Ramírez)" value={valor.responsable_externo || ""} onChange={(e) => set({ responsable_tipo: "tercero", responsable_externo: e.target.value })} required={obligatorio} />
          <input placeholder="Teléfono o correo (opcional)" value={valor.responsable_contacto || ""} onChange={(e) => set({ responsable_tipo: "tercero", responsable_contacto: e.target.value })} />
        </div>
      )}
    </div>
  );
}

function responsableCompleto(v) {
  return (v.responsable_tipo === "usuario" && v.responsable_usuario_id) || (v.responsable_tipo === "tercero" && String(v.responsable_externo || "").trim());
}

export function FormTarea({ tarea, proyectoId, onCerrar, onGuardada }) {
  const { guardar, avisar, ayudas } = useEstado();
  const nueva = !tarea;
  const [v, setV] = useState(() => ({
    titulo: "", descripcion: "", estado: "Pendiente", prioridad: "Media", fecha_limite: "", unidad_id: "",
    responsable_tipo: "usuario", responsable_usuario_id: "", responsable_externo: "", responsable_contacto: "",
    ...(tarea || {}),
    ...(tarea?.responsable_tipo === "pendiente" ? { responsable_tipo: "usuario" } : {}),
    proyecto_id: tarea?.proyecto_id || proyectoId,
  }));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });

  const proyecto = ayudas.proyecto(v.proyecto_id);
  const unidades = proyecto ? ayudas.idsInmuebles(proyecto).flatMap((id) => ayudas.unidadesDe(id).map((u) => ({ ...u, inm: ayudas.inmueble(id)?.nombre }))) : [];

  async function enviar(e) {
    e.preventDefault();
    if (!responsableCompleto(v)) return setError("Selecciona un responsable: un usuario o escribe el nombre del tercero.");
    setGuardando(true);
    setError("");
    try {
      const campos = ["proyecto_id", "titulo", "descripcion", "estado", "prioridad", "fecha_limite", "unidad_id", "responsable_tipo", "responsable_usuario_id", "responsable_externo", "responsable_contacto"];
      const data = Object.fromEntries(campos.map((k) => [k, v[k] ?? ""]));
      const r = await guardar("TAREAS", tarea?.id, data);
      avisar(nueva ? "Tarea creada" : "Tarea actualizada");
      onGuardada?.(r);
      onCerrar();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      titulo={nueva ? "Nueva tarea" : "Editar tarea"}
      onCerrar={onCerrar}
      pie={
        <>
          <button type="button" className="boton boton-suave" onClick={onCerrar}>Cancelar</button>
          <button type="submit" form="form-tarea" className="boton" disabled={guardando}>{guardando ? "Guardando…" : "Guardar tarea"}</button>
        </>
      }
    >
      <form id="form-tarea" className="formulario" onSubmit={enviar}>
        {nueva && !proyectoId && (
          <Campo etiqueta="Proyecto *" ancho>
            <select value={v.proyecto_id || ""} onChange={set("proyecto_id")} required>
              <option value="">Selecciona un proyecto…</option>
              {ayudas.proyectosActivos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </Campo>
        )}
        <Campo etiqueta="Título *" ancho>
          <input value={v.titulo} onChange={set("titulo")} required autoFocus={nueva} placeholder="¿Qué hay que hacer?" />
        </Campo>
        <Campo etiqueta="Descripción" ancho>
          <textarea rows={3} value={v.descripcion} onChange={set("descripcion")} placeholder="Detalles, acuerdos, datos útiles…" />
        </Campo>
        <SelectorResponsable valor={v} onCambio={setV} obligatorio />
        <Campo etiqueta="Estado">
          <select value={v.estado} onChange={set("estado")}>{ESTADOS_TAREA.map((x) => <option key={x}>{x}</option>)}</select>
        </Campo>
        <Campo etiqueta="Prioridad">
          <select value={v.prioridad} onChange={set("prioridad")}>{PRIORIDADES.map((x) => <option key={x}>{x}</option>)}</select>
        </Campo>
        <Campo etiqueta="Fecha límite">
          <input type="date" value={v.fecha_limite || ""} onChange={set("fecha_limite")} />
        </Campo>
        {unidades.length > 0 && (
          <Campo etiqueta="Unidad relacionada">
            <select value={v.unidad_id || ""} onChange={set("unidad_id")}>
              <option value="">Ninguna en particular</option>
              {unidades.map((u) => <option key={u.id} value={u.id}>{u.unidad} · {u.inm}</option>)}
            </select>
          </Campo>
        )}
        {error && <p className="error campo-ancho">{error}</p>}
      </form>
    </Modal>
  );
}

export function FormProyecto({ proyecto, inmuebleId, onCerrar, onGuardado }) {
  const { guardar, avisar, ayudas, permisos } = useEstado();
  const nuevo = !proyecto;
  const [v, setV] = useState(() => ({
    nombre: "", descripcion: "", tipo: "Proyecto futuro", estado: "Planeación", prioridad: "Media",
    fecha_inicio: "", fecha_fin: "", presupuesto: "", invertido: "",
    responsable_tipo: "usuario", responsable_usuario_id: "", responsable_externo: "", responsable_contacto: "",
    ...(proyecto || {}),
    ...(proyecto?.responsable_tipo === "pendiente" ? { responsable_tipo: "usuario" } : {}),
  }));
  const [inms, setInms] = useState(() => (proyecto ? ayudas.idsInmuebles(proyecto) : inmuebleId ? [inmuebleId] : []));
  const esInmueble = proyecto ? ayudas.esDeInmueble(proyecto) : false;
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });

  async function enviar(e) {
    e.preventDefault();
    setGuardando(true);
    setError("");
    try {
      const campos = ["nombre", "descripcion", "tipo", "estado", "prioridad", "fecha_inicio", "fecha_fin", "responsable_tipo", "responsable_usuario_id", "responsable_externo", "responsable_contacto"];
      if (permisos.verValores) campos.push("presupuesto", "invertido");
      const data = Object.fromEntries(campos.map((k) => [k, v[k] ?? ""]));
      if (!responsableCompleto(v)) { data.responsable_tipo = "pendiente"; data.responsable_usuario_id = ""; data.responsable_externo = ""; }
      data.inmueble_ids = inms.join(",");
      const r = await guardar("PROYECTOS", proyecto?.id, data);
      avisar(nuevo ? "Proyecto creado" : "Proyecto actualizado");
      onGuardado?.(r);
      onCerrar();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  const alternar = (id) => setInms((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));

  return (
    <Modal
      titulo={nuevo ? "Nuevo proyecto futuro" : "Editar proyecto"}
      onCerrar={onCerrar}
      pie={
        <>
          <button type="button" className="boton boton-suave" onClick={onCerrar}>Cancelar</button>
          <button type="submit" form="form-proyecto" className="boton" disabled={guardando}>{guardando ? "Guardando…" : "Guardar proyecto"}</button>
        </>
      }
    >
      <form id="form-proyecto" className="formulario" onSubmit={enviar}>
        <Campo etiqueta="Nombre del proyecto *" ancho>
          <input value={v.nombre} onChange={set("nombre")} required autoFocus={nuevo} placeholder="Ej. Proyecto urbanístico Bateros" />
        </Campo>
        <Campo etiqueta="Descripción" ancho>
          <textarea rows={2} value={v.descripcion} onChange={set("descripcion")} />
        </Campo>
        {!esInmueble && <div className="campo campo-ancho">
          <span className="campo-etiqueta">Inmuebles relacionados (opcional)</span>
          <div className="opciones-chips">
            {ayudas.inmueblesActivos.map((i) => (
              <button type="button" key={i.id} className={`opcion-chip ${inms.includes(i.id) ? "activo" : ""}`} onClick={() => alternar(i.id)}>
                {i.nombre}
              </button>
            ))}
          </div>
        </div>}
        {!esInmueble && <Campo etiqueta="Tipo">
          <select value={v.tipo} onChange={set("tipo")}>
            {[...new Set([...TIPOS_PROYECTO, v.tipo])].filter((x) => x && x !== "Inmueble").map((x) => <option key={x}>{x}</option>)}
          </select>
        </Campo>}
        <Campo etiqueta="Estado">
          <select value={v.estado} onChange={set("estado")}>{ESTADOS_PROYECTO.map((x) => <option key={x}>{x}</option>)}</select>
        </Campo>
        <Campo etiqueta="Prioridad">
          <select value={v.prioridad} onChange={set("prioridad")}>{PRIORIDADES.map((x) => <option key={x}>{x}</option>)}</select>
        </Campo>
        <Campo etiqueta="Fecha de inicio">
          <input type="date" value={v.fecha_inicio || ""} onChange={set("fecha_inicio")} />
        </Campo>
        <Campo etiqueta="Fecha fin estimada">
          <input type="date" value={v.fecha_fin || ""} onChange={set("fecha_fin")} />
        </Campo>
        {permisos.verValores && (
          <>
            <Campo etiqueta="Presupuesto ($)">
              <input inputMode="numeric" value={v.presupuesto} onChange={set("presupuesto")} placeholder="Por cotizar" />
            </Campo>
            <Campo etiqueta="Invertido ($)">
              <input inputMode="numeric" value={v.invertido} onChange={set("invertido")} placeholder="0" />
            </Campo>
          </>
        )}
        <SelectorResponsable valor={v} onCambio={setV} />
        {error && <p className="error campo-ancho">{error}</p>}
      </form>
    </Modal>
  );
}

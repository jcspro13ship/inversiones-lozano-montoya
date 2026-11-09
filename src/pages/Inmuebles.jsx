import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useEstado } from "../estado";
import { pesos, pesosCorto, porcentaje } from "../lib/formato";
import { Icono, Prioridad, Chip, Modal, Campo } from "../components/ui";
import { PRIORIDADES } from "../components/Formularios";

const TIPOS = ["Mixto", "Comercial", "Residencial", "Rural"];
const USOS = ["Comercial", "Residencial", "Predio rural", "Otro"];

function tasaPorTipo(tipo, t) {
  const x = String(tipo || "").toLowerCase();
  if (x.includes("residencial")) return t.residencial;
  if (x.includes("rural")) return t.rural;
  return t.comercial;
}

// Recalcula el valor con tasas hipotéticas (no guarda nada).
export function valorConTasas(inm, tasas) {
  const tasa = Number(inm.tasa_manual) || tasaPorTipo(inm.tipo, tasas);
  const ingreso = (inm.canon_mensual || 0) * 12;
  if (!ingreso) return { tasa, valor: null };
  return { tasa, valor: ingreso / tasa };
}

// Las rutas antiguas /inmuebles/:id llevan al proyecto del inmueble.
export function RedirigirInmueble() {
  const { id } = useParams();
  const { ayudas } = useEstado();
  const p = ayudas.proyectoDeInmueble(id);
  return <Navigate to={p ? `/proyectos/${p.id}` : "/proyectos"} replace />;
}

export function Escenario({ base, valor, onCambio, total }) {
  const [abierto, setAbierto] = useState(false);
  const t = valor || base;
  const set = (k) => (e) => onCambio({ ...t, [k]: Number(e.target.value) / 100 });
  return (
    <section className={`tarjeta escenario ${valor ? "escenario-activo" : ""}`}>
      <button className="escenario-cabeza" onClick={() => setAbierto((v) => !v)}>
        <div>
          <span className="tenue">{valor ? "Valor del portafolio con tasas modificadas" : "Valor estimado del portafolio"}</span>
          <strong>{pesos(Math.round(total))}</strong>
        </div>
        <span className="enlace-ver">{abierto ? "Cerrar" : "Probar otras tasas"}<Icono n={abierto ? "cerrar" : "adelante"} t={16} /></span>
      </button>
      {abierto && (
        <div className="escenario-cuerpo">
          {[["comercial", "Comercial y mixto"], ["residencial", "Residencial"], ["rural", "Rural"]].map(([k, et]) => (
            <label key={k} className="deslizador">
              <span>{et}<strong>{porcentaje(t[k])}</strong></span>
              <input type="range" min="1" max="15" step="0.25" value={t[k] * 100} onChange={set(k)} />
            </label>
          ))}
          <p className="tenue">Valor = canon mensual × 12 ÷ tasa. Esto es solo una simulación: no cambia las tasas guardadas.</p>
          {valor && <button className="boton boton-suave" onClick={() => onCambio(null)}>Volver a las tasas actuales</button>}
        </div>
      )}
    </section>
  );
}

const SinDato = () => <span className="sin-dato">Sin dato</span>;

// Diagnóstico inicial de un inmueble: datos, valoración, estado, recomendación y unidades.
export function Diagnostico({ inmuebleId }) {
  const navegar = useNavigate();
  const { ayudas, permisos, archivar, avisar } = useEstado();
  const [editar, setEditar] = useState(false);
  const [unidad, setUnidad] = useState(null);
  const i = ayudas.inmueble(inmuebleId);
  if (!i) return <p className="tenue">No se encontró el inmueble.</p>;
  const unidades = ayudas.unidadesDe(inmuebleId);

  async function archivarInmueble() {
    if (!confirm(`¿Archivar «${i.nombre}» y su proyecto? Deja de contar en los totales; se puede restaurar.`)) return;
    try {
      await archivar("INMUEBLES", i.id);
      const p = ayudas.proyectoDeInmueble(i.id);
      if (p) await archivar("PROYECTOS", p.id);
      avisar("Inmueble archivado");
      navegar("/proyectos");
    } catch (e) {
      avisar(e.message, "error");
    }
  }

  return (
    <div className="diagnostico">
      {permisos.verValores && (
        <section className="kpis">
          <div className="kpi"><span>Canon mensual</span><strong>{pesos(i.canon_mensual)}</strong><small>{pesos(i.ingreso_anual)} al año</small></div>
          <div className="kpi kpi-destacado"><span>Valor estimado</span><strong>{i.valor_estimado ? pesosCorto(i.valor_estimado) : "Sin dato"}</strong><small>{i.valor_estimado ? `${pesosCorto(i.valor_bajo)} – ${pesosCorto(i.valor_alto)}` : "No hay canon registrado"}</small></div>
          <div className="kpi"><span>Tasa aplicada</span><strong>{porcentaje(i.tasa)}</strong><small>{i.tasa_manual ? "Tasa propia" : `Tasa ${String(i.tipo).toLowerCase()}`}</small></div>
        </section>
      )}

      <section className="tarjeta">
        <div className="tarjeta-cabeza">
          <h2>Datos del inmueble</h2>
          {permisos.editarInventario && <button className="boton boton-suave" onClick={() => setEditar(true)}><Icono n="editar" t={16} />Editar</button>}
        </div>
        <dl className="ficha ficha-columnas">
          <div><dt>Tipo</dt><dd>{i.tipo || <SinDato />}</dd></div>
          <div><dt>Ciudad</dt><dd>{i.ciudad || <SinDato />}</dd></div>
          <div><dt>Dirección</dt><dd>{i.direccion || <SinDato />}</dd></div>
          <div><dt>Barrio</dt><dd>{i.barrio || <SinDato />}</dd></div>
          <div><dt>Propietarios</dt><dd>{i.propietarios || <SinDato />}</dd></div>
          <div><dt>Matrícula</dt><dd>{i.matricula || <SinDato />}</dd></div>
          <div><dt>Ref. catastral</dt><dd>{i.ref_catastral || <SinDato />}</dd></div>
          <div><dt>Último predial</dt><dd>{i.anio_predial || <SinDato />}</dd></div>
          <div><dt>Área</dt><dd>{i.area_m2 ? `${i.area_m2} m²` : <SinDato />}</dd></div>
          <div><dt>Prioridad</dt><dd><Prioridad v={i.prioridad} /></dd></div>
        </dl>
      </section>

      {(i.estado || i.recomendacion || i.notas) && (
        <section className="tarjeta">
          {i.estado && <div className="bloque-texto"><h4>Estado encontrado</h4><p>{i.estado}</p></div>}
          {i.recomendacion && <div className="bloque-texto"><h4>Recomendación</h4><p>{i.recomendacion}</p></div>}
          {i.notas && <div className="bloque-texto"><h4>Notas</h4><p>{i.notas}</p></div>}
        </section>
      )}

      <section className="tarjeta">
        <div className="tarjeta-cabeza">
          <h2>Unidades y arriendos · {unidades.length}</h2>
          {permisos.editarInventario && <button className="boton boton-suave" onClick={() => setUnidad({ inmueble_id: inmuebleId })}><Icono n="mas" t={16} />Unidad</button>}
        </div>
        <div className="lista-unidades">
          {unidades.map((u) => <FilaUnidad key={u.id} u={u} onEditar={permisos.editarInventario ? () => setUnidad(u) : null} />)}
          {!unidades.length && <p className="tenue">No hay unidades registradas.</p>}
        </div>
      </section>

      {permisos.archivar && <button className="boton-texto peligro" onClick={archivarInmueble}><Icono n="archivar" t={16} />Archivar inmueble</button>}

      {editar && <FormInmueble inmueble={i} onCerrar={() => setEditar(false)} />}
      {unidad && <FormUnidad unidad={unidad} onCerrar={() => setUnidad(null)} />}
    </div>
  );
}

function FilaUnidad({ u, onEditar }) {
  const { permisos } = useEstado();
  const min = Number(u.mercado_min) || 0;
  const max = Number(u.mercado_max) || 0;
  const medio = min && max ? (min + max) / 2 : null;
  const canon = Number(u.canon_actual) || 0;
  const dif = medio !== null ? canon - medio : null;
  const contrato = u.contrato_escrito === "Sí" ? "verde" : u.contrato_escrito === "No" ? "rojo" : "ambar";
  return (
    <div className="unidad">
      <div className="unidad-principal">
        <strong>{u.unidad}</strong>
        <span className="tenue">{u.uso} · {u.arrendatario || "Sin arrendatario"}</span>
        <div className="unidad-chips">
          <Chip tipo={contrato}>{u.contrato_escrito === "Sí" ? "Con contrato" : u.contrato_escrito === "No" ? "Sin contrato escrito" : "Contrato por confirmar"}</Chip>
          {permisos.verValores && !canon && <Chip tipo="ambar">Sin canon</Chip>}
        </div>
      </div>
      {permisos.verValores && (
        <div className="unidad-cifras">
          <strong>{canon ? pesos(canon) : "—"}</strong>
          {medio !== null && (
            <small className={dif > 0 ? "positivo" : dif < 0 ? "negativo" : ""} title={`Mercado ${pesos(min)} – ${pesos(max)}`}>
              {dif === 0 ? "En el medio del mercado" : `${dif > 0 ? "+" : ""}${pesosCorto(dif)} vs. mercado`}
            </small>
          )}
        </div>
      )}
      {u.observacion && <p className="unidad-obs">{u.observacion}</p>}
      {onEditar && <button className="boton-icono unidad-editar" onClick={onEditar} aria-label="Editar unidad"><Icono n="editar" t={16} /></button>}
    </div>
  );
}

// Crear un inmueble crea también su proyecto; editar el nombre renombra el proyecto.
export function FormInmueble({ inmueble, onCerrar }) {
  const { guardar, avisar, permisos, ayudas } = useEstado();
  const navegar = useNavigate();
  const [v, setV] = useState(() => ({
    nombre: "", direccion: "", barrio: "", ciudad: "", tipo: "Residencial", propietarios: "", ref_catastral: "", matricula: "",
    anio_predial: "", area_m2: "", estado: "", recomendacion: "", prioridad: "Media", tasa_manual: "", notas: "", ...(inmueble || {}),
  }));
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });

  async function enviar(e) {
    e.preventDefault();
    setGuardando(true);
    try {
      const campos = ["nombre", "direccion", "barrio", "ciudad", "tipo", "propietarios", "ref_catastral", "matricula", "anio_predial", "area_m2", "estado", "recomendacion", "prioridad", "notas"];
      if (permisos.verValores) campos.push("tasa_manual");
      const data = Object.fromEntries(campos.map((k) => [k, v[k] ?? ""]));
      if (data.tasa_manual !== "" && Number(data.tasa_manual) >= 1) data.tasa_manual = Number(data.tasa_manual) / 100;
      const r = await guardar("INMUEBLES", inmueble?.id, data);
      if (!inmueble) {
        const p = await guardar("PROYECTOS", undefined, {
          nombre: r.nombre, descripcion: "", inmueble_ids: r.id, tipo: "Inmueble", estado: "Planeación",
          prioridad: r.prioridad || "Media", responsable_tipo: "pendiente",
        });
        avisar("Inmueble y proyecto creados");
        onCerrar();
        navegar(`/proyectos/${p.id}?vista=diagnostico`);
        return;
      }
      const p = ayudas.proyectoDeInmueble(inmueble.id);
      if (p && p.nombre === inmueble.nombre && r.nombre !== inmueble.nombre) await guardar("PROYECTOS", p.id, { nombre: r.nombre });
      avisar("Inmueble actualizado");
      onCerrar();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal titulo={inmueble ? "Editar inmueble" : "Nuevo inmueble"} onCerrar={onCerrar}
      pie={<><button className="boton boton-suave" onClick={onCerrar}>Cancelar</button><button className="boton" form="form-inm" disabled={guardando}>{guardando ? "Guardando…" : "Guardar"}</button></>}>
      <form id="form-inm" className="formulario" onSubmit={enviar}>
        {!inmueble && <p className="tenue campo-ancho">Se crea el inmueble y su proyecto, donde quedarán sus tareas, archivos y diagnóstico.</p>}
        <Campo etiqueta="Nombre *" ancho><input value={v.nombre} onChange={set("nombre")} required /></Campo>
        <Campo etiqueta="Tipo"><select value={v.tipo} onChange={set("tipo")}>{TIPOS.map((x) => <option key={x}>{x}</option>)}</select></Campo>
        <Campo etiqueta="Prioridad"><select value={v.prioridad} onChange={set("prioridad")}>{PRIORIDADES.map((x) => <option key={x}>{x}</option>)}</select></Campo>
        <Campo etiqueta="Dirección" ancho><input value={v.direccion} onChange={set("direccion")} /></Campo>
        <Campo etiqueta="Barrio"><input value={v.barrio} onChange={set("barrio")} /></Campo>
        <Campo etiqueta="Ciudad"><input value={v.ciudad} onChange={set("ciudad")} /></Campo>
        <Campo etiqueta="Propietarios" ancho><input value={v.propietarios} onChange={set("propietarios")} /></Campo>
        <Campo etiqueta="Matrícula inmobiliaria"><input value={v.matricula} onChange={set("matricula")} /></Campo>
        <Campo etiqueta="Referencia catastral"><input value={v.ref_catastral} onChange={set("ref_catastral")} /></Campo>
        <Campo etiqueta="Año último predial"><input inputMode="numeric" value={v.anio_predial} onChange={set("anio_predial")} /></Campo>
        <Campo etiqueta="Área (m²)"><input inputMode="decimal" value={v.area_m2} onChange={set("area_m2")} /></Campo>
        {permisos.verValores && (
          <Campo etiqueta="Tasa propia (%)" ayuda="Vacío = usa la tasa según el tipo.">
            <input inputMode="decimal" value={v.tasa_manual === "" ? "" : Number(v.tasa_manual) < 1 ? +(Number(v.tasa_manual) * 100).toFixed(2) : v.tasa_manual} onChange={set("tasa_manual")} placeholder="Ej. 6.5" />
          </Campo>
        )}
        <Campo etiqueta="Estado encontrado" ancho><textarea rows={2} value={v.estado} onChange={set("estado")} /></Campo>
        <Campo etiqueta="Recomendación" ancho><textarea rows={2} value={v.recomendacion} onChange={set("recomendacion")} /></Campo>
        <Campo etiqueta="Notas" ancho><textarea rows={2} value={v.notas} onChange={set("notas")} /></Campo>
        {error && <p className="error campo-ancho">{error}</p>}
      </form>
    </Modal>
  );
}

function FormUnidad({ unidad, onCerrar }) {
  const { guardar, archivar, avisar, permisos } = useEstado();
  const nueva = !unidad.id;
  const [v, setV] = useState(() => ({
    unidad: "", uso: "Residencial", arrendatario: "", contrato_escrito: "Por confirmar", fecha_inicio: "",
    canon_inicial: "", canon_actual: "", mercado_min: "", mercado_max: "", observacion: "", ...unidad,
  }));
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });

  async function enviar(e) {
    e.preventDefault();
    setGuardando(true);
    try {
      const campos = ["inmueble_id", "unidad", "uso", "arrendatario", "contrato_escrito", "fecha_inicio", "observacion"];
      if (permisos.verValores) campos.push("canon_inicial", "canon_actual", "mercado_min", "mercado_max");
      await guardar("UNIDADES", unidad.id, Object.fromEntries(campos.map((k) => [k, v[k] ?? ""])));
      avisar(nueva ? "Unidad creada" : "Unidad actualizada");
      onCerrar();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function quitar() {
    if (!confirm(`¿Archivar la unidad «${unidad.unidad}»?`)) return;
    try {
      await archivar("UNIDADES", unidad.id);
      avisar("Unidad archivada");
      onCerrar();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Modal titulo={nueva ? "Nueva unidad" : unidad.unidad} onCerrar={onCerrar}
      pie={<>
        {!nueva && permisos.archivar && <button className="boton-texto peligro" onClick={quitar}>Archivar</button>}
        <button className="boton boton-suave" onClick={onCerrar}>Cancelar</button>
        <button className="boton" form="form-uni" disabled={guardando}>{guardando ? "Guardando…" : "Guardar"}</button>
      </>}>
      <form id="form-uni" className="formulario" onSubmit={enviar}>
        <Campo etiqueta="Unidad *"><input value={v.unidad} onChange={set("unidad")} required placeholder="Ej. Apto 301" /></Campo>
        <Campo etiqueta="Uso"><select value={v.uso} onChange={set("uso")}>{[...new Set([...USOS, v.uso])].map((x) => <option key={x}>{x}</option>)}</select></Campo>
        <Campo etiqueta="Arrendatario"><input value={v.arrendatario} onChange={set("arrendatario")} /></Campo>
        <Campo etiqueta="Contrato escrito"><select value={v.contrato_escrito} onChange={set("contrato_escrito")}>{["Sí", "No", "Por confirmar"].map((x) => <option key={x}>{x}</option>)}</select></Campo>
        <Campo etiqueta="Fecha de inicio"><input type="date" value={v.fecha_inicio || ""} onChange={set("fecha_inicio")} /></Campo>
        {permisos.verValores && (
          <>
            <Campo etiqueta="Canon actual ($)"><input inputMode="numeric" value={v.canon_actual} onChange={set("canon_actual")} /></Campo>
            <Campo etiqueta="Canon inicial ($)"><input inputMode="numeric" value={v.canon_inicial} onChange={set("canon_inicial")} /></Campo>
            <Campo etiqueta="Mercado mínimo ($)"><input inputMode="numeric" value={v.mercado_min} onChange={set("mercado_min")} /></Campo>
            <Campo etiqueta="Mercado máximo ($)"><input inputMode="numeric" value={v.mercado_max} onChange={set("mercado_max")} /></Campo>
          </>
        )}
        <Campo etiqueta="Observación" ancho><textarea rows={3} value={v.observacion} onChange={set("observacion")} /></Campo>
        {error && <p className="error campo-ancho">{error}</p>}
      </form>
    </Modal>
  );
}

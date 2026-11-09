import { useEffect, useRef, useState } from "react";
import { useEstado } from "../estado";
import { llamar } from "../lib/api";
import { prepararArchivo, base64ABlobUrl } from "../lib/archivos";
import { fechaHora, hace, tamano } from "../lib/formato";
import { Icono, Avatar, Segmentos, Cargando, Modal } from "./ui";

// Comentarios, adjuntos e historial de cualquier inmueble, proyecto o tarea.
export default function Actividad({ entidad, id, inicial = "comentarios" }) {
  const { ayudas } = useEstado();
  const [pestana, setPestana] = useState(inicial);
  const nCom = ayudas.comentariosDe(entidad, id).length;
  const nAdj = ayudas.adjuntosDe(entidad, id).length;
  return (
    <section className="actividad">
      <Segmentos
        valor={pestana}
        onCambio={setPestana}
        opciones={[["comentarios", `Comentarios${nCom ? ` · ${nCom}` : ""}`], ["adjuntos", `Adjuntos${nAdj ? ` · ${nAdj}` : ""}`], ["historial", "Historial"]]}
      />
      {pestana === "comentarios" && <Comentarios entidad={entidad} id={id} />}
      {pestana === "adjuntos" && <Adjuntos entidad={entidad} id={id} />}
      {pestana === "historial" && <HistorialEntidad entidad={entidad} id={id} />}
    </section>
  );
}

function Comentarios({ entidad, id }) {
  const { ayudas, comentar, permisos, avisar } = useEstado();
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const lista = ayudas.comentariosDe(entidad, id);

  async function enviar(e) {
    e.preventDefault();
    if (!texto.trim()) return;
    setEnviando(true);
    try {
      await comentar(entidad, id, texto);
      setTexto("");
    } catch (err) {
      avisar(err.message, "error");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="lista-actividad">
      {lista.length === 0 && <p className="tenue">Aún no hay comentarios.</p>}
      {lista.map((c) => (
        <div key={c.id} className="comentario">
          <Avatar nombre={c.usuario_nombre} t={30} />
          <div>
            <div className="comentario-cabeza"><strong>{c.usuario_nombre}</strong><span title={fechaHora(c.creado_en)}>{hace(c.creado_en)}</span></div>
            <p>{c.texto}</p>
          </div>
        </div>
      ))}
      {permisos.gestionar && (
        <form className="nuevo-comentario" onSubmit={enviar}>
          <textarea rows={2} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escribe un comentario o una actualización…" />
          <button className="boton" disabled={enviando || !texto.trim()}>{enviando ? "Enviando…" : "Comentar"}</button>
        </form>
      )}
    </div>
  );
}

function Adjuntos({ entidad, id }) {
  const { ayudas, subirAdjunto, quitarAdjunto, permisos, sesion, avisar } = useEstado();
  const [subiendo, setSubiendo] = useState(false);
  const [viendo, setViendo] = useState(null);
  const input = useRef();
  const camara = useRef();
  const lista = ayudas.adjuntosDe(entidad, id);

  async function subir(files) {
    if (!files?.length) return;
    setSubiendo(true);
    try {
      for (const f of files) {
        if (f.size > 25 * 1024 * 1024) { avisar(`«${f.name}» pesa más de 25 MB`, "error"); continue; }
        await subirAdjunto(entidad, id, await prepararArchivo(f));
      }
      avisar(files.length > 1 ? "Archivos subidos" : "Archivo subido");
    } catch (err) {
      avisar(err.message, "error");
    } finally {
      setSubiendo(false);
      if (input.current) input.current.value = "";
      if (camara.current) camara.current.value = "";
    }
  }

  async function quitar(a) {
    if (!confirm(`¿Quitar «${a.nombre}»? El archivo queda guardado en el Drive del administrador.`)) return;
    try {
      await quitarAdjunto(a.id);
      avisar("Adjunto quitado");
    } catch (err) {
      avisar(err.message, "error");
    }
  }

  return (
    <div className="lista-actividad">
      {lista.length === 0 && <p className="tenue">No hay archivos. Puedes subir contratos, recibos o fotos.</p>}
      <div className="adjuntos">
        {lista.map((a) => (
          <div key={a.id} className="adjunto">
            <button className="adjunto-abrir" onClick={() => setViendo(a)}>
              <Icono n={/^image\//.test(a.mime) ? "ojo" : "archivo"} />
              <span>
                <strong>{a.nombre}</strong>
                <small>{tamano(a.tamano)} · {a.usuario_nombre} · {hace(a.creado_en)}</small>
              </span>
            </button>
            {(permisos.archivar || a.usuario_id === sesion.usuario.id) && (
              <button className="boton-icono" onClick={() => quitar(a)} aria-label="Quitar adjunto"><Icono n="archivar" t={18} /></button>
            )}
          </div>
        ))}
      </div>
      {permisos.gestionar && (
        <div className="acciones-adjuntos">
          <input ref={input} type="file" multiple hidden onChange={(e) => subir([...e.target.files])} />
          <input ref={camara} type="file" accept="image/*" capture="environment" hidden onChange={(e) => subir([...e.target.files])} />
          <button className="boton boton-suave" disabled={subiendo} onClick={() => input.current.click()}><Icono n="clip" t={18} />{subiendo ? "Subiendo…" : "Subir archivo"}</button>
          <button className="boton boton-suave solo-movil" disabled={subiendo} onClick={() => camara.current.click()}><Icono n="ojo" t={18} />Tomar foto</button>
        </div>
      )}
      {viendo && <VisorAdjunto adjunto={viendo} onCerrar={() => setViendo(null)} />}
    </div>
  );
}

function VisorAdjunto({ adjunto, onCerrar }) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let u;
    llamar("verAdjunto", { id: adjunto.id })
      .then((r) => { u = base64ABlobUrl(r.base64, r.mime); setUrl(u); })
      .catch((e) => setError(e.message));
    return () => u && URL.revokeObjectURL(u);
  }, [adjunto.id]);
  const imagen = /^image\//.test(adjunto.mime);
  const pdf = adjunto.mime === "application/pdf";
  return (
    <Modal titulo={adjunto.nombre} onCerrar={onCerrar} ancho={900}
      pie={url && <a className="boton" href={url} download={adjunto.nombre}>Descargar</a>}>
      {error && <p className="error">{error}</p>}
      {!url && !error && <Cargando texto="Abriendo archivo…" />}
      {url && imagen && <img className="visor-imagen" src={url} alt={adjunto.nombre} />}
      {url && pdf && <iframe className="visor-pdf" src={url} title={adjunto.nombre} />}
      {url && !imagen && !pdf && <p className="tenue">Vista previa no disponible. Usa «Descargar» para abrirlo.</p>}
    </Modal>
  );
}

function HistorialEntidad({ entidad, id }) {
  const [filas, setFilas] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    llamar("historial", { entidad, entidad_id: id, limite: 200 }).then(setFilas).catch((e) => setError(e.message));
  }, [entidad, id]);
  if (error) return <p className="error">{error}</p>;
  if (!filas) return <Cargando />;
  if (!filas.length) return <p className="tenue">Sin movimientos registrados.</p>;
  return <ListaHistorial filas={filas} />;
}

export function ListaHistorial({ filas }) {
  return (
    <ol className="linea-tiempo">
      {filas.map((h) => (
        <li key={h.id}>
          <span className={`punto punto-${h.accion}`} />
          <div>
            <p>
              <strong>{h.usuario_nombre}</strong> {String(h.detalle).charAt(0).toLowerCase() + String(h.detalle).slice(1)}
            </p>
            <Cambios json={h.cambios} />
            <small>{fechaHora(h.fecha)}</small>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Cambios({ json }) {
  const { ayudas } = useEstado();
  if (!json) return null;
  let c;
  try { c = JSON.parse(json); } catch { return null; }
  const filas = Object.entries(c);
  if (!filas.length) return null;
  const v = (k, x) => {
    if (x === "" || x === null || x === undefined) return "vacío";
    if (k === "responsable_usuario_id") return ayudas?.nombreUsuario(x) || x;
    return String(x);
  };
  const etiqueta = (k) => (k === "responsable_usuario_id" ? "responsable" : k.replace(/_/g, " "));
  return (
    <ul className="cambios">
      {filas.slice(0, 8).map(([k, [a, b]]) => (
        <li key={k}><span>{etiqueta(k)}:</span> <del>{v(k, a)}</del> → <ins>{v(k, b)}</ins></li>
      ))}
    </ul>
  );
}

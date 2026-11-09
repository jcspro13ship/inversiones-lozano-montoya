import { useEffect } from "react";
import { iniciales } from "../lib/formato";

const TRAZOS = {
  inicio: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  edificio: "M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 9h3a1 1 0 0 1 1 1v11M2 21h20M8 7h4M8 11h4M8 15h4",
  carpeta: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  tareas: "M9 11l2 2 4-4M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z",
  reloj: "M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
  usuarios: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  ajustes: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  mas: "M12 5v14M5 12h14",
  buscar: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3",
  salir: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  clip: "M21.4 11.1l-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5",
  mensaje: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
  alerta: "M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01",
  atras: "M15 18l-6-6 6-6",
  adelante: "M9 18l6-6-6-6",
  cerrar: "M18 6 6 18M6 6l12 12",
  editar: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
  calendario: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
  persona: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  archivo: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6",
  archivar: "M21 8v13H3V8M1 3h22v5H1zM10 12h4",
  check: "M20 6 9 17l-5-5",
  menu: "M3 12h18M3 6h18M3 18h18",
  telefono: "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z",
  candado: "M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zM7 11V7a5 5 0 0 1 10 0v4",
  recargar: "M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6",
  ojo: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
};

export function Icono({ n, t = 20, className = "" }) {
  return (
    <svg className={`icono ${className}`} width={t} height={t} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={TRAZOS[n]} />
    </svg>
  );
}

export function Modal({ titulo, onCerrar, children, pie, ancho }) {
  useEffect(() => {
    const tecla = (e) => e.key === "Escape" && onCerrar();
    document.addEventListener("keydown", tecla);
    document.body.classList.add("sin-scroll");
    return () => {
      document.removeEventListener("keydown", tecla);
      document.body.classList.remove("sin-scroll");
    };
  }, [onCerrar]);
  return (
    <div className="modal-fondo" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="modal" style={ancho ? { maxWidth: ancho } : undefined} role="dialog" aria-modal="true" aria-label={titulo}>
        <header className="modal-cabeza">
          <h2>{titulo}</h2>
          <button className="boton-icono" onClick={onCerrar} aria-label="Cerrar"><Icono n="cerrar" /></button>
        </header>
        <div className="modal-cuerpo">{children}</div>
        {pie && <footer className="modal-pie">{pie}</footer>}
      </div>
    </div>
  );
}

const CLASES_ESTADO = {
  Pendiente: "gris", "En curso": "azul", Bloqueada: "rojo", Bloqueado: "rojo", Hecha: "verde", Terminado: "verde",
  Planeación: "gris", "En pausa": "ambar", Alta: "rojo", Media: "ambar", Baja: "gris",
};

export function Chip({ v, tipo, children }) {
  return <span className={`chip chip-${tipo || CLASES_ESTADO[v] || "gris"}`}>{children || v}</span>;
}

export function Prioridad({ v }) {
  if (!v) return null;
  return <span className={`prioridad prioridad-${(v || "").toLowerCase()}`} title={`Prioridad ${v}`}><i />{v}</span>;
}

export function Avatar({ nombre, tercero, t = 28 }) {
  return (
    <span className={`avatar ${tercero ? "avatar-tercero" : ""}`} style={{ width: t, height: t, fontSize: t * 0.4 }} title={nombre}>
      {tercero ? <Icono n="persona" t={t * 0.55} /> : iniciales(nombre)}
    </span>
  );
}

export function Progreso({ pct, grande }) {
  return (
    <div className={`progreso ${grande ? "progreso-grande" : ""}`} role="progressbar" aria-valuenow={Math.round(pct * 100)} aria-valuemin="0" aria-valuemax="100">
      <div style={{ width: `${Math.round(pct * 100)}%` }} />
    </div>
  );
}

export function Vacio({ icono = "carpeta", titulo, children }) {
  return (
    <div className="vacio">
      <Icono n={icono} t={32} />
      <strong>{titulo}</strong>
      {children && <p>{children}</p>}
    </div>
  );
}

export function Campo({ etiqueta, ayuda, children, ancho }) {
  return (
    <label className={`campo ${ancho ? "campo-ancho" : ""}`}>
      <span className="campo-etiqueta">{etiqueta}</span>
      {children}
      {ayuda && <span className="campo-ayuda">{ayuda}</span>}
    </label>
  );
}

export function Cargando({ texto = "Cargando…" }) {
  return (
    <div className="cargando">
      <span className="spinner" />
      {texto}
    </div>
  );
}

export function Segmentos({ opciones, valor, onCambio }) {
  return (
    <div className="segmentos" role="tablist">
      {opciones.map((o) => {
        const [v, etiqueta] = Array.isArray(o) ? o : [o, o];
        return (
          <button key={v} type="button" role="tab" aria-selected={valor === v} className={valor === v ? "activo" : ""} onClick={() => onCambio(v)}>
            {etiqueta}
          </button>
        );
      })}
    </div>
  );
}

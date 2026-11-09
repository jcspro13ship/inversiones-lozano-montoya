import { useEffect, useState } from "react";
import { useEstado } from "../estado";
import { llamar } from "../lib/api";
import { fechaHora, hace, porcentaje, diasHasta } from "../lib/formato";
import { Icono, Avatar, Chip, Modal, Campo, Cargando, Segmentos, Vacio } from "../components/ui";
import { TareaFila, TareaDetalle } from "../components/Tareas";
import { FormTarea } from "../components/Formularios";
import { ListaHistorial } from "../components/Actividad";
import { FormCambiarClave } from "./Acceso";

// ---------------- Mis tareas ----------------
export function MisTareas() {
  const { sesion, ayudas, permisos } = useEstado();
  const [vista, setVista] = useState("abiertas");
  const [abierta, setAbierta] = useState(null);
  const [nueva, setNueva] = useState(false);
  const mias = ayudas.tareas.filter((t) => t.responsable_tipo === "usuario" && t.responsable_usuario_id === sesion.usuario.id);
  const creadas = ayudas.tareas.filter((t) => t.creado_por === sesion.usuario.id && t.estado !== "Hecha");
  const lista = vista === "abiertas" ? mias.filter((t) => t.estado !== "Hecha") : vista === "creadas" ? creadas : mias.filter((t) => t.estado === "Hecha");
  const ordenada = [...lista].sort((a, b) => (a.fecha_limite || "9999").localeCompare(b.fecha_limite || "9999"));

  const grupos = vista === "hechas" ? [["", ordenada]] : [
    ["Vencidas", ordenada.filter((t) => t.fecha_limite && diasHasta(t.fecha_limite) < 0)],
    ["Próximos 7 días", ordenada.filter((t) => t.fecha_limite && diasHasta(t.fecha_limite) >= 0 && diasHasta(t.fecha_limite) <= 7)],
    ["Más adelante", ordenada.filter((t) => t.fecha_limite && diasHasta(t.fecha_limite) > 7)],
    ["Sin fecha", ordenada.filter((t) => !t.fecha_limite)],
  ];

  return (
    <div className="pagina">
      <header className="pagina-cabeza">
        <div><p className="sobretitulo">{mias.filter((t) => t.estado !== "Hecha").length} abiertas</p><h1>Mis tareas</h1></div>
        {permisos.gestionar && <button className="boton" onClick={() => setNueva(true)}><Icono n="mas" t={18} />Tarea</button>}
      </header>
      <Segmentos valor={vista} onCambio={setVista} opciones={[["abiertas", "Asignadas a mí"], ["creadas", "Creadas por mí"], ["hechas", "Terminadas"]]} />
      <section className="tarjeta">
        {lista.length === 0 && <Vacio icono="check" titulo={vista === "abiertas" ? "Estás al día" : "Nada por aquí"} />}
        {grupos.filter(([, l]) => l.length).map(([titulo, l]) => (
          <div key={titulo} className="grupo-tareas">
            {titulo && <h4 className={titulo === "Vencidas" ? "rojo" : ""}>{titulo} <span>{l.length}</span></h4>}
            <div className="lista-tareas">{l.map((t) => <TareaFila key={t.id} t={t} onAbrir={(x) => setAbierta(x.id)} conProyecto />)}</div>
          </div>
        ))}
      </section>
      {abierta && <TareaDetalle tareaId={abierta} onCerrar={() => setAbierta(null)} />}
      {nueva && <FormTarea onCerrar={() => setNueva(false)} />}
    </div>
  );
}

// ---------------- Historial ----------------
const ENTIDADES = { "": "Todo", PROYECTOS: "Proyectos", TAREAS: "Tareas", INMUEBLES: "Inmuebles", UNIDADES: "Unidades", USUARIOS: "Usuarios y accesos", CONFIG: "Configuración" };

export function Historial() {
  const { datos } = useEstado();
  const [filas, setFilas] = useState(null);
  const [error, setError] = useState("");
  const [usuario, setUsuario] = useState("");
  const [entidad, setEntidad] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [verIngresos, setVerIngresos] = useState(false);

  useEffect(() => {
    setFilas(null);
    llamar("historial", { usuario_id: usuario || undefined, desde: desde || undefined, hasta: hasta || undefined, limite: 1000 })
      .then(setFilas)
      .catch((e) => setError(e.message));
  }, [usuario, desde, hasta]);

  const visibles = (filas || []).filter((h) => (!entidad || h.entidad === entidad) && (verIngresos || h.accion !== "ingreso"));

  function exportar() {
    const enc = ["fecha", "usuario", "rol", "accion", "entidad", "registro", "detalle", "cambios"];
    const csv = [enc, ...visibles.map((h) => [h.fecha, h.usuario_nombre, h.rol, h.accion, h.entidad, h.entidad_nombre, h.detalle, h.cambios])]
      .map((f) => f.map((x) => `"${String(x ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" }));
    a.download = `historial-inversiones-lozano-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  return (
    <div className="pagina">
      <header className="pagina-cabeza">
        <div><p className="sobretitulo">Registro de todo lo que se hace en la app</p><h1>Historial</h1></div>
        <button className="boton boton-suave" onClick={exportar} disabled={!visibles.length}><Icono n="archivo" t={16} />Exportar CSV</button>
      </header>
      <div className="filtros">
        <select value={usuario} onChange={(e) => setUsuario(e.target.value)} aria-label="Usuario">
          <option value="">Todos los usuarios</option>
          {datos.usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
        </select>
        <select value={entidad} onChange={(e) => setEntidad(e.target.value)} aria-label="Tipo">
          {Object.entries(ENTIDADES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <label className="filtro-fecha">Desde<input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></label>
        <label className="filtro-fecha">Hasta<input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></label>
        <label className="interruptor"><input type="checkbox" checked={verIngresos} onChange={(e) => setVerIngresos(e.target.checked)} />Ver ingresos</label>
      </div>
      <section className="tarjeta">
        {error && <p className="error">{error}</p>}
        {!filas && !error && <Cargando />}
        {filas && !visibles.length && <Vacio icono="reloj" titulo="Sin movimientos con estos filtros" />}
        {visibles.length > 0 && <ListaHistorial filas={visibles} />}
      </section>
    </div>
  );
}

// ---------------- Usuarios ----------------
const ROLES = {
  admin: ["Administrador", "Todo: usuarios, valores, inventario, historial y archivar."],
  familia: ["Familia", "Ve valores e inventario, crea y edita proyectos y tareas, ve el historial."],
  colaborador: ["Colaborador", "Crea y edita proyectos y tareas. No ve cánones ni valores."],
  lector: ["Solo lectura", "Consulta inmuebles, proyectos y tareas. No ve valores ni edita."],
};

export function Usuarios() {
  const { sesion, recargar, avisar } = useEstado();
  const [lista, setLista] = useState(null);
  const [error, setError] = useState("");
  const [editando, setEditando] = useState(null);
  const [clave, setClave] = useState(null);

  const cargar = () => llamar("usuarios").then(setLista).catch((e) => setError(e.message));
  useEffect(() => { cargar(); }, []);

  async function restablecer(u) {
    if (!confirm(`¿Generar una clave temporal para ${u.nombre}? Su clave actual dejará de funcionar.`)) return;
    try {
      const r = await llamar("restablecerClave", { id: u.id });
      setClave({ nombre: u.nombre, email: u.email, clave: r.clave_temporal });
      cargar();
    } catch (e) {
      avisar(e.message, "error");
    }
  }

  async function alternarActivo(u) {
    if (u.activo && !confirm(`¿Desactivar a ${u.nombre}? No podrá ingresar; su historial se conserva.`)) return;
    try {
      await llamar("editarUsuario", { id: u.id, data: { activo: !u.activo } });
      avisar(u.activo ? "Usuario desactivado" : "Usuario activado");
      cargar();
      recargar();
    } catch (e) {
      avisar(e.message, "error");
    }
  }

  return (
    <div className="pagina">
      <header className="pagina-cabeza">
        <div><p className="sobretitulo">Quién puede entrar y qué puede hacer</p><h1>Usuarios</h1></div>
        <button className="boton" onClick={() => setEditando({})}><Icono n="mas" t={18} />Nuevo usuario</button>
      </header>
      {error && <p className="error">{error}</p>}
      {!lista && !error && <Cargando />}
      {lista && (
        <section className="tarjeta lista-usuarios">
          {lista.map((u) => (
            <div key={u.id} className={`usuario-fila ${u.activo ? "" : "inactivo"}`}>
              <Avatar nombre={u.nombre} t={40} />
              <div className="usuario-info">
                <strong>{u.nombre}{u.id === sesion.usuario.id && <em> (tú)</em>}</strong>
                <span className="tenue">{u.email}{u.telefono && ` · ${u.telefono}`}</span>
                <span className="tenue">{u.ultimo_ingreso ? `Último ingreso ${hace(u.ultimo_ingreso)}` : "Nunca ha ingresado"}</span>
              </div>
              <div className="usuario-chips">
                <Chip tipo={u.rol === "admin" ? "azul" : u.rol === "familia" ? "verde" : "gris"}>{ROLES[u.rol]?.[0] || u.rol}</Chip>
                {!u.activo && <Chip tipo="rojo">Inactivo</Chip>}
                {u.activo && u.debe_cambiar_clave && <Chip tipo="ambar">Clave temporal</Chip>}
              </div>
              <div className="usuario-acciones">
                <button className="boton-icono" title="Editar" onClick={() => setEditando(u)}><Icono n="editar" t={18} /></button>
                <button className="boton-icono" title="Clave temporal" onClick={() => restablecer(u)}><Icono n="candado" t={18} /></button>
                {u.id !== sesion.usuario.id && <button className="boton-icono" title={u.activo ? "Desactivar" : "Activar"} onClick={() => alternarActivo(u)}><Icono n={u.activo ? "archivar" : "recargar"} t={18} /></button>}
              </div>
            </div>
          ))}
        </section>
      )}
      <section className="tarjeta">
        <h2>Roles</h2>
        <dl className="ficha">{Object.entries(ROLES).map(([k, [n, d]]) => <div key={k}><dt>{n}</dt><dd>{d}</dd></div>)}</dl>
      </section>
      {editando && <FormUsuario usuario={editando} onCerrar={() => setEditando(null)} onListo={(r) => { setEditando(null); cargar(); recargar(); if (r?.clave_temporal) setClave({ nombre: r.usuario.nombre, email: r.usuario.email, clave: r.clave_temporal }); }} />}
      {clave && <ClaveTemporal {...clave} onCerrar={() => setClave(null)} />}
    </div>
  );
}

function FormUsuario({ usuario, onCerrar, onListo }) {
  const { avisar } = useEstado();
  const nuevo = !usuario.id;
  const [v, setV] = useState({ nombre: "", email: "", telefono: "", rol: "colaborador", ...usuario });
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });

  async function enviar(e) {
    e.preventDefault();
    setGuardando(true);
    try {
      const r = nuevo
        ? await llamar("crearUsuario", { data: { nombre: v.nombre, email: v.email, telefono: v.telefono, rol: v.rol } })
        : await llamar("editarUsuario", { id: usuario.id, data: { nombre: v.nombre, telefono: v.telefono, rol: v.rol } });
      avisar(nuevo ? "Usuario creado" : "Usuario actualizado");
      onListo(r);
    } catch (err) {
      setError(err.message);
      setGuardando(false);
    }
  }

  return (
    <Modal titulo={nuevo ? "Nuevo usuario" : `Editar ${usuario.nombre}`} onCerrar={onCerrar}
      pie={<><button className="boton boton-suave" onClick={onCerrar}>Cancelar</button><button className="boton" form="form-usr" disabled={guardando}>{guardando ? "Guardando…" : nuevo ? "Crear y generar clave" : "Guardar"}</button></>}>
      <form id="form-usr" className="formulario" onSubmit={enviar}>
        <Campo etiqueta="Nombre completo *" ancho><input value={v.nombre} onChange={set("nombre")} required /></Campo>
        <Campo etiqueta="Correo *" ayuda={nuevo ? "Con este correo ingresa a la app." : "El correo no se puede cambiar."}>
          <input type="email" value={v.email} onChange={set("email")} required disabled={!nuevo} />
        </Campo>
        <Campo etiqueta="Teléfono"><input type="tel" value={v.telefono || ""} onChange={set("telefono")} /></Campo>
        <div className="campo campo-ancho">
          <span className="campo-etiqueta">Rol</span>
          <div className="opciones-rol">
            {Object.entries(ROLES).map(([k, [n, d]]) => (
              <label key={k} className={`opcion-rol ${v.rol === k ? "activo" : ""}`}>
                <input type="radio" name="rol" value={k} checked={v.rol === k} onChange={set("rol")} />
                <strong>{n}</strong><small>{d}</small>
              </label>
            ))}
          </div>
        </div>
        {error && <p className="error campo-ancho">{error}</p>}
      </form>
    </Modal>
  );
}

function ClaveTemporal({ nombre, email, clave, onCerrar }) {
  const url = window.location.href.split("#")[0];
  const mensaje = `Hola ${nombre.split(" ")[0]}, ya tienes acceso a la app de Inversiones Lozano Montoya.\n\nEntra en: ${url}\nCorreo: ${email}\nClave temporal: ${clave}\n\nAl entrar te pedirá crear tu propia clave.`;
  const [copiado, setCopiado] = useState(false);
  return (
    <Modal titulo="Clave temporal" onCerrar={onCerrar}
      pie={<>
        <a className="boton boton-suave" href={`https://wa.me/?text=${encodeURIComponent(mensaje)}`} target="_blank" rel="noreferrer">Enviar por WhatsApp</a>
        <button className="boton" onClick={() => navigator.clipboard?.writeText(mensaje).then(() => setCopiado(true))}>{copiado ? "Copiado" : "Copiar mensaje"}</button>
      </>}>
      <p>Comparte estos datos con <strong>{nombre}</strong>. La clave solo se muestra esta vez.</p>
      <div className="clave-temporal"><span>{email}</span><code>{clave}</code></div>
      <p className="tenue">Al ingresar, la app le pedirá crear su propia clave.</p>
    </Modal>
  );
}

// ---------------- Mi cuenta / configuración ----------------
export function Ajustes() {
  const { sesion, permisos, datos, avisar, recargar } = useEstado();
  const [tasas, setTasas] = useState(() => datos.config?.tasas && Object.fromEntries(Object.entries(datos.config.tasas).map(([k, v]) => [k, +(v * 100).toFixed(2)])));
  const [guardando, setGuardando] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);

  async function guardarTasas(e) {
    e.preventDefault();
    setGuardando(true);
    try {
      await llamar("guardarConfig", { data: Object.fromEntries(Object.entries(tasas).map(([k, v]) => [k, Number(v) / 100])) });
      await recargar();
      avisar("Tasas actualizadas");
    } catch (err) {
      avisar(err.message, "error");
    } finally {
      setGuardando(false);
    }
  }

  async function sincronizar() {
    setSincronizando(true);
    try {
      await llamar("sincronizar");
      avisar("Pestañas de la Hoja actualizadas");
    } catch (err) {
      avisar(err.message, "error");
    } finally {
      setSincronizando(false);
    }
  }

  return (
    <div className="pagina pagina-angosta">
      <header className="pagina-cabeza"><h1>Mi cuenta</h1></header>
      <section className="tarjeta perfil">
        <Avatar nombre={sesion.usuario.nombre} t={56} />
        <div>
          <strong>{sesion.usuario.nombre}</strong>
          <span className="tenue">{sesion.usuario.email}</span>
          <Chip tipo="azul">{permisos.nombre}</Chip>
        </div>
      </section>

      <section className="tarjeta">
        <h2>Cambiar clave</h2>
        <FormCambiarClave onListo={() => avisar("Clave actualizada")} />
      </section>

      <section className="tarjeta">
        <h2>Instalar la app</h2>
        <div className="instalar">
          <div><strong>iPhone o iPad</strong><p>Abre la app en Safari, toca <em>Compartir</em> y luego <em>Agregar a pantalla de inicio</em>.</p></div>
          <div><strong>Android</strong><p>Abre la app en Chrome, toca el menú <em>⋮</em> y luego <em>Instalar app</em> o <em>Agregar a pantalla principal</em>.</p></div>
          <div><strong>Computador</strong><p>En Chrome o Edge, haz clic en el ícono de instalar al final de la barra de direcciones.</p></div>
        </div>
      </section>

      {permisos.config && tasas && (
        <section className="tarjeta">
          <h2>Tasas de capitalización</h2>
          <p className="tenue">Valor = canon mensual × 12 ÷ tasa. El rango usa la tasa ± la sensibilidad.</p>
          <form className="formulario" onSubmit={guardarTasas}>
            {[["comercial", "Comercial y mixto"], ["residencial", "Residencial"], ["rural", "Rural"], ["sensibilidad", "Sensibilidad (±)"]].map(([k, et]) => (
              <Campo key={k} etiqueta={`${et} (%)`}>
                <input inputMode="decimal" value={tasas[k]} onChange={(e) => setTasas({ ...tasas, [k]: e.target.value })} required />
              </Campo>
            ))}
            <button className="boton campo-ancho" disabled={guardando}>{guardando ? "Guardando…" : "Guardar tasas"}</button>
          </form>
          <p className="tenue">Actuales: comercial {porcentaje(datos.config.tasas.comercial)}, residencial {porcentaje(datos.config.tasas.residencial)}, rural {porcentaje(datos.config.tasas.rural)}.</p>
        </section>
      )}

      {permisos.config && (
        <section className="tarjeta">
          <h2>Hoja de Google</h2>
          <p className="tenue">Las pestañas «1. Inventario Propiedades», «4. Seguimiento Obras» y «5. Unidades y Arriendos» se actualizan solas con cada cambio. Usa este botón si alguien editó la Hoja a mano.</p>
          <button className="boton boton-suave" onClick={sincronizar} disabled={sincronizando}><Icono n="recargar" t={16} />{sincronizando ? "Sincronizando…" : "Sincronizar ahora"}</button>
          <p className="tenue">Datos cargados {fechaHora(datos.generado_en)}.</p>
        </section>
      )}
    </div>
  );
}

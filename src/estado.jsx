import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { llamar, guardarToken, obtenerToken, alExpirarSesion } from "./lib/api";

const Ctx = createContext(null);

const CLAVE_TABLA = { INMUEBLES: "inmuebles", UNIDADES: "unidades", PROYECTOS: "proyectos", TAREAS: "tareas" };

export function EstadoProvider({ children }) {
  const [sesion, setSesion] = useState(null); // { usuario, rol, permisos, debe_cambiar_clave }
  const [datos, setDatos] = useState(null);
  const [iniciando, setIniciando] = useState(Boolean(obtenerToken()));
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);
  const avisoTimer = useRef();

  const avisar = useCallback((texto, tipo = "ok") => {
    clearTimeout(avisoTimer.current);
    setAviso({ texto, tipo });
    avisoTimer.current = setTimeout(() => setAviso(null), 3800);
  }, []);

  const salirLocal = useCallback(() => {
    guardarToken(null);
    setSesion(null);
    setDatos(null);
  }, []);

  useEffect(() => alExpirarSesion(salirLocal), [salirLocal]);

  const recargar = useCallback(async () => {
    try {
      const d = await llamar("datos");
      setDatos(d);
      setError(null);
      return d;
    } catch (e) {
      if (e.codigo !== "SESION") setError(e.message);
      throw e;
    }
  }, []);

  // Al abrir la app con un token guardado, se valida y se cargan los datos.
  useEffect(() => {
    if (!obtenerToken()) return;
    (async () => {
      try {
        const s = await llamar("sesion");
        setSesion(s);
        if (!s.debe_cambiar_clave) await recargar();
      } catch (e) {
        if (e.codigo !== "SESION") setError(e.message);
      } finally {
        setIniciando(false);
      }
    })();
  }, [recargar]);

  async function ingresar(email, clave) {
    const s = await llamar("login", { email, clave });
    guardarToken(s.token);
    setSesion(s);
    if (!s.debe_cambiar_clave) await recargar();
    return s;
  }

  async function cambiarClave(actual, nueva) {
    await llamar("cambiarClave", { actual, nueva });
    setSesion((s) => ({ ...s, debe_cambiar_clave: false }));
    await recargar();
  }

  async function salir() {
    try {
      await llamar("logout");
    } catch {
      /* igual se cierra localmente */
    }
    salirLocal();
  }

  // Guarda y aplica el resultado de inmediato; luego refresca en segundo plano
  // para traer cálculos (valores, sincronización) hechos por el servidor.
  async function guardar(tabla, id, data) {
    const r = await llamar("guardar", { tabla, id, data });
    const clave = CLAVE_TABLA[tabla];
    setDatos((d) => {
      if (!d) return d;
      const lista = d[clave];
      const existe = lista.some((x) => x.id === r.id);
      return { ...d, [clave]: existe ? lista.map((x) => (x.id === r.id ? { ...x, ...r } : x)) : [...lista, r] };
    });
    recargar().catch(() => {});
    return r;
  }

  async function archivar(tabla, id, restaurar = false) {
    await llamar("archivar", { tabla, id, restaurar });
    const clave = CLAVE_TABLA[tabla];
    setDatos((d) => d && { ...d, [clave]: d[clave].map((x) => (x.id === id ? { ...x, archivado: !restaurar } : x)) });
    recargar().catch(() => {});
  }

  async function comentar(entidad, entidad_id, texto) {
    const c = await llamar("comentar", { entidad, entidad_id, texto });
    setDatos((d) => d && { ...d, comentarios: [...d.comentarios, c] });
    return c;
  }

  async function subirAdjunto(entidad, entidad_id, archivo) {
    const a = await llamar("subirAdjunto", { entidad, entidad_id, ...archivo });
    setDatos((d) => d && { ...d, adjuntos: [...d.adjuntos, a] });
    return a;
  }

  async function quitarAdjunto(id) {
    await llamar("archivarAdjunto", { id });
    setDatos((d) => d && { ...d, adjuntos: d.adjuntos.map((a) => (a.id === id ? { ...a, archivado: true } : a)) });
  }

  const ayudas = useMemo(() => crearAyudas(datos), [datos]);

  const valor = {
    sesion, datos, iniciando, error, aviso, avisar, ayudas,
    permisos: sesion?.permisos || {},
    ingresar, cambiarClave, salir, recargar, guardar, archivar, comentar, subirAdjunto, quitarAdjunto,
  };
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useEstado() {
  return useContext(Ctx);
}

const activo = (x) => !(x.archivado === true || x.archivado === "TRUE" || x.archivado === "true");

function crearAyudas(datos) {
  if (!datos) return null;
  const usuarios = new Map(datos.usuarios.map((u) => [u.id, u]));
  const inmuebles = new Map(datos.inmuebles.map((i) => [i.id, i]));
  const proyectos = new Map(datos.proyectos.map((p) => [p.id, p]));
  const tareas = datos.tareas.filter(activo);
  const proyectosActivos = datos.proyectos.filter(activo);

  const tareasDe = (proyectoId) => tareas.filter((t) => t.proyecto_id === proyectoId);
  const progreso = (proyectoId) => {
    const ts = tareasDe(proyectoId);
    const hechas = ts.filter((t) => t.estado === "Hecha").length;
    return { total: ts.length, hechas, pct: ts.length ? hechas / ts.length : 0 };
  };
  const idsInmuebles = (p) => String(p.inmueble_ids || "").split(",").map((s) => s.trim()).filter(Boolean);

  return {
    activo,
    usuario: (id) => usuarios.get(id),
    nombreUsuario: (id) => (id === "sistema" ? "Carga inicial" : usuarios.get(id)?.nombre || "—"),
    inmueble: (id) => inmuebles.get(id),
    proyecto: (id) => proyectos.get(id),
    usuariosActivos: datos.usuarios.filter((u) => u.activo),
    inmueblesActivos: datos.inmuebles.filter(activo),
    proyectosActivos,
    tareas,
    tareasDe,
    progreso,
    idsInmuebles,
    proyectosDeInmueble: (inmId) => proyectosActivos.filter((p) => idsInmuebles(p).includes(inmId)),
    // Cada inmueble tiene su proyecto principal (tipo "Inmueble"); los demás son proyectos futuros u otros.
    esDeInmueble: (p) => p.tipo === "Inmueble" && idsInmuebles(p).length === 1,
    proyectoDeInmueble: (inmId) => datos.proyectos.find((p) => p.tipo === "Inmueble" && idsInmuebles(p)[0] === inmId && activo(p)),
    unidadesDe: (inmId) => datos.unidades.filter((u) => u.inmueble_id === inmId && activo(u)),
    comentariosDe: (entidad, id) => datos.comentarios.filter((c) => c.entidad === entidad && c.entidad_id === id),
    adjuntosDe: (entidad, id) => datos.adjuntos.filter((a) => a.entidad === entidad && a.entidad_id === id && activo(a)),
    responsable: (r) => {
      if (r.responsable_tipo === "usuario") {
        const u = usuarios.get(r.responsable_usuario_id);
        return { nombre: u?.nombre || "Usuario eliminado", tipo: "usuario", contacto: "" };
      }
      if (r.responsable_tipo === "tercero") return { nombre: r.responsable_externo, tipo: "tercero", contacto: r.responsable_contacto };
      return { nombre: "Sin asignar", tipo: "pendiente", contacto: "" };
    },
  };
}

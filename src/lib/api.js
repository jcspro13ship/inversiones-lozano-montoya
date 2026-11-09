// Cliente del Web App de Apps Script. Todas las llamadas son POST con el token
// de sesión; Content-Type text/plain evita el preflight de CORS que Apps Script
// no soporta.
const API_URL = import.meta.env.VITE_API_URL || "";
const CLAVE_TOKEN = "ilm_token";

const SIN_CONEXION = "No se pudo conectar con el servidor. Revisa tu conexión e intenta de nuevo.";
const NO_CONFIRMADO = "No se pudo confirmar si se guardó. Revisa antes de volver a intentarlo.";

// Acciones que no cambian nada: se pueden reintentar sin riesgo.
const LECTURAS = new Set(["sesion", "datos", "historial", "usuarios", "verAdjunto"]);

export class ErrorApi extends Error {
  constructor(mensaje, codigo) {
    super(mensaje);
    this.codigo = codigo;
  }
}

let alExpirar = () => {};
export function alExpirarSesion(fn) {
  alExpirar = fn;
}

export function obtenerToken() {
  try {
    return localStorage.getItem(CLAVE_TOKEN);
  } catch {
    return null;
  }
}
export function guardarToken(t) {
  try {
    if (t) localStorage.setItem(CLAVE_TOKEN, t);
    else localStorage.removeItem(CLAVE_TOKEN);
  } catch {
    /* modo privado: la sesión dura lo que la pestaña */
  }
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const nuevoId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

async function una(cuerpo) {
  let res;
  try {
    res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(cuerpo),
      redirect: "follow",
    });
  } catch {
    throw new ErrorApi(SIN_CONEXION, "RED");
  }
  const texto = await res.text();
  let body;
  try {
    body = JSON.parse(texto);
  } catch {
    throw new ErrorApi(SIN_CONEXION, "RED");
  }
  if (!body.ok) throw new ErrorApi(body.error || "Error del servidor", body.codigo);
  return body.data;
}

export async function llamar(action, params = {}) {
  if (!API_URL) throw new ErrorApi("Falta configurar VITE_API_URL (la URL del Web App de Apps Script).");
  const lectura = LECTURAS.has(action);
  const cuerpo = { action, token: obtenerToken(), ...params };
  // Las escrituras llevan request_id: si la respuesta se pierde, el reintento no duplica.
  if (!lectura && action !== "login" && action !== "cambiarClave") cuerpo.request_id = nuevoId();
  const intentos = action === "login" || action === "cambiarClave" ? 1 : 3;

  for (let i = 0; i < intentos; i++) {
    if (i > 0) await esperar(i * 1500);
    try {
      return await una(cuerpo);
    } catch (e) {
      if (e.codigo === "SESION") {
        guardarToken(null);
        alExpirar();
        throw e;
      }
      if (e.codigo !== "RED" || i === intentos - 1) {
        if (e.codigo === "RED" && !lectura && cuerpo.request_id) throw new ErrorApi(NO_CONFIRMADO, "RED");
        throw e;
      }
    }
  }
}

import { useState } from "react";
import { useEstado } from "../estado";
import { Campo, Icono } from "../components/ui";

function Marco({ children }) {
  return (
    <div className="acceso">
      <div className="acceso-tarjeta">
        <div className="acceso-marca">
          <span className="marca-simbolo grande" aria-hidden="true">ILM</span>
          <h1>Inversiones Lozano Montoya</h1>
          <p>Gestión de propiedades y proyectos</p>
        </div>
        {children}
      </div>
      <p className="credito">Desarrollado por JCS Consultoría Empresarial</p>
    </div>
  );
}

export function Login() {
  const { ingresar } = useEstado();
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [ver, setVer] = useState(false);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setCargando(true);
    setError("");
    try {
      await ingresar(email.trim(), clave);
    } catch (err) {
      setError(err.message);
      setCargando(false);
    }
  }

  return (
    <Marco>
      <form className="formulario una-columna" onSubmit={enviar}>
        <Campo etiqueta="Correo">
          <input type="email" autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </Campo>
        <Campo etiqueta="Clave">
          <div className="con-boton">
            <input type={ver ? "text" : "password"} autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)} required />
            <button type="button" className="boton-icono" onClick={() => setVer((v) => !v)} aria-label={ver ? "Ocultar clave" : "Ver clave"}><Icono n="ojo" t={18} /></button>
          </div>
        </Campo>
        {error && <p className="error">{error}</p>}
        <button className="boton boton-ancho" disabled={cargando}>{cargando ? "Ingresando…" : "Ingresar"}</button>
        <p className="tenue centrado">¿Olvidaste tu clave? Pídele al administrador una clave temporal.</p>
      </form>
    </Marco>
  );
}

export function FormCambiarClave({ obligatorio, onListo }) {
  const { cambiarClave, salir } = useEstado();
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetir, setRepetir] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    if (nueva !== repetir) return setError("Las claves nuevas no coinciden.");
    if (nueva.length < 8 || !/\d/.test(nueva) || !/[a-zA-Z]/.test(nueva)) return setError("Usa al menos 8 caracteres con letras y números.");
    setCargando(true);
    setError("");
    try {
      await cambiarClave(actual, nueva);
      onListo?.();
      setActual(""); setNueva(""); setRepetir("");
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  return (
    <form className="formulario una-columna" onSubmit={enviar}>
      <Campo etiqueta={obligatorio ? "Clave temporal" : "Clave actual"}>
        <input type="password" autoComplete="current-password" value={actual} onChange={(e) => setActual(e.target.value)} required />
      </Campo>
      <Campo etiqueta="Clave nueva" ayuda="Mínimo 8 caracteres, con letras y números.">
        <input type="password" autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} required />
      </Campo>
      <Campo etiqueta="Repite la clave nueva">
        <input type="password" autoComplete="new-password" value={repetir} onChange={(e) => setRepetir(e.target.value)} required />
      </Campo>
      {error && <p className="error">{error}</p>}
      <button className="boton boton-ancho" disabled={cargando}>{cargando ? "Guardando…" : "Guardar clave"}</button>
      {obligatorio && <button type="button" className="boton-texto centrado" onClick={salir}>Salir</button>}
    </form>
  );
}

export function CambioObligatorio() {
  const { sesion } = useEstado();
  return (
    <Marco>
      <div className="acceso-mensaje">
        <Icono n="candado" t={22} />
        <p>Hola, <strong>{sesion.usuario.nombre}</strong>. Para proteger tu cuenta, crea tu propia clave antes de continuar.</p>
      </div>
      <FormCambiarClave obligatorio />
    </Marco>
  );
}

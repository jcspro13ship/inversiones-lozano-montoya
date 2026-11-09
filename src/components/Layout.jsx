import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useEstado } from "../estado";
import { Icono, Avatar } from "./ui";

export default function Layout() {
  const { sesion, permisos, aviso, salir, datos, ayudas } = useEstado();
  const [menuMas, setMenuMas] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setMenuMas(false), [pathname]);

  const misAbiertas = ayudas
    ? ayudas.tareas.filter((t) => t.estado !== "Hecha" && t.responsable_tipo === "usuario" && t.responsable_usuario_id === sesion.usuario.id).length
    : 0;

  const principales = [
    { a: "/", n: "inicio", t: "Inicio", fin: true },
    { a: "/inmuebles", n: "edificio", t: "Inmuebles" },
    { a: "/proyectos", n: "carpeta", t: "Proyectos" },
    { a: "/mis-tareas", n: "tareas", t: "Mis tareas", cuenta: misAbiertas },
  ];
  const secundarias = [
    permisos.historial && { a: "/historial", n: "reloj", t: "Historial" },
    permisos.usuarios && { a: "/usuarios", n: "usuarios", t: "Usuarios" },
    { a: "/ajustes", n: "ajustes", t: "Mi cuenta" },
  ].filter(Boolean);

  const enlace = (i) => (
    <NavLink key={i.a} to={i.a} end={i.fin} className={({ isActive }) => `nav-item ${isActive ? "activo" : ""}`}>
      <Icono n={i.n} />
      <span>{i.t}</span>
      {i.cuenta > 0 && <em className="nav-cuenta">{i.cuenta}</em>}
    </NavLink>
  );

  return (
    <div className="marco">
      <aside className="lateral">
        <div className="marca">
          <span className="marca-simbolo" aria-hidden="true">ILM</span>
          <div>
            <strong>Inversiones Lozano Montoya</strong>
            <small>Gestión de propiedades</small>
          </div>
        </div>
        <nav className="nav-lateral">
          {principales.map(enlace)}
          <div className="nav-separador" />
          {secundarias.map(enlace)}
        </nav>
        <div className="lateral-pie">
          <Avatar nombre={sesion.usuario.nombre} t={34} />
          <div className="lateral-usuario">
            <strong>{sesion.usuario.nombre}</strong>
            <small>{sesion.permisos.nombre}</small>
          </div>
          <button className="boton-icono" onClick={salir} title="Cerrar sesión" aria-label="Cerrar sesión"><Icono n="salir" /></button>
        </div>
      </aside>

      <main className="contenido">
        {!datos ? null : <Outlet />}
        <footer className="credito">Desarrollado por JCS Consultoría Empresarial</footer>
      </main>

      <nav className="nav-inferior">
        {principales.map(enlace)}
        <button className={`nav-item ${menuMas ? "activo" : ""}`} onClick={() => setMenuMas((v) => !v)}>
          <Icono n="menu" />
          <span>Más</span>
        </button>
      </nav>
      {menuMas && (
        <div className="hoja-mas-fondo" onClick={() => setMenuMas(false)}>
          <div className="hoja-mas" onClick={(e) => e.stopPropagation()}>
            <div className="hoja-mas-usuario">
              <Avatar nombre={sesion.usuario.nombre} t={40} />
              <div>
                <strong>{sesion.usuario.nombre}</strong>
                <small>{sesion.permisos.nombre}</small>
              </div>
            </div>
            {secundarias.map(enlace)}
            <button className="nav-item" onClick={salir}><Icono n="salir" /><span>Cerrar sesión</span></button>
          </div>
        </div>
      )}

      {aviso && <div className={`aviso aviso-${aviso.tipo}`} role="status">{aviso.texto}</div>}
    </div>
  );
}

import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { EstadoProvider, useEstado } from "./estado";
import Layout from "./components/Layout";
import { Cargando } from "./components/ui";
import { Login, CambioObligatorio } from "./pages/Acceso";
import Tablero from "./pages/Tablero";
import { RedirigirInmueble } from "./pages/Inmuebles";
import Proyectos, { ProyectoDetalle } from "./pages/Proyectos";
import { MisTareas, Historial, Usuarios, Ajustes } from "./pages/Gestion";
import "./estilos.css";

function App() {
  const { sesion, datos, iniciando, error, permisos, recargar } = useEstado();
  if (iniciando) return <div className="pantalla-completa"><Cargando texto="Abriendo…" /></div>;
  if (!sesion) return <Login />;
  if (sesion.debe_cambiar_clave) return <CambioObligatorio />;
  if (!datos) {
    return (
      <div className="pantalla-completa">
        {error ? (
          <div className="centrado"><p className="error">{error}</p><button className="boton" onClick={() => recargar().catch(() => {})}>Reintentar</button></div>
        ) : <Cargando texto="Cargando información…" />}
      </div>
    );
  }
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Tablero />} />
        <Route path="inmuebles" element={<Navigate to="/proyectos" replace />} />
        <Route path="inmuebles/:id" element={<RedirigirInmueble />} />
        <Route path="proyectos" element={<Proyectos />} />
        <Route path="proyectos/:id" element={<ProyectoDetalle />} />
        <Route path="mis-tareas" element={<MisTareas />} />
        {permisos.historial && <Route path="historial" element={<Historial />} />}
        {permisos.usuarios && <Route path="usuarios" element={<Usuarios />} />}
        <Route path="ajustes" element={<Ajustes />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HashRouter>
      <EstadoProvider>
        <App />
      </EstadoProvider>
    </HashRouter>
  </React.StrictMode>
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}

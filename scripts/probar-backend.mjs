// Pruebas del backend (Code.gs) sobre el Sheet simulado. Uso: node scripts/probar-backend.mjs
import { llamar, inst, hojas } from "./servidor-local.mjs";

let fallas = 0;
const ok = (cond, msg) => { console.log(`${cond ? "✓" : "✗"} ${msg}`); if (!cond) fallas++; };
const igual = (a, b, msg) => ok(a === b, `${msg} (${a}${a === b ? "" : " ≠ " + b})`);

// Ingreso y cambio de clave obligatorio
ok(!llamar({ action: "login", email: inst.email, clave: "mala" }).ok, "Rechaza clave incorrecta");
let r = llamar({ action: "login", email: inst.email.toUpperCase(), clave: inst.clave });
ok(r.ok && r.data.debe_cambiar_clave, "Ingresa con clave temporal y pide cambiarla");
const tokenAdmin = r.data.token;
igual(llamar({ action: "datos", token: tokenAdmin }).codigo, "CAMBIAR_CLAVE", "Bloquea datos hasta cambiar la clave");
ok(!llamar({ action: "cambiarClave", token: tokenAdmin, actual: inst.clave, nueva: "corta" }).ok, "Rechaza clave débil");
ok(llamar({ action: "cambiarClave", token: tokenAdmin, actual: inst.clave, nueva: "Lozano2026" }).ok, "Cambia la clave");

// Validación del análisis
const d = llamar({ action: "datos", token: tokenAdmin }).data;
igual(d.consolidado.canon_mensual, 43700000, "Canon mensual total");
igual(d.consolidado.valor_estimado, 8859220779, "Valor estimado total");
igual(d.consolidado.valor_bajo, 7456153846, "Valor bajo total");
igual(d.consolidado.valor_alto, 11120000000, "Valor alto total");
igual(d.consolidado.total_unidades, 28, "Total de unidades");
igual(d.inmuebles.find((i) => i.id === "inm-5").valor_estimado, null, "Inmueble sin canon queda sin valor");
igual(d.tareas.length, 48, "Tareas iniciales");
igual(d.proyectos.filter((p) => p.tipo === "Inmueble").length, 7, "Un proyecto por inmueble");
igual(d.config.alertas.length, 6, "Alertas de verificación cargadas en CONFIG");

// Usuarios y roles
r = llamar({ action: "crearUsuario", token: tokenAdmin, data: { nombre: "Pedro Colaborador", email: "pedro@x.co", rol: "colaborador" } });
ok(r.ok && r.data.clave_temporal, "Crea colaborador con clave temporal");
const idPedro = r.data.usuario.id;
let t = llamar({ action: "login", email: "pedro@x.co", clave: r.data.clave_temporal }).data.token;
llamar({ action: "cambiarClave", token: t, actual: r.data.clave_temporal, nueva: "Pedro12345" });
const dc = llamar({ action: "datos", token: t }).data;
ok(dc.consolidado === null && dc.inmuebles[0].valor_estimado === undefined && !dc.config.alertas, "Colaborador no ve valoraciones ni alertas");
ok(dc.unidades[0].canon_actual === undefined, "Colaborador no ve cánones");
ok(dc.tareas.find((x) => x.id === "tar-4").descripcion.includes("$•••"), "Cifras en textos enmascaradas para colaborador");
ok(!llamar({ action: "guardar", token: t, tabla: "UNIDADES", id: "uni-1", data: { arrendatario: "X" } }).ok, "Colaborador no edita inventario");
ok(!llamar({ action: "historial", token: t }).ok, "Colaborador no ve historial completo");

// Tareas con responsable
ok(!llamar({ action: "guardar", token: t, tabla: "TAREAS", data: { proyecto_id: "pry-1", titulo: "Sin responsable", estado: "Pendiente", prioridad: "Media" } }).ok, "Exige responsable");
r = llamar({ action: "guardar", token: t, tabla: "TAREAS", data: { proyecto_id: "pry-1", titulo: "Cotizar electricista", estado: "Pendiente", prioridad: "Alta", responsable_tipo: "tercero", responsable_externo: "Electricista Ramírez", responsable_contacto: "3001234567" } });
ok(r.ok, "Crea tarea con tercero");
const idTarea = r.data.id;
r = llamar({ action: "guardar", token: t, tabla: "TAREAS", id: idTarea, data: { estado: "Hecha", responsable_tipo: "usuario", responsable_usuario_id: idPedro } });
ok(r.ok && r.data.completada_en && r.data.responsable_externo === "", "Reasigna a usuario y marca hecha");
ok(llamar({ action: "comentar", token: t, entidad: "TAREAS", entidad_id: idTarea, texto: "Listo, adjunto factura" }).ok, "Comenta");
r = llamar({ action: "subirAdjunto", token: t, entidad: "TAREAS", entidad_id: idTarea, nombre: "factura.txt", mime: "text/plain", base64: Buffer.from("hola").toString("base64") });
ok(r.ok && !r.data.drive_id, "Sube adjunto sin exponer el id de Drive");
igual(Buffer.from(llamar({ action: "verAdjunto", token: t, id: r.data.id }).data.base64, "base64").toString(), "hola", "Descarga adjunto");

// Historial
const h = llamar({ action: "historial", token: tokenAdmin }).data;
const deTarea = h.filter((x) => x.entidad_id === idTarea);
igual(deTarea.length, 4, "Historial de la tarea (crear, editar, comentar, adjuntar)");
ok(deTarea.every((x) => x.usuario_nombre === "Pedro Colaborador"), "El historial registra quién lo hizo");
ok(JSON.parse(deTarea.find((x) => x.accion === "editar").cambios).estado[1] === "Hecha", "El historial guarda antes y después");
ok(llamar({ action: "historial", token: t, entidad: "TAREAS", entidad_id: idTarea }).ok, "Colaborador ve historial de una tarea");

// Inventario y sincronización con la Hoja
ok(llamar({ action: "guardar", token: tokenAdmin, tabla: "UNIDADES", id: "uni-3", data: { canon_actual: 1200000, arrendatario: "Nuevo" } }).ok, "Admin edita unidad");
igual(llamar({ action: "datos", token: tokenAdmin }).data.consolidado.canon_mensual, 44900000, "Recalcula canon total");
const h1 = hojas.get("1. Inventario Propiedades").datos;
igual(h1[1][11], 7650000, "Pestaña 1 sincronizada (canon del inmueble 1)");
igual(hojas.get("4. Seguimiento Obras").datos.filter((f) => f[0]).length, 7, "Pestaña 4 con un renglón por proyecto");

// Desactivar usuario cierra su sesión
llamar({ action: "editarUsuario", token: tokenAdmin, id: idPedro, data: { activo: false } });
igual(llamar({ action: "datos", token: t }).codigo, "SESION", "Usuario desactivado pierde la sesión");
ok(!llamar({ action: "editarUsuario", token: tokenAdmin, id: llamar({ action: "sesion", token: tokenAdmin }).data.usuario.id, data: { activo: false } }).ok, "Admin no puede desactivarse a sí mismo");

// Bloqueo por intentos
for (let i = 0; i < 5; i++) llamar({ action: "login", email: "pedro@x.co", clave: "x" });
ok(/Demasiados/.test(llamar({ action: "login", email: "pedro@x.co", clave: "x" }).error), "Bloquea tras 5 intentos fallidos");

// Idempotencia
const rid = "req-prueba-1";
llamar({ action: "comentar", token: tokenAdmin, request_id: rid, entidad: "PROYECTOS", entidad_id: "pry-1", texto: "Una vez" });
llamar({ action: "comentar", token: tokenAdmin, request_id: rid, entidad: "PROYECTOS", entidad_id: "pry-1", texto: "Una vez" });
igual(llamar({ action: "datos", token: tokenAdmin }).data.comentarios.filter((c) => c.texto === "Una vez").length, 1, "Un reintento no duplica");

console.log(fallas ? `\n${fallas} prueba(s) fallaron` : "\nTodas las pruebas pasaron");
process.exit(fallas ? 1 : 0);

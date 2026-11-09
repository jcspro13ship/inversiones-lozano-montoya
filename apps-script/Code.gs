// =====================================================================
//  App Inversiones Lozano Montoya · Backend (Google Apps Script)
// ---------------------------------------------------------------------
//  Se pega en Extensiones > Apps Script del Google Sheet
//  "Inventario_Propiedades Familia Lozano" y se publica como Web App
//  (Ejecutar como: yo · Quién tiene acceso: cualquier usuario).
//
//  El Sheet es la base de datos. Solo el dueño (y máximo una persona más)
//  tiene acceso al archivo. Todos los demás entran por la app con su
//  correo y clave; el script valida la sesión, el rol y deja registro
//  de TODO en la pestaña HISTORIAL.
//
//  Todas las llamadas son POST con cuerpo JSON (Content-Type text/plain
//  para evitar el preflight de CORS):
//    { action, token, request_id?, ...parámetros }
//  Respuesta: { ok: true, data } | { ok: false, error, codigo? }
//  Ver docs/GUIA_INSTALACION.md para la puesta en marcha.
// =====================================================================

var VERSION = '1.0.0'

// ---- Modelo de datos (pestañas de la app) ---------------------------
var HOJAS = {
  CONFIG: ['clave', 'valor'],
  USUARIOS: ['id', 'nombre', 'email', 'telefono', 'rol', 'activo', 'hash', 'salt', 'debe_cambiar_clave', 'creado_en', 'creado_por', 'ultimo_ingreso'],
  INMUEBLES: ['id', 'nombre', 'direccion', 'barrio', 'ciudad', 'tipo', 'propietarios', 'ref_catastral', 'matricula', 'anio_predial', 'area_m2', 'estado', 'recomendacion', 'prioridad', 'tasa_manual', 'notas', 'archivado', 'creado_en', 'creado_por', 'actualizado_en', 'actualizado_por'],
  UNIDADES: ['id', 'inmueble_id', 'unidad', 'uso', 'arrendatario', 'contrato_escrito', 'fecha_inicio', 'canon_inicial', 'canon_actual', 'mercado_min', 'mercado_max', 'observacion', 'archivado', 'creado_en', 'creado_por', 'actualizado_en', 'actualizado_por'],
  PROYECTOS: ['id', 'nombre', 'descripcion', 'inmueble_ids', 'tipo', 'estado', 'prioridad', 'fecha_inicio', 'fecha_fin', 'presupuesto', 'invertido', 'responsable_tipo', 'responsable_usuario_id', 'responsable_externo', 'responsable_contacto', 'archivado', 'creado_en', 'creado_por', 'actualizado_en', 'actualizado_por'],
  TAREAS: ['id', 'proyecto_id', 'titulo', 'descripcion', 'estado', 'prioridad', 'fecha_limite', 'responsable_tipo', 'responsable_usuario_id', 'responsable_externo', 'responsable_contacto', 'unidad_id', 'completada_en', 'archivado', 'creado_en', 'creado_por', 'actualizado_en', 'actualizado_por'],
  COMENTARIOS: ['id', 'entidad', 'entidad_id', 'texto', 'usuario_id', 'usuario_nombre', 'creado_en'],
  ADJUNTOS: ['id', 'entidad', 'entidad_id', 'nombre', 'mime', 'tamano', 'drive_id', 'usuario_id', 'usuario_nombre', 'creado_en', 'archivado'],
  HISTORIAL: ['id', 'fecha', 'usuario_id', 'usuario_nombre', 'rol', 'accion', 'entidad', 'entidad_id', 'entidad_nombre', 'detalle', 'cambios']
}

// Columnas que se guardan como texto para que Sheets no las convierta en fechas o números.
var COLUMNAS_TEXTO = /^(id|.*_id|inmueble_ids|fecha.*|.*_en|telefono|responsable_contacto|anio_predial|matricula|ref_catastral|hash|salt|cambios|detalle)$/

// Campos de dinero: solo los ven los roles con verValores.
var CAMPOS_VALOR = {
  UNIDADES: ['canon_inicial', 'canon_actual', 'mercado_min', 'mercado_max'],
  PROYECTOS: ['presupuesto', 'invertido'],
  INMUEBLES: ['tasa_manual']
}
var CAMPOS_NUMERICOS = ['canon_inicial', 'canon_actual', 'mercado_min', 'mercado_max', 'presupuesto', 'invertido', 'tasa_manual', 'area_m2']
var CAMPOS_TEXTO_LIBRE = ['estado', 'recomendacion', 'observacion', 'notas', 'descripcion']

// ---- Roles ----------------------------------------------------------
var ROLES = {
  admin:       { nombre: 'Administrador', verValores: true,  editarInventario: true,  gestionar: true,  archivar: true,  usuarios: true,  historial: true,  config: true },
  familia:     { nombre: 'Familia',       verValores: true,  editarInventario: true,  gestionar: true,  archivar: false, usuarios: false, historial: true,  config: false },
  colaborador: { nombre: 'Colaborador',   verValores: false, editarInventario: false, gestionar: true,  archivar: false, usuarios: false, historial: false, config: false },
  lector:      { nombre: 'Solo lectura',  verValores: false, editarInventario: false, gestionar: false, archivar: false, usuarios: false, historial: false, config: false }
}

var ESTADOS_TAREA = ['Pendiente', 'En curso', 'Bloqueada', 'Hecha']
var ESTADOS_PROYECTO = ['Planeación', 'En curso', 'En pausa', 'Bloqueado', 'Terminado']
var PRIORIDADES = ['Alta', 'Media', 'Baja']

var DURACION_SESION_DIAS = 30
var MAX_INTENTOS_LOGIN = 5
var MAX_ADJUNTO_BYTES = 15 * 1024 * 1024

// =====================================================================
//  Entrada HTTP
// =====================================================================

function doGet() {
  return responder({ ok: true, data: { app: 'Inversiones Lozano Montoya', version: VERSION } })
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents)
    if (body.request_id) {
      return ejecutarUnaSolaVez(body.request_id, function () { return despachar(body) })
    }
    return despachar(body)
  } catch (err) {
    return responder({ ok: false, error: mensajeError(err) })
  }
}

function despachar(body) {
  try {
    var accion = body.action
    if (accion === 'login') return responder(login(body.email, body.clave))

    var ctx = validarSesion(body.token)
    if (!ctx) return responder({ ok: false, error: 'Tu sesión terminó. Vuelve a ingresar.', codigo: 'SESION' })

    // Mientras tenga clave temporal, solo puede cambiarla o salir.
    if (esVerdadero(ctx.usuario.debe_cambiar_clave) && ['cambiarClave', 'logout', 'sesion'].indexOf(accion) === -1) {
      return responder({ ok: false, error: 'Debes cambiar tu clave temporal antes de continuar.', codigo: 'CAMBIAR_CLAVE' })
    }

    var acciones = {
      sesion: function () { return datosSesion(ctx) },
      logout: function () { return logout(body.token, ctx) },
      cambiarClave: function () { return cambiarClave(ctx, body.actual, body.nueva) },
      datos: function () { return cargarDatos(ctx) },
      historial: function () { return consultarHistorial(ctx, body) },
      guardar: function () { return conCandado(function () { return guardar(ctx, body.tabla, body.id, body.data || {}) }) },
      archivar: function () { return conCandado(function () { return archivar(ctx, body.tabla, body.id, body.restaurar === true) }) },
      comentar: function () { return conCandado(function () { return comentar(ctx, body.entidad, body.entidad_id, body.texto) }) },
      subirAdjunto: function () { return subirAdjunto(ctx, body) },
      verAdjunto: function () { return verAdjunto(ctx, body.id) },
      archivarAdjunto: function () { return conCandado(function () { return archivarAdjunto(ctx, body.id) }) },
      usuarios: function () { return listarUsuarios(ctx) },
      crearUsuario: function () { return conCandado(function () { return crearUsuario(ctx, body.data || {}) }) },
      editarUsuario: function () { return conCandado(function () { return editarUsuario(ctx, body.id, body.data || {}) }) },
      restablecerClave: function () { return conCandado(function () { return restablecerClave(ctx, body.id) }) },
      guardarConfig: function () { return conCandado(function () { return guardarConfig(ctx, body.data || {}) }) },
      sincronizar: function () { requiere(ctx, 'config'); sincronizarPestanas(); return { sincronizado: true } }
    }
    if (!acciones[accion]) return responder({ ok: false, error: 'Acción no reconocida: ' + accion })
    return responder({ ok: true, data: acciones[accion]() })
  } catch (err) {
    return responder({ ok: false, error: mensajeError(err) })
  }
}

// =====================================================================
//  Autenticación y sesiones
// =====================================================================

function login(email, clave) {
  email = String(email || '').trim().toLowerCase()
  if (!email || !clave) return { ok: false, error: 'Escribe tu correo y tu clave.' }

  var cache = CacheService.getScriptCache()
  var claveIntentos = 'fallos_' + email
  var fallos = Number(cache.get(claveIntentos) || 0)
  if (fallos >= MAX_INTENTOS_LOGIN) {
    return { ok: false, error: 'Demasiados intentos fallidos. Espera 15 minutos e intenta de nuevo.' }
  }

  var usuario = leerTodo('USUARIOS').filter(function (u) { return String(u.email).toLowerCase() === email })[0]
  var valido = usuario && esVerdadero(usuario.activo) && usuario.hash && hashClave(String(clave), String(usuario.salt)) === String(usuario.hash)
  if (!valido) {
    cache.put(claveIntentos, String(fallos + 1), 15 * 60)
    return { ok: false, error: 'Correo o clave incorrectos.' }
  }
  cache.remove(claveIntentos)

  var token = Utilities.getUuid() + Utilities.getUuid().replace(/-/g, '')
  var expira = Date.now() + DURACION_SESION_DIAS * 86400000
  PropertiesService.getScriptProperties().setProperty('S_' + sha256(token), JSON.stringify({ u: usuario.id, e: expira }))
  limpiarSesionesVencidas()

  conCandado(function () { actualizarFila('USUARIOS', usuario.id, { ultimo_ingreso: ahora() }) })
  registrar({ usuario: usuario }, 'ingreso', 'USUARIOS', usuario.id, usuario.nombre, 'Inició sesión', null)

  var ctx = { usuario: usuario, permisos: ROLES[usuario.rol] || ROLES.lector }
  var data = datosSesion(ctx)
  data.token = token
  return { ok: true, data: data }
}

function validarSesion(token) {
  if (!token) return null
  var props = PropertiesService.getScriptProperties()
  var clave = 'S_' + sha256(String(token))
  var raw = props.getProperty(clave)
  if (!raw) return null
  var s = JSON.parse(raw)
  if (Date.now() > s.e) { props.deleteProperty(clave); return null }

  var usuario = buscarPorId('USUARIOS', s.u)
  if (!usuario || !esVerdadero(usuario.activo)) { props.deleteProperty(clave); return null }

  // Sesión deslizante: si le quedan menos de 25 días, se renueva.
  if (s.e - Date.now() < 25 * 86400000) {
    s.e = Date.now() + DURACION_SESION_DIAS * 86400000
    props.setProperty(clave, JSON.stringify(s))
  }
  return { usuario: usuario, permisos: ROLES[usuario.rol] || ROLES.lector }
}

function datosSesion(ctx) {
  return {
    usuario: usuarioPublico(ctx.usuario, true),
    rol: ctx.usuario.rol,
    permisos: ctx.permisos,
    debe_cambiar_clave: esVerdadero(ctx.usuario.debe_cambiar_clave)
  }
}

function logout(token) {
  PropertiesService.getScriptProperties().deleteProperty('S_' + sha256(String(token)))
  return { salio: true }
}

function cambiarClave(ctx, actual, nueva) {
  if (!actual || !nueva) throw new Error('Escribe la clave actual y la nueva.')
  validarClaveNueva(nueva)
  if (hashClave(String(actual), String(ctx.usuario.salt)) !== String(ctx.usuario.hash)) throw new Error('La clave actual no es correcta.')
  var salt = Utilities.getUuid()
  conCandado(function () {
    actualizarFila('USUARIOS', ctx.usuario.id, { salt: salt, hash: hashClave(String(nueva), salt), debe_cambiar_clave: false })
  })
  registrar(ctx, 'cambiar_clave', 'USUARIOS', ctx.usuario.id, ctx.usuario.nombre, 'Cambió su clave', null)
  return { cambiada: true }
}

function validarClaveNueva(clave) {
  clave = String(clave)
  if (clave.length < 8) throw new Error('La clave debe tener al menos 8 caracteres.')
  if (!/[0-9]/.test(clave) || !/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(clave)) throw new Error('La clave debe tener letras y números.')
}

function cerrarSesionesDe(usuarioId) {
  var props = PropertiesService.getScriptProperties()
  var todas = props.getProperties()
  Object.keys(todas).forEach(function (k) {
    if (k.indexOf('S_') !== 0) return
    try { if (JSON.parse(todas[k]).u === usuarioId) props.deleteProperty(k) } catch (e) { props.deleteProperty(k) }
  })
}

function limpiarSesionesVencidas() {
  var props = PropertiesService.getScriptProperties()
  var todas = props.getProperties()
  Object.keys(todas).forEach(function (k) {
    if (k.indexOf('S_') !== 0) return
    try { if (Date.now() > JSON.parse(todas[k]).e) props.deleteProperty(k) } catch (e) { props.deleteProperty(k) }
  })
}

// Hash con sal e iteraciones (Apps Script no trae bcrypt). La sal es única por usuario.
function hashClave(clave, salt) {
  var v = salt + '|' + clave
  for (var i = 0; i < 300; i++) {
    v = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, v + salt, Utilities.Charset.UTF_8))
  }
  return v
}

function sha256(texto) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, texto, Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2) }).join('')
}

function claveTemporal() {
  var letras = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz'
  var numeros = '23456789'
  var c = ''
  for (var i = 0; i < 6; i++) c += letras.charAt(Math.floor(Math.random() * letras.length))
  for (var j = 0; j < 4; j++) c += numeros.charAt(Math.floor(Math.random() * numeros.length))
  return c
}

function requiere(ctx, permiso) {
  if (!ctx.permisos[permiso]) throw new Error('Tu rol no tiene permiso para esta acción.')
}

// =====================================================================
//  Lectura de datos (filtrada por rol)
// =====================================================================

function cargarDatos(ctx) {
  var verValores = ctx.permisos.verValores
  var config = leerConfig()
  var unidades = leerTodo('UNIDADES')
  var inmuebles = calcularInmuebles(leerTodo('INMUEBLES'), unidades, config)
  var usuarios = leerTodo('USUARIOS').map(function (u) { return usuarioPublico(u, false) })

  var datos = {
    config: verValores ? config : { tasas: null },
    usuarios: usuarios,
    inmuebles: inmuebles,
    unidades: unidades,
    proyectos: leerTodo('PROYECTOS'),
    tareas: leerTodo('TAREAS'),
    comentarios: leerTodo('COMENTARIOS'),
    adjuntos: leerTodo('ADJUNTOS').map(function (a) { delete a.drive_id; return a }),
    consolidado: verValores ? consolidar(inmuebles, unidades) : null,
    generado_en: ahora()
  }
  if (!verValores) ocultarValores(datos)
  return datos
}

function ocultarValores(datos) {
  datos.inmuebles.forEach(function (i) {
    ['canon_mensual', 'ingreso_anual', 'tasa', 'valor_estimado', 'valor_bajo', 'valor_alto', 'tasa_manual'].forEach(function (k) { delete i[k] })
    enmascararTextos(i)
  })
  datos.unidades.forEach(function (u) { CAMPOS_VALOR.UNIDADES.forEach(function (k) { delete u[k] }); enmascararTextos(u) })
  datos.proyectos.forEach(function (p) { CAMPOS_VALOR.PROYECTOS.forEach(function (k) { delete p[k] }); enmascararTextos(p) })
  datos.tareas.forEach(enmascararTextos)
}

// En textos libres, cifras como "1.100.000" o "$2.000.000" se reemplazan por "$•••".
function enmascararTextos(obj) {
  CAMPOS_TEXTO_LIBRE.concat(['titulo', 'nombre']).forEach(function (k) {
    if (typeof obj[k] === 'string') obj[k] = obj[k].replace(/\$?\s?\d{1,3}(?:[.,]\d{3})+(?:[.,]\d+)?/g, '$•••')
  })
}

function usuarioPublico(u, completo) {
  var r = { id: u.id, nombre: u.nombre, rol: u.rol, activo: esVerdadero(u.activo) }
  if (completo) { r.email = u.email; r.telefono = u.telefono }
  return r
}

function leerConfig() {
  var filas = leerTodo('CONFIG')
  var c = {}
  filas.forEach(function (f) { c[f.clave] = f.valor })
  return {
    tasas: {
      comercial: Number(c.tasa_comercial || 0.07),
      residencial: Number(c.tasa_residencial || 0.055),
      rural: Number(c.tasa_rural || 0.03),
      sensibilidad: Number(c.sensibilidad || 0.01)
    },
    alertas: leerJson(c.alertas, [])
  }
}

function leerJson(texto, porDefecto) {
  try { return texto ? JSON.parse(texto) : porDefecto } catch (e) { return porDefecto }
}

// Valor = canon mensual x 12 / tasa. Bajo = ingreso / (tasa + s). Alto = ingreso / (tasa - s).
// El canon del inmueble es la suma del canon actual de sus unidades activas.
function calcularInmuebles(inmuebles, unidades, config) {
  var t = config.tasas
  return inmuebles.map(function (inm) {
    var canon = 0
    unidades.forEach(function (u) {
      if (String(u.inmueble_id) === String(inm.id) && !esVerdadero(u.archivado)) canon += Number(u.canon_actual) || 0
    })
    var tasa = Number(inm.tasa_manual) || tasaPorTipo(inm.tipo, t)
    var ingreso = canon * 12
    inm.canon_mensual = canon
    inm.ingreso_anual = ingreso
    inm.tasa = tasa
    inm.valor_estimado = canon > 0 ? Math.round(ingreso / tasa) : null
    inm.valor_bajo = canon > 0 ? Math.round(ingreso / (tasa + t.sensibilidad)) : null
    inm.valor_alto = canon > 0 && tasa - t.sensibilidad > 0 ? Math.round(ingreso / (tasa - t.sensibilidad)) : null
    return inm
  })
}

function tasaPorTipo(tipo, t) {
  var x = String(tipo || '').toLowerCase()
  if (x.indexOf('residencial') !== -1) return t.residencial
  if (x.indexOf('rural') !== -1) return t.rural
  return t.comercial // Comercial y Mixto
}

function consolidar(inmuebles, unidades) {
  var activos = inmuebles.filter(function (i) { return !esVerdadero(i.archivado) })
  var ids = activos.map(function (i) { return String(i.id) })
  var uni = unidades.filter(function (u) { return !esVerdadero(u.archivado) && ids.indexOf(String(u.inmueble_id)) !== -1 })
  var suma = function (arr, k) { return arr.reduce(function (s, x) { return s + (Number(x[k]) || 0) }, 0) }
  var valor = suma(activos, 'valor_estimado')
  var canon = suma(activos, 'canon_mensual')
  return {
    total_inmuebles: activos.length,
    total_unidades: uni.length,
    canon_mensual: canon,
    ingreso_anual: canon * 12,
    valor_estimado: valor,
    valor_bajo: suma(activos, 'valor_bajo'),
    valor_alto: suma(activos, 'valor_alto'),
    rentabilidad_bruta: valor ? canon * 12 / valor : 0,
    unidades_sin_canon: uni.filter(function (u) { return !(Number(u.canon_actual) > 0) }).length,
    unidades_sin_contrato: uni.filter(function (u) { return String(u.contrato_escrito) === 'No' }).length
  }
}

function consultarHistorial(ctx, q) {
  var porEntidad = q.entidad && q.entidad_id
  if (!ctx.permisos.historial && !porEntidad) throw new Error('Tu rol no puede ver el historial completo.')
  var filas = leerTodo('HISTORIAL')
  if (porEntidad) {
    // Comentarios y adjuntos se registran con la entidad padre, así que también aparecen aquí.
    filas = filas.filter(function (h) { return h.entidad === q.entidad && String(h.entidad_id) === String(q.entidad_id) })
  }
  if (q.usuario_id) filas = filas.filter(function (h) { return String(h.usuario_id) === String(q.usuario_id) })
  if (q.desde) filas = filas.filter(function (h) { return String(h.fecha) >= q.desde })
  if (q.hasta) filas = filas.filter(function (h) { return String(h.fecha).slice(0, 10) <= q.hasta })
  filas.reverse()
  var limite = Math.min(Number(q.limite) || 300, 2000)
  filas = filas.slice(0, limite)
  if (!ctx.permisos.verValores) {
    var ocultos = [].concat(CAMPOS_VALOR.UNIDADES, CAMPOS_VALOR.PROYECTOS, CAMPOS_VALOR.INMUEBLES)
    filas.forEach(function (h) {
      if (!h.cambios) return
      try {
        var c = JSON.parse(h.cambios)
        ocultos.forEach(function (k) { if (c[k]) c[k] = ['•••', '•••'] })
        h.cambios = JSON.stringify(c)
      } catch (e) {}
    })
  }
  return filas
}

// =====================================================================
//  Escritura con registro en HISTORIAL
// =====================================================================

var TABLAS_EDITABLES = {
  INMUEBLES: { permiso: 'editarInventario', etiqueta: 'inmueble', nombre: 'nombre' },
  UNIDADES: { permiso: 'editarInventario', etiqueta: 'unidad', nombre: 'unidad' },
  PROYECTOS: { permiso: 'gestionar', etiqueta: 'proyecto', nombre: 'nombre' },
  TAREAS: { permiso: 'gestionar', etiqueta: 'tarea', nombre: 'titulo' }
}
var CAMPOS_SISTEMA = ['id', 'archivado', 'creado_en', 'creado_por', 'actualizado_en', 'actualizado_por', 'completada_en']

function guardar(ctx, tabla, id, data) {
  var def = TABLAS_EDITABLES[tabla]
  if (!def) throw new Error('No se puede editar ' + tabla)
  requiere(ctx, def.permiso)

  // Solo campos conocidos y no de sistema; los de dinero, solo si puede verlos.
  var limpio = {}
  HOJAS[tabla].forEach(function (k) {
    if (CAMPOS_SISTEMA.indexOf(k) !== -1 || data[k] === undefined) return
    if (!ctx.permisos.verValores && (CAMPOS_VALOR[tabla] || []).indexOf(k) !== -1) return
    var v = data[k]
    if (CAMPOS_NUMERICOS.indexOf(k) !== -1) v = (v === '' || v === null) ? '' : Number(String(v).replace(/[^0-9.\-]/g, ''))
    else if (typeof v === 'string') v = v.trim()
    limpio[k] = v
  })

  var anterior = id ? buscarPorId(tabla, id) : null
  if (id && !anterior) throw new Error('No se encontró el registro.')
  validarRegistro(tabla, limpio, anterior)

  if (tabla === 'TAREAS') {
    var estadoNuevo = limpio.estado || (anterior && anterior.estado)
    var estabaHecha = anterior && anterior.estado === 'Hecha'
    if (estadoNuevo === 'Hecha' && !estabaHecha) limpio.completada_en = ahora()
    if (estadoNuevo !== 'Hecha' && estabaHecha) limpio.completada_en = ''
  }

  limpio.actualizado_en = ahora()
  limpio.actualizado_por = ctx.usuario.id
  var resultado, accion, cambios
  if (anterior) {
    cambios = diferencias(anterior, limpio)
    if (!Object.keys(cambios).length) return anterior
    resultado = actualizarFila(tabla, id, limpio)
    accion = 'editar'
  } else {
    limpio.creado_en = limpio.actualizado_en
    limpio.creado_por = ctx.usuario.id
    limpio.archivado = false
    resultado = crearFila(tabla, limpio)
    accion = 'crear'
    cambios = null
  }
  var nombre = resultado[def.nombre]
  registrar(ctx, accion, tabla, resultado.id, nombre, describir(accion, def.etiqueta, nombre, cambios), cambios)
  sincronizarSeguro()
  return resultado
}

function validarRegistro(tabla, d, anterior) {
  var valor = function (k) { return d[k] !== undefined ? d[k] : (anterior ? anterior[k] : '') }
  if (tabla === 'INMUEBLES' && !valor('nombre')) throw new Error('El inmueble necesita un nombre.')
  if (tabla === 'UNIDADES') {
    if (!valor('unidad')) throw new Error('La unidad necesita un nombre.')
    if (!buscarPorId('INMUEBLES', valor('inmueble_id'))) throw new Error('La unidad debe pertenecer a un inmueble.')
  }
  if (tabla === 'PROYECTOS') {
    if (!valor('nombre')) throw new Error('El proyecto necesita un nombre.')
    if (valor('estado') && ESTADOS_PROYECTO.indexOf(valor('estado')) === -1) throw new Error('Estado de proyecto no válido.')
    validarResponsable(d, anterior, false)
  }
  if (tabla === 'TAREAS') {
    if (!valor('titulo')) throw new Error('La tarea necesita un título.')
    if (!buscarPorId('PROYECTOS', valor('proyecto_id'))) throw new Error('La tarea debe pertenecer a un proyecto.')
    if (valor('estado') && ESTADOS_TAREA.indexOf(valor('estado')) === -1) throw new Error('Estado de tarea no válido.')
    validarResponsable(d, anterior, true)
  }
  if (d.prioridad && PRIORIDADES.indexOf(d.prioridad) === -1) throw new Error('Prioridad no válida.')
}

// Toda tarea nueva debe tener responsable: un usuario activo o un tercero con nombre.
function validarResponsable(d, anterior, obligatorio) {
  var tocaResponsable = ['responsable_tipo', 'responsable_usuario_id', 'responsable_externo'].some(function (k) { return d[k] !== undefined })
  if (anterior && !tocaResponsable) return
  var tipo = d.responsable_tipo !== undefined ? d.responsable_tipo : (anterior ? anterior.responsable_tipo : '')
  if (!tipo || tipo === 'pendiente') {
    if (obligatorio) throw new Error('Selecciona un responsable para la tarea: un usuario o un tercero.')
    return
  }
  d.responsable_tipo = tipo
  if (tipo === 'usuario') {
    if (d.responsable_usuario_id === undefined && anterior) d.responsable_usuario_id = anterior.responsable_usuario_id
    var u = buscarPorId('USUARIOS', d.responsable_usuario_id)
    if (!u || !esVerdadero(u.activo)) throw new Error('El usuario responsable no existe o está inactivo.')
    d.responsable_externo = ''
    d.responsable_contacto = ''
  } else if (tipo === 'tercero') {
    if (d.responsable_externo === undefined && anterior) d.responsable_externo = anterior.responsable_externo
    if (!d.responsable_externo) throw new Error('Escribe el nombre del tercero responsable.')
    d.responsable_usuario_id = ''
  } else {
    throw new Error('Tipo de responsable no válido.')
  }
}

function archivar(ctx, tabla, id, restaurar) {
  var def = TABLAS_EDITABLES[tabla]
  if (!def) throw new Error('No se puede archivar ' + tabla)
  requiere(ctx, 'archivar')
  var anterior = buscarPorId(tabla, id)
  if (!anterior) throw new Error('No se encontró el registro.')
  actualizarFila(tabla, id, { archivado: !restaurar, actualizado_en: ahora(), actualizado_por: ctx.usuario.id })
  var accion = restaurar ? 'restaurar' : 'archivar'
  registrar(ctx, accion, tabla, id, anterior[def.nombre], (restaurar ? 'Restauró ' : 'Archivó ') + def.etiqueta + ' «' + anterior[def.nombre] + '»', null)
  sincronizarSeguro()
  return { id: id, archivado: !restaurar }
}

function comentar(ctx, entidad, entidadId, texto) {
  requiere(ctx, 'gestionar')
  texto = String(texto || '').trim()
  if (!texto) throw new Error('El comentario está vacío.')
  if (texto.length > 4000) throw new Error('El comentario es demasiado largo.')
  var padre = validarEntidad(entidad, entidadId)
  var c = crearFila('COMENTARIOS', {
    entidad: entidad, entidad_id: entidadId, texto: texto,
    usuario_id: ctx.usuario.id, usuario_nombre: ctx.usuario.nombre, creado_en: ahora()
  })
  registrar(ctx, 'comentar', entidad, entidadId, padre.nombre, 'Comentó: «' + texto.slice(0, 120) + (texto.length > 120 ? '…' : '') + '»', null)
  return c
}

function validarEntidad(entidad, id) {
  var def = TABLAS_EDITABLES[entidad]
  if (!def) throw new Error('Entidad no válida.')
  var fila = buscarPorId(entidad, id)
  if (!fila) throw new Error('No se encontró el registro.')
  return { nombre: fila[def.nombre], fila: fila }
}

// ---- Adjuntos (Google Drive, carpeta privada del dueño) ----

function carpetaAdjuntos() {
  var props = PropertiesService.getScriptProperties()
  var id = props.getProperty('CARPETA_ADJUNTOS')
  if (id) { try { return DriveApp.getFolderById(id) } catch (e) {} }
  var carpeta = DriveApp.createFolder('App Inversiones Lozano Montoya · Adjuntos')
  props.setProperty('CARPETA_ADJUNTOS', carpeta.getId())
  return carpeta
}

function subirAdjunto(ctx, b) {
  requiere(ctx, 'gestionar')
  var padre = validarEntidad(b.entidad, b.entidad_id)
  if (!b.base64 || !b.nombre) throw new Error('Falta el archivo.')
  var bytes = Utilities.base64Decode(b.base64)
  if (bytes.length > MAX_ADJUNTO_BYTES) throw new Error('El archivo supera 15 MB.')
  var nombre = String(b.nombre).replace(/[\\/:*?"<>|]/g, '_').slice(0, 120)
  var archivo = carpetaAdjuntos().createFile(Utilities.newBlob(bytes, b.mime || 'application/octet-stream', nombre))
  archivo.setDescription(b.entidad + ':' + b.entidad_id + ' · subido por ' + ctx.usuario.nombre)
  var fila
  conCandado(function () {
    fila = crearFila('ADJUNTOS', {
      entidad: b.entidad, entidad_id: b.entidad_id, nombre: nombre, mime: b.mime || '',
      tamano: bytes.length, drive_id: archivo.getId(), usuario_id: ctx.usuario.id,
      usuario_nombre: ctx.usuario.nombre, creado_en: ahora(), archivado: false
    })
    registrar(ctx, 'adjuntar', b.entidad, b.entidad_id, padre.nombre, 'Adjuntó «' + nombre + '»', null)
  })
  delete fila.drive_id
  return fila
}

function verAdjunto(ctx, id) {
  var a = buscarPorId('ADJUNTOS', id)
  if (!a || esVerdadero(a.archivado)) throw new Error('Adjunto no encontrado.')
  var blob = DriveApp.getFileById(a.drive_id).getBlob()
  return { nombre: a.nombre, mime: a.mime || blob.getContentType(), base64: Utilities.base64Encode(blob.getBytes()) }
}

function archivarAdjunto(ctx, id) {
  var a = buscarPorId('ADJUNTOS', id)
  if (!a) throw new Error('Adjunto no encontrado.')
  // Puede quitarlo quien lo subió o un administrador. El archivo sigue en Drive.
  if (!ctx.permisos.archivar && String(a.usuario_id) !== String(ctx.usuario.id)) throw new Error('Solo quien lo subió o un administrador puede quitarlo.')
  actualizarFila('ADJUNTOS', id, { archivado: true })
  var padre = validarEntidad(a.entidad, a.entidad_id)
  registrar(ctx, 'quitar_adjunto', a.entidad, a.entidad_id, padre.nombre, 'Quitó el adjunto «' + a.nombre + '»', null)
  return { id: id }
}

// ---- Usuarios (solo administrador) ----

function listarUsuarios(ctx) {
  requiere(ctx, 'usuarios')
  return leerTodo('USUARIOS').map(function (u) {
    return {
      id: u.id, nombre: u.nombre, email: u.email, telefono: u.telefono, rol: u.rol,
      activo: esVerdadero(u.activo), debe_cambiar_clave: esVerdadero(u.debe_cambiar_clave),
      creado_en: u.creado_en, ultimo_ingreso: u.ultimo_ingreso
    }
  })
}

function crearUsuario(ctx, d) {
  requiere(ctx, 'usuarios')
  var email = String(d.email || '').trim().toLowerCase()
  if (!d.nombre || !email) throw new Error('Nombre y correo son obligatorios.')
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('El correo no es válido.')
  if (!ROLES[d.rol]) throw new Error('Rol no válido.')
  if (leerTodo('USUARIOS').some(function (u) { return String(u.email).toLowerCase() === email })) throw new Error('Ya existe un usuario con ese correo.')
  var temporal = claveTemporal()
  var salt = Utilities.getUuid()
  var u = crearFila('USUARIOS', {
    nombre: String(d.nombre).trim(), email: email, telefono: String(d.telefono || '').trim(), rol: d.rol,
    activo: true, hash: hashClave(temporal, salt), salt: salt, debe_cambiar_clave: true,
    creado_en: ahora(), creado_por: ctx.usuario.id
  })
  registrar(ctx, 'crear', 'USUARIOS', u.id, u.nombre, 'Creó el usuario «' + u.nombre + '» con rol ' + ROLES[d.rol].nombre, null)
  return { usuario: { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol, activo: true }, clave_temporal: temporal }
}

function editarUsuario(ctx, id, d) {
  requiere(ctx, 'usuarios')
  var anterior = buscarPorId('USUARIOS', id)
  if (!anterior) throw new Error('Usuario no encontrado.')
  var cambios = {}
  ;['nombre', 'telefono', 'rol', 'activo'].forEach(function (k) { if (d[k] !== undefined) cambios[k] = typeof d[k] === 'string' ? d[k].trim() : d[k] })
  if (cambios.rol && !ROLES[cambios.rol]) throw new Error('Rol no válido.')
  if (String(id) === String(ctx.usuario.id) && (cambios.activo === false || (cambios.rol && cambios.rol !== 'admin'))) {
    throw new Error('No puedes quitarte a ti mismo el rol de administrador ni desactivarte.')
  }
  var dif = diferencias(anterior, cambios)
  if (!Object.keys(dif).length) return listarUsuarios(ctx).filter(function (u) { return u.id === id })[0]
  actualizarFila('USUARIOS', id, cambios)
  if (cambios.activo === false || cambios.rol) cerrarSesionesDe(id)
  registrar(ctx, 'editar', 'USUARIOS', id, anterior.nombre, describir('editar', 'usuario', anterior.nombre, dif), dif)
  return listarUsuarios(ctx).filter(function (u) { return u.id === id })[0]
}

function restablecerClave(ctx, id) {
  requiere(ctx, 'usuarios')
  var u = buscarPorId('USUARIOS', id)
  if (!u) throw new Error('Usuario no encontrado.')
  var temporal = claveTemporal()
  var salt = Utilities.getUuid()
  actualizarFila('USUARIOS', id, { salt: salt, hash: hashClave(temporal, salt), debe_cambiar_clave: true })
  cerrarSesionesDe(id)
  registrar(ctx, 'restablecer_clave', 'USUARIOS', id, u.nombre, 'Generó una clave temporal para «' + u.nombre + '»', null)
  return { clave_temporal: temporal }
}

function guardarConfig(ctx, d) {
  requiere(ctx, 'config')
  var anterior = leerConfig().tasas
  var cambios = {}
  ;['comercial', 'residencial', 'rural', 'sensibilidad'].forEach(function (k) {
    if (d[k] === undefined) return
    var v = Number(d[k])
    if (!(v > 0 && v < 1)) throw new Error('La tasa ' + k + ' debe estar entre 0 y 1 (por ejemplo 0.07).')
    var clave = k === 'sensibilidad' ? 'sensibilidad' : 'tasa_' + k
    escribirConfig(clave, v)
    if (v !== anterior[k]) cambios[clave] = [anterior[k], v]
  })
  if (Object.keys(cambios).length) registrar(ctx, 'editar', 'CONFIG', 'tasas', 'Tasas de capitalización', describir('editar', 'configuración', 'tasas', cambios), cambios)
  sincronizarSeguro()
  return leerConfig()
}

function escribirConfig(clave, valor) {
  var hoja = obtenerHoja('CONFIG')
  var datos = hoja.getDataRange().getValues()
  for (var i = 1; i < datos.length; i++) {
    if (datos[i][0] === clave) { hoja.getRange(i + 1, 2).setValue(valor); return }
  }
  hoja.appendRow([clave, valor])
}

// ---- Historial ----

function registrar(ctx, accion, entidad, entidadId, entidadNombre, detalle, cambios) {
  var u = ctx.usuario
  crearFila('HISTORIAL', {
    fecha: ahora(), usuario_id: u.id, usuario_nombre: u.nombre, rol: u.rol || '',
    accion: accion, entidad: entidad, entidad_id: entidadId, entidad_nombre: entidadNombre || '',
    detalle: detalle || '', cambios: cambios ? JSON.stringify(cambios) : ''
  })
}

function diferencias(anterior, nuevo) {
  var d = {}
  Object.keys(nuevo).forEach(function (k) {
    if (['actualizado_en', 'actualizado_por', 'completada_en', 'hash', 'salt'].indexOf(k) !== -1) return
    var a = anterior[k] === undefined || anterior[k] === null ? '' : anterior[k]
    var n = nuevo[k] === undefined || nuevo[k] === null ? '' : nuevo[k]
    if (String(a) !== String(n)) d[k] = [a, n]
  })
  return d
}

function describir(accion, etiqueta, nombre, cambios) {
  if (accion === 'crear') return 'Creó ' + etiqueta + ' «' + nombre + '»'
  var campos = Object.keys(cambios || {}).map(function (k) { return k.replace(/_/g, ' ') })
  return 'Editó ' + etiqueta + ' «' + nombre + '»' + (campos.length ? ': ' + campos.join(', ') : '')
}

// =====================================================================
//  Sincronización con las pestañas de reporte (1, 4 y 5)
// =====================================================================

function sincronizarSeguro() {
  try { sincronizarPestanas() } catch (e) { console.error('Sincronización: ' + e) }
}

function sincronizarPestanas() {
  var ss = SpreadsheetApp.getActiveSpreadsheet()
  var config = leerConfig()
  var unidades = leerTodo('UNIDADES').filter(function (u) { return !esVerdadero(u.archivado) })
  var inmuebles = calcularInmuebles(leerTodo('INMUEBLES').filter(function (i) { return !esVerdadero(i.archivado) }), unidades, config)
  var proyectos = leerTodo('PROYECTOS').filter(function (p) { return !esVerdadero(p.archivado) })
  var tareas = leerTodo('TAREAS').filter(function (t) { return !esVerdadero(t.archivado) })
  var usuarios = leerTodo('USUARIOS')
  var nombreUsuario = function (id) { var u = usuarios.filter(function (x) { return String(x.id) === String(id) })[0]; return u ? u.nombre : '' }
  var responsable = function (r) {
    if (r.responsable_tipo === 'usuario') return nombreUsuario(r.responsable_usuario_id)
    if (r.responsable_tipo === 'tercero') return r.responsable_externo + ' (tercero)'
    return 'Por asignar'
  }
  var sd = function (v) { return v === '' || v === null || v === undefined ? 'Sin dato' : v }
  var nombreInm = {}
  inmuebles.forEach(function (i) { nombreInm[String(i.id)] = i.nombre })

  // 1. Inventario Propiedades
  var filas1 = inmuebles.map(function (i, n) {
    var uni = unidades.filter(function (u) { return String(u.inmueble_id) === String(i.id) }).length
    var resp = proyectos.filter(function (p) { return String(p.inmueble_ids).split(',').indexOf(String(i.id)) !== -1 && p.estado !== 'Terminado' })
      .map(responsable).filter(function (x, k, a) { return x && a.indexOf(x) === k }).join(', ')
    return [n + 1, i.nombre, sd(i.direccion), sd(i.barrio), sd(i.ciudad), i.tipo, i.propietarios, sd(i.ref_catastral), sd(i.matricula), sd(i.anio_predial),
      uni, i.canon_mensual, i.ingreso_anual, i.tasa, sd(i.valor_estimado), sd(i.valor_bajo), sd(i.valor_alto),
      i.estado, i.recomendacion, i.prioridad, resp || 'Por asignar', String(i.actualizado_en || '').slice(0, 10)]
  })
  escribirReporte(ss, '1. Inventario Propiedades', filas1, 22, { 12: '$#,##0', 13: '$#,##0', 14: '0.0%', 15: '$#,##0', 16: '$#,##0', 17: '$#,##0' })

  // 5. Unidades y Arriendos
  var filas5 = unidades.map(function (u) {
    var min = Number(u.mercado_min) || 0, max = Number(u.mercado_max) || 0
    var medio = min && max ? (min + max) / 2 : ''
    return [u.inmueble_id ? inmuebles.map(function (i) { return String(i.id) }).indexOf(String(u.inmueble_id)) + 1 : '', nombreInm[String(u.inmueble_id)] || '',
      u.unidad, u.uso, u.arrendatario, u.contrato_escrito, u.fecha_inicio, u.canon_inicial, Number(u.canon_actual) || 0,
      u.mercado_min, u.mercado_max, medio, medio !== '' ? (Number(u.canon_actual) || 0) - medio : '', u.observacion]
  })
  escribirReporte(ss, '5. Unidades y Arriendos', filas5, 14, { 8: '$#,##0', 9: '$#,##0', 10: '$#,##0', 11: '$#,##0', 12: '$#,##0', 13: '$#,##0' })

  // 4. Seguimiento Obras (un renglón por proyecto)
  var filas4 = proyectos.map(function (p) {
    var ts = tareas.filter(function (t) { return String(t.proyecto_id) === String(p.id) })
    var hechas = ts.filter(function (t) { return t.estado === 'Hecha' }).length
    var props = String(p.inmueble_ids || '').split(',').map(function (id) { return nombreInm[id.trim()] }).filter(String).join(', ')
    return [props, p.tipo, p.nombre + (p.descripcion ? ': ' + p.descripcion : ''), responsable(p), p.presupuesto === '' ? 'Por cotizar' : p.presupuesto,
      Number(p.invertido) || 0, ts.length ? hechas / ts.length : 0, p.fecha_inicio, p.fecha_fin, p.estado,
      (ts.length - hechas) + ' tareas abiertas de ' + ts.length]
  })
  escribirReporte(ss, '4. Seguimiento Obras', filas4, 11, { 5: '$#,##0', 6: '$#,##0', 7: '0%' })
}

function escribirReporte(ss, nombre, filas, columnas, formatos) {
  var hoja = ss.getSheetByName(nombre)
  if (!hoja) return
  var ultima = Math.max(hoja.getLastRow(), 2)
  hoja.getRange(2, 1, ultima - 1, columnas).clearContent()
  if (!filas.length) return
  hoja.getRange(2, 1, filas.length, columnas).setValues(filas)
  Object.keys(formatos).forEach(function (col) { hoja.getRange(2, Number(col), filas.length, 1).setNumberFormat(formatos[col]) })
}

// =====================================================================
//  Instalación (se ejecuta una vez desde el editor o el menú)
// =====================================================================

function onOpen() {
  SpreadsheetApp.getUi().createMenu('App Inversiones')
    .addItem('1. Instalar o reparar pestañas', 'instalarDesdeMenu')
    .addItem('Sincronizar pestañas de reporte', 'sincronizarPestanas')
    .addItem('Generar clave temporal de administrador', 'claveAdminDesdeMenu')
    .addToUi()
}

function instalarDesdeMenu() {
  var r = instalar()
  SpreadsheetApp.getUi().alert('Instalación lista',
    r.mensaje + (r.clave ? '\n\nUsuario: ' + r.email + '\nClave temporal: ' + r.clave + '\n\nAnótala: la app te pedirá cambiarla al entrar.' : ''),
    SpreadsheetApp.getUi().ButtonSet.OK)
}

function instalar() {
  var ss = SpreadsheetApp.getActiveSpreadsheet()
  Object.keys(HOJAS).forEach(function (nombre) {
    var hoja = ss.getSheetByName(nombre)
    if (!hoja) hoja = ss.insertSheet(nombre)
    var enc = HOJAS[nombre]
    if (hoja.getMaxColumns() < enc.length) hoja.insertColumnsAfter(hoja.getMaxColumns(), enc.length - hoja.getMaxColumns())
    var actuales = hoja.getRange(1, 1, 1, enc.length).getValues()[0]
    if (actuales.join('') === '') hoja.getRange(1, 1, 1, enc.length).setValues([enc])
    else enc.forEach(function (c) {
      var fila = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0]
      if (fila.indexOf(c) === -1) hoja.getRange(1, hoja.getLastColumn() + 1).setValue(c)
    })
    hoja.getRange(1, 1, 1, hoja.getLastColumn()).setFontWeight('bold').setBackground('#0F3A5F').setFontColor('#FFFFFF')
    hoja.setFrozenRows(1)
    var encFinal = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0]
    encFinal.forEach(function (c, i) { if (COLUMNAS_TEXTO.test(c)) hoja.getRange(1, i + 1, hoja.getMaxRows(), 1).setNumberFormat('@') })
  })

  if (!leerTodo('CONFIG').length) {
    escribirConfig('tasa_comercial', 0.07)
    escribirConfig('tasa_residencial', 0.055)
    escribirConfig('tasa_rural', 0.03)
    escribirConfig('sensibilidad', 0.01)
  }

  var sistema = { usuario: { id: 'sistema', nombre: 'Instalación', rol: 'admin' } }
  var mensaje = 'Pestañas listas.'
  if (!leerTodo('INMUEBLES').length) {
    cargarSemilla()
    registrar(sistema, 'crear', 'SISTEMA', 'semilla', 'Carga inicial', 'Cargó el inventario inicial (7 inmuebles, 28 unidades) y los pendientes como proyectos y tareas', null)
    mensaje += ' Se cargó el inventario inicial con los pendientes como proyectos y tareas.'
  }
  carpetaAdjuntos()

  var r = { mensaje: mensaje }
  if (!leerTodo('USUARIOS').length) {
    var email = Session.getEffectiveUser().getEmail()
    var temporal = claveTemporal()
    var salt = Utilities.getUuid()
    crearFila('USUARIOS', {
      nombre: 'Administrador', email: email.toLowerCase(), telefono: '', rol: 'admin', activo: true,
      hash: hashClave(temporal, salt), salt: salt, debe_cambiar_clave: true, creado_en: ahora(), creado_por: 'sistema'
    })
    r.email = email
    r.clave = temporal
    console.log('Usuario administrador: ' + email + ' · Clave temporal: ' + temporal)
  }
  sincronizarPestanas()
  return r
}

function claveAdminDesdeMenu() {
  var email = Session.getEffectiveUser().getEmail().toLowerCase()
  var u = leerTodo('USUARIOS').filter(function (x) { return String(x.email).toLowerCase() === email })[0]
  if (!u) { SpreadsheetApp.getUi().alert('No hay un usuario con el correo ' + email + '. Ejecuta primero la instalación.'); return }
  var temporal = claveTemporal()
  var salt = Utilities.getUuid()
  actualizarFila('USUARIOS', u.id, { salt: salt, hash: hashClave(temporal, salt), debe_cambiar_clave: true, activo: true, rol: 'admin' })
  cerrarSesionesDe(u.id)
  registrar({ usuario: u }, 'restablecer_clave', 'USUARIOS', u.id, u.nombre, 'Generó clave temporal desde la Hoja (dueño del archivo)', null)
  SpreadsheetApp.getUi().alert('Clave temporal para ' + email + ': ' + temporal)
}

function cargarSemilla() {
  if (typeof SEMILLA === 'undefined') {
    throw new Error('Falta el archivo Semilla en Apps Script. Créalo con + > Secuencia de comandos, pega el contenido de Semilla.gs, guarda y vuelve a ejecutar la instalación.')
  }
  var s = SEMILLA
  var ahoraTxt = ahora()
  var base = { creado_en: ahoraTxt, creado_por: 'sistema', actualizado_en: ahoraTxt, actualizado_por: 'sistema', archivado: false }
  var conBase = function (o) { var r = {}; Object.keys(base).forEach(function (k) { r[k] = base[k] }); Object.keys(o).forEach(function (k) { r[k] = o[k] }); return r }
  escribirVarias('INMUEBLES', s.inmuebles.map(conBase))
  escribirVarias('UNIDADES', s.unidades.map(conBase))
  escribirVarias('PROYECTOS', s.proyectos.map(conBase))
  escribirVarias('TAREAS', s.tareas.map(conBase))
  // Alertas de verificación del análisis: se editan en la pestaña CONFIG (fila "alertas").
  if (s.alertas) escribirConfig('alertas', JSON.stringify(s.alertas))
}

function escribirVarias(nombre, objetos) {
  if (!objetos.length) return
  var hoja = obtenerHoja(nombre)
  var enc = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0]
  var filas = objetos.map(function (o) { return enc.map(function (h) { return o[h] === undefined || o[h] === null ? '' : o[h] }) })
  hoja.getRange(hoja.getLastRow() + 1, 1, filas.length, enc.length).setValues(filas)
}

// =====================================================================
//  Acceso genérico a las pestañas
// =====================================================================

function obtenerHoja(nombre) {
  var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nombre)
  if (!hoja) throw new Error('Falta la pestaña ' + nombre + '. Ejecuta "App Inversiones > Instalar".')
  return hoja
}

function leerTodo(nombre) {
  var valores = obtenerHoja(nombre).getDataRange().getValues()
  var enc = valores[0]
  return valores.slice(1).filter(function (f) { return f.join('') !== '' }).map(function (f) {
    var o = {}
    enc.forEach(function (h, i) { if (h) o[h] = normalizar(f[i]) })
    return o
  })
}

function buscarPorId(nombre, id) {
  if (id === undefined || id === null || id === '') return null
  return leerTodo(nombre).filter(function (f) { return String(f.id) === String(id) })[0] || null
}

function crearFila(nombre, datos) {
  var hoja = obtenerHoja(nombre)
  var enc = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0]
  if (enc.indexOf('id') !== -1 && !datos.id) datos.id = generarId(nombre)
  hoja.appendRow(enc.map(function (h) { return datos[h] !== undefined && datos[h] !== null ? datos[h] : '' }))
  return datos
}

function actualizarFila(nombre, id, datos) {
  var hoja = obtenerHoja(nombre)
  var valores = hoja.getDataRange().getValues()
  var enc = valores[0]
  var col = enc.indexOf('id')
  for (var i = 1; i < valores.length; i++) {
    if (String(valores[i][col]) !== String(id)) continue
    var resultado = {}
    var fila = enc.map(function (h, j) {
      var v = datos[h] !== undefined ? datos[h] : valores[i][j]
      resultado[h] = normalizar(v)
      return v
    })
    hoja.getRange(i + 1, 1, 1, enc.length).setValues([fila])
    return resultado
  }
  return null
}

function generarId(nombre) {
  var prefijos = { USUARIOS: 'usr', INMUEBLES: 'inm', UNIDADES: 'uni', PROYECTOS: 'pry', TAREAS: 'tar', COMENTARIOS: 'com', ADJUNTOS: 'adj', HISTORIAL: 'his' }
  return (prefijos[nombre] || nombre.toLowerCase().slice(0, 3)) + '-' + Utilities.getUuid().slice(0, 8)
}

function conCandado(fn) {
  var lock = LockService.getScriptLock()
  lock.waitLock(20000)
  try { return fn() } finally { lock.releaseLock() }
}

// Si la respuesta de Google se pierde y la app reintenta con el mismo request_id,
// se devuelve la respuesta de la primera vez en lugar de guardar dos veces.
function ejecutarUnaSolaVez(requestId, ejecutar) {
  var cache = CacheService.getScriptCache()
  var clave = 'req_' + requestId
  var previo = conCandado(function () {
    var p = cache.get(clave)
    if (p === null) cache.put(clave, 'PENDIENTE', 600)
    return p
  })
  if (previo !== null) {
    for (var i = 0; i < 25 && previo === 'PENDIENTE'; i++) { Utilities.sleep(1000); previo = cache.get(clave) }
    if (previo === null || previo === 'PENDIENTE') return responder({ ok: false, error: 'La operación anterior sigue en proceso. Revisa antes de volver a guardar.' })
    return ContentService.createTextOutput(previo).setMimeType(ContentService.MimeType.JSON)
  }
  try {
    var salida = ejecutar()
    var texto = salida.getContent()
    if (JSON.parse(texto).ok && texto.length < 90000) cache.put(clave, texto, 600)
    else cache.remove(clave)
    return salida
  } catch (err) {
    cache.remove(clave)
    throw err
  }
}

// ---- Utilidades ----

function normalizar(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss").replace('T00:00:00', '')
  }
  return v
}

function ahora() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss")
}

function esVerdadero(v) {
  return v === true || v === 'TRUE' || v === 'true' || v === 'VERDADERO' || v === 1 || v === 'Sí'
}

function mensajeError(err) {
  return String(err && err.message ? err.message : err).replace(/^Error:\s*/, '')
}

function responder(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON)
}

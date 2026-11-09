# Guía de instalación · App Inversiones Lozano Montoya

Tiempo estimado: 30 a 45 minutos. Se hace una sola vez.

## Antes de empezar

1. **Haz una copia de seguridad de la Hoja.** Abre «Inventario_Propiedades Familia Lozano», ve a *Archivo > Hacer una copia* y guárdala como «Respaldo antes de la app».
2. **Revisa quién tiene acceso a la Hoja.** Ve a *Compartir* y deja solo tu cuenta y, como máximo, una persona más de confianza. Los demás usuarios entran **solo por la app**: si alguien tiene acceso directo a la Hoja, puede ver las claves cifradas y editar el historial.

## Paso 1 · Pegar el backend en la Hoja

1. En la Hoja, abre *Extensiones > Apps Script*.
2. En el editor, borra el contenido de `Código.gs` y pega todo el contenido de `apps-script/Code.gs`.
3. Crea otro archivo con *+ > Secuencia de comandos*, llámalo `Semilla` y pega `apps-script/Semilla.gs`.
4. Haz clic en ⚙️ *Configuración del proyecto*, activa **«Mostrar el archivo de manifiesto appsscript.json»** y reemplaza su contenido por el de `apps-script/appsscript.json`.
5. Guarda (💾).

## Paso 2 · Instalar las pestañas y crear tu usuario

1. Vuelve a la Hoja y recarga la página. Aparece el menú **App Inversiones**.
2. Haz clic en *App Inversiones > 1. Instalar o reparar pestañas*. Google te pedirá autorizar el script: elige tu cuenta, luego *Configuración avanzada > Ir a … (no seguro)* y *Permitir*. Es normal: el script es tuyo y Google aún no lo ha verificado.
3. Al terminar verás un mensaje con **tu correo y una clave temporal. Anótala.**

Qué pasa en la Hoja:
- Se crean las pestañas de la app: `CONFIG`, `USUARIOS`, `INMUEBLES`, `UNIDADES`, `PROYECTOS`, `TAREAS`, `COMENTARIOS`, `ADJUNTOS` e `HISTORIAL`.
- Se cargan los 7 inmuebles, las 28 unidades y los pendientes como 9 proyectos con 31 tareas.
- Las pestañas `1. Inventario Propiedades`, `4. Seguimiento Obras` y `5. Unidades y Arriendos` se vuelven **reportes**: la app las reescribe con cada cambio. No las edites a mano; edita desde la app o en las pestañas de la app.
- Las pestañas `2. Resumen Arreglos`, `3. Consolidado Financiero` y `6. Supuestos y Fuentes` no se tocan.
- En tu Drive aparece la carpeta privada **«App Inversiones Lozano Montoya · Adjuntos»**.

## Paso 3 · Publicar el backend como Web App

1. En el editor de Apps Script, haz clic en *Implementar > Nueva implementación*.
2. En el tipo, elige **Aplicación web**.
3. Configura:
   - **Ejecutar como:** Yo (tu correo)
   - **Quién tiene acceso:** Cualquier usuario
4. Haz clic en *Implementar* y **copia la URL** que termina en `/exec`.

> «Cualquier usuario» no significa que cualquiera vea los datos: la URL solo responde a quien tenga una sesión válida creada con correo y clave.

**Cuando actualices `Code.gs` más adelante:** usa *Implementar > Gestionar implementaciones > ✏️ > Versión: Nueva versión*. Así la URL no cambia.

## Paso 4 · Conectar la app con el backend

El repositorio ya está creado: **https://github.com/jcspro13ship/inversiones-lozano-montoya**. La app se publica sola en GitHub Pages cada vez que se sube un cambio a `main`.

1. En GitHub, abre el repositorio > *Settings > Secrets and variables > Actions > pestaña Variables > New repository variable*.
2. Nombre: `VITE_API_URL`. Valor: la URL del Paso 3, la que termina en `/exec`.
3. Ve a *Actions > Publicar app > Run workflow* para publicar con la URL nueva.
4. En uno o dos minutos la app queda en **https://jcspro13ship.github.io/inversiones-lozano-montoya/**.

> El repositorio es público, como tus otros proyectos (GitHub Pages en un repositorio privado necesita un plan de pago). Eso **no expone datos**: los datos viven en la Hoja y solo se entregan con sesión válida. Los únicos archivos con información de la familia son `apps-script/Semilla.gs` y la carpeta `data/`, y están en `.gitignore`, así que no se suben a GitHub.

## Paso 5 · Primer ingreso y usuarios

1. Abre la app, entra con tu correo y la clave temporal, y crea tu clave definitiva.
2. Ve a **Usuarios > Nuevo usuario**. Por cada persona escribe nombre, correo y rol. La app genera una clave temporal y te deja **copiarla o enviarla por WhatsApp**.
3. Cada persona entra, cambia su clave e instala la app:
   - **iPhone:** Safari > Compartir > *Agregar a pantalla de inicio*.
   - **Android:** Chrome > ⋮ > *Instalar app*.
   - **Computador:** ícono de instalar en la barra de direcciones de Chrome o Edge.

## Uso diario

- **Proyecto nuevo:** Proyectos > Nuevo proyecto. Puede cubrir uno o varios inmuebles.
- **Tarea nueva:** dentro del proyecto > Tarea. El responsable es obligatorio: un usuario de la app o un **tercero** (escribes su nombre y, si quieres, el teléfono).
- **Avance:** toca el círculo de la tarea para marcarla como hecha, o usa los estados *Pendiente / En curso / Bloqueada / Hecha*.
- **Comentarios y archivos:** en cada tarea, proyecto o inmueble. Desde el celular puedes tomar una foto directamente.
- **Historial:** queda todo, con quién, cuándo y qué cambió (antes y después). Los administradores y la familia lo filtran por persona y fecha, y lo exportan a CSV.

## Si algo falla

| Problema | Solución |
|---|---|
| Olvidé mi clave (usuario) | El administrador entra a Usuarios > 🔒 y genera una clave temporal |
| Olvidé mi clave (administrador) | En la Hoja: *App Inversiones > Generar clave temporal de administrador* |
| «No se pudo conectar con el servidor» o «Falta configurar VITE_API_URL» | Revisa la conexión. Si sigue, verifica que la variable `VITE_API_URL` del repositorio sea la URL de la implementación vigente y vuelve a ejecutar *Actions > Publicar app* |
| Cambié `Code.gs` y no se refleja | Implementar > Gestionar implementaciones > Nueva versión |
| Alguien editó la Hoja a mano | Mi cuenta > Sincronizar ahora (o *App Inversiones > Sincronizar pestañas de reporte*) |

## Seguridad

- Las claves se guardan cifradas (hash con sal única por usuario), nunca en texto.
- Tras 5 intentos fallidos, el correo queda bloqueado 15 minutos.
- La sesión dura 30 días y se renueva sola con el uso. Si desactivas a un usuario o le cambias el rol, su sesión se cierra de inmediato.
- Nada se borra: proyectos, tareas, unidades y adjuntos se **archivan** y se pueden restaurar.
- Los adjuntos quedan en tu Drive privado. La app los entrega a través del script, sin enlaces públicos.

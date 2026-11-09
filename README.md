# App Inversiones Lozano Montoya · Gestión de propiedades

Aplicación web instalable (computador, iPhone y Android) para gestionar los inmuebles de Inversiones Lozano Montoya, sus proyectos y tareas, con usuarios con clave, roles e historial de todo lo que se hace.

## Cómo está armada

```
 Celular / computador                  Google (cuenta del dueño)
┌───────────────────────┐   HTTPS   ┌──────────────────────────────────────────┐
│ App web (GitHub Pages)│ ────────▶ │ Apps Script (Web App)                    │
│ React · instalable    │   token   │  · valida sesión y rol en cada llamada   │
└───────────────────────┘           │  · escribe HISTORIAL en cada cambio      │
                                    │  · oculta valores a quien no puede verlos│
                                    │            │                             │
                                    │            ▼                             │
                                    │ Google Sheet «Inventario_Propiedades…»   │
                                    │  pestañas de la app + reportes 1, 4 y 5  │
                                    │ Drive: carpeta privada de adjuntos       │
                                    └──────────────────────────────────────────┘
```

- **GitHub** guarda el código y publica la app (GitHub Pages).
- **Apps Script** es el backend: está dentro de la misma Hoja de Google.
- **Google Sheet** es la base de datos. Solo el dueño (y máximo una persona más) tiene acceso al archivo. Todos los demás entran solo por la app.

## Carpetas

| Ruta | Qué es |
|---|---|
| `apps-script/Code.gs` | Backend: usuarios, sesiones, roles, proyectos, tareas, historial, adjuntos y sincronización con la Hoja |
| `apps-script/Semilla.gs` | Inventario inicial (7 inmuebles, 28 unidades) con un proyecto por inmueble y 48 tareas iniciales. Lo genera `npm run semilla` (archivos locales, no van a GitHub) |
| `apps-script/appsscript.json` | Zona horaria (Bogotá) y permisos del script |
| `src/` | App web (React + Vite) |
| `public/` | Íconos, manifiesto y service worker de la app instalable |
| `scripts/servidor-local.mjs` | Ejecuta `Code.gs` en tu equipo con una Hoja simulada, para probar sin tocar la real |
| `scripts/probar-backend.mjs` | 36 pruebas automáticas del backend |
| `docs/GUIA_INSTALACION.md` | Puesta en marcha paso a paso |

## Comandos

```bash
npm install            # una sola vez
npm run probar         # pruebas del backend
npm run servidor-local # API de prueba en http://localhost:8787 (imprime la clave del admin)
npm run dev            # app en modo desarrollo (usa VITE_API_URL de .env.local)
git push               # GitHub Actions compila y publica en GitHub Pages
```

## Roles

| Rol | Ve cánones y valores | Edita inventario | Crea y edita proyectos/tareas | Historial completo | Usuarios, tasas, archivar |
|---|---|---|---|---|---|
| Administrador | Sí | Sí | Sí | Sí | Sí |
| Familia | Sí | Sí | Sí | Sí | No |
| Colaborador | No | No | Sí | No (solo el de cada tarea) | No |
| Solo lectura | No | No | No | No (solo el de cada tarea) | No |

Para los roles sin acceso a valores, el servidor no envía cánones, valoraciones, presupuestos ni tasas. Las cifras dentro de textos libres (por ejemplo "1.100.000") se reemplazan por `$•••`.

## Valoración

Igual que el análisis del 27-10-2026: `Valor = canon mensual × 12 ÷ tasa`; bajo y alto con la tasa ± 1 punto. El canon de cada inmueble es la suma del canon actual de sus unidades. Con las tasas por defecto (comercial 7 %, residencial 5,5 %, rural 3 %) da $43.700.000 de canon y $8.859.220.779 de valor. Las pruebas automáticas lo verifican.

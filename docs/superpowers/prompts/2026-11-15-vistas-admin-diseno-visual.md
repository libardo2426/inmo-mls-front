# Prompt — Diseño visual de las vistas del panel (entrada para spec)

- **Fecha:** 2026-11-15
- **Origen:** sesión de diseño visual (marca, paleta, logo y maquetas HTML del panel)
- **Destino:** agente front, que lo lleva al **arquitecto** para que produzca el spec
- **Estado:** pendiente de spec. Nada de esto está aprobado ni implementado.

## Rol y qué se pide

Este documento es **entrada para brainstorming**, no una orden de implementar. El agente front no escribe código: lleva esto al arquitecto, en su sesión, y el arquitecto decide cómo se hace y escribe el spec (y después el plan) de cada fase afectada.

Las maquetas HTML están en `docs/superpowers/design-refs/2026-11-15-vistas-admin/`. Son **referencia visual con datos inventados**, no código a copiar. Hay una guía de marca editable en https://claude.ai/artifact/1SfX4h4skQgfjKaFnAbYue (privada: pedir el contenido al usuario si no se puede abrir) y un brief editable con las mismas preguntas en https://claude.ai/artifact/PkKSPsQbFbU5xcgWG8yr5k.

**Entregable esperado del arquitecto:** una decisión por cada pregunta de la sección 6 y, en cada fase afectada, un spec en `docs/superpowers/specs/YYYY-MM-DD-<tema>-design.md`. Los pedidos nuevos al backend se registran como `B-n` y las dudas como *Pregunta abierta*.

---

## 0. Regla de proceso (obligatoria)

Este proyecto es **spec-driven** (flujo Superpowers: brainstorming → spec → plan → TDD → revisión → verificación).

**No escribas código ni crees archivos de implementación todavía.**

1. Antes de implementar nada, **solicita al arquitecto, en su sesión, cómo se va a hacer**: qué fase del roadmap cubre este diseño, qué decisiones de arquitectura aplican y qué spec y plan se aprueban. El agente front no decide esto por su cuenta.
2. No se planifica sin que el arquitecto apruebe el spec, y no se implementa sin que apruebe el plan.
3. Sin commit, push ni merge sin aprobación.
4. Las preguntas que debes llevarle están en la sección 6.

---

## 1. Qué existe hoy en el repo (verificado leyendo `inmo-mls-front`)

- Stack: React 19, TypeScript strict, Vite, TanStack Router y Query, Tailwind 4, shadcn (Radix), `lucide-react`, Zod, cliente generado desde `docs/backend/openapi.json`.
- Fases hechas: F0 fundación, F1 autenticación, F2 autorización y shell, F3 revisión de agencias, F3.5 sistema visual (ADR-0006).
- Rutas hoy: `/`, `/agencias`, `/agencias/$agencyId` y las de autenticación. El menú (`src/config/navigation.ts`) tiene solo Inicio y Agencias.
- Sistema visual ya definido: tokens semánticos en `src/index.css` (claro y oscuro), Lato 400/700/900, radio 0.75 rem, utilidades `type-page-title`, `type-section-title`, `type-label`, `type-data`, y primitivos en `src/components/shared` (`PageHeader`, `Section`, `DescriptionList`, `StatusBadge`, `DataTable`, estados vacío/error/sin permiso). Test de contraste en `src/test/contrast.test.ts`.
- Reglas ya aprobadas (roadmap y ADR-0004/0006): autorización por **permisos** (`can()` / `<Can>`), nunca por rol; sin colores sueltos en componentes; estados con tono y siempre con texto; densidad alta; modo oscuro desde el día uno; UI en `es-CO`; Zod en toda respuesta; paginación por **cursor**.
- Fuente de verdad del backend: `docs/backend/contexto-para-frontend.md`. No inventes endpoints, campos ni reglas.

El repo **ya adoptó** la paleta de la marca (primary verde ≈ `#3D7A5A`, menú en carbón, fondo gris claro, Lato). El diseño que traigo es coherente con eso; no hay que rehacer el sistema visual, solo ajustarlo.

---

## 2. Fuente visual

| Qué | Dónde |
|---|---|
| Maquetas HTML (abrir en navegador) | `docs/superpowers/design-refs/2026-11-15-vistas-admin/` |
| Guía de uso de marca (logo, paleta, contraste, tipografía) | https://claude.ai/artifact/1SfX4h4skQgfjKaFnAbYue (privada: pide el contenido al usuario si no puedes abrirla) |
| Imagen de referencia de la marca | `docs/superpowers/design-refs/2026-11-15-vistas-admin/ref1.jpg` (anuncio de apartamento) |

### Dirección visual a aplicar

- **Logo:** «m» geométrica sólida con dos puertas en arco cortadas en negativo y un punto como tirador, más el wordmark `inmo-mls` en Lato negrita con el guion en acento. Hoy el menú muestra solo texto (`es.app.name`); hay que incorporar el símbolo. Pide el SVG definitivo al usuario o al arquitecto; el de las maquetas es una aproximación.
- **Paleta (medida de `ref1.jpg`):** verde `#3C7755` (marca), verde profundo `#2D5D42` (botones sobre claro), carbón `#44473F`, base oscura `#2B2E2B`, hoja `#9BB96D` (acento), arena `#DEC9B7`, gris perla `#E2E2E2`, cielo `#95D1FA` (enlaces sobre oscuro).
- **Contraste verificado:** blanco sobre verde `#3C7755` 5.3:1; verde profundo sobre gris perla 5.9:1; hoja sobre base 6.3:1. Prohibido: verde `#3C7755` como texto sobre gris perla (4.1:1) o arena (3.3:1); hoja o cielo como texto sobre fondos claros.
- **Listón:** columna vertical de líneas finas en hoja, como motivo de apoyo, a lo sumo una vez por pantalla.
- **Componentes de la ficha de propiedad** (tomados del anuncio): etiqueta de precio en carbón con texto blanco, recuadro de datos en verde con texto blanco, ubicación en verde profundo.

---

## 3. Vistas: nombre, finalidad y encaje con el backend real

Leyenda: ✅ el backend lo soporta · ⚠️ parcial · 🚫 sin soporte (no construir, solo referencia).

| # | Vista (maqueta) | Finalidad | Fase del roadmap | Viabilidad y qué hacer |
|---|---|---|---|---|
| 01 | **Panel** (`01-panel.html`) | Inicio con indicadores (propiedades, asesores, cierres), gráficos y últimas propiedades | F7 Dashboard | 🚫 No hay endpoints de métricas (B-12). **No construir.** Solo se toma de aquí el patrón de tarjeta de indicador para cuando exista. La ruta `/` sigue como está. |
| 02 | **Propiedades — listado** (`02-propiedades-listado.html`) | Consultar el inventario de la red con filtros, tabla y vista de tarjetas | F5 Inmuebles (solo lectura) | ⚠️ `GET /v1/properties` con filtros, pero **la respuesta no tiene esquema en OpenAPI** (B-11, Zod a mano). Filtros en la URL. Sin búsqueda de texto. Paginación por **cursor** («Cargar más»), no páginas numeradas. Sin contadores por pestaña. Sin acciones masivas. |
| 03 | **Propiedad — detalle** (`03-propiedad-detalle.html`) | Ficha completa: galería, datos, ubicación, asesor, verificación | F5 | ⚠️ Mostrar solo lo que el backend entrega. **El admin MLS no ve `privateTerms`.** Soportes por `GET /v1/documents/{id}/download` (URL firmada, no se guarda). «Terminar encargo» con 2FA y motivo. **Quitar** del diseño lo inventado: vistas, contactos, favoritos, verificación en línea de tiempo, piso, antigüedad, mapa. |
| 04 | **Propiedad — nueva** (`04-propiedad-nueva.html`) | Formulario de alta con ficha en vivo | F10 (portal Inmobiliaria/Agente) | 🚫 El admin MLS solo lee propiedades; alta y edición son de `broker`/`agent`. **No construir ahora.** Se conserva como referencia para F10. |
| 05 | **Asesores** (`05-asesores.html`) | Ver personas de la red y su estado | F4 Miembros | ⚠️ El backend solo expone **miembros por agencia** (`GET /v1/agencies/{agencyId}/members`, sin paginar) y `POST /v1/members/{id}/terminate` (2FA, error `last_broker`). **No existe listado global de asesores, ni aprobar/rechazar asesores, ni métricas de cierres.** Ubicarlo como sección dentro del detalle de agencia. |
| 06 | **Inmobiliarias** (`06-inmobiliarias.html`) | Revisar y administrar inmobiliarias de la red | F3 (ya implementada) | ✅ Es el **código que ya existe** (`/agencias`). Ajustar su aspecto a esta maqueta (ver sección 4). Estados reales: `pending`, `changes_requested`, `active`, `rejected`, `suspended`, `terminated`. **No existen** planes, membresías, vencimientos ni «cierres del mes»: no construirlos. |
| 07 | **Solicitudes** (`07-solicitudes.html`) | Bandeja de consultas de compradores y arrendatarios sobre una propiedad, con seguimiento | — | 🚫 Fuera de alcance: el cliente final está fuera del alcance (roadmap §1) y no hay endpoints de consultas. **Ojo:** en el backend «solicitud» significa **solicitud de agencia**, que ya es F3. **No construir.** Preguntar al arquitecto si el término debe renombrarse. |
| 00 | Portada pública (`00-portada-publica-referencia.html`) | Referencia de marca para un sitio público | — | 🚫 El portal público está fuera de alcance. Solo referencia de logo, paleta y tono. |

**Resumen:** de 8 maquetas, el encaje real hoy es **F3 ajustada** (06), **F5** (02 y 03) y **F4** (05, dentro de la agencia). Las demás quedan como referencia.

---

## 4. Ajustes propuestos sobre el código existente (sujetos a aprobación del arquitecto)

1. **Tokens (`src/index.css`):** evaluar si se añaden `accent` (hoja `#9BB96D`) y una superficie cálida (arena `#DEC9B7`) siguiendo el procedimiento del ADR-0006 («cómo añadir un tono»), con su entrada en `contrast.test.ts` en el mismo cambio, y su par oscuro. No usar hex sueltos en componentes. El `primary` verde actual se mantiene.
2. **Shell (`src/app/shell/AppSidebar.tsx`):** incorporar el símbolo del logo junto al nombre; ítem activo con el acento; cabecera con buscador y usuario como en la maqueta, sin romper el landmark `banner` ni `useSidebarPreference`.
3. **Navegación (`src/config/navigation.ts`):** añadir ítems solo cuando exista su ruta y su permiso (`agency.list`, `property.read`, `member.read`). No añadir ítems para vistas bloqueadas.
4. **Agencias (`src/features/agencies/screens/AgenciesListScreen.tsx` y `AgencyDetailScreen.tsx`):**
   - Pestañas por estado como filtro real (`?status=`), sin contadores (el backend no los da).
   - Opción de vista tabla o tarjetas, si el arquitecto la aprueba.
   - Acciones de revisión (aprobar, devolver, rechazar) con el patrón de diálogo existente: confirmación, motivo 1–2000 y 2FA.
   - Usar `StatusBadge` y un `Record<Estado, Tone>` en la feature, como indica ADR-0006.
5. **Miembros (F4):** sección en el detalle de agencia con tabla de miembros y acción «terminar» condicionada por permiso y estado, manejando `last_broker`.
6. **Inmuebles (F5):** feature nueva `src/features/properties/` con listado, ficha y esquema Zod a mano para los endpoints sin esquema (marcados `B-11`).
7. **Densidad:** las maquetas son más aireadas que lo que pide el roadmap (alta densidad). Prevalece el roadmap.
8. **Modo oscuro:** las maquetas son solo claras. Derivar el tema oscuro con los tokens existentes.

---

## 5. Lo que NO se debe llevar al código

- Datos, cifras, nombres y teléfonos de las maquetas: todos son inventados.
- Planes, membresías, vencimientos, cierres del mes, vistas, contactos, favoritos, rendimiento, aprobación de asesores, bandeja de consultas de clientes, mapa.
- Páginas numeradas y contadores por pestaña (el backend pagina por cursor).
- Comparaciones por rol, tokens en `localStorage`, colores sueltos, `dangerouslySetInnerHTML`.

---

## 6. Preguntas para el arquitecto (llevarlas a su sesión antes de cualquier código)

1. ¿Este diseño entra como **ajuste de F3/F3.5** (agencias), como **nueva fase** o se reparte entre F4 y F5? ¿Cuál es el orden?
2. ¿Se aprueba añadir `accent` (hoja) y una superficie arena a los tokens, o el acento queda solo en el verde actual?
3. Vista de tarjetas en agencias: ¿sí o no? ¿Solo tabla para respetar la densidad alta?
4. «Asesores»: ¿se renombra a **Miembros** y vive dentro del detalle de agencia? ¿Hay pedido `B-n` para un listado global?
5. «Solicitudes»: ¿se descarta, se renombra o se registra como pedido al backend?
6. «Panel»: ¿se mantiene bloqueado hasta B-12, o se hace una portada mínima con datos que sí existen (por ejemplo conteo de agencias por estado vía el listado)?
7. ¿Quién entrega el **SVG definitivo del logo** y dónde se guarda (`public/` o `src/assets`)?
8. Listado y ficha de inmuebles: ¿se espera el esquema de OpenAPI (B-11) o se tipa a mano con Zod y se marca `B-11`?
9. ¿Cuál es el nombre del spec y del plan de esta entrega bajo `docs/superpowers/specs/` y `plans/`, y quién redacta el spec?

---

## 7. Qué debes devolver y las puertas de aprobación

1. Llevar la sección 6 al arquitecto y esperar su respuesta.
2. Con su decisión, ejecutar `superpowers:brainstorming` y producir el **spec** de la fase → **el arquitecto lo aprueba**.
3. Producir el **plan** (`superpowers:writing-plans`) → **el arquitecto lo aprueba**.
4. Solo entonces implementar: rama aislada, TDD, `shadcn` para componentes, `design-taste-frontend` para la dirección visual, revisión con `vercel-react-best-practices` (solo reglas de cliente) y cierre con verificación.
5. Cada pantalla con estados de carga, vacío, error y sin permiso, y acciones sensibles con confirmación, motivo y 2FA cuando el backend lo exija.

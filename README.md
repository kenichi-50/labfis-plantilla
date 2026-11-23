
# LABFIS — Plantilla base para ocho equipos

Aplicación React/Vite con estilo común y navegación a ocho módulos, un ejemplo docente **funcional** de solicitudes de impresión 3D y conexión a PostgreSQL mediante Supabase Auth y RLS.

El módulo de Reservas cuenta con funcionalidades implementadas para consultar la disponibilidad y gestionar reservas de equipos del laboratorio.

## Qué está implementado y qué no

- ✅ Portada + menú de los 8 módulos LABFIS.
- ✅ Ejemplo docente de impresión 3D: insertar y consultar solicitudes en **PostgreSQL** una vez configurado Supabase.
- ✅ Formulario de registro e ingreso de usuarios por correo/contraseña; la confirmación de correo depende de la configuración de Supabase.
- ✅ Políticas RLS para controlar el acceso a los registros según los permisos.
- ✅ El módulo de Reservas está implementado y conectado con PostgreSQL mediante Supabase. Permite consultar disponibilidad, crear, modificar y cancelar reservas, además de consultar el historial.
- ✅ El módulo cuenta con autenticación, autorización de usuarios, gestión de roles y administración de productos y equipos.
- ✅ Los demás módulos conservan su estructura base para el desarrollo de sus respectivos equipos.
  

## Ruta rápida A: StackBlitz (sin instalaciones)

1. Abre el repositorio en GitHub desde la rama `desarrollo`.
2. Importa el repositorio en StackBlitz utilizando `https://stackblitz.com/github/USUARIO/REPOSITORIO`.
3. Deja que StackBlitz instale las dependencias y ejecute el proyecto. Si es necesario, ejecuta `npm run dev`.
4. Deberías ver la portada y los ocho módulos, aun sin Supabase.
5. Configura Supabase según el bloque siguiente. En StackBlitz define las variables de entorno desde su editor o configuración.

## Ruta rápida B: desarrollo local

Requisitos: Node.js compatible con Vite y npm.

Descarga el proyecto desde GitHub o clona la rama de desarrollo:

```bash
git clone -b desarrollo https://github.com/kenichi-50/labfis-plantilla.git
cd labfis-plantilla
```

Instala las dependencias:

```bash
npm install
```

Crea un archivo llamado `.env.local` en la raíz del proyecto, junto a `package.json`, y agrega las variables de Supabase indicadas en la siguiente sección.

Una vez configurado, ejecuta:

```bash
npm run dev
```

Abre la URL local que indique Vite (habitualmente `http://localhost:5173`).

**Nota:** si descargas el proyecto como ZIP, abre una terminal dentro de la carpeta que contiene `package.json` antes de ejecutar los comandos.

## Conectar PostgreSQL en Supabase (docente o responsable del entorno)

1. Entra a https://supabase.com/ y crea un **proyecto de pruebas** o utiliza uno previamente configurado.
2. Para el ejemplo docente de impresión 3D, el archivo `supabase/01_base_demo.sql` contiene su configuración inicial.
3. En **Project Connect / API**, localiza el **Project URL** y la **Publishable key**.
4. Define las variables de entorno en `.env.local`:

```env
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=TU_CLAVE_PUBLICABLE
```

5. Reinicia el servidor si corresponde.
6. Registra una cuenta con correo y contraseña en la aplicación. Si se exige confirmación por correo, confirma antes de iniciar sesión.
7. Ve a **Impresión 3D**. Registra una solicitud y comprueba que aparece en el listado.
8. Abre Supabase **Table Editor → printing_requests** para comprobar que se almacenó en PostgreSQL. Recarga la página y verifica que permanece.

Para utilizar el módulo de Reservas, el proyecto Supabase debe contar con el esquema de reservas y una cuenta autorizada.

Los archivos SQL correspondientes se encuentran en la carpeta `supabase`.

**Importante:** las migraciones del módulo de Reservas ya están instaladas en el proyecto Supabase utilizado durante las pruebas. No deben volver a ejecutarse sobre la misma base de datos.

**Seguridad:** la clave publicable se utiliza en el cliente junto con RLS; nunca pegues `service_role`, `sb_secret_*`, contraseñas de BD ni JWT privados en variables `VITE_*`.

El archivo `.env.local` está excluido de Git y no debe subirse al repositorio.

## Con qué trabaja cada equipo

| Equipo | Módulo | ID en menú |
|---|---|---|
| 1 | Objetos perdidos | `objetos` |
| 2 | Préstamo de equipos | `prestamos` |
| 3 | Reporte de daños | `danos` |
| 4 | Llaves y accesos | `accesos` |
| 5 | Reservas | `reservas` |
| 6 | Apertura y cierre | `apertura` |
| 7 | Inventario QR | `inventario` |
| 8 | Dashboard | `dashboard` |

Para crear un módulo real, **crea un archivo de componente propio** (por ejemplo `src/modules/ObjetosPerdidos.jsx`) y cambia el renderizado condicional en `src/App.jsx`. No alteres módulos de otros equipos. Utiliza el ejemplo de impresión 3D como referencia para conectar con Supabase.

El módulo de Reservas ya cuenta con su implementación funcional.

## HU del ejemplo docente

Como estudiante quiero registrar una solicitud de impresión 3D, indicando descripción, material y cantidad, para gestionar su fabricación.

- CA01: Descripción obligatoria.
- CA02: Cantidad válida, mínimo 1.
- CA03: Registro visible tras guardar y recargar.
- CA04: Estado inicial **Pendiente**.

## Archivos más importantes

- `src/App.jsx`: estructura, menú global e integración de módulos.
- `src/modules/config.js`: nombres, resúmenes e identificación de módulos.
- `src/modules/PrintingDemo.jsx`: ejemplo con formulario, validación y consultas SQL vía Supabase.
- `src/modules/StudentModule.jsx`: plantilla base para equipos.
- `src/modules/Reservas.jsx`: consultas, formularios e historial de reservas.
- `src/modules/reservas.css`: estilos del módulo de Reservas.
- `src/lib/reservasApi.js`: validaciones y operaciones con Supabase.
- `src/lib/supabase.js`: configuración segura del cliente público.
- `src/modules/Reservas.test.jsx`: pruebas del módulo de Reservas.
- `src/lib/reservasApi.test.js`: pruebas de las operaciones de reservas.
- `supabase/01_base_demo.sql`: tabla de ejemplo, restricciones y RLS.
- `supabase/02_reservas.sql`: esquema principal de reservas.
- `supabase/03_reservas_configuracion.sql`: configuración inicial.
- `supabase/04_reservas_pruebas.sql`: pruebas SQL de reservas.
- `supabase/06_panel_administracion.sql`: gestión administrativa, productos y permisos.
- `supabase/07_panel_pruebas.sql`: pruebas del panel administrativo.
- `docs/GUIA_DOCENTE.md`: guion de laboratorio.
- `docs/PROMPT_EQUIPOS.md`: prompt estandarizado de IA.
- `docs/RESERVAS_IMPLEMENTACION.md`: documentación del módulo de Reservas.

## Entrega mínima de un equipo

1. HU y CA implementados y trazables.
2. Pantalla(s) de React navegables.
3. Tabla propia PostgreSQL y reglas RLS.
4. Guardar + consultar desde el navegador, con recarga.
5. Al menos dos pruebas manuales con evidencia.
6. Código en repositorio sin credenciales privadas.

> Este proyecto es un punto de partida académico. Los módulos que aún no tienen funcionalidades implementadas conservan su estructura base para el desarrollo de cada equipo. No usar con información institucional real.

## Módulo de reservas implementado

La opción **Reservas** integra disponibilidad, reservas propias e historial autorizado con Supabase.

Entre sus funcionalidades se encuentran:

- Consultar disponibilidad de equipos por fecha y horario.
- Filtrar equipos por tipo, nombre o código.
- Crear reservas de equipos disponibles.
- Modificar fechas y horarios de reservas activas.
- Cancelar reservas con confirmación.
- Detectar conflictos entre horarios superpuestos.
- Consultar reservas propias e historial general.
- Aplicar filtros al historial de reservas.

Consulta la [guía del módulo](docs/RESERVAS_IMPLEMENTACION.md) para configuración, permisos y pruebas.

## Pruebas del módulo de Reservas

Se realizaron pruebas automatizadas y pruebas funcionales utilizando React y Supabase.

### Pruebas automatizadas

- 39 pruebas exitosas con Vitest, distribuidas en 6 archivos.
- Pruebas de autenticación, reservas, cuentas, permisos e integración.
- Compilación de producción realizada correctamente.

Para ejecutar las pruebas:

```bash
npm test -- --run
```

Para verificar la compilación:

```bash
npm run build
```

### Pruebas funcionales

Se verificaron las siguientes operaciones:

- Inicio y cierre de sesión.
- Consulta de disponibilidad.
- Creación de reservas.
- Modificación de reservas.
- Cancelación de reservas.
- Validación de horarios incorrectos.
- Identificación de conflictos entre horarios.
- Consulta de historial y filtros.
- Persistencia de los datos después de recargar la aplicación.
- Verificación de registros directamente en Supabase Table Editor.

Se comprobó el funcionamiento del módulo de Reservas en el navegador sin errores relevantes de JavaScript o Supabase durante las consultas realizadas.

### Historias de usuario verificadas

**HU-02 — Consultar disponibilidad de equipos**

Se comprobó que el sistema permite consultar equipos por fecha y horario.

- Prueba positiva: el equipo LAB01 apareció disponible para el 24/11/2026 de 10:00 a 11:00.
- Prueba negativa: el equipo apareció no disponible para el 25/11/2026 de 10:30 a 11:30 debido a una reserva activa superpuesta.

**HU-04 — Modificar una reserva**

Se comprobó la modificación de una reserva existente.

- Prueba positiva: se modificó el horario de 10:00–11:00 a 12:00–13:00, conservando el identificador.
- Prueba negativa: el sistema rechazó un horario cuya hora final era anterior a la inicial.
- Persistencia: la modificación se conservó después de recargar la aplicación.

Los criterios de aceptación, casos de prueba y evidencias se encuentran documentados en el informe de pruebas del equipo.

## Base de datos del módulo de Reservas

El módulo utiliza PostgreSQL mediante Supabase.

Las tablas principales son:

- `reservas_usuarios`: usuarios, roles y autorizaciones.
- `reservas_equipos`: equipos y códigos de inventario.
- `reservas_productos`: productos, fechas de disponibilidad y roles permitidos.
- `reservas`: información de las reservas.
- `reservas_auditoria_admin`: registro de operaciones administrativas.

El esquema incluye claves primarias y foráneas, restricciones `CHECK`, permisos `GRANT` y `REVOKE`, políticas RLS y funciones RPC.

Además, se utiliza una restricción de exclusión GiST para impedir reservas activas con horarios superpuestos sobre un mismo equipo.

## Acceso y autorización

El login es una pantalla independiente. Después de iniciar sesión se abre el inicio y sus módulos.

El registro permite solicitar Estudiante o Docente; un responsable valida el rol y autoriza el acceso a Reservas.

La autorización y los permisos se gestionan desde el sistema según el rol asignado a cada usuario.

## Panel administrativo y catálogo

El usuario **admin** puede autorizar cuentas y asignar roles desde Gestión del laboratorio.

Personal y administrador registran productos con cantidades, códigos de inventario, fechas y roles permitidos.

La migración `06_panel_administracion.sql` está instalada en el proyecto Supabase configurado.

Las credenciales administrativas no se almacenan en el repositorio.

## Repositorio y ejecución

Repositorio GitHub:

https://github.com/kenichi-50/labfis-plantilla

Rama de desarrollo:

https://github.com/kenichi-50/labfis-plantilla/tree/desarrollo

La aplicación se ejecuta localmente mediante:

```bash
npm install
npm run dev
```

Es necesario configurar previamente el archivo `.env.local` con las variables públicas de Supabase para utilizar las funcionalidades conectadas a la base de datos.

**Despliegue público:** pendiente de configurar y verificar.

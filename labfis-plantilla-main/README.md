# LABFIS — Plantilla base para ocho equipos

Aplicación React/Vite con estilo común y navegación a ocho módulos, un ejemplo docente **funcional** de solicitudes de impresión 3D y conexión a PostgreSQL mediante Supabase Auth y RLS.

## Qué está implementado y qué no

- ✅ Portada + menú de los 8 módulos LABFIS.
- ✅ Ejemplo docente de impresión 3D: insertar y consultar solicitudes en **PostgreSQL** una vez configurado Supabase.
- ✅ Formulario de registro e ingreso de usuarios por correo/contraseña; la confirmación de correo depende de configuración de Supabase.
- ✅ Políticas RLS que aíslan los registros de cada cuenta.
- ⏳ Los 8 módulos tienen **plantillas de trabajo**, no funcionalidades finales ni tablas propias todavía.
- ⏳ Integración multiusuario por equipos, permisos de personal LABFIS y despliegue: no incluidos.

## Ruta rápida A: StackBlitz (sin instalaciones)

1. Descomprime el ZIP y sube la carpeta **labfis-base** a un repositorio de GitHub. No incluyas `.env.local`.
2. Abre `https://stackblitz.com/github/USUARIO/REPOSITORIO` (reemplaza con tu URL). Si tu repositorio es privado, usa el flujo de importación privada de StackBlitz según tu plan.
3. Deja que StackBlitz instale dependencias y ejecute el proyecto. Si es necesario, ejecuta `npm run dev`.
4. Deberías ver la portada y los ocho módulos, aun sin Supabase.
5. Configura Supabase según el bloque siguiente. En StackBlitz define las variables de entorno desde su editor o configuración.

## Ruta rápida B: desarrollo local

Requisitos: Node.js compatible con Vite y npm.

```bash
npm install
cp .env.example .env.local    # En Windows: copia el archivo manualmente
npm run dev
```

Abre la URL local que indique Vite (habitualmente `http://localhost:5173`).

## Conectar PostgreSQL en Supabase (docente o responsable del entorno)

1. Entra a https://supabase.com/ y crea un **proyecto de pruebas**.
2. Abre **SQL Editor** y ejecuta `supabase/01_base_demo.sql`.
3. En **Project Connect / API**, localiza el **Project URL** y la **Publishable key**.
4. Define las variables de entorno:

```env
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=TU_CLAVE_PUBLICABLE
```

5. Reinicia el servidor si corresponde.
6. Registra una cuenta con correo y contraseña en la aplicación. Si se exige confirmación por correo, confirma antes de iniciar sesión.
7. Ve a **Impresión 3D**. Registra una solicitud y comprueba que aparece en el listado.
8. Abre Supabase **Table Editor → printing_requests** para comprobar que se almacenó en PostgreSQL. Recarga la página y verifica que permanece.

**Seguridad**: la clave publicable se usa en el cliente con RLS; nunca pegues `service_role`, `sb_secret_*`, contraseñas de BD ni JWT privados en variables `VITE_*`.

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

## HU del ejemplo docente

Como estudiante quiero registrar una solicitud de impresión 3D, indicando descripción, material y cantidad, para gestionar su fabricación.

- CA01: Descripción obligatoria.
- CA02: Cantidad válida, mínimo 1.
- CA03: Registro visible tras guardar y recargar.
- CA04: Estado inicial **Pendiente**.

## Archivos más importantes

- `src/App.jsx`: estructura y menú global.
- `src/modules/config.js`: nombres, resúmenes e identificación de módulos.
- `src/modules/PrintingDemo.jsx`: ejemplo con formulario, validación y consultas SQL vía Supabase.
- `src/modules/StudentModule.jsx`: plantilla vacía para equipos.
- `src/lib/supabase.js`: configuración segura del cliente público.
- `supabase/01_base_demo.sql`: tabla de ejemplo, restricciones y RLS.
- `docs/GUIA_DOCENTE.md`: guion de laboratorio.
- `docs/PROMPT_EQUIPOS.md`: prompt estandarizado de IA.

## Entrega mínima de un equipo

1. HU y CA implementados y trazables.
2. Pantalla(s) de React navegables.
3. Tabla propia PostgreSQL y reglas RLS.
4. Guardar + consultar desde el navegador, con recarga.
5. Al menos dos pruebas manuales con evidencia.
6. Código en repositorio sin credenciales privadas.

> Este proyecto es un punto de partida académico. Los módulos están vacíos intencionalmente: deben construirse, probarse e integrarse. No usar con información institucional real.

# Guía docente: laboratorio de LABFIS

## Propósito
Implementar un incremento vertical mínimo (UI + validaciones + PostgreSQL + prueba) en un módulo distinto de los ocho asignados: **solicitudes de impresión 3D**.

## Preparar antes del laboratorio
1. Crear **un proyecto docente de Supabase de pruebas**, no usar bases institucionales.
2. Abrir **SQL Editor** y ejecutar `supabase/01_base_demo.sql`.
3. Revisar **Authentication > Providers > Email**. El correo/contraseña debe estar habilitado; el servicio puede exigir confirmación por correo (por defecto en Supabase alojado). Probar con una cuenta propia antes de clase.
4. Crear un repositorio GitHub de la plantilla (sin `.env.local`). Abrirlo desde StackBlitz.
5. Agregar variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` en StackBlitz. **Nunca usar service_role, secret key o contraseña de Postgres en frontend**.
6. Confirmar con una cuenta de prueba que el formulario guarda y el listado recupera la solicitud.

## Secuencia orientativa (sin imponer duración)
1. Mostrar la portada con los ocho módulos y el módulo independiente de impresión 3D.
2. Relacionar HU + CA con los campos y las comprobaciones del formulario.
3. Demostrar un registro inválido y uno válido.
4. Abrir Supabase Table Editor y evidenciar el registro. Volver al navegador y recargar para mostrar persistencia.
5. Abrir código `src/modules/PrintingDemo.jsx`; localizar INSERT, SELECT y validaciones.
6. Cada equipo abre `src/modules/StudentModule.jsx`, selecciona una HU y pide a su IA una implementación **pequeña** con la misma arquitectura.
7. Comprobar al menos un CA usando pruebas manuales y registrar los resultados en un README.

## Importante para el Sprint
- La plantilla es **una sola aplicación** con ocho espacios de módulos. No se deben crear ocho proyectos arquitectónicamente distintos.
- Los ocho módulos están **deliberadamente sin implementar**: cada equipo debe construirlos según sus HU.
- La tabla `printing_requests` sólo es docente; no corresponde a ningún módulo asignado.
- Cada cuenta consulta sus propios registros gracias a RLS. El esquema de usuarios, equipos y permisos compartidos para el sistema final es una tarea de arquitectura posterior.
- No usar datos reales de estudiantes ni personal.
- La plantilla **no incluye despliegue**, pruebas automatizadas ni autenticación por roles institucionales. No equivale a un producto listo para producción.

## Plan alterno sin Supabase
La interfaz puede abrirse sin credenciales, pero el botón Guardar queda deshabilitado. Si la BD falla, se puede inspeccionar el código y hacer la validación visual; **no debe calificarse como persistencia real**.

## Criterios rápidos de revisión
- HU/CA coherentes con la implementación.
- Se demuestra una validación negativa.
- Se guarda un registro en PostgreSQL y se consulta tras recargar.
- Código versionado en GitHub sin credenciales secretas.
- El estudiante explica cómo funciona, incluso si lo generó una IA.

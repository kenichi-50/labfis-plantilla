> Actualización: cuentas y productos se gestionan desde **Gestión del laboratorio**. Los cuatro roles pueden reservar según el permiso de cada producto. La migración 06 ya está instalada; consulta [el panel administrativo](PANEL_ADMINISTRACION.md) para el flujo vigente. Las instrucciones SQL de provisión de este documento describen la etapa inicial.
# Módulo de reservas SIGELAB

Implementado en la aplicación activa `C:\Criowl\lab_fis`, opción **Reservas** del menú (módulo 05). Utiliza el cliente existente de Supabase y las RPC del esquema de reservas. Las demás opciones conservan sus componentes.

## Uso

1. Ejecutar `npm install` y `npm run dev` desde la raíz del proyecto.
2. Abrir la URL de Vite, iniciar sesión y entrar a **Reservas**.
3. Una cuenta autorizada como ESTUDIANTE o DOCENTE puede consultar disponibilidad, reservar un equipo, ver sus reservas, modificar el período y cancelar con confirmación.
4. Una cuenta autorizada como PERSONAL o ADMINISTRADOR ve disponibilidad e historial general con filtros por equipo, solicitante, fechas y estado, y páginas de diez registros.

Si aparece **Cuenta pendiente de autorización**, el responsable debe registrar o habilitar la cuenta en `reservas_usuarios` usando `supabase/03_reservas_configuracion.sql`. No se asignan privilegios desde el navegador ni desde los metadatos editables del registro. El catálogo se carga desde `reservas_equipos`; el módulo no inventa equipos ni crea registros de demostración en Supabase.

## Conexión y esquema

El `.env` debe estar junto a `package.json`, en la raíz activa, con `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`. Está excluido de Git. Nunca usar claves secretas o service_role en Vite.

En esta implementación se verificó que el Supabase configurado reconoce `reservas_usuarios`, `reservas_equipos`, `reservas`, `reservas_disponibilidad` y `reservas_consultar` y rechaza peticiones anónimas con 42501. Esto comprueba que existen los recursos protegidos, no que una cuenta concreta tenga autorización.

El esquema completo está en `supabase/02_reservas.sql`: ejecutar una sola vez en una base nueva. **No volver a ejecutarlo sobre el esquema ya creado.** La configuración administrativa está en `03_reservas_configuracion.sql`. Las pruebas SQL opcionales de aceptación están en `04_reservas_pruebas.sql` y terminan en ROLLBACK.

Supabase utiliza PostgreSQL; el requisito de concurrencia de HU-05 se implementa mediante una restricción de exclusión GiST sobre equipo y rango horario, dentro de la transacción de cada llamada. No se utiliza MySQL.

## Historias implementadas

| Historia | Implementación |
| --- | --- |
| HU-01 | Equipo individual, fecha, hora inicial/final, actividad obligatoria, diálogo de confirmación, comprobación definitiva en PostgreSQL y confirmación con identificador/equipo/período/estado. |
| HU-02 | Consulta por fecha/horas, filtro por tipo, búsqueda por nombre/código, estados disponible/ocupado/no habilitado y mensajes distintos para resultados vacíos y fallo de servicio. Cambiar criterios invalida resultados anteriores. |
| HU-03 | Listado propio, selección de reserva activa, confirmación previa y cancelación conservando el registro. La RPC comprueba la propiedad con auth.uid(). |
| HU-04 | Cambio de fecha/horas manteniendo identificador. Si hay conflicto se muestra el error, se actualiza el listado y se conserva el período original. |
| HU-05 | Las RPC usan la restricción de exclusión del esquema existente para impedir solapamientos, incluso concurrentes; canceladas no bloquean. |
| HU-06 | Historial exclusivo de personal autorizado, nombre y rol del solicitante, equipo, identificador, período, estado, filtros y paginación. |

Fechas y horarios se presentan en America/Guayaquil; las llamadas envían zona -05:00 explícita. Los intervalos son [inicio, fin): una reserva que termina a las 10:00 permite otra desde las 10:00. Las reglas no especifican horario de atención, duración máxima ni prohibición de fechas pasadas y no se han agregado esas restricciones.

## Archivos

- `src/modules/Reservas.jsx`: pantalla, consultas, formularios, diálogos, filtros y paginación.
- `src/modules/reservas.css`: estilos adaptables específicos del módulo.
- `src/lib/reservasApi.js`: validación temporal, roles, mensajes y llamadas RPC; las mutaciones descartan parámetros de propietario/rol/estado.
- `src/App.jsx`: integración y reinicio del estado del módulo al cambiar de cuenta para evitar mostrar datos de la sesión anterior.
- `src/modules/Reservas.test.jsx` y `src/lib/reservasApi.test.js`: pruebas de interacción y contrato.

## Validación

`npm test`: 16 pruebas correctas con Vitest/Testing Library y respuestas de Supabase simuladas. Incluyen autorizaciones, creación, cancelación confirmada, modificación, conflictos, consultas con filtros, respuestas tardías, fallos de red y paginación.

`npm run build`: compilación de producción correcta. Vite sirve el componente nuevo sin errores de transformación. Entorno verificado: Node.js 24.

Las comprobaciones remotas realizadas no crean ni modifican reservas. Falta una prueba de persistencia de extremo a extremo con una sesión real autorizada; las pruebas automatizadas del frontend no sustituyen esa comprobación.

### Prueba manual con cuenta autorizada

1. Seleccionar un equipo disponible, completar actividad y confirmar. Comprobar identificador y estado ACTIVA.
2. Ir a Mis reservas y recargar la página: el registro debe persistir.
3. Desde otra cuenta autorizada intentar un período superpuesto: debe fallar sin insertar otra reserva.
4. Modificar a un período libre y verificar que mantiene el identificador. Intentar un período ocupado y verificar que mantiene el horario anterior.
5. Abrir Cancelar y pulsar Volver: no debe cambiar nada. Repetir y confirmar: debe quedar CANCELADA y liberar disponibilidad.
6. Con PERSONAL/ADMINISTRADOR consultar historial, aplicar filtros y cambiar páginas cuando haya más de diez resultados. Con ESTUDIANTE/DOCENTE no debe aparecer el historial general.
7. Si no aparecen equipos, cargar el inventario real desde SQL administrativo; si falta autorización, habilitar la cuenta con 03_reservas_configuracion.sql.

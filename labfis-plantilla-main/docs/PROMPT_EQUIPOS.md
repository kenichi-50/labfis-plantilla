# Prompt para usar con ChatGPT, Claude o Gemini

Actúa como tutor y desarrollador React. Estamos construyendo **un único sistema modular LABFIS**. No crees una aplicación nueva, no cambies React + Vite, no modifiques componentes ajenos y no inventes funcionalidades no justificadas.

Tengo esta estructura de código: `src/App.jsx`, `src/modules/config.js`, `src/modules/StudentModule.jsx` y `src/modules/PrintingDemo.jsx` (ejemplo de referencia).

Mi módulo es: [NOMBRE]
Mi HU es: [PEGAR HU]
Mis CA son: [PEGAR CA]
Mis casos de prueba son: [PEGAR PRUEBAS]
Mi prototipo contiene: [DESCRIPCIÓN O IMAGEN]

**Tareas**:
1. Sugiere el **componente propio** para mi módulo en `src/modules/<NombreDelModulo>.jsx`, manteniendo menú y estilos comunes.
2. Genera SQL para una tabla **específica de mi módulo** con claves y restricciones justificadas por los requisitos. Aplica RLS, evita lecturas y escrituras públicas y limita registros por usuario autenticado hasta que tengamos un modelo de permisos por equipos.
3. Genera las funciones React para insertar y consultar datos usando el cliente `src/lib/supabase.js`; no incluyas claves secretas en el frontend.
4. Agrega validaciones acordes con los CA, mensajes de error/éxito y estados de carga.
5. Explica qué archivo debo crear o modificar y los pasos de integración en `App.jsx`, con código copiable.
6. Proporciona pruebas manuales: caso válido, caso inválido y verificación de persistencia en PostgreSQL.
7. No afirmes que el código se ejecutó o que las pruebas pasaron si no se verificaron realmente.

Primero proponme el esquema mínimo y la estructura de archivos. Luego genera la solución paso a paso, sin implementar funcionalidades fuera de la HU priorizada.

export const modules = [
  {id:'objetos', number:'01', name:'Objetos perdidos', icon:'package-search', summary:'Registro, custodia y devolución de objetos encontrados.', fields:['Descripción','Lugar','Fecha','Estado']},
  {id:'prestamos', number:'02', name:'Préstamo de equipos', icon:'laptop', summary:'Solicitudes, entregas y devoluciones de equipos.', fields:['Equipo','Solicitante','Fecha','Estado']},
  {id:'danos', number:'03', name:'Reporte de daños', icon:'wrench', summary:'Incidentes y seguimiento de recursos del laboratorio.', fields:['Equipo o aula','Descripción','Prioridad','Estado']},
  {id:'accesos', number:'04', name:'Llaves y accesos', icon:'key-round', summary:'Registro de autorizaciones, entregas y retornos.', fields:['Persona','Recurso','Fecha','Estado']},
  {id:'reservas', number:'05', name:'Reservas', icon:'calendar-days', summary:'Disponibilidad y solicitud de espacios o equipos.', fields:['Recurso','Fecha','Hora','Estado']},
  {id:'apertura', number:'06', name:'Apertura y cierre', icon:'door-open', summary:'Registro y verificación de aperturas y cierres.', fields:['Laboratorio','Responsable','Fecha','Acción']},
  {id:'inventario', number:'07', name:'Inventario QR', icon:'qr-code', summary:'Inventario, consulta y códigos QR de activos.', fields:['Código','Descripción','Ubicación','Estado']},
  {id:'dashboard', number:'08', name:'Dashboard', icon:'chart-column', summary:'Indicadores e información para la toma de decisiones.', fields:['Indicador','Fuente','Período','Resultado']},
]

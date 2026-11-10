# Posición de lectura al volver

Cada entrada del historial tiene una posición propia. Abrir una URL nueva empieza arriba (o en su sección enlazada); Atrás, Adelante y el enlace Volver recuperan la posición anterior de forma instantánea, antes de mostrar el contenido.

El catálogo conserva página, categoría, búsqueda, rango de precio y orden. Cuando volver requiere cargar datos, la página se revela después de restaurar su posición, evitando mostrar primero el inicio. Las imágenes conservan sus dimensiones reservadas para reducir cambios de altura durante la carga.

Se conserva el historial nativo del navegador; no se añaden dependencias ni servicios. Un límite de espera evita dejar una página oculta indefinidamente si hay un fallo de carga. La posición se ajusta al contenido disponible si este cambió o se eliminó. No se persisten archivos locales subidos ni formularios completos al abandonar sus páginas.

Pruebas de navegador: Volver desde una ficha, Atrás/Adelante, orden del catálogo, categoría con respuesta retrasada y registro del primer cuadro visible de páginas legales. Las páginas nuevas mantienen su inicio arriba, sin animación.

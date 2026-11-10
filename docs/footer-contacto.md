# Footer e información de Mundo 3D

El footer usa las categorías activas del mismo endpoint del catálogo y enlaza mediante `/?categoria=…#catalogo`. El enlace funciona al abrirlo directamente, recargarlo o abrirlo en otra pestaña. Las pestañas del catálogo y los enlaces del footer utilizan el mismo cambio de categoría; al elegirla se limpia la búsqueda y se vuelve a la primera página.

El contacto está en un elemento `<address>` con correo y teléfono acompañados por sus iconos. Las etiquetas textuales se conservan para lectores de pantalla. El acceso a WhatsApp está en el botón flotante. Los datos se centralizan en `apps/web/src/site-content.js`.

Para publicar las redes reales, definir `VITE_INSTAGRAM_URL` y `VITE_FACEBOOK_URL` al compilar el frontend, o actualizar sus valores predeterminados en ese archivo. Solo se muestran URLs HTTPS de instagram.com y facebook.com, sin credenciales. No se muestran enlaces vacíos ni cuentas supuestas. Las variables VITE son públicas, nunca deben contener secretos.

`/sobre-nosotros` y `/preguntas-frecuentes` son rutas públicas y admiten acceso directo y navegación atrás/adelante. El menú principal y el menú de hamburguesa comparten el enlace “Sobre nosotros”. El footer incluye tres respuestas desplegables y un enlace a la página con todas las preguntas. Los textos describen el flujo actual de solicitudes; no prometen medios de pago, envíos o plazos fijos sin confirmar.

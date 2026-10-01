# 1. Autenticación vs Autorización: Los Cimientos

En desarrollo de software, confundir **Autenticación** con **Autorización** es uno de los errores conceptuales más comunes. Son dos fases distintas de la seguridad.

---

## 🔑 Autenticación (Authentication - ¿Quién sos?)

La **autenticación** es el proceso de verificar la identidad de un usuario. Es la "puerta de entrada".

- **Ejemplo de la vida real:** Mostrar tu documento de identidad (DNI o pasaporte) en la entrada de un edificio.
- **Ejemplo en código:** Cuando el usuario envía su `email` y `password` en el formulario de login y el servidor comprueba que la contraseña sea correcta usando `bcrypt.compare()`.

---

## 🛡️ Autorización (Authorization - ¿Qué tenés permitido hacer?)

La **autorización** es el proceso de verificar si un usuario autenticado tiene permiso para realizar una acción específica o ver un recurso.

- **Ejemplo de la vida real:** El documento demuestra quién sos, pero ¿tenés la llave de la oficina del director?
- **Ejemplo en código:** Un alumno autenticado intenta ingresar a `/admin/configuracion`. El servidor revisa su rol y le responde un código HTTP `403 Forbidden` (Acceso Denegado).

---

## 📊 Cuadro Comparativo Rápido

| Criterio | Autenticación | Autorización |
| :--- | :--- | :--- |
| **Pregunta clave** | ¿Quién sos? | ¿Qué podés hacer? |
| **Momento** | Sucede primero (al iniciar sesión). | Sucede en cada petición a un recurso protegido. |
| **Mecanismo habitual** | Credenciales (email/password), OAuth, Biometría. | Roles (RBAC), Permisos, Scopes. |
| **Código HTTP de error** | `401 Unauthorized` (Sin sesión o credencial inválida). | `403 Forbidden` (Autenticado pero sin permiso). |

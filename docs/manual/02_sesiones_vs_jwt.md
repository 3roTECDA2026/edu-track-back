# 2. Modelos de Autenticación: Sesiones vs JWT

Una vez que el usuario demuestra quién es, el servidor necesita recordarlo en las siguientes peticiones. Al ser HTTP un protocolo sin estado (*stateless*), existen dos formas principales de resolverlo.

---

## 🍪 A. Sesiones Tradicionales (Stateful / Cookies)

El servidor guarda una lista de sesiones activas en su propia memoria o base de datos.

1. El usuario se loguea.
2. El servidor genera un ID de sesión ramdom (ej. `sess_12345`) y lo guarda en su memoria RAM o Redis.
3. Le envía al navegador una **Cookie** con ese ID.
4. En cada petición, el navegador adjunta automáticamente la cookie.

### ⚠️ El problema al escalar:
Si tenés 3 servidores backend corriendo en paralelo para soportar más usuarios, la sesión guardada en la RAM del Servidor A no existe en el Servidor B. Necesitás configurar bases de datos compartidas (Redis) o "sticky sessions".

---

## 🪙 B. Tokens Firmados JWT (Stateless / Bearer Token)

En lugar de guardar datos en el servidor, le entregamos al cliente un pasaporte firmado digitalmente (**JSON Web Token**).

1. El usuario se loguea.
2. El servidor valida las credenciales y crea un objeto JSON con sus datos mínimos:
   ```json
   {
     "usuario_id": 42,
     "rol_id": 1,
     "exp": 1759363200
   }
   ```
3. El servidor firma ese JSON usando una clave secreta (`JWT_SECRET`) y genera el token.
4. El cliente guarda el token y lo envía en el encabezado de cada petición:
   `Authorization: Bearer <token>`

### 🚀 Por qué es mejor para APIs y React:
- **Cero memoria en servidor:** Cualquier servidor backend puede verificar la firma matemática con el `JWT_SECRET` sin hacer consultas a la base de datos.
- **Desacoplado:** Funciona perfecto si tu frontend React está hosteado en un dominio o puerto distinto (evita problemas de cookies CORS).

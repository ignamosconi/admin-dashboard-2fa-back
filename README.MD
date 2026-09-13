# Dashboard de Administrador con 2FA - Backend

API REST construida con **NestJS** que provee autenticación segura para administradores con soporte de doble factor (TOTP).

## Front-end
El front-end de este proyecto puede encontrarse a través del siguiente enlace:
- https://github.com/ignamosconi/admin-dashboard-2fa-front


## Funcionalidades principales

- **Gestión de administradores** - CRUD completo: crear, listar, actualizar y eliminar admins.
- **Autenticación con 2FA obligatorio** - Flujo en dos pasos: credenciales → TOTP. El primer login genera un QR para vincular un autenticador (Google Authenticator, Authy, etc.). Los logins posteriores validan el código TOTP directamente.
- **Tokens JWT con rotación de refresh tokens** - Access token de corta duración + refresh token rotativo con detección de reutilización. Si se detecta reutilización, se revoca toda la familia de tokens.
- **Challenges pendientes en Redis** - El estado intermedio del flujo 2FA (entre credenciales y TOTP) se almacena en Redis con TTL configurable y límite de intentos fallidos.
- **Cifrado AES-256-GCM para secrets TOTP** - Los secrets TOTP nunca se guardan en texto plano; se cifran con una clave de 32 bytes antes de persistirse en la base de datos.
- **Passwords hasheadas con bcrypt** - Las contraseñas de administradores nunca se almacenan en claro.
- **Reset de 2FA autenticado** - Un admin puede resetear su autenticador confirmando su contraseña actual. El próximo login solicitará vincular un nuevo QR.
- **Migraciones con TypeORM** - Esquema versionado. La base de datos se inicializa y actualiza automáticamente al levantar la aplicación.
- **Seeder de admin inicial** - En entorno `development`, si no existe ningún admin, se crea uno automáticamente con las credenciales definidas en `.env`.
- **Documentación Swagger** - Disponible en `/api/docs`, protegida con usuario y contraseña configurables.
- **Rate limiting** - Throttling global para mitigar fuerza bruta.

## Stack

| Tecnología | Uso |
|---|---|
| NestJS | Framework principal |
| TypeORM + PostgreSQL | Persistencia |
| Redis | Challenges 2FA pendientes |
| JWT (`@nestjs/jwt`) | Access y refresh tokens |
| bcrypt | Hash de contraseñas |
| otplib | Generación y validación TOTP |
| qrcode | Generación de QR para setup 2FA |
| AES-256-GCM (crypto nativo) | Cifrado de secrets TOTP |

## Estructura

```
src
 ├── admin/              # CRUD de administradores
 ├── admin-auth/         # Login, 2FA setup/confirm/validate/reset, refresh, logout
 ├── refresh-token/      # Persistencia y rotación de refresh tokens
 ├── redis/              # Módulo de conexión a Redis
 └── database/
      ├── migrations/    # Migraciones TypeORM
      └── seeders/       # Seeder del admin inicial
```

## Variables de entorno

Copiá `.env.example` a `.env` y completá los valores:

```bash
cp .env.example .env
```

| Variable | Descripción |
|---|---|
| `NODE_ENV` | `development` habilita el seeder |
| `PORT` | Puerto del servidor |
| `ADMIN_PANEL_URL` | URL del frontend (CORS) |
| `DB_*` | Conexión PostgreSQL |
| `JWT_ADMIN_ACCESS_SECRET` | Secret para access tokens de admins |
| `JWT_ADMIN_REFRESH_SECRET` | Secret para refresh tokens de admins |
| `JWT_ADMIN_ACCESS_EXPIRES_IN` | Duración del access token (ej: `15m`) |
| `JWT_ADMIN_REFRESH_EXPIRES_IN` | Duración del refresh token (ej: `1d`) |
| `TOTP_ENCRYPTION_KEY` | Clave hex de 64 chars para cifrar secrets TOTP |
| `REDIS_HOST / REDIS_PORT / REDIS_PASSWORD` | Conexión Redis |
| `PENDING_2FA_TTL_MS` | TTL del challenge pendiente en ms |
| `PENDING_2FA_MAX_ATTEMPTS` | Intentos TOTP antes de invalidar el challenge |
| `ADMIN_USERNAME_SEEDER` | Usuario del admin inicial (solo en development) |
| `ADMIN_PASSWORD_SEEDER` | Contraseña del admin inicial (solo en development) |
| `SWAGGER_USER / SWAGGER_PASSWORD` | Credenciales para acceder a `/api/docs` |

Generá claves seguras con:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Instalación y ejecución

```bash
npm install
npm run start:dev   # desarrollo con watch
npm run start:prod  # producción
```

Las migraciones corren automáticamente al iniciar la aplicación.

## Flujo de autenticación

```
POST /admin/auth/login
  → { pending_token, requires_2fa_setup }

# Primera vez (requires_2fa_setup: true):
POST /admin/auth/2fa/setup    { pending_token }
  → { qrCodeDataUrl, manualEntrySecret, confirm_pending_token }
POST /admin/auth/2fa/confirm  { pending_token: confirm_pending_token, totp_code }
  → { access_token, refresh_token }

# Logins posteriores:
POST /admin/auth/2fa/validate { pending_token, totp_code }
  → { access_token, refresh_token }

# Renovar sesión:
POST /admin/auth/refresh  { refresh_token }
  → { access_token, refresh_token }

# Cerrar sesión:
POST /admin/auth/logout   { refresh_token }
```
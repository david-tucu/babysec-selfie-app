# babysec-selfie

Webapp tipo photobooth de video selfie para eventos.

## Requisitos

- PHP 8+ con servidor web (Apache/Nginx) o `php -S`
- Navegador moderno con soporte de MediaRecorder y getUserMedia
- HTTPS recomendado en producción (requerido para cámara en muchos dispositivos)

## Ejecutar en local

```bash
cd babysec
php -S localhost:8080
```

Abrir `http://localhost:8080/index.php`

> Nota: `getUserMedia` puede requerir `https://` o `localhost` según el navegador.

## Estructura

```
index.php          → Landing HTML
css/style.css      → Estilos mobile-first
js/                → Módulos ES6
  app.js           → Orquestador
  StateManager.js  → Máquina de estados
  Camera.js        → getUserMedia
  Renderer.js      → Canvas 1080×1920
  Recorder.js      → MediaRecorder + timestamps
  Preview.js       → Blob preview
  Uploader.js      → fetch + FormData
  UI.js            → Único módulo que toca el DOM
  Utils.js         → Helpers
assets/            → logo.png, marco.png
api/upload.php     → Backend PHP
uploads/videos/    → Videos guardados
```

## Estados

`LANDING → REGISTRATION → CAMERA → COUNTDOWN → RECORDING → PREVIEW → UPLOADING → FINISHED`

Errores transicionan a `ERROR`.

## Registro de usuarios

Al pulsar **Comenzar**, el usuario ingresa nombre, apellido y correo. Esos datos se envían junto al video y se guardan en:

- `uploads/videos/{video}.meta.json` — metadata por video
- `uploads/registry.json` — registro central (útil para panel admin)

## Pantalla final

Tras enviar el video, el usuario puede **descargar** o **publicar en redes** (Web Share API en móvil). No hay opción de grabar un nuevo video.

## Personalización

Reemplaza `assets/logo.png` y `assets/marco.png` con los gráficos de tu evento.
El marco debe ser PNG transparente en proporción 9:16 (1080×1920 recomendado).

## Panel Admin

Acceso: `http://localhost:8080/admin/`

Credenciales por defecto (cambiar en producción):

| Campo | Valor |
|---|---|
| Usuario | `admin` |
| Contraseña | `booth2026` |

Copiá `admin/config.example.php` como `admin/config.php` y generá un nuevo hash:

```bash
php -r "echo hash('sha256', 'TU_PASSWORD' . 'TU_SALT');"
```

Funciones del panel:

- Ver todos los registros (nombre, apellido, email, fecha, archivo)
- Buscar por nombre, apellido o email
- Ver y descargar videos
- Exportar registros visibles a CSV

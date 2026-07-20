<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="theme-color" content="#23135f">
  <link rel="icon" href="assets/icons/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="assets/icons/favicon-32x32.png">

  <title>babysec-selfie</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <div id="app" class="app">

    <!-- PORTADA -->
    <section id="screen-landing" class="screen screen--landing screen--landing-cover">
      <div id="landing" class="landing" aria-label="Portada">
        <div id="landing-stage" class="landing__stage">
          <img class="landing__bg" src="assets/fondo.png" alt="" decoding="async">

          <div class="landing__pin" style="--x: 540; --y: 290">
            <img class="landing__art landing__art--1" src="assets/p1_1.png" alt="" decoding="async">
          </div>
          <div class="landing__pin" style="--x: 540; --y: 540">
            <img class="landing__art landing__art--2" src="assets/p1_2.png" alt="" decoding="async">
          </div>
          <div class="landing__pin" style="--x: 540; --y: 920">
            <img class="landing__art landing__art--3" src="assets/p1_3.png" alt="" decoding="async">
          </div>
          <div class="landing__pin" style="--x: 540; --y: 1330">
            <img class="landing__art landing__art--4" src="assets/p1_4.png" alt="" decoding="async">
          </div>
          <div class="landing__pin landing__pin--cta" style="--x: 540; --y: 1590">
            <button id="btn-start" type="button" class="btn btn--primary btn--large landing__cta">
              COMENZAR
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- FORMULARIO -->
    <section id="screen-registration" class="screen screen--registration hidden">
      <div class="screen__content screen__content--scroll">
        <button id="btn-back-home" type="button" class="registration-back" aria-label="Volver al inicio">
          <span class="registration-back__icon" aria-hidden="true">←</span>
        </button>

        <img src="assets/logo.png" alt="Logo del evento" class="brand-logo">
        <h1 class="title" style="display: none;">babysec-selfie</h1>
        <p class="subtitle">Completá tus datos para participar.</p>

        <form id="registration-form" class="registration-form" novalidate>
          <div class="form-field">
            <label for="input-nombre" class="form-label">Nombre</label>
            <input value="DAV" id="input-nombre" name="nombre" type="text" class="form-input form-input--uppercase" autocomplete="given-name" autocapitalize="characters" placeholder="Tu nombre" required>
            <span id="error-nombre" class="form-error hidden"></span>
          </div>

          <div class="form-field">
            <label for="input-apellido" class="form-label">Apellido</label>
            <input value="BED" id="input-apellido" name="apellido" type="text" class="form-input form-input--uppercase" autocomplete="family-name" autocapitalize="characters" placeholder="Tu apellido" required>
            <span id="error-apellido" class="form-error hidden"></span>
          </div>

          <div class="form-field">
            <label for="input-localidad" class="form-label">Localidad</label>
            <input id="input-localidad" name="localidad" type="text" class="form-input form-input--uppercase" autocomplete="address-level2" autocapitalize="characters" placeholder="Tu localidad" required>
            <span id="error-localidad" class="form-error hidden"></span>
          </div>

          <div class="form-field">
            <label for="input-email" class="form-label">Correo electrónico</label>
            <input value="dav@bed.com" id="input-email" name="email" type="email" class="form-input" autocomplete="email" placeholder="tu@email.com" inputmode="email" required>
            <span id="error-email" class="form-error hidden"></span>
          </div>

          <button id="btn-continue" type="submit" class="btn btn--primary btn--large">
            Continuar a la cámara
          </button>
        </form>
      </div>
    </section>

    <!-- CÁMARA / GRABACIÓN -->
    <section id="screen-camera" class="screen screen--camera hidden">
      <div id="canvas-container" class="canvas-container" aria-label="Vista previa en vivo"></div>

      <div id="countdown-display" class="countdown-display hidden" aria-live="polite"></div>
      <div id="rec-display" class="rec-display hidden" aria-live="polite">
        <span class="rec-dot"></span> REC
      </div>

      <div class="camera-controls">
        <button id="btn-record" type="button" class="btn btn--record" aria-label="Grabar video">
          <span class="btn--record__inner"></span>
        </button>
        <button id="btn-stop" type="button" class="btn btn--stop hidden" aria-label="Detener grabación">
          <span class="btn--stop__inner"></span>
        </button>
      </div>
    </section>

    <!-- PREVIEW -->
    <section id="screen-preview" class="screen screen--preview hidden">
      <video id="preview-video" class="preview-video" playsinline controls></video>

      <div class="preview-controls">
        <button id="btn-retry" type="button" class="btn btn--secondary">Volver a grabar</button>
        <button id="btn-send" type="button" class="btn btn--primary">Enviar video</button>
      </div>

      <div id="upload-overlay" class="upload-overlay hidden">
        <div class="upload-overlay__box">
          <div class="spinner"></div>
          <p id="upload-message">Subiendo video...</p>
          <div
            id="upload-progress"
            class="upload-progress"
            role="progressbar"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow="0"
          >
            <div id="upload-progress-bar" class="upload-progress__bar"></div>
          </div>
        </div>
      </div>
    </section>

    <!-- FINALIZADO -->
    <section id="screen-finished" class="screen screen--finished hidden">
      <div class="screen__content">
        <div class="success-icon">✓</div>
        <h2 class="title title--sm">¡Listo!</h2>
        <p id="finished-message" class="subtitle">Tu video fue guardado correctamente.</p>

        <div class="finished-actions">
          <button id="btn-download" type="button" class="btn btn--primary btn--large">Descargar video</button>
          <button id="btn-share" type="button" class="btn btn--secondary btn--large">Publicar en redes</button>
        </div>
        <p id="share-hint" class="share-hint hidden">
          En este dispositivo podés descargar el video y subirlo manualmente a Instagram, TikTok o WhatsApp.
        </p>
      </div>
    </section>

    <!-- ERROR -->
    <section id="screen-error" class="screen screen--error hidden">
      <div class="screen__content">
        <div class="error-icon">!</div>
        <h2 class="title title--sm">Algo salió mal</h2>
        <p id="error-message" class="subtitle">Ocurrió un error inesperado.</p>
        <button id="btn-error-retry" type="button" class="btn btn--primary">Reintentar</button>
      </div>
    </section>

  </div>

  <!-- ts-ebml (UMD): remux WebM seekable para players nativos Android -->
  <script src="js/vendor/EBML.js"></script>
  <script type="module" src="js/app.js"></script>
</body>
</html>

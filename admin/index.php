<?php

declare(strict_types=1);

require_once __DIR__ . '/includes/auth.php';
require_once dirname(__DIR__) . '/includes/assets.php';
requireAdmin();
send_demo_cache_headers();

$registrations = loadRegistrations();
$orphanVideos = loadOrphanVideos($registrations);
$today = (new DateTimeImmutable('today', appTimezone()))->format('Y-m-d');
$todayCount = 0;
$uploadedCount = 0;

foreach ($registrations as $entry) {
    $createdDay = formatDateDay((string) ($entry['created_at'] ?? ''));
    if ($createdDay === $today) {
        $todayCount++;
    }
    if (($entry['estado'] ?? '') === 'uploaded') {
        $uploadedCount++;
    }
}

$totalCount = count($registrations);
$orphanCount = count($orphanVideos);

// Asegura conexión resuelta para mostrar ruta/aviso de riesgo FTP.
try {
    Database::connection();
} catch (Throwable) {
    // El listado ya maneja DB vacía/rota; el aviso se omite si no hay path.
}

$dbPath = Database::path();
$dbInsideProject = Database::isInsideProject();
?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Registros — Babysec-selfie - Lo estás haciendo bien</title>
  <link rel="stylesheet" href="<?= htmlspecialchars(asset_url('css/button.css', '../'), ENT_QUOTES, 'UTF-8') ?>">
  <link rel="stylesheet" href="<?= htmlspecialchars(asset_url('admin/css/admin.css', '../'), ENT_QUOTES, 'UTF-8') ?>">
  <link rel="icon" href="<?= htmlspecialchars(asset_url('assets/icons/favicon.ico', '../'), ENT_QUOTES, 'UTF-8') ?>" sizes="any">
  <link rel="icon" type="image/png" sizes="32x32" href="<?= htmlspecialchars(asset_url('assets/icons/favicon-32x32.png', '../'), ENT_QUOTES, 'UTF-8') ?>">
</head>
<body class="admin-body">
  <header class="admin-header">
    <div class="admin-header__inner">
      <div>
        <h1 class="admin-header__title">Registros de participaciones</h1>
        <p class="admin-header__subtitle">Babysec Selfie — "Lo estás haciendo bien" — panel de administración</p>
      </div>
      <a href="logout.php" class="btn btn--ghost btn--sm">Cerrar sesión</a>
    </div>
  </header>

  <main class="admin-main">
    <?php if ($dbInsideProject): ?>
      <aside class="admin-banner admin-banner--warn" role="status">
        <strong>Riesgo de deploy:</strong>
        la base está dentro del proyecto
        (<span class="mono"><?= htmlspecialchars($dbPath, ENT_QUOTES, 'UTF-8') ?></span>).
        Un FTP puede pisarla. En producción, copiá
        <span class="mono">includes/local.example.php</span> →
        <span class="mono">includes/local.php</span> y apuntá
        <span class="mono">database_path</span> /
        <span class="mono">private_path</span> fuera de la carpeta que subís
        (ahí también viven <span class="mono">log-participaciones.txt</span> y
        <span class="mono">log-videos.txt</span>).
        Ver también <span class="mono">deploy-exclude.txt</span>.
      </aside>
    <?php endif; ?>

    <section class="stats-grid">
      <article class="stat-card">
        <span class="stat-card__label">Total de registros</span>
        <strong class="stat-card__value"><?= $totalCount ?></strong>
      </article>
      <article class="stat-card">
        <span class="stat-card__label">Hoy</span>
        <strong class="stat-card__value"><?= $todayCount ?></strong>
      </article>
      <article class="stat-card">
        <span class="stat-card__label">Con video</span>
        <strong class="stat-card__value"><?= $uploadedCount ?></strong>
      </article>
    </section>

    <section class="panel">
      <div class="panel__toolbar">
        <div class="search-box">
          <input
            id="search-input"
            type="search"
            class="form-input"
            placeholder="Buscar por nombre, apellido, localidad o email..."
            autocomplete="off"
          >
        </div>
        <div class="toolbar-actions">
          <button id="btn-export" type="button" class="btn btn--secondary btn--sm">Exportar CSV</button>
          <a id="btn-export-all" href="export-all.php" class="btn btn--primary btn--sm">Exportar todo</a>
          <button id="btn-purge" type="button" class="btn btn--danger btn--sm">Vaciar</button>
        </div>
      </div>

      <?php if ($totalCount === 0): ?>
        <div class="empty-state">
          <p>No hay registros todavía.</p>
          <p class="empty-state__hint">Los videos aparecerán aquí cuando los usuarios envíen sus selfies.</p>
        </div>
      <?php else: ?>
        <div class="table-wrap">
          <table class="data-table" id="registrations-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Nombre</th>
                <th>Apellido</th>
                <th>Localidad</th>
                <th>Email</th>
                <th>Estado</th>
                <th class="col-file">Archivo</th>
                <th>Tamaño</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <?php foreach ($registrations as $entry): ?>
                <?php
                  $videoUrl = registrationVideoUrl($entry);
                  $estado = (string) ($entry['estado'] ?? '');
                  $searchText = strtolower(trim(implode(' ', [
                      $entry['nombre'] ?? '',
                      $entry['apellido'] ?? '',
                      $entry['localidad'] ?? '',
                      $entry['email'] ?? '',
                      $entry['uuid'] ?? '',
                      $estado,
                      formatEstado($estado),
                      $entry['video_filename'] ?? '',
                  ])));
                ?>
                <tr data-search="<?= htmlspecialchars($searchText, ENT_QUOTES, 'UTF-8') ?>">
                  <td data-label="Fecha"><?= htmlspecialchars(formatDate($entry['created_at'] ?? null), ENT_QUOTES, 'UTF-8') ?></td>
                  <td data-label="Nombre"><?= htmlspecialchars($entry['nombre'] ?? '—', ENT_QUOTES, 'UTF-8') ?></td>
                  <td data-label="Apellido"><?= htmlspecialchars($entry['apellido'] ?? '—', ENT_QUOTES, 'UTF-8') ?></td>
                  <td data-label="Localidad"><?= htmlspecialchars($entry['localidad'] ?? '—', ENT_QUOTES, 'UTF-8') ?></td>
                  <td data-label="Email">
                    <a href="mailto:<?= htmlspecialchars($entry['email'] ?? '', ENT_QUOTES, 'UTF-8') ?>" class="link">
                      <?= htmlspecialchars($entry['email'] ?? '—', ENT_QUOTES, 'UTF-8') ?>
                    </a>
                  </td>
                  <td data-label="Estado">
                    <span class="badge badge--<?= htmlspecialchars($estado !== '' ? $estado : 'muted', ENT_QUOTES, 'UTF-8') ?>">
                      <?= htmlspecialchars(formatEstado($estado), ENT_QUOTES, 'UTF-8') ?>
                    </span>
                  </td>
                  <td data-label="Archivo" class="col-file">
                    <span class="file-ellipsis mono" title="<?= htmlspecialchars($entry['video_filename'] ?? '', ENT_QUOTES, 'UTF-8') ?>">
                      <?= htmlspecialchars($entry['video_filename'] ?? '—', ENT_QUOTES, 'UTF-8') ?>
                    </span>
                  </td>
                  <td data-label="Tamaño"><?= htmlspecialchars(formatFileSize(isset($entry['video_size']) ? (int) $entry['video_size'] : null), ENT_QUOTES, 'UTF-8') ?></td>
                  <td data-label="Acciones">
                    <div class="action-group">
                      <?php if ($videoUrl): ?>
                        <a href="<?= htmlspecialchars($videoUrl, ENT_QUOTES, 'UTF-8') ?>" class="btn btn--secondary btn--xs" target="_blank" rel="noopener">Ver</a>
                        <a href="<?= htmlspecialchars($videoUrl, ENT_QUOTES, 'UTF-8') ?>" class="btn btn--primary btn--xs" download>Descargar</a>
                      <?php else: ?>
                        <span class="badge badge--muted">Sin video</span>
                      <?php endif; ?>
                    </div>
                  </td>
                </tr>
              <?php endforeach; ?>
            </tbody>
          </table>
        </div>
        <p id="filter-count" class="filter-count"></p>
      <?php endif; ?>
    </section>

    <section class="panel panel--orphans">
      <div class="panel__toolbar">
        <div>
          <h2 class="panel__title muted" >Videos sin registro</h2>
          <p class="panel__subtitle">Archivos en disco sin registro asociado (<?= $orphanCount ?>)</p>
        </div>
      </div>

      <?php if ($orphanCount === 0): ?>
        <div class="empty-state">
          <p>No hay videos huérfanos.</p>
          <p class="empty-state__hint">Todos los archivos de video están vinculados a un participante.</p>
        </div>
      <?php else: ?>
        <div class="table-wrap">
          <table class="data-table" id="orphans-table">
            <thead>
              <tr>
                <th class="col-file">Archivo</th>
                <th>Modificado</th>
                <th>Tamaño</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <?php foreach ($orphanVideos as $orphan): ?>
                <tr>
                  <td data-label="Archivo" class="col-file">
                    <span class="file-ellipsis mono" title="<?= htmlspecialchars($orphan['filename'], ENT_QUOTES, 'UTF-8') ?>">
                      <?= htmlspecialchars($orphan['filename'], ENT_QUOTES, 'UTF-8') ?>
                    </span>
                  </td>
                  <td data-label="Modificado">
                    <?= htmlspecialchars(
                        $orphan['mtime'] > 0
                          ? (new DateTimeImmutable('@' . $orphan['mtime']))->setTimezone(appTimezone())->format('d/m/Y H:i')
                          : '—',
                        ENT_QUOTES,
                        'UTF-8'
                    ) ?>
                  </td>
                  <td data-label="Tamaño"><?= htmlspecialchars(formatFileSize($orphan['size']), ENT_QUOTES, 'UTF-8') ?></td>
                  <td data-label="Acciones">
                    <div class="action-group">
                      <a href="<?= htmlspecialchars($orphan['url'], ENT_QUOTES, 'UTF-8') ?>" class="btn btn--secondary btn--xs" target="_blank" rel="noopener">Ver</a>
                      <a href="<?= htmlspecialchars($orphan['url'], ENT_QUOTES, 'UTF-8') ?>" class="btn btn--primary btn--xs" download>Descargar</a>
                    </div>
                  </td>
                </tr>
              <?php endforeach; ?>
            </tbody>
          </table>
        </div>
      <?php endif; ?>
    </section>
  </main>

  <script type="module" src="<?= htmlspecialchars(asset_url('admin/js/admin.js', '../'), ENT_QUOTES, 'UTF-8') ?>"></script>
</body>
</html>

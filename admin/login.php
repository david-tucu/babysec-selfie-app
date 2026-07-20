<?php

declare(strict_types=1);

require_once __DIR__ . '/includes/auth.php';
require_once dirname(__DIR__) . '/includes/assets.php';
send_demo_cache_headers();

if (isAdminLoggedIn()) {
    header('Location: index.php');
    exit;
}

$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim($_POST['username'] ?? '');
    $password = $_POST['password'] ?? '';

    $result = attemptLogin($username, $password);

    if ($result === true) {
        header('Location: index.php');
        exit;
    }

    $error = is_string($result) ? $result : 'No se pudo iniciar sesión.';
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Admin — babysec-selfie</title>
  <link rel="stylesheet" href="<?= htmlspecialchars(asset_url('css/button.css', '../'), ENT_QUOTES, 'UTF-8') ?>">
  <link rel="stylesheet" href="<?= htmlspecialchars(asset_url('admin/css/admin.css', '../'), ENT_QUOTES, 'UTF-8') ?>">
</head>
<body class="admin-body admin-body--center">
  <main class="login-card">
    <h1 class="login-card__title">Panel Admin</h1>
    <p class="login-card__subtitle">babysec-selfie</p>

    <?php if ($error !== ''): ?>
      <div class="alert alert--error"><?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?></div>
    <?php endif; ?>

    <form method="post" class="login-form">
      <div class="form-field">
        <label for="username" class="form-label">Usuario</label>
        <input id="username" name="username" type="text" class="form-input" autocomplete="username" required autofocus>
      </div>
      <div class="form-field">
        <label for="password" class="form-label">Contraseña</label>
        <input id="password" name="password" type="password" class="form-input" autocomplete="current-password" required>
      </div>
      <button type="submit" class="btn btn--primary btn--block">Ingresar</button>
    </form>
  </main>
</body>
</html>

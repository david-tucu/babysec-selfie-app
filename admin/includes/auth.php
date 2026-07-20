<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

function isAdminLoggedIn(): bool
{
    return !empty($_SESSION[ADMIN_SESSION_KEY]);
}

function requireAdmin(): void
{
    if (!isAdminLoggedIn()) {
        header('Location: login.php');
        exit;
    }
}

/**
 * @return bool|string true si OK, mensaje de error si falla
 */
function attemptLogin(string $username, string $password): bool|string
{
    $config = adminConfig();

    if (!hash_equals($config['username'], $username)) {
        return 'Usuario o contraseña incorrectos.';
    }

    $hash = hash('sha256', $password . $config['auth_salt']);

    if (!hash_equals($config['password_hash'], $hash)) {
        return 'Usuario o contraseña incorrectos.';
    }

    session_regenerate_id(true);
    $_SESSION[ADMIN_SESSION_KEY] = [
        'username'  => $config['username'],
        'logged_at' => date('c'),
    ];

    return true;
}

function logoutAdmin(): void
{
    $_SESSION = [];

    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(
            session_name(),
            '',
            time() - 42000,
            $params['path'],
            $params['domain'],
            (bool) $params['secure'],
            (bool) $params['httponly'],
        );
    }

    session_destroy();
}

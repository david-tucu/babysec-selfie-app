<?php
/**
 * Copiá este archivo como config.php y cambiá las credenciales.
 *
 * Generar nuevo hash de contraseña:
 *   php -r "echo hash('sha256', 'TU_PASSWORD' . 'TU_SALT');"
 */

declare(strict_types=1);

$salt = 'babysec-selfie-salt-change-me';

return [
    'username'      => 'admin',
    'auth_salt'     => $salt,
    'password_hash' => hash('sha256', 'booth2026' . $salt),
];

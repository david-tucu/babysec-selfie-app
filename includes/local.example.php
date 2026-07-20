<?php

/**
 * Copiá este archivo como includes/local.php en el servidor (NO lo subas en cada deploy).
 *
 * Layout recomendado (hermana de babysec, dentro de public_html):
 *   /home/USUARIO/public_html/
 *     babysec/                 <- codigo (FTP de deploys)
 *     babysec-private/         <- DB + logs (NO subir en deploys)
 *       .htaccess              <- denegar acceso HTTP
 *       database.sqlite
 *       log-participaciones.txt
 *       log-videos.txt
 *
 * Importante: babysec-private debe tener .htaccess "Require all denied"
 * (si no, alguien podria intentar bajar el sqlite por URL).
 */

declare(strict_types=1);

// Desde includes/, dirname(__DIR__, 2) = public_html (padre de babysec).
$privateDir = dirname(__DIR__, 2) . '/babysec-private';

return [
    'private_path' => $privateDir,
    'database_path' => $privateDir . '/database.sqlite',

    // true = cache corto / bust de assets (etapa de muestra al cliente).
    // false = cuando el evento ya esté estable.
    'demo_mode' => true,
];

<?php

declare(strict_types=1);

const ADMIN_SESSION_KEY = 'babysec_selfie_admin';

/** @var string Ruta raíz del proyecto */
define('PROJECT_ROOT', dirname(__DIR__, 2));

/** @var string Carpeta de videos */
define('VIDEOS_DIR', PROJECT_ROOT . '/uploads/videos');

require_once PROJECT_ROOT . '/includes/Database.php';

/**
 * @return array{username: string, auth_salt: string, password_hash: string}
 */
function adminConfig(): array
{
    static $config = null;

    if ($config !== null) {
        return $config;
    }

    $configPath = dirname(__DIR__) . '/config.php';

    if (!is_file($configPath)) {
        http_response_code(500);
        exit('Falta admin/config.php. Copiá admin/config.example.php como admin/config.php');
    }

    $config = require $configPath;
    return $config;
}

/**
 * Lista participantes desde SQLite (más recientes primero).
 *
 * @return array<int, array<string, mixed>>
 */
function loadRegistrations(): array
{
    try {
        $pdo = Database::connection();
        $stmt = $pdo->query(
            'SELECT
                id,
                uuid,
                nombre,
                apellido,
                localidad,
                email,
                estado,
                video_filename,
                video_mime,
                video_size,
                created_at,
                updated_at
             FROM participantes
             ORDER BY datetime(created_at) DESC, id DESC'
        );

        $rows = $stmt->fetchAll();
        return is_array($rows) ? $rows : [];
    } catch (Throwable) {
        return [];
    }
}

/**
 * @param array<string, mixed> $entry
 */
function registrationVideoUrl(array $entry): ?string
{
    $filename = (string) ($entry['video_filename'] ?? '');
    if ($filename === '' || !is_file(VIDEOS_DIR . '/' . $filename)) {
        return null;
    }

    return '../uploads/videos/' . rawurlencode($filename);
}

/**
 * Etiqueta legible del estado del participante.
 */
function formatEstado(?string $estado): string
{
    return match ($estado) {
        'registered' => 'Registrado',
        'uploaded'   => 'Subido',
        'failed'     => 'Fallido',
        default      => $estado !== null && $estado !== '' ? $estado : '—',
    };
}

/**
 * @param int|null $bytes
 */
function formatFileSize(?int $bytes): string
{
    if ($bytes === null || $bytes <= 0) {
        return '—';
    }

    if ($bytes >= 1048576) {
        return number_format($bytes / 1048576, 1) . ' MB';
    }

    return number_format($bytes / 1024, 0) . ' KB';
}

/**
 * @param string|null $isoDate
 */
function formatDate(?string $isoDate): string
{
    if ($isoDate === null || $isoDate === '') {
        return '—';
    }

    try {
        $dt = (new DateTimeImmutable($isoDate))->setTimezone(appTimezone());
        return $dt->format('d/m/Y H:i');
    } catch (Exception) {
        return $isoDate;
    }
}

/**
 * Fecha local (Y-m-d) de un ISO guardado, en zona de la app.
 */
function formatDateDay(?string $isoDate): ?string
{
    if ($isoDate === null || $isoDate === '') {
        return null;
    }

    try {
        return (new DateTimeImmutable($isoDate))->setTimezone(appTimezone())->format('Y-m-d');
    } catch (Exception) {
        return null;
    }
}

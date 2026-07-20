<?php
/**
 * API de subida de videos — PHP 8 + SQLite
 * Recibe únicamente uuid + video y actualiza el participante existente.
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require_once dirname(__DIR__) . '/includes/Database.php';
require_once dirname(__DIR__) . '/includes/UploadTrace.php';
require_once dirname(__DIR__) . '/includes/ParticipationLog.php';

UploadTrace::begin('upload');

register_shutdown_function(static function (): void {
    $err = error_get_last();
    if ($err !== null && in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        UploadTrace::step('shutdown_fatal', [
            'type' => $err['type'],
            'message' => $err['message'],
            'file' => $err['file'] ?? null,
            'line' => $err['line'] ?? null,
        ]);
    } else {
        UploadTrace::step('shutdown');
    }
});

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Método no permitido.']);
    exit;
}

$uuid = trim($_POST['uuid'] ?? '');
UploadTrace::step('post_parsed', [
    'uuid' => $uuid !== '' ? $uuid : null,
    'has_video' => isset($_FILES['video']),
    'content_length' => $_SERVER['CONTENT_LENGTH'] ?? null,
]);

if ($uuid === '' || !preg_match(
    '/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i',
    $uuid
)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'UUID inválido o ausente.']);
    exit;
}

try {
    UploadTrace::step('db_connect_start');
    $pdo = Database::connection();
    UploadTrace::step('db_connect_ok');
} catch (Throwable $e) {
    UploadTrace::step('db_connect_fail', ['error' => $e->getMessage()]);
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'No se pudo conectar a la base de datos.']);
    exit;
}

UploadTrace::step('select_participant_start');
$stmt = $pdo->prepare(
    'SELECT id, uuid, nombre, apellido, localidad, email, estado
     FROM participantes
     WHERE uuid = :uuid
     LIMIT 1'
);
$stmt->execute([':uuid' => $uuid]);
$participant = $stmt->fetch();
UploadTrace::step('select_participant_done', [
    'found' => (bool) $participant,
    'estado' => $participant['estado'] ?? null,
]);

if (!$participant) {
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'Participante no encontrado.']);
    exit;
}

$estadoActual = (string) ($participant['estado'] ?? '');

if (!in_array($estadoActual, ['registered', 'failed'], true)) {
    http_response_code(409);
    echo json_encode([
        'success' => false,
        'message' => 'El participante ya tiene un video asociado o no admite subida.',
    ]);
    exit;
}

// ── Validar archivo de video ──
if (!isset($_FILES['video']) || $_FILES['video']['error'] !== UPLOAD_ERR_OK) {
    $errorMessages = [
        UPLOAD_ERR_INI_SIZE   => 'El archivo excede el límite del servidor.',
        UPLOAD_ERR_FORM_SIZE  => 'El archivo excede el límite del formulario.',
        UPLOAD_ERR_PARTIAL    => 'La subida fue incompleta.',
        UPLOAD_ERR_NO_FILE    => 'No se recibió ningún archivo.',
        UPLOAD_ERR_NO_TMP_DIR => 'Falta carpeta temporal en el servidor.',
        UPLOAD_ERR_CANT_WRITE => 'No se pudo escribir el archivo.',
        UPLOAD_ERR_EXTENSION  => 'Extensión PHP bloqueó la subida.',
    ];

    $code = $_FILES['video']['error'] ?? UPLOAD_ERR_NO_FILE;
    $message = $errorMessages[$code] ?? 'Error desconocido al subir.';

    UploadTrace::step('files_error', ['code' => $code, 'message' => $message]);
    markUploadFailed($pdo, (int) $participant['id']);

    http_response_code(400);
    echo json_encode(['success' => false, 'message' => $message]);
    exit;
}

$file = $_FILES['video'];
UploadTrace::step('files_ok', [
    'name' => $file['name'] ?? null,
    'size' => $file['size'] ?? null,
    'client_type' => $file['type'] ?? null,
    'tmp_name' => isset($file['tmp_name']) ? basename((string) $file['tmp_name']) : null,
]);

$maxSize = 50 * 1024 * 1024;
if ($file['size'] > $maxSize) {
    markUploadFailed($pdo, (int) $participant['id']);
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'El video supera el tamaño máximo permitido (50 MB).']);
    exit;
}

UploadTrace::step('mime_detect_start');
$mimeType = detectUploadMimeType($file);
UploadTrace::step('mime_detect_done', ['mime' => $mimeType]);

$allowedMimes = [
    'video/webm'               => 'webm',
    'video/mp4'                => 'mp4',
    'video/ogg'                => 'ogg',
    'application/octet-stream' => 'webm',
];

if (!is_string($mimeType) || !array_key_exists($mimeType, $allowedMimes)) {
    markUploadFailed($pdo, (int) $participant['id']);
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Tipo de archivo no permitido: ' . ($mimeType ?: 'desconocido'),
    ]);
    exit;
}

$extension = $allowedMimes[$mimeType];
$uploadDir = dirname(__DIR__) . '/uploads/videos';

if (!is_dir($uploadDir) && !mkdir($uploadDir, 0755, true)) {
    markUploadFailed($pdo, (int) $participant['id']);
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'No se pudo crear el directorio de subida.']);
    exit;
}

$originalName = pathinfo($file['name'], PATHINFO_FILENAME);
$safeName = preg_replace('/[^a-zA-Z0-9_-]/', '', (string) $originalName) ?: 'selfie';
$filename = $safeName . '_' . date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '.' . $extension;
$destination = $uploadDir . '/' . $filename;

UploadTrace::step('move_start', ['destination' => $filename]);
if (!move_uploaded_file($file['tmp_name'], $destination)) {
    UploadTrace::step('move_fail');
    markUploadFailed($pdo, (int) $participant['id']);
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'No se pudo guardar el video.']);
    exit;
}
UploadTrace::step('move_ok', ['bytes' => filesize($destination) ?: null]);

$now = appNowAtom();

try {
    UploadTrace::step('db_update_start');
    $update = $pdo->prepare(
        'UPDATE participantes
         SET estado = :estado,
             video_filename = :video_filename,
             video_mime = :video_mime,
             video_size = :video_size,
             updated_at = :updated_at
         WHERE id = :id'
    );

    $update->execute([
        ':estado'         => 'uploaded',
        ':video_filename' => $filename,
        ':video_mime'     => $mimeType,
        ':video_size'     => (int) $file['size'],
        ':updated_at'     => $now,
        ':id'             => (int) $participant['id'],
    ]);
    UploadTrace::step('db_update_ok');
} catch (Throwable $e) {
    UploadTrace::step('db_update_fail', ['error' => $e->getMessage()]);
    // El archivo ya está en disco; marcamos failed pero no borramos el participante.
    markUploadFailed($pdo, (int) $participant['id']);
    @unlink($destination);
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'El video se guardó pero no se pudo actualizar el registro.']);
    exit;
}

// Backup append-only: vínculo uuid ↔ video (también línea VIDEO_LINK en log-participaciones).
ParticipationLog::logVideo([
    'uuid' => $uuid,
    'nombre' => (string) ($participant['nombre'] ?? ''),
    'apellido' => (string) ($participant['apellido'] ?? ''),
    'email' => (string) ($participant['email'] ?? ''),
    'video_filename' => $filename,
    'video_mime' => $mimeType,
    'video_size' => (int) $file['size'],
    'estado' => 'uploaded',
    'updated_at' => $now,
]);

$baseUrl = rtrim(dirname(dirname($_SERVER['SCRIPT_NAME'] ?? '')), '/');
$fileUrl = $baseUrl . '/uploads/videos/' . $filename;

UploadTrace::step('response_ok', ['filename' => $filename, 'size' => (int) $file['size']]);

echo json_encode([
    'success'     => true,
    'message'     => 'Video guardado correctamente.',
    'filename'    => $filename,
    'url'         => $fileUrl,
    'downloadUrl' => $fileUrl,
    'size'        => (int) $file['size'],
    'mimeType'    => $mimeType,
    'uuid'        => $uuid,
    'user'        => [
        'nombre'   => $participant['nombre'],
        'apellido' => $participant['apellido'],
        'localidad' => $participant['localidad'],
        'email'    => $participant['email'],
    ],
]);

/**
 * Detecta MIME sin depender de finfo/libmagic (puede colgar en algunos MAMP/macOS con WebM).
 *
 * @param array{name?: string, type?: string, tmp_name?: string} $file
 */
function detectUploadMimeType(array $file): ?string
{
    $tmp = (string) ($file['tmp_name'] ?? '');
    $clientType = strtolower(trim((string) ($file['type'] ?? '')));
    // Chrome manda "video/webm;codecs=vp9,opus" → normalizar.
    if (str_contains($clientType, ';')) {
        $clientType = trim(explode(';', $clientType, 2)[0]);
    }

    $ext = strtolower(pathinfo((string) ($file['name'] ?? ''), PATHINFO_EXTENSION));

    if ($tmp !== '' && is_file($tmp)) {
        $header = @file_get_contents($tmp, false, null, 0, 12);
        if (is_string($header) && strlen($header) >= 4) {
            // EBML / WebM
            if (strncmp($header, "\x1A\x45\xDF\xA3", 4) === 0) {
                return 'video/webm';
            }
            // MP4 / ISO BMFF: ....ftyp
            if (strlen($header) >= 8 && substr($header, 4, 4) === 'ftyp') {
                return 'video/mp4';
            }
            // Ogg
            if (strncmp($header, 'OggS', 4) === 0) {
                return 'video/ogg';
            }
        }
    }

    $byExt = [
        'webm' => 'video/webm',
        'mp4'  => 'video/mp4',
        'm4v'  => 'video/mp4',
        'ogg'  => 'video/ogg',
        'ogv'  => 'video/ogg',
    ];

    if (isset($byExt[$ext])) {
        return $byExt[$ext];
    }

    if (in_array($clientType, ['video/webm', 'video/mp4', 'video/ogg', 'application/octet-stream'], true)) {
        return $clientType;
    }

    return $clientType !== '' ? $clientType : null;
}

/**
 * Marca el participante como failed sin eliminarlo.
 */
function markUploadFailed(PDO $pdo, int $participantId): void
{
    try {
        UploadTrace::step('mark_failed_start', ['id' => $participantId]);
        $stmt = $pdo->prepare(
            'UPDATE participantes
             SET estado = :estado,
                 updated_at = :updated_at
             WHERE id = :id
               AND estado IN (\'registered\', \'failed\')'
        );
        $stmt->execute([
            ':estado'     => 'failed',
            ':updated_at' => appNowAtom(),
            ':id'         => $participantId,
        ]);
        UploadTrace::step('mark_failed_ok');
    } catch (Throwable $e) {
        UploadTrace::step('mark_failed_error', ['error' => $e->getMessage()]);
    }
}

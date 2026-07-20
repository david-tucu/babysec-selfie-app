<?php
/**
 * Vaca registros y videos de prueba.
 * Requiere sesin admin + clave QUIEROBORRARTODO.
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/includes/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Mtodo no permitido.']);
    exit;
}

if (!isAdminLoggedIn()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Sesin no vlida. Inici sesin de nuevo.']);
    exit;
}

const PURGE_CONFIRM_KEY = 'QUIEROBORRARTODO';

$key = trim((string) ($_POST['key'] ?? ''));

if ($key === '' || !hash_equals(PURGE_CONFIRM_KEY, $key)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Clave incorrecta.']);
    exit;
}

$deletedFiles = 0;
$errors = [];

// Borrar videos (y meta.json legacy)
$videoPatterns = ['*.webm', '*.mp4', '*.ogg', '*.meta.json'];
foreach ($videoPatterns as $pattern) {
    foreach (glob(VIDEOS_DIR . '/' . $pattern) ?: [] as $path) {
        if (!is_file($path)) {
            continue;
        }
        if (@unlink($path)) {
            $deletedFiles += 1;
        } else {
            $errors[] = 'No se pudo borrar: ' . basename($path);
        }
    }
}

@unlink(PROJECT_ROOT . '/uploads/registry.json');
@unlink(PROJECT_ROOT . '/data/upload-trace.log');

$deletedRows = 0;

try {
    $pdo = Database::connection();
    $deletedRows = (int) $pdo->exec('DELETE FROM participantes');
    // Reinicia el autoincrement para dejar la tabla "en cero".
    try {
        $pdo->exec('DELETE FROM sqlite_sequence WHERE name = \'participantes\'');
    } catch (Throwable) {
        // sqlite_sequence puede no existir en bases nuevas.
    }
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Se borraron archivos pero fall la base de datos.',
        'deletedFiles' => $deletedFiles,
        'errors' => array_merge($errors, [$e->getMessage()]),
    ]);
    exit;
}

echo json_encode([
    'success' => true,
    'message' => 'Datos de prueba eliminados.',
    'deletedRows' => $deletedRows,
    'deletedFiles' => $deletedFiles,
    'errors' => $errors,
]);

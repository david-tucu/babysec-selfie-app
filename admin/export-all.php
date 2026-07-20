<?php
/**
 * Exporta todos los registros (CSV) + videos en un ZIP.
 */

declare(strict_types=1);

require_once __DIR__ . '/includes/auth.php';
requireAdmin();

if (!class_exists(ZipArchive::class)) {
    http_response_code(500);
    exit('La extensiùn ZipArchive no estù disponible en este PHP.');
}

$registrations = loadRegistrations();
$stamp = (new DateTimeImmutable('now', appTimezone()))->format('Y-m-d_His');
$downloadName = 'babysec-selfie-export-' . $stamp . '.zip';

/**
 * Busca un directorio escribible para el ZIP temporal.
 * @return array{0: string|false, 1: list<string>}
 */
$resolveTempDir = static function (): array {
    $candidates = [
        sys_get_temp_dir(),
        ini_get('upload_tmp_dir') ?: '',
        '/Applications/MAMP/tmp/php',
        PROJECT_ROOT . '/data',
        PROJECT_ROOT . '/uploads',
    ];

    $tried = [];
    foreach ($candidates as $dir) {
        $dir = is_string($dir) ? rtrim($dir, "/\\") : '';
        if ($dir === '') {
            continue;
        }
        $writable = is_dir($dir) && is_writable($dir);
        $tried[] = $dir . ' (dir=' . (is_dir($dir) ? '1' : '0') . ', writable=' . ($writable ? '1' : '0') . ')';
        if ($writable) {
            return [$dir, $tried];
        }
    }

    return [false, $tried];
};

[$tempDir, $tempTried] = $resolveTempDir();
$tmpZip = $tempDir !== false ? tempnam($tempDir, 'babysec_export_') : false;

if ($tmpZip === false) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    echo "No se pudo crear archivo temporal.\n\n";
    echo 'sys_get_temp_dir(): ' . sys_get_temp_dir() . "\n";
    echo 'upload_tmp_dir: ' . (ini_get('upload_tmp_dir') ?: '(vacÌo)') . "\n";
    echo 'open_basedir: ' . (ini_get('open_basedir') ?: '(vacÌo)') . "\n";
    echo "Candidatos probados:\n- " . implode("\n- ", $tempTried) . "\n";
    exit;
}

// tempnam crea un archivo; ZipArchive necesita path libre o overwrite.
@unlink($tmpZip);
$tmpZip .= '.zip';

$zip = new ZipArchive();
if ($zip->open($tmpZip, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    exit('No se pudo crear el ZIP en: ' . $tmpZip);
}

// ?? CSV ??
$headers = [
    'Fecha',
    'Nombre',
    'Apellido',
    'Localidad',
    'Email',
    'Estado',
    'Archivo',
    'Tamaùo',
    'UUID',
];

$csvHandle = fopen('php://temp', 'r+');
if ($csvHandle === false) {
    $zip->close();
    @unlink($tmpZip);
    http_response_code(500);
    exit('No se pudo generar el CSV.');
}

fprintf($csvHandle, chr(0xEF) . chr(0xBB) . chr(0xBF)); // UTF-8 BOM (Excel)
fputcsv($csvHandle, $headers);

$videosAdded = 0;
$videosMissing = 0;

foreach ($registrations as $entry) {
    $filename = (string) ($entry['video_filename'] ?? '');
    $size = isset($entry['video_size']) ? (int) $entry['video_size'] : null;

    fputcsv($csvHandle, [
        formatDate($entry['created_at'] ?? null),
        (string) ($entry['nombre'] ?? ''),
        (string) ($entry['apellido'] ?? ''),
        (string) ($entry['localidad'] ?? ''),
        (string) ($entry['email'] ?? ''),
        formatEstado(isset($entry['estado']) ? (string) $entry['estado'] : null),
        $filename !== '' ? $filename : '',
        formatFileSize($size),
        (string) ($entry['uuid'] ?? ''),
    ]);

    if ($filename === '') {
        continue;
    }

    $path = VIDEOS_DIR . '/' . $filename;
    if (!is_file($path)) {
        $videosMissing += 1;
        continue;
    }

    // Nombre seguro dentro del zip (sin path traversal).
    $safeName = basename($filename);
    $zipPath = 'videos/' . $safeName;

    if ($zip->addFile($path, $zipPath)) {
        if (defined('ZipArchive::CM_STORE')) {
            $zip->setCompressionName($zipPath, ZipArchive::CM_STORE);
        }
        $videosAdded += 1;
    }
}

rewind($csvHandle);
$csvContents = stream_get_contents($csvHandle);
fclose($csvHandle);

if ($csvContents === false) {
    $zip->close();
    @unlink($tmpZip);
    http_response_code(500);
    exit('No se pudo leer el CSV generado.');
}

$zip->addFromString('registros.csv', $csvContents);
$zip->addFromString(
    'README.txt',
    "Export babysec-selfie\n"
    . "Fecha: {$stamp}\n"
    . 'Registros: ' . count($registrations) . "\n"
    . "Videos incluidos: {$videosAdded}\n"
    . "Videos faltantes en disco: {$videosMissing}\n"
    . "Contenido:\n"
    . "- registros.csv\n"
    . "- videos/\n"
);

$zip->close();

if (!is_file($tmpZip)) {
    http_response_code(500);
    exit('El ZIP no se generù correctamente.');
}

$fileSize = filesize($tmpZip);
header('Content-Type: application/zip');
header('Content-Disposition: attachment; filename="' . $downloadName . '"');
header('Content-Length: ' . (string) ($fileSize !== false ? $fileSize : 0));
header('Cache-Control: no-store');
header('Pragma: no-cache');

readfile($tmpZip);
@unlink($tmpZip);
exit;

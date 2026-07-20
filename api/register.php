<?php

/**
 * API de registro de participantes - PHP 8 + SQLite
 * Recibe datos personales, crea UUID y deja estado 'registered'.
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require_once dirname(__DIR__) . '/includes/Database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'M�todo no permitido.']);
    exit;
}

$nombre    = mb_strtoupper(trim($_POST['nombre'] ?? ''), 'UTF-8');
$apellido  = mb_strtoupper(trim($_POST['apellido'] ?? ''), 'UTF-8');
$localidad = mb_strtoupper(trim($_POST['localidad'] ?? ''), 'UTF-8');
$email     = trim(strtolower($_POST['email'] ?? ''));

if (mb_strlen($nombre) < 2) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'El nombre es obligatorio (m�nimo 2 caracteres).']);
    exit;
}

if (mb_strlen($apellido) < 2) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'El apellido es obligatorio (m�nimo 2 caracteres).']);
    exit;
}

if (mb_strlen($localidad) < 2) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'La localidad es obligatoria (m�nimo 2 caracteres).']);
    exit;
}

if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'El correo electr�nico no es v�lido.']);
    exit;
}

$uuid = sprintf(
    '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
    random_int(0, 0xffff),
    random_int(0, 0xffff),
    random_int(0, 0xffff),
    random_int(0, 0x0fff) | 0x4000,
    random_int(0, 0x3fff) | 0x8000,
    random_int(0, 0xffff),
    random_int(0, 0xffff),
    random_int(0, 0xffff),
);

$now = appNowAtom();

try {
    $pdo = Database::connection();
    $stmt = $pdo->prepare(
        'INSERT INTO participantes (
            uuid, nombre, apellido, localidad, email, estado,
            video_filename, video_mime, video_size,
            created_at, updated_at
        ) VALUES (
            :uuid, :nombre, :apellido, :localidad, :email, :estado,
            NULL, NULL, NULL,
            :created_at, :updated_at
        )'
    );

    $stmt->execute([
        ':uuid'       => $uuid,
        ':nombre'     => $nombre,
        ':apellido'   => $apellido,
        ':localidad'  => $localidad,
        ':email'      => $email,
        ':estado'     => 'registered',
        ':created_at' => $now,
        ':updated_at' => $now,
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'No se pudo registrar al participante.']);
    exit;
}

echo json_encode([
    'success' => true,
    'uuid'    => $uuid,
]);

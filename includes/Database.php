<?php

declare(strict_types=1);

require_once __DIR__ . '/timezone.php';

/**
 * Conexion PDO a SQLite y bootstrap del esquema.
 *
 * La ruta puede overridearse en includes/local.php (no versionado / no FTP)
 * para que un deploy no pise la base de producción.
 */
final class Database
{
    private const DB_RELATIVE_PATH = '/data/database.sqlite';

    private static ?PDO $pdo = null;

    private static ?string $resolvedPath = null;

    /**
     * Ruta absoluta del archivo SQLite en uso.
     */
    public static function path(): string
    {
        return self::$resolvedPath ?? self::resolvePath();
    }

    /**
     * true si la DB vive dentro del directorio del proyecto (riesgo FTP).
     */
    public static function isInsideProject(): bool
    {
        $root = realpath(dirname(__DIR__)) ?: dirname(__DIR__);
        $db = self::path();
        $rootPrefix = rtrim(str_replace('\\', '/', $root), '/') . '/';
        $dbNorm = str_replace('\\', '/', $db);

        return str_starts_with($dbNorm, $rootPrefix);
    }

    /**
     * Devuelve la conexion PDO compartida (lazy singleton).
     */
    public static function connection(): PDO
    {
        if (self::$pdo instanceof PDO) {
            return self::$pdo;
        }

        $dbPath = self::resolvePath();
        self::$resolvedPath = $dbPath;

        $dbDir = dirname($dbPath);
        if (!is_dir($dbDir) && !mkdir($dbDir, 0775, true) && !is_dir($dbDir)) {
            throw new RuntimeException('No se pudo crear el directorio de la base de datos: ' . $dbDir);
        }

        $pdo = new PDO('sqlite:' . $dbPath, null, null, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
            PDO::ATTR_TIMEOUT            => 5,
        ]);

        // Evita cuelgues indefinidos si otro proceso tiene el sqlite ocupado (admin, etc.).
        $pdo->exec('PRAGMA busy_timeout = 5000');
        $pdo->exec('PRAGMA foreign_keys = ON');
        self::migrate($pdo);
        self::$pdo = $pdo;

        return self::$pdo;
    }

    /**
     * Resuelve ruta: includes/local.php['database_path'] o data/database.sqlite.
     */
    private static function resolvePath(): string
    {
        $root = dirname(__DIR__);
        $default = $root . self::DB_RELATIVE_PATH;
        $localFile = __DIR__ . '/local.php';

        if (!is_file($localFile)) {
            return $default;
        }

        /** @var mixed $local */
        $local = require $localFile;
        if (!is_array($local)) {
            return $default;
        }

        $custom = $local['database_path'] ?? null;
        if (!is_string($custom) || trim($custom) === '') {
            return $default;
        }

        $custom = trim($custom);

        // Relativa al root del proyecto si no es absoluta.
        if ($custom[0] !== '/' && !preg_match('/^[A-Za-z]:[\\\\\\/]/', $custom)) {
            $custom = $root . '/' . ltrim($custom, '/\\');
        }

        return $custom;
    }

    /**
     * Crea la tabla participantes y aplica migraciones.
     */
    private static function migrate(PDO $pdo): void
    {
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS participantes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                uuid TEXT NOT NULL UNIQUE,
                nombre TEXT NOT NULL,
                apellido TEXT NOT NULL,
                localidad TEXT NOT NULL,
                email TEXT NOT NULL,
                estado TEXT NOT NULL,
                video_filename TEXT NULL,
                video_mime TEXT NULL,
                video_size INTEGER NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )'
        );

        self::migrateDniToLocalidad($pdo);

        $pdo->exec(
            'CREATE INDEX IF NOT EXISTS idx_participantes_estado
             ON participantes (estado)'
        );

        $pdo->exec(
            'CREATE INDEX IF NOT EXISTS idx_participantes_localidad
             ON participantes (localidad)'
        );
    }

    /**
     * Renombra la columna dni a localidad en bases existentes.
     */
    private static function migrateDniToLocalidad(PDO $pdo): void
    {
        $columns = $pdo->query('PRAGMA table_info(participantes)')->fetchAll();
        $names = array_column($columns, 'name');

        if (in_array('dni', $names, true) && !in_array('localidad', $names, true)) {
            $pdo->exec('ALTER TABLE participantes RENAME COLUMN dni TO localidad');
            $pdo->exec('DROP INDEX IF EXISTS idx_participantes_dni');
        }
    }
}

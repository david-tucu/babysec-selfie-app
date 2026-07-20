<?php

declare(strict_types=1);

require_once __DIR__ . '/timezone.php';

/**
 * Conexion PDO a SQLite y bootstrap del esquema.
 */
final class Database
{
    private const DB_RELATIVE_PATH = '/data/database.sqlite';

    private static ?PDO $pdo = null;

    /**
     * Devuelve la conexion PDO compartida (lazy singleton).
     */
    public static function connection(): PDO
    {
        if (self::$pdo instanceof PDO) {
            return self::$pdo;
        }

        $root = dirname(__DIR__);
        $dataDir = $root . '/data';
        $dbPath = $root . self::DB_RELATIVE_PATH;

        if (!is_dir($dataDir) && !mkdir($dataDir, 0775, true) && !is_dir($dataDir)) {
            throw new RuntimeException('No se pudo crear el directorio data/.');
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

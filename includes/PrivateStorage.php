<?php

declare(strict_types=1);

/**
 * Carpeta privada fuera del FTP (babysec-private) para DB/logs de respaldo.
 */
final class PrivateStorage
{
    private static ?string $dir = null;

    /**
     * Directorio absoluto escribible para backups/logs.
     */
    public static function directory(): string
    {
        if (self::$dir !== null) {
            return self::$dir;
        }

        $root = dirname(__DIR__);
        $candidates = [];

        $local = self::localConfig();
        $privatePath = $local['private_path'] ?? null;
        if (is_string($privatePath) && trim($privatePath) !== '') {
            $candidates[] = self::absolutePath(trim($privatePath), $root);
        }

        $dbPath = $local['database_path'] ?? null;
        if (is_string($dbPath) && trim($dbPath) !== '') {
            $candidates[] = dirname(self::absolutePath(trim($dbPath), $root));
        }

        // Default: hermana del proyecto.
        $candidates[] = dirname($root) . '/babysec-private';
        // Fallback local si no se puede crear fuera.
        $candidates[] = $root . '/data/private';

        foreach ($candidates as $dir) {
            if (self::ensureWritableDir($dir)) {
                self::$dir = $dir;
                return self::$dir;
            }
        }

        // Último recurso: data/ del proyecto.
        $fallback = $root . '/data';
        self::ensureWritableDir($fallback);
        self::$dir = $fallback;
        return self::$dir;
    }

    /**
     * Append de una línea a un archivo de log (no lanza si falla).
     */
    public static function appendLog(string $filename, string $line): bool
    {
        $safeName = basename($filename);
        if ($safeName === '' || $safeName === '.' || $safeName === '..') {
            return false;
        }

        $path = self::directory() . '/' . $safeName;
        $payload = rtrim($line, "\r\n") . "\n";

        return @file_put_contents($path, $payload, FILE_APPEND | LOCK_EX) !== false;
    }

    /**
     * @return array<string, mixed>
     */
    private static function localConfig(): array
    {
        $localFile = __DIR__ . '/local.php';
        if (!is_file($localFile)) {
            return [];
        }

        /** @var mixed $local */
        $local = require $localFile;
        return is_array($local) ? $local : [];
    }

    private static function absolutePath(string $path, string $root): string
    {
        if ($path[0] === '/' || preg_match('/^[A-Za-z]:[\\\\\\/]/', $path) === 1) {
            return $path;
        }

        return $root . '/' . ltrim($path, '/\\');
    }

    private static function ensureWritableDir(string $dir): bool
    {
        if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
            return false;
        }

        return is_dir($dir) && is_writable($dir);
    }
}

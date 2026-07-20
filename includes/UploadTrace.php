<?php

declare(strict_types=1);

/**
 * Trace de subida a archivo (diagnóstico de cuelgues en waiting_server).
 * Escribe de inmediato; no altera la respuesta JSON.
 */
final class UploadTrace
{
    private static ?string $requestId = null;
    private static float $startedAt = 0.0;

    public static function begin(string $label = 'upload'): string
    {
        self::$startedAt = microtime(true);
        self::$requestId = substr(bin2hex(random_bytes(4)), 0, 8);
        self::step($label . ':begin');
        return self::$requestId;
    }

    public static function step(string $step, array $context = []): void
    {
        if (self::$requestId === null) {
            self::begin('auto');
        }

        $elapsedMs = (int) round((microtime(true) - self::$startedAt) * 1000);
        $line = sprintf(
            "%s\t%s\t+%dms\t%s\t%s\n",
            date('c'),
            self::$requestId,
            $elapsedMs,
            $step,
            $context === [] ? '' : json_encode($context, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
        );

        $path = dirname(__DIR__) . '/data/upload-trace.log';
        @file_put_contents($path, $line, FILE_APPEND | LOCK_EX);
    }
}

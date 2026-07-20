<?php

declare(strict_types=1);

/**
 * Helpers de assets para etapa demo / producciùn.
 * - asset_url(): agrega ?v=mtime para bustear cache al cambiar el archivo
 * - asset_cache_headers(): Cache-Control corto (demo) o mùs largo (prod)
 */

/**
 * @return array<string, mixed>
 */
function assetLocalConfig(): array
{
    static $local = null;
    if ($local !== null) {
        return $local;
    }

    $file = __DIR__ . '/local.php';
    if (!is_file($file)) {
        $local = [];
        return $local;
    }

    /** @var mixed $cfg */
    $cfg = require $file;
    $local = is_array($cfg) ? $cfg : [];
    return $local;
}

/**
 * true en etapa de muestra al cliente.
 * - Sin local.php ? demo (cache corto)
 * - local.php con demo_mode ? respeta ese valor
 * - local.php sin demo_mode ? demo=false (producciÛn con private path)
 */
function assetDemoMode(): bool
{
    $cfg = assetLocalConfig();
    if (array_key_exists('demo_mode', $cfg)) {
        return (bool) $cfg['demo_mode'];
    }

    // Si hay local.php de producciÛn pero sin demo_mode, asumimos prod.
    if (is_file(__DIR__ . '/local.php')) {
        return false;
    }

    return true;
}

/**
 * URL de asset con cache-bust (?v=mtime).
 *
 * @param string $relativePath Ruta relativa al root del proyecto (ej. css/style.css)
 * @param string $urlPrefix Prefijo para pùginas en subcarpetas (ej. '../' desde admin/)
 */
function asset_url(string $relativePath, string $urlPrefix = ''): string
{
    $relativePath = ltrim(str_replace('\\', '/', $relativePath), '/');
    $root = dirname(__DIR__);
    $full = $root . '/' . $relativePath;
    $version = is_file($full) ? (string) filemtime($full) : (string) time();

    return $urlPrefix . $relativePath . '?v=' . rawurlencode($version);
}

/**
 * Headers anti-cache para HTML (y opcionalmente assets vùa .htaccess).
 */
function send_demo_cache_headers(): void
{
    if (!assetDemoMode()) {
        return;
    }

    if (headers_sent()) {
        return;
    }

    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    header('Expires: 0');
}

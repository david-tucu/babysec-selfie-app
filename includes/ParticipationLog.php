<?php

declare(strict_types=1);

require_once __DIR__ . '/PrivateStorage.php';

/**
 * Logs append-only de respaldo (independientes del SQLite).
 *
 * - log-participaciones.txt  ? alta de participante
 * - log-videos.txt           ? vínculo uuid ? archivo de video
 */
final class ParticipationLog
{
    private const PARTICIPACIONES = 'log-participaciones.txt';
    private const VIDEOS = 'log-videos.txt';

    /**
     * @param array{
     *   uuid: string,
     *   nombre: string,
     *   apellido: string,
     *   localidad: string,
     *   email: string,
     *   estado?: string,
     *   created_at?: string
     * } $data
     */
    public static function logRegistration(array $data): void
    {
        $line = implode("\t", [
            $data['created_at'] ?? appNowAtom(),
            'REGISTER',
            $data['uuid'] ?? '',
            self::clean($data['nombre'] ?? ''),
            self::clean($data['apellido'] ?? ''),
            self::clean($data['localidad'] ?? ''),
            self::clean($data['email'] ?? ''),
            self::clean($data['estado'] ?? 'registered'),
        ]);

        PrivateStorage::appendLog(self::PARTICIPACIONES, $line);
    }

    /**
     * @param array{
     *   uuid: string,
     *   nombre?: string,
     *   apellido?: string,
     *   email?: string,
     *   video_filename: string,
     *   video_mime?: string,
     *   video_size?: int,
     *   estado?: string,
     *   updated_at?: string
     * } $data
     */
    public static function logVideo(array $data): void
    {
        $line = implode("\t", [
            $data['updated_at'] ?? appNowAtom(),
            'VIDEO',
            $data['uuid'] ?? '',
            self::clean($data['video_filename'] ?? ''),
            (string) ($data['video_size'] ?? ''),
            self::clean($data['video_mime'] ?? ''),
            self::clean($data['estado'] ?? 'uploaded'),
            self::clean($data['nombre'] ?? ''),
            self::clean($data['apellido'] ?? ''),
            self::clean($data['email'] ?? ''),
        ]);

        PrivateStorage::appendLog(self::VIDEOS, $line);

        // También una línea de vínculo en el log de participaciones (fácil de grepear por uuid).
        $linkLine = implode("\t", [
            $data['updated_at'] ?? appNowAtom(),
            'VIDEO_LINK',
            $data['uuid'] ?? '',
            self::clean($data['video_filename'] ?? ''),
            (string) ($data['video_size'] ?? ''),
        ]);
        PrivateStorage::appendLog(self::PARTICIPACIONES, $linkLine);
    }

    private static function clean(string $value): string
    {
        $value = str_replace(["\t", "\r", "\n"], ' ', $value);
        return trim($value);
    }
}

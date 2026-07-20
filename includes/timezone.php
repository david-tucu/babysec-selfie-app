<?php

declare(strict_types=1);

/** Zona horaria de la experiencia (Argentina). */
const APP_TIMEZONE = 'America/Argentina/Buenos_Aires';

date_default_timezone_set(APP_TIMEZONE);

/**
 * @return DateTimeZone
 */
function appTimezone(): DateTimeZone
{
    static $tz = null;
    return $tz ??= new DateTimeZone(APP_TIMEZONE);
}

/**
 * Instantánea actual en zona de la app, formato ATOM.
 */
function appNowAtom(): string
{
    return (new DateTimeImmutable('now', appTimezone()))->format(DateTimeInterface::ATOM);
}

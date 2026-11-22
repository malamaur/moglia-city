// Sole e meteo reali per Moglia.
// - sunPosition(): posizione astronomica del sole (algoritmo semplificato NOAA, errore < 1°)
// - fetchWeather(): meteo attuale da Open-Meteo (gratuito, senza chiave, CORS aperto)
// - weatherInfo(): traduce il codice meteo WMO in un tipo di effetto, un'icona e un'etichetta

const RAD = Math.PI / 180;

// Restituisce { alt, az } in radianti: alt = altezza sull'orizzonte, az = azimut da nord in senso orario.
export function sunPosition(date, lat, lon) {
  const d = date.getTime() / 86400000 - 10957.5; // giorni da J2000.0 (1/1/2000 12:00 UTC)
  const g = (357.529 + 0.98560028 * d) * RAD; // anomalia media
  const q = 280.459 + 0.98564736 * d; // longitudine media
  const L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * RAD; // longitudine eclittica
  const e = (23.439 - 0.00000036 * d) * RAD; // obliquità
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = ((18.697374558 + 24.06570982441908 * d) % 24 + 24) % 24; // ore
  const H = (gmst * 15 + lon) * RAD - ra; // angolo orario
  const phi = lat * RAD;
  const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  const az = Math.atan2(-Math.sin(H), Math.tan(dec) * Math.cos(phi) - Math.sin(phi) * Math.cos(H));
  return { alt, az: (az + Math.PI * 2) % (Math.PI * 2) };
}

// Direzione verso il sole nel sistema del gioco: x = est, y = alto, z = sud.
export function sunVector(alt, az, out) {
  const c = Math.cos(alt);
  out.set(Math.sin(az) * c, Math.sin(alt), -Math.cos(az) * c);
  return out;
}

// Ora locale di Moglia (Europe/Rome) in ore decimali, anche se il giocatore è in un altro fuso.
export function mogliaHours(date) {
  try {
    const p = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(date);
    const v = (t) => +(p.find(x => x.type === t) || { value: 0 }).value;
    return v('hour') + v('minute') / 60 + v('second') / 3600;
  } catch (_) {
    return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  }
}

const CODES = {
  0: ['clear', '☀️', 'Sereno'], 1: ['clear', '🌤️', 'Poco nuvoloso'], 2: ['cloudy', '⛅', 'Parzialmente nuvoloso'], 3: ['cloudy', '☁️', 'Coperto'],
  45: ['fog', '🌫️', 'Nebbia'], 48: ['fog', '🌫️', 'Nebbia con brina'],
  51: ['drizzle', '🌦️', 'Pioviggine leggera'], 53: ['drizzle', '🌦️', 'Pioviggine'], 55: ['drizzle', '🌧️', 'Pioviggine intensa'],
  56: ['drizzle', '🌧️', 'Pioviggine gelata'], 57: ['drizzle', '🌧️', 'Pioviggine gelata'],
  61: ['rain', '🌦️', 'Pioggia debole'], 63: ['rain', '🌧️', 'Pioggia'], 65: ['rain', '🌧️', 'Pioggia forte'],
  66: ['rain', '🌧️', 'Pioggia gelata'], 67: ['rain', '🌧️', 'Pioggia gelata forte'],
  71: ['snow', '🌨️', 'Neve debole'], 73: ['snow', '🌨️', 'Neve'], 75: ['snow', '❄️', 'Neve forte'], 77: ['snow', '🌨️', 'Nevischio'],
  80: ['rain', '🌦️', 'Rovesci'], 81: ['rain', '🌧️', 'Rovesci'], 82: ['rain', '⛈️', 'Rovesci violenti'],
  85: ['snow', '🌨️', 'Rovesci di neve'], 86: ['snow', '❄️', 'Rovesci di neve forti'],
  95: ['storm', '⛈️', 'Temporale'], 96: ['storm', '⛈️', 'Temporale con grandine'], 99: ['storm', '⛈️', 'Temporale con grandine'],
};
export function weatherInfo(code) {
  const c = CODES[code] || CODES[0];
  return { kind: c[0], icon: c[1], label: c[2] };
}

export async function fetchWeather(lat, lon, timeoutMs = 8000) {
  const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat.toFixed(4) + '&longitude=' + lon.toFixed(4) +
    '&current=temperature_2m,weather_code,cloud_cover,precipitation,rain,snowfall,wind_speed_10m,wind_direction_10m,visibility&timezone=Europe%2FRome';
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const t = setTimeout(() => ctl && ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, ctl ? { signal: ctl.signal } : undefined);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json(), c = j.current || {};
    const code = c.weather_code | 0, info = weatherInfo(code);
    return {
      code, ...info,
      temp: c.temperature_2m, clouds: (c.cloud_cover ?? 0) / 100,
      precip: c.precipitation ?? 0, snow: c.snowfall ?? 0,
      wind: c.wind_speed_10m ?? 0, windDir: c.wind_direction_10m ?? 0,
      visibility: c.visibility ?? 20000, time: c.time || null,
    };
  } finally { clearTimeout(t); }
}

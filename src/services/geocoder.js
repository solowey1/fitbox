/**
 * Адрес → координаты.
 *
 * Если задан YANDEX_GEOCODER_API_KEY — Геокодер Яндекса (точнее по домам),
 * иначе — Nominatim (OpenStreetMap), бесплатно и без ключа.
 * Правила Nominatim: не чаще 1 запроса в секунду и свой User-Agent —
 * поэтому запросы идут по очереди, а ответы запоминаются.
 */

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const YANDEX_URL = 'https://geocode-maps.yandex.ru/1.x/';
const USER_AGENT = process.env.GEOCODER_USER_AGENT || 'fitbox-backend/1.0 (+https://fitbox.su)';
const TIMEOUT_MS = 8000;

const MEMORY_LIMIT = 2000;
const memory = new Map(); // запрос -> результат (null — адрес не найден)

const remember = (key, value) => {
  if (memory.size >= MEMORY_LIMIT) memory.delete(memory.keys().next().value);
  memory.set(key, value);
};

// Очередь для Nominatim: следующий запрос не раньше чем через секунду
let queue = Promise.resolve();
let lastRequestAt = 0;
const throttled = task => {
  const run = queue.then(async () => {
    const wait = lastRequestAt + 1100 - Date.now();
    if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
    lastRequestAt = Date.now();
    return task();
  });
  queue = run.catch(() => {});
  return run;
};

const fetchJson = async (url) => {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', 'Accept-Language': 'ru' },
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (!response.ok) throw new Error(`Геокодер: HTTP ${response.status}`);
  return response.json();
};

/** Точность «дом» — иначе по одной улице зону не определить: улица может идти через несколько зон */
const geocodeNominatim = async ({ city, street, house }) => {
  const params = new URLSearchParams({
    format: 'jsonv2',
    limit: '1',
    countrycodes: 'ru',
    addressdetails: '0',
    city,
    street: `${house} ${street}`.trim()
  });
  const data = await throttled(() => fetchJson(`${NOMINATIM_URL}?${params}`));
  const place = data[0];
  if (!place) return null;
  return {
    lat: parseFloat(place.lat),
    lon: parseFloat(place.lon),
    address: place.display_name,
    precise: place.addresstype === 'building' || place.category === 'building' || place.type === 'house',
    provider: 'nominatim'
  };
};

const geocodeYandex = async ({ city, street, house }) => {
  const params = new URLSearchParams({
    apikey: process.env.YANDEX_GEOCODER_API_KEY,
    format: 'json',
    results: '1',
    lang: 'ru_RU',
    geocode: `${city}, ${street}, ${house}`
  });
  const data = await fetchJson(`${YANDEX_URL}?${params}`);
  const member = data.response.GeoObjectCollection.featureMember[0];
  if (!member) return null;
  const object = member.GeoObject;
  const [lon, lat] = object.Point.pos.split(' ').map(Number);
  const precision = object.metaDataProperty.GeocoderMetaData.precision;
  return {
    lat,
    lon,
    address: object.metaDataProperty.GeocoderMetaData.text,
    precise: precision === 'exact' || precision === 'number' || precision === 'near',
    provider: 'yandex'
  };
};

/**
 * { city, street, house } → { lat, lon, address, precise, provider } или null.
 * Корпус/строение дописываем к дому: «15к2».
 */
const geocode = async ({ city, street, house, corpus }) => {
  const fullHouse = corpus ? `${house}к${corpus}` : house;
  const query = { city: city.trim(), street: street.trim(), house: String(fullHouse || '').trim() };
  const key = JSON.stringify(query).toLowerCase();
  if (memory.has(key)) return memory.get(key);

  let result = process.env.YANDEX_GEOCODER_API_KEY ? await geocodeYandex(query) : await geocodeNominatim(query);
  // с корпусом дом могут не найти — пробуем без него
  if (!result && corpus) {
    result = await geocode({ city, street, house, corpus: '' });
  }

  remember(key, result);
  return result;
};

module.exports = { geocode };

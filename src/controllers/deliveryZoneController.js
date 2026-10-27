const zonesByCity = require('../data/delivery-zones.json');
const { geocode } = require('../services/geocoder');

/**
 * Зона доставки по адресу из корзины
 * GET /api/tilda/delivery-zone?city=Казань&street=Чуйкова&house=54&corpus=
 *
 * Зоны — полигоны с карты Яндекс Конструктора (src/data/delivery-zones.json,
 * обновляются скриптом scripts/update-delivery-zones.js). Надбавка зоны — surcharge, ₽.
 *
 * Ответ:
 * - { status: 'found', surcharge, zone, color, point, address } — адрес в зоне доставки
 *   (color — цвет зоны на карте города, по нему корзина подписывает зону);
 * - { status: 'outside', point, address } — адрес найден, но вне зон;
 * - { status: 'not_found' } — геокодер адрес не нашёл;
 * - { status: 'no_zones' } — для города зоны не заданы.
 */

/** Точка внутри кольца: луч вправо пересекает контур нечётное число раз */
const inRing = ([lon, lat], ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

/** Первый контур — граница, остальные — дырки */
const inPolygon = (point, polygon) => inRing(point, polygon[0]) && !polygon.slice(1).some(hole => inRing(point, hole));

/** Зоны отсортированы по zIndex: если полигоны перекрываются, берём верхний — как на карте */
const findZone = (city, lon, lat) => {
  const zones = (zonesByCity[city] && zonesByCity[city].zones) || [];
  return zones.find(zone => inPolygon([lon, lat], zone.polygon)) || null;
};

const clean = value => String(value || '').trim().slice(0, 200);

const getDeliveryZone = async (req, res) => {
  const city = clean(req.query.city);
  const street = clean(req.query.street);
  const house = clean(req.query.house);
  const corpus = clean(req.query.corpus);

  if (!city || !street || !house) {
    return res.status(400).json({ error: 'Bad request', message: 'Нужны city, street и house' });
  }

  if (!zonesByCity[city]) return res.json({ status: 'no_zones', city });

  try {
    const place = await geocode({ city, street, house, corpus });
    if (!place) return res.json({ status: 'not_found', city });

    const point = [place.lat, place.lon];
    const zone = findZone(city, place.lon, place.lat);
    if (!zone) return res.json({ status: 'outside', city, point, address: place.address, precise: place.precise });

    res.json({
      status: 'found',
      city,
      surcharge: zone.surcharge,
      zone: zone.title,
      color: zone.color,
      point,
      address: place.address,
      precise: place.precise
    });
  } catch (error) {
    console.error('Ошибка определения зоны доставки:', error.message);
    res.status(502).json({ error: 'Bad gateway', message: 'Не удалось определить адрес' });
  }
};

module.exports = { getDeliveryZone, findZone };

/**
 * Выгрузка зон доставки из карты Яндекс Конструктора в src/data/delivery-zones.json.
 *
 * Запускать после того, как зоны поменяли на карте:
 *   node scripts/update-delivery-zones.js
 * затем закоммитить JSON и перезапустить сервер.
 *
 * Надбавка зоны берётся из названия полигона: «Бесплатная зона доставки» — 0,
 * «Зона доставки + 200 рублей» — 200. Полигон без суммы в названии — ошибка.
 * Цвет зоны — цвет заливки полигона: в разных городах одна надбавка бывает разного цвета.
 */
const fs = require('fs');
const path = require('path');

// Карты по городам (блок с картой на главной каждого сайта): ключ — значение поля «Город» в корзине.
// У Димитровграда карты зон нет.
const MAPS = {
  'Ульяновск': 'constructor:2d01253bc37341a757796900d077150c1ddad97ae60820252c60dcf58a74fa80',
  'Казань': 'constructor:dbe528f4a0a3d471f6091c4881f1759bfe066864daa3d61cac52a7957a3c8220',
  'Самара': 'constructor:14004d1c20d1b275878bb0b52bca26e5412d82ca848c15ae89657b38fba4958e',
  'Тольятти': 'constructor:f2718b1575e9d0b3d28eeea1782ebbbe7e5b53afc86e93dbbc13caa3f7d6fb8d'
};

const OUTPUT = path.join(__dirname, '../src/data/delivery-zones.json');

const surchargeFromTitle = (title) => {
  if (/бесплатн/i.test(title)) return 0;
  const match = /\+\s*(\d+)/.exec(title);
  if (!match) throw new Error(`Не понятна надбавка в названии зоны: «${title}»`);
  return parseInt(match[1], 10);
};

// 6 знаков после запятой — около 10 см, точнее не нужно
const round = value => Math.round(value * 1e6) / 1e6;

/** Данные карты лежат в JSON-состоянии страницы виджета (поле userMap) */
const loadUserMap = async (um) => {
  const url = `https://yandex.ru/map-widget/v1/?um=${encodeURIComponent(um)}&source=constructor`;
  const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (fitbox delivery zones)' } });
  if (!response.ok) throw new Error(`HTTP ${response.status} — ${url}`);
  const html = await response.text();

  const scripts = html.match(/<script[^>]*>[\s\S]*?<\/script>/g) || [];
  const state = scripts.find(script => script.includes('"userMap"') && script.includes('"coordinates"'));
  if (!state) throw new Error(`На странице карты нет данных зон (возможно, капча) — ${url}`);

  const json = state.slice(state.indexOf('{'), state.lastIndexOf('}') + 1);
  const find = (node) => {
    if (!node || typeof node !== 'object') return null;
    if (node.userMap && Array.isArray(node.userMap.features)) return node.userMap;
    for (const value of Object.values(node)) {
      const found = find(value);
      if (found) return found;
    }
    return null;
  };
  const userMap = find(JSON.parse(json));
  if (!userMap) throw new Error(`Не найден userMap — ${url}`);
  return userMap;
};

const run = async () => {
  const result = {};

  for (const [city, um] of Object.entries(MAPS)) {
    const userMap = await loadUserMap(um);
    const zones = userMap.features
      .filter(feature => feature.geometry && feature.geometry.type === 'Polygon')
      .map(feature => ({
        title: feature.title,
        surcharge: surchargeFromTitle(feature.title),
        zIndex: feature.zIndex || 0,
        // цвет заливки на карте: по нему в корзине подписывается зона («Желтая зона»)
        color: ((feature.fill && feature.fill.color) || '').toLowerCase() || null,
        // [[долгота, широта], …] — внешний контур и дырки, как в GeoJSON
        polygon: feature.geometry.coordinates.map(ring => ring.map(([lon, lat]) => [round(lon), round(lat)]))
      }))
      .sort((a, b) => b.zIndex - a.zIndex);

    result[city] = {
      map: um,
      title: userMap.title,
      mapUpdatedAt: userMap.lastUpdated ? new Date(userMap.lastUpdated * 1000).toISOString() : null,
      zones
    };

    const bySurcharge = zones.reduce((acc, zone) => ({ ...acc, [zone.surcharge]: (acc[zone.surcharge] || 0) + 1 }), {});
    console.log(`${city}: ${zones.length} зон`, bySurcharge);
  }

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(result)}\n`);
  console.log(`Сохранено: ${path.relative(process.cwd(), OUTPUT)}`);
};

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

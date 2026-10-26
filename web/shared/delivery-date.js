/*!
 * delivery-date.js
 *
 * Логика доступных дат доставки Fitbox по местному времени города.
 * Чистые функции, никакого DOM — этим занимается delivery-datepicker.js
 *
 * API:
 *   NCDM_DELIVERY.getMinDeliveryDate('Казань')     -> timestamp (UTC-полночь)
 *   NCDM_DELIVERY.getLateDeliveryDate('Казань')    -> ближайшая дата, если заказать после отсечки
 *   NCDM_DELIVERY.isDateAllowed('Казань', date)    -> boolean
 *   NCDM_DELIVERY.isBeforeCutoff('Казань')         -> boolean
 *   NCDM_DELIVERY.getSelectedCity(form)            -> 'Казань' | null
 *   NCDM_DELIVERY.debugCity()                      -> что скрипт видит в форме
 *   NCDM_DELIVERY.debugTable()                     -> таблица дат по всем дням недели
 */
(function () {
  'use strict';

  // ==================== НАСТРОЙКИ ====================

  var CONFIG = {
    /**
     * Общие правила. Любой город может переопределить любое из них в CONFIG.cities.
     * Для города, которого нет в CONFIG.cities, действуют только эти правила.
     */
    defaults: {
      utcOffset: 4,         // часовой пояс по умолчанию, UTC+4
      cutoffHour: 14,       // отсечка по местному времени
      beforeCutoff: 2,      // до 14:00 — через 2 дня
      afterCutoff: 3,       // с 14:00 — через 3 дня
      closedWeekdays: [],   // 0=вс, 1=пн ... 6=сб. Пусто = возим все дни
      closedDates: [],      // праздники: ['2026-12-31', '2027-01-01']
      overrides: {}         // особые правила, например: { '5:after': { nextWeekday: 2 } } —
                            // пятница после 14:00 -> ближайший вторник; или { plusDays: 4 }
    },

    // Ключ — значение поля «Город» в корзине (select[name="city"])
    cities: {
      'Ульяновск': { utcOffset: 4 },
      'Казань': { utcOffset: 3, closedWeekdays: [1, 3, 6] }, // не возим в пн, ср, сб
      'Самара': { utcOffset: 4 },
      'Тольятти': { utcOffset: 4 },
      'Димитровград': { utcOffset: 4 }
    },

    citySelector: 'select[name="city"]',

    // Если в форме нет поля города — определяем его по поддомену
    subdomains: {
      '': 'Ульяновск',
      'kzn': 'Казань',
      'smr': 'Самара',
      'tlt': 'Тольятти',
      'dmt': 'Димитровград'
    }
  };

  var DAY = 86400000;
  var HOUR = 3600000;

  // ==================== НАСТРОЙКИ ГОРОДА ====================

  /** Общие правила + правила города. */
  function getCityConfig(city) {
    var own = CONFIG.cities[city] || {};
    var result = {};

    for (var key in CONFIG.defaults) {
      result[key] = own[key] !== undefined ? own[key] : CONFIG.defaults[key];
    }

    return result;
  }

  // ==================== ДАТЫ ====================

  /** Текущие «гражданские» дата и время в городе, независимо от таймзоны браузера. */
  function getNow(city) {
    var local = new Date(Date.now() + getCityConfig(city).utcOffset * HOUR);

    return {
      date: Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()),
      hour: local.getUTCHours(),
      minute: local.getUTCMinutes()
    };
  }

  function addDays(ts, n) { return ts + n * DAY; }
  function weekdayOf(ts) { return new Date(ts).getUTCDay(); }
  function toISO(ts) { return new Date(ts).toISOString().slice(0, 10); }

  /** Понимает Date, timestamp, '2026-08-01' и '01.08.2026'. */
  function toTimestamp(value) {
    if (value instanceof Date) {
      return Date.UTC(value.getFullYear(), value.getMonth(), value.getDate());
    }
    if (typeof value === 'number') return value;

    var str = String(value || '').trim();

    var iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(str);
    if (iso) return Date.UTC(+iso[1], +iso[2] - 1, +iso[3]);

    var ru = /^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/.exec(str);
    if (ru) return Date.UTC(+ru[3], +ru[2] - 1, +ru[1]);

    return NaN;
  }

  function nextWeekdayAfter(ts, weekday) {
    var diff = (weekday - weekdayOf(ts) + 7) % 7;
    return addDays(ts, diff === 0 ? 7 : diff);
  }

  function isClosedDay(cfg, ts) {
    return cfg.closedWeekdays.indexOf(weekdayOf(ts)) !== -1 ||
           cfg.closedDates.indexOf(toISO(ts)) !== -1;
  }

  function isBeforeCutoff(city, now) {
    now = now || getNow(city);
    return now.hour < getCityConfig(city).cutoffHour;
  }

  /** Минимальная доступная дата доставки для города. */
  function getMinDeliveryDate(city, now) {
    if (!city) return null;

    var cfg = getCityConfig(city);
    now = now || getNow(city);

    var isBefore = now.hour < cfg.cutoffHour;
    var key = weekdayOf(now.date) + ':' + (isBefore ? 'before' : 'after');
    var override = cfg.overrides && cfg.overrides[key];
    var min;

    if (override && typeof override.nextWeekday === 'number') {
      min = nextWeekdayAfter(now.date, override.nextWeekday);
    } else if (override && typeof override.plusDays === 'number') {
      min = addDays(now.date, override.plusDays);
    } else {
      min = addDays(now.date, isBefore ? cfg.beforeCutoff : cfg.afterCutoff);
    }

    for (var i = 0; i < 30 && isClosedDay(cfg, min); i++) min = addDays(min, 1);

    return min;
  }

  /** Ближайшая дата, если заказать сегодня уже после отсечки — для подсказки «после 14:00 — …». */
  function getLateDeliveryDate(city, now) {
    if (!city) return null;

    now = now || getNow(city);
    return getMinDeliveryDate(city, {
      date: now.date,
      hour: getCityConfig(city).cutoffHour,
      minute: 0
    });
  }

  function isDateAllowed(city, date, now) {
    if (!city) return false;

    var ts = toTimestamp(date);
    if (isNaN(ts)) return false;

    return ts >= getMinDeliveryDate(city, now) && !isClosedDay(getCityConfig(city), ts);
  }

  // ==================== ГОРОД ИЗ ФОРМЫ ====================

  function getCityFromSubdomain() {
    var parts = window.location.hostname.split('.');
    var subdomain = parts.length > 2 && parts[0] !== 'www' ? parts[0] : '';
    return CONFIG.subdomains[subdomain] || null;
  }

  /** Город из поля корзины, иначе — по поддомену. */
  function getSelectedCity(scope) {
    scope = scope || document;

    var select = scope.querySelector(CONFIG.citySelector);
    var value = select ? String(select.value || '').trim() : '';

    return value || getCityFromSubdomain();
  }

  // ==================== ДИАГНОСТИКА ====================

  /** Показывает, что скрипт видит в форме и какие правила применит. */
  function debugCity(scope) {
    var select = (scope || document).querySelector(CONFIG.citySelector);
    var city = getSelectedCity(scope);
    var info = {
      'Поле города': select ? (select.value || '(пусто)') : 'не найдено',
      'Поддомен': getCityFromSubdomain() || '—',
      'Город': city || 'не определён',
      'Есть в настройках': city ? !!CONFIG.cities[city] : false,
      'Правила': city ? JSON.stringify(getCityConfig(city)) : '—'
    };

    if (console.table) console.table(info); else console.log(info);
    return info;
  }

  function debugTable() {
    var names = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
    var base = Date.UTC(2026, 6, 26); // воскресенье
    var rows = [];

    for (var d = 0; d < 7; d++) {
      ['before', 'after'].forEach(function (when) {
        var label = names[weekdayOf(addDays(base, d))] + (when === 'before' ? ' до отсечки' : ' после');
        var row = { 'Заказ': label };

        Object.keys(CONFIG.cities).forEach(function (city) {
          var cutoff = getCityConfig(city).cutoffHour;
          var now = { date: addDays(base, d), hour: when === 'before' ? cutoff - 1 : cutoff, minute: 0 };
          var min = getMinDeliveryDate(city, now);
          row[city] = names[weekdayOf(min)] + ' ' + toISO(min);
        });

        rows.push(row);
      });
    }

    if (console.table) console.table(rows); else console.log(rows);
    return rows;
  }

  window.NCDM_DELIVERY = {
    CONFIG: CONFIG,
    getCityConfig: getCityConfig,
    getNow: getNow,
    isBeforeCutoff: isBeforeCutoff,
    getMinDeliveryDate: getMinDeliveryDate,
    getLateDeliveryDate: getLateDeliveryDate,
    isDateAllowed: isDateAllowed,
    getSelectedCity: getSelectedCity,
    toTimestamp: toTimestamp,
    toISO: toISO,
    debugCity: debugCity,
    debugTable: debugTable
  };
})();

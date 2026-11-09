/**
 * Промо-галерея: слайдер с промо-картинками
 *  - в корзине: в боковой панели и на странице корзины (T706);
 *  - во всплывающем окне в углу (T945 с якорем #popup:promo-gallery) — открывается при загрузке,
 *    после закрытия не показывается сутки (localStorage, на каждом поддомене своё).
 *
 * Подключение — T123 rec1357805181 на каждом сайте, вместо старой разметки #cart-gallery и скрипта:
 * тег script с src="https://app.fitbox.su/web/shared/promo-gallery.js" и атрибутом defer
 * (точная строка — в documents/TILDA_CONNECT.md).
 *
 * Стили скрипт добавляет сам и не зависит от CSS-класса блока в Тильде:
 * окно находится по якорю, у копий блока на поддоменах класс «uc-popup-promo-gal» потерялся.
 */
(function () {
  'use strict';

  if (window.FITBOX_PROMO) return;

  // Адрес сервера — тот же, с которого загружен этот скрипт
  var ORIGIN = (function () {
    var script = document.currentScript;
    return script && script.src ? new URL(script.src).origin : 'https://app.fitbox.su';
  })();

  var CONFIG = {
    images: [
      // 0 — сертификат
      'https://static.tildacdn.com/tild6538-6332-4331-a533-316362633930/Frame_5101.png',
      // 1 — отзыв
      'https://static.tildacdn.com/tild6136-6433-4039-a631-313430646663/Frame_5091.png',
      // 2 — день рождения
      'https://static.tildacdn.com/tild3331-3366-4736-a133-366637363730/Frame_5081.png',
      // 3 — приведи друга
      'https://static.tildacdn.com/tild6138-3362-4235-a236-313432336361/Frame_5071.png',
      // 4 — бонусная программа
      'https://static.tildacdn.com/tild6665-3639-4436-a132-396230626337/Frame_5061.png',
      // 5 — заказ нескольких рационов
      'https://static.tildacdn.com/tild6432-3736-4664-b131-396130636361/Frame_5051.png',
    ],
    ratio: '16 / 9',  // картинки 640×360
    autoplay: 6000,   // смена слайда, мс
    shuffle: true,    // порядок слайдов случайный
    places: {
      sidebar: { wrapper: '.t706__sidebar-content', images: [5, 2, 0] },
      page: { wrapper: '.t706__cartpage-info-wrapper', images: [3, 5, 1] },
      popup: {
        hook: '#popup:promo-gallery',
        images: [5, 3, 1],
        openOnLoad: true,
        hideAfterCloseHours: 24,               // после закрытия не показывать столько часов
        storageKey: 'fitbox-promo-popup-closed', // когда закрыли (мс), localStorage
        // Слой окна — под мобильным меню (полоса 991, раскрытое меню 999, затемнение 991)
        // и баннером cookie (100001), но над содержимым страницы. Тильда по умолчанию ставит окну 10000001.
        zIndex: 990,
      },
    },
    swiper: {
      js: '/web/vendor/swiper-12.2.0.min.js',
      css: '/web/vendor/swiper-12.2.0.min.css',
    },
  };

  // Свои имена классов: старые правила из cart.css (.swiper-gallery, .t945__popup-gallery) их не задевают
  var CSS = [
    '.fbp-wrap { box-sizing: border-box; width: 100%; }',
    '.fbp-wrap--sidebar, .fbp-wrap--page { padding-top: 50px; }',
    '.fbp-gallery {',
    '  --swiper-theme-color: #121212;',
    '  --swiper-pagination-color: #121212;',
    '  --swiper-pagination-left: auto;',
    '  --swiper-pagination-right: 8px;',
    '  --swiper-pagination-bottom: 8px;',
    '  --swiper-pagination-top: auto;',
    '  --swiper-pagination-bullet-size: 8px;',
    '  --swiper-pagination-bullet-inactive-color: #000;',
    '  --swiper-pagination-bullet-inactive-opacity: .2;',
    '  --swiper-pagination-bullet-horizontal-gap: 4px;',
    '  border-radius: 20px;',
    '  overflow: hidden;',
    '}',
    // картинка во всю ширину, высота — по пропорциям: без полей и без обрезки снизу
    '.fbp-gallery .swiper-slide img {',
    '  display: block;',
    '  width: 100%;',
    '  height: auto;',
    '  aspect-ratio: ' + CONFIG.ratio + ';',
    '  object-fit: cover;',
    '}',
    // окно: Тильда даёт .t-popup поля 0 20px и белый фон — картинка должна занимать окно целиком
    '.t945__popup.fbp-popup {',
    '  padding: 0 !important;',
    '  background: transparent !important;',
    '  overflow: hidden;',
    '  z-index: ' + CONFIG.places.popup.zIndex + ' !important;',
    '}',
    '.fbp-popup .fbp-gallery { border-radius: inherit; }',
    '.fbp-popup .t-popup__close {',
    '  position: absolute;',
    '  top: 12px !important;',
    '  right: 12px !important;',
    '  z-index: 2;',
    '  width: 24px;',
    '  height: 24px;',
    '  display: flex;',
    '  align-items: center;',
    '  justify-content: center;',
    '  background: #ffffff;',
    '  border-radius: 50%;',
    '}',
    '.fbp-popup .t-popup__close-wrapper { display: flex; padding: 0; background: none; border: 0; cursor: pointer; }',
    '.fbp-popup .t-popup__close-icon { width: 12px; height: 12px; }',
  ].join('\n');

  function addStyles() {
    if (document.getElementById('fbp-styles')) return;
    var style = document.createElement('style');
    style.id = 'fbp-styles';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  // Swiper на сайтах уже подключён; если нет — грузим свой из web/vendor
  function whenSwiper(callback) {
    if (window.Swiper) return callback();

    var existing = document.querySelector('script[src*="swiper"]');
    if (existing) {
      existing.addEventListener('load', function () { callback(); });
      // скрипт мог загрузиться между проверками
      setTimeout(function () { if (window.Swiper) callback(); }, 0);
      return;
    }

    if (!document.querySelector('link[href*="swiper"]')) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = ORIGIN + CONFIG.swiper.css;
      document.head.appendChild(link);
    }
    var script = document.createElement('script');
    script.src = ORIGIN + CONFIG.swiper.js;
    script.onload = callback;
    document.head.appendChild(script);
  }

  function shuffled(list) {
    var result = list.slice();
    for (var i = result.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = result[i];
      result[i] = result[j];
      result[j] = tmp;
    }
    return result;
  }

  function buildGallery(type, images) {
    var wrap = document.createElement('div');
    wrap.className = 'fbp-wrap fbp-wrap--' + type;

    var gallery = document.createElement('div');
    gallery.className = 'swiper fbp-gallery';
    gallery.id = 'fbp-' + type;

    var slides = document.createElement('div');
    slides.className = 'swiper-wrapper';

    (CONFIG.shuffle ? shuffled(images) : images).forEach(function (index) {
      var slide = document.createElement('div');
      slide.className = 'swiper-slide';
      var img = document.createElement('img');
      img.src = CONFIG.images[index];
      img.alt = '';
      img.loading = type === 'popup' ? 'eager' : 'lazy';
      slide.appendChild(img);
      slides.appendChild(slide);
    });

    var pagination = document.createElement('div');
    pagination.className = 'swiper-pagination';

    gallery.appendChild(slides);
    gallery.appendChild(pagination);
    wrap.appendChild(gallery);
    return wrap;
  }

  function startSwiper(gallery) {
    var swiper = new window.Swiper(gallery, {
      autoplay: { delay: CONFIG.autoplay },
      mousewheel: { enabled: true },
      loop: true,
      pagination: { el: gallery.querySelector('.swiper-pagination'), clickable: true },
      slidesPerView: 1,
      speed: 300,
    });
    if (swiper.autoplay) swiper.autoplay.start();
    return swiper;
  }

  function mountCart(type) {
    var place = CONFIG.places[type];
    var wrapper = document.querySelector(place.wrapper);
    if (!wrapper || wrapper.querySelector('.fbp-wrap')) return null;
    var wrap = buildGallery(type, place.images);
    wrapper.appendChild(wrap);
    return wrap.querySelector('.fbp-gallery');
  }

  // Тильда при открытии ставит фокус на окно (tilda-popup), и браузер прокручивает к нему страницу:
  // при медленной загрузке покупатель оказывается в середине страницы. Фокус — без прокрутки.
  function keepScrollOnFocus(element) {
    var focus = element.focus;
    element.focus = function (options) {
      var settings = {};
      if (options) Object.keys(options).forEach(function (key) { settings[key] = options[key]; });
      settings.preventScroll = true;
      return focus.call(this, settings);
    };
  }

  // ─── Окно: не показывать сутки после закрытия ───────────────────────────

  function closedAt() {
    try {
      return Number(window.localStorage.getItem(CONFIG.places.popup.storageKey)) || 0;
    } catch (error) {
      return 0; // localStorage недоступен (приватный режим) — показываем как обычно
    }
  }

  function isHiddenAfterClose() {
    var hours = CONFIG.places.popup.hideAfterCloseHours;
    return hours > 0 && Date.now() - closedAt() < hours * 3600 * 1000;
  }

  function rememberClose() {
    try {
      window.localStorage.setItem(CONFIG.places.popup.storageKey, String(Date.now()));
    } catch (error) {
      // не сохранилось — в следующий раз окно просто покажется снова
    }
  }

  // Закрытие ловим по классу t-popup_show: так срабатывают и крестик, и Esc, и любой другой способ Тильды
  function watchClose(popup) {
    var shown = popup.classList.contains('t-popup_show');
    new MutationObserver(function () {
      var nowShown = popup.classList.contains('t-popup_show');
      if (shown && !nowShown) rememberClose();
      shown = nowShown;
    }).observe(popup, { attributes: true, attributeFilter: ['class'] });
  }

  function mountPopup() {
    var place = CONFIG.places.popup;
    var popup = document.querySelector('.t945__popup[data-tooltip-hook="' + place.hook + '"]');
    if (!popup || popup.querySelector('.fbp-wrap')) return null;

    // закрыли меньше суток назад — окно не собираем и не открываем (ссылок на него на сайтах нет)
    if (isHiddenAfterClose()) return null;

    // пустая форма T945 не нужна — вместо неё галерея
    var container = popup.querySelector('.t945__container');
    if (container) container.remove();

    popup.classList.add('fbp-popup');
    keepScrollOnFocus(popup);
    watchClose(popup);
    var wrap = buildGallery('popup', place.images);
    popup.appendChild(wrap);

    if (place.openOnLoad) {
      var rec = popup.closest('.r');
      var recId = rec ? rec.id.replace('rec', '') : '';
      if (recId && typeof window.t_onFuncLoad === 'function') {
        window.t_onFuncLoad('t945_init', function () {
          window.t_onFuncLoad('t945_showPopup', function () {
            window.t945_showPopup(recId);
          });
        });
      }
    }

    return wrap.querySelector('.fbp-gallery');
  }

  var swipers = [];

  function init() {
    addStyles();

    var galleries = [mountCart('sidebar'), mountCart('page'), mountPopup()].filter(Boolean);
    if (!galleries.length) return;

    whenSwiper(function () {
      galleries.forEach(function (gallery) {
        if (!gallery.swiper) swipers.push(startSwiper(gallery));
      });
    });
  }

  window.FITBOX_PROMO = {
    init: init,
    // показать окно снова уже сегодня (для проверки)
    resetPopup: function () {
      try { window.localStorage.removeItem(CONFIG.places.popup.storageKey); } catch (error) { /* нет доступа */ }
    },
    debug: function () {
      return {
        origin: ORIGIN,
        swiperLoaded: Boolean(window.Swiper),
        popupClosedAt: closedAt() ? new Date(closedAt()).toLocaleString() : null,
        popupHiddenAfterClose: isHiddenAfterClose(),
        galleries: Array.prototype.map.call(document.querySelectorAll('.fbp-gallery'), function (g) {
          return g.id + (g.swiper ? ' (swiper)' : ' (без swiper)');
        }),
      };
    },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

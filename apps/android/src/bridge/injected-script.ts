import { SCHOLAR_ANDROID_MOBILE_CSS } from "@/webview/android-mobile-styles";

const ENCODED_ANDROID_CSS = JSON.stringify(SCHOLAR_ANDROID_MOBILE_CSS);

export function createScholarAndroidBootstrapScript(bottomInset: number): string {
  const safeBottom = Number.isFinite(bottomInset) ? Math.max(0, Math.round(bottomInset)) : 0;
  return String.raw`
(function () {
  var root = document.documentElement;
  root.dataset.scholarNative = 'android';
  root.style.setProperty('--scholar-android-native-bottom', '${safeBottom}px');

  var viewport = document.querySelector('meta[name="viewport"]');
  if (!viewport) {
    viewport = document.createElement('meta');
    viewport.setAttribute('name', 'viewport');
    (document.head || root).appendChild(viewport);
  }
  viewport.setAttribute(
    'content',
    'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover'
  );

  function applyScholarAndroidEnvironment() {
    root.dataset.scholarNative = 'android';
    if (document.body) document.body.classList.add('scholar-android');
    var style = document.getElementById('scholar-android-mobile-styles');
    if (!style) {
      style = document.createElement('style');
      style.id = 'scholar-android-mobile-styles';
      style.textContent = ${ENCODED_ANDROID_CSS};
      (document.head || root).appendChild(style);
    }
  }

  window.__SCHOLAR_APPLY_ANDROID_ENVIRONMENT__ = applyScholarAndroidEnvironment;
  if (!window.__SCHOLAR_ANDROID_ZOOM_GUARD__) {
    window.__SCHOLAR_ANDROID_ZOOM_GUARD__ = true;
    var blockMultiTouchZoom = function (event) {
      if (event.touches && event.touches.length > 1) event.preventDefault();
    };
    document.addEventListener('touchstart', blockMultiTouchZoom, { passive: false });
    document.addEventListener('touchmove', blockMultiTouchZoom, { passive: false });
    document.addEventListener('gesturestart', function (event) { event.preventDefault(); }, { passive: false });
    document.addEventListener('gesturechange', function (event) { event.preventDefault(); }, { passive: false });
    document.addEventListener('wheel', function (event) {
      if (event.ctrlKey) event.preventDefault();
    }, { passive: false });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyScholarAndroidEnvironment, { once: true });
  } else {
    applyScholarAndroidEnvironment();
  }
  true;
})();
`;
}

export const SCHOLAR_BRIDGE_SCRIPT = String.raw`
(function () {
  if (window.__SCHOLAR_NATIVE_BRIDGE__) return true;
  window.__SCHOLAR_NATIVE_BRIDGE__ = true;
  document.documentElement.dataset.scholarNative = 'android';
  if (window.__SCHOLAR_APPLY_ANDROID_ENVIRONMENT__) {
    window.__SCHOLAR_APPLY_ANDROID_ENVIRONMENT__();
  } else if (document.body) {
    document.body.classList.add('scholar-android');
  }

  var ANDROID_VIEWPORT = 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';
  function ensureAndroidPresentation() {
    var root = document.documentElement;
    root.dataset.scholarNative = 'android';
    if (document.body && !document.body.classList.contains('scholar-android')) {
      document.body.classList.add('scholar-android');
    }

    var viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) {
      viewport = document.createElement('meta');
      viewport.setAttribute('name', 'viewport');
      (document.head || root).appendChild(viewport);
    }
    if (viewport.getAttribute('content') !== ANDROID_VIEWPORT) {
      viewport.setAttribute('content', ANDROID_VIEWPORT);
    }

    var style = document.getElementById('scholar-android-mobile-styles');
    if (!style) {
      style = document.createElement('style');
      style.id = 'scholar-android-mobile-styles';
      style.textContent = ${ENCODED_ANDROID_CSS};
      (document.head || document.body || root).appendChild(style);
    }
  }

  ensureAndroidPresentation();
  window.setTimeout(ensureAndroidPresentation, 0);
  window.setTimeout(ensureAndroidPresentation, 250);
  window.setTimeout(ensureAndroidPresentation, 1000);

  var VERSION = 1;
  var lastOverlayState = null;
  var lastRoute = window.location.pathname + window.location.search;

  function post(type, payload) {
    if (!window.ReactNativeWebView) return;
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: type,
      version: VERSION,
      payload: payload
    }));
  }

  function isVisible(element) {
    if (!element) return false;
    var style = window.getComputedStyle(element);
    var rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  }

  function getOpenSurface() {
    var candidates = document.querySelectorAll(
      '[role="dialog"], [aria-modal="true"], [data-state="open"], [data-scholar-overlay="open"]'
    );
    for (var index = candidates.length - 1; index >= 0; index -= 1) {
      if (isVisible(candidates[index])) return candidates[index];
    }
    return null;
  }

  function publishUiState() {
    ensureAndroidPresentation();
    applyAndroidSemanticHooks();
    var route = window.location.pathname + window.location.search;
    if (route !== lastRoute) {
      lastRoute = route;
      var mainScroll = document.getElementById('main-scroll');
      if (mainScroll) mainScroll.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
    var hasOverlay = Boolean(getOpenSurface());
    if (hasOverlay === lastOverlayState) return;
    lastOverlayState = hasOverlay;
    post('UI_STATE', { hasOverlay: hasOverlay });
  }

  function addHook(element, className) {
    if (element && !element.classList.contains(className)) element.classList.add(className);
  }

  function findRouteRoot(element) {
    var current = element;
    var match = null;
    while (current && current !== document.body) {
      if (typeof current.className === 'string' && current.className.indexOf('min-h-[calc(100vh-4rem)]') !== -1) {
        match = current;
      }
      current = current.parentElement;
    }
    return match;
  }

  function applyAndroidSemanticHooks() {
    var guest = document.querySelector('section[aria-label="Guest session information"]');
    if (guest) {
      addHook(guest, 'scholar-guest-banner');
      addHook(guest.querySelector('p'), 'scholar-guest-copy');
      addHook(guest.querySelector('button'), 'scholar-guest-action');
    }

    document.querySelectorAll('[role="tablist"]').forEach(function (tabs) {
      if (tabs.querySelector('.asme-tab')) addHook(tabs, 'scholar-settings-tabs');
      if (tabs.closest('.scholar-notes') || document.querySelector('.mindloop-font-sans')) {
        var labels = Array.from(tabs.querySelectorAll('[role="tab"]')).map(function (tab) {
          return (tab.textContent || '').trim().toLowerCase();
        });
        if (labels.indexOf('folders') !== -1 && labels.indexOf('editor') !== -1) {
          addHook(tabs.parentElement && tabs.parentElement.parentElement, 'scholar-notes-tabs');
        }
      }
    });

    document.querySelectorAll('.bloom-glass[role="button"]').forEach(function (card) {
      addHook(card, 'scholar-feature-card');
      card.querySelectorAll(':scope > span.absolute').forEach(function (badge) {
        addHook(badge, 'scholar-feature-badge');
      });
    });

    document.querySelectorAll('[aria-label$="sponsor message"]').forEach(function (slot) {
      addHook(slot, 'scholar-free-ad-slot');
    });

    var nigtubeNav = document.querySelector('nav.nt-font');
    if (nigtubeNav && nigtubeNav.parentElement) {
      var nigtubeRoot = findRouteRoot(nigtubeNav);
      addHook(nigtubeRoot, 'scholar-nigtube');
      addHook(nigtubeNav.parentElement.querySelector('.nt-scroll.overflow-x-auto'), 'scholar-filter-rail');
      var nigtubeAd = nigtubeRoot && nigtubeRoot.querySelector('[aria-label="Scholar Plus promotion"]');
      if (nigtubeAd) {
        var nigtubePlayer = nigtubeAd.closest('.nt-glass-strong');
        addHook(nigtubePlayer, 'scholar-nigtube-player');
        addHook(nigtubePlayer && nigtubePlayer.querySelector(':scope > div.flex'), 'scholar-nigtube-fallback');
        addHook(nigtubeAd.querySelector(':scope > div.relative.z-10'), 'scholar-nigtube-ad-panel');
        addHook(nigtubeAd.querySelector('ul'), 'scholar-nigtube-ad-benefits');
      }
    }

    var labNav = document.querySelector('nav.lab-font');
    if (labNav && labNav.parentElement) {
      var labRails = labNav.parentElement.querySelectorAll('.overflow-x-auto');
      if (labRails.length) addHook(labRails[0], 'scholar-filter-rail');
    }

    var musicNav = document.querySelector('nav.mu-font');
    if (musicNav && musicNav.parentElement) {
      var musicRoot = findRouteRoot(musicNav);
      addHook(musicRoot, 'scholar-study-music');
      addHook(musicRoot && musicRoot.querySelector('.sticky.bottom-0'), 'scholar-music-player');
    }

    var notesBrand = document.querySelector('.mindloop-font-sans');
    if (notesBrand) {
      addHook(findRouteRoot(notesBrand), 'scholar-notes');
    }

    var settingsTab = document.querySelector('.asme-tab');
    if (settingsTab) {
      var settingsRoot = settingsTab.parentElement;
      while (settingsRoot && settingsRoot !== document.body) {
        if (settingsRoot.classList.contains('relative') && settingsRoot.querySelector('.asme-serif')) break;
        settingsRoot = settingsRoot.parentElement;
      }
      addHook(settingsRoot, 'scholar-settings');
    }

    document.querySelectorAll('.ai-tutor-scroll').forEach(function (scroll) {
      var fullscreen = scroll.closest('.fixed.inset-0');
      if (fullscreen) {
        addHook(fullscreen.querySelector(':scope > div.relative.z-10'), 'scholar-ai-tutor-fullscreen-header');
        addHook(scroll, 'scholar-ai-tutor-fullscreen-messages');
        Array.from(fullscreen.querySelectorAll(':scope > div')).forEach(function (region) {
          if (region.querySelector('textarea')) addHook(region, 'scholar-ai-tutor-composer');
        });
      } else {
        addHook(scroll.previousElementSibling, 'scholar-ai-tutor-header');
        addHook(scroll.nextElementSibling, 'scholar-ai-tutor-composer');
        addHook(findRouteRoot(scroll), 'scholar-ai-tutor');
      }
      scroll.querySelectorAll('[class*="max-w-[75%]"], [class*="max-w-[78%]"]').forEach(function (message) {
        addHook(message, 'scholar-ai-tutor-message');
      });
    });

    var dashboardGlass = document.querySelector('.dash-glass');
    if (dashboardGlass) {
      var dashboardRoot = findRouteRoot(dashboardGlass);
      addHook(dashboardRoot, 'scholar-dashboard');
      var dashboardHeading = dashboardRoot && dashboardRoot.querySelector('h1.font-garamond');
      if (dashboardHeading) {
        addHook(dashboardHeading.parentElement, 'scholar-dashboard-hero');
        addHook(dashboardHeading.parentElement.querySelector('.flex.items-center.gap-4'), 'scholar-dashboard-metrics');
      }
    }

    var landingNav = document.querySelector('section > nav.fixed');
    if (landingNav) addHook(landingNav.closest('section'), 'scholar-landing-hero');
    var capabilitiesHeading = document.querySelector('.lg-serif.text-6xl');
    if (capabilitiesHeading) addHook(capabilitiesHeading.closest('section'), 'scholar-landing-capabilities');
  }

  var uiStateFrame = null;
  function scheduleUiStatePublish() {
    if (uiStateFrame !== null) return;
    uiStateFrame = window.requestAnimationFrame(function () {
      uiStateFrame = null;
      publishUiState();
    });
  }

  function closeOpenSurface() {
    var surface = getOpenSurface();
    if (!surface) return false;
    surface.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Escape',
      code: 'Escape',
      bubbles: true,
      cancelable: true
    }));
    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Escape',
      code: 'Escape',
      bubbles: true,
      cancelable: true
    }));
    var closeButton = surface.querySelector(
      'button[aria-label*="close" i], button[data-scholar-close], [data-radix-dialog-close]'
    );
    if (closeButton && isVisible(closeButton)) closeButton.click();
    setTimeout(publishUiState, 0);
    return true;
  }

  function pauseMedia() {
    document.querySelectorAll('video, audio').forEach(function (media) {
      if (!media.paused) {
        media.dataset.scholarResume = 'true';
        media.pause();
      }
    });
  }

  function resumeMedia() {
    document.querySelectorAll('[data-scholar-resume="true"]').forEach(function (media) {
      delete media.dataset.scholarResume;
      var playResult = media.play();
      if (playResult && playResult.catch) playResult.catch(function () {});
    });
  }

  function handleNativeMessage(event) {
    var message;
    try { message = JSON.parse(event.data); } catch (_) { return; }
    if (!message || message.version !== VERSION || !message.payload) return;
    if (message.type === 'NATIVE_BACK') closeOpenSurface();
    if (message.type === 'APP_STATE') {
      if (message.payload.state === 'active') resumeMedia();
      else pauseMedia();
      window.dispatchEvent(new CustomEvent('scholar:native-app-state', {
        detail: { state: message.payload.state }
      }));
    }
    if (message.type === 'SAFE_AREA' && typeof message.payload.bottom === 'number') {
      var safeBottom = Math.max(0, Math.min(96, message.payload.bottom));
      document.documentElement.style.setProperty('--scholar-android-native-bottom', safeBottom + 'px');
    }
  }

  document.addEventListener('message', handleNativeMessage);
  window.addEventListener('message', handleNativeMessage);

  function syncAndroidViewport() {
    var viewport = window.visualViewport;
    var height = viewport ? viewport.height : window.innerHeight;
    document.documentElement.style.setProperty('--scholar-android-vh', height + 'px');
    document.documentElement.dataset.scholarKeyboardOpen = String(
      Boolean(viewport && window.innerHeight - viewport.height > 140)
    );
  }

  syncAndroidViewport();
  window.addEventListener('resize', syncAndroidViewport, { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', syncAndroidViewport, { passive: true });
    window.visualViewport.addEventListener('scroll', syncAndroidViewport, { passive: true });
  }

  new MutationObserver(scheduleUiStatePublish).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['aria-expanded', 'aria-hidden', 'aria-modal', 'data-state', 'data-scholar-overlay'],
    childList: true,
    subtree: true
  });
  applyAndroidSemanticHooks();
  publishUiState();
  post('WEB_READY', { url: window.location.href });
  true;
})();
`;

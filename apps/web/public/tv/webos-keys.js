/*
 * Phần chỉ dành cho điều khiển LG (webOS). Loader ở cuối index.html nạp file này
 * ngay sau tv-remote.js và dùng lại window.__tv mà tv-remote.js tạo ra.
 *
 * Lý do phải có file riêng: điều khiển LG gửi Back và các phím media bằng keyCode
 * riêng của webOS chứ không phải tên phím chuẩn (event.key rỗng), nên tv-remote.js
 * không thấy gì. Bảng mã: Back 461, Play 415, Pause 19, Stop 413, FF 417, Rew 412.
 */
(function () {
  'use strict';

  var BACK = 461;
  var PLAY = 415;
  var PAUSE = 19;
  var STOP = 413;
  var FORWARD = 417;
  var REWIND = 412;
  var SEEK_STEP = 10;
  var EXIT_WINDOW = 2500;

  var exitAt = 0;
  var toast = null;
  var toastTimer = 0;

  function tv() {
    return window.__tv || null;
  }

  /** Thông báo nhỏ ở giữa dưới. Tự làm chứ không dùng dialog vì dialog cần focus. */
  function say(message) {
    if (!toast) {
      toast = document.createElement('div');
      toast.setAttribute('aria-live', 'polite');
      toast.style.cssText = 'position:fixed;left:50%;bottom:64px;transform:translateX(-50%);'
        + 'z-index:99999;padding:14px 26px;border-radius:999px;pointer-events:none;'
        + 'background:rgba(11,8,6,.92);border:1px solid rgba(255,197,61,.35);color:#f7f0e7;'
        + 'font:500 20px/1.2 system-ui,sans-serif;letter-spacing:.02em;opacity:0;'
        + 'transition:opacity .18s';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = '1';
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toastTimer = 0;
      if (toast) toast.style.opacity = '0';
    }, EXIT_WINDOW - 200);
  }

  function fullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  function leaveFullscreen() {
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
  }

  /** Thoát app. webOS đóng app khi trang tự gọi window.close(). */
  function quit() {
    if (window.webOS && typeof window.webOS.platformBack === 'function') {
      window.webOS.platformBack();
      return;
    }
    window.close();
  }

  /*
   * Đang ở trang gốc của app hay không. Phải xét cả pathname và hash: bản hosted
   * dùng BrowserRouter nên route nằm ở pathname ('/phim/abc'), còn nếu sau này lại
   * chạy từ file:// thì route nằm sau dấu # và pathname là đường dẫn thật trong máy.
   * Đoán sai theo hướng "chưa ở gốc" thì Back sẽ lùi ra khỏi app; đoán sai hướng
   * kia thì Back ở trang con lại đòi thoát app.
   */
  function atRoot() {
    if (location.search) return false;
    var hash = location.hash;
    if (hash && hash !== '#' && hash !== '#/') return false;
    var path = location.pathname.replace(/\/+$/, '');
    return !path || /\/index\.html$/i.test(path);
  }

  /*
   * Back xử lý theo bậc: đang fullscreen thì ra khỏi fullscreen, còn trang để lùi
   * thì lùi, hết rồi mới thoát — và phải bấm hai lần trong 2,5 giây để thoát, đỡ
   * mất phim vì bấm lỡ. appinfo.json đặt disableBackHistoryAPI: true nên webOS
   * không tự gọi history.back() nữa; nếu không thì mỗi lần bấm sẽ lùi hai bước.
   */
  function goBack() {
    if (fullscreenElement()) {
      leaveFullscreen();
      return;
    }
    if (window.history.length > 1 && !atRoot()) {
      window.history.back();
      return;
    }
    var now = Date.now();
    if (now - exitAt < EXIT_WINDOW) {
      quit();
      return;
    }
    exitAt = now;
    say('Bấm Back lần nữa để thoát');
  }

  window.addEventListener('keydown', function (event) {
    var code = event.keyCode || 0;
    var helper = tv();
    if (code === BACK) {
      event.preventDefault();
      goBack();
      return;
    }
    if (!helper) return;
    if (code === PLAY || code === PAUSE || event.key === 'MediaPlayPause') {
      event.preventDefault();
      helper.toggle();
      return;
    }
    if (code === FORWARD) {
      event.preventDefault();
      helper.seek(SEEK_STEP);
      return;
    }
    if (code === REWIND) {
      event.preventDefault();
      helper.seek(-SEEK_STEP);
      return;
    }
    if (code === STOP) {
      event.preventDefault();
      if (fullscreenElement()) leaveFullscreen();
      helper.toggle();
    }
  }, true);

  /*
   * Magic Remote: khi con trỏ hiện ra, webOS bắn mousemove và ô đang chọn theo
   * D-pad không còn đúng nữa. Bỏ viền focus lúc dùng con trỏ, bấm phím thì trả lại.
   */
  var pointer = false;
  window.addEventListener('mousemove', function () {
    if (pointer) return;
    pointer = true;
    document.documentElement.setAttribute('data-tv-pointer', '');
  }, true);
  window.addEventListener('keydown', function () {
    if (!pointer) return;
    pointer = false;
    document.documentElement.removeAttribute('data-tv-pointer');
  }, true);

  // App bị đưa ra nền (bấm Home) thì dừng phim, khỏi phát tiếng dưới nền.
  document.addEventListener('webOSRelaunch', function () {
    var helper = tv();
    if (helper) helper.focusFirst();
  });
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) return;
    var videos = document.querySelectorAll('video');
    for (var i = 0; i < videos.length; i++) {
      if (!videos[i].paused) videos[i].pause();
    }
  });
})();

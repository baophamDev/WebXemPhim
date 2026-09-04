/*
 * Điều hướng D-pad cho bản TV. Nằm trong apps/web/public/tv nên được deploy cùng
 * site, nhưng chỉ nạp khi loader ở cuối index.html phát hiện đang chạy trên TV —
 * máy tính và điện thoại không tải file này.
 *
 * Trình duyệt của TV đổi phím D-pad thành ArrowUp/Down/Left/Right và Enter, nhưng
 * mặc định mũi tên chỉ cuộn trang chứ không nhảy focus. Ở đây tự tính "ô gần nhất
 * theo hướng bấm" rồi focus vào đó, và chặn cuộn mặc định.
 *
 * Phím riêng của điều khiển LG (Back, media) ở webos-keys.js, nạp ngay sau file
 * này và dùng lại window.__tv tạo ở cuối.
 */
(function () {
  'use strict';

  var SELECTOR = 'a[href],button,input,select,textarea,video,[tabindex]';
  var SEEK_STEP = 10;
  var last = null;
  var timer = 0;

  function rectOf(element) {
    return element.getBoundingClientRect();
  }

  /** Ứng viên hợp lệ: đang hiện, đủ lớn, không bị disabled, không tabindex âm. */
  function usable(element) {
    if (!element || element.disabled) return false;
    if (element.getAttribute('aria-hidden') === 'true') return false;
    if (element.tabIndex < 0) return false;
    var box = rectOf(element);
    if (box.width < 4 || box.height < 4) return false;
    var style = window.getComputedStyle(element);
    if (style.visibility === 'hidden' || style.display === 'none') return false;
    return parseFloat(style.opacity || '1') > 0.05;
  }

  function candidates() {
    var nodes = document.querySelectorAll(SELECTOR);
    var found = [];
    for (var i = 0; i < nodes.length; i++) {
      if (usable(nodes[i])) found.push(nodes[i]);
    }
    return found;
  }
  /**
   * Ô tốt nhất theo hướng bấm. Điểm = khoảng cách theo trục đang đi + độ lệch
   * trục còn lại; lệch mà không chồng hàng/cột thì nhân 3 để ưu tiên đi thẳng.
   */
  function best(from, dir) {
    var base = rectOf(from);
    var baseX = base.left + base.width / 2;
    var baseY = base.top + base.height / 2;
    var list = candidates();
    var winner = null;
    var score = Infinity;
    for (var i = 0; i < list.length; i++) {
      var element = list[i];
      if (element === from || from.contains(element) || element.contains(from)) continue;
      var box = rectOf(element);
      var forward, drift, overlap;
      if (dir === 'left' || dir === 'right') {
        forward = dir === 'right' ? box.left - base.right : base.left - box.right;
        if (forward < -Math.min(base.width, box.width) / 2) continue;
        drift = Math.abs(box.top + box.height / 2 - baseY);
        overlap = Math.min(base.bottom, box.bottom) - Math.max(base.top, box.top);
      } else {
        forward = dir === 'down' ? box.top - base.bottom : base.top - box.bottom;
        if (forward < -Math.min(base.height, box.height) / 2) continue;
        drift = Math.abs(box.left + box.width / 2 - baseX);
        overlap = Math.min(base.right, box.right) - Math.max(base.left, box.left);
      }
      var value = Math.max(0, forward) + drift * (overlap > 0 ? 0.6 : 3);
      if (value < score) {
        score = value;
        winner = element;
      }
    }
    return winner;
  }

  /** Không có gì đang focus (vừa đổi route) thì bắt đầu từ ô trên-trái trong khung nhìn. */
  function firstVisible() {
    var list = candidates();
    var winner = null;
    var score = Infinity;
    for (var i = 0; i < list.length; i++) {
      var box = rectOf(list[i]);
      if (box.bottom < 40 || box.top > window.innerHeight - 20) continue;
      var value = box.top * 2 + box.left;
      if (value < score) {
        score = value;
        winner = list[i];
      }
    }
    return winner || list[0] || null;
  }
  function land(element) {
    if (!element) return false;
    try {
      element.focus({ preventScroll: true });
    } catch (error) {
      element.focus();
    }
    var box = rectOf(element);
    var outside = box.top < 140 || box.bottom > window.innerHeight - 60
      || box.left < 40 || box.right > window.innerWidth - 40;
    // scroll-padding trong tv.css lo phần bị header dính che.
    if (outside) element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    return true;
  }

  function typing(element) {
    if (!element) return false;
    if (element.tagName === 'TEXTAREA') return true;
    return element.tagName === 'INPUT' && !/^(button|submit|checkbox|radio|range)$/i.test(element.type || 'text');
  }

  function player() {
    var list = document.querySelectorAll('video');
    for (var i = 0; i < list.length; i++) {
      if (list[i].readyState > 0 || !list[i].paused) return list[i];
    }
    return list[0] || null;
  }

  function toggle() {
    var video = player();
    if (!video) return;
    if (video.paused) {
      var started = video.play();
      if (started && started.catch) started.catch(function () { /* TV chặn autoplay thì bỏ qua */ });
    } else {
      video.pause();
    }
  }

  function seek(by) {
    var video = player();
    if (!video || !isFinite(video.duration)) return;
    video.currentTime = Math.max(0, Math.min(video.duration - 1, video.currentTime + by));
  }
  var DIRS = {
    ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
    Left: 'left', Right: 'right', Up: 'up', Down: 'down'
  };

  window.addEventListener('keydown', function (event) {
    if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey) return;
    var active = document.activeElement;
    var onPlayer = !!active && active.tagName === 'VIDEO';
    if (onPlayer && (event.key === 'Enter' || event.key === ' ')) {
      toggle();
      event.preventDefault();
      return;
    }
    var dir = DIRS[event.key];
    if (!dir) return;
    // Trong ô nhập, trái/phải là di con trỏ; trên/dưới mới thoát ra ngoài.
    if (typing(active) && (dir === 'left' || dir === 'right')) return;
    if (onPlayer && (dir === 'left' || dir === 'right')) {
      seek(dir === 'right' ? SEEK_STEP : -SEEK_STEP);
      event.preventDefault();
      return;
    }
    event.preventDefault();
    var from = active && active !== document.body && usable(active) ? active : null;
    if (land(from ? best(from, dir) : firstVisible())) return;
    scrollFallback(dir);
  }, true);

  /** Hết ô theo hướng đó thì cuộn tay, để phần cuối trang vẫn xem được. */
  function scrollFallback(dir) {
    var by = dir === 'down' ? 260 : dir === 'up' ? -260 : 0;
    if (!by) return;
    try {
      window.scrollBy({ top: by, left: 0, behavior: 'smooth' });
    } catch (error) {
      window.scrollBy(0, by);
    }
  }

  document.addEventListener('focusin', function (event) {
    if (last && last !== event.target) last.removeAttribute('data-tv-focus');
    last = event.target && event.target.setAttribute ? event.target : null;
    if (last) last.setAttribute('data-tv-focus', '');
  }, true);

  document.addEventListener('focusout', function () {
    if (last) last.removeAttribute('data-tv-focus');
    last = null;
  }, true);
  /**
   * Sau mỗi lần React vẽ lại: cho <video> nhận được focus (để tua bằng D-pad) và
   * nếu focus đang rơi về body — thường là vừa đổi route — thì bắt lại ô đầu tiên.
   */
  function tidy() {
    var videos = document.querySelectorAll('video:not([tabindex])');
    for (var i = 0; i < videos.length; i++) videos[i].setAttribute('tabindex', '0');
    var active = document.activeElement;
    if (!active || active === document.body || active === document.documentElement) land(firstVisible());
  }

  function schedule() {
    if (timer) return;
    timer = window.setTimeout(function () {
      timer = 0;
      tidy();
    }, 200);
  }

  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('load', schedule);
  schedule();

  // webos-keys.js gọi vào đây khi bấm phím media trên điều khiển LG.
  window.__tv = {
    toggle: toggle,
    seek: seek,
    focusFirst: function () { land(firstVisible()); }
  };
})();

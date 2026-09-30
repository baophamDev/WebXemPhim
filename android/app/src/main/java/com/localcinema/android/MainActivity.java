package com.localcinema.android;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.UiModeManager;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.text.InputType;
import android.util.Log;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Vỏ Android của BảoNhànCinema: một WebView nạp bản web đã đóng gói trong APK.
 *
 * Vì sao là WebView chứ không viết lại giao diện bằng Kotlin/Compose: app này vốn
 * đã là một web app hoàn chỉnh — định tuyến, trình phát HLS, phụ đề, lớp điều
 * khiển TV — nên bọc lại là cách duy nhất giữ được đúng một bản giao diện cho
 * mọi thiết bị.
 * Sửa web là mọi nền tảng có bản mới, không có bản Android tách ra để lệch dần.
 *
 * Ba thứ dưới đây là phần "vỏ" thật sự phải làm, không thể đẩy về phía web:
 *
 * 1. Trả nội dung từ `assets/web` dưới một origin https thật. Nạp bằng `file://`
 *    thì origin là opaque (`null`), localStorage bị chặn và mọi request tới API
 *    thành cross-origin kỳ quặc. Một host https không tồn tại nhưng do chính
 *    WebView trả lời (`shouldInterceptRequest`) cho lại một origin bình thường:
 *    có secure context, có localStorage, có cookie — giống hệt bản trên Vercel.
 * 2. Nút Back của Android: lùi trong lịch sử SPA, thoát fullscreen, đóng app ở
 *    gốc. Trang web không tự biết được nút cứng nào của Android.
 * 3. Đổi máy chủ API (API trên Internet ↔ API trong mạng nhà). Giao diện nằm
 *    trong máy nên mở là chạy, nhưng dữ liệu phim thì luôn ở đâu đó ngoài máy,
 *    và địa chỉ đó phải đổi được mà không cần build lại APK.
 */
public class MainActivity extends Activity {

  /** Origin của app: host này không tồn tại trên DNS, chỉ WebView biết nó. */
  private static final String LOCAL_ORIGIN = "https://appassets.androidplatform.net";
  private static final String LOCAL_HOST = "appassets.androidplatform.net";
  /** Thư mục trong assets chứa bản build của apps/web. */
  private static final String ASSET_ROOT = "web";
  private static final String PREFS = "bao-nhan-cinema";
  private static final String KEY_API_BASE = "api-base";
  private static final String TAG = "BaoNhanCinema";
  private static final int BACKGROUND = Color.parseColor("#FF0B0806");

  private FrameLayout root;
  private WebView webView;
  private ViewChrome chrome;
  private View fullscreenView;
  private WebChromeClient.CustomViewCallback fullscreenCallback;
  private boolean isTv;
  /**
   * Ép chế độ TV, dùng để thử giao diện TV ngay trên điện thoại:
   * `adb shell am start -n com.localcinema.android/.MainActivity --ez tv true`
   */
  private boolean forceTv;
  /** Đánh dấu "Back đã bị giữ đủ lâu" để lần nhả phím không đóng app. */
  private boolean backLongPressed;

  @Override protected void onCreate(Bundle saved) {
    super.onCreate(saved);
    forceTv = getIntent() != null && getIntent().getBooleanExtra("tv", false);
    isTv = forceTv || uiModeIsTv();

    root = new FrameLayout(this);
    root.setBackgroundColor(BACKGROUND);
    webView = createWebView();
    root.addView(webView, new FrameLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    setContentView(root);

    if (isTv) {
      // TV không có thanh trạng thái để nhìn, còn thanh điều hướng thì chỉ tổ
      // che mất nội dung ở mép màn hình.
      applyImmersive(true);
      // Màn hình TV tự tắt sau vài phút không có tín hiệu điều khiển; đang đọc
      // danh sách phim mà tivi tắt thì khó chịu hơn là tốn điện.
      getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    } else {
      applyInsets();
    }

    if (saved != null) webView.restoreState(saved);
    else webView.loadUrl(startUrl());
  }

  // ---- WebView ------------------------------------------------------------

  private WebView createWebView() {
    WebView view = new WebView(this);
    view.setBackgroundColor(BACKGROUND);
    // Cho chrome://inspect soi app đang chạy. Đây là app cài trong nhà, không
    // phải app phát hành, mà khi app nằm trên TV box thì logcat là đường duy
    // nhất để biết vì sao trang trắng.
    WebView.setWebContentsDebuggingEnabled(true);

    WebSettings settings = view.getSettings();
    settings.setJavaScriptEnabled(true);
    // localStorage: deviceId (để "xem tiếp"), chủ đề sáng/tối, vị trí cuộn.
    settings.setDomStorageEnabled(true);
    settings.setDatabaseEnabled(true);
    // Mở trang xem là video tự chạy. Android mặc định coi mọi thứ tự phát như
    // quảng cáo nên chặn, và người xem phải bấm play hai lần mới xem được.
    settings.setMediaPlaybackRequiresUserGesture(false);
    settings.setUseWideViewPort(true);
    settings.setLoadWithOverviewMode(false);
    settings.setSupportZoom(false);
    settings.setBuiltInZoomControls(false);
    settings.setDisplayZoomControls(false);
    // Cỡ chữ do CSS của app quyết định. Để cỡ chữ hệ thống (có máy đặt 150%) là
    // layout vỡ mà phía web không có cách nào biết để sửa.
    settings.setTextZoom(100);
    // Trang là https, API trong nhà là http: không có dòng này thì trình duyệt
    // chặn request vì mixed content và web chỉ hiện "API ngoại tuyến".
    settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
    settings.setAllowFileAccess(false);
    settings.setAllowContentAccess(false);
    // App tự quản chủ đề (`data-theme` trên <html>). Để hệ thống "tự làm tối"
    // trang là nó đảo màu ảnh và phá đúng cái chủ đề sáng mà app đã dựng.
    if (Build.VERSION.SDK_INT >= 33) settings.setAlgorithmicDarkeningAllowed(false);
    else if (Build.VERSION.SDK_INT >= 29) settings.setForceDark(WebSettings.FORCE_DARK_OFF);

    // Dấu nhận dạng cho phía web. UA của WebView không nói gì về việc đang chạy
    // trong app Android, và cũng không nói máy này là TV hay điện thoại.
    settings.setUserAgentString(settings.getUserAgentString()
        + " BaoNhanCinema/" + BuildConfig.VERSION_NAME + " Android"
        + (isTv ? " CinemaTV/1" : ""));

    // Cầu tối thiểu cho phía web: mở hộp thoại đổi máy chủ API.
    view.addJavascriptInterface(new Bridge(), "CinemaNative");
    view.setWebViewClient(new LocalClient());
    chrome = new ViewChrome();
    view.setWebChromeClient(chrome);
    view.setOverScrollMode(View.OVER_SCROLL_NEVER);
    view.setLongClickable(false);
    return view;
  }

  /**
   * Trang gốc. `?tv=1` chỉ là đường dự phòng: UA đã có `CinemaTV/1` nên kể cả
   * khi người dùng đổi route rồi tải lại trang, lớp điều khiển TV vẫn được nạp.
   */
  private String startUrl() {
    return LOCAL_ORIGIN + "/" + (isTv ? "?tv=1" : "");
  }

  // ---- Phục vụ nội dung từ assets -----------------------------------------

  /**
   * Trả nội dung trong `assets/web`.
   *
   * Không tìm thấy file thì trả `index.html`: app này dùng BrowserRouter, nên
   * `/movie/ten-phim` là một route chứ không phải một file — trong APK không có
   * ổ đĩa nào để trả 404.
   *
   * Hàm này chạy trên luồng nền của WebView, không phải luồng UI.
   */
  private WebResourceResponse localResponse(String path) {
    String clean = (path == null || path.isEmpty()) ? "/" : path;
    if (clean.endsWith("/")) clean = clean + "index.html";

    Map<String, String> headers = new HashMap<>();
    // Không để WebView giữ bản cũ: cập nhật app xong mà nó còn phục vụ
    // index.html của bản trước thì trang trỏ tới bundle đã bị xoá khỏi APK và
    // app trắng trang, không có cách nào sửa từ ngoài.
    headers.put("Cache-Control", "no-store");

    try {
      if (clean.endsWith("index.html")) return htmlResponse(headers);
      InputStream file = getAssets().open(ASSET_ROOT + clean);
      String mime = mimeOf(clean);
      return new WebResourceResponse(mime, encodingOf(mime), 200, "OK", headers, file);
    } catch (IOException missing) {
      try {
        return htmlResponse(headers);
      } catch (IOException fatal) {
        Log.e(TAG, "assets/" + ASSET_ROOT + " trống — chạy lại build-apk.cmd", fatal);
        byte[] message = "Thiếu nội dung web trong APK. Chạy build-apk.cmd rồi cài lại."
            .getBytes(StandardCharsets.UTF_8);
        return new WebResourceResponse("text/plain", "utf-8", 500, "Thiếu assets", headers,
            new ByteArrayInputStream(message));
      }
    }
  }

  /**
   * `index.html`, kèm một mẩu script chèn ngay sau `<head>` nếu người dùng đã
   * đổi máy chủ API trong app.
   *
   * Vị trí là bắt buộc: khối script bắn trước request của `index.html` cũng nằm
   * trong `<head>` và đọc biến này, nên mẩu chèn phải đứng trước nó.
   */
  private WebResourceResponse htmlResponse(Map<String, String> headers) throws IOException {
    byte[] raw = readAll(getAssets().open(ASSET_ROOT + "/index.html"));
    String override = getSharedPreferences(PREFS, MODE_PRIVATE).getString(KEY_API_BASE, null);
    if (override != null && !override.isEmpty()) {
      // JSONObject.quote lo phần nháy và ký tự điều khiển — tự viết là tự mở đường
      // cho một địa chỉ có dấu nháy làm vỡ cả trang.
      String tag = "<script>window.__API_BASE__=" + JSONObject.quote(override) + ";</script>";
      String html = new String(raw, StandardCharsets.UTF_8);
      int head = html.indexOf("<head>");
      html = head < 0 ? tag + html : html.substring(0, head + 6) + tag + html.substring(head + 6);
      raw = html.getBytes(StandardCharsets.UTF_8);
    }
    return new WebResourceResponse("text/html", "utf-8", 200, "OK", headers,
        new ByteArrayInputStream(raw));
  }

  private static byte[] readAll(InputStream stream) throws IOException {
    try (InputStream in = stream) {
      ByteArrayOutputStream out = new ByteArrayOutputStream(16384);
      byte[] buffer = new byte[16384];
      int read;
      while ((read = in.read(buffer)) != -1) out.write(buffer, 0, read);
      return out.toByteArray();
    }
  }

  /** Bảng MIME tối thiểu cho những đuôi file Vite sinh ra. */
  private static String mimeOf(String path) {
    String lower = path.toLowerCase(Locale.US);
    if (lower.endsWith(".html")) return "text/html";
    if (lower.endsWith(".js") || lower.endsWith(".mjs")) return "text/javascript";
    if (lower.endsWith(".css")) return "text/css";
    if (lower.endsWith(".svg")) return "image/svg+xml";
    if (lower.endsWith(".png")) return "image/png";
    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
    if (lower.endsWith(".webp")) return "image/webp";
    if (lower.endsWith(".gif")) return "image/gif";
    if (lower.endsWith(".ico")) return "image/x-icon";
    if (lower.endsWith(".woff2")) return "font/woff2";
    if (lower.endsWith(".woff")) return "font/woff";
    if (lower.endsWith(".ttf")) return "font/ttf";
    if (lower.endsWith(".mp4")) return "video/mp4";
    if (lower.endsWith(".json") || lower.endsWith(".map") || lower.endsWith(".webmanifest")) return "application/json";
    if (lower.endsWith(".txt")) return "text/plain";
    return "application/octet-stream";
  }

  /** Chỉ kiểu chữ mới cần khai báo bảng mã; ảnh, font và video thì không. */
  private static String encodingOf(String mime) {
    if (mime.startsWith("text/") || mime.equals("application/json") || mime.equals("image/svg+xml")) return "utf-8";
    return null;
  }

  // ---- WebView client -----------------------------------------------------

  private class LocalClient extends WebViewClient {
    @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
      Uri url = request.getUrl();
      if (url == null || !LOCAL_HOST.equals(url.getHost())) return null;
      return localResponse(url.getPath());
    }

    @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
      Uri url = request.getUrl();
      if (url == null || LOCAL_HOST.equals(url.getHost())) return false;
      return openExternally(url);
    }

    /** Android 6 vẫn gọi bản cũ này; không có nó thì link ngoài nạp đè vào app. */
    @Override public boolean shouldOverrideUrlLoading(WebView view, String url) {
      Uri parsed = Uri.parse(url);
      if (LOCAL_HOST.equals(parsed.getHost())) return false;
      return openExternally(parsed);
    }

    @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
      if (request.isForMainFrame()) Log.w(TAG, "không nạp được trang: " + error.getDescription());
    }
  }

  /** Link ra ngoài (trailer, trang nguồn) mở bằng trình duyệt, không nạp trong app. */
  private boolean openExternally(Uri url) {
    try {
      startActivity(new Intent(Intent.ACTION_VIEW, url));
    } catch (ActivityNotFoundException error) {
      Toast.makeText(this, "Không mở được liên kết", Toast.LENGTH_SHORT).show();
    }
    return true;
  }

  private class ViewChrome extends WebChromeClient {
    /** `<video>` bấm fullscreen: WebView giao hẳn View của nó cho app tự gắn. */
    @Override public void onShowCustomView(View view, CustomViewCallback callback) {
      if (fullscreenView != null) { callback.onCustomViewHidden(); return; }
      fullscreenView = view;
      fullscreenCallback = callback;
      view.setBackgroundColor(Color.BLACK);
      root.addView(view, new FrameLayout.LayoutParams(
          ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
      webView.setVisibility(View.GONE);
      applyImmersive(true);
      getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }

    @Override public void onHideCustomView() {
      if (fullscreenView == null) return;
      root.removeView(fullscreenView);
      fullscreenView = null;
      webView.setVisibility(View.VISIBLE);
      if (fullscreenCallback != null) { fullscreenCallback.onCustomViewHidden(); fullscreenCallback = null; }
      // Trên TV thì vẫn phải ẩn thanh hệ thống; trên điện thoại thì trả lại.
      applyImmersive(isTv);
      if (!isTv) getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }

    /** Logcat là nơi duy nhất đọc được lỗi JS khi app chạy trên TV box. */
    @Override public boolean onConsoleMessage(ConsoleMessage message) {
      Log.i(TAG, "console: " + message.message() + " (" + message.sourceId() + ":" + message.lineNumber() + ")");
      return true;
    }
  }

  // ---- Nút Back -----------------------------------------------------------

  /**
   * Back: đang fullscreen thì thoát fullscreen, đang ở giữa lịch sử thì lùi một
   * bước, hết lịch sử thì đóng app.
   *
   * Giữ Back khoảng một giây mở phần đổi máy chủ API. Cần có đường này vì lần
   * đầu mở app mà máy chủ mặc định không tới được thì không còn chỗ nào khác để
   * sửa — mọi nút khác đều nằm trong trang web, mà trang web thì cần API.
   */
  @Override public boolean onKeyDown(int keyCode, KeyEvent event) {
    if (keyCode != KeyEvent.KEYCODE_BACK) return super.onKeyDown(keyCode, event);
    if (event.getRepeatCount() == 0) {
      backLongPressed = false;
      // Bắt buộc để hệ thống còn gửi onKeyLongPress, và để onKeyUp của Activity
      // biết đây là một cú bấm hoàn chỉnh.
      event.startTracking();
    }
    return true;
  }

  @Override public boolean onKeyLongPress(int keyCode, KeyEvent event) {
    if (keyCode != KeyEvent.KEYCODE_BACK) return super.onKeyLongPress(keyCode, event);
    backLongPressed = true;
    showServerDialog();
    return true;
  }

  @Override public boolean onKeyUp(int keyCode, KeyEvent event) {
    if (keyCode != KeyEvent.KEYCODE_BACK) return super.onKeyUp(keyCode, event);
    if (backLongPressed) { backLongPressed = false; return true; }
    if (fullscreenView != null) { hideFullscreen(); return true; }
    if (webView.canGoBack()) { webView.goBack(); return true; }
    finish();
    return true;
  }

  private void hideFullscreen() {
    if (fullscreenCallback != null) {
      // Gọi callback thì WebView tự gọi lại onHideCustomView ở trên; dọn ở một
      // chỗ duy nhất, không rải hai nơi.
      fullscreenCallback.onCustomViewHidden();
      return;
    }
    if (chrome != null) chrome.onHideCustomView();
  }

  // ---- Máy chủ API --------------------------------------------------------

  /**
   * Hộp thoại đổi máy chủ API.
   *
   * Giá trị lưu vào SharedPreferences rồi WebView nạp lại `index.html` — lúc đó
   * `__API_BASE__` được chèn vào trang và mọi request đi theo địa chỉ mới. Không
   * cần build lại APK, cũng không cần khởi động lại app.
   */
  private void showServerDialog() {
    SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
    EditText input = new EditText(this);
    input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
    input.setSingleLine(true);
    input.setText(prefs.getString(KEY_API_BASE, ""));
    input.setHint(BuildConfig.DEFAULT_API_BASE);

    int pad = Math.round(20 * getResources().getDisplayMetrics().density);
    FrameLayout box = new FrameLayout(this);
    box.setPadding(pad, pad / 2, pad, 0);
    box.addView(input);

    new AlertDialog.Builder(this)
        .setTitle("Máy chủ API")
        .setMessage("Mặc định là API trên Internet (Railway). Muốn xem kho phim trong nhà thì"
            + " điền địa chỉ máy tính đang chạy API, nhớ kèm /api ở cuối.\n"
            + "Ví dụ: http://192.168.1.20:4000/api")
        .setView(box)
        .setPositiveButton("Lưu và tải lại", (dialog, which) -> saveServer(input.getText().toString()))
        .setNeutralButton("Về mặc định", (dialog, which) -> saveServer(""))
        .setNegativeButton("Đóng", null)
        .show();
  }

  private void saveServer(String raw) {
    String value = raw.trim().replaceAll("/+$", "");
    if (!value.isEmpty() && !value.startsWith("http://") && !value.startsWith("https://")) {
      Toast.makeText(this, "Địa chỉ phải bắt đầu bằng http:// hoặc https://", Toast.LENGTH_LONG).show();
      return;
    }
    SharedPreferences.Editor editor = getSharedPreferences(PREFS, MODE_PRIVATE).edit();
    if (value.isEmpty()) editor.remove(KEY_API_BASE); else editor.putString(KEY_API_BASE, value);
    editor.apply();
    webView.reload();
  }

  /**
   * Cầu cho phía web gọi vào app. Cố ý chỉ có một hàm: mỗi hàm thêm vào đây là
   * một bề mặt nữa mà trang web chạm được vào app.
   */
  private class Bridge {
    @JavascriptInterface public void openServerDialog() {
      runOnUiThread(MainActivity.this::showServerDialog);
    }
  }

  // ---- Cửa sổ -------------------------------------------------------------

  private boolean uiModeIsTv() {
    UiModeManager manager = (UiModeManager) getSystemService(Context.UI_MODE_SERVICE);
    return manager != null && manager.getCurrentModeType() == Configuration.UI_MODE_TYPE_TELEVISION;
  }

  /**
   * Chừa chỗ cho thanh trạng thái và thanh điều hướng. Chỉ cần từ Android 11:
   * trước đó cửa sổ đã tự nằm dưới các thanh ấy rồi (còn Android 15 thì lại ép
   * tràn viền, nên đây đúng là chỗ bù lại).
   */
  private void applyInsets() {
    if (Build.VERSION.SDK_INT < 30) return;
    root.setOnApplyWindowInsetsListener((view, insets) -> {
      Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
      view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
      return WindowInsets.CONSUMED;
    });
  }

  private void applyImmersive(boolean on) {
    if (Build.VERSION.SDK_INT >= 30) {
      WindowInsetsController controller = getWindow().getInsetsController();
      if (controller == null) return;
      if (on) {
        controller.hide(WindowInsets.Type.systemBars());
        controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
      } else {
        controller.show(WindowInsets.Type.systemBars());
      }
      return;
    }
    View decor = getWindow().getDecorView();
    decor.setSystemUiVisibility(on
        ? View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN
            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        : View.SYSTEM_UI_FLAG_VISIBLE);
  }

  @Override public void onConfigurationChanged(Configuration config) {
    super.onConfigurationChanged(config);
    isTv = forceTv || uiModeIsTv();
    if (isTv) applyImmersive(true);
  }

  // ---- Vòng đời -----------------------------------------------------------

  @Override protected void onSaveInstanceState(Bundle out) {
    super.onSaveInstanceState(out);
    webView.saveState(out);
  }

  @Override protected void onPause() {
    super.onPause();
    webView.onPause();
  }

  @Override protected void onResume() {
    super.onResume();
    webView.onResume();
    if (isTv) applyImmersive(true);
  }

  @Override protected void onDestroy() {
    if (webView != null) {
      root.removeView(webView);
      webView.destroy();
      webView = null;
    }
    super.onDestroy();
  }
}

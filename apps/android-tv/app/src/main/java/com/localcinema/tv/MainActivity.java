package com.localcinema.tv;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Bundle;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.TextView;

public final class MainActivity extends Activity {
    private static final String PREFS = "local_cinema_tv";
    private static final String SERVER_URL = "server_url";
    private FrameLayout root;
    private WebView webView;
    private View fullscreenView;
    private WebChromeClient.CustomViewCallback fullscreenCallback;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        hideSystemUi();
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);
        setContentView(root);
        configureWebView();
        String saved = getSharedPreferences(PREFS, MODE_PRIVATE).getString(SERVER_URL, "");
        if (saved.isEmpty()) showServerDialog(); else webView.loadUrl(saved);
    }

    private void configureWebView() {
        webView = new WebView(this);
        webView.setBackgroundColor(Color.BLACK);
        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { return false; }
            @Override public void onReceivedError(WebView view, int code, String description, String url) {
                if (url.equals(view.getUrl())) showConnectionError(description);
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public void onShowCustomView(View view, CustomViewCallback callback) {
                if (fullscreenView != null) { callback.onCustomViewHidden(); return; }
                fullscreenView = view; fullscreenCallback = callback;
                webView.setVisibility(View.GONE);
                root.addView(view, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
                hideSystemUi();
            }
            @Override public void onHideCustomView() { hideFullscreen(); }
        });
        root.addView(webView, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        webView.requestFocus();
    }

    private void showServerDialog() {
        EditText input = new EditText(this);
        input.setSingleLine(true);
        input.setText("http://192.168.1.3:5173");
        input.setSelectAllOnFocus(true);
        input.setPadding(28, 20, 28, 20);
        new AlertDialog.Builder(this)
            .setTitle(R.string.server_title)
            .setMessage(R.string.server_message)
            .setView(input)
            .setCancelable(false)
            .setPositiveButton(R.string.connect, (dialog, which) -> {
                String url = normalizeUrl(input.getText().toString());
                getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString(SERVER_URL, url).apply();
                webView.loadUrl(url);
            })
            .setNegativeButton(R.string.exit, (dialog, which) -> finish())
            .show();
    }

    private void showConnectionError(String detail) {
        TextView message = new TextView(this);
        message.setText(getString(R.string.connection_error, detail));
        message.setTextColor(Color.WHITE);
        message.setTextSize(18);
        message.setGravity(Gravity.CENTER);
        message.setPadding(60, 40, 60, 40);
        new AlertDialog.Builder(this)
            .setTitle(R.string.cannot_connect)
            .setView(message)
            .setPositiveButton(R.string.retry, (dialog, which) -> webView.reload())
            .setNegativeButton(R.string.change_server, (dialog, which) -> showServerDialog())
            .show();
    }

    private String normalizeUrl(String raw) {
        String url = raw.trim();
        if (!url.startsWith("http://") && !url.startsWith("https://")) url = "http://" + url;
        while (url.endsWith("/")) url = url.substring(0, url.length() - 1);
        return url;
    }

    private void hideFullscreen() {
        if (fullscreenView == null) return;
        root.removeView(fullscreenView); fullscreenView = null;
        webView.setVisibility(View.VISIBLE); webView.requestFocus();
        if (fullscreenCallback != null) fullscreenCallback.onCustomViewHidden();
        fullscreenCallback = null; hideSystemUi();
    }

    private void hideSystemUi() {
        if (android.os.Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) { controller.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars()); controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE); }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
        }
    }

    @Override public boolean onKeyLongPress(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_MENU || keyCode == KeyEvent.KEYCODE_DPAD_CENTER) { showServerDialog(); return true; }
        return super.onKeyLongPress(keyCode, event);
    }

    @Override public void onBackPressed() {
        if (fullscreenView != null) hideFullscreen();
        else if (webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override protected void onResume() { super.onResume(); hideSystemUi(); }
    @Override protected void onDestroy() { webView.destroy(); super.onDestroy(); }
}

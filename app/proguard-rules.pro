# Keep JavascriptInterface methods for WebAppInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

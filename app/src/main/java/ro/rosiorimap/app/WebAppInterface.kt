package ro.rosiorimap.app

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.webkit.JavascriptInterface
import android.widget.Toast

class WebAppInterface(private val activity: Activity) {

    @JavascriptInterface
    fun toast(message: String) {
        activity.runOnUiThread {
            Toast.makeText(activity, message, Toast.LENGTH_SHORT).show()
        }
    }

    @JavascriptInterface
    fun share(title: String, text: String, url: String) {
        activity.runOnUiThread {
            try {
                val sendIntent = Intent().apply {
                    action = Intent.ACTION_SEND
                    putExtra(Intent.EXTRA_TITLE, title)
                    putExtra(Intent.EXTRA_TEXT, "$text\n$url")
                    type = "text/plain"
                }
                val shareIntent = Intent.createChooser(sendIntent, title)
                activity.startActivity(shareIntent)
            } catch (e: Exception) {
                Toast.makeText(activity, "Nu s-a putut partaja linkul", Toast.LENGTH_SHORT).show()
            }
        }
    }

    @JavascriptInterface
    fun dial(phoneNumber: String) {
        activity.runOnUiThread {
            try {
                val clean = phoneNumber.replace(Regex("[^0-9+]"), "")
                val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$clean"))
                activity.startActivity(intent)
            } catch (e: Exception) {
                Toast.makeText(activity, "Nu s-a putut iniția apelul", Toast.LENGTH_SHORT).show()
            }
        }
    }

    @JavascriptInterface
    fun openMapNavigation(lat: Double, lng: Double, label: String) {
        activity.runOnUiThread {
            try {
                // Try opening geo intent (Google Maps / Waze)
                val uri = Uri.parse("geo:$lat,$lng?q=$lat,$lng(${Uri.encode(label)})")
                val intent = Intent(Intent.ACTION_VIEW, uri)
                activity.startActivity(intent)
            } catch (e: Exception) {
                // Fallback to web browser Google Maps
                try {
                    val webUri = Uri.parse("https://www.google.com/maps/dir/?api=1&destination=$lat,$lng")
                    activity.startActivity(Intent(Intent.ACTION_VIEW, webUri))
                } catch (_: Exception) {}
            }
        }
    }

    @JavascriptInterface
    fun isAndroidApp(): Boolean = true

    @JavascriptInterface
    fun getAppVersion(): String = "1.0.0"

    @JavascriptInterface
    fun getAuthor(): String = "Popa Bogdan (theratzul) - devops/linux admin/christian"

    @JavascriptInterface
    fun showAbout() {
        activity.runOnUiThread {
            com.google.android.material.dialog.MaterialAlertDialogBuilder(activity)
                .setTitle(R.string.about_title)
                .setMessage(activity.getString(R.string.about_description))
                .setPositiveButton(android.R.string.ok, null)
                .show()
        }
    }
}

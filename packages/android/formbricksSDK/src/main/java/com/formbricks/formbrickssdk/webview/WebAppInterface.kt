package com.formbricks.formbrickssdk.webview

import android.webkit.JavascriptInterface
import com.formbricks.formbrickssdk.model.javascript.JsMessageData
import com.formbricks.formbrickssdk.model.javascript.EventType
import com.formbricks.formbrickssdk.model.javascript.FileUploadData
import timber.log.Timber

class WebAppInterface(private val callback: WebAppCallback?) {

    interface WebAppCallback {
        fun onClose()
        fun onFinished()
        fun onDisplayCreated()
        fun onResponseCreated()
        fun onFilePick(data: FileUploadData)
    }

    /**
     * Javascript interface to get messages from the WebView's embedded JS
     */
    @JavascriptInterface
    fun message(data: String) {
        Timber.tag("WebAppInterface message").d(data)

        try {
            val jsMessage = JsMessageData.from(data)
            when (jsMessage.event) {
                EventType.ON_CLOSE -> callback?.onClose()
                EventType.ON_FINISHED -> callback?.onFinished()
                EventType.ON_DISPLAY_CREATED -> callback?.onDisplayCreated()
                EventType.ON_RESPONSE_CREATED -> callback?.onResponseCreated()
                EventType.ON_FILE_PICK -> { callback?.onFilePick(FileUploadData.from(data)) }
            }
        } catch (e: Exception) {
            Timber.tag("WebAppInterface error").e(e)
        }
    }

    companion object {
        const val INTERFACE_NAME = "FormbricksJavascript"
    }
}
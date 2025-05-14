package com.formbricks.formbrickssdk.webview

import android.webkit.JavascriptInterface
import com.formbricks.formbrickssdk.Formbricks
import com.formbricks.formbrickssdk.logger.Logger
import com.formbricks.formbrickssdk.model.javascript.JsMessageData
import com.formbricks.formbrickssdk.model.javascript.EventType
import com.formbricks.formbrickssdk.model.javascript.FileUploadData
import com.google.gson.JsonParseException
import java.lang.RuntimeException

class WebAppInterface(private val callback: WebAppCallback?) {

    interface WebAppCallback {
        fun onClose()
        fun onDisplayCreated()
        fun onResponseCreated()
        fun onFilePick(data: FileUploadData)
        fun onSurveyLibraryLoadError()
    }

    /**
     * Javascript interface to get messages from the WebView's embedded JS
     */
    @JavascriptInterface
    fun message(data: String) {
        Logger.d(data)

        try {
            val jsMessage = JsMessageData.from(data)
            when (jsMessage.event) {
                EventType.ON_CLOSE -> callback?.onClose()
                EventType.ON_DISPLAY_CREATED -> callback?.onDisplayCreated()
                EventType.ON_RESPONSE_CREATED -> callback?.onResponseCreated()
                EventType.ON_FILE_PICK -> { callback?.onFilePick(FileUploadData.from(data)) }
                EventType.ON_SURVEY_LIBRARY_LOAD_ERROR -> { callback?.onSurveyLibraryLoadError() }
            }
        } catch (e: Exception) {
            Formbricks.callback?.onError(e)
            Logger.e(RuntimeException(e.message))
        } catch (e: JsonParseException) {
            Logger.e(RuntimeException("Failed to parse JSON message: $data"))
        } catch (e: IllegalArgumentException) {
            Formbricks.callback?.onError(e)
            Logger.e(RuntimeException("Invalid message format: $data"))
        } catch (e: Exception) {
            Formbricks.callback?.onError(e)
            Logger.e(RuntimeException("Unexpected error processing message: $data"))
        }
    }

    companion object {
        const val INTERFACE_NAME = "FormbricksJavascript"
    }
}
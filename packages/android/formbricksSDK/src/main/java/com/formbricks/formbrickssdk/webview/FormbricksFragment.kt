package com.formbricks.formbrickssdk.webview

import android.annotation.SuppressLint
import android.app.Activity.RESULT_OK
import android.app.Dialog
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.OpenableColumns
import android.util.Base64
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.ConsoleMessage
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.activity.result.contract.ActivityResultContracts
import androidx.fragment.app.FragmentManager
import androidx.fragment.app.viewModels
import com.formbricks.formbrickssdk.Formbricks
import com.formbricks.formbrickssdk.R
import com.formbricks.formbrickssdk.databinding.FragmentFormbricksBinding
import com.formbricks.formbrickssdk.logger.Logger
import com.formbricks.formbrickssdk.manager.SurveyManager
import com.formbricks.formbrickssdk.model.error.SDKError
import com.formbricks.formbrickssdk.model.javascript.FileUploadData
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import com.google.gson.JsonObject
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.util.Timer


class FormbricksFragment : BottomSheetDialogFragment() {

    private lateinit var binding: FragmentFormbricksBinding
    private lateinit var surveyId: String
    private val closeTimer = Timer()
    private val viewModel: FormbricksViewModel by viewModels()

    private var webAppInterface = WebAppInterface(object : WebAppInterface.WebAppCallback {
        override fun onClose() {
            Handler(Looper.getMainLooper()).post {
                Formbricks.callback?.onSurveyClosed()
                dismiss()
            }
        }

        override fun onDisplayCreated() {
            Formbricks.callback?.onSurveyStarted()
            SurveyManager.onNewDisplay(surveyId)
        }

        override fun onResponseCreated() {
            SurveyManager.postResponse(surveyId)
        }

        override fun onFilePick(data: FileUploadData) {
            val intent = Intent(Intent.ACTION_OPEN_DOCUMENT)
                .setType("*/*")
                .putExtra(Intent.EXTRA_MIME_TYPES, data.fileUploadParams.allowedExtensionsArray())
                .putExtra(Intent.EXTRA_ALLOW_MULTIPLE, data.fileUploadParams.allowMultipleFiles)

            resultLauncher.launch(intent)
        }

        override fun onSurveyLibraryLoadError() {
            Formbricks.callback?.onError(SDKError.unableToLoadFormbicksJs)
            dismiss()
        }
    })

    var resultLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        if (result.resultCode == RESULT_OK) {
            val intent: Intent? = result.data
            var uriArray: MutableList<Uri> = mutableListOf()

            val dataString = intent?.dataString
            if (null != dataString) {
                uriArray = arrayOf(Uri.parse(dataString)).toMutableList()
            } else {
                val clipData = intent?.clipData
                if (null != clipData) {
                    for (i in 0 until clipData.itemCount) {
                        val uri = clipData.getItemAt(i).uri
                        uriArray.add(uri)
                    }
                }
            }

            val jsonArray = com.google.gson.JsonArray()
            uriArray.forEach { uri ->
                val type = activity?.contentResolver?.getType(uri)
                val fileName = getFileName(uri)
                val base64 = "data:${type};base64,${uriToBase64(uri)}"
                val json = JsonObject()
                json.addProperty("name", fileName)
                json.addProperty("type", type)
                json.addProperty("base64", base64)
                jsonArray.add(json)
            }
            binding.formbricksWebview.evaluateJavascript("""window.formbricksSurveys.onFilePick($jsonArray)""") { result ->
                print(result)
            }
        }
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        binding = FragmentFormbricksBinding.inflate(inflater).apply {
            lifecycleOwner = viewLifecycleOwner
        }
        binding.viewModel = viewModel

        return binding.root
    }

    override fun onCreateDialog(savedInstanceState: Bundle?): Dialog {
        setStyle(STYLE_NO_FRAME, R.style.BottomSheetDialog)
        return super.onCreateDialog(savedInstanceState)
    }

    @Suppress("DEPRECATION")
    override fun onStart() {
        super.onStart()
        val view: FrameLayout = dialog?.findViewById(com.google.android.material.R.id.design_bottom_sheet)!!
        view.layoutParams.height = ViewGroup.LayoutParams.MATCH_PARENT
        val behavior = BottomSheetBehavior.from(view)
        behavior.peekHeight = resources.displayMetrics.heightPixels
        behavior.state = BottomSheetBehavior.STATE_EXPANDED
        behavior.isFitToContents = false
        behavior.setState(BottomSheetBehavior.STATE_EXPANDED)

        dialog?.setCancelable(false)

        dialog?.window?.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
    }

    @Suppress("DEPRECATION")
    @SuppressLint("SetJavaScriptEnabled")
    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        dialog?.window?.setDimAmount(0.0f)
        binding.formbricksWebview.setBackgroundColor(Color.TRANSPARENT)
        binding.formbricksWebview.let {
            it.webChromeClient = object : WebChromeClient() {
                override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                    consoleMessage?.let { cm ->
                        if (cm.messageLevel() == ConsoleMessage.MessageLevel.ERROR) {
                            Formbricks.callback?.onError(SDKError.surveyDisplayFetchError)
                            dismiss()
                        }
                        val log = "[CONSOLE:${cm.messageLevel()}] \"${cm.message()}\", source: ${cm.sourceId()} (${cm.lineNumber()})"
                        Logger.d(log)
                    }
                    return super.onConsoleMessage(consoleMessage)
                }
            }

            it.settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                loadWithOverviewMode = true
                useWideViewPort = true
            }

            it.webViewClient = object : WebViewClient() {
                override fun onReceivedError(
                    view: WebView?,
                    request: WebResourceRequest?,
                    error: WebResourceError?
                ) {
                    super.onReceivedError(view, request, error)
                    Logger.d("WebView Error: ${error?.description}")
                }

                override fun onPageCommitVisible(view: WebView?, url: String?) {
                    dialog?.window?.setDimAmount(0.5f)
                    super.onPageCommitVisible(view, url)
                }
            }

            it.setOnFocusChangeListener { _, hasFocus ->
                if (hasFocus) {
                    dialog?.window?.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
                }
            }

            it.setInitialScale(1)

            it.addJavascriptInterface(webAppInterface, WebAppInterface.INTERFACE_NAME)
        }

        viewModel.loadHtml(surveyId)
    }

    private fun getFileName(uri: Uri): String? {
        var fileName: String? = null
        activity?.contentResolver?.query(uri, null, null, null, null)?.use { cursor ->
            val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (nameIndex != -1 && cursor.moveToFirst()) {
                fileName = cursor.getString(nameIndex)
            }
        }
        return fileName
    }

    private fun uriToBase64(uri: Uri): String? {
        return try {
            val inputStream: InputStream? = activity?.contentResolver?.openInputStream(uri)
            val outputStream = ByteArrayOutputStream()
            val buffer = ByteArray(1024)
            var bytesRead: Int

            while (inputStream?.read(buffer).also { bytesRead = it ?: -1 } != -1) {
                outputStream.write(buffer, 0, bytesRead)
            }

            inputStream?.close()
            outputStream.close()

            Base64.encodeToString(outputStream.toByteArray(), Base64.NO_WRAP)
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    companion object {
        private val TAG: String by lazy { FormbricksFragment::class.java.simpleName }

        fun show(childFragmentManager: FragmentManager, surveyId: String) {
            val fragment = FormbricksFragment()
            fragment.surveyId = surveyId
            fragment.show(childFragmentManager, TAG)
        }

        private const val CLOSING_TIMEOUT_IN_SECONDS = 5L
    }
}
package com.formbricks.formbrickssdk.webview

import android.webkit.WebView
import androidx.databinding.BindingAdapter
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import com.formbricks.formbrickssdk.Formbricks
import com.formbricks.formbrickssdk.extensions.guard
import com.formbricks.formbrickssdk.manager.SurveyManager
import com.formbricks.formbrickssdk.manager.UserManager
import com.formbricks.formbrickssdk.model.environment.EnvironmentDataHolder
import com.formbricks.formbrickssdk.model.environment.getProjectStylingJson
import com.formbricks.formbrickssdk.model.environment.getStyling
import com.formbricks.formbrickssdk.model.environment.getSurveyJson
import com.google.gson.JsonObject

/**
 * A view model for the Formbricks WebView.
 * It generates the HTML string with the necessary data to render the survey.
 */
class FormbricksViewModel : ViewModel() {
    var html = MutableLiveData<String>()

    /**
     * The HTML template to render the Formbricks WebView.
     */
    private val htmlTemplate = """
 <!doctype html>
        <html>
            <meta name="viewport" content="initial-scale=1.0, maximum-scale=1.0">
            
            <head>
                <title>Formbricks WebView Survey</title>
                <script src="https://cdn.tailwindcss.com"></script>
            </head>

            <body style="overflow: hidden; height: 100vh; display: flex; flex-direction: column; justify-content: flex-end;">
                <div id="formbricks-react-native" style="width: 100%;"></div>
            </body>

            <script type="text/javascript">
                var json = `{{WEBVIEW_DATA}}`

                function onClose() {
                    console.log("onClose")
                    FormbricksJavascript.message(JSON.stringify({ event: "onClose" }));
                };

                function onFinished() {
                    FormbricksJavascript.message(JSON.stringify({ event: "onFinished" }));
                };

                function onDisplayCreated() {
                    FormbricksJavascript.message(JSON.stringify({ event: "onDisplayCreated" }));
                };

                function onResponseCreated() {
                    FormbricksJavascript.message(JSON.stringify({ event: "onResponseCreated" }));
                };
                  
                function loadSurvey() {
                    const options = JSON.parse(json);
                    const surveyProps = {
                        ...options,
                        onFinished,
                        onDisplayCreated,
                        onResponseCreated,
                        onClose,
                    };

                    window.formbricksSurveys.renderSurvey(surveyProps);
                }

              // Function to attach click listener to file inputs
              function attachFilePickerOverride() {
                const inputs = document.querySelectorAll('input[type="file"]');
                  inputs.forEach(input => {
                    if (!input.getAttribute('data-file-picker-overridden')) {
                      input.setAttribute('data-file-picker-overridden', 'true');
        
                      const allowedFileExtensions = input.getAttribute('data-accept-extensions');
                      const allowMultipleFiles = input.getAttribute('data-accept-multiple');
        
                      input.addEventListener('click', function (e) {
                        e.preventDefault();
                        FormbricksJavascript.message(JSON.stringify({
                          event: "onFilePick",
                          fileUploadParams: {
                            allowedFileExtensions: allowedFileExtensions,
                            allowMultipleFiles: allowMultipleFiles === "true",
                          },
                        }));
                      });
                    }
                  });
              }
        
              // Initially attach the override
              attachFilePickerOverride();
        
              // Set up a MutationObserver to catch dynamically added file inputs
              const observer = new MutationObserver(function (mutations) {
                attachFilePickerOverride();
              });
        
              observer.observe(document.body, { childList: true, subtree: true });

                const script = document.createElement("script");
                script.src = "${Formbricks.appUrl}/js/surveys.umd.cjs";
                script.async = true;
                script.onload = () => loadSurvey();
                script.onerror = (error) => {
                    FormbricksJavascript.message(JSON.stringify({ event: "onSurveyLibraryLoadError" }));
                    console.error("Failed to load Formbricks Surveys library:", error);
                };
                document.head.appendChild(script);
            </script>
        </html>
"""

    fun loadHtml(surveyId: String) {
        val environment = SurveyManager.environmentDataHolder.guard { return }
        val json = getJson(environment, surveyId)
        val htmlString = htmlTemplate.replace("{{WEBVIEW_DATA}}", json)
        html.postValue(htmlString)
    }

    private fun getJson(environmentDataHolder: EnvironmentDataHolder, surveyId: String): String {
        val jsonObject = JsonObject()
        environmentDataHolder.getSurveyJson(surveyId).let { jsonObject.add("survey", it) }
        jsonObject.addProperty("isBrandingEnabled", true)
        jsonObject.addProperty("apiHost", Formbricks.appUrl)
        jsonObject.addProperty("languageCode", Formbricks.language)
        jsonObject.addProperty("environmentId", Formbricks.environmentId)
        jsonObject.addProperty("contactId", UserManager.contactId)

        val hasCustomStyling = environmentDataHolder.data?.data?.surveys?.first { it.id == surveyId }?.styling != null
        val enabled = environmentDataHolder.data?.data?.project?.styling?.allowStyleOverwrite ?: false
        if (hasCustomStyling && enabled) {
            environmentDataHolder.getStyling(surveyId)?.let { jsonObject.add("styling", it) }
        } else {
            environmentDataHolder.getProjectStylingJson()?.let { jsonObject.add("styling", it) }
        }

        return jsonObject.toString()
            .replace("#", "%23") // Hex color code's # breaks the JSON
            .replace("\\\"","'") // " is replaced to ' in the html codes in the JSON
    }


}

@BindingAdapter("htmlText")
fun WebView.setHtmlText(htmlString: String?) {
    loadData(htmlString ?: "", "text/html", "UTF-8")
}
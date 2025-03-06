package com.formbricks.formbrickssdk.manager

import android.content.Context
import com.formbricks.formbrickssdk.Formbricks
import com.formbricks.formbrickssdk.api.FormbricksApi
import com.formbricks.formbrickssdk.extensions.expiresAt
import com.formbricks.formbrickssdk.extensions.guard
import com.formbricks.formbrickssdk.model.environment.DisplayOptionType
import com.formbricks.formbrickssdk.model.environment.EnvironmentDataHolder
import com.formbricks.formbrickssdk.model.environment.Survey
import com.formbricks.formbrickssdk.model.user.Display
import com.google.gson.Gson
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import timber.log.Timber
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.Date
import java.util.Timer
import java.util.TimerTask

interface FileUploadListener {
    fun fileUploaded(url: String, uploadId: String)
}

/**
 *  The SurveyManager is responsible for managing the surveys that are displayed to the user.
 *  Filtering surveys based on the user's segments, responses, and displays.
 */
object SurveyManager {
    private const val REFRESH_STATE_ON_ERROR_TIMEOUT_IN_MINUTES = 10
    private const val FORMBRICKS_PREFS = "formbricks_prefs"
    private const val PREF_FORMBRICKS_DATA_HOLDER = "formbricksDataHolder"

    private val refreshTimer = Timer()
    private var displayTimer = Timer()
    private val prefManager by lazy { Formbricks.applicationContext.getSharedPreferences(FORMBRICKS_PREFS, Context.MODE_PRIVATE) }
    private var filteredSurveys: MutableList<Survey> = mutableListOf()

    private var environmentDataHolderJson: String?
        get() {
            return prefManager.getString(PREF_FORMBRICKS_DATA_HOLDER, "")
        }
        set(value) {
            if (null != value) {
                prefManager.edit().putString(PREF_FORMBRICKS_DATA_HOLDER, value).apply()
            } else {
                prefManager.edit().remove(PREF_FORMBRICKS_DATA_HOLDER).apply()
            }
        }

    private var backingEnvironmentDataHolder: EnvironmentDataHolder? = null
    var environmentDataHolder: EnvironmentDataHolder?
        get() {
            if (null != backingEnvironmentDataHolder) {
                return backingEnvironmentDataHolder
            }
            synchronized(this) {
                backingEnvironmentDataHolder = environmentDataHolderJson?.let { json ->
                    try {
                        Gson().fromJson(json, EnvironmentDataHolder::class.java)
                    } catch (e: Exception) {
                        Timber.tag("SurveyManager").e("Unable to retrieve environment data from the local storage.")
                        null
                    }
                }
                return backingEnvironmentDataHolder
            }
        }
        set(value) {
            synchronized(this) {
                backingEnvironmentDataHolder = value
                environmentDataHolderJson = Gson().toJson(value)
            }
        }

    /**
     * Fills up the [filteredSurveys] array
     */
    fun filterSurveys() {
        val surveys = environmentDataHolder?.data?.data?.surveys.guard { return }
        val displays = UserManager.displays ?: listOf()
        val responses = UserManager.responses ?: listOf()
        val segments = UserManager.segments ?: listOf()

        filteredSurveys = filterSurveysBasedOnDisplayType(surveys, displays, responses).toMutableList()
        filteredSurveys = filterSurveysBasedOnRecontactDays(filteredSurveys, environmentDataHolder?.data?.data?.project?.recontactDays?.toInt()).toMutableList()

        if (UserManager.userId != null) {
            if (segments.isEmpty()) {
                filteredSurveys = mutableListOf()
                return
            }

            filteredSurveys = filterSurveysBasedOnSegments(filteredSurveys, segments).toMutableList()
        }
    }

    /**
     * Checks if the environment state needs to be refreshed based on its [expiresAt] property,
     * and if so, refreshes it, starts the refresh timer, and filters the surveys.
     */
    fun refreshEnvironmentIfNeeded() {
        environmentDataHolder?.expiresAt()?.let {
            if (it.after(Date())) {
                Timber.tag("SurveyManager").d("Environment state is still valid until $it")
                filterSurveys()
                return
            }
        }

        CoroutineScope(Dispatchers.IO).launch {
            try {
                environmentDataHolder = FormbricksApi.getEnvironmentState().getOrThrow()
                startRefreshTimer(environmentDataHolder?.expiresAt())
                filterSurveys()
            } catch (e: Exception) {
                Timber.tag("SurveyManager").e(e, "Unable to refresh environment state.")
                startErrorTimer()
            }
        }
    }

    /**
     * Checks if there are any surveys to display, based in the track action, and if so, displays the first one.
     * Handles the display percentage and the delay of the survey.
     */
    fun track(action: String) {
        val actionClasses = environmentDataHolder?.data?.data?.actionClasses ?: listOf()
        val codeActionClasses = actionClasses.filter { it.type == "code" }
        val actionClass = codeActionClasses.firstOrNull { it.key == action }
        val firstSurveyWithActionClass = filteredSurveys.firstOrNull { survey ->
            val triggers = survey.triggers ?: listOf()
            triggers.firstOrNull { it.actionClass?.name.equals(actionClass?.name) } != null
        }

        val shouldDisplay = shouldDisplayBasedOnPercentage(firstSurveyWithActionClass?.displayPercentage)

        if (shouldDisplay) {
            firstSurveyWithActionClass?.id?.let {
                val timeout = firstSurveyWithActionClass.delay ?: 0.0
                stopDisplayTimer()
                displayTimer.schedule(object : TimerTask() {
                    override fun run() {
                        Formbricks.showSurvey(it)
                    }

                }, Date.from(Instant.now().plusSeconds(timeout.toLong())))
            }
        }
    }

    private fun stopDisplayTimer() {
        try {
            displayTimer.cancel()
            displayTimer = Timer()
        } catch (_: Exception) {

        }
    }

    /**
     * Posts a survey response to the Formbricks API.
     */
    fun postResponse(surveyId: String?) {
        val id = surveyId.guard {
            Timber.tag("SurveyManager").e("Survey id is mandatory to set.")
            return
        }

        UserManager.onResponse(id)
    }

    /**
     * Creates a new display for the survey. It is called when the survey is displayed to the user.
     */
    fun onNewDisplay(surveyId: String?) {
        val id = surveyId.guard {
            Timber.tag("SurveyManager").e("Survey id is mandatory to set.")
            return
        }

        UserManager.onDisplay(id)
    }

   /**
     *  Starts a timer to refresh the environment state after the given timeout [expiresAt].
     */
    private fun startRefreshTimer(expiresAt: Date?) {
        val date = expiresAt.guard { return }
        refreshTimer.schedule(object: TimerTask() {
            override fun run() {
                Timber.tag("SurveyManager").d("Refreshing environment state.")
                refreshEnvironmentIfNeeded()
            }

        }, date)
    }

    /**
     *  When an error occurs, it starts a timer to refresh the environment state after the given timeout.
     */
    private fun startErrorTimer() {
        val targetDate = Date(System.currentTimeMillis() + 1000 * 60 * REFRESH_STATE_ON_ERROR_TIMEOUT_IN_MINUTES)
        refreshTimer.schedule(object: TimerTask() {
            override fun run() {
                Timber.tag("SurveyManager").d("Refreshing environment state after an error")
                refreshEnvironmentIfNeeded()
            }

        }, targetDate)
    }

    /**
     * Filters the surveys based on the display type and limit.
     */
    private fun filterSurveysBasedOnDisplayType(surveys: List<Survey>, displays: List<Display>, responses: List<String>): List<Survey> {
        return surveys.filter { survey ->
            when (survey.displayOption) {
                DisplayOptionType.RESPOND_MULTIPLE -> true

                DisplayOptionType.DISPLAY_ONCE -> {
                    displays.none { it.surveyId == survey.id }
                }

                DisplayOptionType.DISPLAY_MULTIPLE -> {
                    responses.none { it == survey.id }
                }

                DisplayOptionType.DISPLAY_SOME -> {
                    survey.displayLimit?.let { limit ->
                        if (responses.any { it == survey.id }) {
                            return@filter false
                        }
                        displays.count { it.surveyId == survey.id } < limit
                    } ?: true
                }

                else -> {
                    Timber.tag("SurveyManager").e("Invalid Display Option")
                    false
                }
            }
        }
    }

    /**
     * Filters the surveys based on the recontact days and the [UserManager.lastDisplayedAt] date.
     */
    private fun filterSurveysBasedOnRecontactDays(surveys: List<Survey>, defaultRecontactDays: Int?): List<Survey> {
        return surveys.filter { survey ->
            val lastDisplayedAt = UserManager.lastDisplayedAt.guard { return@filter true }

            val recontactDays = survey.recontactDays ?: defaultRecontactDays

            if (recontactDays != null) {
                val daysBetween = ChronoUnit.DAYS.between(lastDisplayedAt.toInstant(), Instant.now())
                return@filter daysBetween >= recontactDays.toInt()
            }

            true
        }
    }

    /**
     * Filters the surveys based on the user's segments.
     */
    private fun filterSurveysBasedOnSegments(surveys: List<Survey>, segments: List<String>): List<Survey> {
        return surveys.filter { survey ->
            val segmentId = survey.segment?.id?.guard { return@filter false }
            segments.contains(segmentId)
        }
    }

    /**
     * Decides if the survey should be displayed based on the display percentage.
     */
    private fun shouldDisplayBasedOnPercentage(displayPercentage: Double?): Boolean {
        val percentage = displayPercentage.guard { return true }
        val randomNum = (0 until 10000).random() / 100.0
        return randomNum <= percentage
    }
}
package com.formbricks.formbrickssdk

import android.util.Log
import androidx.fragment.app.FragmentManager
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.formbricks.formbrickssdk.api.FormbricksApi
import com.formbricks.formbrickssdk.helper.FormbricksConfig
import com.formbricks.formbrickssdk.manager.SurveyManager
import com.formbricks.formbrickssdk.manager.UserManager

import org.junit.Test
import org.junit.runner.RunWith

import org.junit.Assert.*
import org.junit.Before
import java.text.Normalizer.Form
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * Instrumented test, which will execute on an Android device.
 *
 * See [testing documentation](http://d.android.com/tools/testing).
 */
@RunWith(AndroidJUnit4::class)
class FormbricksInstrumentedTest {

    private val environmentId = "environmentId"
    private val appUrl = "http://appUrl"
    private val userId = "6CCCE716-6783-4D0F-8344-9C7DFA43D8F7"
    private val surveyID = "cm6ovw6j7000gsf0kduf4oo4i"

    @Before
    fun setUp() {
        val appContext = InstrumentationRegistry.getInstrumentation().targetContext
        Formbricks.applicationContext = appContext
        UserManager.logout()
        SurveyManager.environmentDataHolder = null
        FormbricksApi.service = MockFormbricksApiService()
    }

    @Test
    fun testFormbricks() {
        val appContext = InstrumentationRegistry.getInstrumentation().targetContext
        assertEquals("com.formbricks.formbrickssdk.test", appContext.packageName)

        // Everything should be in the default state
        assertFalse(Formbricks.isInitialized)
        assertEquals(0, SurveyManager.filteredSurveys.size)
        assertNull(SurveyManager.environmentDataHolder)
        assertNull(UserManager.userId)
        assertEquals("default", Formbricks.language)

        // Use methods before init should have no effect
        Formbricks.setUserId("userId")
        Formbricks.setLanguage("de")
        Formbricks.setAttributes(mapOf("testA" to "testB"))
        Formbricks.setAttribute("test", "testKey")
        assertNull(UserManager.userId)
        assertEquals("default", Formbricks.language)
        Formbricks.track("click_demo_button")
        waitForSeconds(1)
        assertFalse(SurveyManager.isShowingSurvey)
        Formbricks.logout()
        Formbricks.setFragmentManager(MockFragmentManager())
        Formbricks.setLanguage("")

        // Call the setup and initialize the SDK
        Formbricks.setup(appContext, FormbricksConfig.Builder(appUrl, environmentId).setLoggingEnabled(true).build())
        waitForSeconds(1)

        // Should be ignored, becuase we don't have user ID yet
        Formbricks.setAttributes(mapOf("testA" to "testB"))
        Formbricks.setAttribute("test", "testKey")
        assertNull(UserManager.userId)

        // Verify the base variables are set properly
        assertTrue(Formbricks.isInitialized)
        assertEquals(appUrl, Formbricks.appUrl)
        assertEquals(environmentId, Formbricks.environmentId)

        // User manager default state. There is no user yet.
        assertEquals(UserManager.displays?.count(), 0)
        assertEquals(UserManager.responses?.count(), 0)
        assertEquals(UserManager.segments?.count(), 0)

        // Check error state handling
        (FormbricksApi.service as MockFormbricksApiService).isErrorResponseNeeded = true
        assertFalse(SurveyManager.hasApiError)
        SurveyManager.refreshEnvironmentIfNeeded(true)
        waitForSeconds(1)
        assertTrue(SurveyManager.hasApiError)
        (FormbricksApi.service as MockFormbricksApiService).isErrorResponseNeeded = false

        // Authenticate the user
        Formbricks.setUserId(userId)
        waitForSeconds(1)
        assertEquals(userId, UserManager.userId)
        assertNotNull(UserManager.syncTimer)

        // The environment should be fetched already
        assertNotNull(SurveyManager.environmentDataHolder)

        // Check if the filter method works properly
        assertEquals(1, SurveyManager.filteredSurveys.size)
        assertFalse(SurveyManager.isShowingSurvey)

        // Track an unknown event, shouldn't show the survey
        Formbricks.track("unknown_event")
        assertFalse(SurveyManager.isShowingSurvey)

        // Track a known event, thus, the survey should be shown.
        SurveyManager.isShowingSurvey = false
        Formbricks.track("click_demo_button")
        waitForSeconds(1)
        assertTrue(SurveyManager.isShowingSurvey)

        // Validate display and response
        SurveyManager.onNewDisplay(surveyID)
        SurveyManager.postResponse(surveyID)
        assertEquals(1, UserManager.responses?.size)
        assertEquals(1, UserManager.displays?.size)

        // Track a valid event, but the survey should not shown, because we already gave a response.
        SurveyManager.isShowingSurvey = false
        Formbricks.track("click_demo_button")
        waitForSeconds(1)
        assertFalse(SurveyManager.isShowingSurvey)

        // Validate logout
        assertNotNull(UserManager.userId)
        assertNotNull(UserManager.lastDisplayedAt)
        assertNotEquals(UserManager.displays?.count(), 0)
        assertNotEquals(UserManager.responses?.count(), 0)
        assertNotEquals(UserManager.segments?.count(), 0)
        assertNotNull(UserManager.expiresAt)
        Formbricks.logout()
        assertNull(UserManager.userId)
        assertNull(UserManager.lastDisplayedAt)
        assertNull(UserManager.displays)
        assertEquals(UserManager.responses?.count(), 0)
        assertEquals(UserManager.segments?.count(), 0)
        assertNull(UserManager.expiresAt)

        // Setting the language
        assertEquals("default", Formbricks.language)
        Formbricks.setLanguage("de")
        assertEquals("de", Formbricks.language)

        // Clear the responses
        Formbricks.logout()
        SurveyManager.filterSurveys()

        Formbricks.track("click_demo_button")
        waitForSeconds(1)
        assertTrue(SurveyManager.isShowingSurvey)
    }

    private fun waitForSeconds(seconds: Long) {
        val latch = CountDownLatch(1)
        latch.await(seconds, TimeUnit.SECONDS)
    }
}

class MockFragmentManager : FragmentManager()
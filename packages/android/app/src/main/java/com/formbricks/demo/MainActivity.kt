package com.formbricks.demo

import android.os.Bundle
import android.util.Log
import android.widget.Button
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import com.formbricks.formbrickssdk.Formbricks
//import com.formbricks.formbrickssdk.FormbricksCallback
import com.formbricks.formbrickssdk.helper.FormbricksConfig
import java.util.UUID

class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

//        Formbricks.callback = object: FormbricksCallback {
//            override fun onSurveyStarted() {
//                Log.d("FormbricksCallback", "onSurveyStarted")
//            }
//
//            override fun onSurveyFinished() {
//                Log.d("FormbricksCallback", "onSurveyFinished")
//            }
//
//            override fun onSurveyClosed() {
//                Log.d("FormbricksCallback", "onSurveyClosed")
//            }
//
//            override fun onError(error: Exception) {
//                Log.d("FormbricksCallback", "onError: ${error.localizedMessage}")
//            }
//
//        }

        val config = FormbricksConfig.Builder("http://192.168.29.117:3000","cm9qk3m57000n195soukrmqhh")
            .setLoggingEnabled(true)
            .setFragmentManager(supportFragmentManager)

        Formbricks.setup(this, config.build(), true)

        setContentView(R.layout.activity_main)
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.main)) { v, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom)
            insets
        }

        val button = findViewById<Button>(R.id.button)
        button.setOnClickListener {
            Formbricks.track("click_demo_button")
        }

        val setUserIdButton = findViewById<Button>(R.id.setUserId)
        setUserIdButton.setOnClickListener {
            Formbricks.setUserId(UUID.randomUUID().toString())
        }

        val setAttributeButton = findViewById<Button>(R.id.setAttribute)
        setAttributeButton.setOnClickListener {
            Formbricks.setAttribute("test@web.com", "email")
        }

        val setAttributesButton = findViewById<Button>(R.id.setAttributes)
        setAttributesButton.setOnClickListener {
            Formbricks.setAttributes(mapOf(Pair("attr1", "val1"), Pair("attr2", "val2")))
        }

        val setLanguageButton = findViewById<Button>(R.id.setLanguage)
        setLanguageButton.setOnClickListener {
            Formbricks.setLanguage("vi")
        }

        val logoutButton = findViewById<Button>(R.id.logout)
        logoutButton.setOnClickListener {
            Formbricks.logout()
        }
    }
}

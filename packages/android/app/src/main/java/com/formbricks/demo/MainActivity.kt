package com.formbricks.demo

import android.os.Bundle
import android.util.Log
import android.widget.Button
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import com.formbricks.formbrickssdk.Formbricks
import com.formbricks.formbrickssdk.FormbricksCallback
import com.formbricks.formbrickssdk.helper.FormbricksConfig
import com.formbricks.formbrickssdk.model.enums.SuccessType
import java.util.UUID

class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        Formbricks.callback = object: FormbricksCallback {
            override fun onSurveyStarted() {
                Log.d("FormbricksCallback", "onSurveyStarted")
            }

            override fun onSurveyFinished() {
                Log.d("FormbricksCallback", "onSurveyFinished")
            }

            override fun onSurveyClosed() {
                Log.d("FormbricksCallback", "onSurveyClosed")
            }

            override fun onError(error: Exception) {
                Log.d("FormbricksCallback", "onError: ${error.localizedMessage}")
            }

            override fun onSuccess(successType: SuccessType) {
                Log.d("FormbricksCallback", "onSuccess: ${successType.name}")
            }

        }

        val config = FormbricksConfig.Builder("[appUrl]","[environmentId]")
            .setLoggingEnabled(true)
            .setFragmentManager(supportFragmentManager)
        Formbricks.setup(this, config.build())

        Formbricks.logout()
        Formbricks.setUserId(UUID.randomUUID().toString())

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
    }
}
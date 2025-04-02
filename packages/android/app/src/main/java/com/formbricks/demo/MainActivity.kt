package com.formbricks.demo

import android.os.Bundle
import android.util.Log
import android.widget.Button
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.fragment.app.FragmentActivity
import com.formbricks.formbrickssdk.Formbricks
import com.formbricks.formbrickssdk.FormbricksCallback
import com.formbricks.formbrickssdk.helper.FormbricksConfig
import com.formbricks.formbrickssdk.model.enums.SuccessType
import java.util.UUID

class MainActivity : FragmentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

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

            override fun onPageCommitVisible() {
                Log.d("FormbricksCallback", "onPageCommitVisible")
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
            Formbricks.track("costumer_click_acceptbutton")
        }
    }
}
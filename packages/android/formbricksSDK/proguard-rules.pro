# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

-keeppackagenames com.formbricks.**

-keep class com.formbricks.** { *; }

-keepclassmembers,allowobfuscation class * {
   @com.google.gson.annotations.SerializedName <fields>;
}

-keepattributes SourceFile,LineNumberTable,Exceptions,InnerClasses,Signature,Deprecated,*Annotation*,EnclosingMethod

# add all known-to-be-safely-shrinkable classes to the beginning of line below
-keep class !androidx.legacy.**,!com.google.android.**,!androidx.** { *; }
-keep class android.support.v4.app.** { *; }




# Retrofit
-dontwarn okio.**
-keep class com.squareup.okhttp.** { *; }
-keep interface com.squareup.okhttp.** { *; }
-keep class retrofit.** { *; }
-dontwarn com.squareup.okhttp.**

-keep class retrofit.** { *; }
-keepclasseswithmembers class * {
    @retrofit.http.* <methods>;
}
# ******************************* proguard-rules.pro ***************************************
#
# Module: Proguard Rules
#
# This file supports the Android shell for the Capacitor mobile app.
#
# The file provides:
#
# - Android build, manifest, resource, or activity configuration.
# - native project metadata required by Capacitor.
# - mobile packaging support for the inventory frontend.
#
# Key Structures Used:
#
# - Android Gradle, manifest, resource XML, and Java activity files.
#
# This file ensures:
#
# - the web application can be packaged as an Android app.
# - native mobile settings stay discoverable for the team.
#
# Editors: Aniket, Dipankar, Liam, Jin, and Philip.
#
# ****************************************************************************
# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

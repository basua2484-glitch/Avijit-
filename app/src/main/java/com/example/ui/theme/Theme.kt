package com.example.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext

private val DarkColorScheme = darkColorScheme(
    primary = CleanPrimaryLight,
    onPrimary = CleanOnPrimaryContainer,
    primaryContainer = CleanPrimaryDark,
    onPrimaryContainer = CleanPrimaryLight,
    secondary = CleanLilacBg,
    onSecondary = CleanLilacText,
    secondaryContainer = Color(0xFF332D41),
    onSecondaryContainer = CleanLilacBg,
    tertiary = CleanBlueBg,
    background = DarkBackground,
    onBackground = DarkTextPrimary,
    surface = DarkSurface,
    onSurface = DarkTextPrimary,
    surfaceVariant = DarkSurfaceVariant,
    onSurfaceVariant = DarkTextSecondary,
    outline = DarkOutline,
    error = CleanAlertBg,
    onError = CleanAlertDarkText
)

private val LightColorScheme = lightColorScheme(
    primary = CleanPrimaryBlue,
    onPrimary = Color.White,
    primaryContainer = CleanPrimaryLight,
    onPrimaryContainer = CleanOnPrimaryContainer,
    secondary = CleanLilacText,
    onSecondary = Color.White,
    secondaryContainer = CleanLilacBg,
    onSecondaryContainer = CleanLilacText,
    tertiary = CleanPrimaryBlue,
    background = CleanBackground,
    onBackground = CleanTextPrimary,
    surface = CleanSurface,
    onSurface = CleanTextPrimary,
    surfaceVariant = CleanSurfaceVariant,
    onSurfaceVariant = CleanTextSecondary,
    outline = CleanBorder,
    error = CleanAlertText,
    onError = Color.White
)

@Composable
fun MyApplicationTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = false, // Use our handcrafted branding colors
    content: @Composable () -> Unit
) {
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }
        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}

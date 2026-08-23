package com.example.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.model.MealStatus
import com.example.data.model.ShiftType
import com.example.data.model.UserRole
import com.example.data.model.UserStatus
import com.example.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppTopBar(
    title: String,
    subtitle: String? = null,
    onBackClick: (() -> Unit)? = null,
    actions: @Composable RowScope.() -> Unit = {}
) {
    TopAppBar(
        title = {
            Column {
                Text(
                    text = title,
                    fontWeight = FontWeight.Bold,
                    fontSize = 19.sp
                )
                if (subtitle != null) {
                    Text(
                        text = subtitle,
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        },
        navigationIcon = {
            if (onBackClick != null) {
                IconButton(onClick = onBackClick, modifier = Modifier.testTag("back_button")) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "Back"
                    )
                }
            }
        },
        actions = actions,
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = MaterialTheme.colorScheme.surface,
            titleContentColor = MaterialTheme.colorScheme.onSurface
        )
    )
}

@Composable
fun RoleBadge(role: UserRole, modifier: Modifier = Modifier) {
    val (bgColor, textColor, label) = when (role) {
        UserRole.ADMIN -> Triple(CleanAlertBg, CleanAlertDarkText, "👑 ADMIN")
        UserRole.MANAGER -> Triple(CleanLilacBg, CleanLilacText, "📋 MANAGER")
        UserRole.EMPLOYEE -> Triple(CleanBlueBg, CleanOnPrimaryContainer, "👤 RESIDENT")
    }
    Surface(
        color = bgColor,
        shape = RoundedCornerShape(16.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, textColor.copy(alpha = 0.2f)),
        modifier = modifier
    ) {
        Text(
            text = label,
            color = textColor,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
        )
    }
}

@Composable
fun ShiftBadge(shift: ShiftType, modifier: Modifier = Modifier) {
    val (bgColor, textColor, label, icon) = when (shift) {
        ShiftType.OFF_DUTY -> Quad(CleanSuccessBg, CleanSuccessText, "Off-Duty (भोजन ON)", Icons.Default.Home)
        ShiftType.MORNING -> Quad(Color(0xFFFFEDD5), Color(0xFF9A3412), "Morning Shift", Icons.Default.WbSunny)
        ShiftType.EVENING -> Quad(Color(0xFFFEF9C3), Color(0xFF854D0E), "Evening Shift", Icons.Default.WbTwilight)
        ShiftType.NIGHT -> Quad(CleanLilacBg, CleanLilacText, "Night Shift (भोजन ON)", Icons.Default.Bedtime)
    }
    Surface(
        color = bgColor,
        shape = RoundedCornerShape(12.dp),
        modifier = modifier
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
        ) {
            Icon(
                imageVector = icon,
                contentDescription = label,
                tint = textColor,
                modifier = Modifier.size(14.dp)
            )
            Spacer(modifier = Modifier.width(4.dp))
            Text(
                text = label,
                color = textColor,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

@Composable
fun MealStatusChip(status: MealStatus, modifier: Modifier = Modifier) {
    val (bgColor, textColor, label) = when (status) {
        MealStatus.ON -> Triple(CleanSuccessBg, CleanSuccessText, "✓ Active")
        MealStatus.OFF -> Triple(CleanAlertBg, CleanAlertText, "✕ Inactive")
        MealStatus.MEAL_REQUESTED -> Triple(CleanBlueBg, CleanPrimaryBlue, "✨ Requested")
        MealStatus.SKIP_REQUESTED -> Triple(Color(0xFFFFEDD5), Color(0xFFC2410C), "⏭️ Skipped")
        MealStatus.LATE_PLATE -> Triple(CleanLilacBg, CleanLilacText, "🍲 Late Plate")
        MealStatus.PACK_TIFFIN -> Triple(CleanBlueBg, CleanPrimaryBlue, "🍱 Pack Tiffin")
        MealStatus.ON_LEAVE -> Triple(CleanAlertBg, CleanAlertDarkText, "🌴 On Leave")
    }
    Surface(
        color = bgColor,
        shape = RoundedCornerShape(10.dp),
        modifier = modifier
    ) {
        Text(
            text = label,
            color = textColor,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
        )
    }
}

data class Quad<A, B, C, D>(val first: A, val second: B, val third: C, val fourth: D)

@Composable
fun StatusBanner(
    message: String?,
    isError: Boolean = false,
    onDismiss: () -> Unit
) {
    AnimatedVisibility(visible = message != null) {
        if (message != null) {
            Card(
                colors = CardDefaults.cardColors(
                    containerColor = if (isError) MaterialTheme.colorScheme.errorContainer else MaterialTheme.colorScheme.primaryContainer
                ),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 6.dp)
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = if (isError) Icons.Default.ErrorOutline else Icons.Default.CheckCircleOutline,
                        contentDescription = null,
                        tint = if (isError) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = message,
                        style = MaterialTheme.typography.bodyMedium,
                        color = if (isError) MaterialTheme.colorScheme.onErrorContainer else MaterialTheme.colorScheme.onPrimaryContainer,
                        modifier = Modifier.weight(1f)
                    )
                    IconButton(onClick = onDismiss, modifier = Modifier.size(24.dp)) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = "Dismiss",
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }
            }
        }
    }
}

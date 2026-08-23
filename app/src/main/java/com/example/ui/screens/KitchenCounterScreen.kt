package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.model.MealRecord
import com.example.data.model.MealStatus
import com.example.data.model.MealType
import com.example.ui.components.AppTopBar
import com.example.ui.components.MealStatusChip
import com.example.ui.components.StatusBanner
import com.example.ui.theme.*
import com.example.ui.viewmodel.KitchenViewModel

@Composable
fun KitchenCounterScreen(
    viewModel: KitchenViewModel,
    onBackClick: () -> Unit
) {
    val state by viewModel.uiState.collectAsState()
    val activeSummary = when (state.selectedMealType) {
        MealType.BREAKFAST -> state.breakfastSummary
        MealType.LUNCH -> state.lunchSummary
        MealType.DINNER -> state.dinnerSummary
    }

    var showGuestDialog by remember { mutableStateOf(false) }

    Scaffold(
        containerColor = CleanBackground,
        topBar = {
            AppTopBar(
                title = "Kitchen Live Counter (रसोई काउंटर)",
                subtitle = "Date: ${state.selectedDate} • Zero Food Wastage",
                onBackClick = onBackClick
            )
        }
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item {
                Spacer(modifier = Modifier.height(2.dp))
                StatusBanner(
                    message = state.quickNotice,
                    isError = false,
                    onDismiss = { viewModel.clearNotice() }
                )
            }

            // Meal Type Switcher (Breakfast, Lunch, Dinner)
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    listOf(
                        Triple(MealType.BREAKFAST, "☕ Breakfast", "Cutoff 6:30 AM"),
                        Triple(MealType.LUNCH, "🍲 Lunch", "Cutoff 8:30 AM"),
                        Triple(MealType.DINNER, "🍛 Dinner", "Cutoff 4:30 PM")
                    ).forEach { (mType, title, sub) ->
                        val isSelected = state.selectedMealType == mType
                        Surface(
                            color = if (isSelected) CleanPrimaryBlue else CleanSurface,
                            shape = RoundedCornerShape(16.dp),
                            border = if (isSelected) null else androidx.compose.foundation.BorderStroke(1.dp, CleanBorder),
                            modifier = Modifier
                                .weight(1f)
                                .clickable { viewModel.selectMealType(mType) }
                                .testTag("kitchen_tab_${mType.name}")
                        ) {
                            Column(
                                modifier = Modifier.padding(12.dp),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Text(
                                    text = title,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 12.sp,
                                    color = if (isSelected) Color.White else CleanTextPrimary
                                )
                                Text(
                                    text = sub,
                                    fontSize = 9.sp,
                                    color = if (isSelected) CleanBlueBg else CleanTextSecondary
                                )
                            }
                        }
                    }
                }
            }

            // REAL-TIME TARGET NUMBER HERO CARD (e.g. Lunch: 42 Total Plates)
            item {
                Surface(
                    color = CleanDarkCard,
                    shape = RoundedCornerShape(24.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(20.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Surface(
                            color = CleanBlueBg,
                            shape = RoundedCornerShape(20.dp)
                        ) {
                            Text(
                                text = "🎯 REAL-TIME TARGET NUMBER",
                                color = CleanPrimaryBlue,
                                fontWeight = FontWeight.Bold,
                                fontSize = 11.sp,
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)
                            )
                        }

                        Spacer(modifier = Modifier.height(10.dp))

                        Text(
                            text = "${state.selectedMealType.name}: ${activeSummary.totalRequiredPlates} TOTAL PLATES",
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 22.sp
                        )

                        Text(
                            text = "रसोईया केवल इतनी ही खुराक तैयार करेगा (100% Zero Wastage)",
                            color = CleanSurfaceVariant,
                            fontSize = 11.sp,
                            modifier = Modifier.padding(top = 4.dp)
                        )

                        Spacer(modifier = Modifier.height(16.dp))

                        // 3 Specific Breakdown Columns (Matching wireframe)
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            // Column 1: Normal Dining
                            BreakdownMetricCard(
                                title = "Normal Dining",
                                count = activeSummary.normalDiningCount,
                                subtitle = "हॉल में खाना",
                                bgColor = Color(0xFF1E293B),
                                accentColor = CleanSuccessText,
                                modifier = Modifier.weight(1f)
                            )

                            // Column 2: Pack Tiffins (Long OT)
                            BreakdownMetricCard(
                                title = "Pack Tiffins",
                                count = activeSummary.packTiffinsCount,
                                subtitle = "ड्यूटी साइट (OT)",
                                bgColor = Color(0xFF1E293B),
                                accentColor = CleanPrimaryBlueLight,
                                modifier = Modifier.weight(1f)
                            )

                            // Column 3: Late Covered Plates (Short OT)
                            BreakdownMetricCard(
                                title = "Late Covered",
                                count = activeSummary.lateCoveredPlatesCount,
                                subtitle = "ढक कर रखें (OT)",
                                bgColor = Color(0xFF1E293B),
                                accentColor = CleanLilacText,
                                modifier = Modifier.weight(1f)
                            )
                        }
                    }
                }
            }

            // Quick Guest Adder Bar
            item {
                Surface(
                    color = CleanSurface,
                    shape = RoundedCornerShape(20.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, CleanBorder),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text("Unplanned / Guest Meal", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = CleanTextPrimary)
                            Text("आपातकालीन या गेस्ट प्लेट जोड़ें", fontSize = 11.sp, color = CleanTextSecondary)
                        }
                        Button(
                            onClick = { showGuestDialog = true },
                            modifier = Modifier.testTag("add_guest_plate_button"),
                            colors = ButtonDefaults.buttonColors(containerColor = CleanPrimaryBlue),
                            shape = RoundedCornerShape(12.dp),
                            contentPadding = PaddingValues(horizontal = 14.dp, vertical = 8.dp)
                        ) {
                            Text("+ Add Plates", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            // Resident Plates Roster List
            item {
                Text(
                    text = "Live Resident Kitchen Roster (${activeSummary.mealsList.size} Entries):",
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                    color = CleanTextPrimary
                )
            }

            items(activeSummary.mealsList) { meal ->
                Surface(
                    color = CleanSurface,
                    shape = RoundedCornerShape(16.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, CleanBorder),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier.padding(14.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(
                                text = "${meal.userName} (Room ${meal.roomNumber})",
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp,
                                color = CleanTextPrimary
                            )
                            Text(
                                text = "Shift: ${meal.shiftAtTime.name} • ${if (meal.otHours > 0) "OT: ${meal.otHours}h" else "Regular"}",
                                fontSize = 11.sp,
                                color = CleanTextSecondary
                            )
                        }
                        MealStatusChip(status = meal.status)
                    }
                }
            }

            item {
                Spacer(modifier = Modifier.height(20.dp))
            }
        }
    }

    if (showGuestDialog) {
        var guestCount by remember { mutableIntStateOf(2) }
        var note by remember { mutableStateOf("Official Guest") }

        AlertDialog(
            onDismissRequest = { showGuestDialog = false },
            containerColor = CleanSurface,
            shape = RoundedCornerShape(24.dp),
            title = { Text("Add Guest / Unplanned Plates", fontWeight = FontWeight.Bold, color = CleanTextPrimary) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Select Extra Plates Count:", fontSize = 13.sp, color = CleanTextSecondary)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        listOf(1, 2, 5, 10).forEach { c ->
                            Surface(
                                color = if (guestCount == c) CleanPrimaryBlue else CleanSurfaceVariant,
                                shape = RoundedCornerShape(10.dp),
                                modifier = Modifier
                                    .weight(1f)
                                    .clickable { guestCount = c }
                                    .padding(vertical = 4.dp)
                            ) {
                                Text(
                                    text = "+$c",
                                    fontWeight = FontWeight.Bold,
                                    color = if (guestCount == c) Color.White else CleanTextPrimary,
                                    modifier = Modifier.padding(vertical = 8.dp),
                                    textAlign = androidx.compose.ui.text.style.TextAlign.Center
                                )
                            }
                        }
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.addManualGuestMeal(note, guestCount, state.selectedMealType)
                        showGuestDialog = false
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = CleanPrimaryBlue),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text("Add to Counter", fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showGuestDialog = false }) {
                    Text("Cancel", color = CleanTextSecondary)
                }
            }
        )
    }
}

@Composable
fun BreakdownMetricCard(
    title: String,
    count: Int,
    subtitle: String,
    bgColor: Color,
    accentColor: Color,
    modifier: Modifier = Modifier
) {
    Surface(
        color = bgColor,
        shape = RoundedCornerShape(14.dp),
        modifier = modifier
    ) {
        Column(
            modifier = Modifier.padding(10.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "$count",
                color = accentColor,
                fontWeight = FontWeight.Bold,
                fontSize = 20.sp
            )
            Text(
                text = title,
                color = Color.White,
                fontWeight = FontWeight.SemiBold,
                fontSize = 10.sp,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center
            )
            Text(
                text = subtitle,
                color = CleanSurfaceVariant.copy(alpha = 0.8f),
                fontSize = 8.sp,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center
            )
        }
    }
}

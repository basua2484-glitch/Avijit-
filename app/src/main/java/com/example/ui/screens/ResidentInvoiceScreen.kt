package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.model.ResidentInvoice
import com.example.ui.components.AppTopBar
import com.example.ui.components.StatusBanner
import com.example.ui.theme.*
import com.example.ui.viewmodel.ResidentViewModel
import java.util.Locale

@Composable
fun ResidentInvoiceScreen(
    viewModel: ResidentViewModel,
    onBackClick: () -> Unit
) {
    val state by viewModel.uiState.collectAsState()
    val invoice = state.currentInvoice
    val user = state.user

    var showPaymentModal by remember { mutableStateOf(false) }
    var selectedPaymentMode by remember { mutableStateOf("UPI (Google Pay / PhonePe)") }

    Scaffold(
        containerColor = CleanBackground,
        topBar = {
            AppTopBar(
                title = "Itemized Statement (बिल विवरण)",
                subtitle = "Month: ${state.selectedDate.take(7)} • ${user?.name}",
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
                    message = state.message,
                    isError = false,
                    onDismiss = { viewModel.clearMessage() }
                )
            }

            // Invoice Summary Header Card
            item {
                Surface(
                    color = CleanSurface,
                    shape = RoundedCornerShape(24.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, CleanBorder),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(20.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(
                                    text = "Monthly Hostel & Mess Bill",
                                    color = CleanTextSecondary,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Medium
                                )
                                Text(
                                    text = user?.name ?: "Rahul Kumar",
                                    color = CleanTextPrimary,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 18.sp
                                )
                                Text(
                                    text = "Room: ${user?.assignedRoom ?: "204"} • ID: ${user?.userIdCode ?: "EMP_101"}",
                                    color = CleanTextSecondary,
                                    fontSize = 11.sp
                                )
                            }

                            val isPaid = invoice?.isPaid == true
                            Surface(
                                color = if (isPaid) CleanSuccessBg else CleanAlertBg,
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Text(
                                    text = if (isPaid) "✓ PAID" else "⏳ PENDING",
                                    color = if (isPaid) CleanSuccessText else CleanAlertDarkText,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 12.sp,
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                                )
                            }
                        }

                        HorizontalDivider(
                            color = CleanBorder,
                            modifier = Modifier.padding(vertical = 14.dp)
                        )

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Total Amount Payable:",
                                color = CleanTextSecondary,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Medium
                            )
                            val total = invoice?.totalPayable ?: state.estimatedLiveBill
                            Text(
                                text = "₹${String.format(Locale.US, "%,.2f", total)}",
                                color = CleanPrimaryBlue,
                                fontWeight = FontWeight.Bold,
                                fontSize = 24.sp
                            )
                        }
                    }
                }
            }

            // EXACT ITEMIZED BREAKDOWN TABLE (Matching user's wireframe)
            item {
                Surface(
                    color = CleanSurface,
                    shape = RoundedCornerShape(24.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, CleanBorder),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(20.dp)) {
                        Text(
                            text = "Itemized Statement Breakdown",
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp,
                            color = CleanTextPrimary
                        )
                        Text(
                            text = "पारदर्शी मासिक गणना (100% Transparent Auto-Billing)",
                            fontSize = 11.sp,
                            color = CleanTextSecondary,
                            modifier = Modifier.padding(bottom = 14.dp)
                        )

                        // Table Header
                        Surface(
                            color = CleanSurfaceVariant,
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Row(
                                modifier = Modifier.padding(10.dp),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text("Expense Item", fontWeight = FontWeight.Bold, fontSize = 12.sp, color = CleanTextPrimary, modifier = Modifier.weight(1.5f))
                                Text("Breakdown / Details", fontWeight = FontWeight.Bold, fontSize = 11.sp, color = CleanTextPrimary, modifier = Modifier.weight(1.8f))
                                Text("Amount (₹)", fontWeight = FontWeight.Bold, fontSize = 12.sp, color = CleanTextPrimary, textAlign = TextAlign.End, modifier = Modifier.weight(1f))
                            }
                        }

                        Spacer(modifier = Modifier.height(6.dp))

                        val plates = invoice?.totalPlatesConsumed ?: state.monthlyPlatesConsumed
                        val rate = invoice?.plateRate ?: state.currentPlateRate
                        val mealAmt = invoice?.mealCost ?: (plates * rate)
                        val electShare = invoice?.electricityShare ?: 350.0
                        val waterShare = invoice?.waterShare ?: 150.0
                        val cookShare = invoice?.cookSalaryShare ?: 250.0
                        val roomRent = invoice?.roomRent ?: 1500.0
                        val totalPayable = invoice?.totalPayable ?: (mealAmt + electShare + waterShare + cookShare + roomRent)

                        // Row 1: Total Meal Plates
                        InvoiceTableRow(
                            title = "Total Meal Plates",
                            details = "$plates Plates (× ₹$rate/plate)",
                            amount = mealAmt,
                            icon = Icons.Default.Restaurant
                        )
                        HorizontalDivider(color = CleanBorder.copy(alpha = 0.5f))

                        // Row 2: Electricity Charge
                        InvoiceTableRow(
                            title = "Electricity Charge",
                            details = "Share on active stay days (${invoice?.activeStayDays ?: 30}/30)",
                            amount = electShare,
                            icon = Icons.Default.Bolt
                        )
                        HorizontalDivider(color = CleanBorder.copy(alpha = 0.5f))

                        // Row 3: Water Charge
                        InvoiceTableRow(
                            title = "Water Charge",
                            details = "Share on active stay days",
                            amount = waterShare,
                            icon = Icons.Default.WaterDrop
                        )
                        HorizontalDivider(color = CleanBorder.copy(alpha = 0.5f))

                        // Row 4: Cook & Staff Salary
                        InvoiceTableRow(
                            title = "Cook & Staff Salary",
                            details = "Equal overhead share per person",
                            amount = cookShare,
                            icon = Icons.Default.SoupKitchen
                        )
                        HorizontalDivider(color = CleanBorder.copy(alpha = 0.5f))

                        // Row 5: Room Rent / Maintenance
                        InvoiceTableRow(
                            title = "Room Rent / Maint.",
                            details = "Fixed monthly room charge",
                            amount = roomRent,
                            icon = Icons.Default.MeetingRoom
                        )
                        HorizontalDivider(thickness = 2.dp, color = CleanPrimaryBlue)

                        // Total Row
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Total Amount Payable",
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp,
                                color = CleanTextPrimary
                            )
                            Text(
                                text = "₹${String.format(Locale.US, "%,.2f", totalPayable)}",
                                color = CleanPrimaryBlue,
                                fontWeight = FontWeight.Bold,
                                fontSize = 20.sp
                            )
                        }
                    }
                }
            }

            // Calculation Logic Card (Showing the 3 mathematical steps)
            item {
                Surface(
                    color = CleanSurfaceVariant,
                    shape = RoundedCornerShape(20.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, CleanBorder),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "📐 3-Step Auto-Accounting Logic Used:",
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp,
                            color = CleanTextPrimary
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "• Step 1: Per Plate Rate = Total Mess Grocery & Fuel / Total Consumed Plates\n• Step 2: Utilities & Staff Salary divided by Active Stay Days & headcount\n• Step 3: Individual Bill = (Plates × Rate) + Electricity + Water + Cook + Room Rent",
                            fontSize = 11.sp,
                            color = CleanTextSecondary,
                            lineHeight = 16.sp
                        )
                    }
                }
            }

            // Action Buttons (Pay / Download)
            item {
                Button(
                    onClick = { showPaymentModal = true },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp)
                        .testTag("pay_bill_button"),
                    colors = ButtonDefaults.buttonColors(containerColor = CleanPrimaryBlue),
                    shape = RoundedCornerShape(14.dp)
                ) {
                    Icon(Icons.Default.Payment, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(if (invoice?.isPaid == true) "Payment Completed" else "Pay Now (भुगतान करें)", fontWeight = FontWeight.Bold)
                }
            }

            item {
                Spacer(modifier = Modifier.height(24.dp))
            }
        }
    }

    // Payment Simulation Dialog
    if (showPaymentModal) {
        AlertDialog(
            onDismissRequest = { showPaymentModal = false },
            containerColor = CleanSurface,
            shape = RoundedCornerShape(24.dp),
            title = {
                Text("Hostel Bill Payment (बिल भुगतान)", fontWeight = FontWeight.Bold, color = CleanTextPrimary)
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(
                        text = "Payable Amount: ₹${String.format(Locale.US, "%,.2f", invoice?.totalPayable ?: state.estimatedLiveBill)}",
                        fontWeight = FontWeight.Bold,
                        color = CleanPrimaryBlue,
                        fontSize = 16.sp
                    )
                    Text("Select Payment Mode:", fontSize = 13.sp, color = CleanTextSecondary)

                    listOf(
                        "UPI (Google Pay / PhonePe / Paytm)",
                        "Cash to Hostel Manager",
                        "Bank Transfer / IMPS"
                    ).forEach { mode ->
                        Surface(
                            color = if (selectedPaymentMode == mode) CleanBlueBg else CleanSurfaceVariant,
                            shape = RoundedCornerShape(12.dp),
                            border = if (selectedPaymentMode == mode) androidx.compose.foundation.BorderStroke(1.5.dp, CleanPrimaryBlue) else null,
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { selectedPaymentMode = mode }
                        ) {
                            Row(
                                modifier = Modifier.padding(10.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                RadioButton(
                                    selected = selectedPaymentMode == mode,
                                    onClick = { selectedPaymentMode = mode },
                                    colors = RadioButtonDefaults.colors(selectedColor = CleanPrimaryBlue)
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(mode, fontSize = 12.sp, color = CleanTextPrimary)
                            }
                        }
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        invoice?.id?.let { invId ->
                            viewModel.payInvoice(invId, selectedPaymentMode)
                        }
                        showPaymentModal = false
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = CleanPrimaryBlue),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.testTag("confirm_payment_button")
                ) {
                    Text("Confirm Payment (भुगतान दर्ज करें)", fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showPaymentModal = false }) {
                    Text("Cancel", color = CleanTextSecondary)
                }
            }
        )
    }
}

@Composable
fun InvoiceTableRow(
    title: String,
    details: String,
    amount: Double,
    icon: androidx.compose.ui.graphics.vector.ImageVector
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.weight(1.5f)
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = CleanPrimaryBlue,
                modifier = Modifier.size(16.dp)
            )
            Spacer(modifier = Modifier.width(6.dp))
            Text(title, fontWeight = FontWeight.SemiBold, fontSize = 12.sp, color = CleanTextPrimary)
        }
        Text(
            text = details,
            fontSize = 11.sp,
            color = CleanTextSecondary,
            modifier = Modifier.weight(1.8f)
        )
        Text(
            text = "₹${String.format(Locale.US, "%,.2f", amount)}",
            fontWeight = FontWeight.Bold,
            fontSize = 12.sp,
            textAlign = TextAlign.End,
            color = CleanTextPrimary,
            modifier = Modifier.weight(1f)
        )
    }
}

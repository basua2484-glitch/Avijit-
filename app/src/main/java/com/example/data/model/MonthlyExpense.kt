package com.example.data.model

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "monthly_expenses")
data class MonthlyExpense(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val monthYear: String, // Format: YYYY-MM e.g. "2026-08"
    val groceryMessCost: Double = 0.0,    // Total grocery, ration, vegetables, fuel
    val electricityBill: Double = 0.0,    // Electricity bill
    val waterBill: Double = 0.0,          // Water bill
    val cookStaffSalary: Double = 0.0,    // Cook & mess staff salary
    val roomRentPerPerson: Double = 1500.0, // Default room rent
    val totalPlatesConsumed: Int = 0,
    val calculatedPlateRate: Double = 0.0, // groceryMessCost / totalPlatesConsumed
    val isPublished: Boolean = false,
    val updatedAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "resident_invoices")
data class ResidentInvoice(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val monthYear: String, // e.g. "2026-08"
    val userId: Long,
    val userCode: String,
    val userName: String,
    val roomNumber: String,
    val totalPlatesConsumed: Int,
    val plateRate: Double,
    val mealCost: Double, // totalPlatesConsumed * plateRate
    val activeStayDays: Int, // Out of total month days (e.g. 30 minus leave days)
    val totalMonthDays: Int = 30,
    val electricityShare: Double,
    val waterShare: Double,
    val cookSalaryShare: Double,
    val roomRent: Double,
    val totalPayable: Double, // mealCost + electricityShare + waterShare + cookSalaryShare + roomRent
    val isPaid: Boolean = false,
    val paymentMode: String = "Pending", // "UPI", "Cash", "Pending"
    val paymentDate: Long? = null,
    val generatedAt: Long = System.currentTimeMillis()
)

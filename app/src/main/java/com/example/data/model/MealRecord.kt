package com.example.data.model

import androidx.room.Entity
import androidx.room.PrimaryKey

enum class MealType {
    BREAKFAST,
    LUNCH,
    DINNER
}

enum class MealStatus {
    OFF,              // Khana nahi chahiye
    ON,               // Khana ON (Normal dining)
    SKIP_REQUESTED,   // Remote skip override
    MEAL_REQUESTED,   // Remote request override
    LATE_PLATE,       // Short OT (1-3h) - Khana dhak kar rakhega
    PACK_TIFFIN,      // Long OT (4h+) - Site par tiffin pack
    ON_LEAVE          // Gaon / Chhutti par
}

enum class OvertimeType {
    NONE,
    SHORT_OT, // 1-3 hrs -> Late Plate
    LONG_OT   // 4+ hrs -> Pack Tiffin or Cancel
}

@Entity(tableName = "meal_records")
data class MealRecord(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val userId: Long,
    val userCode: String,
    val userName: String,
    val roomNumber: String,
    val date: String, // Format: YYYY-MM-DD
    val mealType: MealType,
    val status: MealStatus,
    val shiftAtTime: ShiftType,
    val overtimeType: OvertimeType = OvertimeType.NONE,
    val otHours: Int = 0,
    val isLocked: Boolean = false, // True after strict cut-off
    val isConsumed: Boolean = true,
    val updatedAt: Long = System.currentTimeMillis(),
    val notes: String = ""
)

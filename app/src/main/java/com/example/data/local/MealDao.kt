package com.example.data.local

import androidx.room.*
import com.example.data.model.MealRecord
import com.example.data.model.MealStatus
import com.example.data.model.MealType
import kotlinx.coroutines.flow.Flow

@Dao
interface MealDao {
    @Query("SELECT * FROM meal_records WHERE date = :date ORDER BY id DESC")
    fun getMealsForDate(date: String): Flow<List<MealRecord>>

    @Query("SELECT * FROM meal_records WHERE userId = :userId AND date = :date")
    fun getUserMealsForDate(userId: Long, date: String): Flow<List<MealRecord>>

    @Query("SELECT * FROM meal_records WHERE userId = :userId AND date = :date")
    suspend fun getUserMealsForDateOnce(userId: Long, date: String): List<MealRecord>

    @Query("SELECT * FROM meal_records WHERE userId = :userId AND date BETWEEN :startDate AND :endDate")
    fun getUserMealsForDateRange(userId: Long, startDate: String, endDate: String): Flow<List<MealRecord>>

    @Query("SELECT * FROM meal_records WHERE date LIKE :monthPrefix || '%'")
    fun getMealsForMonth(monthPrefix: String): Flow<List<MealRecord>>

    @Query("SELECT * FROM meal_records WHERE date LIKE :monthPrefix || '%'")
    suspend fun getMealsForMonthOnce(monthPrefix: String): List<MealRecord>

    @Query("SELECT * FROM meal_records WHERE userId = :userId AND date LIKE :monthPrefix || '%'")
    fun getUserMealsForMonth(userId: Long, monthPrefix: String): Flow<List<MealRecord>>

    @Query("SELECT COUNT(*) FROM meal_records WHERE userId = :userId AND date LIKE :monthPrefix || '%' AND status IN ('ON', 'MEAL_REQUESTED', 'LATE_PLATE', 'PACK_TIFFIN') AND isConsumed = 1")
    fun getUserConsumedPlateCount(userId: Long, monthPrefix: String): Flow<Int>

    @Query("SELECT COUNT(*) FROM meal_records WHERE date LIKE :monthPrefix || '%' AND status IN ('ON', 'MEAL_REQUESTED', 'LATE_PLATE', 'PACK_TIFFIN') AND isConsumed = 1")
    suspend fun getTotalConsumedPlatesForMonth(monthPrefix: String): Int

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertMeal(meal: MealRecord): Long

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertMeals(meals: List<MealRecord>)

    @Update
    suspend fun updateMeal(meal: MealRecord)

    @Query("UPDATE meal_records SET status = :status, isConsumed = :isConsumed, updatedAt = :updatedAt WHERE id = :id")
    suspend fun updateMealStatus(id: Long, status: MealStatus, isConsumed: Boolean, updatedAt: Long = System.currentTimeMillis())

    @Query("UPDATE meal_records SET status = 'ON_LEAVE', isConsumed = 0, isLocked = 1 WHERE userId = :userId AND date BETWEEN :startDate AND :endDate")
    suspend fun markMealsOnLeave(userId: Long, startDate: String, endDate: String)

    @Query("UPDATE meal_records SET isLocked = :isLocked WHERE date = :date AND mealType = :mealType")
    suspend fun lockMealsForCutOff(date: String, mealType: MealType, isLocked: Boolean)
}

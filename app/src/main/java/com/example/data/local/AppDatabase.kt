package com.example.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.TypeConverter
import androidx.room.TypeConverters
import com.example.data.model.*

class Converters {
    @TypeConverter
    fun fromUserRole(value: UserRole): String = value.name

    @TypeConverter
    fun toUserRole(value: String): UserRole = runCatching { UserRole.valueOf(value) }.getOrDefault(UserRole.EMPLOYEE)

    @TypeConverter
    fun fromUserStatus(value: UserStatus): String = value.name

    @TypeConverter
    fun toUserStatus(value: String): UserStatus = runCatching { UserStatus.valueOf(value) }.getOrDefault(UserStatus.ACTIVE)

    @TypeConverter
    fun fromShiftType(value: ShiftType): String = value.name

    @TypeConverter
    fun toShiftType(value: String): ShiftType = runCatching { ShiftType.valueOf(value) }.getOrDefault(ShiftType.OFF_DUTY)

    @TypeConverter
    fun fromMealType(value: MealType): String = value.name

    @TypeConverter
    fun toMealType(value: String): MealType = runCatching { MealType.valueOf(value) }.getOrDefault(MealType.LUNCH)

    @TypeConverter
    fun fromMealStatus(value: MealStatus): String = value.name

    @TypeConverter
    fun toMealStatus(value: String): MealStatus = runCatching { MealStatus.valueOf(value) }.getOrDefault(MealStatus.ON)

    @TypeConverter
    fun fromOvertimeType(value: OvertimeType): String = value.name

    @TypeConverter
    fun toOvertimeType(value: String): OvertimeType = runCatching { OvertimeType.valueOf(value) }.getOrDefault(OvertimeType.NONE)

    @TypeConverter
    fun fromLeaveStatus(value: LeaveStatus): String = value.name

    @TypeConverter
    fun toLeaveStatus(value: String): LeaveStatus = runCatching { LeaveStatus.valueOf(value) }.getOrDefault(LeaveStatus.APPROVED)
}

@Database(
    entities = [
        User::class,
        MealRecord::class,
        LeaveRecord::class,
        MonthlyExpense::class,
        ResidentInvoice::class
    ],
    version = 1,
    exportSchema = false
)
@TypeConverters(Converters::class)
abstract class AppDatabase : RoomDatabase() {
    abstract fun userDao(): UserDao
    abstract fun mealDao(): MealDao
    abstract fun leaveDao(): LeaveDao
    abstract fun expenseDao(): ExpenseDao
    abstract fun invoiceDao(): InvoiceDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getDatabase(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "hostel_mess_db"
                ).fallbackToDestructiveMigration().build()
                INSTANCE = instance
                instance
            }
        }
    }
}

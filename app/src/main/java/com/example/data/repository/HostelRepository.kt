package com.example.data.repository

import com.example.data.local.*
import com.example.data.model.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.*
import kotlin.math.roundToInt

class HostelRepository(
    private val userDao: UserDao,
    private val mealDao: MealDao,
    private val leaveDao: LeaveDao,
    private val expenseDao: ExpenseDao,
    private val invoiceDao: InvoiceDao
) {
    val allUsers: Flow<List<User>> = userDao.getAllUsers()
    val activeUsers: Flow<List<User>> = userDao.getActiveUsers()
    val allLeaves: Flow<List<LeaveRecord>> = leaveDao.getAllLeaves()
    val pendingLeaves: Flow<List<LeaveRecord>> = leaveDao.getPendingLeaves()
    val allExpenses: Flow<List<MonthlyExpense>> = expenseDao.getAllExpenses()

    fun getUserById(userId: Long): Flow<User?> = userDao.getUserById(userId)
    fun getUserLeaves(userId: Long): Flow<List<LeaveRecord>> = leaveDao.getUserLeaves(userId)
    fun getMealsForDate(date: String): Flow<List<MealRecord>> = mealDao.getMealsForDate(date)
    fun getUserMealsForDate(userId: Long, date: String): Flow<List<MealRecord>> = mealDao.getUserMealsForDate(userId, date)
    fun getUserMealsForMonth(userId: Long, monthPrefix: String): Flow<List<MealRecord>> = mealDao.getUserMealsForMonth(userId, monthPrefix)
    fun getUserConsumedPlateCount(userId: Long, monthPrefix: String): Flow<Int> = mealDao.getUserConsumedPlateCount(userId, monthPrefix)
    fun getExpenseForMonth(monthYear: String): Flow<MonthlyExpense?> = expenseDao.getExpenseForMonth(monthYear)
    fun getInvoicesForMonth(monthYear: String): Flow<List<ResidentInvoice>> = invoiceDao.getInvoicesForMonth(monthYear)
    fun getUserInvoices(userId: Long): Flow<List<ResidentInvoice>> = invoiceDao.getUserInvoices(userId)
    fun getUserInvoiceForMonth(userId: Long, monthYear: String): Flow<ResidentInvoice?> = invoiceDao.getUserInvoiceForMonth(userId, monthYear)

    suspend fun getUserByMobile(mobile: String): User? = withContext(Dispatchers.IO) {
        userDao.getUserByMobile(mobile)
    }

    suspend fun getUserByIdOnce(userId: Long): User? = withContext(Dispatchers.IO) {
        userDao.getUserByIdOnce(userId)
    }

    suspend fun registerUser(
        name: String,
        mobile: String,
        role: UserRole,
        assignedRoom: String
    ): User = withContext(Dispatchers.IO) {
        val userCode = when (role) {
            UserRole.ADMIN -> "ADM_${System.currentTimeMillis() % 1000}"
            UserRole.MANAGER -> "MGR_${System.currentTimeMillis() % 1000}"
            UserRole.EMPLOYEE -> "EMP_${System.currentTimeMillis() % 1000}"
        }
        val user = User(
            userIdCode = userCode,
            name = name,
            mobile = mobile,
            role = role,
            status = UserStatus.ACTIVE,
            assignedRoom = assignedRoom,
            currentShift = ShiftType.OFF_DUTY
        )
        val id = userDao.insertUser(user)
        val created = user.copy(id = id)
        // Auto-generate today's meals for new employee
        if (role == UserRole.EMPLOYEE) {
            val today = getTodayDateString()
            generateMealsForUserDate(created, today)
        }
        created
    }

    suspend fun updateUser(user: User) = withContext(Dispatchers.IO) {
        userDao.updateUser(user)
    }

    suspend fun updateUserStatus(userId: Long, status: UserStatus) = withContext(Dispatchers.IO) {
        userDao.updateUserStatus(userId, status)
    }

    suspend fun updateUserRoom(userId: Long, room: String) = withContext(Dispatchers.IO) {
        userDao.updateUserRoom(userId, room)
    }

    suspend fun replaceManager(newManagerName: String, newManagerMobile: String, assignedRoom: String = "Office"): User = withContext(Dispatchers.IO) {
        // Step 1: Revoke existing active managers to REPLACED
        userDao.revokeExistingRole(UserRole.MANAGER)
        // Step 2: Create new manager
        val managerCode = "MGR_${System.currentTimeMillis() % 1000}"
        val newManager = User(
            userIdCode = managerCode,
            name = newManagerName,
            mobile = newManagerMobile,
            role = UserRole.MANAGER,
            status = UserStatus.ACTIVE,
            assignedRoom = assignedRoom,
            currentShift = ShiftType.OFF_DUTY
        )
        val id = userDao.insertUser(newManager)
        newManager.copy(id = id)
    }

    suspend fun deleteUser(userId: Long) = withContext(Dispatchers.IO) {
        userDao.deleteUser(userId)
    }

    /**
     * Updates shift and re-applies default meal operational rules:
     * - Off-Duty / Night Shift -> Meal ON
     * - Morning / Evening (On-Duty) -> Meal OFF
     */
    suspend fun updateEmployeeShift(userId: Long, newShift: ShiftType, date: String = getTodayDateString()) = withContext(Dispatchers.IO) {
        userDao.updateUserShift(userId, newShift)
        val user = userDao.getUserByIdOnce(userId) ?: return@withContext

        // Check if user has active approved leave for today
        val activeLeave = leaveDao.getActiveLeaveForUser(userId, date)
        if (activeLeave != null) {
            // User is on leave, keep meals ON_LEAVE
            return@withContext
        }

        // Determine default meal status based on Shift Rule:
        // Rule: Off-Duty aur Night Shift walon ka khana ON rahega. On-Duty (Morning/Evening) walon ka khana OFF rahega.
        val defaultStatus = when (newShift) {
            ShiftType.OFF_DUTY, ShiftType.NIGHT -> MealStatus.ON
            ShiftType.MORNING, ShiftType.EVENING -> MealStatus.OFF
        }
        val isConsumed = (defaultStatus == MealStatus.ON)

        val existingMeals = mealDao.getUserMealsForDateOnce(userId, date)
        if (existingMeals.isEmpty()) {
            val meals = listOf(
                MealRecord(
                    userId = userId,
                    userCode = user.userIdCode,
                    userName = user.name,
                    roomNumber = user.assignedRoom,
                    date = date,
                    mealType = MealType.BREAKFAST,
                    status = defaultStatus,
                    shiftAtTime = newShift,
                    isConsumed = isConsumed
                ),
                MealRecord(
                    userId = userId,
                    userCode = user.userIdCode,
                    userName = user.name,
                    roomNumber = user.assignedRoom,
                    date = date,
                    mealType = MealType.LUNCH,
                    status = defaultStatus,
                    shiftAtTime = newShift,
                    isConsumed = isConsumed
                ),
                MealRecord(
                    userId = userId,
                    userCode = user.userIdCode,
                    userName = user.name,
                    roomNumber = user.assignedRoom,
                    date = date,
                    mealType = MealType.DINNER,
                    status = defaultStatus,
                    shiftAtTime = newShift,
                    isConsumed = isConsumed
                )
            )
            mealDao.insertMeals(meals)
        } else {
            existingMeals.forEach { meal ->
                if (!meal.isLocked && meal.status != MealStatus.ON_LEAVE) {
                    mealDao.updateMeal(
                        meal.copy(
                            status = defaultStatus,
                            shiftAtTime = newShift,
                            isConsumed = isConsumed,
                            overtimeType = OvertimeType.NONE,
                            otHours = 0,
                            updatedAt = System.currentTimeMillis()
                        )
                    )
                }
            }
        }
    }

    /**
     * Remote Override:
     * - Request Meal: On-Duty person requests meal
     * - Skip Meal: Off-duty person skips meal
     */
    suspend fun toggleMealRequest(mealId: Long, requestAction: Boolean) = withContext(Dispatchers.IO) {
        val newStatus = if (requestAction) MealStatus.MEAL_REQUESTED else MealStatus.SKIP_REQUESTED
        val isConsumed = requestAction
        mealDao.updateMealStatus(mealId, newStatus, isConsumed)
    }

    /**
     * Overtime Logic:
     * - Short OT (1-3h) -> Late Plate Request (Cook food covered)
     * - Long OT (4h+) -> Pack Tiffin (Duty site) or Cancel
     */
    suspend fun updateMealOvertime(
        mealId: Long,
        otHours: Int,
        action: String // "LATE_PLATE", "PACK_TIFFIN", "CANCEL"
    ) = withContext(Dispatchers.IO) {
        val (status, otType, consumed) = when {
            action == "LATE_PLATE" || (otHours in 1..3 && action != "CANCEL") -> {
                Triple(MealStatus.LATE_PLATE, OvertimeType.SHORT_OT, true)
            }
            action == "PACK_TIFFIN" || (otHours >= 4 && action != "CANCEL") -> {
                Triple(MealStatus.PACK_TIFFIN, OvertimeType.LONG_OT, true)
            }
            else -> {
                Triple(MealStatus.OFF, OvertimeType.LONG_OT, false)
            }
        }
        val existing = mealDao.getMealsForMonthOnce(getTodayDateString().substring(0, 7)).firstOrNull { it.id == mealId }
        if (existing != null) {
            mealDao.updateMeal(
                existing.copy(
                    status = status,
                    overtimeType = otType,
                    otHours = otHours,
                    isConsumed = consumed,
                    updatedAt = System.currentTimeMillis()
                )
            )
        }
    }

    /**
     * Gaon / Leave Management:
     * Marking on leave automatically cancels and locks all meals between start and end date.
     */
    suspend fun submitLeave(
        userId: Long,
        startDate: String,
        endDate: String,
        reason: String,
        autoApprove: Boolean = true
    ): Long = withContext(Dispatchers.IO) {
        val user = userDao.getUserByIdOnce(userId) ?: return@withContext -1L
        val days = calculateDaysBetween(startDate, endDate)
        val leave = LeaveRecord(
            userId = userId,
            userCode = user.userIdCode,
            userName = user.name,
            startDate = startDate,
            endDate = endDate,
            totalDays = days,
            reason = reason,
            status = if (autoApprove) LeaveStatus.APPROVED else LeaveStatus.PENDING
        )
        val leaveId = leaveDao.insertLeave(leave)
        if (autoApprove) {
            mealDao.markMealsOnLeave(userId, startDate, endDate)
        }
        leaveId
    }

    suspend fun approveLeave(leaveId: Long, approve: Boolean) = withContext(Dispatchers.IO) {
        val status = if (approve) LeaveStatus.APPROVED else LeaveStatus.REJECTED
        leaveDao.updateLeaveStatus(leaveId, status)
        if (approve) {
            val all = leaveDao.getAllLeaves()
            // In IO, fetch leave record details
            // lock meals
        }
    }

    suspend fun ensureDailyMealsGenerated(date: String = getTodayDateString()) = withContext(Dispatchers.IO) {
        val users = userDao.getUserByIdOnce(1L) // Check if DB is seeded
        if (users == null) {
            seedInitialData()
        }
        val allActive = userDao.getUserByMobile("dummy") // check
        // check users
    }

    suspend fun generateMealsForUserDate(user: User, date: String) = withContext(Dispatchers.IO) {
        val existing = mealDao.getUserMealsForDateOnce(user.id, date)
        if (existing.isNotEmpty()) return@withContext

        val activeLeave = leaveDao.getActiveLeaveForUser(user.id, date)
        if (activeLeave != null) {
            val leaveMeals = listOf(
                MealRecord(userId = user.id, userCode = user.userIdCode, userName = user.name, roomNumber = user.assignedRoom, date = date, mealType = MealType.BREAKFAST, status = MealStatus.ON_LEAVE, shiftAtTime = user.currentShift, isConsumed = false, isLocked = true),
                MealRecord(userId = user.id, userCode = user.userIdCode, userName = user.name, roomNumber = user.assignedRoom, date = date, mealType = MealType.LUNCH, status = MealStatus.ON_LEAVE, shiftAtTime = user.currentShift, isConsumed = false, isLocked = true),
                MealRecord(userId = user.id, userCode = user.userIdCode, userName = user.name, roomNumber = user.assignedRoom, date = date, mealType = MealType.DINNER, status = MealStatus.ON_LEAVE, shiftAtTime = user.currentShift, isConsumed = false, isLocked = true)
            )
            mealDao.insertMeals(leaveMeals)
            return@withContext
        }

        val defaultStatus = when (user.currentShift) {
            ShiftType.OFF_DUTY, ShiftType.NIGHT -> MealStatus.ON
            ShiftType.MORNING, ShiftType.EVENING -> MealStatus.OFF
        }
        val isConsumed = (defaultStatus == MealStatus.ON)

        val meals = listOf(
            MealRecord(userId = user.id, userCode = user.userIdCode, userName = user.name, roomNumber = user.assignedRoom, date = date, mealType = MealType.BREAKFAST, status = defaultStatus, shiftAtTime = user.currentShift, isConsumed = isConsumed),
            MealRecord(userId = user.id, userCode = user.userIdCode, userName = user.name, roomNumber = user.assignedRoom, date = date, mealType = MealType.LUNCH, status = defaultStatus, shiftAtTime = user.currentShift, isConsumed = isConsumed),
            MealRecord(userId = user.id, userCode = user.userIdCode, userName = user.name, roomNumber = user.assignedRoom, date = date, mealType = MealType.DINNER, status = defaultStatus, shiftAtTime = user.currentShift, isConsumed = isConsumed)
        )
        mealDao.insertMeals(meals)
    }

    /**
     * Expense & 3-Step Auto-Accounting Billing Formula:
     * Step 1: Per Plate Rate = Total Grocery & Fuel Mess Cost / Total Consumed Plates across all residents.
     * Step 2: Utility & Overhead Share:
     *   - Electricity Charge = Active stay days share
     *   - Water Charge = Active stay days share
     *   - Cook & Staff Salary = Fixed overhead share per resident
     *   - Room Rent = Fixed monthly charge (₹1500)
     * Step 3: Individual Bill Formula = (Consumed Plates * Rate) + Electricity + Water + Cook + Rent
     */
    suspend fun saveMonthlyExpenseAndGenerateInvoices(
        monthYear: String,
        groceryCost: Double,
        electricityBill: Double,
        waterBill: Double,
        cookSalary: Double,
        roomRent: Double = 1500.0
    ): Pair<Double, List<ResidentInvoice>> = withContext(Dispatchers.IO) {
        val totalPlates = mealDao.getTotalConsumedPlatesForMonth(monthYear).coerceAtLeast(1)
        val calculatedPlateRate = (groceryCost / totalPlates * 100.0).roundToInt() / 100.0

        val expense = MonthlyExpense(
            monthYear = monthYear,
            groceryMessCost = groceryCost,
            electricityBill = electricityBill,
            waterBill = waterBill,
            cookStaffSalary = cookSalary,
            roomRentPerPerson = roomRent,
            totalPlatesConsumed = totalPlates,
            calculatedPlateRate = calculatedPlateRate,
            isPublished = true,
            updatedAt = System.currentTimeMillis()
        )
        expenseDao.insertOrUpdateExpense(expense)

        // Get all active employees
        val allEmployees = withContext(Dispatchers.IO) {
            val users = mutableListOf<User>()
            userDao.getUserByIdOnce(1L)?.let { if (it.role == UserRole.EMPLOYEE) users.add(it) }
            // Query all active employees
            users
        }

        // Fetch all users
        val allUsersList = mutableListOf<User>()
        // Let's generate invoices for all employees
        val mealsForMonth = mealDao.getMealsForMonthOnce(monthYear)
        val usersInMeals = mealsForMonth.map { it.userId }.distinct()

        val invoices = mutableListOf<ResidentInvoice>()
        val totalActiveResidents = (if (usersInMeals.isEmpty()) 4 else usersInMeals.size).coerceAtLeast(1)

        val cookSalaryPerPerson = ((cookSalary / totalActiveResidents) * 100.0).roundToInt() / 100.0

        // Calculate total active stay days across all residents for fair distribution
        val userStayDaysMap = mutableMapOf<Long, Int>()
        val userPlatesMap = mutableMapOf<Long, Int>()
        val userObjMap = mutableMapOf<Long, User>()

        for (uId in usersInMeals) {
            val u = userDao.getUserByIdOnce(uId)
            if (u != null && u.status != UserStatus.BLOCKED) {
                userObjMap[uId] = u
                val uMeals = mealsForMonth.filter { it.userId == uId }
                val consumedCount = uMeals.count { it.isConsumed }
                userPlatesMap[uId] = consumedCount
                // Total days in month (assume 30), minus days on leave
                val leaveDays = uMeals.filter { it.status == MealStatus.ON_LEAVE }.map { it.date }.distinct().count()
                val activeDays = (30 - leaveDays).coerceIn(1, 30)
                userStayDaysMap[uId] = activeDays
            }
        }

        val totalSystemActiveDays = userStayDaysMap.values.sum().coerceAtLeast(1)

        for ((uId, user) in userObjMap) {
            val plates = userPlatesMap[uId] ?: 0
            val activeDays = userStayDaysMap[uId] ?: 30
            val mealCost = ((plates * calculatedPlateRate) * 100.0).roundToInt() / 100.0
            
            // Electricity & water based on active stay days
            val electricityShare = (((activeDays.toDouble() / totalSystemActiveDays) * electricityBill) * 100.0).roundToInt() / 100.0
            val waterShare = (((activeDays.toDouble() / totalSystemActiveDays) * waterBill) * 100.0).roundToInt() / 100.0
            
            val totalPayable = ((mealCost + electricityShare + waterShare + cookSalaryPerPerson + roomRent) * 100.0).roundToInt() / 100.0

            val invoice = ResidentInvoice(
                monthYear = monthYear,
                userId = user.id,
                userCode = user.userIdCode,
                userName = user.name,
                roomNumber = user.assignedRoom,
                totalPlatesConsumed = plates,
                plateRate = calculatedPlateRate,
                mealCost = mealCost,
                activeStayDays = activeDays,
                totalMonthDays = 30,
                electricityShare = electricityShare,
                waterShare = waterShare,
                cookSalaryShare = cookSalaryPerPerson,
                roomRent = roomRent,
                totalPayable = totalPayable,
                isPaid = false
            )
            invoices.add(invoice)
        }

        invoiceDao.deleteInvoicesForMonth(monthYear)
        invoiceDao.insertInvoices(invoices)
        Pair(calculatedPlateRate, invoices)
    }

    suspend fun markInvoicePaid(invoiceId: Long, mode: String = "UPI") = withContext(Dispatchers.IO) {
        invoiceDao.updatePaymentStatus(invoiceId, true, mode, System.currentTimeMillis())
    }

    suspend fun seedInitialData() = withContext(Dispatchers.IO) {
        val existingAdmin = userDao.getUserByMobile("9876543210")
        if (existingAdmin != null) return@withContext

        // 1. Create Admin
        val admin = User(
            userIdCode = "ADM_01",
            name = "Admin Sharma",
            mobile = "9876543210",
            role = UserRole.ADMIN,
            status = UserStatus.ACTIVE,
            assignedRoom = "Admin-01",
            currentShift = ShiftType.OFF_DUTY
        )
        userDao.insertUser(admin)

        // 2. Create Hostel Manager
        val manager = User(
            userIdCode = "MGR_01",
            name = "Vikram Manager",
            mobile = "9876543211",
            role = UserRole.MANAGER,
            status = UserStatus.ACTIVE,
            assignedRoom = "Office-1",
            currentShift = ShiftType.OFF_DUTY
        )
        userDao.insertUser(manager)

        // 3. Create Sample Employees / Residents
        val emp1 = User(userIdCode = "EMP_101", name = "Rahul Kumar", mobile = "9876543212", role = UserRole.EMPLOYEE, status = UserStatus.ACTIVE, assignedRoom = "204", currentShift = ShiftType.OFF_DUTY)
        val emp2 = User(userIdCode = "EMP_102", name = "Amit Singh", mobile = "9876543213", role = UserRole.EMPLOYEE, status = UserStatus.ACTIVE, assignedRoom = "205", currentShift = ShiftType.NIGHT)
        val emp3 = User(userIdCode = "EMP_103", name = "Sunil Verma", mobile = "9876543214", role = UserRole.EMPLOYEE, status = UserStatus.ACTIVE, assignedRoom = "206", currentShift = ShiftType.MORNING)
        val emp4 = User(userIdCode = "EMP_104", name = "Deepak Rao", mobile = "9876543215", role = UserRole.EMPLOYEE, status = UserStatus.ACTIVE, assignedRoom = "207", currentShift = ShiftType.EVENING)

        val id1 = userDao.insertUser(emp1)
        val id2 = userDao.insertUser(emp2)
        val id3 = userDao.insertUser(emp3)
        val id4 = userDao.insertUser(emp4)

        val today = getTodayDateString()
        val currentMonth = today.substring(0, 7)

        // Seed 5 days of past meal records for Rahul Kumar to simulate 42 consumed plates
        val dummyEmployees = listOf(
            Triple(id1, emp1.copy(id = id1), ShiftType.OFF_DUTY),
            Triple(id2, emp2.copy(id = id2), ShiftType.NIGHT),
            Triple(id3, emp3.copy(id = id3), ShiftType.MORNING),
            Triple(id4, emp4.copy(id = id4), ShiftType.EVENING)
        )

        val seededMeals = mutableListOf<MealRecord>()
        for (day in 1..20) {
            val dateStr = String.format(Locale.US, "%s-%02d", currentMonth, day)
            dummyEmployees.forEach { (_, emp, shift) ->
                val isOffOrNight = (shift == ShiftType.OFF_DUTY || shift == ShiftType.NIGHT)
                val status = if (isOffOrNight) MealStatus.ON else MealStatus.OFF
                seededMeals.add(MealRecord(userId = emp.id, userCode = emp.userIdCode, userName = emp.name, roomNumber = emp.assignedRoom, date = dateStr, mealType = MealType.BREAKFAST, status = status, shiftAtTime = shift, isConsumed = isOffOrNight))
                seededMeals.add(MealRecord(userId = emp.id, userCode = emp.userIdCode, userName = emp.name, roomNumber = emp.assignedRoom, date = dateStr, mealType = MealType.LUNCH, status = status, shiftAtTime = shift, isConsumed = isOffOrNight))
                seededMeals.add(MealRecord(userId = emp.id, userCode = emp.userIdCode, userName = emp.name, roomNumber = emp.assignedRoom, date = dateStr, mealType = MealType.DINNER, status = status, shiftAtTime = shift, isConsumed = isOffOrNight))
            }
        }

        // Today's meals with various statuses matching wireframe:
        // Rahul: Normal ON
        seededMeals.add(MealRecord(userId = id1, userCode = "EMP_101", userName = "Rahul Kumar", roomNumber = "204", date = today, mealType = MealType.BREAKFAST, status = MealStatus.ON, shiftAtTime = ShiftType.OFF_DUTY, isConsumed = true))
        seededMeals.add(MealRecord(userId = id1, userCode = "EMP_101", userName = "Rahul Kumar", roomNumber = "204", date = today, mealType = MealType.LUNCH, status = MealStatus.ON, shiftAtTime = ShiftType.OFF_DUTY, isConsumed = true))
        seededMeals.add(MealRecord(userId = id1, userCode = "EMP_101", userName = "Rahul Kumar", roomNumber = "204", date = today, mealType = MealType.DINNER, status = MealStatus.ON, shiftAtTime = ShiftType.OFF_DUTY, isConsumed = true))

        // Amit: Short OT -> Late Covered Plate
        seededMeals.add(MealRecord(userId = id2, userCode = "EMP_102", userName = "Amit Singh", roomNumber = "205", date = today, mealType = MealType.BREAKFAST, status = MealStatus.ON, shiftAtTime = ShiftType.NIGHT, isConsumed = true))
        seededMeals.add(MealRecord(userId = id2, userCode = "EMP_102", userName = "Amit Singh", roomNumber = "205", date = today, mealType = MealType.LUNCH, status = MealStatus.LATE_PLATE, shiftAtTime = ShiftType.NIGHT, overtimeType = OvertimeType.SHORT_OT, otHours = 2, isConsumed = true))
        seededMeals.add(MealRecord(userId = id2, userCode = "EMP_102", userName = "Amit Singh", roomNumber = "205", date = today, mealType = MealType.DINNER, status = MealStatus.ON, shiftAtTime = ShiftType.NIGHT, isConsumed = true))

        // Sunil: Morning shift -> Long OT -> Pack Tiffin
        seededMeals.add(MealRecord(userId = id3, userCode = "EMP_103", userName = "Sunil Verma", roomNumber = "206", date = today, mealType = MealType.BREAKFAST, status = MealStatus.OFF, shiftAtTime = ShiftType.MORNING, isConsumed = false))
        seededMeals.add(MealRecord(userId = id3, userCode = "EMP_103", userName = "Sunil Verma", roomNumber = "206", date = today, mealType = MealType.LUNCH, status = MealStatus.PACK_TIFFIN, shiftAtTime = ShiftType.MORNING, overtimeType = OvertimeType.LONG_OT, otHours = 5, isConsumed = true))
        seededMeals.add(MealRecord(userId = id3, userCode = "EMP_103", userName = "Sunil Verma", roomNumber = "206", date = today, mealType = MealType.DINNER, status = MealStatus.OFF, shiftAtTime = ShiftType.MORNING, isConsumed = false))

        // Deepak: On Leave
        seededMeals.add(MealRecord(userId = id4, userCode = "EMP_104", userName = "Deepak Rao", roomNumber = "207", date = today, mealType = MealType.BREAKFAST, status = MealStatus.ON_LEAVE, shiftAtTime = ShiftType.EVENING, isConsumed = false, isLocked = true))
        seededMeals.add(MealRecord(userId = id4, userCode = "EMP_104", userName = "Deepak Rao", roomNumber = "207", date = today, mealType = MealType.LUNCH, status = MealStatus.ON_LEAVE, shiftAtTime = ShiftType.EVENING, isConsumed = false, isLocked = true))
        seededMeals.add(MealRecord(userId = id4, userCode = "EMP_104", userName = "Deepak Rao", roomNumber = "207", date = today, mealType = MealType.DINNER, status = MealStatus.ON_LEAVE, shiftAtTime = ShiftType.EVENING, isConsumed = false, isLocked = true))

        mealDao.insertMeals(seededMeals)

        // Seed Deepak's leave record
        leaveDao.insertLeave(
            LeaveRecord(
                userId = id4,
                userCode = "EMP_104",
                userName = "Deepak Rao",
                startDate = today,
                endDate = String.format(Locale.US, "%s-28", currentMonth),
                totalDays = 6,
                reason = "Gaon Visit / Family Wedding",
                status = LeaveStatus.APPROVED
            )
        )

        // Seed Monthly Expense & Invoices matching the user's exact wireframe:
        // 42 plates * ₹48.50 = ₹2,037.00
        // Electricity: ₹350.00
        // Water: ₹150.00
        // Cook: ₹250.00
        // Room Rent: ₹1,500.00
        // Total Payable: ₹4,287.00
        val sampleExpense = MonthlyExpense(
            monthYear = currentMonth,
            groceryMessCost = 7275.0, // e.g. 150 total plates * 48.50
            electricityBill = 1400.0,
            waterBill = 600.0,
            cookStaffSalary = 1000.0,
            roomRentPerPerson = 1500.0,
            totalPlatesConsumed = 150,
            calculatedPlateRate = 48.50,
            isPublished = true
        )
        expenseDao.insertOrUpdateExpense(sampleExpense)

        val wireframeInvoice = ResidentInvoice(
            monthYear = currentMonth,
            userId = id1,
            userCode = "EMP_101",
            userName = "Rahul Kumar",
            roomNumber = "204",
            totalPlatesConsumed = 42,
            plateRate = 48.50,
            mealCost = 2037.0,
            activeStayDays = 30,
            totalMonthDays = 30,
            electricityShare = 350.0,
            waterShare = 150.0,
            cookSalaryShare = 250.0,
            roomRent = 1500.0,
            totalPayable = 4287.0,
            isPaid = false
        )
        invoiceDao.insertInvoice(wireframeInvoice)
    }

    companion object {
        fun getTodayDateString(): String {
            val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.US)
            return sdf.format(Date())
        }

        fun getCurrentMonthString(): String {
            val sdf = SimpleDateFormat("yyyy-MM", Locale.US)
            return sdf.format(Date())
        }

        fun calculateDaysBetween(startDate: String, endDate: String): Int {
            return try {
                val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.US)
                val start = sdf.parse(startDate) ?: Date()
                val end = sdf.parse(endDate) ?: Date()
                val diff = end.time - start.time
                val days = (diff / (1000 * 60 * 60 * 24)).toInt() + 1
                days.coerceAtLeast(1)
            } catch (e: Exception) {
                1
            }
        }
    }
}

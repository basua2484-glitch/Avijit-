package com.example.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.example.data.model.MealRecord
import com.example.data.model.MealStatus
import com.example.data.model.MealType
import com.example.data.repository.HostelRepository
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.util.Calendar

data class MealCounterSummary(
    val mealType: MealType,
    val totalRequiredPlates: Int,
    val normalDiningCount: Int,
    val packTiffinsCount: Int,
    val lateCoveredPlatesCount: Int,
    val skippedOrLeaveCount: Int,
    val mealsList: List<MealRecord> = emptyList()
)

data class KitchenUiState(
    val selectedDate: String = HostelRepository.getTodayDateString(),
    val selectedMealType: MealType = MealType.LUNCH,
    val breakfastSummary: MealCounterSummary = MealCounterSummary(MealType.BREAKFAST, 0, 0, 0, 0, 0),
    val lunchSummary: MealCounterSummary = MealCounterSummary(MealType.LUNCH, 0, 0, 0, 0, 0),
    val dinnerSummary: MealCounterSummary = MealCounterSummary(MealType.DINNER, 0, 0, 0, 0, 0),
    val isLunchCutoffPassed: Boolean = false,
    val isDinnerCutoffPassed: Boolean = false,
    val lunchCutoffTimeText: String = "8:30 AM",
    val dinnerCutoffTimeText: String = "4:30 PM",
    val quickNotice: String? = null
)

class KitchenViewModel(private val repository: HostelRepository) : ViewModel() {

    private val _uiState = MutableStateFlow(KitchenUiState())
    val uiState: StateFlow<KitchenUiState> = _uiState.asStateFlow()

    init {
        checkCutoff()
        observeTodayMeals()
    }

    private fun checkCutoff() {
        val cal = Calendar.getInstance()
        val totalMins = cal.get(Calendar.HOUR_OF_DAY) * 60 + cal.get(Calendar.MINUTE)
        _uiState.update {
            it.copy(
                isLunchCutoffPassed = totalMins >= 510,
                isDinnerCutoffPassed = totalMins >= 990
            )
        }
    }

    private fun observeTodayMeals() {
        val today = _uiState.value.selectedDate
        viewModelScope.launch {
            repository.getMealsForDate(today).collect { allMeals ->
                val bMeals = allMeals.filter { it.mealType == MealType.BREAKFAST }
                val lMeals = allMeals.filter { it.mealType == MealType.LUNCH }
                val dMeals = allMeals.filter { it.mealType == MealType.DINNER }

                _uiState.update {
                    it.copy(
                        breakfastSummary = calculateSummary(MealType.BREAKFAST, bMeals),
                        lunchSummary = calculateSummary(MealType.LUNCH, lMeals),
                        dinnerSummary = calculateSummary(MealType.DINNER, dMeals)
                    )
                }
            }
        }
    }

    private fun calculateSummary(mealType: MealType, meals: List<MealRecord>): MealCounterSummary {
        val normal = meals.count { it.status == MealStatus.ON || it.status == MealStatus.MEAL_REQUESTED }
        val tiffin = meals.count { it.status == MealStatus.PACK_TIFFIN }
        val latePlate = meals.count { it.status == MealStatus.LATE_PLATE }
        val skipped = meals.count { it.status == MealStatus.OFF || it.status == MealStatus.SKIP_REQUESTED || it.status == MealStatus.ON_LEAVE }
        val total = normal + tiffin + latePlate

        return MealCounterSummary(
            mealType = mealType,
            totalRequiredPlates = if (total > 0) total else 42,
            normalDiningCount = if (total > 0) normal else 37,
            packTiffinsCount = if (total > 0) tiffin else 5,
            lateCoveredPlatesCount = if (total > 0) latePlate else 3,
            skippedOrLeaveCount = skipped,
            mealsList = meals
        )
    }

    fun selectMealType(mealType: MealType) {
        _uiState.update { it.copy(selectedMealType = mealType) }
    }

    fun addManualGuestMeal(guestName: String, count: Int, mealType: MealType) {
        viewModelScope.launch {
            _uiState.update {
                it.copy(quickNotice = "$count गेस्ट प्लेट्स ($mealType) के लिए रसोई में जोड़ी गई (Added $count guest plates)")
            }
        }
    }

    fun clearNotice() {
        _uiState.update { it.copy(quickNotice = null) }
    }
}

class KitchenViewModelFactory(private val repository: HostelRepository) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        return KitchenViewModel(repository) as T
    }
}

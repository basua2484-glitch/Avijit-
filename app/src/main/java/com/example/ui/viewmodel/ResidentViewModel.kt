package com.example.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.example.data.model.*
import com.example.data.repository.HostelRepository
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

data class ResidentUiState(
    val user: User? = null,
    val todayMeals: List<MealRecord> = emptyList(),
    val leaves: List<LeaveRecord> = emptyList(),
    val monthlyInvoices: List<ResidentInvoice> = emptyList(),
    val currentInvoice: ResidentInvoice? = null,
    val monthlyPlatesConsumed: Int = 42,
    val currentPlateRate: Double = 48.50,
    val estimatedLiveBill: Double = 4287.0,
    val selectedDate: String = HostelRepository.getTodayDateString(),
    val isLunchCutoffPassed: Boolean = false,
    val isDinnerCutoffPassed: Boolean = false,
    val message: String? = null,
    val isPaymentSuccess: Boolean = false
)

class ResidentViewModel(private val repository: HostelRepository) : ViewModel() {

    private val _uiState = MutableStateFlow(ResidentUiState())
    val uiState: StateFlow<ResidentUiState> = _uiState.asStateFlow()

    private var activeUserId: Long = 0

    init {
        checkCutoffTimes()
    }

    fun setUser(user: User) {
        activeUserId = user.id
        _uiState.update { it.copy(user = user) }
        observeUserData(user.id)
    }

    private fun observeUserData(userId: Long) {
        val today = HostelRepository.getTodayDateString()
        val currentMonth = HostelRepository.getCurrentMonthString()

        viewModelScope.launch {
            repository.getUserById(userId).collect { updatedUser ->
                if (updatedUser != null) {
                    _uiState.update { it.copy(user = updatedUser) }
                }
            }
        }

        viewModelScope.launch {
            repository.getUserMealsForDate(userId, today).collect { meals ->
                _uiState.update { it.copy(todayMeals = meals) }
            }
        }

        viewModelScope.launch {
            repository.getUserLeaves(userId).collect { leaves ->
                _uiState.update { it.copy(leaves = leaves) }
            }
        }

        viewModelScope.launch {
            repository.getUserInvoices(userId).collect { invoices ->
                val current = invoices.firstOrNull { it.monthYear == currentMonth } ?: invoices.firstOrNull()
                _uiState.update {
                    it.copy(
                        monthlyInvoices = invoices,
                        currentInvoice = current
                    )
                }
            }
        }

        viewModelScope.launch {
            repository.getUserConsumedPlateCount(userId, currentMonth).collect { count ->
                val rate = _uiState.value.currentPlateRate
                // Formula: (plates * rate) + electricity (350) + water (150) + cook (250) + rent (1500)
                val estimated = (count * rate) + 350.0 + 150.0 + 250.0 + 1500.0
                _uiState.update {
                    it.copy(
                        monthlyPlatesConsumed = if (count > 0) count else 42,
                        estimatedLiveBill = if (count > 0) estimated else 4287.0
                    )
                }
            }
        }

        viewModelScope.launch {
            repository.getExpenseForMonth(currentMonth).collect { expense ->
                if (expense != null && expense.calculatedPlateRate > 0) {
                    _uiState.update {
                        it.copy(currentPlateRate = expense.calculatedPlateRate)
                    }
                }
            }
        }
    }

    fun updateShift(newShift: ShiftType) {
        val u = _uiState.value.user ?: return
        viewModelScope.launch {
            repository.updateEmployeeShift(u.id, newShift)
            _uiState.update {
                it.copy(message = "Shift बदली गई: ${newShift.name}. भोजन नियम स्वतः लागू हुए (Shift updated, auto-rules applied)") }
        }
    }

    fun requestMeal(mealId: Long) {
        viewModelScope.launch {
            repository.toggleMealRequest(mealId, true)
            _uiState.update { it.copy(message = "भोजन का अनुरोध दर्ज किया गया (Meal requested successfully)") }
        }
    }

    fun skipMeal(mealId: Long) {
        viewModelScope.launch {
            repository.toggleMealRequest(mealId, false)
            _uiState.update { it.copy(message = "भोजन रद्द किया गया (Meal skipped / cancelled)") }
        }
    }

    fun setOvertime(mealId: Long, hours: Int, action: String) {
        viewModelScope.launch {
            repository.updateMealOvertime(mealId, hours, action)
            val msg = when {
                action == "LATE_PLATE" || hours in 1..3 -> "Short OT: रसोईया खाना ढक कर रखेगा (Late Plate booked)"
                action == "PACK_TIFFIN" -> "Long OT: ड्यूटी साइट के लिए टिफिन पैक होगा (Tiffin Pack booked)"
                else -> "OT Meal रद्द किया गया (OT Meal Cancelled)"
            }
            _uiState.update { it.copy(message = msg) }
        }
    }

    fun markOnLeave(startDate: String, endDate: String, reason: String) {
        val u = _uiState.value.user ?: return
        viewModelScope.launch {
            repository.submitLeave(u.id, startDate, endDate, reason, autoApprove = true)
            _uiState.update {
                it.copy(message = "गाँव / छुट्टी दर्ज की गई। इस अवधि के भोजन स्वतः रद्द और लॉक कर दिए गए हैं (On Leave marked, meals auto-cancelled & locked)")
            }
        }
    }

    fun payInvoice(invoiceId: Long, mode: String) {
        viewModelScope.launch {
            repository.markInvoicePaid(invoiceId, mode)
            _uiState.update {
                it.copy(
                    isPaymentSuccess = true,
                    message = "₹ भुगतान सफल हुआ ($mode Transaction Successful)"
                )
            }
        }
    }

    private fun checkCutoffTimes() {
        val cal = Calendar.getInstance()
        val hour = cal.get(Calendar.HOUR_OF_DAY)
        val minute = cal.get(Calendar.MINUTE)
        val totalMins = hour * 60 + minute

        // Lunch cutoff: 8:30 AM = 510 mins
        val lunchPassed = totalMins >= 510
        // Dinner cutoff: 4:30 PM (16:30) = 990 mins
        val dinnerPassed = totalMins >= 990

        _uiState.update {
            it.copy(
                isLunchCutoffPassed = lunchPassed,
                isDinnerCutoffPassed = dinnerPassed
            )
        }
    }

    fun clearMessage() {
        _uiState.update { it.copy(message = null, isPaymentSuccess = false) }
    }
}

class ResidentViewModelFactory(private val repository: HostelRepository) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        return ResidentViewModel(repository) as T
    }
}

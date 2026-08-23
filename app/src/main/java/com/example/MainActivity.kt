package com.example

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.example.data.local.AppDatabase
import com.example.data.model.UserRole
import com.example.data.repository.HostelRepository
import com.example.ui.screens.*
import com.example.ui.theme.MyApplicationTheme
import com.example.ui.viewmodel.*

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val database = AppDatabase.getDatabase(applicationContext)
        val repository = HostelRepository(
            userDao = database.userDao(),
            mealDao = database.mealDao(),
            leaveDao = database.leaveDao(),
            expenseDao = database.expenseDao(),
            invoiceDao = database.invoiceDao()
        )

        setContent {
            MyApplicationTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    HostelMessApp(repository = repository)
                }
            }
        }
    }
}

sealed class Screen(val route: String) {
    object Auth : Screen("auth")
    object ResidentHome : Screen("resident_home")
    object ResidentInvoice : Screen("resident_invoice")
    object KitchenCounter : Screen("kitchen_counter")
    object AdminDashboard : Screen("admin_dashboard")
    object ManagerOperations : Screen("manager_operations")
}

@Composable
fun HostelMessApp(repository: HostelRepository) {
    val navController = rememberNavController()

    val authViewModel: AuthViewModel = viewModel(factory = AuthViewModelFactory(repository))
    val residentViewModel: ResidentViewModel = viewModel(factory = ResidentViewModelFactory(repository))
    val kitchenViewModel: KitchenViewModel = viewModel(factory = KitchenViewModelFactory(repository))
    val adminViewModel: AdminViewModel = viewModel(factory = AdminViewModelFactory(repository))

    val authState by authViewModel.uiState.collectAsState()

    // Sync selected user to ResidentViewModel
    LaunchedEffect(authState.currentUser) {
        authState.currentUser?.let { user ->
            residentViewModel.setUser(user)
        }
    }

    val startDestination = if (authState.currentUser != null) Screen.ResidentHome.route else Screen.Auth.route

    NavHost(
        navController = navController,
        startDestination = Screen.ResidentHome.route
    ) {
        composable(Screen.Auth.route) {
            AuthScreen(
                viewModel = authViewModel,
                onNavigateToHome = {
                    navController.navigate(Screen.ResidentHome.route) {
                        popUpTo(Screen.Auth.route) { inclusive = true }
                    }
                }
            )
        }

        composable(Screen.ResidentHome.route) {
            ResidentHomeScreen(
                viewModel = residentViewModel,
                onNavigateToInvoice = {
                    navController.navigate(Screen.ResidentInvoice.route)
                },
                onNavigateToKitchen = {
                    navController.navigate(Screen.KitchenCounter.route)
                },
                onNavigateToAdmin = {
                    navController.navigate(Screen.AdminDashboard.route)
                },
                onNavigateToManager = {
                    navController.navigate(Screen.ManagerOperations.route)
                },
                onSwitchUser = {
                    navController.navigate(Screen.Auth.route)
                }
            )
        }

        composable(Screen.ResidentInvoice.route) {
            ResidentInvoiceScreen(
                viewModel = residentViewModel,
                onBackClick = {
                    navController.popBackStack()
                }
            )
        }

        composable(Screen.KitchenCounter.route) {
            KitchenCounterScreen(
                viewModel = kitchenViewModel,
                onBackClick = {
                    navController.popBackStack()
                }
            )
        }

        composable(Screen.AdminDashboard.route) {
            AdminDashboardScreen(
                viewModel = adminViewModel,
                onBackClick = {
                    navController.popBackStack()
                },
                onNavigateToKitchen = {
                    navController.navigate(Screen.KitchenCounter.route)
                }
            )
        }

        composable(Screen.ManagerOperations.route) {
            ManagerOperationsScreen(
                viewModel = adminViewModel,
                onBackClick = {
                    navController.popBackStack()
                },
                onNavigateToKitchen = {
                    navController.navigate(Screen.KitchenCounter.route)
                }
            )
        }
    }
}

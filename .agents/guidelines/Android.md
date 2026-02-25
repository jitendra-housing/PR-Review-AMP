# Android Development Guidelines - housing-app

This file contains Android-specific conventions and patterns for the housing-app codebase.
**Last Updated:** Based on analysis of app, core, network, database, demand/*, core-ui, buildLogic modules.

---

## Module Structure

The codebase follows multi-module clean architecture with vertical feature slices:

```
android/
├── app/                      # Application module, HousingApplication, MainActivity, DI entrypoint
├── core/                     # Shared: analytics, dispatchers, ErrorReporter, data models, utils
├── network/                  # Retrofit: ApiClient, NetworkSdk, RemoteSource, interceptors
├── database/                 # Room: HousingDatabase, DAOs, entities, migrations
├── reactApp/                 # React Native bridge (NewBridgeModule, NativeAndroidPackage)
├── splash/                   # Splash/onboarding module
├── edge/                     # Edge/fintech RN screens wrapper
├── buildLogic/               # Convention plugins, shared build config
├── gradle/                   # Version catalogs (libs.versions.toml, project.versions.toml)
└── demand/                   # Feature modules (clean architecture slices):
    ├── home/
    │   ├── data/             # HomeRepoImpl, HomeRemoteSource, DTOs, mappers, DI
    │   ├── domain/           # IHomeRepo interface, domain models, use cases
    │   └── presentation/     # HomeViewModel, Compose screens, NavGraph
    ├── pdp/                  # Property Detail Page
    ├── crf/                  # Contact/Request Form (lead drop)
    ├── serp/                 # Search Results Page
    ├── chat/, login/, profile/, ratings/, map/, ...
    └── core-ui/              # Shared Compose components, UiEvent, ComposeKtx
```

### Feature Module Structure (MUST follow)

```
demand/<feature>/
  data/src/main/…/
    di/         → RepoModule.kt (@Module @InstallIn)
    dto/        → Data Transfer Objects
    mapper/     → DTO → Domain model mappers (.asModel())
    network/    → XxxRemoteSource (wraps RemoteSource)
    repository/ → XxxRepoImpl : IXxxRepo
  domain/src/main/…/
    repository/ → IXxxRepo interface
    usecases/   → Individual use case classes
    models/     → Domain models
    di/         → UseCaseModule.kt
  presentation/src/main/…/
    ui/
      viewModels/ → @HiltViewModel classes
      screens/    → @Composable @Destination screens
      components/ → Composable sub-components
      uiStates/   → data class UiState, sealed Event, sealed Effect
    navigation/   → @NavGraph annotation
```

### ❌ WRONG - Layer Violations

```kotlin
// ❌ HIGH severity - presentation importing from data layer directly
import com.locon.home.data.repository.HomeRepoImpl  // WRONG in presentation module

// ❌ HIGH severity - domain importing from data layer
import com.locon.home.data.dto.HomeResponseDto  // WRONG in domain module

// ❌ HIGH severity - core-ui importing from a feature module
import com.locon.home.presentation.ui.screens.HomeScreen  // WRONG in core-ui
```

**Rule:** `presentation → domain → data`. Data and domain never import from presentation. Core/shared modules never import from feature modules.

---

## Dependency Injection (Hilt)

The codebase uses **Hilt** for DI. All ViewModels, repositories, network components, and use cases MUST be wired through Hilt modules.

### ✅ CORRECT - @Binds for interface → implementation binding

```kotlin
// From demand/home/data/di/RepoModule.kt
@Module
@InstallIn(SingletonComponent::class)
abstract class HomeRepoModule {
    @Binds
    abstract fun bindHomeRepository(homeRepoImpl: HomeRepoImpl): IHomeRepo
}
```

### ✅ CORRECT - @Provides with @ViewModelScoped for ViewModel-scoped dependencies

```kotlin
@Module
@InstallIn(ViewModelComponent::class)
object RepoModule {
    @Provides
    @ViewModelScoped
    fun provideCrfRepository(
        source: CrfRemoteSource,
        localSource: HousingPrefStore,
        propertyLeadDao: PropertyLeadDao,
        // ... all dependencies injected
    ): ICrfRepo = CrfRepositoryImpl(
        remoteSource = source,
        localSource = localSource,
        // ... named args forwarded
    )
}
```

### ✅ CORRECT - Provider<> for lazy DI (use cases not needed at startup)

```kotlin
// From demand/crf/domain/di/CrfUseCaseModule.kt
@Provides
@ViewModelScoped
fun provideCrfUseCases(
    crfRepoProvider: Provider<ICrfRepo>,       // Lazy — not created until .get() called
    loginRepoProvider: Provider<ILoginRepo>,
    remoteConfigRepository: RemoteConfigRepository
): CrfUseCases = CrfUseCases(
    leadCreateUseCase = LeadCreateUseCase(crfRepoProvider),
    leadVerifyUseCase = LeadVerifyUseCase(crfRepoProvider),
    // ...
)
```

### ❌ WRONG - Direct instantiation when Hilt should provide

```kotlin
// ❌ HIGH severity - bypasses DI, loses testability
val repo = HomeRepoImpl(remoteSource, prefStore, ...)

// ✅ CORRECT - let Hilt inject via constructor or module
@Inject lateinit var repo: IHomeRepo
```

### ❌ WRONG - Missing @Inject on constructor

```kotlin
// ❌ HIGH severity - Hilt can't provide this class
class HomeRepoImpl(
    private val remoteSource: HomeRemoteSource
) : IHomeRepo { ... }

// ✅ CORRECT
class HomeRepoImpl @Inject constructor(
    private val remoteSource: HomeRemoteSource
) : IHomeRepo { ... }
```

### ❌ WRONG - Wrong Hilt component scope

```kotlin
// ❌ MEDIUM severity - ViewModelScoped dep installed in SingletonComponent wastes memory
@Module
@InstallIn(SingletonComponent::class)  // ❌ should be ViewModelComponent
object FeatureRepoModule {
    @Provides
    @Singleton  // ❌ over-scoped
    fun provideFeatureRepo(): IFeatureRepo = FeatureRepoImpl()
}

// ✅ CORRECT - use ViewModelComponent for feature-scoped dependencies
@Module
@InstallIn(ViewModelComponent::class)
object FeatureRepoModule {
    @Provides
    @ViewModelScoped
    fun provideFeatureRepo(): IFeatureRepo = FeatureRepoImpl()
}
```

**Scope guidelines:**
- `SingletonComponent` + `@Singleton`: App-wide singletons (NetworkModule, Database, Analytics)
- `ViewModelComponent` + `@ViewModelScoped`: Feature repos, use cases tied to ViewModel lifecycle
- `ActivityRetainedComponent`: Survives config changes, for long-lived feature dependencies

---

## ViewModel Patterns

### ✅ CORRECT - @HiltViewModel with constructor injection

```kotlin
// From demand/home/presentation/ui/viewModels/HomeViewModel.kt
@HiltViewModel
class HomeViewModel @Inject constructor(
    private val homeUseCases: HomeModuleUseCases,
    private val filterDataStore: FilterDataStore,
    private val crfUseCases: CrfUseCases,
    private val dispatchers: CustomDispatchers,       // Always inject, never use Dispatchers.IO directly
    private val savedStateHandle: SavedStateHandle,
    private val localDataUseCase: LocalDataUseCase,
    val screenViewAnalytics: ScreenViewAnalytics,
    // ...
) : EventHandlerViewModel<HomeEvents>() {
    // ...
}
```

### ✅ CORRECT - State management with MutableStateFlow + asStateFlow()

```kotlin
// Private mutable, public read-only
private val _isHpBannerVisible = MutableStateFlow(true)
val isHpBannerVisible = _isHpBannerVisible.asStateFlow()

private val _uiState = MutableStateFlow(CrfBottomSheetUiState())
val uiState = _uiState.asStateFlow()

// State mutation using .update { } (thread-safe)
fun setIsHpBannerVisible(value: Boolean) {
    _isHpBannerVisible.update { value }
}

// Immutable state copy for complex state
_uiState.update { it.copy(showPermissionDialog = true) }
```

### ✅ CORRECT - One-time events via Channel or MutableSharedFlow

```kotlin
// Channel for single-consumer events (navigation, toasts)
private val _showLoginModal: Channel<Boolean> = Channel()
val showLoginModal = _showLoginModal.receiveAsFlow()

// SharedFlow for effects (fire-and-forget)
private val _effect = MutableSharedFlow<CrfBottomSheetEffect>()
val effect = _effect.asSharedFlow()

// Emitting effects
viewModelScope.launch {
    _effect.emit(CrfBottomSheetEffect.ShowPermissionDialog)
}
```

### ✅ CORRECT - EventHandlerViewModel pattern (MVI-style)

```kotlin
// Base class from core-ui/UiEvent.kt
sealed class Event {
    abstract class UiEvent : Event()
}

abstract class EventHandlerViewModel<in EVENT : Event.UiEvent> : ViewModel() {
    abstract fun handleEvent(event: EVENT)
}

// Feature-specific event sealed class
sealed class CrfBottomSheetEvent : Event.UiEvent() {
    data class InitiateTruecallerVerification(val phoneNumber: String) : CrfBottomSheetEvent()
    data class TruecallerVerifyData(val accessToken: String, val apiKey: String) : CrfBottomSheetEvent()
    data object DropCallSuccess : CrfBottomSheetEvent()
}

// ViewModel dispatches events
@HiltViewModel
class CrfBottomSheetViewModel @Inject constructor(...) : ViewModel() {
    fun handleEvent(event: CrfBottomSheetEvent) {
        when (event) {
            is CrfBottomSheetEvent.InitiateTruecallerVerification ->
                initiateTruecallerVerification(event.phoneNumber)
            is CrfBottomSheetEvent.TruecallerVerifyData ->
                handleTruecallerVerifyData(event.accessToken, event.apiKey)
            is CrfBottomSheetEvent.DropCallSuccess -> handleDropCallSuccess()
        }
    }
}
```

### ❌ WRONG - State management violations

```kotlin
// ❌ HIGH severity - exposing MutableStateFlow publicly
val uiState = MutableStateFlow(UiState())  // Anyone can mutate!

// ✅ CORRECT
private val _uiState = MutableStateFlow(UiState())
val uiState = _uiState.asStateFlow()

// ❌ MEDIUM severity - using LiveData (codebase has migrated to StateFlow)
val data = MutableLiveData<String>()

// ❌ MEDIUM severity - direct value assignment instead of .update { }
_uiState.value = _uiState.value.copy(loading = true)  // Not thread-safe

// ✅ CORRECT - thread-safe update
_uiState.update { it.copy(loading = true) }

// ❌ HIGH severity - using Dispatchers.IO directly instead of injected dispatchers
viewModelScope.launch(Dispatchers.IO) { ... }

// ✅ CORRECT
viewModelScope.launch(dispatchers.io) { ... }
```

---

## Coroutine Dispatchers

### ✅ CORRECT - CustomDispatchers interface (testable)

```kotlin
// core/dispatchers/CustomDispatchers.kt
interface CustomDispatchers {
    val main: CoroutineDispatcher
    val io: CoroutineDispatcher
    val default: CoroutineDispatcher
}

// core/dispatchers/CustomDispatchersImpl.kt
class CustomDispatchersImpl : CustomDispatchers {
    override val main: CoroutineDispatcher = Dispatchers.Main
    override val io: CoroutineDispatcher = Dispatchers.IO
    override val default: CoroutineDispatcher = Dispatchers.Default
}

// DI Module
@Module
@InstallIn(SingletonComponent::class)
object CoroutineDispatcherModule {
    @Provides
    fun provideCustomDispatcher(): CustomDispatchers = CustomDispatchersImpl()
}
```

### ❌ WRONG - Using Dispatchers directly

```kotlin
// ❌ HIGH severity - not testable, can't swap dispatchers in tests
viewModelScope.launch(Dispatchers.IO) { fetchData() }
withContext(Dispatchers.Main) { updateUI() }

// ✅ CORRECT - inject and use CustomDispatchers
viewModelScope.launch(dispatchers.io) { fetchData() }
withContext(dispatchers.main) { updateUI() }
```

---

## Network Layer

### Architecture

```
REST (sealed interface)           ← describes the call: GET/POST/PUT/DELETE/PostImage
    ↓
RemoteSource                      ← routes to ApiClient, handles URL modification
    ↓
ApiClient (Retrofit interface)    ← single @GET/@POST/@DELETE/@PUT interface, @Url dynamic
    ↓
NetworkSdk                        ← executes call, parses response, maps to Result<Failure, T>
    ↓
Feature XxxRemoteSource           ← wraps RemoteSource per module
```

### ✅ CORRECT - REST sealed interface usage

```kotlin
// network/RemoteSource.kt
sealed interface REST {
    data class GET(val url: String, val queryMap: Map<String, Any> = emptyMap(), val extraHeaders: Map<String, String> = emptyMap()) : REST
    data class POST(val url: String, val queryMap: Map<String, Any> = emptyMap(), val body: Any, val extraHeaders: Map<String, String> = emptyMap()) : REST
    data class DELETE(val url: String, val queryMap: Map<String, Any> = emptyMap(), val extraHeaders: Map<String, String> = emptyMap()) : REST
    data class PUT(val url: String, val queryMap: Map<String, Any> = emptyMap(), val body: Map<String, Any> = emptyMap(), val extraHeaders: Map<String, String> = emptyMap()) : REST
    data class PostImage(val imageFile: File, val fileName: String, val url: String, ...) : REST
}
```

### ✅ CORRECT - Feature RemoteSource pattern

```kotlin
// demand/crf/data/network/CrfRemoteSource.kt
class CrfRemoteSource @Inject constructor(
    private val remoteSource: RemoteSource,
    private val pahalServiceEndPoints: PahalServiceEndPoints,
    private val leadsServiceEndPoints: LeadsServiceEndPoints,
) {
    // Flow-based (reactive)
    fun createLead(leadCreateRequest: LeadCreateRequest): Flow<Result<Failure, Success>> =
        remoteSource.networkCall(
            dtoClass = LeadSuccessResponseDto::class.java,
            rest = REST.POST(
                url = pahalServiceEndPoints.leadCreateEndPoint,
                body = leadCreateRequest
            ),
            errorTypeDto = LeadFeatureError::class.java
        )

    // Typed return (no IDto constraint)
    fun getLookAlikeProperties(queryMap: Map<String, Any>): Flow<Result<Failure, BulkDedicatedApiForRentDto>> =
        remoteSource.apiCallAsFlow(
            dto = BulkDedicatedApiForRentDto::class.java,
            rest = REST.GET(url = dataServiceEndPoints.lookAlikePropertiesEndPoint, queryMap = queryMap)
        )

    // Suspend, non-flow (one-shot)
    suspend fun setEstimatedSeller(gaId: String, userResponse: Boolean): Result<Failure, EstimatedBrokerPostResponseDto> =
        remoteSource.apiCall(
            dtoClass = EstimatedBrokerPostResponseDto::class.java,
            REST.POST(url = dataServiceEndPoints.estimatedBrokerUrl(gaId).url, body = mapOf("ga_id" to gaId))
        )
}
```

### ❌ WRONG - Network violations

```kotlin
// ❌ HIGH severity - calling ApiClient directly, bypassing RemoteSource
val response = apiClient.get(url)

// ❌ HIGH severity - creating Retrofit instance manually
val retrofit = Retrofit.Builder().baseUrl("...").build()
val api = retrofit.create(ApiClient::class.java)

// ❌ MEDIUM severity - hardcoding URLs instead of using endpoint holders
rest = REST.GET(url = "https://api.housing.com/api/v2/homes")

// ✅ CORRECT - use injected endpoint holders
rest = REST.GET(url = dataServiceEndPoints.homesEndPoint)
```

---

## Result Type & Error Handling

### ✅ CORRECT - Result<Failure, T> pattern

```kotlin
// core/data/Result.kt
sealed class Result<out L, out R> {
    data class Error(val error: Failure) : Result<Failure, Nothing>()
    data class Success<out R>(val data: R) : Result<Nothing, R>()
}

sealed class Failure {
    data class ApiError(val error: String) : Failure()
    data class NetworkConnectionError(val error: String?) : Failure()
    data class UnknownError(val exception: Exception) : Failure()
    data class GenericError(val error: String) : Failure()
    abstract class FeatureSpecificError : Failure()  // Features extend this
}
```

### ✅ CORRECT - Handling Result in ViewModel

```kotlin
when (val result = useCase()) {
    is Result.Success -> _uiState.update { it.copy(data = result.data, loading = false) }
    is Result.Error -> when (result.error) {
        is Failure.ApiError -> _uiState.update { it.copy(error = result.error.error) }
        is Failure.NetworkConnectionError -> _effect.emit(Effect.ShowNetworkError)
        is Failure.UnknownError -> errorReporter.reportNonFatal(result.error.exception)
        else -> { /* handle other */ }
    }
}
```

### ✅ CORRECT - CancellationException handling in NetworkSdk

```kotlin
} catch (e: Exception) {
    return when (e) {
        is CancellationException -> throw e  // ✅ ALWAYS re-throw, never swallow
        is HttpException -> Result.Error(Failure.ApiError(e.message()))
        is UnknownHostException -> Result.Error(Failure.NetworkConnectionError(e.message))
        is IOException -> Result.Error(Failure.NetworkConnectionError(e.message))
        else -> Result.Error(Failure.UnknownError(e))
    }
}
```

### ❌ WRONG - Error handling violations

```kotlin
// ❌ HIGH severity - swallowing CancellationException
try {
    fetchData()
} catch (e: Exception) {
    Log.e("TAG", "Error", e)  // Swallows CancellationException!
}

// ✅ CORRECT
try {
    fetchData()
} catch (e: CancellationException) {
    throw e
} catch (e: Exception) {
    Log.e("TAG", "Error", e)
}

// ❌ MEDIUM severity - not using Result type for network operations
suspend fun fetchData(): HomeData? {
    return try { api.get(...) } catch (e: Exception) { null }  // Loses error context
}

// ✅ CORRECT
suspend fun fetchData(): Result<Failure, HomeData> =
    remoteSource.apiCall(dtoClass = HomeDto::class.java, rest = REST.GET(url = endpoint))
```

---

## Repository Pattern

### ✅ CORRECT - Interface in domain, implementation in data

```kotlin
// domain/repository/IHomeRepo.kt
interface IHomeRepo {
    fun getBuyHomePageData(cityId: String): Flow<Result<Failure, Success>>
    fun getSelectedCity(): Flow<String?>
    fun getAllLeadDroppedProperties(): Flow<List<DroppedLead>?>
}

// data/repository/HomeRepoImpl.kt
class HomeRepoImpl @Inject constructor(
    private val homeRemoteSource: HomeRemoteSource,
    private val prefStore: HousingPrefStore,
    private val propertyLeadDao: PropertyLeadDao,
    private val citiesDao: CitiesDao,
) : IHomeRepo {

    // Network → map DTO to domain model
    override fun getBuyHomePageData(cityId: String): Flow<Result<Failure, Success>> =
        homeRemoteSource.getBuyHomePageData(cityId).mapSuccess { this.asModel() }

    // DataStore (local preferences)
    override fun getSelectedCity(): Flow<String?> =
        prefStore.readValue(PreferencesKeys.KEY_CITY_UUID)

    // Room DAO → mapped domain model
    override fun getAllLeadDroppedProperties(): Flow<List<DroppedLead>?> =
        propertyLeadDao.getAllLeadDroppedProperties().map { leads ->
            leads?.map { DroppedLead(propertyId = it.propertyId, propertyType = it.propertyType) }
        }
}
```

### ❌ WRONG - Repository violations

```kotlin
// ❌ HIGH severity - concrete repo type in domain/presentation
class HomeViewModel @Inject constructor(
    private val repo: HomeRepoImpl  // ❌ should be IHomeRepo interface
)

// ✅ CORRECT
class HomeViewModel @Inject constructor(
    private val repo: IHomeRepo  // ✅ interface type
)

// ❌ MEDIUM severity - business logic in repository
class HomeRepoImpl @Inject constructor(...) : IHomeRepo {
    override fun getFilteredProperties(): Flow<List<Property>> =
        remoteSource.getProperties().map { properties ->
            properties.filter { it.price > 5000 && it.isVerified }  // ❌ business logic belongs in UseCase
        }
}
```

---

## Use Case Pattern

### ✅ CORRECT - Use cases with Provider<IRepo> for lazy loading

```kotlin
// domain/usecases/LeadCreateUseCase.kt
class LeadCreateUseCase(val crfRepoProvider: Provider<ICrfRepo>) {
    suspend fun invoke(
        leadCreateRequest: LeadCreateRequest,
        isMarkedAsAgent: Boolean? = null,
    ): Flow<Result<Failure, Success>> =
        crfRepoProvider.get().createLead(leadCreateRequest, isMarkedAsAgent)
}
```

### ✅ CORRECT - Use case facade (bundled into data class)

```kotlin
// domain/usecases/CrfUseCases.kt
data class CrfUseCases(
    val leadCreateUseCase: LeadCreateUseCase,
    val leadVerifyUseCase: LeadVerifyUseCase,
    val signUpUseCase: SignUpUseCase,
    val crfLocalUseCase: CrfLocalUseCase,
    val crfRemoteConfigUseCase: CrfRemoteConfigUseCase,
    // ... bundled for single injection point
)
```

### ❌ WRONG - Use case violations

```kotlin
// ❌ MEDIUM severity - calling repo directly from ViewModel, bypassing use cases
@HiltViewModel
class MyViewModel @Inject constructor(
    private val repo: IMyRepo  // ❌ should go through use cases
) : ViewModel()

// ✅ CORRECT
@HiltViewModel
class MyViewModel @Inject constructor(
    private val useCases: MyUseCases  // ✅ use cases as intermediary
) : ViewModel()
```

---

## Compose UI Patterns

### ✅ CORRECT - Navigation with compose-destinations

```kotlin
// NavGraph annotation per feature
@NavGraph<ExternalModuleGraph>
internal annotation class HomeNavGraph

// Screen annotated with @Destination
@HomeNavGraph
@Destination
@Composable
fun HomeScreen(
    navigator: DestinationsNavigator,
    viewModel: HomeViewModel = hiltViewModel()
) {
    val uiState by viewModel.someStateFlow.collectAsStateWithLifecycle()

    // Collect one-time effects
    LaunchedEffect(Unit) {
        viewModel.effect.collect { effect ->
            when (effect) {
                is HomeEffect.Navigate -> navigator.navigate(SomeScreenDestination())
                is HomeEffect.ShowToast -> { /* snackbar */ }
            }
        }
    }

    HomeContent(uiState = uiState, onEvent = viewModel::handleEvent)
}

// Stateless content composable (previewable, testable)
@Composable
private fun HomeContent(uiState: HomeUiState, onEvent: (HomeEvent) -> Unit) {
    LazyColumn { /* render sections */ }
}
```

### ✅ CORRECT - ViewModel obtained via hiltViewModel()

```kotlin
val viewModel = hiltViewModel<HomeViewModel>()
val viewModel: HomeViewModel = hiltViewModel()
```

### ❌ WRONG - Compose violations

```kotlin
// ❌ HIGH severity - creating ViewModel manually
val viewModel = HomeViewModel(useCases, dispatchers, ...)

// ❌ MEDIUM severity - collecting Flow without lifecycle awareness
val state = viewModel.uiState.collectAsState()  // ❌ not lifecycle-aware

// ✅ CORRECT
val state by viewModel.uiState.collectAsStateWithLifecycle()

// ❌ MEDIUM severity - side effects outside LaunchedEffect
viewModel.effect.collect { ... }  // ❌ runs on every recomposition

// ✅ CORRECT
LaunchedEffect(Unit) {
    viewModel.effect.collect { ... }
}
```

---

## Room Database

### ✅ CORRECT - DAO patterns

```kotlin
// Write operations → suspend fun
@Insert(onConflict = OnConflictStrategy.REPLACE)
suspend fun insertPropertyLead(propertyLead: PropertyLead)

// Reactive reads → fun returning Flow<T>
@Query("SELECT * FROM property_lead WHERE property_id = :propertyId")
fun getDroppedLeadByPropertyId(propertyId: Long): Flow<List<PropertyLead>?>

@Query("SELECT EXISTS (SELECT * FROM property_lead WHERE property_id = :propertyId)")
fun isPropertyContacted(propertyId: Long): Flow<Int>

// Atomic multi-step writes → @Transaction on default interface method
@Transaction
suspend fun deleteAndInsertCities(cities: List<City>) {
    deleteAllCities()
    insertCities(cities)
}
```

### ✅ CORRECT - Entity conventions

```kotlin
@Entity(tableName = "cities", primaryKeys = ["uuid", "service_type"])
data class City(
    @ColumnInfo(name = "name") val name: String,
    @ColumnInfo(name = "uuid") val uuid: String,
    @ColumnInfo(name = "service_type") val serviceType: ServiceType,
)
```

### ❌ WRONG - Database violations

```kotlin
// ❌ HIGH severity - missing @Transaction for multi-step write
suspend fun replaceAllCities(cities: List<City>) {
    deleteAllCities()   // If app crashes here, data is lost
    insertCities(cities)
}

// ✅ CORRECT
@Transaction
suspend fun replaceAllCities(cities: List<City>) {
    deleteAllCities()
    insertCities(cities)
}

// ❌ MEDIUM severity - suspend fun for reactive read (loses reactivity)
@Query("SELECT * FROM cities")
suspend fun getAllCities(): List<City>  // One-shot, no updates on change

// ✅ CORRECT (if UI needs to react to DB changes)
@Query("SELECT * FROM cities")
fun getAllCities(): Flow<List<City>>
```

---

## Error Reporting

### ✅ CORRECT - Using ErrorReporter for non-fatal exceptions

```kotlin
// core/errorReporter/ErrorReporter.kt (singleton)
object ErrorReporter {
    fun reportNonFatal(exception: Exception, extras: Map<String, Any> = emptyMap()) {
        Sentry.captureException(exception)
    }
}

// core/errorReporter/NonFatalSentryException.kt
class NonFatalSentryException(
    message: String,
    val tags: Map<String, String> = emptyMap()
) : Exception(message)
```

### ❌ WRONG - Error reporting violations

```kotlin
// ❌ MEDIUM severity - using Log.e for production errors
Log.e("TAG", "API failed", exception)

// ✅ CORRECT - report to Sentry
ErrorReporter.reportNonFatal(exception)
Timber.e(exception, "API failed")  // Timber for debug logging

// ❌ HIGH severity - logging sensitive data
Timber.d("User token: $accessToken, phone: $phoneNumber")

// ✅ CORRECT
Timber.d("User authenticated successfully")
```

---

## Analytics Patterns

### ✅ CORRECT - Feature analytics extend FeatureAnalytics base

```kotlin
// core/analytics/FeatureAnalytics.kt
abstract class FeatureAnalytics : CoroutineScope {
    private val job = SupervisorJob()
    override val coroutineContext: CoroutineContext
        get() = job + Dispatchers.IO  // Analytics fire-and-forget on IO
}

// Feature-specific analytics class
class CrfAnalytics @Inject constructor(
    private val analyticsService: HousingAnalyticService
) : FeatureAnalytics() {
    fun trackLeadDrop(action: String, category: String, screen: String, attrs: Map<String, Any?>) {
        launch { analyticsService.logEvent(screen, action, category, attrs) }
    }
}
```

### ❌ WRONG - Analytics violations

```kotlin
// ❌ MEDIUM severity - analytics on main thread
analyticsService.logEvent(screen, action, category, attrs)  // Blocks UI

// ✅ CORRECT - fire on IO via FeatureAnalytics base
launch { analyticsService.logEvent(screen, action, category, attrs) }

// ❌ MEDIUM severity - PII in analytics
analyticsService.logEvent("login", "success", "auth", mapOf("phone" to userPhone))

// ✅ CORRECT
analyticsService.logEvent("login", "success", "auth", mapOf("method" to "truecaller"))
```

---

## DeeplinkRouter Pattern

### ✅ CORRECT - Interface with Null Object companion

```kotlin
interface DeeplinkRouter {
    fun deepLinkToHome()
    fun deeplinkProjectPdp(
        propertyId: String,
        autoLeadDropFlow: Boolean = false,
        shareSource: ShareSource = ShareSource.Unknown,
        // ... many optional params with defaults
    )

    // Default no-op for optional methods
    fun deeplinkToGeneralSeeAll(...) {}

    // Null Object for previews/tests
    companion object {
        val empty = object : DeeplinkRouter {
            override fun deepLinkToHome() {}
            override fun deeplinkProjectPdp(propertyId: String, ...) {}
            // ... all no-op stubs
        }
    }
}
```

---

## App Startup / Initializer Pattern

### ✅ CORRECT - Jetpack App Startup Initializer

```kotlin
// app/startup/TimberInitializer.kt
class TimberInitializer : Initializer<Unit> {
    override fun create(context: Context) {
        if (BuildConfig.ENABLE_ALPHA_DEBUGGING) {
            Timber.plant(Timber.DebugTree())
        }
    }
    override fun dependencies(): List<Class<out Initializer<*>>> = emptyList()
}
```

### ❌ WRONG - Heavy initialization in Application.onCreate()

```kotlin
// ❌ MEDIUM severity - blocking main thread during app startup
class HousingApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        initializeHeavySDK()           // ❌ blocks startup
        loadRemoteConfig()             // ❌ network on main thread
    }
}

// ✅ CORRECT - offload to IO
CoroutineScope(Dispatchers.IO).launch {
    initializeHeavySDK()
}
```

---

## Testing Patterns

### ✅ CORRECT - MainDispatcherRule (each module has its own copy)

```kotlin
class MainDispatcherRule(
    val testDispatcher: TestDispatcher = StandardTestDispatcher(TestCoroutineScheduler())
) : TestWatcher() {
    override fun starting(description: Description) {
        Dispatchers.setMain(testDispatcher)
    }
    override fun finished(description: Description) {
        Dispatchers.resetMain()
    }
}
```

### ✅ CORRECT - ViewModel test structure

```kotlin
class CrfSharedViewModelTest {

    @get:Rule
    val mainCoroutineRule = MainDispatcherRule()

    @MockK(relaxed = true)
    private lateinit var crfUseCases: CrfUseCases

    @MockK
    private lateinit var dispatchers: CustomDispatchers

    private lateinit var viewModel: CrfSharedViewModel

    @Before
    fun setUp() {
        MockKAnnotations.init(this)

        // Redirect dispatchers to test scheduler
        every { dispatchers.io } returns mainCoroutineRule.testDispatcher
        every { dispatchers.main } returns mainCoroutineRule.testDispatcher

        // Wire use case facades
        every { crfUseCases.leadCreateUseCase } returns leadCreateUseCase

        // Construct ViewModel manually (not via Hilt in unit tests)
        viewModel = CrfSharedViewModel(crfUseCases, dispatchers, ...)

        // Mock singleton objects
        mockkObject(SessionDataManager)
        every { SessionDataManager.isEstimatedBroker } returns MutableStateFlow(false)
    }

    @After
    fun tearDown() {
        unmockkObject(SessionDataManager)
    }

    @Test
    fun `initialize should update ui state`() = runTest {
        coEvery { localDataUseCase.getCachedData() } returns cachedData

        viewModel.handleEvent(CrfSharedEvent.Initialize(initDetails))
        mainCoroutineRule.testDispatcher.scheduler.advanceUntilIdle()

        assertEquals("Expected", viewModel.uiState.value.name)
    }

    @Test
    fun `effect should emit on success`() = runTest {
        coEvery { useCase(phone) } returns flowOf(Result.Success(model))

        val effects = mutableListOf<CrfSharedEffect>()
        val job = launch { viewModel.effect.collect { effects.add(it) } }

        viewModel.handleEvent(CrfSharedEvent.PhoneLookup(phone))
        mainCoroutineRule.testDispatcher.scheduler.advanceUntilIdle()

        assertTrue(effects.any { it is CrfSharedEffect.NavigateToDetails })
        job.cancel()
    }
}
```

### ❌ WRONG - Testing violations

```kotlin
// ❌ MEDIUM severity - not using MainDispatcherRule
@Test
fun `test something`() = runTest {
    // Will fail because Dispatchers.Main is not set
    viewModel.fetchData()
}

// ❌ MEDIUM severity - not unmocking singleton objects
@Before
fun setUp() {
    mockkObject(SessionDataManager)  // ❌ never unmocked → leaks to other tests
}

// ❌ MEDIUM severity - not advancing test dispatcher
@Test
fun `test async`() = runTest {
    viewModel.handleEvent(SomeEvent)
    // ❌ async work hasn't completed
    assertEquals(expected, viewModel.uiState.value)
}

// ✅ CORRECT
@Test
fun `test async`() = runTest {
    viewModel.handleEvent(SomeEvent)
    mainCoroutineRule.testDispatcher.scheduler.advanceUntilIdle()  // ✅
    assertEquals(expected, viewModel.uiState.value)
}
```

---

## Naming Conventions

### Classes/Interfaces

| Type | Pattern | Examples |
|------|---------|----------|
| ViewModel | `{Feature}ViewModel` | `HomeViewModel`, `PdpViewModel`, `CrfBottomSheetViewModel` |
| Repository Interface | `I{Feature}Repo` | `IHomeRepo`, `ICrfRepo`, `ILoginRepo` |
| Repository Impl | `{Feature}RepoImpl` | `HomeRepoImpl`, `CrfRepositoryImpl` |
| RemoteSource | `{Feature}RemoteSource` | `HomeRemoteSource`, `CrfRemoteSource` |
| Use Case | `{Action}UseCase` | `LeadCreateUseCase`, `LeadVerifyUseCase`, `LocalDataUseCase` |
| Use Case Facade | `{Feature}UseCases` | `CrfUseCases`, `HomeModuleUseCases` |
| DI Module | `{Feature}Module` or `RepoModule` | `NetworkModule`, `HomeRepoModule`, `CrfUseCaseModule` |
| Hilt Component Scope | varies | `@InstallIn(SingletonComponent::class)`, `@InstallIn(ViewModelComponent::class)` |
| DTO | `{Feature}{Type}Dto` | `LeadSuccessResponseDto`, `BulkDedicatedApiForRentDto` |
| Entity (Room) | `{Name}` | `City`, `PropertyLead`, `SeenProperty` |
| DAO | `{Entity}Dao` | `CitiesDao`, `PropertyLeadDao`, `SeenPropertyDao` |
| UI State | `{Feature}UiState` | `CrfBottomSheetUiState`, `HomeUiState` |
| UI Event | `{Feature}Event` | `CrfBottomSheetEvent`, `HomeEvents`, `GalleryViewEvent` |
| UI Effect | `{Feature}Effect` | `CrfBottomSheetEffect`, `HomeEffect` |
| Analytics | `{Feature}Analytics` | `CrfAnalytics`, `GalleryAnalytics`, `ScreenViewAnalytics` |
| Composable Screen | `{Feature}Screen` | `HomeScreen`, `CommercialPdpScreen` |
| NavGraph | `{Feature}NavGraph` | `HomeNavGraph`, `MainGraph` |

### Packages

- `com.locon.housing` — app module
- `com.locon.core` — core module
- `com.locon.network` — network module
- `com.locon.database` — database module
- `com.locon.home.{data|domain|presentation}` — feature modules
- `com.locon.coreUI` — shared Compose components

### Variables/Functions

- `camelCase` for variables and functions
- Boolean: `isEnabled`, `hasData`, `isPropertySaved`, `isKeyboardOpen`
- Private backing fields: `_uiState`, `_effect`, `_isLoading`
- Public exposed: `uiState`, `effect`, `isLoading`
- Event handlers: `handleEvent()`, `onEvent()`

---

## Null Safety

### ✅ CORRECT

```kotlin
val name = user.name ?: return
val name = user.name ?: "Unknown"
val city = user.city?.let { processCity(it) }

if (data != null) { useData(data) }
```

### ❌ WRONG

```kotlin
// ❌ HIGH severity - can crash
val name = user.name!!

// ❌ MEDIUM severity - platform type without null check
val length = javaString.length  // Can NPE if javaString is null
```

---

## Build Configuration

### Version Catalog (gradle/libs.versions.toml)

```toml
[versions]
kotlin = "1.9.x"
hilt = "2.x"
compose-bom = "2024.x"

[libraries]
hilt-android = { group = "com.google.dagger", name = "hilt-android", version.ref = "hilt" }

[plugins]
convention-android-app = { id = "convention.android.app" }
```

### Convention Plugins (buildLogic/)

```kotlin
// buildLogic/plugins/AndroidApplicationConventionPlugin.kt
class AndroidApplicationConventionPlugin : Plugin<Project> {
    override fun apply(target: Project) {
        with(target) {
            with(pluginManager) {
                apply("com.android.application")
                apply("org.jetbrains.kotlin.android")
                apply("dagger.hilt.android.plugin")
            }
            // Common config: compileSdk, minSdk, etc.
        }
    }
}
```

### ❌ WRONG - Build violations

```kotlin
// ❌ MEDIUM severity - hardcoding SDK versions instead of using version catalog
android {
    compileSdk = 34  // ❌ should come from GradleConfig or version catalog
}

// ✅ CORRECT
android {
    compileSdk = GradleConfig.COMPILE_SDK
}

// ❌ MEDIUM severity - adding dependency without version catalog
implementation("com.squareup.retrofit2:retrofit:2.9.0")

// ✅ CORRECT
implementation(libs.retrofit)
```

---

## Kotlin Style Rules

### ✅ CORRECT

```kotlin
// data class for state objects
data class CrfBottomSheetUiState(
    val isLoading: Boolean = false,
    val name: String = "",
    val error: String? = null
)

// sealed class/interface for restricted hierarchies
sealed interface CrfBottomSheetEvent : Event.UiEvent()
sealed class Failure { ... }
sealed class Result<out L, out R> { ... }

// Extension functions for mapping
fun HomeResponseDto.asModel(): HomeData = HomeData(
    title = this.title ?: "",
    properties = this.properties?.map { it.toDomain() } ?: emptyList()
)

// Scope functions for builder-like patterns
OkHttpClient.Builder().apply {
    addInterceptor(headerInterceptor)
    callTimeout(timeOutValue, TimeUnit.SECONDS)
}.build()

// when expression for exhaustive matching
when (result) {
    is Result.Success -> handleSuccess(result.data)
    is Result.Error -> handleError(result.error)
}
```

### ❌ WRONG

```kotlin
// ❌ MEDIUM severity - mutable data class (use copy() instead)
data class UiState(var isLoading: Boolean = false)

// ✅ CORRECT
data class UiState(val isLoading: Boolean = false)
// Mutate via: _uiState.update { it.copy(isLoading = true) }

// ❌ MEDIUM severity - using !! when safe alternatives exist
val item = list.find { it.id == id }!!

// ✅ CORRECT
val item = list.find { it.id == id } ?: return

// ❌ LOW severity - unnecessary let
user?.let { it.name }  // Just use user?.name
```

---

## Common Violations Checklist

Based on analysis of housing-app (Feb 2026):

| # | Violation | Severity | What to Check |
|---|-----------|----------|---------------|
| 1 | Direct instantiation bypassing Hilt | HIGH | `= SomeClass()` for injected types |
| 2 | `Dispatchers.IO`/`Main` used directly | HIGH | Should use injected `CustomDispatchers` |
| 3 | Swallowing `CancellationException` | HIGH | Bare `catch (e: Exception)` without re-throw |
| 4 | Exposing `MutableStateFlow` publicly | HIGH | Must use `asStateFlow()` |
| 5 | Force unwrap `!!` | HIGH | Use `?:`, `?.let`, `guard` |
| 6 | Missing `@Transaction` for multi-step DB writes | HIGH | Delete + Insert without wrapping |
| 7 | Layer violations (presentation → data) | HIGH | Wrong imports across module boundaries |
| 8 | Concrete types instead of interfaces | MEDIUM | `HomeRepoImpl` vs `IHomeRepo` |
| 9 | `collectAsState()` instead of `collectAsStateWithLifecycle()` | MEDIUM | Lifecycle-unaware collection |
| 10 | Missing `advanceUntilIdle()` in tests | MEDIUM | Async work not completed |
| 11 | LiveData in new code | MEDIUM | Codebase uses StateFlow |
| 12 | `_uiState.value = copy(...)` instead of `.update {}` | MEDIUM | Not thread-safe |
| 13 | Business logic in Repository | MEDIUM | Should be in UseCase |
| 14 | Hardcoded URLs/SDK versions | MEDIUM | Should use endpoint holders / version catalog |
| 15 | PII in logs/analytics | HIGH | Phone numbers, tokens, emails |
| 16 | Not unmocking singletons in `@After` | MEDIUM | Test pollution |

---

## Notes for Reviewers

- **DI pattern violations are HIGH severity** — they break testability and the entire architecture
- **Dispatcher violations are HIGH severity** — they make code untestable
- **CancellationException swallowing is HIGH severity** — breaks structured concurrency
- **Layer boundary violations are HIGH severity** — they break module isolation
- **Convention violations are MEDIUM severity** — they affect maintainability
- Always reference this file in review comments with specific patterns
- Update this file when new patterns are established or violations are found

---

## Quick Reference

**When reviewing a PR, check:**
1. ✅ All classes use `@Inject constructor` or are provided via Hilt `@Module`
2. ✅ ViewModels use `@HiltViewModel` and are obtained via `hiltViewModel()`
3. ✅ `CustomDispatchers` injected, never `Dispatchers.*` directly
4. ✅ `MutableStateFlow` is private, exposed via `asStateFlow()`
5. ✅ State updates use `.update { it.copy(...) }` (thread-safe)
6. ✅ One-time events use `Channel`/`SharedFlow`, not `StateFlow`
7. ✅ `CancellationException` is always re-thrown
8. ✅ Repository interfaces in domain, implementations in data
9. ✅ Use cases as intermediary between ViewModel and Repository
10. ✅ Compose screens use `collectAsStateWithLifecycle()`
11. ✅ Effects collected in `LaunchedEffect(Unit)`
12. ✅ Room writes use `suspend`, reactive reads use `Flow`
13. ✅ Multi-step DB writes wrapped in `@Transaction`
14. ✅ Tests use `MainDispatcherRule`, mock dispatchers, `advanceUntilIdle()`
15. ✅ No PII in logs or analytics
16. ✅ Dependencies from version catalog, not hardcoded

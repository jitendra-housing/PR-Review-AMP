# iOS Development Guidelines - housing-app

This file contains iOS-specific conventions and patterns for the housing-app codebase.
**Last Updated:** Based on analysis of AppCore, Common, PDPModule, and HomePageModule.

## Dependency Injection (Container Pattern)

The codebase uses a custom `DIContainer` for dependency injection. **ALL** ViewControllers and ViewModels MUST be instantiated via `container.resolve()`.

### ✅ CORRECT - Use container.resolve()

**Example 1: ViewController + ViewModel with arguments**
```swift
// From PDPCoordinator.swift - openFloorPlanBottomSheet()
let vm = container.resolve(FloorPlanBottomSheetViewVMProtocol.self, arguments: data)
let vc = container.resolve(FloorPlanBottomSheetVC.self)
vc.viewModel = vm
presentBottomSheet(contentController: vc, style: .custom(600), type: .intrinsic, showPullBar: true)
```

**Example 2: Resolve with multiple arguments**
```swift
// From PDPDependencies.swift
container.registerFactory(PDPImmersiveViewModelProtocol.self) { args in
    guard let id = args[safe: 0] as? String,
          let type = args[safe: 1] as? PropertyTypes else {
        fatalError("Invalid arguments")
    }
    return PDPImmersiveViewModel(id: id, type: type, deps: deps)
}

// Usage:
let viewModel = container.resolve(PDPImmersiveViewModelProtocol.self, arguments: id, type)
```

**Example 3: Resolve ViewControllers**
```swift
// From PDPDependencies.swift
container.registerFactory(PDPViewController.self) {
    let vc = PDPViewController()
    return vc
}

// Usage:
let vc = container.resolve(PDPViewController.self)
```

### ❌ WRONG - Direct instantiation

**FOUND IN CODE REVIEW: PDPCoordinator.swift:364**
```swift
func openEMIBreakupBottomSheet(model: EMIBreakupBottomSheetModel, delegate: EMIBreakupBottomSheetVCDelegate?) {
    let vc = EMIBreakupBottomSheetVC()  // ❌ HIGH severity violation
    vc.model = model
    vc.delegate = delegate
    presentBottomSheet(contentController: vc, style: .custom(600), type: .intrinsic, showPullBar: true)
}
```

**SHOULD BE:**
```swift
func openEMIBreakupBottomSheet(model: EMIBreakupBottomSheetModel, delegate: EMIBreakupBottomSheetVCDelegate?) {
    let vm = container.resolve(EMIBreakupBottomSheetViewVMProtocol.self, arguments: model)  // ✅ Correct
    let vc = container.resolve(EMIBreakupBottomSheetVC.self)  // ✅ Correct
    vc.viewModel = vm
    vc.delegate = delegate
    presentBottomSheet(contentController: vc, style: .custom(600), type: .intrinsic, showPullBar: true)
}
```

**Why HIGH severity:**
- Violates the DI architecture used throughout the codebase
- Reduces testability (can't inject mock dependencies)
- Creates tight coupling
- Inconsistent with all other VC instantiations in PDPModule

---

## Memory Management

### ✅ CORRECT - Use [weak self] in closures

**Found throughout PDPModule:**
```swift
// From PDPCoordinator.swift
dismissBottomSheet(completion: { [weak self] in
    self?.presentSomeVC()
})

// From TopGalleryHeaderView.swift
delegate?.didTapTopGalleryHeaderSaveButton(addToFavorite: !isPropertySaved, fromLabel: PDPConstants.shortList) { [weak self] success in
    self?.updateUI(success)
}

// From SponsoredSellerView.swift
imageLoadTask = HousingImageManager.shared.loadImage(with: imageURL) { [weak self] image, _ in
    self?.imageView.image = image
}
```

### ❌ WRONG - Strong reference cycles
```swift
dismissBottomSheet(completion: {
    self.presentSomeVC()  // ❌ MEDIUM/HIGH severity - potential memory leak
})

HousingImageManager.shared.loadImage(with: url) { image, _ in
    self.imageView.image = image  // ❌ MEDIUM/HIGH severity - retain cycle
}
```

**Why:** Creates strong reference cycles, preventing proper deallocation of ViewControllers and memory leaks.

---

## Optional Handling

### ✅ CORRECT - Use guard or if-let
```swift
guard let value = optionalValue else { return }

if let value = optionalValue {
    // use value
}
```

### ❌ WRONG - Force unwrapping
```swift
let value = optionalValue!  // MEDIUM/HIGH severity - can crash
```

---

## Singleton Access

### ✅ CORRECT - Use .shared
```swift
let manager = DatabaseManager.shared
let analytics = AnalyticsManager.shared
```

### ❌ WRONG - Direct instantiation
```swift
let manager = DatabaseManager()  // HIGH severity violation
```

---

## Naming Conventions

### Classes/Structs/Protocols

**ViewControllers:**
- Format: `{Feature}ViewController` or `{Feature}VC`
- Examples from codebase:
  - `PDPViewController`
  - `PDPImmersiveViewController`
  - `FloorPlanBottomSheetVC`
  - `EMIBreakupBottomSheetVC`
  - `ScreenshotShareViewController`

**ViewModels:**
- Format: `{Feature}ViewModel` or `{Feature}VM`
- Examples:
  - `PDPImmersiveViewModel`
  - `PDPNPViewModel`
  - `FloorPlanBottomSheetViewVM`

**Protocols:**
- Format: `{Type}Protocol` or specific suffix like `Delegate`
- Examples from PDPModule:
  - `PDPViewModelProtocol`
  - `PDPNetworkServiceProtocol`
  - `FloorPlanBottomSheetViewVMProtocol`
  - `PDPCoordinatorDelegate`
  - `PDPCoordinatorBottomSheetProtocol`
  - `CRFSelectionViewProtocol`

**Coordinators:**
- Format: `{Module}Coordinator`
- Example: `PDPCoordinator`

### Variables/Functions
- Use `camelCase`
- Boolean properties: `isEnabled`, `hasData`, `canPerform`, `isPropertySaved`
- Function names: `openFloorPlanBottomSheet`, `dismissBottomSheet`, `presentBottomSheet`

### Constants
- Examples from codebase:
  - `DateFormat` (struct with static constants)
  - `BottomSheet` (configuration constants)
  - `PDPConstants` (module-specific constants)
  - Use structured constants in separate files (see AppCore/Constants/)

---

## Async Operations

### ✅ CORRECT - Use async/await
```swift
func fetchData() async throws -> Data {
    let data = try await networkService.fetch()
    return data
}
```

### ❌ WRONG - Old completion handlers (if codebase uses async/await)
```swift
func fetchData(completion: @escaping (Data?) -> Void) {
    // Only if codebase has migrated to async/await
}
```

---

## UI Updates

### ✅ CORRECT - Always on main thread
```swift
DispatchQueue.main.async {
    self.updateUI()
}

// Or with async/await
await MainActor.run {
    updateUI()
}
```

### ❌ WRONG - UI updates on background thread
```swift
updateUI()  // HIGH severity if called from background thread
```

---

## Error Handling

### ✅ CORRECT - Proper error propagation
```swift
func doSomething() throws {
    try performAction()
}

// Or
func doSomething() -> Result<Data, Error> {
    // implementation
}
```

### ❌ WRONG - Swallowing errors
```swift
try? performAction()  // MEDIUM severity - loses error context
```

---

## Code Organization

### Module Structure

The codebase follows a modular architecture:
```
ios/
├── AppCore/              # Core dependencies, networking, DI container
│   ├── DI/              # DIContainer.swift, CoreDependencies.swift
│   ├── Networking/      # NetworkService, Headers, Domains
│   ├── Constants/       # Global constants
│   └── Managers/        # Shared managers
├── Common/              # Shared models, protocols, utilities
│   ├── DI/              # CommonDependencies.swift
│   └── Constants/       # Shared constants
├── PDPModule/           # Property Detail Page module
│   ├── PDP/
│   │   ├── DI/          # PDPDependencies.swift (registers all PDP dependencies)
│   │   ├── Domain/      # Interactors, NetworkService
│   │   ├── Presentation/# ViewModels
│   │   ├── Views/       # Custom views, cells
│   │   └── PDPCoordinator.swift
└── HomePageModule/      # Similar structure
```

### Dependency Registration Pattern

Each module has a `{Module}Dependencies.swift` file that registers all dependencies:

```swift
// From PDPDependencies.swift
public final class PDPDependencies {
    public static func register(in container: DIContainer, analytics: AnalyticsLogging) {
        
        // Register ViewModels with protocols
        container.registerFactory(PDPImmersiveViewModelProtocol.self) { args in
            // Factory implementation
        }
        
        // Register ViewControllers
        container.registerFactory(PDPViewController.self) {
            let vc = PDPViewController()
            return vc
        }
        
        // Register Coordinators
        container.registerFactory(PDPCoordinatorProtocol.self) { args in
            return PDPCoordinator(container: container, id: id, type: type)
        }
    }
}
```

### File Size Guidelines
- Based on codebase analysis:
  - ViewControllers: Typically 200-500 lines
  - ViewModels: Split into extensions (e.g., `PDPViewModel+Tabs.swift`)
  - Complex ViewModels use protocol composition
  - Large files split using extensions with descriptive names

### Method Complexity
- Avoid > 3 levels of nesting
- Extract complex logic into private methods
- Use extensions to organize code by feature (see `PDPViewModel+AllianceBanner.swift`)

---

## Testing

### Required Tests
- All ViewModels must have unit tests
- Business logic must be tested
- Use dependency injection for testability

---

## Project-Specific Patterns

### Bottom Sheet Presentation Pattern

**✅ CORRECT - From PDPCoordinator.swift:**
```swift
func openFloorPlanBottomSheet(
    data: FloorPlanBottomSheetModel?,
    sheetViewLayout: NSCollectionLayoutSection,
    shareData: ShareData?,
    listingModel: BaseListingModelProtocol?,
    pdpModel: PDPModelProtocol?,
    selectedIndex: Int
) {
    guard let data = data else { return }
    let vm = container.resolve(FloorPlanBottomSheetViewVMProtocol.self, arguments: data)
    let vc = container.resolve(FloorPlanBottomSheetVC.self)
    vc.viewModel = vm
    vc.sheetViewLayout = sheetViewLayout
    vc.shareData = shareData
    vc.listingModel = listingModel
    vc.pdpModel = pdpModel
    vc.selectedIndex = selectedIndex
    presentBottomSheet(contentController: vc, style: .custom(600), type: .intrinsic, showPullBar: true)
}
```

**❌ WRONG - Direct instantiation:**
```swift
func openEMIBreakupBottomSheet(model: EMIBreakupBottomSheetModel, delegate: EMIBreakupBottomSheetVCDelegate?) {
    let vc = EMIBreakupBottomSheetVC()  // ❌ HIGH severity - violates DI pattern
    vc.model = model
    vc.delegate = delegate
    presentBottomSheet(contentController: vc, style: .custom(600), type: .intrinsic, showPullBar: true)
}
```

### Coordinator Pattern

The codebase uses coordinators to manage navigation:
- Each module has a `{Module}Coordinator`
- Coordinators hold references to `DIContainer`
- Navigation logic is delegated to coordinators
- ViewControllers should NOT perform navigation directly

**Example:**
```swift
// PDPCoordinator initialization
let coordinator = container.resolve(PDPCoordinatorProtocol.self, arguments: id, typeString, multiCardID)
```

### Protocol-Based Architecture

- ViewModels are accessed via protocols: `PDPViewModelProtocol`, not concrete types
- Network services use protocols: `PDPNetworkServiceProtocol`
- Benefits: Easier testing, loose coupling, dependency inversion

---

## Common Violations Found in Codebase

Based on analysis of housing-app (Jan 2026):

### 1. Direct ViewController Instantiation (HIGH Severity)
**Location:** `PDPCoordinator.swift:364`
```swift
❌ let vc = EMIBreakupBottomSheetVC()
✅ let vc = container.resolve(EMIBreakupBottomSheetVC.self)
```

### 2. Missing ViewModel Resolution
Many bottom sheet presentations skip ViewModel creation via DI.

**Pattern to follow:**
1. Resolve ViewModel with arguments: `container.resolve(VMProtocol.self, arguments: data)`
2. Resolve ViewController: `container.resolve(VC.self)`
3. Assign ViewModel to VC: `vc.viewModel = vm`
4. Present

---

## Notes for Reviewers

- **DI Pattern violations are HIGH severity** - they break the entire architecture
- **Memory management issues are HIGH severity** - they cause leaks
- **Convention violations are MEDIUM severity** - they affect maintainability
- Always reference this file in review comments with specific line numbers
- Update this file when new patterns are established or violations are found

---

## Quick Reference

**When reviewing a PR, check:**
1. ✅ All VCs/VMs use `container.resolve()` (not direct instantiation)
2. ✅ All closures capturing `self` use `[weak self]`
3. ✅ Optionals handled safely (guard/if-let, not force unwrap)
4. ✅ Naming follows conventions (Protocol suffix, VC/VM suffix)
5. ✅ Dependencies registered in `{Module}Dependencies.swift`
6. ✅ ViewModels accessed via protocols, not concrete types

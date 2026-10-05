# Flutter → Expo migration status

Source: `ejr_mobile` (Flutter, 84 Dart files, 36,309 lines).
Target: Expo SDK 57 · React Native 0.86 · TypeScript · Expo Router (file-based routes in `src/app`).

**Done:** 27 · **Navigation shell / stub:** 23 · **Pending:** 31 · **Skipped:** 3

## Package mapping

| Flutter | Expo / RN |
|---|---|
| `http` | built-in `fetch` (+ `FormData` for uploads) |
| `flutter_secure_storage` | `expo-secure-store` |
| `shared_preferences` | `@react-native-async-storage/async-storage` |
| `google_fonts` (Poppins) | `@expo-google-fonts/poppins` |
| `image_picker` | `expo-image-picker` |
| `url_launcher` | `Linking.openURL` (react-native) |
| `Clipboard` | `expo-clipboard` |
| `showDatePicker` | `components/DatePickerModal.tsx` (custom month grid; supports disabled days) |
| `DropdownButtonFormField` | `components/Select.tsx` (tap -> bottom sheet) |
| `showModalBottomSheet` | `components/Sheet.tsx` |
| Constructor args between screens | `services/bookingDraft.ts` / `services/qrphHandoff.ts` (in-memory) |
| `SnackBar` | `useToast()` from `components/Toast.tsx` |
| `showDialog` / `AlertDialog` | `Alert.alert` via `lib/dialogs.ts` (`showAlert`, `confirm`) |
| `flutter_local_notifications` | `expo-notifications` |
| `safe_device` | `jail-monkey` (native; absent in Expo Go -> fails open) |
| `package_info_plus` | `expo-application` + `expo-constants` |
| `app_links` | `expo-linking` + `src/app/+native-intent.tsx` + `app.json` intent filter / associated domains |
| `ChangeNotifier` | `useSyncExternalStore` stores (`session.ts`, `cart.ts`) |
| `Navigator` / named routes | Expo Router (`router.push/replace`, route groups per role) |
| `Material Icons` | `@expo/vector-icons` (Ionicons) |

## Porting conventions

- **Screens** go in the matching route file (stubs already exist, each says which Dart file it comes from).
- **API calls**: use `api` from `@/services/api`. All endpoints from `api_service.dart` are already ported with the same request/response shapes.
- **Session**: `useUserSession()` re-renders on login/logout/profile refresh; `userSession` for non-React code.
- **Styling**: `colors`, `fonts`, `text` from `@/theme/theme`. Poppins weights are chosen by font family (`fonts.semibold`), not `fontWeight`.
- **Forms**: `Field`, `PrimaryButton`, `ErrorBanner`, `Screen`, `BackButton` in `@/components/ui`.
- **Detail screens** (e.g. booking details, e-receipt) become new files under the role group, e.g. `src/app/(customer)/booking/[id].tsx`, and are opened with `router.push`.

## File-by-file status

| Dart file | Lines | Status | Where / note |
|---|---:|---|---|
| `lib/main.dart` | 114 | ✅ Done | `src/app/_layout.tsx`, `src/app/+native-intent.tsx` |
| `lib/screens/admin/admin_account.dart` | 526 | 🟡 Shell | Basic `ProfileSummary` at `(admin)/account.tsx`; edit/password UI pending |
| `lib/screens/admin/admin_appointments.dart` | 1014 | 🟡 Shell | Route stub `(admin)/appointments.tsx` |
| `lib/screens/admin/admin_busy_dates.dart` | 716 | 🟡 Shell | Route stub `(admin)/busy-dates.tsx` |
| `lib/screens/admin/admin_dashboard.dart` | 638 | 🟡 Shell | Route stub `(admin)/index.tsx` |
| `lib/screens/admin/admin_drawer.dart` | 635 | 🟡 Shell | Drawer + menu done in `(admin)/_layout.tsx`; live count badges (`getAdminDrawerCounts`) pending |
| `lib/screens/admin/admin_history.dart` | 743 | 🟡 Shell | Route stub `(admin)/history.tsx` |
| `lib/screens/admin/admin_live_chat.dart` | 975 | ✅ Done | `(admin)/live-chat.tsx` (inbox + conversation, live-request accept/decline) + `components/chat/*` + `lib/chat.ts` |
| `lib/screens/admin/admin_mechanics.dart` | 987 | 🟡 Shell | Route stub `(admin)/mechanics.tsx` |
| `lib/screens/admin/admin_orders.dart` | 786 | 🟡 Shell | Route stub `(admin)/orders.tsx` |
| `lib/screens/admin/admin_pages.dart` | 1093 | ⬜ Pending |  |
| `lib/screens/admin/admin_part_inquiries.dart` | 747 | 🟡 Shell | Route stub `(admin)/inquiries.tsx` |
| `lib/screens/admin/admin_parts.dart` | 1521 | 🟡 Shell | Route stub `(admin)/parts.tsx` |
| `lib/screens/admin/admin_services.dart` | 967 | 🟡 Shell | Route stub `(admin)/services.tsx` |
| `lib/screens/admin/admin_users.dart` | 1120 | 🟡 Shell | Route stub `(admin)/users.tsx` |
| `lib/screens/admin/admin_vehicles.dart` | 761 | 🟡 Shell | Route stub `(admin)/vehicles.tsx` |
| `lib/screens/admin/admin_widgets.dart` | 146 | ⬜ Pending |  |
| `lib/screens/customer/appointment_screen.dart` | 526 | ✅ Done | `src/app/appointments.tsx` |
| `lib/screens/customer/available_parts_screen.dart` | 742 | ✅ Done | `(customer)/parts.tsx` + `components/InquirySheet.tsx` + `components/CartButton.tsx` |
| `lib/screens/customer/billing_screen.dart` | 234 | ⬜ Pending |  |
| `lib/screens/customer/booking_confirmation_screen.dart` | 287 | ✅ Done | `src/app/booking-confirmation.tsx` (state carried by `services/bookingDraft.ts`) |
| `lib/screens/customer/booking_details_screen.dart` | 1408 | ✅ Done | `(customer)/booking.tsx` (Booking tab) + `lib/vehicleData.ts`, `components/Select.tsx`, `components/DatePickerModal.tsx` |
| `lib/screens/customer/booking_screen.dart` | 1332 | ✅ Done | `src/app/select-services.tsx` |
| `lib/screens/customer/cart_screen.dart` | 875 | ✅ Done | `src/app/cart.tsx` |
| `lib/screens/customer/e_receipt_screen.dart` | 281 | ⬜ Pending |  |
| `lib/screens/customer/edit_profile_screen.dart` | 482 | ⬜ Pending |  |
| `lib/screens/customer/forgot_password_screen.dart` | 165 | ⏭ Skipped | Skipped — unreferenced duplicate of `screens/forgot_password_screen.dart`. |
| `lib/screens/customer/home_screen.dart` | 701 | ✅ Done | `(customer)/_layout.tsx` (tabs) + `(customer)/index.tsx` (home content) |
| `lib/screens/customer/live_chat_screen.dart` | 1668 | ✅ Done | `(customer)/chat.tsx` (bot / waiting / live modes) + `components/chat/*` + `lib/chat.ts` |
| `lib/screens/customer/my_inquiries_screen.dart` | 295 | 🟡 Shell | Route stub `src/app/my-inquiries.tsx` |
| `lib/screens/customer/my_orders_screen.dart` | 365 | ✅ Done | `src/app/my-orders.tsx` |
| `lib/screens/customer/my_vehicles_screen.dart` | 933 | 🟡 Shell | Route stub `src/app/my-vehicles.tsx` |
| `lib/screens/customer/payment_preference_screen.dart` | 238 | ⬜ Pending |  |
| `lib/screens/customer/payment_screen.dart` | 358 | ⬜ Pending |  |
| `lib/screens/customer/profile_screen.dart` | 297 | 🟡 Shell | Basic version (`ProfileSummary`: avatar, name, email, logout); menu list pending -> `(customer)/profile.tsx` |
| `lib/screens/customer/qrph_payment_screen.dart` | 451 | ✅ Done | `src/app/qrph-payment.tsx` (QR handed over via `services/qrphHandoff.ts`, not route params) |
| `lib/screens/customer/review_summary_screen.dart` | 238 | ⬜ Pending |  |
| `lib/screens/customer/settings_screen.dart` | 303 | ⬜ Pending |  |
| `lib/screens/forgot_password_screen.dart` | 165 | ✅ Done | `src/app/forgot-password.tsx` |
| `lib/screens/get_started_screen.dart` | 102 | ✅ Done | `src/app/get-started.tsx` |
| `lib/screens/login_screen.dart` | 296 | ✅ Done | `src/app/login.tsx` |
| `lib/screens/mechanic/core/colors.dart` | 23 | ✅ Done | `mechanicColors` in `src/theme/theme.ts` |
| `lib/screens/mechanic/core/constants.dart` | 0 | ⏭ Skipped | Skipped — empty file. |
| `lib/screens/mechanic/core/date_utils.dart` | 33 | ⬜ Pending |  |
| `lib/screens/mechanic/core/theme.dart` | 41 | ⬜ Pending |  |
| `lib/screens/mechanic/models/dashboard_card_model.dart` | 13 | ⬜ Pending |  |
| `lib/screens/mechanic/screens/booking_confirmation_screen.dart` | 290 | ⬜ Pending |  |
| `lib/screens/mechanic/screens/booking_details_screen.dart` | 351 | ⬜ Pending |  |
| `lib/screens/mechanic/screens/booking_screen.dart` | 280 | 🟡 Shell | Route stub `(mechanic)/bookings.tsx` |
| `lib/screens/mechanic/screens/chat_screen.dart` | 136 | ⬜ Pending |  |
| `lib/screens/mechanic/screens/customer_details_screen.dart` | 376 | ⬜ Pending |  |
| `lib/screens/mechanic/screens/customers_screen.dart` | 280 | 🟡 Shell | Route stub `(mechanic)/customers.tsx` |
| `lib/screens/mechanic/screens/dashboard_screen.dart` | 463 | ⬜ Pending |  |
| `lib/screens/mechanic/screens/employees_screen.dart` | 257 | ⬜ Pending |  |
| `lib/screens/mechanic/screens/feedback_screen.dart` | 284 | ⬜ Pending |  |
| `lib/screens/mechanic/screens/inspection_screen.dart` | 172 | ⬜ Pending |  |
| `lib/screens/mechanic/screens/inventory_screen.dart` | 335 | 🟡 Shell | Route stub `(mechanic)/inventory.tsx` |
| `lib/screens/mechanic/screens/job_order_screen.dart` | 387 | ⬜ Pending |  |
| `lib/screens/mechanic/screens/leave_request_screen.dart` | 594 | ⬜ Pending |  |
| `lib/screens/mechanic/screens/mechanic_home_screen.dart` | 416 | 🟡 Shell | Route stub `(mechanic)/index.tsx` |
| `lib/screens/mechanic/screens/mechanic_main_screen.dart` | 473 | 🟡 Shell | Tabs + polling lifecycle done in `(mechanic)/_layout.tsx`; header status toggle / side menu pending |
| `lib/screens/mechanic/screens/messages_screen.dart` | 102 | ⬜ Pending |  |
| `lib/screens/mechanic/screens/notifications_screen.dart` | 193 | ⬜ Pending |  |
| `lib/screens/mechanic/screens/reports_screen.dart` | 321 | ⬜ Pending |  |
| `lib/screens/mechanic/screens/service_selection_screen.dart` | 272 | ⬜ Pending |  |
| `lib/screens/mechanic/screens/settings_screen.dart` | 271 | ⬜ Pending |  |
| `lib/screens/mechanic/screens/work_assignment_screen.dart` | 317 | ⬜ Pending |  |
| `lib/screens/mechanic/widgets/bottom_nav.dart` | 50 | ✅ Done | `src/app/(mechanic)/_layout.tsx` |
| `lib/screens/mechanic/widgets/dashboard_card.dart` | 63 | ⬜ Pending |  |
| `lib/screens/mechanic/widgets/recent_booking_card.dart` | 118 | ⬜ Pending |  |
| `lib/screens/new_password_screen.dart` | 264 | ✅ Done | `src/app/new-password.tsx` |
| `lib/screens/signup_screen.dart` | 294 | ✅ Done | `src/app/signup.tsx` |
| `lib/screens/splash_screen.dart` | 226 | ✅ Done | `src/app/index.tsx` |
| `lib/screens/terms_screen.dart` | 193 | ✅ Done | `src/app/terms.tsx` |
| `lib/screens/verify_account_screen.dart` | 169 | ⏭ Skipped | Skipped — dead code in the Flutter app (nothing navigates to it; verification is via the emailed link). |
| `lib/services/api_service.dart` | 1285 | ✅ Done | `src/services/api.ts` (all endpoints) |
| `lib/services/app_update_service.dart` | 104 | ✅ Done | `src/services/appUpdate.ts` |
| `lib/services/cart_service.dart` | 161 | ✅ Done | `src/services/cart.ts` |
| `lib/services/device_integrity_service.dart` | 29 | ✅ Done | `src/services/deviceIntegrity.ts` |
| `lib/services/notification_service.dart` | 130 | ✅ Done | `src/services/notifications.ts` |
| `lib/services/payment_preference_service.dart` | 46 | ✅ Done | `src/services/paymentPreference.ts` |
| `lib/services/user_session.dart` | 59 | ✅ Done | `src/services/session.ts` |
| `lib/theme/app_theme.dart` | 166 | ✅ Done | `src/theme/theme.ts` |
| `lib/utils/admin_date_format.dart` | 41 | ⬜ Pending |  |

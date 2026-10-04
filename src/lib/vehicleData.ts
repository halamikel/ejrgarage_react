// Generated from lib/screens/customer/booking_details_screen.dart (same lists, same order).
// Shared by the Booking flow and My Vehicles.

export const VEHICLE_MODELS: Record<string, string[]> = {
  'Toyota': ['Agya', 'Avanza', 'Camry', 'Corolla', 'Corolla Altis', 'Corolla Cross', 'Fortuner', 'GR 86', 'GR Yaris', 'Hiace', 'Hilux', 'Innova', 'Land Cruiser', 'Raize', 'Rush', 'Veloz', 'Vios', 'Wigo', 'Yaris', 'Yaris Cross'],
  'Honda': ['Brio', 'BR-V', 'City', 'Civic', 'CR-V', 'HR-V', 'Jazz', 'Mobilio', 'Odyssey', 'Pilot'],
  'Mitsubishi': ['ASX', 'Eclipse Cross', 'Lancer', 'Mirage', 'Montero Sport', 'Outlander', 'Strada', 'Xpander', 'Xpander Cross'],
  'Nissan': ['Almera', 'Juke', 'Kicks', 'Leaf', 'Navara', 'Patrol', 'Terra', 'Urvan', 'X-Trail'],
  'Ford': ['EcoSport', 'Everest', 'Explorer', 'Expedition', 'Mustang', 'Ranger', 'Territory', 'Transit'],
  'Suzuki': ['APV', 'Celerio', 'Dzire', 'Ertiga', 'Jimny', 'S-Presso', 'Swift', 'Vitara', 'XL7'],
  'Isuzu': ['D-Max', 'MU-X', 'Traviz', 'Crosswind', 'Elf'],
  'Hyundai': ['Accent', 'Creta', 'Elantra', 'Ioniq', 'Kona', 'Santa Fe', 'Stargazer', 'Staria', 'Tucson', 'Venue'],
  'Kia': ['Carnival', 'EV6', 'EV9', 'Forte', 'Picanto', 'Rio', 'Seltos', 'Sonet', 'Sorento', 'Sportage'],
  'Mazda': ['CX-3', 'CX-5', 'CX-8', 'CX-9', 'CX-30', 'Mazda2', 'Mazda3', 'Mazda6', 'MX-5'],
  'Other': ['Other'],
};

export const VEHICLE_BRANDS: string[] = ['Toyota', 'Honda', 'Mitsubishi', 'Nissan', 'Ford', 'Suzuki', 'Isuzu', 'Hyundai', 'Kia', 'Mazda', 'Other'];
export const TRANSMISSIONS: string[] = ['Automatic', 'Manual', 'CVT'];
export const FUEL_TYPES: string[] = ['Gasoline', 'Diesel', 'Hybrid', 'Electric'];

/** Current year back to 1980, newest first (Flutter's _buildYearList). */
export function buildYearList(): string[] {
  const current = new Date().getFullYear();
  return Array.from({ length: current - 1980 + 1 }, (_, i) => String(current - i));
}

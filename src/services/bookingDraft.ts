// In-memory state carried across the booking steps (Flutter passed these as
// constructor arguments from screen to screen).
export type BookingVehicle = {
  brand: string;
  model: string;
  year: string;
  plate: string;
  transmission: string;
  fuel: string;
  appointmentDate: string; // 'YYYY-MM-DD'
};

/** Optional preferred mechanic; null = no preference (shop assigns one). */
export type BookingMechanic = { id: number; name: string };

type Draft = { vehicle: BookingVehicle | null; notes: string; services: string[]; mechanic: BookingMechanic | null };

const EMPTY: Draft = { vehicle: null, notes: '', services: [], mechanic: null };
let draft: Draft = EMPTY;

export const bookingDraft = {
  get: (): Draft => draft,
  setDetails(vehicle: BookingVehicle, notes: string, mechanic: BookingMechanic | null = null) {
    draft = { vehicle, notes, services: [], mechanic };
  },
  setServices(services: string[]) {
    draft = { ...draft, services };
  },
  clear() {
    draft = EMPTY;
  },
};
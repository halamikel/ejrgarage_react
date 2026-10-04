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

type Draft = { vehicle: BookingVehicle | null; notes: string; services: string[] };

let draft: Draft = { vehicle: null, notes: '', services: [] };

export const bookingDraft = {
  get: (): Draft => draft,
  setDetails(vehicle: BookingVehicle, notes: string) {
    draft = { vehicle, notes, services: [] };
  },
  setServices(services: string[]) {
    draft = { ...draft, services };
  },
  clear() {
    draft = { vehicle: null, notes: '', services: [] };
  },
};

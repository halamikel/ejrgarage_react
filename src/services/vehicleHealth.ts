import AsyncStorage from '@react-native-async-storage/async-storage';

export const INSPECTION_COMPONENTS = ['Engine', 'Brakes', 'Tires', 'Battery', 'Fluids', 'Lights', 'Suspension'] as const;
export type InspectionComponent = (typeof INSPECTION_COMPONENTS)[number];
export type VehicleCondition = 'Good' | 'Needs Attention' | 'Critical';

export type InspectionResult = Record<InspectionComponent, VehicleCondition>;

export type VehicleHealthInspection = {
  id: string;
  vehicleKey: string;
  vehicleLabel: string;
  appointmentId?: string;
  mechanicName?: string;
  createdAt: string;
  results: InspectionResult;
  notes: Partial<Record<InspectionComponent, string>>;
  score: number;
  recommendations: string[];
};

const STORAGE_KEY = 'ejr_vehicle_health_inspections_v1';
const POINTS: Record<VehicleCondition, number> = { Good: 100, 'Needs Attention': 70, Critical: 40 };

const RECOMMENDATIONS: Partial<Record<InspectionComponent, Record<Exclude<VehicleCondition, 'Good'>, string>>> = {
  Engine: { 'Needs Attention': 'Engine inspection is recommended based on the latest check.', Critical: 'Prompt engine service is recommended based on the latest check.' },
  Brakes: { 'Needs Attention': 'Brake inspection or servicing is recommended.', Critical: 'Prompt brake service is recommended for safety.' },
  Tires: { 'Needs Attention': 'Tire inspection and tread check are recommended.', Critical: 'Tire replacement is recommended before regular driving.' },
  Battery: { 'Needs Attention': 'Battery testing and charging-system inspection are recommended.', Critical: 'Battery replacement or urgent electrical inspection is recommended.' },
  Fluids: { 'Needs Attention': 'Fluid inspection and top-up are recommended.', Critical: 'Prompt fluid service is recommended.' },
  Lights: { 'Needs Attention': 'Lighting inspection is recommended.', Critical: 'Prompt lighting repair is recommended for visibility and safety.' },
  Suspension: { 'Needs Attention': 'Suspension inspection is recommended.', Critical: 'Prompt suspension service is recommended.' },
};

export const defaultInspectionResults = (): InspectionResult =>
  Object.fromEntries(INSPECTION_COMPONENTS.map((component) => [component, 'Good'])) as InspectionResult;

export function scoreForResults(results: InspectionResult) {
  const total = INSPECTION_COMPONENTS.reduce((sum, component) => sum + POINTS[results[component]], 0);
  return Math.round(total / INSPECTION_COMPONENTS.length);
}

export function labelForScore(score: number) {
  if (score >= 90) return 'Excellent Condition';
  if (score >= 75) return 'Good Condition';
  if (score >= 50) return 'Needs Attention';
  return 'Critical Condition';
}

export function colorForScore(score: number) {
  if (score >= 90) return '#16803C';
  if (score >= 75) return '#1976D2';
  if (score >= 50) return '#D97706';
  return '#D32F2F';
}

export function vehicleHealthKey(vehicle: Record<string, unknown>) {
  const plate = String(vehicle.plate_number ?? vehicle.plate ?? '').replace(/[^a-z0-9]/gi, '').toUpperCase();
  if (plate) return `plate:${plate}`;
  const id = String(vehicle.id ?? vehicle.vehicle_id ?? '').trim();
  if (id) return `vehicle:${id}`;
  return `vehicle:${String(vehicle.brand ?? vehicle.vehicle_brand ?? '')}|${String(vehicle.model ?? vehicle.vehicle_model ?? '')}|${String(vehicle.year_model ?? vehicle.year ?? '')}`.toLowerCase();
}

function recommendationsFor(results: InspectionResult) {
  return INSPECTION_COMPONENTS.flatMap((component) => {
    const condition = results[component];
    return condition === 'Good' ? [] : [RECOMMENDATIONS[component]?.[condition] ?? `${component} service is recommended.`];
  });
}

// Read for display: unreadable data just shows as empty.
async function readAll(): Promise<VehicleHealthInspection[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Read for writing: throws instead of returning [] when storage is unreadable, so a
// failed/corrupt read can never lead to wiping every saved inspection.
async function readForWrite(): Promise<VehicleHealthInspection[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('Saved inspection data is corrupted.');
  return parsed;
}

// Serialize writes so two quick saves can't read the same list and drop one.
let writeQueue: Promise<unknown> = Promise.resolve();
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(task, task);
  writeQueue = run.catch(() => {});
  return run;
}

export async function getVehicleHealthHistory(vehicleKey: string) {
  const all = await readAll();
  return all.filter((inspection) => inspection.vehicleKey === vehicleKey).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveVehicleInspection(input: {
  vehicle: Record<string, unknown>;
  vehicleLabel: string;
  appointmentId?: string;
  mechanicName?: string;
  results: InspectionResult;
  notes: Partial<Record<InspectionComponent, string>>;
}) {
  const inspection: VehicleHealthInspection = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    vehicleKey: vehicleHealthKey(input.vehicle),
    vehicleLabel: input.vehicleLabel,
    appointmentId: input.appointmentId,
    mechanicName: input.mechanicName,
    createdAt: new Date().toISOString(),
    results: input.results,
    notes: Object.fromEntries(Object.entries(input.notes).filter(([, note]) => note?.trim())) as Partial<Record<InspectionComponent, string>>,
    score: scoreForResults(input.results),
    recommendations: recommendationsFor(input.results),
  };
  await enqueue(async () => {
    const all = await readForWrite();
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...all, inspection]));
  });
  return inspection;
}

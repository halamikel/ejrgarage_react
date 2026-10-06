# Vehicle Health

Vehicle Health gives a customer a simple maintenance-condition summary based on a mechanic's latest inspection. It is not a vehicle diagnosis or a replacement for a professional repair assessment.

## User flow

1. A mechanic opens an assigned job in **Bookings** and selects **Inspect**.
2. The mechanic marks each component as **Good**, **Needs Attention**, or **Critical** and may add notes for items that need attention.
3. Selecting **Submit Inspection** calculates the health score, creates maintenance recommendations, and saves an inspection record.
4. The customer opens **Home → My Vehicles**, selects a vehicle, and views the latest score, component results, notes, recommendations, and historical scores.

## Inspection components and scoring

The inspection covers Engine, Brakes, Tires, Battery, Fluids, Lights, and Suspension.

| Condition | Points |
| --- | ---: |
| Good | 100 |
| Needs Attention | 70 |
| Critical | 40 |

The score is the rounded average across all seven components. The application then displays one of the following labels:

| Score | Label |
| --- | --- |
| 90–100% | Excellent Condition |
| 75–89% | Good Condition |
| 50–74% | Needs Attention |
| Below 50% | Critical Condition |

Recommendations are generated only for components marked **Needs Attention** or **Critical**. Notes are optional and are displayed to the customer with the relevant component.

## Data storage and sync

Inspection data is persisted with the app's on-device storage under `ejr_vehicle_health_inspections_v1`. This means it remains available after the app is restarted and can be used when testing mechanic and customer roles on the same device.

The current PHP API does not expose vehicle-health endpoints, so inspections do not yet synchronize between different devices. To enable production syncing, add authenticated endpoints for saving and retrieving vehicle inspections, then replace the storage calls in `src/services/vehicleHealth.ts` with those API calls while retaining the same score and recommendation rules.

## Relevant code

- `src/services/vehicleHealth.ts` — conditions, points, score calculation, recommendation rules, and persistence.
- `src/app/(mechanic)/bookings.tsx` — mechanic inspection entry and submission.
- `src/app/my-vehicles.tsx` — customer health summary, details, and history.
- `src/services/notifications.ts` — Expo Go-safe notification loading; job polling continues without crashing Expo Go.

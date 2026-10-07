// Structured Philippine shipping address.
//
// The PHP backend (place_order.php, create_qrph_payment.php, update_profile.php)
// only stores ONE `address` string, so the five fields below are joined into a
// single line when sending (formatAddress) and best-effort split back apart when
// reading an old single-string address (parseAddress).

export type ShippingAddress = {
  line1: string;
  line2: string;
  city: string;
  province: string;
  zip: string;
};

export const EMPTY_ADDRESS: ShippingAddress = { line1: '', line2: '', city: '', province: '', zip: '' };

export const PROVINCES = [
  'Abra', 'Agusan del Norte', 'Agusan del Sur', 'Aklan', 'Albay', 'Antique', 'Apayao', 'Aurora',
  'Basilan', 'Bataan', 'Batanes', 'Batangas', 'Benguet', 'Biliran', 'Bohol', 'Bukidnon', 'Bulacan',
  'Cagayan', 'Camarines Norte', 'Camarines Sur', 'Camiguin', 'Capiz', 'Catanduanes', 'Cavite', 'Cebu', 'Cotabato',
  'Davao de Oro', 'Davao del Norte', 'Davao del Sur', 'Davao Occidental', 'Davao Oriental', 'Dinagat Islands',
  'Eastern Samar', 'Guimaras', 'Ifugao', 'Ilocos Norte', 'Ilocos Sur', 'Iloilo', 'Isabela',
  'Kalinga', 'La Union', 'Laguna', 'Lanao del Norte', 'Lanao del Sur', 'Leyte',
  'Maguindanao del Norte', 'Maguindanao del Sur', 'Marinduque', 'Masbate', 'Metro Manila',
  'Misamis Occidental', 'Misamis Oriental', 'Mountain Province',
  'Negros Occidental', 'Negros Oriental', 'Northern Samar', 'Nueva Ecija', 'Nueva Vizcaya',
  'Occidental Mindoro', 'Oriental Mindoro', 'Palawan', 'Pampanga', 'Pangasinan',
  'Quezon', 'Quirino', 'Rizal', 'Romblon', 'Samar', 'Sarangani', 'Siquijor', 'Sorsogon',
  'South Cotabato', 'Southern Leyte', 'Sultan Kudarat', 'Sulu', 'Surigao del Norte', 'Surigao del Sur',
  'Tarlac', 'Tawi-Tawi', 'Zambales', 'Zamboanga del Norte', 'Zamboanga del Sur', 'Zamboanga Sibugay',
] as const;

const PROVINCE_LOOKUP = new Map<string, string>([
  ...PROVINCES.map((p) => [p.toLowerCase(), p] as [string, string]),
  ['ncr', 'Metro Manila'],
  ['national capital region', 'Metro Manila'],
  ['manila', 'Metro Manila'],
]);

function matchProvince(raw: string): string | null {
  const key = raw.trim().toLowerCase().replace(/\s+province$/, '');
  return PROVINCE_LOOKUP.get(key) ?? null;
}

/** "Line 1, Line 2, City, Province 1234" (empty parts are skipped). */
export function formatAddress(a: ShippingAddress): string {
  const provinceZip = [a.province.trim(), a.zip.trim()].filter(Boolean).join(' ');
  return [a.line1, a.line2, a.city, provinceZip]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(', ');
}

/** Best-effort split of a legacy single-string address. Anything it can't place is left blank. */
export function parseAddress(raw: unknown): ShippingAddress {
  const parts = String(raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return { ...EMPTY_ADDRESS };

  let zip = '';
  let province = '';

  // Trailing "1234" either as its own part or glued to the last one ("Bulacan 3019").
  const last = parts[parts.length - 1];
  const zipMatch = last.match(/^(.*?)\s*(\d{4})$/);
  if (zipMatch) {
    zip = zipMatch[2];
    if (zipMatch[1]) parts[parts.length - 1] = zipMatch[1];
    else parts.pop();
  }

  if (parts.length > 0) {
    const p = matchProvince(parts[parts.length - 1]);
    if (p) {
      province = p;
      parts.pop();
    }
  }

  let city = '';
  let line1 = '';
  let line2 = '';
  if (parts.length === 1) {
    line1 = parts[0];
  } else if (parts.length >= 2) {
    city = parts[parts.length - 1];
    line1 = parts[0];
    line2 = parts.slice(1, -1).join(', ');
  }
  return { line1, line2, city, province, zip };
}

export type AddressErrors = Partial<Record<keyof ShippingAddress, string>>;

/** Line 2 is the only optional field. */
export function validateAddress(a: ShippingAddress): AddressErrors {
  const e: AddressErrors = {};
  if (a.line1.trim().length < 3) e.line1 = 'Enter your house/unit number and street';
  if (a.city.trim().length < 2) e.city = 'Enter your city or town';
  if (!a.province.trim()) e.province = 'Select your province';
  if (!/^\d{4}$/.test(a.zip.trim())) e.zip = 'Enter a 4-digit ZIP code';
  return e;
}

export function isAddressComplete(a: ShippingAddress): boolean {
  return Object.keys(validateAddress(a)).length === 0;
}

// Port of lib/services/api_service.dart.
//
// Talks to the EJR Garage PHP backend. Same auth pattern as before: the JWT
// is kept in secure storage and attached as a Bearer token to every
// authenticated request.

import { Platform } from 'react-native';
import { secureStorage } from './secureStorage';

// Responses are loosely-typed JSON from the PHP backend (the Dart code used
// Map<String, dynamic> everywhere). Tighten these per-screen as you port them.
export type Json = Record<string, any>;

export class ApiException extends Error {
  statusCode?: number;
  /** login.php's "field" key ("email" | "password") */
  field?: string;
  /** e.g. "waiting_verification.php" for unverified accounts */
  redirect?: string;

  constructor(
    message: string,
    opts: { statusCode?: number; field?: string; redirect?: string } = {},
  ) {
    super(message);
    this.name = 'ApiException';
    this.statusCode = opts.statusCode;
    this.field = opts.field;
    this.redirect = opts.redirect;
  }
}

/** A local image picked via expo-image-picker (asset.uri / fileName / mimeType). */
export type UploadFile = { uri: string; name?: string | null; type?: string | null };

const TOKEN_KEY = 'jwt_token';

// The backend issues 24h JWTs. When an authenticated call comes back 401 the
// token is dead, so clear it and let the app (see app/_layout.tsx) send the
// user back to the welcome screen instead of leaving every screen erroring.
type UnauthorizedListener = () => void;
const unauthorizedListeners = new Set<UnauthorizedListener>();
export function onUnauthorized(listener: UnauthorizedListener) {
  unauthorizedListeners.add(listener);
  return () => {
    unauthorizedListeners.delete(listener);
  };
}

// These headers mimic a modern Android browser. This is essential for
// bypassing security challenges (like TestCookie/AES) that some free hosts
// use to block mobile apps. (Same headers the Flutter app sent.)
const BASE_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'X-Requested-With': 'XMLHttpRequest',
  'Sec-Fetch-Site': 'cross-site',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Dest': 'empty',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDate(raw: unknown): string {
  if (raw == null) return '';
  // Dart's DateTime.tryParse + local getters == the literal digits; parse them
  // directly so Hermes' stricter Date parsing (and timezones) can't shift days.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(raw));
  if (!m) return String(raw);
  return `${MONTHS[Number(m[2]) - 1]} ${m[3]}, ${m[1]}`;
}

function roleNameFor(roleId: unknown): string {
  switch (parseInt(String(roleId), 10)) {
    case 2:
      return 'Admin';
    case 3:
      return 'Mechanic';
    default:
      return 'Customer';
  }
}

export function roleIdForName(role: string): number {
  switch (role) {
    case 'Admin':
      return 2;
    case 'Mechanic':
      return 3;
    default:
      return 1;
  }
}

function decode(res: Response, bodyText: string): Json {
  try {
    const parsed = JSON.parse(bodyText);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('not an object');
    }
    return parsed as Json;
  } catch {
    const snippet = bodyText.trim().replace(/\n/g, ' ');

    if (snippet.includes('aes.js') || snippet.includes('__test') || snippet.includes('toNumbers')) {
      throw new ApiException(
        'Hosting Security Block: InfinityFree is blocking the app from accessing the API. Free hosts often block mobile apps to force browser usage. \n\nFIX: Move your PHP scripts to a host that supports APIs (like Render, 000webhost, or a cheap VPS).',
        { statusCode: res.status },
      );
    }

    const preview = snippet.length > 200 ? `${snippet.slice(0, 200)}…` : snippet;
    throw new ApiException(`Unexpected server response (HTTP ${res.status}): ${preview}`, {
      statusCode: res.status,
    });
  }
}

async function readJson(res: Response): Promise<Json> {
  return decode(res, await res.text());
}

/**
 * fetch() with a timeout and readable errors.
 *
 * The backend is on Render, which puts idle services to sleep; the first
 * request after that can take 30-60s, so the timeout is generous. Network
 * failures (offline, DNS, server down, or on web builds a CORS block) all
 * surface from fetch() as an opaque TypeError, so log the real cause and throw
 * an ApiException the UI can show instead of a generic message.
 */
const REQUEST_TIMEOUT_MS = 60_000;

async function netFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (e) {
    const timedOut = ctrl.signal.aborted;
    console.warn(`[api] ${init.method ?? 'GET'} ${url} failed${timedOut ? ' (timed out)' : ''}:`, e);
    throw new ApiException(
      timedOut
        ? 'The server is taking too long to respond. It may be waking up - please try again in a moment.'
        : 'Cannot reach the server. Check your internet connection and try again. (On a web build this can also be a CORS block - see the browser console.)',
    );
  } finally {
    clearTimeout(timer);
  }
}

class ApiService {
  /** Override at build time with EXPO_PUBLIC_API_BASE_URL (must end with "/"). */
  static readonly baseUrl: string =
    process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://ejrgarage.onrender.com/api/';

  // ── Token storage ───────────────────────────────────────────
  private saveToken(token: string) {
    return secureStorage.setItem(TOKEN_KEY, token);
  }
  getToken() {
    return secureStorage.getItem(TOKEN_KEY);
  }
  clearToken() {
    return secureStorage.deleteItem(TOKEN_KEY);
  }
  async isLoggedIn() {
    return (await this.getToken()) != null;
  }
  private async expireSession() {
    await this.clearToken();
    unauthorizedListeners.forEach((l) => l());
  }

  // ── Low-level helpers ───────────────────────────────────────
  private async authedFetch(endpoint: string, init: { method: 'GET' | 'POST'; body?: unknown }) {
    const token = await this.getToken();
    if (token == null) throw new ApiException('Not logged in.', { statusCode: 401 });

    const headers: Record<string, string> = { ...BASE_HEADERS, Authorization: `Bearer ${token}` };
    if (init.method === 'POST') headers['Content-Type'] = 'application/json';

    const res = await netFetch(`${ApiService.baseUrl}${endpoint}`, {
      method: init.method,
      headers,
      body: init.method === 'POST' ? JSON.stringify(init.body ?? {}) : undefined,
    });
    return this.handleAuthedResponse(res);
  }

  private async handleAuthedResponse(res: Response): Promise<Json> {
    const body = await readJson(res);
    if (res.status === 401) {
      await this.expireSession();
      throw new ApiException(body.message ?? 'Session expired. Please log in again.', {
        statusCode: 401,
      });
    }
    if (body.status === 'error') {
      throw new ApiException(body.message ?? 'Request failed.', { statusCode: res.status });
    }
    return body;
  }

  /** Public POST (no token) used by login/register/forgot/reset. */
  private async publicPost(endpoint: string, data: unknown): Promise<{ res: Response; body: Json }> {
    const res = await netFetch(`${ApiService.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { ...BASE_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return { res, body: await readJson(res) };
  }

  /** Public GET (no token) — e.g. get_services.php, get_parts.php. */
  async getPublic(endpoint: string): Promise<Json> {
    const res = await netFetch(`${ApiService.baseUrl}${endpoint}`, { headers: BASE_HEADERS });
    const body = await readJson(res);
    if (body.status === 'error') {
      throw new ApiException(body.message ?? 'Request failed.', { statusCode: res.status });
    }
    return body;
  }

  /**
   * Authenticated GET for background checks. Unlike get(), a 401 here never
   * clears the token / logs the user out — it just throws, and the caller retries later.
   */
  async getQuiet(endpoint: string): Promise<Json> {
    const token = await this.getToken();
    if (token == null) throw new ApiException('Not logged in.', { statusCode: 401 });
    const res = await netFetch(`${ApiService.baseUrl}${endpoint}`, {
      method: 'GET',
      headers: { ...BASE_HEADERS, Authorization: `Bearer ${token}` },
    });
    const body = await readJson(res);
    if (res.status === 401 || body.status === 'error') {
      throw new ApiException(body.message ?? 'Request failed.', { statusCode: res.status });
    }
    return body;
  }

  /** Authenticated GET for every other endpoint. */
  get(endpoint: string): Promise<Json> {
    return this.authedFetch(endpoint, { method: 'GET' });
  }

  /** Authenticated POST (JSON body). */
  post(endpoint: string, data: Json = {}): Promise<Json> {
    return this.authedFetch(endpoint, { method: 'POST', body: data });
  }

  /** Multipart upload. Don't set Content-Type — fetch adds the boundary. */
  private async upload(endpoint: string, field: string, file: UploadFile): Promise<Json> {
    const token = await this.getToken();
    if (token == null) throw new ApiException('Not logged in.', { statusCode: 401 });

    const form = new FormData();
    const name = file.name || file.uri.split('/').pop() || `${field}.jpg`;
    if (Platform.OS === 'web') {
      // Browser FormData needs a real Blob; the { uri } shorthand is RN-only.
      const blob = await (await fetch(file.uri)).blob();
      form.append(field, blob, name);
    } else {
      // React Native's FormData accepts { uri, name, type } for file parts.
      form.append(field, { uri: file.uri, name, type: file.type || 'image/jpeg' } as any);
    }

    const res = await netFetch(`${ApiService.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });

    let data: Json;
    try {
      data = JSON.parse(await res.text());
    } catch {
      throw new ApiException(`Unexpected server response (HTTP ${res.status}).`, {
        statusCode: res.status,
      });
    }
    if (res.status === 401) await this.expireSession();
    if (data.status !== 'success') {
      throw new ApiException(data.message ?? 'Could not upload photo.', { statusCode: res.status });
    }
    return data;
  }

  // ── Auth ────────────────────────────────────────────────────
  /** Returns the "user" object from login.php (id, name, full_name, email, role_id, ...). */
  async login(email: string, password: string): Promise<Json> {
    const { res, body } = await this.publicPost('login.php', { email, password });
    if (body.status === 'success') {
      await this.saveToken(body.token as string);
      return body.user as Json;
    }
    throw new ApiException(body.message ?? 'Login failed.', {
      statusCode: res.status,
      field: body.field,
      redirect: body.redirect,
    });
  }

  logout() {
    return this.clearToken();
  }

  /** Always "succeeds" server-side (doesn't leak which emails exist); emails a reset LINK. */
  async forgotPassword(email: string): Promise<void> {
    const { res, body } = await this.publicPost('forgot_password.php', { email });
    if (body.status !== 'success') {
      throw new ApiException(body.message ?? 'Something went wrong. Please try again.', {
        statusCode: res.status,
      });
    }
  }

  /** Token comes from the deep-linked reset-password.php URL. */
  async resetPassword(args: { token: string; newPassword: string }): Promise<void> {
    const { res, body } = await this.publicPost('update-password.php', {
      token: args.token,
      password: args.newPassword,
    });
    if (body.status !== 'success') {
      throw new ApiException(body.message ?? 'Something went wrong. Please try again.', {
        statusCode: res.status,
      });
    }
  }

  /** Creates an unverified account and emails a verification LINK. Does not log in. */
  async register(args: {
    name: string;
    email: string;
    phone: string;
    password: string;
  }): Promise<void> {
    const { res, body } = await this.publicPost('register.php', args);
    if (body.status !== 'success') {
      throw new ApiException(body.message ?? 'Registration failed.', { statusCode: res.status });
    }
  }

  // ── Live chat (routed through check_session.php's "type" dispatcher) ──
  getChatMessages() {
    return this.post('check_session.php', { type: 'get_messages' });
  }
  /** action: 'chat' | 'request_live' | 'cancel_live_request' */
  sendChatMessage(message: string, action: 'chat' | 'request_live' | 'cancel_live_request' = 'chat') {
    return this.post('check_session.php', { type: 'chat', action, message });
  }
  /** Ends a LIVE session and wipes the conversation history server-side. */
  endChatSession() {
    return this.post('check_session.php', { type: 'end_session' });
  }

  // ── Profile ─────────────────────────────────────────────────
  getProfile() {
    return this.get('get_profile.php');
  }
  updateProfile(a: { fullName: string; email: string; phone: string; address: string }) {
    return this.post('update_profile.php', {
      full_name: a.fullName,
      email: a.email,
      phone: a.phone,
      address: a.address,
    });
  }
  uploadAvatar(file: UploadFile) {
    return this.upload('upload_avatar.php', 'avatar', file);
  }
  removeAvatar() {
    return this.post('remove_avatar.php', {});
  }
  saveNotificationPreferences(a: { notifEmail: boolean; notifSms: boolean }) {
    return this.post('save_notifications.php', {
      notif_email: a.notifEmail ? 1 : 0,
      notif_sms: a.notifSms ? 1 : 0,
    });
  }
  async changePassword(a: { currentPassword: string; newPassword: string; confirmPassword: string }) {
    const res = await this.post('change_password.php', {
      current_password: a.currentPassword,
      new_password: a.newPassword,
      confirm_password: a.confirmPassword,
    });
    if (res.status !== 'success') {
      throw new ApiException(res.message ?? 'Could not change password.');
    }
  }

  // ── Parts catalog / inquiries / orders ──────────────────────
  getParts(a: { search?: string; category?: string } = {}) {
    const q = `search=${encodeURIComponent(a.search ?? '')}&category=${encodeURIComponent(a.category ?? '')}`;
    return this.getPublic(`get_parts.php?${q}`);
  }
  async submitPartInquiry(a: { partId: number; customerName: string; contact: string; message?: string }) {
    const res = await this.post('submit_inquiry.php', {
      part_id: a.partId,
      customer_name: a.customerName,
      contact: a.contact,
      message: a.message ?? '',
    });
    if (res.status !== 'success') {
      throw new ApiException(res.message ?? 'Could not submit inquiry.');
    }
  }
  /** items: [{ id, name, price, qty }]. Returns { checkout_url } for online payments, null for 'cod'. */
  placeOrder(a: {
    customerName: string;
    contact: string;
    address: string;
    items: Json[];
    totalPrice: number;
    /** The Flutter cart sends 'online' | 'cod' (online => PayMongo checkout_url). */
    paymentMethod: 'online' | 'card' | 'cod';
  }) {
    return this.post('place_order.php', {
      customer_name: a.customerName,
      contact: a.contact,
      address: a.address,
      items: a.items,
      total_price: a.totalPrice,
      payment_method: a.paymentMethod,
    });
  }
  getMyOrders() {
    return this.get('get_my_orders.php');
  }
  cancelOrder(orderId: number) {
    return this.post('cancel_order.php', { id: orderId });
  }
  createQrphPayment(a: { customerName: string; contact: string; address: string; items: Json[]; totalPrice: number }) {
    return this.post('create_qrph_payment.php', {
      customer_name: a.customerName,
      contact: a.contact,
      address: a.address,
      items: a.items,
      total_price: a.totalPrice,
    });
  }
  checkQrphStatus(orderId: number) {
    return this.get(`check_qrph_status.php?order_id=${orderId}`);
  }
  regenerateQrphPayment(orderId: number) {
    return this.post('regenerate_qrph_payment.php', { order_id: orderId });
  }
  getMyInquiries() {
    return this.get('get_inquiries.php');
  }
  getRewards() {
    return this.get('get_rewards.php');
  }
  getMyVouchers() {
    return this.get('get_my_vouchers.php');
  }
  getPointsHistory() {
    return this.get('get_points_history.php');
  }
  claimReward(rewardId: number) {
    return this.post('claim_reward.php', { reward_id: rewardId });
  }

  // ── Vehicles & bookings (customer) ──────────────────────────
  getBusyDates() {
    return this.getPublic('get_busy_dates.php');
  }
  getVehicles() {
    return this.get('get_vehicles.php');
  }
  addVehicle(a: { brand: string; model: string; year: string; plate: string; transmission: string; fuel: string }) {
    return this.post('add_vehicle.php', a);
  }
  removeVehicle(vehicleId: number) {
    return this.post('remove_vehicle.php', { id: vehicleId });
  }
  updateVehicle(a: {
    id: number;
    brand: string;
    model: string;
    year: string;
    plate: string;
    transmission: string;
    fuel: string;
  }) {
    return this.post('update_vehicle.php', a);
  }
  cancelAppointment(appointmentId: number) {
    return this.post('cancel_appointment.php', { id: appointmentId });
  }
  submitFeedback(data: { appointment_id: number; rating: number; comment?: string }) {
    return this.post('submit_feedback.php', data);
  }
  /**
   * Mechanics a customer can pick when booking. Each row: id, name, specialty,
   * status, profile_picture?, avg_rating (number|null), rating_count (number).
   * See docs/MECHANIC_SELECTION.md for the PHP endpoint this expects.
   */
  getMechanics() {
    return this.get('get_mechanics.php');
  }
  submitBooking(a: { services: string[]; vehicle: Record<string, string>; mechanicId?: number | null }) {
    const body: Json = { services: a.services, vehicle: a.vehicle };
    // Optional: omitted entirely when the customer has no preference.
    if (a.mechanicId != null) body.mechanic_id = a.mechanicId;
    return this.post('save_booking.php', body);
  }

  // ── Mechanic ────────────────────────────────────────────────
  getMechanicJobs() {
    return this.get('get_mechanic_jobs.php');
  }
  updateJobStatus(jobId: number, status: string) {
    return this.post('update_job_status.php', { job_id: jobId, status });
  }
  updateMechanicAvailability(status: string) {
    return this.post('update_availability.php', { status });
  }
  getCustomerHistory(customerUserId: number) {
    return this.get(`get_customer_history.php?user_id=${customerUserId}`);
  }
  getEmployees() {
    return this.get('get_employees.php');
  }
  getMyLeaveRequests() {
    return this.get('get_my_leave_requests.php');
  }
  /** Dates are 'YYYY-MM-DD'. */
  submitLeaveRequest(a: { startDate: string; endDate: string; reason?: string }) {
    return this.post('submit_leave_request.php', {
      start_date: a.startDate,
      end_date: a.endDate,
      reason: a.reason ?? '',
    });
  }

  // ── Admin ───────────────────────────────────────────────────
  getAdminDashboardStats() {
    return this.get('admin/dashboard_stats.php');
  }
  getAdminDrawerCounts() {
    return this.get('admin/drawer_counts.php');
  }

  getAdminBusyDates() {
    return this.get('admin/manage_busy_dates.php');
  }
  blockBusyDate(a: { date: string; limit?: number }) {
    return this.post('admin/manage_busy_dates.php', { action: 'block', date: a.date, limit: a.limit ?? 5 });
  }
  deleteBusyDate(id: number) {
    return this.post('admin/manage_busy_dates.php', { action: 'delete', id });
  }

  getAdminChatUsers() {
    return this.get('admin/get_chat_users.php');
  }
  getAdminChatMessages(userId: number) {
    return this.get(`admin/get_messages.php?user_id=${userId}`);
  }
  sendAdminChatMessage(userId: number, message: string) {
    return this.post('admin/send_message.php', { user_id: userId, message });
  }
  respondToLiveRequest(userId: number, action: string) {
    return this.post('admin/accept_session.php', { user_id: userId, action });
  }
  endAdminChatSession(userId: number) {
    return this.post('admin/end_session.php', { user_id: userId });
  }

  /** Reshapes admin/get_full_site_data.php's appointments into the UI's row format. */
  async getAdminAppointments(): Promise<Json> {
    const res = await this.get('admin/get_full_site_data.php');
    const raw: Json[] = res.appointments ?? [];
    const appointments = raw.map((row) => ({
      id: row.id,
      customer: row.full_name ?? 'Unknown',
      service: row.service_type ?? '',
      vehicle: row.vehicle_info ?? '',
      date: row.appointment_date ?? '',
      mechanic: row.mechanic_name ?? 'Unassigned',
      mechanic_id: row.mechanic_id,
      status: row.status ?? 'Pending',
      notes: row.notes ?? '',
      cancellation_reply: row.cancellation_reply ?? '',
    }));
    return { status: res.status, appointments };
  }

  getAdminMechanics() {
    return this.get('admin/manage_mechanics.php');
  }
  addMechanic(a: { name: string; specialty: string }) {
    return this.post('admin/manage_mechanics.php', { action: 'add', ...a });
  }
  updateMechanic(a: { id: number; name: string; specialty: string; isAvailable?: boolean; status?: string }) {
    return this.post('admin/manage_mechanics.php', {
      action: 'update',
      id: a.id,
      name: a.name,
      specialty: a.specialty,
      status: a.status ?? (a.isAvailable ? 'available' : 'unavailable'),
    });
  }
  deleteMechanic(id: number) {
    return this.post('admin/manage_mechanics.php', { action: 'delete', id });
  }

  /** action: 'update_status' | 'assign_mechanic' | 'delete' */
  manageAppointment(a: { appointmentId: number; action: string; extra?: Json }) {
    const extra = a.extra ?? {};
    switch (a.action) {
      case 'update_status': {
        const body: Json = { appointment_id: a.appointmentId, status: extra.status };
        if (extra.status === 'Cancelled' && String(extra.cancellation_reply ?? '').length > 0) {
          body.cancellation_reply = extra.cancellation_reply;
        }
        return this.post('admin/update_appointment.php', body);
      }
      case 'assign_mechanic':
        return this.post('admin/manage_mechanics.php', {
          action: 'assign',
          appointment_id: a.appointmentId,
          mechanic_id: extra.mechanic_id,
        });
      case 'delete':
        return this.post('admin/update_appointment.php', { appointment_id: a.appointmentId, action: 'delete' });
      default:
        throw new ApiException(`Unknown appointment action: ${a.action}`);
    }
  }

  async getAdminUsers(): Promise<Json> {
    const res = await this.get('admin/get_full_site_data.php');
    const raw: Json[] = res.users ?? [];
    const users = raw.map((row) => ({
      id: row.id,
      name: row.full_name ?? 'Unknown',
      email: row.email ?? '',
      phone: row.phone ?? '',
      role: roleNameFor(row.role_id),
      joined: formatDate(row.created_at),
    }));
    return { status: res.status, users };
  }

  /** manage_user.php's update_info needs the whole record, so fetch it first. */
  async changeUserRole(userId: number, newRole: string): Promise<Json> {
    const detail = await this.get(`admin/manage_user.php?id=${userId}`);
    if (detail.status !== 'success' || detail.data == null) {
      throw new ApiException(detail.message ?? 'Could not load user.');
    }
    const u = detail.data as Json;
    return this.post('admin/manage_user.php', {
      action: 'update_info',
      user_id: userId,
      full_name: u.full_name,
      email: u.email,
      role_id: roleIdForName(newRole),
      is_verified: u.is_verified,
      is_phone_verified: u.is_phone_verified,
    });
  }
  deleteUser(userId: number) {
    return this.post('admin/manage_user.php', { action: 'delete', user_id: userId });
  }

  async getAdminVehicles(): Promise<Json> {
    const res = await this.get('admin/manage_vehicles.php');
    const raw: Json[] = res.vehicles ?? [];
    const vehicles = raw.map((row) => ({
      id: row.id,
      owner: row.owner_name ?? 'Unknown',
      brand: row.brand ?? '',
      model: row.model ?? '',
      year: row.year_model ?? '',
      plate: row.plate_number ?? '',
      fuel: row.fuel_type ?? '',
      transmission: row.transmission ?? '',
    }));
    return { status: res.status, vehicles };
  }
  deleteVehicle(vehicleId: number) {
    return this.post('admin/manage_vehicles.php', { action: 'delete', id: vehicleId });
  }

  async getAdminServiceHistory(): Promise<Json> {
    const res = await this.get('admin/get_service_history.php');
    const raw: Json[] = res.history ?? [];
    const history = raw.map((row) => {
      const brand = String(row.brand ?? '').trim();
      const model = String(row.model ?? '').trim();
      const vehicle = [brand, model].filter((s) => s.length > 0).join(' ');
      return {
        id: row.id,
        customer: row.full_name ?? 'Unknown',
        service: row.service_type ?? '',
        vehicle: vehicle.length === 0 ? 'N/A' : vehicle,
        plate: row.plate_number ?? '',
        date: formatDate(row.service_date),
        mechanic: row.mechanic_name ?? 'Unassigned',
        status: 'Completed',
      };
    });
    return { status: res.status, history };
  }
  deleteServiceHistory(recordId: number) {
    return this.post('admin/get_service_history.php', { action: 'delete', id: recordId });
  }

  getAdminParts() {
    return this.get('admin/manage_parts.php');
  }
  uploadPartImage(file: UploadFile) {
    return this.upload('admin/upload_part_image.php', 'image', file);
  }
  addPart(a: {
    name: string;
    category: string;
    price: number;
    stock: number;
    brand?: string;
    description?: string;
    imageUrl?: string;
  }) {
    return this.post('admin/manage_parts.php', {
      action: 'add',
      name: a.name,
      brand: a.brand ?? '',
      description: a.description ?? '',
      category: a.category,
      image_url: a.imageUrl ?? '',
      price: a.price,
      stock: a.stock,
    });
  }
  editPart(a: {
    id: number;
    name: string;
    category: string;
    price: number;
    stock: number;
    brand?: string;
    description?: string;
    imageUrl?: string;
  }) {
    return this.post('admin/manage_parts.php', {
      action: 'edit',
      id: a.id,
      name: a.name,
      brand: a.brand ?? '',
      description: a.description ?? '',
      category: a.category,
      image_url: a.imageUrl ?? '',
      price: a.price,
      stock: a.stock,
    });
  }
  deletePart(id: number) {
    return this.post('admin/manage_parts.php', { action: 'delete', id });
  }

  getAdminPartInquiries() {
    return this.get('admin/manage_parts.php?action=get_inquiries');
  }
  /** action: 'reply' | 'delete' */
  managePartInquiry(a: { inquiryId: number; action: string; extra?: Json }) {
    switch (a.action) {
      case 'reply':
        return this.post('admin/manage_parts.php', {
          action: 'update_inquiry',
          id: a.inquiryId,
          status: 'responded',
          reply_message: a.extra?.reply_message,
        });
      case 'delete':
        return this.post('admin/manage_parts.php', { action: 'delete_inquiry', id: a.inquiryId });
      default:
        throw new ApiException(`Unknown inquiry action: ${a.action}`);
    }
  }

  getAdminOrders() {
    return this.get('admin/manage_orders.php');
  }
  /** action: 'update_status' | 'delete' | 'send_receipt' */
  manageOrder(a: { orderId: number; action: string; extra?: Json }) {
    switch (a.action) {
      case 'update_status': {
        const body: Json = { action: 'update_status', id: a.orderId, status: a.extra?.status };
        if (a.extra?.status === 'cancelled' && String(a.extra?.cancellation_reply ?? '').length > 0) {
          body.cancellation_reply = a.extra?.cancellation_reply;
        }
        return this.post('admin/manage_orders.php', body);
      }
      case 'delete':
        return this.post('admin/manage_orders.php', { action: 'delete', id: a.orderId });
      case 'send_receipt':
        return this.post('admin/manage_orders.php', { action: 'send_receipt', id: a.orderId });
      default:
        throw new ApiException(`Unknown order action: ${a.action}`);
    }
  }

  getAdminServices() {
    return this.get('admin/manage_services.php');
  }
  addService(a: { name: string; category: string; description?: string; priceFrom?: number }) {
    return this.post('admin/manage_services.php', {
      action: 'add',
      name: a.name,
      category: a.category,
      description: a.description ?? '',
      price_from: a.priceFrom ?? 0,
    });
  }
  updateService(a: {
    id: number;
    name: string;
    category: string;
    isActive: boolean;
    description?: string;
    priceFrom?: number;
  }) {
    return this.post('admin/manage_services.php', {
      action: 'update',
      id: a.id,
      name: a.name,
      category: a.category,
      description: a.description ?? '',
      price_from: a.priceFrom ?? 0,
      is_active: a.isActive ? 1 : 0,
    });
  }
  deleteService(id: number) {
    return this.post('admin/manage_services.php', { action: 'delete', id });
  }
  toggleService(a: { id: number; isActive: boolean }) {
    return this.post('admin/manage_services.php', { action: 'toggle', id: a.id, is_active: a.isActive ? 1 : 0 });
  }
}

export const api = new ApiService();
export { ApiService };

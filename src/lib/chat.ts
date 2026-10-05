// Shared helpers for the customer and admin live-chat screens.
//
// The PHP endpoints return loosely-typed JSON, so ALL assumptions about field
// names live here. If a screen shows blank text or the wrong side of the
// conversation, this is the only file that needs adjusting.
import type { Json } from '@/services/api';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

export type ChatAuthor = 'customer' | 'admin' | 'bot';
/** bot = automated assistant, pending = waiting for staff, live = talking to staff */
export type ChatMode = 'bot' | 'pending' | 'live';

export type ChatMessage = {
  id: string;
  author: ChatAuthor;
  text: string;
  createdAt: string | null;
};

export type ChatUser = {
  id: number;
  name: string;
  lastMessage: string;
  lastAt: string | null;
  unread: number;
  mode: ChatMode;
};

/** `action` values sent to admin/accept_session.php. Confirm against the backend. */
export const LIVE_ACTION = { accept: 'accept', decline: 'decline' } as const;

const truthy = (v: unknown) => v === true || v === 1 || v === '1';

function authorOf(m: Json): ChatAuthor {
  if (truthy(m.is_admin)) return 'admin';
  const raw = String(m.sender ?? m.sender_type ?? m.sender_role ?? m.role ?? m.from ?? '')
    .trim()
    .toLowerCase();
  if (/admin|agent|staff|mechanic|support/.test(raw)) return 'admin';
  if (/^(bot|ai|assistant|system)$/.test(raw)) return 'bot';
  return 'customer';
}

export function normalizeMessages(res: Json): ChatMessage[] {
  const raw = res.messages ?? res.data ?? res.history ?? [];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((m: Json, i: number): ChatMessage => {
      const createdAt = (m.created_at ?? m.timestamp ?? m.time ?? null) as string | null;
      return {
        id: String(m.id ?? m.message_id ?? `${createdAt ?? 'm'}-${i}`),
        author: authorOf(m),
        text: String(m.message ?? m.text ?? m.content ?? m.body ?? ''),
        createdAt,
      };
    })
    .filter((m) => m.text.trim().length > 0);
}

export function chatModeOf(res: Json): ChatMode {
  if (truthy(res.is_live)) return 'live';
  const raw = String(res.mode ?? res.chat_mode ?? res.session_status ?? res.live_status ?? res.request_status ?? '')
    .trim()
    .toLowerCase();
  if (/^(live|active|accepted)$/.test(raw)) return 'live';
  if (/^(pending|waiting|requested)$/.test(raw)) return 'pending';
  return 'bot';
}

export function normalizeChatUsers(res: Json): ChatUser[] {
  const raw = res.users ?? res.chats ?? res.data ?? [];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((u: Json): ChatUser => ({
      id: Number(u.id ?? u.user_id),
      name: String(u.full_name ?? u.name ?? 'Customer'),
      lastMessage: String(u.last_message ?? u.message ?? ''),
      lastAt: (u.last_message_at ?? u.last_activity ?? u.updated_at ?? null) as string | null,
      unread: Number(u.unread_count ?? u.unread ?? 0) || 0,
      mode: chatModeOf(u),
    }))
    .filter((u) => Number.isFinite(u.id))
    .sort((a, b) => {
      const rank = (u: ChatUser) => (u.mode === 'pending' ? 0 : u.unread > 0 ? 1 : u.mode === 'live' ? 2 : 3);
      return rank(a) - rank(b) || (b.lastAt ?? '').localeCompare(a.lastAt ?? '');
    });
}

// ── Time formatting (same "YYYY-MM-DD HH:MM" parsing as lib/format.ts) ──
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/;

/** "3:05 PM" */
export function formatChatTime(raw: string | null): string {
  const m = raw ? DATE_RE.exec(raw) : null;
  if (!m || !m[4]) return '';
  const h = Number(m[4]);
  return `${h % 12 === 0 ? 12 : h % 12}:${m[5]} ${h >= 12 ? 'PM' : 'AM'}`;
}

/** "Oct 5, 2026" — used for day separators. */
export function formatChatDay(raw: string | null): string | null {
  const m = raw ? DATE_RE.exec(raw) : null;
  return m ? `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}` : null;
}

/**
 * Runs `task` now and then every `intervalMs` AFTER the previous run finishes
 * (so slow networks never stack up requests). Pauses while the app is in the
 * background and refreshes immediately when it returns to the foreground.
 */
export function usePolling(task: () => Promise<void>, intervalMs: number, enabled = true) {
  const taskRef = useRef(task);
  taskRef.current = task;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let inFlight = false;
    let active = AppState.currentState === 'active';
    let timer: ReturnType<typeof setTimeout> | null = null;

    const clear = () => {
      if (timer) clearTimeout(timer);
      timer = null;
    };

    const run = async () => {
      if (cancelled || inFlight || !active) return;
      inFlight = true;
      try {
        await taskRef.current();
      } catch {
        // the task reports its own errors; keep polling
      } finally {
        inFlight = false;
      }
      if (!cancelled && active) {
        clear();
        timer = setTimeout(run, intervalMs);
      }
    };

    const sub = AppState.addEventListener('change', (state) => {
      const nowActive = state === 'active';
      if (nowActive === active) return;
      active = nowActive;
      clear();
      if (nowActive) run();
    });

    run();
    return () => {
      cancelled = true;
      clear();
      sub.remove();
    };
  }, [intervalMs, enabled]);
}

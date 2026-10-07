import { useToast } from '@/components/Toast';
import { confirm } from '@/lib/dialogs';
import { ApiException, api, type Json } from '@/services/api';
import { refreshPoints, useUserSession, userSession } from '@/services/session';
import { colors, fonts, text } from '@/theme/theme';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Vouchers are valid for 30 days from the day they are claimed.
const VOUCHER_VALID_DAYS = 30;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseDbDate(raw: unknown): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(String(raw ?? ''));
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0));
}

/** Server's expires_at if present, otherwise claim date + 30 days. */
function voucherExpiry(v: Json): Date | null {
  const exp = parseDbDate(v.expires_at);
  if (exp) return exp;
  const claimed = parseDbDate(v.claimed_at ?? v.created_at);
  if (!claimed) return null;
  claimed.setDate(claimed.getDate() + VOUCHER_VALID_DAYS);
  return claimed;
}

function voucherState(v: Json): { label: string; usable: boolean } {
  if (v.used_at || v.is_used === 1 || v.is_used === '1' || String(v.status).toLowerCase() === 'used') {
    return { label: 'Used', usable: false };
  }
  const exp = voucherExpiry(v);
  if (!exp) return { label: 'Active', usable: true };
  const msLeft = exp.getTime() - Date.now();
  if (msLeft <= 0) return { label: 'Expired', usable: false };
  const days = Math.ceil(msLeft / 86_400_000);
  return { label: days === 1 ? '1 day left' : `${days} days left`, usable: true };
}

function formatDate(d: Date | null) {
  return d ? `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}` : '';
}

export default function RewardsScreen() {
  const toast = useToast();
  const { session } = useUserSession();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rewards, setRewards] = useState<Json[]>([]);
  const [vouchers, setVouchers] = useState<Json[]>([]);
  const [claiming, setClaiming] = useState<number | null>(null);
  // Synchronous guard: state updates are async, so a fast double-tap could fire two claims.
  const claimLock = useRef(false);
  const [activeTab, setActiveTab] = useState<'available' | 'my'>('available');

  const load = useCallback(async (pull = false) => {
    if (pull) setRefreshing(true);
    else setLoading(true);
    // Load each piece independently: a failure in the rewards/vouchers endpoints
    // must not stop the points balance (from get_profile.php) from refreshing.
    const [res, profileRes, vouchersRes] = await Promise.allSettled([
      api.getRewards(),
      api.getProfile(),
      api.getMyVouchers(),
    ]);
    try {
      if (profileRes.status === 'fulfilled' && profileRes.value.user) userSession.setUser(profileRes.value.user);
      if (res.status === 'fulfilled') setRewards((res.value.rewards as Json[]) ?? []);
      if (vouchersRes.status === 'fulfilled') setVouchers((vouchersRes.value.vouchers as Json[]) ?? []);
      const failed = [res, profileRes, vouchersRes].find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
      if (failed) {
        console.error(failed.reason);
        toast(failed.reason instanceof Error ? failed.reason.message : 'Could not load rewards.', 'error');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function copyToClipboard(code: string) {
    await Clipboard.setStringAsync(code);
    toast('Code copied to clipboard!', 'success');
  }

  async function handleClaim(reward: Json) {
    if (claimLock.current) return;

    const rewardId = Number(reward.id);
    const points = Number(reward.points_required);
    if (!Number.isFinite(rewardId) || !Number.isFinite(points)) {
      toast('This reward is unavailable. Pull down to refresh.', 'error');
      return;
    }
    if (session.points < points) {
      toast(`You need ${points - session.points} more points to claim this.`, 'error');
      return;
    }

    claimLock.current = true;
    try {
      const ok = await confirm(
        'Redeem Points?',
        `Use ${points} EJR points to claim "${reward.title}"?`,
        { confirmText: 'Redeem Now' },
      );
      if (!ok) return;

      setClaiming(rewardId);
      let claimed = false;
      try {
        const res = await api.claimReward(rewardId);
        // The API wrapper only throws on status === 'error'; treat any other
        // non-success status (or success: false) as a failed claim too.
        if ((res.status && res.status !== 'success') || res.success === false) {
          throw new ApiException(res.message ?? 'Failed to redeem points.');
        }
        claimed = true;

        // Update the balance right away from the response if the server sends it,
        // otherwise deduct locally; the refresh below then confirms the real value.
        const serverBalance = res.points ?? res.new_balance ?? res.balance ?? res.user?.points;
        if (userSession.user) {
          const next = serverBalance != null ? Number(serverBalance) : Math.max(0, session.points - points);
          userSession.setUser({ ...userSession.user, points: next });
        }
        const code = res.code ?? res.voucher?.code ?? res.voucher_code;
        toast(code ? `Voucher claimed! Your code: ${code}` : res.message || 'Voucher claimed successfully!', 'success');
      } catch (e) {
        toast(e instanceof ApiException ? e.message : 'Failed to redeem points.', 'error');
      }

      if (claimed) {
        // Refresh without the full-screen spinner, and never let a refresh
        // failure make a successful claim look like it failed.
        await Promise.allSettled([
          refreshPoints(),
          api.getMyVouchers().then((r) => setVouchers((r.vouchers as Json[]) ?? [])),
          api.getRewards().then((r) => setRewards((r.rewards as Json[]) ?? [])),
        ]);
        setActiveTab('my');
      }
    } finally {
      setClaiming(null);
      claimLock.current = false;
    }
  }

  if (loading && !refreshing) {
    return <ActivityIndicator color={colors.primary} style={{ flex: 1 }} />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }} edges={[]}>
      <View style={styles.header}>
        <View style={styles.pointsCard}>
          <Text style={styles.pointsLabel}>Your Balance</Text>
          <View style={styles.pointsRow}>
            <Ionicons name="star" size={24} color={colors.white} />
            <Text style={styles.pointsValue}>{session.points} pts</Text>
          </View>
          <Text style={styles.pointsSubtext}>Earn 1 EJR point for every ₱200 spent</Text>
          <Pressable onPress={() => router.push('/points-history')} style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ color: colors.white, fontFamily: fonts.bold, fontSize: 13 }}>View points history</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.white} />
          </Pressable>
        </View>

        <View style={styles.tabs}>
          <Pressable
            onPress={() => setActiveTab('available')}
            style={[styles.tab, activeTab === 'available' && styles.activeTab]}
          >
            <Text style={[styles.tabText, activeTab === 'available' && styles.activeTabText]}>Available</Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab('my')}
            style={[styles.tab, activeTab === 'my' && styles.activeTab]}
          >
            <Text style={[styles.tabText, activeTab === 'my' && styles.activeTabText]}>My Vouchers</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={activeTab === 'available' ? rewards : vouchers}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
        ListHeaderComponent={
          activeTab === 'available' ? (
            <View style={{ marginBottom: 20 }}>
              <Text style={[text.headingSmall, { marginBottom: 12 }]}>Earning EJR Points</Text>
              <View style={styles.benefitItem}>
                <View style={styles.benefitIcon}>
                  <Ionicons name="calendar" size={16} color={colors.primary} />
                </View>
                <Text style={styles.benefitText}>50 pts for every completed appointment</Text>
              </View>
              <View style={styles.benefitItem}>
                <View style={styles.benefitIcon}>
                  <Ionicons name="cart" size={16} color={colors.primary} />
                </View>
                <Text style={styles.benefitText}>1 pt for every ₱200 spent on parts</Text>
              </View>
              <View style={styles.benefitItem}>
                <View style={styles.benefitIcon}>
                  <Ionicons name="star" size={16} color={colors.primary} />
                </View>
                <Text style={styles.benefitText}>10 pts for every service review</Text>
              </View>

              <Text style={[text.headingSmall, { marginTop: 24, marginBottom: 16 }]}>Redeem EJR Points</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          if (activeTab === 'my') {
            const state = voucherState(item);
            return (
              <View style={[styles.rewardCard, !state.usable && styles.rewardCardLocked]}>
                <View style={[styles.rewardIcon, !state.usable && styles.rewardIconLocked]}>
                  <Ionicons
                    name={item.reward_type === 'shipping' ? 'bus' : 'pricetag'}
                    size={28}
                    color={state.usable ? colors.primary : colors.grey}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 16 }}>
                  <Text style={styles.rewardTitle}>{item.title}</Text>
                  <Text style={styles.rewardDesc}>{item.description}</Text>

                  <View style={styles.codeContainer}>
                    <Text style={styles.codeLabel}>VOUCHER CODE</Text>
                    <View style={styles.codeRow}>
                      <Text style={[styles.codeValue, !state.usable && { color: colors.grey, textDecorationLine: 'line-through' }]}>
                        {item.code}
                      </Text>
                      {state.usable && (
                        <Pressable onPress={() => copyToClipboard(item.code)} style={styles.copyBtn}>
                          <Ionicons name="copy-outline" size={18} color={colors.primary} />
                        </Pressable>
                      )}
                    </View>
                  </View>

                  <View style={styles.durationRow}>
                    <Ionicons name="time-outline" size={14} color={colors.grey} />
                    <Text style={styles.durationText}>
                      {state.usable ? 'Expires' : state.label === 'Used' ? 'Used voucher · was valid until' : 'Expired on'}{' '}
                      {formatDate(voucherExpiry(item))} · {state.label}
                    </Text>
                  </View>
                  {state.usable && (
                    <Text style={[styles.durationText, { marginTop: 4 }]}>Enter this code at checkout when ordering parts.</Text>
                  )}
                </View>
              </View>
            );
          }

          const canAfford = session.points >= Number(item.points_required);
          const isClaiming = claiming === Number(item.id);

          return (
            <View style={[styles.rewardCard, !canAfford && styles.rewardCardLocked]}>
              <View style={[styles.rewardIcon, !canAfford && styles.rewardIconLocked]}>
                <Ionicons
                  name={item.reward_type === 'shipping' ? 'bus' : 'pricetag'}
                  size={28}
                  color={canAfford ? colors.primary : colors.grey}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 16 }}>
                <Text style={[styles.rewardTitle, !canAfford && styles.rewardTitleLocked]}>{item.title}</Text>
                <Text style={[styles.rewardDesc, !canAfford && styles.rewardDescLocked]}>{item.description}</Text>
                <View style={styles.durationRow}>
                  <Ionicons name="time-outline" size={14} color={colors.grey} />
                  <Text style={styles.durationText}>Valid for {VOUCHER_VALID_DAYS} days after claiming</Text>
                </View>

                {!canAfford && (
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBarBg}>
                      <View
                        style={[
                          styles.progressBarFill,
                          { width: `${Math.max(5, Math.min(100, (session.points / Number(item.points_required)) * 100))}%` }
                        ]}
                      />
                    </View>
                    <Text style={styles.progressText}>
                      {session.points} / {item.points_required} pts
                    </Text>
                  </View>
                )}

                <View style={styles.actionRow}>
                  <View style={[styles.pointsRequired, !canAfford && styles.pointsRequiredLocked]}>
                    <Ionicons name="star" size={14} color={canAfford ? colors.primary : colors.grey} />
                    <Text style={[styles.pointsReqText, !canAfford && styles.pointsReqTextLocked]}>{item.points_required} pts</Text>
                  </View>
                  <Pressable
                    onPress={() => handleClaim(item)}
                    disabled={!canAfford || isClaiming}
                    style={[
                      styles.claimBtn,
                      !canAfford && styles.disabledBtn,
                      isClaiming && { opacity: 0.7 }
                    ]}
                  >
                    {isClaiming ? (
                      <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                      <Text style={styles.claimText}>{canAfford ? 'Claim' : 'Locked'}</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons
              name={activeTab === 'available' ? 'gift-outline' : 'ticket-outline'}
              size={48}
              color={colors.greyLight}
            />
            <Text style={styles.emptyText}>
              {activeTab === 'available'
                ? 'No rewards available at the moment.'
                : 'You haven\'t claimed any vouchers yet.'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: 20,
    backgroundColor: colors.white,
  },
  pointsCard: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
  },
  pointsLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontFamily: fonts.medium,
    fontSize: 14,
    marginBottom: 4,
  },
  pointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pointsValue: {
    color: colors.white,
    fontFamily: fonts.bold,
    fontSize: 32,
  },
  pointsSubtext: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    marginTop: 8,
    fontFamily: fonts.regular,
  },
  rewardCard: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.greyBorder,
    alignItems: 'center',
  },
  rewardCardLocked: {
    backgroundColor: '#f8f8f8',
    borderColor: colors.greyLight,
    opacity: 0.7,
  },
  rewardIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardIconLocked: {
    backgroundColor: colors.greyLight,
  },
  rewardTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.black,
  },
  rewardTitleLocked: {
    color: colors.grey,
  },
  rewardDesc: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.grey,
    marginTop: 2,
  },
  rewardDescLocked: {
    color: colors.greyLight,
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  durationText: {
    fontSize: 11,
    color: colors.grey,
    fontFamily: fonts.regular,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  pointsRequired: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pointsRequiredLocked: {
    backgroundColor: colors.greyLight,
  },
  pointsReqText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.primary,
  },
  pointsReqTextLocked: {
    color: colors.grey,
  },
  claimBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 80,
    alignItems: 'center',
  },
  disabledBtn: {
    backgroundColor: colors.grey,
  },
  claimText: {
    color: colors.white,
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  progressContainer: {
    marginTop: 10,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 10,
    color: colors.grey,
    fontFamily: fonts.medium,
    marginTop: 4,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  benefitIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  benefitText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.black,
  },
  tabs: {
    flexDirection: 'row',
    marginTop: 20,
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  activeTab: {
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.grey,
  },
  activeTabText: {
    color: colors.primary,
    fontFamily: fonts.bold,
  },
  codeContainer: {
    backgroundColor: '#f8f9fa',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: colors.greyBorder,
    alignItems: 'center',
  },
  codeLabel: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: colors.grey,
    letterSpacing: 1,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  codeValue: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  copyBtn: {
    padding: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
    opacity: 0.6,
  },
  emptyText: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.grey,
    marginTop: 12,
    textAlign: 'center',
  },
});
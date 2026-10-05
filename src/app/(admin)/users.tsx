// Admin > Users. Backend: admin/get_full_site_data.php (list) + admin/manage_user.php.
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Card, CardActions, FilterChips, ListScreen, Meta, PickerSheet, Pill, SearchBar, SmallButton, useAdminList, useRunner, matches } from '@/components/admin';
import { confirm } from '@/lib/dialogs';
import { api, type Json } from '@/services/api';
import { userSession } from '@/services/session';
import { colors, fonts, text } from '@/theme/theme';

const ROLES = ['Customer', 'Mechanic', 'Admin'];
const roleColor = (r: string) => (r === 'Admin' ? colors.primary : r === 'Mechanic' ? colors.blue : colors.green);

export default function AdminUsers() {
  const list = useAdminList(() => api.getAdminUsers().then((r) => r.users as Json[]));
  const { run, busy } = useRunner(list.refresh);
  const [q, setQ] = useState('');
  const [role, setRole] = useState('All');
  const [target, setTarget] = useState<Json | null>(null);
  const me = Number(userSession.user?.id);

  const data = useMemo(
    () => list.items.filter((u) => (role === 'All' || u.role === role) && matches(q, u.name, u.email, u.phone)),
    [list.items, q, role],
  );

  async function remove(u: Json) {
    const ok = await confirm('Delete User?', `Delete ${u.name}? This cannot be undone.`, { confirmText: 'Delete', destructive: true });
    if (ok) run(() => api.deleteUser(Number(u.id)), 'User deleted.');
  }

  return (
    <>
      <ListScreen
        list={list}
        data={data}
        keyOf={(u) => String(u.id)}
        emptyIcon="people-outline"
        emptyLabel="No users found."
        header={
          <>
            <SearchBar value={q} onChange={setQ} placeholder="Search name, email or phone" />
            <FilterChips options={['All', ...ROLES]} value={role} onChange={setRole} />
          </>
        }
        renderItem={(u) => {
          const isMe = Number(u.id) === me;
          return (
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.primary }}>{String(u.name).charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 15 }}>{u.name}{isMe ? '  (you)' : ''}</Text>
                  <Text numberOfLines={1} style={text.bodySmall}>{u.email}</Text>
                </View>
                <Pill label={u.role} color={roleColor(u.role)} />
              </View>
              <Meta icon="call-outline">{u.phone}</Meta>
              <Meta icon="calendar-outline">{`Joined ${u.joined}`}</Meta>
              {!isMe && (
                <CardActions>
                  <SmallButton label="Change Role" icon="swap-horizontal-outline" tone="primary" disabled={busy} onPress={() => setTarget(u)} />
                  <SmallButton label="Delete" icon="trash-outline" tone="danger" disabled={busy} onPress={() => remove(u)} />
                </CardActions>
              )}
            </Card>
          );
        }}
      />
      <PickerSheet
        visible={target != null}
        title={target ? `Role for ${target.name}` : ''}
        options={ROLES.map((r) => ({ value: r, label: r }))}
        value={target?.role}
        onClose={() => setTarget(null)}
        onPick={(r) => {
          const u = target;
          setTarget(null);
          if (u && r !== u.role) run(() => api.changeUserRole(Number(u.id), r), `${u.name} is now ${r}.`);
        }}
      />
    </>
  );
}
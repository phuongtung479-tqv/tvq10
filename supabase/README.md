# Supabase SQL deployment

Run the SQL files below in Supabase SQL Editor, in this order:

1. `admin_users.sql`
2. `funnel_configs.sql`
3. `leads.sql`
4. `visitor_tracking.sql`
5. `admin_rls_patch.sql`

`admin_users.sql` expects the Auth user to already exist. The current allowlist entry is `phuongtung477.tn@gmail.com`.

## Verification

After running the files, verify the admin row with an authenticated SQL session:

```sql
select user_id, email, role, enabled
from public.admin_users
where lower(email) = lower('phuongtung477.tn@gmail.com');
```

The result must contain one row with `role = 'owner'` and `enabled = true`.

Verify the config row and that the Auth password is not stored in JSON:

```sql
select id, updated_at, data ? 'admin' as has_admin_config,
       (data->'admin') ? 'password' as has_password_key
from public.funnel_configs
where id = 1;
```

`has_password_key` should be `false` after the cleanup statement in `funnel_configs.sql`.

Do not run old dated SQL dumps after these files. They can recreate obsolete policies or overwrite the current aggregate configuration.

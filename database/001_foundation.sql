-- AYOMI / Tahap 1: 6 dari 60 tabel aplikasi.
-- Jalankan SELURUH file satu kali di SQL Editor project Supabase development.
-- Memerlukan auth.users, auth.uid(), role anon/authenticated/service_role.
-- Tidak menghapus tabel/data. Jika nama objek sudah ada, transaksi dibatalkan.
-- Akses katalog publik dan akses anak untuk staf dibuka pada tahap berikutnya.

begin;

create schema if not exists ayomi_private;
revoke all on schema ayomi_private from public, anon, authenticated;
grant usage on schema ayomi_private to authenticated;

-- 1. Identitas aplikasi; password/email autentikasi tetap di Supabase Auth.
create table public.users (
  id uuid primary key references auth.users(id) on delete restrict,
  role text not null default 'parent'
    check (role in ('parent', 'manager', 'caregiver', 'admin')),
  full_name text not null check (char_length(btrim(full_name)) between 2 and 150),
  phone text check (phone is null or char_length(phone) <= 32),
  status text not null default 'active'
    check (status in ('active', 'inactive', 'suspended')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Profil daycare; belum ada data fiktif yang otomatis dipublikasikan.
create table public.daycares (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(btrim(name)) between 2 and 200),
  description text not null default '',
  address text not null,
  province_code text not null,
  city_code text not null,
  district_code text not null,
  postal_code text,
  timezone text not null default 'Asia/Jakarta'
    check (timezone in ('Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura')),
  contact_phone text not null,
  latitude numeric(9,6) check (latitude between -90 and 90),
  longitude numeric(9,6) check (longitude between -180 and 180),
  facilities jsonb not null default '[]'::jsonb check (jsonb_typeof(facilities) = 'array'),
  opening_hours jsonb not null default '{}'::jsonb check (jsonb_typeof(opening_hours) = 'object'),
  public_gallery jsonb not null default '[]'::jsonb check (jsonb_typeof(public_gallery) = 'array'),
  commission_category_code text,
  daily_capacity integer not null check (daily_capacity > 0),
  status text not null default 'inactive' check (status in ('inactive', 'active', 'suspended')),
  main_manager_id uuid references public.users(id) on delete restrict,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'active' or (main_manager_id is not null and deleted_at is null))
);

-- 3. Hubungan akun staf dengan daycare.
create table public.daycare_members (
  id uuid primary key default gen_random_uuid(),
  daycare_id uuid not null references public.daycares(id) on delete restrict,
  user_id uuid not null references public.users(id) on delete restrict,
  member_role text not null check (member_role in ('manager', 'caregiver')),
  status text not null default 'pending_verification'
    check (status in ('invited', 'pending_verification', 'active', 'inactive')),
  verified_by uuid references public.users(id) on delete restrict,
  verified_at timestamptz,
  joined_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (daycare_id, user_id),
  check (ended_at is null or joined_at is null or ended_at >= joined_at),
  check (status <> 'active' or
    (verified_by is not null and verified_at is not null and joined_at is not null and ended_at is null))
);

create unique index daycare_one_active_manager
  on public.daycare_members(daycare_id)
  where member_role = 'manager' and status = 'active';
create index daycare_members_user_idx on public.daycare_members(user_id, status);
create index daycares_manager_idx on public.daycares(main_manager_id);

-- 4. Data umum anak; Parent adalah pemilik akun/wali bersama pada MVP.
create table public.children (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.users(id) on delete restrict,
  full_name text not null check (char_length(btrim(full_name)) between 2 and 150),
  birth_date date not null check (birth_date <= current_date),
  gender text,
  general_notes text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index children_parent_idx on public.children(parent_id);

-- 5. Kesehatan dipisahkan karena hak aksesnya berbeda dari data umum anak.
create table public.child_health_profiles (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null unique references public.children(id) on delete restrict,
  allergies text not null default '',
  medical_history text not null default '',
  special_needs text not null default '',
  medication_notes text not null default '',
  version integer not null default 1 check (version > 0),
  updated_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6. Riwayat sensitif; diisi trigger, tidak ditulis langsung oleh browser.
create table public.child_health_change_logs (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete restrict,
  from_version integer not null check (from_version >= 0),
  to_version integer not null check (to_version = from_version + 1),
  before_data jsonb not null,
  after_data jsonb not null,
  changed_by uuid not null references public.users(id) on delete restrict,
  reason text,
  created_at timestamptz not null default now(),
  unique (child_id, to_version)
);
create index health_history_child_time_idx
  on public.child_health_change_logs(child_id, created_at desc);

-- RLS diaktifkan eksplisit, termasuk jika automatic RLS dashboard tidak aktif.
alter table public.users enable row level security;
alter table public.daycares enable row level security;
alter table public.daycare_members enable row level security;
alter table public.children enable row level security;
alter table public.child_health_profiles enable row level security;
alter table public.child_health_change_logs enable row level security;

-- Helper tidak berada pada schema API. Tidak mengambil role dari user_metadata.
create function ayomi_private.current_app_role()
returns text language sql stable security definer set search_path = ''
as $$
  select u.role from public.users u
  join auth.users a on a.id = u.id
  where u.id = (select auth.uid())
    and u.status = 'active' and u.deleted_at is null
    and (a.email_confirmed_at is not null or a.phone_confirmed_at is not null)
    and (a.banned_until is null or a.banned_until <= now());
$$;

create function ayomi_private.is_member(target_daycare uuid, required_role text default null)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.daycare_members m
    where m.daycare_id = target_daycare and m.user_id = (select auth.uid())
      and m.status = 'active' and m.ended_at is null
      and m.member_role = ayomi_private.current_app_role()
      and (required_role is null or m.member_role = required_role)
  );
$$;

create function ayomi_private.owns_child(target_child uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select ayomi_private.current_app_role() = 'parent' and exists (
    select 1 from public.children c
    where c.id = target_child and c.parent_id = (select auth.uid())
  );
$$;

create function ayomi_private.touch_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger users_updated_at before update on public.users
  for each row execute function ayomi_private.touch_updated_at();
create trigger daycares_updated_at before update on public.daycares
  for each row execute function ayomi_private.touch_updated_at();
create trigger members_updated_at before update on public.daycare_members
  for each row execute function ayomi_private.touch_updated_at();
create trigger children_updated_at before update on public.children
  for each row execute function ayomi_private.touch_updated_at();

-- Signup selalu menjadi Parent. Undangan staf/provisioning Admin adalah operasi
-- server terpisah pada tahap berikutnya, bukan pilihan role di formulir publik.
create function ayomi_private.handle_auth_user_created()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  display_name text;
begin
  display_name := left(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 150);
  if char_length(display_name) < 2 then display_name := 'Orang Tua'; end if;
  insert into public.users (id, role, full_name, status)
  values (new.id, 'parent', display_name, 'active');
  return new;
end;
$$;
create trigger ayomi_auth_user_created after insert on auth.users
  for each row execute function ayomi_private.handle_auth_user_created();

-- Jangan diam-diam mengubah akun Auth yang sudah ada menjadi akun aplikasi.
-- Project lama dengan akun yang belum dipetakan memerlukan backfill terpisah.
do $$
begin
  if exists (select 1 from auth.users) then
    raise exception 'Tahap 1 memerlukan project tanpa akun Auth. Akun lama perlu ditinjau/backfill dahulu; transaksi dibatalkan tanpa menghapus data.';
  end if;
end;
$$;

-- Integritas role dan Manager utama diperiksa pada akhir transaksi sehingga
-- provisioning user + membership + daycare dapat dilakukan secara atomik.
create function ayomi_private.validate_foundation_links()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if exists (
    select 1 from public.children c join public.users u on u.id = c.parent_id
    where u.role <> 'parent'
  ) then
    raise exception 'Pemilik anak harus mempunyai role parent.';
  end if;
  if exists (
    select 1 from public.daycare_members m join public.users u on u.id = m.user_id
    where m.status = 'active' and m.member_role <> u.role
  ) then
    raise exception 'Role anggota aktif harus sesuai role akun.';
  end if;
  if exists (
    select 1 from public.daycares d
    where d.status = 'active' and not exists (
      select 1 from public.users u join public.daycare_members m on m.user_id = u.id
      where u.id = d.main_manager_id and u.role = 'manager'
        and u.status = 'active' and u.deleted_at is null
        and m.daycare_id = d.id and m.member_role = 'manager' and m.status = 'active'
    )
  ) then
    raise exception 'Daycare aktif wajib memiliki satu Manager utama dengan akun dan keanggotaan aktif.';
  end if;
  return null;
end;
$$;
create constraint trigger users_links_valid after insert or update or delete on public.users
  deferrable initially deferred for each row execute function ayomi_private.validate_foundation_links();
create constraint trigger daycares_links_valid after insert or update or delete on public.daycares
  deferrable initially deferred for each row execute function ayomi_private.validate_foundation_links();
create constraint trigger members_links_valid after insert or update or delete on public.daycare_members
  deferrable initially deferred for each row execute function ayomi_private.validate_foundation_links();
create constraint trigger children_links_valid after insert or update or delete on public.children
  deferrable initially deferred for each row execute function ayomi_private.validate_foundation_links();

create function ayomi_private.prepare_health_change()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.child_id <> old.child_id or new.id <> old.id then
      raise exception 'Identitas profil kesehatan tidak dapat dipindahkan.';
    end if;
    new.version := old.version + 1;
    new.created_at := old.created_at;
  else
    new.version := 1;
  end if;
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  if new.updated_by is null then raise exception 'Aktor perubahan kesehatan wajib dicatat.'; end if;
  new.updated_at := now();
  return new;
end;
$$;

create function ayomi_private.record_health_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  previous_data jsonb := '{}'::jsonb;
  previous_version integer := 0;
begin
  if tg_op = 'UPDATE' then
    previous_data := jsonb_build_object('allergies', old.allergies,
      'medical_history', old.medical_history, 'special_needs', old.special_needs,
      'medication_notes', old.medication_notes);
    previous_version := old.version;
  end if;
  insert into public.child_health_change_logs
    (child_id, from_version, to_version, before_data, after_data, changed_by)
  values (new.child_id, previous_version, new.version, previous_data,
    jsonb_build_object('allergies', new.allergies, 'medical_history', new.medical_history,
      'special_needs', new.special_needs, 'medication_notes', new.medication_notes), new.updated_by);
  return new;
end;
$$;

create trigger health_prepare before insert or update on public.child_health_profiles
  for each row execute function ayomi_private.prepare_health_change();
create trigger health_history after insert or update on public.child_health_profiles
  for each row execute function ayomi_private.record_health_change();

create function ayomi_private.initialize_child_health()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.child_health_profiles (child_id, updated_by)
  values (new.id, coalesce(auth.uid(), new.parent_id));
  return new;
end;
$$;
create trigger child_health_initialize after insert on public.children
  for each row execute function ayomi_private.initialize_child_health();

create function ayomi_private.reject_history_mutation()
returns trigger language plpgsql set search_path = ''
as $$
begin
  raise exception 'Riwayat kesehatan bersifat append-only.';
end;
$$;
create trigger health_history_immutable before update or delete on public.child_health_change_logs
  for each row execute function ayomi_private.reject_history_mutation();

-- Setiap grant ditulis eksplisit: kompatibel dengan Automatically expose = OFF.
revoke all on table public.users, public.daycares, public.daycare_members,
  public.children, public.child_health_profiles, public.child_health_change_logs
  from public, anon, authenticated, service_role;
grant usage on schema public to authenticated, service_role;
grant select on table public.users, public.daycares, public.daycare_members,
  public.children, public.child_health_profiles, public.child_health_change_logs to authenticated;
grant update (full_name, phone) on public.users to authenticated;
grant insert (parent_id, full_name, birth_date, gender, general_notes) on public.children to authenticated;
grant update (full_name, birth_date, gender, general_notes) on public.children to authenticated;
grant update (allergies, medical_history, special_needs, medication_notes)
  on public.child_health_profiles to authenticated;
grant select, insert, update on table public.users, public.daycares,
  public.daycare_members, public.children, public.child_health_profiles to service_role;
grant select on public.child_health_change_logs to service_role;

-- Tidak ada INSERT/UPDATE role/status akun dari browser, tidak ada DELETE data.
create policy users_read_self on public.users for select to authenticated
  using (id = (select auth.uid()));
create policy users_admin_read on public.users for select to authenticated
  using ((select ayomi_private.current_app_role()) = 'admin');
create policy users_edit_self on public.users for update to authenticated
  using (id = (select auth.uid()) and (select ayomi_private.current_app_role()) is not null)
  with check (id = (select auth.uid()));

create policy daycares_read_scope on public.daycares for select to authenticated
  using ((select ayomi_private.current_app_role()) = 'admin' or ayomi_private.is_member(id));
create policy members_read_scope on public.daycare_members for select to authenticated
  using ((select ayomi_private.current_app_role()) is not null and
    (user_id = (select auth.uid()) or (select ayomi_private.current_app_role()) = 'admin'
      or ayomi_private.is_member(daycare_id, 'manager')));

create policy children_read_scope on public.children for select to authenticated
  using ((parent_id = (select auth.uid()) and (select ayomi_private.current_app_role()) = 'parent')
    or (select ayomi_private.current_app_role()) = 'admin');
create policy children_insert_own on public.children for insert to authenticated
  with check (parent_id = (select auth.uid()) and (select ayomi_private.current_app_role()) = 'parent');
create policy children_edit_own on public.children for update to authenticated
  using (parent_id = (select auth.uid()) and (select ayomi_private.current_app_role()) = 'parent'
    and status = 'active' and deleted_at is null)
  with check (parent_id = (select auth.uid()) and (select ayomi_private.current_app_role()) = 'parent');

create policy health_read_scope on public.child_health_profiles for select to authenticated
  using (ayomi_private.owns_child(child_id) or (select ayomi_private.current_app_role()) = 'admin');
create policy health_edit_own on public.child_health_profiles for update to authenticated
  using (ayomi_private.owns_child(child_id) and exists (
    select 1 from public.children c where c.id = child_id and c.status = 'active' and c.deleted_at is null
  ))
  with check (ayomi_private.owns_child(child_id));
create policy health_history_read_scope on public.child_health_change_logs for select to authenticated
  using (ayomi_private.owns_child(child_id) or (select ayomi_private.current_app_role()) = 'admin');

-- Fungsi trigger tidak dapat dipanggil sebagai RPC. Hanya helper RLS boleh
-- dieksekusi authenticated; schema ayomi_private jangan diekspos di Data API.
revoke all on all functions in schema ayomi_private from public, anon, authenticated, service_role;
grant execute on function ayomi_private.current_app_role() to authenticated;
grant execute on function ayomi_private.is_member(uuid, text) to authenticated;
grant execute on function ayomi_private.owns_child(uuid) to authenticated;

commit;

-- Hasil yang diharapkan: 6 baris, semuanya rowsecurity = true.
select tablename, rowsecurity from pg_tables
where schemaname = 'public' and tablename in
  ('users', 'daycares', 'daycare_members', 'children', 'child_health_profiles', 'child_health_change_logs')
order by tablename;

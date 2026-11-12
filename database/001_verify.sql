-- Jalankan SETELAH 001_foundation.sql, di SQL Editor development sebagai postgres.
-- Seluruh akun dan data uji dibuat di transaksi ini lalu dibatalkan (ROLLBACK).
-- Tidak membuat akun login produksi, tidak mengirim email, tidak menghapus data lama.
begin;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['users', 'daycares', 'daycare_members',
    'children', 'child_health_profiles', 'child_health_change_logs']
  loop
    if not exists (select 1 from pg_tables
      where schemaname = 'public' and tablename = table_name and rowsecurity) then
      raise exception 'FAIL: tabel % tidak ada atau RLS belum aktif', table_name;
    end if;
    if has_table_privilege('anon', 'public.' || table_name, 'SELECT') then
      raise exception 'FAIL: anon mempunyai SELECT pada %', table_name;
    end if;
    if has_table_privilege('authenticated', 'public.' || table_name, 'DELETE') then
      raise exception 'FAIL: authenticated mempunyai DELETE pada %', table_name;
    end if;
  end loop;
  if has_column_privilege('authenticated', 'public.users', 'role', 'UPDATE')
    or has_column_privilege('authenticated', 'public.children', 'parent_id', 'UPDATE')
    or has_function_privilege('anon', 'ayomi_private.current_app_role()', 'EXECUTE') then
    raise exception 'FAIL: privilege kolom/fungsi terlalu luas';
  end if;
  raise notice 'PASS: enam tabel dilindungi RLS dan grants terbatas.';
end;
$$;

-- ID acak menghindari benturan dengan data yang sudah ada.
do $$
declare
  test_role text;
  account_id uuid;
  daycare_id uuid := gen_random_uuid();
begin
  foreach test_role in array array['parent_a', 'parent_b', 'manager', 'caregiver', 'admin', 'unconfirmed']
  loop
    account_id := gen_random_uuid();
    perform set_config('ayomi.test_' || test_role, account_id::text, true);
    insert into auth.users (id, aud, role, email, email_confirmed_at, raw_user_meta_data)
    values (account_id, 'authenticated', 'authenticated', account_id::text || '@example.invalid',
      case when test_role = 'unconfirmed' then null else now() end,
      '{"full_name":"Akun Uji Ayomi","role":"admin"}'::jsonb);
    if (select role from public.users where id = account_id) <> 'parent' then
      raise exception 'FAIL: metadata signup dapat menaikkan role';
    end if;
    if test_role in ('manager', 'caregiver', 'admin') then
      update public.users set role = test_role where id = account_id;
    end if;
  end loop;
  perform set_config('ayomi.test_daycare', daycare_id::text, true);
  insert into public.daycares
    (id, slug, name, address, province_code, city_code, district_code,
      contact_phone, daily_capacity, main_manager_id)
  values (daycare_id, 'uji-' || daycare_id::text, 'Daycare Uji Rollback', 'Alamat uji',
    'uji', 'uji', 'uji', '0000000000', 10, current_setting('ayomi.test_manager')::uuid);
  insert into public.daycare_members
    (daycare_id, user_id, member_role, status, verified_by, verified_at, joined_at)
  values
    (daycare_id, current_setting('ayomi.test_manager')::uuid, 'manager', 'active',
      current_setting('ayomi.test_admin')::uuid, now(), now()),
    (daycare_id, current_setting('ayomi.test_caregiver')::uuid, 'caregiver', 'active',
      current_setting('ayomi.test_manager')::uuid, now(), now());
  update public.daycares set status = 'active' where id = daycare_id;
  raise notice 'PASS: signup mengabaikan role metadata; provisioning staf konsisten.';
end;
$$;
set constraints all immediate;

select set_config('request.jwt.claim.sub', current_setting('ayomi.test_parent_a'), true);
select set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('ayomi.test_parent_a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare
  child_id uuid;
begin
  insert into public.children (parent_id, full_name, birth_date)
  values (auth.uid(), 'Anak Uji Rollback', current_date - 730)
  returning id into child_id;
  perform set_config('ayomi.test_child', child_id::text, true);
  if (select count(*) from public.child_health_profiles where child_id = current_setting('ayomi.test_child')::uuid) <> 1 then
    raise exception 'FAIL: profil kesehatan tidak otomatis dibuat';
  end if;
  update public.child_health_profiles set allergies = 'Catatan alergi contoh'
    where child_id = current_setting('ayomi.test_child')::uuid;
  if not exists (select 1 from public.child_health_profiles
    where child_id = current_setting('ayomi.test_child')::uuid and version = 2
      and updated_by = auth.uid() and allergies = 'Catatan alergi contoh') then
    raise exception 'FAIL: versi/aktor perubahan kesehatan salah';
  end if;
  if (select count(*) from public.child_health_change_logs
    where child_id = current_setting('ayomi.test_child')::uuid) <> 2 then
    raise exception 'FAIL: riwayat kesehatan tidak lengkap';
  end if;
  begin
    update public.users set role = 'admin' where id = auth.uid();
    raise exception 'FAIL: Parent dapat menaikkan role';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.children where id = current_setting('ayomi.test_child')::uuid;
    raise exception 'FAIL: Parent dapat menghapus anak secara fisik';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.child_health_change_logs set reason = 'Ubah bukti'
      where child_id = current_setting('ayomi.test_child')::uuid;
    raise exception 'FAIL: Parent dapat mengganti riwayat kesehatan';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS: Parent membuat anak, kesehatan otomatis, histori tercatat, eskalasi role/DELETE ditolak.';
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', current_setting('ayomi.test_parent_b'), true);
select set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('ayomi.test_parent_b'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare affected integer;
begin
  if exists (select 1 from public.children where id = current_setting('ayomi.test_child')::uuid)
    or exists (select 1 from public.child_health_profiles where child_id = current_setting('ayomi.test_child')::uuid)
    or exists (select 1 from public.child_health_change_logs where child_id = current_setting('ayomi.test_child')::uuid) then
    raise exception 'FAIL: Parent B dapat membaca data Parent A';
  end if;
  update public.children set full_name = 'Nama tidak sah' where id = current_setting('ayomi.test_child')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: Parent B dapat mengubah anak Parent A'; end if;
  begin
    insert into public.children (parent_id, full_name, birth_date)
    values (current_setting('ayomi.test_parent_a')::uuid, 'Anak pemilik palsu', current_date - 730);
    raise exception 'FAIL: pemalsuan parent_id diterima';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS: Parent B tidak dapat membaca, mengubah, atau membuat data atas nama Parent A.';
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', current_setting('ayomi.test_caregiver'), true);
select set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('ayomi.test_caregiver'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  if exists (select 1 from public.children where id = current_setting('ayomi.test_child')::uuid)
    or exists (select 1 from public.child_health_profiles where child_id = current_setting('ayomi.test_child')::uuid) then
    raise exception 'FAIL: Caregiver tanpa penugasan bisa membaca anak/kesehatan';
  end if;
  if not exists (select 1 from public.daycares where id = current_setting('ayomi.test_daycare')::uuid) then
    raise exception 'FAIL: staf aktif tidak dapat membaca daycare sendiri';
  end if;
  if exists (select 1 from public.daycare_members where user_id = current_setting('ayomi.test_manager')::uuid) then
    raise exception 'FAIL: Caregiver bisa membaca keanggotaan staf lain';
  end if;
  raise notice 'PASS: Caregiver hanya mendapat scope awal yang diizinkan.';
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', current_setting('ayomi.test_manager'), true);
select set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('ayomi.test_manager'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.daycare_members where daycare_id = current_setting('ayomi.test_daycare')::uuid) <> 2 then
    raise exception 'FAIL: Manager tidak dapat melihat staf daycare sendiri';
  end if;
  if exists (select 1 from public.children where id = current_setting('ayomi.test_child')::uuid) then
    raise exception 'FAIL: Manager dapat membaca anak sebelum enrollment tersedia';
  end if;
  raise notice 'PASS: Manager membaca keanggotaan tanpa akses anak sebelum enrollment.';
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', current_setting('ayomi.test_unconfirmed'), true);
select set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('ayomi.test_unconfirmed'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  begin
    insert into public.children (parent_id, full_name, birth_date)
    values (auth.uid(), 'Anak tanpa konfirmasi', current_date - 730);
    raise exception 'FAIL: akun belum terkonfirmasi mendapat akses operasional';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS: akun belum terkonfirmasi tidak dapat membuat anak.';
end;
$$;
reset role;

update public.users set status = 'suspended' where id = current_setting('ayomi.test_parent_a')::uuid;
select set_config('request.jwt.claim.sub', current_setting('ayomi.test_parent_a'), true);
select set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('ayomi.test_parent_a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  if exists (select 1 from public.children where id = current_setting('ayomi.test_child')::uuid)
    or exists (select 1 from public.child_health_profiles where child_id = current_setting('ayomi.test_child')::uuid) then
    raise exception 'FAIL: akun suspended masih membaca data anak';
  end if;
  raise notice 'PASS: status suspended memutus akses tanpa menunggu JWT kedaluwarsa.';
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', current_setting('ayomi.test_admin'), true);
select set_config('request.jwt.claims', jsonb_build_object('sub', current_setting('ayomi.test_admin'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  if not exists (select 1 from public.children where id = current_setting('ayomi.test_child')::uuid)
    or not exists (select 1 from public.child_health_change_logs where child_id = current_setting('ayomi.test_child')::uuid) then
    raise exception 'FAIL: Admin tidak dapat membaca data pengawasan';
  end if;
  raise notice 'PASS: Admin dapat membaca data pengawasan.';
end;
$$;
reset role;

set constraints all immediate;
rollback;
select 'PASS: pemeriksaan fondasi selesai; seluruh akun/data uji di-ROLLBACK.' as hasil;

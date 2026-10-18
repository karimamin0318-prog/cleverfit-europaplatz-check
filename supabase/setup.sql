-- Studio Check: Tabellen und Zugriffsregeln.
-- Einmal im Supabase-Dashboard unter „SQL Editor“ einfügen und „Run“ drücken. Mehrfach ausführen schadet nicht.

-- Wer Aufgaben/Layout ändern darf (E-Mail des Supabase-Kontos, klein geschrieben)
create table if not exists public.admins (email text primary key);
-- Aufgaben, Layout, Punkte, gespeicherte Layouts … als ein Dokument pro Studio
create table if not exists public.studio (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
-- Häkchen: ein Eintrag pro erledigter Aufgabe und Tag/Stunde/Intervall („<aufgabe>|<zeitraum>“)
create table if not exists public.done (key text primary key, done_at timestamptz not null default now());

alter table public.admins enable row level security;
alter table public.studio enable row level security;
alter table public.done enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where email = lower(auth.jwt() ->> 'email'));
$$;

-- Nur angemeldete Konten (Theke + Admins) haben überhaupt Zugriff; ohne Login nichts.
revoke all on public.admins, public.studio, public.done from anon;
grant select on public.admins to authenticated;
grant select, insert, update on public.studio to authenticated;
grant select, insert, update, delete on public.done to authenticated;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "admins lesen" on public.admins;
create policy "admins lesen" on public.admins for select to authenticated using (true);

drop policy if exists "studio lesen" on public.studio;
drop policy if exists "studio anlegen nur admin" on public.studio;
drop policy if exists "studio aendern nur admin" on public.studio;
create policy "studio lesen" on public.studio for select to authenticated using (true);
create policy "studio anlegen nur admin" on public.studio for insert to authenticated with check (public.is_admin());
create policy "studio aendern nur admin" on public.studio for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "done lesen" on public.done;
drop policy if exists "done abhaken" on public.done;
drop policy if exists "done aendern" on public.done;
drop policy if exists "done loeschen" on public.done;
create policy "done lesen" on public.done for select to authenticated using (true);
create policy "done abhaken" on public.done for insert to authenticated with check (true);
create policy "done aendern" on public.done for update to authenticated using (true) with check (true);
create policy "done loeschen" on public.done for delete to authenticated using (true);

insert into public.admins (email) values ('karimamin0318@gmail.com'), ('philipp.schlattinger@gmx.at') on conflict do nothing;

-- Live-Abgleich zwischen Geräten
do $$ begin
  alter publication supabase_realtime add table public.studio, public.done;
exception when duplicate_object then null; end $$;

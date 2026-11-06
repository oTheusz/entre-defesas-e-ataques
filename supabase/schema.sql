-- Entre Defesas e Ataques — mesa virtual
-- Cole tudo isto no Supabase: SQL Editor > New query > Run.
-- Pode rodar de novo sem problema (é idempotente).

create extension if not exists pgcrypto with schema extensions;

-- ---------- Tabelas públicas ----------
create table if not exists rooms (
  code text primary key,
  name text not null default 'Mesa',
  active_match uuid,
  created_at timestamptz not null default now()
);

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  room_code text not null references rooms(code) on delete cascade,
  name text not null default 'Partida',
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists tokens (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  team text not null default 'home',
  slot int not null default 0,
  number int not null default 0,
  name text not null default '',
  photo text not null default '',
  owner text not null default '',
  important boolean not null default false,
  x real not null default 0.5,
  y real not null default 0.5,
  res jsonb not null default '{}'::jsonb
);

create table if not exists players (
  id text primary key,
  room_code text not null references rooms(code) on delete cascade,
  name text not null default 'Jogador',
  skills jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists rolls (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  kind text not null default 'roll',
  who text not null default '',
  label text not null default '',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists tokens_match_idx on tokens(match_id);
create index if not exists rolls_match_idx on rolls(match_id, created_at desc);
create index if not exists matches_room_idx on matches(room_code);
create index if not exists players_room_idx on players(room_code);

-- ---------- Segredos do mestre (ninguém lê direto) ----------
create table if not exists room_secrets (
  room_code text primary key references rooms(code) on delete cascade,
  gm_hash text not null,
  data jsonb not null default '{}'::jsonb
);

-- ---------- Permissões ----------
-- Mesa entre amigos: qualquer pessoa com o link lê e edita as tabelas públicas.
-- O site é que limita quem mexe em quê. Os segredos do mestre ficam protegidos por senha.
alter table rooms enable row level security;
alter table matches enable row level security;
alter table tokens enable row level security;
alter table players enable row level security;
alter table rolls enable row level security;
alter table room_secrets enable row level security;

do $$
declare t text;
begin
  foreach t in array array['rooms','matches','tokens','players','rolls'] loop
    execute format('drop policy if exists "mesa_all" on %I', t);
    execute format('create policy "mesa_all" on %I for all to anon, authenticated using (true) with check (true)', t);
  end loop;
end $$;
-- room_secrets: sem política nenhuma = ninguém acessa direto.

-- ---------- Funções do mestre ----------
create or replace function create_room(p_name text, p_pass text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare v_code text;
begin
  if length(coalesce(p_pass,'')) < 4 then raise exception 'senha curta'; end if;
  loop
    v_code := upper(substr(md5(random()::text), 1, 6));
    exit when not exists (select 1 from rooms where code = v_code);
  end loop;
  insert into rooms(code, name) values (v_code, coalesce(nullif(trim(p_name),''),'Mesa'));
  insert into room_secrets(room_code, gm_hash) values (v_code, crypt(p_pass, gen_salt('bf')));
  return v_code;
end $$;

create or replace function check_gm(p_room text, p_pass text)
returns boolean language sql security definer set search_path = public, extensions as $$
  select exists(select 1 from room_secrets where room_code = p_room and gm_hash = crypt(p_pass, gm_hash));
$$;

create or replace function get_secrets(p_room text, p_pass text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v jsonb;
begin
  select data into v from room_secrets where room_code = p_room and gm_hash = crypt(p_pass, gm_hash);
  if not found then raise exception 'senha errada'; end if;
  return v;
end $$;

create or replace function set_secrets(p_room text, p_pass text, p_data jsonb)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  update room_secrets set data = p_data where room_code = p_room and gm_hash = crypt(p_pass, gm_hash);
  if not found then raise exception 'senha errada'; end if;
end $$;

grant execute on function create_room(text,text) to anon, authenticated;
grant execute on function check_gm(text,text) to anon, authenticated;
grant execute on function get_secrets(text,text) to anon, authenticated;
grant execute on function set_secrets(text,text,jsonb) to anon, authenticated;

-- ---------- Tempo real ----------
alter table rooms replica identity full;
alter table matches replica identity full;
alter table tokens replica identity full;
alter table players replica identity full;
alter table rolls replica identity full;

do $$
declare t text;
begin
  foreach t in array array['rooms','matches','tokens','players','rolls'] loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- ---------- Fotos dos tokens ----------
insert into storage.buckets (id, name, public) values ('fotos', 'fotos', true)
on conflict (id) do nothing;

drop policy if exists "fotos_upload" on storage.objects;
create policy "fotos_upload" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'fotos');
drop policy if exists "fotos_read" on storage.objects;
create policy "fotos_read" on storage.objects for select to anon, authenticated
  using (bucket_id = 'fotos');

-- ---------- Slice of life (cidade e semana) ----------
alter table rooms add column if not exists view text not null default 'campo';
alter table rooms add column if not exists semana int not null default 1;
alter table players add column if not exists local text not null default 'dormitorio';

create table if not exists periods (
  id text primary key,
  room_code text not null references rooms(code) on delete cascade,
  player_id text not null,
  semana int not null default 1,
  slot int not null default 1,
  local text not null default '',
  atividade text not null default '',
  nota text not null default '',
  resultado text not null default ''
);
create index if not exists periods_room_idx on periods(room_code, semana);
alter table periods enable row level security;
drop policy if exists "mesa_all" on periods;
create policy "mesa_all" on periods for all to anon, authenticated using (true) with check (true);
alter table periods replica identity full;
do $$ begin
  alter publication supabase_realtime add table periods;
exception when duplicate_object then null; end $$;

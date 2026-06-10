-- ============================================================
-- Schema Supabase - Arcon / manutencao-ar-condicionado
-- Modelo atual: bairro faz parte do cadastro do cliente
-- ============================================================

-- DROP completo (ordem correta por FK)
drop table if exists public.analytics cascade;
drop table if exists public.comunicacao cascade;
drop table if exists public.orcamentos cascade;
drop table if exists public.materiais_usados cascade;
drop table if exists public.materiais cascade;
drop table if exists public.manutencoes cascade;
drop table if exists public.equipamentos cascade;
drop table if exists public.unidades cascade;
drop table if exists public.clientes cascade;
drop table if exists public.bairros cascade;
drop table if exists public.profiles cascade;

-- ============================================================
-- Tabelas principais
-- ============================================================

create table public.profiles (
  id            uuid references auth.users(id) on delete cascade primary key,
  name          text,
  role          text not null default 'administrativo',
  business_mode text default 'autonomo',
  avatar        text,
  created_at    timestamptz default now()
);

create table public.clientes (
  id              bigserial primary key,
  owner_id        uuid references auth.users(id) on delete cascade not null,
  nome            text,
  tipo            text,
  endereco        text,
  logradouro      text,
  numero          text,
  complemento     text,
  bairro_endereco text,
  cidade          text,
  estado          text,
  cep             text,
  grupo           text,
  telefone        text,
  whatsapp        text,
  created_at      timestamptz default now()
);

create table public.unidades (
  id           bigserial primary key,
  owner_id     uuid references auth.users(id) on delete cascade not null,
  cliente_id   bigint references public.clientes(id) on delete cascade not null,
  apartamento  text,
  proprietario text,
  telefone     text,
  created_at   timestamptz default now()
);

create table public.equipamentos (
  id                 bigserial primary key,
  owner_id           uuid references auth.users(id) on delete cascade not null,
  cliente_id         bigint references public.clientes(id) on delete cascade not null,
  unidade_id         bigint references public.unidades(id) on delete set null,
  marca              text,
  modelo             text,
  btu                integer,
  localizacao        text,
  ultima_manutencao  timestamptz,
  proxima_manutencao timestamptz,
  created_at         timestamptz default now()
);

create table public.manutencoes (
  id              bigserial primary key,
  owner_id        uuid references auth.users(id) on delete cascade not null,
  client_id       bigint references public.clientes(id) on delete set null,
  equipamento_id  bigint references public.equipamentos(id) on delete set null,
  tipo_servico    text,
  status          text default 'concluido',
  data_realizada  timestamptz,
  data_agendada   timestamptz,
  proxima_data    timestamptz,
  descricao       text,
  valor           numeric(10,2),
  forma_pagamento text,
  tecnico_id      text,
  foto            text,
  created_at      timestamptz default now()
);

create table public.materiais (
  id             bigserial primary key,
  owner_id       uuid references auth.users(id) on delete cascade not null,
  nome           text,
  categoria      text,
  estoque        integer,
  preco_unitario numeric(10,2),
  created_at     timestamptz default now()
);

create table public.materiais_usados (
  id             bigserial primary key,
  owner_id       uuid references auth.users(id) on delete cascade not null,
  manutencao_id  bigint references public.manutencoes(id) on delete cascade,
  material_id    bigint references public.materiais(id) on delete set null,
  quantidade     integer,
  valor_unitario numeric(10,2),
  created_at     timestamptz default now()
);

create table public.orcamentos (
  id         bigserial primary key,
  owner_id   uuid references auth.users(id) on delete cascade not null,
  cliente_id bigint references public.clientes(id) on delete set null,
  status     text,
  titulo     text,
  descricao  text,
  valor      numeric(10,2),
  dados      jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table public.comunicacao (
  id         bigserial primary key,
  owner_id   uuid references auth.users(id) on delete cascade not null,
  cliente_id bigint references public.clientes(id) on delete set null,
  tipo       text,
  mensagem   text,
  data       timestamptz,
  created_at timestamptz default now()
);

create table public.analytics (
  id         bigserial primary key,
  owner_id   uuid references auth.users(id) on delete cascade not null,
  tipo       text,
  dados      jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- ============================================================
-- Indices uteis
-- ============================================================

create index clientes_owner_idx on public.clientes(owner_id);
create index clientes_bairro_endereco_idx on public.clientes(owner_id, bairro_endereco);
create index equipamentos_owner_cliente_idx on public.equipamentos(owner_id, cliente_id);
create index equipamentos_proxima_idx on public.equipamentos(owner_id, proxima_manutencao);
create index manutencoes_owner_client_idx on public.manutencoes(owner_id, client_id);
create index manutencoes_agendada_idx on public.manutencoes(owner_id, data_agendada);
create index comunicacao_owner_cliente_idx on public.comunicacao(owner_id, cliente_id);

-- ============================================================
-- RLS
-- ============================================================

alter table public.profiles        enable row level security;
alter table public.clientes        enable row level security;
alter table public.unidades        enable row level security;
alter table public.equipamentos    enable row level security;
alter table public.manutencoes     enable row level security;
alter table public.materiais       enable row level security;
alter table public.materiais_usados enable row level security;
alter table public.orcamentos      enable row level security;
alter table public.comunicacao     enable row level security;
alter table public.analytics       enable row level security;

create policy "profiles_own" on public.profiles
  using (auth.uid() = id) with check (auth.uid() = id);

do $$
declare t text;
begin
  foreach t in array array['clientes','unidades','equipamentos','manutencoes','materiais','materiais_usados','orcamentos','comunicacao','analytics']
  loop
    execute format(
      'create policy "%s_own" on public.%I
       using (owner_id = auth.uid())
       with check (owner_id = auth.uid())', t, t);
  end loop;
end;
$$;

-- ============================================================
-- Trigger: cria profile no cadastro
-- ============================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, role, business_mode)
  values (
    new.id,
    new.raw_user_meta_data->>'name',
    coalesce(new.raw_user_meta_data->>'role', 'administrativo'),
    coalesce(new.raw_user_meta_data->>'businessMode', new.raw_user_meta_data->>'business_mode', 'autonomo')
  ) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

select pg_notify('pgrst', 'reload schema');

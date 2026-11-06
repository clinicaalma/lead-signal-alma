-- Lead Signal · Clínica Alma: captação da Black Alma (página /black + painel /painel/black).
-- Cole tudo no SQL Editor e clique em Run. Pode rodar de novo sem problema.
-- Não mexe nas tabelas do quiz e do CRM (clientes_quiz e leads).

-- 1. Visitas na /black
create table if not exists black_visitas (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  utm_source text,
  utm_campaign text,
  utm_content text,
  fbclid text,
  fbp text,
  fbc text,
  user_agent text
);

-- 2. Cliques no botão "Entrar no grupo VIP"
create table if not exists black_cliques (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_id text not null,
  utm_source text,
  utm_campaign text,
  utm_content text,
  fbclid text,
  fbp text,
  fbc text,
  user_agent text
);

-- 3. Fotografias do total de membros do grupo (Evolution API a cada 30 min ou digitado no painel)
create table if not exists black_grupo_snapshots (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  total_membros int not null check (total_membros >= 0),
  origem text not null check (origem in ('evolution', 'manual'))
);

create index if not exists idx_black_visitas_created_at on black_visitas(created_at desc);
create index if not exists idx_black_visitas_utm_content on black_visitas(utm_content);
create index if not exists idx_black_cliques_created_at on black_cliques(created_at desc);
create index if not exists idx_black_cliques_utm_content on black_cliques(utm_content);
create index if not exists idx_black_snapshots_created_at on black_grupo_snapshots(created_at desc);

-- 4. Segurança: mesmo padrão do projeto. RLS ligado e nenhuma policy.
-- Só o servidor (service role) lê e grava; a chave anon/pública não enxerga nada.
alter table black_visitas enable row level security;
alter table black_cliques enable row level security;
alter table black_grupo_snapshots enable row level security;

-- 5. Resumo para o painel, calculado no banco (o Supabase devolve no máximo 1.000 linhas
-- por consulta, então contar no navegador erraria quando passar disso). Dias no fuso de Brasília.
create or replace function black_resumo()
returns json
language sql
stable
set search_path = public
as $$
  select json_build_object(
    'dias', (
      select coalesce(json_agg(d order by d.dia), '[]'::json)
      from (
        select dia, sum(v)::int as visitas, sum(c)::int as cliques
        from (
          select (created_at at time zone 'America/Sao_Paulo')::date as dia, 1 as v, 0 as c from black_visitas
          union all
          select (created_at at time zone 'America/Sao_Paulo')::date, 0, 1 from black_cliques
        ) x
        group by dia
      ) d
    ),
    'origens', (
      select coalesce(json_agg(o order by o.cliques desc, o.visitas desc), '[]'::json)
      from (
        select utm_content, sum(v)::int as visitas, sum(c)::int as cliques
        from (
          select utm_content, 1 as v, 0 as c from black_visitas
          union all
          select utm_content, 0, 1 from black_cliques
        ) x
        group by utm_content
      ) o
    ),
    'membros_dia', (
      select coalesce(json_agg(m order by m.dia), '[]'::json)
      from (
        select distinct on (dia) dia, total_membros, created_at
        from (
          select (created_at at time zone 'America/Sao_Paulo')::date as dia, total_membros, created_at
          from black_grupo_snapshots
        ) s
        order by dia, created_at desc
      ) m
    ),
    'ultimo_snapshot', (
      select row_to_json(s)
      from (
        select created_at, total_membros, origem
        from black_grupo_snapshots
        order by created_at desc
        limit 1
      ) s
    )
  );
$$;

-- A função só pode ser chamada pelo servidor.
revoke execute on function black_resumo() from public, anon, authenticated;
grant execute on function black_resumo() to service_role;

-- Lead Signal · Clínica Alma: banco completo (projeto Supabase NOVO).
-- Cole tudo no SQL Editor e clique em Run. Pode rodar de novo sem problema.
-- Os segredos (token da CAPI, Pixel e WhatsApp) ficam nas variáveis da Netlify, não no banco.

-- 1. Cadastro do cliente
create table if not exists clientes_quiz (
  id uuid primary key default gen_random_uuid(),
  cliente_id text unique not null,
  nome_cliente text not null,
  nicho text,
  whatsapp_numero text not null,
  meta_pixel_id text not null,
  meta_dataset_id text,
  meta_access_token text not null,
  nome_evento_lead text default 'Lead',
  nome_evento_qualificado text default 'LeadQualificado',
  nota_de_corte int default 60,
  perguntas jsonb not null,
  gates jsonb not null,
  ativo boolean default true,
  created_at timestamptz default now()
);

-- 2. Leads do quiz
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  cliente_id text not null references clientes_quiz(cliente_id),
  event_id text not null,
  telefone text,
  respostas jsonb not null,
  score int not null,
  gates_aprovados boolean not null,
  qualificado boolean not null,
  consentimento boolean not null default false,
  consentimento_em timestamptz,
  fbp text,
  fbc text,
  fbclid text,
  client_ip_address text,
  client_user_agent text,
  evento_lead_enviado boolean default false,
  evento_qualificado_enviado boolean default false,
  -- Origem (UTMs)
  origem text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  referrer text,
  -- CRM
  etapa text not null default 'novo',
  responsavel text,
  protocolo text,
  valor_pedido numeric(12,2),
  notas text,
  proximo_contato date,
  data_reposicao date,
  motivo_perda text,
  fechado_em timestamptz,
  evento_compra_enviado boolean not null default false,
  atualizado_em timestamptz default now(),
  created_at timestamptz default now()
);

-- Etapas do Kanban: novo, atendimento (Em atendimento), proposta (Avaliação agendada), fechou, perdido.
alter table leads drop constraint if exists leads_etapa_check;
alter table leads add constraint leads_etapa_check
  check (etapa in ('novo', 'atendimento', 'proposta', 'fechou', 'perdido'));

create index if not exists idx_leads_cliente on leads(cliente_id);
create index if not exists idx_leads_created_at on leads(created_at desc);
create index if not exists idx_leads_qualificado on leads(qualificado);
create index if not exists idx_leads_etapa on leads(etapa);
create index if not exists idx_leads_proximo_contato on leads(proximo_contato);
create index if not exists idx_leads_utm_campaign on leads(utm_campaign);
create index if not exists idx_leads_utm_content on leads(utm_content);

-- 3. Segurança: RLS ligado e nenhuma policy. Só o servidor (service role) lê e grava;
-- a chave anon/pública não enxerga nada.
alter table clientes_quiz enable row level security;
alter table leads enable row level security;

-- 4. Cadastro da Clínica Alma (gerado do config/quiz.json)
insert into clientes_quiz (cliente_id, nome_cliente, nicho, whatsapp_numero, meta_pixel_id, meta_access_token, nota_de_corte, perguntas, gates)
values ('clinica-alma', 'Clínica Alma', 'clínica de estética corporal em Cascavel-PR (gordura localizada e estrias)', 'ENV:WHATSAPP_NUMERO', 'ENV:META_PIXEL_ID', 'ENV:META_CAPI_TOKEN', 60,
  $json$[{"id":"incomodo","rotulo":"O que me incomoda","texto":"O que mais te incomoda hoje?","opcoes":[{"label":"Gordurinha localizada (barriga, flanco, costas, braço)","pontos":10},{"label":"Estrias","pontos":10},{"label":"Os dois","pontos":15}]},{"id":"tentou","rotulo":"Já tentei","texto":"O que você já tentou para resolver?","opcoes":[{"label":"Pacote em outra clínica","pontos":20},{"label":"Dieta ou academia","pontos":15},{"label":"Cremes e tratamentos em casa","pontos":10},{"label":"Nada ainda","pontos":5}]},{"id":"quando","rotulo":"Quero começar","texto":"Quando você quer começar?","opcoes":[{"label":"Esta semana","pontos":30},{"label":"Este mês","pontos":25},{"label":"Tenho uma data (verão, viagem, evento)","pontos":25},{"label":"Só estou pesquisando","pontos":0}]},{"id":"periodo","rotulo":"Melhor período","texto":"Qual período fica melhor para sua avaliação?","opcoes":[{"label":"Manhã","pontos":0},{"label":"Tarde","pontos":0},{"label":"Sábado","pontos":0}]}]$json$::jsonb,
  $json$[{"id":"regiao","rotulo":"Região","texto":"Você mora em Cascavel ou região?","opcoes":[{"label":"Sim","aprova":true},{"label":"Não","aprova":false}]},{"id":"investimento","rotulo":"Investimento","texto":"Os protocolos vão de R$ 399 a R$ 2.900, com desconto no Pix ou em até 10x no cartão. Isso faz sentido para você agora?","opcoes":[{"label":"Sim, quero agendar minha avaliação","pontos":35,"aprova":true},{"label":"Sim, se tiver parcelamento","pontos":30,"aprova":true},{"label":"Agora não","pontos":0,"aprova":false}]}]$json$::jsonb)
on conflict (cliente_id) do update set nome_cliente = excluded.nome_cliente, nicho = excluded.nicho, perguntas = excluded.perguntas, gates = excluded.gates, nota_de_corte = excluded.nota_de_corte;

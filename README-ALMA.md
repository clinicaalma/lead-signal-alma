# Lead Signal | Clínica Alma (Cascavel-PR)

Quiz "Avaliação Sob Medida" que roda antes do WhatsApp, mais o CRM em `/painel`. Dispara `Lead` e `LeadQualificado` pro Meta via Pixel + Conversions API com o mesmo `event_id` (deduplicação). O CRM dispara `Purchase` quando a lead vai para **Fechou** com valor preenchido.

Feito a partir do Lead Signal da Aurora Baby (`lead-signal-bolsas`), com a mesma lógica.

## Fórmula da lead qualificada

**LeadQualificado = score ≥ 60 E região aprovada E investimento aprovado** (score máximo: 100). Tudo isso está em `config/quiz.json`.

| Pergunta | Respostas e pontos |
| --- | --- |
| O que mais te incomoda | Gordurinha localizada = 10 · Estrias = 10 · Os dois = 15 |
| Cascavel ou região? **(gate)** | Sim = passa · Não = reprova |
| O que já tentou | Pacote em outra clínica = 20 · Dieta ou academia = 15 · Cremes em casa = 10 · Nada ainda = 5 |
| Quando quer começar | Esta semana = 30 · Este mês = 25 · Tenho uma data = 25 · Só pesquisando = 0 |
| Investimento **(score + gate)** | Quero agendar = 35 ✓ · Se tiver parcelamento = 30 ✓ · Agora não = 0 ✗ |
| Melhor período | 0 (só informação) |

Todas as leads, qualificadas ou não, preenchem o contato, viram `Lead` e vão para o WhatsApp. Só as qualificadas disparam também `LeadQualificado`. Rode `npm run test:score` para ver os 7 cenários.

## 1. Supabase (projeto novo)

1. Crie um projeto novo em supabase.com com a conta da clínica (região São Paulo).
2. **SQL Editor** → cole todo o `supabase/alma-completo.sql` → **Run**. Ele cria as tabelas, os índices, o RLS e o cadastro da clínica.
3. **Project Settings → API**: copie a **Project URL** (`SUPABASE_URL`) e a chave **service_role** (`SUPABASE_SERVICE_ROLE_KEY`). Essa chave é secreta e fica só na Netlify.

## 2. GitHub

1. Crie um repositório **privado** na conta da clínica (ex.: `lead-signal-alma`).
2. Nesta pasta: `git add . && git commit -m "Lead Signal Clínica Alma"`, depois `git remote add origin <url>` e `git push -u origin main`.

## 3. Netlify (site novo)

1. Na conta da clínica: **Add new site → Import an existing project** → escolha o repositório.
2. Nome do site: `clinicaalma-ads` (fica `clinicaalma-ads.netlify.app`).
3. O build já está no `netlify.toml` (`npm run build` + plugin do Next.js). Não precisa mudar nada.
4. **Site configuration → Environment variables**: cadastre as variáveis abaixo e faça **Deploy**.
5. Toda vez que mudar uma variável, faça um novo deploy (**Deploys → Trigger deploy**).

## Variáveis de ambiente

| Variável | Onde pegar |
| --- | --- |
| `META_PIXEL_ID` | Gerenciador de Eventos → Fontes de dados → o Pixel/dataset da clínica → número do ID |
| `META_CAPI_TOKEN` | Mesmo dataset → **Configurações** → Conversions API → **Gerar token de acesso** |
| `META_TEST_EVENT_CODE` | Opcional. Dataset → **Testar eventos** → código (ex.: `TEST12345`). Apague depois dos testes |
| `META_GRAPH_VERSION` | Opcional (padrão `v23.0`) |
| `WHATSAPP_NUMERO` | WhatsApp da clínica só com números: `55` + DDD + número (ex.: `5545999999999`) |
| `SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role` |
| `PAINEL_SENHA` | Você define. É a senha do CRM em `/painel` |

## Logo, favicon e política

- `public/logo.png`: logo da clínica com fundo transparente, tirada da versão marrom (aparece no quiz e no login do CRM).
- `app/icon.png`, `app/apple-icon.png` e `app/favicon.ico`: o "A" da logo sobre fundo marrom `#2D1910`.
- `public/politica-de-privacidade.html`: Política de Privacidade (LGPD), linkada na autorização do contato. **Antes de publicar, preencha os campos marcados entre colchetes.**

## Parâmetros de URL dos anúncios

No anúncio, em **Parâmetros de URL**:

```
utm_source=meta&utm_campaign={{campaign.name}}&utm_content={{ad.name}}
```

O link fica `https://clinicaalma-ads.netlify.app/?utm_source=meta&utm_campaign={{campaign.name}}&utm_content={{ad.name}}`. O CRM mostra a campanha e o anúncio de cada lead e soma tudo na aba **Origens**.

## CRM (/painel)

Etapas: **Novo → Em atendimento → Avaliação agendada → Fechou / Perdido**. Use o **Próximo contato** como a data da avaliação: no dia, a lead aparece em "Pra chamar hoje". Ao salvar em **Fechou** com valor, o `Purchase` vai pro Meta uma vez só.

## Checklist de testes (antes de ligar as campanhas)

Coloque `META_TEST_EVENT_CODE` na Netlify, faça um deploy e abra o quiz com `?fbclid=teste&utm_source=meta&utm_campaign=teste&utm_content=anuncio1`.

1. [ ] **Lead qualificada** (os dois, pacote, esta semana, quero agendar): `Lead` + `LeadQualificado` chegam no Testar eventos, cada um como **Navegador e Servidor**, deduplicados.
2. [ ] **"Agora não"** ou **fora da região**: chega só `Lead`.
3. [ ] **Avaliação agendada**: mova a lead para a etapa no CRM. Não dispara evento (no painel da Aurora também não há evento nessa etapa).
4. [ ] **"Fechou" com R$ 100**: chega `Purchase` com valor 100 e moeda BRL.
5. [ ] **WhatsApp**: a tela final abre o WhatsApp sozinha em 2 segundos, com nome e respostas na mensagem.
6. [ ] **Painel**: a lead de teste aparece em `/painel` com a origem `Meta Ads · anuncio1`.

Depois: **apague `META_TEST_EVENT_CODE`** e faça um novo deploy. Se ficar ligado, os eventos reais vão só para a aba de teste. Apague também as leads de teste no Supabase (Table Editor → leads).

## Campanha

- Objetivo **Leads**, local da conversão **Site**, URL = link do quiz com os parâmetros acima.
- Comece otimizando para `LeadQualificado` (conversão personalizada). A meta "Maximizar o número de leads qualificados" costuma liberar depois de alguns dias de eventos reais chegando pelo servidor.
- Revise pesos e corte a cada 2 a 4 semanas, com o que a Kamilla e a Nicoly estão vendo no WhatsApp.

"use client";

import { useEffect, useMemo, useState } from "react";
import "./painel.css";

const ETAPAS = [
  { id: "novo", nome: "Novo" },
  { id: "atendimento", nome: "Em atendimento" },
  { id: "proposta", nome: "Avaliação agendada" },
  { id: "fechou", nome: "Fechou" },
  { id: "perdido", nome: "Perdido" },
];
const RESPONSAVEIS = ["Kamilla", "Nicoly"];
const PROTOCOLOS = ["Harmonização Corporal", "Protocolo de Estrias", "Combinado Sob Medida", "Área avulsa", "Combo Black", "Outro"];
const MOTIVOS_PERDA = ["Sem resposta", "Achou caro", "Não compareceu", "Fechou com outra clínica", "Outro"];
const TZ = "America/Sao_Paulo";

const hojeISO = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });
const fmtData = (iso) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: TZ });
const fmtDia = (d) => (d ? d.split("-").reverse().slice(0, 2).join("/") : "");
const fmtReal = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtTel = (t) => {
  const d = String(t || "").replace(/^55/, "");
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : t;
};
const somaDias = (iso, n) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

function baixarCsv(leads) {
  const cab = ["Data", "Nome", "WhatsApp", "O que incomoda", "Região", "Já tentou", "Quando quer começar", "Investimento", "Melhor período", "Score", "Qualificada", "Etapa", "Profissional", "Protocolo", "Valor", "Próximo contato", "Retorno/manutenção", "Motivo da perda", "Notas", "Origem", "Campanha", "Conjunto", "Anúncio", "utm_source", "utm_medium"];
  const linhas = leads.map((l) => {
    const r = l.respostas || {};
    return [fmtData(l.created_at), r.nome, fmtTel(l.telefone), r.incomodo, r.regiao, r.tentou, r.quando, r.investimento, r.periodo, l.score,
      l.qualificado ? "Sim" : "Não", ETAPAS.find((e) => e.id === l.etapa)?.nome, l.responsavel, l.protocolo, l.valor_pedido, fmtDia(l.proximo_contato),
      fmtDia(l.data_reposicao), l.motivo_perda, l.notas, l.origem, l.utm_campaign, l.utm_term, l.utm_content, l.utm_source, l.utm_medium];
  });
  const csv = [cab, ...linhas].map((c) => c.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  a.download = `crm-alma-${hojeISO()}.csv`;
  a.click();
}

const origemDe = (l) => l.origem || "Sem origem";
const AGRUPAR = [
  { id: "utm_content", nome: "Anúncio" },
  { id: "utm_campaign", nome: "Campanha" },
  { id: "utm_term", nome: "Conjunto" },
  { id: "origem", nome: "Origem" },
];

function lerSenhaSalva() {
  try { return sessionStorage.getItem("crm_senha") || ""; } catch { return ""; }
}
function salvarSenha(s) {
  try { sessionStorage.setItem("crm_senha", s); } catch {}
}

export default function Crm() {
  const [senha, setSenha] = useState("");
  const [leads, setLeads] = useState(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [aba, setAba] = useState("funil");
  const [busca, setBusca] = useState("");
  const [soQualificados, setSoQualificados] = useState(false);
  const [filtroOrigem, setFiltroOrigem] = useState("");
  const [agrupar, setAgrupar] = useState("utm_content");
  const [aberto, setAberto] = useState(null);

  async function carregar(s = senha) {
    setErro("");
    setCarregando(true);
    try {
      const res = await fetch("/api/painel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ senha: s }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro || "Erro ao carregar");
      salvarSenha(s);
      setLeads(json.leads);
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    const s = lerSenhaSalva();
    if (s) { setSenha(s); carregar(s); }
  }, []);

  async function salvar(id, mudancas) {
    const res = await fetch("/api/painel/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ senha, id, mudancas }) });
    const json = await res.json();
    if (!res.ok) throw new Error(json.erro || "Erro ao salvar");
    setLeads((ls) => ls.map((l) => (l.id === id ? json.lead : l)));
    return json;
  }

  const filtrados = useMemo(() => {
    if (!leads) return [];
    const q = busca.trim().toLowerCase();
    return leads.filter((l) => {
      if (soQualificados && !l.qualificado) return false;
      if (filtroOrigem && origemDe(l) !== filtroOrigem) return false;
      if (!q) return true;
      const r = l.respostas || {};
      return [r.nome, r.incomodo, l.telefone, l.responsavel, l.protocolo, l.origem, l.utm_campaign, l.utm_term, l.utm_content]
        .some((v) => String(v || "").toLowerCase().includes(q));
    });
  }, [leads, busca, soQualificados, filtroOrigem]);

  const origensDisponiveis = useMemo(() => [...new Set((leads || []).map(origemDe))].sort(), [leads]);

  if (!leads) {
    return (
      <main className="tela">
        <section className="cartao">
          <img className="logo" src="/logo.png" alt="Clínica Alma" />
          <span className="selo">CRM · Clínica Alma</span>
          <h2>Entre com a senha</h2>
          <form onSubmit={(e) => { e.preventDefault(); carregar(); }} className="form">
            <input className="campo" type="password" value={senha} autoFocus onChange={(e) => setSenha(e.target.value)} placeholder="Senha" />
            {erro ? <p className="erro">{erro}</p> : null}
            <button className="botao" disabled={carregando || !senha}>{carregando ? "Entrando..." : "Entrar"}</button>
          </form>
        </section>
      </main>
    );
  }

  const hoje = hojeISO();
  const fechados = leads.filter((l) => l.etapa === "fechou");
  const faturamento = fechados.reduce((s, l) => s + Number(l.valor_pedido || 0), 0);
  const qualificados = leads.filter((l) => l.qualificado).length;
  const followups = leads.filter((l) => l.proximo_contato && l.proximo_contato <= hoje && !["fechou", "perdido"].includes(l.etapa));
  const reposicoes = leads.filter((l) => l.data_reposicao && l.data_reposicao <= somaDias(hoje, 30)).sort((a, b) => a.data_reposicao.localeCompare(b.data_reposicao));
  const leadAberto = leads.find((l) => l.id === aberto);

  return (
    <main className="painel">
      <header className="painel-topo">
        <div>
          <h1>CRM · Clínica Alma</h1>
          <p className="sub">Leads do quiz, do primeiro contato ao retorno/manutenção.</p>
        </div>
        <div className="painel-acoes">
          <button className="botao-sec" onClick={() => carregar()}>{carregando ? "Atualizando..." : "Atualizar"}</button>
          <button className="botao-sec" onClick={() => baixarCsv(filtrados)}>Baixar planilha</button>
        </div>
      </header>

      <section className="numeros">
        <div className="numero"><span>{leads.length}</span><small>leads</small></div>
        <div className="numero"><span>{qualificados}</span><small>qualificadas</small></div>
        <div className="numero"><span>{fechados.length}</span><small>protocolos fechados</small></div>
        <div className="numero destaque"><span>{fmtReal(faturamento)}</span><small>em protocolos</small></div>
        <div className="numero"><span>{leads.length ? Math.round((fechados.length / leads.length) * 100) : 0}%</span><small>lead → protocolo</small></div>
      </section>

      {followups.length || reposicoes.length ? (
        <section className="alertas">
          {followups.length ? (
            <div className="alerta">
              <strong>Pra chamar hoje ({followups.length})</strong>
              <div className="alerta-itens">
                {followups.map((l) => (
                  <button key={l.id} className={`mini${l.proximo_contato < hoje ? " atrasado" : ""}`} onClick={() => setAberto(l.id)}>
                    {l.respostas?.nome || "Sem nome"} · {l.proximo_contato < hoje ? `atrasado (${fmtDia(l.proximo_contato)})` : "hoje"}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {reposicoes.length ? (
            <div className="alerta">
              <strong>Retornos/manutenções nos próximos 30 dias ({reposicoes.length})</strong>
              <div className="alerta-itens">
                {reposicoes.map((l) => (
                  <button key={l.id} className={`mini${l.data_reposicao < hoje ? " atrasado" : ""}`} onClick={() => setAberto(l.id)}>
                    {l.respostas?.nome || "Sem nome"} · {fmtDia(l.data_reposicao)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="filtros">
        <button className={`chip${aba === "funil" ? " ativo" : ""}`} onClick={() => setAba("funil")}>Funil</button>
        <button className={`chip${aba === "lista" ? " ativo" : ""}`} onClick={() => setAba("lista")}>Lista</button>
        <button className={`chip${aba === "origens" ? " ativo" : ""}`} onClick={() => setAba("origens")}>Origens</button>
        <select className="campo filtro-origem" value={filtroOrigem} onChange={(e) => setFiltroOrigem(e.target.value)} aria-label="Filtrar por origem">
          <option value="">Todas as origens</option>
          {origensDisponiveis.map((o) => <option key={o}>{o}</option>)}
        </select>
        <label className="check"><input type="checkbox" checked={soQualificados} onChange={(e) => setSoQualificados(e.target.checked)} /> Só qualificadas</label>
        <input className="campo busca" placeholder="Buscar nome, WhatsApp, anúncio..." value={busca} onChange={(e) => setBusca(e.target.value)} />
      </section>

      {aba === "funil" ? (
        <section className="funil">
          {ETAPAS.map((et) => {
            const daEtapa = filtrados.filter((l) => (l.etapa || "novo") === et.id);
            const soma = daEtapa.reduce((s, l) => s + Number(l.valor_pedido || 0), 0);
            return (
              <div key={et.id} className={`coluna c-${et.id}`}>
                <div className="coluna-topo">
                  <strong>{et.nome}</strong>
                  <span>{daEtapa.length}{soma ? ` · ${fmtReal(soma)}` : ""}</span>
                </div>
                {daEtapa.map((l) => <Cartao key={l.id} l={l} hoje={hoje} onClick={() => setAberto(l.id)} />)}
                {!daEtapa.length ? <p className="coluna-vazia">Nenhum lead</p> : null}
              </div>
            );
          })}
        </section>
      ) : aba === "origens" ? (
        <Origens leads={filtrados} agrupar={agrupar} setAgrupar={setAgrupar} />
      ) : (
        <section className="tabela-wrap">
          <table className="tabela">
            <thead><tr><th>Data</th><th>Cliente</th><th>Começar</th><th>Protocolo</th><th>Score</th><th>Etapa</th><th>Profissional</th><th>Valor</th><th>Próx. contato</th><th>Origem</th></tr></thead>
            <tbody>
              {filtrados.map((l) => (
                <tr key={l.id} onClick={() => setAberto(l.id)}>
                  <td>{fmtData(l.created_at)}</td>
                  <td><strong>{l.respostas?.nome}</strong><br /><small>{l.respostas?.incomodo}</small></td>
                  <td>{l.respostas?.quando}</td>
                  <td>{l.protocolo || "—"}</td>
                  <td><span className={`tag${l.qualificado ? " tag-q" : ""}`}>{l.score}</span></td>
                  <td>{ETAPAS.find((e) => e.id === (l.etapa || "novo"))?.nome}</td>
                  <td>{l.responsavel || "—"}</td>
                  <td>{l.valor_pedido ? fmtReal(l.valor_pedido) : "—"}</td>
                  <td className={l.proximo_contato && l.proximo_contato < hoje ? "atrasado-txt" : ""}>{fmtDia(l.proximo_contato) || "—"}</td>
                  <td>{origemDe(l)}{l.utm_content ? <><br /><small>{l.utm_content}</small></> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {leadAberto ? <Ficha key={leadAberto.id} l={leadAberto} onClose={() => setAberto(null)} onSave={salvar} /> : null}
    </main>
  );
}

function Cartao({ l, hoje, onClick }) {
  const r = l.respostas || {};
  return (
    <button className={`card${l.qualificado ? " q" : ""}`} onClick={onClick}>
      <div className="card-topo">
        <strong>{r.nome || "Sem nome"}</strong>
        <span className={`tag${l.qualificado ? " tag-q" : ""}`}>{l.score} pts</span>
      </div>
      <span className="loja">{r.incomodo}</span>
      {l.protocolo ? <span className="card-info">{l.protocolo}</span> : null}
      <span className="card-origem" title={[l.utm_campaign, l.utm_term, l.utm_content].filter(Boolean).join(" › ")}>
        {origemDe(l)}{l.utm_content ? ` · ${l.utm_content}` : ""}
      </span>
      <div className="card-rodape">
        {l.responsavel ? <span className="resp">{l.responsavel}</span> : <span className="resp vazio-resp">Sem profissional</span>}
        {l.valor_pedido ? <span className="valor">{fmtReal(l.valor_pedido)}</span> : null}
        {l.proximo_contato && !["fechou", "perdido"].includes(l.etapa) ? (
          <span className={`prox${l.proximo_contato < hoje ? " atrasado" : l.proximo_contato === hoje ? " hoje" : ""}`}>↻ {fmtDia(l.proximo_contato)}</span>
        ) : null}
      </div>
    </button>
  );
}

function Ficha({ l, onClose, onSave }) {
  const r = l.respostas || {};
  const [f, setF] = useState({
    etapa: l.etapa || "novo",
    responsavel: l.responsavel || "",
    protocolo: l.protocolo || "",
    valor_pedido: l.valor_pedido ?? "",
    proximo_contato: l.proximo_contato || "",
    data_reposicao: l.data_reposicao || "",
    motivo_perda: l.motivo_perda || "",
    notas: l.notas || "",
  });
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    const esc = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  async function salvar() {
    setMsg("");
    const bruto = String(f.valor_pedido ?? "").replace(/[R$\s]/g, "");
    const valor = Number(bruto.includes(",") ? bruto.replace(/\./g, "").replace(",", ".") : bruto);
    if (f.etapa === "fechou" && !(valor > 0)) {
      setMsg("Coloque o valor do protocolo pra marcar como fechado.");
      return;
    }
    setSalvando(true);
    try {
      const res = await onSave(l.id, f);
      if (res.compra?.enviado) setMsg("Salvo. Compra enviada pro Meta ✓");
      else if (res.compra?.erro) setMsg(`Salvo, mas a compra não foi pro Meta: ${res.compra.erro}`);
      else setMsg("Salvo ✓");
    } catch (e) {
      setMsg(e.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fundo" onClick={onClose}>
      <aside className="ficha" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Lead ${r.nome || ""}`}>
        <div className="ficha-topo">
          <div>
            <h2>{r.nome || "Sem nome"}</h2>
            <span className="loja">{r.incomodo ? `${r.incomodo} · ` : ""}chegou {fmtData(l.created_at)}</span>
          </div>
          <button className="fechar" onClick={onClose} aria-label="Fechar">×</button>
        </div>

        <div className="ficha-links">
          <a className="botao-wa" href={`https://wa.me/${l.telefone}`} target="_blank" rel="noreferrer">WhatsApp {fmtTel(l.telefone)}</a>
          <span className={`tag${l.qualificado ? " tag-q" : ""}`}>{l.qualificado ? "Qualificada" : "Não qualificada"} · {l.score} pts</span>
        </div>

        <div className="origem-box">
          <span className="rotulo">Origem: {origemDe(l)}</span>
          <dl>
            <div><dt>Campanha</dt><dd>{l.utm_campaign || "—"}</dd></div>
            <div><dt>Conjunto</dt><dd>{l.utm_term || "—"}</dd></div>
            <div><dt>Anúncio</dt><dd>{l.utm_content || "—"}</dd></div>
            <div><dt>Fonte / meio</dt><dd>{[l.utm_source, l.utm_medium].filter(Boolean).join(" / ") || "—"}</dd></div>
            {l.referrer ? <div className="largo"><dt>Veio do site</dt><dd>{l.referrer}</dd></div> : null}
          </dl>
        </div>

        <label className="rotulo">Etapa</label>
        <div className="etapas">
          {ETAPAS.map((e) => (
            <button key={e.id} className={`chip${f.etapa === e.id ? " ativo" : ""}`} onClick={() => setF({ ...f, etapa: e.id })}>{e.nome}</button>
          ))}
        </div>

        <div className="grade">
          <label>Profissional
            <select className="campo" value={f.responsavel} onChange={set("responsavel")}>
              <option value="">—</option>
              {RESPONSAVEIS.map((p) => <option key={p}>{p}</option>)}
            </select>
          </label>
          <label>Protocolo
            <select className="campo" value={f.protocolo} onChange={set("protocolo")}>
              <option value="">—</option>
              {PROTOCOLOS.map((p) => <option key={p}>{p}</option>)}
            </select>
          </label>
          <label>Valor do protocolo (R$)
            <input className="campo" inputMode="decimal" value={f.valor_pedido} onChange={set("valor_pedido")} placeholder="Ex.: 1290" />
          </label>
          <label>Próximo contato
            <input className="campo" type="date" value={f.proximo_contato} onChange={set("proximo_contato")} />
          </label>
          <label>Retorno/manutenção
            <input className="campo" type="date" value={f.data_reposicao} onChange={set("data_reposicao")} />
          </label>
        </div>

        {f.etapa === "perdido" ? (
          <label className="bloco">Motivo da perda
            <select className="campo" value={f.motivo_perda} onChange={set("motivo_perda")}>
              <option value="">—</option>
              {MOTIVOS_PERDA.map((m) => <option key={m}>{m}</option>)}
            </select>
          </label>
        ) : null}

        <label className="bloco">Anotações
          <textarea className="campo" rows={4} value={f.notas} onChange={set("notas")} placeholder="Áreas avaliadas, protocolo combinado, forma de pagamento..." />
        </label>

        {f.etapa === "fechou" ? (
          <p className="aviso">
            {l.evento_compra_enviado
              ? "A compra deste lead já foi enviada pro Meta."
              : "Ao salvar como Fechou, o valor do protocolo vai pro Meta como evento de Compra (uma vez só)."}
          </p>
        ) : null}

        <div className="ficha-acoes">
          <button className="botao" onClick={salvar} disabled={salvando}>{salvando ? "Salvando..." : "Salvar"}</button>
          {msg ? <p className="msg">{msg}</p> : null}
        </div>

        <details className="respostas">
          <summary>Respostas do quiz</summary>
          <dl>
            <div><dt>O que incomoda</dt><dd>{r.incomodo}</dd></div>
            <div><dt>Cascavel ou região</dt><dd>{r.regiao}</dd></div>
            <div><dt>Já tentou</dt><dd>{r.tentou}</dd></div>
            <div><dt>Quando quer começar</dt><dd>{r.quando}</dd></div>
            <div><dt>Investimento</dt><dd>{r.investimento}</dd></div>
            <div><dt>Melhor período</dt><dd>{r.periodo}</dd></div>
          </dl>
        </details>
      </aside>
    </div>
  );
}

function Origens({ leads, agrupar, setAgrupar }) {
  const grupos = {};
  leads.forEach((l) => {
    const chave = (agrupar === "origem" ? origemDe(l) : l[agrupar]) || `Sem UTM · ${origemDe(l)}`;
    const g = (grupos[chave] ||= { nome: chave, leads: 0, qualificados: 0, fechados: 0, valor: 0 });
    g.leads += 1;
    if (l.qualificado) g.qualificados += 1;
    if (l.etapa === "fechou") { g.fechados += 1; g.valor += Number(l.valor_pedido || 0); }
  });
  const linhas = Object.values(grupos).sort((a, b) => b.valor - a.valor || b.fechados - a.fechados || b.leads - a.leads);
  const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : "—");

  return (
    <section className="origens">
      <div className="filtros">
        <span className="rotulo-inline">Agrupar por</span>
        {AGRUPAR.map((a) => (
          <button key={a.id} className={`chip${agrupar === a.id ? " ativo" : ""}`} onClick={() => setAgrupar(a.id)}>{a.nome}</button>
        ))}
      </div>
      <div className="tabela-wrap">
        <table className="tabela">
          <thead><tr><th>{AGRUPAR.find((a) => a.id === agrupar)?.nome}</th><th>Leads</th><th>Qualificados</th><th>% qualif.</th><th>Fechamentos</th><th>Lead → fechou</th><th>Faturamento</th></tr></thead>
          <tbody className="sem-clique">
            {linhas.map((g) => (
              <tr key={g.nome}>
                <td><strong>{g.nome}</strong></td>
                <td>{g.leads}</td>
                <td>{g.qualificados}</td>
                <td>{pct(g.qualificados, g.leads)}</td>
                <td>{g.fechados}</td>
                <td>{pct(g.fechados, g.leads)}</td>
                <td>{g.valor ? fmtReal(g.valor) : "—"}</td>
              </tr>
            ))}
            {!linhas.length ? <tr><td colSpan={7} className="vazio">Nenhum lead ainda</td></tr> : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import { avaliar, buscarPasso, normalizarTelefone } from "../lib/scoring";

function lerCookie(nome) {
  return document.cookie.match(new RegExp(`(?:^|; )${nome}=([^;]+)`))?.[1];
}

const UTMS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
const ORIGEM_DIAS = 30;

// Origem do lead: UTMs do link. Guarda o primeiro clique por 30 dias,
// pra quem volta depois sem parâmetros continuar atribuído ao anúncio.
function lerOrigem() {
  const params = new URLSearchParams(window.location.search);
  const atual = {};
  UTMS.forEach((k) => { const v = params.get(k); if (v) atual[k] = v.slice(0, 200); });
  const referrer = document.referrer && !document.referrer.includes(window.location.host) ? document.referrer.slice(0, 300) : "";
  if (referrer) atual.referrer = referrer;

  let salva = null;
  try {
    const bruto = JSON.parse(localStorage.getItem("ls_origem") || "null");
    if (bruto && Date.now() - bruto.em < ORIGEM_DIAS * 864e5) salva = bruto.dados;
  } catch {}

  if (atual.utm_source || atual.utm_campaign) {
    try { localStorage.setItem("ls_origem", JSON.stringify({ em: Date.now(), dados: atual })); } catch {}
    return atual;
  }
  return salva || atual;
}

function novoId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// "45999999999" -> "(45) 99999-9999", formatando enquanto digita.
function mascaraTelefone(valor) {
  const d = String(valor || "").replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : "";
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export default function Quiz({ config, whatsappNumero }) {
  const total = config.ordem.length + 1; // + tela de contato
  const [etapa, setEtapa] = useState(-1); // -1 = capa
  const [respostas, setRespostas] = useState({});
  const [contato, setContato] = useState({ nome: "", whatsapp: "" });
  const [consentimento, setConsentimento] = useState(false);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [linkWhats, setLinkWhats] = useState(""); // preenchido = tela final
  const [tracking, setTracking] = useState({});

  // Prioridade nº 1: capturar fbp / fbc / fbclid na entrada.
  useEffect(() => {
    const fbclid = new URLSearchParams(window.location.search).get("fbclid");
    let fbc = lerCookie("_fbc");
    if (!fbc && fbclid) {
      fbc = `fb.1.${Date.now()}.${fbclid}`;
      document.cookie = `_fbc=${fbc}; path=/; max-age=7776000; SameSite=Lax`;
    }
    setTracking({ fbclid: fbclid || undefined, fbc, origem: lerOrigem() });
  }, []);

  // Tela final: abre o WhatsApp sozinho depois de 2 segundos.
  useEffect(() => {
    if (!linkWhats) return;
    const timer = setTimeout(() => { window.location.href = linkWhats; }, 2000);
    return () => clearTimeout(timer);
  }, [linkWhats]);

  // Todas seguem até o contato: quem reprova num gate também vira Lead e vai pro WhatsApp,
  // só não dispara LeadQualificado.
  function escolher(id, label) {
    setRespostas({ ...respostas, [id]: label });
    setEtapa(etapa + 1);
  }

  async function enviar(e) {
    e.preventDefault();
    setErro("");
    const telefone = normalizarTelefone(contato.whatsapp);
    if (!contato.nome.trim()) return setErro("Digite seu nome.");
    if (!telefone) return setErro("Digite seu WhatsApp com DDD.");
    if (!consentimento) return setErro("Marque a autorização para continuar.");

    setEnviando(true);
    const { qualificado } = avaliar(config, respostas);
    const eventId = novoId();

    // Pixel (browser) com o MESMO event_id usado no CAPI, para deduplicar.
    if (window.fbq) {
      window.fbq("track", config.nome_evento_lead, {}, { eventID: eventId });
      if (qualificado) {
        window.fbq("trackCustom", config.nome_evento_qualificado, {}, { eventID: `${eventId}-q` });
      }
    }

    const payload = {
      respostas,
      contato,
      consentimento,
      eventId,
      fbp: lerCookie("_fbp"),
      fbc: tracking.fbc || lerCookie("_fbc"),
      fbclid: tracking.fbclid,
      origem: tracking.origem || {},
      url: window.location.href,
    };
    try {
      const controle = new AbortController();
      const timer = setTimeout(() => controle.abort(), 4000);
      await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
        signal: controle.signal,
      });
      clearTimeout(timer);
    } catch {
      // Mesmo se a API demorar, a cliente segue para o WhatsApp.
    }

    const texto =
      `Oi! Fiz o quiz da Avaliação Sob Medida 🤍\n` +
      `Nome: ${contato.nome.trim()}\n` +
      `O que me incomoda: ${respostas.incomodo}\n` +
      `Já tentei: ${respostas.tentou}\n` +
      `Quero começar: ${respostas.quando}\n` +
      `Investimento: ${respostas.investimento}\n` +
      `Melhor período: ${respostas.periodo}`;
    setLinkWhats(`https://wa.me/${whatsappNumero}?text=${encodeURIComponent(texto)}`);
  }

  if (linkWhats) {
    return (
      <main className="tela">
        <section className="cartao centro">
          <img className="logo" src="/logo.png" alt="Clínica Alma" />
          <h1>Pronto, {contato.nome.trim()}!</h1>
          <p className="sub">
            Toque no botão e fale com a gente no WhatsApp para escolher o melhor horário da sua avaliação 🤍
          </p>
          <a className="botao" href={linkWhats}>Falar no WhatsApp</a>
        </section>
      </main>
    );
  }

  if (etapa === -1) {
    return (
      <main className="tela">
        <section className="cartao centro">
          <img className="logo" src="/logo.png" alt="Clínica Alma" />
          <h1>Avaliação Sob Medida</h1>
          <p className="sub">
            Antes de qualquer procedimento, a gente avalia o seu corpo. Responda 6 perguntas rápidas e garanta sua
            avaliação gratuita com a Kamilla e a Nicoly.
          </p>
          <button className="botao" onClick={() => setEtapa(0)}>Começar</button>
          <p className="nota">Clínica Alma · Cascavel, PR</p>
        </section>
      </main>
    );
  }

  const progresso = Math.round(((etapa + 1) / total) * 100);
  const barra = (
    <div className="progresso" aria-label={`Etapa ${etapa + 1} de ${total}`}>
      <div style={{ width: `${progresso}%` }} />
    </div>
  );

  if (etapa < config.ordem.length) {
    const passo = buscarPasso(config, config.ordem[etapa]);
    return (
      <main className="tela">
        <section className="cartao">
          {barra}
          <p className="contador">{etapa + 1} de {total}</p>
          <h2>{passo.texto}</h2>
          <div className="opcoes">
            {passo.opcoes.map((o) => (
              <button
                key={o.label}
                className={`opcao${respostas[passo.id] === o.label ? " marcada" : ""}`}
                onClick={() => escolher(passo.id, o.label)}
              >
                {o.label}
              </button>
            ))}
          </div>
          {etapa > 0 ? (
            <button className="link" onClick={() => setEtapa(etapa - 1)}>Voltar</button>
          ) : null}
        </section>
      </main>
    );
  }

  return (
    <main className="tela">
      <section className="cartao">
        {barra}
        <p className="contador">{total} de {total}</p>
        <h2>Pra gente te chamar no WhatsApp</h2>
        <form onSubmit={enviar} className="form">
          <label>Seu nome
            <input className="campo" value={contato.nome} autoComplete="name"
              onChange={(e) => setContato({ ...contato, nome: e.target.value })} />
          </label>
          <label>WhatsApp com DDD
            <input className="campo" value={contato.whatsapp} inputMode="tel" autoComplete="tel"
              placeholder="(45) 99999-9999"
              onChange={(e) => setContato({ ...contato, whatsapp: mascaraTelefone(e.target.value) })} />
          </label>
          <label className="consentimento">
            <input type="checkbox" checked={consentimento} onChange={(e) => setConsentimento(e.target.checked)} />
            <span>
              Autorizo a Clínica Alma a usar meu nome, meu WhatsApp e as respostas deste quiz, inclusive a área que me
              incomoda, para entrar em contato sobre a avaliação gratuita, conforme a{" "}
              <a href="/politica-de-privacidade.html" target="_blank" rel="noreferrer">Política de Privacidade</a>.
              Posso retirar essa autorização a qualquer momento.
            </span>
          </label>
          {erro ? <p className="erro">{erro}</p> : null}
          <button className="botao" type="submit" disabled={enviando}>
            {enviando ? "Enviando..." : "Garantir minha avaliação"}
          </button>
        </form>
        <button className="link" onClick={() => setEtapa(etapa - 1)}>Voltar</button>
      </section>
    </main>
  );
}

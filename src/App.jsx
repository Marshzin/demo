import React, { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import Barcode from "react-barcode";
import "./styles.css";

/*
  Usuarios / lojas:
  - Senha padrão: 1234
  - Senha admin: demo1234
*/
const ACCOUNTS = [
  { usuario: "NovoShopping", loja: "NovoShopping", isAdmin: false },
  { usuario: "RibeiraoShopping", loja: "RibeiraoShopping", isAdmin: false },
  { usuario: "DomPedro", loja: "DomPedro", isAdmin: false },
  { usuario: "Iguatemi", loja: "Iguatemi", isAdmin: false },
  { usuario: "Administrador", loja: "Administrador", isAdmin: true },
];

const SENHA_PADRAO = "1234";
const SENHA_ADMIN = "demo1234";
const LOJAS = ["NovoShopping", "RibeiraoShopping", "DomPedro", "Iguatemi"];
const LS_PEDIDOS_KEY = "pedidosERP_v1";
const LOGO_URL = "/logo.jpeg"; // ajuste se necessário

export default function App() {
  // Auth
  const [logado, setLogado] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [usuarioAtual, setUsuarioAtual] = useState(null);

  // UI / tabs
  const [abaAtiva, setAbaAtiva] = useState("transferencia"); // transferencia | pedidos | admin

  // itens carregados do xls
  const [catalogo, setCatalogo] = useState([]);

  // pedidos armazenados (array)
  const [pedidos, setPedidos] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_PEDIDOS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // transferencia inputs
  const [destinatario, setDestinatario] = useState(LOJAS[0]);
  const [vendedor, setVendedor] = useState("");
  const [manualCodigo, setManualCodigo] = useState("");

  // admin view select
  const [lojaSelecionada, setLojaSelecionada] = useState(LOJAS[0]);

  // notificacao {msg, tipo: 'sucesso'|'erro'} ou null
  const [notificacao, setNotificacao] = useState(null);

  // scanner buffer refs
  const scannerBuffer = useRef("");
  const scannerTimeout = useRef(null);
  const ultimaTransferencia = useRef({ codigoProduto: null, destinatario: null, timestamp: 0 });

  // modal de histórico de enviados
  const [showHistorico, setShowHistorico] = useState(false);

  // load itens.xls on mount
  useEffect(() => {
    fetch("/itens.xls")
      .then((res) => res.arrayBuffer())
      .then((data) => {
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        const list = rows.map((row, idx) => {
          const codigoProduto = String(row["Código Produto"] ?? "").trim();
          const cbRaw = String(row["Códigos de Barras"] ?? "");
          const codigosBarras = cbRaw
            .split("|")
            .map((c) => c.trim())
            .filter((c) => c.length > 0)
            .map((c) => c.replace(/[^\dA-Za-z]/g, "").trim());
          const codigoBarra = codigosBarras.length > 0 ? [...codigosBarras].sort((a, b) => b.length - a.length)[0] : codigoProduto;
          const descricao = String(row["Descrição Completa"] ?? "Sem descrição").trim();
          const referencia = String(row["Referência"] ?? "").trim();

          return {
            id: `${codigoProduto}-${idx}`,
            codigoProduto,
            codigosBarras,
            codigoBarra,
            descricao,
            referencia,
            raw: row,
          };
        });
        setCatalogo(list);
      })
      .catch((err) => {
        console.error("Erro ao carregar itens.xls", err);
        showNotificacao("Erro ao carregar itens.xls — verifique arquivo e colunas.", "erro");
      });
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LS_PEDIDOS_KEY, JSON.stringify(pedidos));
    } catch (e) {
      console.error("Erro ao salvar pedidos no localStorage", e);
    }
  }, [pedidos]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Shift" || e.key === "Control" || e.key === "Alt" || e.key === "Meta") return;
      if (e.key === "Enter") {
        const code = scannerBuffer.current.trim();
        if (code.length > 0) {
          processarCodigo(code);
        } else {
          const manualEl = document.getElementById("manualCodigoInput");
          const manualVal = manualEl ? (manualEl.value || "").trim() : "";
          if (manualVal) processarCodigo(manualVal);
        }
        scannerBuffer.current = "";
        if (scannerTimeout.current) {
          clearTimeout(scannerTimeout.current);
          scannerTimeout.current = null;
        }
      } else if (e.key.length === 1) {
        scannerBuffer.current += e.key;
        if (scannerTimeout.current) clearTimeout(scannerTimeout.current);
        scannerTimeout.current = setTimeout(() => {
          scannerBuffer.current = "";
          scannerTimeout.current = null;
        }, 80);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [catalogo, destinatario, vendedor, usuarioAtual, pedidos]);

  const onManualKeyDown = (e) => {
    if (e.key === "Enter") {
      const v = (e.target.value || "").trim();
      if (v) {
        processarCodigo(v);
        setManualCodigo("");
      }
    }
  };

  const processarCodigo = (valorOriginal) => {
    const valor = String(valorOriginal || "").replace(/[^\w\d]/g, "").trim().toLowerCase();
    if (!valor) return;
    if (!usuarioAtual) {
      showNotificacao("Faça login primeiro.", "erro");
      return;
    }
    if (!destinatario) {
      showNotificacao("Selecione o destinatário (a loja que pediu).", "erro");
      return;
    }
    if (destinatario === usuarioAtual) {
      showNotificacao("Destinatário não pode ser sua própria loja.", "erro");
      return;
    }

    let encontrado = catalogo.find((it) => {
      if (!it) return false;
      if ((it.codigoProduto || "").toLowerCase() === valor) return true;
      if ((it.codigoBarra || "").toLowerCase() === valor) return true;
      if ((it.referencia || "").toLowerCase() === valor) return true;
      if (Array.isArray(it.codigosBarras)) {
        if (it.codigosBarras.some((cb) => (cb || "").toLowerCase() === valor)) return true;
      }
      return false;
    });

    if (!encontrado) {
      encontrado = catalogo.find((it) => it.codigosBarras && it.codigosBarras.some((cb) => cb.toLowerCase().endsWith(valor)));
    }

    if (!encontrado) {
      showNotificacao(`Produto não encontrado: ${valorOriginal}`, "erro");
      return;
    }

    const agora = Date.now();
    if (
      ultimaTransferencia.current.codigoProduto === encontrado.codigoProduto &&
      ultimaTransferencia.current.destinatario === destinatario &&
      agora - ultimaTransferencia.current.timestamp < 500
    ) {
      return;
    }
    ultimaTransferencia.current = {
      codigoProduto: encontrado.codigoProduto,
      destinatario,
      timestamp: agora,
    };

    setVendedor("");

    const novoPedido = {
      id: Date.now().toString() + "-" + Math.random().toString(36).slice(2, 9),
      itemId: encontrado.id,
      codigoProduto: encontrado.codigoProduto,
      codigoBarra: encontrado.codigoBarra,
      codigosBarras: encontrado.codigosBarras,
      descricao: encontrado.descricao,
      referencia: encontrado.referencia,
      destinatario,
      origem: usuarioAtual,
      vendedor: "",
      data: new Date().toISOString(),
    };

    setPedidos((old) => [novoPedido, ...old]);
    showNotificacao(`Item transferido p/ ${destinatario} — ${encontrado.descricao}`, "sucesso");
  };

  const showNotificacao = (msg, tipo = "sucesso") => {
    setNotificacao({ msg, tipo });
    setTimeout(() => setNotificacao(null), 3200);
  };

  const handleLogin = (usuario, senha) => {
    const acc = ACCOUNTS.find((a) => a.usuario === usuario);
    if (!acc) {
      showNotificacao("Usuário inválido", "erro");
      return;
    }
    const ok = acc.isAdmin ? senha === SENHA_ADMIN : senha === SENHA_PADRAO;
    if (!ok) {
      showNotificacao("Senha incorreta", "erro");
      return;
    }
    setUsuarioAtual(acc.usuario);
    setIsAdmin(!!acc.isAdmin);
    setLogado(true);

    const firstOther = LOJAS.find((l) => l !== acc.usuario);
    setDestinatario(firstOther || "");
  };

  const handleLogout = () => {
    setLogado(false);
    setIsAdmin(false);
    setUsuarioAtual(null);
    setAbaAtiva("transferencia");
    setVendedor("");
    setManualCodigo("");
  };

  // admin: delete individual pedido
  const adminExcluir = (id) => {
    if (!window.confirm("Excluir este pedido?")) return;
    setPedidos((old) => old.filter((p) => p.id !== id));
  };

  // pedidos que deverão aparecer na aba "Itens Pedidos" da loja logada:
  const pedidosParaMinhaLoja = pedidos.filter((p) => p.destinatario === usuarioAtual);
  // pedidos enviados por loja (admin view)
  const pedidosEnviadosPorLoja = (loja) => pedidos.filter((p) => p.origem === loja);

  // Histórico de enviados por essa loja
  const historicoEnviados = pedidos.filter((p) => p.origem === usuarioAtual);

  // Excluir do histórico
  const excluirEnviado = (id) => {
    if (!window.confirm("Excluir este item do seu histórico?")) return;
    setPedidos((old) => old.filter((p) => p.id !== id));
  };

  if (!logado) {
    return (
      <div className="erp-root">
        <div className="login-card">
          <img src={LOGO_URL} alt="logo" className="login-logo" />
          <h1 className="login-title">Transferência de Produtos</h1>

          <div className="login-row">
            <select id="loginSelect" defaultValue={ACCOUNTS[0].usuario} className="login-select" onChange={(e) => setUsuarioAtual(e.target.value)}>
              {ACCOUNTS.map((a) => (
                <option key={a.usuario} value={a.usuario}>
                  {a.usuario}
                </option>
              ))}
            </select>
          </div>

          <div className="login-row">
            <input
              type="password"
              placeholder="Senha"
              className="login-input"
              value={manualCodigo}
              onChange={(e) => setManualCodigo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleLogin(document.getElementById("loginSelect").value, manualCodigo);
                  setManualCodigo("");
                }
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <button
              className="btn primary"
              onClick={() => {
                const sel = document.getElementById("loginSelect").value;
                handleLogin(sel, manualCodigo);
                setManualCodigo("");
              }}
            >
              Entrar
            </button>
            <button
              className="btn"
              onClick={() => {
                alert("Logins: NovoShopping, RibeiraoShopping, DomPedro, Iguatemi (senha 1234). Admin: Administrador (senha demo1234).");
              }}
            >
              Ajuda
            </button>
          </div>

          {notificacao && (
            <div className={`notif ${notificacao.tipo}`}>
              {notificacao.msg}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="erp-root">
      <header className="erp-header">
        <div className="erp-left">
          <img src={LOGO_URL} alt="logo" className="erp-logo" />
          <div>
            <div className="erp-title">Democrata - Transferência por Código ou Referência</div>
            <div className="erp-sub">Painel de Transferência</div>
          </div>
        </div>
        <div className="erp-right" style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "end" }}>
          <div className="erp-user">{usuarioAtual}</div>
          <button className="btn danger" onClick={handleLogout} style={{ zIndex: 1 }}>
            Sair
          </button>
        </div>
      </header>

      <nav className="erp-tabs">
        <button className={abaAtiva === "transferencia" ? "tab active" : "tab"} onClick={() => setAbaAtiva("transferencia")}>Transferência</button>
        <button className={abaAtiva === "pedidos" ? "tab active" : "tab"} onClick={() => setAbaAtiva("pedidos")}>Itens Pedidos</button>
        {isAdmin && <button className={abaAtiva === "admin" ? "tab active" : "tab"} onClick={() => setAbaAtiva("admin")}>Administração</button>}
      </nav>

      <main className="erp-main">
        {abaAtiva === "transferencia" && (
          <section className="card">
            <h3>Registrar / Bipar Item</h3>
            <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 12 }}>
              <label style={{ fontWeight: 700 }}>Destinatário (quem pediu):</label>
              <select value={destinatario} onChange={(e) => setDestinatario(e.target.value)} className="erpf-select">
                <option value="">-- selecione --</option>
                {LOJAS.filter((l) => l !== usuarioAtual).map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
              <label style={{ fontWeight: 700 }}>Vendedor:</label>
              <input value={vendedor} onChange={(e) => setVendedor(e.target.value)} className="erpf-input" placeholder="Nome do vendedor" />
            </div>
            <div style={{ marginTop: 8 }}>
              <input
                id="manualCodigoInput"
                value={manualCodigo}
                onChange={(e) => { setManualCodigo(e.target.value); }}
                onKeyDown={onManualKeyDown}
                placeholder="Aproxime o leitor de código ou digite o código e pressione Enter"
                className="erpf-input large"
                autoFocus
              />
              <div style={{ color: "#666", marginTop: 8, fontSize: 13 }}>Ao bipar o código, o item será registrado automaticamente para o destinatário selecionado.</div>
            </div>
          </section>
        )}

        {abaAtiva === "pedidos" && (
          <section className="card">
            <h3>Itens Pedidos para {usuarioAtual}</h3>
            {pedidosParaMinhaLoja.length === 0 ? (
              <p style={{ color: "#666" }}>Nenhum item registrado para sua loja.</p>
            ) : (
              <div className="grid">
                {pedidosParaMinhaLoja.map((p) => (
                  <div className="grid-card" key={p.id}>
                    <div className="grid-card-title">{p.descricao}</div>
                    <div className="grid-card-sub">Ref: {p.referencia}</div>
                    <div className="grid-card-sub">Cód: {p.codigoBarra}</div>
                    <div className="grid-card-sub">Vendedor: {p.vendedor}</div>
                    <div className="grid-card-sub small">Registrado por: {p.origem} • {new Date(p.data).toLocaleString()}</div>
                    <div style={{ marginTop: 6 }}><Barcode value={String(p.codigoBarra)} height={40} width={1.4} /></div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Administração — só para Administrador */}
        {abaAtiva === "admin" && isAdmin && usuarioAtual === "Administrador" && (
          <section className="card">
            <h3>Administração</h3>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
              <label style={{ fontWeight: 700 }}>Ver pedidos enviados por:</label>
              <select value={lojaSelecionada} onChange={(e) => setLojaSelecionada(e.target.value)} className="erpf-select">
                {LOJAS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              {pedidosEnviadosPorLoja(lojaSelecionada).length === 0 ? (
                <p style={{ color: "#666" }}>Nenhum pedido enviado por {lojaSelecionada}.</p>
              ) : (
                <div className="grid">
                  {pedidosEnviadosPorLoja(lojaSelecionada).map((p) => (
                    <div className="grid-card" key={p.id}>
                      <div className="grid-card-title">{p.descricao}</div>
                      <div className="grid-card-sub">Ref: {p.referencia}</div>
                      <div className="grid-card-sub">Cód: {p.codigoBarra}</div>
                      <div className="grid-card-sub">Destinatário: {p.destinatario}</div>
                      <div className="grid-card-sub small">Vendedor: {p.vendedor} • {new Date(p.data).toLocaleString()}</div>
                      <div style={{ marginTop: 8 }}>
                        <Barcode value={String(p.codigoBarra)} height={40} width={1.4} />
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <button className="btn danger" onClick={() => adminExcluir(p.id)}>Excluir</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      {/* notificacao bottom-right */}
      {notificacao && (
        <div className={`toast ${notificacao.tipo}`}>
          {notificacao.msg}
        </div>
      )}
    </div>
  );
}

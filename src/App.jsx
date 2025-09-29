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
const LOGO_URL = "/logo.jpeg";

export default function App() {
  const [logado, setLogado] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [usuarioAtual, setUsuarioAtual] = useState(null);
  const [abaAtiva, setAbaAtiva] = useState("transferencia");
  const [catalogo, setCatalogo] = useState([]);
  const [pedidos, setPedidos] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_PEDIDOS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Transferência inputs
  // Para admin: precisa de remetente, para loja normal não
  const [remetente, setRemetente] = useState(LOJAS[0]);
  const [destinatario, setDestinatario] = useState(LOJAS[1]);
  const [vendedor, setVendedor] = useState("");
  const [manualCodigo, setManualCodigo] = useState("");
  // Admin view select
  const [lojaSelecionada, setLojaSelecionada] = useState(LOJAS[0]);
  // Notificação
  const [notificacao, setNotificacao] = useState(null);

  // Scanner buffer refs
  const scannerBuffer = useRef("");
  const scannerTimeout = useRef(null);
  const ultimaTransferencia = useRef({ codigoProduto: null, destinatario: null, remetente: null, timestamp: 0 });

  // Modal de histórico de enviados
  const [showHistorico, setShowHistorico] = useState(false);

  // Load itens.xls on mount
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
  }, [catalogo, destinatario, remetente, vendedor, usuarioAtual, pedidos]);

  const onManualKeyDown = (e) => {
    if (e.key === "Enter") {
      const v = (e.target.value || "").trim();
      if (v) {
        processarCodigo(v);
        setManualCodigo("");
      }
    }
  };

  // Para admin: requer remetente, para loja: é sempre a loja logada
  const processarCodigo = (valorOriginal) => {
    const valor = String(valorOriginal || "").replace(/[^\w\d]/g, "").trim().toLowerCase();
    if (!valor) return;
    if (!usuarioAtual) {
      showNotificacao("Faça login primeiro.", "erro");
      return;
    }
    // ADMIN: requer remetente e destinatario. Loja: só destinatario.
    const remetenteValidado = isAdmin && usuarioAtual === 'Administrador' ? remetente : usuarioAtual;
    if (!remetenteValidado || !destinatario) {
      showNotificacao("Selecione o remetente e destinatário.", "erro");
      return;
    }
    if (remetenteValidado === destinatario) {
      showNotificacao("Remetente e destinatário não podem ser a mesma loja.", "erro");
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
      ultimaTransferencia.current.remetente === remetenteValidado &&
      agora - ultimaTransferencia.current.timestamp < 500
    ) {
      return;
    }
    ultimaTransferencia.current = {
      codigoProduto: encontrado.codigoProduto,
      destinatario,
      remetente: remetenteValidado,
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
      remetente: remetenteValidado,
      origem: remetenteValidado,
      vendedor: "",
      data: new Date().toISOString(),
    };

    setPedidos((old) => [novoPedido, ...old]);
    showNotificacao(`Item transferido de ${remetenteValidado} p/ ${destinatario} — ${encontrado.descricao}`, "sucesso");
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

    // Para admin: padrão é primeiro da lista, destinatario é o próximo
    if (acc.isAdmin) {
      setRemetente(LOJAS[0]);
      setDestinatario(LOJAS[1]);
    } else {
      const firstOther = LOJAS.find((l) => l !== acc.usuario);
      setDestinatario(firstOther || "");
    }
  };

  const handleLogout = () => {
    setLogado(false);
    setIsAdmin(false);
    setUsuarioAtual(null);
    setAbaAtiva("transferencia");
    setVendedor("");
    setManualCodigo("");
    setRemetente(LOJAS[0]);
    setDestinatario(LOJAS[1]);
  };

  // admin: delete individual pedido
  const adminExcluir = (id) => {
    if (!window.confirm("Excluir este pedido?")) return;
    setPedidos((old) => old.filter((p) => p.id !== id));
  };

  // pedidos que deverão aparecer na aba "Itens Pedidos" da loja logada:
  const pedidosParaMinhaLoja = pedidos.filter((p) => p.destinatario === usuarioAtual);

  // pedidos enviados por loja (admin view)
  const pedidosEnviadosPorLoja = (loja) => pedidos.filter((p) => p.remetente === loja);

  // Histórico de enviados por essa loja
  const historicoEnviados = pedidos.filter((p) => p.remetente === usuarioAtual);

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
          {/* Só mostra o ícone de ? para LOJA, não para admin */}
          {(!isAdmin || usuarioAtual !== "Administrador") && (
            <button
              title="Histórico de itens enviados"
              style={{
                background: "none",
                border: "none",
                padding: 0,
                marginTop: 4,
                cursor: "pointer",
                fontSize: 18,
                color: "#555",
                width: 22,
                height: 22,
              }}
              onClick={() => setShowHistorico(true)}
            >
              <span aria-label="Histórico" style={{ fontSize: "1em" }}>❓</span>
            </button>
          )}
        </div>
      </header>

      <nav className="erp-tabs">
        <button className={abaAtiva === "transferencia" ? "tab active" : "tab"} onClick={() => setAbaAtiva("transferencia")}>Transferência</button>
        <button className={abaAtiva === "pedidos" ? "tab active" : "tab"} onClick={() => setAbaAtiva("pedidos")}>Itens Pedidos</button>
        {isAdmin && <button className={abaAtiva === "admin" ? "tab active" : "tab"} onClick={() => setAbaAtiva("admin")}>Administração</button>}
      </nav>

      <main className="erp-main">
        {/* Transferência: admin tem Remetente, loja não */}
        {abaAtiva === "transferencia" && (
          <section className="card">
            <h3>Registrar / Bipar Item</h3>
            <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 12 }}>
              {/* Só mostra remetente para admin */}
              {isAdmin && usuarioAtual === "Administrador" && (
                <>
                  <label style={{ fontWeight: 700 }}>Remetente (quem envia):</label>
                  <select value={remetente} onChange={(e) => setRemetente(e.target.value)} className="erpf-select">
                    <option value="">-- selecione --</option>
                    {LOJAS.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </>
              )}
              <label style={{ fontWeight: 700 }}>Destinatário (quem pediu):</label>
              <select value={destinatario} onChange={(e) => setDestinatario(e.target.value)} className="erpf-select">
                <option value="">-- selecione --</option>
                {LOJAS.filter((l) => (isAdmin && usuarioAtual === "Administrador" ? l !== remetente : l !== usuarioAtual)).map((l) => <option key={l} value={l}>{l}</option>)}
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
                    <div className="grid-card-sub small">Remetente: {p.remetente} • {new Date(p.data).toLocaleString()}</div>
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

      {/* Modal Histórico de enviados com scroll */}
      {showHistorico && (
        <div
          style={{
            position: "fixed",
            left: 0,
            top: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.15)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
          onClick={() => setShowHistorico(false)}
        >
          <div
            style={{
              background: "white",
              borderRadius: 8,
              padding: 24,
              minWidth: 320,
              maxWidth: 440,
              maxHeight: "80vh",
              boxShadow: "0 2px 14px rgba(0,0,0,0.18)",
              position: "relative",
              display: "flex",
              flexDirection: "column"
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 10 }}>Histórico de itens enviados</div>
            <div style={{
              flex: 1,
              overflowY: "auto",
              maxHeight: "52vh",
              marginBottom: 8
            }}>
              {historicoEnviados.length === 0 ? (
                <div style={{ color: "#666" }}>Nenhum item enviado por esta loja.</div>
              ) : (
                <div>
                  {historicoEnviados.map(p => (
                    <div key={p.id} style={{
                      border: "1px solid #eee",
                      borderRadius: 5,
                      padding: 10,
                      marginBottom: 12,
                      fontSize: 15,
                      background: "#f7fbff",
                      position: "relative"
                    }}>
                      <div style={{ fontWeight: 600 }}>{p.descricao}</div>
                      <div style={{ fontSize: 13 }}>Ref: {p.referencia}</div>
                      <div style={{ fontSize: 13 }}>Cód: {p.codigoBarra}</div>
                      <div style={{ fontSize: 12, color: "#888" }}>Destinatário: {p.destinatario}</div>
                      <div style={{ fontSize: 12, color: "#888" }}>Data: {new Date(p.data).toLocaleString()}</div>
                      <div style={{ marginTop: 3 }}>
                        <Barcode value={String(p.codigoBarra)} height={28} width={1.2} fontSize={11} />
                      </div>
                      <button
                        className="btn danger"
                        style={{ position: "absolute", right: 10, top: 10, fontSize: 12, padding: "2px 7px" }}
                        onClick={() => excluirEnviado(p.id)}
                      >
                        Excluir
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button
              className="btn"
              style={{ marginTop: 10, width: "100%" }}
              onClick={() => setShowHistorico(false)}
            >
              Fechar
            </button>
          </div>
        </div>
      )}
      {notificacao && (
        <div className={`toast ${notificacao.tipo}`}>
          {notificacao.msg}
        </div>
      )}
    </div>
  );
}

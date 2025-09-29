import React, { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import Barcode from "react-barcode";
import "./styles.css";

/*
  Usuarios / lojas:
  - NovoShopping: 123
  - RibeiraoShopping: 000
  - DomPedro: 456
  - Iguatemi: 789
  - Administrador: demo1234
*/
const ACCOUNTS = [
  { usuario: "NovoShopping", loja: "NovoShopping", isAdmin: false },
  { usuario: "RibeiraoShopping", loja: "RibeiraoShopping", isAdmin: false },
  { usuario: "DomPedro", loja: "DomPedro", isAdmin: false },
  { usuario: "Iguatemi", loja: "Iguatemi", isAdmin: false },
  { usuario: "Administrador", loja: "Administrador", isAdmin: true },
];

const SENHAS_LOJAS = {
  NovoShopping: "123",
  RibeiraoShopping: "000",
  DomPedro: "456",
  Iguatemi: "789",
  Administrador: "demo1234"
};

const LOJAS = ["NovoShopping", "RibeiraoShopping", "DomPedro", "Iguatemi"];
const LS_PEDIDOS_KEY = "pedidosERP_v1";
const LOGO_URL = "/logo.jpeg"; // ajuste se necessário

// Restaurar login salvo
const savedUsuario = localStorage.getItem("erp_usuarioAtual");
const savedIsAdmin = localStorage.getItem("erp_isAdmin") === "1";

export default function App() {
  // Auth
  const [logado, setLogado] = useState(!!savedUsuario);
  const [isAdmin, setIsAdmin] = useState(savedIsAdmin);
  const [usuarioAtual, setUsuarioAtual] = useState(savedUsuario || null);

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
  const [remetente, setRemetente] = useState(LOJAS[0]);
  const [destinatario, setDestinatario] = useState(LOJAS[1]);
  const [vendedor, setVendedor] = useState("");
  const [manualCodigo, setManualCodigo] = useState("");

  // admin view select
  const [lojaSelecionada, setLojaSelecionada] = useState(LOJAS[0]);

  // notificacao {msg, tipo: 'sucesso'|'erro'} ou null
  const [notificacao, setNotificacao] = useState(null);

  // scanner buffer refs
  const scannerBuffer = useRef("");
  const scannerTimeout = useRef(null);
  const ultimaTransferencia = useRef({ codigoProduto: null, destinatario: null, remetente: null, timestamp: 0 });

  // modal de histórico de enviados
  const [showHistorico, setShowHistorico] = useState(false);

  // modal de cadastro manual de item não encontrado
  const [showProdutoManual, setShowProdutoManual] = useState(false);
  const [referenciaManual, setReferenciaManual] = useState("");
  const [numeracaoManual, setNumeracaoManual] = useState("");
  const [solicitanteManual, setSolicitanteManual] = useState("");
  const [codigoNaoEncontrado, setCodigoNaoEncontrado] = useState("");

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
            .map((c) => c.replace(/[^0-9A-Za-z]/g, "").trim())
            .filter((c) => c.length > 0);
          // Pega o código de barras mais longo (ou o de 13 dígitos se houver)
          const codigoBarra =
            codigosBarras.find(cb => cb.length === 13) ||
            codigosBarras.sort((a, b) => b.length - a.length)[0] ||
            codigoProduto;
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

  const processarCodigo = (valorOriginal) => {
    const valor = String(valorOriginal || "").replace(/[^\w\d]/g, "").trim().toLowerCase();
    if (!valor) return;
    if (!usuarioAtual) {
      showNotificacao("Faça login primeiro.", "erro");
      return;
    }
    const remetenteValidado = (isAdmin && usuarioAtual === 'Administrador') ? remetente : usuarioAtual;
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
      if ((it.codigoProduto || "").replace(/[^\w\d]/g, "").trim().toLowerCase() === valor) return true;
      if ((it.codigoBarra || "").replace(/[^\w\d]/g, "").trim().toLowerCase() === valor) return true;
      if ((it.referencia || "").replace(/[^\w\d]/g, "").trim().toLowerCase() === valor) return true;
      if (Array.isArray(it.codigosBarras)) {
        if (it.codigosBarras.some((cb) => cb.replace(/[^\w\d]/g, "").trim().toLowerCase() === valor)) return true;
      }
      return false;
    });

    if (!encontrado) {
      setCodigoNaoEncontrado(valorOriginal);
      setShowProdutoManual(true);
      setReferenciaManual("");
      setNumeracaoManual("");
      setSolicitanteManual("");
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
      vendedor: vendedor.trim(),
      data: new Date().toISOString(),
    };

    setPedidos((old) => [novoPedido, ...old]);
    showNotificacao(`Item transferido de ${remetenteValidado} p/ ${destinatario} — ${encontrado.descricao}`, "sucesso");
  };

  const cadastrarProdutoManual = () => {
    if (!referenciaManual.trim() || !numeracaoManual.trim()) {
      showNotificacao("Preencha todos os campos obrigatórios.", "erro");
      return;
    }
    const remetenteValidado = (isAdmin && usuarioAtual === 'Administrador') ? remetente : usuarioAtual;
    const novoPedido = {
      id: Date.now().toString() + "-" + Math.random().toString(36).slice(2, 9),
      itemId: "manual-" + Date.now(),
      codigoProduto: codigoNaoEncontrado,
      codigoBarra: codigoNaoEncontrado,
      codigosBarras: [codigoNaoEncontrado],
      descricao: `Produto manual - Ref: ${referenciaManual} - Numeração: ${numeracaoManual}`,
      referencia: referenciaManual,
      destinatario,
      remetente: remetenteValidado,
      origem: remetenteValidado,
      vendedor: solicitanteManual.trim(),
      data: new Date().toISOString(),
    };
    setPedidos((old) => [novoPedido, ...old]);
    setShowProdutoManual(false);
    showNotificacao(`Item manual transferido de ${remetenteValidado} p/ ${destinatario} — ${referenciaManual}`, "sucesso");
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
    const senhaCorreta = SENHAS_LOJAS[acc.usuario] || "";
    const ok = senha === senhaCorreta;
    if (!ok) {
      showNotificacao("Senha incorreta", "erro");
      return;
    }
    setUsuarioAtual(acc.usuario);
    setIsAdmin(!!acc.isAdmin);
    setLogado(true);

    localStorage.setItem("erp_usuarioAtual", acc.usuario);
    localStorage.setItem("erp_isAdmin", acc.isAdmin ? "1" : "0");

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
    localStorage.removeItem("erp_usuarioAtual");
    localStorage.removeItem("erp_isAdmin");
  };

  const adminExcluir = (id) => {
    if (!window.confirm("Excluir este pedido?")) return;
    setPedidos((old) => old.filter((p) => p.id !== id));
  };

  const pedidosParaMinhaLoja = pedidos.filter((p) => p.destinatario === usuarioAtual);
  const historicoLojaAdmin = (loja) => pedidos.filter((p) => p.destinatario === loja);
  const historicoEnviados = pedidos.filter((p) => p.remetente === usuarioAtual);

  const excluirEnviado = (id) => {
    if (!window.confirm("Excluir este item do seu histórico?")) return;
    setPedidos((old) => old.filter((p) => p.id !== id));
  };

  const showPedidosTab = !(isAdmin && usuarioAtual === "Administrador");

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
                alert("Logins:\nNovoShopping: 123\nRibeiraoShopping: 000\nDomPedro: 456\nIguatemi: 789\nAdministrador: demo1234");
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
        {showPedidosTab && (
          <button className={abaAtiva === "pedidos" ? "tab active" : "tab"} onClick={() => setAbaAtiva("pedidos")}>Itens Pedidos</button>
        )}
        {isAdmin && <button className={abaAtiva === "admin" ? "tab active" : "tab"} onClick={() => setAbaAtiva("admin")}>Administração</button>}
      </nav>

      <main className="erp-main">
        {abaAtiva === "transferencia" && (
          <section className="card">
            <h3>Registrar / Bipar Item</h3>
            <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 12 }}>
              {isAdmin && usuarioAtual === "Administrador" && (
                <>
                  <label style={{ fontWeight: 700 }}>Remetente:</label>
                  <select value={remetente} onChange={(e) => setRemetente(e.target.value)} className="erpf-select">
                    <option value="">-- selecione --</option>
                    {LOJAS.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </>
              )}
              <label style={{ fontWeight: 700 }}>Destinatário:</label>
              <select value={destinatario} onChange={(e) => setDestinatario(e.target.value)} className="erpf-select">
                <option value="">-- selecione --</option>
                {LOJAS.filter((l) => (isAdmin && usuarioAtual === "Administrador" ? l !== remetente : l !== usuarioAtual)).map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
              <label style={{ fontWeight: 700 }}>Solicitante:</label>
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

        {abaAtiva === "pedidos" && showPedidosTab && (
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
                    <div className="grid-card-sub">Solicitante: {p.vendedor}</div>
                    <div className="grid-card-sub small">{p.remetente} • {new Date(p.data).toLocaleString()}</div>
                    <div style={{ marginTop: 6 }}><Barcode value={String(p.codigoBarra)} height={40} width={1.4} /></div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {abaAtiva === "admin" && isAdmin && usuarioAtual === "Administrador" && (
          <section className="card">
            <h3>Administração</h3>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
              <label style={{ fontWeight: 700 }}>Ver histórico da loja:</label>
              <select value={lojaSelecionada} onChange={(e) => setLojaSelecionada(e.target.value)} className="erpf-select">
                {LOJAS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              {historicoLojaAdmin(lojaSelecionada).length === 0 ? (
                <p style={{ color: "#666" }}>Nenhum item transferido para {lojaSelecionada}.</p>
              ) : (
                <div className="grid">
                  {historicoLojaAdmin(lojaSelecionada).map((p) => (
                    <div className="grid-card" key={p.id}>
                      <div className="grid-card-title">{p.descricao}</div>
                      <div className="grid-card-sub">Ref: {p.referencia}</div>
                      <div className="grid-card-sub">Cód: {p.codigoBarra}</div>
                      <div className="grid-card-sub">Remetente: {p.remetente}</div>
                      <div className="grid-card-sub">Solicitante: {p.vendedor}</div>
                      <div className="grid-card-sub small">Data: {new Date(p.data).toLocaleString()}</div>
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

        {/* MODAL de cadastro manual de produto não encontrado */}
        {showProdutoManual && (
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
            onClick={() => setShowProdutoManual(false)}
          >
            <div
              style={{
                background: "white",
                borderRadius: 8,
                padding: 24,
                minWidth: 320,
                maxWidth: 440,
                boxShadow: "0 2px 14px rgba(0,0,0,0.18)",
                position: "relative",
                display: "flex",
                flexDirection: "column"
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 12, color: "#c00" }}>
                Produto não encontrado
              </div>
              <div style={{ fontSize: 14, color: "#333", marginBottom: 10 }}>
                Código digitado/bipado: <b>{codigoNaoEncontrado}</b>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input
                  placeholder="Referência (obrigatório)"
                  value={referenciaManual}
                  onChange={e => setReferenciaManual(e.target.value)}
                  style={{ padding: 8, border: "1px solid #bbb", borderRadius: 4 }}
                  autoFocus
                />
                <input
                  placeholder="Numeração (obrigatório)"
                  value={numeracaoManual}
                  onChange={e => setNumeracaoManual(e.target.value)}
                  style={{ padding: 8, border: "1px solid #bbb", borderRadius: 4 }}
                />
                <input
                  placeholder="Solicitante"
                  value={solicitanteManual}
                  onChange={e => setSolicitanteManual(e.target.value)}
                  style={{ padding: 8, border: "1px solid #bbb", borderRadius: 4 }}
                />
              </div>
              <button
                className="btn primary"
                style={{ marginTop: 18, width: "100%" }}
                onClick={cadastrarProdutoManual}
              >
                Adicionar item manual
              </button>
              <button
                className="btn"
                style={{ marginTop: 8, width: "100%" }}
                onClick={() => setShowProdutoManual(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

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
                        <div style={{ fontSize: 12, color: "#888" }}>Solicitante: {p.vendedor}</div>
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
      </main>
    </div>
  );
}

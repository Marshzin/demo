// App.jsx
import React, { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import "./styles.css";

const logins = [
  { usuario: "NovoShopping", loja: "NovoShopping", isAdmin: false },
  { usuario: "RibeiraoShopping", loja: "RibeiraoShopping", isAdmin: false },
  { usuario: "DomPedro", loja: "DomPedro", isAdmin: false },
  { usuario: "Iguatemi", loja: "Iguatemi", isAdmin: false },
  { usuario: "Administrador", loja: "Administrador", isAdmin: true },
];

const senhaPadrao = "1234";
const senhaAdmin = "demo1234";
const lojas = ["NovoShopping", "RibeiraoShopping", "DomPedro", "Iguatemi"];
const logoUrl = "/logo.jpeg";
const LS_KEY = "pedidosERP";

export default function App() {
  const [logado, setLogado] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [usuarioAtual, setUsuarioAtual] = useState(null);

  useEffect(() => {
    const storedLogin = localStorage.getItem("logado");
    const storedIsAdmin = localStorage.getItem("isAdmin") === "true";
    const storedUsuario = localStorage.getItem("usuarioAtual");
    if (storedLogin) setLogado(true);
    if (storedIsAdmin) setIsAdmin(true);
    if (storedUsuario) setUsuarioAtual(storedUsuario);
  }, []);

  function handleLogin(usuario, senha) {
    const usuarioEncontrado = logins.find(
      (u) => u.usuario.toLowerCase() === usuario.toLowerCase()
    );
    if (
      usuarioEncontrado &&
      ((usuarioEncontrado.isAdmin && senha === senhaAdmin) ||
        (!usuarioEncontrado.isAdmin && senha === senhaPadrao))
    ) {
      localStorage.setItem("logado", "true");
      localStorage.setItem("isAdmin", usuarioEncontrado.isAdmin ? "true" : "false");
      localStorage.setItem("usuarioAtual", usuarioEncontrado.usuario);

      setLogado(true);
      setIsAdmin(usuarioEncontrado.isAdmin);
      setUsuarioAtual(usuarioEncontrado.usuario);
    } else {
      alert("Usuário ou senha inválidos.");
    }
  }

  function handleLogout() {
    localStorage.removeItem("logado");
    localStorage.removeItem("isAdmin");
    localStorage.removeItem("usuarioAtual");

    setLogado(false);
    setIsAdmin(false);
    setUsuarioAtual(null);
  }

  return logado ? (
    <MainApp onLogout={handleLogout} isAdmin={isAdmin} usuarioAtual={usuarioAtual} />
  ) : (
    <Login onLogin={handleLogin} />
  );
}

function Login({ onLogin }) {
  const [usuario, setUsuario] = useState(logins[0].usuario);
  const [senha, setSenha] = useState("");

  const handleLoginClick = () => onLogin(usuario, senha);

  return (
    <div style={ui.loginPage}>
      <div style={ui.loginCard}>
        <img src={logoUrl} alt="Logo" style={ui.logoLogin} />
        <h1 style={ui.loginTitle}>Transferência de Produtos</h1>

        <select
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          style={ui.input}
        >
          {logins.map((l) => (
            <option key={l.usuario} value={l.usuario}>
              {l.usuario}
            </option>
          ))}
        </select>

        <input
          type="password"
          placeholder="Senha"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          style={ui.input}
        />

        <button onClick={handleLoginClick} style={ui.primaryButton}>
          Entrar
        </button>
      </div>
    </div>
  );
}

function MainApp({ onLogout, isAdmin, usuarioAtual }) {
  const [abaAtiva, setAbaAtiva] = useState("transferencia");
  const [itens, setItens] = useState([]);
  const [pedidos, setPedidos] = useState(() => {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  });
  const [vendedor, setVendedor] = useState("");
  const [codigoDigitado, setCodigoDigitado] = useState("");
  const [destinatario, setDestinatario] = useState(
    lojas.find((l) => l !== usuarioAtual) || lojas[0]
  );
  const [showNotification, setShowNotification] = useState(false);

  const scannerBuffer = useRef("");
  const scannerTimeout = useRef(null);

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(pedidos));
  }, [pedidos]);

  useEffect(() => {
    fetch("/itens.xls")
      .then((res) => res.arrayBuffer())
      .then((data) => {
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        const lista = rows.map((linha, i) => {
          const codigoProduto = String(linha["Código Produto"] ?? "").trim();
          const cbRaw = String(linha["Códigos de Barras"] ?? "");
          const codigosBarras = cbRaw
            .split("|")
            .map((c) => c.trim())
            .filter((c) => c.length > 0)
            .map((c) => c.replace(/[^\dA-Za-z]/g, "").trim());

          let codigoBarra = codigoProduto;
          if (codigosBarras.length > 0) {
            codigosBarras.sort((a, b) => b.length - a.length);
            codigoBarra = codigosBarras[0];
          }

          const descricao = String(linha["Descrição Completa"] ?? "Sem descrição").trim();
          const referencia = String(linha["Referência"] ?? "-").trim();

          return { id: `${codigoProduto}-${i}`, codigo: codigoProduto, codigosBarras, codigoBarra, nome: descricao, referencia };
        });
        setItens(lista);
      })
      .catch((err) => {
        console.error("Erro lendo itens.xls", err);
        alert("Erro ao carregar itens.xls. Verifique o arquivo na pasta public/ e os nomes das colunas.");
      });
  }, []);

  // Scanner de código
  useEffect(() => {
    const onKeyDown = (e) => {
      const active = document.activeElement;
      const activeTag = active && active.tagName && active.tagName.toLowerCase();
      const activeIsInput = activeTag === "input" || activeTag === "textarea" || active.isContentEditable;

      if (e.key === "Enter") {
        const code = scannerBuffer.current.trim();
        if (code.length > 0) {
          processarCodigo(code);
        } else {
          const manual = (document.getElementById("manualCodigoInput") || {}).value;
          if (manual && manual.trim().length > 0) processarCodigo(manual.trim());
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
  }, [itens, destinatario, usuarioAtual, pedidos]);

  const processarCodigo = (valorOriginal) => {
    const valor = String(valorOriginal || "").replace(/[^\w\d]/g, "").trim().toLowerCase();
    if (!valor) return;

    const encontrado = itens.find((it) => {
      if (!it) return false;
      if (String(it.codigo || "").toLowerCase() === valor) return true;
      if (String(it.referencia || "").toLowerCase() === valor) return true;
      if (String(it.codigoBarra || "").toLowerCase() === valor) return true;
      if (Array.isArray(it.codigosBarras)) {
        for (const cb of it.codigosBarras) {
          if (String(cb || "").toLowerCase() === valor) return true;
        }
      }
      return false;
    });

    if (!encontrado) {
      const foundByEnds = itens.find((it) => it.codigosBarras?.some((cb) => cb.toLowerCase().endsWith(valor)));
      if (foundByEnds) {
        registrarPedido(foundByEnds);
        return;
      }
      alert(`Nenhum item encontrado para: ${valorOriginal}`);
      return;
    }
    registrarPedido(encontrado);
  };

  const registrarPedido = (item) => {
    if (!item) return;
    if (!destinatario) return alert("Selecione o destinatário.");

    const novo = {
      id: Date.now() + "-" + Math.random(),
      itemId: item.id,
      codigo: item.codigo,
      codigoBarra: item.codigoBarra,
      nomeItem: item.nome,
      referencia: item.referencia,
      destinatario,
      origem: usuarioAtual,
      vendedor,
      data: new Date().toISOString(),
    };

    setPedidos((old) => [novo, ...old]);
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 3000);
    setCodigoDigitado("");
  };

  const handleManualChange = (e) => setCodigoDigitado(e.target.value);
  const handleManualKeyDown = (e) => e.key === "Enter" && processarCodigo(e.target.value);

  const handleExcluirPedido = (id) => {
    if (window.confirm("Deseja realmente excluir este pedido?")) {
      setPedidos(pedidos.filter((p) => p.id !== id));
    }
  };

  return (
    <div style={ui.appContainer}>
      {/* HEADER */}
      <header style={ui.header}>
        <div style={ui.headerLeft}>
          <img src={logoUrl} alt="Logo" style={ui.logo} />
        </div>
        <div style={ui.headerCenter}>
          <h1 style={ui.title}>Painel de Transferência</h1>
        </div>
        <div style={ui.headerRight}>
          <span style={ui.user}>{usuarioAtual}</span>
          <button onClick={onLogout} style={ui.logoutButton}>Sair</button>
        </div>
      </header>

      {showNotification && <div style={ui.notification}>Produto registrado com sucesso!</div>}

      <nav style={ui.tabs}>
        <button style={abaAtiva === "transferencia" ? ui.tabActive : ui.tab} onClick={() => setAbaAtiva("transferencia")}>Transferência</button>
        <button style={abaAtiva === "pedidos" ? ui.tabActive : ui.tab} onClick={() => setAbaAtiva("pedidos")}>Itens Pedidos</button>
        {isAdmin && <button style={abaAtiva === "admin" ? ui.tabActive : ui.tab} onClick={() => setAbaAtiva("admin")}>Administração</button>}
      </nav>

      <main style={ui.main}>
        {abaAtiva === "transferencia" && (
          <div style={ui.card}>
            <h2 style={ui.cardTitle}>Registrar Pedido</h2>

            <label style={ui.label}>Loja Destinatária</label>
            <select style={ui.input} value={destinatario} onChange={(e) => setDestinatario(e.target.value)}>
              {lojas.filter((l) => l !== usuarioAtual).map((l) => <option key={l} value={l}>{l}</option>)}
            </select>

            <label style={ui.label}>Vendedor</label>
            <input type="text" value={vendedor} onChange={(e) => setVendedor(e.target.value)} style={ui.input} placeholder="Digite o nome do vendedor" />

            <label style={ui.label}>Código do Produto</label>
            <input id="manualCodigoInput" type="text" placeholder="Digite ou cole o código" value={codigoDigitado} onChange={handleManualChange} onKeyDown={handleManualKeyDown} style={ui.input} />
          </div>
        )}

        {abaAtiva === "pedidos" && (
          <div style={ui.card}>
            <h2 style={ui.cardTitle}>Itens Pedidos</h2>
            <table style={ui.table}>
              <thead>
                <tr><th>ID</th><th>Código</th><th>Produto</th><th>Referência</th><th>Destinatário</th><th>Origem</th><th>Vendedor</th><th>Data</th></tr>
              </thead>
              <tbody>
                {pedidos.map(p => <tr key={p.id}><td>{p.id}</td><td>{p.codigo}</td><td>{p.nomeItem}</td><td>{p.referencia}</td><td>{p.destinatario}</td><td>{p.origem}</td><td>{p.vendedor}</td><td>{p.data}</td></tr>)}
              </tbody>
            </table>
          </div>
        )}

        {abaAtiva === "admin" && (
          <div style={ui.card}>
            <h2 style={ui.cardTitle}>Administração - Pedidos por Loja</h2>
            <label style={ui.label}>Filtrar por Loja</label>
            <select style={ui.input} value={destinatario} onChange={e => setDestinatario(e.target.value)}>
              <option value="">Todas</option>
              {lojas.map(l => <option key={l} value={l}>{l}</option>)}
            </select>

            <table style={ui.table}>
              <thead>
                <tr><th>ID</th><th>Código</th><th>Produto</th><th>Referência</th><th>Destinatário</th><th>Origem</th><th>Vendedor</th><th>Data</th><th>Ação</th></tr>
              </thead>
              <tbody>
                {pedidos.filter(p => !destinatario || p.destinatario === destinatario).map(p => (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td>{p.codigo}</td>
                    <td>{p.nomeItem}</td>
                    <td>{p.referencia}</td>
                    <td>{p.destinatario}</td>
                    <td>{p.origem}</td>
                    <td>{p.vendedor}</td>
                    <td>{p.data}</td>
                    <td><button style={ui.deleteButton} onClick={() => handleExcluirPedido(p.id)}>Excluir</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

// ESTILOS (mesmos do código anterior)
const ui = {
  appContainer: { fontFamily: "'Segoe UI', sans-serif", backgroundColor: "#f4f6f9", minHeight: "100vh", display: "flex", flexDirection: "column" },
  header: { position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000, backgroundColor: "#1e40af", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", color: "#fff", boxShadow: "0 3px 10px rgba(0,0,0,0.2)" },
  headerLeft: { display: "flex", alignItems: "center", gap: 12 },
  headerCenter: { textAlign: "center", flex: 1 },
  headerRight: { display: "flex", alignItems: "center", gap: 12 },
  logo: { width: 120, height: 36, objectFit: "contain" },
  title: { fontSize: 22, fontWeight: 600, margin: 0 },
  user: { fontWeight: 500 },
  logoutButton: { backgroundColor: "#ef4444", color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", cursor: "pointer" },
  main: { flex: 1, padding: "100px 24px 24px", display: "flex", justifyContent: "center", alignItems: "flex-start" },
  card: { backgroundColor: "#fff", padding: 24, borderRadius: 12, width: "100%", maxWidth: 800, boxShadow: "0 4px 12px rgba(0,0,0,0.05)" },
  cardTitle: { fontSize: 20, marginBottom: 20 },
  label: { display: "block", marginTop: 12, marginBottom: 6, fontWeight: 500 },
  input: { width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #ccc", fontSize: 15, marginBottom: 12 },
  primaryButton: { width: "100%", padding: "12px", backgroundColor: "#1e40af", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, marginTop: 10 },
  tabs: { display: "flex", gap: 12, marginTop: 80, marginBottom: 16, padding: "0 24px" },
  tab: { padding: "10px 18px", borderRadius: 6, backgroundColor: "#e5e7eb", border: "none", cursor: "pointer" },
  tabActive: { padding: "10px 18px", borderRadius: 6, backgroundColor: "#1e40af", color: "#fff", border: "none", fontWeight: 600 },
  loginPage: { display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "linear-gradient(135deg, #2563eb, #1e40af)" },
  loginCard: { background: "#fff", padding: 32, borderRadius: 12, boxShadow: "0 8px 20px rgba(0,0,0,0.15)", width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 14 },
  loginTitle: { textAlign: "center", marginBottom: 12 },
  logoLogin: { width: 120, height: 40, margin: "0 auto 12px auto", display: "block" },
  notification: { position: "fixed", top: 20, right: 20, backgroundColor: "#16a34a", color: "#fff", padding: "12px 20px", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.2)" },
  table: { width: "100%", borderCollapse: "collapse" },
  deleteButton: { padding: "4px 8px", backgroundColor: "#ef4444", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" },
};

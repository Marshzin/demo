// App.jsx
import React, { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import Barcode from "react-barcode";
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

function App() {
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
  const [vendedor, setVendedor] = useState("");
  const [codigoDigitado, setCodigoDigitado] = useState("");
  const [showNotification, setShowNotification] = useState(false);

  return (
    <div style={ui.appContainer}>
      <header style={ui.header}>
        <img src={logoUrl} alt="Logo" style={ui.logo} />
        <h1 style={ui.title}>Painel de Transferência</h1>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span style={ui.user}>{usuarioAtual}</span>
          <button onClick={onLogout} style={ui.logoutButton}>
            Sair
          </button>
        </div>
      </header>

      {showNotification && (
        <div style={ui.notification}>Produto registrado com sucesso!</div>
      )}

      <nav style={ui.tabs}>
        <button
          style={abaAtiva === "transferencia" ? ui.tabActive : ui.tab}
          onClick={() => setAbaAtiva("transferencia")}
        >
          Transferência
        </button>
        <button
          style={abaAtiva === "pedidos" ? ui.tabActive : ui.tab}
          onClick={() => setAbaAtiva("pedidos")}
        >
          Itens Pedidos
        </button>
        {isAdmin && (
          <button
            style={abaAtiva === "admin" ? ui.tabActive : ui.tab}
            onClick={() => setAbaAtiva("admin")}
          >
            Administração
          </button>
        )}
      </nav>

      <main style={ui.main}>
        {abaAtiva === "transferencia" && (
          <div style={ui.card}>
            <h2 style={ui.cardTitle}>Registrar Pedido</h2>

            <label style={ui.label}>Vendedor</label>
            <input
              type="text"
              value={vendedor}
              onChange={(e) => setVendedor(e.target.value)}
              style={ui.input}
              placeholder="Digite o nome do vendedor"
            />

            <label style={ui.label}>Código do Produto</label>
            <input
              id="manualCodigoInput"
              type="text"
              placeholder="Digite ou bip e pressione Enter"
              value={codigoDigitado}
              onChange={(e) => setCodigoDigitado(e.target.value)}
              style={ui.input}
            />

            <button style={ui.primaryButton}>Registrar</button>
          </div>
        )}
      </main>
    </div>
  );
}

// Novo estilo clean
const ui = {
  appContainer: {
    fontFamily: "'Segoe UI', sans-serif",
    backgroundColor: "#f4f6f9",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    backgroundColor: "#1f2937",
    padding: "16px 32px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    color: "#fff",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
  },
  logo: { width: 140, height: 40, objectFit: "contain" },
  title: { fontSize: 22, fontWeight: 600 },
  user: { fontWeight: 500 },
  logoutButton: {
    backgroundColor: "#ef4444",
    color: "#fff",
    padding: "8px 16px",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
  },
  tabs: {
    display: "flex",
    backgroundColor: "#fff",
    padding: "8px 16px",
    borderBottom: "1px solid #ddd",
    gap: 12,
  },
  tab: {
    padding: "10px 18px",
    backgroundColor: "#f3f4f6",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    fontWeight: 500,
  },
  tabActive: {
    padding: "10px 18px",
    backgroundColor: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontWeight: 600,
  },
  main: {
    flex: 1,
    padding: 24,
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
  },
  card: {
    backgroundColor: "#fff",
    padding: 24,
    borderRadius: 12,
    width: "100%",
    maxWidth: 480,
    boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
  },
  cardTitle: { fontSize: 20, marginBottom: 20 },
  label: { display: "block", marginTop: 12, marginBottom: 6, fontWeight: 500 },
  input: {
    width: "100%",
    padding: "10px 14px",
    borderRadius: 8,
    border: "1px solid #ccc",
    fontSize: 15,
    outline: "none",
    marginBottom: 12,
  },
  primaryButton: {
    width: "100%",
    padding: "12px",
    backgroundColor: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
    marginTop: 10,
  },
  loginPage: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "100vh",
    background: "linear-gradient(135deg, #2563eb, #1e40af)",
  },
  loginCard: {
    background: "#fff",
    padding: 32,
    borderRadius: 12,
    boxShadow: "0 8px 20px rgba(0,0,0,0.15)",
    width: "100%",
    maxWidth: 360,
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  loginTitle: { textAlign: "center", marginBottom: 12 },
  logoLogin: {
    width: 120,
    height: 40,
    margin: "0 auto 12px auto",
    display: "block",
  },
  notification: {
    position: "fixed",
    top: 20,
    right: 20,
    backgroundColor: "#16a34a",
    color: "#fff",
    padding: "12px 20px",
    borderRadius: 8,
    boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
  },
};

export default App;

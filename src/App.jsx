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
const logoUrl = "/logo.jpeg"; // ajuste se necessário
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
    <div style={styles.login}>
      <img src={logoUrl} alt="Logo" style={styles.logoLogin} />
      <h1 style={{ marginBottom: 20 }}>Transferência de Produtos</h1>
      <div style={styles.inputContainer}>
        <select
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          style={styles.input}
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
          style={styles.input}
        />
      </div>
      <button onClick={handleLoginClick} style={styles.loginButton}>
        Entrar
      </button>
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
  const [codigoDigitado, setCodigoDigitado] = useState("");
  const [destinatario, setDestinatario] = useState(
    lojas.find((l) => l !== usuarioAtual) || lojas[0]
  );
  const [vendedor, setVendedor] = useState(""); // Novo estado para vendedor
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

          return {
            id: `${codigoProduto}-${i}`,
            codigo: codigoProduto,
            codigosBarras,
            codigoBarra,
            nome: descricao,
            referencia,
          };
        });

        setItens(lista);
      })
      .catch((err) => {
        console.error("Erro lendo itens.xls", err);
        alert("Erro ao carregar itens.xls. Verifique o arquivo na pasta public/ e os nomes das colunas.");
      });
  }, []);

  const handleManualChange = (e) => setCodigoDigitado(e.target.value);

  const handleManualKeyDown = (e) => {
    if (e.key === "Enter") {
      const v = (e.target.value || "").trim();
      if (v.length > 0) {
        processarCodigo(v);
        setCodigoDigitado("");
      }
    }
  };

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
      const foundByEnds = itens.find((it) => {
        if (!it.codigosBarras) return false;
        return it.codigosBarras.some((cb) => cb.toLowerCase().endsWith(valor));
      });

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
    if (!destinatario) return alert("Selecione o destinatário (a loja que fez o pedido).");

    const novo = {
      id: Date.now().toString() + "-" + Math.random(),
      itemId: item.id,
      codigo: item.codigo,
      codigoBarra: item.codigoBarra,
      nomeItem: item.nome,
      referencia: item.referencia,
      destinatario,
      origem: usuarioAtual,
      vendedor, // Adiciona o vendedor
      data: new Date().toISOString(),
    };

    setPedidos((old) => [novo, ...old]);
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 3000);
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <img src={logoUrl} alt="Logo" style={styles.logo} />
        <h1 style={styles.title}>Painel de Transferência</h1>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ color: "#fff", fontWeight: 600 }}>{usuarioAtual}</div>
          <button onClick={onLogout} style={styles.logoutButton}>
            Sair
          </button>
        </div>
      </header>

      {/* Notificação de Sucesso */}
      {showNotification && (
        <div style={styles.notificacao}>
          <p style={styles.notificacaoTexto}>Produto registrado com sucesso!</p>
        </div>
      )}

      <nav style={styles.tabs}>
        <button
          style={abaAtiva === "transferencia" ? styles.tabActive : styles.tab}
          onClick={() => setAbaAtiva("transferencia")}
        >
          Transferência
        </button>
        <button
          style={abaAtiva === "pedidos" ? styles.tabActive : styles.tab}
          onClick={() => setAbaAtiva("pedidos")}
        >
          Itens Pedidos
        </button>
        {isAdmin && (
          <button
            style={abaAtiva === "admin" ? styles.tabActive : styles.tab}
            onClick={() => setAbaAtiva("admin")}
          >
            Administração
          </button>
        )}
      </nav>

      <main style={styles.section}>
        {abaAtiva === "transferencia" && (
          <>
            <h2 style={{ marginBottom: 12 }}>Bipar e Registrar Pedido</h2>

            <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 14 }}>
              <label style={{ fontWeight: 600 }}>Destinatário:</label>
              <select
                value={destinatario}
                onChange={(e) => setDestinatario(e.target.value)}
                style={styles.select}
              >
                <option value="">-- selecione --</option>
                {lojas
                  .filter((l) => l !== usuarioAtual)
                  .map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
              </select>
            </div>

            {/* Campo de Vendedor */}
            <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 14 }}>
              <label style={{ fontWeight: 600 }}>Vendedor:</label>
              <input
                type="text"
                value={vendedor}
                onChange={(e) => setVendedor(e.target.value)}
                style={styles.input}
                placeholder="Digite o nome do vendedor"
              />
            </div>

            {/* Scanner Manual */}
            <div style={{ marginBottom: 18 }}>
              <input
                id="manualCodigoInput"
                type="text"
                placeholder="Ou digite/cole o código e pressione Enter"
                value={codigoDigitado}
                onChange={handleManualChange}
                onKeyDown={handleManualKeyDown}
                style={{ ...styles.input, width: 420 }}
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

// Estilos
const styles = {
  container: {
    fontFamily: "'Roboto', sans-serif",
    display: "flex",
    flexDirection: "column",
    minHeight: "100vh",
    backgroundColor: "#f7f7f7",
  },
  header: {
    backgroundColor: "#2d3e50",
    padding: "16px 32px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logo: { width: 150, height: 40 },
  title: { color: "#fff", fontSize: 24 },
  logoutButton: {
    backgroundColor: "#e53935",
    color: "#fff",
    padding: "8px 16px",
    border: "none",
    cursor: "pointer",
    borderRadius: 4,
  },
  notificacao: {
    position: "fixed",
    bottom: 20,
    left: "50%",
    transform: "translateX(-50%)",
    backgroundColor: "#4CAF50",
    color: "#fff",
    padding: "10px 20px",
    borderRadius: 8,
    opacity: 0,
    animation: "notificacaoAnimacao 3s forwards",
  },
  notificacaoTexto: { fontSize: 16, fontWeight: 600 },
  tabs: { display: "flex", marginBottom: 16, gap: 12 },
  tab: {
    padding: "12px 20px",
    backgroundColor: "#f1f1f1",
    border: "none",
    cursor: "pointer",
    borderRadius: 4,
    fontWeight: 600,
  },
  tabActive: {
    padding: "12px 20px",
    backgroundColor: "#2d3e50",
    color: "#fff",
    border: "none",
    borderRadius: 4,
    fontWeight: 600,
  },
  section: { padding: "20px" },
  input: {
    padding: "8px 16px",
    borderRadius: 4,
    border: "1px solid #ccc",
    fontSize: 16,
    width: 280,
  },
  select: {
    padding: "8px 16px",
    borderRadius: 4,
    border: "1px solid #ccc",
    fontSize: 16,
    width: 300,
  },
  inputContainer: { display: "flex", flexDirection: "column", gap: 12 },
  loginButton: {
    backgroundColor: "#2196F3",
    color: "#fff",
    padding: "12px 24px",
    border: "none",
    cursor: "pointer",
    borderRadius: 4,
    fontSize: 16,
    marginTop: 20,
  },
  logoLogin: { width: 120, height: 40, marginBottom: 16 },
};

export default App;

import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import Barcode from "react-barcode";
import "./styles.css";

const logins = [
  { usuario: "NovoShopping", loja: "NovoShopping", senha: "1234", isAdmin: false },
  { usuario: "RibeiraoShopping", loja: "RibeiraoShopping", senha: "1234", isAdmin: false },
  { usuario: "DomPedro", loja: "DomPedro", senha: "1234", isAdmin: false },
  { usuario: "Iguatemi", loja: "Iguatemi", senha: "1234", isAdmin: false },
  { usuario: "Administrador", loja: "Administrador", senha: "demo1234", isAdmin: true },
];

const lojas = ["NovoShopping", "RibeiraoShopping", "DomPedro", "Iguatemi"];
const lojaPadrao = "RibeiraoShopping";
const logoUrl = "/logo.jpeg";

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
    const usuarioEncontrado = logins.find((u) => u.usuario === usuario);
    if (usuarioEncontrado && senha === usuarioEncontrado.senha) {
      localStorage.setItem("logado", true);
      localStorage.setItem("isAdmin", usuarioEncontrado.isAdmin);
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
  const [usuario, setUsuario] = useState("NovoShopping");
  const [senha, setSenha] = useState("");

  const handleLogin = () => {
    onLogin(usuario, senha);
  };

  return (
    <div style={styles.login}>
      <img src={logoUrl} alt="Logo" style={styles.logoLogin} />
      <h1 style={{ marginBottom: 30, color: "#222" }}>Painel ERP - Login</h1>
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
      <button onClick={handleLogin} style={styles.loginButton}>
        Entrar
      </button>
    </div>
  );
}

function MainApp({ onLogout, isAdmin, usuarioAtual }) {
  const [abaAtiva, setAbaAtiva] = useState("itens");
  const [itens, setItens] = useState([]);
  const [transferencias, setTransferencias] = useState(() => {
    const dados = localStorage.getItem("transferenciasDemocrata");
    return dados ? JSON.parse(dados) : [];
  });

  const [codigoDigitado, setCodigoDigitado] = useState("");
  const [itensEncontrados, setItensEncontrados] = useState([]);
  const [itemSelecionado, setItemSelecionado] = useState(null);
  const [lojaDestino, setLojaDestino] = useState(lojaPadrao);

  useEffect(() => {
    fetch("/itens.xls")
      .then((res) => res.arrayBuffer())
      .then((data) => {
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const dados = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        if (dados.length === 0) return;
        const lista = dados.map((linha, i) => {
          const codigoProduto = String(linha["Código Produto"] || "").trim();
          const codigosBarras = (String(linha["Códigos de Barras"] || "") || "")
            .split("|")
            .map((c) => c.trim())
            .filter((c) => c.length > 0);
          const codigoBarra =
            codigosBarras.length > 0
              ? codigosBarras[codigosBarras.length - 1]
              : codigoProduto;
          const descricao = String(linha["Descrição Completa"] || "Sem descrição").trim();
          const referencia = String(linha["Referência"] || "-").trim();
          return {
            id: `${codigoProduto}-${i}`,
            codigo: codigoProduto,
            codigoBarra,
            nome: descricao,
            referencia,
            quantidade: 0,
            tamanho: "-",
          };
        });
        setItens(lista);
      })
      .catch(() => {
        alert("Erro ao carregar itens.xls. Verifique o arquivo na pasta public/");
      });
  }, []);

  useEffect(() => {
    localStorage.setItem("transferenciasDemocrata", JSON.stringify(transferencias));
  }, [transferencias]);

  const transferirItem = (item) => {
    if (!item) return;
    const novaTransferencia = {
      id: Date.now().toString() + "-" + Math.random(),
      itemId: item.id,
      codigo: item.codigo,
      codigoBarra: item.codigoBarra,
      nomeItem: item.nome,
      referencia: item.referencia,
      lojaDestino,
      data: new Date().toISOString(),
    };
    setTransferencias((old) => [novaTransferencia, ...old]);
    setItemSelecionado(null);
    setItensEncontrados([]);
    setCodigoDigitado("");
    alert("Transferência realizada!");
  };

  const excluirTransferencias = () => {
    if (window.confirm("Tem certeza que deseja excluir todos os itens transferidos?")) {
      setTransferencias([]);
      localStorage.setItem("transferenciasDemocrata", JSON.stringify([]));
      alert("Todos os itens foram excluídos.");
    }
  };

  const formatarData = (iso) => {
    const dt = new Date(iso);
    return dt.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <img src={logoUrl} alt="Logo" style={styles.logo} />
        <h1 style={styles.title}>ERP - {usuarioAtual}</h1>
        <button onClick={onLogout} style={styles.logoutButton}>
          Sair
        </button>
      </header>

      <nav style={styles.tabs}>
        <button
          style={abaAtiva === "itens" ? styles.tabActive : styles.tab}
          onClick={() => setAbaAtiva("itens")}
        >
          Itens
        </button>
        <button
          style={abaAtiva === "transferidos" ? styles.tabActive : styles.tab}
          onClick={() => setAbaAtiva("transferidos")}
        >
          Transferências
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
        {abaAtiva === "itens" && (
          <>
            <h2>Itens cadastrados</h2>
            <p>Buscar e transferir itens.</p>
          </>
        )}
        {abaAtiva === "transferidos" && (
          <>
            <h2>Histórico de Transferências</h2>
            {transferencias.length === 0 ? (
              <p>Nenhuma transferência realizada.</p>
            ) : (
              <div>
                {transferencias.map((tr) => (
                  <div key={tr.id} style={styles.cardTransfer}>
                    <h4>{tr.nomeItem}</h4>
                    <p>
                      <strong>Ref:</strong> {tr.referencia} |{" "}
                      <strong>Destino:</strong> {tr.lojaDestino}
                    </p>
                    <p style={{ fontSize: 12, color: "#888" }}>{formatarData(tr.data)}</p>
                    <Barcode value={tr.codigoBarra} height={40} width={1.5} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        {abaAtiva === "admin" && isAdmin && (
          <>
            <h2>Administração</h2>
            <button
              onClick={excluirTransferencias}
              style={{ ...styles.button, background: "#c0392b", marginTop: 18 }}
            >
              Excluir todas as transferências
            </button>
          </>
        )}
      </main>
    </div>
  );
}

const styles = {
  login: {
    height: "100vh",
    background: "#f7f7f7",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  logoLogin: { width: 220, marginBottom: 25 },
  inputContainer: { display: "flex", flexDirection: "column", gap: 15, marginBottom: 20 },
  input: {
    padding: 14,
    borderRadius: 8,
    border: "1.5px solid #ccc",
    fontSize: 16,
    outline: "none",
  },
  loginButton: {
    padding: "12px 30px",
    fontSize: 18,
    background: "#2c3e50",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
  },
  container: {
    fontFamily: "Arial, sans-serif",
    background: "#fff",
    minHeight: "100vh",
    maxWidth: 960,
    margin: "0 auto",
    padding: "10px 30px 30px 30px",
    boxSizing: "border-box",
  },
  header: {
    background: "#2c3e50",
    color: "#fff",
    padding: "18px 30px",
    display: "flex",
    alignItems: "center",
    gap: 20,
    borderRadius: 10,
    marginBottom: 30,
  },
  logo: { width: 70 },
  title: { fontSize: 20, fontWeight: "700", flexGrow: 1 },
  logoutButton: {
    backgroundColor: "#c0392b",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    padding: "8px 18px",
    fontSize: 14,
    cursor: "pointer",
  },
  tabs: { display: "flex", gap: 24, marginBottom: 20 },
  tab: {
    padding: "10px 24px",
    backgroundColor: "transparent",
    border: "none",
    fontWeight: "600",
    color: "#666",
    cursor: "pointer",
  },
  tabActive: {
    padding: "10px 24px",
    backgroundColor: "#2c3e50",
    border: "none",
    fontWeight: "700",
    color: "#fff",
    borderRadius: 6,
  },
  section: {
    background: "#fafafa",
    borderRadius: 12,
    padding: "20px 25px",
    boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
    minHeight: 300,
  },
  cardTransfer: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 10,
    boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
    marginBottom: 12,
  },
  button: {
    backgroundColor: "#2c3e50",
    border: "none",
    borderRadius: 8,
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
    padding: "12px 20px",
    cursor: "pointer",
  },
};

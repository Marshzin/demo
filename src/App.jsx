import React, { useState, useEffect } from "react";
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

const lojas = [
  "NovoShopping",
  "RibeiraoShopping",
  "DomPedro",
  "Iguatemi",
];

const logoUrl = "/logo.jpeg";

export default function App() {
  const [logado, setLogado] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [usuarioAtual, setUsuarioAtual] = useState("");

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
    setUsuarioAtual("");
  }

  return logado ? (
    <MainApp
      onLogout={handleLogout}
      isAdmin={isAdmin}
      usuarioAtual={usuarioAtual}
    />
  ) : (
    <Login onLogin={handleLogin} />
  );
}

function Login({ onLogin }) {
  const [usuario, setUsuario] = useState("NovoShopping");
  const [senha, setSenha] = useState("");

  const handleLoginClick = () => {
    onLogin(usuario, senha);
  };

  return (
    <div style={styles.login}>
      <img src={logoUrl} alt="Logo" style={styles.logoLogin} />
      <h1 style={{ marginBottom: 30, color: "#222" }}>Transferência de Produtos</h1>
      <div style={styles.inputContainer}>
        <select
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          style={{ ...styles.input, padding: "14px" }}
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
  const [transferencias, setTransferencias] = useState(() => {
    const dados = localStorage.getItem("transferenciasDemocrata");
    return dados ? JSON.parse(dados) : [];
  });

  const [codigoDigitado, setCodigoDigitado] = useState("");
  const [itensEncontrados, setItensEncontrados] = useState([]);
  const [itemSelecionado, setItemSelecionado] = useState(null);
  const [lojaDestino, setLojaDestino] = useState(lojas[0]);
  const [quemSolicitou, setQuemSolicitou] = useState("");

  // Carregar itens do Excel
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
          const codigosBarras = (String(linha["Códigos de Barras"] || ""))
            .split("|")
            .map((c) => c.trim())
            .filter((c) => c.length > 0);
          const codigoBarra =
            codigosBarras.length > 0 ? codigosBarras[codigosBarras.length - 1] : codigoProduto;
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

  // Bipar código
  const handleInputChange = (e) => {
    const valor = e.target.value;
    setCodigoDigitado(valor);
    if (valor.trim().length >= 5) {
      const busca = valor.trim().toLowerCase();
      const encontrados = itens.filter(
        (i) =>
          i.codigo.toLowerCase() === busca ||
          i.codigoBarra.toLowerCase() === busca ||
          i.referencia.toLowerCase() === busca
      );
      if (encontrados.length === 1) {
        setItemSelecionado(encontrados[0]);
        setTimeout(() => transferirItemAuto(encontrados[0]), 150);
        setCodigoDigitado("");
      } else if (encontrados.length > 1) {
        setItensEncontrados(encontrados);
        setItemSelecionado(null);
      }
    }
  };

  const transferirItemAuto = (item) => {
    if (!item) return;
    if (!quemSolicitou.trim()) return alert("Informe quem solicitou a transferência!");
    const novaTransferencia = {
      id: Date.now().toString() + "-" + Math.random(),
      itemId: item.id,
      codigo: item.codigo,
      codigoBarra: item.codigoBarra,
      nomeItem: item.nome,
      referencia: item.referencia,
      lojaDestino,
      quemSolicitou,
      data: new Date().toISOString(),
    };
    setTransferencias((old) => [novaTransferencia, ...old]);
    setItemSelecionado(null);
    setItensEncontrados([]);
    setCodigoDigitado("");
    alert("Transferência realizada!");
  };

  const transferirItem = () => {
    if (!itemSelecionado) return alert("Selecione um item para transferir.");
    if (!quemSolicitou.trim()) return alert("Informe quem solicitou a transferência!");
    const novaTransferencia = {
      id: Date.now().toString() + "-" + Math.random(),
      itemId: itemSelecionado.id,
      codigo: itemSelecionado.codigo,
      codigoBarra: itemSelecionado.codigoBarra,
      nomeItem: itemSelecionado.nome,
      referencia: itemSelecionado.referencia,
      lojaDestino,
      quemSolicitou,
      data: new Date().toISOString(),
    };
    setTransferencias((old) => [novaTransferencia, ...old]);
    setItemSelecionado(null);
    setCodigoDigitado("");
    setItensEncontrados([]);
  };

  const excluirTransferencias = () => {
    if (window.confirm("Tem certeza que deseja excluir todos os itens transferidos?")) {
      setTransferencias([]);
      localStorage.setItem("transferenciasDemocrata", JSON.stringify([]));
      alert("Todos os itens transferidos foram excluídos.");
    }
  };

  const historicoFiltrado = transferencias;

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <img src={logoUrl} alt="Logo" style={styles.logo} />
        <h1 style={styles.title}>Transferência de Produtos</h1>
        <button onClick={onLogout} style={styles.logoutButton}>
          Sair
        </button>
      </header>

      <nav style={styles.tabs}>
        <button
          style={abaAtiva === "transferencia" ? styles.tabActive : styles.tab}
          onClick={() => setAbaAtiva("transferencia")}
        >
          Transferência
        </button>
        <button
          style={abaAtiva === "transferidos" ? styles.tabActive : styles.tab}
          onClick={() => setAbaAtiva("transferidos")}
        >
          Histórico
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
            <h2>Buscar e Transferir Item</h2>
            <div style={styles.buscaContainer}>
              <input
                type="text"
                placeholder="Código de Barras, Referência ou Código"
                value={codigoDigitado}
                onChange={handleInputChange}
                autoFocus
                style={{ ...styles.input, width: 340 }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
              <label style={{ fontWeight: 600 }}>Destinatário:</label>
              <select
                value={lojaDestino}
                onChange={(e) => setLojaDestino(e.target.value)}
                style={styles.select}
              >
                {lojas.filter((l) => l !== usuarioAtual).map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>

              <label style={{ fontWeight: 600 }}>Quem solicitou:</label>
              <input
                type="text"
                value={quemSolicitou}
                onChange={(e) => setQuemSolicitou(e.target.value)}
                placeholder="Informe quem solicitou"
                style={styles.input}
              />
            </div>

            <button
              style={styles.button}
              onClick={() => {
                if (itemSelecionado) transferirItem();
                else if (codigoDigitado.trim()) transferirItemAuto(itensEncontrados[0]);
              }}
            >
              Transferir
            </button>

            {itensEncontrados.length > 0 && (
              <div style={styles.cardContainer}>
                <h3>Itens encontrados:</h3>
                <div style={styles.itensList}>
                  {itensEncontrados.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setItemSelecionado(item)}
                      style={{
                        ...styles.card,
                        border:
                          item.id === itemSelecionado?.id
                            ? "2px solid #3498db"
                            : "1px solid #ccc",
                      }}
                    >
                      <h4>{item.nome}</h4>
                      <p>
                        <strong>Referência:</strong> {item.referencia}
                      </p>
                      <Barcode value={item.codigoBarra} height={40} width={1.5} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {abaAtiva === "transferidos" && (
          <>
            <h2>Histórico de Transferências</h2>
            {historicoFiltrado.length === 0 ? (
              <p>Nenhuma transferência realizada.</p>
            ) : (
              <div style={styles.gridTransfer}>
                {historicoFiltrado.map((tr) => (
                  <div key={tr.id} style={styles.cardTransfer}>
                    <h4>{tr.nomeItem}</h4>
                    <p>
                      <strong>Cód. Barras:</strong> {tr.codigoBarra}
                    </p>
                    <p>
                      <strong>Referência:</strong> {tr.referencia}
                    </p>
                    <p>
                      <strong>Destino:</strong> {tr.lojaDestino}
                    </p>
                    <p>
                      <strong>Solicitado por:</strong> {tr.quemSolicitou}
                    </p>
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
              style={{ ...styles.button, background: "#c0392b" }}
              onClick={excluirTransferencias}
            >
              Excluir todos os itens transferidos
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
    borderRadius: 12,
    border: "1.5px solid #ccc",
    fontSize: 18,
    fontWeight: 500,
    outline: "none",
  },
  loginButton: {
    padding: "16px 40px",
    fontSize: 22,
    background: "#4a90e2",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    cursor: "pointer",
    boxShadow: "0 6px 12px rgba(74,144,226,0.4)",
  },
  container: { fontFamily: "Arial, sans-serif", background: "#fff", minHeight: "100vh", maxWidth: 960, margin: "0 auto", padding: "10px 30px 30px 30px" },
  header: { display: "flex", alignItems: "center", gap: 20, marginBottom: 30 },
  logo: { width: 90 },
  title: { fontSize: 24, fontWeight: "700", flexGrow: 1 },
  logoutButton: { backgroundColor: "#e03e2f", color: "#fff", border: "none", borderRadius: 8, padding: "10px 22px", fontSize: 15, cursor: "pointer" },
  tabs: { display: "flex", gap: 24, marginBottom: 30 },
  tab: { padding: "12px 32px", backgroundColor: "#eee", border: "none", borderRadius: 8, cursor: "pointer" },
  tabActive: { padding: "12px 32px", backgroundColor: "#3498db", border: "none", borderRadius: 8, color: "#fff", cursor: "default" },
  section: { background: "#fafafa", borderRadius: 12, padding: "12px 25px 25px 25px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", minHeight: 300 },
  buscaContainer: { display: "flex", gap: 14, marginBottom: 25 },
  button: { backgroundColor: "#4a90e2", border: "none", borderRadius: 12, color: "#fff", fontWeight: "600", fontSize: 16, padding: "14px 22px", cursor: "pointer" },
  cardContainer: { maxHeight: 360, overflowY: "auto", marginBottom: 20 },
  itensList: { display: "flex", flexDirection: "column", gap: 14 },
  select: { width: 220, padding: "7px 12px", fontSize: 15, borderRadius: 7, border: "1.2px solid #ccc", marginTop: 6, maxWidth: 240, minWidth: 110 },
  gridTransfer: { display: "flex", flexWrap: "wrap", gap: 14 },
  card: { backgroundColor: "#fff", borderRadius: 10, boxShadow: "0 3px 10px rgba(0,0,0,0.1)", padding: "12px 28px", width: "100%", maxWidth: 750, minHeight: 80, cursor: "pointer", display: "flex", flexDirection: "row", alignItems: "center", gap: 40 },
  cardTransfer: { backgroundColor: "#fff", padding: 18, borderRadius: 10, boxShadow: "0 2px 10px rgba(0,0,0,0.08)", lineHeight: 1.2, marginBottom: 0 },
  lojaTagSmall: { fontSize: 9, color: "#1761a0", fontWeight: 600, marginLeft: 5 },
};

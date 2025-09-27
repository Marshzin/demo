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

  const handleLoginClick = () => {
    onLogin(usuario, senha);
  };

  return (
    <div style={styles.login}>
      <img src={logoUrl} alt="Logo" style={styles.logoLogin} />
      <h1 style={{ marginBottom: 30, color: "#222" }}>Transferência de Produtos</h1>
      <div style={styles.inputContainer}>
        <select value={usuario} onChange={(e) => setUsuario(e.target.value)} style={styles.select}>
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

function MainApp({ onLogout, isAdmin }) {
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
  const [nomeQuemPediu, setNomeQuemPediu] = useState("");

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
          const codigoBarra = codigosBarras.length > 0 ? codigosBarras[codigosBarras.length - 1] : codigoProduto;
          const descricao = String(linha["Descrição Completa"] || "Sem descrição").trim();
          const referencia = String(linha["Referência"] || "-").trim();
          return { id: `${codigoProduto}-${i}`, codigo: codigoProduto, codigoBarra, nome: descricao, referencia, quantidade: 0, tamanho: "-" };
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
        setTimeout(() => {
          transferirItemAuto(encontrados[0]);
        }, 150);
        setCodigoDigitado("");
      } else if (encontrados.length > 1) {
        setItensEncontrados(encontrados);
        setItemSelecionado(null);
      }
    }
  };

  const transferirItemAuto = (item) => {
    if (!item || !nomeQuemPediu.trim()) return;
    const novaTransferencia = {
      id: Date.now().toString() + "-" + Math.random(),
      itemId: item.id,
      codigo: item.codigo,
      codigoBarra: item.codigoBarra,
      nomeItem: item.nome,
      referencia: item.referencia,
      lojaDestino,
      nomeQuemPediu,
      data: new Date().toISOString(),
    };
    setTransferencias((old) => [novaTransferencia, ...old]);
    setItemSelecionado(null);
    setItensEncontrados([]);
    setCodigoDigitado("");
    alert("Transferência Realizada automaticamente!");
  };

  const buscarCodigo = () => {
    if (!codigoDigitado.trim()) {
      alert("Digite o código, referência ou código de barras.");
      return;
    }
    const busca = codigoDigitado.trim().toLowerCase();
    const encontrados = itens.filter(
      (i) =>
        i.codigo.toLowerCase() === busca ||
        i.codigoBarra.toLowerCase() === busca ||
        i.referencia.toLowerCase() === busca
    );
    if (encontrados.length === 0) {
      alert("Nenhum item encontrado.");
      setItensEncontrados([]);
      setItemSelecionado(null);
      return;
    }
    setItensEncontrados(encontrados);
    if (encontrados.length === 1) setItemSelecionado(encontrados[0]);
    else setItemSelecionado(null);
    setCodigoDigitado("");
  };

  const transferirItem = () => {
    if (!itemSelecionado) return alert("Selecione um item para transferir.");
    if (!nomeQuemPediu.trim()) return alert("Digite o nome de quem pediu!");
    const novaTransferencia = {
      id: Date.now().toString() + "-" + Math.random(),
      itemId: itemSelecionado.id,
      codigo: itemSelecionado.codigo,
      codigoBarra: itemSelecionado.codigoBarra,
      nomeItem: itemSelecionado.nome,
      referencia: itemSelecionado.referencia,
      lojaDestino,
      nomeQuemPediu,
      data: new Date().toISOString(),
    };
    setTransferencias((old) => [novaTransferencia, ...old]);
    alert("Transferência Realizada!");
    setItemSelecionado(null);
    setCodigoDigitado("");
    setLojaDestino(lojas[1]);
    setItensEncontrados([]);
    setNomeQuemPediu("");
  };

  const excluirTransferencias = () => {
    if (window.confirm("Tem certeza que deseja excluir todos os itens transferidos?")) {
      setTransferencias([]);
      localStorage.setItem("transferenciasDemocrata", JSON.stringify([]));
      alert("Todos os itens transferidos foram excluídos.");
    }
  };

  const formatarData = (iso) => {
    const dt = new Date(iso);
    return dt.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <img src={logoUrl} alt="Logo" style={styles.logo} />
        <h1 style={styles.title}>Transferência de Produtos</h1>
        <button onClick={onLogout} style={styles.logoutButton}>Sair</button>
      </header>

      <nav style={styles.tabs}>
        <button style={abaAtiva === "itens" ? styles.tabActive : styles.tab} onClick={() => setAbaAtiva("itens")}>Transferência</button>
        <button style={abaAtiva === "transferidos" ? styles.tabActive : styles.tab} onClick={() => setAbaAtiva("transferidos")}>Itens transferidos</button>
        {isAdmin && <button style={abaAtiva === "admin" ? styles.tabActive : styles.tab} onClick={() => setAbaAtiva("admin")}>Administração</button>}
      </nav>

      <main style={styles.section}>
        {abaAtiva === "itens" && (
          <>
            <h2 style={{ color: "#1a1a1a", marginBottom: 20 }}>Buscar e Transferir Item</h2>
            <div style={styles.buscaContainer}>
              <input
                type="text"
                placeholder="Código de Barras, Referência ou Código"
                value={codigoDigitado}
                onChange={handleInputChange}
                style={{ ...styles.input, width: 340 }}
                autoFocus
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <label style={{ fontWeight: 600 }}>Destinatário:</label>
                <select value={lojaDestino} onChange={(e) => setLojaDestino(e.target.value)} style={styles.select}>
                  {lojas.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <label style={{ fontWeight: 600 }}>Nome de quem pediu:</label>
                <input
                  type="text"
                  value={nomeQuemPediu}
                  onChange={(e) => setNomeQuemPediu(e.target.value)}
                  placeholder="Digite o nome"
                  style={{ ...styles.input, width: 250 }}
                />
              </div>

              <button
                style={styles.button}
                onClick={() => {
                  if (!nomeQuemPediu.trim()) return alert("Digite o nome de quem pediu!");
                  if (itemSelecionado) transferirItem();
                  else if (codigoDigitado.trim()) {
                    buscarCodigo();
                    setTimeout(() => {
                      if (itensEncontrados.length === 1) {
                        setItemSelecionado(itensEncontrados[0]);
                        setTimeout(transferirItem, 100);
                      } else alert("Selecione o item após buscar.");
                    }, 100);
                  } else alert("Selecione um item ou digite o código para buscar.");
                }}
              >
                Transferir
              </button>
            </div>

            {itensEncontrados.length > 0 && (
              <div style={styles.cardContainer}>
                <h3>Itens encontrados:</h3>
                <div style={styles.itensList}>
                  {itensEncontrados.map((item) => (
                    <div key={item.id} onClick={() => setItemSelecionado(item)} style={{ ...styles.card, backgroundColor: item.id === itemSelecionado?.id ? "#d0e4ff" : "#fff" }}>
                      <div>
                        <h4>{item.nome}</h4>
                        <p><strong>Referência:</strong> {item.referencia}</p>
                      </div>
                      <div>
                        <Barcode value={item.codigoBarra} height={40} width={1.5} />
                        <div style={styles.lojaTagSmall}>{lojaDestino}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {abaAtiva === "transferidos" && (
          <>
            <h2 style={{ color: "#1a1a1a", marginBottom: 20 }}>Histórico de Transferências</h2>
            {transferencias.length === 0 ? (
              <p style={{ color: "#666" }}>Nenhuma transferência realizada.</p>
            ) : (
              <div style={styles.gridTransfer}>
                {transferencias.map((tr) => (
                  <div key={tr.id} style={styles.cardTransfer}>
                    <h4 style={{ marginTop: 0, marginBottom: 6 }}>{tr.nomeItem}</h4>
                    <p><strong>Cód. Barras:</strong> {tr.codigoBarra}</p>
                    <p><strong>Referência:</strong> {tr.referencia}</p>
                    <p><strong>Destinatário:</strong> {tr.lojaDestino}</p>
                    <p><strong>Solicitado por:</strong> {tr.nomeQuemPediu}</p>
                    <p style={{ fontSize: 12, color: "#888" }}>Em {formatarData(tr.data)}</p>
                    <Barcode value={tr.codigoBarra} height={40} width={1.5} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {abaAtiva === "admin" && isAdmin && (
          <>
            <h2 style={{ color: "#1a1a1a", marginBottom: 20 }}>Administração</h2>
            <button
              onClick={excluirTransferencias}
              style={{ ...styles.button, background: "#c0392b", marginTop: 18 }}
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
  login: { height: "100vh", background: "#f7f7f7", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" },
  logoLogin: { width: 220, marginBottom: 25, filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.1))" },
  inputContainer: { display: "flex", flexDirection: "column", gap: 15, marginBottom: 20 },
  input: { padding: 14, borderRadius: 12, border: "1.5px solid #ccc", fontSize: 18, fontWeight: "500", outline: "none" },
  loginButton: { padding: "16px 40px", fontSize: 22, background: "#4a90e2", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", boxShadow: "0 6px 12px rgba(74,144,226,0.4)", transition: "background-color 0.3s ease" },
  select: { padding: 14, borderRadius: 12, border: "1.5px solid #ccc", fontSize: 16 },
  container: { fontFamily: "Arial, sans-serif", background: "#fff", minHeight: "100vh", maxWidth: 960, margin: "0 auto", padding: "10px 30px 30px 30px", boxSizing: "border-box" },
  header: { background: "#222", color: "#fff", padding: "18px 30px", display: "flex", alignItems: "center", gap: 20, borderRadius: 10, marginBottom: 30 },
  logo: { width: 90, filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.2))" },
  title: { margin: 0, fontSize: 22, flex: 1 },
  logoutButton: { padding: "8px 18px", borderRadius: 8, background: "#e74c3c", color: "#fff", border: "none", cursor: "pointer" },
  tabs: { display: "flex", gap: 12, marginBottom: 20 },
  tab: { padding: "10px 18px", borderRadius: 8, background: "#eee", border: "none", cursor: "pointer" },
  tabActive: { padding: "10px 18px", borderRadius: 8, background: "#3498db", color: "#fff", border: "none", cursor: "pointer" },
  section: { marginTop: 10 },
  buscaContainer: { display: "flex", alignItems: "center", gap: 12, marginBottom: 20 },
  button: { padding: "14px 28px", background: "#2ecc71", color: "#fff", border: "none", borderRadius: 12, fontSize: 16, cursor: "pointer" },
  cardContainer: { marginTop: 12 },
  itensList: { display: "flex", flexWrap: "wrap", gap: 14 },
  card: { border: "1px solid #ccc", padding: 12, borderRadius: 12, width: 220, cursor: "pointer", display: "flex", flexDirection: "column", gap: 8, background: "#fff", boxShadow: "0 2px 6px rgba(0,0,0,0.05)" },
  lojaTagSmall: { fontSize: 11, marginTop: 6, fontWeight: 600, textAlign: "center" },
  gridTransfer: { display: "flex", flexWrap: "wrap", gap: 14 },
  cardTransfer: { border: "1px solid #ccc", borderRadius: 12, padding: 12, width: 210, background: "#fff", display: "flex", flexDirection: "column", gap: 6, boxShadow: "0 2px 6px rgba(0,0,0,0.05)" },
};

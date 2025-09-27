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
  const [usuario, setUsuario] = useState(lojas[0]);
  const [senha, setSenha] = useState("");

  const handleLoginClick = () => onLogin(usuario, senha);

  return (
    <div style={styles.login}>
      <img src={logoUrl} alt="Logo" style={styles.logoLogin} />
      <h1 style={{ marginBottom: 30, color: "#222" }}>Transferência de Produtos</h1>
      <div style={styles.inputContainer}>
        <select value={usuario} onChange={(e) => setUsuario(e.target.value)} style={styles.input}>
          {logins.map((l) => (
            <option key={l.usuario} value={l.usuario}>{l.usuario}</option>
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
    const dados = localStorage.getItem("pedidosERP");
    return dados ? JSON.parse(dados) : [];
  });
  const [codigoDigitado, setCodigoDigitado] = useState("");
  const [itensEncontrados, setItensEncontrados] = useState([]);
  const [itemSelecionado, setItemSelecionado] = useState(null);
  const [destinatario, setDestinatario] = useState(lojaPadrao);
  const [quemPediu, setQuemPediu] = useState("");

  const [lojaSelecionada, setLojaSelecionada] = useState(lojas[0]);

  useEffect(() => {
    localStorage.setItem("pedidosERP", JSON.stringify(pedidos));
  }, [pedidos]);

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
        setTimeout(() => transferirItem(encontrados[0]), 150);
        setCodigoDigitado("");
      } else if (encontrados.length > 1) {
        setItensEncontrados(encontrados);
        setItemSelecionado(null);
      }
    }
  };

  const transferirItem = (item = itemSelecionado) => {
    if (!item) return alert("Selecione um item para transferir.");
    if (!quemPediu.trim()) return alert("Informe quem solicitou o pedido.");
    const novoPedido = {
      id: Date.now().toString() + "-" + Math.random(),
      itemId: item.id,
      codigo: item.codigo,
      codigoBarra: item.codigoBarra,
      nomeItem: item.nome,
      referencia: item.referencia,
      destinatario,
      quemPediu,
      data: new Date().toISOString(),
    };
    setPedidos((old) => [novoPedido, ...old]);
    setItemSelecionado(null);
    setCodigoDigitado("");
    setQuemPediu("");
    alert("Pedido registrado!");
  };

  const formatarData = (iso) => {
    const dt = new Date(iso);
    return dt.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const pedidosFiltrados = pedidos.filter((p) => p.destinatario === usuarioAtual);

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
        <button style={abaAtiva === "transferencia" ? styles.tabActive : styles.tab} onClick={() => setAbaAtiva("transferencia")}>
          Transferência
        </button>
        <button style={abaAtiva === "pedidos" ? styles.tabActive : styles.tab} onClick={() => setAbaAtiva("pedidos")}>
          Itens Pedidos
        </button>
        {isAdmin && (
          <button style={abaAtiva === "admin" ? styles.tabActive : styles.tab} onClick={() => setAbaAtiva("admin")}>
            Administração
          </button>
        )}
      </nav>

      <main style={styles.section}>
        {abaAtiva === "transferencia" && (
          <>
            <h2 style={{ color: "#1a1a1a", marginBottom: 20 }}>Bipar e Transferir Item</h2>
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
                <select value={destinatario} onChange={(e) => setDestinatario(e.target.value)} style={styles.select}>
                  {lojas.filter((l) => l !== usuarioAtual).map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <label style={{ fontWeight: 600 }}>Quem solicitou:</label>
                <input
                  type="text"
                  value={quemPediu}
                  onChange={(e) => setQuemPediu(e.target.value)}
                  style={{ ...styles.input, width: 200 }}
                />
              </div>
            </div>
            <button style={styles.button} onClick={() => transferirItem()}>
              Registrar Pedido
            </button>
          </>
        )}

        {abaAtiva === "pedidos" && (
          <>
            <h2 style={{ color: "#1a1a1a", marginBottom: 20 }}>Itens Pedidos para {usuarioAtual}</h2>
            {pedidosFiltrados.length === 0 ? (
              <p style={{ color: "#666" }}>Nenhum pedido registrado.</p>
            ) : (
              <div style={styles.gridTransfer}>
                {pedidosFiltrados.map((p) => (
                  <div key={p.id} style={styles.cardTransfer}>
                    <h4 style={{ marginTop: 0, marginBottom: 6 }}>{p.nomeItem}</h4>
                    <p style={{ margin: "2px 0" }}><strong>Cód. Barras:</strong> {p.codigoBarra}</p>
                    <p style={{ margin: "2px 0" }}><strong>Referência:</strong> {p.referencia}</p>
                    <p style={{ margin: "2px 0" }}><strong>Destinatário:</strong> {p.destinatario}</p>
                    <p style={{ fontSize: 12, color: "#888", margin: "2px 0 8px 0" }}>Solicitado por: {p.quemPediu}</p>
                    <Barcode value={p.codigoBarra} height={40} width={1.5} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {abaAtiva === "admin" && isAdmin && (
          <>
            <h2 style={{ color: "#1a1a1a", marginBottom: 20 }}>Administração</h2>
            <div style={{ display: "flex", gap: 20, marginBottom: 20 }}>
              <label style={{ fontWeight: 600 }}>Selecionar Loja:</label>
              <select value={lojaSelecionada} onChange={(e) => setLojaSelecionada(e.target.value)} style={styles.select}>
                {lojas.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            {pedidos.filter((p) => p.quemPediu === lojaSelecionada).length === 0 ? (
              <p style={{ color: "#666" }}>Nenhum pedido registrado para {lojaSelecionada}.</p>
            ) : (
              <div style={styles.gridTransfer}>
                {pedidos.filter((p) => p.quemPediu === lojaSelecionada).map((p) => (
                  <div key={p.id} style={styles.cardTransfer}>
                    <h4 style={{ marginTop: 0, marginBottom: 6 }}>{p.nomeItem}</h4>
                    <p style={{ margin: "2px 0" }}><strong>Cód. Barras:</strong> {p.codigoBarra}</p>
                    <p style={{ margin: "2px 0" }}><strong>Referência:</strong> {p.referencia}</p>
                    <p style={{ margin: "2px 0" }}><strong>Destinatário:</strong> {p.destinatario}</p>
                    <p style={{ fontSize: 12, color: "#888", margin: "2px 0 8px 0" }}>Recebido por: {p.destinatario}</p>
                    <Barcode value={p.codigoBarra} height={40} width={1.5} />
                    <button
                      style={{ ...styles.button, background: "#c0392b", marginTop: 10 }}
                      onClick={() => {
                        if (window.confirm("Excluir este pedido?")) {
                          setPedidos(old => old.filter(item => item.id !== p.id));
                        }
                      }}
                    >
                      Excluir
                    </button>
                  </div>
                ))}
              </div>
            )}
            {pedidos.filter((p) => p.quemPediu === lojaSelecionada).length > 0 && (
              <button
                onClick={() => {
                  if (window.confirm(`Excluir todos os pedidos de ${lojaSelecionada}?`)) {
                    setPedidos(old => old.filter(p => p.quemPediu !== lojaSelecionada));
                  }
                }}
                style={{ ...styles.button, background: "#e74c3c", marginTop: 20 }}
              >
                Excluir todos os pedidos da loja
              </button>
            )}
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
  container: { fontFamily: "Arial, sans-serif", background: "#fff", minHeight: "100vh", maxWidth: 960, margin: "0 auto", padding: "10px 30px 30px 30px", boxSizing: "border-box" },
  header: { background: "#222", color: "#fff", padding: "18px 30px", display: "flex", alignItems: "center", gap: 20, borderRadius: 10, marginBottom: 30 },
  logo: { width: 90, filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.3))" },
  title: { fontSize: 24, fontWeight: "700", flexGrow: 1 },
  logoutButton: { backgroundColor: "#e03e2f", color: "#fff", border: "none", borderRadius: 8, padding: "10px 22px", fontSize: 15, cursor: "pointer", boxShadow: "0 4px 10px rgba(224,62,47,0.4)", transition: "background-color 0.3s ease" },
  tabs: { display: "flex", gap: 24, marginBottom: 30, borderBottom: "2px solid #eee" },
  tab: { padding: "12px 32px", backgroundColor: "transparent", border: "none", borderBottom: "3px solid transparent", fontWeight: "600", fontSize: 16, cursor: "pointer", color: "#555", transition: "border-bottom 0.3s ease, color 0.3s ease" },
  tabActive: { padding: "12px 32px", backgroundColor: "transparent", border: "none", borderBottom: "3px solid #4a90e2", fontWeight: "600", fontSize: 16, cursor: "pointer", color: "#222" },
  section: { paddingBottom: 60 },
  buscaContainer: { display: "flex", marginBottom: 15 },
  select: { padding: 14, borderRadius: 12, border: "1.5px solid #ccc", fontSize: 18, fontWeight: "500", outline: "none" },
  button: { padding: "12px 28px", borderRadius: 12, backgroundColor: "#27ae60", color: "#fff", border: "none", fontSize: 16, cursor: "pointer", transition: "background-color 0.3s ease" },
  gridTransfer: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 18 },
  cardTransfer: { padding: 16, borderRadius: 12, border: "1px solid #ccc", display: "flex", flexDirection: "column", alignItems: "center", backgroundColor: "#fefefe" },
};

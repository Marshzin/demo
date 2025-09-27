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
  const [destinatario, setDestinatario] = useState(lojas.find(l => l !== usuarioAtual));

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
        const lista = dados.map((linha, i) => {
          const codigoProduto = String(linha["Código Produto"] || "").trim();
          const codigosBarras = (String(linha["Códigos de Barras"] || "") || "")
            .split("|")
            .map((c) => c.trim())
            .filter((c) => c.length > 0);
          const codigoBarra = codigosBarras.length > 0 ? codigosBarras[0] : codigoProduto;
          const descricao = String(linha["Descrição Completa"] || "Sem descrição").trim();
          const referencia = String(linha["Referência"] || "-").trim();
          return {
            id: `${codigoProduto}-${i}`,
            codigo: codigoProduto,
            codigoBarra,
            nome: descricao,
            referencia,
          };
        });
        setItens(lista);
      })
      .catch(() => {
        alert("Erro ao carregar itens.xls. Verifique o arquivo na pasta public/");
      });
  }, []);

  const handleInputChange = (e) => {
    const valor = e.target.value.trim();
    setCodigoDigitado(valor);
    if (valor.length >= 5) {
      const item = itens.find(
        (i) =>
          i.codigo.toLowerCase() === valor.toLowerCase() ||
          i.codigoBarra.toLowerCase() === valor.toLowerCase() ||
          i.referencia.toLowerCase() === valor.toLowerCase()
      );
      if (item) {
        registrarPedido(item);
        setCodigoDigitado("");
      }
    }
  };

  const registrarPedido = (item) => {
    if (!item) return;
    const novoPedido = {
      id: Date.now().toString() + "-" + Math.random(),
      itemId: item.id,
      codigo: item.codigo,
      codigoBarra: item.codigoBarra,
      nomeItem: item.nome,
      referencia: item.referencia,
      destinatario,
      data: new Date().toISOString(),
    };
    setPedidos((old) => [novoPedido, ...old]);
  };

  const pedidosFiltrados = pedidos.filter((p) => p.destinatario === usuarioAtual);

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <img src={logoUrl} alt="Logo" style={styles.logo} />
        <h1 style={styles.title}>Transferência de Produtos</h1>
        <button onClick={onLogout} style={styles.logoutButton}>Sair</button>
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
            <h2>Bipar e Transferir Item</h2>
            <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
              <label>Destinatário:</label>
              <select value={destinatario} onChange={(e) => setDestinatario(e.target.value)} style={styles.select}>
                {lojas.filter((l) => l !== usuarioAtual).map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            <input
              type="text"
              placeholder="Código de Barras, Referência ou Código"
              value={codigoDigitado}
              onChange={handleInputChange}
              style={{ ...styles.input, width: 300 }}
              autoFocus
            />
          </>
        )}

        {abaAtiva === "pedidos" && (
          <>
            <h2>Itens Pedidos para {usuarioAtual}</h2>
            {pedidosFiltrados.length === 0 ? (
              <p>Nenhum pedido registrado.</p>
            ) : (
              <div style={styles.gridTransfer}>
                {pedidosFiltrados.map((p) => (
                  <div key={p.id} style={styles.cardTransfer}>
                    <h4>{p.nomeItem}</h4>
                    <p>Cód. Barras: {p.codigoBarra}</p>
                    <p>Referência: {p.referencia}</p>
                    <Barcode value={p.codigoBarra} height={40} width={1.5} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {abaAtiva === "admin" && isAdmin && (
          <>
            <h2>Administração</h2>
            <label>Selecionar Loja:</label>
            <select value={lojaSelecionada} onChange={(e) => setLojaSelecionada(e.target.value)} style={styles.select}>
              {lojas.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
            {pedidos.filter((p) => p.destinatario === lojaSelecionada).length === 0 ? (
              <p>Nenhum pedido registrado para {lojaSelecionada}.</p>
            ) : (
              <div style={styles.gridTransfer}>
                {pedidos.filter((p) => p.destinatario === lojaSelecionada).map((p) => (
                  <div key={p.id} style={styles.cardTransfer}>
                    <h4>{p.nomeItem}</h4>
                    <p>Cód. Barras: {p.codigoBarra}</p>
                    <p>Referência: {p.referencia}</p>
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
          </>
        )}
      </main>
    </div>
  );
}

const styles = {
  login: { height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "Arial" },
  logoLogin: { width: 180, marginBottom: 25 },
  inputContainer: { display: "flex", flexDirection: "column", gap: 15, marginBottom: 20 },
  input: { padding: 12, borderRadius: 10, border: "1px solid #ccc", fontSize: 16, outline: "none" },
  loginButton: { padding: "12px 30px", fontSize: 18, background: "#4a90e2", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" },
  container: { fontFamily: "Arial", padding: 20 },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  logo: { width: 80 },
  title: { fontSize: 24, fontWeight: 600 },
  logoutButton: { padding: "8px 18px", background: "#e03e2f", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" },
  tabs: { display: "flex", gap: 20, marginBottom: 20 },
  tab: { padding: "8px 18px", cursor: "pointer" },
  tabActive: { padding: "8px 18px", cursor: "pointer", borderBottom: "2px solid #4a90e2" },
  section: {},
  select: { padding: 10, borderRadius: 6, border: "1px solid #ccc" },
  gridTransfer: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 18 },
  cardTransfer: { padding: 12, border: "1px solid #ccc", borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center" },
  button: { padding: "8px 16px", borderRadius: 6, border: "none", backgroundColor: "#27ae60", color: "#fff", cursor: "pointer" },
};

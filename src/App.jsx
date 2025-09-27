import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import Barcode from "react-barcode";
import "./styles.css";

const logins = [
  { usuario: "NovoShopping", loja: "NovoShopping", isAdmin: false },
  { usuario: "RibeiraoShopping", loja: "RibeiraoShopping", isAdmin: false },
  { usuario: "DomPedro", loja: "DomPedro", isAdmin: false },
  { usuario: "Iguatemi", loja: "Iguatemi", isAdmin: false },
  { usuario: "Administrador", loja: "Admin", isAdmin: true },
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
      (u) => u.usuario === usuario
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
  const [usuario, setUsuario] = useState(lojas[1]);
  const [senha, setSenha] = useState("");

  return (
    <div style={styles.login}>
      <img src={logoUrl} alt="Logo" style={styles.logoLogin} />
      <h1 style={{ marginBottom: 30, color: "#222" }}>
        Transferência de Produtos
      </h1>
      <div style={styles.inputContainer}>
        <select
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          style={styles.select}
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
      <button
        onClick={() => onLogin(usuario, senha)}
        style={styles.loginButton}
      >
        Entrar
      </button>
      <div style={{ marginTop: 28, fontSize: 13, color: "#999" }}>
        <div>Usuários disponíveis:</div>
        <ul style={{ margin: 0, padding: 0, listStyle: "none", color: "#666" }}>
          <li>NovoShopping / 1234</li>
          <li>RibeiraoShopping / 1234</li>
          <li>DomPedro / 1234</li>
          <li>Iguatemi / 1234</li>
          <li>Administrador / demo1234</li>
        </ul>
      </div>
    </div>
  );
}

function MainApp({ onLogout, isAdmin }) {
  const [abaAtiva, setAbaAtiva] = useState("transferencia");
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
        const lista = dados.map((linha, i) => {
          const codigoProduto = String(linha["Código Produto"] || "").trim();
          const codigosBarras = (String(linha["Códigos de Barras"] || ""))
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
        setTimeout(() => transferirItem(), 100);
        setCodigoDigitado("");
      } else if (encontrados.length > 1) {
        setItensEncontrados(encontrados);
        setItemSelecionado(null);
      }
    }
  };

  const transferirItem = () => {
    if (!itemSelecionado) return alert("Selecione um item ou digite o código.");
    const novaTransferencia = {
      id: Date.now().toString() + "-" + Math.random(),
      itemId: itemSelecionado.id,
      codigo: itemSelecionado.codigo,
      codigoBarra: itemSelecionado.codigoBarra,
      nomeItem: itemSelecionado.nome,
      referencia: itemSelecionado.referencia,
      lojaDestino,
      data: new Date().toISOString(),
    };
    setTransferencias((old) => [novaTransferencia, ...old]);
    alert("Transferência Realizada!");
    setItemSelecionado(null);
    setCodigoDigitado("");
    setItensEncontrados([]);
    setLojaDestino(lojas[1]);
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

  const historicoFiltrado = transferencias;

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <img src={logoUrl} alt="Logo" style={styles.logo} />
        <h1 style={styles.title}>Democrata - Transferência de Produtos</h1>
        <button onClick={onLogout} style={styles.logoutButton}>Sair</button>
      </header>

      <nav style={styles.tabs}>
        <button style={abaAtiva === "transferencia" ? styles.tabActive : styles.tab} onClick={() => setAbaAtiva("transferencia")}>Transferência</button>
        <button style={abaAtiva === "transferidos" ? styles.tabActive : styles.tab} onClick={() => setAbaAtiva("transferidos")}>Itens transferidos</button>
        {isAdmin && <button style={abaAtiva === "admin" ? styles.tabActive : styles.tab} onClick={() => setAbaAtiva("admin")}>Administração</button>}
      </nav>

      <main style={styles.section}>
        {abaAtiva === "transferencia" && (
          <div>
            <input
              type="text"
              autoFocus
              value={codigoDigitado}
              onChange={handleInputChange}
              placeholder="Bipe o código de barras ou digite..."
              style={{ ...styles.input, width: "100%", marginBottom: 20 }}
              onKeyDown={(e) => e.key === "Enter" && transferirItem()}
            />
            {itemSelecionado && (
              <div style={styles.cardTransfer}>
                <div><b>Item selecionado:</b> {itemSelecionado.nome}</div>
                <div><b>Código:</b> {itemSelecionado.codigo}</div>
                <div><b>Referência:</b> {itemSelecionado.referencia}</div>
                <div>
                  <b>Loja destino:</b>{" "}
                  <select value={lojaDestino} onChange={(e) => setLojaDestino(e.target.value)} style={styles.select}>
                    {lojas.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <button onClick={transferirItem} style={styles.button}>Transferir</button>
              </div>
            )}
            {itensEncontrados.length > 1 && (
              <div>
                <h4>Itens encontrados:</h4>
                {itensEncontrados.map((item) => (
                  <div key={item.id} style={styles.cardTransfer} onClick={() => setItemSelecionado(item)}>
                    {item.nome} | Código: {item.codigo} | Ref: {item.referencia}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {abaAtiva === "transferidos" && (
          <div>
            {historicoFiltrado.map((t) => (
              <div key={t.id} style={styles.cardTransfer}>
                <div><b>Item:</b> {t.nomeItem}</div>
                <div><b>Código:</b> {t.codigo}</div>
                <div><b>Referência:</b> {t.referencia}</div>
                <div><b>Loja destino:</b> {t.lojaDestino}</div>
                <div><b>Data:</b> {formatarData(t.data)}</div>
                <Barcode value={t.codigoBarra} height={50} width={1.4} />
              </div>
            ))}
            {isAdmin && <button onClick={excluirTransferencias} style={styles.button}>Excluir histórico</button>}
          </div>
        )}

        {abaAtiva === "admin" && isAdmin && (
          <div>
            <h2>Administração</h2>
            <button onClick={excluirTransferencias} style={{ ...styles.button, background: "#c0392b" }}>Excluir todos os itens transferidos</button>
          </div>
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
  loginButton: { padding: "16px 40px", fontSize: 22, background: "#4a90e2", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", boxShadow: "0 6px 12px rgba(74,144,226,0.4)" },
  container: { fontFamily: "Arial, sans-serif", background: "#fff", minHeight: "100vh", maxWidth: 960, margin: "0 auto", padding: "10px 30px 30px 30px", boxSizing: "border-box" },
  header: { background: "#222", color: "#fff", padding: "18px 30px", display: "flex", alignItems: "center", gap: 20, borderRadius: 10, marginBottom: 30 },
  logo: { width: 90, filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.3))" },
  title: { fontSize: 24, fontWeight: "700", flexGrow: 1 },
  logoutButton: { backgroundColor: "#e03e2f", color: "#fff", border: "none", borderRadius: 8, padding: "10px 22px", fontSize: 15, cursor: "pointer", boxShadow: "0 4px 10px rgba(224,62,47,0.4)" },
  tabs: { display: "flex", gap: 24, marginBottom: 30, borderBottom: "2px solid #eee" },
  tab: { padding: "12px 32px", backgroundColor: "transparent", border: "none", borderBottom: "3px solid transparent", fontWeight: "600", fontSize: 16, color: "#666", cursor: "pointer" },
  tabActive: { padding: "12px 32px", backgroundColor: "transparent", border: "none", borderBottom: "3px solid #4a90e2", fontWeight: "700", fontSize: 16, color: "#222" },
  section: { background: "#fafafa", borderRadius: 12, padding: "12px 25px 25px 25px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", minHeight: 300 },
  button: { backgroundColor: "#4a90e2", border: "none", borderRadius: 12, color: "#fff", fontWeight: "600", fontSize: 16, padding: "14px 22px", cursor: "pointer" },
  cardTransfer: { backgroundColor: "#fff", padding: 18, borderRadius: 10, boxShadow: "0 2px 10px rgba(0,0,0,0.08)", lineHeight: 1.2, marginBottom: 10 },
  select: { width: 220, padding: "7px 12px", fontSize: 15, borderRadius: 7, border: "1.2px solid #ccc", marginTop: 6 }
};

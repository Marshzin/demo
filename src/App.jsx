import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import Barcode from "react-barcode";
import "./styles.css";

const logins = [
  { usuario: "NovoShopping", senha: "1234", isAdmin: false },
  { usuario: "RibeiraoShopping", senha: "1234", isAdmin: false },
  { usuario: "DomPedro", senha: "1234", isAdmin: false },
  { usuario: "Iguatemi", senha: "1234", isAdmin: false },
  { usuario: "Administrador", senha: "demo1234", isAdmin: true },
];

export default function App() {
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [logado, setLogado] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [destinatario, setDestinatario] = useState("");
  const [pedidos, setPedidos] = useState({});
  const [itens, setItens] = useState([]);
  const [codigoBarras, setCodigoBarras] = useState("");
  const [vendedor, setVendedor] = useState("");
  const [notificacao, setNotificacao] = useState("");

  // Carregar XLS
  useEffect(() => {
    fetch("/itens.xls")
      .then((res) => res.arrayBuffer())
      .then((data) => {
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet);
        setItens(json);
      });
  }, []);

  // Login
  const handleLogin = () => {
    const user = logins.find((l) => l.usuario === usuario && l.senha === senha);
    if (user) {
      setLogado(true);
      setIsAdmin(user.isAdmin);
    } else {
      setNotificacao("Usuário ou senha inválidos!");
      setTimeout(() => setNotificacao(""), 3000);
    }
  };

  // BIP automático
  const handleBip = (e) => {
    if (e.key === "Enter" && codigoBarras.trim() !== "" && destinatario && vendedor) {
      const item = itens.find(
        (i) => String(i.codigo) === codigoBarras || String(i.barras) === codigoBarras
      );
      if (item) {
        const novoPedido = {
          ...item,
          vendedor,
          data: new Date().toLocaleString(),
        };
        setPedidos((prev) => ({
          ...prev,
          [destinatario]: [...(prev[destinatario] || []), novoPedido],
        }));
        setNotificacao(`✅ Item transferido para ${destinatario}`);
      } else {
        setNotificacao("❌ Produto não encontrado no estoque!");
      }
      setCodigoBarras("");
      setTimeout(() => setNotificacao(""), 3000);
    }
  };

  // Excluir pedido (admin)
  const excluirPedido = (loja, index) => {
    setPedidos((prev) => {
      const novos = { ...prev };
      novos[loja].splice(index, 1);
      return { ...novos };
    });
  };

  // Logout
  const handleLogout = () => {
    setLogado(false);
    setUsuario("");
    setSenha("");
    setDestinatario("");
    setVendedor("");
  };

  if (!logado) {
    return (
      <div style={styles.loginContainer}>
        <h2>Transferência de Produtos</h2>
        <select value={usuario} onChange={(e) => setUsuario(e.target.value)} style={styles.input}>
          <option value="">Selecione a Loja</option>
          {logins.map((l, i) => (
            <option key={i} value={l.usuario}>
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
        <button onClick={handleLogin} style={styles.button}>
          Entrar
        </button>
        {notificacao && <div className="popup">{notificacao}</div>}
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h2>Painel de Transferência - {usuario}</h2>
      <button onClick={handleLogout} style={styles.logout}>
        Sair
      </button>

      {isAdmin ? (
        <div>
          <h3>Administração - Pedidos</h3>
          {Object.keys(pedidos).map((loja) => (
            <div key={loja} style={styles.card}>
              <h4>{loja}</h4>
              <ul>
                {pedidos[loja].map((p, i) => (
                  <li key={i}>
                    {p.nome} - {p.codigo} - {p.data} - Vendedor: {p.vendedor}
                    <button
                      onClick={() => excluirPedido(loja, i)}
                      style={styles.deleteButton}
                    >
                      Excluir
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <div>
          <label>Destinatário:</label>
          <select
            value={destinatario}
            onChange={(e) => setDestinatario(e.target.value)}
            style={styles.input}
          >
            <option value="">Selecione o Destinatário</option>
            {logins
              .filter((l) => l.usuario !== usuario && !l.isAdmin)
              .map((l, i) => (
                <option key={i} value={l.usuario}>
                  {l.usuario}
                </option>
              ))}
          </select>

          <input
            type="text"
            placeholder="Nome do Vendedor"
            value={vendedor}
            onChange={(e) => setVendedor(e.target.value)}
            style={styles.input}
          />

          <input
            type="text"
            placeholder="Bipar código de barras"
            value={codigoBarras}
            onChange={(e) => setCodigoBarras(e.target.value)}
            onKeyDown={handleBip}
            style={styles.input}
          />

          <h3>Itens Pedidos</h3>
          <ul>
            {(pedidos[usuario] || []).map((p, i) => (
              <li key={i}>
                {p.nome} - {p.codigo} - {p.data} - Vendedor: {p.vendedor}
                <Barcode value={String(p.codigo)} height={30} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {notificacao && <div className="popup">{notificacao}</div>}
    </div>
  );
}

const styles = {
  container: { padding: 20, fontFamily: "Arial" },
  loginContainer: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    width: 300,
    margin: "100px auto",
    padding: 20,
    border: "1px solid #ccc",
    borderRadius: 8,
    textAlign: "center",
  },
  input: { padding: 10, borderRadius: 5, border: "1px solid #ccc" },
  button: {
    padding: 10,
    borderRadius: 5,
    border: "none",
    background: "#3498db",
    color: "#fff",
    cursor: "pointer",
  },
  logout: {
    padding: "6px 12px",
    marginBottom: 15,
    border: "none",
    background: "#e74c3c",
    color: "#fff",
    borderRadius: 5,
    cursor: "pointer",
  },
  card: { border: "1px solid #ccc", borderRadius: 5, padding: 10, marginTop: 10 },
  deleteButton: {
    marginLeft: 10,
    padding: "2px 6px",
    border: "none",
    background: "#e74c3c",
    color: "#fff",
    borderRadius: 4,
    cursor: "pointer",
  },
};

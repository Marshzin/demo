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

const lojas = ["NovoShopping", "RibeiraoShopping", "DomPedro", "Iguatemi"];

export default function App() {
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [logado, setLogado] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState("transferencia");
  const [destinatario, setDestinatario] = useState("");
  const [vendedor, setVendedor] = useState("");
  const [codigoBarras, setCodigoBarras] = useState("");
  const [produtos, setProdutos] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [lojaSelecionada, setLojaSelecionada] = useState(lojas[0]);
  const [notificacao, setNotificacao] = useState(null);

  useEffect(() => {
    fetch("/itens.xls")
      .then((res) => res.arrayBuffer())
      .then((data) => {
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet);
        setProdutos(json);
      });
  }, []);

  const handleLogin = () => {
    const user = logins.find((l) => l.usuario === usuario && l.senha === senha);
    if (user) {
      setLogado(true);
      setIsAdmin(user.isAdmin);
    } else {
      setNotificacao({ mensagem: "Usuário ou senha incorretos", tipo: "erro" });
      setTimeout(() => setNotificacao(null), 3000);
    }
  };

  const handleBip = (e) => {
    if (e.key === "Enter" && codigoBarras.trim() !== "") {
      if (!destinatario) {
        setNotificacao({ mensagem: "Selecione o destinatário!", tipo: "erro" });
        setTimeout(() => setNotificacao(null), 3000);
        return;
      }
      if (!vendedor.trim()) {
        setNotificacao({ mensagem: "Informe o vendedor!", tipo: "erro" });
        setTimeout(() => setNotificacao(null), 3000);
        return;
      }

      const produto = produtos.find(
        (p) =>
          String(p["Códigos de Barras"]).trim() === codigoBarras.trim()
      );

      if (produto) {
        const novoPedido = {
          id: Date.now(),
          codigoBarra: produto["Códigos de Barras"],
          referencia: produto["Referência"],
          nomeItem: produto["Descrição Completa"],
          destinatario,
          vendedor,
        };
        setPedidos((old) => [...old, novoPedido]);
        setCodigoBarras("");
        setNotificacao({
          mensagem: `Item transferido com sucesso para ${destinatario}`,
          tipo: "sucesso",
        });
        setTimeout(() => setNotificacao(null), 3000);
      } else {
        setNotificacao({
          mensagem: "Produto não encontrado no cadastro!",
          tipo: "erro",
        });
        setTimeout(() => setNotificacao(null), 3000);
      }
    }
  };

  if (!logado) {
    return (
      <div style={styles.loginContainer}>
        <h2 style={{ marginBottom: 20 }}>Transferência de Produtos</h2>
        <select
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          style={styles.input}
        >
          <option value="">Selecione a loja</option>
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
        <button onClick={handleLogin} style={styles.button}>
          Entrar
        </button>

        {notificacao && (
          <div
            style={{
              ...styles.notificacao,
              background:
                notificacao.tipo === "sucesso" ? "#2ecc71" : "#e74c3c",
            }}
          >
            {notificacao.mensagem}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <h1 style={{ marginBottom: 20 }}>Painel de Transferência</h1>
      {!isAdmin && (
        <>
          <div style={styles.section}>
            <label>Destinatário:</label>
            <select
              value={destinatario}
              onChange={(e) => setDestinatario(e.target.value)}
              style={styles.input}
            >
              <option value="">Selecione</option>
              {lojas
                .filter((l) => l !== usuario)
                .map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
            </select>
          </div>

          <div style={styles.section}>
            <label>Vendedor:</label>
            <input
              type="text"
              placeholder="Digite o nome do vendedor"
              value={vendedor}
              onChange={(e) => setVendedor(e.target.value)}
              style={styles.input}
              required
            />
          </div>

          <div style={styles.section}>
            <label>Bipar Código de Barras:</label>
            <input
              type="text"
              value={codigoBarras}
              onChange={(e) => setCodigoBarras(e.target.value)}
              onKeyDown={handleBip}
              style={styles.input}
              autoFocus
            />
          </div>

          <h2>Itens Pedidos</h2>
          <div style={styles.grid}>
            {pedidos
              .filter((p) => p.destinatario === usuario)
              .map((p) => (
                <div key={p.id} style={styles.card}>
                  <h4>{p.nomeItem}</h4>
                  <p><b>Referência:</b> {p.referencia}</p>
                  <p><b>Cód. Barras:</b> {p.codigoBarra}</p>
                  <p><b>Vendedor:</b> {p.vendedor}</p>
                  <Barcode value={String(p.codigoBarra)} height={40} width={1.5} />
                </div>
              ))}
          </div>
        </>
      )}

      {isAdmin && (
        <>
          <h2>Administração</h2>
          <div style={styles.section}>
            <label>Selecionar Loja:</label>
            <select
              value={lojaSelecionada}
              onChange={(e) => setLojaSelecionada(e.target.value)}
              style={styles.input}
            >
              {lojas.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div style={styles.grid}>
            {pedidos
              .filter((p) => p.destinatario === lojaSelecionada)
              .map((p) => (
                <div key={p.id} style={styles.card}>
                  <h4>{p.nomeItem}</h4>
                  <p><b>Referência:</b> {p.referencia}</p>
                  <p><b>Cód. Barras:</b> {p.codigoBarra}</p>
                  <p><b>Destinatário:</b> {p.destinatario}</p>
                  <p><b>Vendedor:</b> {p.vendedor}</p>
                  <Barcode value={String(p.codigoBarra)} height={40} width={1.5} />
                  <button
                    style={{ ...styles.button, background: "#c0392b", marginTop: 10 }}
                    onClick={() =>
                      setPedidos((old) => old.filter((item) => item.id !== p.id))
                    }
                  >
                    Excluir
                  </button>
                </div>
              ))}
          </div>
          {pedidos.filter((p) => p.destinatario === lojaSelecionada).length > 0 && (
            <button
              onClick={() =>
                setPedidos((old) => old.filter((p) => p.destinatario !== lojaSelecionada))
              }
              style={{ ...styles.button, background: "#e74c3c", marginTop: 20 }}
            >
              Excluir todos os pedidos da loja
            </button>
          )}
        </>
      )}

      {notificacao && (
        <div
          style={{
            ...styles.notificacao,
            background:
              notificacao.tipo === "sucesso" ? "#2ecc71" : "#e74c3c",
          }}
        >
          {notificacao.mensagem}
        </div>
      )}
    </div>
  );
}

const styles = {
  app: { padding: 20, fontFamily: "Arial, sans-serif" },
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
  input: {
    padding: 10,
    borderRadius: 6,
    border: "1px solid #ccc",
    fontSize: 16,
    width: "100%",
  },
  button: {
    padding: 10,
    borderRadius: 6,
    border: "none",
    background: "#27ae60",
    color: "#fff",
    cursor: "pointer",
    fontSize: 16,
  },
  section: { marginBottom: 20 },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: 16,
  },
  card: {
    border: "1px solid #ccc",
    padding: 12,
    borderRadius: 8,
    background: "#fafafa",
  },
  notificacao: {
    position: "fixed",
    top: 20,
    right: 20,
    color: "#fff",
    padding: "12px 20px",
    borderRadius: 8,
    fontWeight: "600",
    boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
    zIndex: 1000,
  },
};

import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import Barcode from "react-barcode";
import "./styles.css";

const logins = [
  { usuario: "NovoShopping", loja: "NovoShopping", senha: "1234", isAdmin: false },
  { usuario: "RibeiraoShopping", loja: "RibeiraoShopping", senha: "1234", isAdmin: false },
  { usuario: "Iguatemi", loja: "Iguatemi", senha: "1234", isAdmin: false },
  { usuario: "DomPedro", loja: "DomPedro", senha: "1234", isAdmin: false },
  { usuario: "Administrador", loja: "Administrador", senha: "demo1234", isAdmin: true },
];

const lojas = ["NovoShopping", "RibeiraoShopping", "Iguatemi", "DomPedro"];
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

  const handleLogin = () => {
    onLogin(usuario, senha);
  };

  return (
    <div style={styles.login}>
      <img src={logoUrl} alt="Logo" style={styles.logoLogin} />
      <h1 style={styles.title}>Transferência de Produtos</h1>

      <div style={styles.inputContainer}>
        <select
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          style={styles.input}
        >
          {logins.map((u) => (
            <option key={u.usuario} value={u.usuario}>
              {u.usuario}
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
    const dados = localStorage.getItem("transferencias");
    return dados ? JSON.parse(dados) : {};
  });
  const [codigoDigitado, setCodigoDigitado] = useState("");
  const [itensEncontrados, setItensEncontrados] = useState([]);
  const [itemSelecionado, setItemSelecionado] = useState(null);
  const [lojaDestino, setLojaDestino] = useState(lojas[0]);

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
      .catch(() => alert("Erro ao carregar itens.xls"));
  }, []);

  useEffect(() => {
    localStorage.setItem("transferencias", JSON.stringify(transferencias));
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
    setTransferencias((old) => {
      const copia = { ...old };
      if (!copia[usuarioAtual]) copia[usuarioAtual] = [];
      copia[usuarioAtual] = [novaTransferencia, ...copia[usuarioAtual]];
      return copia;
    });
    setItemSelecionado(null);
    setItensEncontrados([]);
    setCodigoDigitado("");
    alert("Transferência Realizada automaticamente!");
  };

  const buscarCodigo = () => {
    if (!codigoDigitado.trim()) return alert("Digite o código, referência ou código de barras.");
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
    setCodigoDigitado("");
  };

  const transferirItem = () => {
    if (!itemSelecionado) return alert("Selecione um item para transferir.");
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
    setTransferencias((old) => {
      const copia = { ...old };
      if (!copia[usuarioAtual]) copia[usuarioAtual] = [];
      copia[usuarioAtual] = [novaTransferencia, ...copia[usuarioAtual]];
      localStorage.setItem("transferencias", JSON.stringify(copia));
      setTransferencias(copia);
      alert("Transferência realizada com sucesso.");
      setItemSelecionado(null);
    });
  };

  return (
    <div style={styles.mainApp}>
      <h1 style={styles.title}>Transferência de Produtos</h1>
      <button onClick={onLogout} style={styles.logoutButton}>Logout</button>
      <div style={styles.container}>
        <div style={styles.panel}>
          <div style={styles.inputSection}>
            <input
              type="text"
              value={codigoDigitado}
              onChange={handleInputChange}
              onBlur={buscarCodigo}
              style={styles.input}
              placeholder="Digite o código ou código de barras"
            />
            <button onClick={buscarCodigo} style={styles.inputButton}>Buscar</button>
          </div>
          <div style={styles.resultados}>
            {itensEncontrados.length > 0 && (
              <div>
                <h3>Resultados encontrados:</h3>
                <ul>
                  {itensEncontrados.map((item) => (
                    <li key={item.id}>
                      <span>{item.nome}</span>
                      <button
                        onClick={() => setItemSelecionado(item)}
                        style={styles.selectItemButton}
                      >
                        Selecionar
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {itemSelecionado && (
              <div style={styles.selectedItem}>
                <h4>Item selecionado:</h4>
                <p>{itemSelecionado.nome}</p>
                <p>Referência: {itemSelecionado.referencia}</p>
                <Barcode value={itemSelecionado.codigoBarra} />
                <button onClick={transferirItem} style={styles.transferButton}>Transferir</button>
              </div>
            )}
          </div>
        </div>
        <div style={styles.transferencias}>
          <h2>Minhas Transferências</h2>
          <ul>
            {transferencias[usuarioAtual] && transferencias[usuarioAtual].map((item) => (
              <li key={item.id}>
                {item.nomeItem} - Destino: {item.lojaDestino}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

const styles = {
  logoLogin: {
    width: "220px",
    marginBottom: "25px",
    objectFit: "contain",
  },
  login: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    height: "100vh",
    backgroundColor: "#f4f4f4",
    textAlign: "center",
  },
  title: {
    fontFamily: "'Roboto', sans-serif", // Fonte personalizada
    fontSize: "32px",
    fontWeight: "700",
    marginBottom: "20px",
  },
  inputContainer: {
    display: "flex",
    flexDirection: "column",
    marginBottom: 30,
  },
  input: {
    padding: "10px",
    margin: "10px",
    borderRadius: "5px",
    border: "1px solid #ddd",
    width: "250px",
  },
  loginButton: {
    padding: "10px 20px",
    backgroundColor: "#4CAF50",
    color: "white",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
  },
  mainApp: {
    fontFamily: "Arial, sans-serif",
    backgroundColor: "#f9f9f9",
    padding: "20px",
    maxWidth: "1200px",
    margin: "0 auto",
  },
  panel: {
    display: "flex",
    flexDirection: "column",
  },
  inputSection: {
    display: "flex",
    marginBottom: "20px",
  },
  inputButton: {
    padding: "10px 20px",
    backgroundColor: "#3faffa",
    color: "white",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
  },
  resultados: {
    marginTop: "20px",
  },
  selectItemButton: {
    padding: "5px 10px",
    backgroundColor: "#ffb6c1",
    color: "white",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
  },
  transferButton: {
    padding: "10px 20px",
    backgroundColor: "#4CAF50",
    color: "white",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
  },
  selectedItem: {
    marginTop: "20px",
  },
  logoutButton: {
    padding: "10px 20px",
    backgroundColor: "#f44336",
    color: "white",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    marginBottom: "30px",
  },
};

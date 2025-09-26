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
      <h1 style={styles.title}>Bem-vindo(a)!</h1>
      <div style={styles.inputContainer}>
        <select
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          style={styles.select}
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
      return copia;
    });

    alert(`Item transferido para ${lojaDestino}!`);
    setItemSelecionado(null);
    setItensEncontrados([]);
    setCodigoDigitado("");
  };

  return (
    <div style={styles.mainApp}>
      <header style={styles.header}>
        <h2>Transferências</h2>
        <button onClick={onLogout} style={styles.logoutButton}>Logout</button>
      </header>
      
      <div style={styles.searchBox}>
        <input
          type="text"
          value={codigoDigitado}
          onChange={handleInputChange}
          placeholder="Digite o código ou código de barras"
          style={styles.inputSearch}
        />
        <button onClick={buscarCodigo} style={styles.searchButton}>Buscar</button>
      </div>
      
      {itensEncontrados.length > 0 && (
        <ul style={styles.itemList}>
          {itensEncontrados.map((item) => (
            <li
              key={item.id}
              onClick={() => setItemSelecionado(item)}
              style={styles.itemListItem}
            >
              <span>{item.nome} ({item.codigo})</span>
              <Barcode value={item.codigoBarra} />
            </li>
          ))}
        </ul>
      )}
      
      {itemSelecionado && (
        <div style={styles.itemDetails}>
          <h3>Item Selecionado</h3>
          <p><strong>{itemSelecionado.nome}</strong></p>
          <p>Referência: {itemSelecionado.referencia}</p>
          <p>Código: {itemSelecionado.codigo}</p>
          
          <div>
            <label>Loja Destino: </label>
            <select
              value={lojaDestino}
              onChange={(e) => setLojaDestino(e.target.value)}
              style={styles.select}
            >
              {lojas.map((loja) => (
                <option key={loja} value={loja}>
                  {loja}
                </option>
              ))}
            </select>
          </div>

          <button onClick={transferirItem} style={styles.transferButton}>Transferir Item</button>
        </div>
      )}
    </div>
  );
}

const styles = {
  login: {
    display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 20px", textAlign: "center", backgroundColor: "#f4f6f9", height: "100vh", justifyContent: "center"
  },
  logoLogin: {
    width: 150, marginBottom: 20
  },
  title: {
    fontSize: 24, marginBottom: 20, color: "#333"
  },
  inputContainer: {
    display: "flex", flexDirection: "column", width: "100%", maxWidth: "320px", gap: 10
  },
  input: {
    padding: "10px", fontSize: "16px", border: "1px solid #ccc", borderRadius: "8px"
  },
  select: {
    padding: "10px", fontSize: "16px", border: "1px solid #ccc", borderRadius: "8px"
  },
  loginButton: {
    padding: "10px 20px", fontSize: "18px", backgroundColor: "#007bff", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer"
  },
  mainApp: {
    padding: "20px", maxWidth: "900px", margin: "0 auto"
  },
  header: {
    display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px"
  },
  logoutButton: {
    padding: "10px", fontSize: "16px", backgroundColor: "#f44336", color: "#fff", border: "none", cursor: "pointer", borderRadius: "8px"
  },
  searchBox: {
    display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px"
  },
  inputSearch: {
    padding: "10px", fontSize: "16px", border: "1px solid #ccc", borderRadius: "8px", width: "60%"
  },
  searchButton: {
    padding: "10px 20px", fontSize: "16px", backgroundColor: "#28a745", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer"
  },
  itemList: {
    marginTop: "20px", padding: "0", listStyle: "none"
  },
  itemListItem: {
    padding: "10px", border: "1px solid #ccc", margin: "5px 0", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", borderRadius: "8px"
  },
  itemDetails: {
    marginTop: "20px", padding: "20px", border: "1px solid #ccc", borderRadius: "8px", backgroundColor: "#f9f9f9"
  },
  transferButton: {
    marginTop: "10px", padding: "10px 20px", fontSize: "16px", backgroundColor: "#007bff", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer"
  }
};


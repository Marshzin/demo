import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import Barcode from "react-barcode";
import "./styles.css";

// =======================
// CONFIGURAÇÕES
// =======================
const logins = [
  { usuario: "NovoShopping", loja: "NovoShopping", isAdmin: false },
  { usuario: "RibeiraoShopping", loja: "RibeiraoShopping", isAdmin: false },
  { usuario: "DomPedro", loja: "DomPedro", isAdmin: false },
  { usuario: "Iguatemi", loja: "Iguatemi", isAdmin: false },
  { usuario: "Adminstrador", loja: "Administrador", isAdmin: true },
];
const senhaPadrao = "1234";
const senhaAdmin = "demo1234";
const lojas = [
  "NovoShopping",
  "RibeiraoShopping",
  "DomPedro",
  "Iguatemi",
  "Adminstrador"
];
const lojaPadrao = "RibeiraoShopping";

// =======================
// COMPONENTE PRINCIPAL
// =======================
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
    if (
      usuarioEncontrado &&
      ((!usuarioEncontrado.isAdmin && senha === senhaPadrao) ||
        (usuarioEncontrado.isAdmin && senha === senhaAdmin))
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

  return (
    <div>
      <div className="decorative-circle"></div>
      <div className="container">
        {!logado ? (
          <div className="login-box">
            <div className="logo">DEMOCRATA</div>
            <h1>Painel de Transferência</h1>
            <LoginForm onLogin={handleLogin} />
          </div>
        ) : (
          <MainApp
            onLogout={handleLogout}
            isAdmin={isAdmin}
            usuarioAtual={usuarioAtual}
          />
        )}
      </div>
    </div>
  );
}

// =======================
// FORMULÁRIO DE LOGIN
// =======================
function LoginForm({ onLogin }) {
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    onLogin(usuario, senha);
  }

  return (
    <form onSubmit={handleSubmit} className="input-group">
      <div className="select-wrapper">
        <span className="select-icon">👤</span>
        <select
          value={usuario}
          onChange={e => setUsuario(e.target.value)}
          required
        >
          <option value="">Selecione o usuário</option>
          {logins.map((login) => (
            <option key={login.usuario} value={login.usuario}>
              {login.usuario}
            </option>
          ))}
        </select>
      </div>

      <div className="input-wrapper">
        <span className="input-icon">🔒</span>
        <input
          type="password"
          placeholder="Senha"
          value={senha}
          onChange={e => setSenha(e.target.value)}
          required
        />
      </div>

      <button type="submit">Entrar</button>
    </form>
  );
}

// =======================
// SISTEMA PRINCIPAL
// =======================
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
          const codigosBarras = String(linha["Códigos de Barras"] || "")
            .split("|")
            .map((c) => c.trim())
            .filter((c) => c.length > 0);

          const codigoBarra = codigosBarras.at(-1) || codigoProduto;
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

  useEffect(() => {
    localStorage.setItem("transferenciasDemocrata", JSON.stringify(transferencias));
  }, [transferencias]);

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

    setTransferencias((old) => [novaTransferencia, ...old]);
    alert("Transferência realizada!");
    setItemSelecionado(null);
    setCodigoDigitado("");
    setItensEncontrados([]);
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
    <div className="login-box" style={{ maxWidth: 950 }}>
      <div className="cabecalho-usuario">
        <h2>👋 Bem-vindo, {usuarioAtual}!</h2>
      </div>

      <nav className="tabs">
        <button className={abaAtiva === "itens" ? "tabActive" : "tab"} onClick={() => setAbaAtiva("itens")}>Itens</button>
        <button className={abaAtiva === "transferidos" ? "tabActive" : "tab"} onClick={() => setAbaAtiva("transferidos")}>Transferidos</button>
        {isAdmin && (
          <button className={abaAtiva === "admin" ? "tabActive" : "tab"} onClick={() => setAbaAtiva("admin")}>Administração</button>
        )}
      </nav>

      {/* CONTINUA ABAIXO... */}
      <main className="section">
        {abaAtiva === "itens" && (
          <>
            <h3>Transferência de Item</h3>

            <div className="search-container">
              <input
                type="text"
                className="input search-input"
                placeholder="🔍 Buscar por código, referência ou código de barras"
                value={codigoDigitado}
                onChange={(e) => {
                  const valor = e.target.value;
                  setCodigoDigitado(valor);
                  if (valor.length > 2) {
                    const encontrados = itens.filter((item) =>
                      item.codigo.toLowerCase().includes(valor.toLowerCase()) ||
                      item.referencia.toLowerCase().includes(valor.toLowerCase()) ||
                      item.codigoBarra.toLowerCase().includes(valor.toLowerCase())
                    );
                    setItensEncontrados(encontrados.slice(0, 10));
                  } else {
                    setItensEncontrados([]);
                  }
                }}
              />
            </div>

            {itensEncontrados.length > 0 && (
              <div className="results-list">
                {itensEncontrados.map((item) => (
                  <div key={item.id} className="result-card">
                    <div>
                      <strong>{item.nome}</strong>
                      <p>Cód: {item.codigo} | Ref: {item.referencia}</p>
                    </div>
                    <button onClick={() => {
                      setItemSelecionado(item);
                      setItensEncontrados([]);
                      setCodigoDigitado("");
                    }}>
                      Selecionar
                    </button>
                  </div>
                ))}
              </div>
            )}

            {itemSelecionado && (
              <div className="item-detail">
                <h4>Item Selecionado</h4>
                <p><strong>Nome:</strong> {itemSelecionado.nome}</p>
                <p><strong>Referência:</strong> {itemSelecionado.referencia}</p>
                <p><strong>Código de Barras:</strong> {itemSelecionado.codigoBarra}</p>
                <Barcode value={itemSelecionado.codigoBarra} height={40} width={1.5} />

                <div className="select-destino">
                  <label>Loja de destino:</label>
                  <select
                    value={lojaDestino}
                    onChange={(e) => setLojaDestino(e.target.value)}
                  >
                    {lojas.filter(l => l !== "Adminstrador").map((loja) => (
                      <option key={loja} value={loja}>{loja}</option>
                    ))}
                  </select>
                </div>

                <button className="transfer-btn" onClick={transferirItem}>
                  ➕ Transferir Item
                </button>
              </div>
            )}
          </>
        )}

        {abaAtiva === "transferidos" && (
          <>
            <h3>Histórico de Transferências</h3>
            {transferencias.length === 0 ? (
              <p>Nenhuma transferência realizada.</p>
            ) : (
              <div className="gridTransfer">
                {transferencias.map((tr) => (
                  <div key={tr.id} className="cardTransfer">
                    <h4>{tr.nomeItem}</h4>
                    <p><strong>Cód. Barras:</strong> {tr.codigoBarra}</p>
                    <p><strong>Referência:</strong> {tr.referencia}</p>
                    <p><strong>Destino:</strong> {tr.lojaDestino}</p>
                    <p style={{ fontSize: 12, color: "#888" }}>
                      Em {formatarData(tr.data)}
                    </p>
                    <Barcode value={tr.codigoBarra} height={40} width={1.5} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {abaAtiva === "admin" && isAdmin && (
          <>
            <h3>Administração</h3>
            <button
              onClick={excluirTransferencias}
              className="button"
              style={{ background: "#c0392b", marginTop: 18 }}
            >
              Excluir todos os itens transferidos
            </button>
          </>
        )}
      </main>

      {/* ✅ BOTÃO DE SAIR NO RODAPÉ */}
      <footer className="footer-sair">
        <button className="botao-sair" onClick={onLogout}>
          ⏻ Sair
        </button>
      </footer>
    </div>
  );
}

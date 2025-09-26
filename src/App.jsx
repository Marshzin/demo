import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import Barcode from "react-barcode";
import "./styles.css";

const logins = [
  { usuario: "NovoShopping", loja: "NovoShopping", senha: "1234", isAdmin: false },
  { usuario: "RibeiraoShopping", loja: "RibeiraoShopping", senha: "1234", isAdmin: false },
  { usuario: "Iguatemi", loja: "Iguatemi", senha: "1234", isAdmin: false },
  { usuario: "DomPedro", loja: "DomPedro", senha: "1234", isAdmin: false },
  { usuario: "admin", loja: "Administrador", senha: "demo1234", isAdmin: true },
];

const lojas = ["NovoShopping", "RibeiraoShopping", "Iguatemi", "DomPedro"];
const logoUrl = "/logo.jpeg";

export default function App() {
  const [logado, setLogado] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [usuarioAtual, setUsuarioAtual] = useState(null);
  const [lojaAtual, setLojaAtual] = useState(null);

  useEffect(() => {
    const storedLogin = localStorage.getItem("logado");
    const storedIsAdmin = localStorage.getItem("isAdmin") === "true";
    const storedUsuario = localStorage.getItem("usuarioAtual");
    const storedLoja = localStorage.getItem("lojaAtual");
    if (storedLogin) setLogado(true);
    if (storedIsAdmin) setIsAdmin(true);
    if (storedUsuario) setUsuarioAtual(storedUsuario);
    if (storedLoja) setLojaAtual(storedLoja);
  }, []);

  function handleLogin(usuario, senha) {
    const usuarioEncontrado = logins.find((u) => u.usuario === usuario);
    if (usuarioEncontrado && senha === usuarioEncontrado.senha) {
      localStorage.setItem("logado", true);
      localStorage.setItem("isAdmin", usuarioEncontrado.isAdmin);
      localStorage.setItem("usuarioAtual", usuarioEncontrado.usuario);
      localStorage.setItem("lojaAtual", usuarioEncontrado.loja);
      setLogado(true);
      setIsAdmin(usuarioEncontrado.isAdmin);
      setUsuarioAtual(usuarioEncontrado.usuario);
      setLojaAtual(usuarioEncontrado.loja);
    } else {
      alert("Usuário ou senha inválidos.");
    }
  }

  function handleLogout() {
    localStorage.clear();
    setLogado(false);
    setIsAdmin(false);
    setUsuarioAtual(null);
    setLojaAtual(null);
  }

  return logado ? (
    <MainApp
      onLogout={handleLogout}
      isAdmin={isAdmin}
      usuarioAtual={usuarioAtual}
      lojaAtual={lojaAtual}
    />
  ) : (
    <Login onLogin={handleLogin} />
  );
}

function Login({ onLogin }) {
  const [usuarioSelecionado, setUsuarioSelecionado] = useState(logins[0].usuario);
  const [senha, setSenha] = useState("");

  const handleLogin = () => {
    onLogin(usuarioSelecionado, senha);
  };

  return (
    <div className="login">
      <img src={logoUrl} alt="Logo" className="logo" />
      <h2>Login</h2>
      <div className="input-container">
        <select
          value={usuarioSelecionado}
          onChange={(e) => setUsuarioSelecionado(e.target.value)}
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
        />
      </div>
      <button onClick={handleLogin}>Entrar</button>
    </div>
  );
}

function MainApp({ onLogout, isAdmin, usuarioAtual, lojaAtual }) {
  const [abaAtiva, setAbaAtiva] = useState("itens");
  const [itens, setItens] = useState([]);
  const [transferencias, setTransferencias] = useState(() => {
    const dados = localStorage.getItem(`transferencias_${lojaAtual}`);
    return dados ? JSON.parse(dados) : [];
  });
  const [codigoDigitado, setCodigoDigitado] = useState("");
  const [itensEncontrados, setItensEncontrados] = useState([]);
  const [itemSelecionado, setItemSelecionado] = useState(null);
  const [lojaDestino, setLojaDestino] = useState(
    lojaAtual !== "Administrador" ? lojaAtual : lojas[0]
  );
  const [lojaParaLimpar, setLojaParaLimpar] = useState(lojas[0]);

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
          const codigoBarra =
            codigosBarras.length > 0
              ? codigosBarras[codigosBarras.length - 1]
              : codigoProduto;
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
    localStorage.setItem(`transferencias_${lojaAtual}`, JSON.stringify(transferencias));
  }, [transferencias, lojaAtual]);

  const handleInputChange = (e) => {
    setCodigoDigitado(e.target.value);
  };

  const buscarCodigo = () => {
    const busca = codigoDigitado.trim().toLowerCase();
    if (!busca) return;
    const encontrados = itens.filter(
      (i) =>
        i.codigo.toLowerCase() === busca ||
        i.codigoBarra.toLowerCase() === busca ||
        i.referencia.toLowerCase() === busca
    );
    setItensEncontrados(encontrados);
    if (encontrados.length === 1) {
      setItemSelecionado(encontrados[0]);
    }
    setCodigoDigitado("");
  };

  const transferirItem = () => {
    if (!itemSelecionado) return alert("Selecione um item para transferir.");
    const novaTransferencia = {
      id: Date.now(),
      codigo: itemSelecionado.codigo,
      codigoBarra: itemSelecionado.codigoBarra,
      nomeItem: itemSelecionado.nome,
      referencia: itemSelecionado.referencia,
      lojaDestino,
      data: new Date().toISOString(),
    };
    setTransferencias((old) => [novaTransferencia, ...old]);
    setItemSelecionado(null);
    setItensEncontrados([]);
  };

  const excluirTransferencias = () => {
    if (isAdmin && window.confirm(`Excluir histórico da loja ${lojaParaLimpar}?`)) {
      localStorage.removeItem(`transferencias_${lojaParaLimpar}`);
      if (lojaParaLimpar === lojaAtual) {
        setTransferencias([]);
      }
    }
  };

  const formatarData = (iso) => {
    const dt = new Date(iso);
    return dt.toLocaleString("pt-BR");
  };

  return (
    <div className="app">
      <header>
        <img src={logoUrl} alt="Logo" className="logo" />
        <h1>{usuarioAtual} - Transferência de Produtos</h1>
        <button onClick={onLogout} className="logout">Sair</button>
      </header>

      <nav className="tabs">
        <button
          className={abaAtiva === "itens" ? "active" : ""}
          onClick={() => setAbaAtiva("itens")}
        >
          Itens
        </button>
        <button
          className={abaAtiva === "transferidos" ? "active" : ""}
          onClick={() => setAbaAtiva("transferidos")}
        >
          Transferidos
        </button>
        {isAdmin && (
          <button
            className={abaAtiva === "admin" ? "active" : ""}
            onClick={() => setAbaAtiva("admin")}
          >
            Administração
          </button>
        )}
      </nav>

      <main>
        {abaAtiva === "itens" && (
          <div>
            <input
              type="text"
              placeholder="Código / Referência / Barras"
              value={codigoDigitado}
              onChange={handleInputChange}
            />
            <button onClick={buscarCodigo}>Buscar</button>
            {itemSelecionado && (
              <button onClick={transferirItem}>Transferir</button>
            )}
            {itensEncontrados.map((item) => (
              <div
                key={item.id}
                className={`item-card ${
                  itemSelecionado?.id === item.id ? "selected" : ""
                }`}
                onClick={() => setItemSelecionado(item)}
              >
                <div>
                  <h4>{item.nome}</h4>
                  <p>Ref: {item.referencia}</p>
                </div>
                <Barcode value={item.codigoBarra} height={40} />
              </div>
            ))}
          </div>
        )}

        {abaAtiva === "transferidos" && (
          <div>
            {transferencias.length === 0 ? (
              <p>Nenhuma transferência.</p>
            ) : (
              transferencias.map((tr) => (
                <div key={tr.id} className="item-card">
                  <div>
                    <h4>{tr.nomeItem}</h4>
                    <p>Ref: {tr.referencia}</p>
                    <p>Destino: {tr.lojaDestino}</p>
                    <p>Data: {formatarData(tr.data)}</p>
                  </div>
                  <Barcode value={tr.codigoBarra} height={40} />
                </div>
              ))
            )}
          </div>
        )}

        {abaAtiva === "admin" && isAdmin && (
          <div>
            <select
              value={lojaParaLimpar}
              onChange={(e) => setLojaParaLimpar(e.target.value)}
            >
              {lojas.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            <button onClick={excluirTransferencias}>Excluir Histórico</button>
          </div>
        )}
      </main>
    </div>
  );
}

import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import "./styles.css";

const logins = [
  { usuario: "DomPedro", isAdmin: false },
  { usuario: "Iguatemi", isAdmin: false },
  { usuario: "NovoShopping", isAdmin: false },
  { usuario: "RibeiraoShopping", isAdmin: false },
  { usuario: "Administrador", isAdmin: true },
];

const senhaPadrao = "1234";
const senhaAdmin = "demo1234";

const lojas = [
  "DomPedro",
  "Iguatemi",
  "NovoShopping",
  "RibeiraoShopping",
  "Administrador",
];

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
    if (usuarioEncontrado) {
      if (
        (!usuarioEncontrado.isAdmin && senha === senhaPadrao) ||
        (usuarioEncontrado.isAdmin && senha === senhaAdmin)
      ) {
        localStorage.setItem("logado", true);
        localStorage.setItem("isAdmin", usuarioEncontrado.isAdmin);
        localStorage.setItem("usuarioAtual", usuarioEncontrado.usuario);
        setLogado(true);
        setIsAdmin(usuarioEncontrado.isAdmin);
        setUsuarioAtual(usuarioEncontrado.usuario);
      } else {
        alert("Senha incorreta.");
      }
    } else {
      alert("Usuário inválido.");
    }
  }

  function handleLogout() {
    localStorage.clear();
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

  return (
    <div className="login-container">
      <h1>Bem-vindo(a)!</h1>
      <select value={usuario} onChange={(e) => setUsuario(e.target.value)}>
        {lojas.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </select>
      <input
        type="password"
        placeholder="Senha"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
      />
      <button className="btn btn-blue" onClick={() => onLogin(usuario, senha)}>
        Entrar
      </button>
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
  const [destinatario, setDestinatario] = useState(lojas[0]);

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

          const descricao = String(
            linha["Descrição Completa"] || "Sem descrição"
          ).trim();
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
        transferirItem(encontrados[0]);
        setCodigoDigitado("");
      } else if (encontrados.length > 1) {
        setItensEncontrados(encontrados);
        setItemSelecionado(null);
      }
    }
  };

  const transferirItem = (item = itemSelecionado) => {
    if (!item) return alert("Selecione um item para transferir.");

    const novaTransferencia = {
      id: Date.now().toString() + "-" + Math.random(),
      codigo: item.codigo,
      codigoBarra: item.codigoBarra,
      nomeItem: item.nome,
      referencia: item.referencia,
      destinatario,
      data: new Date().toISOString(),
    };

    setTransferencias((old) => [novaTransferencia, ...old]);
    alert("Transferência Realizada!");
    setItemSelecionado(null);
    setCodigoDigitado("");
    setItensEncontrados([]);
  };

  const excluirTransferencias = () => {
    if (window.confirm("Excluir todas as transferências?")) {
      setTransferencias([]);
      localStorage.setItem("transferenciasDemocrata", JSON.stringify([]));
    }
  };

  const imprimirTransferencias = () => {
    const printWindow = window.open("", "_blank");
    const conteudo = `
      <html>
        <head><title>Transferências</title></head>
        <body>
          <h2>Histórico de Transferências</h2>
          <table border="1" cellpadding="5" style="border-collapse: collapse; width: 100%;">
            <thead>
              <tr>
                <th>Item</th>
                <th>Referência</th>
                <th>Cód. Barras</th>
                <th>Destinatário</th>
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              ${transferencias
                .map(
                  (tr) => `
                <tr>
                  <td>${tr.nomeItem}</td>
                  <td>${tr.referencia}</td>
                  <td>${tr.codigoBarra}</td>
                  <td>${tr.destinatario}</td>
                  <td>${new Date(tr.data).toLocaleString("pt-BR")}</td>
                </tr>`
                )
                .join("")}
            </tbody>
          </table>
        </body>
      </html>`;
    printWindow.document.write(conteudo);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>Democrata - Transferência</h1>
        <button className="btn btn-red" onClick={onLogout}>
          Sair
        </button>
      </header>

      <nav className="tabs">
        <button
          className={abaAtiva === "transferencia" ? "active" : ""}
          onClick={() => setAbaAtiva("transferencia")}
        >
          Transferência
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

      {abaAtiva === "transferencia" && (
        <div className="card">
          <h2>Buscar e Transferir</h2>
          <input
            type="text"
            placeholder="Código, Referência ou Código de Barras"
            value={codigoDigitado}
            onChange={handleInputChange}
            autoFocus
          />
          <div>
            <label>Destinatário: </label>
            <select
              value={destinatario}
              onChange={(e) => setDestinatario(e.target.value)}
            >
              {lojas.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            <button className="btn btn-blue" onClick={() => transferirItem()}>
              Transferir
            </button>
          </div>
          {itensEncontrados.length > 0 && (
            <ul>
              {itensEncontrados.map((item) => (
                <li
                  key={item.id}
                  onClick={() => setItemSelecionado(item)}
                  style={{
                    cursor: "pointer",
                    fontWeight: itemSelecionado?.id === item.id ? "bold" : "normal",
                  }}
                >
                  {item.nome} - Ref: {item.referencia}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {abaAtiva === "transferidos" && (
        <div className="card">
          <h2>Histórico de Transferências</h2>
          {transferencias.length === 0 ? (
            <p>Nenhuma transferência realizada.</p>
          ) : (
            <>
              <button className="btn btn-blue" onClick={imprimirTransferencias}>
                Imprimir
              </button>
              <table className="table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Referência</th>
                    <th>Cód. Barras</th>
                    <th>Destinatário</th>
                    <th>Data</th>
                  </tr>
                </thead>
                <tbody>
                  {transferencias.map((tr) => (
                    <tr key={tr.id}>
                      <td>{tr.nomeItem}</td>
                      <td>{tr.referencia}</td>
                      <td>{tr.codigoBarra}</td>
                      <td>{tr.destinatario}</td>
                      <td>{new Date(tr.data).toLocaleString("pt-BR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {abaAtiva === "admin" && isAdmin && (
        <div className="card">
          <h2>Administração</h2>
          <button className="btn btn-red" onClick={excluirTransferencias}>
            Excluir todas as transferências
          </button>
        </div>
      )}
    </div>
  );
}

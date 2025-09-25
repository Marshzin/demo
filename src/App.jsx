import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import Barcode from "react-barcode";
import "./styles.css";

// Usuários e lojas
const logins = [
  { usuario: "democrata", loja: "Democrata", isAdmin: false },
  { usuario: "admin", loja: "Administrador", isAdmin: true },
];
const senhaPadrao = "12345";
const lojas = [
  "Novo Shopping",
  "RibeiraoShopping", // Loja padrão
  "Shopping Galleria",
  "Shopping Dom Pedro",
];
const lojaPadrao = "RibeiraoShopping";
const logoUrl = "/logo.jpeg";

// PRINCIPAL
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
    if (usuarioEncontrado && senha === senhaPadrao) {
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

// TELA DE LOGIN
function Login({ onLogin }) {
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");

  const handleLogin = () => {
    onLogin(usuario, senha);
  };

  return (
    <div className="container">
      <div className="login-box">
        <img src={logoUrl} alt="Logo" style={{ width: 120, marginBottom: 18 }} />
        <h1>Painel de Transferência</h1>
        <div className="input-group" style={{ marginBottom: 18 }}>
          <input
            type="text"
            placeholder="Usuário"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            className="input"
          />
          <input
            type="password"
            placeholder="Senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="input"
          />
        </div>
        <button onClick={handleLogin}>Entrar</button>
        <div style={{ marginTop: 28, fontSize: 13, color: "#999", textAlign: "center" }}>
          <div>Usuários disponíveis:</div>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", color: "#666" }}>
            <li>democrata / 12345</li>
            <li>admin / 12345</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// APP PRINCIPAL
function MainApp({ onLogout, isAdmin }) {
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

  useEffect(() => {
    localStorage.setItem("transferenciasDemocrata", JSON.stringify(transferencias));
  }, [transferencias]);

  // Transferência automática ao bipar
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
        setTimeout(() => {
          transferirItemAuto(encontrados[0]);
        }, 150);
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
    setTransferencias((old) => [novaTransferencia, ...old]);
    setItemSelecionado(null);
    setItensEncontrados([]);
    setCodigoDigitado("");
    alert("Transferência Realizada automaticamente!");
  };

  const buscarCodigo = () => {
    if (!codigoDigitado.trim()) {
      alert("Digite o código, referência ou código de barras.");
      return;
    }

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

    if (encontrados.length === 1) {
      setItemSelecionado(encontrados[0]);
    } else {
      setItemSelecionado(null);
    }
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

    setTransferencias((old) => [novaTransferencia, ...old]);
    alert("Transferência Realizada!!");
    setItemSelecionado(null);
    setCodigoDigitado("");
    setLojaDestino(lojas[1]);
    setItensEncontrados([]);
  };

  const excluirTransferencias = () => {
    if (
      window.confirm(
        "Tem certeza que deseja excluir todos os itens transferidos?"
      )
    ) {
      setTransferencias([]);
      localStorage.setItem("transferenciasDemocrata", JSON.stringify([]));
      alert("Todos os itens transferidos foram excluídos.");
    }
  };

  // IMPRESSÃO
  const imprimir = () => {
    const janela = window.open("", "_blank");
    if (janela) {
      janela.document.write(`
        <html>
        <head>
          <title>Imprimir</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f7fa; padding: 18px; text-align: left; }
            .grid-impressao { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; margin-bottom: 30px; }
            .card-impressao { background: #fff; border: 2.5px solid #4a90e2; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.10); padding: 15px 18px; vertical-align: top; text-align: left; width: 340px; margin: 0 auto; display: flex; flex-direction: column; justify-content: flex-start; }
            .nome-item { font-size: 18px; color: #0F3D57; font-weight: 700; margin-bottom: 10px; word-break: break-word; }
            .referencia { font-size: 15px; color: #454545; margin-bottom: 6px; }
            .destino { font-size: 14px; color: #333; margin-bottom: 15px; }
            .barcode { margin: 10px 0 5px 0; text-align: center; }
            .codigo-barra-num { font-size: 15px; letter-spacing: 1.2px; font-family: monospace; margin-top: 8px; color: #0F3D57; font-weight: 600; }
            @media print { body { background: #fff; } .card-impressao { page-break-inside: avoid; } }
          </style>
        </head>
        <body>
          <div class="grid-impressao">
      `);
      transferencias.forEach((tr, idx) => {
        janela.document.write(`
          <div class="card-impressao">
            <div class="nome-item">${tr.nomeItem}</div>
            <div class="referencia"><strong>Referência:</strong> ${tr.referencia}</div>
            <div class="destino"><strong>Destino:</strong> ${tr.lojaDestino}</div>
            <div class="barcode">
              <svg id="barcode-${idx}"></svg>
              <div class="codigo-barra-num">${tr.codigoBarra}</div>
            </div>
          </div>
        `);
      });
      janela.document.write(`
          </div>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode/dist/JsBarcode.all.min.js"></script>
        <script>
          function renderBarcodes() {
            var dados = ${JSON.stringify(transferencias)};
            dados.forEach(function(tr, idx){
              JsBarcode(
                document.getElementById("barcode-" + idx),
                tr.codigoBarra,
                {height:38, width:1.6, fontSize: 13, margin: 0, displayValue: false}
              );
            });
          }
          if (window.JsBarcode) {
            renderBarcodes();
            setTimeout(() => window.print(), 350);
          } else {
            window.onload = () => {
              renderBarcodes();
              setTimeout(() => window.print(), 350);
            }
          }
        </script>
        </body></html>
      `);
      janela.document.close();
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

  const historicoFiltrado = transferencias;

  return (
    <div className="container">
      <header className="header">
        <img src={logoUrl} alt="Logo" className="logo" />
        <h1 className="title">Democrata - Transferência por Código ou Referência</h1>
        <button className="logoutButton" onClick={onLogout}>Sair</button>
      </header>

      <nav className="tabs">
        <button
          className={abaAtiva === "itens" ? "tabActive" : "tab"}
          onClick={() => setAbaAtiva("itens")}
        >
          Itens cadastrados
        </button>
        <button
          className={abaAtiva === "transferidos" ? "tabActive" : "tab"}
          onClick={() => setAbaAtiva("transferidos")}
        >
          Itens transferidos
        </button>
        {isAdmin && (
          <button
            className={abaAtiva === "admin" ? "tabActive" : "tab"}
            onClick={() => setAbaAtiva("admin")}
          >
            Administração
          </button>
        )}
      </nav>

      <main className="section">
        {abaAtiva === "itens" && (
          <>
            <h2 style={{ color: "#1a1a1a", marginBottom: 20 }}>Buscar e Transferir Item</h2>
            <div className="buscaContainer">
              <input
                type="text"
                placeholder="Código de Barras, Referência ou Código"
                value={codigoDigitado}
                onChange={handleInputChange}
                className="input"
                style={{ width: 340 }}
                autoFocus
              />
            </div>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              margin: "12px 0 18px 0"
            }}>
              <label style={{ fontWeight: 600 }}>Loja destino:</label>
              <select
                value={lojaDestino}
                onChange={e => setLojaDestino(e.target.value)}
                className="select"
              >
                {lojas.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
              <button
                className="button"
                onClick={() => {
                  if (itemSelecionado) {
                    transferirItem();
                  } else if (codigoDigitado.trim()) {
                    buscarCodigo();
                    setTimeout(() => {
                      if (itensEncontrados.length === 1) {
                        setItemSelecionado(itensEncontrados[0]);
                        setTimeout(transferirItem, 100);
                      } else {
                        alert("Selecione o item após buscar.");
                      }
                    }, 100);
                  } else {
                    alert("Selecione um item ou digite o código para buscar.");
                  }
                }}
              >
                Transferir
              </button>
            </div>
            {itensEncontrados.length > 0 && (
              <div className="cardContainer">
                <h3>Itens encontrados:</h3>
                <div className="itensList">
                  {itensEncontrados.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setItemSelecionado(item)}
                      className="card"
                      style={{
                        backgroundColor: "#fff",
                        border:
                          item.id === itemSelecionado?.id
                            ? "2px solid #4a90e2"
                            : "2px solid transparent",
                      }}
                    >
                      <div style={{ flex: 2 }}>
                        <h4>{item.nome}</h4>
                        <p>
                          <strong>Referência:</strong> {item.referencia}
                        </p>
                      </div>
                      <div style={{ minWidth: 150, textAlign: "center" }}>
                        <Barcode value={item.codigoBarra} height={40} width={1.5} />
                        <div className="lojaTagSmall">{lojaDestino}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {abaAtiva === "transferidos" && (
          <>
            <h2 style={{ color: "#1a1a1a", marginBottom: 20 }}>Histórico de Transferências</h2>
            {historicoFiltrado.length === 0 ? (
              <p style={{ color: "#666" }}>Nenhuma transferência realizada.</p>
            ) : (
              <div className="gridTransfer">
                {historicoFiltrado.map((tr) => (
                  <div key={tr.id} className="cardTransfer">
                    <h4 style={{ marginTop: 0, marginBottom: 6 }}>{tr.nomeItem}</h4>
                    <p style={{ margin: "2px 0" }}><strong>Cód. Barras:</strong> {tr.codigoBarra}</p>
                    <p style={{ margin: "2px 0" }}><strong>Referência:</strong> {tr.referencia}</p>
                    <p style={{ margin: "2px 0" }}><strong>Destino:</strong> {tr.lojaDestino}</p>
                    <p style={{ fontSize: 12, color: "#888", margin: "2px 0 8px 0" }}>Em {formatarData(tr.data)}</p>
                    <Barcode value={tr.codigoBarra} height={40} width={1.5} />
                  </div>
                ))}
              </div>
            )}
            <button className="button" onClick={imprimir}>Imprimir Códigos de Barras</button>
          </>
        )}

        {abaAtiva === "admin" && isAdmin && (
          <>
            <h2 style={{ color: "#1a1a1a", marginBottom: 20 }}>Administração</h2>
            <button
              onClick={excluirTransferencias}
              className="button"
              style={{
                background: "#c0392b",
                marginTop: 18,
              }}
            >
              Excluir todos os itens transferidos
            </button>
          </>
        )}
      </main>
    </div>
  );
}

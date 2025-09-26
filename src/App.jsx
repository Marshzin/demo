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

  function handleLogin(usuario, senha, loja) {
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
    localStorage.removeItem("logado");
    localStorage.removeItem("isAdmin");
    localStorage.removeItem("usuarioAtual");
    localStorage.removeItem("lojaAtual");
    setLogado(false);
    setIsAdmin(false);
    setUsuarioAtual(null);
    setLojaAtual(null);
  }

  return logado ? (
    <MainApp onLogout={handleLogout} isAdmin={isAdmin} usuarioAtual={usuarioAtual} lojaAtual={lojaAtual} />
  ) : (
    <Login onLogin={handleLogin} />
  );
}

function Login({ onLogin }) {
  const [usuarioSelecionado, setUsuarioSelecionado] = useState(logins[0].usuario);
  const [senha, setSenha] = useState("");

  const handleLogin = () => {
    const usuarioObj = logins.find((u) => u.usuario === usuarioSelecionado);
    if (usuarioObj) {
      onLogin(usuarioObj.usuario, senha, usuarioObj.loja);
    }
  };

  return (
    <div style={styles.login}>
      <img src={logoUrl} alt="Logo" style={styles.logoLogin} />
      <h1 style={{ marginBottom: 30, color: "#222" }}>Bem-vindo(a)!</h1>

      <div style={styles.inputContainer}>
        <select
          value={usuarioSelecionado}
          onChange={(e) => setUsuarioSelecionado(e.target.value)}
          style={{ ...styles.input, padding: 14, borderRadius: 12, cursor: "pointer" }}
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
    localStorage.setItem(`transferencias_${lojaAtual}`, JSON.stringify(transferencias));
  }, [transferencias, lojaAtual]);

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
    setLojaDestino(lojas[0]);
    setItensEncontrados([]);
  };

  const excluirTransferencias = () => {
    if (isAdmin) {
      if (window.confirm(`Excluir histórico da loja ${lojaParaLimpar}?`)) {
        localStorage.removeItem(`transferencias_${lojaParaLimpar}`);
        if (lojaParaLimpar === lojaAtual) {
          setTransferencias([]);
        }
        alert(`Histórico da loja ${lojaParaLimpar} excluído.`);
      }
    }
  };

  const imprimir = () => {
    const janela = window.open("", "_blank");
    if (janela) {
      janela.document.write(
        `<html>
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
            <div class="grid-impressao">`
      );
      transferencias.forEach((tr, idx) => {
        janela.document.write(
          `<div class="card-impressao">
              <div class="nome-item">${tr.nomeItem}</div>
              <div class="referencia"><strong>Referência:</strong> ${tr.referencia}</div>
              <div class="destino"><strong>Destino:</strong> ${tr.lojaDestino}</div>
              <div class="barcode">
                <svg id="barcode-${idx}"></svg>
                <div class="codigo-barra-num">${tr.codigoBarra}</div>
              </div>
            </div>`
        );
      });
      janela.document.write(
        `</div>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode/dist/JsBarcode.all.min.js"></script>
          <script>
            function renderBarcodes() {
              var dados = ${JSON.stringify(transferencias)};
              dados.forEach(function(tr, idx){
                JsBarcode(
                  document.getElementById("barcode-" + idx), tr.codigoBarra,
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
          </body>
        </html>`
      );
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
    <div style={styles.container}>
      <header style={styles.header}>
        <img src={logoUrl} alt="Logo" style={styles.logo} />
        <h1 style={styles.title}>
          {usuarioAtual} - Transferência por Código ou Referência
        </h1>
        <button onClick={onLogout} style={styles.logoutButton}>
          Sair
        </button>
      </header>

      <nav style={styles.tabs}>
        <button
          style={abaAtiva === "itens" ? styles.tabActive : styles.tab}
          onClick={() => setAbaAtiva("itens")}
        >
          Itens cadastrados
        </button>
        <button
          style={abaAtiva === "transferidos" ? styles.tabActive : styles.tab}
          onClick={() => setAbaAtiva("transferidos")}
        >
          Itens transferidos
        </button>
        {isAdmin && (
          <button
            style={abaAtiva === "admin" ? styles.tabActive : styles.tab}
            onClick={() => setAbaAtiva("admin")}
          >
            Administração
          </button>
        )}
      </nav>

      <main style={styles.section}>
        {abaAtiva === "itens" && (
          <>
            <h2 style={{ color: "#1a1a1a", marginBottom: 20 }}> Buscar e Transferir Item </h2>
            <div style={styles.buscaContainer}>
              <input
                type="text"
                placeholder="Código de Barras, Referência ou Código"
                value={codigoDigitado}
                onChange={handleInputChange}
                style={{ ...styles.input, width: 340 }}
                autoFocus
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, margin: "12px 0 18px 0" }}>
              <label style={{ fontWeight: 600 }}>Loja destino:</label>
              <select
                value={lojaDestino}
                onChange={(e) => setLojaDestino(e.target.value)}
                style={styles.select}
                disabled={lojaAtual === "Administrador" ? false : true}
              >
                {lojas.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
              <button
                style={styles.button}
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
              <div style={styles.cardContainer}>
                <h3>Itens encontrados:</h3>
                <div style={styles.itensList}>
                  {itensEncontrados.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setItemSelecionado(item)}
                      style={{
                        ...styles.card,
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
                        <Barcode
                          value={item.codigoBarra}
                          height={40}
                          width={1.4}
                          displayValue={true}
                          fontSize={12}
                        />
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
            <h2 style={{ color: "#1a1a1a", marginBottom: 20 }}> Histórico de Transferências </h2>
            {historicoFiltrado.length === 0 ? (
              <p>Nenhuma transferência realizada.</p>
            ) : (
              <>
                <button onClick={imprimir} style={styles.button}>
                  Imprimir Selecionados
                </button>
                <div style={styles.cardContainer}>
                  {historicoFiltrado.map((tr) => (
                    <div key={tr.id} style={styles.card}>
                      <div style={{ flex: 2 }}>
                        <h4>{tr.nomeItem}</h4>
                        <p>
                          <strong>Referência:</strong> {tr.referencia}
                        </p>
                        <p>
                          <strong>Destino:</strong> {tr.lojaDestino}
                        </p>
                        <p>
                          <strong>Data:</strong> {formatarData(tr.data)}
                        </p>
                      </div>
                      <div style={{ minWidth: 160, textAlign: "center" }}>
                        <Barcode
                          value={tr.codigoBarra}
                          height={40}
                          width={1.4}
                          displayValue={true}
                          fontSize={12}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {abaAtiva === "admin" && isAdmin && (
          <>
            <h2 style={{ color: "#1a1a1a", marginBottom: 20 }}> Administração </h2>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <select
                value={lojaParaLimpar}
                onChange={(e) => setLojaParaLimpar(e.target.value)}
                style={styles.select}
              >
                {lojas.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
              <button onClick={excluirTransferencias} style={{ ...styles.button, background: "#d9534f" }}>
                Excluir Histórico da Loja
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

const styles = {
  container: {
    fontFamily: "'Segoe UI', Arial, sans-serif",
    background: "#f5f7fa",
    minHeight: "100vh",
  },
  header: {
    background: "#0F3D57",
    padding: "14px 22px",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
  },
  logo: {
    height: 50,
    marginRight: 16,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: "600",
  },
  logoutButton: {
    background: "#d9534f",
    border: "none",
    color: "#fff",
    padding: "8px 14px",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 14,
  },
  tabs: {
    display: "flex",
    borderBottom: "2px solid #ddd",
    background: "#fff",
  },
  tab: {
    flex: 1,
    padding: 14,
    cursor: "pointer",
    background: "#fff",
    border: "none",
    fontWeight: 500,
    fontSize: 15,
  },
  tabActive: {
    flex: 1,
    padding: 14,
    cursor: "pointer",
    background: "#e1efff",
    border: "none",
    fontWeight: 600,
    fontSize: 15,
    borderBottom: "3px solid #0F3D57",
  },
  section: {
    padding: 20,
  },
  inputContainer: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
    width: 260,
  },
  input: {
    padding: 12,
    borderRadius: 8,
    border: "1px solid #ccc",
    fontSize: 14,
    outline: "none",
  },
  select: {
    padding: 10,
    borderRadius: 8,
    border: "1px solid #ccc",
    fontSize: 14,
  },
  button: {
    background: "#4a90e2",
    border: "none",
    color: "#fff",
    padding: "10px 16px",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 14,
  },
  login: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
    background: "#eef2f7",
  },
  loginButton: {
    marginTop: 20,
    background: "#0F3D57",
    color: "#fff",
    padding: "12px 20px",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    fontSize: 16,
    fontWeight: 600,
  },
  logoLogin: {
    width: 160,
    marginBottom: 30,
  },
  buscaContainer: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  cardContainer: {
    marginTop: 18,
  },
  card: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "#fff",
    padding: 12,
    marginBottom: 10,
    borderRadius: 8,
    boxShadow: "0 1px 5px rgba(0,0,0,0.1)",
  },
  itensList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    marginTop: 12,
  },
};

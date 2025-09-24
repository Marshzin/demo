import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import Barcode from "react-barcode";
import "./styles.css";

const logins = [
  { usuario: "NovoShopping", senha: "1234", loja: "NovoShopping", isAdmin: false },
  { usuario: "RibeiraoShopping", senha: "1234", loja: "RibeiraoShopping", isAdmin: false },
  { usuario: "Iguatemi", senha: "1234", loja: "Iguatemi", isAdmin: false },
  { usuario: "DomPedro", senha: "1234", loja: "DomPedro", isAdmin: false },
  { usuario: "Administrador", senha: "demo1234", loja: "Administrador", isAdmin: true },
];

const lojas = ["NovoShopping", "RibeiraoShopping", "Iguatemi", "DomPedro"];
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
      (u) => u.usuario === usuario && u.senha === senha
    );
    if (usuarioEncontrado) {
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
      <h1 style={{ marginBottom: 30, color: "#222" }}>Bem-vindo(a)!</h1>

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
    setLojaDestino(lojaPadrao);
    setItensEncontrados([]);
  };

  const excluirTransferencias = () => {
    if (!isAdmin) return;
    if (window.confirm("Tem certeza que deseja excluir todos os itens transferidos?")) {
      setTransferencias([]);
      localStorage.setItem("transferencias", JSON.stringify([]));
      alert("Todos os itens transferidos foram excluídos.");
    }
  };

  const imprimir = () => {
    const janela = window.open("", "_blank");
    if (janela) {
      janela.document.write(`<html><head><title>Imprimir</title><style>
        body{font-family:'Segoe UI',Arial,sans-serif;background:#f5f7fa;padding:18px;}
        .grid-impressao{display:grid;grid-template-columns:repeat(2,1fr);gap:24px;margin-bottom:30px;}
        .card-impressao{background:#fff;border:2.5px solid #4a90e2;border-radius:10px;padding:15px 18px;display:flex;flex-direction:column;justify-content:flex-start;}
        .nome-item{font-size:18px;color:#0F3D57;font-weight:700;margin-bottom:10px;word-break:break-word;}
        .referencia{font-size:15px;color:#454545;margin-bottom:6px;}
        .destino{font-size:14px;color:#333;margin-bottom:15px;}
        .barcode{text-align:center;margin:10px 0 5px 0;}
        .codigo-barra-num{font-size:15px;letter-spacing:1.2px;font-family:monospace;margin-top:8px;color:#0F3D57;font-weight:600;}
        @media print{body{background:#fff}.card-impressao{page-break-inside:avoid;}}
        </style></head><body><div class="grid-impressao">`);
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
      janela.document.write(`</div>
      <script src="https://cdn.jsdelivr.net/npm/jsbarcode/dist/JsBarcode.all.min.js"></script>
      <script>
        function renderBarcodes(){var dados=${JSON.stringify(transferencias)};dados.forEach(function(tr,idx){JsBarcode(document.getElementById("barcode-"+idx),tr.codigoBarra,{height:38,width:1.6,fontSize:13,margin:0,displayValue:false});});}
        if(window.JsBarcode){renderBarcodes();setTimeout(()=>window.print(),350);} else {window.onload=()=>{renderBarcodes();setTimeout(()=>window.print(),350);}}
      </script></body></html>`);
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

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <img src={logoUrl} alt="Logo" style={styles.logo} />
        <div style={{ flexGrow: 1 }}>
          <h1 style={styles.title}>Democrata - Transferência por Código ou Referência</h1>
          <p style={{ fontSize: 14, color: "#ccc" }}>Usuário: {usuarioAtual}</p>
        </div>
        <button onClick={onLogout} style={styles.logoutButton}>Sair</button>
      </header>

      <nav style={styles.tabs}>
        <button style={abaAtiva === "itens" ? styles.tabActive : styles.tab} onClick={() => setAbaAtiva("itens")}>Itens cadastrados</button>
        <button style={abaAtiva === "transferidos" ? styles.tabActive : styles.tab} onClick={() => setAbaAtiva("transferidos")}>Itens transferidos</button>
        {isAdmin && <button style={abaAtiva === "admin" ? styles.tabActive : styles.tab} onClick={() => setAbaAtiva("admin")}>Administração</button>}
      </nav>

      <main style={styles.section}>
        {/* --- Aba Itens --- */}
        {abaAtiva === "itens" && (
          <>
            <h2 style={{ color: "#1a1a1a", marginBottom: 20 }}>Buscar e Transferir Item</h2>
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
              <select value={lojaDestino} onChange={e => setLojaDestino(e.target.value)} style={styles.select}>
                {lojas.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
              <button style={styles.button} onClick={() => {
                if (itemSelecionado) { transferirItem(); } 
                else if (codigoDigitado.trim()) { buscarCodigo(); } 
                else { alert("Selecione um item ou digite o código."); }
              }}>Transferir</button>
            </div>
            {itensEncontrados.length > 0 && (
              <div style={styles.cardContainer}>
                <h3>Itens encontrados:</h3>
                <div style={styles.itensList}>
                  {itensEncontrados.map((item) => (
                    <div key={item.id} onClick={() => setItemSelecionado(item)} style={{...styles.card, border: item.id === itemSelecionado?.id ? "2px solid #4a90e2" : "2px solid transparent"}}>
                      <div style={{ flex: 2 }}>
                        <h4>{item.nome}</h4>
                        <p><strong>Referência:</strong> {item.referencia}</p>
                      </div>
                      <div style={{ minWidth: 150, textAlign: "center" }}>
                        <Barcode value={item.codigoBarra} height={40} width={1.5} />
                        <div style={styles.lojaTagSmall}>{lojaDestino}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* --- Aba Transferidos --- */}
        {abaAtiva === "transferidos" && (
          <>
            <h2 style={{ color: "#1a1a1a", marginBottom: 20 }}>Histórico de Transferências</h2>
            {transferencias.length === 0 ? (
              <p style={{ color: "#666" }}>Nenhuma transferência realizada.</p>
            ) : (
              <div style={styles.gridTransfer}>
                {transferencias.map((tr) => (
                  <div key={tr.id} style={styles.cardTransfer}>
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
            <button onClick={imprimir} style={styles.button}>Imprimir Códigos de Barras</button>
          </>
        )}

        {/* --- Aba Administração --- */}
        {abaAtiva === "admin" && isAdmin && (
          <>
            <h2 style={{ color: "#1a1a1a", marginBottom: 20 }}>Administração</h2>
            <button onClick={excluirTransferencias} style={{...styles.button, background: "#e74c3c"}}>Excluir Todos Itens Transferidos</button>
          </>
        )}
      </main>
    </div>
  );
}

const styles = {
  login: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh" },
  logoLogin: { width: 140, marginBottom: 20 },
  inputContainer: { display: "flex", flexDirection: "column", gap: 12 },
  input: { padding: 10, fontSize: 16, borderRadius: 6, border: "1px solid #ccc" },
  loginButton: { marginTop: 20, padding: "10px 20px", fontSize: 16, borderRadius: 6, background: "#4a90e2", color: "#fff", border: "none", cursor: "pointer" },
  container: { fontFamily: "'Segoe UI',Arial,sans-serif", padding: 16, maxWidth: 1300, margin: "0 auto" },
  header: { display: "flex", alignItems: "center", marginBottom: 20 },
  logo: { width: 80, marginRight: 16 },
  title: { fontSize: 20, margin: 0 },
  logoutButton: { padding: "6px 14px", background: "#e74c3c", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" },
  tabs: { display: "flex", gap: 12, marginBottom: 20 },
  tab: { padding: "8px 18px", cursor: "pointer", border: "1px solid #ccc", borderRadius: 6, background: "#f5f5f5" },
  tabActive: { padding: "8px 18px", cursor: "pointer", border: "1px solid #4a90e2", borderRadius: 6, background: "#4a90e2", color: "#fff" },
  section: { background: "#f9f9f9", padding: 16, borderRadius: 8 },
  buscaContainer: { marginBottom: 16 },
  button: { padding: "8px 18px", background: "#4a90e2", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" },
  select: { padding: 8, borderRadius: 6, border: "1px solid #ccc" },
  cardContainer: { marginTop: 16 },
  itensList: { display: "flex", flexDirection: "column", gap: 10 },
  card: { display: "flex", alignItems: "center", padding: 12, borderRadius: 6, background: "#fff", cursor: "pointer", transition: "0.2s" },
  lojaTagSmall: { marginTop: 4, fontSize: 12, color: "#4a90e2", fontWeight: 600 },
  gridTransfer: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))", gap: 16 },
  cardTransfer: { padding: 12, borderRadius: 6, background: "#fff", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" },
};


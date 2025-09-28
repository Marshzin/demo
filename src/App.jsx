import React, { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import "./styles.css"; // CSS com animações
const logins = [
  { usuario: "NovoShopping", loja: "NovoShopping", isAdmin: false },
  { usuario: "RibeiraoShopping", loja: "RibeiraoShopping", isAdmin: false },
  { usuario: "DomPedro", loja: "DomPedro", isAdmin: false },
  { usuario: "Iguatemi", loja: "Iguatemi", isAdmin: false },
  { usuario: "Administrador", loja: "Administrador", isAdmin: true },
];
const senhaPadrao = "1234";
const senhaAdmin = "demo1234";
const lojas = ["NovoShopping", "RibeiraoShopping", "DomPedro", "Iguatemi"];
const logoUrl = "/logo.jpeg";
const LS_KEY = "pedidosERP";

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
    if (
      usuarioEncontrado &&
      ((usuarioEncontrado.isAdmin && senha === senhaAdmin) ||
        (!usuarioEncontrado.isAdmin && senha === senhaPadrao))
    ) {
      localStorage.setItem("logado", "true");
      localStorage.setItem("isAdmin", usuarioEncontrado.isAdmin ? "true" : "false");
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
  const [usuario, setUsuario] = useState(logins[0].usuario);
  const [senha, setSenha] = useState("");
  const handleLoginClick = () => onLogin(usuario, senha);
  return (
    <div style={styles.login}>
      <img src={logoUrl} alt="Logo" style={styles.logoLogin} />
      <h1 style={{ marginBottom: 20 }}>Transferência de Produtos</h1>
      <div style={styles.inputContainer}>
        <select value={usuario} onChange={(e) => setUsuario(e.target.value)} style={styles.input}>
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
      </div>
      <button onClick={handleLoginClick} style={styles.loginButton}>
        Entrar
      </button>
    </div>
  );
}

function MainApp({ onLogout, isAdmin, usuarioAtual }) {
  const [abaAtiva, setAbaAtiva] = useState("transferencia");
  const [itens, setItens] = useState([]);
  const [pedidos, setPedidos] = useState(() => {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  });

  const [codigoDigitado, setCodigoDigitado] = useState("");
  const [destinatario, setDestinatario] = useState(lojas.find((l) => l !== usuarioAtual));
  const [vendedor, setVendedor] = useState("");

  const [showNotification, setShowNotification] = useState(false);
  const [erroMensagem, setErroMensagem] = useState("");

  const scannerBuffer = useRef("");
  const scannerTimeout = useRef(null);

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(pedidos));
  }, [pedidos]);

  useEffect(() => {
    fetch("/itens.xls")
      .then((res) => res.arrayBuffer())
      .then((data) => {
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        const lista = rows.map((linha, i) => {
          const codigoProduto = String(linha["Código Produto"] ?? "").trim();
          const cbRaw = String(linha["Códigos de Barras"] ?? "");
          const codigosBarras = cbRaw
            .split("|")
            .map((c) => c.trim())
            .filter((c) => c.length > 0)
            .map((c) => c.replace(/[^\dA-Za-z]/g, "").trim());
          let codigoBarra = codigoProduto;
          if (codigosBarras.length > 0) {
            codigosBarras.sort((a, b) => b.length - a.length);
            codigoBarra = codigosBarras[0];
          }
          const descricao = String(linha["Descrição Completa"] ?? "Sem descrição").trim();
          const referencia = String(linha["Referência"] ?? "-").trim();
          return {
            id: `${codigoProduto}-${i}`,
            codigo: codigoProduto,
            codigosBarras,
            codigoBarra,
            nome: descricao,
            referencia,
          };
        });
        setItens(lista);
      })
      .catch((err) => {
        console.error("Erro lendo itens.xls", err);
        setErroMensagem("Erro ao carregar itens.xls. Verifique o arquivo na pasta public/.");
        setTimeout(() => setErroMensagem(""), 4000);
      });
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Enter") {
        const code = scannerBuffer.current.trim();
        if (code.length > 0) {
          processarCodigo(code);
        } else {
          const manual = (document.getElementById("manualCodigoInput") || {}).value;
          if (manual && manual.trim().length > 0) processarCodigo(manual.trim());
        }
        scannerBuffer.current = "";
        if (scannerTimeout.current) {
          clearTimeout(scannerTimeout.current);
          scannerTimeout.current = null;
        }
      } else if (e.key.length === 1) {
        scannerBuffer.current += e.key;
        if (scannerTimeout.current) clearTimeout(scannerTimeout.current);
        scannerTimeout.current = setTimeout(() => {
          scannerBuffer.current = "";
          scannerTimeout.current = null;
        }, 80);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [itens, destinatario, usuarioAtual, pedidos]);

  const handleManualChange = (e) => setCodigoDigitado(e.target.value);
  const handleManualKeyDown = (e) => {
    if (e.key === "Enter") {
      const v = (e.target.value || "").trim();
      if (v.length > 0) {
        processarCodigo(v);
        setCodigoDigitado("");
      }
    }
  };

  const processarCodigo = (valorOriginal) => {
    const valor = String(valorOriginal || "").replace(/[^\w\d]/g, "").trim().toLowerCase();
    if (!valor) return;
    const encontrado = itens.find((it) => {
      return (
        it.codigo.toLowerCase() === valor ||
        it.referencia.toLowerCase() === valor ||
        it.codigoBarra.toLowerCase() === valor ||
        it.codigosBarras?.some((cb) => cb.toLowerCase() === valor)
      );
    });
    if (!encontrado) {
      const foundByEnds = itens.find((it) =>
        it.codigosBarras?.some((cb) => cb.toLowerCase().endsWith(valor))
      );
      if (foundByEnds) {
        registrarPedido(foundByEnds);
        return;
      }
      setErroMensagem(`Nenhum item encontrado para: ${valorOriginal}`);
      setTimeout(() => setErroMensagem(""), 3000);
      return;
    }
    registrarPedido(encontrado);
  };

  const registrarPedido = (item) => {
    if (!item) return;
    if (!destinatario) {
      setErroMensagem("Selecione o destinatário.");
      setTimeout(() => setErroMensagem(""), 3000);
      return;
    }

    const novo = {
      id: Date.now().toString() + "-" + Math.random(),
      itemId: item.id,
      codigo: item.codigo,
      codigoBarra: item.codigoBarra,
      nomeItem: item.nome,
      referencia: item.referencia,
      destinatario,
      origem: usuarioAtual,
      vendedor,
      data: new Date().toISOString(),
    };

    setPedidos((old) => [novo, ...old]);
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 3000);
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <img src={logoUrl} alt="Logo" style={styles.logo} />
        <h1 style={styles.title}>Painel de Transferência</h1>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ color: "#fff", fontWeight: 600 }}>{usuarioAtual}</div>
          <button onClick={onLogout} style={styles.logoutButton}>Sair</button>
        </div>
      </header>

      {/* Notificações */}
      {showNotification && (
        <div className="popup-notification popup-success">
          Produto registrado com sucesso!
        </div>
      )}
      {erroMensagem && (
        <div className="popup-notification popup-error">
          {erroMensagem}
        </div>
      )}

      <main style={styles.section}>
        <h2 style={{ marginBottom: 12 }}>Bipar e Registrar Pedido</h2>

        <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 14 }}>
          <label style={{ fontWeight: 600 }}>Destinatário:</label>
          <select
            value={destinatario}
            onChange={(e) => setDestinatario(e.target.value)}
            style={styles.select}
          >
            <option value="">-- selecione --</option>
            {lojas.filter((l) => l !== usuarioAtual).map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 14 }}>
          <label style={{ fontWeight: 600 }}>Vendedor:</label>
          <input
            type="text"
            value={vendedor}
            onChange={(e) => setVendedor(e.target.value)}
            style={styles.input}
            placeholder="Digite o nome do vendedor"
          />
        </div>

        <input
          id="manualCodigoInput"
          type="text"
          placeholder="Ou digite/cole o código e pressione Enter"
          value={codigoDigitado}
          onChange={handleManualChange}
          onKeyDown={handleManualKeyDown}
          style={{ ...styles.input, width: 420 }}
        />
      </main>
    </div>
  );
}

const styles = {
  container: { fontFamily: "'Roboto', sans-serif", minHeight: "100vh" },
  header: {
    backgroundColor: "#2d3e50",
    padding: "16px 32px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logo: { width: 150, height: 40 },
  title: { color: "#fff", fontSize: 24 },
  logoutButton: {
    backgroundColor: "#e53935",
    color: "#fff",
    padding: "8px 16px",
    border: "none",
    cursor: "pointer",
    borderRadius: 4,
  },
  section: { padding: 20 },
  input: {
    padding: "8px 16px",
    borderRadius: 4,
    border: "1px solid #ccc",
    fontSize: 16,
    width: 280,
  },
  select: {
    padding: "8px 16px",
    borderRadius: 4,
    border: "1px solid #ccc",
    fontSize: 16,
    width: 300,
  },
  login: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    backgroundColor: "#f7f7f7",
  },
  loginButton: {
    backgroundColor: "#2196F3",
    color: "#fff",
    padding: "12px 24px",
    border: "none",
    cursor: "pointer",
    borderRadius: 4,
    fontSize: 16,
    marginTop: 20,
  },
  logoLogin: {
    width: 120,
    height: 40,
    marginBottom: 16,
  },
  inputContainer: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
};

// App.jsx
import React, { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import Barcode from "react-barcode";
import "./styles.css";

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
const logoUrl = "/logo.jpeg"; // ajuste se necessário
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

/* --------------------- Login --------------------- */
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

/* --------------------- MainApp --------------------- */
function MainApp({ onLogout, isAdmin, usuarioAtual }) {
  const [abaAtiva, setAbaAtiva] = useState("transferencia");
  const [itens, setItens] = useState([]); // lista de produtos lida do xls
  const [pedidos, setPedidos] = useState(() => {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  });

  const [codigoDigitado, setCodigoDigitado] = useState("");
  const [itensEncontrados, setItensEncontrados] = useState([]);
  const [itemSelecionado, setItemSelecionado] = useState(null);

  // destinatario: a loja que pediu (o item deverá aparecer na aba dessa loja)
  const [destinatario, setDestinatario] = useState(
    // por padrão selecionar primeira loja diferente do usuário atual
    lojas.find((l) => l !== usuarioAtual) || lojas[0]
  );

  // admin: qual loja está gerenciando
  const [lojaSelecionada, setLojaSelecionada] = useState(lojas[0]);

  const scannerBuffer = useRef("");
  const scannerTimeout = useRef(null);

  // salvar pedidos
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(pedidos));
  }, [pedidos]);

  // carregar itens.xls corretamente (colunas conforme seu print)
  useEffect(() => {
    fetch("/itens.xls")
      .then((res) => res.arrayBuffer())
      .then((data) => {
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        const lista = rows.map((linha, i) => {
          const codigoProduto = String(linha["Código Produto"] ?? "").trim();
          // "Códigos de Barras" pode conter vários, separados por '|'
          const cbRaw = String(linha["Códigos de Barras"] ?? "");
          const codigosBarras = cbRaw
            .split("|")
            .map((c) => c.trim())
            .filter((c) => c.length > 0)
            // normalizar: remover espaços e possíveis caracteres não numéricos na ponta
            .map((c) => c.replace(/[^\dA-Za-z]/g, "").trim());

          // escolher o código "principal" como o mais longo (normalmente EAN13)
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
            codigosBarras, // array de códigos (todos)
            codigoBarra, // principal (o mais longo)
            nome: descricao,
            referencia,
          };
        });

        setItens(lista);
      })
      .catch((err) => {
        console.error("Erro lendo itens.xls", err);
        alert("Erro ao carregar itens.xls. Verifique o arquivo na pasta public/ e os nomes das colunas.");
      });
  }, []);

  /* ------------------ Scanner (bip) automático ------------------ */
  // Escuta teclas globais para detectar scanner (buffer + Enter) e também processa input manual
  useEffect(() => {
    const onKeyDown = (e) => {
      // Se o usuário estiver digitando em um input de texto normalmente, ignore a captura global
      const active = document.activeElement;
      const activeTag = active && active.tagName && active.tagName.toLowerCase();
      const activeIsInput = activeTag === "input" || activeTag === "textarea" || active.isContentEditable;

      // Some scanners act like keyboard and send directly to focused input.
      // We'll still collect globally for reliability, but if focus is in a text input that is the app's code input,
      // we still want to capture. We'll gather all keys.
      if (e.key === "Enter") {
        const code = scannerBuffer.current.trim();
        if (code.length > 0) {
          processarCodigo(code);
        } else {
          // maybe user pressed Enter inside manual field: handle manual value in codigoDigitado
          const manual = (document.getElementById("manualCodigoInput") || {}).value;
          if (manual && manual.trim().length > 0) processarCodigo(manual.trim());
        }
        scannerBuffer.current = "";
        if (scannerTimeout.current) {
          clearTimeout(scannerTimeout.current);
          scannerTimeout.current = null;
        }
      } else if (e.key.length === 1) {
        // acumula caracteres
        scannerBuffer.current += e.key;
        // limpa buffer após 80ms de inatividade (scanners enviam muito rápido)
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

  // Também processa quando usuário digita no campo manual e aperta Enter
  const handleManualChange = (e) => {
    setCodigoDigitado(e.target.value);
  };
  const handleManualKeyDown = (e) => {
    if (e.key === "Enter") {
      const v = (e.target.value || "").trim();
      if (v.length > 0) {
        processarCodigo(v);
        setCodigoDigitado("");
      }
    }
  };

  // procura item e registra pedido (automático)
  const processarCodigo = (valorOriginal) => {
    const valor = String(valorOriginal || "").replace(/[^\w\d]/g, "").trim().toLowerCase();
    if (!valor) return;

    // procura por igualdade com codigo produto / referencia / qualquer codigo de barras
    const encontrado = itens.find((it) => {
      if (!it) return false;
      // comparar codigo produto
      if (String(it.codigo || "").toLowerCase() === valor) return true;
      // comparar referencia
      if (String(it.referencia || "").toLowerCase() === valor) return true;
      // comparar principal
      if (String(it.codigoBarra || "").toLowerCase() === valor) return true;
      // comparar todos os codigos de barras
      if (Array.isArray(it.codigosBarras)) {
        for (const cb of it.codigosBarras) {
          if (String(cb || "").toLowerCase() === valor) return true;
        }
      }
      return false;
    });

    if (!encontrado) {
      // tentar match por final de código (se scanner enviar somente último pedaço)
      const foundByEnds = itens.find((it) => {
        if (!it.codigosBarras) return false;
        return it.codigosBarras.some((cb) => cb.toLowerCase().endsWith(valor));
      });
      if (foundByEnds) {
        registrarPedido(foundByEnds);
        return;
      }

      alert(`Nenhum item encontrado para: ${valorOriginal}`);
      return;
    }

    registrarPedido(encontrado);
  };

  // registra pedido imediatamente (destinatario = loja que pediu)
  const registrarPedido = (item) => {
    if (!item) return;
    if (!destinatario) return alert("Selecione o destinatário (a loja que fez o pedido).");

    const novo = {
      id: Date.now().toString() + "-" + Math.random(),
      itemId: item.id,
      codigo: item.codigo,
      codigoBarra: item.codigoBarra,
      nomeItem: item.nome,
      referencia: item.referencia,
      destinatario, // importante: this is the store that asked (will see it in their tab)
      origem: usuarioAtual, // quem bipa (fonte)
      data: new Date().toISOString(),
    };
    setPedidos((old) => [novo, ...old]);
    // opcional: som curto de sucesso (não incluído), alert minimal:
    // alert(`Pedido registrado: ${item.nome}`);
  };

  const excluirPedido = (id) => {
    setPedidos((old) => old.filter((p) => p.id !== id));
  };

  const excluirTodosDaLoja = (loja) => {
    if (!window.confirm(`Excluir todos os pedidos destinados a ${loja}?`)) return;
    setPedidos((old) => old.filter((p) => p.destinatario !== loja));
  };

  // pedidos que a loja logada deve visualizar (são os pedidos que foram feitos PARA ela)
  const pedidosParaMinhaLoja = pedidos.filter((p) => p.destinatario === usuarioAtual);

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <img src={logoUrl} alt="Logo" style={styles.logo} />
        <h1 style={styles.title}>Painel de Transferência</h1>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ color: "#fff", fontWeight: 600 }}>{usuarioAtual}</div>
          <button onClick={onLogout} style={styles.logoutButton}>
            Sair
          </button>
        </div>
      </header>

      <nav style={styles.tabs}>
        <button
          style={abaAtiva === "transferencia" ? styles.tabActive : styles.tab}
          onClick={() => setAbaAtiva("transferencia")}
        >
          Transferência
        </button>
        <button
          style={abaAtiva === "pedidos" ? styles.tabActive : styles.tab}
          onClick={() => setAbaAtiva("pedidos")}
        >
          Itens Pedidos
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
        {abaAtiva === "transferencia" && (
          <>
            <h2 style={{ marginBottom: 12 }}>Bipar e Registrar Pedido</h2>

            <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 14 }}>
              <label style={{ fontWeight: 600 }}>Destinatário (quem pediu):</label>
              <select value={destinatario} onChange={(e) => setDestinatario(e.target.value)} style={styles.select}>
                <option value="">-- selecione --</option>
                {lojas
                  .filter((l) => l !== usuarioAtual)
                  .map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
              </select>
              <div style={{ color: "#666", fontSize: 13 }}>Aproxime o scanner — ao ler ele registra automaticamente.</div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <input
                id="manualCodigoInput"
                type="text"
                placeholder="Ou digite/cole o código e pressione Enter"
                value={codigoDigitado}
                onChange={handleManualChange}
                onKeyDown={handleManualKeyDown}
                style={{ ...styles.input, width: 420 }}
              />
            </div>

            {itensEncontrados.length > 0 && (
              <div style={styles.cardContainer}>
                <h4>Itens semelhantes encontrados (clique para selecionar):</h4>
                <div style={styles.itensList}>
                  {itensEncontrados.map((it) => (
                    <div key={it.id} style={styles.card} onClick={() => registrarPedido(it)}>
                      <div>
                        <strong>{it.nome}</strong>
                        <div style={{ fontSize: 13 }}>{it.referencia}</div>
                      </div>
                      <div>
                        <Barcode value={it.codigoBarra} height={40} width={1.4} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {abaAtiva === "pedidos" && (
          <>
            <h2 style={{ marginBottom: 12 }}>Itens Pedidos para {usuarioAtual}</h2>
            {pedidosParaMinhaLoja.length === 0 ? (
              <p style={{ color: "#666" }}>Nenhum pedido registrado para sua loja.</p>
            ) : (
              <div style={styles.gridTransfer}>
                {pedidosParaMinhaLoja.map((p) => (
                  <div key={p.id} style={styles.cardTransfer}>
                    <h4 style={{ margin: "6px 0" }}>{p.nomeItem}</h4>
                    <p style={{ margin: "4px 0" }}>
                      <strong>Cód. Barras:</strong> {p.codigoBarra}
                    </p>
                    <p style={{ margin: "4px 0" }}>
                      <strong>Referência:</strong> {p.referencia}
                    </p>
                    <p style={{ margin: "4px 0", fontSize: 13, color: "#555" }}>
                      Registrado por: {p.origem} • {new Date(p.data).toLocaleString()}
                    </p>
                    <Barcode value={p.codigoBarra} height={40} width={1.4} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {abaAtiva === "admin" && isAdmin && (
          <>
            <h2 style={{ marginBottom: 12 }}>Administração</h2>

            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
              <label style={{ fontWeight: 600 }}>Ver pedidos da loja:</label>
              <select value={lojaSelecionada} onChange={(e) => setLojaSelecionada(e.target.value)} style={styles.select}>
                {lojas.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
              <button
                style={{ ...styles.button, background: "#e74c3c" }}
                onClick={() => {
                  if (!window.confirm(`Excluir todos os pedidos destinados a ${lojaSelecionada}?`)) return;
                  excluirTodosDaLoja(lojaSelecionada);
                }}
              >
                Excluir todos da loja
              </button>
            </div>

            <div>
              {pedidos.filter((p) => p.destinatario === lojaSelecionada).length === 0 ? (
                <p style={{ color: "#666" }}>Nenhum pedido registrado para {lojaSelecionada}.</p>
              ) : (
                <div style={styles.gridTransfer}>
                  {pedidos
                    .filter((p) => p.destinatario === lojaSelecionada)
                    .map((p) => (
                      <div key={p.id} style={styles.cardTransfer}>
                        <h4 style={{ margin: "6px 0" }}>{p.nomeItem}</h4>
                        <p style={{ margin: "4px 0" }}>
                          <strong>Cód. Barras:</strong> {p.codigoBarra}
                        </p>
                        <p style={{ margin: "4px 0" }}>
                          <strong>Referência:</strong> {p.referencia}
                        </p>
                        <p style={{ margin: "4px 0", fontSize: 13, color: "#555" }}>
                          Registrado por: {p.origem} • {new Date(p.data).toLocaleString()}
                        </p>
                        <Barcode value={p.codigoBarra} height={40} width={1.4} />
                        <button
                          style={{ ...styles.button, background: "#c0392b", marginTop: 10 }}
                          onClick={() => {
                            if (!window.confirm("Excluir este pedido?")) return;
                            excluirPedido(p.id);
                          }}
                        >
                          Excluir
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

/* --------------------- Styles --------------------- */
const styles = {
  login: {
    height: "100vh",
    background: "#f7f7f7",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  logoLogin: { width: 220, marginBottom: 20 },
  inputContainer: { display: "flex", flexDirection: "column", gap: 12, marginBottom: 10 },
  input: { padding: 12, borderRadius: 10, border: "1px solid #ccc", fontSize: 16, outline: "none" },
  loginButton: { padding: "12px 30px", background: "#4a90e2", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 16 },

  container: { maxWidth: 1100, margin: "20px auto", padding: 18, fontFamily: "Arial, sans-serif" },
  header: { background: "#222", color: "#fff", padding: "12px 18px", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  logo: { width: 88 },
  title: { margin: 0, fontSize: 20, fontWeight: 700, color: "#fff" },
  logoutButton: { padding: "8px 14px", background: "#e03e2f", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" },

  tabs: { display: "flex", gap: 12, margin: "18px 0" },
  tab: { padding: "8px 14px", borderRadius: 8, cursor: "pointer", background: "#eee", border: "none" },
  tabActive: { padding: "8px 14px", borderRadius: 8, cursor: "pointer", background: "#3498db", color: "#fff", border: "none" },

  section: { background: "#fff", padding: 18, borderRadius: 8, boxShadow: "0 6px 18px rgba(0,0,0,0.04)" },

  select: { padding: 10, borderRadius: 8, border: "1px solid #ccc", fontSize: 15 },
  button: { padding: "10px 16px", borderRadius: 8, background: "#27ae60", color: "#fff", border: "none", cursor: "pointer" },

  buscaContainer: { marginBottom: 12 },
  cardContainer: { marginTop: 12 },
  itensList: { display: "flex", flexDirection: "column", gap: 10 },
  card: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, borderRadius: 8, border: "1px solid #eee", cursor: "pointer" },

  gridTransfer: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 },
  cardTransfer: { padding: 12, borderRadius: 8, border: "1px solid #ddd", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, background: "#fff" },
};

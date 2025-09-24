import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import Barcode from "react-barcode";

const lojas = [
  "Novo Shopping",
  "RibeiraoShopping",
  "Shopping Galleria",
  "Shopping Dom Pedro",
  "Shopping Iguatemi",
];

const logoUrl = "/logo.jpeg";

// Login para cada loja
const lojasLogin = {
  admin: "Administrador",
  novoshopping: "Novo Shopping",
  ribeiraoshopping: "RibeiraoShopping",
  dompedro: "Shopping Dom Pedro",
  iguatemi: "Shopping Iguatemi",
};

export default function App() {
  const [logado, setLogado] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [lojaUsuario, setLojaUsuario] = useState("");

  useEffect(() => {
    const storedLogin = localStorage.getItem("logado");
    const storedIsAdmin = localStorage.getItem("isAdmin") === "true";
    const storedLoja = localStorage.getItem("lojaUsuario");
    if (storedLogin) setLogado(true);
    if (storedIsAdmin) setIsAdmin(true);
    if (storedLoja) setLojaUsuario(storedLoja);
  }, []);

  return logado ? (
    <MainApp
      onLogout={() => {
        localStorage.removeItem("logado");
        localStorage.removeItem("isAdmin");
        localStorage.removeItem("lojaUsuario");
        setLogado(false);
        setIsAdmin(false);
        setLojaUsuario("");
      }}
      isAdmin={isAdmin}
      lojaUsuario={lojaUsuario}
    />
  ) : (
    <Login
      onLogin={(usuario, senha) => {
        if (usuario === "admin" && senha === "demo123") {
          localStorage.setItem("logado", true);
          localStorage.setItem("isAdmin", true);
          setLogado(true);
          setIsAdmin(true);
          setLojaUsuario("");
          localStorage.removeItem("lojaUsuario");
        } else if (
          lojasLogin[usuario] &&
          senha === "1234"
        ) {
          localStorage.setItem("logado", true);
          localStorage.setItem("isAdmin", false);
          localStorage.setItem("lojaUsuario", lojasLogin[usuario]);
          setLogado(true);
          setIsAdmin(false);
          setLojaUsuario(lojasLogin[usuario]);
        } else {
          alert("Usuário ou senha inválidos.");
        }
      }}
    />
  );
}

function Login({ onLogin }) {
  const usuarios = [
    { value: "admin", label: "Administrador" },
    { value: "novoshopping", label: "Novo Shopping" },
    { value: "ribeiraoshopping", label: "RibeiraoShopping" },
    { value: "dompedro", label: "Shopping Dom Pedro" },
    { value: "iguatemi", label: "Shopping Iguatemi" },
  ];

  const [usuario, setUsuario] = useState(usuarios[0].value);
  const [senha, setSenha] = useState("");

  const handleLogin = () => {
    onLogin(usuario, senha);
  };

  return (
    <div
      style={{
        maxWidth: 300,
        margin: "100px auto",
        background: "white",
        padding: 20,
        borderRadius: 10,
        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        alignItems: "center", // Centraliza a logo e o conteúdo
        fontFamily: "'Segoe UI', sans-serif",
      }}
    >
      <img src={logoUrl} alt="Logo" style={{ width: 220, marginBottom: 25 }} />
      <h1 style={{ marginBottom: 30, color: "#222" }}>Bem-vindo(a)!</h1>
      <select
        value={usuario}
        onChange={(e) => setUsuario(e.target.value)}
        style={inputStyle}
      >
        {usuarios.map((u) => (
          <option key={u.value} value={u.value}>
            {u.label}
          </option>
        ))}
      </select>
      <input
        type="password"
        placeholder="Senha"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        style={inputStyle}
      />
      <button onClick={handleLogin} style={buttonStyle}>
        Entrar
      </button>
    </div>
  );
}

const inputStyle = {
  margin: "10px 0",
  padding: 14,
  width: "100%",
  borderRadius: 12,
  border: "1.5px solid #ccc",
  fontSize: 18,
  fontWeight: 500,
  outline: "none",
};

const buttonStyle = {
  padding: "14px",
  background: "#007BFF",
  color: "white",
  border: "none",
  borderRadius: 10,
  cursor: "pointer",
  fontSize: 18,
  marginTop: 10,
};

function MainApp({ onLogout, isAdmin, lojaUsuario }) {
  const [abaAtiva, setAbaAtiva] = useState("itens");
  const [itens, setItens] = useState([]);
  const [transferencias, setTransferencias] = useState(() => {
    const dados = localStorage.getItem("transferenciasDemocrata");
    return dados ? JSON.parse(dados) : [];
  });

  const [codigoDigitado, setCodigoDigitado] = useState("");
  const [itensEncontrados, setItensEncontrados] = useState([]);
  const [itemSelecionado, setItemSelecionado] = useState(null);
  const [lojaDestino, setLojaDestino] = useState(lojas[0]);
  const [vendedor, setVendedor] = useState("");
  const [lojaSolicitante, setLojaSolicitante] = useState(lojas[0]); // Novo campo

  useEffect(() => {
    fetch("/itens.xls")
      .then((res) => res.arrayBuffer())
      .then((data) => {
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const dados = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        if (dados.length === 0) {
          alert("Nenhum dado encontrado na planilha.");
          return;
        }

        const lista = dados.map((linha, i) => {
          const codigoProduto = String(linha["Código Produto"] || "").trim();
          const codigosBarras = (String(linha["Códigos de Barras"] || "") || "")
            .split("|")
            .map((c) => c.trim())
            .filter((c) => c.length > 0);
          const codigoBarra = codigosBarras.length > 0 ? codigosBarras[codigosBarras.length - 1] : codigoProduto;
          const descricao = String(linha["Descrição Completa"] || "Sem descrição").trim();
          const referencia = String(linha["Referência"] || "-").trim();
          const setor = String(linha["Setor"] || "").trim();

          return {
            id: `${codigoProduto}-${i}`,
            codigo: codigoProduto,
            codigoBarra,
            nome: descricao,
            referencia,
            setor,
            quantidade: 0,
            tamanho: "-",
            loja: setor || lojas[0],
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

  const buscarCodigo = (codigo) => {
    if (!codigo.trim()) {
      alert("Digite o código do produto, código de barras.");
      return;
    }
    const busca = codigo.trim().toLowerCase();

    const encontrados = itens.filter(
      (i) =>
        i.codigo.toLowerCase() === busca ||
        i.codigoBarra.toLowerCase() === busca ||
        i.referencia.toLowerCase() === busca
    );

    if (encontrados.length === 0) {
      alert("Nenhum item encontrado.");
      setItensEncontrados([]);
      return;
    }

    setItensEncontrados(encontrados);
    setItemSelecionado(null);
  };

  const transferirItem = () => {
    if (!itemSelecionado) return alert("Selecione um item para transferir.");
    if (itemSelecionado.loja === lojaDestino) return alert("O item já está no destinatário.");
    if (!vendedor.trim()) return alert("Digite o nome do vendedor.");

    setItens((oldItens) =>
      oldItens.map((item) =>
        item.id === itemSelecionado.id ? { ...item, loja: lojaDestino } : item
      )
    );

    const novaTransferencia = {
      id: Date.now().toString() + "-" + Math.random(),
      itemId: itemSelecionado.id,
      codigo: itemSelecionado.codigo,
      codigoBarra: itemSelecionado.codigoBarra,
      nomeItem: itemSelecionado.nome,
      referencia: itemSelecionado.referencia,
      lojaOrigem: itemSelecionado.loja,
      lojaDestino: lojaDestino,
      lojaSolicitante: lojaSolicitante,
      vendedor: vendedor,
      tamanho: itemSelecionado.tamanho,
      data: new Date().toISOString(),
    };

    setTransferencias((old) => [novaTransferencia, ...old]);
    alert(`Transferência de ${itemSelecionado.nome} de ${itemSelecionado.loja} para ${lojaDestino} (Solicitante: ${lojaSolicitante}) realizada por ${vendedor}!`);
    setItemSelecionado(null);
    setCodigoDigitado("");
    setVendedor("");
  };

  const excluirTransferencias = () => {
    if (window.confirm("Tem certeza que deseja excluir todos os itens transferidos?")) {
      setTransferencias([]);
      localStorage.setItem("transferenciasDemocrata", JSON.stringify([]));
      alert("Todos os itens transferidos foram excluídos.");
    }
  };

  const imprimir = () => {
    const janela = window.open("", "_blank");
    if (janela) {
      janela.document.write("<html><head><title>Imprimir</title></head><body>");
      transferencias.forEach((tr) => {
        const svgElement = document.querySelector(`svg[data-value='${tr.codigoBarra}']`);
        const svgHtml = svgElement ? svgElement.parentNode.innerHTML : "";
        janela.document.write(`<div style='margin-bottom:30px;text-align:center;'>
          <p><strong>${tr.nomeItem}</strong></p>
          <p>Referência: ${tr.referencia}</p>
          <p>Código: ${tr.codigo}</p>
          <p>Solicitante: ${tr.lojaSolicitante}</p>
          <p>Vendedor: ${tr.vendedor}</p>
          <div>${svgHtml}</div>
        </div>`);
      });
      janela.document.write("</body></html>");
      janela.document.close();
      janela.print();
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

  const transferenciasRecebidas = transferencias.filter(
    (tr) => tr.lojaDestino === lojaUsuario
  );

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <img src={logoUrl} alt="Logo" style={styles.logo} />
        <h1 style={styles.title}>Democrata - Transferência por Código ou Referência</h1>
        <button onClick={onLogout} style={styles.logoutButton}>
          Sair
        </button>
      </header>

      <nav style={styles.tabs}>
        <button
          style={abaAtiva === "itens" ? styles.tabActive : styles.tab}
          onClick={() => setAbaAtiva("itens")}
        >
          Transferência
        </button>
        <button
          style={abaAtiva === "recebidas" ? styles.tabActive : styles.tab}
          onClick={() => setAbaAtiva("recebidas")}
        >
          Recebidas ({lojaUsuario})
        </button>
        {isAdmin && (
          <button
            style={abaAtiva === "admin" ? styles.tabActive : styles.tab}
            onClick={() => setAbaAtiva("admin")}
          >
            Administrador
          </button>
        )}
      </nav>

      <main style={styles.section}>
        {abaAtiva === "itens" && (
          <>
            <h2 style={{ color: "#1a1a1a", marginBottom: 20 }}>
              Buscar e Transferir Item
            </h2>
            <div style={styles.buscaContainer}>
              <input
                type="text"
                placeholder="Digite código, código de barras."
                value={codigoDigitado}
                onChange={(e) => {
                  setCodigoDigitado(e.target.value);
                  buscarCodigo(e.target.value);
                }}
                style={styles.input}
              />
              <button onClick={() => buscarCodigo(codigoDigitado)} style={styles.button}>
                Buscar
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
                        borderColor:
                          item.id === itemSelecionado?.id ? "#4a90e2" : "#ddd",
                        boxShadow:
                          item.id === itemSelecionado?.id
                            ? "0 4px 12px rgba(74, 144, 226, 0.4)"
                            : "0 2px 5px rgba(0,0,0,0.1)",
                      }}
                    >
                      <div style={styles.cardInfo}>
                        <h4 style={styles.cardTitle}>{item.nome}</h4>
                        <p>
                          <strong>Cód. Barras:</strong> {item.codigoBarra}
                        </p>
                        <p>
                          <strong>Referência:</strong> {item.referencia}
                        </p>
                      </div>
                      <div style={styles.barcodeContainer}>
                        <Barcode value={item.codigoBarra} height={50} width={2} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {itemSelecionado && (
              <div style={styles.cardSelected}>
                <label style={{ fontWeight: "600", marginTop: 12, display: "block" }}>
                  Solicitante:
                </label>
                <select
                  value={lojaSolicitante}
                  onChange={(e) => setLojaSolicitante(e.target.value)}
                  style={styles.select}
                >
                  {lojas.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>

                <label style={{ fontWeight: "600", marginTop: 12, display: "block" }}>
                  Destinatário:
                </label>
                <select
                  value={lojaDestino}
                  onChange={(e) => setLojaDestino(e.target.value)}
                  style={styles.select}
                >
                  {lojas.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>

                <label style={{ fontWeight: "600", marginTop: 12, display: "block" }}>
                  Nome do Vendedor:
                </label>
                <input
                  type="text"
                  placeholder="Digite o nome do vendedor"
                  value={vendedor}
                  onChange={(e) => setVendedor(e.target.value)}
                  style={styles.input}
                />

                <button onClick={transferirItem} style={{ ...styles.button, marginTop: 20 }}>
                  Transferir
                </button>
              </div>
            )}
          </>
        )}

        {abaAtiva === "recebidas" && (
          <>
            <h2 style={{ color: "#1a1a1a", marginBottom: 20 }}>
              Transferências recebidas - {lojaUsuario}
            </h2>
            {transferenciasRecebidas.length === 0 ? (
              <p style={{ color: "#666" }}>Nenhuma transferência recebida.</p>
            ) : (
              transferenciasRecebidas.map((tr) => (
                <div key={tr.id} style={styles.cardTransfer}>
                  <p>
                    <strong>Remetente:</strong> {tr.lojaOrigem}
                  </p>
                  <p>
                    <strong>Destinatário:</strong> {tr.lojaDestino}
                  </p>
                  <p>
                    <strong>Solicitante:</strong> {tr.lojaSolicitante}
                  </p>
                  <p>
                    <strong>Vendedor:</strong> {tr.vendedor}
                  </p>
                  <p style={{ fontSize: 12, color: "#888" }}>
                    Em {formatarData(tr.data)}
                  </p>
                  <Barcode value={tr.codigoBarra} height={40} width={1.5} />
                </div>
              ))
            )}
            <button onClick={imprimir} style={styles.button}>
              Imprimir Códigos de Barras
            </button>
          </>
        )}

        {abaAtiva === "admin" && isAdmin && (
          <>
            <h2 style={{ color: "#1a1a1a", marginBottom: 20 }}>
              Área Administrativa
            </h2>
            <button onClick={excluirTransferencias} style={styles.button}>
              Excluir todos os itens transferidos
            </button>
          </>
        )}
      </main>
    </div>
  );
}

const styles = {
  container: {
    fontFamily: "Arial, sans-serif",
    background: "#fff",
    minHeight: "100vh",
    maxWidth: 960,
    margin: "0 auto",
    padding: 30,
    boxSizing: "border-box",
  },
  header: {
    background: "#222",
    color: "#fff",
    padding: "18px 30px",
    display: "flex",
    alignItems: "center",
    gap: 20,
    borderRadius: 10,
    marginBottom: 30,
  },
  logo: {
    width: 90,
    filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.3))",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    flexGrow: 1,
  },
  logoutButton: {
    backgroundColor: "#e03e2f",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "10px 22px",
    fontSize: 15,
    cursor: "pointer",
    boxShadow: "0 4px 10px rgba(224,62,47,0.4)",
    transition: "background-color 0.3s ease",
  },
  tabs: {
    display: "flex",
    gap: 24,
    marginBottom: 30,
    borderBottom: "2px solid #eee",
  },
  tab: {
    padding: "12px 32px",
    backgroundColor: "transparent",
    border: "none",
    borderBottom: "3px solid transparent",
    fontWeight: "600",
    fontSize: 16,
    cursor: "pointer",
    color: "#555",
    transition: "border-color 0.3s ease",
  },
  tabActive: {
    padding: "12px 32px",
    backgroundColor: "transparent",
    border: "none",
    borderBottom: "3px solid #007BFF",
    fontWeight: "700",
    fontSize: 16,
    cursor: "pointer",
    color: "#007BFF",
  },
  section: {
    minHeight: 400,
  },
  buscaContainer: {
    display: "flex",
    gap: 12,
    marginBottom: 18,
  },
  input: {
    flexGrow: 1,
    padding: 14,
    borderRadius: 12,
    border: "1.5px solid #ccc",
    fontSize: 16,
  },
  button: {
    padding: "14px 24px",
    backgroundColor: "#007BFF",
    border: "none",
    color: "#fff",
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: "600",
    fontSize: 16,
    transition: "background-color 0.3s ease",
  },
  cardContainer: {
    borderTop: "2px solid #eee",
    paddingTop: 16,
  },
  itensList: {
    display: "flex",
    flexWrap: "wrap",
    gap: 14,
  },
  card: {
    flex: "1 1 230px",
    border: "2px solid #ddd",
    borderRadius: 12,
    padding: 16,
    cursor: "pointer",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    transition: "all 0.25s ease",
    backgroundColor: "#fafafa",
  },
  cardInfo: {
    flex: 1,
    paddingRight: 12,
  },
  cardTitle: {
    margin: 0,
    marginBottom: 6,
    fontWeight: "700",
    fontSize: 18,
    color: "#222",
  },
  barcodeContainer: {
    minWidth: 110,
  },
  cardSelected: {
    marginTop: 26,
    backgroundColor: "#f3f9ff",
    padding: 20,
    borderRadius: 12,
    boxShadow: "0 4px 20px rgba(0,123,255,0.1)",
    maxWidth: 520,
  },
  select: {
    marginTop: 6,
    padding: 12,
    fontSize: 16,
    borderRadius: 10,
    border: "1.5px solid #ccc",
    width: "100%",
  },
  cardTransfer: {
    backgroundColor: "#fefefe",
    padding: 20,
    borderRadius: 12,
    boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
    marginBottom: 18,
    fontSize: 15,
  },
};

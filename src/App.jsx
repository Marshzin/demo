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
        alignItems: "center",
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
  const [codigoDigitado, setCodigoDigitado] = useState("");
  const [itensEncontrados, setItensEncontrados] = useState([]);
  const [lojaSolicitante, setLojaSolicitante] = useState(lojas[0]);
  const [nomeSolicitante, setNomeSolicitante] = useState("");

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
        // Corrigido: coluna B é a segunda coluna, que no XLSX é a segunda propriedade
        // Mas para garantir, vamos pegar o campo 'Código de Barras' (ou similar), e também a coluna 'B' se ela existir
        const lista = dados.map((linha, i) => {
          // Tenta pegar por nome ou pela coluna B
          const codigoBarra =
            linha["Código de Barras"] ||
            linha["Códigos de Barras"] ||
            linha["Código Produto"] ||
            linha["B"] ||
            Object.values(linha)[1] || // segunda coluna do excel
            "";
          const codigoProduto =
            linha["Código Produto"] ||
            linha["Código"] ||
            linha["A"] ||
            Object.values(linha)[0] ||
            "";
          const descricao = String(linha["Descrição Completa"] || linha["Descrição"] || "Sem descrição").trim();
          const referencia = String(linha["Referência"] || "-").trim();
          const setor = String(linha["Setor"] || "").trim();

          return {
            id: `${codigoProduto}-${i}`,
            codigo: String(codigoProduto).trim(),
            codigoBarra: String(codigoBarra).trim(),
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

  // Bipar: busca e seleciona pelo código ou código de barras (agora coluna B)
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
  };

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
      </nav>

      <main style={styles.section}>
        {/* Busca + solicitante apenas */}
        <div style={styles.buscaContainer}>
          <input
            type="text"
            placeholder="Digite código, código de barras."
            value={codigoDigitado}
            onChange={e => setCodigoDigitado(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") buscarCodigo(codigoDigitado);
            }}
            style={styles.input}
            autoFocus
          />
          <button onClick={() => buscarCodigo(codigoDigitado)} style={styles.button}>
            Buscar
          </button>
        </div>
        <div style={{ marginTop: 16 }}>
          <label style={{ fontWeight: "600", display: "block", marginBottom: 6 }}>
            Loja Solicitante:
          </label>
          <select
            value={lojaSolicitante}
            onChange={e => setLojaSolicitante(e.target.value)}
            style={styles.select}
          >
            {lojas.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Nome (não obrigatório)"
            value={nomeSolicitante}
            onChange={e => setNomeSolicitante(e.target.value)}
            style={{ ...styles.input, marginTop: 8 }}
          />
        </div>
        {/* Cards dos itens encontrados */}
        {itensEncontrados.length > 0 && (
          <div style={styles.cardContainer}>
            <h3>Itens encontrados:</h3>
            <div style={styles.itensList}>
              {itensEncontrados.map((item) => (
                <div key={item.id} style={styles.card}>
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
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fafafa",
    boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
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
  select: {
    marginTop: 6,
    padding: 12,
    fontSize: 16,
    borderRadius: 10,
    border: "1.5px solid #ccc",
    width: "100%",
  },
};

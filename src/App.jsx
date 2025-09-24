Aqui vai o código atualizado com as mudanças que você pediu. Eu refatorei o sistema de login e autenticação para suportar as lojas específicas (NovoShopping, RibeiraoShopping, Iguatemi, DomPedro) + Administrador. Cada loja tem login com senha padrão "1234", e o Administrador tem senha "demo1234". 

### Principais Mudanças:
1. **Logins Atualizados**:
   - Array `logins` agora inclui as 4 lojas (com `isAdmin: false`) e "Administrador" (com `isAdmin: true`).
   - Senhas: Lojas usam "1234"; Admin usa "demo1234".
   - No `handleLogin`, verificação de senha diferenciada por `isAdmin`.

2. **Interface de Login**:
   - Removi o input de usuário e adicionei um `<select>` para escolher a loja/usuário (com opções baseadas no array `logins`).
   - Mantive o input de senha.
   - Ao selecionar, o `handleLogin` usa o valor do select + senha.

3. **Persistência por Loja**:
   - Históricos de transferências agora são salvos separadamente no localStorage, com chave `transferencias_[nomeDaLoja]` (ex: `transferencias_NovoShopping`).
   - No `MainApp`, uso `useEffect` para carregar/salvar transferências baseado no `usuarioAtual` (que agora é o nome da loja, como "NovoShopping").
   - Se o usuário fizer logout e logar em outra loja, o histórico é isolado.

4. **Funcionalidades do Admin**:
   - O admin tem acesso à aba "Administração".
   - Na aba "admin", adicionei:
     - Um select para escolher uma loja específica.
     - Carregamento do histórico daquela loja (em um viewer read-only).
     - Botão para excluir **todos** os itens transferidos de uma loja específica (com confirmação).
     - O admin ainda pode usar o app normal para transferir itens (como se fosse uma "loja genérica"), mas o histórico dele é salvo em `transferencias_Administrador` (você pode ajustar se não quiser isso).
   - Para o admin, o select de "Loja destino" nas transferências continua funcionando com as 4 lojas (não inclui "Administrador" como destino, assumindo que admin não transfere para si).

5. **Outras Atualizações**:
   - Array `lojas` atualizado para: `["NovoShopping", "RibeiraoShopping", "Iguatemi", "DomPedro"]`.
   - `lojaPadrao` continua "RibeiraoShopping".
   - No header, exibe o `usuarioAtual` (nome da loja logada).
   - Corrigi "Adminstrador" para "Administrador" e "demo1234".
   - Mantive o resto do código intacto (busca, impressão, etc.), mas adaptei para o novo contexto.
   - Adicionei um estado de loading básico para transferências no admin (para evitar flicker).

### Código Completo Atualizado:
```jsx
import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import Barcode from "react-barcode";
import "./styles.css";

const logins = [
  { usuario: "NovoShopping", loja: "NovoShopping", isAdmin: false },
  { usuario: "RibeiraoShopping", loja: "RibeiraoShopping", isAdmin: false },
  { usuario: "Iguatemi", loja: "Iguatemi", isAdmin: false },
  { usuario: "DomPedro", loja: "DomPedro", isAdmin: false },
  { usuario: "Administrador", loja: "Administrador", isAdmin: true },
];
const senhaPadraoLojas = "1234";
const senhaAdmin = "demo1234";
const lojas = [
  "NovoShopping",
  "RibeiraoShopping", // Loja padrão
  "Iguatemi",
  "DomPedro",
];
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
      (u) => u.usuario.toLowerCase() === usuario.toLowerCase()
    );
    const senhaCorreta = usuarioEncontrado.isAdmin ? senha === senhaAdmin : senha === senhaPadraoLojas;
    if (usuarioEncontrado && senhaCorreta) {
      localStorage.setItem("logado", true);
      localStorage.setItem("isAdmin", usuarioEncontrado.isAdmin);
      localStorage.setItem("usuarioAtual", usuarioEncontrado.loja);
      setLogado(true);
      setIsAdmin(usuarioEncontrado.isAdmin);
      setUsuarioAtual(usuarioEncontrado.loja);
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
  const [usuarioSelecionado, setUsuarioSelecionado] = useState("NovoShopping");
  const [senha, setSenha] = useState("");

  const handleLogin = () => {
    onLogin(usuarioSelecionado, senha);
  };

  return (
    <div style={styles.login}>
      <img src={logoUrl} alt="Logo" style={styles.logoLogin} />
      <h1 style={{ marginBottom: 30, color: "#222" }}>Bem-vindo(a)!</h1>
      <div style={styles.inputContainer}>
        <select
          value={usuarioSelecionado}
          onChange={(e) => setUsuarioSelecionado(e.target.value)}
          style={{ ...styles.input, padding: "14px" }}
        >
          {logins.map((u) => (
            <option key={u.usuario} value={u.usuario}>
              {u.loja}
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
      <div style={{ marginTop: 28, fontSize: 13, color: "#999" }}>
        <div>Senhas:</div>
        <ul style={{ margin: 0, padding: 0, listStyle: "none", color: "#666" }}>
          <li>Lojas: 1234</li>
          <li>Administrador: demo1234</li>
        </ul>
      </div>
    </div>
  );
}

function MainApp({ onLogout, isAdmin, usuarioAtual }) {
  const [abaAtiva, setAbaAtiva] = useState("itens");
  const [itens, setItens] = useState([]);
  const [transferencias, setTransferencias] = useState([]);
  const [codigoDigitado, setCodigoDigitado] = useState("");
  const [itensEncontrados, setItensEncontrados] = useState([]);
  const [itemSelecionado, setItemSelecionado] = useState(null);
  const [lojaDestino, setLojaDestino] = useState(lojaPadrao);

  // Chave para localStorage baseada na loja logada
  const transferenciasKey = `transferencias_${usuarioAtual}`;

  // Carregar transferências da loja logada
  useEffect(() => {
    if (usuarioAtual) {
      const dados = localStorage.getItem(transferenciasKey);
      setTransferencias(dados ? JSON.parse(dados) : []);
    }
  }, [usuarioAtual, transferenciasKey]);

  // Salvar transferências da loja logada
  useEffect(() => {
    if (usuarioAtual) {
      localStorage.setItem(transferenciasKey, JSON.stringify(transferencias));
    }
  }, [transferencias, usuarioAtual, transferenciasKey]);

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
    setLojaDestino(lojas[1]); // sempre volta para RibeiraoShopping
    setItensEncontrados([]);
  };

  // Função para excluir transferências da loja logada (para não-admin)
  const excluirTransferenciasLojaLogada = () => {
    if (
      window.confirm(
        `Tem certeza que deseja excluir todos os itens transferidos de ${usuarioAtual}?`
      )
    ) {
      setTransferencias([]);
      localStorage.setItem(transferenciasKey, JSON.stringify([]));
      alert("Todos os itens transferidos foram excluídos.");
    }
  };

  // Estados para admin: gerenciar outras lojas
  const [lojaAdminSelecionada, setLojaAdminSelecionada] = useState(lojas[0]);
  const [transferenciasAdmin, setTransferenciasAdmin] = useState([]);
  const [loadingAdmin, setLoadingAdmin] = useState(false);

  // Carregar histórico de uma loja específica (para admin)
  const carregarHistoricoAdmin = (loja) => {
    setLoadingAdmin(true);
    const key = `transferencias_${loja}`;
    const dados = localStorage.getItem(key);
    setTransferenciasAdmin(dados ? JSON.parse(dados) : []);
    setLojaAdminSelecionada(loja);
    setLoadingAdmin(false);
  };

  // Excluir histórico de uma loja específica (para admin)
  const excluirTransferenciasAdmin = (loja) => {
    if (window.confirm(`Excluir todos os itens transferidos de ${loja}?`)) {
      const key = `transferencias_${loja}`;
      localStorage.setItem(key, JSON.stringify([]));
      alert(`Histórico de ${loja} excluído.`);
      // Recarregar o histórico atualizado
      carregarHistoricoAdmin(loja);
    }
  };

  // IMPRESSÃO: etiquetas em grid de 2 colunas por linha (inclui Destino)
  const imprimir = (transferenciasToPrint = transferencias) => {
    const janela = window.open("", "_blank");
    if (janela) {
      janela.document.write(`
        <html>
        <head>
          <title>Imprimir</title>
          <style>
            body {
              font-family: 'Segoe UI', Arial, sans-serif;
              background: #f5f7fa;
              padding: 18px;
              text-align: left;
            }
            .grid-impressao {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 24px;
              margin-bottom: 30px;
            }
            .card-impressao {
              background: #fff;
              border: 2.5px solid #4a90e2;
              border-radius: 10px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.10);
              padding: 15px 18px;
              vertical-align: top;
              text-align: left;
              width: 340px;
              margin: 0 auto;
              display: flex;
              flex-direction: column;
              justify-content: flex-start;
            }
            .nome-item {
              font-size: 18px;
              color: #0F3D57;
              font-weight: 700;
              margin-bottom: 10px;
              word-break: break-word;
            }
            .referencia {
              font-size: 15px;
              color: #454545;
              margin-bottom: 6px;
            }
            .destino {
              font-size: 14px;
              color: #333;
              margin-bottom: 15px;
            }
            .barcode {
              margin: 10px 0 5px 0;
              text-align: center;
            }
            .codigo-barra-num {
              font-size: 15px;
              letter-spacing: 1.2px;
              font-family: monospace;
              margin-top: 8px;
              color: #0F3D57;
              font-weight: 600;
            }
            @media print {
              body { background: #fff; }
              .card-impressao { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="grid-impressao">
      `);
      transferenciasToPrint.forEach((tr, idx) => {
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
            var dados = ${JSON.stringify(transferenciasToPrint)};
            dados.forEach(function(tr, idx){
              JsBarcode(
                document.getElementById("barcode-" + idx),

import React, { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import Barcode from "react-barcode";
import "./styles.css"; // Certifique-se de ter o arquivo de estilo correto aqui

/*
  Usuarios / lojas:
  - Senha padrão: 1234
  - Senha admin: demo1234
*/
const ACCOUNTS = [
  { usuario: "NovoShopping", loja: "NovoShopping", isAdmin: false },
  { usuario: "RibeiraoShopping", loja: "RibeiraoShopping", isAdmin: false },
  { usuario: "DomPedro", loja: "DomPedro", isAdmin: false },
  { usuario: "Iguatemi", loja: "Iguatemi", isAdmin: false },
  { usuario: "Administrador", loja: "Administrador", isAdmin: true },
];

const SENHA_PADRAO = "1234";
const SENHA_ADMIN = "demo1234";
const LOJAS = ["NovoShopping", "RibeiraoShopping", "DomPedro", "Iguatemi"];
const LS_PEDIDOS_KEY = "pedidosERP_v1";
const LOGO_URL = "/logo.jpeg"; // ajuste se necessário

export default function App() {
  // Auth
  const [logado, setLogado] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [usuarioAtual, setUsuarioAtual] = useState(null);

  // UI / tabs
  const [abaAtiva, setAbaAtiva] = useState("transferencia"); // transferencia | pedidos | admin

  // itens carregados do xls
  const [catalogo, setCatalogo] = useState([]);

  // pedidos armazenados (array)
  const [pedidos, setPedidos] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_PEDIDOS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // transferencia inputs
  const [destinatario, setDestinatario] = useState(LOJAS[0]);
  const [vendedor, setVendedor] = useState(""); // Vendedor não é obrigatório
  const [manualCodigo, setManualCodigo] = useState("");

  // admin view select
  const [lojaSelecionada, setLojaSelecionada] = useState(LOJAS[0]);

  // notificacao {msg, tipo: 'sucesso'|'erro'} ou null
  const [notificacao, setNotificacao] = useState(null);

  // scanner buffer refs
  const scannerBuffer = useRef("");
  const scannerTimeout = useRef(null);

  // load itens.xls on mount
  useEffect(() => {
    fetch("/itens.xls")
      .then((res) => res.arrayBuffer())
      .then((data) => {
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        // normalize rows -> catalogo entries
        const list = rows.map((row, idx) => {
          const codigoProduto = String(row["Código Produto"] ?? "").trim();
          const cbRaw = String(row["Códigos de Barras"] ?? "");
          const codigosBarras = cbRaw
            .split("|")
            .map((c) => c.trim())
            .filter((c) => c.length > 0)
            .map((c) => c.replace(/[^\dA-Za-z]/g, "").trim()); // normalize
          // choose principal (longest) if exists
          const codigoBarra = codigosBarras.length > 0 ? [...codigosBarras].sort((a, b) => b.length - a.length)[0] : codigoProduto;
          const descricao = String(row["Descrição Completa"] ?? "Sem descrição").trim();
          const referencia = String(row["Referência"] ?? "").trim();

          return {
            id: `${codigoProduto}-${idx}`,
            codigoProduto,
            codigosBarras,
            codigoBarra,
            descricao,
            referencia,
            raw: row,
          };
        });
        setCatalogo(list);
      })
      .catch((err) => {
        console.error("Erro ao carregar itens.xls", err);
        showNotificacao("Erro ao carregar itens.xls — verifique arquivo e colunas.", "erro");
      });
  }, []);

  // persist pedidos
  useEffect(() => {
    try {
      localStorage.setItem(LS_PEDIDOS_KEY, JSON.stringify(pedidos));
    } catch (e) {
      console.error("Erro ao salvar pedidos no localStorage", e);
    }
  }, [pedidos]);

  // -------- scanner global listener (keyboard-emulating scanners) ----------
  useEffect(() => {
    const onKeyDown = (e) => {
      // ignore certain modifier-only events
      if (e.key === "Shift" || e.key === "Control" || e.key === "Alt" || e.key === "Meta") return;

      // If focused element is text input, still capture: scanner usually sends to focused input but global capture ensures it works.
      if (e.key === "Enter") {
        const code = scannerBuffer.current.trim();
        if (code.length > 0) {
          processarCodigo(code);
        } else {
          // fallback: if manual input field has value and Enter pressed (user typed), process it
          const manualEl = document.getElementById("manualCodigoInput");
          const manualVal = manualEl ? (manualEl.value || "").trim() : "";
          if (manualVal) processarCodigo(manualVal);
        }
        scannerBuffer.current = "";
        if (scannerTimeout.current) {
          clearTimeout(scannerTimeout.current);
          scannerTimeout.current = null;
        }
      } else if (e.key.length === 1) {
        scannerBuffer.current += e.key;
        // clear buffer quickly after inactivity — scanners send fast
        if (scannerTimeout.current) clearTimeout(scannerTimeout.current);
        scannerTimeout.current = setTimeout(() => {
          scannerBuffer.current = "";
          scannerTimeout.current = null;
        }, 80);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogo, destinatario, vendedor, usuarioAtual, pedidos]);

  // manual input handler (Enter)
  const onManualKeyDown = (e) => {
    if (e.key === "Enter") {
      const v = (e.target.value || "").trim();
      if (v) {
        processarCodigo(v);
        setManualCodigo("");
      }
    }
  };

  // processa código (scanner ou manual)
  const processarCodigo = (valorOriginal) => {
    const valor = String(valorOriginal || "").replace(/[^\w\d]/g, "").trim().toLowerCase();
    if (!valor) return;

    // validations
    if (!usuarioAtual) {
      showNotificacao("Faça login primeiro.", "erro");
      return;
    }
    if (!destinatario) {
      showNotificacao("Selecione o destinatário (a loja que pediu).", "erro");
      return;
    }

    // Verifica se o item já foi transferido para o destinatário
    const itemJaTransferido = pedidos.some((pedido) => pedido.codigoProduto === valor && pedido.destinatario === destinatario);
    if (itemJaTransferido) {
      showNotificacao("Este item já foi transferido para o destinatário.", "erro");
      return;
    }

    // lookup: codigoProduto, codigoBarra principal, qualquer codigosBarras, referencia
    let encontrado = catalogo.find((it) => {
      if (!it) return false;
      if ((it.codigoProduto || "").toLowerCase() === valor) return true;
      if ((it.codigoBarra || "").toLowerCase() === valor) return true;
      if ((it.referencia || "").toLowerCase() === valor) return true;
      if (Array.isArray(it.codigosBarras)) {
        if (it.codigosBarras.some((cb) => (cb || "").toLowerCase() === valor)) return true;
      }
      return false;
    });

    // try partial match by ending (some scanners trim leading zeros)
    if (!encontrado) {
      encontrado = catalogo.find((it) => it.codigosBarras && it.codigosBarras.some((cb) => cb.toLowerCase().endsWith(valor)));
    }

    if (!encontrado) {
      showNotificacao(`Produto não encontrado: ${valorOriginal}`, "erro");
      return;
    }

    // criar pedido: destinatario = loja que pediu (vai ver na aba dela)
    const novoPedido = {
      id: Date.now().toString() + "-" + Math.random().toString(36).slice(2, 9),
      itemId: encontrado.id,
      codigoProduto: encontrado.codigoProduto,
      codigoBarra: encontrado.codigoBarra,
      codigosBarras: encontrado.codigosBarras,
      descricao: encontrado.descricao,
      referencia: encontrado.referencia,
      destinatario,
      vendedor: vendedor.trim() || "Não informado", // not required anymore
      data: new Date().toISOString(),
    };

    setPedidos((old) => [novoPedido, ...old]);
    showNotificacao(`Item transferido p/ ${destinatario} — ${encontrado.descricao}`, "sucesso");
  };

  // show notificacao
  const showNotificacao = (msg, tipo) => {
    setNotificacao({ msg, tipo });
    setTimeout(() => {
      setNotificacao(null);
    }, 3000);
  };

  // login handler
  const onLogin = (usuario, senha) => {
    const usuarioLogado = ACCOUNTS.find(
      (a) => a.usuario === usuario && (a.isAdmin ? senha === SENHA_ADMIN : senha === SENHA_PADRAO)
    );
    if (usuarioLogado) {
      setUsuarioAtual(usuarioLogado.usuario);
      setIsAdmin(usuarioLogado.isAdmin);
      setLogado(true);
    } else {
      showNotificacao("Usuário ou senha incorretos", "erro");
    }
  };

  return (
    <div className="App">
      <header>
        <img src={LOGO_URL} alt="Logo" className="logo" />
        <h1>Sistema de Transferências de Estoque</h1>
      </header>
      {logado ? (
        <>
          <nav className="nav">
            <button onClick={() => setAbaAtiva("transferencia")}>Transferência</button>
            <button onClick={() => setAbaAtiva("pedidos")}>Pedidos</button>
            {isAdmin && <button onClick={() => setAbaAtiva("admin")}>Admin</button>}
          </nav>

          {abaAtiva === "transferencia" && (
            <div className="transferencia">
              <h2>Transferir Produto</h2>
              <div>
                <label>
                  Destinatário:
                  <select
                    value={destinatario}
                    onChange={(e) => setDestinatario(e.target.value)}
                  >
                    {LOJAS.map((loja) => (
                      <option key={loja} value={loja}>
                        {loja}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div>
                <label>
                  Vendedor:
                  <input
                    type="text"
                    value={vendedor}
                    onChange={(e) => setVendedor(e.target.value)}
                    placeholder="Digite o nome do vendedor"
                  />
                </label>
              </div>
              <div>
                <label>
                  Código do Produto:
                  <input
                    id="manualCodigoInput"
                    type="text"
                    value={manualCodigo}
                    onChange={(e) => setManualCodigo(e.target.value)}
                    onKeyDown={onManualKeyDown}
                    placeholder="Escaneie ou digite o código"
                  />
                </label>
              </div>
            </div>
          )}

          {abaAtiva === "pedidos" && (
            <div className="pedidos">
              <h2>Pedidos Realizados</h2>
              <ul>
                {pedidos.map((pedido, idx) => (
                  <li key={idx}>
                    {pedido.descricao} - {pedido.destinatario}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {abaAtiva === "admin" && isAdmin && (
            <div className="admin">
              <h2>Admin: Gerenciar Pedidos</h2>
              <label>
                Selecione uma loja:
                <select
                  value={lojaSelecionada}
                  onChange={(e) => setLojaSelecionada(e.target.value)}
                >
                  {LOJAS.map((loja) => (
                    <option key={loja} value={loja}>
                      {loja}
                    </option>
                  ))}
                </select>
              </label>
              <div>
                <h3>Pedidos da Loja: {lojaSelecionada}</h3>
                <ul>
                  {pedidos
                    .filter((pedido) => pedido.destinatario === lojaSelecionada)
                    .map((pedido, idx) => (
                      <li key={idx}>
                        {pedido.descricao} - {pedido.vendedor || "Não informado"}{" "}
                        <Barcode value={pedido.codigoProduto} />
                      </li>
                    ))}
                </ul>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="login">
          <h2>Faça login</h2>
          <div>
            <label>
              Usuário:
              <input
                type="text"
                placeholder="Digite seu usuário"
                onChange={(e) => setUsuarioAtual(e.target.value)}
              />
            </label>
          </div>
          <div>
            <label>
              Senha:
              <input
                type="password"
                placeholder="Digite sua senha"
                onChange={(e) => setUsuarioAtual(e.target.value)}
              />
            </label>
          </div>
          <button onClick={() => onLogin(usuarioAtual)}>Entrar</button>
        </div>
      )}

      {/* Notificação */}
      {notificacao && (
        <div className={`notificacao ${notificacao.tipo}`}>
          {notificacao.msg}
        </div>
      )}
    </div>
  );
}

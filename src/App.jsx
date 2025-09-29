import React, { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import Barcode from "react-barcode";
import "./styles.css";

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

export default function App() {
  const [logado, setLogado] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [usuarioAtual, setUsuarioAtual] = useState(null);

  const [abaAtiva, setAbaAtiva] = useState("transferencia"); // transferencia | pedidos | admin
  const [catalogo, setCatalogo] = useState([]);
  const [pedidos, setPedidos] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_PEDIDOS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [destinatario, setDestinatario] = useState(LOJAS[0]);
  const [vendedor, setVendedor] = useState("");
  const [manualCodigo, setManualCodigo] = useState("");

  const [lojaSelecionada, setLojaSelecionada] = useState(LOJAS[0]);

  const [notificacao, setNotificacao] = useState(null);

  const scannerBuffer = useRef("");
  const scannerTimeout = useRef(null);

  useEffect(() => {
    fetch("/itens.xls")
      .then((res) => res.arrayBuffer())
      .then((data) => {
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        const list = rows.map((row, idx) => {
          const codigoProduto = String(row["Código Produto"] ?? "").trim();
          const cbRaw = String(row["Códigos de Barras"] ?? "");
          const codigosBarras = cbRaw
            .split("|")
            .map((c) => c.trim())
            .filter((c) => c.length > 0)
            .map((c) => c.replace(/[^\dA-Za-z]/g, "").trim());
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

  useEffect(() => {
    try {
      localStorage.setItem(LS_PEDIDOS_KEY, JSON.stringify(pedidos));
    } catch (e) {
      console.error("Erro ao salvar pedidos no localStorage", e);
    }
  }, [pedidos]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Enter") {
        const code = scannerBuffer.current.trim();
        if (code.length > 0) {
          processarCodigo(code);
        } else {
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
        if (scannerTimeout.current) clearTimeout(scannerTimeout.current);
        scannerTimeout.current = setTimeout(() => {
          scannerBuffer.current = "";
          scannerTimeout.current = null;
        }, 80);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [catalogo, destinatario, vendedor, usuarioAtual, pedidos]);

  const onManualKeyDown = (e) => {
    if (e.key === "Enter") {
      const v = (e.target.value || "").trim();
      if (v) {
        processarCodigo(v);
        setManualCodigo("");
      }
    }
  };

  const processarCodigo = (valorOriginal) => {
    const valor = String(valorOriginal || "").replace(/[^\w\d]/g, "").trim().toLowerCase();
    if (!valor) return;

    if (!usuarioAtual) {
      showNotificacao("Faça login primeiro.", "erro");
      return;
    }
    if (!destinatario) {
      showNotificacao("Selecione o destinatário (a loja que pediu).", "erro");
      return;
    }

    const itemJaTransferido = pedidos.some((pedido) => pedido.codigoProduto === valor && pedido.destinatario === destinatario);
    if (itemJaTransferido) {
      showNotificacao("Este item já foi transferido para o destinatário.", "erro");
      return;
    }

    let encontrado = catalogo.find((it) => {
      if ((it.codigoProduto || "").toLowerCase() === valor) return true;
      if ((it.codigoBarra || "").toLowerCase() === valor) return true;
      if ((it.referencia || "").toLowerCase() === valor) return true;
      if (Array.isArray(it.codigosBarras)) {
        if (it.codigosBarras.some((cb) => (cb || "").toLowerCase() === valor)) return true;
      }
      return false;
    });

    if (!encontrado) {
      encontrado = catalogo.find((it) => it.codigosBarras && it.codigosBarras.some((cb) => cb.toLowerCase().endsWith(valor)));
    }

    if (!encontrado) {
      showNotificacao(`Produto não encontrado: ${valorOriginal}`, "erro");
      return;
    }

    const novoPedido = {
      id: Date.now().toString() + "-" + Math.random().toString(36).slice(2, 9),
      itemId: encontrado.id,
      codigoProduto: encontrado.codigoProduto,
      codigoBarra: encontrado.codigoBarra,
      codigosBarras: encontrado.codigosBarras,
      descricao: encontrado.descricao,
      referencia: encontrado.referencia,
      destinatario,
      vendedor: vendedor.trim() || "Não informado",
      data: new Date().toISOString(),
    };

    setPedidos((old) => [novoPedido, ...old]);
    showNotificacao(`Item transferido p/ ${destinatario} — ${encontrado.descricao}`, "sucesso");
  };

  const showNotificacao = (msg, tipo) => {
    setNotificacao({ msg, tipo });
    setTimeout(() => {
      setNotificacao(null);
    }, 3000);
  };

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
      <header className="header">
        <h1>Sistema de Transferências ERP</h1>
      </header>
      {logado ? (
        <>
          <div className="nav">
            <button onClick={() => setAbaAtiva("transferencia")}>Transferência</button>
            <button onClick={() => setAbaAtiva("pedidos")}>Pedidos</button>
            {isAdmin && <button onClick={() => setAbaAtiva("admin")}>Admin</button>}
          </div>

          {abaAtiva === "transferencia" && (
            <div className="container">
              <h2>Transferir Produto</h2>
              <form>
                <div className="form-row">
                  <label>Destinatário:</label>
                  <select value={destinatario} onChange={(e) => setDestinatario(e.target.value)}>
                    {LOJAS.map((loja) => (
                      <option key={loja} value={loja}>
                        {loja}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-row">
                  <label>Vendedor:</label>
                  <input
                    type="text"
                    value={vendedor}
                    onChange={(e) => setVendedor(e.target.value)}
                    placeholder="Digite o nome do vendedor"
                  />
                </div>

                <div className="form-row">
                  <label>Código Produto:</label>
                  <input
                    type="text"
                    id="manualCodigoInput"
                    value={manualCodigo}
                    onChange={(e) => setManualCodigo(e.target.value)}
                    onKeyDown={onManualKeyDown}
                    placeholder="Escaneie ou digite o código"
                  />
                </div>
              </form>
            </div>
          )}

          {abaAtiva === "pedidos" && (
            <div className="container">
              <h2>Pedidos Realizados</h2>
              <ul className="list">
                {pedidos.map((pedido, idx) => (
                  <li key={idx}>
                    {pedido.descricao} - {pedido.destinatario}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {abaAtiva === "admin" && isAdmin && (
            <div className="container">
              <h2>Admin: Gerenciar Pedidos</h2>
              <div>
                <label>Selecione a Loja:</label>
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
              </div>
              <ul className="list">
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
          )}
        </>
      ) : (
        <div className="login">
          <h2>Faça login</h2>
          <input
            type="text"
            placeholder="Usuário"
            onChange={(e) => setUsuarioAtual(e.target.value)}
          />
          <input
            type="password"
            placeholder="Senha"
            onChange={(e) => setUsuarioAtual(e.target.value)}
          />
          <button onClick={() => onLogin(usuarioAtual)}>Entrar</button>
        </div>
      )}

      {/* Notificação */}
      {notificacao && (
        <div className={`notificacao ${notificacao.tipo}`}>{notificacao.msg}</div>
      )}
    </div>
  );
}

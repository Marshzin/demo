// =======================
// SISTEMA PRINCIPAL
// =======================
function MainApp({ onLogout, isAdmin, usuarioAtual }) {
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

  // carregar planilha de itens
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

  // atualizar itens encontrados sempre que digitar
  useEffect(() => {
    if (!codigoDigitado) {
      setItensEncontrados([]);
      return;
    }
    const termo = codigoDigitado.toLowerCase();
    const resultados = itens.filter(
      (item) =>
        item.codigo.toLowerCase().includes(termo) ||
        item.referencia.toLowerCase().includes(termo) ||
        item.codigoBarra.toLowerCase().includes(termo) ||
        item.nome.toLowerCase().includes(termo)
    );
    setItensEncontrados(resultados);
  }, [codigoDigitado, itens]);

  // Transferir item
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
    setItensEncontrados([]);
  };

  // excluir histórico
  const excluirTransferencias = () => {
    if (window.confirm("Tem certeza que deseja excluir todos os itens transferidos?")) {
      setTransferencias([]);
      localStorage.setItem("transferenciasDemocrata", JSON.stringify([]));
      alert("Todos os itens transferidos foram excluídos.");
    }
  };

  // formatar data
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
    <div className="login-box" style={{ maxWidth: 950, width: "100%" }}>
      <h2>Bem-vindo, {usuarioAtual}!</h2>
      <button className="logout" onClick={onLogout} style={{ float: "right", marginBottom: 18 }}>
        Sair
      </button>

      {/* Abas */}
      <nav className="tabs" style={{ marginTop: 20 }}>
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

      {/* Conteúdo */}
      <main className="section">
        {abaAtiva === "itens" && (
          <>
            <h3>Buscar e Transferir Item</h3>
            <input
              type="text"
              placeholder="Digite código, referência ou código de barras"
              value={codigoDigitado}
              onChange={(e) => setCodigoDigitado(e.target.value)}
              className="input"
            />

            {/* Resultados da busca */}
            {itensEncontrados.length > 0 && (
              <div className="gridTransfer">
                {itensEncontrados.map((item) => (
                  <div
                    key={item.id}
                    className={`cardTransfer ${itemSelecionado?.id === item.id ? "selecionado" : ""}`}
                    onClick={() => setItemSelecionado(item)}
                    style={{ cursor: "pointer" }}
                  >
                    <h4>{item.nome}</h4>
                    <p><strong>Cód:</strong> {item.codigo}</p>
                    <p><strong>Cód. Barras:</strong> {item.codigoBarra}</p>
                    <p><strong>Ref:</strong> {item.referencia}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Seleção de loja destino */}
            {itemSelecionado && (
              <div style={{ marginTop: 20 }}>
                <h4>Selecionado: {itemSelecionado.nome}</h4>
                <label>Loja de destino: </label>
                <select value={lojaDestino} onChange={(e) => setLojaDestino(e.target.value)}>
                  {lojas.map((loja) => (
                    <option key={loja} value={loja}>{loja}</option>
                  ))}
                </select>
                <br />
                <button onClick={transferirItem} style={{ marginTop: 10 }}>Transferir</button>
              </div>
            )}
          </>
        )}

        {abaAtiva === "transferidos" && (
          <>
            <h3>Histórico de Transferências</h3>
            {transferencias.length === 0 ? (
              <p>Nenhuma transferência realizada.</p>
            ) : (
              <div className="gridTransfer">
                {transferencias.map((tr) => (
                  <div key={tr.id} className="cardTransfer">
                    <h4>{tr.nomeItem}</h4>
                    <p><strong>Cód. Barras:</strong> {tr.codigoBarra}</p>
                    <p><strong>Referência:</strong> {tr.referencia}</p>
                    <p><strong>Destino:</strong> {tr.lojaDestino}</p>
                    <p style={{ fontSize: 12, color: "#888" }}>
                      Em {formatarData(tr.data)}
                    </p>
                    <Barcode value={tr.codigoBarra} height={40} width={1.5} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {abaAtiva === "admin" && isAdmin && (
          <>
            <h3>Administração</h3>
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

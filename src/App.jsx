// ... (imports and top unchanged)

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
  const [lojaSolicitante, setLojaSolicitante] = useState(lojas[0]);
  const [nomeSolicitante, setNomeSolicitante] = useState(""); // novo campo

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

  // Agora bipar faz buscarCodigo e seleciona automaticamente o primeiro
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
      setItemSelecionado(null);
      return;
    }
    setItensEncontrados(encontrados);
    setItemSelecionado(encontrados[0]); // Seleciona automaticamente o primeiro encontrado
  };

  const transferirItem = () => {
    if (!itemSelecionado) return alert("Selecione um item para transferir.");
    if (itemSelecionado.loja === lojaDestino) return alert("O item já está no destinatário.");
    // nomeSolicitante não é obrigatório
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
      nomeSolicitante: nomeSolicitante,
      vendedor: vendedor,
      tamanho: itemSelecionado.tamanho,
      data: new Date().toISOString(),
    };

    setTransferencias((old) => [novaTransferencia, ...old]);
    alert(`Transferência de ${itemSelecionado.nome} de ${itemSelecionado.loja} para ${lojaDestino} (Loja Solicitante: ${lojaSolicitante}${nomeSolicitante ? " - " + nomeSolicitante : ""}) realizada por ${vendedor}!`);
    setItemSelecionado(null);
    setCodigoDigitado("");
    setVendedor("");
    setNomeSolicitante("");
  };

  // ... outras funções iguais ...

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
            {/* Loja Solicitante e nome logo abaixo do bipar */}
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
                    <strong>Loja Solicitante:</strong> {tr.lojaSolicitante}
                    {tr.nomeSolicitante ? ` - ${tr.nomeSolicitante}` : ""}
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

// ... styles and Login function unchanged ...

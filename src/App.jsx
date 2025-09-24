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

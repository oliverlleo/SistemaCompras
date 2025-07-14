// Processador de arquivos CSV/XLSX
class FileProcessor {
  constructor() {
    // Dicionário de variações de nomes de colunas
    this.headerVariations = {
      codigo: ['codigo', 'cod', 'cód', 'doc', 'code', 'id', 'código', 'c\u00f3digo', 'cdigo', 'c?digo', 'cdigo'],
      descricao: ['descricao', 'desc', 'descri', 'item', 'produto', 'description', 'produto_descricao', 'descrição', 'descri\u00e7\u00e3o', 'descrio', 'descri??o', 'descricao'],
      quantidade: ['quantidade', 'quant', 'qtde', 'qtd', 'qty', 'qt', 'qtd', 'qtd.', 'comprar'],
      altura: ['altura', 'alt', 'a', 'v', 'vertical', 'h'],
      largura: ['largura', 'l', 'larg', 'horizontal', 'w', 'width'],
      cor: ['cor', 'color', 'colours'],
      medida: ['medida', 'medidas', 'dimension', 'size', 'tamanho'],
      preco: ['preco', 'preço', 'valor', 'price', 'custo'],
      fornecedor: ['fornecedor', 'supplier', 'vendor', 'entrega fornecedor'],
      observacoes: ['observacoes', 'observações', 'obs', 'notes', 'comentarios']
    };
  }

  // Normalizar texto removendo acentos e convertendo para minúsculas
  normalizeText(text) {
    if (!text) return '';
    
    try {
      // Tentar normalização padrão
      return text.toString()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[;\.,-\/#!$%\^&\*;:{}=\-_`~()]/g, '')
        .trim();
    } catch (error) {
      // Se falhar, usar método alternativo para lidar com possíveis problemas de codificação
      console.warn('Erro ao normalizar texto:', error);
      return text.toString()
        .toLowerCase()
        .replace(/[áàãâä]/gi, 'a')
        .replace(/[éèêë]/gi, 'e')
        .replace(/[íìîï]/gi, 'i')
        .replace(/[óòõôö]/gi, 'o')
        .replace(/[úùûü]/gi, 'u')
        .replace(/[ç]/gi, 'c')
        .replace(/[;\.,-\/#!$%\^&\*;:{}=\-_`~()]/g, '')
        .trim();
    }
  }

  // Mapear cabeçalhos das colunas
  mapHeaders(headers) {
    const headerMap = {};
    const normalizedHeaders = headers.map(h => {
      // Certificar que o cabeçalho é uma string antes de normalizar
      if (h === null || h === undefined) return '';
      const headerStr = h.toString().trim();
      return this.normalizeText(headerStr);
    });
    
    console.log('Cabeçalhos encontrados:', headers);
    console.log('Cabeçalhos normalizados:', normalizedHeaders);
    
    // Para cada campo padrão, procurar correspondência
    Object.keys(this.headerVariations).forEach(standardField => {
      const variations = this.headerVariations[standardField];
      
      for (let i = 0; i < normalizedHeaders.length; i++) {
        const normalizedHeader = normalizedHeaders[i];
        
        // Verificar se o cabeçalho normalizado está nas variações
        // Usar includes para busca parcial e também verificar igualdade exata
        const found = variations.some(variation => {
          const normalizedVariation = this.normalizeText(variation);
          return normalizedHeader.includes(normalizedVariation) || 
                 normalizedHeader === normalizedVariation ||
                 normalizedVariation.includes(normalizedHeader) ||
                 // Busca mais flexível para caracteres corrompidos
                 normalizedHeader.replace(/[^a-z0-9]/g, '').includes(normalizedVariation.replace(/[^a-z0-9]/g, ''));
        });
        
        if (found) {
          headerMap[standardField] = i;
          console.log(`Campo '${standardField}' mapeado para coluna '${headers[i]}' (índice ${i})`);
          break;
        }
      }
    });

    return headerMap;
  }

  // Validar se os campos obrigatórios estão presentes
  validateRequiredFields(headerMap) {
    const required = ['codigo', 'descricao', 'quantidade'];
    const missing = required.filter(field => !(field in headerMap));
    
    if (missing.length > 0) {
      throw new Error(`Campos obrigatórios não encontrados: ${missing.join(', ')}`);
    }
    
    return true;
  }

  // Processar dados de uma linha
  processRow(row, headerMap) {
    const item = {};
    
    // Mapear campos básicos
    Object.keys(headerMap).forEach(field => {
      const columnIndex = headerMap[field];
      let value = row[columnIndex];
      
      // Processar diferentes tipos de dados
      if (field === 'codigo') {
          let rawValue = value ? value.toString().trim() : '';
          // Verifica se o código começa com "DOC. " (case-insensitive) e extrai a parte relevante
          if (rawValue.toUpperCase().startsWith('DOC.')) {
              value = rawValue.substring(4).trim();
          } else {
              value = rawValue;
          }
      } else if (field === 'quantidade') {
        value = parseFloat(value) || 0;
      } else if (field === 'altura' || field === 'largura') {
        // Altura e largura são valores numéricos
        value = parseFloat(value) || 0;
      } else if (field === 'preco') {
        value = parseFloat(value) || 0;
      } else {
        value = value ? value.toString().trim() : '';
      }
      
      item[field] = value;
    });

    // Validações específicas
    if (!item.codigo || item.codigo === '') {
      throw new Error('Código do produto é obrigatório');
    }
    
    if (!item.descricao || item.descricao === '') {
      throw new Error('Descrição do produto é obrigatória');
    }
    
    if (item.quantidade <= 0) {
      throw new Error('Quantidade deve ser maior que zero');
    }

    return item;
  }

  // Processar arquivo Excel/CSV
  async processFile(file, listaMaterial) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          let workbook;
          let data;

          console.log('Processando arquivo:', file.name, 'tipo:', file.type);

          if (file.type === 'text/csv') {
            // Processar CSV - tentar diferentes codificações
            let csvData = e.target.result;
            
            console.log('Dados brutos do CSV (primeiros 200 chars):', csvData.substring(0, 200));
            
            // Tentar diferentes separadores e codificações
            workbook = XLSX.read(csvData, { 
              type: 'string',
              raw: false,
              FS: ';', // Forçar separador ponto-e-vírgula
              codepage: 1252 // Windows-1252 (comum em CSVs brasileiros)
            });
          } else {
            // Processar Excel
            const arrayBuffer = e.target.result;
            workbook = XLSX.read(arrayBuffer, { 
              type: 'array',
              codepage: 65001, // UTF-8
              raw: true
            });
          }

          // Pegar a primeira planilha
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          
          // Converter para JSON - usar diferentes opções para CSV
          if (file.type === 'text/csv') {
            data = XLSX.utils.sheet_to_json(sheet, { 
              header: 1,
              raw: false,
              defval: ''
            });
          } else {
            data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          }

          if (data.length === 0) {
            throw new Error('Arquivo está vazio');
          }

          // Primeira linha são os cabeçalhos
          const headers = data[0];
          console.log('Cabeçalhos brutos lidos:', headers);
          
          // Limpar cabeçalhos (remover espaços e caracteres especiais desnecessários)
          const cleanHeaders = headers.map(h => {
            if (!h) return '';
            return h.toString().trim();
          });
          
          console.log('Cabeçalhos limpos:', cleanHeaders);
          
          const rows = data.slice(1);

          // Mapear cabeçalhos usando os cabeçalhos limpos
          const headerMap = this.mapHeaders(cleanHeaders);
          
          // Validar campos obrigatórios
          this.validateRequiredFields(headerMap);

          // Processar todas as linhas
          const processedItems = [];
          const errors = [];

          rows.forEach((row, index) => {
            // Pular linhas vazias
            if (!row || row.every(cell => !cell)) {
              return;
            }

            try {
              const item = this.processRow(row, headerMap);
              item.listaMaterial = listaMaterial;
              item.linhaArquivo = index + 2; // +2 porque começamos do 0 e pulamos o cabeçalho
              processedItems.push(item);
            } catch (error) {
              errors.push({
                linha: index + 2,
                erro: error.message,
                dados: row
              });
            }
          });

          resolve({
            success: true,
            items: processedItems,
            errors: errors,
            fileName: file.name,
            totalRows: rows.length,
            processedRows: processedItems.length
          });

        } catch (error) {
          reject({
            success: false,
            error: error.message,
            fileName: file.name
          });
        }
      };

      reader.onerror = () => {
        reject({
          success: false,
          error: 'Erro ao ler arquivo',
          fileName: file.name
        });
      };

      // Escolher método de leitura baseado no tipo do arquivo
      if (file.type === 'text/csv') {
        // Para CSV, tentar diferentes codificações
        try {
          reader.readAsText(file, 'ISO-8859-1'); // Codificação comum para CSVs brasileiros
        } catch (error) {
          console.warn('Erro ao ler com ISO-8859-1, tentando UTF-8');
          reader.readAsText(file, 'UTF-8');
        }
      } else {
        reader.readAsArrayBuffer(file);
      }
    });
  }

  // Validar tipo de arquivo
  validateFileType(file) {
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    const allowedExtensions = ['.csv', '.xls', '.xlsx'];
    const fileExtension = file.name.toLowerCase().substr(file.name.lastIndexOf('.'));
    
    return allowedTypes.includes(file.type) || allowedExtensions.includes(fileExtension);
  }
}

// Exportar para uso global
window.FileProcessor = FileProcessor;

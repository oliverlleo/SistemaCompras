// Processador de arquivos CSV/XLSX
class FileProcessor {
  constructor() {
    // Dicionário de variações de nomes de colunas (CORRIGIDO - mapeamento específico)
    this.headerVariations = {
      codigo: ['codigo', 'cod', 'cód', 'doc', 'code', 'id', 'código', 'c\u00f3digo', 'cdigo', 'c?digo', 'cdigo'],
      descricao: ['descricao', 'desc', 'descri', 'item', 'produto', 'description', 'produto_descricao', 'descrição', 'descri\u00e7\u00e3o', 'descrio', 'descri??o', 'descricao'],
      quantidade: ['quantidade', 'quant', 'qtde', 'qtd', 'qty', 'qt', 'qtd', 'qtd.', 'comprar', 'total'],
      altura: ['altura', 'alt', 'h', 'vertical'], // H = altura
      largura: ['largura', 'l', 'larg', 'horizontal', 'w', 'width'], // L = largura  
      cor: ['cor', 'color', 'colours'],
      medida: ['medida', 'medidas', 'dimension', 'size', 'tamanho'], // Medida é campo separado
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
    
    // 🎯 CORREÇÃO: Ignorar colunas vazias durante o mapeamento
    const filteredHeaders = [];
    const indexMap = [];
    
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i];
      if (header && header.toString().trim() !== '' && header.toString().trim() !== 'vazio' && header.toString().trim() !== 'nada') {
        filteredHeaders.push(header);
        indexMap.push(i); // Mapear o índice real da coluna
      }
    }
    
    console.log('🔍 Cabeçalhos filtrados (sem vazios):', filteredHeaders);
    console.log('🔍 Mapeamento de índices:', indexMap);
    
    // Normalizar apenas cabeçalhos válidos
    const normalizedValidHeaders = filteredHeaders.map(h => this.normalizeText(h.toString().trim()));
    
    // Para cada campo padrão, procurar correspondência apenas em colunas válidas
    Object.keys(this.headerVariations).forEach(standardField => {
      const variations = this.headerVariations[standardField];
      
      for (let i = 0; i < normalizedValidHeaders.length; i++) {
        const normalizedHeader = normalizedValidHeaders[i];
        const originalIndex = indexMap[i]; // Índice real na planilha original
        
        // Ignorar headers vazios
        if (!normalizedHeader || normalizedHeader.length === 0) {
          continue;
        }
        
        // CORREÇÃO: Lógica de correspondência mais rigorosa para evitar conflitos
        const found = variations.some(variation => {
          const normalizedVariation = this.normalizeText(variation);
          
          // Correspondência exata tem prioridade
          if (normalizedHeader === normalizedVariation) {
            return true;
          }
          
          // Para letras simples (H, L), exige correspondência exata para evitar conflitos
          if (normalizedVariation.length === 1) {
            return normalizedHeader === normalizedVariation;
          }
          
          // Para palavras maiores, permite correspondência parcial
          return normalizedHeader.includes(normalizedVariation) || 
                 normalizedVariation.includes(normalizedHeader);
        });
        
        if (found) {
          // Verificar se não há conflito com mapeamento já existente
          const existingMapping = Object.keys(headerMap).find(key => headerMap[key] === originalIndex);
          if (existingMapping) {
            console.warn(`Conflito detectado: coluna ${originalIndex} (${headers[originalIndex]}) já mapeada para '${existingMapping}', ignorando mapeamento para '${standardField}'`);
            continue;
          }
          
          headerMap[standardField] = originalIndex; // Usar índice original
          console.log(`✅ Campo '${standardField}' mapeado para coluna '${filteredHeaders[i]}' (índice real ${originalIndex})`);
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
    
    console.log('🔍 Verificação de campos obrigatórios:');
    console.log('   - Campos requeridos:', required);
    console.log('   - Campos mapeados:', Object.keys(headerMap));
    console.log('   - Mapeamento completo:', headerMap);
    
    if (missing.length > 0) {
      console.error('❌ Campos obrigatórios não encontrados:', missing);
      console.log('💡 Dica: Verifique se as colunas têm os nomes corretos:');
      console.log('   - Para código: "código", "codigo", "cod", "id"');
      console.log('   - Para descrição: "descrição", "descricao", "desc", "produto", "item"');
      console.log('   - Para quantidade: "quantidade", "qtde", "qtd", "quant"');
      throw new Error(`Campos obrigatórios não encontrados: ${missing.join(', ')}`);
    }
    
    console.log('✅ Todos os campos obrigatórios foram encontrados!');
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
        value = parseFloat(String(value).replace(',', '.')) || 0;
      } else if (field === 'altura' || field === 'largura') {
        // Altura e largura são valores numéricos
        value = parseFloat(String(value).replace(',', '.')) || 0;
      } else if (field === 'preco') {
        value = parseFloat(String(value).replace(',', '.')) || 0;
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

          if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
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
              raw: false
            });
          }

          // Pegar a primeira planilha
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          
          if (!sheet) {
              throw new Error('Nenhuma planilha encontrada no arquivo.');
          }
          
          // Converter para JSON
          data = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });

          if (data.length === 0) {
            throw new Error('Arquivo está vazio ou não foi possível ler os dados.');
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
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
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

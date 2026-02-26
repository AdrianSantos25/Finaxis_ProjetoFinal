const db = require('../database');
const PDFDocument = require('pdfkit');
const XLSX = require('xlsx');

class RelatoriosService {
  /**
   * Obter dados mensais de um ano para relatórios
   */
  async obterDadosAnuais(utilizadorId, ano) {
    const mesesNomes = [
      'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
      'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
    ];

    // Buscar todos os totais mensais numa única query
    const [receitasMensais] = await db.query(`
      SELECT MONTH(data) as mes, COALESCE(SUM(valor), 0) as total
      FROM transacoes
      WHERE tipo = 'receita' AND YEAR(data) = ? AND utilizador_id = ?
      GROUP BY MONTH(data)
    `, [ano, utilizadorId]);

    const [despesasMensais] = await db.query(`
      SELECT MONTH(data) as mes, COALESCE(SUM(valor), 0) as total
      FROM transacoes
      WHERE tipo = 'despesa' AND YEAR(data) = ? AND utilizador_id = ?
      GROUP BY MONTH(data)
    `, [ano, utilizadorId]);

    // Mapear receitas e despesas por mês
    const receitasMap = {};
    receitasMensais.forEach(r => { receitasMap[r.mes] = parseFloat(r.total) || 0; });
    const despesasMap = {};
    despesasMensais.forEach(d => { despesasMap[d.mes] = parseFloat(d.total) || 0; });

    const dadosMensais = [];
    for (let mes = 1; mes <= 12; mes++) {
      const receitas = receitasMap[mes] || 0;
      const despesas = despesasMap[mes] || 0;
      dadosMensais.push({
        mes: mesesNomes[mes - 1],
        receitas,
        despesas,
        saldo: receitas - despesas
      });
    }

    // Totais anuais
    const totalReceitasAno = dadosMensais.reduce((acc, m) => acc + m.receitas, 0);
    const totalDespesasAno = dadosMensais.reduce((acc, m) => acc + m.despesas, 0);
    const saldoAno = totalReceitasAno - totalDespesasAno;

    // Top categorias de despesa (em paralelo)
    const [[topDespesas], [anosRows]] = await Promise.all([
      db.query(`
        SELECT c.nome, c.cor, SUM(t.valor) as total
        FROM transacoes t
        JOIN categorias c ON t.categoria_id = c.id
        WHERE t.tipo = 'despesa' AND YEAR(t.data) = ? AND t.utilizador_id = ?
        GROUP BY c.id, c.nome, c.cor
        ORDER BY total DESC
        LIMIT 5
      `, [ano, utilizadorId]),
      db.query(
        'SELECT DISTINCT YEAR(data) as ano FROM transacoes WHERE utilizador_id = ? ORDER BY ano DESC',
        [utilizadorId]
      )
    ]);

    let anosDisponiveis = anosRows.map(r => r.ano);
    if (!anosDisponiveis.includes(ano)) {
      anosDisponiveis.push(ano);
      anosDisponiveis.sort((a, b) => b - a);
    }

    return {
      dadosMensais,
      totalReceitasAno,
      totalDespesasAno,
      saldoAno,
      topDespesas,
      anosDisponiveis
    };
  }

  /**
   * Obter evolução diária do saldo ao longo de um mês
   * Retorna array com { dia, receitas, despesas, saldoDiario, saldoAcumulado }
   */
  async obterEvolucaoMensal(utilizadorId, mes, ano) {
    const ultimoDia = new Date(ano, mes, 0).getDate();
    const inicioMes = `${ano}-${String(mes).padStart(2, '0')}-01`;
    const fimMes = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;

    // Saldo acumulado ANTES do mês (tudo até o dia anterior ao início)
    const [saldoAnteriorRows] = await db.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN tipo = 'receita' THEN valor ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN tipo = 'despesa' THEN valor ELSE 0 END), 0) as saldo
      FROM transacoes
      WHERE utilizador_id = ? AND data < ?
    `, [utilizadorId, inicioMes]);
    let saldoAcumulado = parseFloat(saldoAnteriorRows[0].saldo) || 0;

    // Movimentos diários do mês
    const [movimentosDiarios] = await db.query(`
      SELECT 
        DAY(data) as dia,
        COALESCE(SUM(CASE WHEN tipo = 'receita' THEN valor ELSE 0 END), 0) as receitas,
        COALESCE(SUM(CASE WHEN tipo = 'despesa' THEN valor ELSE 0 END), 0) as despesas
      FROM transacoes
      WHERE utilizador_id = ? AND data BETWEEN ? AND ?
      GROUP BY DAY(data)
      ORDER BY dia
    `, [utilizadorId, inicioMes, fimMes]);

    const movimentosMap = {};
    movimentosDiarios.forEach(m => {
      movimentosMap[m.dia] = {
        receitas: parseFloat(m.receitas) || 0,
        despesas: parseFloat(m.despesas) || 0
      };
    });

    const evolucao = [];
    for (let dia = 1; dia <= ultimoDia; dia++) {
      const mov = movimentosMap[dia] || { receitas: 0, despesas: 0 };
      saldoAcumulado += mov.receitas - mov.despesas;
      evolucao.push({
        dia,
        receitas: mov.receitas,
        despesas: mov.despesas,
        saldoDiario: mov.receitas - mov.despesas,
        saldoAcumulado: Math.round(saldoAcumulado * 100) / 100
      });
    }

    return evolucao;
  }

  /**
   * Obter dados de comparação entre dois meses
   * Retorna { mesAtual: { receitas, despesas, saldo }, mesAnterior: { receitas, despesas, saldo } }
   */
  async obterComparacaoMeses(utilizadorId, mes, ano) {
    // Mês anterior
    let mesAnterior = mes - 1;
    let anoAnterior = ano;
    if (mesAnterior < 1) {
      mesAnterior = 12;
      anoAnterior = ano - 1;
    }

    const obterTotaisMes = async (m, a) => {
      const ultimoDia = new Date(a, m, 0).getDate();
      const inicio = `${a}-${String(m).padStart(2, '0')}-01`;
      const fim = `${a}-${String(m).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;

      const [rows] = await db.query(`
        SELECT 
          COALESCE(SUM(CASE WHEN tipo = 'receita' THEN valor ELSE 0 END), 0) as receitas,
          COALESCE(SUM(CASE WHEN tipo = 'despesa' THEN valor ELSE 0 END), 0) as despesas
        FROM transacoes
        WHERE utilizador_id = ? AND data BETWEEN ? AND ?
      `, [utilizadorId, inicio, fim]);

      const receitas = parseFloat(rows[0].receitas) || 0;
      const despesas = parseFloat(rows[0].despesas) || 0;

      // Top categorias de despesa do mês
      const [topCategorias] = await db.query(`
        SELECT c.nome, c.cor, SUM(t.valor) as total
        FROM transacoes t
        JOIN categorias c ON t.categoria_id = c.id
        WHERE t.tipo = 'despesa' AND t.data BETWEEN ? AND ? AND t.utilizador_id = ?
        GROUP BY c.id, c.nome, c.cor
        ORDER BY total DESC
        LIMIT 5
      `, [inicio, fim, utilizadorId]);

      return { receitas, despesas, saldo: receitas - despesas, topCategorias };
    };

    const [dadosAtual, dadosAnterior] = await Promise.all([
      obterTotaisMes(mes, ano),
      obterTotaisMes(mesAnterior, anoAnterior)
    ]);

    // Calcular variações percentuais
    const variacaoReceitas = dadosAnterior.receitas > 0
      ? Math.round(((dadosAtual.receitas - dadosAnterior.receitas) / dadosAnterior.receitas) * 100)
      : (dadosAtual.receitas > 0 ? 100 : 0);
    const variacaoDespesas = dadosAnterior.despesas > 0
      ? Math.round(((dadosAtual.despesas - dadosAnterior.despesas) / dadosAnterior.despesas) * 100)
      : (dadosAtual.despesas > 0 ? 100 : 0);

    return {
      mesAtual: dadosAtual,
      mesAnterior: dadosAnterior,
      mesAnteriorNum: mesAnterior,
      anoAnteriorNum: anoAnterior,
      variacaoReceitas,
      variacaoDespesas
    };
  }

  /**
   * Exportar transações de um ano em formato CSV
   */
  async exportarCSV(utilizadorId, ano) {
    const [transacoes] = await db.query(
      `SELECT t.descricao, t.valor, t.tipo, t.data, c.nome as categoria
       FROM transacoes t
       LEFT JOIN categorias c ON t.categoria_id = c.id
       WHERE t.utilizador_id = ? AND YEAR(t.data) = ?
       ORDER BY t.data DESC`,
      [utilizadorId, ano]
    );

    let csv = 'Data;Descrição;Tipo;Categoria;Valor\n';
    transacoes.forEach(t => {
      const data = new Date(t.data).toLocaleDateString('pt-PT');
      const descricao = t.descricao.replace(/;/g, ','); // Escapar separadores
      const categoria = t.categoria || 'Sem categoria';
      const valor = parseFloat(t.valor).toFixed(2).replace('.', ',');
      csv += `${data};${descricao};${t.tipo};${categoria};${valor}\n`;
    });

    return csv;
  }

  /**
   * Exportar transações de um ano em formato Excel
   */
  async exportarExcel(utilizadorId, ano) {
    const [transacoes] = await db.query(
      `SELECT t.descricao, t.valor, t.tipo, t.data, c.nome as categoria
       FROM transacoes t
       LEFT JOIN categorias c ON t.categoria_id = c.id
       WHERE t.utilizador_id = ? AND YEAR(t.data) = ?
       ORDER BY t.data DESC`,
      [utilizadorId, ano]
    );

    const dados = transacoes.map(t => ({
      'Data': new Date(t.data).toLocaleDateString('pt-PT'),
      'Descrição': t.descricao,
      'Tipo': t.tipo === 'receita' ? 'Receita' : 'Despesa',
      'Categoria': t.categoria || 'Sem categoria',
      'Valor (€)': parseFloat(t.valor).toFixed(2)
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(dados);

    // Ajustar largura das colunas
    ws['!cols'] = [
      { wch: 12 }, // Data
      { wch: 30 }, // Descrição
      { wch: 10 }, // Tipo
      { wch: 20 }, // Categoria
      { wch: 12 }  // Valor
    ];

    XLSX.utils.book_append_sheet(wb, ws, `Relatório ${ano}`);
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  /**
   * Exportar transações de um ano em formato PDF
   */
  async exportarPDF(utilizadorId, ano) {
    const [transacoes] = await db.query(
      `SELECT t.descricao, t.valor, t.tipo, t.data, c.nome as categoria
       FROM transacoes t
       LEFT JOIN categorias c ON t.categoria_id = c.id
       WHERE t.utilizador_id = ? AND YEAR(t.data) = ?
       ORDER BY t.data DESC`,
      [utilizadorId, ano]
    );

    // Calcular totais
    let totalReceitas = 0;
    let totalDespesas = 0;
    transacoes.forEach(t => {
      const val = parseFloat(t.valor);
      if (t.tipo === 'receita') totalReceitas += val;
      else totalDespesas += val;
    });

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers = [];

      doc.on('data', chunk => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Título
      doc.fontSize(20).font('Helvetica-Bold').text(`FINAXIS - Relatório ${ano}`, { align: 'center' });
      doc.moveDown();

      // Resumo
      doc.fontSize(12).font('Helvetica-Bold').text('Resumo Anual');
      doc.fontSize(10).font('Helvetica');
      doc.text(`Total Receitas: €${totalReceitas.toFixed(2)}`);
      doc.text(`Total Despesas: €${totalDespesas.toFixed(2)}`);
      doc.text(`Saldo: €${(totalReceitas - totalDespesas).toFixed(2)}`);
      doc.moveDown();

      // Tabela de transações
      doc.fontSize(12).font('Helvetica-Bold').text('Transações');
      doc.moveDown(0.5);

      // Cabeçalho
      const startX = 50;
      let y = doc.y;
      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('Data', startX, y, { width: 70 });
      doc.text('Descrição', startX + 70, y, { width: 170 });
      doc.text('Tipo', startX + 240, y, { width: 60 });
      doc.text('Categoria', startX + 300, y, { width: 100 });
      doc.text('Valor (€)', startX + 400, y, { width: 80, align: 'right' });

      y += 18;
      doc.moveTo(startX, y).lineTo(startX + 480, y).stroke();
      y += 5;

      doc.font('Helvetica').fontSize(8);
      for (const t of transacoes) {
        if (y > 750) {
          doc.addPage();
          y = 50;
        }
        const data = new Date(t.data).toLocaleDateString('pt-PT');
        const descricao = t.descricao.length > 30 ? t.descricao.substring(0, 30) + '...' : t.descricao;
        const tipo = t.tipo === 'receita' ? 'Receita' : 'Despesa';
        const categoria = t.categoria || '-';
        const valor = parseFloat(t.valor).toFixed(2);

        doc.text(data, startX, y, { width: 70 });
        doc.text(descricao, startX + 70, y, { width: 170 });
        doc.text(tipo, startX + 240, y, { width: 60 });
        doc.text(categoria, startX + 300, y, { width: 100 });
        doc.text(valor, startX + 400, y, { width: 80, align: 'right' });
        y += 15;
      }

      // Rodapé
      doc.moveDown(2);
      doc.fontSize(8).font('Helvetica').fillColor('#999');
      doc.text(`Gerado em ${new Date().toLocaleDateString('pt-PT')} - FINAXIS`, { align: 'center' });

      doc.end();
    });
  }

  /**
   * Importar transações a partir de CSV ou Excel
   * Retorna { sucesso: number, erros: string[] }
   */
  async importarDados(utilizadorId, fileBuffer, fileName) {
    const erros = [];
    let sucesso = 0;
    let dados = [];

    const ext = fileName.toLowerCase().split('.').pop();

    if (ext === 'csv') {
      // Parse CSV
      const conteudo = fileBuffer.toString('utf-8').replace(/^\uFEFF/, ''); // Remove BOM
      const linhas = conteudo.split('\n').filter(l => l.trim());

      if (linhas.length < 2) {
        return { sucesso: 0, erros: ['Ficheiro CSV vazio ou sem dados.'] };
      }

      // Detectar separador (;  ou ,)
      const separador = linhas[0].includes(';') ? ';' : ',';
      const cabecalho = linhas[0].split(separador).map(h => h.trim().toLowerCase().replace(/["']/g, ''));

      for (let i = 1; i < linhas.length; i++) {
        const valores = linhas[i].split(separador).map(v => v.trim().replace(/["']/g, ''));
        if (valores.length < 3) continue;

        const obj = {};
        cabecalho.forEach((col, idx) => {
          obj[col] = valores[idx] || '';
        });
        dados.push({ ...obj, linha: i + 1 });
      }
    } else if (ext === 'xlsx' || ext === 'xls') {
      // Parse Excel
      const wb = XLSX.read(fileBuffer, { type: 'buffer' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(ws);

      dados = jsonData.map((row, idx) => {
        const obj = {};
        Object.keys(row).forEach(key => {
          obj[key.toLowerCase().trim()] = String(row[key]).trim();
        });
        obj.linha = idx + 2;
        return obj;
      });
    } else {
      return { sucesso: 0, erros: ['Formato não suportado. Use CSV, XLS ou XLSX.'] };
    }

    // Buscar categorias disponíveis
    const [categorias] = await db.query(
      'SELECT id, nome, tipo FROM categorias WHERE utilizador_id = ? OR utilizador_id IS NULL',
      [utilizadorId]
    );

    for (const row of dados) {
      try {
        // Mapear campos (suportar vários nomes de colunas)
        const descricao = row['descrição'] || row['descricao'] || row['description'] || '';
        let valor = row['valor'] || row['valor (€)'] || row['value'] || row['amount'] || '0';
        const tipo = this._mapearTipo(row['tipo'] || row['type'] || '');
        const categoria = row['categoria'] || row['category'] || '';
        let data = row['data'] || row['date'] || '';

        if (!descricao) {
          erros.push(`Linha ${row.linha}: Descrição em falta.`);
          continue;
        }

        // Converter valor (aceitar , como separador decimal)
        valor = valor.replace(/[€\s]/g, '').replace(',', '.');
        const valorNum = parseFloat(valor);
        if (isNaN(valorNum) || valorNum <= 0) {
          erros.push(`Linha ${row.linha}: Valor inválido "${row['valor'] || row['valor (€)'] || valor}".`);
          continue;
        }

        if (!tipo) {
          erros.push(`Linha ${row.linha}: Tipo inválido "${row['tipo'] || row['type'] || ''}". Use "receita" ou "despesa".`);
          continue;
        }

        // Converter data
        data = this._parsearData(data);
        if (!data) {
          erros.push(`Linha ${row.linha}: Data inválida "${row['data'] || row['date'] || ''}".`);
          continue;
        }

        // Mapear categoria
        let categoriaId = null;
        if (categoria) {
          const cat = categorias.find(c =>
            c.nome.toLowerCase() === categoria.toLowerCase() && c.tipo === tipo
          );
          if (cat) categoriaId = cat.id;
        }

        await db.query(
          'INSERT INTO transacoes (descricao, valor, tipo, categoria_id, data, utilizador_id) VALUES (?, ?, ?, ?, ?, ?)',
          [descricao.trim(), valorNum, tipo, categoriaId, data, utilizadorId]
        );
        sucesso++;
      } catch (err) {
        erros.push(`Linha ${row.linha}: Erro - ${err.message}`);
      }
    }

    return { sucesso, erros };
  }

  /**
   * Mapear string de tipo para 'receita' ou 'despesa'
   */
  _mapearTipo(tipo) {
    const t = tipo.toLowerCase().trim();
    if (['receita', 'income', 'revenue', 'entrada'].includes(t)) return 'receita';
    if (['despesa', 'expense', 'cost', 'saída', 'saida', 'gasto'].includes(t)) return 'despesa';
    return null;
  }

  /**
   * Parsear data em vários formatos
   */
  _parsearData(dataStr) {
    if (!dataStr) return null;

    // Tentar formato dd/mm/yyyy ou dd-mm-yyyy
    let match = dataStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (match) {
      const [, dia, mes, ano] = match;
      const d = new Date(ano, mes - 1, dia);
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    }

    // Tentar formato yyyy-mm-dd
    match = dataStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (match) {
      const d = new Date(dataStr);
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    }

    // Tentar parse genérico
    const d = new Date(dataStr);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];

    return null;
  }
}

module.exports = new RelatoriosService();

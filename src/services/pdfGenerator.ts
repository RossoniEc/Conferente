import jsPDF from 'jspdf';
import { CargoInspection, ClientNote, descreverMotivoCorte, notaPorCodigoCliente, resumoRetornoPallet } from '../types';
import { formatarDuracao } from './tempo';

export function generateBookCarregamentoPdf(
  inspection: CargoInspection,
  empresaNome = 'LOGÍSTICA & DISTRIBUIÇÃO NACIONAL LTDA',
  unidadeCD = 'CD 01 - Matriz São Paulo',
  clientInstruction?: string
): { doc: jsPDF; filename: string; blobUrl: string } {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 14;

  // Colors
  const darkNavy = [15, 23, 42]; // slate-900
  const primaryBlue = [30, 64, 175]; // blue-800
  const amberWarning = [217, 119, 6];
  const emeraldSuccess = [22, 101, 52];
  const borderGray = [226, 232, 240];

  // Header Banner
  doc.setFillColor(darkNavy[0], darkNavy[1], darkNavy[2]);
  doc.rect(10, 10, pageWidth - 20, 22, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('BOOK DE CARREGAMENTO & CONFERÊNCIA DE CARGA', 15, 20);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`${empresaNome} • ${unidadeCD}`, 15, 26);
  doc.text(`EMITIDO EM: ${new Date().toLocaleString('pt-BR')}`, pageWidth - 15, 26, { align: 'right' });

  y = 38;

  // Identification Box
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(10, y, pageWidth - 20, 38, 2, 2, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('DADOS GERAIS DO TRANSPORTE E EXPEDIÇÃO', 14, y + 6);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');

  // Column 1
  doc.text(`DT (Doc. Transporte):`, 14, y + 13);
  doc.setFont('helvetica', 'bold');
  doc.text(inspection.dt, 50, y + 13);

  doc.setFont('helvetica', 'normal');
  doc.text(`Placa do Veículo:`, 14, y + 19);
  doc.setFont('helvetica', 'bold');
  doc.text(`${inspection.placa || 'NÃO INFORMADA'}${inspection.doca ? ` • ${inspection.doca}` : ''}`, 50, y + 19);

  // Column 2
  doc.setFont('helvetica', 'normal');
  doc.text(`Motorista:`, 95, y + 13);
  doc.setFont('helvetica', 'bold');
  doc.text(inspection.motorista || 'Não informado', 120, y + 13);

  doc.setFont('helvetica', 'normal');
  doc.text(`Transportadora:`, 95, y + 19);
  doc.setFont('helvetica', 'bold');
  doc.text(inspection.transportadora || 'Não informada', 120, y + 19);

  // Column 3
  doc.setFont('helvetica', 'normal');
  doc.text(`Nº do Lacre:`, 150, y + 13);
  doc.setFont('helvetica', 'bold');
  doc.text(inspection.numeroLacre || 'N/A', 170, y + 13);

  doc.setFont('helvetica', 'normal');
  doc.text(`Conferente:`, 150, y + 19);
  doc.setFont('helvetica', 'bold');
  doc.text(inspection.conferente, 170, y + 19);

  // Início, término e tempo total de carregamento
  {
    const tempo = formatarDuracao(inspection.dataInicio, inspection.dataFim);
    doc.setFont('helvetica', 'normal');
    doc.text('Início:', 14, y + 25);
    doc.setFont('helvetica', 'bold');
    doc.text(inspection.dataInicio || '-', 50, y + 25);
    doc.setFont('helvetica', 'normal');
    doc.text('Término:', 95, y + 25);
    doc.setFont('helvetica', 'bold');
    doc.text(inspection.dataFim || 'Em andamento', 120, y + 25);
    doc.setFont('helvetica', 'normal');
    doc.text('Tempo total:', 150, y + 25);
    doc.setFont('helvetica', 'bold');
    doc.text(tempo || '-', 170, y + 25);
  }

  // Retorno de pallets
  doc.setFont('helvetica', 'normal');
  doc.text('Retorno de pallets:', 14, y + 31);
  doc.setFont('helvetica', 'bold');
  doc.text(resumoRetornoPallet(inspection.retornoPallet), 50, y + 31);

  y += 40;

  // Quadro Resumo: Total Planejado x Carregado x Faturado x Diferença
  {
    const resumoPlanejado = inspection.itensPlanejados.reduce((a, i) => a + i.quantidadePlanejada, 0);
    const resumoCorte = inspection.itensConferidos.reduce((a, i) => a + (i.corteOperacional?.quantidade || 0), 0);
    const resumoCarregado = inspection.itensConferidos.reduce((a, i) => a + i.quantidadeCarregada, 0);
    const faturamento = inspection.faturamento;
    const resumoFaturado = faturamento?.itensFaturados?.reduce((a, i) => a + i.quantidadeFaturada, 0);
    const temFaturado = resumoFaturado !== undefined;
    // Faturada: Carregado - Faturado. Ainda sem faturamento: Carregado - (Planejado - Corte)
    const resumoDif = temFaturado
      ? resumoCarregado - (resumoFaturado as number)
      : resumoCarregado - (resumoPlanejado - resumoCorte);

    const boxW = (pageWidth - 20 - 3 * 3) / 4;
    const boxH = 17;
    const cells: { label: string; value: string; sub?: string; color: number[] }[] = [
      {
        label: 'TOTAL PLANEJADO',
        value: `${resumoPlanejado} vol.`,
        sub: resumoCorte > 0 ? `Corte operacional: -${resumoCorte}` : undefined,
        color: [15, 23, 42],
      },
      { label: 'TOTAL CARREGADO', value: `${resumoCarregado} vol.`, color: emeraldSuccess },
      {
        label: 'TOTAL FATURADO',
        value: temFaturado ? `${resumoFaturado} vol.` : 'PENDENTE',
        sub: temFaturado ? 'Planilha FAT' : 'Conferência fiscal não realizada',
        color: [109, 40, 217],
      },
      {
        label: 'DIFERENÇA',
        value: resumoDif === 0 ? '0' : resumoDif > 0 ? `+${resumoDif}` : String(resumoDif),
        sub: temFaturado ? 'Carregado - Faturado' : 'Carregado - Planejado líquido',
        color: resumoDif === 0 ? emeraldSuccess : [220, 38, 38],
      },
    ];

    cells.forEach((cell, i) => {
      const x = 10 + i * (boxW + 3);
      doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(x, y, boxW, boxH, 2, 2, 'FD');

      doc.setTextColor(100, 116, 139);
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      doc.text(cell.label, x + boxW / 2, y + 5, { align: 'center' });

      doc.setTextColor(cell.color[0], cell.color[1], cell.color[2]);
      doc.setFontSize(12);
      doc.text(cell.value, x + boxW / 2, y + 11.5, { align: 'center' });

      if (cell.sub) {
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(5.8);
        doc.setFont('helvetica', 'normal');
        doc.text(cell.sub, x + boxW / 2, y + 15.2, { align: 'center' });
      }
    });

    y += boxH + 3;
  }

  // Client Special Instruction Box if present
  if (clientInstruction) {
    doc.setDrawColor(248, 113, 113);
    doc.setFillColor(254, 242, 242);
    doc.roundedRect(10, y, pageWidth - 20, 8, 2, 2, 'FD');
    doc.setTextColor(185, 28, 28);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.text(`EXIGÊNCIA DO CLIENTE: ${clientInstruction}`, 14, y + 5.5);
    y += 11;
  } else {
    y += 4;
  }

  // SKU Summary Table Header
  doc.setFillColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
  doc.rect(10, y, pageWidth - 20, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');

  doc.text('SKU', 13, y + 5.5);
  doc.text('DESCRIÇÃO DO PRODUTO', 32, y + 5.5);
  doc.text('LOTE', 88, y + 5.5);
  doc.text('PLAN.', 122, y + 5.5, { align: 'right' });
  doc.text('CORTE', 139, y + 5.5, { align: 'right' });
  doc.text('CARREG.', 158, y + 5.5, { align: 'right' });
  doc.text('DIF.', 175, y + 5.5, { align: 'right' });
  doc.text('STATUS', 194, y + 5.5, { align: 'right' });

  y += 8;

  // Build mapping of SKUs
  let totalPlanejado = 0;
  let totalCarregado = 0;
  let totalDivergencias = 0;

  // Combine planned items and checked items
  const skusCombined = new Map<string, {
    sku: string;
    descricao: string;
    planejado: number;
    corte: number;
    carregado: number;
    lotes: string[];
    fotos: string[];
  }>();
  let totalCorteTabela = 0;
  // Resumo dos cortes por SKU: quantidade e motivo(s)
  const cortesResumo: { sku: string; quantidade: number; motivo: string }[] = [];

  inspection.itensPlanejados.forEach((item) => {
    totalPlanejado += item.quantidadePlanejada;
    skusCombined.set(item.sku, {
      sku: item.sku,
      descricao: item.descricao,
      planejado: item.quantidadePlanejada,
      corte: 0,
      carregado: 0,
      lotes: [],
      fotos: [],
    });
  });

  inspection.itensConferidos.forEach((item) => {
    totalCarregado += item.quantidadeCarregada;
    const existing = skusCombined.get(item.sku);
    // Vários lotes na mesma leitura: lista cada lote com sua quantidade
    const itemLotes = item.lotes?.length
      ? item.lotes.map((l) => `${l.lote} (${l.quantidade})`)
      : item.lote
      ? [item.lote]
      : [];
    const corte = item.corteOperacional?.quantidade || 0;
    totalCorteTabela += corte;
    if (item.corteOperacional && corte > 0) {
      const motivoTxt = descreverMotivoCorte(item.corteOperacional);
      const prev = cortesResumo.find((c) => c.sku === item.sku && c.motivo === motivoTxt);
      if (prev) prev.quantidade += corte;
      else cortesResumo.push({ sku: item.sku, quantidade: corte, motivo: motivoTxt });
    }
    if (existing) {
      existing.carregado += item.quantidadeCarregada;
      existing.corte += corte;
      itemLotes.forEach((l) => {
        if (!existing.lotes.includes(l)) existing.lotes.push(l);
      });
      if (item.fotos) {
        existing.fotos.push(...item.fotos);
      }
    } else {
      skusCombined.set(item.sku, {
        sku: item.sku,
        descricao: item.descricao,
        planejado: 0,
        corte,
        carregado: item.quantidadeCarregada,
        lotes: itemLotes,
        fotos: item.fotos || [],
      });
    }
  });

  // Render Table Rows
  let rowIndex = 0;
  skusCombined.forEach((val) => {
    // Corte operacional abatido do planejado
    const dif = val.carregado - (val.planejado - val.corte);
    if (dif !== 0) totalDivergencias++;

    const isEven = rowIndex % 2 === 0;
    if (isEven) {
      doc.setFillColor(248, 250, 252);
      doc.rect(10, y, pageWidth - 20, 7, 'F');
    }

    doc.setDrawColor(226, 232, 240);
    doc.line(10, y + 7, pageWidth - 10, y + 7);

    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(val.sku, 13, y + 4.8);

    doc.setFont('helvetica', 'normal');
    // Truncate description if too long
    const descShort = val.descricao.length > 32 ? val.descricao.substring(0, 30) + '...' : val.descricao;
    doc.text(descShort, 32, y + 4.8);

    const loteStr = val.lotes.length > 0 ? val.lotes.join(', ') : 'S/ LOTE';
    doc.text(loteStr.length > 22 ? loteStr.substring(0, 20) + '...' : loteStr, 88, y + 4.8);

    doc.text(String(val.planejado), 122, y + 4.8, { align: 'right' });
    if (val.corte > 0) {
      doc.setTextColor(194, 65, 12); // orange-700
      doc.text(`-${val.corte}`, 139, y + 4.8, { align: 'right' });
      doc.setTextColor(30, 41, 59);
    } else {
      doc.text('-', 139, y + 4.8, { align: 'right' });
    }
    doc.setFont('helvetica', 'bold');
    doc.text(String(val.carregado), 158, y + 4.8, { align: 'right' });

    if (dif === 0) {
      doc.setTextColor(emeraldSuccess[0], emeraldSuccess[1], emeraldSuccess[2]);
      doc.text('0', 175, y + 4.8, { align: 'right' });
      doc.text('OK', 194, y + 4.8, { align: 'right' });
    } else if (dif > 0) {
      doc.setTextColor(amberWarning[0], amberWarning[1], amberWarning[2]);
      doc.text(`+${dif}`, 175, y + 4.8, { align: 'right' });
      doc.text('SOBRA', 194, y + 4.8, { align: 'right' });
    } else {
      doc.setTextColor(220, 38, 38);
      doc.text(String(dif), 175, y + 4.8, { align: 'right' });
      doc.text('FALTA', 194, y + 4.8, { align: 'right' });
    }

    y += 7;
    rowIndex++;
  });

  // Table Totals Footer
  doc.setFillColor(241, 245, 249);
  doc.rect(10, y, pageWidth - 20, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);

  doc.text('TOTAIS CONSOLIDADOS:', 13, y + 5.5);
  doc.text(String(totalPlanejado), 122, y + 5.5, { align: 'right' });
  if (totalCorteTabela > 0) doc.setTextColor(194, 65, 12);
  doc.text(totalCorteTabela > 0 ? `-${totalCorteTabela}` : '-', 139, y + 5.5, { align: 'right' });
  doc.setTextColor(15, 23, 42);
  doc.text(String(totalCarregado), 158, y + 5.5, { align: 'right' });

  const difTotal = totalCarregado - (totalPlanejado - totalCorteTabela);

  if (difTotal === 0) {
    doc.setTextColor(emeraldSuccess[0], emeraldSuccess[1], emeraldSuccess[2]);
    doc.text('0', 175, y + 5.5, { align: 'right' });
    doc.text('CONFORME', 194, y + 5.5, { align: 'right' });
  } else {
    doc.setTextColor(220, 38, 38);
    doc.text((difTotal > 0 ? `+${difTotal}` : String(difTotal)), 175, y + 5.5, { align: 'right' });
    doc.text('DIVERGENTE', 194, y + 5.5, { align: 'right' });
  }

  y += 8;

  // Resumo do corte operacional (SKU, quantidade e motivo) logo abaixo da tabela
  if (cortesResumo.length > 0) {
    const resumo = cortesResumo.map((c) => `SKU ${c.sku}: ${c.quantidade} vol. (${c.motivo})`).join('   •   ');
    const linhas = [
      ...(doc.splitTextToSize(
        `CORTE OPERACIONAL - Total ${totalCorteTabela} vol.  |  ${resumo}`,
        pageWidth - 28
      ) as string[]),
      'DIF. = Carregado - (Planejado - Corte)',
    ];
    const boxH = 4 + linhas.length * 3.6;
    doc.setFillColor(255, 247, 237); // orange-50
    doc.setDrawColor(253, 186, 116); // orange-300
    doc.rect(10, y, pageWidth - 20, boxH, 'FD');
    doc.setTextColor(154, 52, 18); // orange-800
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(linhas, 14, y + 4.2);
    y += boxH + 6;
  } else {
    y += 6;
  }

  // Verification Box
  doc.setFillColor(difTotal === 0 ? 240 : 254, difTotal === 0 ? 253 : 242, difTotal === 0 ? 244 : 242);
  doc.setDrawColor(difTotal === 0 ? 74 : 239, difTotal === 0 ? 222 : 68, difTotal === 0 ? 128 : 68);
  doc.roundedRect(10, y, pageWidth - 20, 16, 2, 2, 'FD');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  if (difTotal === 0 && totalDivergencias === 0) {
    doc.setTextColor(emeraldSuccess[0], emeraldSuccess[1], emeraldSuccess[2]);
    doc.text('STATUS: CONFERÊNCIA CONCLUÍDA SEM DIVERGÊNCIAS', 14, y + 6);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Todos os itens físicos carregados conferem exatamente com a relação planejada do Documento de Transporte.', 14, y + 11);
  } else {
    doc.setTextColor(220, 38, 38);
    doc.text(`STATUS: ATENÇÃO - DIVERGÊNCIA IDENTIFICADA (${totalDivergencias} ITEM(NS))`, 14, y + 6);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Diferença física acumulada: ${difTotal} unidades. Favor acionar o supervisor de expedição antes do fechamento.`, 14, y + 11);
  }

  y += 22;

  // Book de Fotos Section
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('BOOK FOTOGRÁFICO DE CARREGAMENTO & EVIDÊNCIAS', 10, y);
  y += 4;

  // Fotos agrupadas por lançamento (todas as fotos, com página nova quando não couber)
  type GrupoFotos = { titulo: string; sub?: string; cor: [number, number, number]; fotos: { label: string; dataUrl: string }[] };
  const coresGrupo: [number, number, number][] = [
    [217, 119, 6], // âmbar
    [37, 99, 235], // azul
    [5, 150, 105], // verde
    [124, 58, 237], // roxo
    [225, 29, 72], // vermelho
    [8, 145, 178], // ciano
  ];
  const grupos: GrupoFotos[] = [];
  if (inspection.fotoVeiculoInicio) {
    grupos.push({
      titulo: `VEÍCULO NA CHEGADA • PLACA ${inspection.placa || '-'}`,
      cor: [100, 116, 139],
      fotos: [{ label: 'Veículo na chegada', dataUrl: inspection.fotoVeiculoInicio }],
    });
  }
  inspection.itensConferidos.forEach((item, idx) => {
    if (!item.fotos.length) return;
    const n = idx + 1;
    grupos.push({
      titulo: `LANÇAMENTO #${n} • SKU ${item.sku} • ${item.quantidadeCarregada} VOL. • LOTE ${item.lote || 'S/L'}`,
      sub: item.descricao,
      cor: coresGrupo[(n - 1) % coresGrupo.length],
      fotos: item.fotos.map((foto, fIdx) => ({
        label: `#${n} ${item.sku} • ${item.quantidadeCarregada} vol. • foto ${fIdx + 1}/${item.fotos.length}`,
        dataUrl: foto,
      })),
    });
  });
  if (inspection.retornoPallet?.fotoPallets || inspection.retornoPallet?.fotoControle) {
    const rp = inspection.retornoPallet;
    grupos.push({
      titulo: `RETORNO DE PALLETS • ${resumoRetornoPallet(rp).toUpperCase()}`,
      cor: [217, 119, 6],
      fotos: [
        rp.fotoPallets ? { label: 'Pallets retornados', dataUrl: rp.fotoPallets } : null,
        rp.fotoControle ? { label: 'Controle de Recebimento', dataUrl: rp.fotoControle } : null,
      ].filter((x): x is { label: string; dataUrl: string } => !!x),
    });
  }
  if (inspection.fotosGerais?.length) {
    grupos.push({
      titulo: 'FOTOS GERAIS DA CARGA',
      cor: [71, 85, 105],
      fotos: inspection.fotosGerais.map((foto, i) => ({
        label: `Foto geral ${i + 1}/${inspection.fotosGerais.length}`,
        dataUrl: foto,
      })),
    });
  }
  const fotosFechamento = [
    inspection.fotoVeiculoFim ? { label: 'Final da carga', dataUrl: inspection.fotoVeiculoFim } : null,
    inspection.fotoLacre ? { label: `Lacre ${inspection.numeroLacre || 'OK'}`, dataUrl: inspection.fotoLacre } : null,
  ].filter((x): x is { label: string; dataUrl: string } => !!x);
  if (fotosFechamento.length) {
    grupos.push({
      titulo: `FECHAMENTO • LACRE ${inspection.numeroLacre || 'OK'}`,
      cor: [100, 116, 139],
      fotos: fotosFechamento,
    });
  }

  if (grupos.length > 0) {
    const margem = 10;
    const larguraUtil = pageWidth - margem * 2;
    const colunas = 3;
    const espaco = 5;
    const photoWidth = (larguraUtil - 6 - espaco * (colunas - 1)) / colunas;
    const photoHeight = photoWidth * 0.75;
    const legendaAltura = 6;
    const linhaAltura = photoHeight + espaco;
    const topoPagina = 15;
    const limite = pageHeight - 12;

    grupos.forEach((g) => {
      const cabecalhoAltura = g.sub ? 12 : 8;
      // Cabeçalho + pelo menos uma linha de fotos precisam caber na página
      if (y + cabecalhoAltura + linhaAltura + 4 > limite) {
        doc.addPage();
        y = topoPagina;
      }
      let inicioSegmento = y;
      const fecharMoldura = (ate: number) => {
        doc.setDrawColor(g.cor[0], g.cor[1], g.cor[2]);
        doc.setLineWidth(0.8);
        doc.roundedRect(margem, inicioSegmento, larguraUtil, ate - inicioSegmento, 2, 2, 'D');
        doc.setLineWidth(0.2);
      };

      // Cabeçalho colorido do grupo
      doc.setFillColor(g.cor[0], g.cor[1], g.cor[2]);
      doc.rect(margem, y, larguraUtil, cabecalhoAltura, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text(g.titulo, margem + 3, y + 5.2);
      if (g.sub) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.text(g.sub.substring(0, 110), margem + 3, y + 9.8);
      }
      y += cabecalhoAltura + 3;

      g.fotos.forEach((foto, i) => {
        const col = i % colunas;
        if (col === 0 && i > 0) y += linhaAltura;
        // Quebra de página no meio do grupo: fecha a moldura e continua na próxima página
        if (col === 0 && y + photoHeight > limite) {
          fecharMoldura(y - 1);
          doc.addPage();
          y = topoPagina;
          inicioSegmento = y;
        }
        const x = margem + 3 + col * (photoWidth + espaco);
        try {
          doc.addImage(foto.dataUrl, 'JPEG', x, y, photoWidth, photoHeight, undefined, 'FAST');
        } catch {
          doc.setFillColor(241, 245, 249);
          doc.rect(x, y, photoWidth, photoHeight, 'F');
          doc.setFontSize(7);
          doc.setTextColor(100, 116, 139);
          doc.text('Foto registrada', x + 4, y + photoHeight / 2);
        }
        doc.setDrawColor(g.cor[0], g.cor[1], g.cor[2]);
        doc.rect(x, y, photoWidth, photoHeight, 'D');
        doc.setFillColor(15, 23, 42);
        doc.rect(x, y + photoHeight - legendaAltura, photoWidth, legendaAltura, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(6.3);
        doc.setFont('helvetica', 'bold');
        doc.text(foto.label.substring(0, 42), x + 1.5, y + photoHeight - 2);
      });
      y += photoHeight + 3;
      fecharMoldura(y);
      y += 5;
    });
  } else {
    doc.setFillColor(248, 250, 252);
    doc.rect(10, y, pageWidth - 20, 20, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 116, 139);
    doc.text('Fotos digitais anexadas ao registro eletrônico no WMS CargaCheck.', 15, y + 11);
    y += 24;
  }

  // Signatures Section at bottom (nova página se o conteúdo já ocupou o rodapé)
  if (y > pageHeight - 34) {
    doc.addPage();
  }
  const sigY = pageHeight - 34;

  // Assinaturas coletadas na finalização, desenhadas sobre as linhas (proporção preservada)
  const drawSignature = (dataUrl: string | undefined, x: number) => {
    if (!dataUrl) return;
    try {
      const props = doc.getImageProperties(dataUrl);
      const maxW = 75;
      const maxH = 16;
      const scale = Math.min(maxW / props.width, maxH / props.height);
      const w = props.width * scale;
      const h = props.height * scale;
      doc.addImage(dataUrl, 'PNG', x + (maxW - w) / 2, sigY + 12 - h, w, h, undefined, 'FAST');
    } catch {
      /* assinatura inválida: mantém só a linha */
    }
  };
  drawSignature(inspection.assinaturaConferente, 15);
  drawSignature(inspection.assinaturaMotorista, 115);

  doc.setDrawColor(148, 163, 184);
  doc.line(15, sigY + 12, 90, sigY + 12);
  doc.line(115, sigY + 12, 190, sigY + 12);

  doc.setTextColor(71, 85, 105);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text(`CONFERENTE: ${inspection.conferente.toUpperCase()}`, 15, sigY + 16);
  doc.setFont('helvetica', 'normal');
  doc.text(`Matrícula: ${inspection.matriculaConferente || 'CONF-8842'}`, 15, sigY + 20);

  doc.setFont('helvetica', 'bold');
  doc.text('MOTORISTA', 115, sigY + 16);
  doc.setFont('helvetica', 'normal');
  doc.text(`Placa: ${inspection.placa} • Lacre: ${inspection.numeroLacre || 'S/ LACRE'}`, 115, sigY + 20);

  const cleanDt = (inspection.dt || 'DT').replace(/[^a-zA-Z0-9_-]/g, '');
  const cleanPlaca = (inspection.placa || 'PLACA').replace(/[^a-zA-Z0-9_-]/g, '');
  const filename = `Book_Carregamento_${cleanDt}_${cleanPlaca}.pdf`;
  const blobUrl = doc.output('bloburl').toString();

  return { doc, filename, blobUrl };
}

// Instrução do cliente que vai impressa no Book (mesma regra da tela)
export const notaClienteDoBook = (inspection: CargoInspection, clientNotes: ClientNote[] = []) => {
  const loadCli = inspection.itensPlanejados.find((p) => p.cliente)?.cliente || '';
  const matching = clientNotes.find(
    (n) =>
      n.ativo &&
      ((loadCli && (n.cliente.toUpperCase() === loadCli.toUpperCase() || loadCli.toUpperCase().includes(n.cliente.toUpperCase()))) ||
        inspection.dt.toUpperCase().includes(n.cliente.toUpperCase()) ||
        notaPorCodigoCliente(n, inspection.itensPlanejados) ||
        n.cliente.toUpperCase() === 'GERAL')
  );
  return matching ? `${matching.cliente}: ${matching.mensagem}` : undefined;
};

// Gera e baixa o Book completo (todas as informações e fotos). Usado pelo Book e pelo e-mail.
export const baixarBookCarregamentoPdf = (
  inspection: CargoInspection,
  empresaNome?: string,
  unidadeCD?: string,
  clientNotes: ClientNote[] = []
) => {
  const { doc, filename } = generateBookCarregamentoPdf(inspection, empresaNome, unidadeCD, notaClienteDoBook(inspection, clientNotes));
  doc.save(filename);
};

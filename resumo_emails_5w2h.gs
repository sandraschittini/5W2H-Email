/**
 * Resume os emails recebidos ontem em 5W2H, SEM IA e SEM custo.
 *
 * Colunas:
 *   What     = assunto do email
 *   Why      = primeiros 30 caracteres do corpo da mensagem
 *   Who      = Nome do remetente + endereço de email
 *   When     = data de recebimento + datas/horários citados no texto
 *   Where    = link para abrir a mensagem no Gmail
 *   How      = Boleto, Curso, Candidatura, Segurança, Mala direta ou Outros
 *   How much = tamanho total dos anexos (0 se não houver)
 *
 * ORDEM DA CLASSIFICAÇÃO (coluna How) - a primeira que combinar vence:
 *   0. Empresa da qual você é cliente (remetente) ou frase de boleto  -> Boleto
 *   0. Remetente de propaganda já conhecido                          -> Mala direta
 *   1. Instituição de educação (remetente ou assunto)  -> Curso
 *   2. Candidatura (inscrição confirmada, vaga finalizada, currículo em análise...)
 *   3. Curso / educação (palavras no texto)
 *   4. Segurança (token, aviso de acesso, conta associada...)
 *   5. Mala direta (propaganda)
 *   6. Outros
 */

// Limite de emails por execução (o Apps Script para depois de ~6 minutos;
// o Gmail só entrega até 500 conversas por busca).
const MAX_EMAILS = 100;

// Quantos dias para trás a função "resumirUltimosNDias" deve olhar.
// 1 = só ontem | 5 = de 5 dias atrás até ontem | etc.
const DIAS_ATRAS = 5;
const NOME_ABA = 'EmailsResumo';

const COLUNAS = [
  'What (O quê)', 'Why (Por quê)', 'Who (Quem)', 'When (Quando)',
  'Where (Onde)', 'How (Como)', 'How much (Quanto)'
];

/* ================================================================
 * LISTAS EDITÁVEIS - é só acrescentar itens, separados por vírgula.
 * Pode escrever com ou sem acento, em maiúsculas ou minúsculas.
 * Cada termo é procurado no INÍCIO das palavras ("puc" pega "PUCRS",
 * "token" pega "tokens").
 * ================================================================ */

// 0) Boleto: empresas/concessionárias das quais você é cliente.
// Procuradas SÓ no remetente (nome ou endereço do email).
const EMPRESAS_BOLETO = [
  'Águas de Juturnaíba', 'contadigital@relacionamentocaj.com.br',
  'Enel', 'Porto Seguro', 'Banco do Brasil', 'Claro', 'Vivo',
  'Fundação Atlântico', 'Anjos da Esperança', 'Canção Nova', 'qualicorp.net'
];

// 0) Boleto também por frases no assunto/texto, mesmo que o remetente não esteja na lista acima
const PALAVRAS_BOLETO = [
  'geração de nota fiscal', 'nota fiscal', 'fatura'
];

// 0) Mala direta por remetente conhecido (propaganda). Procurados SÓ no remetente.
const REMETENTES_MALA_DIRETA = [
  'mail@mail.adobe.com'
];

// 1) Instituições de educação (procuradas no remetente e no assunto)
const INSTITUICOES_EDUCACAO = [
  'USP', 'PUC', 'SENAI', 'SENAC', 'Educadados',
  'Estácio', 'Certiprof', 'clubedohardware', 'Fapetec', 'Hotmart'
];

// 2) Candidatura
const PALAVRAS_CANDIDATURA = [
  'inscrição confirmada', 'sua inscrição foi enviada', 'inscrição', 'inscrições',
  'vaga finalizada', 'vaga encerrada', 'vaga preenchida',
  'currículo em análise', 'currículo recebido', 'currículo enviado',
  'candidat', 'processo seletivo', 'recruiting',
  'avaliação comportamental', 'interview', 'entrevista', 'processo'
];

// 3) Curso / educação (palavras no texto)
const PALAVRAS_CURSO = [
  'curso', 'educação', 'aula'
];

// 4) Segurança
const PALAVRAS_SEGURANCA = [
  'token', 'código de verificação', 'código de segurança',
  'aviso de segurança', 'alerta de segurança',
  'novo acesso', 'novo login', 'acesso à sua conta', 'acesso suspeito',
  'conta associada', 'conta vinculada',
  'redefinição de senha', 'redefinir senha', 'verificação em duas etapas',
  'compartilhar dados', 'compartilhar seus dados', 'compartilhamento de dados',
  'compartilhou alguns dados', 'dados da sua conta do google',
  'novo dispositivo', 'dispositivo foi validado', 'dispositivo validado'
];

// 5) Mala direta (propaganda). Além destas palavras, o script também
// considera mala direta qualquer email com cabeçalho "List-Unsubscribe".
const PALAVRAS_MALA_DIRETA = [
  'cancelar inscrição', 'descadastr', 'unsubscribe', 'newsletter',
  'deixar de receber', 'ver no navegador', 'view in browser',
  'promoção', 'desconto', 'oferta', 'cupom', 'black friday', 'frete grátis',
  'feche negócio', 'fechar negócio'
];

const TIPO_PADRAO = 'Outros';

/* ================================================================ */

/* ================================================================
 * FUNÇÕES PARA ESCOLHER NO MENU "Executar" DO APPS SCRIPT
 * Cada uma define a data de início. O fim é sempre 00:00 de hoje,
 * ou seja, o período vai até o fim de ontem.
 * ================================================================ */
function resumirOntem()         { executar(1); }
function resumirUltimos2Dias()  { executar(2); }
function resumirUltimos3Dias()  { executar(3); }
function resumirUltimos7Dias()  { executar(7); }
function resumirUltimos30Dias() { executar(30); }
function resumirUltimosNDias()  { executar(DIAS_ATRAS); }   // usa o número definido em DIAS_ATRAS
function resumirTodos()         { executar(0); }            // sem filtro de data: toda a caixa de entrada

// Mantida para não quebrar acionadores (relógio) que já usam este nome
function resumirEmailsDeOntem() { executar(1); }

// dias > 0: de "dias" dias atrás (00:00) até 00:00 de hoje
// dias = 0: todos os emails da caixa de entrada
function executar(dias) {
  const tz = Session.getScriptTimeZone();

  const hoje = new Date();
  const fimDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

  let inicioDia = null;
  let consulta = 'in:inbox';
  if (dias > 0) {
    inicioDia = new Date(fimDia);
    inicioDia.setDate(inicioDia.getDate() - dias);
    consulta += ' after:' + Math.floor(inicioDia.getTime() / 1000) +
                ' before:' + Math.floor(fimDia.getTime() / 1000);
  }

  const threads = GmailApp.search(consulta, 0, Math.min(MAX_EMAILS, 500));
  const linhas = [];

  threads.forEach(function (thread) {
    const link = thread.getPermalink();

    thread.getMessages().forEach(function (msg) {
      const data = msg.getDate();
      if (inicioDia && (data < inicioDia || data >= fimDia)) return;
      if (linhas.length >= MAX_EMAILS) return;

      const assunto = msg.getSubject() || '(sem assunto)';
      const corpo = (msg.getPlainBody() || '').replace(/\s+/g, ' ').trim();
      const dataFmt = Utilities.formatDate(data, tz, 'dd/MM/yyyy HH:mm');

      const tipo = classificaTipo(msg, assunto, corpo);
      aplicarRotulo(thread, tipo);          // Boleto -> Recibos | Candidatura -> trabalho

      linhas.push([
        assunto,                              // What
        corpo.substring(0, 30),               // Why (primeiros 30 caracteres)
        remetente(msg.getFrom()),             // Who
        achaQuando(corpo, dataFmt),           // When
        link,                                 // Where
        tipo,                                 // How
        tamanhoAnexos(msg)                    // How much
      ]);
    });
  });

  escreverNaPlanilha(linhas);
}

/* ---------- Classificação (coluna How) ---------- */

function classificaTipo(msg, assunto, corpo) {
  const texto = semAcento(assunto + ' ' + corpo.substring(0, 3000));
  const remetenteEAssunto = semAcento(msg.getFrom() + ' ' + assunto);

  // Para Candidatura, ignora frases de rodapé como "cancelar inscrição",
  // senão toda propaganda com esse rodapé viraria Candidatura.
  const textoSemRodape = texto.replace(/cancel\w*\s+(a\s+|sua\s+|minha\s+)?inscricao/g, ' ');

  const soRemetente = semAcento(msg.getFrom());

  // 0) Boleto: remetente é uma empresa da qual você é cliente, ou frase típica de boleto/nota
  if (contemAlgum(soRemetente, EMPRESAS_BOLETO) || contemAlgum(texto, PALAVRAS_BOLETO)) return 'Boleto';

  // 0) Mala direta de remetente já conhecido
  if (contemAlgum(soRemetente, REMETENTES_MALA_DIRETA)) return 'Mala direta';

  // 1) Instituição de educação
  if (contemAlgum(remetenteEAssunto, INSTITUICOES_EDUCACAO)) return 'Curso';

  // 2) Candidatura
  if (contemAlgum(textoSemRodape, PALAVRAS_CANDIDATURA)) return 'Candidatura';

  // 3) Curso / educação
  if (contemAlgum(texto, PALAVRAS_CURSO)) return 'Curso';

  // 4) Segurança
  if (contemAlgum(texto, PALAVRAS_SEGURANCA)) return 'Segurança';

  // 5) Mala direta
  if (temDescadastro(msg) || contemAlgum(texto, PALAVRAS_MALA_DIRETA)) return 'Mala direta';

  // 6) Outros
  return TIPO_PADRAO;
}

// true se algum termo da lista aparece no início de uma palavra do texto
function contemAlgum(texto, lista) {
  for (let i = 0; i < lista.length; i++) {
    const termo = semAcento(lista[i]).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp('\\b' + termo).test(texto)) return true;
  }
  return false;
}

// Emails de envio em massa costumam trazer o cabeçalho "List-Unsubscribe"
// (é o que faz o Gmail mostrar o botão "Cancelar inscrição" no topo do email).
function temDescadastro(msg) {
  try {
    return !!msg.getHeader('List-Unsubscribe');
  } catch (e) {
    return false;
  }
}

/* ---------- Demais colunas ---------- */

// "João Fulano <fulano@empresa.com>"  ->  "João Fulano fulano@empresa.com"
function remetente(from) {
  const m = from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (!m) return from.trim();
  const nome = m[1].trim();
  const email = m[2].trim();
  return nome ? nome + ' ' + email : email;
}

// Data de recebimento + datas/horários citados no texto
function achaQuando(corpo, dataRecebido) {
  const re = /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b|\b\d{1,2}h(?:\d{2})?\b|\b\d{1,2}:\d{2}\b|\b(?:hoje|amanhã|segunda|terça|quarta|quinta|sexta|sábado|domingo)(?:-feira)?\b/gi;
  const achados = unicos(corpo.match(re) || []).slice(0, 4);
  return achados.length
    ? 'Recebido ' + dataRecebido + ' | Cita: ' + achados.join(', ')
    : 'Recebido ' + dataRecebido;
}

// Soma do tamanho dos anexos (sem contar imagens embutidas). 0 se não houver.
function tamanhoAnexos(msg) {
  const anexos = msg.getAttachments({ includeInlineImages: false, includeAttachments: true });
  if (anexos.length === 0) return '0';
  let bytes = 0;
  anexos.forEach(function (a) { bytes += a.getBytes().length; });
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return Math.max(1, Math.round(bytes / 1024)) + ' KB';
}

function semAcento(s) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function unicos(lista) {
  return lista.filter(function (v, i) { return lista.indexOf(v) === i; });
}

/* ---------- Planilha ---------- */

// Usa a planilha à qual o script está ligado. Se o script for avulso
// (criado em script.google.com), cria uma planilha na primeira execução
// e passa a reutilizá-la nas próximas.
function obterPlanilha() {
  const ativa = SpreadsheetApp.getActiveSpreadsheet();
  if (ativa) return ativa;

  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('PLANILHA_ID');
  if (id) {
    try {
      return SpreadsheetApp.openById(id);
    } catch (e) {
      // planilha apagada ou sem acesso: cria outra abaixo
    }
  }
  const nova = SpreadsheetApp.create('Resumo de emails 5W2H');
  props.setProperty('PLANILHA_ID', nova.getId());
  return nova;
}

function escreverNaPlanilha(linhas) {
  const ss = obterPlanilha();
  Logger.log('Planilha: ' + ss.getUrl());
  const aba = ss.getSheetByName(NOME_ABA) || ss.insertSheet(NOME_ABA);
  aba.clear();

  aba.getRange(1, 1, 1, COLUNAS.length).setValues([COLUNAS]).setFontWeight('bold');
  aba.setFrozenRows(1);

  if (linhas.length > 0) {
    // Tudo como texto, para o "0" e as datas não serem convertidos pelo Sheets
    aba.getRange(2, 1, linhas.length, COLUNAS.length).setNumberFormat('@').setValues(linhas);
  }
  aba.autoResizeColumns(1, COLUNAS.length);
}

/* ================================================================
 * EXCLUSÃO DE EMAILS POR PERÍODO E POR TIPO (coluna How)
 *
 * Passo 1: rode  simularExclusao  -> só lista o que SERIA excluído.
 * Passo 2: rode  excluirEmails    -> move esses emails para a LIXEIRA
 *          (o Gmail guarda a lixeira por 30 dias; dá para recuperar).
 *
 * Nada é apagado de forma definitiva por este script.
 * Mensagens com estrela e mensagens enviadas por você nunca são excluídas.
 * ================================================================ */

// De quantos dias atrás até ontem. 1 = só ontem | 7 = última semana | 0 = todos os dias
const DIAS_EXCLUSAO = 7;

// Tipos (coluna How) a excluir. Acrescente quantos quiser, separados por vírgula.
// Opções: 'Boleto', 'Curso', 'Candidatura', 'Segurança', 'Mala direta', 'Outros'
const TIPOS_PARA_EXCLUIR = ['Mala direta', 'Segurança'];

const TIPOS_VALIDOS = ['Boleto', 'Curso', 'Candidatura', 'Segurança', 'Mala direta', 'Outros'];
const ABA_EXCLUIDOS = 'Excluídos';

// Usam o período definido em DIAS_EXCLUSAO
function simularExclusao() { excluirPorTipo(true); }    // não exclui nada
function excluirEmails()   { excluirPorTipo(false); }   // move para a lixeira

// Período fixo de 30 dias (ignoram DIAS_EXCLUSAO), com os mesmos TIPOS_PARA_EXCLUIR
function simularExclusaoUltimos30Dias() { excluirPorTipo(true, 30); }
function excluirEmailsUltimos30Dias()   { excluirPorTipo(false, 30); }

// dias: opcional. Se não for informado, usa DIAS_EXCLUSAO.
function excluirPorTipo(simulacao, dias) {
  validarTipos(TIPOS_PARA_EXCLUIR);
  const tiposAlvo = TIPOS_PARA_EXCLUIR.map(semAcento);

  const tz = Session.getScriptTimeZone();
  const eu = (Session.getEffectiveUser().getEmail() || '').toLowerCase();
  const janela = montarJanela(dias === undefined ? DIAS_EXCLUSAO : dias);
  const threads = GmailApp.search(janela.consulta, 0, Math.min(MAX_EMAILS, 500));

  const agora = Utilities.formatDate(new Date(), tz, 'dd/MM/yyyy HH:mm');
  const registros = [];

  threads.forEach(function (thread) {
    thread.getMessages().forEach(function (msg) {
      const data = msg.getDate();
      if (janela.inicio && (data < janela.inicio || data >= janela.fim)) return;
      if (msg.isInTrash()) return;
      if (msg.isStarred()) return;                                   // protege mensagens com estrela
      if (eu && msg.getFrom().toLowerCase().indexOf(eu) !== -1) return; // protege o que você enviou

      const assunto = msg.getSubject() || '(sem assunto)';
      const corpo = (msg.getPlainBody() || '').replace(/\s+/g, ' ').trim();
      const tipo = classificaTipo(msg, assunto, corpo);
      if (tiposAlvo.indexOf(semAcento(tipo)) === -1) return;

      if (!simulacao) msg.moveToTrash();

      registros.push([
        agora,
        Utilities.formatDate(data, tz, 'dd/MM/yyyy HH:mm'),
        assunto,
        remetente(msg.getFrom()),
        tipo,
        simulacao ? 'SIMULAÇÃO (nada foi excluído)' : 'Movido para a lixeira'
      ]);
    });
  });

  registrarExclusao(registros);
  Logger.log((simulacao ? 'SIMULAÇÃO: ' : 'EXCLUÍDOS: ') + registros.length +
             ' email(s) do(s) tipo(s) ' + TIPOS_PARA_EXCLUIR.join(', ') +
             '. Detalhes na aba "' + ABA_EXCLUIDOS + '".');
}

// Janela de datas: de "dias" dias atrás (00:00) até 00:00 de hoje. dias = 0: sem limite de data.
function montarJanela(dias) {
  const hoje = new Date();
  const fim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  let inicio = null;
  let consulta = 'in:inbox';
  if (dias > 0) {
    inicio = new Date(fim);
    inicio.setDate(inicio.getDate() - dias);
    consulta += ' after:' + Math.floor(inicio.getTime() / 1000) +
                ' before:' + Math.floor(fim.getTime() / 1000);
  }
  return { consulta: consulta, inicio: inicio, fim: fim };
}

function validarTipos(lista) {
  if (!lista || lista.length === 0) {
    throw new Error('Defina ao menos um tipo em TIPOS_PARA_EXCLUIR.');
  }
  const validos = TIPOS_VALIDOS.map(semAcento);
  lista.forEach(function (t) {
    if (validos.indexOf(semAcento(t)) === -1) {
      throw new Error('Tipo desconhecido: "' + t + '". Use: ' + TIPOS_VALIDOS.join(', '));
    }
  });
}

// Guarda um histórico do que foi (ou seria) excluído, para você conferir ou recuperar na lixeira
function registrarExclusao(registros) {
  if (registros.length === 0) return;
  const ss = obterPlanilha();
  let aba = ss.getSheetByName(ABA_EXCLUIDOS);
  if (!aba) {
    aba = ss.insertSheet(ABA_EXCLUIDOS);
    const cab = ['Executado em', 'Data do email', 'Assunto', 'Remetente', 'Tipo (How)', 'Resultado'];
    aba.getRange(1, 1, 1, cab.length).setValues([cab]).setFontWeight('bold');
    aba.setFrozenRows(1);
  }
  aba.getRange(aba.getLastRow() + 1, 1, registros.length, 6)
     .setNumberFormat('@').setValues(registros);
  aba.autoResizeColumns(1, 6);
}

/* ================================================================
 * MARCADORES DO GMAIL ("pastas")
 *
 * Toda vez que um resumo é executado, os emails de cada tipo abaixo
 * recebem o marcador indicado. No Gmail, "pasta" é um marcador: o email
 * passa a aparecer dentro dele, na barra lateral.
 * Se o marcador ainda não existir, o script cria.
 * ================================================================ */

// tipo (coluna How) -> nome do marcador no Gmail. Acrescente outros se quiser.
const ROTULOS_POR_TIPO = {
  'Boleto': 'Recibos',
  'Candidatura': 'trabalho',
  'Curso': 'Social',
  'Mala direta': 'Promoções'
};

// true = além de marcar, tira o email da Caixa de entrada (continua no marcador)
const ARQUIVAR_APOS_ROTULAR = false;

// false = os resumos só resumem, sem mexer nos marcadores
const ROTULAR_NO_RESUMO = true;

// Abas automáticas do Gmail. Se o nome em ROTULOS_POR_TIPO for um destes,
// o email é movido para a aba (precisa do serviço "Gmail API" ativado no Apps Script).
// Qualquer outro nome vira um marcador comum.
const CATEGORIAS_GMAIL = {
  'principal': 'CATEGORY_PERSONAL',
  'promocoes': 'CATEGORY_PROMOTIONS',
  'social': 'CATEGORY_SOCIAL',
  'atualizacoes': 'CATEGORY_UPDATES',
  'foruns': 'CATEGORY_FORUMS'
};

function aplicarRotulo(thread, tipo) {
  if (!ROTULAR_NO_RESUMO) return;
  const nome = ROTULOS_POR_TIPO[tipo];
  if (!nome) return;
  try {
    const categoria = CATEGORIAS_GMAIL[semAcento(nome)];
    if (categoria) {
      moverParaAba(thread, categoria);
    } else {
      thread.addLabel(obterRotulo(nome));
    }
    if (ARQUIVAR_APOS_ROTULAR) thread.moveToArchive();
  } catch (e) {
    Logger.log('Falha ao aplicar "' + nome + '": ' + e);
  }
}

// Move a conversa para uma aba do Gmail (Promoções, Social...), tirando das outras abas
function moverParaAba(thread, categoria) {
  if (typeof Gmail === 'undefined') {
    throw new Error('Ative o serviço "Gmail API" em Serviços (+) no menu lateral do Apps Script.');
  }
  const outras = Object.keys(CATEGORIAS_GMAIL)
    .map(function (k) { return CATEGORIAS_GMAIL[k]; })
    .filter(function (c) { return c !== categoria; });
  Gmail.Users.Threads.modify(
    { addLabelIds: [categoria], removeLabelIds: outras },
    'me',
    thread.getId()
  );
}

// Procura o marcador ignorando maiúsculas/minúsculas ("trabalho" acha "Trabalho");
// se não existir, cria.
const cacheRotulos = {};
function obterRotulo(nome) {
  if (cacheRotulos[nome]) return cacheRotulos[nome];
  const alvo = nome.toLowerCase();
  const existentes = GmailApp.getUserLabels();
  for (let i = 0; i < existentes.length; i++) {
    if (existentes[i].getName().toLowerCase() === alvo) {
      cacheRotulos[nome] = existentes[i];
      return existentes[i];
    }
  }
  cacheRotulos[nome] = GmailApp.createLabel(nome);
  return cacheRotulos[nome];
}

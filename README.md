# Resumo de emails 5W2H para Gmail

Script de **Google Apps Script** que lê a sua caixa de entrada do Gmail, resume os emails de um período em formato **5W2H**, classifica cada um por tipo e, se você quiser, organiza o Gmail automaticamente (marcadores e abas) ou move para a lixeira os tipos que você não quer.

Funciona **sem IA, sem API paga e sem chave de acesso**. Tudo roda dentro da sua própria conta Google, usando regras simples de palavras-chave que você mesmo edita.

---

## O que ele faz

1. **Resume** os emails de ontem, de N dias atrás ou de toda a caixa de entrada, numa planilha do Google Sheets.
2. **Classifica** cada email em um tipo: `Boleto`, `Curso`, `Candidatura`, `Segurança`, `Mala direta` ou `Outros`.
3. **Organiza o Gmail** aplicando marcadores (como "Recibos" e "trabalho") ou movendo para as abas Promoções, Social etc.
4. **Exclui** (move para a lixeira) emails por período e por tipo, com modo de simulação.

---

## Formato da planilha

Os resultados vão para a aba **EmailsResumo**, com 7 colunas:

| Coluna | Conteúdo |
|---|---|
| **What** (O quê) | Assunto do email |
| **Why** (Por quê) | Primeiros 30 caracteres do corpo da mensagem |
| **Who** (Quem) | Nome do remetente seguido do endereço de email |
| **When** (Quando) | Data de recebimento, mais datas e horários citados no texto (como "15/10", "14h", "amanhã") |
| **Where** (Onde) | Link para abrir a conversa no Gmail |
| **How** (Como) | Tipo do email (veja abaixo) |
| **How much** (Quanto) | Tamanho total dos anexos (`245 KB`, `1.2 MB`) ou `0` se não houver anexo |

A aba é reescrita a cada execução. O resultado anterior é substituído.

---

## Como a classificação funciona (coluna How)

Cada email recebe **um único tipo**. A primeira regra que combinar vence, nesta ordem:

| # | Regra | Tipo |
|---|---|---|
| 1 | Remetente é uma empresa de `EMPRESAS_BOLETO`, ou o texto tem uma frase de `PALAVRAS_BOLETO` | **Boleto** |
| 2 | Remetente está em `REMETENTES_MALA_DIRETA` | **Mala direta** |
| 3 | Remetente ou assunto cita uma instituição de `INSTITUICOES_EDUCACAO` | **Curso** |
| 4 | Texto tem palavra de `PALAVRAS_CANDIDATURA` | **Candidatura** |
| 5 | Texto tem palavra de `PALAVRAS_CURSO` | **Curso** |
| 6 | Texto tem palavra de `PALAVRAS_SEGURANCA` | **Segurança** |
| 7 | Texto tem palavra de `PALAVRAS_MALA_DIRETA`, ou o email traz o cabeçalho `List-Unsubscribe` | **Mala direta** |
| 8 | Nenhuma regra combinou | **Outros** |

**Detalhes das regras:**

- A comparação ignora acentos e diferença entre maiúsculas e minúsculas.
- Cada termo é procurado no **início das palavras**: `puc` encontra "PUCRS" e `token` encontra "tokens".
- Trechos de rodapé como "cancelar inscrição" são ignorados na regra de Candidatura, para que propagandas não sejam classificadas por engano.
- As listas ficam no começo do arquivo. Para ensinar algo novo ao script, basta acrescentar um termo à lista certa.

---

## Instalação

### Opção A: pelo navegador

1. Acesse [script.google.com](https://script.google.com) e clique em **Novo projeto**. (Se preferir, abra uma planilha e vá em **Extensões > Apps Script**.)
2. Apague o conteúdo do editor e cole o código de `resumo_emails_5w2h.gs`.
3. Clique em **Salvar**.
4. *(Só se for usar abas como Promoções ou Social)* No menu lateral, clique em **+** ao lado de **Serviços**, escolha **Gmail API** e clique em **Adicionar**. Deixe o identificador como `Gmail`.
5. No seletor ao lado do botão **Executar**, escolha uma função (veja a próxima seção) e clique em **Executar**.
6. Autorize o acesso quando o Google pedir. Se aparecer o aviso "app não verificado", clique em **Avançado > Acessar (nome do projeto)**. O script é seu e roda só na sua conta.

Se o projeto não estiver ligado a uma planilha, o script cria sozinho uma planilha chamada **Resumo de emails 5W2H** na primeira execução. O link aparece no **Registro de execução**.

### Opção B: com clasp

Quem usa [clasp](https://github.com/google/clasp) pode versionar o projeto. Para o serviço Gmail API, o `appsscript.json` precisa conter:

```json
{
  "timeZone": "America/Sao_Paulo",
  "runtimeVersion": "V8",
  "dependencies": {
    "enabledAdvancedServices": [
      { "userSymbol": "Gmail", "serviceId": "gmail", "version": "v1" }
    ]
  }
}
```

---

## Funções disponíveis

### Resumo

Todas escrevem na aba `EmailsResumo`. O período vai de 00:00 do dia de início até 00:00 de hoje, ou seja, **até o fim de ontem**.

| Função | Período |
|---|---|
| `resumirOntem` | Só ontem |
| `resumirUltimos2Dias` | De 2 dias atrás até ontem |
| `resumirUltimos3Dias` | De 3 dias atrás até ontem |
| `resumirUltimos7Dias` | De 7 dias atrás até ontem |
| `resumirUltimos30Dias` | De 30 dias atrás até ontem |
| `resumirUltimosNDias` | O número definido em `DIAS_ATRAS` |
| `resumirTodos` | Toda a caixa de entrada, sem filtro de data |
| `resumirEmailsDeOntem` | Igual a `resumirOntem` (mantida por compatibilidade com acionadores) |

### Exclusão (move para a lixeira)

| Função | O que faz |
|---|---|
| `simularExclusao` | Só lista o que seria excluído, usando `DIAS_EXCLUSAO` |
| `excluirEmails` | Move para a lixeira, usando `DIAS_EXCLUSAO` |
| `simularExclusaoUltimos30Dias` | Simulação com período fixo de 30 dias |
| `excluirEmailsUltimos30Dias` | Exclusão com período fixo de 30 dias |

**Recomendação:** rode sempre a simulação antes. O resultado aparece na aba `Excluídos`.

---

## Configuração

Estas constantes ficam no começo do arquivo e podem ser editadas:

| Constante | Padrão | Para que serve |
|---|---|---|
| `MAX_EMAILS` | `100` | Limite de emails por execução (o Apps Script interrompe execuções acima de ~6 minutos) |
| `DIAS_ATRAS` | `5` | Período usado por `resumirUltimosNDias` |
| `NOME_ABA` | `'EmailsResumo'` | Nome da aba de resultados |
| `DIAS_EXCLUSAO` | `7` | Período usado por `simularExclusao` e `excluirEmails` (`0` = todos os dias) |
| `TIPOS_PARA_EXCLUIR` | `['Mala direta', 'Segurança']` | Tipos que a exclusão vai atingir |
| `ROTULOS_POR_TIPO` | veja abaixo | Tipo → marcador ou aba do Gmail |
| `ARQUIVAR_APOS_ROTULAR` | `false` | `true` tira o email da Caixa de entrada depois de marcá-lo |
| `ROTULAR_NO_RESUMO` | `true` | `false` faz o resumo só resumir, sem mexer no Gmail |

### Marcadores e abas do Gmail

```js
const ROTULOS_POR_TIPO = {
  'Boleto': 'Recibos',
  'Candidatura': 'trabalho',
  'Curso': 'Social',
  'Mala direta': 'Promoções'
};
```

- Nomes comuns (como `Recibos`) viram **marcadores**. Se o marcador não existir, o script cria. A busca ignora maiúsculas e minúsculas.
- Os nomes `Principal`, `Promoções`, `Social`, `Atualizações` e `Fóruns` são tratados como **abas automáticas** do Gmail. Para elas, é preciso ativar o serviço **Gmail API**.
- O marcador vale para a **conversa inteira**, não só para a mensagem.
- O script **não remove** marcadores aplicados antes.

---

## Execução automática

Para o resumo rodar sozinho todo dia:

1. No Apps Script, abra o ícone de relógio (**Acionadores**).
2. Clique em **Adicionar acionador**.
3. Escolha a função `resumirOntem`, tipo **Baseado em tempo > Timer diário** e um horário.

Como os resumos também aplicam marcadores, a organização do Gmail passa a acontecer todo dia sem ação manual.

---

## Segurança e privacidade

- O código roda **na sua conta Google**. Nenhum conteúdo de email é enviado para serviços externos.
- Não há chaves de API nem senhas no código.
- A exclusão move emails para a **lixeira**, que o Gmail mantém por 30 dias. Nada é apagado de forma definitiva.
- Mensagens **com estrela** e mensagens **enviadas por você** nunca são excluídas.
- O histórico de exclusões fica na aba `Excluídos`.

**Permissões pedidas pelo Google:** ler e modificar o Gmail (para ler, marcar e mover para a lixeira), criar e editar planilhas e, se você ativar o serviço Gmail API, gerenciar categorias.

> **Antes de publicar uma cópia do código:** as listas de empresas, remetentes e instituições refletem os emails de quem escreveu as regras. Remova ou troque por exemplos genéricos qualquer item pessoal (nomes de empresas das quais você é cliente, endereços de email etc.).

---

## Limitações

- A classificação é feita por **palavras-chave**, não por interpretação do texto. Pode errar, principalmente com palavras comuns (como `processo` ou `fatura`).
- Cada execução trata no máximo `MAX_EMAILS` emails (e o Gmail entrega no máximo 500 conversas por busca). Para períodos grandes, aumente o limite aos poucos ou repita a execução. Na exclusão, repetir funciona bem, porque o que já foi para a lixeira deixa de aparecer na busca.
- Só é analisada a **Caixa de entrada**. Emails já arquivados não entram.
- Só são analisados os primeiros 3.000 caracteres do corpo de cada email.
- O Gmail pode reclassificar emails novos nas abas por conta própria.

---

## Estrutura do repositório

```
.
├── README.md
└── resumo_emails_5w2h.gs
```

## Contribuindo

Sugestões de novas palavras-chave, tipos e melhorias são bem-vindas. Abra uma *issue* descrevendo o caso (sem dados pessoais) ou envie um *pull request*.

## Licença

Escolha uma licença para o repositório (por exemplo, [MIT](https://choosealicense.com/licenses/mit/)) e adicione o arquivo `LICENSE`.

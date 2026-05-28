# SIGO-ATS · Estado do Projeto

Atualizado em: 05/05/2026

## 1. Enquadramento atual

O SIGO-ATS evoluiu de um registo simples para uma aplicação operacional de:

- gestão de turnos ATS
- registo de ocorrências ATS
- controlo de logs de posição operacional
- validação de registos antes do encerramento do turno
- consulta operacional do estado do turno em tempo real

Neste momento, a aplicação já suporta o fluxo-base de operação de turno com regras de permissão e dependência entre ações.

## 2. O que já está implementado

### 2.1. Autenticação e contexto operacional

- login funcional
- carregamento do perfil do utilizador
- ligação à unidade ATS do utilizador
- painel principal com estado operacional do turno

### 2.2. Gestão de turnos

- abertura de turno
- encerramento de turno
- regra de autoridade no encerramento
- composição da equipa definida no momento da abertura

### 2.3. Logs de posição operacional

- registo de entrada na posição
- registo de saída da posição
- consulta dos logs do turno
- apenas o supervisor pode gerir logs
- outros utilizadores podem consultar
- fecho do turno bloqueado se existir CTA ainda ativo na posição

### 2.4. Registo ATS

- criação de entradas ATS
- edição de entradas ATS
- visualização consolidada por turno
- validação do registo ATS
- após validação, a edição deixa de estar disponível

### 2.5. Regras de permissões já ativas

- só membros da composição do turno podem criar ocorrências ATS
- só o supervisor pode gerir logs operacionais
- se houver ocorrências ATS, a validação é obrigatória antes do fecho do turno
- se não houver ocorrências ATS, o turno pode ser encerrado sem validação
- encerrar turno já não faz logout automático

### 2.6. Painel principal

- estado operacional do turno
- composição do turno
- supervisor do turno
- estado atual das posições operacionais
- resumo de hoje
- controlo operacional
- sistema
- acessos rápidos
- lógica de “próxima ação” com dependência operacional

## 3. Lógica operacional atual

Fluxo principal já suportado:

1. abrir turno
2. definir composição da equipa
3. registar entradas na posição operacional
4. registar ocorrências ATS
5. registar saídas da posição operacional
6. validar registo ATS, se existirem ocorrências
7. encerrar turno

## 4. Pontos ainda em aberto

O sistema já está estável no fluxo principal, mas ainda faltam áreas importantes para o transformar numa aplicação completa de gestão operacional.

### 4.1. Relatórios

Falta definir:

- formato institucional dos relatórios
- relatórios operacionais vs relatórios executivos
- estrutura de impressão
- exportação consistente
- organização dos dados apresentados

### 4.2. Encaminhamento de ocorrências

Ainda não existe um módulo próprio para:

- encaminhar ocorrência para entidade/responsável
- registar quando, para quem e por que motivo foi encaminhada
- acompanhar histórico de encaminhamento
- saber se houve resposta ou não

### 4.3. Seguimento

Hoje existe apenas a marcação `requer seguimento`.

Ainda falta construir a lógica real de seguimento:

- criação de pedido de seguimento
- responsável pelo seguimento
- prazo
- estado
- resposta
- fecho do seguimento
- relação com a ocorrência original

### 4.4. Gestão de ocorrências

A aplicação ainda está mais forte no registo do que na gestão posterior.

Falta criar uma camada própria para:

- fila de ocorrências
- estado de tratamento
- prioridades
- responsáveis
- ocorrências abertas / em curso / concluídas
- histórico de ações tomadas

## 5. Próximo plano de trabalho

## Fase 1 · Consolidar a base operacional

Objetivo:
fechar coerência funcional da operação de turno antes de abrir novos módulos.

Itens:

- rever todos os textos ligados a validação, seguimento e controlo operacional
- garantir consistência temporal em todos os timestamps usados pela app
- rever os últimos pontos de UI/UX do painel principal
- confirmar comportamento dos logs de posição em cenários reais de operação

## Fase 2 · Módulo de relatórios

Objetivo:
transformar os dados operacionais em relatórios utilizáveis institucionalmente.

Itens:

- desenhar estrutura do relatório consolidado de turno
- desenhar relatório resumido/executivo
- definir campos obrigatórios e opcionais
- preparar exportação e impressão
- uniformizar cabeçalhos, assinaturas e blocos finais

## Fase 3 · Encaminhamento de ocorrências

Objetivo:
permitir que uma ocorrência passe do registo para o fluxo de tratamento.

Itens:

- definir modelo de encaminhamento
- definir destinatários possíveis
- definir estados do encaminhamento
- criar histórico de encaminhamentos
- ligar encaminhamento ao detalhe da ocorrência

## Fase 4 · Módulo de seguimento

Objetivo:
dar vida operacional real ao conceito de “seguimento”.

Itens:

- modelar o que é um pedido de seguimento
- definir quem cria
- definir quem recebe
- definir prazo e prioridade
- definir estados do seguimento
- mostrar seguimentos pendentes no painel e nos relatórios

## Fase 5 · Área de gestão de ocorrências

Objetivo:
criar uma segunda camada da app focada em tratamento e acompanhamento, e não apenas registo.

Itens:

- nova área de “Gestão de ocorrências”
- listagem por estado
- filtros e pesquisa
- responsáveis
- linha temporal / histórico
- fecho administrativo ou operacional

## 6. Ordem recomendada de execução

1. fechar pequenos ajustes de consistência no fluxo atual
2. desenhar e implementar relatórios
3. desenhar e implementar encaminhamento
4. desenhar e implementar seguimento
5. criar área de gestão de ocorrências

## 7. Próxima sessão recomendada

Na próxima ronda, o melhor ponto de partida é:

### Desenhar o módulo de relatórios

Decisões a tomar:

- que tipos de relatório vão existir
- quem os pode gerar
- que estrutura devem ter
- que informação deve vir do turno
- que informação deve vir das ocorrências
- que informação deve vir dos logs de posição

## 8. Próximas etapas alinhadas

### 8.1. Relatórios

Primeira prioridade funcional:

- desenhar o `Relatório consolidado de turno`
- desenhar o `Relatório executivo de turno`
- desenhar a `Ficha individual de ocorrência`

Estrutura mínima já alinhada:

- cabeçalho institucional
- identificação do turno
- composição da equipa
- logs de posição operacional
- lista de ocorrências ATS
- validação do registo
- notas finais / passagem de serviço

Decisão de produto já assumida:

- o sistema terá relatórios operacionais e relatórios executivos
- a app deve suportar visualização, impressão e exportação

### 8.2. Encaminhamento

Segunda prioridade funcional:

- criar uma lógica própria de encaminhamento de ocorrência
- definir para quem uma ocorrência pode ser encaminhada
- registar data, motivo e destinatário do encaminhamento
- manter histórico de encaminhamento por ocorrência

### 8.3. Seguimento

Terceira prioridade funcional:

- transformar `requer seguimento` num fluxo real de gestão
- definir:
  - responsável
  - prazo
  - prioridade
  - estado
  - resposta
  - fecho do seguimento

Objetivo:

- deixar de tratar o seguimento como simples marcador
- passar a tratá-lo como objeto operacional com ciclo de vida próprio

### 8.4. Gestão de ocorrências

Quarta prioridade funcional:

- criar uma nova área da app dedicada à gestão posterior da ocorrência
- permitir acompanhar:
  - estado da ocorrência
  - tratamento
  - responsável
  - histórico
  - decisão final

Objetivo:

- evoluir o SIGO-ATS de registo operacional para plataforma de registo e gestão de ocorrências

## 9. Ordem prática recomendada

1. consolidar UI e pequenos ajustes do fluxo atual
2. desenhar e implementar `Relatório consolidado de turno`
3. desenhar e implementar `Relatório executivo de turno`
4. desenhar a lógica de encaminhamento
5. desenhar a lógica completa de seguimento
6. criar a nova área de gestão de ocorrências

---

Este ficheiro deve ser mantido como referência viva do estado do SIGO-ATS e atualizado a cada avanço estrutural relevante.

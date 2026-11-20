# SIGO-ATS: validação e fecho concorrentes

- A operação mantém os mesmos endpoints e permissões RLS. Só o utilizador que abriu o turno, no mesmo órgão ATS, pode validar ou fechar. Validação exige pelo menos uma ocorrência e nenhuma posição ativa. Fecho exige nenhuma posição ativa; havendo ocorrências, exige validação anterior.
- A validação congela a criação, edição e remoção de ocorrências. Mantém-se a possibilidade de registar posições enquanto o turno ainda estiver aberto, mesmo após a validação ATS. Fechar impede novos registos. A migração não modifica nem substitui o índice de posições ativas existente.
- As escritas normais e as transições serializam-se na linha do turno. A proteção assume READ COMMITTED; escritas protegidas com outros isolamentos devolvem erro sem gravar. O servidor atribui as horas de validação/fecho. A aplicação só confirma se a linha e o novo estado forem devolvidos.
- Os gatilhos privados precisam de ver todas as linhas (inclusive quando RLS as esconde da aplicação). Não são RPCs, não concedem novas permissões e usam nomes qualificados e row_security=off. Os únicos caminhos especiais são limpeza por DELETE com o service_role existente, cascata da chave externa de um turno apagado e a limpeza de referências FK SET NULL após a eliminação efetiva do perfil.
- O guard de INSERT só impede criar artificialmente estados futuros já validados/fechados; não mexe na gravação da equipa nem limita a quantidade de turnos abertos.

## Antes de uma publicação autorizada

1. Confirmar o projeto certo e executar `supabase/preflight-shift-lifecycle.sql` apenas com acesso existente de leitura ao catálogo. Rever colunas e tipos, os dois estados, triggers e sua ordem, chaves externas (incluindo ações de DELETE), grants/RLS, visibilidade lateral, presença do índice único e índices para os filtros shift_id. Verificar que o PostgREST usa a role efetiva `authenticated` ou `service_role` conforme esperado e READ COMMITTED; o catálogo de sessão por si só não verifica a role de um pedido HTTP.
2. Reproduzir políticas, tipos, índices e triggers efetivos numa base descartável sem registos operacionais. O dono dos gatilhos precisa de conseguir ler/serializar estas tabelas por inteiro: confirmar propriedade ou BYPASSRLS; prever erro seguro se faltar. Não instalar se houver trigger que reescreva estado, autor ou horários depois do guard, diferenças nas regras de manutenção autorizadas ou alteração de esquema não testada. Verificar se um trigger automático altera updated_at durante ações FK; essa diferença deve ser tratada antes de instalar. A migração não toca em grants, RLS, dados ou índices já existentes.
3. Repetir a verificação PostgreSQL e exercícios PostgREST/browsers sintéticos no ambiente isolado, incluindo sessão antiga aberta antes do deploy. Após autorização separada da alteração à base, aplicar `supabase/guard-shift-lifecycle.sql` em janela de baixo tráfego antes da publicação da app conjunta. O limite curto de lock aborta em caso de contenção; não repetir cegamente. Conferir os quatro gatilhos e a ausência de privilégios para executar as funções privadas.
4. Se for necessário reverter, repor primeiro o deploy anterior, depois avaliar `supabase/rollback-shift-lifecycle.sql` com autorização operacional. Remove só os quatro gatilhos, as três funções e o esquema privado; não altera dados históricos nem o índice de duplicados. Não suprime o risco anterior após remover os guards.

## QA descartável

Usar uma instância PostgreSQL nova (não um schema de uma base compartilhada). Configurar PGHOST, PGPORT, PGUSER e PGDATABASE para essa instância e, desde a raiz do projeto, executar:

```sh
psql -X -v ON_ERROR_STOP=1 -f tests/sql/shift-lifecycle-fixture.sql -f supabase/guard-shift-lifecycle.sql
node tests/shift-lifecycle-concurrency.mjs
psql -X -v ON_ERROR_STOP=1 -f supabase/rollback-shift-lifecycle.sql
```

A suíte utiliza dois processos psql com PIDs diferentes e um terceiro que comprova a espera por lock. Deliberadamente esconde ocorrências/posições entre utilizadores com RLS de teste. Não testa a configuração efetiva, o PostgREST real nem o navegador autenticado.

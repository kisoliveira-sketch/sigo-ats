# Criação em lote de utilizadores Auth no Supabase

## Objetivo

Criar ou atualizar utilizadores do `Supabase Authentication` em lote, usando a mesma password inicial.

## Script

Usar:

- [/Users/kisoroliveira/Desktop/siro-ats/scripts/create-supabase-auth-users.mjs](/Users/kisoroliveira/Desktop/siro-ats/scripts/create-supabase-auth-users.mjs)

## Password inicial

Por omissão, o script usa:

- `asa12345`

Pode ser alterada via variável:

- `DEFAULT_USER_PASSWORD`

## Variáveis necessárias

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Alternativamente, o script também aceita:

- `NEXT_PUBLIC_SUPABASE_URL`

## Execução

Exemplo:

```bash
SUPABASE_URL="https://dtqajfxkhfarwqzuuepn.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="..." \
DEFAULT_USER_PASSWORD="asa12345" \
npm run create:auth-users
```

## O que o script faz

- procura utilizadores Auth já existentes por email
- se existirem:
  - atualiza a password
  - confirma o email
  - atualiza `user_metadata.full_name`
- se não existirem:
  - cria o utilizador
  - define a password
  - confirma o email
  - grava o nome completo em `user_metadata`

## Depois do script

Depois de criar os utilizadores Auth, correr os SQLs de ambiente para preencher `profiles`:

- [/Users/kisoroliveira/Desktop/siro-ats/supabase/create-acc-sal-environment.sql](/Users/kisoroliveira/Desktop/siro-ats/supabase/create-acc-sal-environment.sql)
- [/Users/kisoroliveira/Desktop/siro-ats/supabase/create-twr-aipnm-environment.sql](/Users/kisoroliveira/Desktop/siro-ats/supabase/create-twr-aipnm-environment.sql)
- [/Users/kisoroliveira/Desktop/siro-ats/supabase/create-twr-sal-environment.sql](/Users/kisoroliveira/Desktop/siro-ats/supabase/create-twr-sal-environment.sql)
- [/Users/kisoroliveira/Desktop/siro-ats/supabase/create-twr-bvc-environment.sql](/Users/kisoroliveira/Desktop/siro-ats/supabase/create-twr-bvc-environment.sql)

Para uniformizar nomes já existentes segundo o AIP, correr também:

- [/Users/kisoroliveira/Desktop/siro-ats/supabase/normalize-ats-unit-names.sql](/Users/kisoroliveira/Desktop/siro-ats/supabase/normalize-ats-unit-names.sql)

Se quiseres uniformizar também o código legado da unidade AICE:

- [/Users/kisoroliveira/Desktop/siro-ats/supabase/rename-aice-unit-code.sql](/Users/kisoroliveira/Desktop/siro-ats/supabase/rename-aice-unit-code.sql)

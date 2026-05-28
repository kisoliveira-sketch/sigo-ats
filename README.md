# SIRO-ATS

Aplicação web para:

- gestão de turnos ATS
- registo de ocorrências ATS
- controlo de logs de posição operacional
- validação e encerramento de turno

## Arrancar o projeto

Na pasta do projeto:

```bash
npm run dev
```

Depois abrir no browser:

- [http://localhost:3000](http://localhost:3000)

## Arrancar com Codex

Se estiveres a trabalhar com o Codex, o procedimento recomendado é:

1. abrir o projeto no Codex
2. pedir:

```text
run dev
```

3. confirmar no browser interno ou externo:

- [http://localhost:3000](http://localhost:3000)

Se o browser ficar em branco ou a porta estiver presa, pedir ao Codex para:

- confirmar em que porta a app está a correr
- matar o processo antigo
- relançar o `npm run dev`

Exemplos de pedidos úteis ao Codex:

```text
run dev
```

```text
confirm what port the app is running on
```

```text
kill the stuck process and restart the app
```

## Se a porta 3000 estiver ocupada

Ver qual processo está a usar a porta:

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
```

Parar o processo:

```bash
kill <PID>
```

Se não parar:

```bash
kill -9 <PID>
```

Depois voltar a arrancar:

```bash
npm run dev
```

## Reiniciar o projeto

Se a app ficar presa, em branco, ou com comportamento estranho:

1. parar o processo atual
2. arrancar de novo com:

```bash
npm run dev
```

## Fechar o projeto

Se o servidor estiver a correr no terminal atual:

- carregar `Ctrl + C`

Se o processo tiver ficado em background:

1. encontrar o PID:

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
```

2. parar o processo:

```bash
kill <PID>
```

## Fechar com Codex

Se estiveres a trabalhar no Codex, podes pedir diretamente:

```text
stop the app
```

ou:

```text
kill the process on port 3000
```

e depois, quando precisares novamente:

```text
run dev
```

## Nota prática

O ideal é manter só uma instância do `Next.js` a correr.

Se existirem várias instâncias ao mesmo tempo:

- a porta `3000` pode ficar presa
- a app pode subir noutra porta
- o browser pode deixar de responder corretamente

## Comando principal

O comando normal de trabalho é sempre:

```bash
npm run dev
```

# J.A.R.V.I.S

Assistente pessoal local com interface cyberpunk para organizar tarefas, treinos, estudos, anotações e finanças.

## Requisitos

- Node.js 18 ou superior

## Executar

```bash
npm start
```

Abra http://localhost:3000 no navegador. O servidor escuta apenas em `127.0.0.1`.

## Armazenamento

Os registros são gravados em `data.json` na máquina local. A configuração do assistente, incluindo a chave da API Gemini, fica em `config.json`; também é possível fornecer a chave pela variável de ambiente `GEMINI_API_KEY`. Esses arquivos são locais e não devem ser enviados ao GitHub.

Sem o servidor, a interface mantém uma cópia dos dados no armazenamento local do navegador.
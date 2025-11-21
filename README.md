## Build nativo (Windows)

Pré-requisitos:
- Visual Studio Build Tools 2022 (Desktop C++)
- MSVC v143
- Windows 10/11 SDK
- Python 3 disponível no PATH

Comandos usuais:
- `pnpm install`
- `pnpm rebuild:sqlite`
- `pnpm dev:desktop`

Observação (pnpm v10):
- Se `electron` estiver com “build scripts ignorados”, o script `postinstall:electron` executa automaticamente o `install.js` para baixar o binário do Electron.
- Também mantemos `enable-pre-post-scripts=true` no `.npmrc` para garantir execução de pre/post scripts.

Notas:
- O rebuild do `better-sqlite3` é realizado via `electron-rebuild` com as variáveis de ambiente apropriadas.
- Nenhuma alteração de UI é realizada neste processo.


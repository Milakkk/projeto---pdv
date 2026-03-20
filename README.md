# projeto-pdv

Point-of-sale system (PDV/KDS) built with TypeScript, React, Electron and Supabase — deployed on Vercel.

**Live:** https://ia-sdr.vercel.app

## Stack

- **Frontend:** React + TypeScript (Vite)
- - **Desktop:** Electron (offline-capable KDS)
  - - **Database:** Supabase (PostgreSQL + real-time sync)
    - - **Deploy:** Vercel (164+ deployments in production)
      - - **Monorepo:** `apps/`, `packages/`, `electron/`, `supabase/`
       
        - ## Features
       
        - - PDV (Point of Sale) with product and sales management
          - - KDS (Kitchen Display System) with virtual keyboard support
            - - Offline-first Electron app with LAN sync
              - - Supabase real-time sync between PDV and KDS
                - - Cash register open/close with reports
                  - - JWT authentication (user/admin roles)
                    - - Vercel CI/CD with preview and production environments
                     
                      - ## Project Structure
                     
                      - ```
                        apps/          # React apps (PDV, KDS)
                        electron/      # Electron desktop wrapper
                        packages/      # Shared packages
                        supabase/      # Database migrations and config
                        src/           # Core source
                        scripts/       # Utility scripts
                        types/         # Shared TypeScript types
                        ```

                        ## Running locally

                        ```bash
                        npm install
                        npm run dev
                        ```

                        Requires a Supabase project configured in `.env`. See `.env.example` for reference.

                        ## Status

                        Active — in development. Production deployed at https://ia-sdr.vercel.app

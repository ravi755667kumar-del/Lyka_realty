<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/74128896-e998-447b-be4e-e28a1af623eb

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Run with Docker

**Prerequisites:** Docker with the Compose plugin.

From the `PROJECT` directory:

1. Create the environment file:
   ```sh
   cp -n .env.example .env
   ```
2. Edit `.env` and add the credentials for the services you use. For Supabase, set
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. To run without
   Supabase, set `NEXT_PUBLIC_SUPABASE_ENABLED=false`.
3. Build the production image and start the app:
   ```sh
   docker compose up --build -d
   ```
4. Open [http://localhost:3001](http://localhost:3001).

Useful commands:

```sh
docker compose logs -f     # Follow application logs
docker compose ps          # Check container status
docker compose down        # Stop and remove the container
```

The app listens on port `3001`. Rebuild with `docker compose up --build -d`
after changing source files or `NEXT_PUBLIC_` settings; those settings are used
when Next.js builds the client bundle.

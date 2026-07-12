import { defineConfig, loadEnv, type Plugin } from "vite";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const VITE_ALLOWED_HOSTS = env.VITE_ALLOWED_HOSTS
    ? env.VITE_ALLOWED_HOSTS.split(",").map((host) => host.trim())
    : ["localhost"];
  const PROJECT_ID = env.VITE_FIREBASE_PROJECT_ID ?? "greenearth-471522";
  const FUNCTIONS_BASE = `http://127.0.0.1:5001/${PROJECT_ID}/us-central1`;

  const functionProxy = (functionName: string) => ({
    target: "http://127.0.0.1:5001",
    changeOrigin: true,
    rewrite: () => `/${PROJECT_ID}/us-central1/${functionName}`,
  });

  const callbackMiddleware = (): Plugin => ({
    name: "oauth-callback-proxy",
    configureServer(server) {
      server.middlewares.use("/oauth/callback", async (req, res) => {
        try {
          const targetUrl = `${FUNCTIONS_BASE}/oauthCallback${req.url!.replace(/^\/oauth\/callback/, "")}`;
          const response = await fetch(targetUrl);
          res.statusCode = response.status;
          const location = response.headers.get("location");
          if (location) {
            res.setHeader("Location", location);
            res.end();
            return;
          }
          const body = await response.text();
          const contentType = response.headers.get("content-type");
          if (contentType) res.setHeader("Content-Type", contentType);
          res.end(body);
        } catch (err) {
          res.statusCode = 502;
          res.end("Failed to reach Functions emulator on port 5001");
        }
      });
    },
  });

  return {
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    build: {
      target: "es2020",
      outDir: "dist",
    },
    plugins: [callbackMiddleware()],
    server: {
      port: 3000,
      allowedHosts: VITE_ALLOWED_HOSTS,
      proxy: {
        "/.well-known/oauth-client-metadata": functionProxy("oauthClientMetadata"),
        "/.well-known/jwks.json": functionProxy("oauthJwks"),
        "/auth/bluesky": functionProxy("authBluesky"),
      },
    },
  };
});

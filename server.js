// Servidor local do Jarvis (sem dependências, precisa de Node 18+).
// Uso:  node server.js   ->  http://localhost:3000
//
//  /api/data    GET/PUT   dados do app            -> data.json
//  /api/config  GET/POST  chave e modelo Gemini   -> config.json
//  /api/chat    POST      repassa ao Gemini usando a chave guardada aqui
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data.json");
const CONFIG_FILE = path.join(__dirname, "config.json");
const STATIC = {
  "/index.html": "text/html; charset=utf-8",
  "/style.css": "text/css; charset=utf-8",
  "/app.js": "text/javascript; charset=utf-8",
};

const readJSON = (file, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
};
// grava em arquivo temporário e renomeia: evita corromper o data.json se algo falhar no meio
const writeJSON = (file, obj) => {
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, file);
};
const readBody = (req, limit = 5e6) =>
  new Promise((resolve, reject) => {
    let b = "";
    req.on("data", (c) => {
      b += c;
      if (b.length > limit) {
        reject(new Error("corpo grande demais"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(b));
    req.on("error", reject);
  });
const send = (res, code, obj) => {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(typeof obj === "string" ? obj : JSON.stringify(obj));
};
const getConfig = () => {
  const c = readJSON(CONFIG_FILE, {});
  return {
    key: c.key || process.env.GEMINI_API_KEY || "",
    model: c.model || "gemini-2.5-flash",
  };
};
const publicConfig = () => {
  const c = getConfig();
  return { hasKey: !!c.key, model: c.model };
};

http
  .createServer(async (req, res) => {
    const url = req.url.split("?")[0];
    try {
      if (url === "/api/data") {
        if (req.method === "GET") return send(res, 200, readJSON(DATA_FILE, {}));
        if (req.method === "PUT") {
          writeJSON(DATA_FILE, JSON.parse(await readBody(req)));
          return send(res, 200, { ok: true });
        }
      }

      if (url === "/api/config") {
        if (req.method === "GET") return send(res, 200, publicConfig());
        if (req.method === "POST") {
          const b = JSON.parse(await readBody(req));
          const cur = readJSON(CONFIG_FILE, {});
          if (typeof b.key === "string" && b.key.trim()) cur.key = b.key.trim();
          if (typeof b.model === "string" && b.model.trim()) cur.model = b.model.trim();
          writeJSON(CONFIG_FILE, cur);
          return send(res, 200, publicConfig());
        }
      }

      if (url === "/api/chat" && req.method === "POST") {
        const { key, model } = getConfig();
        if (!key) return send(res, 400, { error: { message: "Chave do Gemini não configurada." } });
        const r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": key },
            body: await readBody(req),
          },
        );
        return send(res, r.status, await r.text());
      }

      const file = url === "/" ? "/index.html" : url;
      if (STATIC[file]) {
        res.writeHead(200, { "Content-Type": STATIC[file] });
        return fs.createReadStream(path.join(__dirname, file)).pipe(res);
      }
      res.writeHead(404);
      res.end("Not found");
    } catch (e) {
      send(res, 500, { error: { message: e.message } });
    }
  })
  // 127.0.0.1: só este computador acessa (a chave do Gemini fica protegida)
  .listen(PORT, "127.0.0.1", () => console.log(`Jarvis rodando em http://localhost:${PORT}`));

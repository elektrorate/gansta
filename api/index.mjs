import handler from "../server/handler.mjs";

export function createVercelHandler(apiHandler = handler) {
  return async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      const routes = url.searchParams.getAll("__route");
      if (routes.length > 1) throw new Error();
      let route;
      if (routes.length) {
        // URLSearchParams decodes once; remaining escapes are rejected below.
        route = routes[0];
        const original = req.url.split('?')[0];
        if (original !== '/api/index' && original !== '/api/index.mjs') {
          const expected = original === '/health' ? 'health' : original.startsWith('/api/') ? decodeURIComponent(original.slice(5)) : null;
          if (expected !== route) throw new Error();
        }
      } else {
        const pathname = req.url.split("?")[0];
        if (pathname === "/health") route = "health";
        else if (pathname === "/" || pathname === "/api" || pathname === "/api/") route = "";
        else if (pathname.startsWith("/api/")) route = decodeURIComponent(pathname.slice(5));
        else throw new Error();
      }
      if (route && !/^[\w-]+(?:\/[\w-]+)*$/.test(route)) throw new Error();
      req.url = route === "health" ? "/api/health" : "/api/" + (route || "index");
    } catch {
      res.writeHead(400, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(JSON.stringify({ error: "Ruta no valida." }));
      return;
    }
    return apiHandler(req, res);
  };
}

export default createVercelHandler();

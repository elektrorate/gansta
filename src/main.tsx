import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { canView } from "../shared/domain";
import { Provider, useStore } from "./store";
import { Login, AccessGate } from "./Auth";
import { Dashboard } from "./Dashboard";
import { Offering } from "./Offering";
import { Planning } from "./Planning";
import { OfferingForm } from "./OfferingForm";
import { Admin, Results, Users } from "./Admin";
import { Back, Empty, Header, go } from "./ui";
import "./styles.css";
import "./chart.css";
function App() {
  const s = useStore();
  const [path, setPath] = useState(location.hash.slice(1) || "/");
  useEffect(() => {
    const handler = () => {
      setPath(location.hash.slice(1) || "/");
      window.scrollTo(0, 0);
    };
    addEventListener("hashchange", handler);
    return () => removeEventListener("hashchange", handler);
  }, []);
  const [section, id] = path.split("/").filter(Boolean),
    o = s.bundle.offerings.find((o) => o.id === id);
  let page: React.ReactNode;
  if (s.loading && !s.profile)
    page = (
      <div className="loading" role="status">
        Preparando tu espacio…
      </div>
    );
  else if (!s.demo && !s.identity) page = <Login />;
  else if (
    !s.profile ||
    s.profile.status !== "active" ||
    (!s.demo && !s.identity?.emailVerified)
  )
    page = <AccessGate />;
  else if (s.error)
    page = (
      <>
        <Header title="No se han podido cargar los datos" />
        <p role="alert" className="error">
          {s.error}
        </p>
        <button className="primary" onClick={() => void s.refresh()}>
          Reintentar
        </button>
      </>
    );
  else if (!section) page = <Dashboard />;
  else if (section === "account")
    page = (
      <>
        <Back />
        <Header title={s.profile.name} description={s.profile.email} />
        <section className="surface">
          <h2>
            {s.profile.role === "admin" ? "Administrador" : "Colaborador"}
          </h2>
          {s.demo ? (
            <label className="field">
              Probar otro rol
              <select
                value={s.profile.id}
                onChange={(e) => s.switchDemo(e.target.value)}
              >
                {s.bundle.profiles
                  .filter((p) => p.status === "active")
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.role === "admin" ? "Admin" : "Colaborador"}
                    </option>
                  ))}
              </select>
            </label>
          ) : null}
          <button
            className="secondary full"
            onClick={() => void s.logout().catch(() => {})}
          >
            {s.demo ? "Salir de la demostración" : "Cerrar sesión"}
          </button>
        </section>
      </>
    );
  else if (
    ["admin", "users", "results", "new", "edit"].includes(section) &&
    s.profile.role !== "admin"
  )
    page = (
      <>
        <Back />
        <Empty>Esta sección está reservada a administradores.</Empty>
      </>
    );
  else if (section === "admin") page = <Admin />;
  else if (section === "users") page = <Users />;
  else if (section === "results") page = <Results />;
  else if (section === "new") page = <OfferingForm key="new" />;
  else if (o && canView(s.profile, o)) {
    page =
      section === "offering" ? (
        <Offering key={id} offering={o} />
      ) : section === "edit" ? (
        <OfferingForm key={id} existing={o} />
      ) : section === "planning" ? (
        <Planning key={id} offering={o} />
      ) : (
        <Empty>Página no encontrada.</Empty>
      );
  } else
    page = (
      <>
        <Back />
        <Empty>
          {s.loading
            ? "Cargando offering…"
            : "No se encontró el offering o no tienes acceso."}
        </Empty>
      </>
    );
  const authorized =
    s.profile?.status === "active" && (s.demo || s.identity?.emailVerified);
  return (
    <div className="app-shell">
      {s.demo ? (
        <div className="demo-banner">Demostración local · datos de ejemplo</div>
      ) : null}
      <main>{page}</main>
      {authorized ? (
        <nav className="bottom-nav" aria-label="Navegación principal">
          <button
            aria-current={!section ? "page" : undefined}
            onClick={() => go("/")}
          >
            <span aria-hidden="true">▦</span>Dashboard
          </button>
          {s.profile?.role === "admin" ? (
            <button
              aria-current={
                ["admin", "users", "results", "new", "edit"].includes(section)
                  ? "page"
                  : undefined
              }
              onClick={() => go("/admin")}
            >
              <span aria-hidden="true">⊞</span>Administración
            </button>
          ) : null}
          <button
            aria-current={section === "account" ? "page" : undefined}
            onClick={() => go("/account")}
          >
            <span aria-hidden="true">○</span>Mi cuenta
          </button>
        </nav>
      ) : null}
    </div>
  );
}
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="app-shell">
        <main>
          <Header
            title="Algo no salió bien"
            description="Tus datos guardados no se han borrado."
          />
          <button className="primary" onClick={() => location.reload()}>
            Recargar
          </button>
        </main>
      </div>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Provider>
        <App />
      </Provider>
    </ErrorBoundary>
  </React.StrictMode>,
);

import React from "react";
import "./styles.css";

function EnvRow({ label, value }) {
  return (
    <div className="envRow">
      <div className="envLabel">{label}</div>
      <div className="envValue">{value || <span className="muted">(not set)</span>}</div>
    </div>
  );
}

export default function App() {
  const env = {
    REACT_APP_PORT: process.env.REACT_APP_PORT,
    REACT_APP_FRONTEND_URL: process.env.REACT_APP_FRONTEND_URL,
    REACT_APP_BACKEND_URL: process.env.REACT_APP_BACKEND_URL,
    REACT_APP_API_BASE: process.env.REACT_APP_API_BASE,
    REACT_APP_WS_URL: process.env.REACT_APP_WS_URL
  };

  return (
    <div className="page">
      <header className="header">
        <div>
          <h1 className="title">Quality Defect Tracker</h1>
          <p className="subtitle">Frontend container is installed and running successfully.</p>
        </div>
        <span className="pill">Port 3000</span>
      </header>

      <main className="grid">
        <section className="card">
          <h2 className="cardTitle">Status</h2>
          <p className="cardBody">
            This is a minimal scaffold to fix the container startup/build pipeline. The full
            hackathon UI can be built on top of this foundation.
          </p>
        </section>

        <section className="card">
          <h2 className="cardTitle">Environment (from .env)</h2>
          <div className="env">
            {Object.entries(env).map(([k, v]) => (
              <EnvRow key={k} label={k} value={v} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

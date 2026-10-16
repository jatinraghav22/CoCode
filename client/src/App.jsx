
import { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [serverStatus, setServerStatus] = useState("Checking server...");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("http://localhost:5000/api/health")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Server returned an error");
        }

        return response.json();
      })
      .then((data) => {
        setServerStatus(data.status);
      })
      .catch(() => {
        setError("Cannot connect to the backend.");
        setServerStatus("offline");
      });
  }, []);

  return (
    <main className="app">
      <section className="card">
        <h1>CoCode</h1>
        <p className="subtitle">
          Real-Time Collaborative Coding Platform
        </p>

        <div className="status">
          <span
            className={`indicator ${serverStatus === "healthy" ? "online" : ""
              }`}
          />

          <span>
            Backend: {serverStatus}
          </span>
        </div>

        {error && <p className="error">{error}</p>}

        <p className="description">
          Your collaborative coding workspace starts here.
        </p>
      </section>
    </main>
  );
}

export default App;

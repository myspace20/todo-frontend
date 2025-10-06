import { useEffect, useState } from "react";
import { Amplify } from "aws-amplify";
import awsconfig from "./aws-exports";
import { fetchAuthSession } from "aws-amplify/auth";
import { withAuthenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";

Amplify.configure(awsconfig);

const API_URL =
  "https://7x7l9qzd45.execute-api.eu-central-1.amazonaws.com/prod";

async function getIdToken() {
  const session = await fetchAuthSession();
  const idToken = session?.tokens?.idToken;

  if (!idToken) {
    throw new Error("No id token available. Make sure the user is signed in.");
  }

  return typeof idToken === "string" ? idToken : idToken.toString();
}

async function apiCall(path, method = "GET", body = null) {
  const token = await getIdToken();
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : null,
  });
  if (!res.ok) {
    let errText = `${res.status} ${res.statusText}`;
    try {
      const json = await res.json();
      errText = JSON.stringify(json);
    } catch (e) {}
    const err = new Error("API error");
    err.status = res.status;
    err.body = errText;
    throw err;
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function emptyTask() {
  return {
    taskId: null,
    title: "",
    description: "",
    status: "Pending",
    deadline: "",
  };
}

// Format backend timestamp for datetime-local input
function formatDateForInput(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
}

// Parse datetime-local input to ISO string
function parseDateForAPI(localDate) {
  if (!localDate) return null;
  const date = new Date(localDate);
  if (isNaN(date.getTime())) return null;
  return date.toISOString();
}

function App({ signOut }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyTask());
  const [filter, setFilter] = useState("Pending");
  const [error, setError] = useState(null);

  async function loadTasks() {
    setLoading(true);
    setError(null);
    try {
      const items = await apiCall("/tasks", "GET");
      const normalizedItems = Array.isArray(items)
        ? items.map((item) => ({
            ...item,
            deadline: item.deadline ? new Date(item.deadline).toISOString() : null,
          }))
        : [];
      setTasks(normalizedItems);
    } catch (err) {
      setError(err.body ?? err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTasks();
  }, []);

  async function createTask(e) {
    e?.preventDefault();
    setError(null);
    try {
      const payload = {
        title: form.title,
        description: form.description || "",
        deadline: parseDateForAPI(form.deadline) || null,
      };
      await apiCall("/tasks", "POST", payload);
      setForm(emptyTask());
      await loadTasks();
    } catch (err) {
      setError(err.body ?? err.message);
    }
  }

  async function updateTask(taskId, patch) {
    setError(null);
    try {
      const body = {
        taskId,
        title: patch.title,
        description: patch.description || "",
        deadline: parseDateForAPI(patch.deadline) || null,
        status: patch.status || "Pending",
      };
      await apiCall(`/tasks/${taskId}`, "PUT", body);
      setEditing(null);
      setForm(emptyTask());
      await loadTasks();
    } catch (err) {
      setError(err.body ?? err.message);
    }
  }

  async function removeTask(taskId) {
    setError(null);
    try {
      await apiCall(`/tasks/${taskId}`, "DELETE");
      await loadTasks();
    } catch (err) {
      setError(err.body ?? err.message);
    }
  }

  const visibleTasks =
    filter === "All"
      ? tasks
      : tasks.filter((t) => (t.status || "Pending") === filter);

  return (
    <div style={styles.container}>
      <h1>Todo App</h1>

      <div style={styles.row}>
        <div>
          <strong>Filter:</strong>{" "}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={styles.select}
          >
            <option value="Pending">Pending</option>
            <option value="Completed">Completed</option>
            <option value="Expired">Expired</option>
            <option value="All">All</option>
          </select>
          <button onClick={loadTasks} style={styles.button}>
            Refresh
          </button>
        </div>

        <div>
          <button onClick={() => signOut()} style={styles.button}>
            Sign out
          </button>
        </div>
      </div>

      <section style={styles.card}>
        <h3>{editing ? "Edit Task" : "Create Task"}</h3>
        <form
          onSubmit={
            editing
              ? (e) => {
                  e.preventDefault();
                  updateTask(editing, form);
                }
              : createTask
          }
          style={styles.form}
        >
          <input
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
            style={styles.input}
          />
          <input
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            style={styles.input}
          />
          <input
            type="datetime-local"
            value={form.deadline}
            onChange={(e) => setForm({ ...form, deadline: e.target.value })}
            style={styles.input}
          />
          <div>
            <button type="submit" style={styles.button}>
              {editing ? "Update" : "Create"}
            </button>
            {editing && (
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setForm(emptyTask());
                }}
                style={styles.buttonSecondary}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      <section style={styles.card}>
        <h3>
          Tasks {loading ? "(loading...)" : `(${visibleTasks.length})`}
        </h3>
        {error && (
          <div style={styles.error}>
            <strong>Error:</strong> {String(error)}
          </div>
        )}
        {visibleTasks.length === 0 && !loading ? (
          <div>No tasks to show.</div>
        ) : (
          <ul style={styles.list}>
            {visibleTasks.map((t) => (
              <li key={t.taskId} style={styles.listItem}>
                <div style={{ flex: 1 }}>
                  <div style={styles.titleRow}>
                    <strong>{t.title || "(No Title)"}</strong>
                    <span style={styles.small}>
                      &nbsp;•&nbsp; {t.status ?? "Pending"}
                    </span>
                  </div>
                  {t.description && (
                    <div style={styles.desc}>{t.description}</div>
                  )}
                  {t.deadline && (
                    <div style={styles.small}>
                      Deadline: {new Date(t.deadline).toLocaleString()}
                    </div>
                  )}
                </div>

                <div style={styles.controls}>
                  <button
                    onClick={() =>
                      updateTask(t.taskId, {
                        ...t,
                        status: t.status === "Completed" ? "Pending" : "Completed",
                      })
                    }
                    style={styles.buttonSmall}
                  >
                    {t.status === "Completed" ? "Uncomplete" : "Complete"}
                  </button>

                  <button
                    onClick={() => {
                      setEditing(t.taskId);
                      setForm({
                        taskId: t.taskId,
                        title: t.title || "",
                        description: t.description || "",
                        status: t.status || "Pending",
                        deadline: t.deadline ? formatDateForInput(t.deadline) : "",
                      });
                      window.scrollTo(0, 0);
                    }}
                    style={styles.buttonSmall}
                  >
                    Edit
                  </button>

                  <button
                    onClick={() => {
                      if (
                        window.confirm(
                          "Delete task? This cannot be undone (frontend prompt)"
                        )
                      ) {
                        removeTask(t.taskId);
                      }
                    }}
                    style={styles.buttonDanger}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const styles = {
  container: { padding: 18, fontFamily: "system-ui, sans-serif", maxWidth: 980 },
  row: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 12,
    alignItems: "center",
  },
  card: {
    padding: 12,
    border: "1px solid #eee",
    borderRadius: 8,
    marginBottom: 12,
  },
  form: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" },
  input: { padding: 8, minWidth: 220 },
  select: { padding: 6 },
  button: { padding: "8px 12px", marginLeft: 8 },
  buttonSecondary: { padding: "8px 12px", marginLeft: 8, background: "#eee" },
  buttonSmall: { padding: "6px 8px", marginLeft: 6 },
  buttonDanger: { padding: "6px 8px", marginLeft: 6, color: "white", background: "#c0392b", border: "none" },
  list: { listStyle: "none", padding: 0, margin: 0 },
  listItem: { display: "flex", gap: 12, padding: 8, borderBottom: "1px solid #f2f2f2", alignItems: "center" },
  controls: { display: "flex", gap: 8 },
  titleRow: { display: "flex", gap: 8, alignItems: "baseline" },
  desc: { color: "#333", marginTop: 6 },
  small: { fontSize: 12, color: "#666" },
  error: { color: "#b00020", padding: 8, borderRadius: 6, background: "#fff0f0", marginBottom: 8 },
};

export default withAuthenticator(App);

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  FolderKanban,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  Users
} from "lucide-react";
import { api, clearToken, getToken, setToken } from "./api";

const emptyProject = { name: "", description: "", memberIds: [] };
const emptyTask = {
  title: "",
  description: "",
  project: "",
  assignedTo: "",
  priority: "medium",
  dueDate: ""
};

const statusLabels = {
  todo: "Todo",
  "in-progress": "In progress",
  done: "Done"
};

const userId = (user) => user.id || user._id;

function formatDate(date) {
  return new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function isOverdue(task) {
  return task.status !== "done" && new Date(task.dueDate) < new Date();
}

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("dashboard");
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState(null);
  const [projectForm, setProjectForm] = useState(emptyProject);
  const [taskForm, setTaskForm] = useState(emptyTask);
  const [loading, setLoading] = useState(Boolean(getToken()));
  const [message, setMessage] = useState("");

  const isAdmin = user?.role === "admin";

  async function loadApp() {
    setLoading(true);
    setMessage("");
    try {
      const me = await api("/auth/me");
      const [userList, projectList, taskList, dashboard] = await Promise.all([
        api("/auth/users"),
        api("/projects"),
        api("/tasks"),
        api("/dashboard")
      ]);
      setUser(me.user);
      setUsers(userList.users);
      setProjects(projectList.projects);
      setTasks(taskList.tasks);
      setStats(dashboard.stats);
    } catch (error) {
      clearToken();
      setUser(null);
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (getToken()) loadApp();
  }, []);

  const projectMemberIds = useMemo(() => {
    const selectedProject = projects.find((project) => project._id === taskForm.project);
    return new Set((selectedProject?.members || []).map((member) => userId(member)));
  }, [projects, taskForm.project]);

  const assignableUsers = taskForm.project
    ? users.filter((item) => projectMemberIds.has(userId(item)))
    : users;

  function logout() {
    clearToken();
    setUser(null);
    setView("dashboard");
    setMessage("");
  }

  async function createProject(event) {
    event.preventDefault();
    setMessage("");
    try {
      await api("/projects", { method: "POST", body: projectForm });
      setProjectForm(emptyProject);
      await loadApp();
      setMessage("Project created successfully.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function createTask(event) {
    event.preventDefault();
    setMessage("");
    try {
      await api("/tasks", { method: "POST", body: taskForm });
      setTaskForm(emptyTask);
      await loadApp();
      setMessage("Task created successfully.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function updateStatus(taskId, status) {
    setMessage("");
    try {
      await api(`/tasks/${taskId}/status`, { method: "PATCH", body: { status } });
      await loadApp();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function deleteTask(taskId) {
    setMessage("");
    try {
      await api(`/tasks/${taskId}`, { method: "DELETE" });
      await loadApp();
      setMessage("Task deleted.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  if (!user && !loading) {
    return <AuthPage onLogin={loadApp} message={message} setMessage={setMessage} />;
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <ShieldCheck size={28} />
          <div>
            <strong>Team Task Manager</strong>
            <span>{user?.role === "admin" ? "Admin workspace" : "Member workspace"}</span>
          </div>
        </div>

        <nav className="nav-list">
          <button className={view === "dashboard" ? "active" : ""} onClick={() => setView("dashboard")}>
            <LayoutDashboard size={18} />
            Dashboard
          </button>
          <button className={view === "projects" ? "active" : ""} onClick={() => setView("projects")}>
            <FolderKanban size={18} />
            Projects
          </button>
          <button className={view === "tasks" ? "active" : ""} onClick={() => setView("tasks")}>
            <ListTodo size={18} />
            Tasks
          </button>
        </nav>

        <button className="logout-button" onClick={logout}>
          <LogOut size={18} />
          Logout
        </button>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div>
            <span className="eyebrow">{user?.role}</span>
            <h1>{view === "dashboard" ? "Dashboard" : view === "projects" ? "Projects" : "Tasks"}</h1>
          </div>
          <div className="topbar-actions">
            <span>{user?.name}</span>
            <button className="icon-button" onClick={loadApp} title="Refresh data">
              <RefreshCw size={18} />
            </button>
          </div>
        </header>

        {message && <p className="notice">{message}</p>}
        {loading && <p className="notice">Loading application...</p>}

        {!loading && view === "dashboard" && <Dashboard stats={stats} tasks={tasks} />}
        {!loading && view === "projects" && (
          <ProjectsView
            isAdmin={isAdmin}
            users={users}
            projects={projects}
            projectForm={projectForm}
            setProjectForm={setProjectForm}
            createProject={createProject}
          />
        )}
        {!loading && view === "tasks" && (
          <TasksView
            isAdmin={isAdmin}
            users={assignableUsers}
            projects={projects}
            tasks={tasks}
            taskForm={taskForm}
            setTaskForm={setTaskForm}
            createTask={createTask}
            updateStatus={updateStatus}
            deleteTask={deleteTask}
          />
        )}
      </section>
    </main>
  );
}

function AuthPage({ onLogin, message, setMessage }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "member"
  });

  async function submit(event) {
    event.preventDefault();
    setMessage("");
    try {
      const data = await api(mode === "login" ? "/auth/login" : "/auth/signup", {
        method: "POST",
        body: mode === "login" ? { email: form.email, password: form.password } : form
      });
      setToken(data.token);
      await onLogin();
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-panel">
        <div className="auth-copy">
          <ShieldCheck size={36} />
          <h1>Team Task Manager</h1>
          <p>Projects, team members, task assignment, status tracking, overdue work, and role-based access in one full-stack app.</p>
        </div>

        <form className="auth-card" onSubmit={submit}>
          <div className="segmented">
            <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>
              Login
            </button>
            <button type="button" className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>
              Signup
            </button>
          </div>

          {mode === "signup" && (
            <>
              <label>
                Name
                <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
              </label>
              <label>
                Role
                <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
                  <option value="admin">Admin</option>
                  <option value="member">Member</option>
                </select>
              </label>
            </>
          )}

          <label>
            Email
            <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
          </label>
          <label>
            Password
            <input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required minLength={6} />
          </label>

          {message && <p className="form-message">{message}</p>}
          <button className="primary-button" type="submit">
            {mode === "login" ? "Login" : "Create account"}
          </button>
        </form>
      </section>
    </main>
  );
}

function Dashboard({ stats, tasks }) {
  const cards = [
    { label: "Projects", value: stats?.projects || 0, icon: FolderKanban },
    { label: "Total tasks", value: stats?.total || 0, icon: ListTodo },
    { label: "In progress", value: stats?.inProgress || 0, icon: Clock3 },
    { label: "Done", value: stats?.done || 0, icon: CheckCircle2 },
    { label: "Overdue", value: stats?.overdue || 0, icon: Clock3 }
  ];

  return (
    <div className="content-stack">
      <div className="stats-grid">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article className="stat-card" key={card.label}>
              <Icon size={24} />
              <span>{card.label}</span>
              <strong>{card.value}</strong>
            </article>
          );
        })}
      </div>

      <section className="section-block">
        <h2>Nearest deadlines</h2>
        <TaskList tasks={tasks.slice(0, 5)} updateStatus={() => {}} readOnly />
      </section>
    </div>
  );
}

function ProjectsView({ isAdmin, users, projects, projectForm, setProjectForm, createProject }) {
  function toggleMember(id) {
    setProjectForm({
      ...projectForm,
      memberIds: projectForm.memberIds.includes(id)
        ? projectForm.memberIds.filter((memberId) => memberId !== id)
        : [...projectForm.memberIds, id]
    });
  }

  return (
    <div className="content-grid">
      {isAdmin && (
        <form className="tool-panel" onSubmit={createProject}>
          <h2>
            <Plus size={18} />
            New project
          </h2>
          <label>
            Project name
            <input value={projectForm.name} onChange={(event) => setProjectForm({ ...projectForm, name: event.target.value })} required />
          </label>
          <label>
            Description
            <textarea value={projectForm.description} onChange={(event) => setProjectForm({ ...projectForm, description: event.target.value })} rows="4" />
          </label>
          <div className="check-list">
            <span>Team members</span>
            {users.map((item) => (
              <label className="check-row" key={userId(item)}>
                <input type="checkbox" checked={projectForm.memberIds.includes(userId(item))} onChange={() => toggleMember(userId(item))} />
                {item.name} ({item.role})
              </label>
            ))}
          </div>
          <button className="primary-button" type="submit">Create project</button>
        </form>
      )}

      <section className="list-panel">
        <h2>
          <Users size={18} />
          Project list
        </h2>
        <div className="project-list">
          {projects.map((project) => (
            <article className="project-item" key={project._id}>
              <div>
                <h3>{project.name}</h3>
                <p>{project.description || "No description"}</p>
              </div>
              <span className={`pill ${project.status}`}>{project.status}</span>
              <div className="member-row">
                {project.members.map((member) => (
                  <span key={member._id}>{member.name}</span>
                ))}
              </div>
            </article>
          ))}
          {projects.length === 0 && <p className="empty-text">No projects yet.</p>}
        </div>
      </section>
    </div>
  );
}

function TasksView({ isAdmin, users, projects, tasks, taskForm, setTaskForm, createTask, updateStatus, deleteTask }) {
  return (
    <div className="content-grid">
      {isAdmin && (
        <form className="tool-panel" onSubmit={createTask}>
          <h2>
            <UserPlus size={18} />
            New task
          </h2>
          <label>
            Task title
            <input value={taskForm.title} onChange={(event) => setTaskForm({ ...taskForm, title: event.target.value })} required />
          </label>
          <label>
            Project
            <select value={taskForm.project} onChange={(event) => setTaskForm({ ...taskForm, project: event.target.value, assignedTo: "" })} required>
              <option value="">Select project</option>
              {projects.map((project) => (
                <option value={project._id} key={project._id}>{project.name}</option>
              ))}
            </select>
          </label>
          <label>
            Assign to
            <select value={taskForm.assignedTo} onChange={(event) => setTaskForm({ ...taskForm, assignedTo: event.target.value })} required>
              <option value="">Select member</option>
              {users.map((item) => (
                <option value={userId(item)} key={userId(item)}>{item.name} ({item.role})</option>
              ))}
            </select>
          </label>
          <label>
            Priority
            <select value={taskForm.priority} onChange={(event) => setTaskForm({ ...taskForm, priority: event.target.value })}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
          <label>
            Due date
            <input type="date" value={taskForm.dueDate} onChange={(event) => setTaskForm({ ...taskForm, dueDate: event.target.value })} required />
          </label>
          <label>
            Description
            <textarea value={taskForm.description} onChange={(event) => setTaskForm({ ...taskForm, description: event.target.value })} rows="4" />
          </label>
          <button className="primary-button" type="submit">Create task</button>
        </form>
      )}

      <section className="list-panel">
        <h2>
          <ListTodo size={18} />
          Task list
        </h2>
        <TaskList tasks={tasks} updateStatus={updateStatus} deleteTask={deleteTask} canDelete={isAdmin} />
      </section>
    </div>
  );
}

function TaskList({ tasks, updateStatus, deleteTask, canDelete = false, readOnly = false }) {
  return (
    <div className="task-list">
      {tasks.map((task) => (
        <article className={`task-item ${isOverdue(task) ? "overdue" : ""}`} key={task._id}>
          <div className="task-head">
            <div>
              <h3>{task.title}</h3>
              <p>{task.project?.name} - {task.assignedTo?.name}</p>
            </div>
            <span className={`pill ${task.priority}`}>{task.priority}</span>
          </div>
          {task.description && <p>{task.description}</p>}
          <div className="task-meta">
            <span>Due {formatDate(task.dueDate)}</span>
            <span className={`pill ${task.status}`}>{statusLabels[task.status]}</span>
          </div>
          {!readOnly && (
            <div className="status-actions">
              {Object.keys(statusLabels).map((status) => (
                <button
                  key={status}
                  className={task.status === status ? "active" : ""}
                  onClick={() => updateStatus(task._id, status)}
                >
                  {statusLabels[status]}
                </button>
              ))}
              {canDelete && (
                <button className="danger-button" onClick={() => deleteTask(task._id)}>
                  Delete
                </button>
              )}
            </div>
          )}
        </article>
      ))}
      {tasks.length === 0 && <p className="empty-text">No tasks found.</p>}
    </div>
  );
}

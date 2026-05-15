const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const dotenv = require("dotenv");
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { z } = require("zod");

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;
const mongoUrl =
  process.env.MONGO_URL ||
  process.env.MONGODB_URI ||
  "mongodb://127.0.0.1:27017/team_task_manager";
const jwtSecret = process.env.JWT_SECRET || "development_secret_change_me";

app.use(
  cors({
    origin: process.env.CLIENT_URL || true,
    credentials: true
  })
);
app.use(express.json({ limit: "1mb" }));

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["admin", "member"], default: "member" }
  },
  { timestamps: true }
);

userSchema.methods.safe = function safe() {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    role: this.role,
    createdAt: this.createdAt
  };
};

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2 },
    description: { type: String, trim: true, default: "" },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    status: { type: String, enum: ["active", "completed"], default: "active" }
  },
  { timestamps: true }
);

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 2 },
    description: { type: String, trim: true, default: "" },
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["todo", "in-progress", "done"], default: "todo" },
    priority: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    dueDate: { type: Date, required: true }
  },
  { timestamps: true }
);

taskSchema.index({ dueDate: 1, status: 1 });

const User = mongoose.model("User", userSchema);
const Project = mongoose.model("Project", projectSchema);
const Task = mongoose.model("Task", taskSchema);

const signupSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["admin", "member"]).default("member")
});

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Password is required")
});

const projectInput = z.object({
  name: z.string().trim().min(2, "Project name must be at least 2 characters"),
  description: z.string().trim().optional().default(""),
  memberIds: z.array(z.string()).optional().default([]),
  status: z.enum(["active", "completed"]).optional().default("active")
});

const taskInput = z.object({
  title: z.string().trim().min(2, "Task title must be at least 2 characters"),
  description: z.string().trim().optional().default(""),
  project: z.string().min(1, "Project is required"),
  assignedTo: z.string().min(1, "Assigned member is required"),
  status: z.enum(["todo", "in-progress", "done"]).optional().default("todo"),
  priority: z.enum(["low", "medium", "high"]).optional().default("medium"),
  dueDate: z.string().min(1, "Due date is required")
});

function tokenFor(user) {
  return jwt.sign({ id: user._id, role: user.role }, jwtSecret, { expiresIn: "7d" });
}

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Login required" });

    const payload = jwt.verify(token, jwtSecret);
    const user = await User.findById(payload.id);
    if (!user) return res.status(401).json({ message: "Invalid token user" });

    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  return next();
}

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function populateTask(query) {
  return query
    .populate("project", "name status")
    .populate("assignedTo", "name email role")
    .populate("createdBy", "name email role");
}

async function normalizeMembers(memberIds, ownerId) {
  const uniqueIds = [...new Set([...(memberIds || []), ownerId.toString()])];
  if (uniqueIds.some((id) => !isValidId(id))) {
    const error = new Error("One or more selected members are invalid");
    error.status = 400;
    throw error;
  }

  const count = await User.countDocuments({ _id: { $in: uniqueIds } });
  if (count !== uniqueIds.length) {
    const error = new Error("One or more selected members do not exist");
    error.status = 400;
    throw error;
  }

  return uniqueIds;
}

async function getValidProjectAndAssignee(projectId, assignedToId) {
  if (!isValidId(projectId) || !isValidId(assignedToId)) {
    const error = new Error("Invalid project or user id");
    error.status = 400;
    throw error;
  }

  const [project, assignee] = await Promise.all([
    Project.findById(projectId),
    User.findById(assignedToId)
  ]);

  if (!project) {
    const error = new Error("Project not found");
    error.status = 404;
    throw error;
  }
  if (!assignee) {
    const error = new Error("Assigned user not found");
    error.status = 404;
    throw error;
  }
  if (!project.members.map(String).includes(assignedToId)) {
    const error = new Error("Assigned user must be a project member");
    error.status = 400;
    throw error;
  }

  return project;
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "Team Task Manager API is running" });
});

app.post(
  "/api/auth/signup",
  asyncHandler(async (req, res) => {
    const data = signupSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await User.create({
      name: data.name,
      email: data.email,
      passwordHash,
      role: data.role
    });

    res.status(201).json({ token: tokenFor(user), user: user.safe() });
  })
);

app.post(
  "/api/auth/login",
  asyncHandler(async (req, res) => {
    const data = loginSchema.parse(req.body);
    const user = await User.findOne({ email: data.email.toLowerCase() });
    if (!user || !(await bcrypt.compare(data.password, user.passwordHash))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    return res.json({ token: tokenFor(user), user: user.safe() });
  })
);

app.get("/api/auth/me", auth, (req, res) => {
  res.json({ user: req.user.safe() });
});

app.get(
  "/api/auth/users",
  auth,
  asyncHandler(async (req, res) => {
    const users = await User.find().sort({ name: 1 });
    res.json({ users: users.map((user) => user.safe()) });
  })
);

app.get(
  "/api/projects",
  auth,
  asyncHandler(async (req, res) => {
    const query = req.user.role === "admin" ? {} : { members: req.user._id };
    const projects = await Project.find(query)
      .populate("owner", "name email role")
      .populate("members", "name email role")
      .sort({ createdAt: -1 });

    res.json({ projects });
  })
);

app.post(
  "/api/projects",
  auth,
  adminOnly,
  asyncHandler(async (req, res) => {
    const data = projectInput.parse(req.body);
    const members = await normalizeMembers(data.memberIds, req.user._id);
    const project = await Project.create({
      name: data.name,
      description: data.description,
      owner: req.user._id,
      members,
      status: data.status
    });
    const populated = await Project.findById(project._id)
      .populate("owner", "name email role")
      .populate("members", "name email role");

    res.status(201).json({ project: populated });
  })
);

app.patch(
  "/api/projects/:id",
  auth,
  adminOnly,
  asyncHandler(async (req, res) => {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: "Invalid project id" });
    const data = projectInput.partial().parse(req.body);
    const update = { ...data };

    if (data.memberIds) {
      update.members = await normalizeMembers(data.memberIds, req.user._id);
      delete update.memberIds;
    }

    const project = await Project.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true
    })
      .populate("owner", "name email role")
      .populate("members", "name email role");

    if (!project) return res.status(404).json({ message: "Project not found" });
    return res.json({ project });
  })
);

app.delete(
  "/api/projects/:id",
  auth,
  adminOnly,
  asyncHandler(async (req, res) => {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: "Invalid project id" });
    const project = await Project.findByIdAndDelete(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    await Task.deleteMany({ project: project._id });
    return res.json({ message: "Project and related tasks deleted" });
  })
);

app.get(
  "/api/tasks",
  auth,
  asyncHandler(async (req, res) => {
    const query = {};
    if (req.query.project) query.project = req.query.project;
    if (req.user.role !== "admin") query.assignedTo = req.user._id;
    const tasks = await populateTask(Task.find(query)).sort({ dueDate: 1, createdAt: -1 });

    res.json({ tasks });
  })
);

app.post(
  "/api/tasks",
  auth,
  adminOnly,
  asyncHandler(async (req, res) => {
    const data = taskInput.parse(req.body);
    await getValidProjectAndAssignee(data.project, data.assignedTo);
    const dueDate = new Date(data.dueDate);
    if (Number.isNaN(dueDate.getTime())) {
      return res.status(400).json({ message: "Enter a valid due date" });
    }

    const task = await Task.create({ ...data, dueDate, createdBy: req.user._id });
    const populated = await populateTask(Task.findById(task._id));
    return res.status(201).json({ task: populated });
  })
);

app.patch(
  "/api/tasks/:id/status",
  auth,
  asyncHandler(async (req, res) => {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: "Invalid task id" });
    const { status } = z.object({ status: z.enum(["todo", "in-progress", "done"]) }).parse(req.body);
    const task = await populateTask(Task.findById(req.params.id));
    if (!task) return res.status(404).json({ message: "Task not found" });

    if (req.user.role !== "admin" && task.assignedTo._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "You can update only your own tasks" });
    }

    task.status = status;
    await task.save();
    const populated = await populateTask(Task.findById(task._id));
    return res.json({ task: populated });
  })
);

app.patch(
  "/api/tasks/:id",
  auth,
  adminOnly,
  asyncHandler(async (req, res) => {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: "Invalid task id" });
    const data = taskInput.partial().parse(req.body);
    const current = await Task.findById(req.params.id);
    if (!current) return res.status(404).json({ message: "Task not found" });

    if (data.project || data.assignedTo) {
      await getValidProjectAndAssignee(
        data.project || current.project.toString(),
        data.assignedTo || current.assignedTo.toString()
      );
    }

    const update = { ...data };
    if (data.dueDate) update.dueDate = new Date(data.dueDate);
    const task = await Task.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true
    });
    const populated = await populateTask(Task.findById(task._id));

    return res.json({ task: populated });
  })
);

app.delete(
  "/api/tasks/:id",
  auth,
  adminOnly,
  asyncHandler(async (req, res) => {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: "Invalid task id" });
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ message: "Task not found" });

    return res.json({ message: "Task deleted" });
  })
);

app.get(
  "/api/dashboard",
  auth,
  asyncHandler(async (req, res) => {
    const taskQuery = req.user.role === "admin" ? {} : { assignedTo: req.user._id };
    const projectQuery = req.user.role === "admin" ? {} : { members: req.user._id };
    const now = new Date();

    const [projects, total, todo, inProgress, done, overdue] = await Promise.all([
      Project.countDocuments(projectQuery),
      Task.countDocuments(taskQuery),
      Task.countDocuments({ ...taskQuery, status: "todo" }),
      Task.countDocuments({ ...taskQuery, status: "in-progress" }),
      Task.countDocuments({ ...taskQuery, status: "done" }),
      Task.countDocuments({ ...taskQuery, status: { $ne: "done" }, dueDate: { $lt: now } })
    ]);

    res.json({ stats: { projects, total, todo, inProgress, done, overdue } });
  })
);

const clientDist = path.join(__dirname, "..", "client", "dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (req, res) => res.sendFile(path.join(clientDist, "index.html")));
} else {
  app.get("/", (req, res) => {
    res.send("Build the React client with npm run build, or open http://localhost:5173 in development.");
  });
}

app.use((err, req, res, next) => {
  console.error(err);
  if (err.name === "ZodError") {
    return res.status(400).json({
      message: "Validation failed",
      errors: err.errors.map((item) => item.message)
    });
  }
  if (err.code === 11000) return res.status(409).json({ message: "Email already exists" });
  return res.status(err.status || 500).json({ message: err.message || "Server error" });
});

mongoose
  .connect(mongoUrl)
  .then(() => {
    console.log("MongoDB connected");
    app.listen(port, () => console.log(`Server running on port ${port}`));
  })
  .catch((error) => {
    console.error("MongoDB connection failed", error.message);
    process.exit(1);
  });

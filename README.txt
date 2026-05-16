Team Task Manager - Full Stack Assignment

Live URL:
https://team-task-manager-production-43e7.up.railway.app

GitHub Repository:
https://github.com/sanyamsehrawat/team-task-manager

Project Overview
This is a full-stack Team Task Manager web application. It supports authentication, role-based access control, project and team management, task assignment, status tracking, and a dashboard with task totals and overdue work.

Tech Stack
Frontend: React + Vite
Backend: Node.js + Express.js
Database: MongoDB using Mongoose
Authentication: JWT + bcrypt password hashing
Deployment: Railway

Features
1. Signup and login.
2. Admin and Member roles.
3. Admin can create projects and add team members.
4. Admin can create, edit, assign, and delete tasks.
5. Members can view their assigned tasks and update task status.
6. Dashboard shows projects, total tasks, todo, in progress, done, and overdue tasks.
7. REST APIs with validation and database relationships.

Local Setup Commands
npm install
npm install --prefix client
Copy-Item .env.example .env
npm run dev

Open the frontend:
http://localhost:5173

Backend health check:
http://localhost:5000/api/health

How To Use
1. Signup as Admin. (Adminuserid:admin;adminpassword:admin123)
2. Signup another account as Member.
3. Login as Admin.
4. Create a project and select members.
5. Create tasks, assign them to members, and set due dates.
6. Login as Member to view assigned tasks and update status.

Important API Endpoints
POST /api/auth/signup
POST /api/auth/login
GET /api/auth/me
GET /api/auth/users
GET /api/projects
POST /api/projects
PATCH /api/projects/:id
DELETE /api/projects/:id
GET /api/tasks
POST /api/tasks
PATCH /api/tasks/:id/status
PATCH /api/tasks/:id
DELETE /api/tasks/:id
GET /api/dashboard

GitHub Commands
git init
git add .
git commit -m "Build full-stack team task manager"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/team-task-manager.git
git push -u origin main

Railway Deployment Steps
1. Push the project to GitHub.
2. Go to https://railway.com and create a new project.
3. Choose Deploy from GitHub repo and select this repository.
4. Add a MongoDB database service in the same Railway project.
5. Open the web app service Variables tab and add:
JWT_SECRET=use_a_long_random_secret_here
MONGO_URL=${{MongoDB.MONGO_URL}}
NODE_ENV=production
6. If Railway asks for commands, use:
Build Command: npm run build
Start Command: npm start
7. After deploy succeeds, open Settings and click Generate Domain.
8. Copy the public Railway URL into the submission form.

Submission Checklist
1. Live Railway URL.
2. GitHub repository link.
3. This README.txt file uploaded in the form.

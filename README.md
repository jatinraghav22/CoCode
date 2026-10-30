# CoCode – Real-Time Collaborative Code Editor

<p align="center">
  <strong>Code Together. Learn Together. Build Together.</strong>
</p>

<p align="center">
  A full-stack collaborative coding platform designed to make coding and teamwork easier through real-time collaboration.
</p>

<p align="center">
  <a href="https://cocode-two.vercel.app/">Live Demo</a> •
  <a href="https://github.com/jatinraghav22/CoCode">GitHub Repository</a> •
  <a href="https://cocode-2l13.onrender.com/">Backend API</a>
</p>

---

## About CoCode

**CoCode** is a web-based collaborative coding platform that allows developers and students to work together in a shared coding environment.

The project aims to simplify collaborative programming by providing a platform where users can create coding rooms, connect with other developers, and write code together.

Whether you are practising programming, learning with friends, or working on a coding task, CoCode provides a common environment for collaboration.

## Key Features

- **User Authentication:** Secure user registration and login.
- **Collaborative Coding Rooms:** Create and join coding rooms for collaborative sessions.
- **Real-Time Communication:** Built with Socket.IO to support real-time interaction.
- **Code Editor:** Monaco Editor provides a familiar code-editing experience.
- **Responsive Interface:** Clean and user-friendly interface for different screen sizes.
- **Full-Stack Architecture:** Separate frontend and backend for better project organization.
- **Database Integration:** MySQL and Prisma ORM for structured data management.

## Tech Stack

| Category | Technologies |
|---|---|
| Frontend | React.js, Vite, JavaScript |
| Styling | CSS |
| Code Editor | Monaco Editor |
| Backend | Node.js, Express.js |
| Real-Time Communication | Socket.IO |
| Database | MySQL |
| ORM | Prisma |
| Authentication | JWT |
| Deployment | Vercel, Render |
| Version Control | Git & GitHub |

## Project Structure

```text
CoCode/
│
├── client/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── assets/
│   │   └── ...
│   ├── package.json
│   └── vite.config.js
│
├── server/
│   ├── prisma/
│   │   └── schema.prisma
│   ├── ...
│   └── package.json
│
├── .gitignore
└── README.md
```

## Getting Started

Follow these steps to run CoCode locally.

### 1. Clone the Repository

```bash
git clone https://github.com/jatinraghav22/CoCode.git
```

### 2. Navigate to the Project

```bash
cd CoCode
```

### 3. Install Frontend Dependencies

```bash
cd client
npm install
```

### 4. Install Backend Dependencies

Open another terminal:

```bash
cd CoCode/server
npm install
```

### 5. Configure Environment Variables

Create the required `.env` files for the backend and frontend.

Configure your database connection, JWT secret, server port, and frontend API URL according to your local environment.

Example database connection:

```env
DATABASE_URL="mysql://USER:PASSWORD@localhost:3306/cocode_db"
JWT_SECRET="your_secret_key"
PORT=5000
```

Do not commit your actual environment variables or secrets to GitHub.

### 6. Configure Prisma

From the server directory, run:

```bash
npx prisma generate
npx prisma db push
```

Make sure MySQL is running and the database has been created.

### 7. Start the Application

Start the backend and frontend in separate terminals using their respective development scripts.

Backend:

```bash
cd server
npm run dev
```

Frontend:

```bash
cd client
npm run dev
```

Open the local frontend URL displayed by Vite in your browser.

*Note: Ensure the development scripts and environment variable names match your package configuration.*

## Deployment

CoCode is deployed using the following platforms:

| Component | Platform | Link |
|---|---|---|
| Frontend | Vercel | https://cocode-two.vercel.app/ |
| Backend | Render | https://cocode-2l13.onrender.com/ |
| Source Code | GitHub | https://github.com/jatinraghav22/CoCode |

## Future Improvements

- Enhanced real-time multi-user code synchronization.
- Support for multiple programming languages.
- Integrated code execution environment.
- Voice and video communication.
- Collaborative debugging.
- Improved user profiles and session management.
- Enhanced security and database integration.

## Learning Outcomes

Working on CoCode provides practical experience with:

- Full-stack web development.
- React component-based architecture.
- REST API development.
- Real-time communication using Socket.IO.
- Database design and ORM concepts.
- Authentication and authorization.
- Cloud deployment and version control.

## Author

**Jatin Raghav**

B.Tech – Computer Science and Engineering

- GitHub: [@jatinraghav22](https://github.com/jatinraghav22)
- LinkedIn: [Jatin Raghav](https://www.linkedin.com/in/jatin-raghav-a9a060357/)

---

<p align="center">
  <strong>CoCode – Code Together. Grow Together. 🚀</strong>
</p>

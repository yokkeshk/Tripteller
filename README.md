
# 📍 TripTeller – Field Engineer Tracking Platform

**TripTeller** is a full-stack field service management system that enables organizations to track and manage service engineers in real time. Built using **React**, **Express.js**, **Node.js**, **MongoDB**, and the **Google Maps API**, the app allows role-based access for both **Admins** and **Engineers**.

---

## ✨ Features

### 👨‍🔧 Engineer Dashboard
- Secure login/signup
- View assigned service calls
- Mark attendance and call completion
- Calculate distance traveled using Google Maps
- View personal call and search history

### 🧑‍💼 Admin Dashboard
- Admin can use all Engineer features
- Assign service calls to engineers
- View and verify engineer attendance and distance logs
- Access call history and generate downloadable reports
- Cross-verify traveled distance using distance calculator tool

---

## 🛠️ Tech Stack

| Layer      | Technology            |
|------------|------------------------|
| Frontend   | React.js (TypeScript) |
| Backend    | Node.js, Express.js    |
| Database   | MongoDB Atlas          |
| Auth       | JWT-based login system |
| Mapping    | Google Maps API        |
| Styling    | Bootstrap + SCSS       |

---

## 📁 Folder Structure

```
react-distance-calculator-main/
├── models/               # Mongoose schemas
├── routes/               # Express API routes
├── middleware/           # Auth middleware (JWT)
├── components/           # React components
├── utils/                # Helper functions
├── public/               # Static frontend assets
├── server.js             # Express server entry
├── package.json
├── tsconfig.json
└── .env                  # Environment variables
```

---

## ⚙️ Getting Started

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/yokkeshk/Tripteller.git
cd react-distance-calculator-main
```

---

### 2️⃣ Install Dependencies

```bash
npm install
```

---

### 3️⃣ Create Environment Variables

Create a `.env` file at the root level:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
JWT_SECRET=your_jwt_secret
```

> ✅ Ensure that the **Google Maps JavaScript API** and **Distance Matrix API** are enabled in your Google Cloud Console.

---

### 4️⃣ Start the Application

```bash
npm run dev
```

The frontend will be served from [http://localhost:3000](http://localhost:3000)  
The backend will run on [http://localhost:5000](http://localhost:5000)

---

## 🔐 Role-Based Access

| Role     | Capabilities                                                                 |
|----------|------------------------------------------------------------------------------|
| Engineer | View & complete calls, mark attendance, calculate distance, view history     |
| Admin    | All Engineer features + assign calls, monitor engineers, generate reports     |

---

## 📤 Reports & Validation Tools

- Admins can export daily call and distance reports.
- Google Maps-based calculator tool allows distance validation.
- Engineer routes, assignments, and timestamps are logged and verifiable.

---

## 🚧 Future Enhancements

- Add live tracking with Socket.IO or WebSocket
- Offline tracking & background syncing
- Push notifications for new assignments

---

## 🧪 Scripts

| Command         | Description                    |
|----------------|--------------------------------|
| `npm start`     | Run in production mode        |
| `npm run dev`   | Run in development (nodemon)  |

---

## 📄 License

This project is licensed under the MIT License.

---

## 🙌 Acknowledgments

- [Google Maps API](https://developers.google.com/maps)
- [MongoDB Atlas](https://www.mongodb.com/atlas)
- [Bootstrap](https://getbootstrap.com/)


<img width="1920" height="1080" alt="Screenshot (335)" src="https://github.com/user-attachments/assets/b54b4142-a8a0-4380-9184-531ab4552b88" />

<img width="1920" height="1080" alt="Screenshot (336)" src="https://github.com/user-attachments/assets/8e573dd5-fa53-427e-a062-7f716376905d" />

<img width="1920" height="1080" alt="Screenshot (337)" src="https://github.com/user-attachments/assets/9d646ceb-c0b8-484c-868f-4e4c354c7dd4" />


<img width="1920" height="1080" alt="Screenshot (338)" src="https://github.com/user-attachments/assets/10d36e23-f0d5-47e5-a3e3-eb64add7ccd9" />
<img width="1920" height="1080" alt="Screenshot (339)" src="https://github.com/user-attachments/assets/9114c24a-59ee-49e8-8a61-dc1b77991b05" />
<img width="1920" height="1080" alt="Screenshot (340)" src="https://github.com/user-attachments/assets/6a4f8221-96e8-47a0-8620-a7e478a3652b" />
<img width="1920" height="1080" alt="Screenshot (341)" src="https://github.com/user-attachments/assets/a7075958-cbe6-4627-97ea-49473001a5f9" />

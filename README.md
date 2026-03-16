# Parkly

A peer-to-peer parking space rental platform that connects drivers looking for parking with hosts who offer available spots.

## Features

**For drivers**
- Search and filter parking spots by zone, price, schedule, and features (EV charging, 24h, security, verified)
- View spot details, images, ratings, and hourly pricing
- Make, modify, and cancel reservations
- Process payments via Wompi
- In-app chat with spot owners
- AI-powered assistant for support queries

**For owners**
- List and manage parking spaces with pricing and availability
- View bookings and occupancy from the owner dashboard
- Communicate with renters via in-app chat

**Platform**
- User authentication (email/password + Google OAuth)
- Password recovery via email
- Admin dashboard for platform management
- Analytics and reporting (monthly revenue, occupancy rate, top spots)
- Dark / light theme
- Fully responsive UI

---

## Tech Stack

### Frontend
- HTML5, CSS3, JavaScript (ES6)
- [Tailwind CSS](https://tailwindcss.com) via CDN + custom CSS variables
- [Lucide](https://lucide.dev) icons

### Backend — Node.js
| Package | Purpose |
|---|---|
| Express 5 | REST API |
| Mongoose | MongoDB ODM (chat) |
| MySQL2 | Relational data (TiDB) |
| bcryptjs | Password hashing |
| jsonwebtoken | Session tokens |
| Multer + Cloudinary | Image uploads |
| Resend / EmailJS | Transactional email |
| OpenAI SDK | AI chat assistant |
| Wompi | Payment processing |

### Backend — Python microservice
| Package | Purpose |
|---|---|
| FastAPI + Uvicorn | Analytics REST API |
| Pandas | Data processing |
| mysql-connector-python | TiDB queries |

### Databases
| Database | Used for |
|---|---|
| TiDB (MySQL-compatible) | Users, spots, reservations, payments |
| MongoDB Atlas | Chat messages |

### Infrastructure
- Docker + Docker Compose
- Cloudinary CDN (images)

---

## Project Structure

```
Parkly-1/
├── server.js                 # Main Node.js API
├── stats.py                  # Python analytics microservice
├── docker-compose.yml
├── Dockerfile
├── Dockerfile.python
├── requirements.txt
├── package.json
├── docs/
│   └── diagrams/             # Architecture and wireframe diagrams
└── public/
    ├── index.html            # Landing page
    ├── login.html
    ├── register.html
    ├── search.html           # Spot search and filters
    ├── detail.html           # Spot detail and booking
    ├── payment.html
    ├── dashboard.html        # User bookings dashboard
    ├── owner-dash.html       # Owner management dashboard
    ├── admin-dash.html       # Admin panel
    ├── profile.html          # User profile and settings
    ├── chat.html             # In-app messaging
    ├── legalidad.html        # Terms and conditions
    ├── IA/
    │   ├── box.js            # AI chat Express server (port 3001)
    │   ├── chatbox.js        # Chat widget logic
    │   └── chatbox.css       # Chat widget styles
    ├── js/                   # Frontend modules
    └── css/
        └── styles.css        # Global styles and CSS variables
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.10+
- Docker (optional)

### Environment variables

Create a `.env` file at the project root:

```env
# Database
TIDB_HOST=
TIDB_PORT=
TIDB_USER=
TIDB_PASSWORD=
TIDB_DATABASE=

MONGODB_URI=

# Auth
JWT_SECRET=

# Cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Email
RESEND_API_KEY=

# OpenAI
OPENAI_API_KEY=

# Wompi
WOMPI_PUBLIC_KEY=
WOMPI_PRIVATE_KEY=
WOMPI_WEBHOOK_SECRET=
```

### Install and run

```bash
# Install Node dependencies
npm install

# Install Python dependencies
pip install -r requirements.txt

# Start the main API (port 3000)
node server.js

# Start the analytics microservice (port 8000)
uvicorn stats:app --reload

# Start the AI chat server (port 3001)
node public/IA/box.js
```

### With Docker

```bash
docker-compose up --build
```

---

## API Endpoints (summary)

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Login |
| GET | `/api/spots` | List parking spots |
| POST | `/api/bookings` | Create a reservation |
| POST | `/api/ai-chat` | AI assistant proxy |
| GET | `/api/python/stats/monthly-projection` | Revenue projection |
| GET | `/api/python/stats/occupancy-rate` | Occupancy rate |
| GET | `/api/python/stats/top-spots` | Top performing spots |

---

## Governing Law

This platform operates under the laws of Colombia. Payments are processed through Wompi.

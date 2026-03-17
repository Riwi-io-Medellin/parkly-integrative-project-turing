Here's an improved, fully English README with updated links, project structure, and team profiles:

***

# Parkly

Parkly is an innovative platform that connects drivers looking for parking with hosts who offer available spots. Designed to optimize urban spaces, Parkly provides a secure, efficient, and easy-to-use experience for both drivers and owners.

Live Demo: [https://parkly-web.onrender.com](https://parkly-web.onrender.com)

## Table of Contents
- [Getting Started](#getting-started)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Project Structure](#project-structure)
- [Running the Project](#running-the-project)
- [Using Docker](#using-docker)
- [Technologies Used](#technologies-used)
- [Features](#features)
- [Team](#team)

## Getting Started

Follow these instructions to get the project up and running on your local machine.

## Prerequisites

Ensure you have the following installed:
- Node.js: v18 or higher
- Python: v3.10 or higher
- MySQL/TiDB: Access to a relational database
- MongoDB: Access to a MongoDB instance (for chat)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/Riwi-io-Medellin/parkly-integrative-project-turing.git
cd parkly-integrative-project-turing
```

2. Install dependencies:
```bash
# Install Node.js dependencies
npm install

# Install Python dependencies
pip install -r requirements.txt
```

3. Create a `.env` file in the root directory and configure the variables (refer to `.env.example`):
```
DB_HOST=your_host
DB_USER=your_user
DB_PASSWORD=your_password
DB_NAME=your_database
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_secret
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
OPENAI_API_KEY=your_openai_key
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

## Project Structure

```
├── backend/
│   ├── config/
│   ├── routes/
│   └── services/
├── public/
│   ├── IA/
│   ├── css/
│   └── js/
├── admin-dash.html
├── chat.html
├── dashboard.html
├── detail.html
├── forgot-password.html
├── index.html
├── legalidad.html
├── login.html
├── owner-dash.html
├── payment.html
├── profile.html
├── register.html
├── reset-password.html
├── search.html
├── .dockerignore
├── .env.example
├── .gitignore
├── Dockerfile
├── Dockerfile.python
├── README.md
├── docker-compose.yml
├── package.json
├── render.yaml
├── requirements.txt
├── server.js
├── stats.py
└── supervisord.conf
```

## Running the Project

Run three separate services:

1. **Main API (Node.js)**:
```bash
npm run dev
```
Runs on [http://localhost:3000](http://localhost:3000)

2. **Analytics Microservice (Python)**:
```bash
uvicorn stats:app --reload --port 8000
```
Runs on [http://localhost:8000](http://localhost:8000)

3. **AI Chat Proxy (Node.js)**:
```bash
node public/IA/box.js
```
Runs on [http://localhost:3001](http://localhost:3001)

## Using Docker

Run everything using Docker Compose:
```bash
docker-compose up --build
```

## Technologies Used

### Frontend
- HTML5 & CSS3: Semantic structure and custom styling
- JavaScript (ES6+): Frontend logic and interactivity (JS content loaded)
- Tailwind CSS: Modern utility-first CSS framework
- Lucide Icons: Clean and consistent iconography

### Backend
- Node.js (Express 5): Core REST API and server logic
- Python (FastAPI): Specialized microservice for analytics
- Mongoose: ODM for MongoDB chat storage
- MySQL2: Driver for relational data (TiDB)
- OpenAI SDK: Powering the AI chat assistant

### Infrastructure & Tools
- MongoDB Atlas: Cloud database for messaging
- TiDB Cloud: Distributed SQL database for primary data
- Cloudinary: Image hosting and management
- Wompi: Payment gateway integration
- Docker: Containerization for consistent environments

## Features
- **Smart Search**: Filter spots by price, zone, and availability
- **Secure Payments**: Integrated with Wompi for seamless transactions
- **Real-time Chat**: In-app communication between drivers and hosts
- **AI Assistant**: Intelligent support for user queries
- **Owner Dashboard**: Detailed analytics on revenue and occupancy
- **Responsive Design**: Optimized for desktop and mobile devices

## Team

This project was developed by:

- [Juan Eduardo Zorrilla Chavez](https://github.com/HeroLeni)
- [Yu Wenjin](https://github.com/TzerK-LAST)
- [Sergio Ospina Tabares](https://github.com/SAOT31)
- [Sebastian Montaño](https://github.com/sebastianmontdev)
- [Andres Mauricio Hidrobo](https://github.com/AndresHidrobo)

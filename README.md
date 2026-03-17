# Parkly

Parkly is an innovative platform that connects drivers looking for parking with hosts who offer available spots. Designed to optimize the use of urban spaces, Parkly provides a secure, efficient, and easy-to-use experience for both drivers and owners.


## Getting Started

Follow these instructions to get the project up and running on your local machine.

### Prerequisites

Ensure you have the following installed:
- **Node.js**: v18 or higher
- **Python**: v3.10 or higher
- **MySQL/TiDB**: Access to a relational database
- **MongoDB**: Access to a MongoDB instance (for chat)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Riwi-io-Medellin/parkly-integrative-project-turing
   cd parkly-integrative-project-turing
   ```

2. **Install dependencies:**
   ```bash
   # Install Node.js dependencies
   npm install

   # Install Python dependencies
   pip install -r requirements.txt
   ```

3. **Environment Setup:**
   Create a `.env` file in the root directory and configure the variables (refer to `.env.example`):
   ```env
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

### Running the Project

You need to run three separate services:

1. **Main API (Node.js):**
   ```bash
   npm run dev
   ```
   *Runs on [http://localhost:3000](http://localhost:3000)*

2. **Analytics Microservice (Python):**
   ```bash
   uvicorn stats:app --reload --port 8000
   ```
   *Runs on [http://localhost:8000](http://localhost:8000)*

3. **AI Chat Proxy (Node.js):**
   ```bash
   node public/IA/box.js
   ```
   *Runs on [http://localhost:3001](http://localhost:3001)*

#### Using Docker
Alternatively, you can run everything using Docker Compose:
```bash
docker-compose up --build
```

---

## Technologies Used

### Frontend
- **HTML5 & CSS3**: Semantic structure and custom styling.
- **JavaScript (ES6+)**: Frontend logic and interactivity.
- **Tailwind CSS**: Modern utility-first CSS framework.
- **Lucide Icons**: Clean and consistent iconography.

### Backend
- **Node.js (Express 5)**: Core REST API and server logic.
- **Python (FastAPI)**: Specialized microservice for analytics and data processing.
- **Mongoose**: ODM for MongoDB chat storage.
- **MySQL2**: Driver for relational data (TiDB).
- **OpenAI SDK**: Powering the AI chat assistant.

### Infrastructure & Tools
- **MongoDB Atlas**: Cloud database for messaging.
- **TiDB Cloud**: Distributed SQL database for primary data.
- **Cloudinary**: Image hosting and management.
- **Wompi**: Payment gateway integration.
- **Docker**: Containerization for consistent environments.

---

## Features

- **Smart Search**: Filter spots by price, zone, and availability.
- **Secure Payments**: Integrated with Wompi for seamless transactions.
- **Real-time Chat**: In-app communication between drivers and hosts.
- **AI Assistant**: Intelligent support for user queries.
- **Owner Dashboard**: Detailed analytics on revenue and occupancy.
- **Responsive Design**: Optimized for both desktop and mobile devices.

---

## Team Credits

This project was developed by:

1. **Sergio Espina Tabares**
2. **Andrés Hidrobo**
3. **Juan Eduardo Zorrilla Chavez**
4. **Wenjin Yu**
5. **Sebastian Montaño**

---

© 2026 Crudzaso - Parkly.

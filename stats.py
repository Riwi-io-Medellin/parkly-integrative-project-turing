import os
import mysql.connector
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import pandas as pd

# Load environment variables from .env so we don't hardcode credentials
load_dotenv()

app = FastAPI()

# CORS is open here because this service only talks to our own Node.js backend (port 3000)
# and Vercel. In production you'd lock this down to specific origins.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db_connection():
    """Opens a connection to TiDB Cloud using the credentials stored in .env"""
    try:
        return mysql.connector.connect(
            host=os.getenv("DB_HOST"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
            database=os.getenv("DB_NAME"),
            port=int(os.getenv("DB_PORT", 4000)),
            ssl_disabled=False  # Let the driver negotiate SSL automatically
        )
    except Exception as e:
        print(f"Database connection error: {e}")
        return None


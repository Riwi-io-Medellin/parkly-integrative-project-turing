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


# --- ANALYTICS ENDPOINTS ---

@app.get("/api/python/stats/monthly-projection")
async def get_monthly_projection():
    """Calculates a simple monthly revenue projection based on the average hourly price
    across all verified parking spots, assuming 8 hours of use per day for 30 days."""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")

    try:
        query = "SELECT price_hour FROM parking_spots WHERE verified = 1"
        df = pd.read_sql(query, conn)

        if df.empty:
            return {"projection": 0}

        # Simple formula: average price * 8 hours/day * 30 days
        total_projection = df['price_hour'].mean() * 8 * 30
        return {"projection": round(total_projection, 2)}
    finally:
        conn.close()


@app.get("/api/python/stats/occupancy-rate")
async def get_occupancy_rate():
    """Calculates the occupancy percentage by comparing active reservations
    against the total number of approved parking spots."""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")

    try:
        cursor = conn.cursor()

        # Count all approved (verified) spots
        cursor.execute("SELECT COUNT(*) FROM parking_spots WHERE verified = 1")
        total_spots = cursor.fetchone()[0]

        # Count all non-cancelled reservations as "occupied"
        cursor.execute("SELECT COUNT(*) FROM reservations WHERE status != 'cancelled'")
        active_reservations = cursor.fetchone()[0]

        if total_spots == 0:
            return {"occupancy_rate": 0}

        rate = (active_reservations / total_spots) * 100
        # Cap at 100% in case the math goes over (e.g. multiple bookings per spot)
        return {"occupancy_rate": round(min(rate, 100), 1)}
    finally:
        conn.close()


@app.get("/api/python/stats/top-spots")
async def get_top_spots():
    """Returns the top 3 most-booked parking spots by joining spots with their reservations."""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")

    try:
        query = """
            SELECT p.name, COUNT(r.id) as reservation_count
            FROM parking_spots p
            JOIN reservations r ON p.id = r.spotId
            GROUP BY p.id
            ORDER BY reservation_count DESC
            LIMIT 3
        """
        df = pd.read_sql(query, conn)
    finally:
        conn.close()


@app.get("/metrics/full")
async def get_full_metrics():
    """Aggregates all metrics into a single response for the Admin dashboard."""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")

    try:
        cursor = conn.cursor(dictionary=True)

        # 1. Occupancy Rate
        cursor.execute("SELECT COUNT(*) as count FROM parking_spots WHERE verified = 1")
        total_spots_row = cursor.fetchone()
        total_spots = total_spots_row['count'] if total_spots_row else 0
        
        cursor.execute("SELECT COUNT(*) as count FROM reservations WHERE status != 'cancelled'")
        active_res_row = cursor.fetchone()
        active_res = active_res_row['count'] if active_res_row else 0
        
        occupancy = round((active_res / total_spots * 100), 1) if total_spots > 0 else 0

        # 2. Monthly Revenue (calculated from completions)
        cursor.execute("""
            SELECT MONTH(createdAt) as month, SUM(total) as revenue 
            FROM reservations 
            WHERE status = 'completed' AND YEAR(createdAt) = YEAR(CURDATE())
            GROUP BY MONTH(createdAt)
        """)
        revenue_rows = cursor.fetchall()
        monthly_revenue = [0] * 12
        for r in revenue_rows:
            m = r['month']
            if 1 <= m <= 12:
                monthly_revenue[m-1] = float(r['revenue'])

        # 3. Top Spots
        cursor.execute("""
            SELECT p.name, COUNT(r.id) as reservation_count
            FROM parking_spots p
            JOIN reservations r ON p.id = r.spotId
            GROUP BY p.id
            ORDER BY reservation_count DESC
            LIMIT 3
        """)
        top_spots = cursor.fetchall()

        return {
            "occupancy_rate": occupancy,
            "monthly_revenue": monthly_revenue,
            "top_spots": top_spots
        }
    except Exception as e:
        print(f"Metrics aggregation error: {e}")
        return {
            "occupancy_rate": 0,
            "monthly_revenue": [0]*12,
            "top_spots": []
        }
    finally:
        conn.close()


# This block only runs when we launch the file directly with `python stats.py`.
# On Vercel / production, the ASGI server is started by their platform, not here.
if __name__ == "__main__":
    import uvicorn
    print("Starting Parkly metrics service...")
    uvicorn.run(app, host="0.0.0.0", port=8000)
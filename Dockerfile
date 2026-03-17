# ============================================================
# Parkly — Dockerfile Unificado (Node.js 18 + Python 3 + Supervisor)
# Un solo contenedor que corre el backend Node y el servicio Python
# Render expone un solo puerto ($PORT) asignado dinamicamente
# ============================================================

FROM node:18-slim

# Instalar Python 3, pip y supervisor
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    supervisor \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# --- Dependencias Node.js ---
COPY package*.json ./
RUN npm install --omit=dev

# --- Dependencias Python ---
COPY requirements.txt ./
RUN pip3 install --no-cache-dir -r requirements.txt --break-system-packages

# --- Código fuente ---
COPY . .

# --- Configuración de Supervisor ---
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Render asigna el puerto dinámicamente via $PORT
# Node escucha en $PORT, Python internamente en 8000
EXPOSE 3000

CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
# Usar una computadora virtual ligera con Node.js instalado
FROM node:18-alpine

# Crear la carpeta de trabajo dentro del contenedor
WORKDIR /app

# Copiar la lista de compras (package.json)

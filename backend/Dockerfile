# Use a Python base image
FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the backend code
COPY . .

COPY .env .env

# Expose the backend port
EXPOSE 8002

# Command to run the backend server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8002"]
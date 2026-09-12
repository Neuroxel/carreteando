FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY scraper.py .

# Cron: corre el scraper cada 12h
RUN apt-get update && apt-get install -y cron && rm -rf /var/lib/apt/lists/*
RUN echo "0 */12 * * * cd /app && python scraper.py >> /var/log/scraper.log 2>&1" | crontab -

CMD ["sh", "-c", "python scraper.py && cron -f"]

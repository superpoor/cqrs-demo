from flask import Flask, request, jsonify
import os
import psycopg2
import time
import json
import pika
from dotenv import load_dotenv

# Load .env file (won't override existing environment variables)
load_dotenv()

DATABASE_URL = os.environ.get('DATABASE_URL')
RABBITMQ_URL = os.environ.get('RABBITMQ_URL')

# Initialize the Flask application
app = Flask(__name__)

# Database connection
def get_db_connection():
  retries = 5;
  while retries > 0:
    try:
      conn = psycopg2.connect(DATABASE_URL)
      return conn
    except psycopg2.OperationalError:
      retries -= 1
      time.sleep(5)
  raise Exception("Failed to connect to database.")

def get_rabbitmq_connection():
  retries = 5;
  while retries > 0:
    try:
      connection = pika.BlockingConnection(pika.URLParameters(RABBITMQ_URL))
      return connection
    except pika.exceptions.AMQPConnectionError:
      retries -= 1
      time.sleep(5)
  raise Exception("Failed to connect to RabbitMQ.")

# Initialize DB Table
conn = get_db_connection()
cur = conn.cursor()
cur.execute('''
  CREATE TABLE IF NOT EXISTS todos (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    completed BOOLEAN DEFAULT FALSE
  );
''')
conn.commit()
cur.close()
conn.close()

# API Endpoints
@app.route('/todos', methods=['POST'])
def create_todo():
  data = request.get_json()
  title = data.get('title')
  if not title:
    return jsonify({"error": "Title is required"}), 400
  
  # Save to Write Database
  conn = get_db_connection()
  cur = conn.cursor()
  cur.execute("INSERT INTO todos (title) VALUES (%s) RETURNING id, title, completed;", (title,))
  new_todo = cur.fetchone()
  conn.commit()
  cur.close()
  conn.close()

  todo_id, todo_title, todo_completed = new_todo

  # Publish Event to RabbitMQ
  connection = get_rabbitmq_connection()
  channel = connection.channel()
  channel.queue_declare(queue='todo_events')

  event = {
    'type': 'TODO_CREATED',
    'data': {
      'id': todo_id,
      'title': todo_title,
      'completed': todo_completed
    }
  }
  channel.basic_publish(exchange='', routing_key='todo_events', body=json.dumps(event))
  connection.close()

  print(f"Published event: ${event}")
  return jsonify({"message": "Todo created successfully.", "id": todo_id}), 201

if __name__ == '__main__':
  app.run(
    host='0.0.0.0', 
    port=5001,
    debug=True,
    use_reloader=True
  )

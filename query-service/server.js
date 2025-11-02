const express = require('express');
const { MongoClient } = require('mongodb');
const amqp = require('amqplib');
const dotenv = require('dotenv');

dotenv.config();

const MONGO_URL = process.env.MONGO_URL;
const RABBITMQ_URL = process.env.RABBITMQ_URL;
const PORT = process.env.PORT;
const DB_NAME= process.env.DB_NAME;
const COLLECTION_NAME = process.env.COLLECTION_NAME;

const app = express();
let db, collection;

// Connect to MongoDB
async function connectMongo() {
  try {
    const client = new MongoClient(MONGO_URL);
    await client.connect();
    db = client.db(DB_NAME);
    collection = db.collection(COLLECTION_NAME);
  } catch (err) {
    console.error('Failed to connect to MongoDB', err);
    process.exit(1);
  }
}

// RabbitMQ Consumer
async function consumeEvents() {
  try {
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();
    await channel.assertQueue('todo_events', { durable: false });

    console.log('Waiting for events in todo_events queue...');

    channel.consume('todo_events', async (message) => {
      if (message.content) {
        const event = JSON.parse(message.content.toString());
        console.log("Received event: ", event);

        // Update the Read Model based on the event type
        if (event.type === 'TODO_CREATED') {
          const doc = {
            _id: event.data.id,
            title: event.data.title,
            completed: event.data.completed
          };
          await collection.insertOne(doc);
          console.log(`Todo ${doc._id} inserted into read model.`);
        }
      }
    }, { noAck: true });
  } catch (err) {
    console.error('Failed to consume events', err);
    setTimeout(consumeEvents, 5000);
  }
}

// API Endpoint
app.get('/todos', async (req, res) => {
  try {
    const todos = await collection.find().toArray();
    res.json(todos);
  } catch (err) {
    console.error('Failed to fetch todos', err);
    res.status(500).json({ error: 'Failed to fetch todos' });
  }
});

app.get('/todos/:id', async (req, res) => {
  try {
    const todo = await collection.findOne({ _id: parseInt(req.params.id) });
    if (!todo) {
      return res.status(404).json({ error: 'Todo not found' });
    }
    res.json(todo);
  } catch (err) {
    console.error('Failed to fetch todo', err);
    res.status(500).json({ error: 'Failed to fetch todo' });
  }
});

// Start server and listener
async function start() {
  try {
    await connectMongo();
    await consumeEvents();
    app.listen(PORT, () => {
      console.log(`Query service listening at ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server', err);
    process.exit(1);
  }
}

start();
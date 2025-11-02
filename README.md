# CQRS Demo Project

## What is CQRS?

**CQRS (Command Query Responsibility Segregation)** is an architectural pattern that separates read and write operations into different models:

- **Command Side (Write)**: Handles all data modifications (Create, Update, Delete). Optimized for transactional consistency and business logic validation.
- **Query Side (Read)**: Handles all data retrieval operations. Optimized for fast reads and can use different data models tailored for specific queries.

### Key Benefits

- **Scalability**: Read and write operations can be scaled independently
- **Performance**: Each side can be optimized for its specific purpose
- **Flexibility**: Different databases can be used for reads and writes
- **Separation of Concerns**: Business logic is clearly separated from query logic

## About This Demo

This project demonstrates a simple CQRS implementation for a **Todo application** using:

### Architecture Components

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Command Service** | Flask (Python) | Handles write operations (create todos) |
| **Query Service** | Node.js + Express | Handles read operations (list todos) |
| **Write Database** | PostgreSQL | Stores authoritative data |
| **Read Database** | MongoDB | Stores denormalized data optimized for queries |
| **Message Broker** | RabbitMQ | Propagates events between services |

### Data Flow

```
┌─────────┐
│ Client  │
└────┬────┘
     │
     │ POST /todos (Create)
     ▼
┌──────────────────┐         ┌────────────┐
│ Command Service  │────────▶│ PostgreSQL │
│   (Flask)        │         │  (Write)   │
└────┬─────────────┘         └────────────┘
     │
     │ Publish Event
     ▼
┌──────────────────┐
│    RabbitMQ      │
└────┬─────────────┘
     │
     │ Consume Event
     ▼
┌──────────────────┐         ┌────────────┐
│  Query Service   │────────▶│  MongoDB   │
│   (Node.js)      │         │   (Read)   │
└────┬─────────────┘         └────────────┘
     │
     │ GET /todos (List)
     ▼
┌─────────┐
│ Client  │
└─────────┘
```


## How to Run the Demo

### Step-by-Step Instructions

#### 1. Start All Services

```bash
docker-compose up -d
```

This will start:
- Command Service (Flask) on port **5001**
- Query Service (Node.js) on port **5002**
- PostgreSQL database
- MongoDB database
- RabbitMQ message broker

You should see all 5 services running.

#### 2. Create a Todo (Command Side)

```bash
curl -X POST http://localhost:5001/todos \
  -H "Content-Type: application/json" \
  -d '{"title": "Learn CQRS"}'
```

**Expected Response:**
```json
{
  "message": "Todo created successfully.",
  "id": 1
}
```

#### 3. List Todos (Query Side)

Wait a moment for the event to propagate, then:

```bash
curl http://localhost:5002/todos
```

**Expected Response:**
```json
[
  {
    "id": 1,
    "title": "Learn CQRS",
    "completed": false
  }
]
```

#### 4. View Logs (Optional)

To see what's happening behind the scenes:

```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f command-service
docker-compose logs -f query-service
```

#### 5. Stop the Demo

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (clears all data)
docker-compose down -v
```
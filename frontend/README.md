# Frontend

Open `index.html` in a browser after starting the backend services.

Required services:

```bash
cd backend
venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
```

```bash
cd server
node index.js
```

The frontend calls the Node API at `http://127.0.0.1:3001` by default.

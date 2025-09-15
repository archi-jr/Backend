// D:\Xeno App\backend\index.js

const express = require('express');
const app = express();
const port = 5000; // Choose a port for your backend

app.get('/', (req, res) => {
  res.send('Hello from the Express Backend!');
});

app.listen(port, () => {
  console.log(`🚀 Server is running on http://localhost:${port}`);
});
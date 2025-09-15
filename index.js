// D:\Xeno App\backend\index.js

const express = require('express');
const app = express();

// ✅ Use the PORT environment variable Render provides, or 5000 for local development
const port = process.env.PORT || 5000;

app.get('/', (req, res) => {
  res.send('Hello from the Express Backend!');
});

app.listen(port, () => {
  console.log(`🚀 Server is running on port ${port}`);
});
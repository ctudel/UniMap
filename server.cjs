// import express from 'express';
// import cors from 'cors';
// import path from 'path';
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// Serve the static files from the 'OnTime' directory
app.use(express.static(path.join(__dirname, 'public')));

app.use(cors());

// Route for serving the 'index.html' file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
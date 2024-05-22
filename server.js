const { readFile } = require('fs').promises;
const express = require('express');
const app = express();
const PORT = 8080;

// Serve the static files from the 'OnTime' directory
app.use(express.static(__dirname));

// Route for serving the 'index.html' file
app.get('/', async (req, res) => {
  res.send(await readFile('./index.html', 'utf8'));
});

// Start the server
app.listen(process.env.PORT || PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

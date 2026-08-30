const fs = require('fs');
const path = require('path');

module.exports = async (req, res) => {
  try {
    // Always serve index.html for now to test if handler works
    const filePath = path.join(process.cwd(), 'index.html');
    const data = await fs.promises.readFile(filePath);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(data);
  } catch (err) {
    res.writeHead(500);
    res.end('Internal Server Error');
  }
};
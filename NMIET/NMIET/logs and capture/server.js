// server.js
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const mkdirp = require('mkdirp');

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json({ limit: '20mb' })); // allow large base64 uploads
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// serve static frontend from public/
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));

// ensure directories exist
const logsDir = path.join(__dirname, 'logs');
const capturesDir = path.join(__dirname, 'captures');
mkdirp.sync(logsDir);
mkdirp.sync(capturesDir);

// Endpoint: receive detection logs
app.post('/log-detection', (req, res) => {
  try{
    const body = req.body || {};
    const timestamp = new Date().toISOString();
    const logEntry = { id: Date.now(), timestamp, body };
    const file = path.join(logsDir, `${Date.now()}.json`);
    fs.writeFileSync(file, JSON.stringify(logEntry, null, 2), 'utf8');
    console.log('Saved detection log ->', file);
    res.json({ ok: true, file });
  }catch(err){
    console.error('Error writing log', err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// Endpoint: upload capture (base64 PNG)
app.post('/upload-capture', (req,res) => {
  try{
    const { imageBase64 } = req.body || {};
    if(!imageBase64) return res.status(400).json({ ok:false, error:'missing imageBase64' });

    // imageBase64 expected to be data:image/png;base64,....
    const matches = imageBase64.match(/^data:(image\/\w+);base64,(.+)$/);
    if(!matches) return res.status(400).json({ ok:false, error:'invalid data url' });

    const ext = matches[1].split('/')[1];
    const data = matches[2];
    const buffer = Buffer.from(data, 'base64');

    const filename = `capture_${Date.now()}.${ext}`;
    const filepath = path.join(capturesDir, filename);
    fs.writeFileSync(filepath, buffer);
    console.log('Saved capture ->', filepath);

    res.json({ ok:true, filename, path: `/captures/${filename}` });
  }catch(err){
    console.error('Error uploading capture', err);
    res.status(500).json({ ok:false, error:String(err) });
  }
});

// serve captures and logs for download
app.use('/captures', express.static(capturesDir));
app.use('/logs', express.static(logsDir));

// fallback for SPA
app.get('*', (req,res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(PORT, ()=> {
  console.log(`Server started on http://localhost:${PORT}`);
});

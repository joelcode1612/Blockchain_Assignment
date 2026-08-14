require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const escrowRoutes = require('./routes/escrowRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const milestoneRoutes = require('./routes/milestoneRoutes');
const agreementRoutes = require('./routes/agreementRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const staticPath = path.join(__dirname, '../frontend');
app.use(express.static(staticPath));
app.use('/abi', express.static(path.join(__dirname, '../abi')));

// Serve static assets (CSS and JS) from their respective folders
app.use('/css', express.static(path.join(__dirname, '../frontend/css')));
app.use('/js', express.static(path.join(__dirname, '../frontend/js')));

app.use('/api/escrow', escrowRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/milestones', milestoneRoutes);
app.use('/api/agreements', agreementRoutes);

// Page router — maps clean URLs to the existing page files
const pagesRouter = require('./routes/pagesRoutes');
app.use(pagesRouter);

// API health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server running' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
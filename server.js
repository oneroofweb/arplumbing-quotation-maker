const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey123';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Setup default admin user if no users exist
async function setupDefaultUser() {
  const count = await prisma.user.count();
  if (count === 0) {
    const hashedPassword = await bcrypt.hash('Athar@#1997', 10);
    await prisma.user.create({
      data: {
        username: 'admin',
        password: hashedPassword
      }
    });
    console.log('Default user created: admin / Athar@#1997');
  }
}
setupDefaultUser();

// Auth endpoint
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await prisma.user.findUnique({ where: { username } });
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all clients
app.get('/api/clients', async (req, res) => {
  try {
    const clients = await prisma.client.findMany();
    res.json(clients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a client
app.post('/api/clients', async (req, res) => {
  try {
    const client = await prisma.client.create({ data: req.body });
    res.json(client);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a client
app.delete('/api/clients/:id', async (req, res) => {
  try {
    await prisma.client.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'Client deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all products
app.get('/api/products', async (req, res) => {
  try {
    const products = await prisma.product.findMany();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a product
app.post('/api/products', async (req, res) => {
  try {
    const product = await prisma.product.create({ data: req.body });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a product
app.delete('/api/products/:id', async (req, res) => {
  try {
    await prisma.product.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Update a product
app.put('/api/products/:id', async (req, res) => {
  try {
    const product = await prisma.product.update({
      where: { id: parseInt(req.params.id) },
      data: req.body
    });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Terms endpoints
app.get('/api/terms', async (req, res) => {
  try {
    const terms = await prisma.predefinedTerm.findMany();
    res.json(terms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/terms', async (req, res) => {
  try {
    const term = await prisma.predefinedTerm.create({ data: req.body });
    res.json(term);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/terms/:id', async (req, res) => {
  try {
    const term = await prisma.predefinedTerm.update({
      where: { id: parseInt(req.params.id) },
      data: req.body
    });
    res.json(term);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/terms/:id', async (req, res) => {
  try {
    await prisma.predefinedTerm.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'Term deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Quotations endpoints
app.get('/api/next-quotation-no', async (req, res) => {
  try {
    const lastQuote = await prisma.quotation.findFirst({
      orderBy: { id: 'desc' }
    });
    let nextNo = 1001;
    if (lastQuote && lastQuote.quotationNo) {
      const match = lastQuote.quotationNo.match(/(\d+)$/);
      if (match) {
        nextNo = parseInt(match[1]) + 1;
      } else {
        nextNo = lastQuote.id + 1001;
      }
    }
    res.json({ nextNo: `QT-${nextNo}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/quotations', async (req, res) => {
  try {
    const { clientId, clientName, clientMobile, clientAddress, ...quotationData } = req.body;
    let client;
    if (clientId) {
      client = await prisma.client.findUnique({ where: { id: parseInt(clientId) } });
    }
    
    if (!client && clientName) {
      // Auto-create client if not exists
      client = await prisma.client.create({
        data: {
          name: clientName,
          mobile: clientMobile || '',
          address: clientAddress || ''
        }
      });
    }

    if (!client) {
      return res.status(400).json({ error: "Client is required" });
    }

    // Ensure numeric values for ID and json for arrays are handled properly
    // Check if quote exists
    const existing = await prisma.quotation.findUnique({ where: { quotationNo: quotationData.quotationNo } });
    let quote;
    
    if (existing) {
      quote = await prisma.quotation.update({
        where: { quotationNo: quotationData.quotationNo },
        data: { ...quotationData, clientId: client.id }
      });
    } else {
      quote = await prisma.quotation.create({
        data: { ...quotationData, clientId: client.id }
      });
    }
    res.json(quote);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/quotations', async (req, res) => {
  try {
    const quotes = await prisma.quotation.findMany({ include: { client: true } });
    res.json(quotes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/quotations/:quotationNo', async (req, res) => {
  try {
    const quote = await prisma.quotation.findUnique({
      where: { quotationNo: req.params.quotationNo },
      include: { client: true }
    });
    if (!quote) return res.status(404).json({ error: "Not found" });
    res.json(quote);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a quotation
app.delete('/api/quotations/:id', async (req, res) => {
  try {
    await prisma.quotation.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'Quotation deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Company Profile endpoints
app.get('/api/company', async (req, res) => {
  try {
    let company = await prisma.companyProfile.findFirst();
    if (!company) {
      company = {
        name: 'A. R. Plumbing Works',
        address: 'N No.65/O.No.34, Dr. Besant Road, Royapettah, Chennai, 600014, India',
        phone: '+91 81484 23204',
        email: 'arplumbing@gmail.com',
        signature: null
      };
    }
    res.json(company);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/company', async (req, res) => {
  try {
    const data = req.body;
    let company = await prisma.companyProfile.findFirst();
    if (company) {
      company = await prisma.companyProfile.update({
        where: { id: company.id },
        data
      });
    } else {
      company = await prisma.companyProfile.create({
        data
      });
    }
    res.json(company);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

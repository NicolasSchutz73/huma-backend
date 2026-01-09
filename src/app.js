const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user_routes');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Routes
app.use('/health', healthRoutes);
app.use('/auth', authRoutes);
app.use('/users', userRoutes);

// Hello World Route
app.get('/', (req, res) => {
  res.send('Hello World!');
});

module.exports = app;
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('./db/init');
const requestId = require('./middleware/requestId');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user_routes');
const checkinRoutes = require('./routes/checkins');
const feedbackRoutes = require('./routes/feedbacks');
const teamRoutes = require('./routes/team');

const app = express();

// Middleware
app.disable('x-powered-by');
app.use(helmet());
app.use(cors());
app.use(requestId);
morgan.token('id', (req) => req.id);
app.use(morgan(':id :method :url :status :response-time ms'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Routes
app.use('/health', healthRoutes);
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/checkins', checkinRoutes);
app.use('/feedbacks', feedbackRoutes);
app.use('/team', teamRoutes);

// Hello World Route
app.get('/', (req, res) => {
  res.send('Hello World!');
});

// Fallbacks
app.use(notFound);
app.use(errorHandler);

module.exports = app;

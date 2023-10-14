// External Libraries
import express from 'express';
import dotenv from 'dotenv';
import expressLayouts from 'express-ejs-layouts';

// Routes
import homeRoutes from './routes/homeRoutes.js';
import syncRoutes from './routes/syncRoutes.js';

dotenv.config();

// App Configuration Variables
const PORT = process.env.PORT || 3000;

const app = express();

// Middleware Configuration
app.use(express.static('public'));
app.use(expressLayouts);
app.set('view engine', 'ejs');

// Routes
app.use(homeRoutes);
app.use(syncRoutes);

// 404 Not Found Handler
app.use((req, res, next) => {
    res.status(404).send('Not Found');
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});

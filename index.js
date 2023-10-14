// External Libraries
import express from 'express';
import dotenv from 'dotenv';
import expressLayouts from 'express-ejs-layouts';

// Routes
import homeRoutes from './routes/homeRoutes.js';
import syncRoutes from './routes/syncRoutes.js';

dotenv.config();

//app.locals.debug = process.env.DEBUG || false;
const DB_URL = process.env.DB_URL;
const PORT = process.env.PORT || 3000;

const app = express();

// App Configuration
app.use(express.static('public'));
app.use(expressLayouts);
app.set('view engine', 'ejs');

app.use(homeRoutes);
app.use(syncRoutes);

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});

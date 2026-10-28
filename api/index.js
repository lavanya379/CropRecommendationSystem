/**
 * Vercel Serverless Function Entry Point for CropAI Express API
 */
require('dotenv').config();
const app = require('../backend/src/app');

module.exports = app;

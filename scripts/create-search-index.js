const mongoose = require('mongoose');
require('dotenv').config();

async function createIndex() {
  await mongoose.connect(process.env.MONGODB_URI);
  await mongoose.connection.collection('users').createIndex({
    name: 'text', company: 'text', role: 'text',
    headline: 'text', skills: 'text', location: 'text'
  });
  console.log('Search index created successfully');
  process.exit(0);
}
createIndex();

// makeadmin.js — Run this to make any user an admin
// Usage: node makeadmin.js saadshahzad075@gmail.com

require('dotenv').config();
const mongoose = require('mongoose');

const email = process.argv[2] || 'saadshahzad075@gmail.com';

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/everzio');

mongoose.connection.once('open', async () => {
  const result = await mongoose.connection.db
    .collection('users')
    .updateOne({ email }, { $set: { role: 'admin' } });

  console.log('');
  if (result.modifiedCount === 1) {
    console.log('✅ SUCCESS! Admin ban gaya:');
    console.log('   Email:', email);
    console.log('');
    console.log('Ab website pe login karo aur Account > Open Admin Panel click karo!');
  } else if (result.matchedCount === 1) {
    console.log('ℹ️  Yeh user pehle se admin hai:', email);
  } else {
    console.log('❌ User nahi mila:', email);
    console.log('   Pehle website pe account banao, phir yeh run karo.');
  }
  console.log('');
  mongoose.disconnect();
});

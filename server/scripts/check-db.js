require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.$queryRawUnsafe('SELECT 1')
  .then(() => { console.log('DB: CONNECTED'); process.exit(0); })
  .catch(e => { console.log('DB: OFFLINE -', e.message.split('\n')[0]); process.exit(0); });

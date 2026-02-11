#!/usr/bin/env node

/**
 * Test Snowflake Connection
 *
 * This script tests your Snowflake credentials without exposing them.
 * Run: node test-snowflake-connection.js
 */

require('dotenv').config();
const snowflake = require('snowflake-sdk');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testConnection() {
  log('\n🔍 Testing Snowflake Connection...', 'cyan');
  log('━'.repeat(50), 'cyan');

  // Check environment variables
  log('\n📋 Checking Environment Variables:', 'cyan');

  const requiredVars = [
    'SNOWFLAKE_ACCOUNT',
    'SNOWFLAKE_USERNAME',
    'SNOWFLAKE_PASSWORD',
    'SNOWFLAKE_DATABASE',
    'SNOWFLAKE_WAREHOUSE',
  ];

  let missingVars = [];

  requiredVars.forEach(varName => {
    if (process.env[varName]) {
      // Mask the value for security
      const value = process.env[varName];
      const masked = varName === 'SNOWFLAKE_PASSWORD'
        ? '***' + value.slice(-3)
        : value.substring(0, 20) + (value.length > 20 ? '...' : '');
      log(`  ✅ ${varName}: ${masked}`, 'green');
    } else {
      log(`  ❌ ${varName}: NOT SET`, 'red');
      missingVars.push(varName);
    }
  });

  if (missingVars.length > 0) {
    log(`\n❌ Missing environment variables: ${missingVars.join(', ')}`, 'red');
    log('   Add them to your .env file', 'yellow');
    process.exit(1);
  }

  // Create connection
  log('\n🔌 Connecting to Snowflake...', 'cyan');

  const connection = snowflake.createConnection({
    account: process.env.SNOWFLAKE_ACCOUNT,
    username: process.env.SNOWFLAKE_USERNAME,
    password: process.env.SNOWFLAKE_PASSWORD,
    database: process.env.SNOWFLAKE_DATABASE,
    schema: process.env.SNOWFLAKE_SCHEMA || 'PUBLIC',
    warehouse: process.env.SNOWFLAKE_WAREHOUSE,
  });

  return new Promise((resolve, reject) => {
    connection.connect((err) => {
      if (err) {
        log(`\n❌ Connection Failed:`, 'red');
        log(`   ${err.message}`, 'red');

        // Provide helpful error messages
        if (err.message.includes('Incorrect username or password')) {
          log('\n💡 Tip: Check your SNOWFLAKE_USERNAME and SNOWFLAKE_PASSWORD', 'yellow');
        } else if (err.message.includes('account')) {
          log('\n💡 Tip: Check your SNOWFLAKE_ACCOUNT format', 'yellow');
          log('   Should be: account.region.snowflakecomputing.com', 'yellow');
        } else if (err.message.includes('warehouse')) {
          log('\n💡 Tip: Check your SNOWFLAKE_WAREHOUSE exists and is not suspended', 'yellow');
        }

        reject(err);
        return;
      }

      log('✅ Connected successfully!', 'green');

      // Test query
      log('\n🧪 Testing Query...', 'cyan');

      connection.execute({
        sqlText: 'SELECT CURRENT_VERSION() as version, CURRENT_USER() as user, CURRENT_DATABASE() as database, CURRENT_WAREHOUSE() as warehouse',
        complete: (err, stmt, rows) => {
          connection.destroy();

          if (err) {
            log(`❌ Query Failed: ${err.message}`, 'red');
            reject(err);
            return;
          }

          log('✅ Query executed successfully!', 'green');

          if (rows && rows.length > 0) {
            log('\n📊 Connection Details:', 'cyan');
            const row = rows[0];
            log(`  Version:   ${row.VERSION}`, 'green');
            log(`  User:      ${row.USER}`, 'green');
            log(`  Database:  ${row.DATABASE}`, 'green');
            log(`  Warehouse: ${row.WAREHOUSE}`, 'green');
          }

          log('\n✅ All tests passed!', 'green');
          log('   Your Snowflake connection is working correctly.', 'green');
          log('\n   You can now use the member lookup API! 🚀', 'cyan');

          resolve();
        }
      });
    });
  });
}

// Run test
testConnection()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Test failed');
    process.exit(1);
  });

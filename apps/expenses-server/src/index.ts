import 'dotenv/config';
import { config } from './config';

console.log('🚀 Expense Server Configuration Loaded');
console.log(`   Environment: ${config.NODE_ENV}`);
console.log(`   Port: ${config.PORT}`);
console.log(`   Server URL: ${config.SERVER_URL}`);
console.log(`   Database Path: ${config.DATABASE_PATH}`);
console.log(`   Descope Project ID: ${config.DESCOPE_PROJECT_ID.substring(0, 8)}...`);

// Server setup will be added in Phase 1
console.log('\n✅ Phase 0 Complete - Configuration working!');
console.log('   Run Phase 1 to set up Express server with MCP wrapper.');

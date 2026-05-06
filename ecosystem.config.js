// PM2 ecosystem configuration for staging + production on the same EC2 instance.
// Each app runs from its own directory and listens on its own port.
// Deploy each app separately: `pm2 start ecosystem.config.js --only app-staging`

module.exports = {
  apps: [
    {
      name: 'app-staging',
      script: 'dist/main.js',
      cwd: '/var/www/app-staging/current',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'staging',
        PORT: 3001,
      },
      error_file: '/var/log/pm2/app-staging-error.log',
      out_file: '/var/log/pm2/app-staging-out.log',
      time: true,
    },
    {
      name: 'app-production',
      script: 'dist/main.js',
      cwd: '/var/www/app-production/current',
      instances: 'max',
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: '/var/log/pm2/app-production-error.log',
      out_file: '/var/log/pm2/app-production-out.log',
      time: true,
    },
  ],
};
